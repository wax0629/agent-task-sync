import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { ApplicationService, type Actor, type ProjectInfo, type SyncPort } from "@agent-task-sync/application";
import { FileProjectRegistry } from "@agent-task-sync/project-registry";
import { MarkdownTaskRenderer } from "@agent-task-sync/renderer-markdown";
import { FileEventStore, FileProjectionStore } from "@agent-task-sync/store-files";
import { FileGitSyncPort, MockSyncPort, type GitSyncPort } from "@agent-task-sync/sync-git";

export function stateRoot(cwd = process.cwd()): string {
  return resolve(process.env.TASK_SYNC_STATE_DIR ?? join(cwd, ".task-sync"));
}

function gitValue(args: readonly string[], cwd: string): string | undefined {
  try {
    const value = execFileSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function isGitRepository(cwd: string): boolean {
  return Boolean(gitValue(["rev-parse", "--show-toplevel"], cwd));
}

function discoveredProject(cwd: string): Pick<ProjectInfo, "remoteUrl" | "defaultBranch"> {
  return {
    remoteUrl: gitValue(["remote", "get-url", process.env.TASK_SYNC_REMOTE_NAME ?? "origin"], cwd),
    defaultBranch: process.env.TASK_SYNC_DEFAULT_BRANCH ?? gitValue(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd)?.replace(/^origin\//, "") ?? "main"
  };
}

export interface CliRuntime {
  root: string;
  app: ApplicationService;
  sync: SyncPort & Partial<Pick<GitSyncPort, "initialize" | "fetch" | "status" | "sync">>;
  actor: () => Actor;
}

export function createRuntime(cwd = process.cwd()) {
  const explicitStateRoot = process.env.TASK_SYNC_STATE_DIR;
  const useGitSync = !explicitStateRoot && isGitRepository(cwd);
  const sync: CliRuntime["sync"] = useGitSync
    ? new FileGitSyncPort({
      repoRoot: cwd,
      project: discoveredProject(cwd),
      worktreePath: process.env.TASK_SYNC_WORKTREE_PATH,
      stateBranch: process.env.TASK_SYNC_STATE_BRANCH,
      remoteName: process.env.TASK_SYNC_REMOTE_NAME,
      repoId: process.env.TASK_SYNC_REPO_ID,
      deviceId: process.env.TASK_SYNC_DEVICE_ID
    })
    : new MockSyncPort();
  const root = useGitSync ? (sync as GitSyncPort).stateDirectory : stateRoot(cwd);
  const events = new FileEventStore(root);
  const registry = new FileProjectRegistry(root);
  return {
    root,
    sync,
    app: new ApplicationService({
      events,
      projections: new FileProjectionStore(root),
      renderer: new MarkdownTaskRenderer(),
      registry,
      sync
    }),
    actor: (): Actor => ({
      agentId: process.env.TASK_SYNC_AGENT_ID ?? "human",
      deviceId: process.env.TASK_SYNC_DEVICE_ID ?? homedir().split(/[\\/]/).pop() ?? "unknown-device",
      sessionId: process.env.TASK_SYNC_SESSION_ID ?? `cli-${process.pid}`,
      confirmed: true
    })
  } satisfies CliRuntime;
}
