import test from "node:test";
import assert from "node:assert/strict";
import {
  decode,
  getPrimaryDomain,
  getSecFetchSite,
  computeRefererAndOrigin,
  computeStorageAccess,
  computeOutgoingHeaders,
} from "./headerTransform.js";

// ---------------------------------------------------------------------------
// Helpers for building __cpo-encoded "incoming referer" values, exactly as
// our own proxy would have produced them on a previous hop (i.e. what the
// browser sends back to us as Referer once it's navigated to a proxied page).
// ---------------------------------------------------------------------------
function encodeOrigin(origin) {
  return Buffer.from(origin).toString("base64").replace(/=+$/, "");
}

function proxiedReferer(proxyHost, upstreamUrl) {
  const u = new URL(upstreamUrl);
  const encoded = encodeOrigin(u.origin);
  const out = new URL(u.pathname + u.search, `https://${proxyHost}`);
  out.searchParams.set("__cpo", encoded);
  return out.toString();
}

const PROXY_HOST = "localhost:8000";

// ---------------------------------------------------------------------------
// getPrimaryDomain / getSecFetchSite
// ---------------------------------------------------------------------------

test("getPrimaryDomain extracts the registrable domain", () => {
  assert.equal(getPrimaryDomain("player.videasy.to"), "videasy.to");
  assert.equal(getPrimaryDomain("db.videasy.to"), "videasy.to");
  assert.equal(getPrimaryDomain("api.videasy.to"), "videasy.to");
  assert.equal(getPrimaryDomain("videasy.to"), "videasy.to");
  assert.equal(getPrimaryDomain("something-stupid.vercel.app"), "vercel.app");
  assert.equal(getPrimaryDomain(""), "");
});

test("getSecFetchSite: same-origin", () => {
  assert.equal(
    getSecFetchSite("https://player.videasy.to", "https://player.videasy.to"),
    "same-origin"
  );
});

test("getSecFetchSite: same-site across subdomains (db/api/player.videasy.to)", () => {
  assert.equal(
    getSecFetchSite("https://player.videasy.to", "https://db.videasy.to"),
    "same-site"
  );
  assert.equal(
    getSecFetchSite("https://player.videasy.to", "https://api.videasy.to"),
    "same-site"
  );
});

test("getSecFetchSite: cross-site across unrelated registrable domains", () => {
  assert.equal(
    getSecFetchSite("https://something-stupid.vercel.app", "https://player.videasy.to"),
    "cross-site"
  );
  assert.equal(
    getSecFetchSite("https://player.videasy.to", "https://www.aliexpress.com"),
    "cross-site"
  );
});

test("getSecFetchSite: no realOrigin -> cross-site (conservative default)", () => {
  assert.equal(getSecFetchSite(null, "https://player.videasy.to"), "cross-site");
});

// ---------------------------------------------------------------------------
// computeRefererAndOrigin -- the core bug fix.
// Each case below is taken directly from the supplied network capture
// (document 2: real Chrome curl/fetch exports).
// ---------------------------------------------------------------------------

test("Referer: cross-site navigation into iframe -> origin only, trailing slash (CAPTURED CASE)", () => {
  // Real capture:
  //   fetch player.videasy.to/tv/71728/2/6
  //   referrer: "https://something-stupid.vercel.app/"
  const incoming = proxiedReferer(PROXY_HOST, "https://something-stupid.vercel.app/watch/tv/71728/2/6");
  const { referer, realOrigin } = computeRefererAndOrigin(incoming, "https://player.videasy.to");

  assert.equal(referer, "https://something-stupid.vercel.app/");
  assert.equal(realOrigin, "https://something-stupid.vercel.app");
});

test("Referer: same-site subresource (player -> db.videasy.to) -> origin only (CAPTURED CASE)", () => {
  // Real capture:
  //   curl db.videasy.to/.../season/2
  //   referer: https://player.videasy.to/
  // NOTE: the captured referer is bare-origin even though the actual page is
  // /tv/71728/2/6, because this is itself a cross-origin (different subdomain)
  // request from the player page, which still triggers origin-only truncation
  // under strict-origin-when-cross-origin (it only preserves full path for
  // same-ORIGIN, not same-SITE).
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer, realOrigin } = computeRefererAndOrigin(incoming, "https://db.videasy.to");

  assert.equal(referer, "https://player.videasy.to/");
  assert.equal(realOrigin, "https://player.videasy.to");
});

