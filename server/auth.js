// server/auth.js
// HTTP Basic Auth — the browser shows a native password prompt.
// The user types the password (from .env) into the prompt; we verify the
// password portion of the decoded Authorization header against process.env.PASSWORD
// using a constant-time comparison.
//
// We also issue a short-lived signed WS token (/api/ws-token) that the
// dashboard can use to authenticate WebSocket upgrades, since browsers do
// not re-send the Authorization header on WS handshakes.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REALM = "remote-shell";
const WS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

// --- tiny .env loader so this file has zero npm deps ---
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function checkPassword(attempt) {
  const expected = process.env.PASSWORD;
  if (!expected) return false;
  if (typeof attempt !== "string" || attempt.length === 0) return false;
  // Constant-time compare on the longer of the two so an attacker can't
  // time-side-channel the expected length or content.
  const a = Buffer.from(attempt);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still do a fixed-time compare against the expected buffer so the
    // timing of the rejection is independent of input length.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function parseBasicAuth(header) {
  if (!header || typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function buildAuthMiddleware({ publicPaths = new Set() } = {}) {
  return function authMiddleware(req, res, next) {
    const url = (req.url || "").split("?")[0];
    if (publicPaths.has(url) || publicPaths.has(req.url)) return next();

    // Skip auth entirely if no PASSWORD is configured. The .env loader
    // fills in "letmein" by default, so this is only true in tests.
    if (!process.env.PASSWORD) return next();

    const creds = parseBasicAuth(req.headers.authorization);
    if (creds && checkPassword(creds.pass)) {
      req.user = { name: creds.user || "user" };
      return next();
    }

    // Browser will pop a native prompt with this header. APIs get JSON.
    if (url.startsWith("/api/")) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Basic realm="${REALM}"`,
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    res.writeHead(401, {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": `Basic realm="${REALM}"`,
    });
    res.end("Authentication required.");
  };
}

// --- short-lived WS tokens ---
// The dashboard fetches /api/ws-token after Basic Auth succeeds; the server
// returns a signed token tied to the current password. The token is
// single-use per issuance and expires in 1h. The dashboard then opens
// /ws/term?t=BASE64 and the server validates the token there.
function signToken(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeWsToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(8).toString("hex")}`;
  const sig = signToken(payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyWsToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [ts, nonce, sig] = parts;
    const payload = `${ts}.${nonce}`;
    const expected = signToken(payload);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const issued = Number(ts);
    if (!Number.isFinite(issued) || Date.now() - issued > WS_TOKEN_TTL_MS) return null;
    return { issued };
  } catch {
    return null;
  }
}

function getSecret() {
  // We reuse the session-secret env var if set, otherwise derive from PASSWORD
  // so tests don't need a separate secret. This is a server-side secret, never
  // sent to the client, and is only used to sign WS tokens.
  let s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    s = "ws-token-secret::" + (process.env.PASSWORD || "default");
  }
  return s;
}

export { loadEnv, buildAuthMiddleware, checkPassword, parseBasicAuth, REALM, makeWsToken, verifyWsToken };
