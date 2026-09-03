import type { MarkdownRenderer, ProjectOverview, RenderedDocuments } from "@agent-task-sync/application";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";

const statusLabels: Record<TaskState["status"], string> = {
  planned: "计划中",
  in_progress: "进行中",
  blocked: "已阻塞",
  needs_review: "待审阅",
  handoff_ready: "待交接",
  completed: "已完成",
  archived: "已归档"
};

function text(value: string | undefined | null, fallback = "未记录"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function line(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function bullets(values: readonly string[], fallback = "- 未记录"): string {
  return values.length ? values.map((value) => `- ${line(value)}`).join("\n") : fallback;
}

function eventSummary(event: TaskEvent): string {
  const payload = event.payload as {
    summary?: string;
    command?: string;
    result?: string;
    reason?: string;
    currentFocus?: string;
    nextAction?: string | null;
    filesChanged?: string[];
    commit?: string;
    uncommittedChanges?: string[];
    verification?: Array<{ command: string; status: string }>;
    handoffId?: string;
    completedWork?: string[];
    incompleteWork?: string[];
    nextStep?: string | null;
    relevantFiles?: string[];
    testSummary?: string;
    targetAgent?: string;
  };
  if (event.type === "checkpoint_recorded") {
    return [
      payload.summary,
      payload.currentFocus ? `当前关注：${payload.currentFocus}` : undefined,
      payload.nextAction ? `下一步：${payload.nextAction}` : undefined,
      payload.filesChanged?.length ? `文件：${payload.filesChanged.join(", ")}` : undefined,
      payload.commit ? `commit：${payload.commit}` : undefined,
      payload.uncommittedChanges?.length ? `未提交：${payload.uncommittedChanges.join(", ")}` : undefined,
      payload.verification?.length ? `验证：${payload.verification.map((item) => `${item.command}（${item.status}）`).join(", ")}` : undefined
    ].filter((value): value is string => Boolean(value)).map(line).join("；") || "记录 checkpoint";
  }
  if (event.type === "handoff_created") {
    const id = payload.handoffId ?? `handoff-${event.eventId}`;
    return [
      `创建交接 ${id}`,
      payload.targetAgent ? `目标 Agent：${payload.targetAgent}` : undefined,
      payload.completedWork?.length ? `已完成：${payload.completedWork.join(", ")}` : undefined,
      payload.incompleteWork?.length ? `未完成：${payload.incompleteWork.join(", ")}` : undefined,
      payload.nextStep ? `下一步：${payload.nextStep}` : undefined,
      payload.relevantFiles?.length ? `文件：${payload.relevantFiles.join(", ")}` : undefined,
      payload.testSummary ? `测试：${payload.testSummary}` : undefined
    ].filter((value): value is string => Boolean(value)).map(line).join("；");
  }
  if (event.type === "handoff_accepted") {
    return `接受交接 ${payload.handoffId ?? "未命名交接"}`;
  }
  return payload.summary
    ?? (payload.command ? `${payload.command}：${payload.result ?? ""}` : undefined)
    ?? (payload.reason ? payload.reason : undefined)
    ?? (payload.currentFocus ? `当前关注：${payload.currentFocus}` : event.type);
}

function statusLabel(state: TaskState): string {
  return statusLabels[state.status];
}

export class MarkdownTaskRenderer implements MarkdownRenderer {
  render(state: TaskState, events: readonly TaskEvent[]): RenderedDocuments {
    const phase = state.currentPhaseId && state.phases?.find((item) => item.id === state.currentPhaseId);
    const taskPlan = [
      `# ${line(state.title)}`,
      "",
      `> 状态：${statusLabel(state)}${phase ? ` · 当前阶段：${line(phase.title)}` : ""}`,
      `> 更新时间：${state.updatedAt}`,
      "",
      "## 目标与验收",
      "",
      text(state.goal),
      state.background ? `\n背景：${line(state.background)}` : "",
      "",
      state.acceptanceCriteria.length
        ? state.acceptanceCriteria.map((criterion) => `- [${criterion.completed ? "x" : " "}] ${line(criterion.text)}`).join("\n")
        : "- 未记录验收标准",
      "",
      "## 当前工作",
      "",
      `当前关注点：${text(state.currentFocus)}`,
      "",
      "最近完成：",
      bullets(state.recentCompleted),
      "",
      `下一步：${text(state.nextAction, "未指定")}`,
      ...(state.phases?.length ? ["", "阶段：", ...state.phases.sort((a, b) => a.order - b.order).map((item) => `- ${item.status === "completed" ? "[x]" : "[ ]"} ${line(item.title)}（${item.status}）`)] : []),
      ...(state.handoff ? [
        "",
        "## 当前交接",
        "",
        `交接 ID：${line(state.handoff.id)}`,
        `创建时间：${state.handoff.createdAt}`,
        state.handoff.acceptedAt ? `接受时间：${state.handoff.acceptedAt}` : "接受状态：待接受",
        state.handoff.acceptedBy ? `接受者：${line(state.handoff.acceptedBy.agentId)} / ${line(state.handoff.acceptedBy.deviceId)}` : "",
        state.handoff.targetAgent ? `目标 Agent：${line(state.handoff.targetAgent)}` : "",
        "",
        "已完成：",
        bullets(state.handoff.completedWork),
        "",
        "未完成：",
        bullets(state.handoff.incompleteWork),
        "",
        `交接下一步：${text(state.handoff.nextStep, "未指定")}`,
        state.handoff.testSummary ? `测试摘要：${line(state.handoff.testSummary)}` : ""
      ] : []),
      "",
      "## 关键决策",
      "",
      state.decisions.length ? state.decisions.map((decision) => `- ${line(decision.decision)}${decision.reason ? `：${line(decision.reason)}` : ""}`).join("\n") : "- 未记录",
      "",
      "## 问题与失败尝试",
      "",
      state.openQuestions.length ? state.openQuestions.map((question) => `- ${question.resolved ? "[已解决]" : "[待处理]"} ${line(question.question)}${question.answer ? `：${line(question.answer)}` : ""}`).join("\n") : "- 未记录待处理问题",
      state.knownErrors.length ? state.knownErrors.map((error) => `- ${error.resolved ? "[已解决]" : "[未解决]"} ${line(error.error)}${error.attempts ? `（尝试：${line(error.attempts)}）` : ""}`).join("\n") : "",
      "",
      "## 文件与验证",
      "",
      state.references.length ? state.references.map((reference) => `- ${reference.path ? `文件：${line(reference.path)}` : "记录"}${reference.commit ? ` · commit：${line(reference.commit)}` : ""}${reference.note ? ` · ${line(reference.note)}` : ""}`).join("\n") : "- 未记录文件变化",
      ...(state.uncommittedChanges !== undefined ? ["", "未提交变更：", bullets(state.uncommittedChanges, "- 无")] : []),
      state.verification.length ? state.verification.map((result) => `- [${result.status}] \`${line(result.command)}\`：${line(result.result)}`).join("\n") : "- 未记录验证结果",
      "",
      "## 同步与责任",
      "",
      state.ownership ? `当前责任：${line(state.ownership.agentId)} / ${line(state.ownership.deviceId)}${state.ownership.sessionId ? ` / ${line(state.ownership.sessionId)}` : ""}` : "当前未认领",
      `同步状态：${state.sync.conflict ? "存在冲突" : state.sync.remoteAhead ? "远程领先" : state.sync.localAhead ? "本地领先" : "已同步"}`,
      `本地未同步事件：${state.sync.unsyncedEventCount}`,
      state.conflicts.length ? `冲突：${state.conflicts.filter((conflict) => !conflict.resolved).length} 个待处理` : "冲突：无",
      "",
      "## 恢复说明",
      "",
      "本文档由 `.task-sync` 事件重建生成，不是事实来源。请通过 task-sync CLI 记录修改。",
      ""
    ].filter((part, index, array) => !(part === "" && array[index - 1] === ""))
      .join("\n");

    const progress = [
      "# 工作日志",
      "",
      ...[...events].sort((left, right) => `${left.createdAt}:${left.eventId}`.localeCompare(`${right.createdAt}:${right.eventId}`)).map((event) => {
        return `- ${event.createdAt} · ${line(event.writer.agentId)}/${line(event.writer.deviceId)} · ${event.type} · ${line(eventSummary(event))}`;
      }),
      ""
    ].join("\n");

    const handoff = state.handoff ? [
      `# Handoff：${line(state.title)}`,
      "",
      `交接 ID：${line(state.handoff.id)}`,
      `创建时间：${state.handoff.createdAt}`,
      state.handoff.acceptedAt ? `接受时间：${state.handoff.acceptedAt}` : "接受状态：待接受",
      state.handoff.acceptedBy ? `接受者：${line(state.handoff.acceptedBy.agentId)} / ${line(state.handoff.acceptedBy.deviceId)}` : "",
      state.handoff.targetAgent ? `目标 Agent：${line(state.handoff.targetAgent)}` : "",
      "",
      "## 已完成",
      "",
      bullets(state.handoff.completedWork),
      "",
      "## 未完成",
      "",
      bullets(state.handoff.incompleteWork),
      "",
      "## 下一步",
      "",
      text(state.handoff.nextStep, "未指定"),
      "",
      "## 决策与错误",
      "",
      state.handoff.keyDecisions.length ? state.handoff.keyDecisions.map((item) => `- ${line(item.decision)}${item.reason ? `：${line(item.reason)}` : ""}`).join("\n") : "- 未记录决策",
      state.handoff.knownErrors.length ? state.handoff.knownErrors.map((item) => `- ${line(item.error)}${item.attempts ? `（尝试：${line(item.attempts)}）` : ""}`).join("\n") : "- 未记录错误",
      "",
      "## 文件与验证",
      "",
      bullets(state.handoff.relevantFiles),
      state.handoff.testSummary ? `\n测试摘要：${line(state.handoff.testSummary)}` : "",
      ""
    ].filter((part, index, array) => !(part === "" && array[index - 1] === "")).join("\n") : undefined;

    return { taskPlan, progress, handoff };
  }

  renderProject(overview: ProjectOverview): string {
    const orderedStatuses: TaskState["status"][] = [
      "planned",
      "in_progress",
      "blocked",
      "needs_review",
      "handoff_ready",
      "completed",
      "archived"
    ];
    const syncLabel = overview.sync.conflict
      ? "存在冲突"
      : overview.sync.remoteAhead
        ? "远程领先"
        : overview.sync.localAhead
          ? "本地领先"
          : "已同步";
    const taskLines = overview.tasks.length
      ? overview.tasks.map((task) => [
        `- [${statusLabels[task.status]}] ${line(task.title)} (${task.id})`,
        task.currentFocus ? `  - 当前关注：${line(task.currentFocus)}` : undefined,
        task.nextAction ? `  - 下一步：${line(task.nextAction)}` : undefined,
        task.pendingHandoff ? "  - 待处理：handoff" : undefined,
        task.unresolvedConflictCount ? `  - 待审阅冲突：${task.unresolvedConflictCount} 个` : undefined
      ].filter((value): value is string => Boolean(value)).join("\n")).join("\n")
      : "- 暂无任务";
    const activityLines = overview.recentActivity.length
      ? overview.recentActivity.map((activity) => `- ${activity.createdAt} · ${line(activity.taskTitle)} (${activity.taskId}) · ${line(activity.summary)} · ${line(activity.agentId)}/${line(activity.deviceId)}`).join("\n")
      : "- 暂无活动";
    return [
      `# 项目进度：${line(overview.projectName)}`,
      "",
      `> 项目 ID：${line(overview.projectId)}`,
      `> 最近活动：${overview.lastActivityAt ?? "未记录"}`,
      "",
      "## 状态概览",
      "",
      `- 任务总数：${overview.taskCount}`,
      ...orderedStatuses.map((status) => `- ${statusLabels[status]}：${overview.statusCounts[status]}`),
      `- 待处理 handoff：${overview.pendingHandoffCount}`,
      `- 未解决冲突：${overview.unresolvedConflictCount}`,
      `- 同步状态：${syncLabel}`,
      `- 本地未同步事件：${overview.sync.localEventCount}`,
      "",
      "## 任务概览",
      "",
      taskLines,
      "",
      "## 最近活动",
      "",
      activityLines,
      "",
      "## 说明",
      "",
      "本文档由 `.task-sync` 事件重建生成，不是事实来源。请通过 task-sync CLI 记录修改。",
      ""
    ].join("\n");
  }
}
