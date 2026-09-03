# Agent Task Sync 产品需求文档（PRD）

版本：v0.1  
日期：2026-09-02  
状态：初版，待评审

## 1. 产品概述

### 1.1 产品名称

Agent Task Sync（暂定名）

### 1.2 一句话描述

一个让人和 Codex、Claude Code、Pi 等 AI Agent 在多台设备之间共享任务进度、恢复上下文并可靠交接工作的任务系统。

### 1.3 产品定位

Agent Task Sync 不是普通的项目管理软件，也不是单独的 Agent 插件，而是：

```text
Agent 任务看板 + 上下文恢复 + Handoff 交接 + GitHub 同步
```

它的核心价值是让“任务当前做到哪里”成为一份可被人和机器共同读取的持久状态。

### 1.3.1 产品形态

产品由一个统一核心和多个 Agent 接入层组成：

```text
task-sync 核心 CLI / 本地同步引擎
  ├── 任务、阶段、事件和冲突逻辑
  ├── GitHub/Git 同步
  ├── task_plan.md 和 handoff 生成
  └── 统一 JSON/JSONL 接口

Agent 接入层
  ├── 通用 Agent Skill
  ├── Codex Hook
  ├── Claude Code Hook/Plugin
  ├── Pi Extension
  └── MCP Server
```

核心逻辑只实现一次；不同 Agent 只适配各自的生命周期、配置和输出格式。

### 1.3.2 轻量化边界

产品应接近 `planning-with-files` 的轻量体验，而不是建设一个新的项目管理 SaaS：

- 文件优先，CLI 优先，Web 看板不是使用前提
- 无常驻云端服务即可完成创建、记录、查看和同步
- 不要求用户先维护复杂的项目、阶段、权限和组织模型
- 不保存完整聊天 transcript，只保存明确的任务摘要和高价值事件
- 轻量不等于信息稀疏：跨会话恢复必须有一份足够完整的任务接续文档
- Agent 适配器保持薄，核心逻辑不复制到各个平台
- 结构化事件只记录跨设备合并和审计必需的信息
- 本地缓存可以删除并从 GitHub 状态文件重建

### 1.4 目标用户

- 使用 Codex、Claude Code、Pi、Cursor 等多个 Agent 的个人开发者
- 在 Mac、Windows、Linux 之间切换工作的开发者
- 需要让不同 Agent 串行或并行处理同一任务的技术负责人
- 希望保留 Agent 工作记录和决策依据的团队

## 2. 用户问题

### 2.1 当前痛点

- Agent 的任务上下文留在对话中，`/clear`、压缩或崩溃后难以恢复
- 不同 Agent 使用各自的任务列表，状态彼此不可见
- Mac 和 Windows 上的 Agent 不知道另一台设备完成了什么
- Agent 交接依赖人工重新解释背景、决策和下一步
- 多个 Agent 同时工作时容易覆盖进度或产生隐性冲突
- GitHub 只记录代码变化，没有记录任务执行状态
- 普通 Kanban 只能显示“待办/进行中/完成”，无法表达 Agent、设备、会话和测试状态

### 2.2 用户期望

用户希望在任意一台设备、任意一个支持的 Agent 中打开任务后，立即知道：

1. 目标是什么
2. 已经完成了什么
3. 当前由谁、在哪台设备上处理
4. 下一步唯一应该做什么
5. 有哪些阻塞、决策和失败记录
6. 本地状态是否已经同步

## 3. 产品目标与非目标

### 3.1 MVP 产品目标

- 在 Mac 和 Windows 之间同步同一个任务的结构化状态
- 支持至少 Codex 和 Claude Code 两种 Agent 接入
- 支持 Agent 建议 checkpoint 和 handoff，并在用户确认后写入
- 支持多个 Agent 通过事件日志协作，避免静默覆盖
- 新会话可以在一次状态读取后恢复工作
- 人可以通过 CLI 和 `task_plan.md` 理解完整进度
- GitHub 提供版本历史、备份和冲突可追溯能力

### 3.2 非目标

- 不做完整的 Jira、Linear 或 Kaneo 替代品
- 不在 MVP 中提供团队计费和复杂组织管理
- 不保存或同步完整 Agent 对话 transcript
- 不自动执行任务文件中的命令
- 不保证所有语义冲突都能自动解决
- 不在 MVP 中实现实时协同编辑
- 不强制依赖云端服务才能使用

## 4. 核心概念

