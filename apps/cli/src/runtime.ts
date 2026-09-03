import { access } from "node:fs/promises";
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
  metadata: RuntimeMetadata;
  registry: FileProjectRegistry;
}

export type RuntimeMode = "git-worktree" | "mock";

export interface RuntimeMetadata {
  mode: RuntimeMode;
  isGitRepository: boolean;
  remoteConfigured: boolean;
  remoteUrl?: string;
  defaultBranch?: string;
  stateBranch?: string;
  worktreePath?: string;
  stateDirectory: string;
}

export interface DoctorCheck {
  id: "project" | "state-directory" | "git" | "remote";
  status: "passed" | "warning" | "failed";
  message: string;
  nextStep?: string;
}

export interface DoctorReport {
  ok: boolean;
  initialized: boolean;
  root: string;
  mode: RuntimeMode;
  project?: {
    projectId: string;
    name: string;
    defaultBranch?: string;
    remoteConfigured: boolean;
  };
  state: {
    stateDirectory: string;
    worktreePath?: string;
    stateBranch?: string;
  };
  checks: DoctorCheck[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function inspectRuntime(runtime: CliRuntime): Promise<DoctorReport> {
  let project: ProjectInfo | undefined;
  let projectError: string | undefined;
  try {
    project = await runtime.registry.current();
  } catch (error) {
    projectError = error instanceof Error ? error.message : String(error);
  }
  const stateDirectoryExists = await pathExists(runtime.root);
  const worktreePathExists = runtime.metadata.worktreePath
    ? await pathExists(runtime.metadata.worktreePath)
    : false;
  const worktreeMetadataExists = runtime.metadata.worktreePath
    ? await pathExists(join(runtime.metadata.worktreePath, ".git"))
    : false;
  const checks: DoctorCheck[] = [
    projectError
      ? { id: "project", status: "failed", message: `项目清单无法读取：${projectError}`, nextStep: "检查状态目录中的 project.yaml，必要时备份后重新初始化。" }
      : project
      ? { id: "project", status: "passed", message: `项目已初始化：${project.name}（${project.projectId}）。` }
      : { id: "project", status: "failed", message: "项目尚未初始化。", nextStep: "运行 task-sync init [project-id] [project-name]。" },
    stateDirectoryExists
      ? { id: "state-directory", status: "passed", message: `状态目录可读：${runtime.root}。` }
      : { id: "state-directory", status: "warning", message: `状态目录尚未创建：${runtime.root}。`, nextStep: "初始化项目后再次运行 task-sync doctor。" },
    runtime.metadata.isGitRepository
      ? {
        id: "git",
        status: worktreeMetadataExists ? "passed" : worktreePathExists ? "failed" : "warning",
        message: worktreeMetadataExists
          ? "Git 状态 worktree 已存在。"
          : worktreePathExists
            ? "Git 项目已识别，但状态 worktree 路径不是有效 worktree。"
            : "Git 项目已识别，但状态 worktree 尚未创建。",
        nextStep: worktreeMetadataExists ? undefined : worktreePathExists ? "备份并移走冲突目录后再次运行 task-sync init。" : "运行 task-sync init 以创建隔离状态 worktree。"
      }
      : { id: "git", status: "warning", message: "当前目录不是 Git 仓库，使用本地 mock/offline 状态。", nextStep: "跨设备同步前请在 Git 仓库中运行 task-sync init。" },
    runtime.metadata.remoteConfigured
      ? { id: "remote", status: "passed", message: "已配置 Git remote，可进行跨设备同步。" }
      : { id: "remote", status: "warning", message: "未检测到 Git remote；本地读写仍可用，跨设备同步不可用。", nextStep: "为代码仓库配置 origin，或继续使用本地 offline 模式。" }
  ];

  return {
    ok: Boolean(project) && !projectError,
    initialized: Boolean(project),
    root: runtime.root,
    mode: runtime.metadata.mode,
    project: project
      ? {
        projectId: project.projectId,
        name: project.name,
        defaultBranch: project.defaultBranch,
        remoteConfigured: Boolean(project.remoteUrl)
      }
      : undefined,
    state: {
      stateDirectory: runtime.metadata.stateDirectory,
      worktreePath: runtime.metadata.worktreePath,
      stateBranch: runtime.metadata.stateBranch
    },
    checks
  };
}

export function createRuntime(cwd = process.cwd()) {
  const explicitStateRoot = process.env.TASK_SYNC_STATE_DIR;
  const useGitSync = !explicitStateRoot && isGitRepository(cwd);
  const discovered = useGitSync ? discoveredProject(cwd) : undefined;
  const sync: CliRuntime["sync"] = useGitSync
    ? new FileGitSyncPort({
      repoRoot: cwd,
      project: discovered,
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
    metadata: {
      mode: useGitSync ? "git-worktree" : "mock",
      isGitRepository: useGitSync,
      remoteConfigured: Boolean(discovered?.remoteUrl),
      remoteUrl: discovered?.remoteUrl,
      defaultBranch: discovered?.defaultBranch,
      stateBranch: useGitSync ? (sync as GitSyncPort).stateBranch : undefined,
      worktreePath: useGitSync ? (sync as GitSyncPort).worktreePath : undefined,
      stateDirectory: root
    } satisfies RuntimeMetadata,
    registry,
    actor: (): Actor => ({
      agentId: process.env.TASK_SYNC_AGENT_ID ?? "human",
      deviceId: process.env.TASK_SYNC_DEVICE_ID ?? homedir().split(/[\\/]/).pop() ?? "unknown-device",
      sessionId: process.env.TASK_SYNC_SESSION_ID ?? `cli-${process.pid}`,
      confirmed: true
    })
  } satisfies CliRuntime;
}
