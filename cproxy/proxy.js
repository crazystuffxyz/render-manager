import https from "https";
import axios from "axios";
import { pipeline } from "stream/promises";
import zlib from "zlib";
import { URL } from "url";
import * as cheerio from "cheerio";

const PROXY_QUERY_PARAM = "__cpo";

/**
 * Checks if a buffer is actually compressed based on magic bytes and binary contents.
 * Prevents redundant decompression attempts on streams already decoded by Axios/Vercel.
 */
function isBufferCompressed(buf) {
  if (!buf || buf.length < 4) return false;

  // Gzip magic bytes: 1f 8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) return true;

  // Deflate magic bytes: 78 01, 78 9c, 78 da
  if (buf[0] === 0x78 && (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda)) return true;

  // Brotli has no standard magic bytes. Instead, inspect the prefix of the stream for non-printable binary bytes.
  // Plaintext payloads (HTML, JS, CSS, JSON) start with printable ASCII characters.
  for (let i = 0; i < Math.min(buf.length, 24); i++) {
    const byte = buf[i];
    // If we detect control or high-bit binary bytes, it's compressed or a binary format (like WASM/Images)
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte > 0x7e) {
      return true;
    }
  }
  return false;
}

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
 * NOTE: this is a simplified eTLD+1 approximation (last two labels). It does not consult
 * the Public Suffix List, so it will misclassify multi-part public suffixes (co.uk, com.au,
 * etc.) as "same-site" when they aren't. None of the domains observed in the captures this
 * proxy targets (videasy.to, vercel.app trailing off as cross-site, aliexpress.com,
 * alicdn.com, etc.) hit that edge case, but it's a known limitation worth flagging if this
 * proxy is ever pointed at a target using a compound public suffix.
 */
function getPrimaryDomain(host) {
  if (!host) return "";
  const parts = host.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return host;
}

/**
 * Classifies the relationship between the page that's making the request (realOrigin)
 * and the target being requested (targetOrigin), per the Fetch spec's "Sec-Fetch-Site"
 * algorithm: same-origin > same-site > cross-site (none here, since same-origin already
 * implies a referrer is present, and "none" only applies to user-typed/bookmark navigation
 * which a proxied subresource/iframe load never is).
 */
