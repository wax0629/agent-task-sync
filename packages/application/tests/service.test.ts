import assert from "node:assert/strict";
import test from "node:test";
import {
  ApplicationService,
  ConflictNotFoundError,
  ConfirmationRequiredError,
  InvalidConflictResolutionError
} from "../src/index.js";
import type {
  EventStore,
  InitProjectInput,
  MarkdownRenderer,
  ProjectInfo,
  ProjectOverview,
  ProjectRegistry,
  ProjectionStore,
  RenderedDocuments,
  SyncInspection,
  SyncPort
} from "../src/index.js";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";

class MemoryEvents implements EventStore {
  readonly values: TaskEvent[] = [];

  async append(event: TaskEvent): Promise<void> {
    this.values.push(event);
  }

  async readTaskEvents(taskId: string): Promise<TaskEvent[]> {
    return this.values.filter((event) => event.taskId === taskId);
  }

  async readProjectEvents(projectId?: string): Promise<TaskEvent[]> {
    return this.values.filter((event) => !projectId || event.projectId === projectId);
  }
}

class MemoryProjections implements ProjectionStore {
  readonly states: TaskState[] = [];
  readonly documents = new Map<string, RenderedDocuments>();
  projectMarkdown?: string;

  async writeTaskState(state: TaskState): Promise<void> {
    this.states.push(state);
  }

  async writeMarkdown(taskId: string, documents: RenderedDocuments): Promise<void> {
    this.documents.set(taskId, documents);
  }

  async writeProjectMarkdown(markdown: string): Promise<void> {
    this.projectMarkdown = markdown;
  }
}

class MemoryRegistry implements ProjectRegistry {
  project?: ProjectInfo;

  async init(input: InitProjectInput): Promise<ProjectInfo> {
    this.project = { ...input };
    return this.project;
  }

  async current(): Promise<ProjectInfo | undefined> {
    return this.project;
  }
}

class FakeRenderer implements MarkdownRenderer {
  render(state: TaskState): RenderedDocuments {
    return { taskPlan: `# ${state.title}\n\nNext: ${state.nextAction ?? "none"}`, progress: "" };
  }

  renderProject(overview: ProjectOverview): string {
    return `# ${overview.projectName}\n\nTasks: ${overview.taskCount}`;
  }
}

class FakeSync implements SyncPort {
  calls: string[] = [];

  constructor(private readonly inspection: SyncInspection = { localEventCount: 0, localAhead: false, remoteAhead: false, conflict: false }) {}

  async inspect() {
    this.calls.push("inspect");
    return { ...this.inspection };
  }

  async pull() {
    this.calls.push("pull");
    return { pulledEventCount: 0, changed: false };
  }

  async push() {
    this.calls.push("push");
    return { pushedEventCount: 1, changed: true };
  }
}

function service(inspection?: SyncInspection) {
  const events = new MemoryEvents();
  const projections = new MemoryProjections();
  const registry = new MemoryRegistry();
  const sync = new FakeSync(inspection);
  const app = new ApplicationService({
    events,
    projections,
    registry,
    sync,
    renderer: new FakeRenderer(),
    now: () => "2026-09-03T03:00:00.000Z",
    eventId: (() => {
      let number = 0;
      return () => `event-${++number}`;
    })()
  });
  return { app, events, projections, registry, sync };
}

const actor = { agentId: "codex", deviceId: "mac", sessionId: "session-1", confirmed: true };

test("init, createTask, status, and context use application ports", async () => {
  const { app, events, projections, sync } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  const state = await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Prove the call chain" }, actor);
  assert.equal(state.status, "planned");
  assert.equal(events.values[0]?.type, "task_created");
  assert.equal(projections.documents.has("task-1"), true);
  assert.match(projections.projectMarkdown ?? "", /Tasks: 1/);
  const status = await app.status();
  assert.equal(status.tasks[0]?.id, "task-1");
  assert.equal(status.overview?.taskCount, 1);
  assert.equal(status.overview?.statusCounts.planned, 1);
  const context = await app.getContext("task-1");
  assert.match(context.markdown, /Demo task/);
  assert.deepEqual(sync.calls, ["inspect", "inspect", "inspect"]);
});

