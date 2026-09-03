import { mkdir, readdir, readFile, rmdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PullResult, PushResult, SyncInspection, SyncPort } from "@agent-task-sync/application";
import type { ProjectInfo } from "@agent-task-sync/application";
import { ExecFileGitRunner, type GitCommandResult, type GitRunner } from "./git-runner.js";
import { GitSyncError, GitTextConflictError, NoRemoteError } from "./errors.js";
import { withSyncLock } from "./lock.js";
import { DEFAULT_STATE_BRANCH, defaultWorktreePath, repoIdFromRemote, stateDirectory } from "./paths.js";

export interface GitSyncOptions {
  repoRoot: string;
  project?: Pick<ProjectInfo, "remoteUrl" | "defaultBranch">;
  repoId?: string;
  stateBranch?: string;
  worktreePath?: string;
  remoteName?: string;
  deviceId?: string;
  maxRetries?: number;
  lockTtlMs?: number;
  runner?: GitRunner;
  now?: () => string;
}

export interface GitSyncStatus extends SyncInspection {
  repoId: string;
  stateBranch: string;
  worktreePath: string;
  stateDirectory: string;
}

export interface GitSyncPort extends SyncPort {
  readonly repoId: string;
  readonly stateBranch: string;
  readonly worktreePath: string;
  readonly stateDirectory: string;
  initialize(): Promise<void>;
  fetch(): Promise<void>;
  status(): Promise<GitSyncStatus>;
  sync(): Promise<GitSyncStatus>;
}

export class FileGitSyncPort implements GitSyncPort {
  readonly repoId: string;
  readonly stateBranch: string;
  readonly worktreePath: string;
  readonly stateDirectory: string;
  private readonly runner: GitRunner;
  private readonly remoteName: string;
  private readonly defaultBranch: string;
  private readonly deviceId: string;
  private readonly maxRetries: number;
  private readonly lockTtlMs: number;
  private readonly now: () => string;
  private lastSyncedAt?: string;