function getSecFetchSite(realOrigin, targetOrigin) {
  if (!realOrigin) return "cross-site";
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
 * Computes the outgoing Referer header value and the "real" requesting origin, following
 * Chrome's default Referrer-Policy: "strict-origin-when-cross-origin".
 *
 * Spec (https://w3c.github.io/webappsec-referrer-policy/#strict-origin-when-cross-origin):
 *   - same-origin request  -> full referrer URL (scheme + host + port + path + query,
 *                              NEVER the fragment/hash -- browsers strip '#...' unconditionally)
 *   - cross-origin request -> referrer ORIGIN ONLY (scheme + host + port + "/"), no path/query
 *   - downgrade (https page -> http target) -> no referrer at all
 *
 * This is the fix for the core bug: the previous implementation always forwarded the full
 * decoded referrer URL verbatim regardless of origin relationship, which is only correct
 * for the same-origin case and leaks/garbles the path for every cross-origin request --
 * exactly the mismatch your network captures show against real Chrome traffic.
 */
function computeRefererAndOrigin(rawIncomingReferer, targetOrigin) {
  if (!rawIncomingReferer) {
    return { referer: undefined, realOrigin: null };
  }

  let refererSourceUrl;
  let realOrigin;
  let decodedFull;

  const decodedReferer = decode(rawIncomingReferer);

  if (decodedReferer) {
    // The browser's request to our proxy carried our own __cpo-encoded referer; decode it
    // back to the real upstream URL the browser's "page" actually corresponds to.
    decodedFull = decodedReferer;
    refererSourceUrl = new URL(decodedReferer);
    realOrigin = refererSourceUrl.origin;
  } else {
    // Not one of our encoded URLs. Either it's our own proxy host (referer should be
    // dropped, since the real page has no equivalent upstream URL) or it's some external
    // domain's referer that arrived untouched (leave realOrigin derived from it, but it
    // still needs full-vs-origin-only treatment below).
    try {
      refererSourceUrl = new URL(rawIncomingReferer);
    } catch (e) {
      return { referer: undefined, realOrigin: null };
    }
    decodedFull = rawIncomingReferer;
    realOrigin = refererSourceUrl.origin;
  }

  // Downgrade protection: https page -> http target sends no referrer at all.
  const targetUrlObj = new URL(targetOrigin);
  if (refererSourceUrl.protocol === "https:" && targetUrlObj.protocol === "http:") {
    return { referer: undefined, realOrigin };
  }

  let referer;
  if (realOrigin === targetOrigin) {
    // Same-origin: full URL, no fragment.
    const u = new URL(decodedFull);
    u.hash = "";
    referer = u.toString();
  } else {
    // Cross-origin (same-site or cross-site): origin only, trailing slash, no path/query/hash.
    referer = realOrigin + "/";
  }

  return { referer, realOrigin };
}

/**
 * Computes whether Sec-Fetch-Storage-Access should be forwarded, and with what value.
 *
 * This header reflects live Storage Access API permission state tracked internally by the
 * browser per (requesting site, top-level site) pair -- state a server-side proxy cannot
 * fully reconstruct, since it depends on prior document.requestStorageAccess() calls and
 * browser-internal grant bookkeeping that isn't observable from request data alone.
 *
 * Pattern observed across the supplied network captures: the header is present with value
 * "active" on (a) the top-level/iframe navigation into the proxied site, and (b) same-origin
 * subresource requests within that site. It is absent on same-site (cross-subdomain) and
 * cross-site subresource requests. We mirror that dominant pattern here. It will not be
 * byte-perfect on every single same-origin request in a long session (Chrome can stop
 * re-asserting it after the grant has already been consumed once per frame), but it matches
 * the captured traffic far better than never sending it at all, which was the prior bug.
 */
function computeStorageAccess({ secFetchSite, secFetchMode, secFetchDest }) {
  if (!secFetchSite) return undefined;

  const isNavigation =
    secFetchMode === "navigate" && (secFetchDest === "iframe" || secFetchDest === "document");

  if (secFetchSite === "same-origin") return "active";
  if (isNavigation) return "active";

  return undefined;
}

/**
 * Builds the full set of outgoing request headers for a single proxied call. Pure function
 * (no I/O) so it can be exercised directly in tests against captured-traffic fixtures.
 *
 * @param {object} incomingHeaders - headers object from the request hitting OUR proxy
 * @param {string} url - fully-resolved target URL being proxied to
 * @param {string} proxyHost - host:port of our proxy server (req.get('host'))
 * @param {string} method - HTTP method of the request
 */
function computeOutgoingHeaders(incomingHeaders, url, proxyHost, method) {
  const requestHeaders = { ...(incomingHeaders || {}) };

  const targetUrlObj = new URL(url);
  const targetHostname = targetUrlObj.hostname;
  const targetOrigin = targetUrlObj.origin;

  requestHeaders.host = targetHostname;

  // --- REFERER: recompute per strict-origin-when-cross-origin, not blind passthrough ---
  const { referer, realOrigin } = computeRefererAndOrigin(requestHeaders.referer, targetOrigin);
  if (referer) {
    requestHeaders.referer = referer;
  } else {
    delete requestHeaders.referer;
  }

  // --- ORIGIN & CORS REWRITING ---
  const isCrossOrigin = realOrigin && realOrigin !== targetOrigin;
  if (isCrossOrigin) {
    requestHeaders.origin = realOrigin;
  } else {
    if (method === "GET" || method === "HEAD") {
      delete requestHeaders.origin;
    } else {
      requestHeaders.origin = targetOrigin;
    }
  }

  // --- SEC-FETCH-SITE ALIGNMENT ---
  let secFetchSite = requestHeaders["sec-fetch-site"];
  if (secFetchSite) {
    secFetchSite = getSecFetchSite(realOrigin, targetOrigin);
    requestHeaders["sec-fetch-site"] = secFetchSite;
  }

  // --- SEC-FETCH-STORAGE-ACCESS: synthesize, since the browser's header to OUR proxy
  // reflects storage-access state for OUR origin, not the upstream target's. ---
  const storageAccess = computeStorageAccess({
    secFetchSite,
    secFetchMode: requestHeaders["sec-fetch-mode"],
    secFetchDest: requestHeaders["sec-fetch-dest"],
  });
  if (storageAccess) {
    requestHeaders["sec-fetch-storage-access"] = storageAccess;
  } else {
    delete requestHeaders["sec-fetch-storage-access"];
  }

  // --- OUTGOING COOKIE REWRITING ---
  let cookieHeader = requestHeaders.cookie || "";
  if (cookieHeader) {
    let outboundCookies = [];
    const cookies = cookieHeader.split(';');

    for (let c of cookies) {
      c = c.trim();
      if (!c) continue;
      const eqIdx = c.indexOf('=');
      if (eqIdx === -1) continue;

      const key = c.substring(0, eqIdx);
      const val = c.substring(eqIdx + 1);

      const atIdx = key.lastIndexOf('@');
      if (atIdx !== -1) {
        const realKey = key.substring(0, atIdx);
        const domainSuffix = key.substring(atIdx + 1);

        if (targetHostname === domainSuffix || targetHostname.endsWith('.' + domainSuffix)) {
          outboundCookies.push(`${realKey}=${val}`);
        }
      }
    }
    requestHeaders.cookie = outboundCookies.join('; ');
    if (requestHeaders.cookie === '') delete requestHeaders.cookie;
  }

  delete requestHeaders["content-length"];

  // Restrict Accept-Encoding to encodings Node can safely decompress out-of-the-box
  delete requestHeaders["accept-encoding"];
  requestHeaders["accept-encoding"] = "gzip, deflate, br";

  return requestHeaders;
}

/**
 * Proxies HTTP requests to the target domain, performing header translation,
 * decompression checks, script injections, and cookie rewrites.
 */
async function proxyUrl(req, res, url) {
  try {
    if (url.startsWith(`${req.protocol}://${req.get('host')}/check?url=`)) {
      return res.redirect(url);
    }

    const targetUrlObj = new URL(url);
    const targetHostname = targetUrlObj.hostname;

    const requestHeaders = computeOutgoingHeaders(req.headers, url, req.get('host'), req.method);

    const bodyBuffer = await new Promise((resolve) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", () => resolve(undefined));
      } else resolve(undefined);
    });

    console.log(`[Proxy Request] URL: ${url}`, requestHeaders);

    const remoteRes = await axios({
      method: req.method,
      url: url,
      headers: requestHeaders,
      data: bodyBuffer,
      validateStatus: () => true,
      responseType: "stream",
      maxRedirects: 0,
      decompress: false, // Prevents Axios automatic decompression stream-hijacking
      httpsAgent: new https.Agent({ rejectUnauthorized: false, servername: targetHostname }),
    });

    // Translate redirects back to our proxy domain
    if (remoteRes.headers.location) {
      try {
        const originalLocation = new URL(remoteRes.headers.location, url);
        const encodedOrigin = Buffer.from(originalLocation.origin).toString("base64").replace(/=+$/, '');
        originalLocation.host = req.get("host");
        originalLocation.protocol = req.protocol;
        originalLocation.searchParams.set(PROXY_QUERY_PARAM, encodedOrigin);
        remoteRes.headers.location = originalLocation.toString();
      } catch (e) {}
    }

    // --- INCOMING SET-COOKIE REWRITING ---
    if (remoteRes.headers["set-cookie"]) {
      const host = req.get("host").split(":")[0];
      remoteRes.headers["set-cookie"] = remoteRes.headers["set-cookie"].map(cookieStr => {
        if (!cookieStr || typeof cookieStr !== "string") return cookieStr;

        const parts = cookieStr.split(';').map(p => p.trim());
        if (parts.length === 0) return cookieStr;

        const nameValue = parts[0];
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx === -1) return cookieStr;

        const origName = nameValue.substring(0, eqIdx);
        const val = nameValue.substring(eqIdx + 1);

        let targetDomain = targetHostname;
        let otherParts = [];

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const partLower = part.toLowerCase();

          if (partLower.startsWith('domain=')) {
            let d = part.substring(7).trim();
            if (d.startsWith('.')) d = d.substring(1);
            targetDomain = d;
          } else if (!partLower.startsWith('samesite=') && !partLower.startsWith('path=')) {
            otherParts.push(part);
          }
        }

        const newName = `${origName}@${targetDomain}`;
        let newCookie = `${newName}=${val}`;

        if (otherParts.length > 0) {
          newCookie += '; ' + otherParts.join('; ');
        }

        newCookie += `; Domain=${host}; Path=/; SameSite=Lax`;
        return newCookie;
      });
    }

    const contentType = (remoteRes.headers["content-type"] || "").toLowerCase();
    const isHtml = contentType.includes("html");
    const isJs = contentType.includes("javascript") || contentType.includes("application/js");
    const isTextual = isHtml || isJs || contentType.includes("text") || contentType.includes("json");
    const isBinary = !isTextual;

    res.status(remoteRes.status);

    if (isBinary) {
      Object.entries(remoteRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      await pipeline(remoteRes.data, res);
      return;
    }

    Object.entries(remoteRes.headers).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      const strippedHeaders = [
        "transfer-encoding",
        "content-length",
        "content-encoding",
        "content-security-policy",
        "content-security-policy-report-only",
        "x-frame-options",
        "clear-site-data"
      ];

      if (strippedHeaders.includes(lower)) return;
      res.setHeader(key, value);
    });

    const chunks = [];
    for await (const chunk of remoteRes.data) {
      chunks.push(chunk);
    }
    let body = Buffer.concat(chunks);

    // --- SMART DECOMPRESSION CHECK ---
    const encoding = (remoteRes.headers["content-encoding"] || "").toLowerCase();
    if (encoding && isBufferCompressed(body)) {
      try {
        if (encoding === "gzip" || encoding.includes("gzip")) {
          body = zlib.gunzipSync(body);
        } else if (encoding === "deflate" || encoding.includes("deflate")) {
          body = zlib.inflateSync(body);
        } else if (encoding === "br" || encoding.includes("br")) {
          body = zlib.brotliDecompressSync(body);
        }
      } catch (e) {
        console.warn(`[Decompression Skip/Warning] '${encoding}':`, e.message);
      }
    }

    let bodyStr = body.toString("utf-8");

    bodyStr = bodyStr.replace(/location/g, "__cpLocation");

    // PostMessage AST-like Regex Replacer
    const P1 = '\\([^)(]*\\)';
    const P2 = `\\((?:[^)(]|${P1})*\\)`;
    const P3 = `\\((?:[^)(]|${P2})*\\)`;

    const B1 = '\\[[^\\]\\[]*\\]';
    const B2 = `\\[(?:[^\\]\\[]|${B1})*\\]`;
    const B3 = `\\[(?:[^\\]\\[]|${B2})*\\]`;

    const C1 = '\\{[^}{]*\\}';
    const C2 = `\\{(?:[^}{]|${C1})*\\}`;
    const C3 = `\\{(?:[^}{]|${C2})*\\}`;

    const STR = `"(?:[^"\\\\]|\\\\[\\s\\S])*"|'(?:[^\'\\\\]|\\\\[\\s\\S])*'|\`(?:[^\`\\\\]|\\\\[\\s\\S])*\``;
    const N = `[^,'"\`()\\[\\]{}]+`;

    const ARG_TOKEN = `(?:${STR}|${P3}|${B3}|${C3}|${N})`;
    const ARG = `${ARG_TOKEN}+`;

    const pmRegex = new RegExp(`(\\bpostMessage|\\.postMessage)\\s*\\(\\s*(${ARG})\\s*(?:,\\s*(${ARG})\\s*(?:,\\s*(${ARG})\\s*)?)?\\)`, 'g');

    bodyStr = bodyStr.replace(pmRegex, (match, prefix, arg1, arg2, arg3) => {
      let result = `${prefix}(__cpPreparePostMessageData(${arg1})`;
      if (arg2) {
        result += `, __cpPreparePostMessageOrigin(${arg2})`;
        if (arg3) {
          result += `, ${arg3}`;
        }
      }
      result += `)`;
      return result;
    });

    if (isHtml) {
      const baseTag = `<base href="${url}"><script src="${req.protocol}://${req.get('host')}/middleware.js?__cpo=1" __cpp="1"></script>`;
      if (/<head>/i.test(bodyStr)) {
        bodyStr = bodyStr.replace(/(<head[^>]*>)/i, `$1\n${baseTag}\n`);
      } else if (/<html/i.test(bodyStr)) {
        bodyStr = bodyStr.replace(/(<html[^>]*>)/i, `$1\n<head>\n${baseTag}\n</head>\n`);
      } else {
        bodyStr = `<head>\n${baseTag}\n</head>\n` + bodyStr;
      }
      const $ = cheerio.load(bodyStr);
      $('[integrity]').removeAttr('integrity');
      bodyStr = $.html();
    }

    const proxyURLObj = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const isSW = proxyURLObj.searchParams.has('cp:parser:sw');
    const isModule = proxyURLObj.searchParams.has('cp:parser:module');

    if (isSW) {
      bodyStr = `importScripts('/croxy.sw.js?__cpo=1');\ntry {\n${bodyStr}\n} catch(e) { console.error('SW Error:', e); }`;
    } else if (isModule) {
      const importRegex = /(\b(?:import|export)\b(?:[^"';]*?\bfrom\b\s*|\s*))(['"])(.*?)\2|(\bimport\s*\(\s*)(['"])(.*?)\5(\s*\))/g;
      bodyStr = bodyStr.replace(importRegex, (match, pre1, quote1, path1, pre2, quote2, path2, post2) => {
        const isDynamic = !!pre2;
        const pre = isDynamic ? pre2 : pre1;
        const quote = isDynamic ? quote2 : quote1;
        const importPath = isDynamic ? path2 : path1;
        const post = isDynamic ? post2 : "";

        if (!importPath || importPath.startsWith("data:") || importPath.startsWith("blob:")) {
          return match;
        }

        try {
          const resolvedUrl = new URL(importPath, url);
          const encodedOrigin = Buffer.from(resolvedUrl.origin).toString("base64").replace(/=+$/, '');
          const proxyUrlObj = new URL(resolvedUrl.pathname + resolvedUrl.search, `${req.protocol}://${req.get("host")}`);

          proxyUrlObj.searchParams.set(PROXY_QUERY_PARAM, encodedOrigin);
          proxyUrlObj.searchParams.set('cp:parser:module', '1');

          return `${pre}${quote}${proxyUrlObj.toString()}${quote}${post}`;
        } catch (e) {
          return match;
        }
      });
    }

    // --- RE-COMPRESSION NEGOTIATION ---
    let outBuffer = Buffer.from(bodyStr, "utf-8");
    const clientAccepts = (req.headers['accept-encoding'] || "").toLowerCase();

    if (clientAccepts.includes('br')) {
      outBuffer = zlib.brotliCompressSync(outBuffer);
      res.setHeader("Content-Encoding", "br");
    } else if (clientAccepts.includes('gzip')) {
      outBuffer = zlib.gzipSync(outBuffer);
      res.setHeader("Content-Encoding", "gzip");
    } else if (clientAccepts.includes('deflate')) {
      outBuffer = zlib.deflateSync(outBuffer);
      res.setHeader("Content-Encoding", "deflate");
    }

    res.setHeader("Content-Length", Buffer.byteLength(outBuffer));
    res.send(outBuffer);

  } catch (err) {
    console.error("Proxy error:", err?.message || err);
    if (err?.response) {
      return res.status(502).send(`Proxy upstream error: ${err.response.status} ${err.response.statusText}`);
    }
    return res.status(500).send("Proxy error");
  }
}

/**
 * Proxies WebSockets to the target server, performing cookie translations.
 */
async function handleWebSocketProxy(req, socket, head, proxy) {
  try {
    const { pathname, search } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname !== "/__cpw.php") return socket.destroy();

    const params = new URLSearchParams(search);
    const urlDecoded = Buffer.from(params.get("u") || "", "base64").toString("utf-8");
    if (!urlDecoded) return socket.destroy();

    const targetUrl = new URL(urlDecoded);
    const target = targetUrl.toString();

    const requestHeaders = { ...(req.headers || {}) };
    requestHeaders.host = targetUrl.host;
    requestHeaders.origin = targetUrl.origin;

    // --- OUTGOING WEBSOCKET COOKIE REWRITING ---
    let cookieHeader = requestHeaders.cookie || "";
    if (cookieHeader) {
      let outboundCookies = [];
      const cookies = cookieHeader.split(';');
      for (let c of cookies) {
        c = c.trim();
        if (!c) continue;
        const eqIdx = c.indexOf('=');
        if (eqIdx === -1) continue;

        const key = c.substring(0, eqIdx);
        const val = c.substring(eqIdx + 1);

        const atIdx = key.lastIndexOf('@');
        if (atIdx !== -1) {
          const realKey = key.substring(0, atIdx);
          const domainSuffix = key.substring(atIdx + 1);

          if (targetUrl.hostname === domainSuffix || targetUrl.hostname.endsWith('.' + domainSuffix)) {
            outboundCookies.push(`${realKey}=${val}`);
          }
        }
      }
      requestHeaders.cookie = outboundCookies.join('; ');
    }

    proxy.ws(req, socket, head, {
      target,
      changeOrigin: true,
      secure: false,
      headers: requestHeaders,
    });
  } catch (err) {
    console.error("WebSocket proxy error:", err.message);
    socket.destroy();
  }
}

// Named Exports & Default Exports to cover all import approaches
export {
  decode,
  proxyUrl,
  handleWebSocketProxy,
  getPrimaryDomain,
  getSecFetchSite,
  computeRefererAndOrigin,
  computeStorageAccess,
  computeOutgoingHeaders,
};
export default { decode, proxyUrl, handleWebSocketProxy };