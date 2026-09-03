#!/usr/bin/env node
import { ApplicationService, ConfirmationRequiredError } from "@agent-task-sync/application";
import { ExitCode } from "./exit-codes.js";
import { formatContext, formatStatus } from "./format.js";
import { createRuntime } from "./runtime.js";

interface ParsedArgs {
  command?: string;
  args: string[];
  json: boolean;
  format?: "markdown" | "json";
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = [...argv];
  const json = values.includes("--json");
  const formatIndex = values.indexOf("--format");
  const formatValue = formatIndex >= 0 ? values[formatIndex + 1] : undefined;
  if (formatValue && formatValue !== "markdown" && formatValue !== "json") throw new Error("--format must be markdown or json");
  const filtered = values.filter((value, index) => {
    if (value === "--json") return false;
    if (formatIndex >= 0 && (index === formatIndex || index === formatIndex + 1)) return false;
    return true;
  });
  return { command: filtered[0], args: filtered.slice(1), json, format: formatValue as ParsedArgs["format"] };
}

function print(value: unknown, json: boolean, text: string): void {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n`);
}

export async function run(argv: readonly string[], cwd = process.cwd()): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const runtime = createRuntime(cwd);
    const command = parsed.command;
    if (command === "init") {
      if (parsed.args.length < 1 || parsed.args.length > 2) throw new Error("usage: task-sync init <project-id> [project-name]");
      const projectId = parsed.args[0];
      const name = parsed.args[1] ?? projectId;
      const project = await runtime.app.init({ projectId, name, rootPath: cwd, defaultBranch: "main" });
      print(project, parsed.json, `已初始化项目：${project.name}`);
      return ExitCode.ok;
    }
    if (command === "status") {
      const status = await runtime.app.status();
      if (!status.project) return ExitCode.uninitialized;
      print(status, parsed.json, formatStatus(status));
      return status.sync.conflict ? ExitCode.conflict : status.sync.remoteAhead ? ExitCode.needsSync : ExitCode.ok;
    }
    if (command === "context") {
      if (parsed.args.length !== 1) throw new Error("usage: task-sync context <task-id> [--format markdown|json]");
      const context = await runtime.app.getContext(parsed.args[0]);
      if (parsed.format === "json" || parsed.json) print(context, true, "");
      else print(context, false, formatContext(context));
      return context.warning ? ExitCode.needsSync : ExitCode.ok;
    }
    if (command === "doctor") {
      const status = await runtime.app.status();
      print({ ok: Boolean(status.project), root: runtime.root }, parsed.json, status.project ? `状态目录正常：${runtime.root}` : "尚未初始化");
      return status.project ? ExitCode.ok : ExitCode.uninitialized;
    }
    throw new Error("usage: task-sync init|status|context|doctor");
  } catch (error) {
    const code = error instanceof ConfirmationRequiredError ? ExitCode.invalidInput : ExitCode.invalidInput;
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return code;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
