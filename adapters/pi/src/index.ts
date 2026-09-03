import {
  createCliAgentAdapter,
  ExecFileCliExecutor,
  type AgentAdapter,
  type CliExecutor
} from "@agent-task-sync/adapter-contract";

export function createPiAdapter(executor: CliExecutor = new ExecFileCliExecutor()): AgentAdapter {
  return createCliAgentAdapter({ name: "pi", executor });
}

export type { AgentAdapter } from "@agent-task-sync/adapter-contract";
