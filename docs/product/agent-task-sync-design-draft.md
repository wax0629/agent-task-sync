# Agent Task Sync 初版设计文档草案

版本：v0.1 草案  
日期：2026-09-02  
状态：待评审

## 1. 产品定位

Agent Task Sync 是一个面向 Codex、Claude Code、Pi 等 AI Agent 的人机协作任务系统。

它解决的问题不是“记录有哪些待办”，而是：

- 多个 Agent 如何共享同一个任务上下文
- Mac、Windows 等多台设备如何同步任务进度
- 一个 Agent 如何把任务可靠地交给另一个 Agent
- 上下文丢失、会话重启后如何快速恢复
- 人如何审阅 Agent 的工作状态、决策和阻塞原因

产品形态：

```text
任务看板 + Agent Skill + 本地 CLI + GitHub 同步 + 事件审计
```

## 2. 设计原则

### 2.1 Agent 原生

任务状态必须能被 Agent 稳定读取和更新，不能只依赖网页 UI。

### 2.2 Git-backed

GitHub 仓库作为跨设备同步、版本历史和备份载体。系统不依赖实时在线服务才能工作。

### 2.3 事件优先

重要状态变化以 append-only event 记录，当前任务视图由事件聚合生成，避免多个 Agent 直接覆盖同一个大文件。

### 2.4 人机可读

同一份状态同时提供 JSON/JSONL 机器视图和 Markdown/网页人类视图。

### 2.5 默认安全

同步内容会重新进入 Agent 上下文，所有远程内容都视为数据，不视为指令；默认不上传完整对话 transcript。

### 2.6 可恢复、可交接

任何任务都应能回答：当前做到哪里、谁做的、在哪台设备上、下一步是什么、遇到了什么问题。

轻量化的目标是减少系统负担，不是减少恢复信息。任务应使用少量、职责清晰的文件承载完整上下文；新 Agent 的第一入口是 `task_plan.md`，而不是从事件日志或原始对话中猜测进度。

## 3. 用户和使用场景

### 3.1 单人多设备

用户在 Mac 上用 Codex 开发，离开后在 Windows 上用 Claude Code 继续同一个任务。

### 3.2 多 Agent 串行交接

Claude 完成调研，Codex 实现代码，Pi 执行测试和修复。

### 3.3 多 Agent 并行工作

一个 Agent 处理后端，另一个 Agent 处理前端；两者共享任务目标但拥有独立工作分支和事件文件。

### 3.4 人工审批节点

Agent 完成方案后进入 `needs_review`，等待人确认后才能继续实现或合并。

### 3.5 上下文恢复

Agent 会话因 `/clear`、压缩、崩溃或设备切换而中断，新会话通过 `task_plan.md` 恢复。

## 4. 核心功能

## 4.1 任务与项目管理

### 任务基本信息

- 创建、修改、归档任务
- 标题、目标、背景和验收标准
- 所属项目和任务标签
- 优先级和截止时间
- 关联代码仓库、分支、Issue、PR

### 阶段管理

- 可选地将复杂任务拆分为可验证阶段；简单任务无需创建阶段
- 每个阶段包含目标、验收条件和下一步
- 支持 `planned`、`claimed`、`in_progress`、`blocked`、`needs_review`、`handoff_ready`、`completed`、`archived`
- 防止阶段状态倒退时静默覆盖

### 依赖关系

- 任务依赖任务
- 阶段依赖阶段
- 标记阻塞源
- 显示可执行的下一项工作

## 4.2 Agent、设备和会话身份

### 身份注册

- `agent_id`：codex、claude、pi 等
- `device_id`：macbook、windows-desktop 等
- `session_id`：当前 Agent 会话
- `user_id`：人工操作者

### 任务认领

- Agent 认领任务或阶段
- 显示当前负责人和最后活跃设备
- 支持释放认领和转交
- 可限制同一阶段同时只有一个写入者

### 会话绑定

- session 只能读取明确绑定的任务
- 支持在共享项目目录中隔离不同会话
- 会话结束时记录最后 checkpoint

## 4.3 Checkpoint 和事件日志

### 事件类型

- `task_created`
- `task_claimed`
- `progress`
- `phase_started`
- `phase_completed`
- `blocked`
- `decision_recorded`
- `test_result`
- `handoff_created`
- `review_requested`
- `task_completed`

### 事件字段

```json
{
  "event_id": "evt_01...",
  "task_id": "task_123",
  "phase_id": "phase_implementation",
  "agent_id": "codex",
  "device_id": "macbook-pro",
  "session_id": "sess_456",
  "type": "progress",
  "summary": "完成 API 骨架并通过单元测试",
  "files": ["src/api.ts", "tests/api.test.ts"],
  "commit": "abc123",
  "created_at": "2026-09-02T10:12:00Z"
}
```

