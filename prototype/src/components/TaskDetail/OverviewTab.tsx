import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Layers, 
  GitBranch, 
  GitCommit, 
  AlertTriangle, 
  Clock, 
  Bot, 
  Laptop, 
  ShieldCheck
} from 'lucide-react';
import { Task, PhaseStatus } from '../../types';
import { getAgentBadge, getDeviceLabel } from '../TaskCard';

interface OverviewTabProps {
  task: Task;
  onUpdatePhaseStatus: (phaseId: string, status: PhaseStatus) => void;
  onUnblockTask: () => void;
  onAddCheckpoint: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  task,
  onUpdatePhaseStatus,
  onUnblockTask,
  onAddCheckpoint
}) => {
  const agentInfo = getAgentBadge(task.assigned_agent);

  return (
    <div className="space-y-5">
      {/* 1. Goal & Acceptance Criteria */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>核心目标 (Goal)</span>
          </h4>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
            {task.goal}
          </p>
        </div>

        {task.background && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">背景与上下文</h4>
            <p className="text-xs text-slate-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100 leading-relaxed">
              {task.background}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">验收标准 (Acceptance Criteria)</h4>
          <ul className="space-y-2">
            {task.criteria.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 1.1 Task continuation context */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
          <h4 className="text-xs font-bold text-indigo-900">当前关注点</h4>
          <p className="text-xs text-slate-700 leading-relaxed">{task.current_focus || task.next_action || '尚未记录当前关注点'}</p>
          <h4 className="text-xs font-bold text-indigo-900 pt-2">最近完成</h4>
          {task.recent_completed?.length ? <ul className="space-y-1 text-xs text-slate-700">{task.recent_completed.map((item, i) => <li key={i}>✓ {item}</li>)}</ul> : <p className="text-xs text-slate-400">暂无记录</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-700">验证结果</h4>
          {task.verification?.length ? task.verification.map((v, i) => <div key={i} className="text-xs text-slate-700"><span className="font-mono text-slate-500">{v.command}</span><br />{v.result} · {new Date(v.checked_at).toLocaleString()}</div>) : <p className="text-xs text-slate-400">暂无验证记录</p>}
        </div>
      </div>

      {(task.key_decisions?.length || task.known_errors?.length || task.related_commands?.length || task.uncommitted_changes?.length) && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-4">
          {task.key_decisions?.length ? <div><h4 className="text-xs font-bold text-slate-700 mb-2">关键决策</h4>{task.key_decisions.map((d, i) => <p key={i} className="text-xs text-slate-700"><b>{d.decision}</b>：{d.reason}</p>)}</div> : null}
          {task.known_errors?.length ? <div><h4 className="text-xs font-bold text-rose-700 mb-2">问题与失败尝试</h4>{task.known_errors.map((e, i) => <p key={i} className="text-xs text-slate-700"><b>{e.error}</b>：{e.attempts}</p>)}</div> : null}
          {task.related_commands?.length ? <div><h4 className="text-xs font-bold text-slate-700 mb-2">相关命令</h4><div className="flex flex-wrap gap-2">{task.related_commands.map((c, i) => <code key={i} className="text-[11px] bg-slate-100 px-2 py-1 rounded">{c}</code>)}</div></div> : null}
          {task.uncommitted_changes?.length ? <div><h4 className="text-xs font-bold text-amber-700 mb-2">未提交变更</h4><p className="text-xs text-slate-700">{task.uncommitted_changes.join('、')}</p></div> : null}
        </div>
      )}

      {/* 2. Phase Breakdown (阶段拆解) */}
      {task.phases.length > 0 && <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>阶段拆解与进度 (Phases)</span>
          </h4>
          <span className="text-xs font-mono font-semibold text-slate-500">
            {task.phases.filter(p => p.status === 'completed').length} / {task.phases.length} 完成
          </span>
        </div>

        <div className="space-y-2">
          {task.phases.map((phase) => {
            const isCurrent = phase.id === task.current_phase_id;
            const isDone = phase.status === 'completed';
            const isBlocked = phase.status === 'blocked';

            return (
              <div 
                key={phase.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-indigo-300 bg-indigo-50/40 shadow-subtle'
                    : isDone
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : isBlocked
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => onUpdatePhaseStatus(phase.id, isDone ? 'in_progress' : 'completed')}
                    title={isDone ? '标记为未完成' : '标记为已完成'}
                    className="mt-0.5"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 hover:text-emerald-700" />
                    ) : isBlocked ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 hover:text-indigo-600" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400 font-bold">Phase {phase.order}:</span>
                      <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {phase.title}
                      </span>
                      {isCurrent && (
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          当前阶段
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">目标: {phase.goal}</p>
                    <p className="text-[10px] text-slate-400 font-mono">验收: {phase.criteria}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <select
                    value={phase.status}
                    onChange={(e) => onUpdatePhaseStatus(phase.id, e.target.value as PhaseStatus)}
                    className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus:border-indigo-500 shadow-subtle"
                  >
                    <option value="planned">已计划</option>
                    <option value="in_progress">进行中</option>
                    <option value="completed">已完成</option>
                    <option value="blocked">已阻塞</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {/* 3. Blocked Banner if any */}
      {task.status === 'blocked' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2 shadow-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>当前任务处于阻塞状态</span>
            </div>
            <button
              onClick={onUnblockTask}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
            >
              解除阻塞并继续
            </button>
          </div>
          <p className="text-xs text-amber-950 font-medium bg-amber-100/60 p-3 rounded-xl border border-amber-200/80">
            {task.blocked_reason || '等待外部依赖解决或人工输入'}
          </p>
        </div>
      )}

      {/* 4. Execution Info & Git Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Execution Identity */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2.5 shadow-card">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">执行身份与环境</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-slate-400" /> 认领 Agent:
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${agentInfo.bg}`}>
                {agentInfo.name}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-slate-400" /> 运行设备:
              </span>
              <span className="font-mono font-medium text-slate-800">{getDeviceLabel(task.assigned_device)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">活跃 Session ID:</span>
              <span className="font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                {task.active_session_id || '无绑定 Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Git & Commit */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2.5 shadow-card">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Git 仓库与分支</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-slate-400" /> 工作分支:
              </span>
              <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 font-semibold">
                {task.git_branch || 'main'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <GitCommit className="h-3.5 w-3.5 text-indigo-600" /> 最近 Commit:
              </span>
              <span className="font-mono text-slate-700 font-medium">{task.last_commit || '无未提交变更'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> 最后 Checkpoint:
              </span>
              <span className="font-mono text-slate-500">{new Date(task.last_checkpoint_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
