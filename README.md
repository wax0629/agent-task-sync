# Agent Task Sync

轻量的多 Agent、多设备任务接续工具。它以 JSONL 事件作为事实来源，用 `task.yaml`、`task_plan.md`、`progress.md` 和 `handoff.md` 生成可读、可重建的任务上下文，并通过 Git 状态分支在设备之间同步。

当前版本是 CLI + 文件协议 + 薄适配器。它不会读取或保存完整聊天记录，也不会修改用户正在开发的代码分支。

## 前置条件

- Node.js 20 或更高版本
- Git 2.30 或更高版本
- 一个已有 `main`（或指定默认分支）的代码仓库

## 安装与构建

在本仓库根目录执行：

```bash
npm install
npm run build
npm test
```

本地未将 CLI 加入 `PATH` 时，可以直接运行：

```bash
node apps/cli/dist/main.js status --json
```

要让 Agent 适配器直接找到 `task-sync`，可以在构建后链接 CLI 和适配器：

```bash
npm link --workspace=@agent-task-sync/cli
npm link --workspace=@agent-task-sync/adapter-codex
npm link --workspace=@agent-task-sync/adapter-claude-code
```

## 一次完整接续

下面的例子假设代码仓库已经配置 `origin`，且两台设备都能访问同一个 Git remote。

### 设备 A：创建并交接

```bash
cd /path/to/repository
task-sync init my-project "Agent Task Sync"
task-sync task create task-1 "实现跨设备接续" \
  --goal "让下一台设备可以从事件和文档继续工作" \
  --acceptance "可以恢复任务上下文" \
  --acceptance "不会丢失并发事件" \
  --yes
task-sync task use task-1 --yes
task-sync checkpoint --task task-1 \
  --summary "完成事件模型和 CLI 主链路" \
  --current-focus "验证 Git 状态分支" \
  --recent-completed "完成 reducer" \
  --next-action "在 Windows 接受 handoff" \
  --file packages/domain/src/reducer.ts \
  --uncommitted-change packages/sync-git/tests/dual-device.e2e.test.ts \
  --verification '[{"command":"npm test","result":"passed","status":"passed"}]' \
  --yes
task-sync handoff create --task task-1 \
  --completed "完成事件模型和 CLI 主链路" \
  --incomplete "在 Windows 接受 handoff" \
  --next-step "运行 task-sync sync 后接受交接" \
  --file packages/domain/src/reducer.ts \
  --test-summary "npm test passed" \
  --target-agent claude-code \
  --yes
task-sync sync
```

`handoff create` 的输出会包含 handoff ID。也可以用 `task-sync status --json` 查看当前任务和 ID。

### 设备 B：同步并继续

```bash
git clone <repository-url> /path/to/repository
cd /path/to/repository
task-sync init my-project "Agent Task Sync"
task-sync sync
task-sync status
task-sync context task-1 --format markdown
task-sync handoff accept task-1 <handoff-id> --yes
task-sync checkpoint --task task-1 \
  --summary "已从 Mac 恢复并开始实现" \
  --current-focus "补齐 Windows 测试" \
  --next-action "提交双设备测试结果" \
  --yes
task-sync sync
```

`init` 会创建或获取独立的 `task-sync/state` 状态分支和本机状态 worktree；它不会切换或修改当前代码分支。切换设备前先执行 `sync`。如果 `status` 或 `context` 报告远程领先，应先同步再写入，避免基于旧事件头产生冲突。

## 文件与职责

状态 worktree 中的目录大致如下：

```text
.task-sync/
├── project.yaml
├── current-task
└── tasks/<task-id>/
    ├── events/<device>/<agent>/<session>.jsonl
    ├── task.yaml
    ├── task_plan.md
    ├── progress.md
    └── handoff.md
```

