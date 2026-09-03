export class GitSyncError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly args: readonly string[] = [],
    readonly exitCode?: number,
    readonly stderr?: string
  ) {
    super(message);
    this.name = "GitSyncError";
  }
}

export class NoRemoteError extends GitSyncError {
  constructor(operation = "remote") {
    super("No Git remote is configured; state remains local and cannot be pushed.", operation);
    this.name = "NoRemoteError";
  }
}

export class SyncLockError extends GitSyncError {
  constructor(lockPath: string) {
    super(`Another task-sync process holds the sync lock: ${lockPath}`, "lock", [lockPath]);
    this.name = "SyncLockError";
  }
}

export class GitTextConflictError extends GitSyncError {
  constructor(operation: string, stderr?: string) {
    super("Git reported a text conflict while synchronizing task state.", operation, [], undefined, stderr);
    this.name = "GitTextConflictError";
  }
}
