export type AdapterName = "codex" | "claude-code" | (string & {});

export type HookName = "session_start" | "pre_compact" | "stop";

export interface CliInvocation {
  executable: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CliExecutor {
  run(invocation: CliInvocation): Promise<CliResult>;
}

export interface HookInput {
  cwd: string;
  taskId?: string;
  checkpointInputFile?: string;
  handoffInputFile?: string;
  confirmed?: boolean;
  environment?: Record<string, string | undefined>;
}

export interface AdapterHookResult {
  continue: true;
  hook: HookName;
  output?: string;
  warning?: string;
  requiresConfirmation?: boolean;
  invocations: CliInvocation[];
}

export interface AgentAdapter {
  readonly name: AdapterName;
  sessionStart(input: HookInput): Promise<AdapterHookResult>;
  preCompact(input: HookInput): Promise<AdapterHookResult>;
  stop(input: HookInput): Promise<AdapterHookResult>;
  handoff(input: HookInput): Promise<AdapterHookResult>;
}

export interface AdapterOptions {
  name: AdapterName;
  executable?: string;
  executor: CliExecutor;
}

export interface CheckpointCommandInput {
  taskId: string;
  inputFile: string;
  confirmed?: boolean;
}

export interface HandoffCommandInput {
  taskId: string;
  inputFile: string;
  confirmed?: boolean;
}
