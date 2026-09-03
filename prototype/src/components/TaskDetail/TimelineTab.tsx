import React, { useState } from 'react';
import { 
  History, 
  GitCommit, 
  FileCode2, 
  CheckCircle2, 
  Radio, 
  Code2, 
  ChevronDown, 
  ChevronUp, 
  Filter
} from 'lucide-react';
import { TaskEvent, Task } from '../../types';
import { getAgentBadge, getDeviceLabel } from '../TaskCard';

interface TimelineTabProps {
  task: Task;
  events: TaskEvent[];
}

export const getEventTypeBadge = (type: TaskEvent['type']) => {
  switch (type) {
    case 'task_created':
      return { label: 'Task Created', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'task_claimed':
      return { label: 'Claimed', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'progress':
      return { label: 'Progress', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'phase_started':
      return { label: 'Phase Started', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'phase_completed':
      return { label: 'Phase Done', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'blocked':
      return { label: 'Blocked', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'unblocked':
      return { label: 'Unblocked', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'decision_recorded':
      return { label: 'Decision', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'test_result':
      return { label: 'Test Result', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'handoff_created':
      return { label: 'Handoff Out', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'handoff_accepted':
      return { label: 'Handoff Accepted', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
    case 'conflict_detected':
      return { label: 'Conflict', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'conflict_resolved':
      return { label: 'Conflict Resolved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'task_completed':
      return { label: 'Completed', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    default:
      return { label: type, bg: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
};

export const TimelineTab: React.FC<TimelineTabProps> = ({ task, events }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredEvents = events.filter(evt => {
    if (filterType === 'all') return true;
    return evt.type === filterType;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-card">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">不可变事件审计流 (Append-Only JSONL)</span>
          <span className="text-xs font-mono font-semibold text-slate-400">({events.length} 条记录)</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="all">全部类型</option>
            <option value="progress">Progress 进度</option>
            <option value="phase_completed">阶段完成</option>
            <option value="decision_recorded">关键决策</option>
            <option value="test_result">测试结果</option>
            <option value="handoff_created">Handoff 交接</option>
            <option value="conflict_detected">冲突记录</option>
          </select>
        </div>
      </div>

      {/* Events Timeline List */}
      <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
        {filteredEvents.map((evt) => {
          const typeInfo = getEventTypeBadge(evt.type);
          const agentInfo = getAgentBadge(evt.agent_id);
          const isExpanded = !!expandedEvents[evt.event_id];

          return (
            <div key={evt.event_id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-6 top-3.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 shadow-sm group-hover:scale-125 transition-transform" />

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card hover:border-slate-300 transition-all">
                {/* Event Top Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${typeInfo.bg}`}>
                      {typeInfo.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">
                      {evt.event_id}
                    </span>
                    {!evt.synced && (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.2 rounded-full">
                        <Radio className="h-2 w-2 text-sky-600 animate-pulse" />
                        本地未同步
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className={`px-2 py-0.2 rounded-md border text-[10px] font-semibold ${agentInfo.bg}`}>
                      {agentInfo.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {getDeviceLabel(evt.device_id)}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Event Summary */}
                <p className="text-xs font-semibold text-slate-900 leading-relaxed mb-2">
                  {evt.summary}
                </p>

                {evt.details && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-2 leading-relaxed">
                    {evt.details}
                  </p>
                )}

                {/* Badges: Files, Commit, Tests */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap pt-1 border-t border-slate-100">
                  {evt.files && evt.files.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FileCode2 className="h-3 w-3 text-slate-400" />
                      <span className="font-mono text-[10px] text-slate-600">{evt.files.join(', ')}</span>
                    </div>
                  )}

                  {evt.commit && (
                    <div className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3 text-indigo-600" />
                      <span className="font-mono text-[10px] font-bold text-indigo-700">{evt.commit}</span>
                    </div>
                  )}

                  {evt.test_status && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className={`h-3 w-3 ${evt.test_status === 'passed' ? 'text-emerald-600' : 'text-rose-600'}`} />
                      <span className="text-[10px] font-mono font-medium capitalize text-slate-700">测试: {evt.test_status}</span>
                    </div>
                  )}

                  <button
                    onClick={() => toggleExpand(evt.event_id)}
                    className="ml-auto text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5 font-medium"
                  >
                    <Code2 className="h-3 w-3" />
                    <span>{isExpanded ? '收起 JSON' : '查看 JSON'}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {/* Expandable JSON Raw View */}
                {isExpanded && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-200 overflow-x-auto shadow-inner">
                    <pre>{JSON.stringify(evt, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
