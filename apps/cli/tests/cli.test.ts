import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { run } from "../src/main.js";
import { ExitCode } from "../src/exit-codes.js";
import { createRuntime } from "../src/runtime.js";

test("init, status, and context expose machine-readable JSON without mixing logs", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-"));
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  const initCode = await run(["init", "project-1", "Demo"], cwd);
  assert.equal(initCode, ExitCode.ok);
  const runtime = createRuntime(cwd);
  await runtime.app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Test CLI" }, runtime.actor());
  assert.equal(await run(["status", "--json"], cwd), ExitCode.ok);
  assert.equal(await run(["context", "task-1", "--format", "json"], cwd), ExitCode.ok);
});

test("status and invalid input return explicit exit codes", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-empty-"));
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  assert.equal(await run(["status"], cwd), ExitCode.uninitialized);
  assert.equal(await run(["context"], cwd), ExitCode.invalidInput);
});
