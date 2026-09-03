import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface HookProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const root = process.cwd();
const hookEntrypoints = [
  ["codex", join(root, "adapters", "codex", "dist", "hook.js")],
  ["claude-code", join(root, "adapters", "claude-code", "dist", "hook.js")],
  ["pi", join(root, "adapters", "pi", "dist", "hook.js")]
] as const;

function runHook(entrypoint: string, hook: string, input: string, cwd: string): Promise<HookProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, hook], {
      cwd: root,
      env: {
        ...process.env,
        // Keep the process test independent from a globally linked task-sync.
        PATH: join(tmpdir(), "agent-task-sync-no-cli")
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function parseResult(entrypoint: string, hook: string, input: string, cwd: string): Promise<Record<string, unknown>> {
  const result = await runHook(entrypoint, hook, input, cwd);
  assert.equal(result.exitCode, 0, `${hook} exited with stderr: ${result.stderr}`);
  assert.equal(result.stderr, "", `${hook} wrote unexpected stderr: ${result.stderr}`);
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, 1, `${hook} must emit exactly one JSON line`);
  const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  assert.equal(parsed.continue, true);
  return parsed;
}

test("compiled Codex, Claude Code, and Pi hooks keep every dispatch non-blocking", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-hook-process-"));

  for (const [adapter, entrypoint] of hookEntrypoints) {
    const sessionStart = await parseResult(entrypoint, "session_start", JSON.stringify({ cwd }), cwd);
    assert.equal(sessionStart.hook, "session_start", `${adapter} session_start dispatch`);
    assert.match(String(sessionStart.warning), /task-sync|not found|ENOENT/i);

    const preCompact = await parseResult(entrypoint, "pre_compact", JSON.stringify({ cwd, taskId: "task-1" }), cwd);
    assert.equal(preCompact.hook, "pre_compact", `${adapter} pre_compact dispatch`);
    assert.match(String(preCompact.warning), /task-sync|not found|ENOENT/i);

    const stopCandidate = await parseResult(
      entrypoint,
      "stop",
      JSON.stringify({ cwd, taskId: "task-1", checkpointInputFile: join(cwd, "checkpoint.json") }),
      cwd
    );
    assert.equal(stopCandidate.hook, "stop", `${adapter} stop dispatch`);
    assert.equal(stopCandidate.requiresConfirmation, true);
    const stopInvocations = stopCandidate.invocations as Array<{ args?: string[] }>;
    assert.equal(stopInvocations.length, 1);
    assert.equal(stopInvocations[0]?.args?.includes("--yes"), false, `${adapter} stop candidate must not write`);

    const handoffCandidate = await parseResult(
      entrypoint,
      "handoff",
      JSON.stringify({ cwd, taskId: "task-1", handoffInputFile: join(cwd, "handoff.json") }),
      cwd
    );
    assert.equal(handoffCandidate.hook, "handoff", `${adapter} handoff dispatch`);
    assert.equal(handoffCandidate.requiresConfirmation, true);
    const handoffInvocations = handoffCandidate.invocations as Array<{ args?: string[] }>;
    assert.equal(handoffInvocations.length, 1);
    assert.equal(handoffInvocations[0]?.args?.includes("--yes"), false, `${adapter} handoff candidate must not write`);

    const malformed = await parseResult(entrypoint, "stop", "{", cwd);
    assert.equal(malformed.hook, "stop");
    assert.equal((malformed.invocations as unknown[]).length, 0);

    const missingCwd = await parseResult(entrypoint, "session_start", JSON.stringify({ taskId: "task-1" }), cwd);
    assert.equal(missingCwd.hook, "session_start");
    assert.equal((missingCwd.invocations as unknown[]).length, 0);

    const unknown = await parseResult(entrypoint, "future_hook", JSON.stringify({ cwd }), cwd);
    assert.equal(unknown.hook, "unknown");
    assert.equal((unknown.invocations as unknown[]).length, 0);
  }
});

