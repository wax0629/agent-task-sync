# Agent Task Sync 系统架构设计

版本：v0.1 草案  
日期：2026-09-03  
状态：待评审，不作为编码基线

## 1. 当前阶段与架构目标

当前处于产品原型确认后的系统架构设计阶段。本文目标是固定 MVP 的模块边界、数据契约和主干调用关系，为下一步可编译空骨架提供依据。

本文基于以下产品结论：

- 单人优先，多 Agent、多设备接续是核心场景。
- 一个 GitHub 代码仓库对应一个项目。
- 文件和 GitHub 是持久化与同步载体。
- 不保存完整聊天记录，只保存用户确认的任务信息和高价值工作记录。
- `phase`、`next_action` 和 Handoff 均可选；不因缺少阶段阻止任务继续。
- `task_plan.md` 是人和 Agent 的任务恢复入口；JSONL 是机器同步和审计层。
- MVP 不依赖数据库、常驻服务或 Web UI。

## 2. 目标与非目标

### 2.1 MVP 架构目标

- Mac 和 Windows 在同一个 GitHub 项目中同步任务状态。
- Codex 和 Claude Code 通过同一个核心 CLI 读取、更新和交接任务。
- 新会话只读取一次接续上下文即可开始工作。
- 多设备追加记录时不静默覆盖，不丢失离线工作。
- 所有状态都能从 Git 文件重建，本地缓存可以删除。
- 核心模块可以被 CLI、未来 MCP 和 Web UI 复用。

### 2.2 MVP 明确不做

- 不做团队、组织、角色权限和计费。
- 不做实时在线协同、WebSocket 和云数据库。
- 不做完整项目管理系统或通用 Kanban。
- 不监听或上传完整 Agent 对话。
- 不自动执行状态文件中出现的命令。
- 不自动解决语义冲突。
- 不在首版实现 Pi、Cursor 和 Web UI；只预留适配接口。

## 3. 关键架构决策

### 3.1 技术栈

选择 TypeScript + Node.js 20+：

- Codex、Claude Code Hook、Pi Extension 和 MCP 生态均可直接复用 TypeScript 类型与逻辑。
- Mac、Windows、Linux 有一致运行时。
- MVP 可以发布为单个 npm CLI，不需要服务端环境。

暂不选择 Rust。Rust 的单文件分发更好，但首版的 Agent 适配和迭代成本更高；当安装体积、启动速度或无 Node 环境成为真实问题后再评估。

### 3.2 Git 状态存放位置

备选方案：

1. 状态文件跟随当前代码分支。
2. 每个代码仓库使用独立的 `task-sync/state` 状态分支。
3. 所有项目状态集中到一个独立的 sidecar 仓库。

MVP 选择方案 2。

原因：

- 仍然满足“一个 GitHub 仓库对应一个项目”和“文件优先”。
- Agent 自动写入进度不会污染用户的功能分支和 PR 历史。
- 用户切换代码分支时，任务状态不会随分支消失。
- 不需要额外创建和授权一个中心服务或 sidecar 仓库。

本地通过独立 Git worktree 管理状态分支，路径位于系统应用数据目录，不占用用户当前代码工作区：

```text
macOS:   ~/Library/Application Support/agent-task-sync/projects/<repo-hash>/
Windows: %LOCALAPPDATA%/agent-task-sync/projects/<repo-hash>/
Linux:   $XDG_DATA_HOME/agent-task-sync/projects/<repo-hash>/
```

需要验证的风险：GitHub 分支保护、没有远程仓库、浅克隆以及 Windows worktree 行为。

### 3.3 状态事实来源

选择“事件为审计事实，Reducer 聚合当前状态，Markdown 是投影”：

```text
events/*.jsonl
  -> reducer
  -> task.yaml
  -> task_plan.md / progress.md / handoff.md
```

- JSONL 事件不可原地修改，只能追加修正事件。
- `task.yaml` 是机器读取的当前聚合状态，可由事件重建。
- `task_plan.md` 是完整的人机恢复视图，可由聚合状态重建。
- `progress.md` 是按时间生成的工作日志。
- `handoff.md` 只在存在有效 Handoff 时生成。

