# Agent Task Sync 协议兼容、升级回滚与人工验收

版本：v0.1
日期：2026-09-03
状态：协议 v1 已实现；真实设备、真实 Agent 生命周期和真实用户试用待填写

## 1. 目的与范围

这份文档固定当前轻量版本的兼容边界，并提供一份可复制的人工验收记录。它不引入协议 v2、迁移工具、远程服务或新的状态模型，也不把双 clone 等价测试写成真实 Windows 验收。

当前产品的状态事实仍是 Git 状态分支中的 JSONL 事件；YAML/Markdown 是由事件重建的投影。升级或失败时优先保护事件事实，不删除事件、不 force push、不静默改写投影。

## 2. 当前协议与组件版本

### 2.1 协议清单

| 对象 | 当前协议 | 版本字段 | 事实/投影 | 当前行为 |
|---|---|---|---|---|
| 任务事件 `events/**/*.jsonl` | Event Protocol v1 | `schemaVersion: 1` | 事实来源 | 追加写入；事件结构和事件类型严格校验 |
| 任务状态 `tasks/*/task.yaml` | Task State Projection v1 | 文件结构对应 `task-state.v1.json` | 可重建投影 | 不作为事实来源；`rebuild` 可重新生成 |
| 项目清单 `.task-sync/project.yaml` | Project Protocol v1 | `protocolVersion: 1` | 项目注册元数据 | 未知版本拒绝读取，并映射为 CLI 退出码 `7` |
| 项目/任务 Markdown | Renderer output v1 | 无独立版本字段 | 可读投影 | 从事件和聚合状态生成，手工修改会被下一次重建覆盖 |
| Hook stdin/stdout | Adapter Hook Contract v1 | 由当前 workspace 合约定义 | 生命周期桥接 | 输出必须是可解析 JSON，始终 `continue: true` |

事件 v1 当前支持：`task_created`、`task_updated`、`task_claimed`、`checkpoint_recorded`、`decision_recorded`、`question_recorded`、`error_recorded`、`verification_recorded`、`handoff_created`、`handoff_accepted`、`task_blocked`、`task_completed` 和 `conflict_resolved`。

### 2.2 组件兼容矩阵

当前 workspace 中 CLI、Skill 和三个适配器均为 `0.1.0` 发布线。Skill 没有单独的 npm 版本字段，使用仓库提交和发布说明与 CLI/适配器一起配套升级。

| 组合 | 是否支持 | 说明 |
|---|---|---|
| CLI `0.1.0` + Event/State/Project v1 | 支持 | 当前唯一完整支持组合 |
| Codex、Claude Code、Pi 适配器混用同一 v1 状态 | 支持 | 适配器只转换生命周期，状态读写仍由同一个 CLI 完成 |
| 当前 CLI + canonical Skill `skills/agent-task-sync/SKILL.md` | 支持 | Skill 只规定读取、确认、交接和安全边界，不保存状态 |
| 旧/新适配器混用，但都调用同一 v1 CLI | 有条件支持 | 只要 stdin/stdout 合约未变；升级后必须运行 Hook 冒烟测试 |
| v1 CLI 读取未知 Event/State/Project 协议 | 不支持 | 严格拒绝；不会自动迁移、删除或覆盖原始状态 |
| v1 CLI 与 v2 写入器同时写同一状态分支 | 不支持 | 必须先完成所有写入端升级，避免旧读者遇到未知数据 |
| 仅更新 Skill，不更新 CLI/适配器 | 不建议 | 可读取文档，但命令/Hook 约定可能不一致；应按升级顺序成套更新 |

“有条件支持”不是自动协商：当前没有远程能力发现或版本握手。发布新版本前必须用兼容状态副本跑完构建、契约和人工验收。

## 3. 兼容策略与失败行为

### 3.1 v1 约束

- Event JSONL、Task State YAML 和 Project YAML 均按 v1 严格校验；未知字段或未知版本不能被当作已知事实继续写入。
- JSONL 是唯一事实来源。投影损坏时先保留事件，使用 `task-sync rebuild` 重建；不要手工把投影改成“看起来正确”。
- 同一 v1 状态可以被不同设备、不同 Agent 追加事件；语义冲突进入审阅，不以最后写入覆盖另一方。
- 绝对路径、token、`.env`、SSH key、完整 Prompt/回复和终端历史不属于协议数据。

### 3.2 退出码与 Hook 行为

