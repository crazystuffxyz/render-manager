// _run_all.mjs — run all tests in sequence. Each test is self-contained.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = ["_smoke.mjs", "_ws_e2e.mjs", "_api_e2e.mjs", "_full_e2e.mjs"];

let total = 0, failed = 0;
const t0 = Date.now();

for (const t of tests) {
  total++;
  console.log("\n========================================");
  console.log("▶ " + t);
  console.log("========================================");
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    failed++;
    console.log("✗ " + t + " FAILED");
  } else {
    console.log("✓ " + t + " passed");
  }
}

const ms = Date.now() - t0;
console.log("\n========================================");
console.log(`Tests: ${total - failed}/${total} passed in ${(ms / 1000).toFixed(1)}s`);
console.log("========================================");
process.exit(failed > 0 ? 1 : 0);
