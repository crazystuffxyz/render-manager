// public/static/app.js
// public/static/app.js
// Dashboard logic. Talks to /api/* and /ws/term. Renders xterm.js for shells.
// Auth: HTTP Basic Auth. Browser caches the credential after the first
// successful prompt, so all fetches re-send it automatically. WebSocket
// upgrades can't include the header, so we fetch a short-lived signed
// token from /api/ws-token right before opening a shell.

const Terminal = window.Terminal;
const FitAddon = window.FitAddon.FitAddon;
const WebLinksAddon = window.WebLinksAddon.WebLinksAddon;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Helper to append __cpo=1 to our own API calls so the proxy's Service Worker
// strictly ignores them, avoiding infinite proxy loop interceptions.
function api(path) {
  return path + (path.includes("?") ? "&" : "?") + "__cpo=1";
}

// Cached WS token (refreshed automatically on 401 from the WS upgrade).
let wsToken = null;
let wsTokenPromise = null;
async function getWsToken() {
  if (wsToken) return wsToken;
  if (wsTokenPromise) return wsTokenPromise;
  wsTokenPromise = (async () => {
    const r = await fetch(api("/api/ws-token"), { credentials: "include" });
    if (!r.ok) throw new Error("ws-token: " + r.status);
    const j = await r.json();
    wsToken = j.token;
    return wsToken;
  })();
  try { return await wsTokenPromise; }
  finally { wsTokenPromise = null; }
}

// ---- bootstrap ----
document.addEventListener("DOMContentLoaded", async () => {
  // Status check; if 401 the browser will pop the Basic Auth prompt
  // automatically on this fetch.
  let r;
  try {
    r = await fetch(api("/api/status"), { credentials: "include" });
  } catch (e) {
    document.body.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#dc2626">Failed to reach server: ${e.message}</div>`;
    return;
  }
  if (r.status === 401) {
    // The browser showed the prompt and the user cancelled. Render a clean
    // "click to sign in" affordance — the click forces a fresh prompt
    // (fetching /api/status, which is gated, makes the browser prompt).
    document.body.innerHTML = `<div style="padding:48px 32px;font-family:system-ui;color:#475569;text-align:center;max-width:480px;margin:0 auto">
      <div style="font-size:48px;font-family:ui-monospace,Consolas,monospace;color:#2563eb;line-height:1;margin-bottom:16px">&gt;_</div>
      <h1 style="font-size:20px;font-weight:600;color:#0f172a;margin:0 0 8px">Remote Shell</h1>
      <p style="font-size:14px;margin:0 0 24px">Authentication required to continue.</p>
      <button id="retry" style="padding:10px 20px;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:white;cursor:pointer;font-weight:500;font-size:14px">Sign in</button>
    </div>`;
    document.getElementById("retry").addEventListener("click", () => location.reload());
    return;
  }
  if (!r.ok) {
    document.body.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#dc2626">Failed to reach server: ${r.status} ${r.statusText}</div>`;
    return;
  }
  const status = await r.json();
  bootstrap(status);
});

async function bootstrap(status) {
  renderHeader(status);
  bindTabs();

  // Restore any persistent shells running on the server across reloads
  terminalUI.restoreShells(status.shells);

  bindNewShell();
  bindHostForm();
  bindProxyForm();
  bindAdblock();

  await renderAdblock();
  await renderHosts();
  await renderPorts();
  renderStatus(status);

  setInterval(refreshStatus, 4000);
  setInterval(renderAdblock, 12000);
  setInterval(renderPorts, 4000);
}

function renderHeader(s) {
  const platformLabel = s.platform === "win32" ? "windows" : s.platform === "darwin" ? "macos" : "linux";
  $("#host-info").textContent = `${platformLabel} • ${s.hostname}`;
  $("#userpill").textContent = (s.hostname || "u").slice(0, 1).toUpperCase();
  $("#userName").textContent = s.hostname || "user";
  $("#userHost").textContent = `${s.proxy.running ? "proxy: up" : "proxy: down"}`;
}

