import React, { useState } from 'react';
import { 
  Search, 
  Bot, 
  Laptop, 
  Plus, 
  X
} from 'lucide-react';
import { Task, TaskStatus, AgentId, DeviceId } from '../types';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenNewTask: () => void;
}

const COLUMNS: { id: TaskStatus; title: string; desc: string; color: string; badgeBg: string; borderTop: string }[] = [
  {
    id: 'planned',
    title: '已计划 (Planned)',
    desc: '已创建目标与阶段，待认领',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-200/80 text-slate-700',
    borderTop: 'border-t-slate-400'
  },
  {
    id: 'in_progress',
    title: '执行中 (In Progress)',
    desc: 'Agent 或人类正在推进',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    borderTop: 'border-t-indigo-600'
  },
  {
    id: 'blocked',
    title: '已阻塞 (Blocked)',
    desc: '遇到外部依赖或等待决策',
    color: 'text-amber-800',
    badgeBg: 'bg-amber-100 text-amber-800',
    borderTop: 'border-t-amber-500'
  },
  {
    id: 'needs_review',
    title: '待审阅/冲突 (Needs Review)',
    desc: '并发冲突或方案待人工批准',
    color: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800',
    borderTop: 'border-t-rose-500'
  },
  {
    id: 'handoff_ready',
    title: '交接就绪 (Handoff Ready)',
    desc: '已生成 Handoff 包，等待下任接收',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800',
    borderTop: 'border-t-purple-500'
  },
  {
    id: 'completed',
    title: '已完成 (Completed)',
    desc: '阶段目标已达成并通过验证',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    borderTop: 'border-t-emerald-500'
  }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  onOpenNewTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentId | 'all'>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceId | 'all'>('all');

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAgent = agentFilter === 'all' || task.assigned_agent === agentFilter;
    const matchesDevice = deviceFilter === 'all' || task.assigned_device === deviceFilter;

    return matchesSearch && matchesAgent && matchesDevice;
  });

  const isFiltering = searchQuery !== '' || agentFilter !== 'all' || deviceFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setAgentFilter('all');
    setDeviceFilter('all');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-50/70">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 lg:px-6 py-2">
        <div className="flex items-center gap-3 flex-1 min-w-[260px] max-w-md">
          {/* Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索任务标题、目标、ID..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-subtle"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* Agent Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-subtle">
            <Bot className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500">Agent:</span>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value as any)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全部 Agent</option>
              <option value="codex">Codex</option>
              <option value="claude">Claude Code</option>
              <option value="pi">Pi Agent</option>
              <option value="cursor">Cursor</option>
              <option value="human">人工 (Human)</option>
            </select>
          </div>

          {/* Device Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-subtle">
            <Laptop className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500">设备:</span>
            <select
              value={deviceFilter}
              onChange={e => setDeviceFilter(e.target.value as any)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全部设备</option>
              <option value="macbook-pro">MacBook Pro</option>
              <option value="windows-desktop">Windows PC</option>
              <option value="linux-dev">Linux Server</option>
            </select>
          </div>

          {/* Reset Filters */}
          {isFiltering && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 font-medium"
            >
              <X className="h-3 w-3" />
              <span>清空筛选</span>
            </button>
          )}

          <div className="text-[11px] text-slate-400 pl-2">
            共 <span className="font-mono font-semibold text-slate-700">{filteredTasks.length}</span> 个任务
          </div>
        </div>
      </div>

      {/* Kanban Columns (Horizontal Scroll) */}
      <div className="flex-1 overflow-x-auto p-4 lg:p-6">
        <div className="flex items-start gap-4 min-w-max h-full pb-4">
          {COLUMNS.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);

            return (
              <div
                key={col.id}
                className={`flex flex-col w-80 max-h-full rounded-2xl border border-slate-200/90 bg-slate-100/60 shadow-subtle border-t-2 ${col.borderTop}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-3 border-b border-slate-200/70 bg-white/70 rounded-t-2xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold text-xs tracking-tight truncate ${col.color}`}>
                      {col.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${col.badgeBg}`}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {col.id === 'planned' && (
                    <button
                      onClick={onOpenNewTask}
                      title="新建任务"
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[140px]">
                  {columnTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 rounded-xl border border-dashed border-slate-200 bg-white/30 p-4">
                      <p className="text-xs font-medium text-slate-500">暂无任务</p>
                      <p className="text-[10px] text-slate-400 mt-1">{col.desc}</p>
                    </div>
                  ) : (
                    columnTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onSelectTask(task)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
