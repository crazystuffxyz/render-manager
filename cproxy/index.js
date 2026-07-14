// cproxy/index.js
import dotenv from "dotenv";
dotenv.config();
import net from 'node:net';
import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import cookieParser from 'cookie-parser';
import pkg from 'http-proxy';
import proxyAPI from "./proxyAPI.js";

const { createProxyServer } = pkg;
const { proxyUrl, handleWebSocketProxy } = proxyAPI;

const PROXY_QUERY_PARAM = '__cpo';
const publicPath = fileURLToPath(new URL('./public', import.meta.url));

const proxy = createProxyServer({ ws: true, changeOrigin: true });
const app = express();

app.use(cookieParser());
app.use(express.json());

// Proxy Middleware
app.use(async (req, res, next) => {
  try {
    // Ensure dashboard bypass works cleanly
    if (req.query && req.query[PROXY_QUERY_PARAM] === "1") {
      return next();
    }
    
    const hasProxyParam = !!(req.query && req.query[PROXY_QUERY_PARAM] && req.query[PROXY_QUERY_PARAM] !== "1");
    const hasPreviousOrigin = !!req.cookies.previousOrigin;
    const shouldProxy = req.cookies.shouldProxy === "true";

    if (!(hasProxyParam || hasPreviousOrigin) || !shouldProxy) {
      return next();
    }

    const originForUrl = req.query[PROXY_QUERY_PARAM] || req.cookies.previousOrigin;
    const originUrl = Buffer.from(decodeURIComponent(originForUrl), "base64").toString("utf-8");

    const u = new URL(req.originalUrl, originUrl);
    u.searchParams.delete(PROXY_QUERY_PARAM);
    for (const key of [...u.searchParams.keys()]) {
        if (key.startsWith("cp:parser")) {
            u.searchParams.delete(key);
        }
    }
    const fullUrl = u.toString();

    return await proxyUrl(req, res, fullUrl);
} catch (error) {
  if (error?.message === 'Premature close' || error?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return; // client disconnected, nothing to do
  }
  console.error('Proxy middleware error:', error);
  if (res.headersSent) return; // proxyUrl already sent something, can't send again
  return res.status(500).send('Proxy error: ' + (error?.message || String(error)));
}
});

app.use(express.static("public"));

app.get('/check', (req, res) => {
  const urlString = req.query.url;

  if (!urlString) {
    return res.status(400).send('false');
  }

  try {
    const parsedUrl = new URL(urlString);
    const host = parsedUrl.hostname;
    let port = parsedUrl.port;
    if (!port) {
      port = parsedUrl.protocol === 'https:' ? 443 : 80;
    }

    const socket = new net.Socket();
    let isFinished = false;

    const finish = (status) => {
      if (isFinished) return;
      isFinished = true;
      socket.destroy();
      res.send(status);
    };

    socket.setTimeout(2500);
    socket.on('connect', () => finish('true'));
    socket.on('timeout', () => finish('false'));
    socket.on('error', () => finish('false'));
    socket.connect(port, host);
  } catch (error) {
    res.send('false');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(join(publicPath, '404.html'));
});

const server = createServer(app);

// WebSocket upgrade handling
server.on('upgrade', (req, socket, head) => {
  socket.on('error', (err) => {
    console.error('Socket error on upgrade:', err);
    socket.destroy();
  });
  handleWebSocketProxy(req, socket, head, proxy);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});