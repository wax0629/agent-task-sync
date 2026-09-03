import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { ApplicationService, type Actor } from "@agent-task-sync/application";
import { FileProjectRegistry } from "@agent-task-sync/project-registry";
import { MarkdownTaskRenderer } from "@agent-task-sync/renderer-markdown";
import { FileEventStore, FileProjectionStore } from "@agent-task-sync/store-files";
import { ExecFileGitRunner, FileGitSyncPort, type GitCommandResult, type GitRunner } from "../src/index.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}

class RecordingGitRunner implements GitRunner {
  readonly calls: Array<{ args: string[]; cwd: string; result: GitCommandResult }> = [];
  private readonly delegate = new ExecFileGitRunner();

  async run(args: readonly string[], cwd: string): Promise<GitCommandResult> {
    const result = await this.delegate.run(args, cwd);
    this.calls.push({ args: [...args], cwd, result });
    return result;
  }
}

interface Device {
  app: ApplicationService;
  events: FileEventStore;
  runner: RecordingGitRunner;
  sync: FileGitSyncPort;
  root: string;
}

async function repositoryFixture(): Promise<{ root: string; remote: string; mac: string; windows: string }> {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-dual-device-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const mac = join(root, "mac");
  const windows = join(root, "windows");
  await mkdir(seed, { recursive: true });
  await git(root, "init", "--bare", "-q", remote);
  await git(seed, "init", "-q", "-b", "main");
  await git(seed, "config", "user.email", "agent-task-sync@example.com");
  await git(seed, "config", "user.name", "Agent Task Sync Test");
  await writeFile(join(seed, "README.md"), "fixture\n", "utf8");
  await git(seed, "add", "README.md");
  await git(seed, "commit", "-q", "-m", "fixture");
  await git(seed, "remote", "add", "origin", remote);
  await git(seed, "push", "-q", "origin", "main");
  await git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
  await git(root, "clone", "-q", remote, mac);
  await git(root, "clone", "-q", remote, windows);
  for (const checkout of [mac, windows]) {
    await git(checkout, "config", "user.email", "agent-task-sync@example.com");
    await git(checkout, "config", "user.name", "Agent Task Sync Test");
  }
  return { root, remote, mac, windows };
}

async function deviceFixture(repoRoot: string, remote: string, worktreePath: string, deviceId: string): Promise<Device> {
  const runner = new RecordingGitRunner();
  const sync = new FileGitSyncPort({
    repoRoot,
    project: { remoteUrl: remote, defaultBranch: "main" },
    worktreePath,
    deviceId,
    runner,
    maxRetries: 1
  });
  await sync.initialize();
  const root = sync.stateDirectory;
  const events = new FileEventStore(root);
  const app = new ApplicationService({
    events,
    projections: new FileProjectionStore(root),
    registry: new FileProjectRegistry(root),
    renderer: new MarkdownTaskRenderer(),
    sync
  });
  return { app, events, runner, sync, root };
}

function actor(agentId: string, deviceId: string): Actor {
  return { agentId, deviceId, sessionId: `${deviceId}-session`, confirmed: true };
}

async function createAndPushTask(device: Device, repoRoot: string, remote: string): Promise<void> {
  await device.app.init({ projectId: "fixture-project", name: "Dual device fixture", rootPath: repoRoot, remoteUrl: remote, defaultBranch: "main" });
  await device.app.createTask({ projectId: "fixture-project", taskId: "task-1", title: "Dual device task", goal: "Keep both clones in sync", confirmed: true }, actor("codex", "mac"));
  const result = await device.app.sync();
  assert.equal(result.push.changed, true);
}