任何生成文件都不能反向覆盖事件。用户通过 CLI 或 Agent 修改 Markdown 时，系统先解析为候选变更，确认后追加事件，再重新生成文件。

### 3.4 Agent 接入方式

选择“一套核心 CLI + 通用 Skill + 薄适配器”：

- Skill 规定 Agent 何时读取状态、何时建议 Checkpoint，以及哪些操作需要用户确认。
- Hook 只接入会话生命周期，不实现任务业务逻辑。
- CLI/Core 执行所有校验、落盘、聚合和同步。
- MCP 作为后续主动调用接口，不是 MVP 的必需依赖。

## 4. 系统上下文

```text
┌──────────────────────┐
│ 人类用户              │
└──────────┬───────────┘
           │ 对话 / CLI 确认
┌──────────▼───────────┐
│ Codex / Claude Code   │
│ Skill + 薄 Hook       │
└──────────┬───────────┘
           │ 稳定 JSON/Markdown 接口
┌──────────▼──────────────────────────────────┐
│ task-sync CLI                               │
│ Application → Domain → Store/Renderer/Sync │
└──────────┬──────────────────────────────────┘
           │ 文件 + Git
┌──────────▼───────────┐       ┌──────────────┐
│ 本地状态 worktree     │ <---> │ GitHub 仓库   │
│ task-sync/state 分支  │       │ 状态分支      │
└──────────────────────┘       └──────────────┘
```

普通聊天不会直接进入这条链路。只有用户明确创建任务、确认 Checkpoint、创建 Handoff 或执行同步时才产生持久状态。

## 5. 模块与职责

| 模块 | 负责 | 不负责 |
|---|---|---|
| `domain` | Task、Event、Handoff、Conflict 规则；状态转换；Reducer | 文件、Git、终端输出 |
| `application` | 用例编排、事务边界、权限确认点 | 具体文件格式和 Git 命令 |
| `store-files` | JSONL 追加、YAML 读写、原子落盘、Schema 迁移 | 业务状态判断 |
| `renderer-markdown` | 从聚合状态生成 `task_plan.md`、`progress.md`、`handoff.md` | 解析完整聊天或执行命令 |
| `sync-git` | 状态 worktree、fetch/rebase/push、重试和 Git 冲突报告 | 判断任务语义冲突 |
| `project-registry` | 本机项目发现、代码仓库与状态 worktree 映射 | 跨设备事实状态 |
| `cli` | 参数、交互确认、JSON/文本输出和退出码 | 复制核心业务规则 |
| `adapter-contract` | Agent 适配器稳定输入输出类型 | 针对某个 Agent 的生命周期实现 |
| `adapters/codex` | Codex Skill、Hook 配置和 CLI 调用 | 单独实现任务存储 |
| `adapters/claude` | Claude Code Skill、Hook/命令配置和 CLI 调用 | 单独实现任务存储 |

依赖方向：

```text
cli / adapters
      -> application
            -> domain
            -> store ports
            -> sync ports

store-files / renderer-markdown / sync-git
      -> 实现 application 定义的 ports
```

`domain` 不得依赖 Node 文件系统、Git 或某个 Agent SDK。

## 6. 状态分支文件协议

状态分支建议采用孤立分支，只包含 `.task-sync/`：

```text
.task-sync/
├── manifest.yaml
├── project.yaml
├── tasks/
│   └── <task-id>/
│       ├── task.yaml
│       ├── task_plan.md
│       ├── progress.md
│       ├── handoff.md             # 可选
│       └── events/
│           └── <device-id>/
│               └── <agent-id>/
│                   └── <session-id>.jsonl
└── conflicts/
    └── <conflict-id>.yaml         # 仅存在未解决冲突时
```

### 6.1 文件职责