test("writes require explicit confirmation and checkpoint uses current event heads", async () => {
  const { app, events } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await assert.rejects(
    app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, { ...actor, confirmed: false }),
    ConfirmationRequiredError
  );
  await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, actor);
  await app.recordCheckpoint({ taskId: "task-1", currentFocus: "Testing", nextAction: "Ship", confirmed: true }, actor);
  assert.deepEqual(events.values[1]?.parentEventIds, ["event-1"]);
});

test("task lifecycle updates append events and rebuild every projection", async () => {
  const { app, events, projections } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ taskId: "task-1", projectId: "project-1", title: "Original", goal: "Keep context", background: "Initial context", confirmed: true }, actor);
  await assert.rejects(
    app.updateTask({ taskId: "task-1", title: "Should not write", confirmed: false }, actor),
    ConfirmationRequiredError
  );

  const updated = await app.updateTask({
    taskId: "task-1",
    title: "Updated task",
    background: null,
    currentFocus: "Lifecycle API",
    nextAction: null,
    recentCompleted: ["Defined the lifecycle contract"],
    status: "in_progress",
    confirmed: true
  }, actor);
  assert.equal(updated.title, "Updated task");
  assert.equal(updated.background, undefined);
  assert.equal(updated.currentFocus, "Lifecycle API");
  assert.equal(updated.nextAction, undefined);
  assert.equal(updated.status, "in_progress");
  assert.deepEqual(updated.recentCompleted, ["Defined the lifecycle contract"]);
  assert.equal(events.values[1]?.type, "task_updated");

  const blocked = await app.blockTask({ taskId: "task-1", reason: "Waiting for a product decision", confirmed: true }, actor);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.knownErrors[0]?.error, "Waiting for a product decision");
  assert.equal(events.values[2]?.type, "task_blocked");

  const completed = await app.completeTask({ taskId: "task-1", summary: "Decision received and implementation complete", confirmed: true }, actor);
  assert.equal(completed.status, "completed");
  assert.equal(completed.recentCompleted.includes("Decision received and implementation complete"), true);
  assert.equal(events.values[3]?.type, "task_completed");
  assert.match(projections.documents.get("task-1")?.taskPlan ?? "", /Updated task/);
});

test("context records append decision, question, error, and verification events", async () => {
  const { app, events, projections } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ taskId: "task-1", projectId: "project-1", title: "Context task", goal: "Preserve high-value context", confirmed: true }, actor);
  await assert.rejects(
    app.recordDecision({ taskId: "task-1", decision: "Must not write", confirmed: false }, actor),
    ConfirmationRequiredError
  );

  await app.recordDecision({ taskId: "task-1", decision: "Use JSONL as the source of truth", reason: "It merges across devices", confirmed: true }, actor);
  await app.recordQuestion({ taskId: "task-1", question: "Should the first release include a web UI?", confirmed: true }, actor);
  await app.recordQuestion({ taskId: "task-1", question: "Is the state branch remote-backed?", answer: "Yes, when the repository has a remote.", resolved: true, confirmed: true }, actor);
  await app.recordError({ taskId: "task-1", error: "The first sync attempt was rejected", attempts: "Pulled and retried without force push", confirmed: true }, actor);
  const state = await app.recordVerification({ taskId: "task-1", command: "npm test", result: "All tests passed", status: "passed", confirmed: true }, actor);

  assert.equal(events.values.map((event) => event.type).slice(-5).join(","), "decision_recorded,question_recorded,question_recorded,error_recorded,verification_recorded");
  assert.equal(state.decisions[0]?.decision, "Use JSONL as the source of truth");
  assert.equal(state.decisions[0]?.reason, "It merges across devices");
  assert.equal(state.openQuestions[0]?.resolved, false);
  assert.equal(state.openQuestions[1]?.resolved, true);
  assert.equal(state.openQuestions[1]?.answer, "Yes, when the repository has a remote.");
  assert.equal(state.knownErrors[0]?.attempts, "Pulled and retried without force push");
  assert.equal(state.verification[0]?.status, "passed");
  const documents = projections.documents.get("task-1");
  assert.equal(documents?.taskPlan, "# Context task\n\nNext: none");
});

