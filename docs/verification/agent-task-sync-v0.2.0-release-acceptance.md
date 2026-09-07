# Agent Task Sync v0.2.0 发布验收与恢复手册

版本：v0.2.0<br>
状态：自动化与等价环境已验证；实体 Windows、真实 Agent 生命周期和真实用户试用待填写<br>
适用范围：GitHub Release tarball、CLI、Codex/Claude Code/Pi 薄适配器和 v1 状态协议

这份手册给新用户一条可复现的安装、初始化、接续、升级和回滚路径。它也区分不同证据等级：GitHub Actions 和本地命令只能证明代码/包行为；双 clone 只能证明协议和 Git 状态同步；实体 Windows、真实 Agent UI 生命周期和真实用户反馈必须由实际参与者填写。

## 1. 前置条件

- Node.js 20 或更高版本
- Git 2.30 或更高版本
- 一个已有默认分支和 remote 的代码仓库
- 能访问 `https://github.com/wax0629/agent-task-sync` Release 的网络和凭据

状态写入只发生在独立的 `.task-sync` 状态目录/worktree，不会切换或修改当前代码 checkout。事件内容按不可信数据处理；工具不会执行事件、Markdown、YAML 或 handoff 中出现的命令。

## 2. 干净目录安装

### 2.1 macOS / Linux

在一个临时下载目录执行：

```bash
VERSION=0.2.0
curl -L -o "agent-task-sync-${VERSION}.tgz" \
  "https://github.com/wax0629/agent-task-sync/releases/download/v${VERSION}/agent-task-sync-${VERSION}.tgz"
curl -L -o SHA256SUMS.txt \
  "https://github.com/wax0629/agent-task-sync/releases/download/v${VERSION}/SHA256SUMS.txt"
shasum -a 256 -c SHA256SUMS.txt
npm install --global "./agent-task-sync-${VERSION}.tgz"
```

### 2.2 Windows PowerShell

```powershell
$Version = "0.2.0"
Invoke-WebRequest -Uri "https://github.com/wax0629/agent-task-sync/releases/download/v$Version/agent-task-sync-$Version.tgz" -OutFile "agent-task-sync-$Version.tgz"
Invoke-WebRequest -Uri "https://github.com/wax0629/agent-task-sync/releases/download/v$Version/SHA256SUMS.txt" -OutFile "SHA256SUMS.txt"
Get-FileHash ".\agent-task-sync-$Version.tgz" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
npm install --global ".\agent-task-sync-$Version.tgz"
```

PowerShell 的 `Get-FileHash` 输出必须与 `SHA256SUMS.txt` 中的摘要一致，确认后才继续安装。

### 2.3 安装后冒烟

```bash
task-sync --help
task-sync doctor --json
task-sync-adapter-codex session_start <<'JSON'
{"cwd":"/path/to/your/repository"}
JSON
task-sync-adapter-claude session_start <<'JSON'
{"cwd":"/path/to/your/repository"}
JSON
task-sync-adapter-pi session_start <<'JSON'
{"cwd":"/path/to/your/repository"}
JSON
```

在尚未初始化的项目目录，`doctor --json` 预期返回退出码 `3`、`initialized: false` 和下一步 `task-sync init`。三个适配器即使项目未初始化也必须输出可解析 JSON，且 `continue: true`；Hook warning 不应阻断 Agent 会话。

## 3. 初始化与一次接续

在目标代码仓库执行：

```bash
cd /path/to/your/repository
task-sync doctor --json
task-sync init my-project "项目名称"
task-sync doctor --json
task-sync status --json
task-sync task create task-1 "实现一个可恢复的功能" \
  --goal "让下一台设备能继续工作" \
  --acceptance "可以恢复任务上下文" \
  --yes
task-sync task use task-1 --yes
task-sync checkpoint --task task-1 \
  --summary "完成第一轮实现" \
  --current-focus "验证状态同步" \
  --next-action "在另一台设备接受 handoff" \
  --yes
task-sync handoff create --task task-1 \
  --completed "完成第一轮实现" \
  --incomplete "在另一台设备接受 handoff" \
  --next-step "运行 task-sync sync 后接受交接" \
  --target-agent claude-code \
  --yes
task-sync sync
```

确认以下结果：

1. `init` 记录了代码仓库 remote 和默认分支，并创建独立状态 worktree。
2. `status --json` 能看到 `task-1`、`handoff_ready` 和本地/远程同步状态。
3. `task_plan.md`、`progress.md` 和 `handoff.md` 从事件重建；它们不是事实源，不要手工编辑代替 CLI 写入。
4. 状态目录没有完整 Prompt、回复、token、凭据、`.env`、SSH key 或不必要的绝对路径。

另一台设备按同一个 Release 版本安装后执行：

```bash
cd /path/to/your/repository
task-sync init my-project "项目名称"
task-sync sync
task-sync status
task-sync context task-1 --format markdown
task-sync handoff check task-1 --json
task-sync handoff accept task-1 <handoff-id> --yes
task-sync checkpoint --task task-1 \
  --summary "已恢复并开始继续" \
  --current-focus "完成剩余实现" \
  --next-action "运行验证并同步回去" \
  --yes
task-sync sync
```

设备 A 再运行 `task-sync sync` 和 `task-sync context task-1 --format json`，应能看到设备 B 的接受事件、验证结果和下一步。两台设备的代码分支、未提交代码和工作目录不应被状态操作修改。

