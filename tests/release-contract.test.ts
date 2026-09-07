import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("release metadata and all workspace versions are aligned", async () => {
  const script = fileURLToPath(new URL("../scripts/check-release.mjs", import.meta.url));
  const child = spawn(process.execPath, [script, "--version", "0.2.0"], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: ["ignore", "pipe", "pipe"] });
  const result = await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /v0\.2\.0/);
});
