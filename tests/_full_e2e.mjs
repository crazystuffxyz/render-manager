// _full_e2e.mjs — every endpoint, every UI flow, every error path.
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 18800;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;
const PWD = "letmein";
const AUTH = "Basic " + Buffer.from("user:" + PWD).toString("base64");
const WRONG_AUTH = "Basic " + Buffer.from("user:wrongpass").toString("base64");

let pass = 0, fail = 0;
const failures = [];

// TCP probe for test setup — waits for a server to actually be listening
function probePort(port, host = "127.0.0.1", timeoutMs = 500) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { s.destroy(); } catch {} resolve(v); };
    s.setTimeout(timeoutMs);
    s.once("connect", () => finish(true));
    s.once("timeout", () => finish(false));
    s.once("error", () => finish(false));
    s.connect(port, host);
  });
}

function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; failures.push(name + (detail ? " — " + detail : "")); console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}

function req(method, p, body, customAuth) {
  return new Promise((res, rej) => {
    const data = body !== undefined ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        Authorization: customAuth !== undefined ? customAuth : AUTH,
        ...(data !== null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(BASE + p, opts, (resp) => {
      let chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => res({ status: resp.statusCode, body: Buffer.concat(chunks).toString("utf8"), headers: resp.headers }));
    });
    r.on("error", rej);
    if (data !== null) r.write(data);
    r.end();
  });
}

