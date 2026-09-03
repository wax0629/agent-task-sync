import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { run } from "../src/main.js";
import { ExitCode } from "../src/exit-codes.js";
import { createRuntime } from "../src/runtime.js";
import { filterTasks } from "../src/format.js";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";
import { FileEventStore } from "@agent-task-sync/store-files";

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

test("CLI rebuilds a project progress projection and exposes overview counts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-project-overview-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Overview"], cwd), ExitCode.ok);
    assert.equal(await run(["rebuild", "--json"], cwd), ExitCode.ok);
    assert.match(await readFile(join(cwd, ".state", "progress.md"), "utf8"), /任务总数：0/);

    assert.equal(await run(["task", "create", "task-1", "Active task", "--goal", "Continue work", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["checkpoint", "--task", "task-1", "--current-focus", "Implement overview", "--next-action", "Run tests", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-2", "Handoff task", "--goal", "Prepare handoff", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["handoff", "create", "--task", "task-2", "--next-step", "Continue on Windows", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-3", "Blocked task", "--goal", "Unblock dependency", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "block", "task-3", "--reason", "Waiting for review", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-4", "Completed task", "--goal", "Ship result", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "complete", "task-4", "--summary", "Shipped", "--yes", "--json"], cwd), ExitCode.ok);

    const status = await createRuntime(cwd).app.status();
    assert.equal(status.overview?.taskCount, 4);
    assert.equal(status.overview?.statusCounts.in_progress, 1);
    assert.equal(status.overview?.statusCounts.handoff_ready, 1);
    assert.equal(status.overview?.statusCounts.blocked, 1);
    assert.equal(status.overview?.statusCounts.completed, 1);
    assert.equal(status.overview?.pendingHandoffCount, 1);
    assert.ok((status.overview?.recentActivity.length ?? 0) <= 10);
    const projectMarkdown = await readFile(join(cwd, ".state", "progress.md"), "utf8");
    assert.match(projectMarkdown, /项目进度：Overview/);
    assert.match(projectMarkdown, /待处理 handoff：1/);
    assert.match(projectMarkdown, /任务阻塞：Waiting for review/);

    await unlink(join(cwd, ".state", "progress.md"));
    assert.equal(await run(["rebuild", "--json"], cwd), ExitCode.ok);
    assert.match(await readFile(join(cwd, ".state", "progress.md"), "utf8"), /任务总数：4/);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("task list filters by status and attention without changing the default contract", async () => {
  const makeTask = (overrides: Partial<TaskState>): TaskState => ({
    id: "task-default",
    projectId: "project-1",
    title: "Task",
    goal: "Test filtering",
    acceptanceCriteria: [],
    status: "planned",
    recentCompleted: [],
    decisions: [],
    openQuestions: [],
    knownErrors: [],
    references: [],
    verification: [],
    sync: { unsyncedEventCount: 0 },
    conflicts: [],
    revision: "revision",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides
  });
  const tasks = [
    makeTask({ id: "active", status: "in_progress" }),
    makeTask({ id: "handoff", status: "handoff_ready", handoff: {
      id: "handoff-1",
      completedWork: [],
      incompleteWork: [],
      keyDecisions: [],
      knownErrors: [],
      relevantFiles: [],
      createdAt: "2026-09-03T00:00:00.000Z"
    } }),
    makeTask({ id: "blocked", status: "blocked" }),
    makeTask({ id: "conflict", status: "needs_review", conflicts: [{
      id: "conflict-1",
      taskId: "conflict",
      field: "nextAction",
      parentEventIds: [],
      eventIds: ["event-1", "event-2"],
      options: [],
      reason: "concurrent",
      detectedAt: "2026-09-03T00:00:00.000Z",
      resolved: false
    }] }),
    makeTask({ id: "unsynced", sync: { unsyncedEventCount: 2, localAhead: true } })
  ];
  assert.deepEqual(filterTasks(tasks, { status: "in_progress" }).map((task) => task.id), ["active"]);
  assert.deepEqual(filterTasks(tasks, { attention: "active" }).map((task) => task.id), ["active"]);
  assert.deepEqual(filterTasks(tasks, { attention: "handoff" }).map((task) => task.id), ["handoff"]);
  assert.deepEqual(filterTasks(tasks, { attention: "blocked" }).map((task) => task.id), ["blocked"]);
  assert.deepEqual(filterTasks(tasks, { attention: "conflict" }).map((task) => task.id), ["conflict"]);
  assert.deepEqual(filterTasks(tasks, { attention: "unsynced" }).map((task) => task.id), ["unsynced"]);
  assert.deepEqual(filterTasks(tasks, { status: "needs_review", attention: "conflict" }).map((task) => task.id), ["conflict"]);

  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-task-filter-") );
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Filters"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "list", "--status", "unknown"], cwd), ExitCode.invalidInput);
    assert.equal(await run(["task", "list", "--attention", "unknown"], cwd), ExitCode.invalidInput);
    assert.equal(await run(["task", "list", "--status", "in_progress", "--attention", "active", "--json"], cwd), ExitCode.ok);
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

test("handoff check is a read-only CLI command with stable JSON and text output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-handoff-check-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Handoff checks"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-1", "Check task", "--goal", "Check recovery", "--yes", "--json"], cwd), ExitCode.ok);
    const events = new FileEventStore(join(cwd, ".state"));
    const before = await events.readTaskEvents("task-1");
    assert.equal(await run(["handoff", "check", "task-1", "--json"], cwd), ExitCode.ok);
    const after = await events.readTaskEvents("task-1");
    assert.deepEqual(after.map((event) => event.eventId), before.map((event) => event.eventId));
    assert.equal(await run(["handoff", "check", "task-1"], cwd), ExitCode.ok);
    assert.equal(await run(["handoff", "check", "missing-task", "--json"], cwd), ExitCode.unexpected);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("CLI updates, blocks, and completes a task through append-only events", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-task-operations-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Operations"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-1", "Original task", "--goal", "Keep context", "--background", "Initial", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "update", "task-1", "--title", "Updated task", "--clear-background", "--current-focus", "Lifecycle API", "--next-action", "Ship it", "--status", "in_progress", "--yes", "--json"], cwd), ExitCode.ok);
    let state = (await createRuntime(cwd).app.status()).tasks[0];
    assert.equal(state?.title, "Updated task");
    assert.equal(state?.background, undefined);
    assert.equal(state?.currentFocus, "Lifecycle API");
    assert.equal(state?.nextAction, "Ship it");
    assert.equal(state?.status, "in_progress");

    assert.equal(await run(["task", "block", "task-1", "--reason", "Waiting for review"], cwd), ExitCode.invalidInput);
    assert.equal((await createRuntime(cwd).app.status()).tasks[0]?.status, "in_progress");
    assert.equal(await run(["task", "block", "task-1", "--reason", "Waiting for review", "--yes", "--json"], cwd), ExitCode.ok);
    state = (await createRuntime(cwd).app.status()).tasks[0];
    assert.equal(state?.status, "blocked");
    assert.equal(state?.knownErrors.at(-1)?.error, "Waiting for review");

    assert.equal(await run(["task", "complete", "task-1", "--summary", "Review complete", "--yes", "--json"], cwd), ExitCode.ok);
    state = (await createRuntime(cwd).app.status()).tasks[0];
    assert.equal(state?.status, "completed");
    assert.equal(state?.recentCompleted.at(-1), "Review complete");
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("CLI records decision, question, error, and verification context", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-context-records-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Context records"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-1", "Context task", "--goal", "Preserve context", "--yes", "--json"], cwd), ExitCode.ok);

    assert.equal(await run(["task", "decision", "task-1", "--decision", "Use JSONL", "--reason", "Mergeable facts", "--json"], cwd), ExitCode.invalidInput);
    assert.equal(await run(["task", "decision", "task-1", "--decision", "Use JSONL", "--reason", "Mergeable facts", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "question", "task-1", "--question", "Need product confirmation?", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "question", "task-1", "--question", "Remote configured?", "--answer", "Yes", "--resolved", "true", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "error", "task-1", "--error", "Sync was rejected", "--attempts", "Pulled then retried", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "verify", "task-1", "--command", "npm test", "--result", "passed", "--status", "passed", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "verify", "task-1", "--command", "npm test", "--status", "unknown", "--yes"], cwd), ExitCode.invalidInput);

    const state = (await createRuntime(cwd).app.status()).tasks[0];
    assert.equal(state?.decisions[0]?.decision, "Use JSONL");
    assert.equal(state?.openQuestions[0]?.resolved, false);
    assert.equal(state?.openQuestions[1]?.answer, "Yes");
    assert.equal(state?.openQuestions[1]?.resolved, true);
    assert.equal(state?.knownErrors[0]?.error, "Sync was rejected");
    assert.equal(state?.verification[0]?.command, "npm test");
    assert.equal(state?.verification[0]?.status, "passed");
    const taskRoot = join(cwd, ".state", "tasks", "task-1");
    assert.match(await readFile(join(taskRoot, "task_plan.md"), "utf8"), /Need product confirmation\?|Sync was rejected|npm test/);
    assert.match(await readFile(join(taskRoot, "progress.md"), "utf8"), /decision_recorded|question_recorded|error_recorded|verification_recorded/);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});

test("CLI lists semantic conflicts and resolves them without rewriting competing events", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-conflicts-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  try {
    assert.equal(await run(["init", "project-1", "Conflicts"], cwd), ExitCode.ok);
    assert.equal(await run(["task", "create", "task-1", "Conflict task", "--goal", "Review concurrent work", "--yes", "--json"], cwd), ExitCode.ok);
    const events = new FileEventStore(join(cwd, ".state"));
    const created = (await events.readTaskEvents("task-1")).find((event) => event.type === "task_created");
    assert.ok(created);
    const competing = (eventId: string, nextAction: string, deviceId: string, createdAt: string): TaskEvent => ({
      eventId,
      schemaVersion: 1,
      projectId: "project-1",
      taskId: "task-1",
      type: "checkpoint_recorded",
      payload: { nextAction },
      parentEventIds: [created.eventId],
      writer: { agentId: deviceId === "mac" ? "codex" : "claude-code", deviceId, sessionId: `${deviceId}-session` },
      createdAt
    });
    await events.append(competing("conflict-mac", "Mac branch", "mac", "2026-09-03T03:00:00.000Z"));
    await events.append(competing("conflict-windows", "Windows branch", "windows", "2026-09-03T03:01:00.000Z"));

    assert.equal(await run(["conflicts", "--json"], cwd), ExitCode.conflict);
    const statusBefore = (await createRuntime(cwd).app.status()).tasks[0];
    const conflict = statusBefore?.conflicts.find((item) => !item.resolved);
    assert.ok(conflict);
    assert.equal(await run(["conflict", "resolve", "task-1", conflict.id, "--choice", "discard", "--resolved-event-id", "conflict-mac", "--resolved-event-id", "conflict-windows", "--yes"], cwd), ExitCode.invalidInput);
    assert.equal(await run(["conflict", "resolve", "task-1", conflict.id, "--choice", "keep_last", "--resolved-event-id", "conflict-mac", "--yes"], cwd), ExitCode.invalidInput);
    const unresolved = (await createRuntime(cwd).app.status()).tasks[0];
    assert.equal(unresolved?.status, "needs_review");
    assert.equal(unresolved?.conflicts[0]?.resolved, false);
    assert.equal((await events.readTaskEvents("task-1")).filter((event) => event.type === "conflict_resolved").length, 0);

    assert.equal(await run(["conflict", "resolve", "task-1", conflict.id, "--choice", "keep_last", "--resolved-event-id", "conflict-mac", "--resolved-event-id", "conflict-windows", "--summary", "Keep the latest branch", "--yes", "--json"], cwd), ExitCode.ok);
    assert.equal((await events.readTaskEvents("task-1")).filter((event) => event.type === "conflict_resolved").length, 1);
    assert.equal(await run(["conflicts", "task-1"], cwd), ExitCode.ok);
    assert.equal(await run(["conflict", "resolve", "task-1", conflict.id, "--choice", "keep_first", "--resolved-event-id", "conflict-mac", "--resolved-event-id", "conflict-windows", "--yes"], cwd), ExitCode.ok);
    assert.equal((await events.readTaskEvents("task-1")).filter((event) => event.type === "conflict_resolved").length, 1);
    assert.match(await readFile(join(cwd, ".state", "tasks", "task-1", "progress.md"), "utf8"), /conflict_resolved/);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
  }
});
