// run_tests.js
// Runs the full test suite via the Node built-in runner, inheriting
// its TAP output and final pass/fail summary.  Convenience wrapper
// around `npm test`.

import { spawnSync } from "node:child_process";
import process from "node:process";

const result = spawnSync(
  process.execPath,
  ["--test", "tests/test_*.js"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Failed to launch Node: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
