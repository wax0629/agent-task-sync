export type TaskStatus = 
  | 'planned' 
  | 'in_progress' 
  | 'blocked' 
  | 'needs_review' 
  | 'handoff_ready' 
  | 'completed'
  | 'archived';

export type PhaseStatus = 'planned' | 'in_progress' | 'completed' | 'blocked';

export type AgentId = 'codex' | 'claude' | 'pi' | 'cursor' | 'human';
export type DeviceId = 'macbook-pro' | 'windows-desktop' | 'linux-dev';

export interface Phase {
  id: string;
  order: number;
  title: string;
  goal: string;
  criteria: string;
  status: PhaseStatus;
  claimedBy?: {
    agentId: AgentId;
    deviceId: DeviceId;
    sessionId?: string;
  };
}

export interface TaskEvent {
  event_id: string;
  task_id: string;
  phase_id?: string;
  agent_id: AgentId;
  device_id: DeviceId;
  session_id: string;
  type: 
    | 'task_created'
    | 'task_claimed'
    | 'progress'
    | 'phase_started'
    | 'phase_completed'
    | 'blocked'
    | 'unblocked'
    | 'decision_recorded'
    | 'test_result'
    | 'handoff_created'
    | 'handoff_accepted'
    | 'conflict_detected'
    | 'conflict_resolved'
    | 'task_completed';
  summary: string;
  details?: string;
  files?: string[];
  commit?: string;
  test_status?: 'passed' | 'failed' | 'skipped';
  created_at: string;
  synced: boolean;
}

export interface HandoffPackage {
  handoff_id: string;
  task_id: string;
  from_agent: AgentId;
  from_device: DeviceId;
  target_agent?: AgentId;
  created_at: string;
  completed_work: string[];
  incomplete_work: string[];
  key_decisions: { decision: string; reason: string }[];
  known_errors: { error: string; attempts: string }[];
  next_step: string;
  relevant_files: string[];
  test_summary: string;
  accepted_at?: string;
  accepted_by?: {
    agentId: AgentId;
    deviceId: DeviceId;
  };
}

export interface ConflictRecord {
  id: string;
  task_id: string;
  phase_id: string;
  detected_at: string;
  sideA: {
    agent_id: AgentId;
    device_id: DeviceId;
    summary: string;
    files: string[];
    commit: string;
    timestamp: string;
  };
  sideB: {
    agent_id: AgentId;
    device_id: DeviceId;
    summary: string;
    files: string[];
    commit: string;
    timestamp: string;
  };
  conflict_reason: string;
  resolved: boolean;
  resolution?: {
    choice: 'keep_sideA' | 'keep_sideB' | 'merge';
    summary: string;
    resolved_at: string;
  };
}

export interface Task {
  id: string;
  title: string;
  project: string; // Project ID
  goal: string;
  background?: string;
  criteria: string[];
  current_focus?: string;
  recent_completed?: string[];
  key_decisions?: { decision: string; reason: string }[];
  known_errors?: { error: string; attempts: string }[];
  verification?: { command: string; result: string; checked_at: string }[];
  related_commands?: string[];
  uncommitted_changes?: string[];
  status: TaskStatus;
  current_phase_id?: string;
  next_action: string;
  assigned_agent?: AgentId;
  assigned_device?: DeviceId;
  active_session_id?: string;
  blocked_reason?: string;
  git_repo?: string;
  git_branch?: string;
  last_commit?: string;
  phases: Phase[];
  handoff?: HandoffPackage;
  conflict?: ConflictRecord;
  unsynced_events_count: number;
  last_checkpoint_at: string;
  updated_at: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  repo: string;
  defaultBranch: string;
  syncState: 'synced' | 'local_ahead' | 'remote_ahead' | 'conflict' | 'offline' | 'syncing';
  unsyncedCount: number;
  lastSyncedAt: string;
  activeAgents: AgentId[];
  taskCount?: number;
  created_at: string;
}
