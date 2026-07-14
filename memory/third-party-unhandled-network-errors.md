---
name: third-party-unhandled-network-errors
description: "Third-party modules (like the cproxy sidecar) can leave raw TCP sockets without an 'error' listener. When the upstream refuses the connection, the 'error' event is unhandled and propagates to process.on('uncaughtException'). Install a filter handler that swallows known-benign network error codes (ECONNREFUSED, ETIMEDOUT, ECONNRESET, EHOSTUNREACH, ENOTFOUND) and logs the rest."
metadata:
  type: feedback
---

When you embed a third-party module in-process and it does network I/O, the upstream TCP socket it opens may not have an `.on('error', ...)` attached. If the upstream is down, Node emits an 'error' event with `err.code` like `ECONNREFUSED` and that error bubbles up as `uncaughtException` in YOUR process. The third-party module's own `try { ... } catch {}` may not catch the error because it's emitted asynchronously, after the function that created the socket has returned.

Symptom: process.on('uncaughtException') gets called repeatedly with `err.code === 'ECONNREFUSED'` (or similar) during normal user navigation in the proxy.

**Why:** I hit this when the cproxy sidecar's WebSocket proxy tried to connect to a port nothing was listening on. My `process.on('uncaughtException')` handler logged it but the log spam was huge. The error was benign — it just means "the upstream port isn't open" — but the handler treated it like a real bug.

**How to apply:**
- Any time you `import` or `spawn` a third-party module that does networking, install a discriminating `process.on('uncaughtException')` handler BEFORE the import.
- The handler should filter on `err.code` against a known set of benign network errors: `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `EHOSTUNREACH`, `ENOTFOUND`. Swallow those silently.
- Log anything else as `[main] uncaughtException: <stack>`. Do NOT rethrow — Node 15+ crashes by default, which is worse than logging.
- Pair with a `process.on('unhandledRejection')` handler that just logs. Same reasoning: a third-party promise chain can fail without your code seeing it.
- This pattern is for a SERVER that intentionally proxies to user-controlled upstreams. Do NOT apply it to a regular app where uncaughtException is a real bug.
- See also: [[async-trust-set-rebuild]] for the rebuild race that was the original reason we had a process-level handler.

Related: [[timer-unref-rule]] for unrefing periodic timers; [[listener-cleanup-rule]] for emitter listener cleanup.
