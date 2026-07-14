import { URL } from "url";

const PROXY_QUERY_PARAM = "__cpo";

/**
 * Decodes the proxied target URL from the incoming request query parameters.
 */
function decode(currentUrl, p = PROXY_QUERY_PARAM) {
  try {
    const url = new URL(currentUrl);
    const encoded = url.searchParams.get(p);
    if (!encoded) return null;

    url.searchParams.delete(p);

    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("cp:parser")) {
        url.searchParams.delete(key);
      }
    }

    const base = new URL(
      Buffer.from(encoded, "base64").toString("utf8")
    );

    base.pathname = url.pathname;
    base.search = url.search;
    base.hash = url.hash;

    return base.toString();
  } catch (e) {
    return null;
  }
}

/**
 * Resolves the primary/registrable domain (e.g. videasy.to) for same-site evaluation.
 *
 * NOTE: simplified eTLD+1 approximation (last two labels). Does not consult the Public
 * Suffix List, so multi-part public suffixes (co.uk, com.au, etc.) are misclassified.
 */
function getPrimaryDomain(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }
  return host;
}

/**
 * Classifies the relationship between the requesting page origin and the target origin
 * per the Fetch spec Sec-Fetch-Site algorithm: same-origin > same-site > cross-site > none.
 *
 * `none` is its own outcome, distinct from `cross-site`: it means there is no initiator
 * at all (the user typed the URL, used a bookmark, or the browser triggered the navigation
 * with no referring document — e.g. opening a new tab). `cross-site` means there IS an
 * initiator, but it's on an unrelated origin. Collapsing the two is wrong and is exactly
 * what real Chrome does NOT do — entry navigations into the proxy were observed sending
 * `sec-fetch-site: none` upstream in real (unproxied) traffic, never `cross-site`.
 *
 * @param {string|null} realOrigin - the origin of the referring page, or null/undefined
 *   if there genuinely is no referring page (not "unknown" — actually absent).
 * @param {string} targetOrigin - the origin being requested.
 */
function getSecFetchSite(realOrigin, targetOrigin) {
  if (!realOrigin) return "none";
  if (realOrigin === targetOrigin) return "same-origin";

  try {
    const realHost = new URL(realOrigin).hostname;
    const targetHost = new URL(targetOrigin).hostname;

    if (getPrimaryDomain(realHost) === getPrimaryDomain(targetHost)) {
      return "same-site";
    }
  } catch (e) {}

  return "cross-site";
}

/**
 * Computes the outgoing Referer header and "real" requesting origin per
 * Chrome's default Referrer-Policy: strict-origin-when-cross-origin.
 *
 *   same-origin  → full URL (no fragment)
 *   cross-origin → origin only (scheme + host + port + "/")
 *   https→http   → no referer
 */
function computeRefererAndOrigin(rawIncomingReferer, targetOrigin) {
  if (!rawIncomingReferer) {
    return { referer: undefined, realOrigin: null };
  }

  // Defensive normalization: this function is documented and tested as a pure,
  // independently-callable unit, so it shouldn't silently misbehave if a caller
  // passes a full target URL (with path/query) instead of a bare origin — only
  // the origin (scheme + host + port) is ever meaningful for same-origin/cross-origin
  // comparison.
  let normalizedTargetOrigin;
  try {
    normalizedTargetOrigin = new URL(targetOrigin).origin;
  } catch (e) {
    normalizedTargetOrigin = targetOrigin;
  }

  let refererSourceUrl;
  let realOrigin;
  let decodedFull;

  const decodedReferer = decode(rawIncomingReferer);

  if (decodedReferer) {
    decodedFull = decodedReferer;
    refererSourceUrl = new URL(decodedReferer);
    realOrigin = refererSourceUrl.origin;
  } else {
    try {
      refererSourceUrl = new URL(rawIncomingReferer);
    } catch (e) {
      return { referer: undefined, realOrigin: null };
    }
    decodedFull = rawIncomingReferer;
    realOrigin = refererSourceUrl.origin;
  }

  // Downgrade protection: https page → http target sends no referer.
  const targetUrlObj = new URL(normalizedTargetOrigin);
  if (refererSourceUrl.protocol === "https:" && targetUrlObj.protocol === "http:") {
    return { referer: undefined, realOrigin };
  }

  let referer;
  if (realOrigin === normalizedTargetOrigin) {
    // Same-origin: full URL, no fragment.
    const u = new URL(decodedFull);
    u.hash = "";
    referer = u.toString();
  } else {
    // Cross-origin: origin only, trailing slash, no path/query/hash.
    referer = realOrigin + "/";
  }

  return { referer, realOrigin };
}

/**
 * Computes whether Sec-Fetch-Storage-Access should be sent and with what value.
 *
 * This header reflects live Storage Access API permission state the proxy can't fully
 * reconstruct. Pattern from captured traffic: present on same-origin requests and
 * top-level/iframe navigations; absent on same-site and cross-site subresource fetches.
 */
function computeStorageAccess({ secFetchSite, secFetchMode, secFetchDest }) {
  if (!secFetchSite) return undefined;

  const isNavigation =
    secFetchMode === "navigate" &&
    (secFetchDest === "iframe" || secFetchDest === "document");

  if (secFetchSite === "same-origin") return "active";
  if (isNavigation) return "active";

  return undefined;
}

