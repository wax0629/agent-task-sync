import {
  createCliAgentAdapter,
  ExecFileCliExecutor,
  type AgentAdapter,
  type CliExecutor
} from "@agent-task-sync/adapter-contract";

export function createClaudeCodeAdapter(executor: CliExecutor = new ExecFileCliExecutor()): AgentAdapter {
  return createCliAgentAdapter({ name: "claude-code", executor });
}

export type { AgentAdapter } from "@agent-task-sync/adapter-contract";
