// index.js
// index.js — entry point. Loads .env, embeds the cproxy sidecar in-process,
// serves a Basic-Auth-gated dashboard + JSON API, and exposes /ws/term for
// PTY streams.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv, buildAuthMiddleware, makeWsToken, verifyWsToken } from "./server/auth.js";
import * as terminal from "./server/terminal.js";
import * as hostManager from "./server/hostManager.js";
import * as portWatcher from "./server/portWatcher.js";
import * as adblock from "./server/adblock.js";
import { loadSidecar } from "./server/sidecarApp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC_DIR = path.join(__dirname, "public");

portWatcher.start();
loadSidecar().then(({ app: sidecarApp, upgrader: sidecarUpgrader }) => {
  startServer(sidecarApp, sidecarUpgrader);
}).catch((e) => {
  console.error("[main] failed to load sidecar:", e.message);
  console.error(e.stack);
  process.exit(1);
});

function startServer(sidecarApp, sidecarUpgrader) {

const PUBLIC_PATHS = new Set([
  "/healthz",
  "/favicon.ico",
]);

const authMiddleware = buildAuthMiddleware({ publicPaths: PUBLIC_PATHS });

// paths that get handed off to the cproxy sidecar (cookie parser + proxy
// middleware + static files all run as designed)
const SIDECAR_FILES = new Set([
  "/croxy.sw.js",
  "/dashboard.js",
  "/global.js",
  "/handleProxyClient.js",
  "/middleware.js",
  "/check",
]);

function isSidecarPath(req) {
  const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathOnly = urlObj.pathname;
  const cpo = urlObj.searchParams.get("__cpo");

  if (SIDECAR_FILES.has(pathOnly)) return true;
  if (cpo === "1") return false;
  if (cpo) return true;

  const cookies = req.headers.cookie || "";
  if (cookies.includes("shouldProxy=true") && cookies.includes("previousOrigin=")) {
    return true;
  }
  
  return false;
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathOnly = urlObj.pathname;

  if (pathOnly === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    return;
  }
  if (pathOnly === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  let authed = false;
  const next = () => { authed = true; };
  authMiddleware(req, res, next);
  if (!authed) return;

  if (isSidecarPath(req)) {
    // strip Authorization before handing to the sidecar — we already
    // authenticated at the edge and the upstream shouldn't see our creds.
    // (cproxy's headerTransform doesn't strip it, and we can't modify cproxy.)
    if (req.headers && req.headers.authorization) {
      delete req.headers.authorization;
    }
    
    const cpo = urlObj.searchParams.get("__cpo");
    if (cpo && cpo !== "1") {
      // Decode origin explicitly just to map the cookies identically to proxy's original pattern
      const encoded = decodeURIComponent(cpo);
      const existing = req.headers.cookie || "";
      req.headers.cookie = mergeCookies(existing, [
        `shouldProxy=true`,
        `previousOrigin=${encoded}`,
      ]);
      res.setHeader("Set-Cookie", [
        `shouldProxy=true; Path=/; Max-Age=3600; SameSite=Lax`,
        `previousOrigin=${encoded}; Path=/; Max-Age=3600; SameSite=Lax`,
      ]);
    }
    
    return sidecarApp(req, res);
  }

  if (pathOnly === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      proxy: { running: true, port: PORT, pid: process.pid, dir: "in-process" },
      adblock: adblock.getStatus(),
      shells: terminal.listShells(),
      hosts: hostManager.list(),
      portWatcher: { size: portWatcher.size() },
      platform: process.platform,
      hostname: process.platform === "win32" ? process.env.COMPUTERNAME : (process.env.HOSTNAME || os.hostname()),
    }));
    return;
  }

  if (pathOnly === "/api/ws-token" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ token: makeWsToken() }));
    return;
  }

  if (pathOnly === "/api/hosts" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hosts: hostManager.list() }));
    return;
  }
  if (pathOnly === "/api/hosts" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      try {
        const entry = hostManager.add({ label: body.label, port: body.port, note: body.note });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, host: entry }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  if (pathOnly.startsWith("/api/hosts/") && req.method === "PATCH") {
    const label = decodeURIComponent(pathOnly.slice("/api/hosts/".length));
    readJsonBody(req).then((body) => {
      try {
        const entry = hostManager.update(label, body);
        if (!entry) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, host: entry }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  if (pathOnly.startsWith("/api/hosts/") && req.method === "DELETE") {
    const label = decodeURIComponent(pathOnly.slice("/api/hosts/".length));
    const ok = hostManager.remove(label);
    res.writeHead(ok ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return;
  }
  if (pathOnly === "/api/hosts/probe") {
    hostManager.probeAll().then((results) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, results }));
    });
    return;
  }

  if (pathOnly === "/api/shells" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ shells: terminal.listShells() }));
    return;
  }
  if (pathOnly === "/api/shells" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const s = terminal.createShell({ label: body && body.label });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, shell: { id: s.id, label: s.label, pid: s.proc.pid, cols: s.cols, rows: s.rows } }));
    });
    return;
  }
  if (pathOnly.startsWith("/api/shells/") && req.method === "DELETE") {
    const id = pathOnly.slice("/api/shells/".length);
    const ok = terminal.killShell(id, { signal: "SIGTERM" });
    res.writeHead(ok ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return;
  }
  if (pathOnly.startsWith("/api/shells/") && pathOnly.endsWith("/signal") && req.method === "POST") {
    const id = pathOnly.slice("/api/shells/".length, -"/signal".length);
    readJsonBody(req).then((body) => {
      const sig = (body && body.signal) || "SIGTERM";
      const force = !!(body && body.force);
      const ok = terminal.killShell(id, { signal: sig, force });
      res.writeHead(ok ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    });
    return;
  }

  if (pathOnly === "/api/adblock/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(adblock.getStatus()));
    return;
  }
  if (pathOnly === "/api/adblock/refresh" && req.method === "POST") {
    adblock.refresh({ force: true }).then(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...adblock.getStatus() }));
    }).catch((e) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    });
    return;
  }
  if (pathOnly === "/api/adblock/check") {
    const u = urlObj.searchParams.get("url");
    if (!u) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "missing url" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ url: u, allowed: adblock.isAllowed(u) }));
    return;
  }

  if (pathOnly === "/api/discovered-ports" && req.method === "GET") {
    const includeHidden = urlObj.searchParams.get("includeHidden") === "1";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ports: portWatcher.getAll({ includeHidden }) }));
    return;
  }
  if (pathOnly === "/api/discovered-ports/watch" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const port = Number(body && body.port);
      const r = portWatcher.addWatch(port, body && body.label);
      res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/unwatch" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const r = portWatcher.removeWatch(Number(body && body.port));
      res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/hide" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const r = portWatcher.setHidden(Number(body && body.port), body && body.hidden);
      res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/label" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const r = portWatcher.setLabel(Number(body && body.port), body && body.label);
      res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/probe" && req.method === "POST") {
    readJsonBody(req).then(async (body) => {
      const port = Number(body && body.port);
      const alive = await portWatcher.probeAlive(port);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, port, alive }));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/kill" && req.method === "POST") {
    readJsonBody(req).then(async (body) => {
      const port = Number(body && body.port);
      const r = await portWatcher.tryKill(port);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (pathOnly === "/api/discovered-ports/clear" && req.method === "POST") {
    const r = portWatcher.clearAll();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }

  // test-only endpoint; gated by NODE_ENV so prod never exposes it
  if (process.env.NODE_ENV === "test" && pathOnly === "/api/test/record-shell" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const id = "test-" + Date.now();
      portWatcher.recordShellPid(id, Number(body && body.pid));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, shellId: id }));
    });
    return;
  }

  if (pathOnly === "/" || pathOnly === "/index.html") {
    const file = path.join(PUBLIC_DIR, "index.html");
    serveFile(req, res, file, "text/html; charset=utf-8");
    return;
  }
  if (pathOnly.startsWith("/static/")) {
    const file = path.join(PUBLIC_DIR, pathOnly);
    // path.join normalizes, so /static/../package.json becomes package.json
    // (the public dir) — block anything that escapes.
    if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    serveFile(req, res, file);
    return;
  }

  if (pathOnly.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

terminal.buildWss({ server, authCheck: (req) => {
  let ok = false;
  const fakeRes = { setHeader() {}, writeHead() {}, end() {} };
  authMiddleware(req, fakeRes, () => { ok = true; });
  return ok;
} });

server.on("upgrade", (req, socket, head) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const pathOnly = urlObj.pathname;
  const cpo = urlObj.searchParams.get("__cpo");

  // Terminal WSS is hooked internally, so ignore it here
  if (pathOnly.startsWith("/ws/term") && cpo === "1") {
    return;
  }

  // Everything else goes to the cproxy sidecar upgrader
  if (typeof sidecarUpgrader === "function") {
    try { sidecarUpgrader(req, socket, head); }
    catch (e) { try { socket.destroy(); } catch {} }
    return;
  }
  try { socket.destroy(); } catch {}
  return;
});

