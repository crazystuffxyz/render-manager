// server/portWatcher.js
// Discovers dev-server ports by asking the OS who's listening on what —
// not by parsing PTY output, so it works for Vite/webpack/Next/etc no
// matter how they format their startup banner. A port is only surfaced
// if its owning pid is us or a descendant of a shell we spawned.

import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const ports = new Map();
const trustedPids = new Set([process.pid]);
const shellRootPids = new Map();
let pollTimer = null;
let pollImmediate = false;
let pollInFlight = false;
let pollStopped = false;

// Self-port as a function (not a const) so it reads PORT at call time,
// after loadEnv() has populated process.env. Same value every call, just
// evaluated lazily.
const SELF_PORT = () => Number(process.env.PORT) || 8080;
const PROBE_TIMEOUT_MS = 1200;
const KILL_GRACE_MS = 2000;

const MIN_INTERVAL = 2000;
const MAX_INTERVAL = 60000;
let pollInterval = 2000;

export function probeAlive(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(v); };
    sock.setTimeout(PROBE_TIMEOUT_MS);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, host);
  });
}

export function recordShellPid(shellId, pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  shellRootPids.set(shellId, pid);
  trustedPids.add(pid);
  // kick a poll now so this shell's grandchildren get trusted without a full interval
  scheduleNextPoll(true);
}

export function unrecordShell(shellId) {
  const rootPid = shellRootPids.get(shellId);
  shellRootPids.delete(shellId);
  // remove the root pid from trusted immediately so PID reuse between
  // polls can't sneak a foreign process in
  if (rootPid) trustedPids.delete(rootPid);
}

export function getAll({ includeHidden = false } = {}) {
  const arr = [];
  for (const p of ports.values()) {
    if (p.hidden && !includeHidden) continue;
    arr.push({
      port: p.port,
      label: p.label,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      hits: p.hits,
      sample: p.sample,
      alive: p.alive,
      pid: p.pid,
      watched: !!p.watched,
      hidden: !!p.hidden,
    });
  }
  arr.sort((a, b) => b.lastSeen - a.lastSeen);
  return arr;
}

export function addWatch(port, label) {
  if (!isPlausiblePort(port)) return { ok: false, reason: "port out of range" };
  const info = ports.get(port) || {
    port,
    label: null,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    hits: 0,
    sample: null,
    hidden: false,
    watched: false,
    alive: null,
    pid: null,
  };
  info.watched = true;
  if (label) info.label = String(label).slice(0, 64);
  ports.set(port, info);
  return { ok: true, port: info };
}

export function removeWatch(port) {
  const info = ports.get(port);
  if (!info) return { ok: false, reason: "not watched" };
  if (info.hits === 0 && info.watched) ports.delete(port);
  else info.watched = false;
  return { ok: true };
}

export function setHidden(port, hidden) {
  const info = ports.get(Number(port));
  if (!info) return { ok: false, reason: "unknown port" };
  info.hidden = !!hidden;
  return { ok: true };
}

export function setLabel(port, label) {
  const info = ports.get(Number(port));
  if (!info) return { ok: false, reason: "unknown port" };
  info.label = label ? String(label).slice(0, 64) : null;
  return { ok: true };
}

export function clearAll() {
  ports.clear();
  return { ok: true };
}

function isPlausiblePort(p) {
  if (!Number.isInteger(p)) return false;
  if (p < 1 || p > 65535) return false;
  if (p === SELF_PORT()) return false;
  return true;
}

async function enumerateAllListeningSockets() {
  try {
    if (process.platform === "win32") return await enumerateAllWindows();
    if (process.platform === "darwin") return await enumerateAllLsof();
    try { return await enumerateAllLsof(); }
    catch { return await enumerateAllSs(); }
  } catch {
    return [];
  }
}