test("Referer: same-site subresource (player -> api.videasy.to) -> origin only (CAPTURED CASE)", () => {
  // Real capture: curl api.videasy.to/mb-flix/sources-with-title...
  //   referer: https://player.videasy.to/
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer } = computeRefererAndOrigin(incoming, "https://api.videasy.to");

  assert.equal(referer, "https://player.videasy.to/");
});

test("Referer: same-origin script fetch -> full path preserved (CAPTURED CASE)", () => {
  // Real capture: curl player.videasy.to/scripts/ab.js
  //   referer: https://player.videasy.to/tv/71728/2/6   <-- FULL PATH, same-origin
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer, realOrigin } = computeRefererAndOrigin(incoming, "https://player.videasy.to");

  assert.equal(referer, "https://player.videasy.to/tv/71728/2/6");
  assert.equal(realOrigin, "https://player.videasy.to");
});

test("Referer: same-origin module.wasm fetch -> full path preserved (CAPTURED CASE)", () => {
  // Real capture: curl player.videasy.to/module.wasm
  //   referer: https://player.videasy.to/tv/71728/2/6
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer } = computeRefererAndOrigin(incoming, "https://player.videasy.to");

  assert.equal(referer, "https://player.videasy.to/tv/71728/2/6");
});

test("Referer: cross-site segment fetch (player -> goldweather CDN) -> origin only (CAPTURED CASE)", () => {
  // Real capture: curl joe.goldweather.net/.../seg-19-v1-a1.ts
  //   referer: https://player.videasy.to/
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer } = computeRefererAndOrigin(incoming, "https://joe.goldweather.net");

  assert.equal(referer, "https://player.videasy.to/");
});

test("Referer: query string kept on same-origin, hash always dropped per spec", () => {
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6?x=1#section");
  const { referer } = computeRefererAndOrigin(incoming, "https://player.videasy.to");
  assert.equal(referer, "https://player.videasy.to/tv/71728/2/6?x=1");
});

test("Referer: https -> http downgrade sends no referer", () => {
  const incoming = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const { referer } = computeRefererAndOrigin(incoming, "http://insecure-target.example");
  assert.equal(referer, undefined);
});

test("Referer: no incoming referer -> no outgoing referer", () => {
  const { referer, realOrigin } = computeRefererAndOrigin(undefined, "https://player.videasy.to");
  assert.equal(referer, undefined);
  assert.equal(realOrigin, null);
});

test("Referer: non-encoded external referer still gets origin/full-path treatment", () => {
  // e.g. a request arrives at our proxy carrying a raw, un-encoded third-party referer
  // (happens for assets the rewriter didn't touch, or browser-internal navigations).
  const { referer } = computeRefererAndOrigin(
    "https://www.aliexpress.com/p/popular-landing/aliexpress.html?_immersiveMode=true",
    "https://assets.aliexpress-media.com"
  );
  assert.equal(referer, "https://www.aliexpress.com/");
});

// ---------------------------------------------------------------------------
// computeStorageAccess
// ---------------------------------------------------------------------------

test("storage-access: present on cross-site iframe navigation (CAPTURED CASE: player.videasy.to/tv/.../2/6)", () => {
  const v = computeStorageAccess({
    secFetchSite: "cross-site",
    secFetchMode: "navigate",
    secFetchDest: "iframe",
  });
  assert.equal(v, "active");
});

test("storage-access: present on same-origin script fetch (CAPTURED CASE: scripts/ab.js)", () => {
  const v = computeStorageAccess({
    secFetchSite: "same-origin",
    secFetchMode: "no-cors",
    secFetchDest: "script",
  });
  assert.equal(v, "active");
});

test("storage-access: present on same-origin empty/cors fetch (CAPTURED CASE: module.wasm)", () => {
  const v = computeStorageAccess({
    secFetchSite: "same-origin",
    secFetchMode: "cors",
    secFetchDest: "empty",
  });
  assert.equal(v, "active");
});

test("storage-access: absent on same-site API fetch (CAPTURED CASE: db.videasy.to, api.videasy.to)", () => {
  const v = computeStorageAccess({
    secFetchSite: "same-site",
    secFetchMode: "cors",
    secFetchDest: "empty",
  });
  assert.equal(v, undefined);
});

test("storage-access: absent on cross-site segment fetch (CAPTURED CASE: goldweather CDN .ts)", () => {
  const v = computeStorageAccess({
    secFetchSite: "cross-site",
    secFetchMode: "cors",
    secFetchDest: "empty",
  });
  assert.equal(v, undefined);
});