| 概念 | 定义 |
|---|---|
| 项目 | 一组相关任务及其代码仓库 |
| 任务 | 一个具有明确目标和验收标准的工作单元 |
| 阶段 | 任务内部可验证的执行步骤 |
| Agent | 执行任务的工具，如 Codex、Claude Code、Pi |
| 设备 | 运行 Agent 的 Mac、Windows 或 Linux 设备 |
| 会话 | Agent 在某台设备上的一次连续工作上下文 |
| 事件 | 一次不可变的状态变化或工作记录 |
| Checkpoint | Agent 在工作中保存的阶段性进度 |
| Handoff | 面向下一位 Agent 的结构化交接包 |
| 接续文档 | 从事件日志生成的人类和 Agent 可读的完整任务状态 |

## 5. 用户角色

### 5.1 人类用户

- 创建和拆分任务
- 查看任务状态和活动记录
- 批准方案或解除阻塞
- 指派、暂停、交接和归档任务
- 解决无法自动合并的冲突

### 5.2 执行 Agent

- 读取任务目标、阶段和约束
- 认领任务或阶段
- 记录 checkpoint、测试结果和错误
- 创建 handoff
- 根据权限更新任务状态

### 5.3 观察 Agent

- 读取任务和事件
- 生成总结、风险分析或测试建议
- 默认无权修改任务状态

## 6. 功能需求

优先级说明：P0 为 MVP 必须，P1 为首个可用版本应完成，P2 为后续增强。

### 6.1 项目和任务

#### P0

- 创建、查看、更新和归档任务
- 设置任务标题、目标、背景、验收标准和所属项目
- 将任务拆分为多个阶段
- 显示当前阶段、下一步和整体完成度
- 支持任务状态：`planned`、`in_progress`、`blocked`、`needs_review`、`handoff_ready`、`completed`

#### P1

- 优先级、标签和截止日期
- 任务之间的依赖关系
- 关联 Git 分支、commit、Issue 和 PR
- 任务模板

### 6.2 Agent、设备和会话

#### P0

- 自动记录 `agent_id`、`device_id` 和 `session_id`
- 显示最后更新者、最后更新设备和最后更新时间
- 支持 Agent 认领任务或阶段
- 支持释放认领和转交
- 同一阶段被多个 Agent 同时认领时给出警告

#### P1

- 按 Agent、设备和会话筛选任务
- 显示活跃、空闲和失联会话
- 支持只向绑定会话注入任务状态

### 6.3 Checkpoint 和事件记录

#### P0

- Agent 或 CLI 可以记录 checkpoint
- 事件必须包含任务、阶段、Agent、设备、会话、类型、摘要和时间
- 支持记录修改文件、commit 和测试结果
- 事件采用追加方式保存，不允许原地修改历史
- 事件字段必须通过 schema 校验

### 6.3.1 任务接续信息包

轻量版本不依赖大量表和页面，但每个跨会话任务必须维护一份结构完整的恢复入口。该入口可以由 CLI、Agent Skill 或 Web UI 生成，内容至少回答：

- 任务目标、背景和验收标准
- 当前状态、当前关注点和最近完成的工作
- 下一步唯一建议动作（没有明确下一步时允许为空）
- 当前阶段或里程碑（用户未定义时不强行生成）
- 已确认的关键决策及其原因
- 待用户确认的问题、已知阻塞和失败尝试
- 相关文件、分支、commit、Issue/PR 和可复现命令
- 最近一次测试/验证结果及其时间
- 最后更新的 Agent、设备、会话和同步状态

示例：

```markdown
# 任务：实现 GitHub 同步

## 目标
让 Mac 上记录的任务状态可以在 Windows 上被 Claude Code 恢复，并且不丢失并发更新。

## 验收标准
- `task-sync sync` 能完成 pull、合并、重建和 push
- 重复同步不会重复应用事件
- Git 冲突会保留双方内容并给出原因

## 当前状态
进行中。核心事件 schema 已确定，正在实现同步命令。

## 最近完成
- 定义 event_id、父事件和设备标识
- 为重复事件增加幂等校验

## 下一步
实现 `sync` 的 pull -> validate -> rebuild 流程，并补一条跨设备测试。

## 关键决策
- GitHub 是事实来源；Markdown 是投影
- 不保存完整聊天记录

## 问题与失败尝试
- Windows 的换行符导致 JSONL 校验失败，需统一 LF

## 相关上下文
- 文件：`src/sync.ts`、`tests/sync.test.ts`
- 命令：`pnpm test -- sync`
- 最近验证：2026-09-02，已有 12/12 测试通过

## 更新者
Codex / MacBook Pro / 当前会话，未同步事件：2
```

该文档是面向人和 Agent 的主入口，不能只显示一个百分比或一句 `progress` 摘要。

