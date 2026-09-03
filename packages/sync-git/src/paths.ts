import { createHash } from "node:crypto";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_STATE_BRANCH = "task-sync/state";

export interface StatePathOptions {
  homeDirectory?: string;
  platformName?: NodeJS.Platform;
  appDataDirectory?: string;
}

export function normalizeRemote(remoteUrl: string): string {
  const value = remoteUrl.trim().replace(/\\/g, "/").replace(/\/+$/, "").replace(/\.git$/, "");
  if (value.startsWith("git@")) {
    const separator = value.indexOf(":");
    if (separator > 4) return `${value.slice(4, separator)}/${value.slice(separator + 1)}`.toLowerCase();
  }
  return value.replace(/^https?:\/\//, "").replace(/^ssh:\/\//, "").replace(/^git:\/\//, "").toLowerCase();
}

export function repoIdFromRemote(remoteUrl: string | undefined, repoRoot: string): string {
  const identity = remoteUrl ? normalizeRemote(remoteUrl) : resolve(repoRoot);
  return createHash("sha256").update(identity).digest("hex").slice(0, 20);
}

export function defaultWorktreePath(repoId: string, options: StatePathOptions = {}): string {
  const currentPlatform = options.platformName ?? platform();
  const home = options.homeDirectory ?? homedir();
  const root = options.appDataDirectory
    ?? (currentPlatform === "win32"
      ? process.env.LOCALAPPDATA ?? join(home, "AppData", "Local")
      : currentPlatform === "darwin"
        ? join(home, "Library", "Application Support")
        : process.env.XDG_DATA_HOME ?? join(home, ".local", "share"));
  return join(root, "agent-task-sync", "projects", repoId, "state-worktree");
}

export function stateDirectory(worktreePath: string): string {
  return join(worktreePath, ".task-sync");
}
