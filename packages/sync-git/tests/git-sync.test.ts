import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileGitSyncPort, GitTextConflictError, NoRemoteError, type GitCommandResult, type GitRunner, defaultWorktreePath, normalizeRemote, repoIdFromRemote, stateDirectory, withSyncLock } from "../src/index.js";

class ScriptedRunner implements GitRunner {
  readonly calls: Array<{ args: string[]; cwd: string }> = [];
  private readonly counts = new Map<string, number>();

  constructor(private readonly script: (args: string[], callNumber: number) => GitCommandResult) {}

  async run(args: readonly string[], cwd: string): Promise<GitCommandResult> {
    const values = [...args];
    const key = values.join(" ");
    const callNumber = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, callNumber);
    this.calls.push({ args: values, cwd });
    return this.script(values, callNumber);
  }
}

const ok = (stdout = ""): GitCommandResult => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string, exitCode = 1): GitCommandResult => ({ stdout: "", stderr, exitCode });

async function worktreeFixture(): Promise<{ repoRoot: string; worktreePath: string; stateRoot: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), "agent-task-sync-git-repo-"));
  const worktreePath = join(repoRoot, "state-worktree");
  await mkdir(join(worktreePath, ".git"), { recursive: true });
  const stateRoot = stateDirectory(worktreePath);
  await mkdir(join(stateRoot, "tasks", "task-1", "events", "mac", "codex"), { recursive: true });
  await writeFile(join(stateRoot, "tasks", "task-1", "events", "mac", "codex", "session.jsonl"), "{\"eventId\":\"e1\"}\n");
  return { repoRoot, worktreePath, stateRoot };
}

function baseScript(args: string[]): GitCommandResult {
  if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok();
  if (args[0] === "remote" && args[1] === "get-url") return ok("https://github.com/example/project.git\n");
  if (args[0] === "rev-parse" && args[1] === "--verify") return ok("abc123\n");
  if (args[0] === "fetch") return ok();
  if (args[0] === "merge") return ok();
  if (args[0] === "diff") return ok();
  if (args[0] === "rev-list") return ok("0 0\n");
  if (args[0] === "status") return ok();
  if (args[0] === "push") return ok();
  return ok();
}

test("remote identity and platform paths are stable and normalized", () => {
  assert.equal(normalizeRemote("git@github.com:Wax0629/Agent-Task-Sync.git"), "github.com/wax0629/agent-task-sync");
  assert.equal(normalizeRemote("https://github.com/Wax0629/Agent-Task-Sync.git/"), "github.com/wax0629/agent-task-sync");
  assert.equal(repoIdFromRemote("https://github.com/wax0629/agent-task-sync.git", "/tmp/other"), repoIdFromRemote("git@github.com:wax0629/agent-task-sync.git", "/tmp/other"));
  assert.match(defaultWorktreePath("abc", { homeDirectory: "C:/Users/test", platformName: "win32" }), /agent-task-sync[\\/]projects[\\/]abc[\\/]state-worktree$/);
  assert.match(defaultWorktreePath("abc", { homeDirectory: "/Users/test", platformName: "darwin" }), /Library[\\/]Application Support[\\/]agent-task-sync/);
});

test("initialize creates a dedicated state branch worktree without touching code checkout", async () => {
  const fixture = await worktreeFixture();
  const runner = new ScriptedRunner(baseScript);
  const port = new FileGitSyncPort({ repoRoot: fixture.repoRoot, worktreePath: fixture.worktreePath, runner });
  await port.initialize();
  assert.equal(port.stateBranch, "task-sync/state");
  assert.equal(port.stateDirectory, fixture.stateRoot);
  assert.equal(runner.calls.some(({ args, cwd }) => args[0] === "worktree" && args[1] === "add" && args.includes("task-sync/state") && cwd === fixture.repoRoot), false);
  // Existing .git means initialization is idempotent; no branch or worktree command is needed.
  assert.equal(runner.calls.some(({ args }) => args[0] === "worktree"), false);
});

test("initialize replaces an empty target directory but rejects a non-empty non-worktree", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "agent-task-sync-git-empty-target-"));
  const worktreePath = join(repoRoot, "state-worktree");
  await mkdir(worktreePath);
  const runner = new ScriptedRunner(baseScript);
  const port = new FileGitSyncPort({ repoRoot, worktreePath, runner });
  await port.initialize();
  assert.equal(runner.calls.some(({ args }) => args[0] === "worktree" && args[1] === "add"), true);

  const occupiedRoot = await mkdtemp(join(tmpdir(), "agent-task-sync-git-occupied-target-"));
  const occupiedPath = join(occupiedRoot, "state-worktree");
  await mkdir(occupiedPath);
  await writeFile(join(occupiedPath, "unexpected.txt"), "content", "utf8");
  const occupiedPort = new FileGitSyncPort({ repoRoot: occupiedRoot, worktreePath: occupiedPath, runner: new ScriptedRunner(baseScript) });
  await assert.rejects(occupiedPort.initialize(), /not a Git worktree/);
});

