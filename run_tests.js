// run_tests.js
// Runs the full test suite via the Node built-in runner, capturing
// its TAP output and reformatting suite summary lines with extra
// indentation so they align visually with their test output.

import { spawn } from "node:child_process";
import process from "node:process";

const child = spawn(
  process.execPath,
  ["--test", "tests/test_*.js"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  const out = text.replace(
    /^(ok \d+ - .+ \(\d+ms\))$/gm,
    "  $1",
  );
  process.stdout.write(out);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`Failed to launch Node: ${err.message}`);
  process.exit(1);
});
