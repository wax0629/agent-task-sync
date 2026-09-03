import type { CheckpointCommandInput, CliInvocation, HandoffCommandInput } from "./types.js";

export function statusInvocation(cwd: string, executable = "task-sync"): CliInvocation {
  return { executable, args: ["status", "--json"], cwd };
}

export function contextInvocation(taskId: string, cwd: string, executable = "task-sync"): CliInvocation {
  return { executable, args: ["context", taskId, "--format", "json"], cwd };
}

export function checkpointInvocation(input: CheckpointCommandInput, cwd: string, executable = "task-sync"): CliInvocation {
  return {
    executable,
    args: ["checkpoint", "--task", input.taskId, "--input", input.inputFile, ...(input.confirmed ? ["--yes"] : [])],
    cwd
  };
}

export function handoffInvocation(input: HandoffCommandInput, cwd: string, executable = "task-sync"): CliInvocation {
  return {
    executable,
    args: ["handoff", "create", "--task", input.taskId, "--input", input.inputFile, ...(input.confirmed ? ["--yes"] : [])],
    cwd
  };
}
