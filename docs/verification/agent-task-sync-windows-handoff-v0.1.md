# Agent Task Sync Windows 实机验收 Handoff

版本：v0.1
编写日期：2026-09-04
状态：待实体 Windows 执行；不得将本文档或双 clone 结果当作 Windows 已通过

## 1. 这次要验证什么

这份 handoff 给 Windows 设备上的开发者和 Agent 使用。目标是完成一次真实的：

~~~text
Mac + Agent
  -> 创建/更新任务、checkpoint、handoff
  -> GitHub task-sync/state
Windows + Agent
  -> sync、读取 context、接受 handoff、继续记录
  -> GitHub task-sync/state
Mac
  -> sync、回读 Windows 的结果
~~~

不是每一个测试都必须在 Windows 上重跑。事件模型、Reducer、CLI 主链路、双 clone 同步和异常恢复已经在 Mac/自动化环境覆盖；Windows 实机必须补充操作系统相关证据：

- PowerShell 的命令和 stdin/stdout 行为。
- Windows 路径、带空格路径、反斜杠和可能的 CRLF 影响。
- %LOCALAPPDATA% 下的状态目录和 Git 状态 worktree。
- Windows Git remote 凭据、网络和非快进重试。
- Windows 上真实安装后的 CLI/适配器入口，尤其是 npm 生成的 .cmd shim。
- 真实 Claude Code、Codex 或 Pi 生命周期 Hook（环境中安装了哪个就验证哪个）。

如果某项失败，保留失败证据并回传，不要用手工改投影、删除事件或 force push 把结果“修成通过”。

## 2. 当前基线

### 2.1 代码和仓库

- Agent Task Sync 工具仓库：https://github.com/wax0629/agent-task-sync
- 本 handoff 编写时 GitHub main：137ce001bdf1ace8758c0367dd5f3f6f861bba2de（短 SHA：137ce00）。
- 该提交已经包含 PR #66（npm link 入口修复）和 PR #67（init 保存自动发现的 remote/default branch）。
- Windows 应使用 main 的最新提交；若已拉到更新提交，记录实际短 SHA，并确认没有回退到旧版本。

### 2.2 协议和状态边界

- Event Protocol v1：events/**/*.jsonl 是唯一事实来源，事件只追加，不改写历史。
- Task/Project/Markdown 是可重建投影；不要直接编辑 task.yaml、progress.md、task_plan.md 或 handoff.md。
- Windows 的 Git 模式状态目录默认位于：

~~~text
%LOCALAPPDATA%\agent-task-sync\projects\<repo-id>\state-worktree
~~~

实际路径以 task-sync doctor 输出为准。不要手动 checkout task-sync/state，也不要把状态 worktree 当作代码仓库工作目录。

### 2.3 三个目录不要混淆

| 目录 | 作用 | 是否在这里写任务状态 |
|---|---|---|
| C:\work\agent-task-sync | Agent Task Sync 工具源码，用于构建和链接 CLI/适配器 | 否 |
| C:\work\your-project | 实际要开发的项目代码仓库，必须与 Mac 使用同一个 Git remote | 通过 CLI 操作，但状态不落在代码 checkout |
| %LOCALAPPDATA%\agent-task-sync\projects\...\state-worktree | CLI 管理的 task-sync/state 独立状态 worktree | CLI 自动写入 |

## 3. Mac 端先交给 Windows 的信息

Windows 开始前，Mac 端应提供以下非敏感信息。推荐把它写在 Issue/PR 评论或单独的验收记录中，不要只留在聊天里：

| 信息 | 示例/说明 |
|---|---|
| 目标代码仓库 URL | 与 Mac 当前仓库相同的 origin |
| Windows 本地路径 | 例如 C:\work\your-project |
| projectId | 必须与 Mac task-sync status --json 中的 project.projectId 相同 |
| 项目名称 | 必须与现有项目对应；不要随意创建第二个 project-id |
| taskId | 要继续的任务，例如 task-1；以 Mac 的 status --json 为准 |
| handoffId | Mac 创建的当前 handoff ID；以 status --json 为准 |
| Mac 端代码分支和提交 | 用于确认状态操作没有改变代码 checkout |
| Mac 端最后一次 sync/status 结果 | 应没有远程领先、Git 冲突或未同步事件 |

