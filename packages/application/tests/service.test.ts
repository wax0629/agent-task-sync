import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationService, ConfirmationRequiredError } from "../src/index.js";
import type {
  EventStore,
  InitProjectInput,
  MarkdownRenderer,
  ProjectInfo,
  ProjectRegistry,
  ProjectionStore,
  RenderedDocuments,
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

  async writeTaskState(state: TaskState): Promise<void> {
    this.states.push(state);
  }

  async writeMarkdown(taskId: string, documents: RenderedDocuments): Promise<void> {
    this.documents.set(taskId, documents);
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
}

class FakeSync implements SyncPort {
  calls: string[] = [];

  async inspect() {
    this.calls.push("inspect");
    return { localEventCount: 0, localAhead: false, remoteAhead: false, conflict: false };
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

function service() {
  const events = new MemoryEvents();
  const projections = new MemoryProjections();
  const registry = new MemoryRegistry();
  const sync = new FakeSync();
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
  const status = await app.status();
  assert.equal(status.tasks[0]?.id, "task-1");
  const context = await app.getContext("task-1");
  assert.match(context.markdown, /Demo task/);
  assert.deepEqual(sync.calls, ["inspect", "inspect"]);
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

test("sync always goes through SyncPort and rebuilds before push", async () => {
  const { app, sync } = service();
  await app.init({ projectId: "project-1", name: "Demo", rootPath: "/repo" });
  await app.createTask({ projectId: "project-1", taskId: "task-1", title: "Demo task", goal: "Goal" }, actor);
  const result = await app.sync();
  assert.equal(result.push.changed, true);
  assert.deepEqual(sync.calls.slice(-3), ["inspect", "pull", "push"]);
});
