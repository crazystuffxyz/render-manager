// server/adblock.js
// Server-side adblock orchestrator.
// - Boots a network-level domain blocklist (uBlock / ABP / EasyList / EasyPrivacy).
// - Boots a cosmetic-CSS blocklist for in-page injection.
// - Pulls additional feeds (Adblock Plus, EasyList, EasyPrivacy, Annoyances,
//   Peter Lowe's list, Online Malicious URL Blocklist) to maximize coverage.
// - Caches parsed rules to cproxy/.cache/filters.json and to
//   remote-shell/.data/adblock-cache.json for faster restarts.
// - Exposes a tiny status API the frontend polls to display "X rules loaded".

import fs from "node:fs";
import path from "node:path";
import axios from "axios";

const DATA_DIR = path.join(process.cwd(), ".data");
const CACHE_PATH = path.join(DATA_DIR, "adblock-cache.json");
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// Primary uBO lists (used by cproxy's existing engine).
const UBO_LISTS = [
  "filters.txt",
  "filters-2026.txt",
  "filters-2025.txt",
  "filters-2024.txt",
  "filters-2023.txt",
  "filters-2021.txt",
  "filters-2020.txt",
  "filters-general.txt",
  "filters-mobile.txt",
  "badware.txt",
  "privacy.txt",
  "privacy-removeparam.txt",
  "resource-abuse.txt",
  "annoyances.txt",
  "annoyances-cookies.txt",
  "annoyances-others.txt",
  "unbreak.txt",
  "experimental.txt",
  "quick-fixes.txt",
  "lan-block.txt",
  "legacy.txt",
  "ubol-filters.txt",
  "ubo-link-shorteners.txt",
  "badlists.txt",
];

const UBO_BASE = "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/";

// Adblock Plus / EasyList standard feeds.
const ABP_LISTS = [
  "https://easylist.to/easylist/easylist.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
  "https://secure.fanboy.co.nz/fanboy-annoyance.txt",
  "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
  "https://secure.fanboy.co.nz/fanboy-social.txt",
  "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0",
  "https://adaway.org/hosts.txt",
  // The hosts-file approach to adblocking. The Steven Black consolidated
  // list merges several sources (adware + malware + fakenews + gambling) into
  // a single hosts file we parse like the rest.
  "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
  // AdGuard BaseFilter — the canonical adblock list, served straight from
  // the AdguardTeam/AdguardFilters repo so we get fresh sections.
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers_firstparty.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/antiadblock.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/cryptominers.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/foreign.txt",
  // AdGuard's mobile-specific list.
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/MobileFilter/sections/adservers.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/MobileFilter/sections/antiadblock.txt",
  // AdGuard's Annoyances list (each subdir has its own sections/ dir).
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Popups/sections/popups_general.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Popups/sections/push-notifications_general.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Cookies/sections/cookies_general.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Other/sections/annoyances.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Other/sections/self-promo.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/Widgets/sections/widgets.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/AnnoyancesFilter/MobileApp/sections/mobile-app_general.txt",
];

// --- tiny ADB+ parser --
// ABP format rules: ||domain^ or ||domain^
function parseAbpLine(line) {
  if (!line) return null;
  if (line.startsWith("!") || line.startsWith("[")) return null;
  if (line.includes("##") || line.includes("#@#") || line.includes("#?#")) return null;
  if (line.includes("$")) return null;
  if (line.includes("+js(")) return null;
  const m = line.match(/^\|\|([a-z0-9.-]+)\^/i);
  if (!m) return null;
  return m[1].toLowerCase();
}

function parseHostLine(line) {
  // hosts file: 0.0.0.0 domain
  const m = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)/i);
  if (!m) return null;
  return m[1].toLowerCase();
}

function isEnabled() {
  return process.env.ADBLOCK !== "false" && process.env.ADBLOCK !== "0";
}

// --- state ---
let state = {
  ready: false,
  blockedDomains: new Set(),
  cosmeticSelectors: new Set(),
  cosmeticExceptions: new Map(), // hostname -> Set<selector>
  blockedDomainCount: 0,
  cosmeticSelectorCount: 0,
  sourceFiles: [],
  lastRefresh: 0,
  loading: false,
};