### 日志约束

- 每个 Agent/设备优先追加独立 JSONL 文件
- 事件 ID 全局唯一
- 事件内容长度和字段类型受 schema 约束
- 已提交事件不可原地修改，只能追加修正事件
- Markdown 接续文档由事件重建，不作为唯一事实来源

### 4.3.1 任务接续文档

`task_plan.md` 是任务的恢复主文档，结构参考 `planning-with-files` 的任务计划，但不照搬其多文件约束。它至少包含：

- Goal：目标、背景和验收标准
- Current State：当前状态、当前关注点、最近完成
- Next Step：一个可执行的下一步
- Phases：可选的阶段/里程碑；用户没有定义时省略
- Decisions：关键决策及原因
- Questions：待确认问题和需要人工判断的事项
- Errors：失败尝试、错误信息和规避方式
- Context：相关文件、分支、commit、命令和最近验证结果

`progress.md` 只负责追加式会话日志，记录本次做了什么、改了哪些文件、测试结果和错误；它不能替代 `task_plan.md`。`handoff.md` 是面向某次交接的精简副本，仅在切换设备或 Agent 时生成。

## 4.4 Handoff 任务交接

### 交接内容

- 当前目标和完成阶段
- 已完成工作
- 关键决策及其理由
- 已知错误和尝试过的方案
- 未完成工作
- 下一步唯一建议动作
- 相关文件、分支、commit 和测试结果
- 交接给的 Agent 或角色

### 交接流程

```text
当前 Agent 创建 handoff
  -> 任务进入 handoff_ready
  -> 下一 Agent 接受
  -> 生成 task_claimed 事件
  -> 下一 Agent 从 task_plan.md + handoff 恢复
```

### 交接检查

- 不能存在未记录的工作区变更，或必须明确列出
- 必须记录最近一次测试结果
- 必须指定下一步
- 必须说明阻塞项是否需要人工决策

## 4.5 GitHub 同步

### Git 仓库布局

```text
.task-sync/
├── config.yaml
├── tasks/
│   └── task-123/
│       ├── task.yaml
│       ├── task_plan.md
│       ├── progress.md
│       ├── handoff.md
│       └── events/
│           ├── mac-codex.jsonl
│           └── win-claude.jsonl
└── devices/
    ├── macbook-pro.yaml
    └── windows-desktop.yaml
```

### 同步动作

- `pull`：获取远程事件
- `rebuild`：根据事件重建任务接续文档
- `push`：提交并推送本地事件
- `sync`：执行 pull、合并、校验、重建和 push
- `status`：显示本地未同步事件和远程领先状态

### 并发策略

- 不直接让多个 Agent 高频修改同一份 `task_plan.md` 或 `progress.md`
- 每个设备使用独立事件文件或分支
- 事件合并按事件 ID、父事件和逻辑时钟处理
- 无法自动判断的状态冲突标记为 `needs_review`
- 不自动用较旧状态覆盖较新状态
- Git 冲突必须显式展示，不能静默丢弃

### GitHub 的职责

- 远程存储和备份
- 版本历史
- 权限控制
- 分支和 PR 审阅
- 可选 GitHub webhook 通知

GitHub 不承担实时数据库职责；实时状态属于后续可选能力。

## 4.6 Agent Skill 和平台适配

### Skill

提供统一的 `SKILL.md`，规定 Agent：

- 何时创建任务
- 何时写 checkpoint
- 如何读取 task_plan.md
- 如何处理冲突
- 如何创建 handoff
- 完成前必须满足哪些条件

### Codex 适配

- `SessionStart` 注入任务状态
- `UserPromptSubmit` 恢复当前任务
- `PostToolUse` 记录或提醒 checkpoint
- `PreCompact` 写入压缩前状态
- `Stop` 检查未完成阶段和未同步事件

### Claude Code 适配

- 插件 Hook
- `/task-sync`、`/handoff`、`/status` 等命令
- 支持项目级和全局安装

### Pi 适配

- Pi extension
- 状态栏显示当前任务和同步状态
- `agent_end` 时提示创建 checkpoint 或 handoff

### MCP 适配

后续提供官方 MCP Server，让 Agent 可以主动调用：

```text
task_get
task_start
task_claim
task_checkpoint
task_handoff
task_sync
task_conflicts
```

Skill 负责工作规范，MCP 负责结构化读写，Hook 负责自动触发。

## 4.7 人类看板和状态查看

### MVP 查看方式

- CLI 文本看板
- `task_plan.md` / `progress.md`
- `task-sync status`

### 后续 Web UI