| 文件 | 写入者 | 说明 |
|---|---|---|
| `manifest.yaml` | CLI | 协议版本、生成器版本、仓库 ID |
| `project.yaml` | CLI | 项目名称、远程地址、默认分支等稳定信息 |
| `events/**/*.jsonl` | 当前会话 Writer | 唯一追加输入；不同会话写不同文件 |
| `task.yaml` | Reducer | 当前机器状态，不手工编辑 |
| `task_plan.md` | Renderer | 恢复主文档，不是事实来源 |
| `progress.md` | Renderer | 从事件生成的会话和验证日志 |
| `handoff.md` | Renderer | 当前有效交接包 |
| `conflicts/*.yaml` | Reducer | 待人工处理的语义冲突 |

### 6.2 写入约束

- 所有结构化文件使用 UTF-8、LF 和规范化 POSIX 相对路径。
- JSONL 每行一个完整 JSON 对象，文件末尾必须有换行。
- 先写临时文件并 `fsync`，再原子重命名；禁止半行事件。
- 事件文件按 `device/agent/session` 隔离，避免两台设备追加同一文件。
- 不记录密钥、完整环境变量、完整 Prompt 或聊天 transcript。
- `schema_version` 不兼容时拒绝写入，不能自动猜测。

## 7. 关键数据模型

以下为架构契约示意，最终以 JSON Schema 和 TypeScript 类型为准。

```ts
type TaskStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "handoff_ready"
  | "completed"
  | "archived";

interface TaskState {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  background?: string;
  acceptanceCriteria: AcceptanceCriterion[];
  status: TaskStatus;
  currentFocus?: string;
  recentCompleted: string[];
  nextAction?: string;
  phases?: Phase[];
  decisions: Decision[];
  openQuestions: Question[];
  knownErrors: KnownError[];
  references: WorkReference[];
  verification: VerificationResult[];
  ownership?: Ownership;
  sync: SyncSummary;
  revision: string;
}
```

阶段是可选字段。没有阶段时，任务状态由 `status + currentFocus + recentCompleted + nextAction` 表达。

```ts
interface TaskEvent<TPayload = unknown> {
  eventId: string;              // ULID，唯一标识，不作为绝对时钟
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  type: EventType;
  payload: TPayload;
  parentEventIds: string[];     // 写入者创建事件时观察到的任务 head
  writer: {
    agentId: string;
    deviceId: string;
    sessionId: string;
  };
  createdAt: string;            // 仅展示，不用于覆盖判定
}
```

MVP 事件类型保持克制：

```text
task_created
task_updated
task_claimed
checkpoint_recorded
decision_recorded
question_recorded
error_recorded
verification_recorded
handoff_created
handoff_accepted
task_blocked
task_completed
conflict_resolved
```

Checkpoint 负载包含：当前关注点、最近完成、下一步、文件变化、验证结果和未提交变更。缺失字段允许为空，但不能用空字符串覆盖已有内容。

## 8. 核心接口契约

### 8.1 Application Ports

```ts
interface EventStore {
  append(event: TaskEvent): Promise<void>;
  readTaskEvents(taskId: string): Promise<TaskEvent[]>;
  readProjectEvents(): Promise<TaskEvent[]>;
}

interface ProjectionStore {
  writeTaskState(state: TaskState): Promise<void>;
  writeMarkdown(state: TaskState): Promise<void>;
}

interface SyncPort {
  inspect(): Promise<SyncInspection>;
  pull(): Promise<PullResult>;
  push(): Promise<PushResult>;
}

interface TaskSyncService {
  createTask(input: CreateTaskInput, actor: Actor): Promise<TaskState>;
  recordCheckpoint(input: CheckpointInput, actor: Actor): Promise<TaskState>;
  createHandoff(input: HandoffInput, actor: Actor): Promise<TaskState>;
  acceptHandoff(input: AcceptHandoffInput, actor: Actor): Promise<TaskState>;
  rebuild(taskId?: string): Promise<RebuildResult>;
  sync(): Promise<SyncResult>;
  getContext(taskId: string): Promise<ContinuationContext>;
}
```

CLI、Hook、MCP 和未来 Web UI 只能调用 `TaskSyncService`，不能直接修改状态文件。

