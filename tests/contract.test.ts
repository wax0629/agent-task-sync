import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ApplicationService,
  type Actor,
  type EventStore,
  type MarkdownRenderer,
  type ProjectRegistry,
  type ProjectionStore,
  type RenderedDocuments,
  type SyncPort
} from "@agent-task-sync/application";
import { createClaudeCodeAdapter } from "../adapters/claude-code/src/index.js";
import { createCodexAdapter } from "../adapters/codex/src/index.js";
import type { CliExecutor, CliInvocation, CliResult } from "@agent-task-sync/adapter-contract";
import { reduceTaskEvents, type TaskEvent, type TaskState } from "@agent-task-sync/domain";
import { FileProjectRegistry } from "@agent-task-sync/project-registry";
import { MarkdownTaskRenderer } from "@agent-task-sync/renderer-markdown";
import { FileEventStore, FileProjectionStore } from "@agent-task-sync/store-files";
import { MockSyncPort } from "@agent-task-sync/sync-git";

const fixtureRoot = join(process.cwd(), "tests", "fixtures");

async function copyFixture(name: string, root: string, taskId: string, device = "mac", agent = "codex", session = "fixture-session"): Promise<string> {
  const source = join(fixtureRoot, name);
  const destination = join(root, "tasks", taskId, "events", device, agent, `${session}.jsonl`);
  await mkdir(join(root, "tasks", taskId, "events", device, agent), { recursive: true });
  await cp(source, destination);
  return destination;
}

function fileRuntime(root: string) {
  const events = new FileEventStore(root);
  const projections = new FileProjectionStore(root);
  const registry = new FileProjectRegistry(root);
  const renderer = new MarkdownTaskRenderer();
  const sync = new MockSyncPort();
  const app = new ApplicationService({ events, projections, registry, renderer, sync });
  return { app, events, projections, registry, renderer, sync };
}

const actor: Actor = { agentId: "codex", deviceId: "mac", sessionId: "contract-session", confirmed: true };

test("fixture rebuild preserves CRLF compatibility and renders complete continuation context", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-contract-context-"));
  const eventPath = await copyFixture("continuation.jsonl", root, "fixture-task");
  await writeFile(eventPath, (await readFile(eventPath, "utf8")).replace(/\n/g, "\r\n"));
  const runtime = fileRuntime(root);
  await runtime.registry.init({ projectId: "fixture-project", name: "Fixture project", rootPath: root });
  const context = await runtime.app.getContext("fixture-task");
  assert.equal(context.source, "events");
  assert.match(context.markdown, /Fixture continuation task/);
  assert.match(context.markdown, /当前关注点：Validate integration contracts/);
  assert.match(context.markdown, /下一步：Run the cross-module contract suite/);
  assert.match(context.markdown, /目标与验收/);
  assert.doesNotMatch(context.markdown, /阶段：/);
  const rebuild = await runtime.app.rebuild("fixture-task");
  const projected = await runtime.projections.readTaskState("fixture-task");
  assert.equal(projected?.id, rebuild.states[0]?.id);
  assert.equal(projected?.status, rebuild.states[0]?.status);
  assert.equal(projected?.revision, rebuild.states[0]?.revision);
  assert.deepEqual(projected?.recentCompleted, rebuild.states[0]?.recentCompleted);
  assert.deepEqual(projected?.verification, rebuild.states[0]?.verification);
  assert.equal((await readFile(join(root, "tasks", "fixture-task", "task_plan.md"), "utf8")).includes("\r"), false);
});

