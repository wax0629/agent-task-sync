import assert from "node:assert/strict";
import test from "node:test";
import { assertValidTaskEvent, reduceTaskEvents, validateTaskEvent, validateTaskState } from "../src/index.js";
import type { TaskEvent } from "../src/index.js";

const writer = { agentId: "codex", deviceId: "mac", sessionId: "session-1" };

function event<T extends TaskEvent["payload"]>(
  eventId: string,
  type: TaskEvent["type"],
  payload: T,
  createdAt: string,
  parentEventIds: string[] = []
): TaskEvent<T> {
  return {
    eventId,
    schemaVersion: 1,
    projectId: "project-1",
    taskId: "task-1",
    type,
    payload,
    parentEventIds,
    writer,
    createdAt
  };
}

function created(): TaskEvent {
  return event("e1", "task_created", {
    title: "Build a sync core",
    goal: "Keep task context across devices",
    acceptanceCriteria: [{ id: "c1", text: "rebuild state", completed: false }]
  }, "2026-09-03T01:00:00.000Z");
}

test("schema accepts a valid event and rejects missing protocol fields", () => {
  const valid = created();
  assert.equal(validateTaskEvent(valid).valid, true);
  assert.throws(() => assertValidTaskEvent({ ...valid, writer: undefined }));
  assert.equal(validateTaskEvent({ ...valid, type: "unknown" }).valid, false);
});

test("reducer is deterministic, idempotent, and supports tasks without phases", () => {
  const checkpoint = event("e2", "checkpoint_recorded", {
    currentFocus: "Implement reducer",
    recentCompleted: ["Defined event shape"],
    nextAction: "Write store tests",
    filesChanged: ["packages/domain/src/reducer.ts"],
    commit: "abc123",
    uncommittedChanges: ["packages/domain/tests/reducer.test.ts"],
    verification: [{ id: "v1", command: "npm test", result: "passed", status: "passed", checkedAt: "2026-09-03T02:00:00.000Z" }]
  }, "2026-09-03T02:00:00.000Z", ["e1"]);
  const completed = event("e3", "task_completed", { summary: "Domain reducer is ready" }, "2026-09-03T03:00:00.000Z", ["e2"]);
  const left = reduceTaskEvents([created(), checkpoint, completed]);
  const right = reduceTaskEvents([completed, checkpoint, created(), checkpoint]);
  assert.deepEqual(left.state, right.state);
  assert.deepEqual(right.duplicateEventIds, ["e2"]);
  assert.equal(left.state.status, "completed");
  assert.equal(left.state.phases, undefined);
  assert.deepEqual(left.state.recentCompleted, ["Defined event shape", "Domain reducer is ready"]);
  assert.deepEqual(left.state.uncommittedChanges, ["packages/domain/tests/reducer.test.ts"]);
  assert.equal(left.state.references[0]?.commit, "abc123");
  assert.deepEqual(left.state.verification, [{ id: "v1", command: "npm test", result: "passed", status: "passed", checkedAt: "2026-09-03T02:00:00.000Z" }]);
  assert.equal(validateTaskState(left.state).valid, true);
});

test("same parent status updates produce a conflict instead of silent overwrite", () => {
  const blocked = event("e2", "task_blocked", { reason: "waiting for credentials" }, "2026-09-03T02:00:00.000Z", ["e1"]);
  const completed = event("e3", "task_completed", {}, "2026-09-03T02:01:00.000Z", ["e1"]);
  const result = reduceTaskEvents([completed, created(), blocked]);
  assert.equal(result.state.status, "needs_review");
  assert.equal(result.state.conflicts.length, 1);
  assert.equal(result.state.conflicts[0]?.field, "status");
  assert.deepEqual(result.state.conflicts[0]?.eventIds, ["e2", "e3"]);
});

test("conflict_resolved references both competing events and restores the chosen value", () => {
  const blocked = event("e2", "task_blocked", { reason: "waiting" }, "2026-09-03T02:00:00.000Z", ["e1"]);
  const completed = event("e3", "task_completed", {}, "2026-09-03T02:01:00.000Z", ["e1"]);
  const conflictId = reduceTaskEvents([created(), blocked, completed]).state.conflicts[0]?.id;
  assert.ok(conflictId);
  const resolved = event("e4", "conflict_resolved", {
    conflictId,
    choice: "keep_last",
    resolvedEventIds: ["e2", "e3"],
    summary: "The task was actually completed"
  }, "2026-09-03T02:02:00.000Z", ["e2", "e3"]);
  const state = reduceTaskEvents([resolved, completed, created(), blocked]).state;
  assert.equal(state.status, "completed");
  assert.equal(state.conflicts[0]?.resolved, true);
  assert.deepEqual(state.conflicts[0]?.resolution?.resolvedEventIds, ["e2", "e3"]);
});

test("accepted handoff keeps ownership and acceptedBy as independent values", () => {
  const handoff = event("e2", "handoff_created", {
    handoffId: "handoff-1",
    completedWork: ["Create the handoff"],
    incompleteWork: ["Accept the handoff"],
    nextStep: "Continue on another device"
  }, "2026-09-03T02:00:00.000Z", ["e1"]);
  const accepted = event("e3", "handoff_accepted", { handoffId: "handoff-1" }, "2026-09-03T02:01:00.000Z", ["e2"]);
  const state = reduceTaskEvents([created(), handoff, accepted]).state;

  assert.deepEqual(state.ownership, state.handoff?.acceptedBy);
  assert.notEqual(state.ownership, state.handoff?.acceptedBy);
});