#### P1

- 支持事件修正和撤销事件
- 支持按时间、Agent、设备和事件类型筛选
- 自动从 Git diff 和测试命令生成候选 checkpoint

### 6.4 Handoff 交接

#### P0

- Agent 可以创建 handoff
- Handoff 必须包含：已完成工作、当前阶段、关键决策、错误、阻塞、下一步、相关文件和测试结果
- 创建 handoff 后任务进入 `handoff_ready`
- 下一位 Agent 接受后生成认领事件
- 新会话读取一次 handoff 后可以开始工作

#### P1

- 指定目标 Agent 或角色
- 人工审批后才能接受 handoff
- 对 handoff 完整性进行检查
- 保留多次 handoff 历史

### 6.5 GitHub 同步

#### P0

- 支持将任务事件保存到 Git 仓库
- 支持 `pull`、`push` 和 `sync`
- 支持离线记录，恢复联网后重试同步
- 显示本地未同步事件数
- Git 冲突不可静默丢弃，必须明确提示
- 从事件日志重新生成 `task.yaml`、`task_plan.md` 和项目级 `progress.md`

#### P1

- 每台设备使用独立事件文件或分支
- pull 后自动重建任务接续文档和项目概览
- GitHub webhook 触发本地提醒
- GitHub PR 关联任务和 handoff

### 6.6 Agent 集成

Agent 接入分为三种职责：

| 接入机制 | 职责 | 说明 |
|---|---|---|
| Skill | 规定 Agent 如何参与任务协议 | 通用规范，必须提供 |
| Hook/Extension | 在生命周期中自动读取和记录 | 按 Agent 独立适配 |
| MCP | 提供结构化主动调用接口 | 首个版本可选 |

所有适配器通过核心 CLI 或共享 `core` 包工作，不得各自实现任务状态和 Git 合并逻辑。

#### P0

- 提供通用 `SKILL.md`
- 提供 Codex 基础 Hook
- 提供 Claude Code 基础 Hook
- Agent 启动或用户发言时注入当前任务状态
- 工具调用后提醒或自动记录 checkpoint
- 上下文压缩前写入恢复信息

#### P1

- 提供 Pi extension
- 提供 MCP Server
- 提供 `/status`、`/checkpoint`、`/handoff` 等命令
- 支持按项目配置启用或禁用自动注入

#### 接入策略

- 优先使用 Agent Skills 标准目录和统一 Skill 内容
- Codex、Claude Code、Pi、Cursor 等平台分别维护薄适配器
- 适配器只负责生命周期事件转换、环境变量和输出格式
- 所有适配器调用 `task-sync ... --json` 或共享核心库
- 支持 MCP 的 Agent 使用同一个 MCP Server，不重复实现业务工具
- 只支持 Skill 的 Agent 仍可通过 CLI 手动记录和同步

#### planning-with-files 的复用边界

可在 MIT 许可范围内参考或复用其 Agent Skills 布局、Codex/Claude/Pi Hook 结构、会话恢复、计划隔离、JSONL ledger、attestation 和并发写入检测等实现。

不直接把其三文件计划作为本产品的同步事实来源。本产品以结构化事件日志为事实来源，Markdown 只是事件聚合后的快照。复用代码时必须保留许可证和版权信息，并进行安全审查。

### 6.7 人类看板

#### P0

- 提供 CLI 看板
- 提供 Markdown 任务快照
- 支持按状态查看任务
- 任务详情显示阶段、负责人、设备、最近事件、阻塞和同步状态

#### P1

- Web 看板
- 任务活动时间线
- 冲突中心
- Handoff 接受和审批
- Agent/设备过滤

### 6.8 冲突和安全

#### P0

- 检测同一任务的并发认领
- 检测阶段状态倒退
- 检测事件格式错误和非法任务 ID
- 远程内容进入 Agent 上下文时标记为不可信数据
- 默认不上传完整对话历史
- 计划快照支持 hash 校验
- 不执行事件或 Markdown 中的命令

#### P1

- 用户级访问 token
- 最小权限角色
- 事件签名
- Secret 和敏感路径脱敏
- 可配置的事件保留策略

## 7. 关键用户流程

### 7.1 创建并开始任务

```text
用户创建任务
  -> 设置目标、验收标准和阶段
  -> Codex 认领任务
  -> 写入 task_claimed 事件
  -> 任务进入 in_progress
```

### 7.2 跨设备继续任务

```text
Mac/Codex 写入 checkpoint
  -> git commit + push
  -> Windows/Claude 执行 sync
  -> 重建 task_plan.md
  -> Claude 读取当前阶段和下一步
  -> 继续工作
```