function bindTabs() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => b.classList.toggle("active", b === btn));
      const t = btn.dataset.tab;
      $$(".panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === t));
      if (t === "terminal") terminalUI.refit();
    });
  });
}

// ============================================================================
// Terminal
// ============================================================================
const terminalUI = (() => {
  const termTabsEl = $("#termTabs");
  const termHostEl = $("#termHost");
  const empty = $("#termEmpty");
  const tabs = new Map(); // id -> { label, term, wrapper, fit, ws, dead, exitInfo, pid }
  let active = null;

  function refit() {
    if (active && tabs.get(active)) {
      try { tabs.get(active).fit.fit(); } catch {}
    }
  }

  function renderTabs() {
    if (!termTabsEl) return;
    termTabsEl.innerHTML = "";
    if (tabs.size === 0) {
      if (empty) empty.style.display = "flex";
      return;
    }
    for (const [id, t] of tabs) {
      const el = document.createElement("div");
      el.className = "term-tab" + (id === active ? " active" : "");
      el.innerHTML = `<span>${escapeHtml(t.label)}</span><span class="pid">pid ${t.pid || "?"}</span><span class="x" title="Kill process">×</span>`;
      
      // Bind click to the whole tab element instead of just the inner span
      el.addEventListener("click", () => activate(id));
      el.querySelector(".x").addEventListener("click", (e) => { 
        e.stopPropagation(); 
        killShellUI(id); 
      });
      termTabsEl.appendChild(el);
    }
  }

  function activate(id) {
    active = id;
    if (!termHostEl) return;
    
    if (empty) empty.style.display = "none";

    for (const [tid, t] of tabs) {
      if (t.wrapper) {
        t.wrapper.style.display = (tid === id) ? "block" : "none";
      }
    }

    renderTabs();

    const t = tabs.get(id);
    if (t && t.term) {
      requestAnimationFrame(() => { 
        try { 
          t.fit.fit(); 
          t.term.focus(); 
        } catch {} 
      });
    }
  }

  function setupTerm(entry, ws) {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "SF Mono", Consolas, "Cascadia Code", monospace',
      fontSize: 13,
      theme: { background: "#000000", foreground: "#ffffff", cursor: "#ffffff", selectionBackground: "rgba(255,255,255,0.3)" },
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    entry.term = term;
    entry.fit = fit;
    
    const wrapper = document.createElement("div");
    wrapper.className = "term-wrapper";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    wrapper.style.display = "none";
    wrapper.style.overflow = "hidden";
    termHostEl.appendChild(wrapper);
    entry.wrapper = wrapper;
    
    term.open(wrapper);

    term.onData((data) => {
      if (entry.dead) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(data);
    });
    term.onResize(({ cols, rows }) => {
      if (entry.dead) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    });

    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "exit") {
            entry.dead = true;
            entry.exitInfo = msg;
            term.write(`\r\n\x1b[2m[process exited code=${msg.exitCode} signal=${msg.signal || "none"}]\x1b[0m\r\n`);
            return;
          }
          if (msg.type === "hello") {
            if (entry.id.startsWith("pending-")) {
              const oldId = entry.id;
              entry.id = msg.id;
              entry.platform = msg.platform;
              entry.pid = msg.pid;
              tabs.delete(oldId);
              tabs.set(msg.id, entry);
              if (active === oldId) activate(msg.id);
              else renderTabs();
            } else if (!entry.pid && msg.pid) {
              entry.pid = msg.pid;
              renderTabs();
            }
            return;
          }
        } catch {}
      }
      term.write(ev.data);
    });

    ws.addEventListener("close", () => {
      term.write("\r\n\x1b[2m[connection closed]\x1b[0m\r\n");
    });

    if (active === entry.id) {
      activate(entry.id);
    }
  }

  async function newShell() {
    let token;
    try { token = await getWsToken(); } catch (e) { toast("Auth failed: " + e.message, "bad"); return; }
    // Enforce __cpo=1 on WSS upgrades to escape proxy interception
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/term?t=${encodeURIComponent(token)}&__cpo=1`);
    const idPlaceholder = "pending-" + Math.random().toString(36).slice(2, 8);
    const entry = { label: "shell " + (tabs.size + 1), term: null, wrapper: null, fit: null, ws, dead: false, pid: null, id: idPlaceholder };
    tabs.set(idPlaceholder, entry);

    ws.addEventListener("open", () => setupTerm(entry, ws));
    if (!active) activate(idPlaceholder);
    else renderTabs();
  }

  async function restoreShells(shellsList) {
    if (!shellsList || !shellsList.length) return;
    for (const s of shellsList) {
      if (tabs.has(s.id)) continue;
      if (!s.alive) continue;
      let token;
      try { token = await getWsToken(); } catch (e) { continue; }
      
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/term/${s.id}?t=${encodeURIComponent(token)}&__cpo=1`);
      const entry = { id: s.id, label: s.label, term: null, wrapper: null, fit: null, ws, dead: false, pid: s.pid };
      tabs.set(s.id, entry);
      
      ws.addEventListener("open", () => {
        setupTerm(entry, ws);
      });
    }
    if (!active && shellsList.length > 0 && shellsList[0].alive) {
      activate(shellsList[0].id);
    } else {
      renderTabs();
    }
  }

  function killShell(id) {
    const t = tabs.get(id);
    if (!t) return;
    if (t.ws && t.ws.readyState === WebSocket.OPEN) {
      try { t.ws.send(JSON.stringify({ type: "kill", signal: "SIGTERM" })); } catch {}
    }
  }
  
  function killShellUI(id) {
    killShell(id);
    const t = tabs.get(id);
    if (t) {
      if (t.wrapper) t.wrapper.remove();
      if (t.term) t.term.dispose();
      tabs.delete(id);
    }
    if (active === id) {
      const keys = Array.from(tabs.keys());
      if (keys.length > 0) {
        activate(keys[keys.length - 1]);
      } else {
        active = null;
        if (empty) empty.style.display = "flex";
        renderTabs();
      }
    } else {
      renderTabs();
    }
  }

  window.addEventListener("resize", () => refit());

  return { newShell, restoreShells, refit };
})();