test("two real clones exchange task state and retry a non-fast-forward push without force", async () => {
  const fixture = await repositoryFixture();
  try {
    const mac = await deviceFixture(fixture.mac, fixture.remote, join(fixture.root, "mac-state"), "mac");
    await createAndPushTask(mac, fixture.mac, fixture.remote);
    const windows = await deviceFixture(fixture.windows, fixture.remote, join(fixture.root, "windows-state"), "windows");
    const initial = await windows.app.sync();
    assert.equal(initial.pull.changed, true);
    assert.equal((await windows.app.status()).tasks[0]?.title, "Dual device task");

    await mac.app.recordCheckpoint({ taskId: "task-1", currentFocus: "Mac focus", filesChanged: ["src/mac.ts"], confirmed: true }, actor("codex", "mac"));
    await windows.app.recordCheckpoint({ taskId: "task-1", nextAction: "Windows next", filesChanged: ["src/windows.ts"], confirmed: true }, actor("claude-code", "windows"));
    await mac.app.sync();
    const pushesBefore = windows.runner.calls.filter(({ args }) => args[0] === "push").length;
    const pushed = await windows.sync.push();
    const pushes = windows.runner.calls.filter(({ args }) => args[0] === "push").slice(pushesBefore);
    assert.equal(pushed.changed, true);
    assert.equal(pushes.length >= 2, true);
    assert.equal(pushes.every(({ args }) => !args.includes("--force") && !args.includes("-f")), true);

    await windows.app.rebuild("task-1");
    await windows.sync.push();
    const windowsStatus = await windows.app.status();
    assert.equal(windowsStatus.tasks[0]?.currentFocus, "Mac focus");
    assert.equal(windowsStatus.tasks[0]?.nextAction, "Windows next");
    assert.equal((await windows.app.getContext("task-1")).task.revision, windowsStatus.tasks[0]?.revision);
    assert.match(await readFile(join(windows.root, "tasks", "task-1", "task_plan.md"), "utf8"), /Mac focus/);
    assert.match(await readFile(join(windows.root, "tasks", "task-1", "task_plan.md"), "utf8"), /Windows next/);

    await mac.app.sync();
    const macStatus = await mac.app.status();
    assert.equal(macStatus.tasks[0]?.currentFocus, "Mac focus");
    assert.equal(macStatus.tasks[0]?.nextAction, "Windows next");
    assert.equal((await mac.events.readTaskEvents("task-1")).length, 3);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("same-parent divergence retains both events and exposes semantic conflict after rebuild", async () => {
  const fixture = await repositoryFixture();
  try {
    const mac = await deviceFixture(fixture.mac, fixture.remote, join(fixture.root, "mac-state"), "mac");
    await createAndPushTask(mac, fixture.mac, fixture.remote);
    const windows = await deviceFixture(fixture.windows, fixture.remote, join(fixture.root, "windows-state"), "windows");
    await windows.app.sync();

    await mac.app.recordCheckpoint({ taskId: "task-1", nextAction: "Mac branch", confirmed: true }, actor("codex", "mac"));
    await mac.app.sync();
    await windows.app.recordCheckpoint({ taskId: "task-1", nextAction: "Windows branch", confirmed: true }, actor("claude-code", "windows"));
    await windows.sync.push();
    const rebuilt = await windows.app.rebuild("task-1");
    assert.equal(rebuilt.states[0]?.status, "needs_review");
    assert.equal(rebuilt.states[0]?.conflicts.length, 1);
    assert.equal(rebuilt.states[0]?.conflicts[0]?.eventIds.length, 2);
    await windows.sync.push();

    const status = await windows.app.status();
    assert.equal(status.sync.conflict, true);
    assert.equal(status.tasks[0]?.status, "needs_review");
    const context = await windows.app.getContext("task-1");
    assert.match(context.warning ?? "", /冲突/);
    assert.match(context.markdown, /Mac branch|Windows branch/);

    await mac.app.sync();
    const macContext = await mac.app.getContext("task-1");
    assert.equal(macContext.task.status, "needs_review");
    assert.match(macContext.warning ?? "", /冲突/);
    assert.equal((await mac.app.status()).tasks[0]?.conflicts.length, 1);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
