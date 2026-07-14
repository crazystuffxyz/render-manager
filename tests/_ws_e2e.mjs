// _ws_e2e.mjs — verify the WS auth path end-to-end (Basic auth -> ws-token -> WS upgrade).
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";
import http from "node:http";
import { WebSocket } from "ws";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 18784;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;
const PWD = "letmein";
const AUTH = "Basic " + Buffer.from("user:" + PWD).toString("base64");

let exit = 0;

function get(p) {
  return new Promise((res, rej) => {
    http.get(BASE + p, { headers: { Authorization: AUTH } }, (r) => {
      let chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => res({ status: r.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    }).on("error", rej);
  });
}

async function main() {
  const env = { ...process.env, PORT: String(PORT), PASSWORD: PWD };
  const child = spawn(process.execPath, [path.join(ROOT, "index.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (c) => process.stdout.write("[srv] " + c));
  child.stderr.on("data", (c) => process.stderr.write("[srv] " + c));

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
    console.log("[ws-e2e] server up");

    // 401 without auth
    const noAuth = await new Promise((res) => {
      http.get(BASE + "/api/status", (r) => { r.resume(); res(r.statusCode); }).on("error", () => res(0));
    });
    if (noAuth !== 401) throw new Error("expected 401 without auth, got " + noAuth);
    console.log("[ws-e2e] 401 without auth: OK");

    // /api/status with auth
    const status = await get("/api/status");
    if (status.status !== 200) throw new Error("/api/status not 200: " + status.status);
    const j = JSON.parse(status.body);
    if (!j.ok) throw new Error("/api/status body not ok");
    console.log("[ws-e2e] /api/status with auth: OK");

    // /api/ws-token
    const tok = await get("/api/ws-token");
    if (tok.status !== 200) throw new Error("/api/ws-token not 200");
    const { token } = JSON.parse(tok.body);
    if (!token || typeof token !== "string" || token.length < 16) throw new Error("bad token");
    console.log("[ws-e2e] ws-token len=" + token.length);

    // WS without token -> 401
    const noTok = await new Promise((res) => {
      const ws = new WebSocket(WS_BASE + "/ws/term");
      let closed = false;
      ws.on("unexpected-response", (req, r) => { closed = true; res({ status: r.statusCode }); });
      ws.on("error", () => { if (!closed) res({ status: 0 }); });
      ws.on("close", (code) => { if (!closed) res({ status: -code }); });
    });
    if (noTok.status !== 401) throw new Error("expected 401 on WS without token, got " + noTok.status);
    console.log("[ws-e2e] WS without token -> 401: OK");

    // WS with valid token -> upgrade + "hello" message
    const hello = await new Promise((res, rej) => {
      const ws = new WebSocket(WS_BASE + "/ws/term?t=" + encodeURIComponent(token));
      const t = setTimeout(() => rej(new Error("WS hello timeout")), 5000);
      ws.on("open", () => {});
      ws.on("message", (data) => {
        const s = data.toString();
        try {
          const m = JSON.parse(s);
          if (m.type === "hello" && m.id) { clearTimeout(t); ws.close(); res(m); }
        } catch {}
      });
      ws.on("error", (e) => { clearTimeout(t); rej(e); });
    });
    if (!hello.id) throw new Error("no id in hello");
    if (hello.platform !== process.platform) throw new Error("platform mismatch: " + hello.platform);
    console.log("[ws-e2e] WS with token -> hello OK (id=" + hello.id.slice(0, 8) + "...)");

    // /api/shells shows the new shell
    const shells = JSON.parse((await get("/api/shells")).body);
    const found = shells.shells.find((s) => s.id === hello.id);
    if (!found) throw new Error("shell not in list after WS hello");
    console.log("[ws-e2e] shell listed in /api/shells: OK");

    // kill it
    const killed = await new Promise((res) => {
      const req = http.request(BASE + "/api/shells/" + hello.id, { method: "DELETE", headers: { Authorization: AUTH } }, (r) => {
        r.resume(); res(r.statusCode);
      });
      req.on("error", () => res(0));
      req.end();
    });
    if (killed !== 200) throw new Error("DELETE shell returned " + killed);
    console.log("[ws-e2e] DELETE shell: OK");

    console.log("[ws-e2e] ✅ all checks passed");
  } catch (e) {
    exit = 1;
    console.error("❌", e.message);
  } finally {
    child.kill("SIGTERM");
    await wait(300);
    if (!child.killed) child.kill("SIGKILL");
  }
  process.exit(exit);
}

main().catch((e) => { console.error(e); process.exit(1); });
