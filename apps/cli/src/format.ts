import type { ContinuationContext, ProjectStatus } from "@agent-task-sync/application";

export function formatStatus(status: ProjectStatus): string {
  const project = status.project ? `${status.project.name} (${status.project.projectId})` : "未初始化";
  const tasks = status.tasks.length
    ? status.tasks.map((task) => `- ${task.id} · ${task.title} · ${task.status}${task.nextAction ? ` · 下一步：${task.nextAction}` : ""}`).join("\n")
    : "- 暂无任务";
  return [`项目：${project}`, `同步：${status.sync.remoteAhead ? "远程领先" : status.sync.localAhead ? "本地领先" : "已同步"}`, "任务：", tasks].join("\n");
}

export function formatContext(context: ContinuationContext): string {
  return context.warning ? `${context.warning}\n\n${context.markdown}` : context.markdown;
}
