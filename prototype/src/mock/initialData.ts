import { Task, TaskEvent, Project } from '../types';

export const initialProjects: Project[] = [
  {
    id: 'agent-task-sync',
    name: 'Agent Task Sync',
    description: '核心 CLI 与 Git-Backed 跨设备多 Agent 任务与上下文同步系统',
    repo: 'github.com/organization/agent-task-sync',
    defaultBranch: 'main',
    syncState: 'local_ahead',
    unsyncedCount: 2,
    lastSyncedAt: '2026-09-02T14:15:00Z',
    activeAgents: ['codex', 'claude'],
    created_at: '2026-09-01T08:00:00Z'
  },
  {
    id: 'kaneo-integration',
    name: 'Kaneo MCP Bridge',
    description: 'Kaneo 通用项目看板与 Agent Task Sync 事件流双向 MCP 适配层',
    repo: 'github.com/organization/kaneo-bridge',
    defaultBranch: 'main',
    syncState: 'synced',
    unsyncedCount: 0,
    lastSyncedAt: '2026-09-02T15:00:00Z',
    activeAgents: ['cursor'],
    created_at: '2026-09-01T12:00:00Z'
  },
  {
    id: 'pi-extension-core',
    name: 'Pi Agent Plugin Core',
    description: 'Pi 编辑器状态栏插件与自动 Checkpoint 生命周期钩子实现',
    repo: 'github.com/organization/pi-plugin-core',
    defaultBranch: 'develop',
    syncState: 'local_ahead',
    unsyncedCount: 1,
    lastSyncedAt: '2026-09-02T13:20:00Z',
    activeAgents: ['pi', 'codex'],
    created_at: '2026-09-02T09:00:00Z'
  }
];

