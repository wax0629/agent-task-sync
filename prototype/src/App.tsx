import React, { useState } from 'react';
import { initialProjects, initialTasks, initialEvents } from './mock/initialData';
import { Task, TaskEvent, Project, PhaseStatus, AgentId, DeviceId, HandoffPackage } from './types';
import { TopHeader } from './components/TopHeader';
import { SidebarNav, ViewFilter, CenterView } from './components/SidebarNav';
import { TaskListView } from './components/TaskListView';
import { TaskDetailWorkspace } from './components/TaskDetail/TaskDetailWorkspace';
import { ProjectOverviewView } from './components/ProjectOverviewView';
import { ProjectDirectoryView } from './components/ProjectDirectoryView';
import { AgentHUD } from './components/AgentHUD';
import { NewTaskModal } from './components/NewTaskModal';
import { NewProjectModal } from './components/NewProjectModal';
import { CheckpointModal } from './components/CheckpointModal';

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [currentProject, setCurrentProject] = useState<Project>(initialProjects[0]);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [events, setEvents] = useState<Record<string, TaskEvent[]>>(initialEvents);

  // Center Workbench Navigation & State
  const [centerView, setCenterView] = useState<CenterView>({ type: 'project_directory' });
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'timeline' | 'handoff' | 'sync'>('overview');
  const [agentFilter, setAgentFilter] = useState<AgentId | 'all'>('all');

  // Agent HUD Drawer
  const [isAgentHUDOpen, setIsAgentHUDOpen] = useState(true);

  // Modals & Drawers
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<any>(undefined);
  const [isCheckpointOpen, setIsCheckpointOpen] = useState(false);
  const [checkpointTaskId, setCheckpointTaskId] = useState<string | null>(null);

  // Sync & Offline Simulation
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const selectedTaskId = centerView.type === 'task_detail' ? centerView.taskId : null;
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedTaskEvents = selectedTaskId ? (events[selectedTaskId] || []) : [];

  // 1. Sync Logic (Pull + Push + Rebuild continuation documents)
  const handleTriggerSync = () => {
    if (isOffline) {
      showToast('⚠️ 当前处于离线模式，无法连接 GitHub 远程');
      return;
    }

    setIsSyncing(true);
    setTimeout(() => {
      // Only sync the active project; other projects retain their local lead state.
      const projectTaskIds = new Set(tasks.filter(t => t.project === currentProject.id).map(t => t.id));
      setEvents(prev => {
        const updated = { ...prev };
        projectTaskIds.forEach(k => {
          updated[k] = (updated[k] || []).map(e => ({ ...e, synced: true }));
        });
        return updated;
      });

      // Update tasks unsynced count
      setTasks(prev => prev.map(t => projectTaskIds.has(t.id) ? { ...t, unsynced_events_count: 0 } : t));

      // Update project sync state
      setProjects(prev => prev.map(p => {
        if (p.id === currentProject.id) {
          return { ...p, syncState: 'synced', unsyncedCount: 0, lastSyncedAt: new Date().toISOString() };
        }
        return p;
      }));

      setCurrentProject(prev => ({
        ...prev,
        syncState: 'synced',
        unsyncedCount: 0,
        lastSyncedAt: new Date().toISOString()
      }));

      setIsSyncing(false);
      showToast('✓ GitHub 同步成功：已拉取并合并远程事件，任务接续文档已更新');
    }, 1000);
  };

  const handleToggleOffline = () => {
    setIsOffline(prev => {
      const next = !prev;
      showToast(next ? '⚡ 已切换为离线模式：新产生事件将缓存在本地 JSONL' : '✓ 网络已恢复，可点击同步与 Git 远程通信');
      return next;
    });
  };

  // 2. Project Switch & Creation
  const handleSelectProject = (p: Project) => {
    setCurrentProject(p);
    setCenterView({ type: 'project_overview' });
    showToast(`已切换至项目「${p.name}」`);
  };

  const handleCreateProject = (newProj: Project) => {
    setProjects(prev => [newProj, ...prev]);
    setCurrentProject(newProj);
    setCenterView({ type: 'project_overview' });
    showToast(`✓ 项目「${newProj.name}」初始化完成，已生成 .task-sync 基础配置`);
  };

  // 3. Phase Status Change
  const handleUpdatePhaseStatus = (phaseId: string, newStatus: PhaseStatus) => {
    if (!selectedTaskId) return;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTaskId) return t;

      const updatedPhases = t.phases.map(p => {
        if (p.id === phaseId) {
          return { ...p, status: newStatus };
        }
        return p;
      });

      const allDone = updatedPhases.every(p => p.status === 'completed');

      return {
        ...t,
        phases: updatedPhases,
        status: allDone ? 'completed' : t.status,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: selectedTaskId,
      phase_id: phaseId,
      agent_id: selectedTask?.assigned_agent || 'claude',
      device_id: selectedTask?.assigned_device || 'windows-desktop',
      session_id: 'sess-active',
      type: newStatus === 'completed' ? 'phase_completed' : 'progress',
      summary: `更新 Phase 状态为: ${newStatus}`,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [selectedTaskId]: [newEvent, ...(prev[selectedTaskId] || [])]
    }));

    showToast(`✓ 阶段状态已更新为 ${newStatus}，并写入不可变事件`);
  };

  // 4. Unblock Task
  const handleUnblockTask = () => {
    if (!selectedTaskId) return;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTaskId) return t;
      return {
        ...t,
        status: 'in_progress',
        blocked_reason: undefined,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: selectedTaskId,
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-human-unblock',
      type: 'unblocked',
      summary: '人工操作解除阻塞，恢复任务执行流',
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [selectedTaskId]: [newEvent, ...(prev[selectedTaskId] || [])]
    }));

    showToast('✓ 已解除阻塞，任务恢复为 In Progress');
  };

  // 5. Create Handoff Package
  const handleCreateHandoff = (handoff: HandoffPackage) => {
    if (!selectedTaskId) return;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTaskId) return t;
      return {
        ...t,
        status: 'handoff_ready',
        handoff: handoff,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: selectedTaskId,
      agent_id: handoff.from_agent,
      device_id: handoff.from_device,
      session_id: 'sess-handoff',
      type: 'handoff_created',
      summary: `创建并发布面向 ${handoff.target_agent} 的 Handoff 交接包`,
      details: `下一步唯一动作: ${handoff.next_step}`,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [selectedTaskId]: [newEvent, ...(prev[selectedTaskId] || [])]
    }));

    showToast('✓ Handoff 交接包生成成功，任务已进入 Handoff Ready');
  };

  // 6. Accept Handoff
  const handleAcceptHandoff = (targetAgent: AgentId, targetDevice: DeviceId) => {
    if (!selectedTaskId || !selectedTask) return;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTaskId) return t;
      return {
        ...t,
        status: 'in_progress',
        assigned_agent: targetAgent,
        assigned_device: targetDevice,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: selectedTaskId,
      agent_id: targetAgent,
      device_id: targetDevice,
      session_id: `sess-${targetAgent}-${targetDevice}`,
      type: 'handoff_accepted',
      summary: `${targetAgent} 在 ${targetDevice} 成功接受 Handoff 并接管认领任务`,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [selectedTaskId]: [newEvent, ...(prev[selectedTaskId] || [])]
    }));

    showToast(`✓ 交接成功！${targetAgent} 已在 ${targetDevice} 上接管任务`);
  };

  // 7. Resolve Conflict
  const handleResolveConflict = (taskId: string, choice: 'keep_sideA' | 'keep_sideB' | 'merge', summary: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        status: 'in_progress',
        conflict: t.conflict ? {
          ...t.conflict,
          resolved: true,
          resolution: {
            choice,
            summary,
            resolved_at: new Date().toISOString()
          }
        } : undefined,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: taskId,
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-conflict-resolution',
      type: 'conflict_resolved',
      summary: `解决跨设备并发冲突 [${choice}]: ${summary}`,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [taskId]: [newEvent, ...(prev[taskId] || [])]
    }));

    showToast('✓ 冲突已解决并写入 conflict_resolved 修正事件，任务恢复为 In Progress');
  };

  // 8. Claim Task
  const handleClaimTask = (agentId: AgentId, deviceId: DeviceId) => {
    if (!selectedTaskId) return;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTaskId) return t;
      return {
        ...t,
        assigned_agent: agentId,
        assigned_device: deviceId,
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: selectedTaskId,
      agent_id: agentId,
      device_id: deviceId,
      session_id: `sess-${agentId}`,
      type: 'task_claimed',
      summary: `${agentId} (${deviceId}) 认领任务`,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [selectedTaskId]: [newEvent, ...(prev[selectedTaskId] || [])]
    }));

    showToast(`✓ 任务已由 ${agentId} 认领`);
  };

  // 9. Create Task
  const handleCreateTask = (newTask: Task) => {
    setTasks(prev => [newTask, ...prev]);

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: newTask.id,
      agent_id: newTask.assigned_agent || 'human',
      device_id: newTask.assigned_device || 'macbook-pro',
      session_id: 'sess-create',
      type: 'task_created',
      summary: `创建新任务: ${newTask.title}`,
      details: newTask.goal,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [newTask.id]: [newEvent]
    }));

    setCenterView({ type: 'task_detail', taskId: newTask.id });
    setActiveDetailTab('overview');
    showToast(`✓ 任务「${newTask.title}」已创建并写入首条不可变事件`);
  };

  // 10. Save Checkpoint
  const handleSaveCheckpoint = (data: Partial<TaskEvent>) => {
    const targetId = checkpointTaskId || selectedTaskId;
    if (!targetId) return;

    const newEvent: TaskEvent = {
      event_id: `evt_${Date.now()}`,
      task_id: targetId,
      phase_id: data.phase_id,
      agent_id: selectedTask?.assigned_agent || 'claude',
      device_id: selectedTask?.assigned_device || 'windows-desktop',
      session_id: 'sess-cp',
      type: 'progress',
      summary: data.summary || '记录阶段 Checkpoint',
      files: data.files,
      commit: data.commit,
      test_status: data.test_status,
      created_at: new Date().toISOString(),
      synced: !isOffline
    };

    setEvents(prev => ({
      ...prev,
      [targetId]: [newEvent, ...(prev[targetId] || [])]
    }));

    setTasks(prev => prev.map(t => {
      if (t.id !== targetId) return t;
      return {
        ...t,
        last_checkpoint_at: new Date().toISOString(),
        unsynced_events_count: t.unsynced_events_count + 1,
        updated_at: new Date().toISOString()
      };
    }));

    showToast('✓ Checkpoint 已记录并成功追加至事件流');
  };

  // 11. Scenario Launchers (A, B, C, D)
  const handleRunScenario = (scenario: 'A' | 'B' | 'C' | 'D') => {
    const defaultProj = projects.find(p => p.id === 'agent-task-sync') || projects[0];
    switch (scenario) {
      case 'A': // 看板继续任务
        setCurrentProject(defaultProj);
        setCenterView({ type: 'task_detail', taskId: 'task-002' });
        setActiveDetailTab('overview');
        showToast('👉 路径 A: 已在工作台打开「实现 GitHub 同步」，可查看 Next Step 并在顶部记录 Checkpoint');
        break;
      case 'B': // Agent 建议创建任务
        setIsAgentHUDOpen(true);
        showToast('👉 路径 B: 已打开右侧 Agent 终端，点击「新任务」体验 AI 提议建任务流程');
        break;
      case 'C': // 跨设备 Handoff
        setCurrentProject(defaultProj);
        setCenterView({ type: 'task_detail', taskId: 'task-003' });
        setActiveDetailTab('handoff');
        showToast('👉 路径 C: 已打开「设计事件 Schema」，可查看 5/5 校验并在右侧点击「接受交接」');
        break;
      case 'D': // 并发冲突处理
        setCurrentProject(defaultProj);
        setCenterView({ type: 'task_detail', taskId: 'task-004' });
        setActiveDetailTab('sync');
        showToast('👉 路径 D: 已在工作台打开冲突对比中心，可直观对比 Mac 与 Windows 双侧方案');
        break;
    }
  };

  const hasConflict = tasks.some(t => t.conflict && !t.conflict.resolved);

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex flex-col overflow-hidden font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-2xl text-xs text-slate-900 font-bold flex items-center gap-2 backdrop-blur-md animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Bar */}
      <TopHeader
        currentProject={currentProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
        isOffline={isOffline}
        hasConflict={hasConflict}
        isAgentHUDOpen={isAgentHUDOpen}
        onToggleAgentHUD={() => setIsAgentHUDOpen(!isAgentHUDOpen)}
        onRunScenario={handleRunScenario}
      />

      {/* Main 3-Column Workbench Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <SidebarNav
          projects={projects}
          currentProject={currentProject}
          onSelectProject={handleSelectProject}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          tasks={tasks}
          centerView={centerView}
          onNavigate={setCenterView}
          onOpenNewTask={() => {
            setNewTaskDefaults(undefined);
            setIsNewTaskOpen(true);
          }}
          isOffline={isOffline}
          onToggleOffline={handleToggleOffline}
          agentFilter={agentFilter}
          onSelectAgentFilter={setAgentFilter}
        />

        {/* Center Main Workspace Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {centerView.type === 'project_directory' && (
            <ProjectDirectoryView
              projects={projects}
              tasks={tasks}
              onSelectProject={(project) => {
                setCurrentProject(project);
                setCenterView({ type: 'project_overview' });
              }}
            />
          )}
          {centerView.type === 'project_overview' && (
            <ProjectOverviewView
              project={currentProject}
              tasks={tasks}
              onSelectTask={(id) => {
                setCenterView({ type: 'task_detail', taskId: id });
                setActiveDetailTab('overview');
              }}
              onOpenNewTask={() => {
                setNewTaskDefaults(undefined);
                setIsNewTaskOpen(true);
              }}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
              isOffline={isOffline}
            />
          )}

          {centerView.type === 'task_list' && (
            <TaskListView
              tasks={tasks}
              activeView={centerView.filter}
              currentProject={currentProject}
              onSelectTask={(id) => {
                setCenterView({ type: 'task_detail', taskId: id });
                setActiveDetailTab('overview');
              }}
              onOpenNewTask={() => {
                setNewTaskDefaults(undefined);
                setIsNewTaskOpen(true);
              }}
              agentFilter={agentFilter}
              onSelectAgentFilter={setAgentFilter}
            />
          )}

          {centerView.type === 'task_detail' && selectedTask && (
            <TaskDetailWorkspace
              task={selectedTask}
              events={selectedTaskEvents}
              onBackToList={() => setCenterView({ type: 'task_list', filter: 'all' })}
              onUpdatePhaseStatus={handleUpdatePhaseStatus}
              onUnblockTask={handleUnblockTask}
              onCreateHandoff={handleCreateHandoff}
              onAcceptHandoff={handleAcceptHandoff}
              onResolveConflict={handleResolveConflict}
              onTriggerSync={handleTriggerSync}
              onOpenCheckpointModal={() => {
                setCheckpointTaskId(selectedTask.id);
                setIsCheckpointOpen(true);
              }}
              onClaimTask={handleClaimTask}
              isSyncing={isSyncing}
              isOffline={isOffline}
              defaultTab={activeDetailTab}
            />
          )}
        </main>

        {/* Right Collapsible Agent Live HUD */}
        <AgentHUD
          isOpen={isAgentHUDOpen}
          onClose={() => setIsAgentHUDOpen(false)}
          currentTask={selectedTask}
          onSelectTaskById={(id) => {
            setCenterView({ type: 'task_detail', taskId: id });
            setActiveDetailTab('overview');
          }}
          onTriggerSync={handleTriggerSync}
          onOpenNewTaskWithDefaults={(defaults) => {
            setNewTaskDefaults(defaults);
            setIsNewTaskOpen(true);
          }}
          onQuickCheckpoint={(summary) => {
            handleSaveCheckpoint({ summary, type: 'progress' });
          }}
          onOpenConflict={(id) => {
            setCenterView({ type: 'task_detail', taskId: id });
            setActiveDetailTab('sync');
          }}
        />
      </div>

      {/* New Task Drawer/Modal */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onCreateTask={handleCreateTask}
        defaultData={newTaskDefaults}
        projects={projects}
        currentProjectId={currentProject.id}
      />

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Checkpoint Modal */}
      {isCheckpointOpen && (selectedTask || checkpointTaskId) && (
        <CheckpointModal
          isOpen={isCheckpointOpen}
          onClose={() => setIsCheckpointOpen(false)}
          task={selectedTask || tasks.find(t => t.id === checkpointTaskId)!}
          onSaveCheckpoint={handleSaveCheckpoint}
        />
      )}
    </div>
  );
};
