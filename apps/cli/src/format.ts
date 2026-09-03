import type { ContinuationContext, ProjectStatus, RebuildResult, SyncResult } from "@agent-task-sync/application";
import type { ConflictRecord, TaskState } from "@agent-task-sync/domain";

const statusLabels: Record<TaskState["status"], string> = {
  planned: "计划中",
  in_progress: "进行中",
  blocked: "已阻塞",
  needs_review: "待审阅",
  handoff_ready: "待交接",
  completed: "已完成",
  archived: "已归档"
};

function taskLine(task: TaskState): string {
  const details = [statusLabels[task.status], task.currentFocus ? `当前：${task.currentFocus}` : undefined, task.nextAction ? `下一步：${task.nextAction}` : undefined]
    .filter(Boolean)
    .join(" · ");
  return `- ${task.id} · ${task.title}${details ? ` · ${details}` : ""}`;
}

function syncLabel(status: ProjectStatus["sync"]): string {
  if (status.conflict) return "存在冲突";
  if (status.remoteAhead) return "远程领先";
  if (status.localAhead) return "本地领先";
  return "已同步";
}

export function formatStatus(status: ProjectStatus): string {
  const project = status.project ? `${status.project.name} (${status.project.projectId})` : "未初始化";
  const tasks = status.tasks.length ? status.tasks.map(taskLine).join("\n") : "- 暂无任务";
  const sync = [`同步：${syncLabel(status.sync)}`, `本地事件：${status.sync.localEventCount}`, status.sync.lastSyncedAt ? `上次同步：${status.sync.lastSyncedAt}` : undefined]
    .filter(Boolean)
    .join(" · ");
  return [`项目：${project}`, sync, "任务：", tasks].join("\n");
}

export function formatContext(context: ContinuationContext): string {
  return context.warning ? `${context.warning}\n\n${context.markdown}` : context.markdown;
}

export function formatTaskList(tasks: readonly TaskState[]): string {
  return tasks.length ? tasks.map(taskLine).join("\n") : "暂无任务";
}

export function formatTask(task: TaskState): string {
  return [
    `任务：${task.title} (${task.id})`,
    `状态：${statusLabels[task.status]}`,
    `目标：${task.goal}`,
    task.currentFocus ? `当前关注：${task.currentFocus}` : undefined,
    task.nextAction ? `下一步：${task.nextAction}` : undefined,
    task.handoff ? `Handoff：${task.handoff.id}` : undefined,
    task.conflicts.length ? `冲突：${task.conflicts.filter((conflict) => !conflict.resolved).length} 个待处理` : undefined
  ].filter(Boolean).join("\n");
}

export interface ConflictListEntry extends ConflictRecord {
  taskTitle: string;
  taskStatus: TaskState["status"];
}

function conflictValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatConflicts(conflicts: readonly ConflictListEntry[]): string {
  if (conflicts.length === 0) return "没有待处理冲突。";
  return conflicts.map((conflict) => [
    `任务：${conflict.taskTitle} (${conflict.taskId}) · 状态：${statusLabels[conflict.taskStatus]}`,
    `冲突：${conflict.id} · 字段：${conflict.field}`,
    `父事件：${conflict.parentEventIds.join(", ") || "无"}`,
    "候选值：",
    ...conflict.options.map((option) => `- ${option.eventId}: ${conflictValue(option.value)}`),
    `原因：${conflict.reason}`
  ].join("\n")).join("\n\n");
}

export function formatRebuild(result: RebuildResult): string {
  return `已重建 ${result.taskIds.length} 个任务：${result.taskIds.join(", ") || "无"}`;
}

export function formatSync(result: SyncResult): string {
  return [
    `拉取：${result.pull.changed ? `已更新 ${result.pull.pulledEventCount} 条事件` : "无新增事件"}`,
    `重建：${result.rebuilt.taskIds.length} 个任务`,
    `推送：${result.push.changed ? `已提交 ${result.push.pushedEventCount} 条事件` : "无本地改动"}`,
    `同步前状态：${syncLabel(result.inspection)}`
  ].join("\n");
}
