import type {
  AdapterHookResult,
  AdapterOptions,
  AgentAdapter,
  CliInvocation,
  CliResult,
  HookInput,
  HookName
} from "./types.js";
import { checkpointInvocation, contextInvocation, handoffInvocation, statusInvocation } from "./cli-contract.js";

function successful(result: CliResult): boolean {
  return result.exitCode === 0;
}

function output(result: CliResult): string | undefined {
  const value = result.stdout.trim();
  return value || undefined;
}

function errorMessage(result: CliResult): string {
  return result.stderr.trim() || `task-sync exited with code ${result.exitCode}`;
}

function result(hook: HookName, invocations: CliInvocation[], value: Partial<AdapterHookResult> = {}): AdapterHookResult {
  return { continue: true, hook, invocations, ...value };
}

/**
 * Shared lifecycle behavior. Platform adapters only choose the hook entry point and
 * pass through the platform's input; all stateful work remains in the CLI.
 */
export function createCliAgentAdapter(options: AdapterOptions): AgentAdapter {
  const executable = options.executable ?? "task-sync";

  async function execute(invocation: CliInvocation): Promise<CliResult> {
    return options.executor.run(invocation);
  }

  async function safe(hook: HookName, operation: () => Promise<AdapterHookResult>): Promise<AdapterHookResult> {
    try {
      return await operation();
    } catch (error) {
      return result(hook, [], { warning: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    name: options.name,

    async sessionStart(input: HookInput): Promise<AdapterHookResult> {
      return safe("session_start", async () => {
        const status = statusInvocation(input.cwd, executable);
        const statusResult = await execute({ ...status, env: input.environment });
        const invocations = [status];
        if (!successful(statusResult)) return result("session_start", invocations, { warning: errorMessage(statusResult) });
        if (!input.taskId) return result("session_start", invocations, { output: output(statusResult) });
        const context = contextInvocation(input.taskId, input.cwd, executable);
        const contextResult = await execute({ ...context, env: input.environment });
        invocations.push(context);
        return successful(contextResult)
          ? result("session_start", invocations, { output: output(contextResult) })
          : result("session_start", invocations, { warning: errorMessage(contextResult), output: output(statusResult) });
      });
    },

    async preCompact(input: HookInput): Promise<AdapterHookResult> {
      return safe("pre_compact", async () => {
        if (!input.taskId) return result("pre_compact", [], { warning: "No active task selected; skipped context refresh." });
        const invocation = contextInvocation(input.taskId, input.cwd, executable);
        const contextResult = await execute({ ...invocation, env: input.environment });
        return successful(contextResult)
          ? result("pre_compact", [invocation], { output: output(contextResult) })
          : result("pre_compact", [invocation], { warning: errorMessage(contextResult) });
      });
    },

    async stop(input: HookInput): Promise<AdapterHookResult> {
      return safe("stop", async () => {
        if (!input.taskId || !input.checkpointInputFile) {
          return result("stop", [], { warning: "No checkpoint candidate supplied; no persistent write was attempted." });
        }
        if (!input.confirmed) {
          const invocation = checkpointInvocation({ taskId: input.taskId, inputFile: input.checkpointInputFile }, input.cwd, executable);
          return result("stop", [invocation], {
            requiresConfirmation: true,
            warning: "Checkpoint candidate is ready; user confirmation is required before writing."
          });
        }
        const invocation = checkpointInvocation({ taskId: input.taskId, inputFile: input.checkpointInputFile, confirmed: true }, input.cwd, executable);
        const checkpointResult = await execute({ ...invocation, env: input.environment });
        return successful(checkpointResult)
          ? result("stop", [invocation], { output: output(checkpointResult) })
          : result("stop", [invocation], { warning: errorMessage(checkpointResult) });
      });
    },

    async handoff(input: HookInput): Promise<AdapterHookResult> {
      return safe("handoff", async () => {
        if (!input.taskId || !input.handoffInputFile) {
          return result("handoff", [], { warning: "No handoff candidate supplied; no persistent write was attempted." });
        }
        const invocation = handoffInvocation({ taskId: input.taskId, inputFile: input.handoffInputFile, confirmed: input.confirmed }, input.cwd, executable);
        if (!input.confirmed) {
          return result("handoff", [invocation], {
            requiresConfirmation: true,
            warning: "Handoff candidate is ready; user confirmation is required before writing."
          });
        }
        const handoffResult = await execute({ ...invocation, env: input.environment });
        return successful(handoffResult)
          ? result("handoff", [invocation], { output: output(handoffResult) })
          : result("handoff", [invocation], { warning: errorMessage(handoffResult) });
      });
    }
  };
}
