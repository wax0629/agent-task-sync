import type { PullResult, PushResult, SyncInspection, SyncPort } from "@agent-task-sync/application";

export class MockSyncPort implements SyncPort {
  constructor(private readonly inspection: SyncInspection = { localEventCount: 0, localAhead: false, remoteAhead: false, conflict: false }) {}

  async inspect(): Promise<SyncInspection> {
    return { ...this.inspection };
  }

  async pull(): Promise<PullResult> {
    return { pulledEventCount: 0, changed: false };
  }

  async push(): Promise<PushResult> {
    return { pushedEventCount: 0, changed: false };
  }
}
