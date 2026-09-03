import {
  reduceTaskEvents,
  type CheckpointRecordedPayload,
  type ConflictResolvedPayload,
  type EventPayload,
  type HandoffAcceptedPayload,
  type HandoffCreatedPayload,
  type TaskClaimedPayload,
  type TaskCreatedPayload,
  type TaskEvent,
  type TaskState
} from "@agent-task-sync/domain";
import type {
  AcceptHandoffInput,
  Actor,
  CheckpointInput,
  ClaimTaskInput,
  ContinuationContext,
  CreateTaskInput,
  EventStore,
  HandoffInput,
  InitProjectInput,
  MarkdownRenderer,
  ProjectInfo,
  ProjectRegistry,
  ProjectStatus,
  ProjectionStore,
  RebuildResult,
  RenderedDocuments,
  SyncInspection,
  SyncPort,
  SyncResult,
  TaskSyncService
} from "./ports.js";

export interface ApplicationDependencies {
  events: EventStore;
  projections: ProjectionStore;
  renderer: MarkdownRenderer;
  registry: ProjectRegistry;
  sync: SyncPort;
  now?: () => string;
  eventId?: () => string;
}

export class ConfirmationRequiredError extends Error {
  constructor() {
    super("This write requires explicit confirmation.");
    this.name = "ConfirmationRequiredError";
  }
}

export class HandoffNotFoundError extends Error {
  constructor(taskId: string, handoffId: string) {
    super(`Handoff ${handoffId} does not exist for task ${taskId}.`);
    this.name = "HandoffNotFoundError";
  }
}

export class HandoffAlreadyExistsError extends Error {
  constructor(taskId: string, handoffId: string) {
    super(`Handoff ${handoffId} already exists for task ${taskId}.`);
    this.name = "HandoffAlreadyExistsError";
  }
}

export class ApplicationService implements TaskSyncService {
  private readonly now: () => string;
  private readonly eventId: () => string;