### 7.3 Agent 交接

```text
Agent A 完成阶段
  -> 创建 handoff
  -> 任务进入 handoff_ready
  -> Agent B 接受 handoff
  -> Agent B 认领下一阶段
  -> 从 handoff 和 task_plan.md 恢复
```

### 7.4 并行工作

```text
任务拆分为后端阶段和前端阶段
  -> Codex 认领后端
  -> Claude 认领前端
  -> 两者写独立事件
  -> 系统聚合状态
  -> 阶段冲突时进入 needs_review
```

## 8. 数据与同步要求

### 8.1 推荐仓库结构

```text
.task-sync/
├── config.yaml
├── tasks/<task-id>/
│   ├── task.yaml
│   ├── task_plan.md
│   ├── progress.md
│   ├── handoff.md
│   └── events/<device>-<agent>.jsonl
└── devices/<device-id>.yaml
```

### 8.2 状态来源

- 事件日志是可审计事实来源
- `task.yaml` 保存稳定元数据和当前聚合状态
- `task_plan.md` 是面向人和 Agent 的完整投影视图
- MVP 不引入 SQLite；未来若增加本地索引，也只能作为可删除、可重建的缓存

### 8.2.1 最小状态文件

MVP 不引入数据库依赖，推荐每个项目使用以下文件：

```text
.task-sync/
├── project.yaml       # 项目和 GitHub 仓库映射
├── progress.md        # 项目级概览和最近活动
└── tasks/
    └── <task-id>/
        ├── task.yaml   # 当前任务状态，字段尽量少
        ├── task_plan.md # 任务恢复主文档，内容完整但保持可读
        ├── progress.md  # 追加式工作日志和测试记录
        ├── handoff.md  # 需要明确交接时才生成
        └── events.jsonl # 重要变化，追加写入
```

`phase`、`next_action`、`handoff.md` 都是可选的；但只要任务跨会话继续，`task_plan.md` 必须存在。没有阶段时，文档使用“当前状态/下一步/问题”结构，不强行添加阶段编号。

### 8.2.2 文件职责边界

| 文件 | 负责什么 | 不负责什么 |
|---|---|---|
| `task.yaml` | 稳定元数据、状态、关联项目和当前聚合字段 | 长篇上下文、完整日志 |
| `task_plan.md` | 新 Agent 恢复任务所需的目标、决策、问题、下一步和验证结果 | 逐条记录所有工具调用 |
| `progress.md` | 按时间追加最近工作、文件变更、测试和错误 | 作为唯一恢复入口 |
| `handoff.md` | 一次具体交接的摘要、接收条件和未完成事项 | 长期替代任务计划 |
| `events.jsonl` | 可合并、可审计的关键状态事件 | 给用户直接阅读的界面 |

### 8.3 一致性要求

- 事件 ID 全局唯一
- 重复同步不会重复应用事件
- 旧设备不能静默覆盖新状态
- 无法自动合并时保留双方内容和冲突原因
- 同步失败时本地事件不得丢失

## 9. MVP 交付范围

### MVP 必须交付

- 一个轻量 CLI（优先 TypeScript/Node.js，避免引入服务端运行时）
- 本地 `.task-sync/` 初始化
- 任务、阶段和事件 schema
- checkpoint 和 handoff
- Git 同步
- Markdown 任务接续文档
- `status`、`claim`、`checkpoint`、`handoff`、`sync` 命令
- Codex 和 Claude Code 基础适配
- 统一 Skill、核心 CLI 和平台适配器分层
- Mac、Windows 基础兼容
- 单元测试、跨平台同步测试和最小冲突测试

### MVP 暂不交付

- Web UI
- 实时同步服务
- SQLite 或其他必须运行的数据库
- 常驻后台 daemon
- 多用户、多租户和组织权限
- Kaneo 深度集成
- 多租户账号体系
- Slack/Discord 通知
- 完整 MCP 工具集
- 自动语义冲突解决

### 9.1 轻量验收

- 新用户只需安装 CLI、配置一个 GitHub 仓库即可开始
- 单个项目的任务状态文件不超过必要的几份 Markdown/YAML/JSONL
- 没有后台服务时，Mac 和 Windows 仍可通过 GitHub 完成恢复
- 任何自动化功能都可以退回为手动 CLI 操作
- 删除本地缓存后，重新 clone 状态仓库可以恢复任务

## 10. 非功能需求

### 10.1 可用性

- 无网络时可以创建任务和记录事件
- 同步失败有明确错误和可重试入口
- Agent 在 1 次状态读取后能够恢复任务