export const initialTasks: Task[] = [
  {
    id: 'task-001',
    title: '完成竞品分析与产品定位',
    project: 'agent-task-sync',
    goal: '全面调研 Kaneo、Cursor、Claude Code 等多 Agent 任务协同现状，明确 Agent Task Sync 核心差异化。',
    background: '市面上缺乏以不可变事件为核心、支持断点自动恢复与多端无感交接的专用系统。',
    criteria: [
      '梳理出与 Kaneo 等通用看板的核心差异（Git-backed vs Server DB）',
      '输出明确的产品定位与核心价值定义',
      '完成首版架构对比矩阵'
    ],
    status: 'completed',
    current_phase_id: 'p-001-3',
    next_action: '已完成全部验收项，准备进入核心架构设计',
    assigned_agent: 'codex',
    assigned_device: 'macbook-pro',
    active_session_id: 'sess-mac-0902-1',
    git_repo: 'github.com/organization/agent-task-sync',
    git_branch: 'docs/competitive-analysis',
    last_commit: 'a1b2c3d',
    unsynced_events_count: 0,
    last_checkpoint_at: '2026-09-02T10:30:00Z',
    created_at: '2026-09-01T09:00:00Z',
    updated_at: '2026-09-02T10:30:00Z',
    phases: [
      {
        id: 'p-001-1',
        order: 1,
        title: '市场同类产品调研',
        goal: '调研 Kaneo 及 Linear MCP 集成方式',
        criteria: '产出调研对比表',
        status: 'completed'
      },
      {
        id: 'p-001-2',
        order: 2,
        title: '产品差异化定位',
        goal: '定义 Agent Task Sync 原生人机协同范式',
        criteria: '完成定位论证',
        status: 'completed'
      },
      {
        id: 'p-001-3',
        order: 3,
        title: '产出分析结论与总结',
        goal: '汇总为 PRD 竞争分析章节',
        criteria: 'PRD 第 12 节通过评审',
        status: 'completed'
      }
    ]
  },
  {
    id: 'task-002',
    title: '实现 GitHub 同步引擎与任务接续文档重建',
    project: 'agent-task-sync',
    goal: '实现基于 Git 的跨设备事件同步机制，支持离线追加、多分支安全合并与从事件日志重建 task_plan.md。',
    background: '跨设备协作时 Mac 和 Windows 产生独立 JSONL 事件日志，需通过 Git 自动同步并保障无静默覆盖。',
    criteria: [
      '实现 `task-sync pull`、`push`、`sync` 核心算法',
      '支持从追加式 events/*.jsonl 快速构建 task_plan.md 状态视图',
      '在网络中断时优雅降级为离线模式，恢复后支持重试'
    ],
    current_focus: '事件 Schema 已确定，正在实现 pull -> validate -> rebuild 流程。',
    recent_completed: ['定义 event_id、父事件和设备标识', '增加重复事件幂等校验'],
    key_decisions: [{ decision: 'GitHub 事件历史是事实来源，Markdown 是投影', reason: '兼顾跨设备同步和人机可读性' }],
    known_errors: [{ error: 'Windows 换行符导致 JSONL 校验失败', attempts: '在校验前统一为 LF' }],
    verification: [{ command: 'pnpm test -- sync', result: '12/12 通过', checked_at: '2026-09-02T14:10:00Z' }],
    related_commands: ['pnpm test -- sync', 'task-sync sync'],
    uncommitted_changes: ['src/sync.ts', 'tests/sync.test.ts'],
    status: 'in_progress',
    current_phase_id: 'p-002-2',
    next_action: '确定事件 Schema 并编写 Git Rebase 幂等合并单元测试',
    assigned_agent: 'claude',
    assigned_device: 'windows-desktop',
    active_session_id: 'sess-win-claude-882',
    git_repo: 'github.com/organization/agent-task-sync',
    git_branch: 'feat/git-sync-engine',
    last_commit: '8f9e0a1',
    unsynced_events_count: 2,
    last_checkpoint_at: '2026-09-02T14:15:00Z',
    created_at: '2026-09-02T08:30:00Z',
    updated_at: '2026-09-02T14:15:00Z',
    phases: [
      {
        id: 'p-002-1',
        order: 1,
        title: 'Git 目录结构与配置初始化',
        goal: '支持 `.task-sync/` 本地目录结构创建',
        criteria: '执行 init 生成 config.yaml 与 devices 目录',
        status: 'completed'
      },
      {
        id: 'p-002-2',
        order: 2,
        title: '事件合并与幂等去重算法',
        goal: '处理多设备上传的事件追加合并',
        criteria: '通过并发 100 条事件合并测试',
        status: 'in_progress',
        claimedBy: {
          agentId: 'claude',
          deviceId: 'windows-desktop',
          sessionId: 'sess-win-claude-882'
        }
      },
      {
        id: 'p-002-3',
        order: 3,
        title: '任务接续文档渲染器',
        goal: '将事件聚合并输出人类/Agent 可读的 task_plan.md',
        criteria: '格式符合 PRD 8.2 规范且带 hash 校验',
        status: 'planned'
      },
      {
        id: 'p-002-4',
        order: 4,
        title: '离线模式与网络重试机制',
        goal: '离线时缓存本地操作并在联网后自动同步',
        criteria: '断网模拟测试通过',
        status: 'planned'
      },
      {
        id: 'p-002-5',
        order: 5,
        title: 'Mac / Windows 端到端集成测试',
        goal: '跨操作系统验证同步正确性',
        criteria: '两台机器双向同步无数据损坏',
        status: 'planned'
      }
    ]
  },
  {
    id: 'task-003',
    title: '设计任务与事件 Schema 规范 (交接示例)',
    project: 'agent-task-sync',
    goal: '制定 Task、Phase、Event、Handoff 完整 JSON Schema 规范，并建立强类型验证层。',
    background: '所有 Agent（Codex、Claude、Pi）与 CLI 必须遵循同一套事件格式，确保数据不被损坏。',
    criteria: [
      '定义全部 13 种事件类型的强校验 Schema',
      '支持 Secret 与敏感路径自动脱敏规则',
      '完成 schema 单元测试并生成 TypeScript 类型声明'
    ],
    status: 'handoff_ready',
    current_phase_id: 'p-003-3',
    next_action: '等待 Windows 上的 Claude 接收 Handoff，开始编写 TypeScript 类型生成器',
    assigned_agent: 'codex',
    assigned_device: 'macbook-pro',
    active_session_id: 'sess-mac-codex-901',
    git_repo: 'github.com/organization/agent-task-sync',
    git_branch: 'spec/event-schemas',
    last_commit: 'e5f6a7b',
    unsynced_events_count: 0,
    last_checkpoint_at: '2026-09-02T13:40:00Z',
    created_at: '2026-09-02T11:00:00Z',
    updated_at: '2026-09-02T13:40:00Z',
    handoff: {
      handoff_id: 'hdo_01j6k89abc',
      task_id: 'task-003',
      from_agent: 'codex',
      from_device: 'macbook-pro',
      target_agent: 'claude',
      created_at: '2026-09-02T13:40:00Z',
      completed_work: [
        '完成了 Task Schema (task.yaml) 定义，支持 6 种状态',
        '完成了 Event Schema (events.jsonl) 的 13 种类型校验',
        '编写了基础的 Ajv 验证器原型并通过了 15 个基础用例'
      ],
      incomplete_work: [
        '尚未实现 json-schema-to-typescript 自动化导出管道',
        '尚未集成敏感字段脱敏正则'
      ],
      key_decisions: [
        {
          decision: '事件采用 Append-Only 格式存储在每台设备独立文件中',
          reason: '避免多设备高频写入同一个文件导致复杂的 Git 文本冲突'
        },
        {
          decision: '所有远程数据在注入 Agent 前均做不可信标记与长度截断',
          reason: '防御 Prompt Injection 攻击'
        }
      ],
      known_errors: [
        {
          error: 'Windows 路径反斜杠导致跨平台 Hash 校验偶尔不一致',
          attempts: '已在 schema 预处理中统一规范为 POSIX 正斜杠处理'
        }
      ],
      next_step: '在 Windows 环境下运行 `npm test` 验证路径规范化，并接入 TS 类型导出脚本',
      relevant_files: [
        'schemas/task.schema.json',
        'schemas/event.schema.json',
        'src/validator.ts',
        'tests/schema.test.ts'
      ],
      test_summary: 'Mac 环境 18/18 单元测试全部通过，覆盖率 94%'
    },
    phases: [
      {
        id: 'p-003-1',
        order: 1,
        title: 'Task 元数据 Schema',
        goal: '定义任务基本信息及阶段模型',
        criteria: '覆盖 6 种任务状态与阶段列表',
        status: 'completed'
      },
      {
        id: 'p-003-2',
        order: 2,
        title: 'Event JSONL Schema',
        goal: '定义 13 种事件格式及不可变规则',
        criteria: '严格字段校验与 schema 测试',
        status: 'completed'
      },
      {
        id: 'p-003-3',
        order: 3,
        title: '跨平台类型生成与验证器',
        goal: '生成 TS 类型并编写统一验证器',
        criteria: '在 Mac 和 Windows 上均可执行',
        status: 'in_progress',
        claimedBy: {
          agentId: 'codex',
          deviceId: 'macbook-pro'
        }
      },
      {
        id: 'p-003-4',
        order: 4,
        title: '接入 Hook 自动化拦截',
        goal: '在写入前自动校验 schema',
        criteria: '非法 schema 写入时被拦截并记录报错',
        status: 'planned'
      }
    ]
  },
  {
    id: 'task-004',
    title: '解决多 Agent 并行认领状态冲突',
    project: 'agent-task-sync',
    goal: '解决 Mac/Codex 与 Windows/Claude 在离线状态下同时修改 Phase 2 产生的逻辑冲突。',
    background: '检测到两台设备对同一阶段写入了不同下一步结论，系统自动降级为 needs_review，等待人工审阅并合并。',
    criteria: [
      '清晰展示两台设备、两个 Agent 产生冲突的事件对比',
      '支持用户选择单侧覆盖或合并双方成果',
      '生成 conflict_resolved 修正事件并恢复任务流转'
    ],
    status: 'needs_review',
    current_phase_id: 'p-004-2',
    next_action: '需要人工审阅冲突，选择保留 Codex 的 API 方案还是 Claude 的 Hook 方案',
    assigned_agent: 'codex',
    assigned_device: 'macbook-pro',
    active_session_id: 'sess-conflict-01',
    git_repo: 'github.com/organization/agent-task-sync',
    git_branch: 'fix/concurrent-claims',
    last_commit: 'c3d4e5f',
    unsynced_events_count: 1,
    last_checkpoint_at: '2026-09-02T14:45:00Z',
    created_at: '2026-09-02T12:00:00Z',
    updated_at: '2026-09-02T14:45:00Z',
    conflict: {
      id: 'cfl_01j789xyz',
      task_id: 'task-004',
      phase_id: 'p-004-2',
      detected_at: '2026-09-02T14:45:00Z',
      conflict_reason: '同一 Phase 2 在离线状态下被 Mac/Codex 与 Windows/Claude 分别更新并提交了互斥的设计方案。',
      resolved: false,
      sideA: {
        agent_id: 'codex',
        device_id: 'macbook-pro',
        summary: '方案 A：采用统一 CLI 子命令实现 Hook 触发 (`task-sync hook post-tool`)',
        files: ['src/cli/hook.ts', 'config/codex-hooks.json'],
        commit: '9a8b7c6',
        timestamp: '2026-09-02T14:30:10Z'
      },
      sideB: {
        agent_id: 'claude',
        device_id: 'windows-desktop',
        summary: '方案 B：采用独立 Node.js 守护进程监听文件系统事件 (`task-sync daemon`)',
        files: ['src/daemon/watcher.ts', 'config/claude-plugin.json'],
        commit: '1b2c3d4',
        timestamp: '2026-09-02T14:32:45Z'
      }
    },
    phases: [
      {
        id: 'p-004-1',
        order: 1,
        title: '并发写入检测机制',
        goal: '基于 logical timestamp 与 parent_event 识别冲突',
        criteria: '冲突检出率 100%',
        status: 'completed'
      },
      {
        id: 'p-004-2',
        order: 2,
        title: 'Hook 触发架构设计方案决策',
        goal: '确定 CLI 模式还是 Daemon 监听模式',
        criteria: '人工决策通过后继续',
        status: 'blocked'
      },
      {
        id: 'p-004-3',
        order: 3,
        title: '合并测试与修正事件写入',
        goal: '写入 conflict_resolved 修正事件',
        criteria: '两端重新拉取后状态恢复 in_progress',
        status: 'planned'
      }
    ]
  },
  {
    id: 'task-005',
    title: '实现 Kaneo MCP 任务双向导入导出',
    project: 'kaneo-integration',
    goal: '通过 MCP 协议将 Kaneo 看板任务转换为 Agent Task Sync 本地 JSONL 事件流。',
    background: '支持企业既有 Kaneo 用户无需迁移数据库即可获得 Agent 断点恢复能力。',
    criteria: [
      '实现 `kaneo_import` 与 `kaneo_export` MCP 工具',
      '支持标签与工时字段兼容映射'
    ],
    status: 'in_progress',
    current_phase_id: 'p-005-1',
    next_action: '编写 Kaneo OpenAPI 客户端鉴权层',
    assigned_agent: 'cursor',
    assigned_device: 'macbook-pro',
    git_repo: 'github.com/organization/kaneo-bridge',
    git_branch: 'feat/mcp-server',
    last_commit: '7b8c9d0',
    unsynced_events_count: 0,
    last_checkpoint_at: '2026-09-02T15:00:00Z',
    created_at: '2026-09-01T14:00:00Z',
    updated_at: '2026-09-02T15:00:00Z',
    phases: [
      {
        id: 'p-005-1',
        order: 1,
        title: 'Kaneo OpenAPI 客户端',
        goal: '封装 REST API',
        criteria: '完成单元测试',
        status: 'in_progress'
      },
      {
        id: 'p-005-2',
        order: 2,
        title: 'MCP Server 工具暴露',
        goal: '暴露 task_get 与 task_update',
        criteria: 'Claude Code 成功调用',
        status: 'planned'
      }
    ]
  },
  {
    id: 'task-006',
    title: '编写 Pi Agent Extension 状态栏插件',
    project: 'pi-extension-core',
    goal: '在 Pi 编辑器中实时展示当前认领任务名称、未同步事件与 Checkpoint 快捷入口。',
    background: '为轻量级终端编辑器提供无感知的断点保护与阶段提醒。',
    criteria: [
      '监听 agent_start 与 agent_end 事件',
      '状态栏指示灯实时响应 Git 同步状态'
    ],
    status: 'in_progress',
    current_phase_id: 'p-006-1',
    next_action: '完善 Pi 生命周期 Hook 脚本',
    assigned_agent: 'pi',
    assigned_device: 'macbook-pro',
    git_repo: 'github.com/organization/pi-plugin-core',
    git_branch: 'develop',
    last_commit: '3f4a5b6',
    unsynced_events_count: 1,
    last_checkpoint_at: '2026-09-02T13:20:00Z',
    created_at: '2026-09-02T09:00:00Z',
    updated_at: '2026-09-02T13:20:00Z',
    phases: [
      {
        id: 'p-006-1',
        order: 1,
        title: '生命周期 Hook 监听',
        goal: '拦截 Session 状态',
        criteria: '成功输出 checkpoint 建议',
        status: 'in_progress'
      },
      {
        id: 'p-006-2',
        order: 2,
        title: '状态栏 UI 渲染',
        goal: '渲染 Task ID',
        criteria: '正常显示无闪烁',
        status: 'planned'
      }
    ]
  }
];