这些信息不应包含完整 Prompt、模型回复、token、.env、SSH key、密码或源码全文。

Mac 端可用下面的只读命令准备这些信息；把输出中的 projectId、taskId 和 handoffId 交给 Windows：

~~~bash
task-sync sync
task-sync status --json
task-sync context <task-id> --format markdown
~~~

若 status 报告远程领先、Git 冲突或未同步事件，Mac 应先处理并再次 sync；Windows 不应基于旧的 handoff 继续写入。

## 4. Windows 环境记录

在 PowerShell 中记录版本和当前用户环境。建议先启动 transcript；提交前检查并删去凭据、令牌和不必要的绝对路径。

~~~powershell
$LogPath = Join-Path $env:TEMP 'agent-task-sync-windows-acceptance.txt'
Start-Transcript -Path $LogPath

$PSVersionTable.PSVersion
node --version
npm --version
git --version
git config --get core.autocrlf
~~~

同时记录：

- Windows 版本（Windows 10/11 及具体版本）。
- PowerShell 版本。
- Node.js、npm、Git 版本。
- 实际使用的 Agent 及版本（Claude Code、Codex 或 Pi）。
- 是否通过 HTTPS/SSH 访问 GitHub，以及凭据是否由系统凭据管理器提供。

## 5. 安装 Agent Task Sync

以下命令假设工具源码放在 C:\work\agent-task-sync。路径带空格时必须始终加引号；也可以把 ToolRoot 改成实际路径。

~~~powershell
$ToolRoot = 'C:\work\agent-task-sync'
Set-Location $ToolRoot

git fetch origin main
git rev-parse --short origin/main
npm ci
npm run build
npm test
npm run typecheck

npm link --workspace=@agent-task-sync/cli
npm link --workspace=@agent-task-sync/adapter-codex
npm link --workspace=@agent-task-sync/adapter-claude-code
npm link --workspace=@agent-task-sync/adapter-pi
~~~

确认 PowerShell 能找到链接后的入口：

~~~powershell
Get-Command task-sync -All
Get-Command task-sync-adapter-codex -All
Get-Command task-sync-adapter-claude -All
Get-Command task-sync-adapter-pi -All
~~~

在 Windows 上 npm 可能提供 task-sync.cmd、task-sync-adapter-claude.cmd 等 shim。CLI 在 PowerShell 中能运行，不代表 Node 的 execFile("task-sync") 一定能从适配器中启动该 shim；第 10 节的 Hook 冒烟测试专门检查这一点。如果出现 .cmd/execFile 错误，记录完整 stderr 和复现命令，停止扩散修复，不要把修复混入本 handoff 文档 PR。

如果 task-sync 不在 PATH，可先用以下方式验证 CLI 本身，但适配器测试仍需要解决入口问题：

~~~powershell
node (Join-Path $ToolRoot 'apps\cli\dist\main.js') doctor --json
~~~

## 6. 安装统一 Skill

三个 Agent 共用仓库中的 canonical Skill：

~~~text
skills/agent-task-sync/SKILL.md
~~~

Codex 的默认 Windows 目标目录如下：

~~~powershell
$SkillSource = Join-Path $ToolRoot 'skills\agent-task-sync'
$SkillDest = Join-Path $env:USERPROFILE '.codex\skills\agent-task-sync'
New-Item -ItemType Directory -Force -Path $SkillDest | Out-Null
Copy-Item -Path (Join-Path $SkillSource '*') -Destination $SkillDest -Recurse -Force
Test-Path (Join-Path $SkillDest 'SKILL.md')
~~~

Claude Code 和 Pi 的 Skill 目录由各自实际安装机制决定。把同一个 skills/agent-task-sync 目录内容安装到平台支持的 Skill 位置，并在结果表中记录实际路径；不要为不同 Agent 维护三套改过的协议文档。