function isAllowed(url) {
  if (!isEnabled()) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      if (state.blockedDomains.has(parts.slice(i).join("."))) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function isAllowedHostname(hostname) {
  if (!isEnabled()) return true;
  if (!hostname) return true;
  const host = hostname.toLowerCase();
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (state.blockedDomains.has(parts.slice(i).join("."))) return false;
  }
  return true;
}

function getCosmeticCSS(hostname) {
  if (!isEnabled()) return "";
  if (!hostname) return "";
  const host = hostname.toLowerCase();
  const parts = host.split(".");
  const exceptions = new Set();
  // Walk up the subdomain chain (foo.bar.example.com → bar.example.com →
  // example.com) and collect exception selectors from any matching domain.
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const ex = state.cosmeticExceptions.get(candidate);
    if (ex) for (const s of ex) exceptions.add(s);
  }
  const rules = [];
  for (const sel of state.cosmeticSelectors) {
    if (exceptions.has(sel)) continue;
    // Strip braces defensively in case a malformed rule made it in.
    const clean = sel.replace(/[{}]/g, "").trim();
    if (clean) rules.push(clean);
  }
  return rules.map((s) => `${s} { display: none !important; }`).join("\n");
}

function getCosmeticSelectorsForHost(hostname) {
  if (!isEnabled()) return [];
  if (!hostname) return [];
  const parts = hostname.toLowerCase().split(".");
  const out = new Set();
  for (const sel of state.cosmeticSelectors) out.add(sel);
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join(".");
    const exceptions = state.cosmeticExceptions.get(candidate);
    if (exceptions) for (const s of exceptions) out.delete(s);
  }
  return Array.from(out);
}

function applyToCheerio($, hostname) {
  if (!$) return;
  if (!isEnabled()) return new Set();
  // Strip elements with URLs pointing to blocked domains.
  const blocked = new Set();
  const urlAttrs = [
    ["script", "src"],
    ["iframe", "src"],
    ["img", "src"],
    ["img", "data-src"],
    ["link[rel=stylesheet]", "href"],
    ["source", "src"],
    ["embed", "src"],
    ["object", "data"],
  ];
  for (const [sel, attr] of urlAttrs) {
    try {
      $(sel).each((_, el) => {
        const $el = $(el);
        const v = $el.attr(attr);
        if (!v) return;
        let target;
        try { target = new URL(v, "http://" + (hostname || "x")).hostname.toLowerCase(); } catch { return; }
        if (target && !isAllowedHostname(target)) {
          $el.remove();
          blocked.add(target);
        }
      });
    } catch {}
  }
  // Apply cosmetic selectors.
  const selectors = getCosmeticSelectorsForHost(hostname);
  for (const s of selectors) {
    try {
      const $matches = $(s);
      if ($matches.length) $matches.remove();
    } catch {}
  }
  return blocked;
}

async function fetchList(url, timeoutMs = 30000) {
  try {
    const r = await axios.get(url, { timeout: timeoutMs, responseType: "text", transformResponse: (d) => d });
    return String(r.data || "");
  } catch (e) {
    console.warn(`[adblock] failed to fetch ${url}: ${e.message}`);
    return "";
  }
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const stat = fs.statSync(CACHE_PATH);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const j = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    if (!j || !Array.isArray(j.blockedDomains)) return null;
    return j;
  } catch {
    return null;
  }
}

function saveCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      CACHE_PATH,
      JSON.stringify(
        {
          blockedDomains: Array.from(state.blockedDomains),
          cosmeticSelectors: Array.from(state.cosmeticSelectors),
          cosmeticExceptions: Array.from(state.cosmeticExceptions.entries()).map(([k, v]) => [k, Array.from(v)]),
          sourceFiles: state.sourceFiles,
          lastRefresh: state.lastRefresh,
        },
        null,
        2
      )
    );
  } catch (e) {
    console.warn("[adblock] cache write failed:", e.message);
  }
}

function applyCached(j) {
  state.blockedDomains = new Set(j.blockedDomains || []);
  state.cosmeticSelectors = new Set(j.cosmeticSelectors || []);
  state.cosmeticExceptions = new Map((j.cosmeticExceptions || []).map(([k, v]) => [k, new Set(v)]));
  state.sourceFiles = j.sourceFiles || [];
  state.lastRefresh = j.lastRefresh || 0;
  state.blockedDomainCount = state.blockedDomains.size;
  state.cosmeticSelectorCount = state.cosmeticSelectors.size;
  state.ready = true;
}

