import {
  reduceTaskEvents,
  type CheckpointRecordedPayload,
  type ConflictResolvedPayload,
  type EventPayload,
  type HandoffAcceptedPayload,
  type HandoffCreatedPayload,
  type DecisionRecordedPayload,
  type QuestionRecordedPayload,
  type ErrorRecordedPayload,
  type VerificationRecordedPayload,
  type TaskClaimedPayload,
  type TaskCreatedPayload,
  type TaskEvent,
  type TaskState,
  type TaskUpdatedPayload,
  type TaskBlockedPayload,
  type TaskCompletedPayload
} from "@agent-task-sync/domain";
import type {
  AcceptHandoffInput,
  Actor,
  BlockTaskInput,
  CheckpointInput,
  ClaimTaskInput,
  CompleteTaskInput,
  ContinuationContext,
  CreateTaskInput,
  DecisionInput,
  ErrorInput,
  EventStore,
  HandoffInput,
  InitProjectInput,
  MarkdownRenderer,
  ProjectInfo,
  ProjectActivity,
  ProjectOverview,
  ProjectTaskSummary,
  ProjectRegistry,
  ProjectStatus,
  ProjectionStore,
  QuestionInput,
  RebuildResult,
  RenderedDocuments,
  ResolveConflictInput,
  SyncInspection,
  SyncPort,
  SyncResult,
  UpdateTaskInput,
  VerificationInput,
  TaskSyncService
} from "./ports.js";

const taskStatuses: TaskState["status"][] = [
  "planned",
  "in_progress",
  "blocked",
  "needs_review",
  "handoff_ready",
  "completed",
  "archived"
];

function compact(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function activitySummary(event: TaskEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.summary === "string" && payload.summary.trim()) return compact(payload.summary, event.type);
  switch (event.type) {
    case "task_created":
      return `创建任务：${compact(payload.title, "未命名任务")}`;
    case "task_updated":
      return "更新任务信息";
    case "task_claimed":
      return payload.released ? "释放任务认领" : `认领任务：${compact(payload.agentId, event.writer.agentId)}`;
    case "checkpoint_recorded":
      return compact(payload.currentFocus, "记录 checkpoint");
    case "decision_recorded":
      return `记录决策：${compact(payload.decision, "未命名决策")}`;
    case "question_recorded":
      return `记录问题：${compact(payload.question, "未命名问题")}`;
    case "error_recorded":
      return `记录错误：${compact(payload.error, "未命名错误")}`;
    case "verification_recorded":
      return `验证：${compact(payload.command, "未命名命令")}（${compact(payload.status, "未记录状态")}）`;
    case "handoff_created":
      return `创建交接：${compact(payload.handoffId, `handoff-${event.eventId}`)}`;
    case "handoff_accepted":
      return `接受交接：${compact(payload.handoffId, "未命名交接")}`;
    case "task_blocked":
      return `任务阻塞：${compact(payload.reason, "未记录原因")}`;
    case "task_completed":
      return `任务完成：${compact(payload.summary, "未记录摘要")}`;
    case "conflict_resolved":
      return `解析冲突：${compact(payload.conflictId, "未命名冲突")}`;
    default:
      return event.type;
  }
}

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

export class ConflictNotFoundError extends Error {
  constructor(taskId: string, conflictId: string) {
    super(`Conflict ${conflictId} does not exist for task ${taskId}.`);
    this.name = "ConflictNotFoundError";
  }
}

export class InvalidConflictResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidConflictResolutionError";
  }
}

