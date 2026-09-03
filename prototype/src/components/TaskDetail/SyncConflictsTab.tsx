import React, { useState } from 'react';
import { 
  GitMerge, 
  RefreshCw, 
  GitBranch, 
  GitCommit, 
  ShieldAlert, 
  Radio, 
  Check, 
  Sparkles
} from 'lucide-react';
import { Task, TaskEvent } from '../../types';
import { getAgentBadge } from '../TaskCard';

interface SyncConflictsTabProps {
  task: Task;
  events: TaskEvent[];
  onTriggerSync: () => void;
  onResolveConflict: (taskId: string, choice: 'keep_sideA' | 'keep_sideB' | 'merge', summary: string) => void;
  isSyncing: boolean;
  isOffline: boolean;
}

export const SyncConflictsTab: React.FC<SyncConflictsTabProps> = ({
  task,
  events,
  onTriggerSync,
  onResolveConflict,
  isSyncing,
  isOffline
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'keep_sideA' | 'keep_sideB' | 'merge'>('merge');
  const [mergeSummary, setMergeSummary] = useState<string>('采用 CLI 子命令作为轻量触发器，同时预留 Daemon 接口供高级插件监听');

  const unsyncedEvents = events.filter(e => !e.synced);
  const conflict = task.conflict;

  return (
    <div className="space-y-5">
      {/* 1. Conflict Alert & Visual Diff Resolver if Conflict Exists */}
      {conflict && !conflict.resolved && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 space-y-4 shadow-card">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-rose-200/80">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-sm mt-0.5">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">检测到多 Agent 跨设备并发状态冲突</h3>
                  <span className="font-mono text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                    {conflict.id}
                  </span>
                </div>
                <p className="text-xs text-rose-900 mt-1 leading-relaxed font-medium">
                  {conflict.conflict_reason}
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-Side Diff Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Side A: Mac / Codex */}
            <div className={`rounded-2xl border p-4 transition-all ${
              selectedResolution === 'keep_sideA' 
                ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 shadow-sm' 
                : 'border-slate-200 bg-white shadow-subtle'
            }`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">提交分支 A (Mac)</span>
                  <span className={`px-2 py-0.2 rounded-md border text-[10px] font-semibold ${getAgentBadge(conflict.sideA.agent_id).bg}`}>
                    {getAgentBadge(conflict.sideA.agent_id).name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(conflict.sideA.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-2.5">
                <p className="text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {conflict.sideA.summary}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <GitCommit className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="font-mono text-[10px] font-bold text-indigo-700">{conflict.sideA.commit}</span>
                </div>

                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-400">修改文件: </span>
                  <span className="font-mono text-[10px] text-slate-700 font-medium">{conflict.sideA.files.join(', ')}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedResolution('keep_sideA')}
                className={`mt-3.5 w-full py-2 rounded-xl text-xs font-semibold border transition-all ${
                  selectedResolution === 'keep_sideA'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                选择保留方案 A
              </button>
            </div>

            {/* Side B: Windows / Claude */}
            <div className={`rounded-2xl border p-4 transition-all ${
              selectedResolution === 'keep_sideB' 
                ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 shadow-sm' 
                : 'border-slate-200 bg-white shadow-subtle'
            }`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">提交分支 B (Windows)</span>
                  <span className={`px-2 py-0.2 rounded-md border text-[10px] font-semibold ${getAgentBadge(conflict.sideB.agent_id).bg}`}>
                    {getAgentBadge(conflict.sideB.agent_id).name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(conflict.sideB.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-2.5">
                <p className="text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {conflict.sideB.summary}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <GitCommit className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-mono text-[10px] font-bold text-amber-700">{conflict.sideB.commit}</span>
                </div>

                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-400">修改文件: </span>
                  <span className="font-mono text-[10px] text-slate-700 font-medium">{conflict.sideB.files.join(', ')}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedResolution('keep_sideB')}
                className={`mt-3.5 w-full py-2 rounded-xl text-xs font-semibold border transition-all ${
                  selectedResolution === 'keep_sideB'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                选择保留方案 B
              </button>
            </div>
          </div>

          {/* Merge Option Customization */}
          <div className={`p-4 rounded-2xl border transition-all ${
            selectedResolution === 'merge'
              ? 'border-indigo-600 bg-white ring-2 ring-indigo-600 shadow-card'
              : 'border-slate-200 bg-white'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <label 
                onClick={() => setSelectedResolution('merge')}
                className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>智能合并方案 (Merge & Reconcile - 推荐)</span>
              </label>
              <button
                onClick={() => setSelectedResolution('merge')}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                  selectedResolution === 'merge' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                选中此项
              </button>
            </div>

            <textarea
              rows={2}
              value={mergeSummary}
              onChange={(e) => setMergeSummary(e.target.value)}
              disabled={selectedResolution !== 'merge'}
              placeholder="输入合并后的统一方案描述..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Action to resolve */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                const summary = 
                  selectedResolution === 'keep_sideA' 
                    ? conflict.sideA.summary 
                    : selectedResolution === 'keep_sideB' 
                    ? conflict.sideB.summary 
                    : mergeSummary;
                onResolveConflict(task.id, selectedResolution, summary);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>确认解决方案并追加 conflict_resolved 修正事件</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Git & Repository Status */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-indigo-600" />
            <span>Git-Backed 远程同步状态</span>
          </h4>
          <button
            onClick={onTriggerSync}
            disabled={isSyncing || isOffline}
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '同步中...' : '立即与 GitHub 同步'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 text-[11px] font-medium">Git 仓库</span>
            <div className="font-mono text-slate-800 font-semibold truncate">{task.git_repo || 'github.com/organization/agent-task-sync'}</div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 text-[11px] font-medium">分支 & Commit</span>
            <div className="font-mono text-indigo-700 font-semibold truncate">{task.git_branch} @ {task.last_commit}</div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 text-[11px] font-medium">本地待推送事件</span>
            <div className="font-mono font-bold">
              {unsyncedEvents.length > 0 ? (
                <span className="text-sky-700">{unsyncedEvents.length} 条待同步</span>
              ) : (
                <span className="text-emerald-700">已全部推送 (Synced)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Unsynced Local Events List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-3 shadow-card">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-sky-600" />
          <span>本地暂存事件队列 (Pending Push)</span>
        </h4>

        {unsyncedEvents.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400 font-medium">
            暂无未推送的本地事件，所有状态均已同步至 Git 远程。
          </div>
        ) : (
          <div className="space-y-2">
            {unsyncedEvents.map(evt => (
              <div key={evt.event_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
                  <span className="font-mono text-[11px] text-slate-400 font-bold">{evt.event_id}</span>
                  <span className="text-slate-800 font-semibold">{evt.summary}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {new Date(evt.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
