# Agent Task Sync Mac 验收记录

版本：v0.1
验收日期：2026-09-03（Asia/Shanghai）
验收平台：macOS（本机）
验收结论：Mac CLI、Git 状态同步和三个 Hook 入口通过；实体 Windows、真实 Agent 生命周期和真实用户试用待补

## 1. 验收范围

本次验收覆盖以下可在当前 Mac 环境直接验证的链路：

- CLI 构建、npm link 后的直接启动和诊断退出码。
- 两个独立 clone 通过本地 Git remote 交换任务状态。
- Codex、Claude Code、Pi 编译 Hook 的直接进程启动、JSON 输出和确认边界。
- 非法 JSON、缺少 `cwd`、未知 Hook 和 CLI 不可用时的非阻断行为。
- 事件事实、任务投影和代码 checkout 的隔离。

以下项目不能由本机模拟结果替代：实体 Windows 的 PowerShell/路径/凭据、真实 Codex/Claude Code/Pi 生命周期，以及真实用户安装试用。

## 2. 环境与版本

| 项目 | 记录 |
|---|---|
| Node.js | `v24.18.0` |
| npm | `11.16.0` |
| Git | `2.50.1 (Apple Git-155)` |
| 仓库 | `wax0629/agent-task-sync` |
| 验收提交 | `5707390`（`fix(bin): make linked CLI and adapters executable`） |
| 状态协议 | Event/State/Project v1 |

## 3. 安装与入口验收

执行：

```bash
npm install
npm run build
npm link --workspace=@agent-task-sync/cli
npm link --workspace=@agent-task-sync/adapter-codex
npm link --workspace=@agent-task-sync/adapter-claude-code
npm link --workspace=@agent-task-sync/adapter-pi
```

结果：

- `task-sync doctor --json` 通过 npm symlink 正常输出单个 JSON，并在未初始化时返回退出码 `3`。
- `task-sync-adapter-codex`、`task-sync-adapter-claude`、`task-sync-adapter-pi` 直接启动成功；编译入口包含 Unix shebang。
- 修复前发现的“CLI 无输出”和“Hook 被 shell 解析、退出码 2”均不再复现。

## 4. 核心流程验收

| 场景 | 执行/证据 | 结果 |
|---|---|---|
| 双设备接续 | `apps/cli/tests/dual-device.e2e.test.ts`：真实 Git remote、两个独立 clone、Mac → Windows 身份接续 | 通过：1 test, 1 pass |
| Git 异常恢复 | `packages/sync-git/tests/git-sync.test.ts` 远程缺失、远程领先、非快进重试、文本冲突 | 通过：4 tests, 4 pass |
| 双 clone 并发/语义冲突 | `packages/sync-git/tests/dual-device.e2e.test.ts` | 通过：3 tests, 3 pass |
| Hook 进程契约 | `tests/hook-process.test.ts` | 通过：三个适配器均输出一行 JSON，始终 `continue: true` |
| 全量测试 | `npm test` | 通过 |
| 类型检查 | `npm run typecheck` | 通过 |

双设备流程确认：任务创建、认领、checkpoint、handoff、sync、另一侧 accept、追加 checkpoint 和回读均成功；状态写入独立 `task-sync/state` worktree，不改动代码 checkout。

## 5. 安全与确认边界

- Stop/handoff 未确认时只返回候选 invocation，不带 `--yes`，不会写入状态。
- 输入确认后才允许 CLI 写入 checkpoint/handoff。
- 非法 JSON、缺少 `cwd`、未知 Hook 和 CLI 不可用均返回 `continue: true`，不阻断 Agent 会话。
- 状态中不保存完整聊天记录、token、`.env`、SSH key 或绝对用户路径。

## 6. 未覆盖项与后续

- 在实体 Windows 上复核 PowerShell、`%LOCALAPPDATA%`、带空格路径和凭据环境。
- 在真实 Codex、Claude Code、Pi 配置中触发 SessionStart、PreCompact、Stop/Handoff，并留存输出。
- 进行一轮真实用户安装和跨设备试用，记录反馈对应的 Issue。
- 本次验收另发现 `init` 未把自动发现的 Git remote 写入 `project.yaml`，已单独登记 Issue #65；不混入当前入口修复。

## 7. Issue #74 追加验收（2026-09-07）

本节记录 Handoff checkpoint 和同 Mac 多 Agent 接续的新增证据。它是自动化/等价环境验收，不把结果扩写为真实 Codex/Pi UI 或实体 Windows 验收。

### 7.1 环境与版本

| 项目 | 记录 |
|---|---|
| 操作系统 | macOS（本机） |
| Node.js | `v24.18.0` |
| npm | `11.16.0` |
| Git | `2.50.1 (Apple Git-155)` |
| 合并提交 | `3336424`（`feat(handoff): add structured checkpoint fields and Mac hook loop`） |
| 关联 PR / Issue | [PR #77](https://github.com/wax0629/agent-task-sync/pull/77) / [Issue #74](https://github.com/wax0629/agent-task-sync/issues/74) |

### 7.2 可复现步骤与证据

自动化测试 `apps/cli/tests/dual-device.e2e.test.ts` 的“compiled Codex and Pi hooks complete a same-Mac continuation loop”使用真实本地 Git remote、代码 checkout 和独立状态 worktree，按以下顺序执行：

1. `task-sync init` 创建项目，Codex 创建任务并 `task use` 写入共享 `current-task`。
2. 编译后的 Codex Hook 在确认后写入 checkpoint 和 Handoff，并执行 `sync`。
3. 编译后的 Pi `session_start` 不传 `taskId`，从 `current-task` 恢复同一任务；Pi 明确接受 Handoff。
4. Pi 的确认后 Stop Hook 写入 checkpoint 并 `sync`；随后 Codex `session_start` 回读 Pi 的结果。
5. 断言事件 writer 同时包含 `codex` 与 `pi`，两者 `deviceId` 均为 `mac`；代码 checkout 仍在 `main` 且干净。
6. 断言 `handoff.md` 具备 `Goal`、`Constraints`、`Progress`（`Done` / `In Progress` / `Blocked`）、`Decisions`、`Next Steps`、`Context` 六个区块，并且没有实际 prompt/token 内容。

验证命令：

```bash
npm test
npm run typecheck
npm run build
git diff --check
npx tsx --test --test-name-pattern="compiled Codex and Pi hooks" apps/cli/tests/dual-device.e2e.test.ts
```

结果：上述命令全部通过；同 Mac 编译 Hook 接力测试 `1 test, 1 pass`。Hook 未确认时仍只返回候选，不写入事件；CLI/Hook 失败保持 `continue: true`。

### 7.3 文章原则落地

- 会话内上下文压缩仍由 Agent 原生机制负责；本项目只提供跨会话/跨 Agent Handoff，不实现第二套 token 压缩。
- Handoff 是短 checkpoint，固定字段和顺序；`Done` 只写有证据的结果，首个 `Next Steps` 必须可直接执行。
- 新交接只保留当前有效摘要；完整历史留在 JSONL 事件和任务级 `progress.md`。

### 7.4 仍待实体验收

- 真实 Codex、Pi 配置中触发 SessionStart、PreCompact、Stop/Handoff，并保存实际输出。
- Windows 实机的 PowerShell、路径、凭据和跨设备回传。
- 一轮真实用户安装与跨设备试用。
