import React from 'react';
import { 
  Bot, 
  Laptop, 
  Clock, 
  GitBranch, 
  AlertCircle, 
  ArrowRight, 
  FileCheck, 
  Layers, 
  Radio
} from 'lucide-react';
import { Task, AgentId, DeviceId } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onQuickCheckpoint?: (task: Task) => void;
}

export const getAgentBadge = (agentId?: AgentId) => {
  switch (agentId) {
    case 'codex':
      return {
        name: 'Codex',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        dot: 'bg-emerald-500'
      };
    case 'claude':
      return {
        name: 'Claude Code',
        bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dot: 'bg-amber-500'
      };
    case 'pi':
      return {
        name: 'Pi Agent',
        bg: 'bg-purple-50 text-purple-800 border-purple-200/80',
        dot: 'bg-purple-500'
      };
    case 'cursor':
      return {
        name: 'Cursor',
        bg: 'bg-sky-50 text-sky-800 border-sky-200/80',
        dot: 'bg-sky-500'
      };
    case 'human':
      return {
        name: 'Human User',
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-500'
      };
    default:
      return {
        name: 'Unassigned',
        bg: 'bg-slate-100 text-slate-400 border-slate-200',
        dot: 'bg-slate-400'
      };
  }
};

export const getDeviceLabel = (deviceId?: DeviceId) => {
  switch (deviceId) {
    case 'macbook-pro':
      return 'MacBook Pro';
    case 'windows-desktop':
      return 'Windows PC';
    case 'linux-dev':
      return 'Linux Server';
    default:
      return '未绑定设备';
  }
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const agentInfo = getAgentBadge(task.assigned_agent);
  
  // Calculate completed phases
  const totalPhases = task.phases.length;
  const completedPhases = task.phases.filter(p => p.status === 'completed').length;
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const currentPhase = task.phases.find(p => p.id === task.current_phase_id) || task.phases[0];

  return (
    <div 
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-card hover:border-slate-300 hover:shadow-card-hover transition-all cursor-pointer hover:-translate-y-0.5"
    >
      {/* Top badges: ID, Unsynced, Conflict, Handoff */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
            {task.id}
          </span>
          {task.status === 'needs_review' && task.conflict && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              <AlertCircle className="h-3 w-3 text-rose-500" />
              <span>并发冲突</span>
            </span>
          )}
          {task.status === 'handoff_ready' && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
              <FileCheck className="h-3 w-3 text-purple-500" />
              <span>Handoff 就绪</span>
            </span>
          )}
          {task.status === 'blocked' && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              <span>已阻塞</span>
            </span>
          )}
        </div>

        {task.unsynced_events_count > 0 && (
          <span 
            title={`${task.unsynced_events_count} 条事件尚未 push 到 Git 远程`}
            className="flex items-center gap-1 text-[10px] font-mono font-medium text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full"
          >
            <Radio className="h-2 w-2 text-sky-600 animate-pulse" />
            <span>+{task.unsynced_events_count} 待同步</span>
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2 leading-snug">
        {task.title}
      </h3>

      {/* Goal / Next Step Highlight */}
      {totalPhases > 0 ? <div className="rounded-lg bg-slate-50/80 p-2.5 border border-slate-100 mb-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-slate-400" />
            <span>阶段进度 ({completedPhases}/{totalPhases})</span>
          </span>
          <span className="font-mono font-semibold text-slate-700">{progressPercent}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden mb-1.5">
          <div 
            className={`h-full transition-all duration-300 rounded-full ${
              task.status === 'completed' 
                ? 'bg-emerald-500' 
                : task.status === 'needs_review' 
                ? 'bg-rose-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {currentPhase && (
          <div className="text-[11px] text-slate-700 truncate font-medium">
            当前: <span className="text-slate-900">{currentPhase.title}</span>
          </div>
        )}

        {task.next_action && (
          <div className="mt-1.5 text-[10px] text-slate-500 flex items-start gap-1">
            <ArrowRight className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
            <span className="line-clamp-1 italic text-slate-700">{task.next_action}</span>
          </div>
        )}
      </div> : <div className="rounded-lg bg-slate-50/80 p-2.5 border border-slate-100 mb-3 text-[11px] text-slate-500">{task.current_focus || '未定义阶段，按当前状态推进'}</div>}

      {/* Footer: Agent, Device, Checkpoint */}
      <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
        {/* Agent & Device */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium truncate ${agentInfo.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${agentInfo.dot}`} />
            <span className="truncate">{agentInfo.name}</span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
            {getDeviceLabel(task.assigned_device)}
          </span>
        </div>

        {/* Last Checkpoint time */}
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono shrink-0">
          <Clock className="h-2.5 w-2.5" />
          <span>{new Date(task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};
