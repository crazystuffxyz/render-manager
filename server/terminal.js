// server/terminal.js
// Multi-shell PTY manager. node-pty per shell, full xterm-256 color,
// proper Ctrl-C/SIGINT/SIGTERM semantics, persists across reconnects
// by shell id so a Ctrl-R reattaches the same PTY.

import pty from "node-pty";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { verifyWsToken } from "./auth.js";
import * as portWatcher from "./portWatcher.js";

const DEFAULT_COLS = 100;
const DEFAULT_ROWS = 30;
const KILL_GRACE_MS = 2000;

// browsers don't re-send the Authorization header on WS upgrades, so the
// client passes a short-lived signed token (issued by /api/ws-token after
// Basic Auth succeeded) as ?t=BASE64URL.
function extractWsToken(req) {
  try {
    const u = new URL(req.url, "http://x");
    return u.searchParams.get("t");
  } catch {
    return null;
  }
}

function checkWsToken(token) {
  return !!verifyWsToken(token);
}

function getShellForPlatform(shellOverride) {
  if (process.platform === "win32") {
    return shellOverride || process.env.SHELL_WIN || "cmd.exe";
  }
  if (process.platform === "darwin") {
    return shellOverride || process.env.SHELL_MAC || "zsh";
  }
  return shellOverride || process.env.SHELL_LINUX || "bash";
}

const shells = new Map();

function createShell({ label, cols = DEFAULT_COLS, rows = DEFAULT_ROWS, cwd } = {}) {
  const id = randomUUID();
  const shellPath = getShellForPlatform();
  const env = {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "1",
    CLICOLOR: "1",
    CLICOLOR_FORCE: "1",
  };

  // CRITICAL FIX: The Node process for the remote shell uses PORT (default 8080).
  // If we pass this down to the shell, any dev server (React, Next.js, Vite, etc.)
  // started inside the terminal will read PORT=8080 and try to bind to it, causing
  // EADDRINUSE crashes and breaking port discovery.
  delete env.PORT;

  // bare `bash` with cwd=undefined resolves to process.cwd() which on some
  // boxes is / or somewhere weird. fall back to home/userprofile.
  const safeCwd = cwd || process.env.HOME || process.env.USERPROFILE || process.cwd();

  const proc = pty.spawn(shellPath, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: safeCwd,
    env,
    useConpty: process.platform === "win32",
  });

  const entry = { id, proc, shellPath, cols, rows, label: label || deriveLabel(shellPath), createdAt: Date.now(), killed: false, clients: new Set(), dataDisposable: null, exitDisposable: null };
  shells.set(id, entry);
  try { portWatcher.recordShellPid(id, proc.pid); } catch {}
  // one onData + one onExit per shell, both fan out / clean up. registering
  // these per-WS leaks listeners and makes multiple tabs race on cleanup.
  // node-pty's onData + onExit both return disposables; we hold both so the
  // onExit handler can detach them before deleting the entry.
  const onData = (data) => {
    for (const c of entry.clients) {
      try { c.send(data); } catch {}
    }
  };
  entry.dataDisposable = proc.onData(onData);
  entry.exitDisposable = proc.onExit(({ exitCode, signal }) => {
    for (const c of entry.clients) {
      try { c.send(JSON.stringify({ type: "exit", exitCode, signal })); } catch {}
    }
    if (!entry.killed) {
      try { portWatcher.unrecordShell(id); } catch {}
    }
    if (entry.dataDisposable) {
      try { entry.dataDisposable.dispose(); } catch {}
      entry.dataDisposable = null;
    }
    if (entry.exitDisposable) {
      entry.exitDisposable = null; // we're inside it
    }
    shells.delete(id);
  });
  return entry;
}

function deriveLabel(shellPath) {
  const base = path.basename(shellPath);
  return base.replace(/\.exe$/i, "");
}

function getShell(id) {
  return shells.get(id) || null;
}

function listShells() {
  return Array.from(shells.values()).map((s) => ({
    id: s.id,
    label: s.label,
    pid: s.proc.pid,
    cols: s.cols,
    rows: s.rows,
    createdAt: s.createdAt,
    alive: !s.killed,
    platform: process.platform,
    shell: path.basename(s.shellPath),
  }));
}

function writeToShell(id, data) {
  const s = shells.get(id);
  if (!s || s.killed) return false;
  try {
    s.proc.write(data);
    return true;
  } catch (e) {
    console.error("[terminal] write failed:", e.message);
    return false;
  }
}

function resizeShell(id, cols, rows) {
  const s = shells.get(id);
  if (!s || s.killed) return false;
  try {
    s.proc.resize(cols, rows);
    s.cols = cols;
    s.rows = rows;
    return true;
  } catch (e) {
    console.error("[terminal] resize failed:", e.message);
    return false;
  }
}