async function enumerateAllWindows() {
  // `netstat -ano -p TCP` lines look like:
  //   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234
  // PID is the last column. Only LISTENING entries count.
  const { stdout } = await execFileP("netstat", ["-ano", "-p", "TCP"], { windowsHide: true, timeout: 5000 });
  const out = [];
  for (const raw of stdout.split(/\r?\n/)) {
    if (!/LISTENING/i.test(raw)) continue;
    const cols = raw.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const local = cols[1] || "";
    // lastIndexOf finds the port separator in both 0.0.0.0:3000 and [::]:3000
    const colon = local.lastIndexOf(":");
    if (colon < 0) continue;
    const port = Number(local.slice(colon + 1));
    const pid = Number(cols[cols.length - 1]);
    if (!isPlausiblePort(port) || !Number.isInteger(pid) || pid <= 0) continue;
    out.push({ port, pid, address: local.slice(0, colon) });
  }
  return out;
}

async function enumerateAllLsof() {
  // -F nP: machine-parseable. Records alternate p<pid> and n<name> lines.
  // name is "n*:3000" / "n127.0.0.1:8080" / "n[::1]:443".
  const { stdout } = await execFileP(
    "lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "nP"],
    { windowsHide: true, timeout: 5000 }
  );
  const out = [];
  let curPid = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const tag = line[0];
    if (tag === "p") {
      curPid = Number(line.slice(1));
    } else if (tag === "n" && curPid && curPid > 0) {
      const name = line.slice(1);
      const m = name.match(/^(?:\*|[\d.]+|\[[^\]]*\]):(\d{1,5})$/);
      if (m) {
        const port = Number(m[1]);
        if (isPlausiblePort(port)) {
          const lastColon = name.lastIndexOf(":");
          out.push({ port, pid: curPid, address: lastColon > 0 ? name.slice(0, lastColon) : name });
        }
      }
    }
  }
  return out;
}

async function enumerateAllSs() {
  // ss -tlnpH: numeric, listening, with process info. "users:" field has pid=NNNN,..
  // Format: State Recv-Q Send-Q LocalAddr:Port PeerAddr:Port [users:(...)]
  // The local address is the 4th whitespace-separated token. We anchor on
  // that token, then split on its last ":" to get the port — the previous
  // regex matched the first ":" in the line (which is the recv-q "0" not
  // the port) and always returned port 0, which isPlausiblePort rejects.
  const { stdout } = await execFileP("ss", ["-tlnpH"], { windowsHide: true, timeout: 5000 });
  const out = [];
  for (const raw of stdout.split(/\r?\n/)) {
    if (!/^LISTEN\s/.test(raw)) continue;
    const pidMatch = raw.match(/pid=(\d+)/);
    if (!pidMatch) continue;
    const toks = raw.trim().split(/\s+/);
    if (toks.length < 4) continue;
    const local = toks[3];
    const colon = local.lastIndexOf(":");
    if (colon < 0) continue;
    const port = Number(local.slice(colon + 1));
    if (!isPlausiblePort(port)) continue;
    out.push({ port, pid: Number(pidMatch[1]), address: local.slice(0, colon) });
  }
  return out;
}

async function reconcileFromOS() {
  const sockets = await enumerateAllListeningSockets();
  const seenPorts = new Set();
  let changes = 0;

  for (const s of sockets) {
    if (s.pid !== process.pid && !trustedPids.has(s.pid)) continue;
    if (s.port === SELF_PORT()) continue;
    seenPorts.add(s.port);

    const now = Date.now();
    const existing = ports.get(s.port);
    if (existing) {
      const was = existing.alive;
      existing.alive = true;
      existing.lastSeen = now;
      existing.pid = s.pid;
      if (!was) changes++;
    } else {
      changes++;
      ports.set(s.port, {
        port: s.port,
        label: null,
        firstSeen: now,
        lastSeen: now,
        hits: 1,
        sample: null,
        hidden: false,
        watched: false,
        alive: true,
        pid: s.pid,
      });
    }
  }

  // drop-on-death: anything we saw last time but didn't see this scan is gone.
  // manual watches stick around even when their process dies.
  for (const [port, info] of ports) {
    if (seenPorts.has(port)) continue;
    if (info.watched) continue;
    if (info.alive === false) continue;
    changes++;
    ports.delete(port);
  }
  return changes;
}