- `events/**/*.jsonl`：追加式事件，是唯一事实来源；每个事件包含 ID、父事件、写入者和时间。
- `task.yaml`：机器读取的当前聚合状态，可由事件重建。
- `task_plan.md`：新 Agent 恢复任务所需的目标、当前工作、决策、问题、文件和验证。
- `progress.md`：按时间生成的工作日志，保留 checkpoint、handoff 创建和接受的历史摘要。
- `handoff.md`：当前有效交接包；历史仍在事件和 `progress.md` 中。

Git 仓库默认使用独立状态 worktree：

- macOS：`~/Library/Application Support/agent-task-sync/projects/<repo-id>/state-worktree`
- Windows：`%LOCALAPPDATA%/agent-task-sync/projects/<repo-id>/state-worktree`
- Linux：`$XDG_DATA_HOME/agent-task-sync/projects/<repo-id>/state-worktree`

如果当前目录不是 Git 仓库，或设置了 `TASK_SYNC_STATE_DIR`，CLI 会使用本地目录和 mock sync；这种模式可以离线读写，但不会把状态推送到远端。

## CLI 命令

| 命令 | 作用 |
| --- | --- |
| `task-sync init [project-id] [project-name]` | 注册项目并初始化状态 worktree |
| `task-sync status [--json]` | 查看项目、任务和 Git 同步状态 |
| `task-sync doctor` | 检查状态目录是否已初始化 |
| `task-sync task create ... --yes` | 创建任务事件 |
| `task-sync task list [--json]` | 列出当前项目任务 |
| `task-sync task use <task-id> --yes` | 记录当前任务认领和本地指针 |
| `task-sync task update <task-id> ... --yes` | 更新任务元数据、状态、当前工作或下一步 |
| `task-sync task block <task-id> [--reason ...] --yes` | 记录阻塞原因并将任务置为阻塞 |
| `task-sync task complete <task-id> [--summary ...] --yes` | 记录完成摘要并将任务置为已完成 |
| `task-sync context <task-id> --format markdown` | 输出恢复主文档；`--format json` 输出结构化上下文 |
| `task-sync checkpoint ... --yes` | 记录可恢复进展、文件、验证和未提交变更 |
| `task-sync handoff create ... --yes` | 创建交接包 |
| `task-sync handoff accept <task-id> <handoff-id> --yes` | 接受当前交接；重复接受是幂等的 |
| `task-sync rebuild [<task-id>]` | 只从事件重建投影 |
| `task-sync sync` | pull、重建投影并 push 状态分支 |

任务创建、认领、更新、阻塞、完成、checkpoint 和 handoff 的写入命令都要求显式 `--yes`；`init`、`rebuild` 和 `sync` 是项目生命周期操作，不使用该确认参数。`--input <file>` 可以传 JSON 对象，`--input -` 从 stdin 读取；CLI 不会执行输入文件或同步文档里的命令。

### JSON 输入示例

`checkpoint.json`：

```json
{
  "taskId": "task-1",
  "summary": "完成 API 适配",
  "currentFocus": "验证跨设备恢复",
  "recentCompleted": ["定义 CLI 合约"],
  "nextAction": "运行 npm test",
  "filesChanged": ["apps/cli/src/main.ts"],
  "commit": "abc1234",
  "uncommittedChanges": ["tests/contract.test.ts"],
  "verification": [
    {
      "id": "verification-1",
      "command": "npm test",
      "result": "passed",
      "status": "passed",
      "checkedAt": "2026-09-03T10:00:00.000Z"
    }
  ]
}
```

```bash
task-sync checkpoint --input checkpoint.json --yes --json
```

`handoff.json` 使用 `completedWork`、`incompleteWork`、`keyDecisions`、`knownErrors`、`nextStep`、`relevantFiles`、`testSummary` 和 `targetAgent` 字段：

```bash
task-sync handoff create --task task-1 --input handoff.json --yes --json
```

## 同步状态和冲突

`status` 会报告 `已同步`、`本地领先`、`远程领先` 或 `存在冲突`。远程领先时，`context` 会给出同步提示；本地领先时会显示未同步事件数。