  constructor(private readonly options: GitSyncOptions) {
    this.runner = options.runner ?? new ExecFileGitRunner();
    this.remoteName = options.remoteName ?? "origin";
    this.defaultBranch = options.project?.defaultBranch ?? "main";
    this.repoId = options.repoId ?? repoIdFromRemote(options.project?.remoteUrl, options.repoRoot);
    this.stateBranch = options.stateBranch ?? DEFAULT_STATE_BRANCH;
    this.worktreePath = options.worktreePath ?? defaultWorktreePath(this.repoId);
    this.stateDirectory = stateDirectory(this.worktreePath);
    this.deviceId = options.deviceId ?? process.env.TASK_SYNC_DEVICE_ID ?? "unknown-device";
    this.maxRetries = Math.max(0, options.maxRetries ?? 1);
    this.lockTtlMs = Math.max(1_000, options.lockTtlMs ?? 30_000);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<void> {
    await withSyncLock(this.lockOptions(), () => this.initializeUnlocked());
  }

  async fetch(): Promise<void> {
    await withSyncLock(this.lockOptions(), () => this.fetchUnlocked());
  }

  async inspect(): Promise<SyncInspection> {
    return this.status();
  }

  async status(): Promise<GitSyncStatus> {
    await this.initializeUnlocked();
    const localEventCount = await countEventLines(this.stateDirectory);
    const remote = await this.remoteAvailable();
    let localAhead = false;
    let remoteAhead = false;
    if (remote) {
      const comparison = await this.run(["rev-list", "--left-right", "--count", `${this.stateBranch}...${this.remoteName}/${this.stateBranch}`], this.worktreePath, "status");
      if (comparison.exitCode === 0) {
        const [left, right] = comparison.stdout.trim().split(/\s+/).map((value) => Number(value));
        localAhead = left > 0;
        remoteAhead = right > 0;
      }
    }
    const conflict = await this.hasTextConflict();
    return {
      localEventCount,
      remoteEventCount: undefined,
      localAhead,
      remoteAhead,
      conflict,
      lastSyncedAt: this.lastSyncedAt,
      repoId: this.repoId,
      stateBranch: this.stateBranch,
      worktreePath: this.worktreePath,
      stateDirectory: this.stateDirectory
    };
  }

  async pull(): Promise<PullResult> {
    return withSyncLock(this.lockOptions(), () => this.pullUnlocked());
  }

  async push(): Promise<PushResult> {
    return withSyncLock(this.lockOptions(), () => this.pushUnlocked());
  }

  async sync(): Promise<GitSyncStatus> {
    return withSyncLock(this.lockOptions(), async () => {
      await this.pullUnlocked();
      await this.pushUnlocked();
      return this.statusUnlocked();
    });
  }

  private async initializeUnlocked(): Promise<void> {
    const topLevel = await this.run(["rev-parse", "--show-toplevel"], this.options.repoRoot, "initialize");
    this.assertSuccess(topLevel, "initialize", ["rev-parse", "--show-toplevel"]);
    const existing = await stat(join(this.worktreePath, ".git")).catch(() => undefined);
    if (existing) return;
    const worktree = await stat(this.worktreePath).catch(() => undefined);
    if (worktree) {
      const entries = await readdir(this.worktreePath);
      if (entries.length > 0) {
        throw new GitSyncError(`State worktree path exists and is not a Git worktree: ${this.worktreePath}`, "initialize", [this.worktreePath]);
      }
      await rmdir(this.worktreePath);
    }
    await mkdir(dirname(this.worktreePath), { recursive: true });
    const branchExists = await this.run(["show-ref", "--verify", "--quiet", `refs/heads/${this.stateBranch}`], this.options.repoRoot, "initialize");
    const args = branchExists.exitCode === 0
      ? ["worktree", "add", this.worktreePath, this.stateBranch]
      : ["worktree", "add", "-b", this.stateBranch, this.worktreePath, this.defaultBranch];
    const added = await this.run(args, this.options.repoRoot, "initialize");
    this.assertSuccess(added, "initialize", args);
  }

  private async fetchUnlocked(): Promise<void> {
    await this.initializeUnlocked();
    await this.requireRemote("fetch");
    const result = await this.run(["fetch", "--prune", this.remoteName], this.options.repoRoot, "fetch");
    this.assertSuccess(result, "fetch", ["fetch", "--prune", this.remoteName]);
  }

  private async pullUnlocked(): Promise<PullResult> {
    await this.initializeUnlocked();
    const before = await countEventLines(this.stateDirectory);
    if (await this.remoteAvailable()) {
      await this.fetchUnlocked();
      const remoteRef = `${this.remoteName}/${this.stateBranch}`;
      const remoteBranch = await this.run(["rev-parse", "--verify", remoteRef], this.worktreePath, "pull");
      if (remoteBranch.exitCode === 0) {
        const merge = await this.run(["merge", "--no-edit", remoteRef], this.worktreePath, "pull");
        if (merge.exitCode !== 0) {
          if (await this.hasTextConflict()) throw new GitTextConflictError("pull", merge.stderr);
          this.assertSuccess(merge, "pull", ["merge", "--no-edit", remoteRef]);
        }
      }
    }
    const after = await countEventLines(this.stateDirectory);
    this.lastSyncedAt = this.now();
    return { pulledEventCount: Math.max(0, after - before), changed: after !== before };
  }

  private async pushUnlocked(): Promise<PushResult> {
    await this.initializeUnlocked();
    await this.requireRemote("push");
    let pushedEventCount = 0;
    let changed = false;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const before = await countEventLines(this.stateDirectory);
      const status = await this.run(["status", "--porcelain", "--", ".task-sync"], this.worktreePath, "push");
      this.assertSuccess(status, "push", ["status", "--porcelain", "--", ".task-sync"]);
      if (status.stdout.trim()) {
        changed = true;
        const add = await this.run(["add", "--", ".task-sync"], this.worktreePath, "push");
        this.assertSuccess(add, "push", ["add", "--", ".task-sync"]);
        const commit = await this.run(["commit", "-m", "chore(task-sync): update task state"], this.worktreePath, "push");
        this.assertSuccess(commit, "push", ["commit", "-m", "chore(task-sync): update task state"]);
      }
      const args = ["push", this.remoteName, `HEAD:refs/heads/${this.stateBranch}`];
      const pushed = await this.run(args, this.worktreePath, "push");
      if (pushed.exitCode === 0) {
        const after = await countEventLines(this.stateDirectory);
        pushedEventCount = Math.max(0, after - before);
        this.lastSyncedAt = this.now();
        return { pushedEventCount, changed };
      }
      const nonFastForward = /non-fast-forward|fetch first|rejected/i.test(`${pushed.stderr}\n${pushed.stdout}`);
      if (!nonFastForward || attempt >= this.maxRetries) this.assertSuccess(pushed, "push", args);
      await this.pullUnlocked();
    }
    throw new GitSyncError("Git push retry limit reached.", "push");
  }

