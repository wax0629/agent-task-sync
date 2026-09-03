import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CliExecutor, CliInvocation, CliResult } from "./types.js";

const execFileAsync = promisify(execFile);

/** Default adapter runner. `execFile` keeps task data out of shell parsing. */
export class ExecFileCliExecutor implements CliExecutor {
  async run(invocation: CliInvocation): Promise<CliResult> {
    try {
      const result = await execFileAsync(invocation.executable, invocation.args, {
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
