import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { run } from "../src/main.js";
import { ExitCode } from "../src/exit-codes.js";
import { createRuntime } from "../src/runtime.js";

async function capture(action: () => Promise<number>): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof originalOut;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof originalErr;
  try {
    return { code: await action(), stdout, stderr };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
}

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

test("CLI writes the complete task lifecycle and supports JSON output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-lifecycle-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Lifecycle"], cwd), ExitCode.ok);

    const created = await capture(() => run(["task", "create", "task-1", "Lifecycle task", "--goal", "Exercise every write command", "--yes", "--json"], cwd));
    assert.equal(created.code, ExitCode.ok);
    assert.equal(JSON.parse(created.stdout).status, "planned");

    const rejected = await capture(() => run(["checkpoint", "--task", "task-1", "--summary", "must not write"], cwd));
    assert.equal(rejected.code, ExitCode.invalidInput);
    assert.match(rejected.stderr, /--yes/);
    assert.equal((await createRuntime(cwd).app.status()).tasks[0]?.status, "planned");

    const checkpoint = await capture(() => run([
      "checkpoint", "--task", "task-1", "--summary", "Created the first checkpoint", "--current-focus", "CLI lifecycle", "--next-action", "Create handoff", "--file", "apps/cli/src/main.ts", "--yes", "--json"
    ], cwd));
    assert.equal(checkpoint.code, ExitCode.ok);
    assert.equal(JSON.parse(checkpoint.stdout).status, "in_progress");

    const handoffInput = join(cwd, "handoff.json");
    await writeFile(handoffInput, JSON.stringify({
      completedWork: ["Implemented checkpoint command"],
      incompleteWork: ["Accept the handoff"],
      nextStep: "Run the integration suite",
      relevantFiles: ["apps/cli/src/main.ts"],
      testSummary: "CLI tests pass",
      targetAgent: "claude-code"
    }), "utf8");
    const handoff = await capture(() => run(["handoff", "create", "--task", "task-1", "--input", handoffInput, "--yes", "--json"], cwd));
    assert.equal(handoff.code, ExitCode.ok);
    const handoffState = JSON.parse(handoff.stdout) as { status: string; handoff?: { id?: string } };
    assert.equal(handoffState.status, "handoff_ready");
    assert.ok(handoffState.handoff?.id);

    const accepted = await capture(() => run(["handoff", "accept", "task-1", handoffState.handoff?.id ?? "", "--yes", "--json"], cwd));
    assert.equal(accepted.code, ExitCode.ok);
    assert.equal(JSON.parse(accepted.stdout).status, "in_progress");

    const selected = await capture(() => run(["task", "use", "task-1", "--yes", "--json"], cwd));
    assert.equal(selected.code, ExitCode.ok);
    const context = await capture(() => run(["context", "--json"], cwd));
    assert.equal(context.code, ExitCode.ok);
    assert.equal(JSON.parse(context.stdout).task.id, "task-1");

    const listed = await capture(() => run(["task", "list", "--json"], cwd));
    assert.equal(listed.code, ExitCode.ok);
    assert.equal(JSON.parse(listed.stdout).length, 1);

    const rebuilt = await capture(() => run(["rebuild", "--json"], cwd));
    assert.equal(rebuilt.code, ExitCode.ok);
    assert.deepEqual(JSON.parse(rebuilt.stdout).taskIds, ["task-1"]);

    const synced = await capture(() => run(["sync", "--json"], cwd));
    assert.equal(synced.code, ExitCode.ok);
    assert.equal(JSON.parse(synced.stdout).rebuilt.taskIds[0], "task-1");

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