/**
 * Builds the full set of outgoing request headers for a single proxied call.
 * Pure function — no I/O — so it can be unit-tested independently.
 *
 * @param {string} proxyHost - host:port of our proxy server (e.g. "localhost:8000")
 */
function computeOutgoingHeaders(incomingHeaders, rawHeaders, url, proxyHost, method) {
  // Create a shallow copy of incomingHeaders (Express guarantees req.headers keys are always lowercase)
  const headers = { ...(incomingHeaders || {}) };

  const targetUrlObj = new URL(url);
  const targetHostname = targetUrlObj.hostname;
  const targetOrigin = targetUrlObj.origin;

  headers['host'] = targetHostname;

  // --- REFERER: strict-origin-when-cross-origin ---
  const { referer, realOrigin } = computeRefererAndOrigin(headers['referer'], targetOrigin);

  // If the decoded realOrigin is our own proxy host, the referer is useless to upstream —
  // the browser attached our proxy URL as the referer for a navigation triggered by proxied
  // JS, but the upstream server should never see localhost:8000 as a referring page.
  const proxyOrigins = [
    `http://${proxyHost}`,
    `https://${proxyHost}`,
  ];
  const refererIsProxyHost = realOrigin && proxyOrigins.some(o => realOrigin === o ||
    realOrigin.startsWith(o + "/"));

  if (referer && !refererIsProxyHost) {
    headers['referer'] = referer;
  } else {
    delete headers['referer'];
  }

  // --- ORIGIN & CORS ---
  // If realOrigin is our proxy host, don't forward it — upstream servers must never see
  // localhost:8000 as the origin of a cross-origin request.
  const effectiveRealOrigin = refererIsProxyHost ? null : realOrigin;
  const isCrossOrigin = effectiveRealOrigin && effectiveRealOrigin !== targetOrigin;
  if (isCrossOrigin) {
    headers['origin'] = effectiveRealOrigin;
  } else {
    if (method === "GET" || method === "HEAD") {
      delete headers['origin'];
    } else {
      headers['origin'] = targetOrigin;
    }
  }

  // --- SEC-FETCH-SITE ---
  let secFetchSite = headers["sec-fetch-site"];
  if (secFetchSite) {
    secFetchSite = getSecFetchSite(effectiveRealOrigin, targetOrigin);
    headers["sec-fetch-site"] = secFetchSite;
  }

  // --- SEC-FETCH-DEST: document → iframe when navigate has a referer ---
  // A top-level navigation has no referer; a navigate-into-iframe always does.
  // Only apply if the referer was a real upstream page, not our proxy host.
  if (
    headers["sec-fetch-dest"] === "document" &&
    headers["sec-fetch-mode"] === "navigate" &&
    referer !== undefined &&
    !refererIsProxyHost
  ) {
    headers["sec-fetch-dest"] = "iframe";
  }

  // --- SEC-FETCH-STORAGE-ACCESS ---
  const storageAccess = computeStorageAccess({
    secFetchSite,
    secFetchMode: headers["sec-fetch-mode"],
    secFetchDest: headers["sec-fetch-dest"],
  });
  if (storageAccess) {
    headers["sec-fetch-storage-access"] = storageAccess;
  } else {
    delete headers["sec-fetch-storage-access"];
  }

  // --- OUTGOING COOKIE REWRITING ---
  const cookieHeader = headers['cookie'] || "";
  if (cookieHeader) {
    const outboundCookies = [];
    for (let c of cookieHeader.split(";")) {
      c = c.trim();
      if (!c) continue;
      const eqIdx = c.indexOf("=");
      if (eqIdx === -1) continue;

      const key = c.substring(0, eqIdx);
      const val = c.substring(eqIdx + 1);
      const atIdx = key.lastIndexOf("@");

      if (atIdx !== -1) {
        const realKey = key.substring(0, atIdx);
        const domainSuffix = key.substring(atIdx + 1);

        if (
          targetHostname === domainSuffix ||
          targetHostname.endsWith("." + domainSuffix)
        ) {
          outboundCookies.push(`${realKey}=${val}`);
        }
      }
    }
    headers['cookie'] = outboundCookies.join("; ");
    if (headers['cookie'] === "") delete headers['cookie'];
  }

  delete headers["content-length"];

  // Compression Dictionary Transport headers are same-origin scoped (RFC 9842) and
  // must never be forwarded to a different upstream host.
  delete headers["available-dictionary"];
  delete headers["dictionary-id"];

  // Normalize to encodings Node can safely decompress.
  delete headers["accept-encoding"];
  headers["accept-encoding"] = "gzip, deflate, br";

  // Reconstruct original casing right before returning
  const requestHeaders = {};
  const rawMap = {};
  if (rawHeaders && rawHeaders.length) {
    for (let i = 0; i < rawHeaders.length; i += 2) {
      rawMap[rawHeaders[i].toLowerCase()] = rawHeaders[i];
    }
  }

  for (const [key, val] of Object.entries(headers)) {
    const origKey = rawMap[key] || key.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
    requestHeaders[origKey] = val;
  }

  return requestHeaders;
}

export {
  PROXY_QUERY_PARAM,
  decode,
  getPrimaryDomain,
  getSecFetchSite,
  computeRefererAndOrigin,
  computeStorageAccess,
  computeOutgoingHeaders,
};