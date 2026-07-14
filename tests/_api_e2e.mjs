// _api_e2e.mjs — verify the host manager, adblock, and shells API end-to-end.
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 18790;
const BASE = `http://127.0.0.1:${PORT}`;
const PWD = "letmein";
const AUTH = "Basic " + Buffer.from("user:" + PWD).toString("base64");

let exit = 0;

function req(method, p, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(BASE + p, {
      method,
      headers: {
        Authorization: AUTH,
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (resp) => {
      let chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => res({ status: resp.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    r.on("error", rej);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const env = { ...process.env, PORT: String(PORT), PASSWORD: PWD };
  const child = spawn(process.execPath, [path.join(ROOT, "index.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (c) => process.stdout.write("[srv] " + c));
  child.stderr.on("data", (c) => process.stderr.write("[srv] " + c));

  try {
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
    console.log("[api-e2e] server up");

    // 1. /api/status
    let r = await req("GET", "/api/status");
    if (r.status !== 200) throw new Error("/api/status not 200");
    const j = JSON.parse(r.body);
    if (!j.ok) throw new Error("/api/status body not ok");
    if (!j.platform) throw new Error("/api/status missing platform");
    if (!j.proxy) throw new Error("/api/status missing proxy");
    if (!j.adblock) throw new Error("/api/status missing adblock");
    if (!Array.isArray(j.hosts)) throw new Error("/api/status hosts not array");
    if (!Array.isArray(j.shells)) throw new Error("/api/status shells not array");
    console.log("[api-e2e] /api/status: OK (proxy=" + j.proxy.running + " adblock=" + j.adblock.ready + ")");

    // 2. Host manager: add -> list -> patch -> probe -> delete
    r = await req("POST", "/api/hosts", { label: "smoketest", port: 59999, note: "auto-test" });
    if (r.status !== 200) throw new Error("POST /api/hosts not 200: " + r.body);
    const added = JSON.parse(r.body);
    if (!added.ok || !added.host) throw new Error("POST /api/hosts bad body");
    if (added.host.label !== "smoketest") throw new Error("POST /api/hosts wrong label");
    console.log("[api-e2e] POST /api/hosts: OK");

    r = await req("GET", "/api/hosts");
    if (r.status !== 200) throw new Error("GET /api/hosts not 200");
    const list = JSON.parse(r.body);
    if (!list.hosts.find((h) => h.label === "smoketest")) throw new Error("host missing from list");
    console.log("[api-e2e] GET /api/hosts: OK");

    r = await req("PATCH", "/api/hosts/smoketest", { enabled: false });
    if (r.status !== 200) throw new Error("PATCH /api/hosts not 200");
    const patched = JSON.parse(r.body);
    if (!patched.host.enabled === false) throw new Error("PATCH did not toggle");
    console.log("[api-e2e] PATCH /api/hosts: OK");

    r = await req("GET", "/api/hosts/probe");
    if (r.status !== 200) throw new Error("GET /api/hosts/probe not 200");
    const probe = JSON.parse(r.body);
    if (!Array.isArray(probe.results)) throw new Error("probe missing results");
    const probed = probe.results.find((p) => p.label === "smoketest");
    if (!probed) throw new Error("smoketest not in probe results");
    if (!["open", "closed", "timeout", "error"].includes(probed.status)) throw new Error("bad probe status: " + probed.status);
    console.log("[api-e2e] GET /api/hosts/probe: OK (status=" + probed.status + ")");

    r = await req("DELETE", "/api/hosts/smoketest");
    if (r.status !== 200) throw new Error("DELETE /api/hosts not 200");
    console.log("[api-e2e] DELETE /api/hosts: OK");

    // 3. Adblock status + check
    r = await req("GET", "/api/adblock/status");
    if (r.status !== 200) throw new Error("GET /api/adblock/status not 200");
    const ab = JSON.parse(r.body);
    console.log("[api-e2e] GET /api/adblock/status: OK (domains=" + (ab.blockedDomainCount || 0) + ")");

    r = await req("GET", "/api/adblock/check?url=https://example.com/track.js");
    if (r.status !== 200) throw new Error("GET /api/adblock/check not 200");
    const ck = JSON.parse(r.body);
    if (typeof ck.allowed !== "boolean") throw new Error("adblock check missing allowed field");
    console.log("[api-e2e] GET /api/adblock/check: OK (allowed=" + ck.allowed + ")");

    // 4. Shell CRUD
    r = await req("POST", "/api/shells", { label: "test-shell" });
    if (r.status !== 200) throw new Error("POST /api/shells not 200");
    const sh = JSON.parse(r.body);
    if (!sh.ok || !sh.shell) throw new Error("POST /api/shells bad body");
    const shellId = sh.shell.id;
    console.log("[api-e2e] POST /api/shells: OK (id=" + shellId.slice(0, 8) + ")");

    r = await req("GET", "/api/shells");
    if (r.status !== 200) throw new Error("GET /api/shells not 200");
    const shl = JSON.parse(r.body);
    if (!shl.shells.find((s) => s.id === shellId)) throw new Error("shell not in list");
    console.log("[api-e2e] GET /api/shells: OK");

    r = await req("DELETE", "/api/shells/" + shellId);
    if (r.status !== 200) throw new Error("DELETE /api/shells not 200");
    console.log("[api-e2e] DELETE /api/shells: OK");

    // 5. Static file fallbacks
    r = await req("GET", "/static/app.css");
    if (r.status !== 200) throw new Error("static app.css not 200");
    r = await req("GET", "/static/app.js");
    if (r.status !== 200) throw new Error("static app.js not 200");
    r = await req("GET", "/favicon.ico");
    if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw new Error("favicon unexpected: " + r.status);
    console.log("[api-e2e] static assets: OK");

    console.log("[api-e2e] ✅ all checks passed");
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