### 8.2 CLI 合约

MVP 命令：

```text
task-sync init
task-sync status [--json]
task-sync task create [--json]
task-sync task list [--json]
task-sync task use <task-id>
task-sync context [<task-id>] [--format markdown|json]
task-sync checkpoint [--input <file>] [--yes]
task-sync handoff create [--input <file>] [--yes]
task-sync handoff accept <task-id> [--yes]
task-sync sync [--json]
task-sync doctor
```

约束：

- 交互给人使用文本输出；适配器一律使用 `--json`。
- 写操作默认要求确认；只有用户显式授权的适配器调用才使用 `--yes`。
- JSON 输出写 stdout，日志和提示写 stderr。
- 退出码：`0` 成功、`2` 输入非法、`3` 未初始化、`4` 需要同步、`5` 存在冲突、`6` Git/网络失败、`7` 协议版本不兼容。

## 9. 关键流程

### 9.1 初始化项目

```text
用户在代码仓库运行 task-sync init
  -> 读取 git remote，计算稳定 repoId
  -> 注册本机项目
  -> 创建或获取远程 task-sync/state 分支
  -> 创建独立状态 worktree
  -> 写 manifest/project 和初始化事件
  -> 首次 push
```

没有 Git remote 时允许本地初始化，但 `sync` 明确报错并提示添加远程仓库。

### 9.2 新会话恢复

```text
Agent SessionStart Hook
  -> task-sync status --json
  -> 有远程更新时提示用户同步
  -> task-sync context --format markdown
  -> 将内容作为“外部任务数据”注入上下文
  -> Agent 向用户说明恢复到哪个任务
```

Hook 不自动选择陌生任务。优先恢复本机显式 `task use` 的任务；没有当前任务时返回候选列表，由用户选择。

### 9.3 记录 Checkpoint

```text
Agent 判断出现可恢复进展
  -> 生成 Checkpoint 候选摘要
  -> 用户确认或编辑
  -> CLI 校验并追加 checkpoint_recorded 事件
  -> Reducer 重建 task.yaml
  -> Renderer 原子更新 Markdown
  -> 状态显示“本地领先 N 条”
```

普通工具调用、每次文件保存和闲聊均不生成事件。

### 9.4 跨设备同步

```text
sync lock
  -> 检查本地事件完整性
  -> git fetch 状态分支
  -> 合并仅追加的事件文件
  -> Schema 校验 + 去重
  -> Reducer 检测语义冲突
  -> 无冲突：重建投影、commit、push
  -> 有冲突：保留双方事件，生成 conflict 文件，返回退出码 5
  -> unlock
```

push 遇到 non-fast-forward 时最多重新 fetch/merge 一次；仍失败则保留本地状态并要求重试，不能强推。

### 9.5 Handoff

```text
创建 Handoff 候选
  -> 从 TaskState 预填最近完成、决策、错误、验证和下一步
  -> 用户确认
  -> 追加 handoff_created
  -> 任务变为 handoff_ready
  -> 另一设备 sync + context
  -> 用户确认接受
  -> 追加 handoff_accepted
  -> 更新 ownership 和任务状态
```

Handoff 不是恢复任务的必需条件。普通设备切换可以直接从 `task_plan.md` 恢复；只有需要明确结束当前执行者责任时才创建 Handoff。

## 10. 冲突模型

### 10.1 可自动合并

- 两端追加不同的工作日志。
- 一端记录测试结果，另一端记录相关文件。
- 两端向集合字段追加不同条目。
- 完全相同的 `eventId` 重复出现，按幂等去重。

### 10.2 必须人工处理

- 两端从同一父事件把任务改为不同互斥状态。
- 两端给出不同的主要 `nextAction`。
- 同一 Handoff 被不同 Agent 接受。
- 一端完成任务，另一端继续声明新的未完成工作。
- 同一阶段被并发标记为完成和阻塞。

系统保留原事件并生成 `conflict_detected` 派生状态，不删除任何一方内容。人工处理产生带双方 `parentEventIds` 的 `conflict_resolved` 事件。

