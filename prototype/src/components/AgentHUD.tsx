import React, { useState } from 'react';
import { 
  Bot, 
  X, 
  Sparkles, 
  Terminal, 
  BookmarkPlus, 
  ShieldAlert, 
  PlusCircle, 
  CheckCircle2, 
  Send, 
  ArrowRight, 
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Task, AgentId, DeviceId } from '../types';

interface AgentHUDProps {
  isOpen: boolean;
  onClose: () => void;
  currentTask?: Task;
  onSelectTaskById: (taskId: string) => void;
  onTriggerSync: () => void;
  onOpenNewTaskWithDefaults: (defaults: any) => void;
  onQuickCheckpoint: (summary: string) => void;
  onOpenConflict: (taskId: string) => void;
}

export const AgentHUD: React.FC<AgentHUDProps> = ({
  isOpen,
  onClose,
  currentTask,
  onSelectTaskById,
  onTriggerSync,
  onOpenNewTaskWithDefaults,
  onQuickCheckpoint,
  onOpenConflict
}) => {
  const [activeScenario, setActiveScenario] = useState<'restore' | 'checkpoint' | 'conflict' | 'suggest_task'>('restore');
  const [currentAgent, setCurrentAgent] = useState<AgentId>('claude');
  const [currentDevice, setCurrentDevice] = useState<DeviceId>('windows-desktop');
  const [customPrompt, setCustomPrompt] = useState('');

  if (!isOpen) return null;

  return (
    <aside className="w-88 sm:w-96 border-l border-slate-200/80 bg-white flex flex-col h-full shrink-0 select-none shadow-lg z-10 animate-slideInRight">
      {/* 1. HUD Header */}
      <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900">Agent 协同终端 (HUD)</h3>
              <span className="rounded-full bg-indigo-100 px-2 py-0.2 text-[9px] font-bold text-indigo-700 font-mono">
                Hook Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400">模拟 Agent 命令行断点恢复与建议</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Simulator Environment Selector */}
      <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium text-[11px]">环境:</span>
          <select
            value={currentAgent}
            onChange={e => setCurrentAgent(e.target.value as AgentId)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none"
          >
            <option value="claude">Claude Code (Win)</option>
            <option value="codex">Codex (Mac)</option>
            <option value="pi">Pi Extension</option>
          </select>
        </div>

        {/* Quick Scenario Pills */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={() => setActiveScenario('restore')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              activeScenario === 'restore' ? 'bg-white text-indigo-700 shadow-subtle' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            接续状态
          </button>
          <button
            onClick={() => setActiveScenario('checkpoint')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              activeScenario === 'checkpoint' ? 'bg-white text-indigo-700 shadow-subtle' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            保存
          </button>
          <button
            onClick={() => setActiveScenario('conflict')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              activeScenario === 'conflict' ? 'bg-white text-indigo-700 shadow-subtle' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            冲突
          </button>
          <button
            onClick={() => setActiveScenario('suggest_task')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              activeScenario === 'suggest_task' ? 'bg-white text-indigo-700 shadow-subtle' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            新任务
          </button>
        </div>
      </div>

      {/* 3. Terminal Live Output */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] pb-1.5 border-b border-slate-200">
          <Terminal className="h-3 w-3 text-slate-500" />
          <span>session://{currentAgent}-{currentDevice}</span>
        </div>

        {/* Scenario 1: continuation state injected */}
        {activeScenario === 'restore' && (
          <div className="space-y-2.5 animate-fadeIn font-sans">
            <div className="p-3.5 rounded-xl bg-white border border-indigo-200 shadow-card space-y-2.5">
              <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>任务接续状态已注入</span>
              </div>

              <div className="space-y-1 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                <div><span className="text-slate-400">任务:</span> task-002 (实现 GitHub 同步引擎)</div>
                <div><span className="text-slate-400">阶段:</span> Phase 2/5 (事件合并去重)</div>
                <div><span className="text-slate-400">执行:</span> Claude / Windows PC</div>
                <div className="text-indigo-900 font-bold">
                  <span className="text-slate-400">下一步:</span> 确定事件 Schema 并编写测试
                </div>
                <div><span className="text-slate-400">暂存:</span> 2 条本地事件</div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 font-sans">
                <button
                  onClick={() => onSelectTaskById('task-002')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>定位到工作区</span>
                </button>
                <button
                  onClick={onTriggerSync}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>同步 Git</span>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic px-1">
              * Agent 开启新会话或 `/clear` 时，Hook 会自动向 Prompt 前置注入上述结构化 Markdown 状态。
            </p>
          </div>
        )}

        {/* Scenario 2: Checkpoint Suggestion */}
        {activeScenario === 'checkpoint' && (
          <div className="space-y-2.5 animate-fadeIn font-sans">
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-card space-y-2.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <BookmarkPlus className="h-3.5 w-3.5 text-emerald-600" />
                <span>Agent 建议记录 Checkpoint</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                检测到本地测试全部通过且 `src/sync/engine.ts` 已修改。建议保存当前断点：
              </p>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono space-y-1">
                <div><span className="text-slate-400">摘要:</span> 完成 Git Rebase 幂等去重并跑通 12 个并发用例</div>
                <div><span className="text-slate-400">文件:</span> src/sync/engine.ts</div>
                <div><span className="text-slate-400">测试:</span> <span className="text-emerald-700 font-bold">passed (100%)</span></div>
              </div>

              <div className="flex items-center gap-2 pt-1 font-sans">
                <button
                  onClick={() => onQuickCheckpoint('完成 Git Rebase 幂等去重并跑通 12 个并发用例')}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>一键确认并写入</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scenario 3: Conflict Alert */}
        {activeScenario === 'conflict' && (
          <div className="space-y-2.5 animate-fadeIn font-sans">
            <div className="p-3.5 rounded-xl bg-white border border-rose-200 shadow-card space-y-2.5">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                <span>并发冲突预警 (Conflict Alert)</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                检测到 Win/Claude 与 Mac/Codex 在离线期间分别修改了 Phase 2。系统已开启防覆盖保护，进入只读模式。
              </p>

              <div className="pt-1 font-sans">
                <button
                  onClick={() => onOpenConflict('task-004')}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>进入工作区对比合并</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scenario 4: New Task Proposal */}
        {activeScenario === 'suggest_task' && (
          <div className="space-y-2.5 animate-fadeIn font-sans">
            <div className="p-3.5 rounded-xl bg-white border border-indigo-200 shadow-card space-y-2.5">
              <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
                <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />
                <span>Agent 提议创建新任务</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                根据上下文讨论，建议创建结构化任务：
              </p>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono space-y-1">
                <div><span className="text-slate-400">标题:</span> 编写 Pi Agent Extension 状态栏插件</div>
                <div><span className="text-slate-400">阶段:</span> 1. 扩展注册 → 2. 状态栏UI → 3. 钩子</div>
                <div><span className="text-slate-400">指派:</span> Pi Agent @ MacBook Pro</div>
              </div>

              <div className="pt-1 font-sans">
                <button
                  onClick={() => onOpenNewTaskWithDefaults({
                    title: '编写 Pi Agent Extension 状态栏插件',
                    goal: '在 Pi 编辑器状态栏实时展示当前认领任务名称、未同步事件与 Checkpoint 快捷入口。',
                    assigned_agent: 'pi',
                    assigned_device: 'macbook-pro',
                    phases: [
                      { title: 'Pi Extension 脚手架与生命周期监听', goal: '监听 agent_start 与 agent_end' },
                      { title: '状态栏 UI 渲染组件', goal: '展示当前任务进度与同步状态' },
                      { title: '一键创建 Checkpoint 交互', goal: '点击弹窗直接写入 events.jsonl' }
                    ]
                  })}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>打开确认抽屉并创建</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic px-1">
              * PRD §14.1 规范要求：AI 绝不静默创建任务，必须经过人工双重确认。
            </p>
          </div>
        )}
      </div>

      {/* 4. Terminal Input Bar */}
      <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="模拟 Agent 交互指令 (/status, /checkpoint)..."
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono shadow-subtle"
        />
        <button
          onClick={() => {
            if (customPrompt.includes('status')) {
              setActiveScenario('restore');
            } else if (customPrompt.includes('checkpoint')) {
              setActiveScenario('checkpoint');
            } else if (customPrompt.includes('new') || customPrompt.includes('task')) {
              setActiveScenario('suggest_task');
            } else {
              setActiveScenario('restore');
            }
            setCustomPrompt('');
          }}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
};
