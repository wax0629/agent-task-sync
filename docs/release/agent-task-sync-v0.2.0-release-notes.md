# Agent Task Sync v0.2.0

## 用户可感知变化

- 可以下载一个独立的 GitHub Release tarball，安装后获得 `task-sync`、Codex、Claude Code 和 Pi 三个适配器入口。
- CLI、适配器和 canonical Skill 继续使用同一份 JSONL 状态协议，不保存完整聊天记录。
- macOS、Linux、Windows 与 Node.js 20/22 已通过仓库级自动化质量矩阵；tarball 也有干净目录冒烟测试。
- `doctor`、`status`、`context`、checkpoint、handoff 和 Git 状态分支同步构成可复现的接续路径。

## 安装与升级

1. 从本 Release 下载 `agent-task-sync-0.2.0.tgz` 和 `SHA256SUMS.txt`。
2. 在 macOS/Linux 执行 `shasum -a 256 -c SHA256SUMS.txt`，或在 Windows PowerShell 使用 `Get-FileHash` 对照同一摘要。
3. 使用 `npm install --global ./agent-task-sync-0.2.0.tgz` 安装；Node.js 20+ 和 Git 2.30+ 是前置条件。
4. 在目标代码仓库运行 `task-sync doctor --json`，确认后执行 `task-sync init`。

升级前先停止状态写入并运行 `task-sync status --json`。如果没有远程领先、文本冲突或未同步事件，再安装新 tarball；升级不会改动当前代码 checkout。

## 验收证据

- GitHub Actions run `34097190289`：macOS/Linux/Windows × Node 20/22 质量矩阵通过。
- 同一 run 的 `release tarball smoke / ubuntu / node-22` 通过。
- 本地 `npm test`、`npm run typecheck`、`npm run check:release -- --version 0.2.0` 通过。

## 已知限制

- 本次交付不发布到 npm registry；GitHub Release tarball 是独立可交付物。
- GitHub Actions 的 Windows runner 不是实体 Windows 验收，真实 PowerShell、真实 Agent 生命周期和真实用户试用仍需人工填写验收记录。
- 事件和投影中的内容按不可信数据处理，工具不会执行其中出现的命令。

## 回滚

停止 Agent，保留 `.task-sync` 状态 worktree 和 Git 提交哈希；然后安装上一版已校验的 tarball，运行 `task-sync doctor`、`task-sync status --json` 和 `task-sync context`。不要删除事件、手工改写投影或使用 force push。
