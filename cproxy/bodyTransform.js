// cproxy/bodyTransform.js
import zlib from "zlib";
import { URL } from "url";
import * as cheerio from "cheerio";
import { PROXY_QUERY_PARAM } from "./headerTransform.js";
import adblock from './adblock.js';

// Trigger initial filter load asynchronously to prevent blocking startup
adblock.refresh().catch((err) => {
  console.warn("[adblock] Initial background refresh failed:", err.message);
});

adblock.startAutoRefresh(
  12 * 60 * 60 * 1000 // every 12 hours
);

/**
 * Checks if a buffer is actually compressed based on magic bytes.
 * Prevents redundant decompression attempts on streams already decoded upstream.
 */
function isBufferCompressed(buf) {
  if (!buf || buf.length < 4) return false;

  // Gzip: 1f 8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) return true;

  // Deflate: 78 01 / 78 9c / 78 da
  if (buf[0] === 0x78 && (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda))
    return true;

  // Brotli has no magic bytes — infer from non-printable byte content.
  // Plaintext (HTML, JS, CSS, JSON) starts with printable ASCII.
  for (let i = 0; i < Math.min(buf.length, 24); i++) {
    const byte = buf[i];
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte > 0x7e) return true;
  }
  return false;
}

/**
 * Decompresses a response buffer according to its Content-Encoding.
 * Returns the original buffer unchanged if compression isn't detected.
 */
function decompress(body, encoding) {
  if (!encoding || !isBufferCompressed(body)) return body;

  try {
    if (encoding === "gzip" || encoding.includes("gzip")) {
      return zlib.gunzipSync(body);
    } else if (encoding === "deflate" || encoding.includes("deflate")) {
      return zlib.inflateSync(body);
    } else if (encoding === "br" || encoding.includes("br")) {
      return zlib.brotliDecompressSync(body);
    }
  } catch (e) {
    console.warn(`[Decompression Skip/Warning] '${encoding}':`, e.message);
  }
  return body;
}

// ---------------------------------------------------------------------------
// PostMessage AST-like Regex — built once at module load, not per-request.
// ---------------------------------------------------------------------------
const P1 = "\\([^)(]*\\)";
const P2 = `\\((?:[^)(]|${P1})*\\)`;
const P3 = `\\((?:[^)(]|${P2})*\\)`;

const B1 = "\\[[^\\]\\[]*\\]";
const B2 = `\\[(?:[^\\]\\[]|${B1})*\\]`;
const B3 = `\\[(?:[^\\]\\[]|${B2})*\\]`;

const C1 = "\\{[^}{]*\\}";
const C2 = `\\{(?:[^}{]|${C1})*\\}`;
const C3 = `\\{(?:[^}{]|${C2})*\\}`;

const STR = `"(?:[^"\\\\]|\\\\[\\s\\S])*"|'(?:[^\\'\\\\]|\\\\[\\s\\S])*'|\`(?:[^\`\\\\]|\\\\[\\s\\S])*\``;
const N = "[^,'\"\\`()\\[\\]{}]+";

const ARG_TOKEN = `(?:${STR}|${P3}|${B3}|${C3}|${N})`;
const ARG = `${ARG_TOKEN}+`;

const PM_REGEX = new RegExp(
  `(\\bpostMessage|\\.postMessage)\\s*\\(\\s*(${ARG})\\s*(?:,\\s*(${ARG})\\s*(?:,\\s*(${ARG})\\s*)?)?\\)`,
  "g"
);

