import type {
  AcceptanceCriterion,
  ConflictRecord,
  ConflictResolvedPayload,
  EventPayload,
  HandoffAcceptedPayload,
  HandoffCreatedPayload,
  Ownership,
  ReduceResult,
  TaskEvent,
  TaskState,
  TaskStatus,
  TaskUpdatedPayload
} from "./types.js";

type Patch = { field: string; value: unknown };

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `r${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(nonBlank))];
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function parentKey(event: TaskEvent): string | undefined {
  if (event.parentEventIds.length === 0) return undefined;
  return [...event.parentEventIds].sort().join("|");
}

function ownershipFromEvent(event: TaskEvent, payload: { agentId: string; deviceId: string; sessionId?: string; phaseId?: string }): Ownership {
  return {
    agentId: payload.agentId,
    deviceId: payload.deviceId,
    sessionId: payload.sessionId,
    phaseId: payload.phaseId,
    claimedAt: event.createdAt
  };
}

function patchesForEvent(event: TaskEvent): Patch[] {
  const payload = event.payload as EventPayload;
  switch (event.type) {
    case "task_updated": {
      const update = payload as TaskUpdatedPayload;
      return [
        ...(update.status ? [{ field: "status", value: update.status }] : []),
        ...(update.nextAction !== undefined ? [{ field: "nextAction", value: update.nextAction }] : []),
        ...(update.currentFocus !== undefined ? [{ field: "currentFocus", value: update.currentFocus }] : [])
      ];
    }
    case "task_claimed": {
      const claim = payload as { agentId: string; deviceId: string; sessionId?: string; phaseId?: string; released?: boolean };
      return claim.released ? [] : [{ field: "ownership", value: ownershipFromEvent(event, claim) }];
    }
    case "checkpoint_recorded": {
      const checkpoint = payload as { status?: TaskStatus; nextAction?: string | null; currentFocus?: string };
      return [
        ...(checkpoint.status ? [{ field: "status", value: checkpoint.status }] : []),
        ...(checkpoint.nextAction !== undefined ? [{ field: "nextAction", value: checkpoint.nextAction }] : []),
        ...(checkpoint.currentFocus !== undefined ? [{ field: "currentFocus", value: checkpoint.currentFocus }] : [])
      ];
    }
    case "handoff_created":
      return [{ field: "status", value: "handoff_ready" }];
    case "handoff_accepted":
      return [{ field: "status", value: "in_progress" }];
    case "task_blocked":
      return [{ field: "status", value: "blocked" }];
    case "task_completed":
      return [{ field: "status", value: "completed" }];
    default:
      return [];
  }
}

function conflictId(taskId: string, parent: string, field: string, eventIds: string[]): string {
  return `conflict-${fingerprint({ taskId, parent, field, eventIds })}`;
}

function detectConflicts(taskId: string, events: TaskEvent[]): ConflictRecord[] {
  const groups = new Map<string, Array<{ event: TaskEvent; patch: Patch }>>();
  for (const event of events) {
    const parent = parentKey(event);
    if (!parent) continue;
    for (const patch of patchesForEvent(event)) {
      const key = `${parent}::${patch.field}`;
      const group = groups.get(key) ?? [];
      group.push({ event, patch });
      groups.set(key, group);
    }
  }

  const conflicts: ConflictRecord[] = [];
  for (const [key, entries] of groups) {
    const values = entries.map(({ patch }) => patch.value);
    const distinct = values.filter((value, index) => values.findIndex((candidate) => sameValue(candidate, value)) === index);
    if (distinct.length < 2) continue;
    const [parent, field] = key.split("::");
    const eventIds = [...new Set(entries.map(({ event }) => event.eventId))].sort();
    conflicts.push({
      id: conflictId(taskId, parent, field, eventIds),
      taskId,
      field,
      parentEventIds: parent.split("|").filter(Boolean),
      eventIds,
      options: entries
        .sort((left, right) => left.event.eventId.localeCompare(right.event.eventId))
        .map(({ event, patch }) => ({ eventId: event.eventId, value: patch.value })),
      reason: `Concurrent updates to ${field} share the same parent event head.`,
      detectedAt: entries.map(({ event }) => event.createdAt).sort()[0],
      resolved: false
    });
  }
  return conflicts.sort((left, right) => left.id.localeCompare(right.id));
}

function baseState(event: TaskEvent): TaskState {
  const payload = event.payload as {
    title: string;
    goal: string;
    background?: string;
    acceptanceCriteria?: AcceptanceCriterion[];
    phases?: TaskState["phases"];
    status?: TaskStatus;
  };
  return {
    id: event.taskId,
    projectId: event.projectId,
    title: payload.title,
    goal: payload.goal,
    background: payload.background,
    acceptanceCriteria: payload.acceptanceCriteria ? [...payload.acceptanceCriteria] : [],
    status: payload.status ?? "planned",
    recentCompleted: [],
    phases: payload.phases ? [...payload.phases] : undefined,
    decisions: [],
    openQuestions: [],
    knownErrors: [],
    references: [],
    verification: [],
    sync: { unsyncedEventCount: 0 },
    conflicts: [],
    revision: "pending",
    createdAt: event.createdAt,
    updatedAt: event.createdAt
  };
}

function setOptionalString(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined) return;
  if (value === null) {
    delete target[key];
    return;
  }
  if (nonBlank(value)) target[key] = value;
}

function mergeCriteria(existing: AcceptanceCriterion[], incoming: AcceptanceCriterion[]): AcceptanceCriterion[] {
  const byId = new Map(existing.map((criterion) => [criterion.id, criterion]));
  for (const criterion of incoming) {
    if (!nonBlank(criterion.id) || !nonBlank(criterion.text)) continue;
    byId.set(criterion.id, { ...criterion });
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function applyEvent(state: TaskState, event: TaskEvent): void {
  const payload = event.payload as EventPayload;
  switch (event.type) {
    case "task_updated": {
      const update = payload as TaskUpdatedPayload;
      setOptionalString(state as unknown as Record<string, unknown>, "title", update.title);
      setOptionalString(state as unknown as Record<string, unknown>, "goal", update.goal);
      setOptionalString(state as unknown as Record<string, unknown>, "background", update.background);
      setOptionalString(state as unknown as Record<string, unknown>, "currentFocus", update.currentFocus);
      setOptionalString(state as unknown as Record<string, unknown>, "nextAction", update.nextAction);
      if (update.status) state.status = update.status;
      if (update.acceptanceCriteria) state.acceptanceCriteria = mergeCriteria(state.acceptanceCriteria, update.acceptanceCriteria);
      if (update.recentCompleted) state.recentCompleted = uniqueStrings([...state.recentCompleted, ...update.recentCompleted]);
      if (update.phases) state.phases = [...update.phases];
      if (update.currentPhaseId === null) delete state.currentPhaseId;
      else if (nonBlank(update.currentPhaseId)) state.currentPhaseId = update.currentPhaseId;
      break;
    }
    case "task_claimed": {
      const claim = payload as { agentId: string; deviceId: string; sessionId?: string; phaseId?: string; released?: boolean };
      if (claim.released) {
        delete state.ownership;
      } else {
        state.ownership = ownershipFromEvent(event, claim);
        if (claim.phaseId && state.phases) {
          state.phases = state.phases.map((phase) => phase.id === claim.phaseId
            ? { ...phase, status: phase.status === "planned" ? "in_progress" : phase.status, claimedBy: state.ownership }
            : phase);
          state.currentPhaseId = claim.phaseId;
        }
        if (state.status === "planned") state.status = "in_progress";
      }
      break;
    }
    case "checkpoint_recorded": {
      const checkpoint = payload as {
        summary?: string;
        currentFocus?: string;
        recentCompleted?: string[];
        nextAction?: string | null;
        filesChanged?: string[];
        commit?: string;
        verification?: TaskState["verification"];
        uncommittedChanges?: string[];
        status?: TaskStatus;
      };
      setOptionalString(state as unknown as Record<string, unknown>, "currentFocus", checkpoint.currentFocus);
      setOptionalString(state as unknown as Record<string, unknown>, "nextAction", checkpoint.nextAction);
      if (checkpoint.recentCompleted) state.recentCompleted = uniqueStrings([...state.recentCompleted, ...checkpoint.recentCompleted]);
      if (checkpoint.status) state.status = checkpoint.status;
      else if (state.status === "planned") state.status = "in_progress";
      if (checkpoint.filesChanged?.length || checkpoint.commit || checkpoint.summary) {
        state.references.push({
          path: checkpoint.filesChanged?.join(", "),
          commit: checkpoint.commit,
          note: checkpoint.summary,
          recordedAt: event.createdAt
        });
      }
      if (checkpoint.verification) state.verification.push(...checkpoint.verification.map((item) => ({ ...item })));
      if (checkpoint.uncommittedChanges !== undefined) {
        state.uncommittedChanges = uniqueStrings(checkpoint.uncommittedChanges);
      }
      break;
    }
    case "decision_recorded": {
      const decision = payload as { decision: string; reason?: string };
      if (nonBlank(decision.decision)) {
        state.decisions.push({
          id: `decision-${event.eventId}`,
          decision: decision.decision,
          reason: nonBlank(decision.reason) ? decision.reason : undefined,
          recordedAt: event.createdAt,
          recordedBy: ownershipFromEvent(event, event.writer)
        });
      }
      break;
    }
    case "question_recorded": {
      const question = payload as { question: string; resolved?: boolean; answer?: string };
      if (nonBlank(question.question)) {
        state.openQuestions.push({
          id: `question-${event.eventId}`,
          question: question.question,
          resolved: question.resolved ?? false,
          answer: nonBlank(question.answer) ? question.answer : undefined,
          recordedAt: event.createdAt
        });
      }
      break;
    }
    case "error_recorded": {
      const error = payload as { error: string; attempts?: string; resolved?: boolean };
      if (nonBlank(error.error)) {
        state.knownErrors.push({
          id: `error-${event.eventId}`,
          error: error.error,
          attempts: nonBlank(error.attempts) ? error.attempts : undefined,
          resolved: error.resolved ?? false,
          recordedAt: event.createdAt
        });
      }
      break;
    }
    case "verification_recorded": {
      const verification = payload as { command: string; result: string; status: "passed" | "failed" | "skipped" };
      if (nonBlank(verification.command)) {
        state.verification.push({
          id: `verification-${event.eventId}`,
          command: verification.command,
          result: verification.result,
          status: verification.status,
          checkedAt: event.createdAt
        });
      }
      break;
    }
    case "handoff_created": {
      const handoff = payload as HandoffCreatedPayload;
      state.handoff = {
        id: handoff.handoffId ?? `handoff-${event.eventId}`,
        completedWork: uniqueStrings(handoff.completedWork ?? []),
        incompleteWork: uniqueStrings(handoff.incompleteWork ?? []),
        keyDecisions: handoff.keyDecisions ? [...handoff.keyDecisions] : [],
        knownErrors: handoff.knownErrors ? [...handoff.knownErrors] : [],
        nextStep: nonBlank(handoff.nextStep) ? handoff.nextStep : undefined,
        relevantFiles: uniqueStrings(handoff.relevantFiles ?? []),
        testSummary: nonBlank(handoff.testSummary) ? handoff.testSummary : undefined,
        targetAgent: nonBlank(handoff.targetAgent) ? handoff.targetAgent : undefined,
        createdAt: event.createdAt
      };
      state.status = "handoff_ready";
      break;
    }
    case "handoff_accepted": {
      const accepted = payload as HandoffAcceptedPayload;
      if (state.handoff?.id === accepted.handoffId) {
        state.handoff.acceptedAt = event.createdAt;
        state.handoff.acceptedBy = ownershipFromEvent(event, event.writer);
        state.status = "in_progress";
        // Keep the two projections value-equivalent without sharing an object
        // reference that can be emitted as an unsupported YAML alias.
        state.ownership = { ...state.handoff.acceptedBy };
      }
      break;
    }
    case "task_blocked": {
      const blocked = payload as { reason?: string };
      state.status = "blocked";
      if (nonBlank(blocked.reason)) {
        state.knownErrors.push({
          id: `blocked-${event.eventId}`,
          error: blocked.reason,
          resolved: false,
          recordedAt: event.createdAt
        });
      }
      break;
    }
    case "task_completed": {
      const completed = payload as { summary?: string };
      state.status = "completed";
      if (nonBlank(completed.summary)) state.recentCompleted = uniqueStrings([...state.recentCompleted, completed.summary]);
      break;
    }
    case "conflict_resolved":
      break;
    case "task_created":
      break;
  }
}

function applyResolution(state: TaskState, conflict: ConflictRecord, event: TaskEvent): void {
  const payload = event.payload as ConflictResolvedPayload;
  if (payload.status) state.status = payload.status;
  if (payload.nextAction !== undefined) setOptionalString(state as unknown as Record<string, unknown>, "nextAction", payload.nextAction);
  if (payload.choice === "keep_first" || payload.choice === "keep_last") {
    const option = payload.choice === "keep_first" ? conflict.options[0] : conflict.options[conflict.options.length - 1];
    if (conflict.field === "status" && typeof option.value === "string") state.status = option.value as TaskStatus;
    if (conflict.field === "nextAction") setOptionalString(state as unknown as Record<string, unknown>, "nextAction", option.value);
    if (conflict.field === "currentFocus") setOptionalString(state as unknown as Record<string, unknown>, "currentFocus", option.value);
    if (conflict.field === "ownership" && option.value && typeof option.value === "object") state.ownership = option.value as Ownership;
  }
  conflict.resolved = true;
  conflict.resolution = {
    choice: payload.choice,
    summary: payload.summary,
    resolvedAt: event.createdAt,
    resolvedEventIds: [...payload.resolvedEventIds].sort()
  };
}

export function reduceTaskEvents(inputEvents: readonly TaskEvent[]): ReduceResult {
  const byId = new Map<string, TaskEvent>();
  const duplicateEventIds: string[] = [];
  for (const event of inputEvents) {
    const existing = byId.get(event.eventId);
    if (!existing) {
      byId.set(event.eventId, event);
      continue;
    }
    duplicateEventIds.push(event.eventId);
    if (canonical(event) < canonical(existing)) byId.set(event.eventId, event);
  }

  const orderedEvents = [...byId.values()].sort((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt);
    return created === 0 ? left.eventId.localeCompare(right.eventId) : created;
  });
  const created = orderedEvents.find((event) => event.type === "task_created");
  if (!created) throw new Error("Cannot reduce task events without a task_created event.");

  const taskEvents = orderedEvents.filter((event) => event.taskId === created.taskId && event.projectId === created.projectId);
  const state = baseState(created);
  const conflicts = detectConflicts(created.taskId, taskEvents);
  const resolutions = new Map<string, TaskEvent>();

  for (const event of taskEvents) {
    applyEvent(state, event);
    state.updatedAt = event.createdAt > state.updatedAt ? event.createdAt : state.updatedAt;
    if (event.type === "conflict_resolved") {
      const payload = event.payload as ConflictResolvedPayload;
      resolutions.set(payload.conflictId, event);
    }
  }

  for (const conflict of conflicts) {
    const resolution = resolutions.get(conflict.id);
    if (resolution) {
      const payload = resolution.payload as ConflictResolvedPayload;
      const resolvedIds = new Set(payload.resolvedEventIds);
      if (conflict.eventIds.every((eventId) => resolvedIds.has(eventId))) applyResolution(state, conflict, resolution);
    }
  }

  state.conflicts = conflicts;
  if (conflicts.some((conflict) => !conflict.resolved)) state.status = "needs_review";
  state.revision = fingerprint({
    taskId: state.id,
    eventIds: orderedEvents.map((event) => event.eventId),
    state: { ...state, revision: undefined }
  });
  return { state, orderedEvents, duplicateEventIds: [...new Set(duplicateEventIds)].sort() };
}