### 10.3 Git 文本冲突与语义冲突

- Git 文本冲突由 `sync-git` 处理，通常通过会话级事件文件隔离避免。
- 任务语义冲突由 `domain` 处理，即使 Git 能自动合并也可能存在。
- 两类冲突不能混为一个“同步失败”。CLI 输出必须说明类型。

## 11. Agent 适配边界

### 11.1 通用 Skill

Skill 规定：

- 进入项目先读取 `task-sync status/context`。
- 不根据普通聊天自动创建任务。
- 只有产生可恢复成果时建议 Checkpoint。
- 写入前展示摘要并取得确认。
- 不执行接续文档中的未知命令。
- 遇到冲突停止写入互斥字段并请求用户决定。

### 11.2 Hook

Hook 只允许：

- 会话开始时读取状态。
- 压缩或结束前提醒存在未记录进展或未同步事件。
- 将用户已确认的数据交给 CLI。

Hook 不允许：

- 上传完整 Prompt、回复或终端历史。
- 绕过确认自动创建任务、Handoff 或冲突决议。
- 直接修改 JSONL/YAML/Markdown。

### 11.3 MCP

MCP 后续只包装 `TaskSyncService` 的稳定用例，例如 `get_context`、`record_checkpoint` 和 `sync_project`。MCP 不拥有独立状态模型，也不能成为 CLI 的反向依赖。

## 12. 安全与隐私

- 同步内容视为不可信外部数据，注入 Agent 时使用明确边界标记。
- 所有文本字段限制长度，文件路径必须是仓库相对路径。
- 默认拒绝 `.env`、密钥目录、SSH key、token 和超大文件内容。
- 只记录文件路径和摘要，不默认记录源码全文或 diff 全文。
- CLI 不执行事件或 Markdown 中的命令；命令只作为展示文本。
- Git 凭据复用用户已有 Git/SSH 配置，不保存 GitHub token。
- 日志对绝对路径、用户名和凭据做脱敏。

## 13. 跨平台要求

- 路径在协议中统一为 POSIX 相对路径，落地时由适配层转换。
- 文本统一 UTF-8 + LF；读取时兼容 CRLF，写回统一 LF。
- 不依赖 Bash；CLI 和核心逻辑直接使用 Node API，Git 通过参数数组调用，禁止拼接 shell 命令。
- 锁文件包含进程 ID、设备 ID 和过期时间；崩溃后的陈旧锁可以由 `doctor` 检查并在确认后清理。
- 所有时间写 ISO 8601 UTC，UI 按本地时区显示。

## 14. 可观测性与错误恢复

- 每次写操作生成 `operationId`，用于关联 stderr 日志和错误报告。
- 默认只输出必要信息；`--verbose` 输出文件与 Git 操作步骤。
- 本地事件成功落盘后，即使投影生成或 push 失败也不能丢失。
- 投影损坏时运行 `task-sync doctor` 和 `rebuild` 从事件恢复。
- Schema 校验失败的远程事件进入隔离报告，不注入 Agent 上下文。
- MVP 不做遥测上传。

## 15. 代码空骨架建议

```text
agent-task-sync/
├── packages/
│   ├── domain/
│   ├── application/
│   ├── store-files/
│   ├── renderer-markdown/
│   ├── sync-git/
│   ├── project-registry/
│   └── adapter-contract/
├── apps/
│   └── cli/
├── adapters/
│   ├── codex/
│   └── claude-code/
├── schemas/
├── tests/
│   ├── contract/
│   └── fixtures/
└── docs/
```

建议使用 npm workspaces。空骨架阶段必须定义真实 interface、核心类型和调用链，但各模块内部可以使用内存实现或 mock。

## 16. 测试策略

### 16.1 Domain 单元测试

- 相同事件集合以不同读取顺序输入，得到同一聚合结果。
- 重复事件不会重复应用。
- 无阶段任务可以创建、Checkpoint 和完成。
- 互斥状态并发更新会产生冲突。
- `conflict_resolved` 必须引用冲突双方。

### 16.2 文件协议契约测试

