import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileEventStore, FileProjectionStore } from "../src/index.js";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";

function makeEvent(eventId: string, sessionId = "session-1"): TaskEvent {
  return {
    eventId,
    schemaVersion: 1,
    projectId: "project-1",
    taskId: "task-1",
    type: "task_created",
    payload: { title: "Demo", goal: "Test file protocol" },
    parentEventIds: [],
    writer: { agentId: "codex", deviceId: "mac", sessionId },
    createdAt: "2026-09-03T01:00:00.000Z"
  };
}

function makeState(): TaskState {
  return {
    id: "task-1",
    projectId: "project-1",
    title: "Demo",
    goal: "Test file protocol",
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
    revision: "r1",
    createdAt: "2026-09-03T01:00:00.000Z",
    updatedAt: "2026-09-03T01:00:00.000Z"
  };
}

test("events are isolated by session, idempotent, and CRLF-compatible", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-store-"));
  const store = new FileEventStore(root);
  await Promise.all([store.append(makeEvent("e1")), store.append(makeEvent("e1")), store.append(makeEvent("e2", "session-2"))]);
  const events = await store.readTaskEvents("task-1");
  assert.deepEqual(events.map((event) => event.eventId), ["e1", "e2"]);
  const file = join(root, "tasks", "task-1", "events", "mac", "codex", "session-1.jsonl");
  await writeFile(file, (await readFile(file, "utf8")).replace(/\n/g, "\r\n"));
  assert.equal((await store.readTaskEvents("task-1")).length, 2);
});

test("projection files are stable and validate task state", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-projection-"));
  const store = new FileProjectionStore(root);
  await store.writeTaskState(makeState());
  await store.writeMarkdown("task-1", { taskPlan: "# Demo\r\n", progress: "# Log\r\n" });
  const first = await readFile(join(root, "tasks", "task-1", "task_plan.md"), "utf8");
  await store.writeMarkdown("task-1", { taskPlan: "# Demo\n", progress: "# Log\n" });
  const second = await readFile(join(root, "tasks", "task-1", "task_plan.md"), "utf8");
  assert.equal(first, "# Demo\n");
  assert.equal(second, first);
  assert.equal((await store.readTaskState("task-1"))?.title, "Demo");
});

test("invalid JSONL reports the exact file and line", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-invalid-"));
  const file = join(root, "tasks", "task-1", "events", "mac", "codex", "session-1.jsonl");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(root, "tasks", "task-1", "events", "mac", "codex"), { recursive: true });
  await writeFile(file, "{bad-json}\n");
  await assert.rejects(new FileEventStore(root).readTaskEvents("task-1"), /session-1\.jsonl:1/);
});