function killShell(id, { signal = "SIGTERM", force = false } = {}) {
  const s = shells.get(id);
  if (!s || s.killed) return false;
  s.killed = true;
  try { portWatcher.unrecordShell(id); } catch {}
  try {
    if (process.platform === "win32") {
      // node-pty on Windows only supports process.kill() with the default
      // signal — for ConPTY/PowerShell that's a hard kill. For "Ctrl-C =
      // SIGINT" semantics, deliver \x03 into the pty; that lets the
      // foreground process see it the same way it would in a real terminal.
      if (signal === "SIGINT") {
        try { s.proc.write("\x03"); } catch {}
        if (force) {
          try { s.proc.kill(); } catch {}
        }
        return true;
      }
      s.proc.kill();
      return true;
    }
    s.proc.kill(signal);
    if (signal === "SIGTERM" && !force) {
      // SIGKILL escalation in case the child ignores SIGTERM. unref so a
      // process that died cleanly from SIGTERM doesn't keep the event loop
      // alive for 2s waiting for the escalation.
      setTimeout(() => {
        if (shells.has(id)) {
          try { s.proc.kill("SIGKILL"); } catch {}
        }
      }, KILL_GRACE_MS).unref();
    }
    return true;
  } catch (e) {
    console.error("[terminal] kill failed:", e.message);
    return false;
  }
}

function attachWebSocket(ws, id) {
  const s = shells.get(id);
  if (!s) {
    try {
      ws.send(JSON.stringify({ type: "error", error: "shell-not-found" }));
    } catch {}
    return ws.close(1008, "shell-not-found");
  }

  s.clients.add(ws);

  ws.on("message", (raw) => {
    // two message shapes: raw bytes go straight to pty; JSON envelope
    // carries {type: "resize",...} / {type: "signal",...} / {type: "kill",...}
    if (raw.length === 0) return;
    const head = raw[0];
    if (head === 0x7b) {
      let parsed = null;
      try {
        parsed = JSON.parse(raw.toString("utf8"));
      } catch {
        writeToShell(id, raw.toString("utf8"));
        return;
      }
      if (parsed && parsed.type === "resize") {
        resizeShell(id, parsed.cols, parsed.rows);
        return;
      }
      if (parsed && parsed.type === "signal") {
        killShell(id, { signal: parsed.name || "SIGTERM" });
        return;
      }
      if (parsed && parsed.type === "kill") {
        killShell(id, { signal: parsed.signal || "SIGTERM", force: !!parsed.force });
        return;
      }
      return;
    }

    // legacy RESIZE: prefix kept for the original frontend
    const text = raw.toString("utf8");
    if (text.startsWith("RESIZE:")) {
      try {
        const sz = JSON.parse(text.slice(7));
        resizeShell(id, sz.cols, sz.rows);
      } catch {}
      return;
    }
    writeToShell(id, text);
  });

  ws.on("close", () => {
    // drop this client from the fan-out set so the next onData doesn't
    // try to send to a dead socket. the shell itself is intentionally
    // preserved so a reconnect from another tab reattaches.
    if (s) s.clients.delete(ws);
  });
}

function buildWss({ server, authCheck }) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    // only handle /ws/term — leave other upgrade paths (proxy/local/viewport)
    // for the main server's upgrade listener. returning without touching
    // the socket here is what lets the next listener run.
    if (!url.startsWith("/ws/term")) return;
    // try regular authCheck (Authorization header etc.) first, then the ?t=... token
    const passed = (authCheck && authCheck(req)) || checkWsToken(extractWsToken(req));
    if (!passed) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const m = url.match(/^\/ws\/term(?:\/([A-Za-z0-9_-]+))?(?:\?|$)/);
    if (!m) {
      socket.destroy();
      return;
    }
    let id = m[1] || null;
    if (!id) {
      const s = createShell({});
      id = s.id;
    }
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        try {
          ws.send(JSON.stringify({ type: "hello", id, platform: process.platform }));
        } catch {}
        attachWebSocket(ws, id);
      });
    } catch (e) {
      try { socket.destroy(); } catch {}
    }
  });
  return wss;
}

function shutdownAll() {
  for (const s of shells.values()) {
    s.killed = true;
    try { portWatcher.unrecordShell(s.id); } catch {}
    try { s.proc.kill(); } catch {}
  }
  shells.clear();
}

export {
  createShell,
  getShell,
  listShells,
  writeToShell,
  resizeShell,
  killShell,
  attachWebSocket,
  buildWss,
  shutdownAll,
  getShellForPlatform,
};