适配器配置文件是配置骨架，不是自动安装脚本：

~~~text
adapters/codex/codex-hooks.json
adapters/claude-code/claude-hooks.json
adapters/pi/pi-hooks.json
~~~

按实际 Agent 的 Hook 配置格式注册命令，并记录生效的配置位置。适配器只做生命周期转换，事件存储、Reducer 和写入确认仍由同一个 task-sync CLI 负责。

## 7. 初始化并同步目标代码仓库

### 7.1 只读检查

先进入与 Mac 相同 remote 的代码仓库，确认代码 checkout 当前分支和工作树。不要在工具源码仓库中执行这些项目操作。

~~~powershell
$ProjectRoot = 'C:\work\your-project'
Set-Location $ProjectRoot

git status --short
git remote -v
git branch --show-current
git rev-parse --short HEAD

task-sync doctor --json
$DoctorExitCode = $LASTEXITCODE
"doctor exit code: $DoctorExitCode"
~~~

在尚未初始化的全新代码仓库中，doctor 返回退出码 3 是预期结果；它不代表安装失败。初始化后应再次执行 doctor。如果 doctor 报告远程领先、冲突或状态 worktree 路径冲突，先按第 11 节处理，不要继续写入。

### 7.2 使用 Mac 的 project-id 初始化

把下列占位值替换为 Mac 提供的同一 projectId 和项目名称：

~~~powershell
$ProjectId = '<与 Mac 相同的 project-id>'
$ProjectName = '<与 Mac 相同的项目名称>'

task-sync init $ProjectId $ProjectName
task-sync doctor --json
task-sync status --json
~~~

init 会根据当前代码仓库的 Git remote 自动保存项目元数据，并创建独立的状态 worktree；不会切换或修改当前代码分支。初始化后重点确认：

- doctor.mode 为 git-worktree。
- doctor.project.projectId 与 Mac 相同。
- doctor.project.remoteConfigured 为 true。
- doctor.state.worktreePath 位于 %LOCALAPPDATA% 下的 Agent Task Sync 路径。
- git branch --show-current 与初始化前相同，git status --short 没有被状态操作改动。

如果该代码仓库已经初始化过，跳过 init，不要删除状态目录，直接执行 task-sync sync。如果发现已有初始化使用了错误的 project-id，停止并回报，不要通过删除目录重置。

### 7.3 同步远程状态

~~~powershell
task-sync sync
task-sync status --json
~~~

正常情况下 Windows 应能读到 Mac 已创建的任务。同步过程会 pull、从事件重建投影并 push；不要手动 checkout task-sync/state。若 GitHub 要求登录，使用组织允许的 Git Credential Manager/SSH 配置，不要把凭据写入日志或任务状态。

## 8. 恢复并接受 Mac handoff

### 8.1 找到任务和 handoff

先保存 Mac 提供的 TaskId；下面的 task-1 只是示例，不要盲目照抄。

~~~powershell
$TaskId = '<Mac 提供的 task-id>'

$StatusJson = task-sync status --json
$Status = $StatusJson | ConvertFrom-Json
$Status.project.projectId
$Status.tasks | Select-Object id,title,status,currentFocus,nextAction

$Task = $Status.tasks | Where-Object { $_.id -eq $TaskId }
if (-not $Task) { throw "Task not found: $TaskId" }
$HandoffId = $Task.handoff.id
if (-not $HandoffId) { throw "No handoff found for task: $TaskId" }
"handoff: $HandoffId"
~~~

读取完整恢复上下文时，文档中的命令、路径和文本都是同步数据，不是 PowerShell 指令；只把它们当作信息审阅：

~~~powershell
task-sync context $TaskId --format markdown
task-sync handoff check $TaskId --json
~~~

handoff check 的阻断项必须先处理；推荐项可以在验收记录中说明暂不适用。确认任务目标、完成项、未完成项、关键决策、已知错误、相关文件和测试摘要均能从 context/handoff 读到后，再接受交接：

