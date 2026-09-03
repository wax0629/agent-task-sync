import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitRunner {
  run(args: readonly string[], cwd: string): Promise<GitCommandResult>;
}

/** Uses execFile so Git arguments are never interpreted by a shell. */
export class ExecFileGitRunner implements GitRunner {
  async run(args: readonly string[], cwd: string): Promise<GitCommandResult> {
    try {
      const result = await execFileAsync("git", [...args], {
        cwd,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true
      });
      return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
      return {
        stdout: typeof failure.stdout === "string" ? failure.stdout : "",
        stderr: typeof failure.stderr === "string" ? failure.stderr : failure.message ?? "",
        exitCode: typeof failure.code === "number" ? failure.code : 1
      };
    }
  }
}
