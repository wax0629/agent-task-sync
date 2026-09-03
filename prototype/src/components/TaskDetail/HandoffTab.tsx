import React, { useState } from 'react';
import { 
  FileCheck, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';
import { Task, HandoffPackage, AgentId, DeviceId } from '../../types';
import { getAgentBadge, getDeviceLabel } from '../TaskCard';

interface HandoffTabProps {
  task: Task;
  onCreateHandoff: (handoff: HandoffPackage) => void;
  onAcceptHandoff: (targetAgent: AgentId, targetDevice: DeviceId) => void;
}

export const HandoffTab: React.FC<HandoffTabProps> = ({
  task,
  onCreateHandoff,
  onAcceptHandoff
}) => {
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating handoff
  const [targetAgent, setTargetAgent] = useState<AgentId>('claude');
  const [completedWork, setCompletedWork] = useState<string>('完成了当前阶段代码编写与本地单元测试验证');
  const [incompleteWork, setIncompleteWork] = useState<string>('跨平台兼容性测试与生产级构建');
  const [decisionText, setDecisionText] = useState<string>('事件采用独立 JSONL 存储以避免合并冲突');
  const [decisionReason, setDecisionReason] = useState<string>('保障离线并发写入安全性');
  const [errorText, setErrorText] = useState<string>('Windows 路径反斜杠兼容问题');
  const [errorAttempts, setErrorAttempts] = useState<string>('在 Git 提交前做 normalize POSIX 统一规范化');
  const [nextStep, setNextStep] = useState<string>('在目标机器执行 `npm test` 验证并通过验收标准');
  const [relevantFiles, setRelevantFiles] = useState<string>('src/sync/engine.ts, tests/sync.test.ts');
  const [testSummary, setTestSummary] = useState<string>('12/12 单元测试通过，零未捕获异常');

  // 5 Integrity Checks
  const checks = {
    hasCurrentPhase: !!task.current_phase_id,
    hasNextStep: nextStep.trim().length > 5,
    hasTestSummary: testSummary.trim().length > 3,
    hasRelevantFiles: relevantFiles.trim().length > 0,
    hasDecisions: decisionText.trim().length > 0
  };
  const isAllValid = Object.values(checks).every(Boolean);

  const handleSubmitNewHandoff = () => {
    if (!isAllValid) return;
    const newPackage: HandoffPackage = {
      handoff_id: `hdo_${Date.now()}`,
      task_id: task.id,
      from_agent: task.assigned_agent || 'codex',
      from_device: task.assigned_device || 'macbook-pro',
      target_agent: targetAgent,
      created_at: new Date().toISOString(),
      completed_work: completedWork.split('\n').filter(Boolean),
      incomplete_work: incompleteWork.split('\n').filter(Boolean),
      key_decisions: [{ decision: decisionText, reason: decisionReason }],
      known_errors: [{ error: errorText, attempts: errorAttempts }],
      next_step: nextStep,
      relevant_files: relevantFiles.split(',').map(s => s.trim()).filter(Boolean),
      test_summary: testSummary
    };

    onCreateHandoff(newPackage);
    setIsCreating(false);
  };

  const handoff = task.handoff;

  return (
    <div className="space-y-5">
      {/* If Task has an active Handoff */}
      {handoff && !isCreating ? (
        <div className="space-y-4">
          {/* Top Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm mt-0.5">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">结构化交接包就绪 (Handoff Package Ready)</h3>
                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                    {handoff.handoff_id}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  由 <span className="text-slate-900 font-semibold">{getAgentBadge(handoff.from_agent).name}</span> ({getDeviceLabel(handoff.from_device)}) 发起，指定交接给 <span className="text-indigo-700 font-bold">{getAgentBadge(handoff.target_agent).name}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onAcceptHandoff(handoff.target_agent || 'claude', 'windows-desktop')}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>接受交接 (以 {getAgentBadge(handoff.target_agent || 'claude').name} 认领)</span>
              </button>
            </div>
          </div>

          {/* 5-Point Integrity Checklist Box */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-card">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Handoff 完整性校验 (5/5 通过)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>1. 当前阶段目标明确</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>2. 唯一下一步动作已指定</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>3. 附带最近测试结果</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>4. 相关文件无遗漏</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>5. 关键决策与试错已记录</span>
              </div>
            </div>
          </div>

          {/* Handoff Details Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Completed & Incomplete */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-4">
              <div>
                <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>已完成工作 (Completed)</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {handoff.completed_work.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span>未完成工作 (Incomplete)</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {handoff.incomplete_work.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-amber-50/40 p-2.5 rounded-xl border border-amber-100">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Decisions, Errors, Next Step */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-4">
              {/* Next Step */}
              <div>
                <h4 className="text-xs font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4 text-indigo-600" />
                  <span>下一步建议动作 (Next Step)</span>
                </h4>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 text-xs text-indigo-950 font-semibold leading-relaxed">
                  {handoff.next_step}
                </div>
              </div>

              {/* Decisions */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1.5">关键决策与依据</h4>
                {handoff.key_decisions.map((d, idx) => (
                  <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1 mb-1.5">
                    <div className="text-slate-900 font-semibold">决策: {d.decision}</div>
                    <div className="text-slate-500 text-[11px]">理由: {d.reason}</div>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {handoff.known_errors.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1.5">已知错误与排查记录</h4>
                  {handoff.known_errors.map((e, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="text-rose-700 font-mono text-[11px] font-semibold">错误: {e.error}</div>
                      <div className="text-slate-500 text-[11px]">排查: {e.attempts}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Test summary */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">测试结果摘要</h4>
                <div className="font-mono text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-semibold">
                  {handoff.test_summary}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Create New Handoff Form */
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-indigo-600" />
                <span>创建任务交接包 (Create Handoff)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">将当前上下文与阶段成果整理为结构化交接文档，便于另一位 Agent 快速恢复。</p>
            </div>

            {handoff && (
              <button
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                取消
              </button>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">指派接收 Agent (Target Agent)</label>
                <select
                  value={targetAgent}
                  onChange={(e) => setTargetAgent(e.target.value as AgentId)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle font-medium"
                >
                  <option value="claude">Claude Code (Windows/Mac)</option>
                  <option value="codex">Codex (MacBook Pro)</option>
                  <option value="pi">Pi Agent</option>
                  <option value="cursor">Cursor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">测试结果摘要 (Test Summary)</label>
                <input
                  type="text"
                  value={testSummary}
                  onChange={(e) => setTestSummary(e.target.value)}
                  placeholder="例如: 18/18 单元测试全部通过"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-subtle"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">已完成工作列表 (按换行分隔)</label>
              <textarea
                rows={2}
                value={completedWork}
                onChange={(e) => setCompletedWork(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">未完成工作 / 待办 (按换行分隔)</label>
              <textarea
                rows={2}
                value={incompleteWork}
                onChange={(e) => setIncompleteWork(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-subtle"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">关键决策与依据</label>
                <input
                  type="text"
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="决策内容"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 mb-1.5 shadow-subtle"
                />
                <input
                  type="text"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="决策理由"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 focus:outline-none focus:border-indigo-500 text-[11px] shadow-subtle"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">已知错误与排查记录</label>
                <input
                  type="text"
                  value={errorText}
                  onChange={(e) => setErrorText(e.target.value)}
                  placeholder="错误描述"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 mb-1.5 shadow-subtle"
                />
                <input
                  type="text"
                  value={errorAttempts}
                  onChange={(e) => setErrorAttempts(e.target.value)}
                  placeholder="尝试过的解决方案"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 focus:outline-none focus:border-indigo-500 text-[11px] shadow-subtle"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">下一步建议唯一动作 (Next Step - 核心关键)</label>
              <input
                type="text"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="例如: 运行 npm test 验证并接入 TS 类型导出"
                className="w-full bg-indigo-50/50 border border-indigo-300 rounded-xl px-3 py-2 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold shadow-subtle"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">相关文件路径 (逗号分隔)</label>
              <input
                type="text"
                value={relevantFiles}
                onChange={(e) => setRelevantFiles(e.target.value)}
                placeholder="src/api.ts, tests/api.test.ts"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-subtle"
              />
            </div>
          </div>

          {/* Validation Checklist feedback */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="font-bold text-slate-700">提交前 5 项完整性检查:</div>
            <div className="flex flex-wrap gap-3 font-medium">
              <span className={`flex items-center gap-1 ${checks.hasCurrentPhase ? 'text-emerald-700' : 'text-rose-600'}`}>
                {checks.hasCurrentPhase ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                当前阶段明确
              </span>
              <span className={`flex items-center gap-1 ${checks.hasNextStep ? 'text-emerald-700' : 'text-rose-600'}`}>
                {checks.hasNextStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                下一步唯一动作
              </span>
              <span className={`flex items-center gap-1 ${checks.hasTestSummary ? 'text-emerald-700' : 'text-rose-600'}`}>
                {checks.hasTestSummary ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                测试结果摘要
              </span>
              <span className={`flex items-center gap-1 ${checks.hasRelevantFiles ? 'text-emerald-700' : 'text-rose-600'}`}>
                {checks.hasRelevantFiles ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                相关文件
              </span>
              <span className={`flex items-center gap-1 ${checks.hasDecisions ? 'text-emerald-700' : 'text-rose-600'}`}>
                {checks.hasDecisions ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                关键决策
              </span>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleSubmitNewHandoff}
              disabled={!isAllValid}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                isAllValid
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>生成交接包并进入 Handoff Ready</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
