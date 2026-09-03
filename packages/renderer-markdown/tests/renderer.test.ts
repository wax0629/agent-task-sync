import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownTaskRenderer } from "../src/index.js";
import type { ProjectOverview } from "@agent-task-sync/application";
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
  uncommittedChanges: ["src/renderer.ts"],
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
  assert.match(documents.taskPlan, /未提交变更：/);
  assert.doesNotMatch(documents.taskPlan, /阶段：/);
  assert.match(documents.progress, /task_created/);
  assert.equal(documents.handoff, undefined);
});

test("renderer exposes the current handoff and preserves handoff details in progress history", () => {
  const handoffState: TaskState = {
    ...state,
    status: "in_progress",
    handoff: {
      id: "handoff-1",
      completedWork: ["完成 checkpoint"],
      incompleteWork: ["运行集成测试"],
      keyDecisions: [{ decision: "保留事件事实来源", reason: "可重建" }],
      knownErrors: [],
      nextStep: "运行集成测试",
      relevantFiles: ["src/renderer.ts"],
      testSummary: "renderer tests pass",
      targetAgent: "claude-code",
      createdAt: "2026-09-03T02:00:00.000Z",
      acceptedAt: "2026-09-03T03:00:00.000Z",
      acceptedBy: { agentId: "claude-code", deviceId: "windows", claimedAt: "2026-09-03T03:00:00.000Z" }
    }
  };
  const handoffEvent: TaskEvent = {
    ...event,
    eventId: "e2",
    type: "handoff_created",
    payload: {
      handoffId: "handoff-1",
      completedWork: ["完成 checkpoint"],
      incompleteWork: ["运行集成测试"],
      nextStep: "运行集成测试",
      relevantFiles: ["src/renderer.ts"],
      testSummary: "renderer tests pass"
    },
    parentEventIds: ["e1"]
  };
  const acceptedEvent: TaskEvent = {
    ...event,
    eventId: "e3",
    type: "handoff_accepted",
    payload: { handoffId: "handoff-1" },
    parentEventIds: ["e2"]
  };
  const documents = new MarkdownTaskRenderer().render(handoffState, [event, handoffEvent, acceptedEvent]);
  assert.match(documents.taskPlan, /交接 ID：handoff-1/);
  assert.match(documents.taskPlan, /接受者：claude-code \/ windows/);
  assert.match(documents.progress, /创建交接 handoff-1/);
  assert.match(documents.progress, /接受交接 handoff-1/);
  assert.match(documents.handoff ?? "", /接受时间：2026-09-03T03:00:00.000Z/);
});

test("renderer creates a compact project progress overview", () => {
  const overview: ProjectOverview = {
    projectId: "project-1",
    projectName: "同步项目",
    taskCount: 5,
    statusCounts: {
      planned: 1,
      in_progress: 1,
      blocked: 1,
      needs_review: 1,
      handoff_ready: 1,
      completed: 0,
      archived: 0
    },
    pendingHandoffCount: 1,
    unresolvedConflictCount: 1,
    lastActivityAt: "2026-09-03T04:00:00.000Z",
    recentActivity: [{
      eventId: "event-1",
      taskId: "task-1",
      taskTitle: "同步任务",
      type: "checkpoint_recorded",
      createdAt: "2026-09-03T04:00:00.000Z",
      agentId: "codex",
      deviceId: "mac",
      summary: "验证跨设备恢复"
    }],
    tasks: [{
      id: "task-1",
      title: "同步任务",
      status: "needs_review",
      currentFocus: "审阅冲突",
      nextAction: "选择候选值",
      updatedAt: "2026-09-03T04:00:00.000Z",
      pendingHandoff: false,
      unresolvedConflictCount: 1
    }],
    sync: { localEventCount: 2, localAhead: true, remoteAhead: false, conflict: true }
  };
  const markdown = new MarkdownTaskRenderer().renderProject(overview);
  assert.match(markdown, /# 项目进度：同步项目/);
  assert.match(markdown, /任务总数：5/);
  assert.match(markdown, /待审阅：1/);
  assert.match(markdown, /待处理 handoff：1/);
  assert.match(markdown, /未解决冲突：1/);
  assert.match(markdown, /选择候选值/);
  assert.match(markdown, /codex\/mac/);
});
