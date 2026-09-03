import { join, relative, sep } from "node:path";

function assertSafeSegment(value: string, name: string): string {
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || value.includes("\0")) {
    throw new Error(`Invalid ${name}: ${JSON.stringify(value)}`);
  }
  return value;
}

export function taskDirectory(rootDir: string, taskId: string): string {
  return join(rootDir, "tasks", assertSafeSegment(taskId, "task id"));
}

export function eventFile(rootDir: string, event: { taskId: string; writer: { deviceId: string; agentId: string; sessionId: string } }): string {
  return join(
    taskDirectory(rootDir, event.taskId),
    "events",
    assertSafeSegment(event.writer.deviceId, "device id"),
    assertSafeSegment(event.writer.agentId, "agent id"),
    `${assertSafeSegment(event.writer.sessionId, "session id")}.jsonl`
  );
}

export function relativeProtocolPath(rootDir: string, path: string): string {
  const value = relative(rootDir, path).split(sep).join("/");
  if (value.startsWith("../") || value === "..") throw new Error(`Path escapes state root: ${path}`);
  return value;
}
