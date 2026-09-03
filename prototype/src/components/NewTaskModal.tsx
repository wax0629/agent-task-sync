import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles
} from 'lucide-react';
import { Task, Phase, AgentId, DeviceId, Project } from '../types';
import { getAgentBadge, getDeviceLabel } from './TaskCard';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: Task) => void;
  defaultData?: Partial<Task>;
  projects?: Project[];
  currentProjectId?: string;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  defaultData,
  projects,
  currentProjectId
}) => {
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  // Form states
  const [title, setTitle] = useState(defaultData?.title || '实现 Pi Agent 状态栏插件');
  const [project, setProject] = useState(defaultData?.project || currentProjectId || 'agent-task-sync');
  const [goal, setGoal] = useState(defaultData?.goal || '在 Pi 编辑器中实时渲染任务同步状态，支持断点快速查看与事件写入。');
  const [background, setBackground] = useState('完善 Agent 接入层，让轻量编辑器用户也能参与统一任务协议。');
  const [criteria, setCriteria] = useState<string[]>([
    '支持监听 Agent 启动与结束事件',
    '状态栏显示当前活跃任务、未同步数及阶段进度',
    '支持一键生成 Checkpoint 记录'
  ]);
  const [newCriterion, setNewCriterion] = useState('');

  const [assignedAgent, setAssignedAgent] = useState<AgentId>(defaultData?.assigned_agent || 'pi');
  const [assignedDevice, setAssignedDevice] = useState<DeviceId>(defaultData?.assigned_device || 'macbook-pro');

  const [phases, setPhases] = useState<{ title: string; goal: string; criteria: string }[]>(
    defaultData?.phases?.map(p => ({ title: p.title, goal: p.goal, criteria: p.criteria || '通过基础测试' })) || [
      { title: 'Pi Extension 注册与生命周期钩子', goal: '接入 agent_start 与 agent_end', criteria: '钩子成功拦截会话' },
      { title: '状态栏 UI 与交互组件编写', goal: '在底部栏显示 Task ID 和未同步指示灯', criteria: '渲染正常无卡顿' },
      { title: '本地 events.jsonl 追加写入支持', goal: '实现快速 checkpoint 弹窗', criteria: '本地文件写入正确' },
      { title: '端到端集成测试与文档更新', goal: '验证与核心 CLI 的联动', criteria: '全部用例通过' }
    ]
  );
  const [usePhases, setUsePhases] = useState(true);

  if (!isOpen) return null;

  const handleAddPhase = () => {
    if (phases.length >= 7) return;
    setPhases([...phases, { title: `Phase ${phases.length + 1} 新阶段`, goal: '明确此阶段产出', criteria: '通过验收条件' }]);
  };

  const handleRemovePhase = (index: number) => {
    if (phases.length <= 1) return;
    setPhases(phases.filter((_, i) => i !== index));
  };

  const handleTogglePhases = (enabled: boolean) => {
    setUsePhases(enabled);
    if (enabled && phases.length === 0) {
      setPhases([{ title: '首个执行阶段', goal: '明确本阶段产出', criteria: '通过验收条件' }]);
    }
  };

  const handleUpdatePhase = (index: number, field: string, val: string) => {
    const updated = [...phases];
    updated[index] = { ...updated[index], [field]: val };
    setPhases(updated);
  };

  const handleAddCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria([...criteria, newCriterion.trim()]);
    setNewCriterion('');
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = () => {
    const taskId = `task-${String(Date.now()).slice(-3)}`;
    const fullPhases: Phase[] = usePhases ? phases.map((p, idx) => ({
      id: `p-${taskId}-${idx + 1}`,
      order: idx + 1,
      title: p.title,
      goal: p.goal,
      criteria: p.criteria,
      status: idx === 0 ? 'in_progress' : 'planned',
      claimedBy: idx === 0 ? { agentId: assignedAgent, deviceId: assignedDevice } : undefined
    })) : [];

    const newTask: Task = {
      id: taskId,
      title,
      project,
      goal,
      background,
      criteria,
      status: 'in_progress',
      current_phase_id: fullPhases[0]?.id,
      next_action: fullPhases[0] ? `开始执行 Phase 1: ${fullPhases[0].title}` : '明确下一步行动并开始执行',
      assigned_agent: assignedAgent,
      assigned_device: assignedDevice,
      phases: fullPhases,
      git_repo: 'github.com/organization/agent-task-sync',
      git_branch: `feat/${taskId}-plugin`,
      last_commit: 'init-001',
      unsynced_events_count: 1,
      last_checkpoint_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    onCreateTask(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {step === 'form' ? '新建人机协同任务 (New Task)' : '确认创建任务摘要 (Double Confirmation)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {step === 'form' ? '遵循规范将目标拆解为 3~7 个可验证阶段' : 'PRD §14.1 规范要求：创建前需人工确认'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs bg-white">
          {step === 'form' ? (
            <>
              {/* Title & Project */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">任务标题 (Title)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例如: 实现 GitHub 同步引擎"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold shadow-subtle"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">所属项目 (Project)</label>
                  {projects && projects.length > 0 ? (
                    <select
                      value={project}
                      onChange={e => setProject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 shadow-subtle text-xs cursor-pointer"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={project}
                      onChange={e => setProject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 shadow-subtle"
                    />
                  )}
                </div>
              </div>

              {/* Goal & Background */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">核心目标 (Goal)</label>
                <textarea
                  rows={2}
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="清晰描述该工作单元要达成的最终状态..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle leading-relaxed"
                />
              </div>

              {/* Assignee & Device */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">初始认领 Agent</label>
                  <select
                    value={assignedAgent}
                    onChange={e => setAssignedAgent(e.target.value as AgentId)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle font-medium"
                  >
                    <option value="codex">Codex</option>
                    <option value="claude">Claude Code</option>
                    <option value="pi">Pi Agent</option>
                    <option value="cursor">Cursor</option>
                    <option value="human">人工执行</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">执行设备 (Device)</label>
                  <select
                    value={assignedDevice}
                    onChange={e => setAssignedDevice(e.target.value as DeviceId)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle font-medium"
                  >
                    <option value="macbook-pro">MacBook Pro</option>
                    <option value="windows-desktop">Windows PC</option>
                    <option value="linux-dev">Linux Dev</option>
                  </select>
                </div>
              </div>

              {/* Acceptance Criteria */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">验收标准 (Acceptance Criteria)</label>
                <div className="space-y-1.5 mb-2">
                  {criteria.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-slate-800 font-medium">{c}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCriterion(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCriterion}
                    onChange={e => setNewCriterion(e.target.value)}
                    placeholder="添加一条验收标准并按回车..."
                    onKeyDown={e => e.key === 'Enter' && handleAddCriterion()}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs shadow-subtle"
                  />
                  <button
                    onClick={handleAddCriterion}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* Optional phases */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    <span>执行阶段拆解（可选）</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <input type="checkbox" checked={usePhases} onChange={e => handleTogglePhases(e.target.checked)} />
                    定义阶段
                  </label>
                  {usePhases && phases.length < 7 && (
                    <button
                      onClick={handleAddPhase}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>增加阶段</span>
                    </button>
                  )}
                </div>

                {usePhases ? <div className="space-y-2">
                  {phases.map((p, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-400 font-bold">Phase {idx + 1}</span>
                        <input
                          type="text"
                          value={p.title}
                          onChange={e => handleUpdatePhase(idx, 'title', e.target.value)}
                          placeholder="阶段名称"
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-subtle"
                        />
                        {phases.length > 1 && (
                          <button
                            onClick={() => handleRemovePhase(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={p.goal}
                          onChange={e => handleUpdatePhase(idx, 'goal', e.target.value)}
                          placeholder="阶段目标"
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-[11px] focus:outline-none shadow-subtle"
                        />
                        <input
                          type="text"
                          value={p.criteria}
                          onChange={e => handleUpdatePhase(idx, 'criteria', e.target.value)}
                          placeholder="阶段验收条件"
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-500 text-[11px] focus:outline-none shadow-subtle"
                        />
                      </div>
                    </div>
                  ))}
                </div> : (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3">
                    不定义阶段也可以创建任务，后续用当前状态、最近完成和下一步继续推进。
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Confirmation Step */
            <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-4">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <span>任务创建确认摘要</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-indigo-100 space-y-3 leading-relaxed shadow-subtle">
                <div>
                  <span className="text-slate-400 font-medium">将创建任务: </span>
                  <span className="font-bold text-slate-900 text-sm">「{title}」</span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-600 font-medium">
                  <div><span className="text-slate-400">所属项目:</span> {project}</div>
                  <div><span className="text-slate-400">执行阶段:</span> {usePhases ? `${phases.length} 个阶段` : '未定义阶段'}</div>
                  <div><span className="text-slate-400">认领 Agent:</span> {getAgentBadge(assignedAgent).name}</div>
                  <div><span className="text-slate-400">执行设备:</span> {getDeviceLabel(assignedDevice)}</div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 font-medium">目标:</span>
                  <p className="text-slate-800 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">{goal}</p>
                </div>

                {usePhases && phases[0] && <div>
                  <span className="text-slate-400 block mb-1 font-medium">首阶段计划:</span>
                  <p className="text-indigo-900 text-xs font-bold">Phase 1: {phases[0].title}（将自动进入 in_progress）</p>
                </div>}
              </div>

              <p className="text-[11px] text-slate-500">
                点击下方「确认创建并同步」后，系统将在本地写入 `task.yaml`、`task_plan.md` 与第一条 `task_created` 不可变事件。
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50/70">
          {step === 'form' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                取消
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!title.trim() || !goal.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
              >
                <span>下一步：查看确认摘要</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('form')}
                className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                返回修改
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>确认创建并同步任务</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