test("conflict resolution validates candidates, appends one event, and is idempotent", async () => {
  const { app, events } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ taskId: "task-1", projectId: "project-1", title: "Conflict task", goal: "Review competing next actions", confirmed: true }, actor);
  await app.recordCheckpoint({ taskId: "task-1", nextAction: "Mac branch", confirmed: true }, actor);
  const created = events.values.find((event) => event.type === "task_created");
  assert.ok(created);
  events.values.push({
    eventId: "event-windows",
    schemaVersion: 1,
    projectId: "project-1",
    taskId: "task-1",
    type: "checkpoint_recorded",
    payload: { nextAction: "Windows branch" },
    parentEventIds: [created.eventId],
    writer: { agentId: "claude-code", deviceId: "windows", sessionId: "windows-session" },
    createdAt: "2026-09-03T03:01:00.000Z"
  });

  const conflict = (await app.status()).tasks[0]?.conflicts[0];
  assert.ok(conflict);
  const before = events.values.length;
  await assert.rejects(
    app.resolveConflict({ taskId: "task-1", conflictId: conflict.id, choice: "keep_last", resolvedEventIds: conflict.eventIds, confirmed: false }, actor),
    ConfirmationRequiredError
  );
  await assert.rejects(
    app.resolveConflict({ taskId: "task-1", conflictId: conflict.id, choice: "keep_last", resolvedEventIds: [conflict.eventIds[0] ?? ""], confirmed: true }, actor),
    InvalidConflictResolutionError
  );
  assert.equal(events.values.length, before);
  await assert.rejects(
    app.resolveConflict({ taskId: "task-1", conflictId: "missing", choice: "keep_last", resolvedEventIds: conflict.eventIds, confirmed: true }, actor),
    ConflictNotFoundError
  );

  const resolved = await app.resolveConflict({
    taskId: "task-1",
    conflictId: conflict.id,
    choice: "keep_last",
    resolvedEventIds: conflict.eventIds,
    summary: "Windows branch is the agreed next action",
    confirmed: true
  }, actor);
  assert.equal(resolved.nextAction, "Windows branch");
  assert.equal(resolved.conflicts[0]?.resolved, true);
  assert.equal(events.values.filter((event) => event.type === "conflict_resolved").length, 1);

  const repeated = await app.resolveConflict({
    taskId: "task-1",
    conflictId: conflict.id,
    choice: "keep_first",
    resolvedEventIds: [...conflict.eventIds].reverse(),
    confirmed: true
  }, actor);
  assert.equal(repeated.nextAction, "Windows branch");
  assert.equal(events.values.filter((event) => event.type === "conflict_resolved").length, 1);
});

test("sync always goes through SyncPort and rebuilds before push", async () => {
  const { app, sync } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, actor);
  const result = await app.sync();
  assert.equal(result.push.changed, true);
  assert.deepEqual(sync.calls.slice(-3), ["inspect", "pull", "push"]);
});

test("handoff validates the current id and makes repeated acceptance idempotent", async () => {
  const { app, events } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, actor);
  await assert.rejects(
    app.acceptHandoff({ taskId: "task-1", handoffId: "missing", confirmed: true }, actor),
    /does not exist/
  );
  const created = await app.createHandoff({ taskId: "task-1", handoffId: "handoff-1", completedWork: ["Done"], confirmed: true }, actor);
  const accepted = await app.acceptHandoff({ taskId: "task-1", handoffId: "handoff-1", confirmed: true }, actor);
  const repeated = await app.acceptHandoff({ taskId: "task-1", handoffId: "handoff-1", confirmed: true }, { ...actor, agentId: "claude-code" });
  assert.equal(created.handoff?.id, "handoff-1");
  assert.equal(accepted.handoff?.acceptedAt, repeated.handoff?.acceptedAt);
  assert.equal(events.values.filter((event) => event.type === "handoff_accepted").length, 1);
});

test("status and context project sync inspection into task summaries and warnings", async () => {
  const { app } = service({ localEventCount: 5, remoteEventCount: 3, localAhead: true, remoteAhead: true, conflict: true });
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, actor);
  const status = await app.status();
  assert.equal(status.tasks[0]?.sync.unsyncedEventCount, 2);
  assert.equal(status.tasks[0]?.sync.remoteAhead, true);
  assert.equal(status.overview?.taskCount, 1);
  assert.equal(status.overview?.statusCounts.planned, 1);
  assert.equal(status.overview?.sync.conflict, true);
  const context = await app.getContext("task-1");
  assert.match(context.warning ?? "", /远程有更新/);
  assert.match(context.warning ?? "", /尚未同步/);
  assert.match(context.warning ?? "", /冲突/);
});