function serveFile(req, res, file, contentType) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    if (!contentType) {
      const ext = path.extname(file).toLowerCase();
      const map = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
      contentType = map[ext] || "application/octet-stream";
    }
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function mergeCookies(existingCookie, additions) {
  const map = new Map();
  if (existingCookie) {
    for (const piece of existingCookie.split(";")) {
      const idx = piece.indexOf("=");
      if (idx === -1) continue;
      const k = piece.slice(0, idx).trim();
      const v = piece.slice(idx + 1).trim();
      if (k) map.set(k, v);
    }
  }
  for (const pair of additions) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) map.set(k, v);
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Remote shell webapp listening on http://0.0.0.0:${PORT}`);
  console.log(`  Password:    ${process.env.PASSWORD || "(unset — edit .env)"}`);
  console.log(`  Sidecar:     in-process on the same port (loopback access via /?__cpo=)`);
  console.log(`  Platform:    ${process.platform}\n`);
});

function shutdown(reason) {
  console.log(`\n[main] shutting down (${reason})…`);
  portWatcher.stop();
  terminal.shutdownAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Defensive: a single unhandled promise rejection shouldn't silently kill
// the process. Log it; if we get a flood of them, exit (Node 15+ default).
process.on("unhandledRejection", (reason, promise) => {
  console.error("[main] unhandledRejection:", reason && reason.stack || reason);
});
// The cproxy sidecar is third-party code we don't control; its WS proxy
// can leave upstream TCP sockets without an error handler, which then
// emit ECONNREFUSED / ETIMEDOUT to the process. Those are expected when
// the user navigates to a port nothing is listening on, so suppress them.
// Real bugs in our own code still surface as the message above.
const NETWORK_NOISE_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND"]);
process.on("uncaughtException", (err) => {
  if (err && err.code && NETWORK_NOISE_CODES.has(err.code)) {
    // expected when a proxied upstream isn't running; do not log
    return;
  }
  console.error("[main] uncaughtException:", err && err.stack || err);
});

} // end startServer