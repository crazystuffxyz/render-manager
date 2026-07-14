// server/hostManager.js
// User-facing list of "hosts" — local ports exposed through the proxy. The
// user can add, remove, and toggle entries from the UI. Each entry maps a
// port (e.g. 3000) to a label (e.g. "React App"). The proxy then serves
// that port at /local/{label}/... so the same /__cpo/ middleware works
// against it without further changes.
//
// Backed by an in-memory map plus a JSON file in the data dir so the list
// survives restarts.

import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const HOSTS_FILE = path.join(DATA_DIR, "hosts.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(HOSTS_FILE)) return new Map();
  try {
    const raw = fs.readFileSync(HOSTS_FILE, "utf8");
    if (!raw.trim()) return new Map();
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.hosts)) {
      throw new Error("hosts.json is missing the `hosts` array");
    }
    const out = new Map();
    for (const h of j.hosts) {
      if (!h || typeof h !== "object") continue;
      if (typeof h.label !== "string" || typeof h.port !== "number") continue;
      out.set(h.label, h);
    }
    return out;
  } catch (e) {
    // Surface the corruption instead of silently wiping — move the bad file
    // aside so the user can recover their entries by hand. The next save()
    // will rewrite the (empty) map, so this is the only chance to preserve
    // the original content.
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backup = HOSTS_FILE + ".corrupt-" + stamp;
      fs.renameSync(HOSTS_FILE, backup);
      console.error(`[hostManager] hosts.json was corrupt (${e.message}); moved to ${backup}`);
    } catch (renameErr) {
      console.error(`[hostManager] hosts.json corrupt and backup rename failed: ${e.message} / ${renameErr.message}`);
    }
    return new Map();
  }
}

function save(map) {
  ensureDataDir();
  const arr = Array.from(map.values());
  fs.writeFileSync(HOSTS_FILE, JSON.stringify({ hosts: arr }, null, 2));
}

function loadSeeds() {
  // Seed from .env HOST_PORTS if any. Each becomes "port-<n>".
  const map = new Map();
  const seed = (process.env.HOST_PORTS || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const port of seed) {
    if (!/^\d{1,5}$/.test(port)) continue;
    const label = `port-${port}`;
    map.set(label, {
      id: randomUUID(),
      label,
      port: Number(port),
      enabled: true,
      createdAt: Date.now(),
      note: "from .env",
    });
  }
  return map;
}

const hosts = load();
if (hosts.size === 0) {
  for (const [k, v] of loadSeeds()) hosts.set(k, v);
  if (hosts.size > 0) save(hosts);
}

function list() {
  return Array.from(hosts.values()).sort((a, b) => a.port - b.port || a.label.localeCompare(b.label));
}

function add({ label, port, note }) {
  if (!/^\d{1,5}$/.test(String(port))) throw new Error("invalid port");
  if (Number(port) < 1 || Number(port) > 65535) throw new Error("port out of range");
  const safeLabel = String(label || `port-${port}`).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,32}$/.test(safeLabel)) {
    throw new Error("label must be lowercase letters/digits/dashes, 1-33 chars");
  }
  // Reject duplicate labels.
  if (hosts.has(safeLabel)) throw new Error("label already exists");
  const entry = {
    id: randomUUID(),
    label: safeLabel,
    port: Number(port),
    enabled: true,
    createdAt: Date.now(),
    note: note ? String(note).slice(0, 200) : "",
  };
  hosts.set(safeLabel, entry);
  save(hosts);
  return entry;
}

function update(label, patch) {
  const entry = hosts.get(label);
  if (!entry) return null;
  if (patch.port !== undefined) {
    if (!/^\d{1,5}$/.test(String(patch.port))) throw new Error("invalid port");
    entry.port = Number(patch.port);
  }
  if (patch.enabled !== undefined) entry.enabled = !!patch.enabled;
  if (patch.note !== undefined) entry.note = String(patch.note).slice(0, 200);
  hosts.set(label, entry);
  save(hosts);
  return entry;
}

function remove(label) {
  if (!hosts.has(label)) return false;
  hosts.delete(label);
  save(hosts);
  return true;
}

function get(label) {
  return hosts.get(label) || null;
}

// Probe a port: returns 'open' | 'closed' | 'timeout' | 'error'
function probePort(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (status) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(status);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("open"));
    socket.once("timeout", () => finish("timeout"));
    socket.once("error", (err) => {
      if (err && (err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH")) finish("closed");
      else finish("error");
    });
    try {
      socket.connect(port, host);
    } catch {
      finish("error");
    }
  });
}

async function probeAll() {
  const out = [];
  for (const h of hosts.values()) {
    out.push({ label: h.label, port: h.port, status: await probePort(h.port) });
  }
  return out;
}

export { list, add, update, remove, get, probePort, probeAll, DATA_DIR, HOSTS_FILE };
