import type { MarkdownRenderer, RenderedDocuments } from "@agent-task-sync/application";
import type { TaskEvent, TaskState } from "@agent-task-sync/domain";

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

function statusLabel(state: TaskState): string {
  const labels: Record<TaskState["status"], string> = {
    planned: "计划中",
    in_progress: "进行中",
    blocked: "已阻塞",
    needs_review: "待审阅",
    handoff_ready: "待交接",
    completed: "已完成",
    archived: "已归档"
  };
  return labels[state.status];
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
      state.verification.length ? state.verification.map((result) => `- [${result.status}] \`${line(result.command)}\`：${line(result.result)}`).join("\n") : "- 未记录验证结果",
      "",
      "## 同步与责任",
      "",
      state.ownership ? `当前责任：${line(state.ownership.agentId)} / ${line(state.ownership.deviceId)}${state.ownership.sessionId ? ` / ${line(state.ownership.sessionId)}` : ""}` : "当前未认领",
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
        const payload = event.payload as { summary?: string; command?: string; result?: string };
        const summary = payload.summary ?? (payload.command ? `${payload.command}：${payload.result ?? ""}` : event.type);
        return `- ${event.createdAt} · ${line(event.writer.agentId)}/${line(event.writer.deviceId)} · ${event.type} · ${line(summary)}`;
      }),
      ""
    ].join("\n");

    const handoff = state.handoff ? [
      `# Handoff：${line(state.title)}`,
      "",
      `创建时间：${state.handoff.createdAt}`,
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
}