- Git 仓库没有 remote：本地事件仍会保存，`sync` 的 push 返回退出码 `6`。
- 两台设备同时追加不同事件：Git 会合并事件文件，随后 reducer 重建投影。
- 派生的 `task.yaml`/Markdown 发生文本冲突：Git 层可以丢弃旧投影并从合并后的事件重建。
- 同一父事件上的状态字段出现不同值：双方事件保留，任务进入 `needs_review`，`status` 和 `context` 会告警；不要 force push 或删除事件。
- 同一个 handoff ID 不存在时，接受操作失败；同一个已接受 ID 重试不会新增事件。

## Agent 适配

适配器是薄层，不复制 Domain Reducer。它们只把平台生命周期转换为稳定的 CLI 调用：

| 平台 | 配置骨架 | 会调用 |
| --- | --- | --- |
| Codex | `adapters/codex/codex-hooks.json` | `task-sync-adapter-codex session_start/pre_compact/stop` |
| Claude Code | `adapters/claude-code/claude-hooks.json` | `task-sync-adapter-claude session_start/pre_compact/stop` |

会话开始读取 `status --json`，有明确任务时再读取 `context --format json`。停止或压缩前只能生成 checkpoint/handoff 候选；只有输入包含 `confirmed=true`（最终转成 CLI 的 `--yes`）时才写事件。Hook 失败会返回 warning，不应阻断 Agent 会话。

Claude Code 的只读命令模板位于 `adapters/claude-code/commands/`，可以按平台规则复制到命令目录。Pi 等其他 Agent 可以复用同一 CLI/JSON 合约，实现自己的薄适配器，不需要重新实现状态逻辑。

## 环境变量

常用覆盖项：

| 变量 | 作用 |
| --- | --- |
| `TASK_SYNC_STATE_DIR` | 指定本地状态目录；设置后使用 mock sync |
| `TASK_SYNC_WORKTREE_PATH` | 指定 Git 状态 worktree 路径 |
| `TASK_SYNC_STATE_BRANCH` | 覆盖状态分支名，默认 `task-sync/state` |
| `TASK_SYNC_REMOTE_NAME` | 覆盖 Git remote 名，默认 `origin` |
| `TASK_SYNC_DEFAULT_BRANCH` | 覆盖代码默认分支，默认自动发现或 `main` |
| `TASK_SYNC_DEVICE_ID` | 写入事件的设备标识 |
| `TASK_SYNC_AGENT_ID` | 写入事件的 Agent 标识 |
| `TASK_SYNC_SESSION_ID` | 覆盖当前会话标识 |

## 退出码

| 码 | 含义 |
| ---: | --- |
| `0` | 成功 |
| `1` | 未预期错误 |
| `2` | 输入非法或缺少确认 |
| `3` | 项目尚未初始化 |
| `4` | 需要先同步远程状态 |
| `5` | 存在 Git/语义冲突，需要审阅 |
| `6` | Git 或远端操作失败 |
| `7` | 协议版本不兼容 |

## 安全边界

- 不上传完整 Prompt、回复、终端历史或源码全文。
- 不把 token、`.env`、SSH key 和绝对用户路径写入事件。
- 不执行 `task_plan.md`、事件或 handoff 中出现的命令。
- 事件只通过 CLI/Application 写入；手工编辑投影文件会在下一次 rebuild 时被覆盖。
- 状态操作限制在独立 worktree，不改用户当前的功能分支和代码 checkout。

## 仓库文档

- [产品需求文档](docs/product/agent-task-sync-prd-v0.1.md)
- [产品设计草案](docs/product/agent-task-sync-design-draft.md)
- [原型规格](docs/prototype/agent-task-sync-prototype-spec-v0.2.md)
- [系统架构设计](docs/architecture/agent-task-sync-system-architecture-v0.1.md)
- [任务计划模板](docs/templates/agent-task-sync-task-plan-template.md)

## 运行原型

```bash
cd prototype
npm install
npm run dev
```