function bindNewShell() {
  $("#newShellBtn").addEventListener("click", () => terminalUI.newShell());
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ============================================================================
// Host manager
// ============================================================================
async function renderHosts() {
  const r = await fetch(api("/api/hosts"), { credentials: "include" });
  const j = await r.json();
  const body = $("#hostsBody");
  body.innerHTML = "";
  const hosts = j.hosts || [];
  if (hosts.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">No hosts configured.</td></tr>`;
    return;
  }
  let probe = { results: [] };
  try {
    const p = await (await fetch(api("/api/hosts/probe"), { credentials: "include" })).json();
    probe = p;
  } catch {}
  const byLabel = new Map();
  for (const p of (probe.results || [])) byLabel.set(p.label, p);
  for (const h of hosts) {
    const status = byLabel.get(h.label) || { status: "unknown" };
    const tr = document.createElement("tr");
    const proxyUrl = `/?__cpo=${btoa('http://127.0.0.1:' + h.port).replace(/=+$/, '')}`;
    tr.innerHTML = `
      <td><b>${escapeHtml(h.label)}</b></td>
      <td class="mono">${h.port}</td>
      <td><span class="status-pill ${status.status}">${status.status}</span></td>
      <td>${escapeHtml(h.note || "")}</td>
      <td><a class="btn btn-sm" href="${proxyUrl}" target="_blank" rel="noopener">Open ↗</a></td>
      <td class="actions">
        <button class="btn btn-sm" data-act="toggle" data-label="${escapeHtml(h.label)}">${h.enabled ? "Disable" : "Enable"}</button>
        <button class="btn btn-sm btn-danger" data-act="del" data-label="${escapeHtml(h.label)}">Delete</button>
      </td>`;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const label = btn.dataset.label;
      if (act === "del") {
        if (!confirm(`Delete host "${label}"?`)) return;
        await fetch(api("/api/hosts/" + encodeURIComponent(label)), { method: "DELETE", credentials: "include" });
        toast("Deleted.", "good");
      } else if (act === "toggle") {
        const h = hosts.find((x) => x.label === label);
        await fetch(api("/api/hosts/" + encodeURIComponent(label)), {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !h.enabled }),
        });
        toast(h.enabled ? "Disabled." : "Enabled.", "good");
      }
      renderHosts();
    });
  });
}

