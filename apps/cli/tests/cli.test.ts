import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { run } from "../src/main.js";
import { ExitCode } from "../src/exit-codes.js";
import { createRuntime } from "../src/runtime.js";

test("init, status, and context expose machine-readable JSON without mixing logs", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    const initCode = await run(["init", "project-1", "Demo"], cwd);
    assert.equal(initCode, ExitCode.ok);
    const runtime = createRuntime(cwd);
    await runtime.app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Test CLI" }, runtime.actor());
    assert.equal(await run(["status", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["context", "task-1", "--format", "json"], cwd), ExitCode.ok);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("status and invalid input return explicit exit codes", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-empty-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["status"], cwd), ExitCode.uninitialized);
    assert.equal(await run(["context"], cwd), ExitCode.invalidInput);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("CLI writes the complete task lifecycle and supports JSON output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-lifecycle-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Lifecycle"], cwd), ExitCode.ok);

    assert.equal(await run(["task", "create", "task-1", "Lifecycle task", "--goal", "Exercise every write command", "--yes", "--json"], cwd), ExitCode.ok);

    assert.equal(await run(["checkpoint", "--task", "task-1", "--summary", "must not write"], cwd), ExitCode.invalidInput);
    assert.equal((await createRuntime(cwd).app.status()).tasks[0]?.status, "planned");

    assert.equal(await run([
      "checkpoint", "--task", "task-1", "--summary", "Created the first checkpoint", "--current-focus", "CLI lifecycle", "--next-action", "Create handoff", "--file", "apps/cli/src/main.ts", "--yes", "--json"
    ], cwd), ExitCode.ok);

    const handoffInput = join(cwd, "handoff.json");
    await writeFile(handoffInput, JSON.stringify({
      completedWork: ["Implemented checkpoint command"],
      incompleteWork: ["Accept the handoff"],
      nextStep: "Run the integration suite",
      relevantFiles: ["apps/cli/src/main.ts"],
      testSummary: "CLI tests pass",
      targetAgent: "claude-code"
    }), "utf8");
    assert.equal(await run(["handoff", "create", "--task", "task-1", "--input", handoffInput, "--yes", "--json"], cwd), ExitCode.ok);
    const handoffState = (await createRuntime(cwd).app.status()).tasks[0]?.handoff;
    assert.ok(handoffState?.id);

    assert.equal(await run(["handoff", "accept", "task-1", handoffState?.id ?? "", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal((await createRuntime(cwd).app.status()).tasks[0]?.status, "in_progress");

    assert.equal(await run(["task", "use", "task-1", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["context", "--json"], cwd), ExitCode.ok);

    assert.equal(await run(["task", "list", "--json"], cwd), ExitCode.ok);

    assert.equal(await run(["rebuild", "--json"], cwd), ExitCode.ok);

    assert.equal(await run(["sync", "--json"], cwd), ExitCode.ok);

    const stateRoot = join(cwd, ".state", "tasks", "task-1");
    assert.match(await readFile(join(stateRoot, "task_plan.md"), "utf8"), /下一步：Create handoff/);
    assert.match(await readFile(join(stateRoot, "handoff.md"), "utf8"), /Implemented checkpoint command/);
    assert.match(await readFile(join(stateRoot, "handoff.md"), "utf8"), /Run the integration suite/);
    assert.match((await createRuntime(cwd).app.status()).tasks[0]?.ownership?.agentId ?? "", /human/);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});
