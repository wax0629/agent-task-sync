import type {
  ConflictResolvedPayload,
  EventPayload,
  EventWriter,
  TaskEvent,
  TaskState,
  VerificationResult
} from "@agent-task-sync/domain";

export interface Actor extends EventWriter {
  confirmed?: boolean;
}

export interface ProjectInfo {
  projectId: string;
  name: string;
  rootPath: string;
  remoteUrl?: string;
  defaultBranch?: string;
}

export interface ProjectActivity {
  eventId: string;
  taskId: string;
  taskTitle: string;
  type: TaskEvent["type"];
  createdAt: string;
  agentId: string;
  deviceId: string;
  summary: string;
}

export interface ProjectTaskSummary {
  id: string;
  title: string;
  status: TaskState["status"];
  currentFocus?: string;
  nextAction?: string;
  updatedAt: string;
  pendingHandoff: boolean;
  unresolvedConflictCount: number;
}

export interface ProjectOverview {
  projectId: string;
  projectName: string;
  taskCount: number;
  statusCounts: Record<TaskState["status"], number>;
  pendingHandoffCount: number;
  unresolvedConflictCount: number;
  lastActivityAt?: string;
  recentActivity: ProjectActivity[];
  tasks: ProjectTaskSummary[];
  sync: SyncInspection;
}

export interface HandoffCheck {
  taskId: string;
  taskTitle: string;
  taskStatus: TaskState["status"];
  hasHandoff: boolean;
  ready: boolean;
  blockers: string[];
  recommendations: string[];
}

export interface InitProjectInput {
  projectId: string;
  name: string;
  rootPath: string;
  remoteUrl?: string;
  defaultBranch?: string;
}

export interface ProjectRegistry {
  init(input: InitProjectInput): Promise<ProjectInfo>;
  current(): Promise<ProjectInfo | undefined>;
}

export interface EventStore {
  append(event: TaskEvent): Promise<void>;
  readTaskEvents(taskId: string): Promise<TaskEvent[]>;
  readProjectEvents(projectId?: string): Promise<TaskEvent[]>;
}

export interface RenderedDocuments {
  taskPlan: string;
  progress: string;
  handoff?: string;
}

export interface ProjectionStore {
  writeTaskState(state: TaskState): Promise<void>;
  writeMarkdown(taskId: string, documents: RenderedDocuments): Promise<void>;
  writeProjectMarkdown(markdown: string): Promise<void>;
}

export interface MarkdownRenderer {
  render(state: TaskState, events: readonly TaskEvent[]): RenderedDocuments;
  renderProject(overview: ProjectOverview): string;
}

export interface SyncInspection {
  localEventCount: number;
  remoteEventCount?: number;
  localAhead: boolean;
  remoteAhead: boolean;
  conflict: boolean;
  lastSyncedAt?: string;
}

export interface PullResult {
  pulledEventCount: number;
  changed: boolean;
}

export interface PushResult {
  pushedEventCount: number;
  changed: boolean;
}

export interface SyncPort {
  inspect(): Promise<SyncInspection>;
  pull(): Promise<PullResult>;
  push(): Promise<PushResult>;
}

export interface CreateTaskInput {
  projectId: string;
  taskId: string;
  title: string;
  goal: string;
  background?: string;
  acceptanceCriteria?: TaskState["acceptanceCriteria"];
  phases?: TaskState["phases"];
  status?: TaskState["status"];
  confirmed?: boolean;
}

export interface ClaimTaskInput {
  taskId: string;
  phaseId?: string;
  released?: boolean;
  confirmed?: boolean;
}

export interface CheckpointInput {
  taskId: string;
  summary?: string;
  currentFocus?: string;
  recentCompleted?: string[];
  nextAction?: string | null;
  filesChanged?: string[];
  commit?: string;
  verification?: VerificationResult[];
  uncommittedChanges?: string[];
  status?: TaskState["status"];
  confirmed?: boolean;
}