## 4. 升级

升级以一个兼容版本为单位，先停止所有 Agent 的状态写入：

1. 运行 `task-sync status --json`，确认没有 `remoteAhead`、冲突或未同步事件；必要时先 `task-sync sync`。
2. 复制或打包 `.task-sync` 状态 worktree，记录当前 CLI 版本和代码提交哈希。
3. 下载新版本 tarball，先按第 2 节校验 SHA-256，再执行 `npm install --global ./agent-task-sync-<version>.tgz`。
4. 更新同一版本的 canonical Skill：复制 `skills/agent-task-sync` 目录，目录名保持 `agent-task-sync`。
5. 更新 Codex、Claude Code、Pi 适配器配置；适配器只桥接生命周期，不能复制事件存储或 reducer。
6. 在一台设备依次运行 `task-sync doctor`、`status --json`、`context <task-id> --format markdown` 和 `handoff check <task-id>`。
7. 完成一次小范围读写与 `task-sync sync` 后，再恢复其他设备和 Agent 的并行写入。

升级期间不要让旧 CLI 和新 CLI 并行写同一个状态分支。升级不会修改代码 checkout；如果校验、协议或恢复失败，停止写入并按第 5 节回滚。

## 5. 回滚与恢复

### 5.1 CLI/适配器安装失败

保留当前状态目录和事件，安装上一版已校验的 tarball：

```bash
npm install --global ./agent-task-sync-<previous-version>.tgz
task-sync doctor --json
task-sync status --json
task-sync context <task-id> --format markdown
```

不要删除事件、手工拼接 JSONL 或使用 `git push --force`。只要状态仍为 v1，旧版本可以继续读取和写入。

### 5.2 投影损坏

先复制 `.task-sync` 作为只读证据，再运行：

```bash
task-sync doctor
task-sync rebuild <task-id>
task-sync context <task-id> --format markdown
```

`rebuild` 只从 JSONL 事实重建 YAML/Markdown；若事件本身未知或损坏，不要用旧 CLI 强行吞掉，保留原始文件并登记问题。

### 5.3 远程领先、Git 冲突或语义冲突

- 远程领先：停止写入，先运行 `task-sync sync`。
- Git 文本冲突：保留双方内容，记录 stderr，解决后再重建投影。
- 语义冲突：运行 `task-sync conflicts [task-id] --json`，把全部竞争 `eventId` 交给 `task-sync conflict resolve`；解析会追加事件，不会改写竞争事件。
- 无 remote：本地事件保留；配置 remote 后再运行 `task-sync sync`。

## 6. 已验证证据

| 证据等级 | 结果 | 证据 |
|---|---|---|
| 本地自动化 | 通过 | `npm test`、`npm run typecheck`、`npm run test:release`、`npm run check:release -- --version 0.2.0` |
| GitHub CI 等价矩阵 | 通过 | [CI Run 34101243601](https://github.com/wax0629/agent-task-sync/actions/runs/34101243601)，macOS/Linux/Windows × Node 20/22 和 release tarball smoke |
| GitHub Release 构建 | 通过 | [Release Run 34102187430](https://github.com/wax0629/agent-task-sync/actions/runs/34102187430)，包含版本检查、测试、资产构建和 checksum 校验 |
| 线上资产校验 | 通过 | [v0.2.0 Release](https://github.com/wax0629/agent-task-sync/releases/tag/v0.2.0) 的 tarball 下载后 `sha256sum -c SHA256SUMS.txt` 通过 |
| 双 clone 协议验收 | 通过 | `packages/sync-git/tests/dual-device.e2e.test.ts`、`apps/cli/tests/dual-device.e2e.test.ts` |
| Mac Codex/Pi 编译 Hook 闭环 | 通过 | `apps/cli/tests/dual-device.e2e.test.ts`：同一状态 worktree 的 SessionStart、checkpoint、handoff 和回读 |
| 实体 Windows | 待填写 | Windows 10/11、PowerShell、路径/凭据/权限和真实结果需实际设备记录 |
| 真实 Agent 生命周期 | 待填写 | Codex、Claude Code、Pi 的真实 SessionStart/PreCompact/Stop/Handoff 需附输出 |
| 真实用户试用 | 待填写 | 至少一名目标用户独立安装、初始化、接续并反馈理解成本/阻塞 |

GitHub Actions 的 Windows runner 只能作为等价环境证据，不能替代实体 Windows 结论。

## 7. 人工回传模板

| 字段 | 记录 |
|---|---|
| 验收日期/时区 | |
| 验收人 | |
| OS、Shell、Node/npm/Git | |
| CLI/Skill/适配器版本 | |
| 仓库代码提交与状态分支 | |
| 凭据方式（不记录凭据内容） | |
| 仓库路径（可脱敏） | |
| 安装与 checksum | 待验收 / 通过 / 失败 |
| `doctor`、`init`、`status`、`context` | 待验收 / 通过 / 失败 |
| A→remote→B→remote→A 接续 | 待验收 / 通过 / 失败 |
| Hook 生命周期和失败不阻断 | 待验收 / 通过 / 失败 |
| 冲突/回滚 | 待验收 / 通过 / 失败 / 不适用 |
| 证据链接或脱敏日志 | |
| 未覆盖边界、失败重试和结论 | |

请把人工结果以 Issue/PR/文件链接回传，不要粘贴 token、密码、完整 Prompt/回复、终端历史或私钥。