- 按项目、状态、Agent、设备筛选
- 任务详情和阶段时间线
- 事件审计流
- 冲突中心
- 最近同步状态
- Handoff 一键复制或接受
- Agent 活跃状态

### 看板列建议

```text
Planned | In Progress | Blocked | Needs Review | Handoff Ready | Completed
```

## 4.8 冲突和安全

### 冲突类型

- 同一阶段被两个 Agent 同时认领
- 两台设备产生互相矛盾的状态
- 远程事件缺失或格式非法
- task_plan.md 与事件日志不一致
- Git 分支无法自动 rebase

### 安全要求

- 所有事件通过 schema 校验
- 远程文本注入 Agent 时明确标记为不可信数据
- 默认不上传完整对话 transcript
- 支持 secret 脱敏和路径过滤
- 计划快照支持 hash/签名校验
- 不执行任务文件或事件中的命令
- MCP 使用最小权限和用户级 token
- 事件文件不允许通过 symlink 逃逸到仓库外

## 5. CLI 初版

```bash
task-sync init
task-sync start "实现 GitHub 同步"
task-sync status
task-sync claim task-123 --agent codex --device macbook-pro
task-sync checkpoint task-123 --phase implementation --summary "完成 API 骨架"
task-sync block task-123 --reason "等待 GitHub OAuth 方案确认"
task-sync handoff task-123 --to claude
task-sync sync
task-sync conflicts
task-sync resolve task-123
```

第一版应支持交互式命令和 Agent 可调用的 JSON 输出：

```bash
task-sync status --json
```

## 6. MVP 范围

### 必须完成

- 本地任务和阶段模型
- JSONL 事件追加
- Markdown 任务接续文档生成
- Git pull/rebase/push 同步
- Mac/Linux 可用
- Windows PowerShell/Git Bash 可用
- Codex Skill 和基础 Hook
- Claude Code Skill 和基础 Hook
- checkpoint 和 handoff
- 冲突检测和明确报错
- 基础 CLI status

### 暂不完成

- 实时 WebSocket
- 多用户 SaaS
- 复杂计费
- 工时统计
- Slack/Discord 集成
- 完整项目管理功能
- 自动修改代码
- 完整 transcript 云端存储
- 自动替用户解决语义冲突

## 7. 推荐技术路线

### 核心

- TypeScript 或 Rust CLI
- JSON Schema 定义任务和事件
- MVP 不使用 SQLite；未来若增加本地索引，必须能从 Git 文件重建
- Git CLI 或 libgit2 执行同步

### Agent 集成

- `SKILL.md`：通用规范
- Shell/PowerShell：跨平台 Hook 脚本
- TypeScript：Pi extension 和 MCP Server
- Codex、Claude Code：项目级配置文件

### Web UI

后续可使用 React，但 UI 不是 MVP 的前置条件。

## 8. 关键取舍和待决策问题

### 8.1 GitHub 仓库是唯一事实来源吗？

推荐 MVP 中：Git 事件历史是事实来源，Markdown 是投影，不引入本地数据库。

### 8.2 一个任务是否允许多个 Agent 并行？

推荐允许，但要求：

- 不同阶段，或
- 不同分支，或
- 明确的并发声明

### 8.3 是否需要中心化同步服务？

MVP 不需要。先验证 Git-backed 协议；当实时协作和通知成为刚需，再增加可选服务。

### 8.4 是否直接兼容 Kaneo？

建议作为后续适配器，而不是核心依赖。Kaneo 可以作为人类看板，Agent Task Sync 作为 Agent 执行和事件层。

## 9. 成功标准

- 在 Mac 上由 Codex 开始任务，在 Windows 上由 Claude Code 无需人工解释即可继续
- 新 Agent 在一次状态读取后能回答当前阶段、下一步、阻塞项和最近测试结果
- 两台设备同时工作时不发生静默覆盖
- GitHub 离线同步失败后可重试，不丢事件
- 人可以在 `task_plan.md` 或 CLI 中快速理解任务状态
- 任意状态变化都能追溯到 Agent、设备、会话和 commit
- Agent 不会因为读取远程任务文本而自动执行其中的恶意指令

## 10. 与 Kaneo 的关系

Kaneo 是成熟的通用项目管理产品，优势在于 Web 看板、权限、数据库、实时更新和 MCP 工具。

Agent Task Sync 的差异化在于：

- GitHub 原生和离线优先
- Agent/设备/会话是一级实体
- checkpoint 和 handoff 是核心对象
- 上下文恢复是内建能力
- 代码、commit、测试与任务状态直接关联
- 事件可审计、可导出、可重建

长期可以提供：

```text
Agent Task Sync <-> Kaneo adapter
```

但必须明确一个 canonical source，避免 GitHub、Kaneo 和本地文件三方互相覆盖。