test("storage-access: absent when sec-fetch-site missing entirely (non-Chrome / no fetch metadata)", () => {
  const v = computeStorageAccess({});
  assert.equal(v, undefined);
});

// ---------------------------------------------------------------------------
// computeOutgoingHeaders -- full integration of the per-request rewrite,
// exercised against the same scenarios end-to-end.
// ---------------------------------------------------------------------------

test("sec-fetch-dest: document+navigate+referer -> iframe (CAPTURED CASE: player.videasy.to/tv/71728/2/6)", () => {
  // New log shows: sec-fetch-dest: 'document' going to player.videasy.to
  // Real Chrome sends: sec-fetch-dest: 'iframe' because it's embedded via <iframe src=...>
  // Distinguishing signal: a navigate WITH a referer is always an iframe nav, not top-level.
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://something-stupid.vercel.app/watch/tv/71728/2/6");
  const incoming = {
    referer: incomingReferer,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
  };
  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/tv/71728/2/6", PROXY_HOST, "GET");
  assert.equal(out["sec-fetch-dest"], "iframe");
});

test("sec-fetch-dest: document+navigate WITHOUT referer stays document (true top-level nav)", () => {
  // No referer = user navigated directly (address bar, bookmark) -- stays document.
  const incoming = {
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
  };
  const out = computeOutgoingHeaders(incoming, "https://something-stupid.vercel.app/watch/tv/71728/2/6", PROXY_HOST, "GET");
  assert.equal(out["sec-fetch-dest"], "document");
});

test("sec-fetch-dest: non-navigate dests are never transformed", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  for (const dest of ["script", "empty", "style", "image", "font"]) {
    const incoming = {
      referer: incomingReferer,
      "sec-fetch-dest": dest,
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };
    const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/x", PROXY_HOST, "GET");
    assert.equal(out["sec-fetch-dest"], dest, `dest=${dest} should be unchanged`);
  }
});

test("full headers: cross-site iframe navigation matches captured shape", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://something-stupid.vercel.app/watch/tv/71728/2/6");
  const incoming = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    referer: incomingReferer,
    "sec-fetch-dest": "document",   // browser sends "document" to OUR proxy
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-storage-access": "active",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 test-agent",
  };

  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/tv/71728/2/6", PROXY_HOST, "GET");

  assert.equal(out["sec-fetch-dest"], "iframe");  // transformed to iframe for upstream
  assert.equal(out.referer, "https://something-stupid.vercel.app/");
  assert.equal(out["sec-fetch-site"], "cross-site");
  assert.equal(out["sec-fetch-storage-access"], "active");
  assert.equal(out.host, "player.videasy.to");
  assert.equal(out.origin, "https://something-stupid.vercel.app");
});

test("full headers: same-site db.videasy.to API call matches captured shape", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const incoming = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    referer: incomingReferer,
    origin: `https://${PROXY_HOST}`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
  };

  const out = computeOutgoingHeaders(incoming, "https://db.videasy.to/3/tv/71728/season/2", PROXY_HOST, "GET");

  assert.equal(out.referer, "https://player.videasy.to/");
  assert.equal(out["sec-fetch-site"], "same-site");
  assert.equal(out["sec-fetch-storage-access"], undefined);
  assert.equal(out.origin, "https://player.videasy.to");
});

test("full headers: same-origin scripts/ab.js call matches captured shape", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const incoming = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    referer: incomingReferer,
    "sec-fetch-dest": "script",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-site": "same-origin",
  };

  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/scripts/ab.js", PROXY_HOST, "GET");

  assert.equal(out.referer, "https://player.videasy.to/tv/71728/2/6");
  assert.equal(out["sec-fetch-site"], "same-origin");
  assert.equal(out["sec-fetch-storage-access"], "active");
  assert.equal(out.origin, undefined);
});

test("full headers: cross-site CDN segment fetch (goldweather) matches captured shape", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const incoming = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    referer: incomingReferer,
    origin: `https://${PROXY_HOST}`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
  };

  const out = computeOutgoingHeaders(
    incoming,
    "https://joe.goldweather.net/abcXYZ/seg-19-v1-a1.ts",
    PROXY_HOST,
    "GET"
  );

  assert.equal(out.referer, "https://player.videasy.to/");
  assert.equal(out["sec-fetch-site"], "cross-site");
  assert.equal(out["sec-fetch-storage-access"], undefined);
  assert.equal(out.origin, "https://player.videasy.to");
});

