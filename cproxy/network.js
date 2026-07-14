import https from "https";
import axios from "axios";
import { pipeline } from "stream/promises";
import { URL } from "url";

/**
 * Fires the upstream HTTP request via axios and returns the raw response stream.
 * No header manipulation, no body processing — purely the network call.
 *
 * @param {string}  method         - HTTP method
 * @param {string}  url            - fully resolved upstream URL
 * @param {object}  requestHeaders - already-computed outgoing headers
 * @param {Buffer}  bodyBuffer     - request body (undefined for GET/HEAD)
 * @returns {Promise<import("axios").AxiosResponse>}
 */
async function fetchUpstream(method, url, requestHeaders, bodyBuffer) {
  const { hostname } = new URL(url);

  return axios({
    method,
    url,
    headers: requestHeaders,
    data: bodyBuffer,
    validateStatus: () => true,
    responseType: "stream",
    maxRedirects: 0,
    decompress: false, // prevents Axios from hijacking the decompression stream
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      servername: hostname,
    }),
  });
}

/**
 * Collects a streaming axios response body into a single Buffer.
 */
async function collectStream(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Pipes a binary response stream directly to the client response without buffering.
 */
async function pipeStream(stream, res) {
  await pipeline(stream, res);
}

/**
 * Proxies a WebSocket connection to the target server.
 * Performs cookie un-scoping (the reverse of the @-domain scoping in headerTransform)
 * so the upstream WS server receives the correct credential cookies.
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

    // Un-scope @-domain cookies so the upstream WS server sees clean cookie names.
    const cookieHeader = requestHeaders.cookie || "";
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
            targetUrl.hostname === domainSuffix ||
            targetUrl.hostname.endsWith("." + domainSuffix)
          ) {
            outboundCookies.push(`${realKey}=${val}`);
          }
        }
      }
      requestHeaders.cookie = outboundCookies.join("; ");
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

export { fetchUpstream, collectStream, pipeStream, handleWebSocketProxy };