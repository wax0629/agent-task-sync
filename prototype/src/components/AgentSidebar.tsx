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
  RefreshCw
} from 'lucide-react';
import { Task, AgentId, DeviceId } from '../types';

interface AgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentTask?: Task;
  onSelectTaskById: (taskId: string) => void;
  onTriggerSync: () => void;
  onOpenNewTaskWithDefaults: (defaults: any) => void;
  onQuickCheckpoint: (summary: string) => void;
  onOpenConflict: (taskId: string) => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
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
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slideInRight">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">Agent 交互与断点恢复终端</h3>
              <span className="rounded-full bg-indigo-100 px-2 py-0.2 text-[10px] font-semibold text-indigo-700">
                Hook 注入
              </span>
            </div>
            <p className="text-[11px] text-slate-500">模拟 Codex / Claude 命令行会话自动注入与断点恢复</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Simulator Switcher Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">模拟环境:</span>
          <select
            value={currentAgent}
            onChange={e => setCurrentAgent(e.target.value as AgentId)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
          >
            <option value="claude">Claude Code (Win)</option>
            <option value="codex">Codex (Mac)</option>
            <option value="pi">Pi Extension</option>
          </select>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveScenario('restore')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeScenario === 'restore'
                ? 'bg-white text-indigo-700 shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            上下文恢复
          </button>
          <button
            onClick={() => setActiveScenario('checkpoint')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeScenario === 'checkpoint'
                ? 'bg-white text-indigo-700 shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            建议保存
          </button>
          <button
            onClick={() => setActiveScenario('conflict')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeScenario === 'conflict'
                ? 'bg-white text-indigo-700 shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            冲突警告
          </button>
          <button
            onClick={() => setActiveScenario('suggest_task')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeScenario === 'suggest_task'
                ? 'bg-white text-indigo-700 shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            建议新建
          </button>
        </div>
      </div>

      {/* Terminal Output Simulation Box */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70 text-xs">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 text-slate-400 text-[11px] pb-2 border-b border-slate-200 font-mono">
          <Terminal className="h-3.5 w-3.5 text-slate-500" />
          <span>session://{currentAgent}-{currentDevice}-0902</span>
        </div>

        {/* 1. SCENARIO: Context Restoration (断点恢复) */}
        {activeScenario === 'restore' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-card text-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>已自动读取 task_plan.md 并恢复任务上下文</span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div><span className="text-slate-400 font-medium">任务名称:</span> <span className="font-semibold text-slate-900">实现 GitHub 同步引擎与任务接续文档重建</span> (task-002)</div>
                <div><span className="text-slate-400 font-medium">当前阶段:</span> Phase 2/5 (事件合并与幂等去重算法)</div>
                <div><span className="text-slate-400 font-medium">上一操作者:</span> Claude / Windows PC</div>
                <div><span className="text-slate-400 font-medium">已完成:</span> 脚手架初始化、Git 目录结构生成</div>
                <div className="text-indigo-900 font-semibold">
                  <span className="text-slate-400 font-medium">下一步:</span> 确定事件 Schema 并编写 Git Rebase 幂等合并测试
                </div>
                <div><span className="text-slate-400 font-medium">待推送事件:</span> <span className="text-sky-700 font-bold">2 条本地事件</span></div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => onSelectTaskById('task-002')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm shadow-indigo-600/20"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>查看任务详情并继续</span>
                </button>
                <button
                  onClick={onTriggerSync}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>先同步 Git 远程</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 italic px-1">
              * 当你在命令行开启新对话或执行 `/clear` 后，Hook 会自动向上下文注入上述结构化任务接续文档。
            </div>
          </div>
        )}

        {/* 2. SCENARIO: Checkpoint Suggestion */}
        {activeScenario === 'checkpoint' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-card text-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <BookmarkPlus className="h-4 w-4 text-emerald-600" />
                <span>Agent 智能 Checkpoint 建议</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                我检测到你刚通过了全部 12 项 Git 合并单元测试，且 `src/sync/engine.ts` 文件已修改完毕。建议记录一次 Checkpoint。
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div><span className="text-slate-400 font-medium">建议摘要:</span> <span className="font-semibold text-slate-900">完成 Git Rebase 算法并通过 12 个并发用例测试</span></div>
                <div><span className="text-slate-400 font-medium">关联文件:</span> <span className="font-mono text-[11px] text-slate-700">src/sync/engine.ts, tests/sync.test.ts</span></div>
                <div><span className="text-slate-400 font-medium">测试状态:</span> <span className="text-emerald-700 font-bold">passed (100%)</span></div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onQuickCheckpoint('完成 Git Rebase 算法并通过 12 个并发用例测试')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>确认记录并写入事件</span>
                </button>
                <button
                  onClick={() => onSelectTaskById('task-002')}
                  className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium"
                >
                  自定义摘要
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. SCENARIO: Conflict Warning */}
        {activeScenario === 'conflict' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-card text-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <span>跨设备并发冲突警报 (Conflict Detected)</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                检测到 Windows 上的 Claude (14:32) 与 Mac 上的 Codex (14:30) 在离线期间分别修改了「解决多 Agent 并行认领状态冲突」的 Phase 2。系统已自动降级为安全只读模式，未覆盖任何数据。
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onOpenConflict('task-004')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>立即进入可视化冲突对比</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. SCENARIO: Suggest New Task Proposal */}
        {activeScenario === 'suggest_task' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-card text-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                <PlusCircle className="h-4 w-4 text-indigo-600" />
                <span>Agent 识别到新需求，建议创建任务</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                根据刚才关于「Pi Agent 状态栏插件」的讨论，建议创建结构化任务：
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div><span className="text-slate-400 font-medium">建议标题:</span> <span className="font-semibold text-slate-900">编写 Pi Agent Extension 状态栏插件</span></div>
                <div><span className="text-slate-400 font-medium">拟定阶段:</span> 1. 扩展注册 → 2. 状态栏渲染 → 3. 自动 checkpoint 钩子</div>
                <div><span className="text-slate-400 font-medium">初始指派:</span> Pi Agent @ MacBook Pro</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm shadow-indigo-600/20"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>确认并打开任务创建抽屉</span>
                </button>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 italic px-1">
              * 遵循 PRD §14.1 规范：AI 绝不静默创建任务，必须经过人工双重确认。
            </div>
          </div>
        )}
      </div>

      {/* Simulator Input Bar */}
      <div className="p-3.5 border-t border-slate-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="向 Agent 发送模拟指令，如 /status, /checkpoint..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono shadow-subtle"
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
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