async function main() {
  const env = { ...process.env, PORT: String(PORT), PASSWORD: PWD, NODE_ENV: "test" };
  const child = spawn(process.execPath, [path.join(ROOT, "index.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  const serverLog = [];
  child.stdout.on("data", (c) => serverLog.push(String(c)));
  child.stderr.on("data", (c) => serverLog.push(String(c)));

  try {
    // wait for server
    for (let i = 0; i < 50; i++) {
      try {
        const r = await new Promise((res) => {
          const req = http.get(BASE + "/healthz", (r) => { r.resume(); res(r.statusCode === 200); });
          req.on("error", () => res(false));
          req.setTimeout(1000, () => req.destroy());
        });
        if (r) break;
      } catch {}
      await wait(200);
    }
    console.log("\n=== AUTH GATE ===");
    {
      const r = await new Promise((res) => {
        http.get(BASE + "/healthz", (r) => { r.resume(); res(r); });
      });
      check("GET /healthz without auth = 200", r.statusCode === 200);

      const r2 = await new Promise((res) => {
        http.get(BASE + "/api/status", (r) => { r.resume(); res(r); });
      });
      check("GET /api/status without auth = 401", r2.statusCode === 401);
      check("WWW-Authenticate header present on 401", !!r2.headers["www-authenticate"], "header: " + r2.headers["www-authenticate"]);

      const r3 = await req("GET", "/api/status", undefined, WRONG_AUTH);
      check("GET /api/status with wrong password = 401", r3.status === 401);

      const r4 = await req("GET", "/api/status");
      check("GET /api/status with correct password = 200", r4.status === 200);
    }

    console.log("\n=== /api/status PAYLOAD ===");
    {
      const r = await req("GET", "/api/status");
      const j = JSON.parse(r.body);
      check("status.ok is true", j.ok === true);
      check("status.proxy exists", j.proxy && typeof j.proxy.running === "boolean");
      check("status.adblock exists", j.adblock && typeof j.adblock.ready === "boolean");
      check("status.shells is array", Array.isArray(j.shells));
      check("status.hosts is array", Array.isArray(j.hosts));
      check("status.platform is string", typeof j.platform === "string" && j.platform.length > 0);
      check("status.hostname is string", typeof j.hostname === "string" && j.hostname.length > 0);
    }

    console.log("\n=== /api/ws-token ===");
    let token = null;
    {
      const r = await req("GET", "/api/ws-token");
      check("GET /api/ws-token = 200", r.status === 200);
      check("Cache-Control: no-store", r.headers["cache-control"] === "no-store");
      const j = JSON.parse(r.body);
      check("ws-token.body.token is string", typeof j.token === "string" && j.token.length > 16);
      token = j.token;

      const r2 = await new Promise((res) => {
        http.get(BASE + "/api/ws-token", (r) => { r.resume(); res(r); });
      });
      check("GET /api/ws-token without auth = 401", r2.statusCode === 401);
    }

    console.log("\n=== STATIC FILES ===");
    {
      const r = await req("GET", "/");
      check("GET / = 200", r.status === 200);
      check("GET / has sidebar", r.body.includes('<aside class="sidebar">'));
      check("GET / has nav-item buttons", r.body.includes("nav-item"));
      check("GET / has /static/app.css link", r.body.includes("/static/app.css"));
      check("GET / has /static/app.js script", r.body.includes("/static/app.js"));
      check("GET / has xterm CDN script", r.body.includes("cdn.jsdelivr.net"));
      check("GET / has 5 panels", (r.body.match(/data-panel=/g) || []).length === 5);

      const r2 = await req("GET", "/static/app.css");
      check("GET /static/app.css = 200", r2.status === 200);
      check("CSS has --accent: #2563eb", r2.body.includes("--accent: #2563eb"));
      check("CSS has .btn-primary", r2.body.includes(".btn-primary"));
      check("CSS has .nav-item.active", r2.body.includes(".nav-item.active"));
      check("CSS has .term-shell", r2.body.includes(".term-shell"));

      const r3 = await req("GET", "/static/app.js");
      check("GET /static/app.js = 200", r3.status === 200);
      check("app.js exports getWsToken", r3.body.includes("getWsToken"));
      check("app.js has renderAdblock", r3.body.includes("renderAdblock"));
      check("app.js has renderHosts", r3.body.includes("renderHosts"));
      check("app.js has terminalUI", r3.body.includes("terminalUI"));

      const r4 = await req("GET", "/favicon.ico");
      check("GET /favicon.ico returns 204 or 404", r4.status === 204 || r4.status === 404, "got " + r4.status);

      const r5 = await req("GET", "/static/../../../../../../etc/passwd");
      check("Path traversal blocked (not 200)", r5.status !== 200, "got " + r5.status);
    }

    console.log("\n=== HOST MANAGER ===");
    let hostLabel = "test-" + Date.now();
    {
      const r = await req("GET", "/api/hosts");
      check("GET /api/hosts = 200", r.status === 200);
      const j = JSON.parse(r.body);
      check("hosts is array", Array.isArray(j.hosts));
      const before = j.hosts.length;

      const r2 = await req("POST", "/api/hosts", { label: hostLabel, port: 59999, note: "e2e" });
      check("POST /api/hosts valid = 200", r2.status === 200, "body: " + r2.body);
      const j2 = JSON.parse(r2.body);
      check("POST response has .ok true", j2.ok === true);
      check("POST response has .host.label", j2.host && j2.host.label === hostLabel);

      const r2b = await req("POST", "/api/hosts", { label: "Bad Label With Spaces", port: 1, note: "" });
      check("POST /api/hosts invalid label = 400", r2b.status === 400, "got " + r2b.status);

      const r2c = await req("POST", "/api/hosts", { label: hostLabel, port: 59999, note: "" });
      check("POST /api/hosts duplicate = 400", r2c.status === 400, "got " + r2c.status);

      const r3 = await req("GET", "/api/hosts");
      const j3 = JSON.parse(r3.body);
      check("After add, hosts.length = before + 1", j3.hosts.length === before + 1);
      const entry = j3.hosts.find((h) => h.label === hostLabel);
      check("Added host has enabled=true", entry && entry.enabled === true);

      const r4 = await req("PATCH", "/api/hosts/" + hostLabel, { enabled: false });
      check("PATCH /api/hosts/{label} = 200", r4.status === 200);
      const j4 = JSON.parse(r4.body);
      check("PATCH response.host.enabled=false", j4.host && j4.host.enabled === false);

      const r4b = await req("PATCH", "/api/hosts/nonexistent-12345", { enabled: true });
      check("PATCH /api/hosts/unknown = 404", r4b.status === 404, "got " + r4b.status);

      const r5 = await req("GET", "/api/hosts/probe");
      check("GET /api/hosts/probe = 200", r5.status === 200);
      const j5 = JSON.parse(r5.body);
      check("probe has results array", Array.isArray(j5.results));
      const probed = j5.results.find((p) => p.label === hostLabel);
      check("probe has our host", !!probed);
      check("probe status is valid", probed && ["open", "closed", "timeout", "error"].includes(probed.status));

      const r6 = await req("DELETE", "/api/hosts/" + hostLabel);
      check("DELETE /api/hosts/{label} = 200", r6.status === 200);

      const r7 = await req("GET", "/api/hosts");
      const j7 = JSON.parse(r7.body);
      check("After delete, host not in list", !j7.hosts.find((h) => h.label === hostLabel));

      const r7b = await req("DELETE", "/api/hosts/nonexistent-12345");
      check("DELETE /api/hosts/unknown = 404", r7b.status === 404);
    }

    console.log("\n=== ADBLOCK ===");
    {
      const r = await req("GET", "/api/adblock/status");
      check("GET /api/adblock/status = 200", r.status === 200);
      const j = JSON.parse(r.body);
      check("adblock has ready field", typeof j.ready === "boolean");
      check("adblock has blockedDomainCount", typeof j.blockedDomainCount === "number");
      check("adblock has cosmeticSelectorCount", typeof j.cosmeticSelectorCount === "number");
      check("adblock has sourceFiles", Array.isArray(j.sourceFiles));

      const r2 = await req("GET", "/api/adblock/check?url=https://example.com/track.js");
      check("GET /api/adblock/check?url=... = 200", r2.status === 200);
      const j2 = JSON.parse(r2.body);
      check("check.url echoed", j2.url === "https://example.com/track.js");
      check("check.allowed is boolean", typeof j2.allowed === "boolean");

      const r3 = await req("GET", "/api/adblock/check");
      check("GET /api/adblock/check no-url = 400", r3.status === 400);

      const r4 = await req("POST", "/api/adblock/refresh");
      check("POST /api/adblock/refresh = 200", r4.status === 200);
    }

    console.log("\n=== SHELLS (PTY) ===");
    let shellId = null;
    {
      // The conpty_console_list_agent "AttachConsole failed" error is benign
      // noise from node-pty on Windows. The test's server child is spawned
      // with stdio: ["ignore", "pipe", "pipe"] so it has no console; node-pty
      // forks a helper to query conpty state and the helper's AttachConsole
      // fails harmlessly. A 5s timeout in node-pty bounds the damage.
      const r = await req("GET", "/api/shells");
      check("GET /api/shells = 200", r.status === 200);
      const j = JSON.parse(r.body);
      check("shells is array", Array.isArray(j.shells));

      const r2 = await req("POST", "/api/shells", { label: "test-shell" });
      check("POST /api/shells = 200", r2.status === 200);
      const j2 = JSON.parse(r2.body);
      check("POST response has .shell.id", j2.shell && typeof j2.shell.id === "string");
      check("POST response has .shell.pid (number)", j2.shell && typeof j2.shell.pid === "number");
      shellId = j2.shell.id;

      const r3 = await req("GET", "/api/shells");
      const j3 = JSON.parse(r3.body);
      check("created shell in list", j3.shells.find((s) => s.id === shellId));

      const r4 = await req("DELETE", "/api/shells/00000000-0000-0000-0000-000000000000");
      check("DELETE unknown shell = 404", r4.status === 404);

      const r5 = await req("POST", "/api/shells/" + shellId + "/signal", { signal: "SIGTERM" });
      check("POST signal = 200", r5.status === 200);

      await wait(1500);

      const r6 = await req("GET", "/api/shells");
      const j6 = JSON.parse(r6.body);
      const stillThere = j6.shells.find((s) => s.id === shellId);
      check("killed shell removed from list", !stillThere || !stillThere.alive);
    }

    console.log("\n=== WEBSOCKET ===");
    {
      const noTok = await new Promise((res) => {
        const ws = new WebSocket(WS_BASE + "/ws/term");
        let closed = false;
        ws.on("unexpected-response", (req, r) => { closed = true; res({ status: r.statusCode }); });
        ws.on("error", () => { if (!closed) res({ status: 0 }); });
        ws.on("close", (code) => { if (!closed) res({ status: -code }); });
      });
      check("WS without token = 401", noTok.status === 401, "got " + noTok.status);

      const badTok = await new Promise((res) => {
        const ws = new WebSocket(WS_BASE + "/ws/term?t=AAAA");
        let closed = false;
        ws.on("unexpected-response", (req, r) => { closed = true; res({ status: r.statusCode }); });
        ws.on("error", () => { if (!closed) res({ status: 0 }); });
        ws.on("close", (code) => { if (!closed) res({ status: -code }); });
      });
      check("WS with bad token = 401", badTok.status === 401, "got " + badTok.status);

      const tok = JSON.parse((await req("GET", "/api/ws-token")).body).token;
      const hello = await new Promise((res, rej) => {
        const ws = new WebSocket(WS_BASE + "/ws/term?t=" + encodeURIComponent(tok));
        const t = setTimeout(() => rej(new Error("hello timeout")), 5000);
        ws.on("open", () => {});
        ws.on("message", (data) => {
          try {
            const m = JSON.parse(String(data));
            if (m.type === "hello" && m.id) { clearTimeout(t); ws.close(); res(m); }
          } catch {}
        });
        ws.on("error", (e) => { clearTimeout(t); rej(e); });
      });
      check("WS hello received", !!hello.id);
      check("WS hello.platform matches", hello.platform === process.platform);
      const wsId = hello.id;

      const hello2 = await new Promise((res, rej) => {
        const ws = new WebSocket(WS_BASE + "/ws/term/" + wsId + "?t=" + encodeURIComponent(tok));
        const t = setTimeout(() => rej(new Error("reconnect timeout")), 5000);
        ws.on("message", (data) => {
          try {
            const m = JSON.parse(String(data));
            if (m.type === "hello" && m.id === wsId) { clearTimeout(t); ws.close(); res(m); }
          } catch {}
        });
        ws.on("error", (e) => { clearTimeout(t); rej(e); });
      });
      check("WS reattach to same id", hello2.id === wsId);

      await req("DELETE", "/api/shells/" + wsId);
    }

    console.log("\n=== PROXY PIPELINE ===");
    {
      const r = await req("GET", "/proxy/");
      check("GET /proxy/ = 200", r.status === 200, "got " + r.status);

      const encoded = Buffer.from("http://example.com").toString("base64").replace(/=+$/, "");
      const r2 = await req("GET", "/proxy/?__cpo=" + encodeURIComponent(encoded));
      check("GET /proxy/?__cpo=... = 200", r2.status === 200, "got " + r2.status);
      check("/proxy/ response has proxy base href", r2.body.includes("example.com"));

      const logStr = serverLog.join("");
      const match = logStr.match(/\[Proxy Request\][^}]*?authorization/i);
      check("Authorization not leaked to upstream proxy", !match, match ? "leaked: " + match[0] : "");

      // discovered dev server becomes one click away
      const r3 = await req("GET", "/viewport/59998/");
      // 59998 is probably not listening, so 502 from cproxy's proxy. just
      // confirm we don't 404 the route
      check("GET /viewport/59998/ does not 404", r3.status !== 404, "got " + r3.status);

      const r3b = await req("GET", "/viewport/abc/");
      check("GET /viewport/abc/ = 400", r3b.status === 400, "got " + r3b.status);

      const r3c = await req("GET", "/viewport/" + PORT + "/");
      check("GET /viewport/{own port}/ = 400", r3c.status === 400, "got " + r3c.status);
    }

    console.log("\n=== WS PROXY ===");
    {
      // spin up a tiny upstream WS server
      const WS_PORT = PORT + 1;
      const upstream = http.createServer();
      const upstreamWss = new WebSocketServer({ server: upstream });
      let upstreamHits = 0;
      upstreamWss.on("connection", (ws) => {
        upstreamHits++;
        ws.send("hello from upstream");
        ws.on("message", (m) => ws.send("echo: " + m.toString()));
      });
      await new Promise((r) => upstream.listen(WS_PORT, "127.0.0.1", r));

      // proxy a WS to it via /__cpw.php?u=base64(ws://127.0.0.1:WS_PORT)
      const u = "ws://127.0.0.1:" + WS_PORT;
      const encoded = Buffer.from(u).toString("base64").replace(/=+$/, "");
      const wsUrl = `ws://127.0.0.1:${PORT}/__cpw.php?u=${encodeURIComponent(encoded)}`;

      const wsResult = await new Promise((res) => {
        const client = new WebSocket(wsUrl);
        const t = setTimeout(() => { try { client.close(); } catch {} res({ open: false, messages: [] }); }, 4000);
        const messages = [];
        client.on("open", () => { /* wait for first message */ });
        client.on("message", (m) => {
          messages.push(m.toString());
          if (messages.length >= 1) { clearTimeout(t); res({ open: true, messages }); try { client.close(); } catch {} }
        });
        client.on("error", () => { clearTimeout(t); res({ open: false, messages }); });
      });
      check("WS proxy handshake completed", wsResult.open, JSON.stringify(wsResult));
      check("WS proxy got upstream message", wsResult.messages[0] === "hello from upstream", JSON.stringify(wsResult.messages));
      check("upstream received the connection", upstreamHits === 1, "hits=" + upstreamHits);

      // also verify the upgrade listener didn't break /ws/term
      const r2 = await req("GET", "/api/ws-token");
      const token = JSON.parse(r2.body).token;
      const termWs = await new Promise((res) => {
        const c = new WebSocket(`ws://127.0.0.1:${PORT}/ws/term?t=${encodeURIComponent(token)}`);
        const t = setTimeout(() => { try { c.close(); } catch {} res({ ok: false }); }, 3000);
        c.on("message", (m) => {
          try {
            const parsed = JSON.parse(String(m));
            if (parsed.type === "hello") { clearTimeout(t); res({ ok: true, msg: parsed }); try { c.close(); } catch {} }
          } catch {}
        });
        c.on("error", () => { clearTimeout(t); res({ ok: false }); });
      });
      check("terminal WS still works", termWs.ok);

      upstream.close();
    }

    console.log("\n=== DISCOVERED PORTS ===");
    {
      const r = await req("GET", "/api/discovered-ports");
      check("GET /api/discovered-ports = 200", r.status === 200);
      const j = JSON.parse(r.body);
      check("discovered-ports.ports is array", Array.isArray(j.ports));

      // the PTY-output path is hard to test cross-platform without a
      // long-lived shell; addWatch exercises the same code.
      const r2 = await req("POST", "/api/discovered-ports/watch", { port: 59997, label: "watched-test" });
      check("POST watch = 200", r2.status === 200, "body: " + r2.body);
      const j2 = JSON.parse(r2.body);
      check("watch response.ok", j2.ok === true);

      const r3 = await req("GET", "/api/discovered-ports");
      const j3 = JSON.parse(r3.body);
      const watched = j3.ports.find((p) => p.port === 59997);
      check("watched port present", !!watched);
      check("watched port has label 'watched-test'", watched && watched.label === "watched-test");
      check("watched port.watched is true", watched && watched.watched === true);

      const r4 = await req("POST", "/api/discovered-ports/hide", { port: 59997, hidden: true });
      check("POST hide = 200", r4.status === 200);
      const r5 = await req("GET", "/api/discovered-ports");
      const j5 = JSON.parse(r5.body);
      check("hidden port absent from default list", !j5.ports.find((p) => p.port === 59997));
      const r5b = await req("GET", "/api/discovered-ports?includeHidden=1");
      const j5b = JSON.parse(r5b.body);
      check("hidden port present with includeHidden=1", !!j5b.ports.find((p) => p.port === 59997 && p.hidden));

      const r6 = await req("POST", "/api/discovered-ports/hide", { port: 59997, hidden: false });
      check("POST hide=false = 200", r6.status === 200);

      const r7 = await req("POST", "/api/discovered-ports/label", { port: 59997, label: "renamed" });
      check("POST label = 200", r7.status === 200);

      const r8 = await req("POST", "/api/discovered-ports/probe", { port: 59997 });
      check("POST probe = 200", r8.status === 200);
      const j8 = JSON.parse(r8.body);
      check("probe.alive is boolean", typeof j8.alive === "boolean");

      const r9 = await req("POST", "/api/discovered-ports/kill", { port: PORT });
      check("POST kill {own port} refused", r9.status === 200);
      const j9 = JSON.parse(r9.body);
      check("kill own port reason mentions required", j9.ok === false && /required|reserved/i.test(JSON.stringify(j9)));

      const r10 = await req("POST", "/api/discovered-ports/kill", { port: 59996 });
      check("POST kill {no listener} = 200", r10.status === 200);
      const j10 = JSON.parse(r10.body);
      check("kill no-listener reason set", j10.ok === false && typeof j10.reason === "string");

      const r11 = await req("POST", "/api/discovered-ports/unwatch", { port: 59997 });
      check("POST unwatch = 200", r11.status === 200);

      const r12 = await req("POST", "/api/discovered-ports/watch", { port: 99999, label: "bad" });
      check("POST watch {out-of-range} = 400", r12.status === 400, "got " + r12.status);

      const r13 = await req("POST", "/api/discovered-ports/clear");
      check("POST clear = 200", r13.status === 200);
      const r14 = await req("GET", "/api/discovered-ports?includeHidden=1");
      const j14 = JSON.parse(r14.body);
      check("after clear, list is empty", j14.ports.length === 0, "got " + j14.ports.length);
    }

    console.log("\n=== STATIC JS FILES COPIED TO PUBLIC ===");
    {
      for (const f of ["croxy.sw.js", "dashboard.js", "global.js", "handleProxyClient.js", "middleware.js"]) {
        const r = await req("GET", "/" + f);
        check("GET /" + f + " = 200", r.status === 200, "got " + r.status + " (file may be embedded in cproxy sidecar)");
      }
    }

    console.log("\n=== 404 / 405 BEHAVIOR ===");
    {
      const r = await req("GET", "/this-does-not-exist");
      check("GET unknown path = 404", r.status === 404);

      const r2 = await req("POST", "/api/hosts/this-doesnt-exist");
      check("POST unknown method/path = 404", r2.status === 404);
    }

    console.log("\n=== CONCURRENT REQUEST HANDLING ===");
    {
      const reqs = await Promise.all(Array.from({ length: 20 }, () => req("GET", "/api/status")));
      const allOk = reqs.every((r) => r.status === 200);
      check("20 parallel /api/status all 200", allOk, "got statuses: " + reqs.map((r) => r.status).join(","));
    }

    console.log("\n=== OS-DRIVEN DISCOVERY ===");
    {
      // real process -> real listener -> real PID -> real netstat -> port map.
      // no regex involved.
      const testPort = 19995 + Math.floor(Math.random() * 100);
      const py = spawn(process.platform === "win32" ? "python" : "python3",
        ["-m", "http.server", String(testPort), "--bind", "127.0.0.1"],
        { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      let pyErr = "";
      py.stderr.on("data", (c) => { pyErr += String(c); });

      // use a TCP probe rather than relying on python's stdout, which is
      // platform-dependent
      let pyReady = false;
      for (let i = 0; i < 50 && !pyReady; i++) {
        pyReady = await probePort(testPort);
        if (!pyReady) await wait(100);
      }
      if (!pyReady) {
        check("python http.server started on port " + testPort, false, "stderr: " + pyErr);
      } else {
        check("python http.server started on port " + testPort, true);
      }

      if (pyReady && py.pid) {
        const r0 = await req("POST", "/api/test/record-shell", { pid: py.pid });
        check("POST /api/test/record-shell = 200", r0.status === 200);

        let discovered = null;
        for (let i = 0; i < 20; i++) {
          const r = await req("GET", "/api/discovered-ports");
          const j = JSON.parse(r.body);
          discovered = j.ports.find((p) => p.port === testPort);
          if (discovered) break;
          await wait(500);
        }
        check("OS scan discovered port " + testPort, !!discovered, "ports: " + (discovered ? "found" : "missing"));
        if (discovered) {
          check("discovered port has pid", Number.isInteger(discovered.pid) && discovered.pid === py.pid, "got pid " + discovered.pid);
          check("discovered port alive=true", discovered.alive === true);
        }

        try { py.kill("SIGTERM"); } catch {}
        await wait(500);
        try { py.kill("SIGKILL"); } catch {}

        let stillThere = null;
        for (let i = 0; i < 20; i++) {
          const r = await req("GET", "/api/discovered-ports");
          const j = JSON.parse(r.body);
          stillThere = j.ports.find((p) => p.port === testPort);
          if (!stillThere) break;
          await wait(500);
        }
        check("killed port removed from discovered list (drop-on-death)", !stillThere);

        // trust filter: spawn another python server, do NOT register its
        // PID, verify it stays out of the discovered list
        const orphanPort = testPort + 1;
        const py2 = spawn(process.platform === "win32" ? "python" : "python3",
          ["-m", "http.server", String(orphanPort), "--bind", "127.0.0.1"],
          { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
        let py2Ready = false;
        for (let i = 0; i < 50 && !py2Ready; i++) {
          py2Ready = await probePort(orphanPort);
          if (!py2Ready) await wait(100);
        }

        if (py2Ready) {
          await wait(3500);
          const r2 = await req("GET", "/api/discovered-ports");
          const j2 = JSON.parse(r2.body);
          const orphanFound = j2.ports.find((p) => p.port === orphanPort);
          check("untrusted port NOT in discovered list (trust filter works)", !orphanFound, orphanFound ? "leaked" : "");
        } else {
          check("python http.server #2 started", false);
        }
        try { py2.kill("SIGTERM"); } catch {}
        await wait(300);
        try { py2.kill("SIGKILL"); } catch {}
      }
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Passed: ${pass}`);
    console.log(`Failed: ${fail}`);
    if (fail > 0) {
      console.log("\nFAILURES:");
      for (const f of failures) console.log("  - " + f);
    }

    const errorLines = serverLog.filter((l) => /error|Error|throw|UnhandledPromise/i.test(l));
    if (errorLines.length) {
      console.log("\n=== Server log error lines ===");
      for (const l of errorLines) console.log("  ! " + l.trim());
    }
  } catch (e) {
    fail++;
    console.error("\nTest runner crashed:", e.message);
    console.error(e.stack);
  } finally {
    child.kill("SIGTERM");
    await wait(500);
    if (!child.killed) child.kill("SIGKILL");
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
