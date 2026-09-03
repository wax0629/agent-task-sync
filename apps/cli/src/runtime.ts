import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ApplicationService, type Actor } from "@agent-task-sync/application";
import { FileProjectRegistry } from "@agent-task-sync/project-registry";
import { MarkdownTaskRenderer } from "@agent-task-sync/renderer-markdown";
import { FileEventStore, FileProjectionStore } from "@agent-task-sync/store-files";
import { MockSyncPort } from "@agent-task-sync/sync-git";

export function stateRoot(cwd = process.cwd()): string {
  return resolve(process.env.TASK_SYNC_STATE_DIR ?? join(cwd, ".task-sync"));
}

export function createRuntime(cwd = process.cwd()) {
  const root = stateRoot(cwd);
  const events = new FileEventStore(root);
  return {
    root,
    app: new ApplicationService({
      events,
      projections: new FileProjectionStore(root),
      renderer: new MarkdownTaskRenderer(),
      registry: new FileProjectRegistry(root),
      sync: new MockSyncPort()
    }),
    actor: (): Actor => ({
      agentId: process.env.TASK_SYNC_AGENT_ID ?? "human",
      deviceId: process.env.TASK_SYNC_DEVICE_ID ?? homedir().split(/[\\/]/).pop() ?? "unknown-device",
      sessionId: process.env.TASK_SYNC_SESSION_ID ?? `cli-${process.pid}`,
      confirmed: true
    })
  };
}