### 10.2 性能

- `task-sync status` 在常规任务仓库中 1 秒内返回
- 单次 checkpoint 不应阻塞 Agent 主流程
- 快照生成应支持增量处理

### 10.3 可移植性

- Mac、Linux、Windows PowerShell、Windows Git Bash 可用
- 路径、换行和 UTF-8 行为一致
- 不依赖特定编辑器或单一 Agent

### 10.4 安全性

- 不上传完整 transcript 作为默认行为
- 不执行远程任务文本中的命令
- Token 使用最小权限并存储在系统凭据位置
- 远程事件在注入上下文前进行长度限制和内容标记

## 11. 成功指标

### MVP 验收指标

- Mac 上 Codex 创建的任务可在 Windows 上由 Claude Code 恢复
- 新 Agent 在一次 `status` 或 Hook 注入后，能获得目标、当前阶段、下一步和阻塞项
- 两台设备并发操作时，无静默丢失事件
- 同步失败后重试不丢数据
- 100% 的状态变化可追溯到 Agent、设备、会话和时间
- 至少覆盖任务创建、认领、checkpoint、handoff、冲突和恢复六类测试

### 后续产品指标

- 用户从创建任务到首次有效 checkpoint 的时间
- Handoff 后下一 Agent 开始有效工作的时间
- 因上下文丢失而重复工作的次数
- 未同步事件平均滞留时间
- 自动冲突被人工介入的比例

## 12. 竞争与差异化

### 与 Kaneo 的差异

- Kaneo 是完整的通用项目管理和看板系统
- Agent Task Sync 是 Agent 执行状态、上下文恢复和交接系统
- Kaneo 的 MCP 让 Agent 操作任务
- Agent Task Sync 的 Skill/Hook 让 Agent 持续遵守任务协议
- Kaneo 以服务端数据库为中心
- Agent Task Sync 以 GitHub 事件历史和本地离线能力为中心

### 可借鉴方向

- Kaneo 的 MCP 工具设计
- 工作区、项目、任务、标签和权限模型
- 活动时间线和实时通知
- Docker、自托管和安装体验
- OpenAPI/schema 驱动的接口设计

## 13. 主要风险

| 风险 | 影响 | 初步应对 |
|---|---|---|
| Git 冲突复杂 | 用户不敢使用同步 | 事件文件隔离，冲突显式化 |
| Agent 不主动记录状态 | 看板失真 | Hook 自动 checkpoint，Stop 前提示 |
| Skill 兼容性不一致 | 不同 Agent 行为不同 | 核心 CLI 统一，适配器薄化 |
| 事件过多导致上下文膨胀 | Agent 读取成本高 | 快照、摘要和固定字段 |
| 远程文本 Prompt Injection | 安全事故 | 数据标记、hash、长度限制、不执行命令 |
| 范围膨胀成通用 PM 软件 | MVP 失焦 | 明确 Agent 执行和 handoff 为核心 |

## 14. 待决策问题

1. GitHub 仓库是否必须是唯一事实来源，还是允许后续接入 Kaneo 作为主库？
2. MVP 是否只支持单用户，还是一开始就需要团队权限？
3. 事件采用每设备文件、每 Agent 文件，还是每任务分支？
4. 是否允许两个 Agent 同时修改同一阶段？
5. 首个 Web UI 是否放在 MVP 之后？
6. MCP Server 是否与 CLI 同一版本发布？
7. 是否需要对 checkpoint 绑定工作区 Git diff？
8. MVP 是否先用 CLI + Skill 验证工作流，再加入 MCP？
9. Agent 识别出新项目后，是否必须先向用户确认再创建和同步？

### 14.1 自动识别与用户确认

系统可以根据对话和文件变化提出“建议创建任务”或“建议生成 checkpoint”，但默认不得静默创建或同步正式任务。

推荐流程：

```text
Agent 判断用户开始了新项目
  -> 展示任务名称、目标和拟定阶段
  -> 用户确认
  -> 核心 CLI 创建任务并写入事件
  -> 执行 GitHub 同步
```

这样可以避免把普通聊天、临时问题或敏感内容误判成项目并上传。

## 15. 建议的第一迭代顺序

1. 固定任务、阶段和事件 schema
2. 实现本地 CLI 和 Markdown 任务接续文档
3. 实现 Git 同步和幂等事件合并
4. 实现 checkpoint、handoff 和冲突检测
5. 接入 Codex Hook
6. 接入 Claude Code Hook
7. 完成 Mac/Windows 端到端测试
8. 再决定是否需要 Web UI、MCP 和 Kaneo 适配器