function bindHostForm() {
  $("#addHostForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = $("#hostLabel").value.trim();
    const port = Number($("#hostPort").value);
    const note = $("#hostNote").value.trim();
    const r = await fetch(api("/api/hosts"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, port, note }),
    });
    const j = await r.json();
    if (!j.ok) { toast(j.error || "Failed", "bad"); return; }
    $("#hostLabel").value = ""; $("#hostPort").value = ""; $("#hostNote").value = "";
    toast("Added " + j.host.label, "good");
    renderHosts();
  });
}

// ============================================================================
// Proxy
// ============================================================================
function bindProxyForm() {
  $("#proxyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#proxyInput").value.trim();
    if (!v) return;
    let url = v;
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    const u = new URL(url);
    const origin = u.origin;
    const encoded = btoa(origin);
    const proxied = u.pathname + u.search + (u.search ? "&" : "?") + "__cpo=" + encodeURIComponent(encoded);
    $("#proxyFrame").src = proxied;
  });
}

// ============================================================================
// Adblock
// ============================================================================
async function renderAdblock() {
  const s = await (await fetch(api("/api/adblock/status"), { credentials: "include" })).json();
  const el = $("#abStats");
  const items = [
    ["Status", s.enabled === false ? "disabled" : (s.ready ? "ready" : (s.loading ? "loading" : "idle"))],
    ["Blocked domains", (s.blockedDomainCount || 0).toLocaleString()],
    ["Cosmetic selectors", (s.cosmeticSelectorCount || 0).toLocaleString()],
    ["Source feeds", (s.sourceFiles || []).length],
    ["Last refresh", s.lastRefresh ? new Date(s.lastRefresh).toLocaleString() : "—"],
  ];
  el.classList.add("kv-grid");
  el.innerHTML = items.map(([k, v]) => `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(String(v))}</div>`).join("");
}

function bindAdblock() {
  $("#abRefresh").addEventListener("click", async () => {
    toast("Refreshing lists…");
    await fetch(api("/api/adblock/refresh"), { method: "POST", credentials: "include" });
    await renderAdblock();
    toast("Refreshed.", "good");
  });
  $("#abCheckForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("#abCheckUrl").value.trim();
    if (!url) return;
    const r = await fetch(api("/api/adblock/check?url=" + encodeURIComponent(url)), { credentials: "include" });
    const j = await r.json();
    $("#abResult").innerHTML = `<pre class="code-block">${escapeHtml(JSON.stringify(j, null, 2))}</pre>`;
  });
}

// ============================================================================
// Status
// ============================================================================
async function refreshStatus() {
  try {
    const s = await (await fetch(api("/api/status"), { credentials: "include" })).json();
    renderStatus(s);
    renderHeader(s);
  } catch {}
}

function renderStatus(s) {
  $("#statusBox").textContent = JSON.stringify(s, null, 2);
}

function toast(msg, kind = "info") {
  const wrap = $("#toasts");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind === "bad" ? "bad" : kind === "good" ? "good" : "");
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// Capture the password from the Basic Auth prompt by trapping fetch failures.
// If the user successfully authenticated, our very first /api/status succeeded;
// we can ask them once via a non-blocking prompt for the WS upgrade. We
// only ask on the first "+ New shell" click — see bindNewShell.

