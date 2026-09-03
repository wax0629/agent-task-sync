export type TaskStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "handoff_ready"
  | "completed"
  | "archived";

export type PhaseStatus = "planned" | "in_progress" | "blocked" | "completed";

export type EventType =
  | "task_created"
  | "task_updated"
  | "task_claimed"
  | "checkpoint_recorded"
  | "decision_recorded"
  | "question_recorded"
  | "error_recorded"
  | "verification_recorded"
  | "handoff_created"
  | "handoff_accepted"
  | "task_blocked"
  | "task_completed"
  | "conflict_resolved";

export interface AcceptanceCriterion {
  id: string;
  text: string;
  completed: boolean;
}

export interface PhaseState {
  id: string;
  order: number;
  title: string;
  status: PhaseStatus;
  goal?: string;
  criteria?: string;
  claimedBy?: Ownership;
}

export interface Ownership {
  agentId: string;
  deviceId: string;
  sessionId?: string;
  claimedAt?: string;
  phaseId?: string;
}

export interface Decision {
  id: string;
  decision: string;
  reason?: string;
  recordedAt: string;
  recordedBy?: Ownership;
}

export interface Question {
  id: string;
  question: string;
  resolved: boolean;
  answer?: string;
  recordedAt: string;
}

export interface KnownError {
  id: string;
  error: string;
  attempts?: string;
  resolved: boolean;
  recordedAt: string;
}

export interface WorkReference {
  path?: string;
  commit?: string;
  issue?: string;
  pullRequest?: string;
  note?: string;
  recordedAt: string;
}

export interface VerificationResult {
  id: string;
  command: string;
  result: string;
  status: "passed" | "failed" | "skipped";
  checkedAt: string;
}

export interface SyncSummary {
  unsyncedEventCount: number;
  lastSyncedAt?: string;
  remoteRevision?: string;
}

export interface HandoffState {
  id: string;
  completedWork: string[];
  incompleteWork: string[];
  keyDecisions: Array<{ decision: string; reason?: string }>;
  knownErrors: Array<{ error: string; attempts?: string }>;
  nextStep?: string;
  relevantFiles: string[];
  testSummary?: string;
  targetAgent?: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: Ownership;
}

export interface ConflictOption {
  eventId: string;
  value: unknown;
}

export interface ConflictRecord {
  id: string;
  taskId: string;
  field: string;
  parentEventIds: string[];
  eventIds: string[];
  options: ConflictOption[];
  reason: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: {
    choice: "keep_first" | "keep_last" | "merge";
    summary?: string;
    resolvedAt: string;
    resolvedEventIds: string[];
  };
}

export interface TaskState {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  background?: string;
  acceptanceCriteria: AcceptanceCriterion[];
  status: TaskStatus;
  currentFocus?: string;
  recentCompleted: string[];
  nextAction?: string;
  phases?: PhaseState[];
  currentPhaseId?: string;
  decisions: Decision[];
  openQuestions: Question[];
  knownErrors: KnownError[];
  references: WorkReference[];
  verification: VerificationResult[];
  ownership?: Ownership;
  sync: SyncSummary;
  handoff?: HandoffState;
  conflicts: ConflictRecord[];
  revision: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreatedPayload {
  title: string;
  goal: string;
  background?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  phases?: PhaseState[];
  status?: TaskStatus;
}

export interface TaskUpdatedPayload {
  title?: string;
  goal?: string;
  background?: string | null;
  acceptanceCriteria?: AcceptanceCriterion[];
  status?: TaskStatus;
  currentFocus?: string | null;
  recentCompleted?: string[];
  nextAction?: string | null;
  phases?: PhaseState[];
  currentPhaseId?: string | null;
}

export interface TaskClaimedPayload {
  agentId: string;
  deviceId: string;
  sessionId?: string;
  phaseId?: string;
  released?: boolean;
}

export interface CheckpointRecordedPayload {
  summary?: string;
  currentFocus?: string;
  recentCompleted?: string[];
  nextAction?: string | null;
  filesChanged?: string[];
  commit?: string;
  verification?: VerificationResult[];
  uncommittedChanges?: string[];
  status?: TaskStatus;
}

export interface DecisionRecordedPayload {
  decision: string;
  reason?: string;
}

export interface QuestionRecordedPayload {
  question: string;
  resolved?: boolean;
  answer?: string;
}

export interface ErrorRecordedPayload {
  error: string;
  attempts?: string;
  resolved?: boolean;
}

export interface VerificationRecordedPayload {
  command: string;
  result: string;
  status: "passed" | "failed" | "skipped";
}

export interface HandoffCreatedPayload {
  handoffId?: string;
  completedWork?: string[];
  incompleteWork?: string[];
  keyDecisions?: Array<{ decision: string; reason?: string }>;
  knownErrors?: Array<{ error: string; attempts?: string }>;
  nextStep?: string | null;
  relevantFiles?: string[];
  testSummary?: string;
  targetAgent?: string;
}

export interface HandoffAcceptedPayload {
  handoffId: string;
}

export interface TaskBlockedPayload {
  reason?: string;
}

export interface TaskCompletedPayload {
  summary?: string;
}

export interface ConflictResolvedPayload {
  conflictId: string;
  choice: "keep_first" | "keep_last" | "merge";
  resolvedEventIds: string[];
  summary?: string;
  status?: TaskStatus;
  nextAction?: string | null;
}

export type EventPayload =
  | TaskCreatedPayload
  | TaskUpdatedPayload
  | TaskClaimedPayload
  | CheckpointRecordedPayload
  | DecisionRecordedPayload
  | QuestionRecordedPayload
  | ErrorRecordedPayload
  | VerificationRecordedPayload
  | HandoffCreatedPayload
  | HandoffAcceptedPayload
  | TaskBlockedPayload
  | TaskCompletedPayload
  | ConflictResolvedPayload;

export interface EventWriter {
  agentId: string;
  deviceId: string;
  sessionId: string;
}

export interface TaskEvent<TPayload extends EventPayload = EventPayload> {
  eventId: string;
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  type: EventType;
  payload: TPayload;
  parentEventIds: string[];
  writer: EventWriter;
  createdAt: string;
}

export interface ReduceResult {
  state: TaskState;
  orderedEvents: TaskEvent[];
  duplicateEventIds: string[];
}
