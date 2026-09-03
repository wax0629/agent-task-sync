import React from 'react';
import { 
  FolderGit2, 
  GitBranch, 
  RefreshCw, 
  Plus, 
  Bot, 
  Laptop, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  GitCommit, 
  Radio,
  FileCode2,
  ExternalLink
} from 'lucide-react';
import { Project, Task, AgentId } from '../types';
import { getAgentBadge, getDeviceLabel } from './TaskCard';

interface ProjectOverviewViewProps {
  project: Project;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onOpenNewTask: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  isOffline: boolean;
}

export const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = ({
  project,
  tasks,
  onSelectTask,
  onOpenNewTask,
  onTriggerSync,
  isSyncing,
  isOffline
}) => {
  const projectTasks = tasks.filter(t => t.project === project.id);
  const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress');
  const conflictTasks = projectTasks.filter(t => t.status === 'needs_review' || (t.conflict && !t.conflict.resolved));
  const handoffTasks = projectTasks.filter(t => t.status === 'handoff_ready');
  const completedTasks = projectTasks.filter(t => t.status === 'completed');

  // Total phases
  const allPhases = projectTasks.flatMap(t => t.phases);
  const completedPhases = allPhases.filter(p => p.status === 'completed').length;
  const totalPhases = allPhases.length;
  const projectProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* 1. Project Hero Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold">
              <FolderGit2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {project.name}
                </h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200/60 font-mono">
                  {project.id}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  project.syncState === 'synced'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : project.syncState === 'conflict'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {project.syncState === 'synced' ? 'Git 已同步' : `${project.unsyncedCount} 条待推送`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {project.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onTriggerSync}
              disabled={isSyncing || isOffline}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isSyncing ? '同步中...' : '同步 Git 远程'}</span>
            </button>
            <button
              onClick={onOpenNewTask}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>新建任务单元</span>
            </button>
          </div>
        </div>

        {/* Repository & System Path Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-mono">
            <GitBranch className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="truncate">{project.repo}:{project.defaultBranch}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-mono">
            <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">.task-sync/ (Schema v0.1)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <span>最近同步: {new Date(project.lastSyncedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* 2. Core Project Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card space-y-1">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">任务总量</div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{projectTasks.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">{totalPhases > 0 ? `总计包含 ${totalPhases} 个执行阶段` : '阶段由任务自行决定'}</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card space-y-1">
          <div className="text-indigo-700 font-bold uppercase tracking-wider text-[10px]">活跃执行中</div>
          <div className="text-2xl font-bold text-indigo-600 font-mono">{inProgressTasks.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">{project.activeAgents.join(', ')} 正在推进</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card space-y-1">
          <div className="text-rose-700 font-bold uppercase tracking-wider text-[10px]">冲突与待审阅</div>
          <div className="text-2xl font-bold text-rose-600 font-mono">{conflictTasks.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">需要人工确认解决方案</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card space-y-1">
          <div className="text-purple-700 font-bold uppercase tracking-wider text-[10px]">Handoff 交接就绪</div>
          <div className="text-2xl font-bold text-purple-600 font-mono">{handoffTasks.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">已完成 5 项完整性检查</div>
        </div>
      </div>

      {/* 3. Project Tasks Pipeline */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">该项目所属任务列表 (Project Task Pipeline)</h3>
            <p className="text-xs text-slate-500 mt-0.5">点击任意任务可直接进入深度工作区与不可变事件审计流</p>
          </div>
          <span className="text-xs font-mono text-slate-400 font-semibold">
            {totalPhases > 0 ? `${completedPhases}/${totalPhases} 阶段已完成 (${projectProgress}%)` : '以任务状态和下一步为准'}
          </span>
        </div>

        <div className="space-y-3">
          {projectTasks.map(task => {
            const agentInfo = getAgentBadge(task.assigned_agent);
            const currentPhase = task.phases.find(p => p.id === task.current_phase_id) || task.phases[0];

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-card transition-all cursor-pointer group"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {task.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'needs_review'
                        ? 'bg-rose-100 text-rose-800 animate-pulse'
                        : task.status === 'handoff_ready'
                        ? 'bg-purple-100 text-purple-800'
                        : task.status === 'blocked'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {task.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {task.title}
                  </h4>

                  {task.next_action && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-indigo-500" />
                      <span className="italic">{task.next_action}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${agentInfo.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${agentInfo.dot}`} />
                    <span>{agentInfo.name}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