const IMPORT_REGEX =
  /(\b(?:import|export)\b(?:[^"';]*?\bfrom\b\s*|\s*))(['"])(.*?)\2|(\bimport\s*\(\s*)(['"])(.*?)\5(\s*\))/g;

// ---------------------------------------------------------------------------

/**
 * ARCHITECTURE NOTE: IN-MEMORY TRANSFORMATIONS ONLY
 * 
 * This proxy NEVER edits files on your local hard drive. 
 * It intercepts the HTTP response streams in RAM, modifies them as strings, 
 * and sends the modified strings to the browser.
 * 
 * Even if ADBLOCK=false, the proxy MUST perform several strict rewriting steps 
 * on the HTML and Javascript, otherwise the proxied site will "escape" the 
 * sandbox, relative URLs will 404, and the proxy illusion will shatter.
 *
 * Steps performed regardless of Adblock status:
 *   1. location → __cpLocation (prevents JS redirects escaping proxy)
 *   2. postMessage → __cpPreparePostMessageData (sandboxes iframe messaging)
 *   3. HTML: injects <base href> (fixes relative links) + middleware.js (hooks DOM APIs)
 *   4. HTML: strips SRI `integrity` attrs (since we modified the code, hashes won't match)
 *   5. Service Worker: prepends importScripts for our proxy SW shim
 *   6. ES Module: rewrites static/dynamic import paths to include __cpo=1
 *
 * Steps performed ONLY if ADBLOCK=true:
 *   - CSS: Injects cosmetic display:none !important stylesheets.
 *   - Cheerio: Removes elements like tracking scripts, ad iframes, and empty ad shells.
 */
function transformBody(bodyStr, url, req) {
  console.log("Transform");
  console.log(url);

  // 1. Neutralise `location` references so they go through our __cpLocation shim.
  bodyStr = bodyStr.replace(/location/g, "__cpLocation");

  // 2. Wrap postMessage calls so origin arguments are rewritten at runtime.
  bodyStr = bodyStr.replace(PM_REGEX, (match, prefix, arg1, arg2, arg3) => {
    let result = `${prefix}(__cpPreparePostMessageData(${arg1})`;
    if (arg2) {
      result += `, __cpPreparePostMessageOrigin(${arg2})`;
      if (arg3) result += `, ${arg3}`;
    }
    result += `)`;
    return result;
  });
  const contentType = req._proxyContentType || "";
  const isHtml = contentType.includes("html");

  // 3. HTML injection.
  if (isHtml) {
    const hostname = new URL(url).hostname;
    
    // Adblock Cosmetic CSS (Returns empty string if disabled in .env)
    const cosmeticCss = adblock.getCleanCSS(hostname);

    const baseTag =
      `<base href="${url}">` +
      `<script src="${req.protocol}://${req.get("host")}/middleware.js?__cpo=1" __cpp="1"></script>` +
      (cosmeticCss ? `<style>${cosmeticCss}</style>` : "");

    if (/<head>/i.test(bodyStr)) {
      bodyStr = bodyStr.replace(/(<head[^>]*>)/i, `$1\n${baseTag}\n`);
    } else if (/<html/i.test(bodyStr)) {
      bodyStr = bodyStr.replace(/(<html[^>]*>)/i, `$1\n<head>\n${baseTag}\n</head>\n`);
    } else {
      bodyStr = `<head>\n${baseTag}\n</head>\n` + bodyStr;
    }

    const $ = cheerio.load(bodyStr);
    
    // Adblock DOM Stripping (Returns unmodified $ if disabled in .env)
    adblock.cleanHTML($, {
      hostname: hostname
    });
    
    // Subresource Integrity hashes will fail because we modified the HTML/JS. 
    // We MUST strip them to prevent the browser from blocking the scripts.
    $("[integrity]").removeAttr("integrity");
    bodyStr = $.html();
  }

  // 4 & 5. Service Worker and ES Module rewrites.
  const proxyURLObj = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  const isSW = proxyURLObj.searchParams.has("cp:parser:sw");
  const isModule = proxyURLObj.searchParams.has("cp:parser:module");

  if (isSW) {
    bodyStr =
      `importScripts('/croxy.sw.js?__cpo=1');\ntry {\n${bodyStr}\n} catch(e) { console.error('SW Error:', e); }`;
  } else if (isModule) {
    bodyStr = bodyStr.replace(
      IMPORT_REGEX,
      (match, pre1, quote1, path1, pre2, quote2, path2, post2) => {
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
          const encodedOrigin = Buffer.from(resolvedUrl.origin)
            .toString("base64");
          const proxyUrlObj = new URL(
            resolvedUrl.pathname + resolvedUrl.search,
            `${req.protocol}://${req.get("host")}`
          );

          proxyUrlObj.searchParams.set(PROXY_QUERY_PARAM, encodedOrigin);
          proxyUrlObj.searchParams.set("cp:parser:module", "1");

          return `${pre}${quote}${proxyUrlObj.toString()}${quote}${post}`;
        } catch (e) {
          return match;
        }
      }
    );
  }

  return bodyStr;
}

/**
 * Re-compresses a transformed body string to match what the client accepts,
 * sets the appropriate Content-Encoding and Content-Length response headers,
 * and returns the final Buffer to send.
 */
function compressForClient(bodyStr, req, res) {
  let outBuffer = Buffer.from(bodyStr, "utf-8");
  const clientAccepts = (req.headers["accept-encoding"] || "").toLowerCase();

  if (clientAccepts.includes("br")) {
    outBuffer = zlib.brotliCompressSync(outBuffer);
    res.setHeader("Content-Encoding", "br");
  } else if (clientAccepts.includes("gzip")) {
    outBuffer = zlib.gzipSync(outBuffer);
    res.setHeader("Content-Encoding", "gzip");
  } else if (clientAccepts.includes("deflate")) {
    outBuffer = zlib.deflateSync(outBuffer);
    res.setHeader("Content-Encoding", "deflate");
  }

  res.setHeader("Content-Length", Buffer.byteLength(outBuffer));
  return outBuffer;
}

export { isBufferCompressed, decompress, transformBody, compressForClient };