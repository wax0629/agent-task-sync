import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  History, 
  FileCheck, 
  GitMerge, 
  ArrowRight, 
  BookmarkPlus
} from 'lucide-react';
import { Task, TaskEvent, PhaseStatus, AgentId, DeviceId, HandoffPackage } from '../../types';
import { getAgentBadge, getDeviceLabel } from '../TaskCard';
import { OverviewTab } from './OverviewTab';
import { TimelineTab } from './TimelineTab';
import { HandoffTab } from './HandoffTab';
import { SyncConflictsTab } from './SyncConflictsTab';

interface TaskDetailModalProps {
  task: Task;
  events: TaskEvent[];
  onClose: () => void;
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

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  events,
  onClose,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">
        {/* Modal Top Header Bar */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70">
          <div className="space-y-1.5 min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-subtle">
                {task.id}
              </span>
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                {task.project}
              </span>
              
              {/* Status Badge */}
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

              {task.unsynced_events_count > 0 && (
                <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 font-semibold">
                  +{task.unsynced_events_count} 待同步
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {task.title}
            </h2>

            {/* Next Action Line */}
            {task.next_action && (
              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-subtle w-fit">
                <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold text-indigo-900">下一步行动: </span>
                <span className="text-slate-700">{task.next_action}</span>
              </div>
            )}
          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenCheckpointModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-subtle"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-indigo-600" />
              <span>记录 Checkpoint</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-white px-4 sm:px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>任务概览 (Overview)</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-4 w-4" />
            <span>事件时间线 (Timeline)</span>
            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-semibold">
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('handoff')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'handoff'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            <span>交接中心 (Handoff)</span>
            {task.handoff && (
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'sync'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitMerge className="h-4 w-4" />
            <span>同步与冲突 (Sync & Conflicts)</span>
            {task.conflict && !task.conflict.resolved && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60">
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

        {/* Modal Footer Quick Action Bar */}
        <div className="flex items-center justify-between p-3 sm:px-6 border-t border-slate-200/80 bg-white text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">当前认领:</span>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${agentInfo.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${agentInfo.dot}`} />
              <span>{agentInfo.name}</span>
            </div>
            <span className="text-slate-400 font-mono hidden sm:inline">
              ({getDeviceLabel(task.assigned_device)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onClaimTask('claude', 'windows-desktop')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
            >
              切为 Claude (Win) 认领
            </button>
            <button
              onClick={() => onClaimTask('codex', 'macbook-pro')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
            >
              切为 Codex (Mac) 认领
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
