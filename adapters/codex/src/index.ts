import {
  createCliAgentAdapter,
  ExecFileCliExecutor,
  type AgentAdapter,
  type CliExecutor
} from "@agent-task-sync/adapter-contract";

export function createCodexAdapter(executor: CliExecutor = new ExecFileCliExecutor()): AgentAdapter {
  return createCliAgentAdapter({ name: "codex", executor });
}

export type { AgentAdapter } from "@agent-task-sync/adapter-contract";
