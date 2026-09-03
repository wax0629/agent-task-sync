import { createClaudeCodeAdapter } from "./index.js";
import { runHook } from "@agent-task-sync/adapter-contract";

async function readInput(): Promise<string> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk.toString();
  return text;
}

const adapter = createClaudeCodeAdapter();
const result = await runHook(adapter, process.argv[2] ?? "session_start", await readInput(), process.cwd());
process.stdout.write(`${JSON.stringify(result)}\n`);