export class EmptyTaskUpdateError extends Error {
  constructor(taskId: string) {
    super(`Task update for ${taskId} must include at least one field.`);
    this.name = "EmptyTaskUpdateError";
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
    const effectiveSync = semanticConflict ? { ...sync, conflict: true } : sync;
    if (semanticConflict) {
      for (const task of tasks) {
        if (task.conflicts.some((conflict) => !conflict.resolved)) task.sync.conflict = true;
      }
    }
    return {
      project,
      tasks,
      sync: effectiveSync,
      overview: project ? this.buildProjectOverview(project, tasks, events, effectiveSync) : undefined
    };
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

  async updateTask(input: UpdateTaskInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: TaskUpdatedPayload = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.goal !== undefined) payload.goal = input.goal;
    if (input.background !== undefined) payload.background = input.background;
    if (input.acceptanceCriteria !== undefined) payload.acceptanceCriteria = input.acceptanceCriteria;
    if (input.status !== undefined) payload.status = input.status;
    if (input.currentFocus !== undefined) payload.currentFocus = input.currentFocus;
    if (input.recentCompleted !== undefined) payload.recentCompleted = input.recentCompleted;
    if (input.nextAction !== undefined) payload.nextAction = input.nextAction;
    if (input.phases !== undefined) payload.phases = input.phases;
    if (input.currentPhaseId !== undefined) payload.currentPhaseId = input.currentPhaseId;
    if (Object.keys(payload).length === 0) throw new EmptyTaskUpdateError(input.taskId);
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "task_updated", payload, actor, this.heads(events)));
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

  async blockTask(input: BlockTaskInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: TaskBlockedPayload = { reason: input.reason };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "task_blocked", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async completeTask(input: CompleteTaskInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: TaskCompletedPayload = { summary: input.summary };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "task_completed", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async recordDecision(input: DecisionInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: DecisionRecordedPayload = { decision: input.decision, reason: input.reason };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "decision_recorded", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async recordQuestion(input: QuestionInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: QuestionRecordedPayload = {
      question: input.question,
      resolved: input.resolved,
      answer: input.answer
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "question_recorded", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async recordError(input: ErrorInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: ErrorRecordedPayload = {
      error: input.error,
      attempts: input.attempts,
      resolved: input.resolved
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "error_recorded", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async recordVerification(input: VerificationInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const payload: VerificationRecordedPayload = {
      command: input.command,
      result: input.result,
      status: input.status
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "verification_recorded", payload, actor, this.heads(events)));
    return this.rebuildOne(input.taskId);
  }

  async resolveConflict(input: ResolveConflictInput, actor: Actor): Promise<TaskState> {
    this.requireConfirmation(input.confirmed ?? actor.confirmed);
    const events = await this.dependencies.events.readTaskEvents(input.taskId);
    const current = this.reduceOne(events);
    const conflict = current.conflicts.find((item) => item.id === input.conflictId);
    if (!conflict) throw new ConflictNotFoundError(input.taskId, input.conflictId);
    if (conflict.resolved) return this.rebuildOne(input.taskId);

    if (input.choice !== "keep_first" && input.choice !== "keep_last" && input.choice !== "merge") {
      throw new InvalidConflictResolutionError("Conflict choice must be keep_first, keep_last, or merge.");
    }
    if (!Array.isArray(input.resolvedEventIds) || input.resolvedEventIds.length === 0 || input.resolvedEventIds.some((id) => typeof id !== "string" || !id.trim())) {
      throw new InvalidConflictResolutionError("Conflict resolution must include every competing event ID.");
    }
    const expectedEventIds = [...conflict.eventIds].sort();
    const resolvedEventIds = [...input.resolvedEventIds].sort();
    if (new Set(resolvedEventIds).size !== resolvedEventIds.length || expectedEventIds.length !== resolvedEventIds.length || expectedEventIds.some((id, index) => id !== resolvedEventIds[index])) {
      throw new InvalidConflictResolutionError(`Conflict resolution must reference exactly these event IDs: ${expectedEventIds.join(", ")}.`);
    }
    if (input.status !== undefined && !["planned", "in_progress", "blocked", "needs_review", "handoff_ready", "completed", "archived"].includes(input.status)) {
      throw new InvalidConflictResolutionError(`Invalid task status override: ${String(input.status)}.`);
    }
    if (input.nextAction !== undefined && input.nextAction !== null && typeof input.nextAction !== "string") {
      throw new InvalidConflictResolutionError("Conflict nextAction override must be a string or null.");
    }
    if (input.summary !== undefined && typeof input.summary !== "string") {
      throw new InvalidConflictResolutionError("Conflict resolution summary must be a string.");
    }

    const payload: ConflictResolvedPayload = {
      conflictId: conflict.id,
      choice: input.choice,
      resolvedEventIds,
      summary: input.summary,
      status: input.status,
      nextAction: input.nextAction
    };
    await this.dependencies.events.append(this.makeEvent(current.projectId, input.taskId, "conflict_resolved", payload, actor, conflict.eventIds));
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
    const effectiveInspection = inspection ?? await this.dependencies.sync.inspect();
    if (taskId) {
      const state = await this.rebuildOne(taskId, effectiveInspection, false);
      await this.rebuildProjectProgress(effectiveInspection);
      return { taskIds: [taskId], states: [state] };
    }
    const project = await this.dependencies.registry.current();
    const events = await this.dependencies.events.readProjectEvents(project?.projectId);
    const taskIds = [...new Set(events.map((event) => event.taskId))].sort();
    const states = await Promise.all(taskIds.map((id) => this.rebuildOne(id, effectiveInspection, false)));
    await this.rebuildProjectProgress(effectiveInspection);
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

  private async rebuildOne(taskId: string, inspection?: SyncInspection, writeProject = true): Promise<TaskState> {
    const events = await this.dependencies.events.readTaskEvents(taskId);
    const state = this.reduceOne(events);
    const effectiveInspection = inspection ?? await this.dependencies.sync.inspect();
    this.withSyncSummary(state, effectiveInspection);
    const documents = this.dependencies.renderer.render(state, events);
    await this.dependencies.projections.writeTaskState(state);
    await this.dependencies.projections.writeMarkdown(taskId, documents);
    if (writeProject) await this.rebuildProjectProgress(effectiveInspection);
    return state;
  }

  private async rebuildProjectProgress(inspection?: SyncInspection): Promise<ProjectOverview | undefined> {
    const project = await this.dependencies.registry.current();
    if (!project) return undefined;
    const events = await this.dependencies.events.readProjectEvents(project.projectId);
    const effectiveInspection = inspection ?? await this.dependencies.sync.inspect();
    const tasks = this.reduceTasks(events).map((state) => this.withSyncSummary(state, effectiveInspection));
    const semanticConflict = tasks.some((state) => state.conflicts.some((conflict) => !conflict.resolved));
    const effectiveSync = semanticConflict ? { ...effectiveInspection, conflict: true } : effectiveInspection;
    if (semanticConflict) {
      for (const task of tasks) {
        if (task.conflicts.some((conflict) => !conflict.resolved)) task.sync.conflict = true;
      }
    }
    const overview = this.buildProjectOverview(project, tasks, events, effectiveSync);
    await this.dependencies.projections.writeProjectMarkdown(this.dependencies.renderer.renderProject(overview));
    return overview;
  }

  private buildProjectOverview(
    project: ProjectInfo,
    tasks: readonly TaskState[],
    events: readonly TaskEvent[],
    sync: SyncInspection
  ): ProjectOverview {
    const statusCounts = Object.fromEntries(taskStatuses.map((status) => [status, 0])) as Record<TaskState["status"], number>;
    const taskSummaries: ProjectTaskSummary[] = tasks
      .map((task) => {
        statusCounts[task.status] += 1;
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          currentFocus: task.currentFocus,
          nextAction: task.nextAction,
          updatedAt: task.updatedAt,
          pendingHandoff: Boolean(task.handoff && !task.handoff.acceptedAt),
          unresolvedConflictCount: task.conflicts.filter((conflict) => !conflict.resolved).length
        } satisfies ProjectTaskSummary;
      })
      .sort((left, right) => `${right.updatedAt}:${right.id}`.localeCompare(`${left.updatedAt}:${left.id}`));
    const orderedEvents = [...events].sort((left, right) => `${left.createdAt}:${left.eventId}`.localeCompare(`${right.createdAt}:${right.eventId}`));
    const titles = new Map(tasks.map((task) => [task.id, task.title]));
    const recentActivity: ProjectActivity[] = orderedEvents.slice(-10).reverse().map((event) => ({
      eventId: event.eventId,
      taskId: event.taskId,
      taskTitle: titles.get(event.taskId) ?? event.taskId,
      type: event.type,
      createdAt: event.createdAt,
      agentId: event.writer.agentId,
      deviceId: event.writer.deviceId,
      summary: activitySummary(event)
    }));
    return {
      projectId: project.projectId,
      projectName: project.name,
      taskCount: tasks.length,
      statusCounts,
      pendingHandoffCount: taskSummaries.filter((task) => task.pendingHandoff).length,
      unresolvedConflictCount: taskSummaries.reduce((total, task) => total + task.unresolvedConflictCount, 0),
      lastActivityAt: orderedEvents.at(-1)?.createdAt,
      recentActivity,
      tasks: taskSummaries,
      sync
    };
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
