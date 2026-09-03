import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileEventStore } from "@agent-task-sync/store-files";
import { ExitCode } from "../src/exit-codes.js";
import { inspectRuntime, createRuntime } from "../src/runtime.js";
import { run } from "../src/main.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

test("doctor reports an uninitialized mock runtime without creating state", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-doctor-mock-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  const previousWorktreePath = process.env.TASK_SYNC_WORKTREE_PATH;
  process.env.TASK_SYNC_STATE_DIR = join(cwd, ".state");
  delete process.env.TASK_SYNC_WORKTREE_PATH;
  try {
    const runtime = createRuntime(cwd);
    const report = await inspectRuntime(runtime);
    assert.equal(report.ok, false);
    assert.equal(report.initialized, false);
    assert.equal(report.mode, "mock");
    assert.equal(report.project, undefined);
    assert.equal(report.checks.find((check) => check.id === "project")?.status, "failed");
    assert.equal(await exists(runtime.root), false);
    assert.equal(await run(["doctor", "--json"], cwd), ExitCode.uninitialized);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
    if (previousWorktreePath === undefined) delete process.env.TASK_SYNC_WORKTREE_PATH;
    else process.env.TASK_SYNC_WORKTREE_PATH = previousWorktreePath;
  }
});

test("doctor is read-only for an initialized mock runtime", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-doctor-readonly-"));
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  const previousWorktreePath = process.env.TASK_SYNC_WORKTREE_PATH;
  const stateDir = join(cwd, ".state");
  process.env.TASK_SYNC_STATE_DIR = stateDir;
  delete process.env.TASK_SYNC_WORKTREE_PATH;
  try {
    const runtime = createRuntime(cwd);
    await runtime.app.init({ projectId: "project-1", name: "Doctor fixture", rootPath: cwd });
    const events = new FileEventStore(stateDir);
    const before = await events.readProjectEvents();
    const report = await inspectRuntime(createRuntime(cwd));
    const after = await events.readProjectEvents();
    assert.equal(report.ok, true);
    assert.equal(report.mode, "mock");
    assert.equal(report.project?.projectId, "project-1");
    assert.equal(report.checks.find((check) => check.id === "remote")?.status, "warning");
    assert.deepEqual(after.map((event) => event.eventId), before.map((event) => event.eventId));
    assert.equal(await run(["doctor", "--json"], cwd), ExitCode.ok);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
    if (previousWorktreePath === undefined) delete process.env.TASK_SYNC_WORKTREE_PATH;
    else process.env.TASK_SYNC_WORKTREE_PATH = previousWorktreePath;
  }
});

test("doctor detects a Git repository without initializing its state worktree", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agent-task-sync-doctor-git-"));
  execFileSync("git", ["init", "--initial-branch=main"], { cwd, stdio: "ignore" });
  const previousStateDir = process.env.TASK_SYNC_STATE_DIR;
  const previousWorktreePath = process.env.TASK_SYNC_WORKTREE_PATH;
  const worktreePath = join(cwd, "state-worktree");
  delete process.env.TASK_SYNC_STATE_DIR;
  process.env.TASK_SYNC_WORKTREE_PATH = worktreePath;
  try {
    const runtime = createRuntime(cwd);
    const report = await inspectRuntime(runtime);
    assert.equal(report.mode, "git-worktree");
    assert.equal(report.state.worktreePath, worktreePath);
    assert.equal(report.checks.find((check) => check.id === "git")?.status, "warning");
    assert.equal(await exists(worktreePath), false);
    assert.equal(await exists(join(worktreePath, ".git")), false);
  } finally {
    if (previousStateDir === undefined) delete process.env.TASK_SYNC_STATE_DIR;
    else process.env.TASK_SYNC_STATE_DIR = previousStateDir;
    if (previousWorktreePath === undefined) delete process.env.TASK_SYNC_WORKTREE_PATH;
    else process.env.TASK_SYNC_WORKTREE_PATH = previousWorktreePath;
  }
});
