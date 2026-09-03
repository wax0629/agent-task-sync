import React, { useState } from 'react';
import { 
  FolderGit2, 
  Layers, 
  PlayCircle, 
  AlertCircle, 
  FileCheck, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Bot, 
  Laptop, 
  Radio, 
  Wifi, 
  WifiOff, 
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  GitBranch,
  Home,
  FolderOpen,
  PanelLeft
} from 'lucide-react';
import { Task, Project, AgentId, DeviceId, TaskStatus } from '../types';

export type ViewFilter = 'all' | 'in_progress' | 'conflicts' | 'handoff_ready' | 'blocked' | 'completed';

// What screen the center area should display
export type CenterView = 
  | { type: 'project_directory' }
  | { type: 'project_overview' }
  | { type: 'task_list'; filter: ViewFilter }
  | { type: 'task_detail'; taskId: string };

interface SidebarNavProps {
  projects: Project[];
  currentProject: Project;
  onSelectProject: (project: Project) => void;
  onOpenNewProject: () => void;
  tasks: Task[];
  centerView: CenterView;
  onNavigate: (view: CenterView) => void;
  onOpenNewTask: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  agentFilter: AgentId | 'all';
  onSelectAgentFilter: (agent: AgentId | 'all') => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onOpenNewProject,
  tasks,
  centerView,
  onNavigate,
  onOpenNewTask,
  isOffline,
  onToggleOffline,
  agentFilter,
  onSelectAgentFilter
}) => {
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);

  // Filter tasks by current project
  const projectTasks = tasks.filter(t => t.project === currentProject.id);

  // Compute counts
  const countAll = projectTasks.length;
  const countInProgress = projectTasks.filter(t => t.status === 'in_progress').length;
  const countConflicts = projectTasks.filter(t => t.status === 'needs_review' || (t.conflict && !t.conflict.resolved)).length;
  const countHandoff = projectTasks.filter(t => t.status === 'handoff_ready').length;
  const countBlocked = projectTasks.filter(t => t.status === 'blocked').length;
  const countCompleted = projectTasks.filter(t => t.status === 'completed').length;

  const navItems = [
    { id: 'all' as ViewFilter, label: '全部任务', icon: Layers, count: countAll, badgeColor: 'bg-slate-200 text-slate-700' },
    { id: 'in_progress' as ViewFilter, label: '执行中', icon: PlayCircle, count: countInProgress, badgeColor: 'bg-indigo-100 text-indigo-800' },
    { id: 'conflicts' as ViewFilter, label: '冲突与待审阅', icon: ShieldAlert, count: countConflicts, badgeColor: 'bg-rose-100 text-rose-800 font-bold', highlight: countConflicts > 0 },
    { id: 'handoff_ready' as ViewFilter, label: '交接就绪 (Handoff)', icon: FileCheck, count: countHandoff, badgeColor: 'bg-purple-100 text-purple-800' },
    { id: 'blocked' as ViewFilter, label: '已阻塞', icon: AlertCircle, count: countBlocked, badgeColor: 'bg-amber-100 text-amber-800' },
    { id: 'completed' as ViewFilter, label: '已完成', icon: CheckCircle2, count: countCompleted, badgeColor: 'bg-emerald-100 text-emerald-800' },
  ];

  // Unique active agents for current project
  const activeAgentEntries: { id: AgentId; name: string; device: string; dot: string; bg: string; taskCount: number }[] = [];
  const agentMap: Record<string, { count: number }> = {};
  projectTasks.forEach(t => {
    if (t.assigned_agent) {
      agentMap[t.assigned_agent] = agentMap[t.assigned_agent] || { count: 0 };
      agentMap[t.assigned_agent].count++;
    }
  });

  const agentMeta: Record<string, { name: string; device: string; dot: string; bg: string; selectedBg: string; selectedBorder: string }> = {
    codex: { name: 'Codex', device: 'MacBook Pro', dot: 'bg-emerald-500', bg: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700', selectedBg: 'border-emerald-300 bg-emerald-50/60 text-emerald-900 shadow-subtle', selectedBorder: 'border-emerald-300' },
    claude: { name: 'Claude Code', device: 'Windows PC', dot: 'bg-amber-500', bg: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700', selectedBg: 'border-amber-300 bg-amber-50/60 text-amber-900 shadow-subtle', selectedBorder: 'border-amber-300' },
    pi: { name: 'Pi Extension', device: 'MacBook Pro', dot: 'bg-purple-400', bg: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700', selectedBg: 'border-purple-300 bg-purple-50/60 text-purple-900 shadow-subtle', selectedBorder: 'border-purple-300' },
    cursor: { name: 'Cursor Agent', device: 'MacBook Pro', dot: 'bg-sky-500', bg: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700', selectedBg: 'border-sky-300 bg-sky-50/60 text-sky-900 shadow-subtle', selectedBorder: 'border-sky-300' },
    human: { name: 'Human', device: '—', dot: 'bg-slate-400', bg: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700', selectedBg: 'border-slate-300 bg-slate-50/60 text-slate-900 shadow-subtle', selectedBorder: 'border-slate-300' },
  };

  Object.keys(agentMap).forEach(agentId => {
    const meta = agentMeta[agentId] || agentMeta.human;
    activeAgentEntries.push({
      id: agentId as AgentId,
      name: meta.name,
      device: meta.device,
      dot: meta.dot,
      bg: agentFilter === agentId ? meta.selectedBg : meta.bg,
      taskCount: agentMap[agentId].count
    });
  });

  const isProjectOverview = centerView.type === 'project_overview';
  const isProjectDirectory = centerView.type === 'project_directory';
  const isTaskList = centerView.type === 'task_list';

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col h-full shrink-0 select-none">
      {/* 1. Project Switcher */}
      <div className="p-3.5 border-b border-slate-100">
        <button
          onClick={() => setIsProjectListOpen(!isProjectListOpen)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-subtle text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 font-bold shrink-0">
            <FolderGit2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">
              {currentProject.name}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono truncate">
              <GitBranch className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{currentProject.defaultBranch}</span>
              {currentProject.unsyncedCount > 0 && (
                <span className="text-indigo-600 font-bold ml-1">+{currentProject.unsyncedCount}</span>
              )}
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${isProjectListOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Project Dropdown */}
        {isProjectListOpen && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-fadeIn">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              项目仓库列表 (Projects)
            </div>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProject(p);
                  setIsProjectListOpen(false);
                  onNavigate({ type: 'project_overview' });
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-colors ${
                  p.id === currentProject.id
                    ? 'bg-indigo-50 text-indigo-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="truncate">
                  <div className="truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{p.repo}</div>
                </div>
                {p.id === currentProject.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-1" />}
              </button>
            ))}
            <button
              onClick={() => {
                onOpenNewProject();
                setIsProjectListOpen(false);
              }}
              className="flex w-full items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors mt-1 border-t border-slate-100 pt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新建项目仓库</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <button
            onClick={() => onNavigate({ type: 'project_directory' })}
            className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isProjectDirectory ? 'bg-indigo-50 text-indigo-700 shadow-subtle' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FolderOpen className={`h-4 w-4 ${isProjectDirectory ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>所有项目</span>
          </button>
        </div>

        {/* Project Overview */}
        <div>
          <button
            onClick={() => onNavigate({ type: 'project_overview' })}
            className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isProjectOverview
                ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Home className={`h-4 w-4 ${isProjectOverview ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>项目总览 (Overview)</span>
          </button>
        </div>

        {/* Task View Filters */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            任务工作视图 (Task Views)
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isTaskList && centerView.type === 'task_list' && centerView.filter === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate({ type: 'task_list', filter: item.id })}
                  className={`flex w-full items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-subtle'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'} ${item.highlight ? 'text-rose-600 animate-pulse' : ''}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${item.badgeColor}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Agent Online Matrix */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Agent 在线矩阵 (Active Agents)
          </div>
          <div className="space-y-1">
            {activeAgentEntries.map(agent => (
              <button
                key={agent.id}
                onClick={() => onSelectAgentFilter(agentFilter === agent.id ? 'all' : agent.id)}
                className={`flex w-full items-center justify-between p-2 rounded-xl border text-xs text-left transition-all ${agent.bg}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${agent.dot} ${agent.taskCount > 0 ? 'animate-pulse' : ''}`} />
                  <div>
                    <div className="font-bold text-[11px]">{agent.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{agent.device}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {agent.taskCount} {agent.taskCount === 1 ? 'task' : 'tasks'}
                </span>
              </button>
            ))}

            {activeAgentEntries.length === 0 && (
              <div className="text-[11px] text-slate-400 italic px-2 py-1">该项目暂无活跃 Agent</div>
            )}
          </div>
        </div>

        {/* New Task Quick Button */}
        <button
          onClick={onOpenNewTask}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 text-indigo-400" />
          <span>新建任务 (New Task)</span>
        </button>
      </div>

      {/* 3. Bottom Footer: Offline Mode Toggle */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={onToggleOffline}
          className={`flex w-full items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
            isOffline
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {isOffline ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-700" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span>{isOffline ? '离线事件暂存模式' : 'Git 远程在线'}</span>
          </div>
          <span className="text-[10px] font-mono uppercase">{isOffline ? 'OFFLINE' : 'ONLINE'}</span>
        </button>
      </div>
    </aside>
  );
};
