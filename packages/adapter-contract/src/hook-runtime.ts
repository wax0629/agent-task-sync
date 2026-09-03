import type {
  AgentAdapter,
  AdapterHookResult,
  HookDispatchName,
  HookInput,
  HookInputParseResult,
  HookName
} from "./types.js";

const hookNames: readonly HookName[] = ["session_start", "pre_compact", "stop", "handoff"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnvironment(value: unknown): value is Record<string, string | undefined> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "undefined");
}

function isHookName(value: string | undefined): value is HookName {
  return typeof value === "string" && hookNames.includes(value as HookName);
}

function dispatchName(value: string | undefined): HookDispatchName {
  return isHookName(value) ? value : "unknown";
}

/** Parse the stable adapter fields without inspecting or executing payload content. */
export function parseHookInput(rawInput: string, defaultCwd: string): HookInputParseResult {
  if (!rawInput.trim()) return { input: { cwd: defaultCwd } };

  let value: unknown;
  try {
    value = JSON.parse(rawInput);
  } catch (error) {
    return { warning: `Invalid hook input JSON: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!isRecord(value)) return { warning: "Invalid hook input: expected a JSON object." };
  if (!isNonEmptyString(value.cwd)) return { warning: "Invalid hook input: cwd must be a non-empty string." };
  if (value.taskId !== undefined && !isNonEmptyString(value.taskId)) return { warning: "Invalid hook input: taskId must be a non-empty string when provided." };
  if (value.checkpointInputFile !== undefined && !isNonEmptyString(value.checkpointInputFile)) return { warning: "Invalid hook input: checkpointInputFile must be a non-empty string when provided." };
  if (value.handoffInputFile !== undefined && !isNonEmptyString(value.handoffInputFile)) return { warning: "Invalid hook input: handoffInputFile must be a non-empty string when provided." };
  if (value.confirmed !== undefined && typeof value.confirmed !== "boolean") return { warning: "Invalid hook input: confirmed must be a boolean when provided." };
  if (value.environment !== undefined && !isEnvironment(value.environment)) return { warning: "Invalid hook input: environment must contain only string values." };

  return { input: value as unknown as HookInput };
}

function warningResult(hook: HookDispatchName, warning: string): AdapterHookResult {
  return { continue: true, hook, warning, invocations: [] };
}

/** Dispatch one hook while keeping malformed input and unknown hooks non-blocking. */
export async function runHook(
  adapter: AgentAdapter,
  requestedHook: string | undefined,
  rawInput: string,
  defaultCwd: string
): Promise<AdapterHookResult> {
  const hook = dispatchName(requestedHook);
  if (hook === "unknown") return warningResult(hook, `Unknown hook: ${requestedHook ?? "<empty>"}.`);

  const parsed = parseHookInput(rawInput, defaultCwd);
  if (!parsed.input) return warningResult(hook, parsed.warning ?? "Invalid hook input.");

  switch (hook) {
    case "session_start":
      return adapter.sessionStart(parsed.input);
    case "pre_compact":
      return adapter.preCompact(parsed.input);
    case "stop":
      return adapter.stop(parsed.input);
    case "handoff":
      return adapter.handoff(parsed.input);
  }
}