async function refresh({ force = false } = {}) {
  if (!isEnabled()) {
    state.ready = true;
    state.loading = false;
    return state;
  }

  if (state.loading) return state;
  state.loading = true;
  try {
    if (!force) {
      const cached = loadCache();
      if (cached) {
        applyCached(cached);
        console.log(`[adblock] loaded cache: ${state.blockedDomains.size} domains, ${state.cosmeticSelectors.size} selectors`);
      }
    }
    // Fetch uBO primary lists (in parallel where possible).
    const uboPromises = UBO_LISTS.map((f) => fetchList(UBO_BASE + f));
    const abpPromises = ABP_LISTS.map((u) => fetchList(u));
    const [uboResults, abpResults] = await Promise.all([
      Promise.all(uboPromises),
      Promise.all(abpPromises),
    ]);

    const blocked = new Set();
    const cosmetic = new Set();
    const cosmeticExceptions = new Map();
    const sourceFiles = [];

    // uBO format: ||domain^ and ##selector
    for (let i = 0; i < uboResults.length; i++) {
      const text = uboResults[i];
      const file = UBO_LISTS[i];
      if (!text) continue;
      sourceFiles.push(UBO_BASE + file);
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("!") || line.startsWith("[")) continue;
        if (line.includes("+js(")) continue;
        const cosmeticIdx = line.indexOf("##");
        if (cosmeticIdx !== -1) {
          const domainsPart = line.slice(0, cosmeticIdx);
          const sel = line.slice(cosmeticIdx + 2);
          if (!sel) continue;
          if (domainsPart === "") {
            cosmetic.add(sel);
          } else {
            // Skip domain-specific for now (keep global only) to limit cost.
          }
          continue;
        }
        const isException = line.startsWith("@@");
        const body = isException ? line.slice(2) : line;
        const m = body.match(/^\|\|([a-z0-9.-]+)\^/i);
        if (m) {
          const dom = m[1].toLowerCase();
          if (isException) blocked.delete(dom);
          else blocked.add(dom);
        }
      }
    }

    // ABP / hosts file: ||domain^ or 0.0.0.0 domain
    for (let i = 0; i < abpResults.length; i++) {
      const text = abpResults[i];
      if (!text) continue;
      sourceFiles.push(ABP_LISTS[i]);
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("!")) continue;
        const dom = parseAbpLine(line) || parseHostLine(line);
        if (dom) blocked.add(dom);
      }
    }

    // Never block these — they break everything.
    const PROTECT = [
      "google.com",
      "googleapis.com",
      "gstatic.com",
      "googleusercontent.com",
      "youtube.com",
      "ytimg.com",
      "github.com",
      "githubusercontent.com",
      "jsdelivr.net",
      "cdnjs.cloudflare.com",
      "cloudflare.com",
      "tailwindcss.com",
      "wikipedia.org",
      "wikimedia.org",
      "duckduckgo.com",
    ];
    for (const p of PROTECT) {
      // Only unblock at registrable domain level (no over-broad subdomains).
      blocked.delete(p);
    }

    state.blockedDomains = blocked;
    state.cosmeticSelectors = cosmetic;
    state.cosmeticExceptions = cosmeticExceptions;
    state.blockedDomainCount = blocked.size;
    state.cosmeticSelectorCount = cosmetic.size;
    state.sourceFiles = sourceFiles;
    state.lastRefresh = Date.now();
    state.ready = true;
    saveCache();
    console.log(`[adblock] refreshed: ${blocked.size} domains, ${cosmetic.size} selectors from ${sourceFiles.length} feeds`);
    return state;
  } finally {
    state.loading = false;
  }
}

function getStatus() {
  return {
    enabled: isEnabled(),
    ready: state.ready,
    loading: state.loading,
    blockedDomainCount: state.blockedDomainCount,
    cosmeticSelectorCount: state.cosmeticSelectorCount,
    sourceFiles: state.sourceFiles,
    lastRefresh: state.lastRefresh,
    cachePath: CACHE_PATH,
  };
}

// Boot on first import (background) — never blocks the server startup.
const cached = loadCache();
if (cached) {
  applyCached(cached);
}
// Kick off a refresh but don't await.
refresh().catch((e) => console.warn("[adblock] initial refresh failed:", e.message));

export { isAllowed, isAllowedHostname, getCosmeticCSS, getCosmeticSelectorsForHost, applyToCheerio, refresh, getStatus };