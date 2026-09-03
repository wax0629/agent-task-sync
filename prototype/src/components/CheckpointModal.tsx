import React, { useState } from 'react';
import { 
  X, 
  BookmarkPlus, 
  CheckCircle2
} from 'lucide-react';
import { Task, TaskEvent } from '../types';

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSaveCheckpoint: (checkpointData: Partial<TaskEvent>) => void;
}

export const CheckpointModal: React.FC<CheckpointModalProps> = ({
  isOpen,
  onClose,
  task,
  onSaveCheckpoint
}) => {
  const [selectedPhaseId, setSelectedPhaseId] = useState(task.current_phase_id || task.phases[0]?.id || '');
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState('src/sync/engine.ts, tests/sync.test.ts');
  const [commit, setCommit] = useState(`c_${String(Date.now()).slice(-6)}`);
  const [testStatus, setTestStatus] = useState<'passed' | 'failed' | 'skipped'>('passed');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!summary.trim()) return;
    onSaveCheckpoint({
      phase_id: selectedPhaseId,
      summary: summary.trim(),
      files: files.split(',').map(f => f.trim()).filter(Boolean),
      commit,
      test_status: testStatus,
      type: 'progress'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
              <BookmarkPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">记录任务 Checkpoint</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-xs">{task.title}</p>
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
            <label className="block text-slate-700 font-bold mb-1">所属执行阶段 (Phase)</label>
            <select
              value={selectedPhaseId}
              onChange={e => setSelectedPhaseId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-medium shadow-subtle"
            >
              {task.phases.map(p => (
                <option key={p.id} value={p.id}>
                  Phase {p.order}: {p.title} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">进度摘要 (Summary - 必填)</label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="例如: 完成了 Git Rebase 幂等去重逻辑并补充 5 个单元测试"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold shadow-subtle"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">关联修改文件 (逗号分隔)</label>
              <input
                type="text"
                value={files}
                onChange={e => setFiles(e.target.value)}
                placeholder="src/api.ts, src/sync.ts"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-mono text-[11px] shadow-subtle"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">测试结果 (Test Status)</label>
              <select
                value={testStatus}
                onChange={e => setTestStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-medium shadow-subtle"
              >
                <option value="passed">通过 (Passed)</option>
                <option value="failed">失败 (Failed)</option>
                <option value="skipped">已跳过 (Skipped)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            * Checkpoint 将以 Append-Only 格式追加到本地 <span className="font-mono text-indigo-700 font-semibold">.task-sync/tasks/{task.id}/events/</span>，并在联网时与远程 Git 仓库同步。
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
            disabled={!summary.trim()}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              summary.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>保存并写入事件</span>
          </button>
        </div>
      </div>
    </div>
  );
};
