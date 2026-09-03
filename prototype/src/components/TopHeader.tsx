import React, { useState } from 'react';
import { 
  FolderGit2, 
  RefreshCw, 
  Sparkles, 
  PlayCircle, 
  ChevronDown, 
  ArrowRight, 
  Bot, 
  GitBranch, 
  Radio,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Project } from '../types';

interface TopHeaderProps {
  currentProject: Project;
  projects: Project[];
  onSelectProject: (p: Project) => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  isOffline: boolean;
  hasConflict: boolean;
  isAgentHUDOpen: boolean;
  onToggleAgentHUD: () => void;
  onRunScenario: (scenario: 'A' | 'B' | 'C' | 'D') => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentProject,
  projects,
  onSelectProject,
  isSyncing,
  onTriggerSync,
  isOffline,
  hasConflict,
  isAgentHUDOpen,
  onToggleAgentHUD,
  onRunScenario
}) => {
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  return (
    <header className="h-14 border-b border-slate-200/80 bg-white px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0 z-20">
      {/* Left: Project Selector & Repository Info */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-subtle"
          >
            <FolderGit2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>{currentProject.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProjectDropdown && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-fadeIn">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                切换代码仓库 / 项目
              </div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p);
                    setShowProjectDropdown(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs text-left transition-colors ${
                    p.id === currentProject.id
                      ? 'bg-indigo-50 text-indigo-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div>
                    <div>{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{p.repo}</div>
                  </div>
                  {p.id === currentProject.id && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          <GitBranch className="h-3 w-3 text-slate-400" />
          <span>{currentProject.repo}:{currentProject.defaultBranch}</span>
        </div>
      </div>

      {/* Center: Scenario Launcher (Path A, B, C, D) */}
      <div className="relative">
        <button
          onClick={() => setShowScenarioMenu(!showScenarioMenu)}
          className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all shadow-subtle"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          <span>核心闭环验证 (Path A / B / C / D)</span>
          <ChevronDown className="h-3 w-3 text-indigo-500" />
        </button>

        {showScenarioMenu && (
          <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-88 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl z-50 animate-fadeIn">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <PlayCircle className="h-4 w-4 text-indigo-600" />
                <span>一键触发 4 条原型闭环路径</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">PRD §11</span>
            </div>
            
            <div className="mt-2.5 space-y-1.5 text-xs">
              <button
                onClick={() => {
                  onRunScenario('A');
                  setShowScenarioMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-center justify-between text-slate-800 font-bold group-hover:text-indigo-600">
                  <span>路径 A：从看板继续并推进 Checkpoint</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">看板定位「实现 GitHub 同步」→ 查看下一步 → 记录 Checkpoint 推进</p>
              </button>

              <button
                onClick={() => {
                  onRunScenario('B');
                  setShowScenarioMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-center justify-between text-slate-800 font-bold group-hover:text-indigo-600">
                  <span>路径 B：Agent 对话侧栏建议创建任务</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Agent 识别新项目 → 弹出确认摘要 → 确认创建并写入事件</p>
              </button>

              <button
                onClick={() => {
                  onRunScenario('C');
                  setShowScenarioMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-center justify-between text-slate-800 font-bold group-hover:text-indigo-600">
                  <span>路径 C：跨设备 Handoff 交接闭环</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Mac/Codex 发起 Handoff → 5项校验 → Windows/Claude 接受并认领</p>
              </button>

              <button
                onClick={() => {
                  onRunScenario('D');
                  setShowScenarioMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-center justify-between text-slate-800 font-bold group-hover:text-indigo-600">
                  <span>路径 D：并发冲突可视化对比与合并</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">两端离线写入冲突 → 对比差异 → 选择合并方案并追加解决事件</p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Sync Status & Agent HUD toggle */}
      <div className="flex items-center gap-2.5">
        {/* Global Git Sync button */}
        <button
          onClick={onTriggerSync}
          disabled={isSyncing || isOffline}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
            hasConflict
              ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 animate-pulse'
              : currentProject.unsyncedCount > 0
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
          <span className="hidden sm:inline">
            {isSyncing
              ? '同步中...'
              : hasConflict
              ? '存在冲突 (需要合并)'
              : currentProject.unsyncedCount > 0
              ? `待推送 (+${currentProject.unsyncedCount})`
              : 'Git 已同步'}
          </span>
        </button>

        {/* Agent HUD Toggle */}
        <button
          onClick={onToggleAgentHUD}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
            isAgentHUDOpen
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Bot className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden md:inline">Agent 实时终端</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      </div>
    </header>
  );
};