test("full headers: POST request keeps origin even when same-origin", () => {
  const incomingReferer = proxiedReferer(PROXY_HOST, "https://player.videasy.to/tv/71728/2/6");
  const incoming = {
    referer: incomingReferer,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };

  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/api/submit", PROXY_HOST, "POST");
  assert.equal(out.origin, "https://player.videasy.to");
});

test("full headers: accept-encoding always normalized regardless of input", () => {
  const out = computeOutgoingHeaders(
    { "accept-encoding": "weird, unsupported" },
    "https://player.videasy.to/x",
    PROXY_HOST,
    "GET"
  );
  assert.equal(out["accept-encoding"], "gzip, deflate, br");
});

test("full headers: content-length stripped (let axios recompute for proxied body)", () => {
  const out = computeOutgoingHeaders(
    { "content-length": "12345" },
    "https://player.videasy.to/x",
    PROXY_HOST,
    "POST"
  );
  assert.equal(out["content-length"], undefined);
});

// ---------------------------------------------------------------------------
// Compression Dictionary Transport: Available-Dictionary / Dictionary-ID are
// origin-scoped per RFC 9842 and must never be forwarded upstream, since the
// browser computed them relative to OUR PROXY's origin, not the real target's.
// ---------------------------------------------------------------------------

test("available-dictionary: stripped even when present (CAPTURED CASE: same value sent to every host)", () => {
  // Real capture: every single proxied request across totally unrelated hosts
  // (player.videasy.to, db.videasy.to, joe.goldweather.net, aliexpress.com,
  // googlesyndication.com...) carried the identical hash:
  //   available-dictionary: ':M+11USZfQnewFLD2FBYjLO4fD4nFUyD08rzPIUS+YkI=:'
  // That hash is only ever valid for resources under our proxy's own origin and must
  // be dropped before forwarding anywhere.
  const incoming = {
    "available-dictionary": ":M+11USZfQnewFLD2FBYjLO4fD4nFUyD08rzPIUS+YkI=:",
  };

  const playerOut = computeOutgoingHeaders(incoming, "https://player.videasy.to/tv/71728/2/6", PROXY_HOST, "GET");
  const dbOut = computeOutgoingHeaders(incoming, "https://db.videasy.to/3/tv/71728/season/2", PROXY_HOST, "GET");
  const cdnOut = computeOutgoingHeaders(incoming, "https://joe.goldweather.net/seg.ts", PROXY_HOST, "GET");
  const adOut = computeOutgoingHeaders(incoming, "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", PROXY_HOST, "GET");

  assert.equal(playerOut["available-dictionary"], undefined);
  assert.equal(dbOut["available-dictionary"], undefined);
  assert.equal(cdnOut["available-dictionary"], undefined);
  assert.equal(adOut["available-dictionary"], undefined);
});

test("dictionary-id: stripped when present (companion header to available-dictionary, same origin-scoping rule)", () => {
  const out = computeOutgoingHeaders(
    { "dictionary-id": '"some-server-assigned-id"' },
    "https://player.videasy.to/x",
    PROXY_HOST,
    "GET"
  );
  assert.equal(out["dictionary-id"], undefined);
});

// ---------------------------------------------------------------------------
// Cookie scoping regression check (pre-existing behavior, verifying the
// refactor didn't disturb it)
// ---------------------------------------------------------------------------

test("cookies: only forwards cookies scoped to the target hostname or its parent", () => {
  const incoming = {
    cookie:
      "session@player.videasy.to=abc123; other@unrelated.example=zzz; tracking@videasy.to=parent-scoped",
    "sec-fetch-site": "same-origin",
  };
  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/x", PROXY_HOST, "GET");
  assert.equal(out.cookie, "session=abc123; tracking=parent-scoped");
});

test("cookies: empty cookie header is removed entirely, not sent blank", () => {
  const incoming = { cookie: "unrelated@nomatch.example=zzz" };
  const out = computeOutgoingHeaders(incoming, "https://player.videasy.to/x", PROXY_HOST, "GET");
  assert.equal(out.cookie, undefined);
});

// ---------------------------------------------------------------------------
// decode() regression check
// ---------------------------------------------------------------------------

test("decode: round-trips a proxied referer back to the original upstream URL", () => {
  const original = "https://player.videasy.to/tv/71728/2/6?foo=bar";
  const encoded = proxiedReferer(PROXY_HOST, original);
  assert.equal(decode(encoded), original);
});

test("decode: returns null for URLs without the __cpo param", () => {
  assert.equal(decode(`https://${PROXY_HOST}/some/path`), null);
});