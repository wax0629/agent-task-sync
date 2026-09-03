import React, { useState } from 'react';
import { 
  FolderGit2, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Plus, 
  Bot, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  PlayCircle,
  Sparkles,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { Project } from '../types';

interface NavbarProps {
  currentProject: Project;
  projects: Project[];
  onSelectProject: (p: Project) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onOpenNewTask: () => void;
  onToggleAgentSidebar: () => void;
  isAgentSidebarOpen: boolean;
  onRunScenario: (scenario: 'A' | 'B' | 'C' | 'D') => void;
  hasConflict: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  isOffline,
  onToggleOffline,
  onTriggerSync,
  isSyncing,
  onOpenNewTask,
  onToggleAgentSidebar,
  isAgentSidebarOpen,
  onRunScenario,
  hasConflict
}) => {
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 lg:px-6 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand & Project Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm shadow-indigo-600/20 text-white font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm tracking-tight">
                <span>Agent Task Sync</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-200/60">
                  v0.1 原型
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">多 Agent 跨设备任务与上下文同步系统</p>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Project Selector */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <FolderGit2 className="h-3.5 w-3.5 text-slate-500" />
              <span>{currentProject.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showProjectDropdown && (
              <div className="absolute left-0 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-fadeIn">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  切换代码仓库 / 项目
                </div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p);
                      setShowProjectDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-colors ${
                      p.id === currentProject.id
                        ? 'bg-indigo-50 text-indigo-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{p.repo}</div>
                    </div>
                    {p.id === currentProject.id && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Quick Scenario Tester (Guide for testing the 4 Paths) */}
        <div className="relative">
          <button
            onClick={() => setShowScenarioMenu(!showScenarioMenu)}
            className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-all shadow-subtle"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>核心体验路径 (A/B/C/D)</span>
            <ChevronDown className="h-3 w-3 text-indigo-500" />
          </button>

          {showScenarioMenu && (
            <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-84 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <PlayCircle className="h-4 w-4 text-indigo-600" />
                  <span>快捷体验原型 4 条关键路径</span>
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
                  <div className="flex items-center justify-between text-slate-800 font-semibold group-hover:text-indigo-600">
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
                  <div className="flex items-center justify-between text-slate-800 font-semibold group-hover:text-indigo-600">
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
                  <div className="flex items-center justify-between text-slate-800 font-semibold group-hover:text-indigo-600">
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
                  <div className="flex items-center justify-between text-slate-800 font-semibold group-hover:text-indigo-600">
                    <span>路径 D：并发冲突可视化对比与合并</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">两端离线写入冲突 → 对比差异 → 选择合并方案并追加解决事件</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Sync Status, Offline Toggle, Agent Drawer, New Task */}
        <div className="flex items-center gap-2">
          {/* Offline Toggle */}
          <button
            onClick={onToggleOffline}
            title={isOffline ? '当前为离线模式（本地事件暂存）' : '当前已联网'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border ${
              isOffline
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                <span className="hidden md:inline">离线模式</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden md:inline">在线</span>
              </>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={onTriggerSync}
            disabled={isSyncing || isOffline}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all border ${
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
                ? '正在同步...'
                : hasConflict
                ? '存在冲突'
                : currentProject.unsyncedCount > 0
                ? `待推送 (${currentProject.unsyncedCount})`
                : '已同步'}
            </span>
          </button>

          {/* Agent Simulation Sidebar Toggle */}
          <button
            onClick={onToggleAgentSidebar}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
              isAgentSidebarOpen
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Bot className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Agent 终端</span>
          </button>

          {/* New Task Button */}
          <button
            onClick={onOpenNewTask}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>新建任务</span>
          </button>
        </div>
      </div>
    </header>
  );
};
