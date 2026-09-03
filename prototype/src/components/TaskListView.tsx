import React, { useState } from 'react';
import { 
  Search, 
  Bot, 
  Laptop, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  FileCheck, 
  Clock, 
  ArrowRight, 
  Radio, 
  Plus, 
  X,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { Task, AgentId, DeviceId, Project } from '../types';
import { ViewFilter } from './SidebarNav';
import { getAgentBadge, getDeviceLabel } from './TaskCard';

interface TaskListViewProps {
  tasks: Task[];
  activeView: ViewFilter;
  currentProject: Project;
  onSelectTask: (taskId: string) => void;
  onOpenNewTask: () => void;
  agentFilter: AgentId | 'all';
  onSelectAgentFilter: (agent: AgentId | 'all') => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  activeView,
  currentProject,
  onSelectTask,
  onOpenNewTask,
  agentFilter,
  onSelectAgentFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceId | 'all'>('all');
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // 0. Project filter
    if (!showAllProjects && task.project !== currentProject.id) return false;

    // 1. View filter
    if (activeView === 'in_progress' && task.status !== 'in_progress') return false;
    if (activeView === 'conflicts' && task.status !== 'needs_review' && (!task.conflict || task.conflict.resolved)) return false;
    if (activeView === 'handoff_ready' && task.status !== 'handoff_ready') return false;
    if (activeView === 'blocked' && task.status !== 'blocked') return false;
    if (activeView === 'completed' && task.status !== 'completed') return false;

    // 2. Agent filter
    if (agentFilter !== 'all' && task.assigned_agent !== agentFilter) return false;

    // 3. Device filter
    if (deviceFilter !== 'all' && task.assigned_device !== deviceFilter) return false;

    // 4. Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchGoal = task.goal.toLowerCase().includes(q);
      const matchId = task.id.toLowerCase().includes(q);
      if (!matchTitle && !matchGoal && !matchId) return false;
    }

    return true;
  });

  const getViewTitle = () => {
    switch (activeView) {
      case 'all': return { title: '全部任务 (All Tasks)', desc: '当前项目下由各 Agent 和人工维护的所有任务单元' };
      case 'in_progress': return { title: '执行中的任务 (In Progress)', desc: '当前各设备上的 Agent 正在活跃处理的任务' };
      case 'conflicts': return { title: '冲突与待审阅 (Conflicts & Review)', desc: '由于多端离线并发写入产生互斥、需要人工合并的任务' };
      case 'handoff_ready': return { title: '交接就绪 (Handoff Ready)', desc: '已由前任 Agent 生成完整交接包、等待下任 Agent 认领的任务' };
      case 'blocked': return { title: '已阻塞 (Blocked)', desc: '遇到外部依赖或需要用户决策、暂停执行的任务' };
      case 'completed': return { title: '已完成 (Completed)', desc: '已完成全部阶段验收并通过测试的任务' };
    }
  };

  const viewInfo = getViewTitle();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/60">
      {/* Header & Filter Toolbar */}
      <div className="p-4 sm:px-6 bg-white border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {viewInfo.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{viewInfo.desc}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewTask}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm shadow-indigo-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新建任务</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索任务标题、目标、ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
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

          {/* Device Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700">
            <Laptop className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400">设备:</span>
            <select
              value={deviceFilter}
              onChange={e => setDeviceFilter(e.target.value as any)}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全部设备</option>
              <option value="macbook-pro">MacBook Pro</option>
              <option value="windows-desktop">Windows PC</option>
              <option value="linux-dev">Linux Server</option>
            </select>
          </div>

          {/* Project Scope Toggle */}
          <button
            onClick={() => setShowAllProjects(!showAllProjects)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
              showAllProjects
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-subtle'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{showAllProjects ? '🌐 显示全部项目任务' : `📁 仅当前项目: ${currentProject.name}`}</span>
          </button>

          {(searchQuery || deviceFilter !== 'all' || agentFilter !== 'all' || showAllProjects) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDeviceFilter('all');
                onSelectAgentFilter('all');
                setShowAllProjects(false);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2"
            >
              重置筛选
            </button>
          )}

          <div className="text-[11px] font-mono text-slate-400 ml-auto">
            共 <span className="font-bold text-slate-700">{filteredTasks.length}</span> 项任务
          </div>
        </div>
      </div>

      {/* Task List Grid/Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white p-6">
            <Layers className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">未找到符合条件的任务</p>
            <p className="text-xs text-slate-400 mt-1">尝试更改左侧导航视图或清除筛选条件</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const agentInfo = getAgentBadge(task.assigned_agent);
            const totalPhases = task.phases.length;
            const completedPhases = task.phases.filter(p => p.status === 'completed').length;
            const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
            const currentPhase = task.phases.find(p => p.id === task.current_phase_id) || task.phases[0];

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-card hover:border-indigo-300 hover:shadow-card-hover transition-all cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Info: ID, Title, Badges */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {task.id}
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

                      {task.status === 'needs_review' && task.conflict && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3 text-rose-600" />
                          <span>并发冲突待合并</span>
                        </span>
                      )}

                      {task.status === 'handoff_ready' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          <FileCheck className="h-3 w-3 text-purple-600" />
                          <span>已就绪待交接</span>
                        </span>
                      )}

                      {task.unsynced_events_count > 0 && (
                        <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                          +{task.unsynced_events_count} 待推送
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {task.title}
                    </h2>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {task.goal}
                    </p>

                    {/* Prominent Next Action Banner */}
                    {task.next_action && (
                      <div className="flex items-center gap-2 text-xs bg-slate-50 group-hover:bg-indigo-50/40 p-2.5 rounded-xl border border-slate-100 group-hover:border-indigo-100 transition-colors w-fit">
                        <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span className="font-bold text-indigo-950">下一步行动: </span>
                        <span className="text-slate-700 font-medium italic">{task.next_action}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Info: Phase Progress & Assignee Identity */}
                  <div className="flex flex-row lg:flex-col lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Optional phase progress */}
                    {totalPhases > 0 ? <div className="w-44 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Phase {currentPhase?.order || 1}/{totalPhases}</span>
                        <span className="font-mono font-bold text-slate-800">{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
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
                      <div className="text-[10px] text-slate-400 truncate">
                        {currentPhase?.title}
                      </div>
                    </div> : <div className="max-w-44 text-[11px] text-slate-500 text-right">{task.current_focus || '未定义阶段'}</div>}

                    {/* Agent & Device */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${agentInfo.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${agentInfo.dot}`} />
                        <span>{agentInfo.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                        {getDeviceLabel(task.assigned_device)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