test("pull without a remote keeps local events and does not fail", async () => {
  const fixture = await worktreeFixture();
  const runner = new ScriptedRunner((args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok();
    if (args[0] === "remote" && args[1] === "get-url") return fail("No such remote");
    return baseScript(args);
  });
  const port = new FileGitSyncPort({ repoRoot: fixture.repoRoot, worktreePath: fixture.worktreePath, runner });
  const result = await port.pull();
  assert.equal(result.pulledEventCount, 0);
  assert.equal(result.changed, false);
  assert.equal((await readFile(join(fixture.stateRoot, "tasks", "task-1", "events", "mac", "codex", "session.jsonl"), "utf8")).endsWith("\n"), true);
  assert.equal(runner.calls.some(({ args }) => args[0] === "fetch"), false);
});

test("push refuses a missing remote and preserves local state", async () => {
  const fixture = await worktreeFixture();
  const runner = new ScriptedRunner((args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok();
    if (args[0] === "remote" && args[1] === "get-url") return fail("No such remote");
    return baseScript(args);
  });
  const port = new FileGitSyncPort({ repoRoot: fixture.repoRoot, worktreePath: fixture.worktreePath, runner });
  await assert.rejects(port.push(), NoRemoteError);
  assert.equal((await readFile(join(fixture.stateRoot, "tasks", "task-1", "events", "mac", "codex", "session.jsonl"), "utf8")).includes("e1"), true);
  assert.equal(runner.calls.some(({ args }) => args[0] === "push"), false);
});

test("non-fast-forward push performs one pull retry and never uses force", async () => {
  const fixture = await worktreeFixture();
  const runner = new ScriptedRunner((args, callNumber) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok();
    if (args[0] === "remote" && args[1] === "get-url") return ok("https://github.com/example/project.git\n");
    if (args[0] === "status") return callNumber === 1 ? ok(" M .task-sync\n") : ok();
    if (args[0] === "push") return callNumber === 1 ? fail("rejected: non-fast-forward") : ok();
    return baseScript(args);
  });
  const port = new FileGitSyncPort({ repoRoot: fixture.repoRoot, worktreePath: fixture.worktreePath, runner, maxRetries: 1 });
  const result = await port.push();
  assert.equal(result.changed, true);
  const pushes = runner.calls.filter(({ args }) => args[0] === "push");
  assert.equal(pushes.length, 2);
  assert.equal(pushes.every(({ args }) => !args.includes("--force") && !args.includes("-f")), true);
  assert.equal(runner.calls.filter(({ args }) => args[0] === "fetch").length, 1);
});

test("text conflicts are reported separately from ordinary Git failures", async () => {
  const fixture = await worktreeFixture();
  const runner = new ScriptedRunner((args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok();
    if (args[0] === "remote" && args[1] === "get-url") return ok("https://github.com/example/project.git\n");
    if (args[0] === "rev-parse" && args[1] === "--verify") return ok("abc123\n");
    if (args[0] === "merge") return fail("CONFLICT (content): Merge conflict in .task-sync/tasks/task-1/task.yaml");
    if (args[0] === "diff") return ok(".task-sync/tasks/task-1/task.yaml\n");
    return baseScript(args);
  });
  const port = new FileGitSyncPort({ repoRoot: fixture.repoRoot, worktreePath: fixture.worktreePath, runner });
  await assert.rejects(port.pull(), GitTextConflictError);
});

test("stale locks can be reclaimed while active locks are rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-lock-"));
  const lockPath = join(root, "nested", "sync.lock");
  const staleNow = 2_000;
  await mkdir(join(root, "nested"), { recursive: true });
  await writeFile(lockPath, JSON.stringify({ pid: 1, deviceId: "old", createdAt: 0, expiresAt: 1_000 }));
  let ran = false;
  await withSyncLock({ lockPath, deviceId: "new", ttlMs: 10_000, now: () => staleNow }, async () => { ran = true; });
  assert.equal(ran, true);
  await assert.rejects(
    withSyncLock({ lockPath, deviceId: "active", ttlMs: 10_000, now: () => staleNow }, async () => {
      await withSyncLock({ lockPath, deviceId: "nested", ttlMs: 10_000, now: () => staleNow }, async () => undefined);
    }),
    /sync lock/
  );
});
