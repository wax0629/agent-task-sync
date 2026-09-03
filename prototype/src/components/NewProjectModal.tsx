import React, { useState } from 'react';
import { 
  X, 
  FolderGit2, 
  CheckCircle2, 
  GitBranch, 
  Plus
} from 'lucide-react';
import { Project } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repo, setRepo] = useState('github.com/organization/');
  const [defaultBranch, setDefaultBranch] = useState('main');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    const projectId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `proj-${Date.now()}`;

    const newProj: Project = {
      id: projectId,
      name: name.trim(),
      description: description.trim() || '人机协同开发任务与上下文同步仓库',
      repo: repo.trim(),
      defaultBranch: defaultBranch.trim() || 'main',
      syncState: 'synced',
      unsyncedCount: 0,
      lastSyncedAt: new Date().toISOString(),
      activeAgents: ['codex', 'claude'],
      created_at: new Date().toISOString()
    };

    onCreateProject(newProj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">新建协同项目仓库 (New Project)</h3>
              <p className="text-[11px] text-slate-500">初始化 `.task-sync/` 并绑定 Git 远程仓库</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs bg-white">
          <div>
            <label className="block text-slate-700 font-bold mb-1">项目名称 (Project Name)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如: Pi Agent Extension"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold shadow-subtle"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">一句话描述 (Description)</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述该项目要实现的目标与架构定位..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">关联 Git 仓库 (Repo URL)</label>
              <input
                type="text"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                placeholder="github.com/organization/repo"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-mono text-[11px] shadow-subtle"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">默认主分支 (Default Branch)</label>
              <input
                type="text"
                value={defaultBranch}
                onChange={e => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-mono text-[11px] shadow-subtle"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            * 遵循 PRD 规范：新项目将在本地自动创建 <span className="font-mono text-indigo-700 font-semibold">.task-sync/config.yaml</span> 与 <span className="font-mono text-indigo-700 font-semibold">tasks/</span> 目录，所有任务事件将通过 Git 分支自动同步。
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50/70">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              name.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>创建项目并初始化仓库</span>
          </button>
        </div>
      </div>
    </div>
  );
};