export const initialEvents: Record<string, TaskEvent[]> = {
  'task-001': [
    {
      event_id: 'evt_001_01',
      task_id: 'task-001',
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-init',
      type: 'task_created',
      summary: '创建任务：完成竞品分析与产品定位',
      details: '明确多 Agent 任务协同工具的技术架构与差异化空间。',
      created_at: '2026-09-01T09:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_001_02',
      task_id: 'task-001',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-0902-1',
      type: 'task_claimed',
      summary: 'Codex 认领全部阶段并开始执行',
      created_at: '2026-09-01T09:05:00Z',
      synced: true
    },
    {
      event_id: 'evt_001_03',
      task_id: 'task-001',
      phase_id: 'p-001-1',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-0902-1',
      type: 'phase_completed',
      summary: '完成 Kaneo、Cursor、Claude Code 调研，输出对比表',
      files: ['docs/competitive-analysis.md'],
      created_at: '2026-09-01T15:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_001_04',
      task_id: 'task-001',
      phase_id: 'p-001-2',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-0902-1',
      type: 'decision_recorded',
      summary: '决策：以 GitHub 事件日志为单一事实来源，不依赖云端集中数据库',
      created_at: '2026-09-02T09:30:00Z',
      synced: true
    },
    {
      event_id: 'evt_001_05',
      task_id: 'task-001',
      phase_id: 'p-001-3',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-0902-1',
      type: 'task_completed',
      summary: 'PRD 竞品与定位章节编写完成并归档',
      files: ['docs/product/agent-task-sync-prd-v0.1.md'],
      commit: 'a1b2c3d',
      test_status: 'passed',
      created_at: '2026-09-02T10:30:00Z',
      synced: true
    }
  ],
  'task-002': [
    {
      event_id: 'evt_002_01',
      task_id: 'task-002',
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-user',
      type: 'task_created',
      summary: '创建任务：实现 GitHub 同步引擎与快照重建',
      created_at: '2026-09-02T08:30:00Z',
      synced: true
    },
    {
      event_id: 'evt_002_02',
      task_id: 'task-002',
      phase_id: 'p-002-1',
      agent_id: 'claude',
      device_id: 'windows-desktop',
      session_id: 'sess-win-claude-882',
      type: 'task_claimed',
      summary: 'Claude (Windows) 认领阶段 1 与阶段 2',
      created_at: '2026-09-02T09:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_002_03',
      task_id: 'task-002',
      phase_id: 'p-002-1',
      agent_id: 'claude',
      device_id: 'windows-desktop',
      session_id: 'sess-win-claude-882',
      type: 'phase_completed',
      summary: '完成 .task-sync 基础配置脚手架生成',
      files: ['src/config/init.ts', 'src/types/config.ts'],
      commit: '8f9e0a1',
      test_status: 'passed',
      created_at: '2026-09-02T11:20:00Z',
      synced: true
    },
    {
      event_id: 'evt_002_04',
      task_id: 'task-002',
      phase_id: 'p-002-2',
      agent_id: 'claude',
      device_id: 'windows-desktop',
      session_id: 'sess-win-claude-882',
      type: 'progress',
      summary: '编写 Git pull 与 JSONL 事件流解析器',
      files: ['src/sync/engine.ts', 'src/sync/jsonl-parser.ts'],
      created_at: '2026-09-02T13:50:00Z',
      synced: false
    },
    {
      event_id: 'evt_002_05',
      task_id: 'task-002',
      phase_id: 'p-002-2',
      agent_id: 'claude',
      device_id: 'windows-desktop',
      session_id: 'sess-win-claude-882',
      type: 'test_result',
      summary: '单元测试：测试 50 条并发事件幂等去重成功',
      test_status: 'passed',
      created_at: '2026-09-02T14:15:00Z',
      synced: false
    }
  ],
  'task-003': [
    {
      event_id: 'evt_003_01',
      task_id: 'task-003',
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-init',
      type: 'task_created',
      summary: '创建任务：设计任务与事件 Schema 规范',
      created_at: '2026-09-02T11:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_003_02',
      task_id: 'task-003',
      phase_id: 'p-003-1',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-codex-901',
      type: 'phase_completed',
      summary: '定义 Task 元数据 Schema',
      files: ['schemas/task.schema.json'],
      created_at: '2026-09-02T12:10:00Z',
      synced: true
    },
    {
      event_id: 'evt_003_03',
      task_id: 'task-003',
      phase_id: 'p-003-2',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-codex-901',
      type: 'phase_completed',
      summary: '定义 13 种 Event 的完整 Schema 校验规则',
      files: ['schemas/event.schema.json'],
      created_at: '2026-09-02T13:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_003_04',
      task_id: 'task-003',
      phase_id: 'p-003-3',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-mac-codex-901',
      type: 'handoff_created',
      summary: 'Mac/Codex 完成阶段性验证，发起面向 Windows/Claude 的 Handoff',
      details: '包含 5 项完整性检查及所有决策背景，任务进入 handoff_ready。',
      commit: 'e5f6a7b',
      created_at: '2026-09-02T13:40:00Z',
      synced: true
    }
  ],
  'task-004': [
    {
      event_id: 'evt_004_01',
      task_id: 'task-004',
      agent_id: 'human',
      device_id: 'macbook-pro',
      session_id: 'sess-init',
      type: 'task_created',
      summary: '创建任务：解决多 Agent 并行认领状态冲突',
      created_at: '2026-09-02T12:00:00Z',
      synced: true
    },
    {
      event_id: 'evt_004_02',
      task_id: 'task-004',
      phase_id: 'p-004-1',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-conflict-01',
      type: 'phase_completed',
      summary: '编写并发写入检测逻辑',
      created_at: '2026-09-02T13:30:00Z',
      synced: true
    },
    {
      event_id: 'evt_004_03',
      task_id: 'task-004',
      phase_id: 'p-004-2',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-conflict-01',
      type: 'progress',
      summary: 'Mac/Codex 提交方案 A: 采用 CLI 子命令模式',
      commit: '9a8b7c6',
      created_at: '2026-09-02T14:30:10Z',
      synced: true
    },
    {
      event_id: 'evt_004_04',
      task_id: 'task-004',
      phase_id: 'p-004-2',
      agent_id: 'claude',
      device_id: 'windows-desktop',
      session_id: 'sess-win-claude-882',
      type: 'progress',
      summary: 'Windows/Claude 提交方案 B: 采用 Daemon 监听模式',
      commit: '1b2c3d4',
      created_at: '2026-09-02T14:32:45Z',
      synced: true
    },
    {
      event_id: 'evt_004_05',
      task_id: 'task-004',
      phase_id: 'p-004-2',
      agent_id: 'codex',
      device_id: 'macbook-pro',
      session_id: 'sess-conflict-01',
      type: 'conflict_detected',
      summary: '检测到两台设备对 Phase 2 产生了互斥提交，任务进入 needs_review',
      created_at: '2026-09-02T14:45:00Z',
      synced: false
    }
  ],
  'task-005': [
    {
      event_id: 'evt_005_01',
      task_id: 'task-005',
      agent_id: 'cursor',
      device_id: 'macbook-pro',
      session_id: 'sess-kaneo-01',
      type: 'task_created',
      summary: '初始化 Kaneo MCP 适配项目',
      created_at: '2026-09-01T14:00:00Z',
      synced: true
    }
  ],
  'task-006': [
    {
      event_id: 'evt_006_01',
      task_id: 'task-006',
      agent_id: 'pi',
      device_id: 'macbook-pro',
      session_id: 'sess-pi-01',
      type: 'task_created',
      summary: '创建 Pi Extension 状态栏扩展项目',
      created_at: '2026-09-02T09:00:00Z',
      synced: false
    }
  ]
};
