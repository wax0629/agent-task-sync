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
    const tasks = this.reduceTasks(events);
    const sync = await this.dependencies.sync.inspect();
    return { project, tasks, sync };
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
    const payload: HandoffAcceptedPayload = { handoffId: input.handoffId };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "handoff_accepted", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async rebuild(taskId?: string): Promise<RebuildResult> {
    if (taskId) return { taskIds: [taskId], states: [await this.rebuildOne(taskId)] };
    const project = await this.dependencies.registry.current();
    const events = await this.dependencies.events.readProjectEvents(project?.projectId);
    const taskIds = [...new Set(events.map((event) => event.taskId))].sort();
    const states = await Promise.all(taskIds.map((id) => this.rebuildOne(id)));
    return { taskIds, states };
  }

  async sync(): Promise<SyncResult> {
    const inspection = await this.dependencies.sync.inspect();
    const pull = await this.dependencies.sync.pull();
    const rebuilt = await this.rebuild();
    const push = await this.dependencies.sync.push();
    return { inspection, pull, push, rebuilt };
  }

  async getContext(taskId: string): Promise<ContinuationContext> {
    const events = await this.dependencies.events.readTaskEvents(taskId);
    const task = this.reduceOne(events);
    const documents = this.dependencies.renderer.render(task, events);
    const sync = await this.dependencies.sync.inspect();
    return {
      task,
      markdown: documents.taskPlan,
      source: "events",
      warning: sync.remoteAhead ? "Remote state is ahead; run task-sync sync before writing." : undefined
    };
  }

  private async rebuildOne(taskId: string): Promise<TaskState> {
    const events = await this.dependencies.events.readTaskEvents(taskId);
    const state = this.reduceOne(events);
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
