import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Layers, 
  History, 
  FileCheck, 
  GitMerge, 
  ArrowRight, 
  BookmarkPlus, 
  CheckCircle2, 
  GitBranch, 
  GitCommit, 
  Clock, 
  Bot, 
  Laptop,
  ShieldCheck,
  Send,
  Plus
} from 'lucide-react';
import { Task, TaskEvent, PhaseStatus, AgentId, DeviceId, HandoffPackage } from '../../types';
import { getAgentBadge, getDeviceLabel } from '../TaskCard';
import { OverviewTab } from './OverviewTab';
import { TimelineTab } from './TimelineTab';
import { HandoffTab } from './HandoffTab';
import { SyncConflictsTab } from './SyncConflictsTab';

interface TaskDetailWorkspaceProps {
  task: Task;
  events: TaskEvent[];
  onBackToList: () => void;
  onUpdatePhaseStatus: (phaseId: string, status: PhaseStatus) => void;
  onUnblockTask: () => void;
  onCreateHandoff: (handoff: HandoffPackage) => void;
  onAcceptHandoff: (targetAgent: AgentId, targetDevice: DeviceId) => void;
  onResolveConflict: (taskId: string, choice: 'keep_sideA' | 'keep_sideB' | 'merge', summary: string) => void;
  onTriggerSync: () => void;
  onOpenCheckpointModal: () => void;
  onClaimTask: (agentId: AgentId, deviceId: DeviceId) => void;
  isSyncing: boolean;
  isOffline: boolean;
  defaultTab?: 'overview' | 'timeline' | 'handoff' | 'sync';
}

export const TaskDetailWorkspace: React.FC<TaskDetailWorkspaceProps> = ({
  task,
  events,
  onBackToList,
  onUpdatePhaseStatus,
  onUnblockTask,
  onCreateHandoff,
  onAcceptHandoff,
  onResolveConflict,
  onTriggerSync,
  onOpenCheckpointModal,
  onClaimTask,
  isSyncing,
  isOffline,
  defaultTab = 'overview'
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'handoff' | 'sync'>(defaultTab);

  const agentInfo = getAgentBadge(task.assigned_agent);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/60 animate-fadeIn">
      {/* 1. Breadcrumbs & Top Action Bar */}
      <div className="p-4 sm:px-6 bg-white border-b border-slate-200/80 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onBackToList}
              className="flex items-center gap-1 font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>返回任务列表</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-400">{task.id}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
              {task.project}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCheckpointModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shadow-indigo-600/20 active:scale-[0.98]"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              <span>记录 Checkpoint</span>
            </button>
          </div>
        </div>

        {/* Task Title & Meta Row */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                task.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : task.status === 'needs_review'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : task.status === 'handoff_ready'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : task.status === 'blocked'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}>
                {task.status.toUpperCase()}
              </span>

              <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                {task.title}
              </h1>
            </div>

            {/* Quick Agent Claim buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${agentInfo.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${agentInfo.dot}`} />
                <span>{agentInfo.name}</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                ({getDeviceLabel(task.assigned_device)})
              </span>
            </div>
          </div>

          {/* Prominent Next Action Banner */}
          {task.next_action && (
            <div className="flex items-center gap-2 text-xs bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 shadow-subtle">
              <ArrowRight className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-indigo-950">下一步唯一行动指南 (Single Next Action): </span>
              <span className="text-indigo-900 font-semibold italic">{task.next_action}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-4 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>任务概览 (Overview)</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>不可变事件流 (Timeline)</span>
            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-semibold">
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('handoff')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'handoff'
                ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileCheck className="h-3.5 w-3.5" />
            <span>交接中心 (Handoff)</span>
            {task.handoff && (
              <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'sync'
                ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            <span>同步与冲突 (Sync & Conflicts)</span>
            {task.conflict && !task.conflict.resolved && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              task={task}
              onUpdatePhaseStatus={onUpdatePhaseStatus}
              onUnblockTask={onUnblockTask}
              onAddCheckpoint={onOpenCheckpointModal}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineTab
              task={task}
              events={events}
            />
          )}

          {activeTab === 'handoff' && (
            <HandoffTab
              task={task}
              onCreateHandoff={onCreateHandoff}
              onAcceptHandoff={onAcceptHandoff}
            />
          )}

          {activeTab === 'sync' && (
            <SyncConflictsTab
              task={task}
              events={events}
              onTriggerSync={onTriggerSync}
              onResolveConflict={onResolveConflict}
              isSyncing={isSyncing}
              isOffline={isOffline}
            />
          )}
        </div>
      </div>
    </div>
  );
};