| 场景 | CLI/Hook 行为 | 数据处理 |
|---|---|---|
| 项目未初始化 | CLI 退出 `3` | 不创建任务事件；按提示执行 `init` |
| Project Protocol 不支持 | CLI 退出 `7` | 停止读取/写入，保留状态目录原样 |
| 需要先同步远程 | CLI 退出 `4` | 先 `sync`，不基于旧事件头写入 |
| Git/远程失败 | CLI 退出 `6` | 本地事件保留，可恢复后重试 |
| Git 文本冲突或语义冲突 | CLI 退出 `5` | 保留双方内容，人工审阅/解析；不 force push |
| 非法 Hook JSON、缺少 `cwd`、未知 Hook | Hook 进程退出 `0`，输出 `continue: true` 和 warning | 不调用 CLI 写入 |
| CLI 不可用或 Hook 内部失败 | Hook 进程退出 `0`，输出 `continue: true` 和 warning | 不阻断 Agent 会话；按 warning 排查 |
| stop/handoff 未确认 | 输出候选，写入调用不带 `--yes` | 等待用户明确确认 |

事件或投影内容校验失败属于 fail-closed 路径：命令不会用不完整状态继续写入。当前实现对这类非 Project Protocol 错误可能返回通用非零退出码；验收时应记录完整 stderr 和原始文件路径，不要把它当作可自动迁移信号。

## 4. 升级顺序

一次升级以一个兼容版本为单位，先在状态副本验证，再逐设备切换。建议顺序如下：

1. 在所有设备停止写入，执行 `task-sync status --json`，确认没有远程领先、Git 冲突或未同步事件；必要时备份状态 worktree 或复制 Git remote。
2. 更新 Agent Task Sync 仓库/CLI workspace，运行 `npm install`、`npm run build`、`npm test` 和 `npm run typecheck`。
3. 安装同一提交的 canonical Skill：复制 `skills/agent-task-sync` 目录，保留目录名 `agent-task-sync`。
4. 更新 Codex、Claude Code、Pi 薄适配器和对应 Hook 配置；不要在适配器中复制事件存储或 reducer。
5. 在一台设备执行 `task-sync doctor`、`task-sync status --json`、`task-sync context <task-id> --format markdown` 和一次只读 `handoff check`。
6. 先让一台设备完成小范围读写和 `task-sync sync`，确认 GitHub 的 `task-sync/state` 状态分支可正常 pull/push 后，再切换其他设备。
7. 每个真实 Agent 至少触发一次 SessionStart/PreCompact；Stop 和 handoff 先检查候选，再由用户确认后写入。

升级期间不要让旧 CLI 和新 CLI 并行写同一状态分支。不同设备必须在同一兼容矩阵内完成升级后再恢复并行工作。

## 5. 失败与回滚

### 5.1 尚未写入不兼容数据

这是最简单的回滚场景：停止 Agent，恢复上一版 CLI、Skill 和适配器，保留状态分支不动，重新运行 `doctor`/`status`。只要状态仍是 v1，不需要迁移或改写事件。

### 5.2 已发现未知协议或损坏投影

1. 立即停止所有状态写入，保留当前状态 worktree 和 Git 提交哈希。
2. 复制或打包 `.task-sync` 作为只读证据，记录命令、stderr、设备和 Agent。
3. 不使用 force push、`reset --hard`、删除事件文件或手工拼接 JSONL 来“修复”。
4. 如果只是派生投影损坏，在兼容 CLI 上执行 `task-sync rebuild`；如果是未知协议，回到能读取该协议的 CLI，或先完成明确的迁移设计。
5. 迁移/修复完成后先在隔离 clone 验证事件数、任务状态、handoff、冲突和 Markdown 投影，再恢复真实设备写入。

回滚的目标是恢复可解释、可重试的状态，不是让旧 CLI 强行吞掉未知数据。没有经过验证的状态分支不能直接作为新的事实基线。

## 6. 人工验收记录模板

以下表格是待填写模板。`通过` 只能在有命令输出、日志、截图或 PR/Issue 链接等证据时填写；等价双 clone 测试不能替代“实体 Windows”“真实 Agent 生命周期”和“真实用户试用”。

### 6.1 验收元数据

| 字段 | 记录 |
|---|---|
| 验收日期/时区 | |
| 验收人 | |
| 仓库/状态分支 | |
| CLI 提交或版本 | |
| Skill 提交或版本 | |
| Codex 适配器版本 | |
| Claude Code 适配器版本 | |
| Pi 适配器版本 | |
| 证据位置（链接/文件） | |

### 6.2 设备与安装

| 编号 | 场景 | 环境与步骤 | 结果（待验收/通过/失败/不适用） | 证据/问题 |
|---|---|---|---|---|
| I-1 | Mac 安装 | Node 20+、Git 2.30+；构建、链接 CLI 和需要的适配器 | | |
| I-2 | Windows 安装 | Windows 10/11、PowerShell；构建或安装同一版本 CLI/适配器 | | |
| I-3 | Skill 安装 | Codex、Claude Code、Pi 均加载同一 canonical Skill 目录 | | |
| I-4 | 首次诊断 | 两台设备在目标代码仓库运行 `task-sync doctor --json` | | |
| I-5 | 路径检查 | Windows `%LOCALAPPDATA%`、macOS Application Support、带空格的仓库路径 | | |