function adjustInterval(changes) {
  if (changes > 0) pollInterval = Math.max(MIN_INTERVAL, Math.floor(pollInterval / 2));
  else pollInterval = Math.min(MAX_INTERVAL, Math.floor(pollInterval * 1.5));
}

function scheduleNextPoll(immediate = false) {
  if (pollStopped) return;
  // a poll is currently awaiting rebuildAncestry/reconcileFromOS — its
  // tail call checks pollImmediate and reruns immediately, so just mark
  // intent and let the in-flight poll do the work.
  if (pollInFlight) {
    if (immediate) pollImmediate = true;
    return;
  }
  if (pollTimer) clearTimeout(pollTimer);
  pollImmediate = !!immediate;
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    if (pollStopped) return;
    pollInFlight = true;
    let changes = 0;
    try {
      await rebuildAncestry();
      changes = await reconcileFromOS();
    } catch {}
    pollInFlight = false;
    const rerun = pollImmediate;
    pollImmediate = false;
    if (pollStopped) return;
    adjustInterval(changes);
    scheduleNextPoll(rerun);
  }, pollImmediate ? 0 : pollInterval);
  // don't pin the event loop open on the periodic poll — if the server has
  // nothing else to do, we want it to exit. The shell subsystem has its own
  // keep-alive (PIDs, ws client sets, etc.), so we don't need this to.
  if (pollTimer && typeof pollTimer.unref === "function") pollTimer.unref();
}

async function findPidsOnPort(port) {
  try {
    if (process.platform === "win32") return await findPidsWindows(port);
    if (process.platform === "darwin") return await findPidsLsof(port);
    try { return await findPidsSs(port); }
    catch { return await findPidsLsof(port); }
  } catch {
    return [];
  }
}

async function findPidsWindows(port) {
  const { stdout } = await execFileP("netstat", ["-ano", "-p", "TCP"], { windowsHide: true });
  const out = new Set();
  const needle = ":" + port + " ";
  for (const raw of stdout.split(/\r?\n/)) {
    if (!raw.includes(needle)) continue;
    if (!/LISTENING/i.test(raw)) continue;
    const cols = raw.trim().split(/\s+/);
    const pid = Number(cols[cols.length - 1]);
    if (Number.isInteger(pid) && pid > 0) out.add(pid);
  }
  return Array.from(out);
}

