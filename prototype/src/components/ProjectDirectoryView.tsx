import React from 'react';
import { FolderGit2, GitBranch, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Project, Task } from '../types';

interface ProjectDirectoryViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProject: (project: Project) => void;
}

export const ProjectDirectoryView: React.FC<ProjectDirectoryViewProps> = ({ projects, tasks, onSelectProject }) => (
  <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5 sm:p-8">
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold text-indigo-600 mb-2">AGENT TASK SYNC</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">我的项目</h1>
        <p className="text-sm text-slate-500 mt-1">从 GitHub 仓库进入项目，再继续具体任务。</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(project => {
          const projectTasks = tasks.filter(task => task.project === project.id);
          const active = projectTasks.filter(task => task.status === 'in_progress').length;
          const needsAttention = projectTasks.filter(task => task.status === 'blocked' || task.status === 'needs_review' || task.status === 'handoff_ready').length;
          return (
            <button key={project.id} onClick={() => onSelectProject(project)} className="text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><FolderGit2 className="h-5 w-5" /></div>
                  <div className="min-w-0"><h2 className="font-bold text-slate-900 truncate">{project.name}</h2><p className="text-xs text-slate-400 font-mono truncate mt-1">{project.repo}</p></div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mt-4 line-clamp-2">{project.description}</p>
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span>{projectTasks.length} 个任务</span><span>{active} 个进行中</span>
                {needsAttention > 0 && <span className="flex items-center gap-1 text-amber-700"><AlertCircle className="h-3.5 w-3.5" />{needsAttention} 项待处理</span>}
                <span className="ml-auto flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" />{project.defaultBranch}</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400"><RefreshCw className="h-3 w-3" />{project.syncState === 'synced' ? '已同步' : `本地领先 ${project.unsyncedCount} 条`}</div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