  constructor(private readonly dependencies: ApplicationDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.eventId = dependencies.eventId ?? (() => globalThis.crypto?.randomUUID() ?? `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  async init(input: InitProjectInput): Promise<ProjectInfo> {
    return this.dependencies.registry.init(input);
  }

  async status(): Promise<ProjectStatus> {
    const project = await this.dependencies.registry.current();
    const events = await this.dependencies.events.readProjectEvents(project?.projectId);
    const sync = await this.dependencies.sync.inspect();
    const tasks = this.reduceTasks(events).map((state) => this.withSyncSummary(state, sync));
    const semanticConflict = tasks.some((state) => state.conflicts.some((conflict) => !conflict.resolved));
    if (semanticConflict) {
      for (const task of tasks) {
        if (task.conflicts.some((conflict) => !conflict.resolved)) task.sync.conflict = true;
      }
    }
    return { project, tasks, sync: semanticConflict ? { ...sync, conflict: true } : sync };
  }

  async createTask(input: CreateTaskInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const payload: TaskCreatedPayload = {
      title: input.title,
      goal: input.goal,
      background: input.background,
      acceptanceCriteria: input.acceptanceCriteria,
      phases: input.phases,
      status: input.status
    };
    const event = this.makeEvent(input.projectId, input.taskId, "task_created", payload, actor, []);
    await this.dependencies.events.append(event);
    return this.rebuildOne(input.taskId);
  }

  async claimTask(input: ClaimTaskInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: TaskClaimedPayload = {
      agentId: actor.agentId,
      deviceId: actor.deviceId,
      sessionId: actor.sessionId,
      phaseId: input.phaseId,
      released: input.released
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "task_claimed", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async recordCheckpoint(input: CheckpointInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: CheckpointRecordedPayload = {
      summary: input.summary,
      currentFocus: input.currentFocus,
      recentCompleted: input.recentCompleted,
      nextAction: input.nextAction,
      filesChanged: input.filesChanged,
      commit: input.commit,
      verification: input.verification,
      uncommittedChanges: input.uncommittedChanges,
      status: input.status
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "checkpoint_recorded", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async createHandoff(input: HandoffInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const existingHandoffIds = events
      .filter((event) => event.type === "handoff_created")
      .map((event) => {
        const payload = event.payload as HandoffCreatedPayload;
        return payload.handoffId ?? `handoff-${event.eventId}`;
      });
    if (input.handoffId && existingHandoffIds.includes(input.handoffId)) {
      throw new HandoffAlreadyExistsError(input.taskId, input.handoffId);
    }
    const payload: HandoffCreatedPayload = {
      handoffId: input.handoffId,
      completedWork: input.completedWork,
      incompleteWork: input.incompleteWork,
      keyDecisions: input.keyDecisions,
      knownErrors: input.knownErrors,
      nextStep: input.nextStep,
      relevantFiles: input.relevantFiles,
      testSummary: input.testSummary,
      targetAgent: input.targetAgent
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "handoff_created", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async acceptHandoff(input: AcceptHandoffInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    if (!current.handoff || current.handoff.id !== input.handoffId) {
      throw new HandoffNotFoundError(input.taskId, input.handoffId);
    }
    // Accepting the same handoff twice is a safe retry, not a second state transition.
    if (current.handoff.acceptedAt) return this.rebuildOne(input.taskId);
    const payload: HandoffAcceptedPayload = { handoffId: input.handoffId };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "handoff_accepted", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async rebuild(taskId?: string): Promise<RebuildResult> {
    return this.rebuildInternal(taskId);
  }

  private async rebuildInternal(taskId?: string, inspection?: SyncInspection): Promise<RebuildResult> {
    if (taskId) return { taskIds: [taskId], states: [await this.rebuildOne(taskId, inspection)] };
    const project = await this.dependencies.registry.current();
    const events = await this.dependencies.events.readProjectEvents(project?.projectId);
    const taskIds = [...new Set(events.map((event) => event.taskId))].sort();
    const states = await Promise.all(taskIds.map((id) => this.rebuildOne(id, inspection)));
    return { taskIds, states };
  }

  async sync(): Promise<SyncResult> {
    const inspection = await this.dependencies.sync.inspect();
    const pull = await this.dependencies.sync.pull();
    const rebuilt = await this.rebuildInternal(undefined, inspection);
    const push = await this.dependencies.sync.push();
    const semanticConflict = rebuilt.states.some((state) => state.conflicts.some((conflict) => !conflict.resolved));
    return { inspection: semanticConflict ? { ...inspection, conflict: true } : inspection, pull, push, rebuilt };
  }

  async getContext(taskId: string): Promise<ContinuationContext> {
    const events = await this.dependencies.events.readTaskEvents(taskId);
    const task = this.reduceOne(events);
    const sync = await this.dependencies.sync.inspect();
    this.withSyncSummary(task, sync);
    const rendered = this.dependencies.renderer.render(task, events);
    const warnings = [
      sync.remoteAhead ? "远程有更新，请先运行 task-sync sync。" : undefined,
      sync.localAhead && task.sync.unsyncedEventCount > 0 ? `本地有 ${task.sync.unsyncedEventCount} 条事件尚未同步。` : undefined,
      sync.conflict || task.conflicts.some((conflict) => !conflict.resolved) ? "同步存在冲突，请先审阅后再继续。" : undefined
    ].filter((value): value is string => Boolean(value));
    return {
      task,
      markdown: rendered.taskPlan,
      source: "events",
      warning: warnings.length ? warnings.join("\n") : undefined
    };
  }

  private async rebuildOne(taskId: string, inspection?: SyncInspection): Promise<TaskState> {
    const events = await this.dependencies.events.readTaskEvents(taskId);
    const state = this.reduceOne(events);
    this.withSyncSummary(state, inspection ?? await this.dependencies.sync.inspect());
    const documents = this.dependencies.renderer.render(state, events);
    await this.dependencies.projections.writeTaskState(state);
    await this.dependencies.projections.writeMarkdown(taskId, documents);
    return state;
  }

  private reduceTasks(events: readonly TaskEvent[]): TaskState[] {
    const taskIds = [...new Set(events.map((event) => event.taskId))].sort();
    return taskIds.map((taskId) => this.reduceOne(events.filter((event) => event.taskId === taskId)));
  }

  private reduceOne(events: readonly TaskEvent[]): TaskState {
    if (events.length === 0) throw new Error("Task has no events.");
    return reduceTaskEvents(events).state;
  }

  private withSyncSummary(state: TaskState, inspection: SyncInspection): TaskState {
    const remoteEventCount = inspection.remoteEventCount;
    const unsyncedEventCount = inspection.localAhead
      ? remoteEventCount === undefined
        ? Math.max(0, inspection.localEventCount)
        : Math.max(0, inspection.localEventCount - remoteEventCount)
      : 0;
    state.sync = {
      unsyncedEventCount,
      localAhead: inspection.localAhead,
      remoteAhead: inspection.remoteAhead,
      conflict: inspection.conflict,
      ...(inspection.lastSyncedAt ? { lastSyncedAt: inspection.lastSyncedAt } : {})
    };
    return state;
  }

  private makeEvent<TPayload extends EventPayload>(
    projectId: string,
    taskId: string,
    type: TaskEvent["type"],
    payload: TPayload,
    actor: Actor,
    parentEventIds: string[]
  ): TaskEvent<TPayload> {
    return {
      eventId: this.eventId(),
      schemaVersion: 1,
      projectId,
      taskId,
      type,
      payload,
      parentEventIds,
      writer: {
        agentId: actor.agentId,
        deviceId: actor.deviceId,
        sessionId: actor.sessionId
      },
      createdAt: this.now()
    };
  }

  private heads(events: readonly TaskEvent[]): string[] {
    const referenced = new Set(events.flatMap((event) => event.parentEventIds));
    return events.map((event) => event.eventId).filter((id) => !referenced.has(id)).sort();
  }

  private requireConfirmation(confirmed: boolean | undefined): void {
    if (!confirmed) throw new ConfirmationRequiredError();
  }
}