test("application writes checkpoint and handoff events only after confirmation and rebuilds projections", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-contract-write-"));
  const runtime = fileRuntime(root);
  await runtime.registry.init({ projectId: "project-1", name: "Write fixture", rootPath: root });
  const created = await runtime.app.createTask({ projectId: "project-1", taskId: "task-1", title: "Write path", goal: "Exercise full continuation lifecycle" }, actor);
  assert.equal(created.status, "planned");
  await assert.rejects(
    runtime.app.recordCheckpoint({ taskId: "task-1", summary: "must not persist", confirmed: false }, { ...actor, confirmed: false }),
    /confirmation/
  );
  assert.equal((await runtime.events.readTaskEvents("task-1")).length, 1);
  const checkpoint = await runtime.app.recordCheckpoint({
    taskId: "task-1",
    summary: "Checkpoint persisted",
    currentFocus: "Integration contracts",
    recentCompleted: ["Created the task"],
    nextAction: "Accept handoff",
    confirmed: true
  }, actor);
  assert.equal(checkpoint.status, "in_progress");
  const handoff = await runtime.app.createHandoff({
    taskId: "task-1",
    completedWork: ["Checkpoint persisted"],
    incompleteWork: ["Accept handoff"],
    nextStep: "Continue on Windows",
    relevantFiles: ["tests/contract.test.ts"],
    testSummary: "Contract fixture is ready",
    confirmed: true
  }, actor);
  assert.equal(handoff.status, "handoff_ready");
  const accepted = await runtime.app.acceptHandoff({ taskId: "task-1", handoffId: handoff.handoff?.id ?? "", confirmed: true }, { ...actor, agentId: "claude-code", deviceId: "windows" });
  assert.equal(accepted.status, "in_progress");
  const events = await runtime.events.readTaskEvents("task-1");
  assert.deepEqual(
    events
      .sort((left, right) => `${left.createdAt}:${left.eventId}`.localeCompare(`${right.createdAt}:${right.eventId}`))
      .map((event) => event.type),
    ["task_created", "checkpoint_recorded", "handoff_created", "handoff_accepted"]
  );
  const files = await Promise.all([
    readFile(join(root, "tasks", "task-1", "task.yaml"), "utf8"),
    readFile(join(root, "tasks", "task-1", "task_plan.md"), "utf8"),
    readFile(join(root, "tasks", "task-1", "progress.md"), "utf8"),
    readFile(join(root, "tasks", "task-1", "handoff.md"), "utf8")
  ]);
  assert.match(files[0], /status: in_progress/);
  assert.match(files[1], /下一步：Accept handoff/);
  assert.match(files[2], /checkpoint_recorded/);
  assert.match(files[3], /Continue on Windows/);
  assert.match(files[3], /Contract fixture is ready/);
});

test("conflict fixture is retained across rebuild and points to both competing events", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-contract-conflict-"));
  await copyFixture("conflict.jsonl", root, "conflict-task", "mac", "codex", "mac-session");
  const secondPath = await copyFixture("conflict.jsonl", root, "conflict-task", "windows", "claude-code", "windows-session");
  const secondContent = await readFile(secondPath, "utf8");
  await writeFile(secondPath, secondContent.replace(/conflict-blocked/g, "conflict-blocked-duplicate").replace(/\{"eventId":"conflict-blocked-duplicate"[^\n]+\n/, ""));
  const runtime = fileRuntime(root);
  const events = await runtime.events.readTaskEvents("conflict-task");
  const reduced = reduceTaskEvents(events);
  assert.equal(reduced.state.status, "needs_review");
  assert.equal(reduced.state.conflicts.length, 1);
  assert.deepEqual(reduced.state.conflicts[0]?.eventIds, ["conflict-blocked", "conflict-completed"]);
  await runtime.projections.writeTaskState(reduced.state);
  await runtime.projections.writeMarkdown("conflict-task", runtime.renderer.render(reduced.state, events));
  const projected = await runtime.projections.readTaskState("conflict-task");
  assert.equal(projected?.conflicts[0]?.resolved, false);
  assert.match(await readFile(join(root, "tasks", "conflict-task", "task_plan.md"), "utf8"), /待审阅/);
});

class SharedFixtureExecutor implements CliExecutor {
  readonly calls: CliInvocation[] = [];
  constructor(private readonly contextJson: string) {}

  async run(invocation: CliInvocation): Promise<CliResult> {
    this.calls.push(invocation);
    return invocation.args[0] === "status"
      ? { exitCode: 0, stdout: this.contextJson, stderr: "" }
      : { exitCode: 0, stdout: this.contextJson, stderr: "" };
  }
}

test("Codex and Claude adapters consume the same fixture context without touching the domain layer", async () => {
  const context = JSON.stringify({ taskId: "fixture-task", status: "in_progress", nextAction: "Run the cross-module contract suite" });
  const codexExecutor = new SharedFixtureExecutor(context);
  const claudeExecutor = new SharedFixtureExecutor(context);
  const codexResult = await createCodexAdapter(codexExecutor).sessionStart({ cwd: "/repo", taskId: "fixture-task" });
  const claudeResult = await createClaudeCodeAdapter(claudeExecutor).sessionStart({ cwd: "/repo", taskId: "fixture-task" });
  assert.equal(codexResult.output, context);
  assert.equal(claudeResult.output, context);
  assert.deepEqual(codexExecutor.calls.map((call) => call.args), claudeExecutor.calls.map((call) => call.args));
  assert.equal(codexExecutor.calls.every((call) => call.args[0] === "status" || call.args[0] === "context"), true);
});

test("offline mock sync keeps local context readable and exposes an explicit mock boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-contract-offline-"));
  const runtime = fileRuntime(root);
  await runtime.registry.init({ projectId: "project-1", name: "Offline fixture", rootPath: root });
  await runtime.app.createTask({ projectId: "project-1", taskId: "task-1", title: "Offline task", goal: "Keep local events", confirmed: true }, actor);
  const result = await runtime.app.sync();
  assert.equal(result.pull.changed, false);
  assert.equal(result.push.changed, false);
  assert.equal((await runtime.app.getContext("task-1")).task.title, "Offline task");
});