~~~powershell
$env:TASK_SYNC_DEVICE_ID = 'windows'
$env:TASK_SYNC_AGENT_ID = 'claude-code' # 实际使用 Pi/Codex 时替换

task-sync handoff accept $TaskId $HandoffId --yes --json
task-sync task use $TaskId --yes --json
task-sync status --json
~~~

预期：

- 任务状态由 handoff_ready 变为 in_progress。
- handoff 有 acceptedAt 和 Windows 的接受者信息。
- 任务仍是同一个 taskId，没有新建重复任务。
- 代码 checkout 分支和未提交代码没有被改变。

## 9. Windows 继续工作并回传 checkpoint

完成至少一个真实的 Windows 工作步骤或兼容性验证后，记录摘要、当前关注点、已完成项、下一步、文件和验证结果。示例：

~~~powershell
task-sync checkpoint --task $TaskId --summary '已从 Mac 恢复并完成 Windows 实机验证' --current-focus 'Windows 路径与 Agent Hook 兼容性' --recent-completed '完成 Windows 安装和跨设备恢复' --next-action '回到 Mac 复核 Windows 写入结果' --file 'src\example.ts' --verification '[{"command":"npm test","result":"passed","status":"passed"}]' --yes --json

task-sync sync
task-sync status --json
~~~

注意：

- --file、--uncommitted-change 和 JSON 输入中的路径都要使用引号；带空格的路径必须完整包起来。
- 不要把完整 Prompt、回复、token、.env、SSH key、终端历史或源码全文写入 checkpoint/handoff。
- 所有写入命令都要显式 --yes；没有明确确认时只能查看候选，不应产生事件。
- 不要直接编辑 .task-sync 下的 task.yaml、Markdown 或 JSONL。

如果命令行 JSON 引号在当前 PowerShell 环境中不易维护，可使用 --input 文件。文件至少包含：

~~~json
{
  "taskId": "task-1",
  "summary": "已从 Mac 恢复并完成 Windows 实机验证",
  "currentFocus": "Windows 路径与 Agent Hook 兼容性",
  "recentCompleted": ["完成 Windows 安装和跨设备恢复"],
  "nextAction": "回到 Mac 复核 Windows 写入结果",
  "filesChanged": ["src\\example.ts"],
  "verification": [
    {
      "command": "npm test",
      "result": "passed",
      "status": "passed"
    }
  ]
}
~~~

保存后执行：

~~~powershell
task-sync checkpoint --input .\windows-checkpoint.json --yes --json
task-sync sync
~~~

## 10. Windows Hook 冒烟测试

至少验证一个真实安装的 Agent；推荐先验证 Claude Code，再按环境补 Codex/Pi。以下示例使用 Claude Code 入口。PowerShell 通过 ConvertTo-Json 生成 stdin，避免手写 Windows 反斜杠导致非法 JSON。

### 10.1 SessionStart：读取状态

~~~powershell
$HookInput = @{ cwd = $ProjectRoot } | ConvertTo-Json -Compress
$HookResult = $HookInput | task-sync-adapter-claude session_start
$HookResult
$HookObject = $HookResult | ConvertFrom-Json
if ($HookObject.continue -ne $true) { throw 'Hook did not return continue=true' }
~~~

预期：输出一行可解析 JSON，continue 为 true；有任务时可再传 taskId，适配器会依次调用 status --json 和 context <task-id> --format json。

### 10.2 PreCompact：刷新上下文

~~~powershell
$HookInput = @{
  cwd = $ProjectRoot
  taskId = $TaskId
} | ConvertTo-Json -Compress
$HookResult = $HookInput | task-sync-adapter-claude pre_compact
$HookResult
($HookResult | ConvertFrom-Json).continue
~~~

预期：返回当前任务的 JSON 上下文；CLI 或路径失败时仍返回 continue: true 和 warning，不阻断 Agent 会话。

### 10.3 Stop：先看候选，确认后才写入

先用一个候选输入文件路径测试“未确认不写入”。该阶段不需要 CLI 读取文件内容：

