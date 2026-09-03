import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownTaskRenderer } from "../src/index.js";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";

const state: TaskState = {
  id: "task-1",
  projectId: "project-1",
  title: "无阶段任务",
  goal: "验证恢复信息",
  acceptanceCriteria: [{ id: "c1", text: "能重建", completed: false }],
  status: "in_progress",
  currentFocus: "写 renderer",
  recentCompleted: ["定义状态"],
  nextAction: "运行测试",
  decisions: [],
  openQuestions: [],
  knownErrors: [],
  references: [],
  verification: [],
  sync: { unsyncedEventCount: 1 },
  conflicts: [],
  revision: "r1",
  createdAt: "2026-09-03T01:00:00.000Z",
  updatedAt: "2026-09-03T02:00:00.000Z"
};

const event: TaskEvent = {
  eventId: "e1",
  schemaVersion: 1,
  projectId: "project-1",
  taskId: "task-1",
  type: "task_created",
  payload: { title: state.title, goal: state.goal },
  parentEventIds: [],
  writer: { agentId: "codex", deviceId: "mac", sessionId: "s1" },
  createdAt: state.createdAt
};

test("renderer contains complete continuation sections without inventing a phase", () => {
  const documents = new MarkdownTaskRenderer().render(state, [event]);
  assert.match(documents.taskPlan, /目标与验收/);
  assert.match(documents.taskPlan, /当前关注点：写 renderer/);
  assert.match(documents.taskPlan, /下一步：运行测试/);
  assert.doesNotMatch(documents.taskPlan, /阶段：/);
  assert.match(documents.progress, /task_created/);
  assert.equal(documents.handoff, undefined);
});
