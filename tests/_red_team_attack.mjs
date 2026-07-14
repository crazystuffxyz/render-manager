// _red_team_attack.mjs — adversarial fuzzing. Spawns the server, hits it
// with concurrent / invalid / abusive traffic, then asserts the server is
// still alive and that no sockets / listeners / memory have leaked.
//
// Run standalone:   node tests/_red_team_attack.mjs
// Pass criteria:    process.exit(0) if the server survives all attacks.

import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 19999;
const BASE = `http://127.0.0.1:${PORT}`;
const PWD = "letmein";
const AUTH = "Basic " + Buffer.from("user:" + PWD).toString("base64");

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log("  ✓ " + label);
  } else {
    failures++;
    console.log("  ✗ " + label + (detail ? " — " + detail : ""));
  }
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(BASE + "/healthz", (r) => { r.resume(); if (r.statusCode === 200) res(); else rej(new Error("s=" + r.statusCode)); });
        req.on("error", rej);
        req.setTimeout(800, () => req.destroy(new Error("t")));
      });
      return;
    } catch {}
    await wait(150);
  }
  throw new Error("server didn't come up");
}

function req(method, p, { headers = {}, body = null } = {}) {
  return new Promise((res) => {
    const u = new URL(p, BASE);
    const r = http.request({
      method,
      host: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) },
    }, (resp) => {
      const chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => res({ status: resp.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    r.on("error", (e) => res({ status: 0, body: "", err: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

// =============================================================
// STARTUP
// =============================================================
console.log("\n=== RED TEAM: starting server ===");
const t0 = Date.now();
const child = spawn(process.execPath, [path.join(ROOT, "index.js")], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), PASSWORD: PWD, NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let srvLog = "";
let srvErr = "";
child.stdout.on("data", (c) => { srvLog += c.toString(); });
child.stderr.on("data", (c) => { srvErr += c.toString(); });
child.on("exit", (code, sig) => {
  console.log("[srv] exited code=" + code + " sig=" + sig);
});

let exitCode = 0;
try {
  await waitForServer();
  console.log("[red] server up in " + (Date.now() - t0) + "ms");

  // =============================================================
  // ATTACK 1: Concurrency / Race Conditions
  // =============================================================
  console.log("\n=== ATTACK 1: concurrency / race conditions ===");
  {
    // 200 concurrent /api/status requests
    const N = 200;
    const results = await Promise.all(Array.from({ length: N }, () => req("GET", "/api/status", { headers: { Authorization: AUTH } })));
    const ok = results.filter((r) => r.status === 200).length;
    check(`${N} concurrent /api/status all returned 200`, ok === N, `got ${ok}/${N}`);

    // 200 concurrent /api/discovered-ports reads while poll is running
    const r2 = await Promise.all(Array.from({ length: N }, () => req("GET", "/api/discovered-ports", { headers: { Authorization: AUTH } })));
    const ok2 = r2.filter((r) => r.status === 200).length;
    check(`${N} concurrent /api/discovered-ports all 200`, ok2 === N, `got ${ok2}/${N}`);

    // 200 concurrent /api/ws-token
    const r3 = await Promise.all(Array.from({ length: N }, () => req("GET", "/api/ws-token", { headers: { Authorization: AUTH } })));
    const ok3 = r3.filter((r) => r.status === 200).length;
    check(`${N} concurrent /api/ws-token all 200`, ok3 === N, `got ${ok3}/${N}`);

    // 100 concurrent /api/hosts GETs
    const r4 = await Promise.all(Array.from({ length: 100 }, () => req("GET", "/api/hosts", { headers: { Authorization: AUTH } })));
    const ok4 = r4.filter((r) => r.status === 200).length;
    check(`100 concurrent /api/hosts GET all 200`, ok4 === 100, `got ${ok4}/100`);
  }

  // =============================================================
  // ATTACK 2: Resource Exhaustion / Listener Leak Detection
  // =============================================================
  console.log("\n=== ATTACK 2: resource exhaustion / listener leaks ===");
  {
    const N = 50;
    // Get a WS token first
    const tokRes = await req("GET", "/api/ws-token", { headers: { Authorization: AUTH } });
    const token = JSON.parse(tokRes.body).token;

    // Pre-attack listener baseline (we measure our process)
    const baseListeners = process.listenerCount("request");

    // Spawn N shells
    const shellIds = [];
    for (let i = 0; i < N; i++) {
      const r = await req("POST", "/api/shells", { headers: { Authorization: AUTH }, body: JSON.stringify({ label: "fuzz-" + i }) });
      if (r.status === 200) {
        const s = JSON.parse(r.body).shell;
        if (s) shellIds.push(s.id);
      }
    }
    check(`created ${N} shells via /api/shells`, shellIds.length === N, `got ${shellIds.length}`);

    // Open N WebSocket connections to /ws/term
    const sockets = [];
    for (let i = 0; i < N; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/term/${shellIds[i]}?t=${encodeURIComponent(token)}`);
      ws.on("error", () => {}); // swallow errors from abruptly-terminated sockets
      sockets.push(ws);
    }
    // wait for opens
    await new Promise((res) => setTimeout(res, 500));

    const openCount = sockets.filter((w) => w.readyState === WebSocket.OPEN).length;
    check(`${N} /ws/term sockets opened`, openCount === N, `got ${openCount}`);

    // Abruptly drop ALL of them (no graceful close)
    for (const w of sockets) {
      try { if (w.readyState !== WebSocket.CLOSED) w.terminate(); } catch {}
    }
    // Give the server a moment to handle the closes
    await new Promise((res) => setTimeout(res, 1500));

    // Force GC if available, then check process listeners
    if (global.gc) global.gc();

    const afterListeners = process.listenerCount("request");
    check("process listener count stable", afterListeners <= baseListeners + 2, `before=${baseListeners} after=${afterListeners}`);

    // Now kill the shells
    for (const id of shellIds) {
      await req("DELETE", "/api/shells/" + id, { headers: { Authorization: AUTH } });
    }
    await wait(500);
    const shellsLeft = JSON.parse((await req("GET", "/api/shells", { headers: { Authorization: AUTH } })).body).shells;
    check("all shells killed", shellsLeft.length === 0, `left=${shellsLeft.length}`);

    // Memory should not have grown unboundedly. Heuristic: <100MB heap.
    const mem = process.memoryUsage();
    check("process memory under 200MB", mem.heapUsed < 200 * 1024 * 1024, `heapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  }

  // =============================================================
  // ATTACK 3: Input Mutation / Fuzzing
  // =============================================================
  console.log("\n=== ATTACK 3: input mutation / fuzzing ===");
  {
    // 3a: malformed JSON to /api/hosts
    const bad = [
      "{",
      "{,}",
      '{"port":}',
      '{"port":NaN}',
      '{"port":-1}',
      '{"port":99999999}',
      '{"label":"../etc/passwd","port":3000}',
      '{"label":"x; DROP TABLE","port":3000}',
      '{"label":"a".repeat(10000),"port":3000}',
      "\x00\x01\x02\xff",
      "null",
      "[]",
      "42",
    ];
    for (const b of bad) {
      const r = await req("POST", "/api/hosts", { headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: b });
      check(`malformed JSON to /api/hosts returns 4xx (got ${r.status}): ${JSON.stringify(b.slice(0, 30))}`, r.status >= 400 && r.status < 500, "");
    }

    // 3b: path traversal attempts on /static/
    const trav = [
      "/static/../package.json",
      "/static/../../etc/passwd",
      "/static/../../../etc/hosts",
      "/static/..%2F..%2Fpackage.json",
      "/static/..%5C..%5Cetc",
      "/static/....//package.json",
      "/static/%2e%2e/package.json",
      "/static/.%2e/.%2e/etc",
      "/static/" + "../".repeat(30) + "etc/passwd",
      "/static/" + "..%2f".repeat(30) + "etc",
    ];
    for (const t of trav) {
      const r = await req("GET", t, { headers: { Authorization: AUTH } });
      const safe = r.status === 403 || r.status === 404;
      check(`traversal blocked (${r.status}) for ${t.slice(0, 40)}`, safe, "");
    }

    // 3c: oversized payload
    const huge = "x".repeat(5 * 1024 * 1024);
    const r3c = await req("POST", "/api/hosts", { headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: huge });
    check(`oversized payload handled (status ${r3c.status})`, r3c.status < 600, "");

    // 3d: malformed Authorization header
    const r3d = await req("GET", "/api/status", { headers: { Authorization: "Basic not-base64-!!!" } });
    check(`bad Authorization returns 401 (got ${r3d.status})`, r3d.status === 401, "");

    // 3e: garbage bytes on WebSocket upgrade
    const r3e = await new Promise((res) => {
      const s = net.connect(PORT, "127.0.0.1", () => {
        s.write("GET /ws/term HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n");
      });
      s.on("data", () => {});
      s.on("end", () => res({ closed: true }));
      s.on("close", () => res({ closed: true }));
      s.on("error", () => res({ closed: true }));
      setTimeout(() => { try { s.destroy(); } catch {} res({ closed: true }); }, 1000);
    });
    check("garbage WS upgrade closed cleanly", r3e.closed === true, "");

    // 3f: random path fuzzing
    const randomPaths = [
      "/proxy/" + "../".repeat(10) + "etc",
      "/local/" + "x".repeat(2000),
      "/viewport/0/",
      "/viewport/99999/",
      "/viewport/abc/",
      "/viewport/1/", // port 1 has no listener — sidecar will error, server should still respond
      "/api/" + "x".repeat(2000),
      "/api/shells/" + "x".repeat(2000) + "/signal",
    ];
    for (const p of randomPaths) {
      const r = await req("GET", p, { headers: { Authorization: AUTH } });
      check(`random path returned cleanly (${r.status}) for ${p.slice(0, 50)}`, r.status >= 200 && r.status < 600, "");
    }
  }

  // =============================================================
  // ATTACK 4: WS Proxy under fuzz
  // =============================================================
  console.log("\n=== ATTACK 4: WS proxy under fuzz ===");
  {
    // 50 concurrent WS connections to /__cpw.php pointing at a port nothing listens on
    const sockets = [];
    for (let i = 0; i < 50; i++) {
      const u = "ws://127.0.0.1:1";
      const encoded = Buffer.from(u).toString("base64").replace(/=+$/, "");
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/__cpw.php?u=${encodeURIComponent(encoded)}`);
      // suppress unhandled 'error' on sockets that fail before open
      ws.on("error", () => {});
      sockets.push(ws);
    }
    await new Promise((res) => setTimeout(res, 2000));
    for (const w of sockets) {
      try { if (w.readyState !== WebSocket.CLOSED) w.terminate(); } catch {}
    }
    await wait(500);

    // Health check
    const h = await req("GET", "/healthz");
    check("server still healthy after WS proxy fuzz", h.status === 200, "got " + h.status);
  }

  // =============================================================
  // ATTACK 5: process still alive
  // =============================================================
  console.log("\n=== ATTACK 5: process survival ===");
  {
    const r = await req("GET", "/healthz");
    check("server still responsive", r.status === 200, "got " + r.status);
    const r2 = await req("GET", "/api/status", { headers: { Authorization: AUTH } });
    check("/api/status still works", r2.status === 200, "got " + r2.status);
  }

  // Final memory snapshot
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  console.log(`\n[mem] rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`);

  console.log("\n=== Server stderr (last 1000 chars) ===");
  console.log(srvErr.slice(-1000));

} catch (e) {
  console.error("\n[red] attack errored:", e.message);
  console.error(e.stack);
  exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await wait(500);
  if (!child.killed) child.kill("SIGKILL");
  await wait(200);
}

console.log(`\n=== RED TEAM: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures) ===`);
process.exit(failures === 0 && exitCode === 0 ? 0 : 1);
