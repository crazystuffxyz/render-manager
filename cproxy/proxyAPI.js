// cproxy/proxyAPI.js
import { URL } from "url";
import {
  PROXY_QUERY_PARAM,
  decode,
  getPrimaryDomain,
  getSecFetchSite,
  computeRefererAndOrigin,
  computeStorageAccess,
  computeOutgoingHeaders,
} from "./headerTransform.js";
import { decompress, transformBody, compressForClient } from "./bodyTransform.js";
import { fetchUpstream, collectStream, pipeStream, handleWebSocketProxy } from "./network.js";
import adblock from './adblock.js';

// Re-export everything callers imported from the old monolithic proxyAPI.js so
// no import sites in server.js (or anywhere else) need to change.
export {
  decode,
  handleWebSocketProxy,
  PROXY_QUERY_PARAM,
  getPrimaryDomain,
  getSecFetchSite,
  computeRefererAndOrigin,
  computeStorageAccess,
  computeOutgoingHeaders,
};

/**
 * Proxies an HTTP request end-to-end:
 *   1. Compute outgoing headers          (headerTransform)
 *   2. Fetch upstream                    (network)
 *   3. Rewrite redirect / set-cookie     (here — response metadata)
 *   4. Stream binary responses directly  (network)
 *   5. Buffer, decompress, transform,
 *      re-compress textual responses     (bodyTransform)
 */
async function proxyUrl(req, res, url) {
  try {
    console.log(url, adblock.isAllowed(url));
    if(!adblock.isAllowed(url)) return res.status(404).send();
    if (url.startsWith(`${req.protocol}://${req.get("host")}/check?url=`)) {
      return res.redirect(url);
    }

    const targetUrlObj = new URL(url);
    const targetHostname = targetUrlObj.hostname;

    // ── 1. Headers ──────────────────────────────────────────────────────────
    const requestHeaders = computeOutgoingHeaders(
      req.headers, req.rawHeaders, url, req.get("host"), req.method
    );

    // ── 2. Body collection (non-GET/HEAD only) ───────────────────────────────
    const bodyBuffer = await new Promise((resolve) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.body && Object.keys(req.body).length > 0) {
          return resolve(Buffer.from(JSON.stringify(req.body)));
        }
        if (req.complete) {
           return resolve(req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.alloc(0));
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", () => resolve(undefined));
      } else {
        resolve(undefined);
      }
    });

    console.log(`[Proxy Request] URL: ${url}`, requestHeaders);

    // ── 3. Upstream fetch ────────────────────────────────────────────────────
    const remoteRes = await fetchUpstream(req.method, url, requestHeaders, bodyBuffer);

    if (remoteRes.status === 403) {
      console.log("\n--- [403 DETECTED] ---");
      console.log("403 detected, original headers before rewriting:", req.headers);
      console.log("after rewriting:", requestHeaders);
      console.log("----------------------\n");
    }

    // ── 4. Response metadata rewrites ────────────────────────────────────────
    // Translate redirect Location back through our proxy domain.
    if (remoteRes.headers.location) {
      try {
        const originalLocation = new URL(remoteRes.headers.location, url);
        const encodedOrigin = Buffer.from(originalLocation.origin)
          .toString("base64");
        originalLocation.host = req.get("host");
        originalLocation.protocol = req.protocol;
        originalLocation.searchParams.set(PROXY_QUERY_PARAM, encodedOrigin);
        remoteRes.headers.location = originalLocation.toString();
      } catch (e) {}
    }

    // Scope Set-Cookie values to our proxy domain using @-domain notation.
    if (remoteRes.headers["set-cookie"]) {
      const host = req.get("host").split(":")[0];
      remoteRes.headers["set-cookie"] = remoteRes.headers["set-cookie"].map((cookieStr) => {
        if (!cookieStr || typeof cookieStr !== "string") return cookieStr;

        const parts = cookieStr.split(";").map((p) => p.trim());
        if (parts.length === 0) return cookieStr;

        const nameValue = parts[0];
        const eqIdx = nameValue.indexOf("=");
        if (eqIdx === -1) return cookieStr;

        const origName = nameValue.substring(0, eqIdx);
        const val = nameValue.substring(eqIdx + 1);

        let targetDomain = targetHostname;
        const otherParts = [];

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const partLower = part.toLowerCase();

          if (partLower.startsWith("domain=")) {
            let d = part.substring(7).trim();
            if (d.startsWith(".")) d = d.substring(1);
            targetDomain = d;
          } else if (!partLower.startsWith("samesite=") && !partLower.startsWith("path=")) {
            otherParts.push(part);
          }
        }

        const newName = `${origName}@${targetDomain}`;
        let newCookie = `${newName}=${val}`;
        if (otherParts.length > 0) newCookie += "; " + otherParts.join("; ");
        newCookie += `; Domain=${host}; Path=/; SameSite=Lax`;
        return newCookie;
      });
    }

    // ── 5. Content-type routing ──────────────────────────────────────────────
    const contentType = (remoteRes.headers["content-type"] || "").toLowerCase();
    const isHtml = contentType.includes("html");
    const isJs = contentType.includes("javascript") || contentType.includes("application/js");
    const isTextual = isHtml || isJs || (contentType.includes("text") && !contentType.includes("json"));
    const isBinary = !isTextual;

    res.status(remoteRes.status);

    if (isBinary) {
      // Binary: stream directly, no buffering or transformation.
      Object.entries(remoteRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      await pipeStream(remoteRes.data, res);
      return;
    }

    // Textual: strip security/encoding headers that we manage ourselves.
    const STRIPPED_RESPONSE_HEADERS = new Set([
      "transfer-encoding",
      "content-length",
      "content-encoding",
      "content-security-policy",
      "content-security-policy-report-only",
      "x-frame-options",
      "clear-site-data",
    ]);
    Object.entries(remoteRes.headers).forEach(([key, value]) => {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // ── 6. Buffer + decompress ───────────────────────────────────────────────
    const rawBody = await collectStream(remoteRes.data);
    const encoding = (remoteRes.headers["content-encoding"] || "").toLowerCase();
    const decompressedBody = decompress(rawBody, encoding);

    // ── 7. Transform body ────────────────────────────────────────────────────
    // Attach content-type to req so bodyTransform can check isHtml without re-parsing.
    req._proxyContentType = contentType;
    const bodyStr = transformBody(decompressedBody.toString("utf-8"), url, req);

    // ── 8. Re-compress and send ──────────────────────────────────────────────
    const outBuffer = compressForClient(bodyStr, req, res);
    res.send(outBuffer);

  } catch (err) {
    // "Premature close" means the client disconnected mid-stream — not an error worth
    // logging loudly, and we definitely can't send an error response.
    if (err?.message === "Premature close" || err?.code === "ERR_STREAM_PREMATURE_CLOSE") {
      return;
    }
    console.error("Proxy error:", err?.message || err);
    // If headers have already been sent (status line written before the stream threw)
    // we cannot send another response — just close the connection.
    if (res.headersSent) {
      return res.destroy ? res.destroy() : res.end();
    }
    if (err?.response) {
      return res
        .status(502)
        .send(`Proxy upstream error: ${err.response.status} ${err.response.statusText}`);
    }
    return res.status(500).send("Proxy error");
  }
}

export { proxyUrl };

// Default export preserves the shape server.js destructures:
// const { proxyUrl, handleWebSocketProxy } = proxyAPI;
export default { proxyUrl, handleWebSocketProxy, decode };