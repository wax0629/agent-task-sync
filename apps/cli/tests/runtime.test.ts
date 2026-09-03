import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileGitSyncPort } from "@agent-task-sync/sync-git";
import { createRuntime } from "../src/runtime.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd, encoding: "utf8" });
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("Git repositories use an isolated state worktree for CLI runtime", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "agent-task-sync-runtime-repo-"));
  const worktreePath = join(repoRoot, "state-worktree");
  await git(repoRoot, "init", "-q", "-b", "main");
  await git(repoRoot, "config", "user.email", "agent-task-sync@example.com");
  await git(repoRoot, "config", "user.name", "Agent Task Sync Test");
  await writeFile(join(repoRoot, "README.md"), "fixture\n", "utf8");
  await git(repoRoot, "add", "README.md");
  await git(repoRoot, "commit", "-q", "-m", "fixture");

  const previous = {
    stateDir: process.env.TASK_SYNC_STATE_DIR,
    worktree: process.env.TASK_SYNC_WORKTREE_PATH,
    device: process.env.TASK_SYNC_DEVICE_ID
  };
  delete process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_WORKTREE_PATH = worktreePath;
  process.env.TASK_SYNC_DEVICE_ID = "mac";
  try {
    const runtime = createRuntime(repoRoot);
    assert.equal(runtime.sync instanceof FileGitSyncPort, true);
    await runtime.sync.initialize?.();
    await runtime.app.init({ projectId: "fixture-project", name: "Fixture", rootPath: repoRoot, defaultBranch: "main" });
    await runtime.app.createTask({ projectId: "fixture-project", taskId: "fixture-task", title: "Fixture task", goal: "Use the state worktree", confirmed: true }, runtime.actor());
    const state = await runtime.sync.status?.();
    assert.equal(state?.stateDirectory, join(worktreePath, ".task-sync"));
    assert.match(await readFile(join(worktreePath, ".task-sync", "tasks", "fixture-task", "task.yaml"), "utf8"), /Fixture task/);
    await assert.rejects(readFile(join(repoRoot, ".task-sync", "tasks", "fixture-task", "task.yaml"), "utf8"), { code: "ENOENT" });
  } finally {
    restore("TASK_SYNC_STATE_DIR", previous.stateDir);
    restore("TASK_SYNC_WORKTREE_PATH", previous.worktree);
    restore("TASK_SYNC_DEVICE_ID", previous.device);
  }
});
