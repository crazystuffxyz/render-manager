// server/sidecarApp.js
// In-process embedding of the cproxy sidecar.
//
// Instead of spawn()-ing cproxy on a second port, we import its index.js
// inside the same Node process and capture the express app it builds.
// The captured app is then mounted onto our own http server in index.js.
// The only thing we suppress is the actual TCP bind — cproxy's
// `server.listen(PORT)` is replaced with a no-op by patching
// http.Server.prototype.listen for the duration of cproxy's import.
//
// Why patch the prototype and not http.createServer? Because cproxy uses
// `import { createServer } from 'node:http'`, and that named import in
// ESM is bound to the original value at module-resolution time. Mutating
// `http.createServer` from outside is not visible to cproxy. The
// prototype method, on the other hand, is looked up at call-time via
// `this`, so any server instance cproxy creates will hit our patch.
//
// During cproxy's import we also tag any server that registers an
// 'upgrade' listener as the "sidecar" server, and capture both its
// 'request' listener (the express app) and its 'upgrade' listener
// (for WebSocket proxy delegation). The main server's upgrade handler
// calls the captured upgrade fn directly when it sees /proxy/* etc.

import http from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cproxyEntry = pathToFileURL(path.join(__dirname, "..", "cproxy", "index.js")).href;

let capturedApp = null;
let capturedUpgrader = null;
let loadingPromise = null;

export function loadSidecar() {
  if (capturedApp) return Promise.resolve({ app: capturedApp, upgrader: capturedUpgrader });
  if (loadingPromise) return loadingPromise;
  loadingPromise = doLoad();
  return loadingPromise;
}

async function doLoad() {
  const realListen = http.Server.prototype.listen;
  const realOn = http.Server.prototype.on;

  http.Server.prototype.listen = function patchedListen(...args) {
    if (this && this.__sidecar) {
      // Suppress the actual bind. Invoke the trailing callback (if any)
      // on next tick so any code that synchronously checks server.listening
      // doesn't observe a partial state.
      const cb = args[args.length - 1];
      if (typeof cb === "function") setImmediate(() => cb.call(this));
      return this;
    }
    return realListen.apply(this, args);
  };

  http.Server.prototype.on = function patchedOn(event, fn) {
    if (this && !this.__sidecar) {
      // First time we see this server, mark it as the sidecar and grab
      // the things we need off it. cproxy's createServer(app) registers
      // the express app as the 'request' listener internally, and
      // cproxy itself calls server.on('upgrade', handler) for WS proxying.
      this.__sidecar = true;
    }
    if (event === "request" && typeof fn === "function" && !capturedApp) {
      capturedApp = fn;
    } else if (event === "upgrade" && typeof fn === "function" && !capturedUpgrader) {
      capturedUpgrader = fn;
    }
    return realOn.call(this, event, fn);
  };

  try {
    // Dynamic import: cproxy's middleware uses `await` inside an async
    // app.use handler, which makes the module graph async, so we can't
    // use createRequire (ERR_REQUIRE_ASYNC_MODULE).
    await import(cproxyEntry);
  } finally {
    http.Server.prototype.listen = realListen;
    http.Server.prototype.on = realOn;
  }

  if (!capturedApp) {
    throw new Error("cproxy did not register a request handler — in-process embed failed");
  }
  if (!capturedUpgrader) {
    throw new Error("cproxy did not register an upgrade handler — in-process embed failed");
  }

  return { app: capturedApp, upgrader: capturedUpgrader };
}
