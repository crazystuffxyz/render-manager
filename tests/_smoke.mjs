// _smoke.mjs — verify the rebuilt dashboard renders without errors.
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 18783;
const BASE = `http://127.0.0.1:${PORT}`;
const PWD = "letmein";
const AUTH = "Basic " + Buffer.from("user:" + PWD).toString("base64");

const errors = [];
const consoleErrors = [];

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await new Promise((res, rej) => {
        const req = http.get(BASE + "/healthz", (r) => { r.resume(); res(r.statusCode === 200); });
        req.on("error", rej);
        req.setTimeout(1000, () => req.destroy(new Error("t")));
      });
      if (r) return;
    } catch {}
    await wait(200);
  }
  throw new Error("server not up");
}

async function get(p) {
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
  let exit = 0;
  try {
    await waitForServer();
    console.log("[smoke] server up");

    const idx = await get("/");
    if (idx.status !== 200) throw new Error("dashboard not 200: " + idx.status);
    if (!idx.body.includes("<aside class=\"sidebar\">")) throw new Error("dashboard HTML missing sidebar");
    if (!idx.body.includes("nav-item")) throw new Error("dashboard HTML missing nav");
    if (!idx.body.includes("/static/app.css")) throw new Error("css link missing");
    if (!idx.body.includes("/static/app.js")) throw new Error("app.js script missing");
    console.log("[smoke] dashboard HTML OK");

    const css = await get("/static/app.css");
    if (css.status !== 200) throw new Error("css not 200");
    if (!css.body.includes("--accent: #2563eb")) throw new Error("css missing accent color");
    console.log("[smoke] css OK (" + css.body.length + " bytes)");

    const js = await get("/static/app.js");
    if (js.status !== 200) throw new Error("js not 200");
    if (!js.body.includes("getWsToken")) throw new Error("js missing ws-token fetch");
    console.log("[smoke] js OK (" + js.body.length + " bytes)");

    const token = await get("/api/ws-token");
    if (token.status !== 200) throw new Error("ws-token not 200");
    if (!token.body.includes('"token"')) throw new Error("ws-token missing token");
    console.log("[smoke] ws-token OK");

    // happy-dom render
    const window = new Window({
      url: BASE + "/",
      settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
    });
    const document = window.document;
    window.addEventListener("error", (ev) => errors.push("win: " + (ev.message || ev.error?.message)));
    window.addEventListener("unhandledrejection", (ev) => errors.push("rej: " + (ev.reason?.message || ev.reason)));
    window.console.error = (...a) => consoleErrors.push(a.map(String).join(" "));
    window.console.warn = () => {};

    const cleanHtml = idx.body
      .replace(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/g, "")
      .replace(/<script\b[^>]*src=[^>]*><\/script>/g, "")
      .replace(/<script\b[^>]*src=[^>]*>/g, "");
    document.write(cleanHtml);

    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      init = { ...init, headers: { ...(init.headers || {}), Authorization: AUTH }, credentials: "include" };
      return realFetch(input, init);
    };
    class FakeWS { constructor() { this.readyState = 3; this.listeners = {}; } addEventListener() {} send() {} close() {} }
    window.WebSocket = FakeWS;

    const rewritten = js.body
      .replace(/^\s*import\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?/gm, "")
      .replace(/^\s*import\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["'];?/gm, "");
    const blob = new window.URL("data:text/javascript;charset=utf-8," + encodeURIComponent(rewritten));
    const s = document.createElement("script");
    s.type = "module";
    s.textContent = `import("${blob}").then(() => { document.dispatchEvent(new Event('DOMContentLoaded')); window.__appLoaded = true; }).catch((e) => { window.__appLoadError = e; });`;
    document.body.appendChild(s);
    await wait(3000);

    if (window.__appLoadError) throw new Error("app.js load failed: " + window.__appLoadError.message);
    if (errors.length) throw new Error("window errors: " + JSON.stringify(errors, null, 2));
    if (consoleErrors.length) throw new Error("console.error: " + JSON.stringify(consoleErrors, null, 2));
    console.log("[smoke] no errors during render");

    if (!document.querySelector(".sidebar")) throw new Error("no sidebar");
    if (!document.querySelector(".nav-item")) throw new Error("no nav");
    if (!document.querySelector(".panel.active")) throw new Error("no active panel");
    if (!document.querySelector(".btn-primary")) throw new Error("no primary button");
    if (document.querySelector(".tabs")) throw new Error("old dark-theme .tabs class leaked");
    if (document.querySelector("#abStats")?.textContent === "Loading…") throw new Error("abStats never filled");
    console.log("[smoke] DOM structure looks like the new light theme");

    // Verify key CSS rules are in the stylesheet.
    if (!css.body.includes("var(--accent)")) throw new Error("css missing accent vars");
    if (!css.body.includes(".btn-primary")) throw new Error("css missing .btn-primary");
    if (!css.body.includes(".nav-item.active")) throw new Error("css missing .nav-item.active");
    console.log("[smoke] css has expected rules");

    console.log("[smoke] ✅ all checks passed");
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
