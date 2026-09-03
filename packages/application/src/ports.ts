import type {
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
}

export interface MarkdownRenderer {
  render(state: TaskState, events: readonly TaskEvent[]): RenderedDocuments;
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
  recordCheckpoint(input: CheckpointInput, actor: Actor): Promise<TaskState>;
  createHandoff(input: HandoffInput, actor: Actor): Promise<TaskState>;
  acceptHandoff(input: AcceptHandoffInput, actor: Actor): Promise<TaskState>;
  rebuild(taskId?: string): Promise<RebuildResult>;
  sync(): Promise<SyncResult>;
  getContext(taskId: string): Promise<ContinuationContext>;
}

export type EventPayloadFor<TType extends TaskEvent["type"]> = Extract<
  TaskEvent,
  { type: TType }
>["payload"] | EventPayload;