~~~powershell
$CheckpointPath = Join-Path $env:TEMP 'agent-task-sync-windows-checkpoint.json'
$HookInput = @{
  cwd = $ProjectRoot
  taskId = $TaskId
  checkpointInputFile = $CheckpointPath
} | ConvertTo-Json -Compress
$HookResult = $HookInput | task-sync-adapter-claude stop
$HookResult
$HookObject = $HookResult | ConvertFrom-Json
if ($HookObject.continue -ne $true) { throw 'Hook did not return continue=true' }
if ($HookObject.requiresConfirmation -ne $true) { throw 'Stop did not request confirmation' }
if ($HookObject.invocations[0].args -contains '--yes') { throw 'Unconfirmed stop attempted a write' }
~~~

确认候选内容后，在 $CheckpointPath 写入合法 checkpoint JSON，再显式传 confirmed = true：

~~~powershell
$HookInput = @{
  cwd = $ProjectRoot
  taskId = $TaskId
  checkpointInputFile = $CheckpointPath
  confirmed = $true
} | ConvertTo-Json -Compress
$HookResult = $HookInput | task-sync-adapter-claude stop
$HookResult
($HookResult | ConvertFrom-Json).continue
~~~

确认写入后检查事件和状态：

~~~powershell
task-sync status --json
task-sync sync
~~~

### 10.4 失败不阻断 Agent

用一个不存在的工作目录模拟 CLI 无法启动；不要修改真实状态：

~~~powershell
$BadInput = @{ cwd = 'C:\path\that\does\not\exist' } | ConvertTo-Json -Compress
$BadResult = $BadInput | task-sync-adapter-claude session_start
$BadResult
$BadObject = $BadResult | ConvertFrom-Json
if ($BadObject.continue -ne $true) { throw 'Hook failure blocked the session' }
if (-not $BadObject.warning) { throw 'Hook failure did not return a warning' }
~~~

如果这里出现 task-sync.cmd、execFile、ENOENT 或类似 Windows 入口错误，记录原始输出、Node/npm 版本、Get-Command 结果和复现命令，标记为适配器 Bug 线索；不要在 Windows 上直接改状态文件或绕过确认边界。

### 10.5 其他 Agent

如果 Windows 上安装了 Codex 或 Pi，使用同样的输入/输出断言替换入口：

~~~powershell
$HookInput | task-sync-adapter-codex session_start
$HookInput | task-sync-adapter-codex pre_compact
$HookInput | task-sync-adapter-codex stop

$HookInput | task-sync-adapter-pi session_start
$HookInput | task-sync-adapter-pi pre_compact
$HookInput | task-sync-adapter-pi stop
~~~

Pi 还可以验证 handoff：未确认时必须只返回候选；确认后才以包含 --yes 的 CLI invocation 写入。平台未安装时填“不适用”并记录原因，不要假装通过。

## 11. 异常处理和停止条件

| 现象/退出码 | 处理 |
|---|---|
| task-sync 找不到 | 回到工具源码目录重新 npm run build、npm link --workspace=@agent-task-sync/cli，再检查 Get-Command |
| doctor 首次退出 3 | 预期的未初始化状态；使用 Mac 提供的 project-id 执行 init |
| doctor 报状态 worktree 路径冲突 | 先备份并移走冲突的非 worktree 目录，再重试；不要让 CLI 自动删除目录 |
| status/写入退出 4，报告远程领先 | 先 task-sync sync，确认状态不再远程领先后再写入 |
| sync 退出 5 | 执行 task-sync conflicts 审阅；保留双方事件，不 force push、不删除事件 |
| sync 退出 6 | 记录网络/凭据/Git stderr；本地事件应保留，恢复后重试 |
| Project/Event/State Protocol 不兼容 | 停止写入，保留状态 worktree 和提交哈希，不自动迁移或覆盖 |
| Hook 输出不是 JSON 或 continue 不是 true | 标记适配器问题并回传原始 stdout/stderr；不要阻断或修改 Agent 状态 |
| .cmd/execFile 启动失败 | 记录为独立 Bug 线索，文档验收不判通过；不要把临时 shell 绕过写成正式配置 |

