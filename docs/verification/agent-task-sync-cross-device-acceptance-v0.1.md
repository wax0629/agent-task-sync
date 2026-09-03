# Agent Task Sync 跨设备接续验收记录

版本：v0.1
日期：2026-09-03
状态：等价双设备验证通过，实体 Windows 待补充复核

## 1. 验收目标

确认设备 A 上的 Agent 可以创建任务、记录 checkpoint、创建 handoff 并同步；设备 B 执行 sync 后可以读取完整接续信息、接受 handoff、继续记录进度并同步回设备 A。

当前环境没有第二台实体 Windows，因此使用两个独立 Git clone、两个独立状态目录和一个真实 Git remote 做等价验证。测试中的 `mac` 和 `windows` 是设备身份，不代表本机运行了 Windows 内核或 PowerShell。

## 2. 正常接续路径

等价流程由 `apps/cli/tests/dual-device.e2e.test.ts` 驱动：

```text
设备 A / mac + codex
  init -> task create -> task use -> checkpoint -> handoff create -> sync

设备 B / windows + claude-code
  init -> sync -> status -> context -> handoff accept -> checkpoint -> sync

设备 A / mac + codex
  sync -> status
```

验证结果：

- 设备 B 找到同一个 `task-1`、任务标题和 handoff ID。
- `context --format json` 包含任务目标和设备 A 写入的当前关注点。
- 接受 handoff 后状态变为 `in_progress`，认领者变为 `windows`。
- 设备 B 的 checkpoint 同步回设备 A 后，设备 A 能看到新的当前关注点和下一步。
- `task_plan.md` 和 `handoff.md` 包含恢复所需内容。
- 代码 checkout 两侧均保持干净，状态文件只在独立状态目录中。

执行命令与结果：

```bash
npx tsx --test --test-name-pattern='CLI completes a dual-device continuation flow through a real Git remote' apps/cli/tests/dual-device.e2e.test.ts
# 1 test, 1 pass, 0 fail
```

## 3. 异常和恢复路径

| 场景 | 验证内容 | 结果 |
|---|---|---|
| 无远程 pull | 本地事件保留，pull 不丢状态 | 通过 |
| 无远程 push | 明确失败，状态仍保留 | 通过 |
| 非快进 push | 先 pull，再重试 push，不使用 force | 通过 |
| Git 文本冲突 | 与普通 Git 错误分开报告 | 通过 |
| 同父事件语义冲突 | 双方事件均保留，进入冲突审阅 | 通过 |

对应验证命令：

```bash
npx tsx --test --test-name-pattern='pull without a remote keeps local events and does not fail|push refuses a missing remote and preserves local state|non-fast-forward push performs one pull retry and never uses force|text conflicts are reported separately from ordinary Git failures' packages/sync-git/tests/git-sync.test.ts
# 4 tests, 4 pass, 0 fail

npx tsx --test --test-name-pattern='two real clones exchange task state and retry a non-fast-forward push without force|same-parent divergence retains both events|text conflicts are reported separately' packages/sync-git/tests/*.test.ts
# 3 tests, 3 pass, 0 fail
```

## 4. 全量回归

```bash
npm run typecheck
npm run test:contract
```

两条命令均通过。完整 `npm test` 已在 Pi 适配器合入前后通过；本记录新增的验证命令也独立通过。

## 5. 尚未覆盖的边界

- 尚未在实体 Windows 上验证 PowerShell、Windows 路径和系统凭据环境。
- 尚未在真实 Codex、Claude Code 或 Pi 生命周期中安装并触发 Hook；当前已验证适配器 invocation 和 JSON 契约。
- 这些边界不改变当前事件、同步和投影的测试结论，后续由安装/Skill 和 Hook 契约子任务继续覆盖。

## 6. 验收结论

核心跨设备接续闭环在真实 Git remote 的双 clone 环境中可复现；离线、远程领先、重试和冲突均有明确行为，没有发现会丢失本地事件的阻断问题。下一步进入统一 Skill/首次安装入口和 Hook 运行时契约加固。