- Mac/Windows 路径和 CRLF 输入得到一致规范化结果。
- 中途崩溃不会留下半行 JSONL 或半写 YAML。
- Markdown 投影可由 fixture 事件稳定重建。
- 新旧 Schema 的兼容和拒绝行为可预测。

### 16.3 Git 集成测试

- 两个临时克隆模拟 Mac 和 Windows 双向同步。
- 离线双方追加事件后可以合并。
- non-fast-forward 重试不会丢事件。
- 状态分支与当前功能分支相互独立。
- 无远程、无权限、浅克隆和分支保护均有明确错误。

### 16.4 Agent 适配验收

- Codex 和 Claude Code 读取相同 fixture 得到同一任务上下文。
- 未经确认不会产生持久事件。
- 新会话不读取 transcript 也能完成下一步操作。

## 17. MS1 空骨架主干

首个可编译版本只要求串联以下路径：

```text
CLI init
  -> Application service
  -> File EventStore（可写 fixture）
  -> Domain reducer
  -> Markdown renderer
  -> Git SyncPort（首版可 mock）
  -> CLI JSON result
```

验收门槛：

- workspace 可以安装、构建和测试。
- 核心接口与数据类型不是占位名称。
- CLI 确实调用 Application，Application 确实调用各 port。
- 用一个 mock 任务生成 `task.yaml` 和 `task_plan.md`。
- Git SyncPort 可以返回 mock 同步结果，但调用必须已经串联。
- Codex/Claude 适配目录只能调用 CLI 契约，不能复制 Reducer。

这不代表 MVP 已经真实同步；真实双设备 Git 流程属于下一阶段。

## 18. 建议 Issue 拆分

1. 定义 Domain 类型、事件 Schema 和 Reducer 接口。
2. 建立 npm workspace 与可编译主干。
3. 实现 File EventStore、原子写入和 Markdown Renderer。
4. 串联 CLI 的 `init/status/context`。
5. 实现状态分支 worktree 和 Git SyncPort。
6. 实现 Checkpoint、Handoff 与冲突 Reducer。
7. 接入 Codex Skill/Hook。
8. 接入 Claude Code Skill/Hook。
9. 完成 Mac/Windows 双克隆端到端测试。

每个 Issue 应对应一个或少量可评审 PR，不把所有模块放进一个大 PR。

## 19. 风险与验证方式

| 风险 | 影响 | 编码前验证 |
|---|---|---|
| 状态分支 worktree 在不同系统行为不一致 | 同步方案不可用 | Mac/Windows 各做最小 Git spike |
| 丰富 Markdown 无法由事件完整重建 | 任务恢复信息丢失 | 用真实任务 fixture 做往返测试 |
| 并发模型过度复杂 | 产品变重、难维护 | 只实现集合合并和五类互斥冲突 |
| Hook 能力在不同 Agent 间差异较大 | 自动恢复体验不一致 | 先定义 CLI 契约，再逐个做适配 spike |
| 自动 commit/push 干扰用户 Git | 用户不信任产品 | 所有状态操作限制在独立状态 worktree |
| Prompt injection 通过同步内容进入 Agent | 安全风险 | 上下文边界、字段限长、命令不执行测试 |
| GitHub 不可用或离线 | 无法切换设备 | 本地追加成功优先，恢复联网后显式同步 |

## 20. 待评审决策

以下问题需要在搭空骨架前确认：

1. 是否接受每个项目使用 `task-sync/state` 独立状态分支？
2. MVP 是否只支持 Codex + Claude Code，Pi 延后？
3. Checkpoint 写入是否始终需要用户确认，还是允许用户为某个项目开启自动确认？
4. `task_plan.md` 是否完全由系统生成，还是允许用户手工编辑后由 CLI 转成事件？
5. Handoff 是否保留单个当前文件，历史只通过事件查看？
6. Web 原型是否明确不进入首个 CLI MVP 的实现范围？

这些决策确认后，本文升级为架构基线，再创建空骨架 Issue；在此之前不应直接实现真实同步。