  private async statusUnlocked(): Promise<GitSyncStatus> {
    const localEventCount = await countEventLines(this.stateDirectory);
    const remote = await this.remoteAvailable();
    let localAhead = false;
    let remoteAhead = false;
    if (remote) {
      const comparison = await this.run(["rev-list", "--left-right", "--count", `${this.stateBranch}...${this.remoteName}/${this.stateBranch}`], this.worktreePath, "status");
      if (comparison.exitCode === 0) {
        const [left, right] = comparison.stdout.trim().split(/\s+/).map((value) => Number(value));
        localAhead = left > 0;
        remoteAhead = right > 0;
      }
    }
    return {
      localEventCount,
      localAhead,
      remoteAhead,
      conflict: await this.hasTextConflict(),
      lastSyncedAt: this.lastSyncedAt,
      repoId: this.repoId,
      stateBranch: this.stateBranch,
      worktreePath: this.worktreePath,
      stateDirectory: this.stateDirectory
    };
  }

  private async remoteAvailable(): Promise<boolean> {
    const result = await this.run(["remote", "get-url", this.remoteName], this.options.repoRoot, "remote");
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  }

  private async requireRemote(operation: string): Promise<void> {
    if (!(await this.remoteAvailable())) throw new NoRemoteError(operation);
  }

  private async hasTextConflict(): Promise<boolean> {
    const result = await this.run(["diff", "--name-only", "--diff-filter=U"], this.worktreePath, "status");
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  }

  private lockOptions() {
    return {
      // Keep the lock beside the target so creating it does not make an
      // otherwise-empty worktree path look occupied to `git worktree add`.
      lockPath: `${this.worktreePath}.lock`,
      deviceId: this.deviceId,
      ttlMs: this.lockTtlMs,
      now: () => Date.parse(this.now())
    };
  }

  private async run(args: readonly string[], cwd: string, operation: string): Promise<GitCommandResult> {
    return this.runner.run(args, cwd).catch((error) => {
      throw new GitSyncError(`Git ${operation} could not start: ${(error as Error).message}`, operation, args);
    });
  }

  private assertSuccess(result: GitCommandResult, operation: string, args: readonly string[]): void {
    if (result.exitCode !== 0) {
      throw new GitSyncError(`Git ${operation} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`, operation, args, result.exitCode, result.stderr);
    }
  }
}

async function countEventLines(root: string): Promise<number> {
  let count = 0;
  for (const file of await jsonlFiles(root)) {
    const content = await readFile(file, "utf8");
    count += content.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim()).length;
  }
  return count;
}

async function jsonlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await jsonlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
  }
  return files;
}
