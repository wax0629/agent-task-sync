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