### 6.3 Mac -> GitHub -> Windows 接续

| 编号 | 场景 | 验收步骤 | 结果（待验收/通过/失败/不适用） | 证据/问题 |
|---|---|---|---|---|
| F-1 | 项目初始化 | Mac 执行 `init`，确认代码 checkout 分支不变、状态 worktree 独立 | | |
| F-2 | 创建与认领 | Mac + Codex 创建任务并 `task use`，记录任务 ID | | |
| F-3 | checkpoint | Mac 记录当前关注点、已完成、下一步、文件和验证；确认后写入 | | |
| F-4 | handoff | Mac 创建 handoff 并执行 `sync`；确认没有完整聊天或敏感信息进入状态 | | |
| F-5 | 恢复 | Windows + Claude Code 或 Pi 执行 `sync`、`status`、`context`，看到同一任务和 handoff | | |
| F-6 | 接受并继续 | Windows 明确接受 handoff，追加 checkpoint，再 `sync` 回 GitHub | | |
| F-7 | 回读 | Mac 再次 `sync`，能看到 Windows 的验证、下一步和活动记录 | | |
| F-8 | 代码隔离 | 两台设备的代码分支和未提交代码不被状态操作改动 | | |

### 6.4 真实 Agent 生命周期

| 编号 | 平台/Hook | 验收步骤 | 结果（待验收/通过/失败/不适用） | 证据/问题 |
|---|---|---|---|---|
| H-1 | Codex SessionStart | 有/无当前任务时都能读取 status；有任务时读取 context | | |
| H-2 | Codex PreCompact | 返回精简上下文；CLI 失败不阻断会话 | | |
| H-3 | Codex Stop | 未确认只给 checkpoint 候选；确认后才写入 | | |
| H-4 | Claude Code SessionStart/PreCompact/Stop | 验证 settings 配置、stdin/stdout JSON 和确认边界 | | |
| H-5 | Pi SessionStart/PreCompact/Stop/Handoff | 验证四个入口、确认边界和 warning 行为 | | |
| H-6 | 异常输入 | 非法 JSON、缺少 `cwd`、未知 Hook 均返回 `continue: true` | | |
| H-7 | 隐私检查 | 检查事件、Markdown 和日志没有完整 Prompt、token、`.env`、SSH key 或绝对用户路径 | | |

### 6.5 异常与回滚

| 编号 | 场景 | 验收步骤 | 结果（待验收/通过/失败/不适用） | 证据/问题 |
|---|---|---|---|---|
| R-1 | 无 remote | 断开/移除 remote，确认本地事件保留且错误可解释 | | |
| R-2 | 远程领先 | 设备 B 先写入，设备 A 在未 sync 时尝试写入，确认收到同步提示 | | |
| R-3 | 非快进 push | 两台设备并发追加，确认先 pull/retry，不使用 force push | | |
| R-4 | 文本冲突 | 人为造成投影冲突，确认 Git 冲突被报告且事件未删除 | | |
| R-5 | 语义冲突 | 同一父事件写入不同状态，确认双方事件保留并进入 `needs_review` | | |
| R-6 | 协议失败 | 使用隔离副本放入未知 `protocolVersion`，确认退出 `7`、原始状态保留、没有自动迁移 | | |
| R-7 | 回滚 | 恢复上一版 CLI/Skill/适配器，在 v1 状态副本中重新读取并同步 | | |

### 6.6 真实用户试用

| 字段 | 记录 |
|---|---|
| 用户画像/使用场景 | |
| 用户是否独立完成安装和初始化 | |
| 用户是否理解“项目、任务、checkpoint、handoff、sync” | |
| 用户是否误以为系统保存完整聊天 | |
| 用户遇到的阻塞 | |
| 用户反馈原话或脱敏摘要 | |
| 反馈对应的 Issue/变更记录 | |
| 结论（继续、修复后再试、调整范围） | |

## 7. 当前未覆盖项

- 本仓库已完成等价双 clone、契约测试和编译 Hook 进程级冒烟测试，但这些结果不代表实体 Windows 的 PowerShell、凭据、路径或文件权限已经验收。
- 当前没有真实 Codex、Claude Code、Pi 生命周期运行记录；上面的 H-1 至 H-7 需要在对应 Agent 的真实配置中填写。
- 当前没有真实外部用户试用记录；在获得反馈前，不把“安装顺畅”“自动识别当前任务”或“无需确认即可写入”写成已满足能力。

## 8. 结论规则

当 I、F、H 和 R 中的关键项都有可追溯证据，且真实用户试用没有阻断性问题时，才可把轻量版本标记为“可交付”。在此之前，项目保持“代码闭环已通过、人工边界待验收”的状态，不通过新增 Web UI、MCP、通知或数据库来掩盖验收缺口。