export interface HandoffInput {
  taskId: string;
  handoffId?: string;
  completedWork?: string[];
  incompleteWork?: string[];
  keyDecisions?: Array<{ decision: string; reason?: string }>;
  knownErrors?: Array<{ error: string; attempts?: string }>;
  nextStep?: string | null;
  relevantFiles?: string[];
  testSummary?: string;
  targetAgent?: string;
  confirmed?: boolean;
}

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  goal?: string;
  background?: string | null;
  acceptanceCriteria?: TaskState["acceptanceCriteria"];
  status?: TaskState["status"];
  currentFocus?: string | null;
  recentCompleted?: string[];
  nextAction?: string | null;
  phases?: TaskState["phases"];
  currentPhaseId?: string | null;
  confirmed?: boolean;
}

export interface BlockTaskInput {
  taskId: string;
  reason?: string;
  confirmed?: boolean;
}

export interface CompleteTaskInput {
  taskId: string;
  summary?: string;
  confirmed?: boolean;
}

export interface DecisionInput {
  taskId: string;
  decision: string;
  reason?: string;
  confirmed?: boolean;
}

export interface QuestionInput {
  taskId: string;
  question: string;
  resolved?: boolean;
  answer?: string;
  confirmed?: boolean;
}

export interface ErrorInput {
  taskId: string;
  error: string;
  attempts?: string;
  resolved?: boolean;
  confirmed?: boolean;
}

export interface VerificationInput {
  taskId: string;
  command: string;
  result: string;
  status: VerificationResult["status"];
  confirmed?: boolean;
}

export interface ResolveConflictInput {
  taskId: string;
  conflictId: string;
  choice: ConflictResolvedPayload["choice"];
  resolvedEventIds: string[];
  summary?: string;
  status?: TaskState["status"];
  nextAction?: string | null;
  confirmed?: boolean;
}

export interface AcceptHandoffInput {
  taskId: string;
  handoffId: string;
  confirmed?: boolean;
}

export interface RebuildResult {
  taskIds: string[];
  states: TaskState[];
}

export interface ContinuationContext {
  task: TaskState;
  markdown: string;
  source: "events";
  warning?: string;
}

export interface ProjectStatus {
  project?: ProjectInfo;
  tasks: TaskState[];
  sync: SyncInspection;
  overview?: ProjectOverview;
}

export interface SyncResult {
  inspection: SyncInspection;
  pull: PullResult;
  push: PushResult;
  rebuilt: RebuildResult;
}

export interface TaskSyncService {
  init(input: InitProjectInput): Promise<ProjectInfo>;
  status(): Promise<ProjectStatus>;
  createTask(input: CreateTaskInput, actor: Actor): Promise<TaskState>;
  updateTask(input: UpdateTaskInput, actor: Actor): Promise<TaskState>;
  claimTask(input: ClaimTaskInput, actor: Actor): Promise<TaskState>;
  blockTask(input: BlockTaskInput, actor: Actor): Promise<TaskState>;
  completeTask(input: CompleteTaskInput, actor: Actor): Promise<TaskState>;
  recordDecision(input: DecisionInput, actor: Actor): Promise<TaskState>;
  recordQuestion(input: QuestionInput, actor: Actor): Promise<TaskState>;
  recordError(input: ErrorInput, actor: Actor): Promise<TaskState>;
  recordVerification(input: VerificationInput, actor: Actor): Promise<TaskState>;
  resolveConflict(input: ResolveConflictInput, actor: Actor): Promise<TaskState>;
  recordCheckpoint(input: CheckpointInput, actor: Actor): Promise<TaskState>;
  createHandoff(input: HandoffInput, actor: Actor): Promise<TaskState>;
  acceptHandoff(input: AcceptHandoffInput, actor: Actor): Promise<TaskState>;
  checkHandoff(taskId: string): Promise<HandoffCheck>;
  rebuild(taskId?: string): Promise<RebuildResult>;
  sync(): Promise<SyncResult>;
  getContext(taskId: string): Promise<ContinuationContext>;
}

export type EventPayloadFor<TType extends TaskEvent["type"]> = Extract<
  TaskEvent,
  { type: TType }
>["payload"] | EventPayload;
