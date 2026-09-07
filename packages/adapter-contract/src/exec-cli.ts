import { execFile } from "node:child_process";
import { extname } from "node:path";
import { promisify } from "node:util";
import type { CliExecutor, CliInvocation, CliResult } from "./types.js";

const execFileAsync = promisify(execFile);

function commandFor(invocation: CliInvocation): { executable: string; args: string[] } {
  // A JavaScript entrypoint is portable across POSIX and Windows even when it
  // is not marked executable (as is common for files produced by `tsc`).
  const extension = extname(invocation.executable).toLowerCase();
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    return { executable: process.execPath, args: [invocation.executable, ...invocation.args] };
  }
  return { executable: invocation.executable, args: invocation.args };
}

/** Default adapter runner. `execFile` keeps task data out of shell parsing. */
export class ExecFileCliExecutor implements CliExecutor {
  async run(invocation: CliInvocation): Promise<CliResult> {
    const command = commandFor(invocation);
    try {
      const result = await execFileAsync(command.executable, command.args, {
        cwd: invocation.cwd,
        env: { ...process.env, ...invocation.env },
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true
      });
      return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
      return {
        exitCode: typeof failure.code === "number" ? failure.code : 1,
        stdout: typeof failure.stdout === "string" ? failure.stdout : "",
        stderr: typeof failure.stderr === "string" ? failure.stderr : failure.message ?? ""
      };
    }
  }
}
