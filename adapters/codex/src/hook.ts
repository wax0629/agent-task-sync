import { createCodexAdapter } from "./index.js";
import type { HookInput, HookName } from "@agent-task-sync/adapter-contract";

async function readInput(): Promise<HookInput> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk.toString();
  return text.trim() ? JSON.parse(text) as HookInput : { cwd: process.cwd() };
}

const input = await readInput();
const hook = (process.argv[2] ?? "session_start") as HookName;
const adapter = createCodexAdapter();
const result = hook === "session_start"
  ? await adapter.sessionStart(input)
  : hook === "pre_compact"
    ? await adapter.preCompact(input)
    : await adapter.stop(input);
process.stdout.write(`${JSON.stringify(result)}\n`);