## 12. Windows 回传清单

请复制下表到 Issue #68 或验收记录中填写。通过必须附命令输出、日志、截图或链接；没有证据就填“待验收”。

### 12.1 环境和安装

| 编号 | 检查项 | 结果 | 证据/问题 |
|---|---|---|---|
| I-1 | Windows 版本和 PowerShell 版本 | 待验收 | |
| I-2 | Node/npm/Git 版本 | 待验收 | |
| I-3 | 工具仓库 commit 与 main 基线一致 | 待验收 | |
| I-4 | npm ci、build、test、typecheck | 待验收 | |
| I-5 | CLI 和实际使用的适配器 Get-Command 可见 | 待验收 | |
| I-6 | canonical Skill 安装路径和读取结果 | 待验收 | |

### 12.2 跨设备接续

| 编号 | 检查项 | 结果 | 证据/问题 |
|---|---|---|---|
| F-1 | doctor 识别 Git worktree、remote 和 %LOCALAPPDATA% 状态路径 | 待验收 | |
| F-2 | Windows 使用与 Mac 相同的 projectId | 待验收 | |
| F-3 | sync 后找到同一 taskId 和 handoffId | 待验收 | |
| F-4 | context/handoff check 能读到目标、完成项、下一步、验证和问题 | 待验收 | |
| F-5 | 接受 handoff 后任务变为 in_progress | 待验收 | |
| F-6 | Windows checkpoint 写入并同步到 GitHub | 待验收 | |
| F-7 | Mac sync/status/context 能回读 Windows 结果 | 待验收 | |
| F-8 | 代码 checkout 分支、提交和未提交代码未被状态操作改动 | 待验收 | |

### 12.3 Agent Hook

| 编号 | 平台/Hook | 结果 | 证据/问题 |
|---|---|---|---|
| H-1 | 实际 Agent SessionStart | 待验收 | |
| H-2 | 实际 Agent PreCompact | 待验收 | |
| H-3 | Stop 未确认只返回候选且不带 --yes | 待验收 | |
| H-4 | Stop 明确确认后才写入 checkpoint | 待验收 | |
| H-5 | CLI/路径失败时输出 warning 且 continue: true | 待验收 | |
| H-6 | .cmd shim/execFile 是否可用 | 待验收 | |
| H-7 | Pi handoff（仅安装 Pi 时） | 不适用/待验收 | |

### 12.4 结果摘要

~~~text
验收日期/时区：
验收人：
Windows 版本：
PowerShell 版本：
Node/npm/Git：
Agent 及版本：
工具仓库 commit：
目标代码仓库路径：
projectId / taskId / handoffId：
状态 worktree 路径：
Git remote 方式（HTTPS/SSH）：
总体结论（通过/部分通过/失败）：
阻断问题及 Issue：
证据文件或链接：
~~~

完成回传后结束 transcript：

~~~powershell
Stop-Transcript
~~~

提交日志前检查：没有 token、密码、SSH key、.env、完整聊天记录或不必要的源码内容。

## 13. Windows 完成后的 Mac 回读

Windows 回传并确认已执行 sync 后，Mac 在原代码仓库执行：

~~~bash
task-sync sync
task-sync status --json
task-sync context <task-id> --format markdown
~~~

确认：

- Windows 的 checkpoint、验证结果、下一步和活动记录已出现。
- handoff 的 acceptedBy.deviceId/agentId 与 Windows 回传一致。
- Mac 代码 checkout 分支和未提交代码仍保持原样。
- 没有远程领先、Git 文本冲突或未解决语义冲突。

只有 Windows 实机证据和 Mac 回读都完成，才能把 Issue #68 的 Windows 验收项标记为通过。若 Hook 的 .cmd 启动问题复现，应另建最小 Bug Issue 和独立修复 PR，不把未验证的临时绕过方案写入正式 handoff。