// ============================================================================
// Discovered ports
// ============================================================================
// Polls /api/discovered-ports every few seconds. Each row is a port we've
// either seen in a PTY's output or that the user added to the watch list.
// Actions:
//   * View    — open the port via the in-process proxy (/?__cpo=...)
//   * Probe   — single TCP connect; updates the status pill in place
//   * Watch   — toggle whether we keep tracking this port
//   * Hide    — remove from the default list (still visible with ?includeHidden)
//   * Kill    — try to kill the process listening on this port. The server
//               refuses to kill the app's own port.
async function renderPorts() {
  const body = $("#portsBody");
  if (!body) return;
  let ports = [];
  try {
    const r = await fetch(api("/api/discovered-ports"), { credentials: "include" });
    if (!r.ok) return;
    const j = await r.json();
    ports = j.ports || [];
  } catch {}
  if (ports.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">No ports discovered yet. Start a dev server in a shell and it will appear here.</td></tr>`;
    return;
  }
  body.innerHTML = "";
  for (const p of ports) {
    const tr = document.createElement("tr");
    tr.dataset.port = p.port;
    const status = p.alive === true ? "open" : p.alive === false ? "closed" : "unknown";
    const ago = p.lastSeen ? timeAgo(p.lastSeen) : "—";
    const proxyUrl = `/?__cpo=${btoa('http://127.0.0.1:' + p.port).replace(/=+$/, '')}`;
    tr.innerHTML = `
      <td class="mono"><b>${p.port}</b></td>
      <td>${escapeHtml(p.label || "")}</td>
      <td><span class="status-pill ${status}">${status}</span></td>
      <td class="mono">${p.pid || "—"}</td>
      <td class="muted">${ago}</td>
      <td class="actions">
        <a class="btn btn-sm" href="${proxyUrl}" target="_blank" rel="noopener">View ↗</a>
        <button class="btn btn-sm" data-act="probe" data-port="${p.port}">Probe</button>
        <button class="btn btn-sm" data-act="watch" data-port="${p.port}" data-watched="${p.watched ? "1" : "0"}">${p.watched ? "Unwatch" : "Watch"}</button>
        <button class="btn btn-sm" data-act="hide" data-port="${p.port}">Hide</button>
        <button class="btn btn-sm btn-danger" data-act="kill" data-port="${p.port}">Kill</button>
      </td>`;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const port = Number(btn.dataset.port);
      if (act === "probe") {
        btn.disabled = true;
        try {
          const r = await fetch(api("/api/discovered-ports/probe"), {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ port }),
          });
          const j = await r.json();
          toast(`Port ${port}: ${j.alive ? "open" : "closed"}`, j.alive ? "good" : "info");
        } finally { btn.disabled = false; }
        await renderPorts();
      } else if (act === "watch") {
        if (btn.dataset.watched === "1") {
          await fetch(api("/api/discovered-ports/unwatch"), {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ port }),
          });
          toast(`Stopped watching ${port}`, "info");
        } else {
          await fetch(api("/api/discovered-ports/watch"), {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ port, label: "" }),
          });
          toast(`Watching ${port}`, "good");
        }
        await renderPorts();
      } else if (act === "hide") {
        await fetch(api("/api/discovered-ports/hide"), {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ port, hidden: true }),
        });
        toast(`Hid ${port}`, "info");
        await renderPorts();
      } else if (act === "kill") {
        if (!confirm(`Try to kill the process on port ${port}?`)) return;
        const r = await fetch(api("/api/discovered-ports/kill"), {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ port }),
        });
        const j = await r.json();
        if (j.ok) {
          toast(`Signaled ${(j.results || []).filter((x) => x.ok).length} process(es) on ${port}`, "good");
        } else {
          toast(`Cannot kill ${port}: ${j.reason}`, "bad");
        }
        setTimeout(() => renderPorts(), 1200);
      }
    });
  });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