async function findPidsLsof(port) {
  const { stdout } = await execFileP("lsof", ["-nP", "-iTCP:" + port, "-sTCP:LISTEN", "-t"], { windowsHide: true });
  return stdout.split(/\r?\n/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

async function findPidsSs(port) {
  const { stdout } = await execFileP("ss", ["-tlnp", "sport", "=", ":", String(port)], { windowsHide: true });
  const out = new Set();
  for (const raw of stdout.split(/\r?\n/)) {
    const m = raw.match(/pid=(\d+)/);
    if (m) out.add(Number(m[1]));
  }
  return Array.from(out);
}

export async function tryKill(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, reason: "port out of range" };
  if (port === SELF_PORT()) return { ok: false, reason: "this port is required for the app" };

  const pids = await findPidsOnPort(port);
  if (!pids.length) return { ok: false, reason: "no process is listening on that port" };

  // refresh trust set so a brand-new shell's grandchildren are protected
  // even if the periodic poll hasn't run yet
  await rebuildAncestry();

  const results = [];
  for (const pid of pids) {
    if (pid === process.pid) {
      results.push({ pid, ok: false, reason: "would kill self" });
      continue;
    }
    
    // Explicitly removed the trustedPids block here so that user clicking
    // "Kill" can forcefully terminate their own dev server that the shell spun up!

    try {
      process.kill(pid, "SIGTERM");
      results.push({ pid, ok: true, signal: "SIGTERM" });
      const killTimer = setTimeout(() => {
        try { process.kill(pid, 0); }
        catch { return; }
        try { process.kill(pid, "SIGKILL"); } catch {}
      }, KILL_GRACE_MS);
      killTimer.unref(); // don't keep the server alive for the escalation
    } catch (e) {
      results.push({ pid, ok: false, reason: e.code || e.message });
    }
  }
  setTimeout(() => { scheduleNextPoll(true); }, 800).unref();
  return { ok: true, results };
}

let rebuildLock = null;
async function rebuildAncestry() {
  // simple promise-chain mutex so concurrent recordShellPid / unrecordShell
  // calls during a rebuild don't race against the clear+rebuild at the end.
  const prev = rebuildLock || Promise.resolve();
  let release;
  rebuildLock = new Promise((r) => { release = r; });
  try {
    await prev;
    const newTrusted = new Set([process.pid]);
    // take a final snapshot at the end too, so any recordShellPid that ran
    // during our awaits is also covered. Between this snapshot and the
    // clear+add below is a tiny window, but the mutex above keeps it closed.
    const shellsSnapshot = new Map(shellRootPids);
    for (const [shellId, rootPid] of shellsSnapshot) {
      newTrusted.add(rootPid);
      const children = await enumerateDescendants(rootPid).catch(() => []);
      for (const c of children) newTrusted.add(c);
    }
    // re-check the snapshot for any pids added during the awaits.
    for (const [shellId, rootPid] of shellRootPids) {
      newTrusted.add(rootPid);
    }
    trustedPids.clear();
    for (const p of newTrusted) trustedPids.add(p);
  } finally {
    release();
  }
}

async function enumerateDescendants(rootPid) {
  if (process.platform === "win32") return enumerateDescendantsWindows(rootPid);
  return enumerateDescendantsPosix(rootPid);
}

async function enumerateDescendantsWindows(rootPid) {
  // wmic is deprecated but still works on Win10/11. Newer Windows 11
  // builds without wmic fall back to PowerShell's Get-CimInstance.
  return enumerateDescendantsWindowsRecursive(rootPid, new Set(), 0);
}

// Intentionally recursive — wmic/wmi's single-level query only returns
// direct children of one pid, so the only way to walk a process tree is
// to recurse and union the results. Cap at 10 to bound fanout.
async function enumerateDescendantsWindowsRecursive(rootPid, visited, depth) {
  if (depth > 10) return [];
  if (visited.has(rootPid)) return [];
  visited.add(rootPid);
  let direct = [];
  try {
    const { stdout } = await execFileP("wmic", [
      "process", "where", `(ParentProcessId=${rootPid})`, "get", "ProcessId",
    ], { windowsHide: true, timeout: 5000 });
    direct = parsePids(stdout);
  } catch {
    try {
      const ps = `Get-CimInstance Win32_Process -Filter "ParentProcessId=${rootPid}" | Select-Object -ExpandProperty ProcessId`;
      const { stdout } = await execFileP("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 10000 });
      direct = parsePids(stdout);
    } catch { return []; }
  }
  const out = [];
  for (const pid of direct) {
    if (pid === process.pid) continue;
    out.push(pid);
    const grand = await enumerateDescendantsWindowsRecursive(pid, visited, depth + 1);
    for (const g of grand) out.push(g);
  }
  return out;
}

function parsePids(s) {
  return s.split(/\r?\n/)
    .map((l) => Number(l.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

async function enumerateDescendantsPosix(rootPid) {
  // `ps -axo pid=,ppid=` gives N rows. BFS to fixed point, cap at 10 levels.
  let frontier = [rootPid];
  const all = new Set();
  for (let depth = 0; depth < 10 && frontier.length; depth++) {
    let stdout;
    try {
      ({ stdout } = await execFileP("ps", ["-axo", "pid=,ppid="], { windowsHide: true }) );
    } catch {
      return Array.from(all);
    }
    const next = [];
    for (const line of stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const pid = Number(parts[0]);
      const ppid = Number(parts[1]);
      if (!Number.isInteger(pid) || !Number.isInteger(ppid)) continue;
      if (frontier.includes(ppid) && !all.has(pid) && pid !== process.pid) {
        all.add(pid);
        next.push(pid);
      }
    }
    frontier = next;
  }
  return Array.from(all);
}

export function start() {
  if (pollTimer) return;
  scheduleNextPoll(true);
}

export function stop() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  pollImmediate = false;
  pollStopped = true;
}

export function size() { return ports.size; }