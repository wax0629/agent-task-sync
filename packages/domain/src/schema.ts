import AjvModule, { type ErrorObject, type ValidateFunction } from "ajv";
import type { TaskEvent, TaskState } from "./types.js";

interface AjvInstance {
  compile(schema: unknown): ValidateFunction;
  errorsText(errors?: ErrorObject[] | null): string;
}

const AjvConstructor = AjvModule as unknown as new (options?: object) => AjvInstance;

const taskEventSchema = {
  $id: "https://agent-task-sync.dev/schema/task-event.v1.json",
  type: "object",
  additionalProperties: false,
  required: [
    "eventId",
    "schemaVersion",
    "projectId",
    "taskId",
    "type",
    "payload",
    "parentEventIds",
    "writer",
    "createdAt"
  ],
  properties: {
    eventId: { type: "string", minLength: 1 },
    schemaVersion: { const: 1 },
    projectId: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    type: {
      type: "string",
      enum: [
        "task_created",
        "task_updated",
        "task_claimed",
        "checkpoint_recorded",
        "decision_recorded",
        "question_recorded",
        "error_recorded",
        "verification_recorded",
        "handoff_created",
        "handoff_accepted",
        "task_blocked",
        "task_completed",
        "conflict_resolved"
      ]
    },
    payload: { type: "object" },
    parentEventIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true
    },
    writer: {
      type: "object",
      additionalProperties: false,
      required: ["agentId", "deviceId", "sessionId"],
      properties: {
        agentId: { type: "string", minLength: 1 },
        deviceId: { type: "string", minLength: 1 },
        sessionId: { type: "string", minLength: 1 }
      }
    },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const taskStateSchema = {
  $id: "https://agent-task-sync.dev/schema/task-state.v1.json",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "title",
    "goal",
    "acceptanceCriteria",
    "status",
    "recentCompleted",
    "decisions",
    "openQuestions",
    "knownErrors",
    "references",
    "verification",
    "sync",
    "conflicts",
    "revision",
    "createdAt",
    "updatedAt"
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    projectId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    goal: { type: "string", minLength: 1 },
    background: { type: "string" },
    acceptanceCriteria: { type: "array", items: { type: "object" } },
    status: {
      type: "string",
      enum: ["planned", "in_progress", "blocked", "needs_review", "handoff_ready", "completed", "archived"]
    },
    currentFocus: { type: "string" },
    recentCompleted: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" },
    phases: { type: "array", items: { type: "object" } },
    currentPhaseId: { type: "string" },
    decisions: { type: "array", items: { type: "object" } },
    openQuestions: { type: "array", items: { type: "object" } },
    knownErrors: { type: "array", items: { type: "object" } },
    references: { type: "array", items: { type: "object" } },
    verification: { type: "array", items: { type: "object" } },
    uncommittedChanges: { type: "array", items: { type: "string" } },
    ownership: { type: "object" },
    sync: {
      type: "object",
      additionalProperties: false,
      required: ["unsyncedEventCount"],
      properties: {
        unsyncedEventCount: { type: "integer", minimum: 0 },
        localAhead: { type: "boolean" },
        remoteAhead: { type: "boolean" },
        conflict: { type: "boolean" },
        lastSyncedAt: { type: "string", format: "date-time" },
        remoteRevision: { type: "string", minLength: 1 }
      }
    },
    handoff: { type: "object" },
    conflicts: { type: "array", items: { type: "object" } },
    revision: { type: "string", minLength: 1 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
} as const;

const ajv = new AjvConstructor({ allErrors: true, strict: false, formats: { "date-time": true } });
const validateEvent = ajv.compile(taskEventSchema);
const validateState = ajv.compile(taskStateSchema);

export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

function result(validate: ValidateFunction): SchemaValidationResult {
  return { valid: Boolean(validate.errors === null), errors: validate.errors ?? [] };
}

export function validateTaskEvent(event: unknown): SchemaValidationResult {
  validateEvent(event);
  return result(validateEvent);
}

export function assertValidTaskEvent(event: unknown): asserts event is TaskEvent {
  const validation = validateTaskEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid task event: ${ajv.errorsText(validation.errors)}`);
  }
}

export function validateTaskState(state: unknown): SchemaValidationResult {
  validateState(state);
  return result(validateState);
}

export function assertValidTaskState(state: unknown): asserts state is TaskState {
  const validation = validateTaskState(state);
  if (!validation.valid) {
    throw new Error(`Invalid task state: ${ajv.errorsText(validation.errors)}`);
  }
}

export { taskEventSchema, taskStateSchema };
