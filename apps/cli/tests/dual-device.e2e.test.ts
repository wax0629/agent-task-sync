import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../dist/main.js", import.meta.url));

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface RepositoryFixture {
  root: string;
  remote: string;
  mac: string;
  windows: string;
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}

async function runCli(cwd: string, stateWorktree: string, deviceId: string, ...args: string[]): Promise<CliResult> {
  return runAgentCli(cwd, stateWorktree, deviceId, deviceId === "mac" ? "codex" : "claude-code", ...args);
}

async function runAgentCli(cwd: string, stateWorktree: string, deviceId: string, agentId: string, ...args: string[]): Promise<CliResult> {
  const environment = { ...process.env };
  delete environment.TASK_SYNC_STATE_DIR;
  environment.TASK_SYNC_WORKTREE_PATH = stateWorktree;
  environment.TASK_SYNC_DEVICE_ID = deviceId;
  environment.TASK_SYNC_AGENT_ID = agentId;
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd,
      env: environment,
      encoding: "utf8"
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      stdout: typeof failure.stdout === "string" ? failure.stdout : "",
      stderr: typeof failure.stderr === "string" ? failure.stderr : failure.message ?? ""
    };
  }
}

async function runCompiledHook(entrypoint: string, hook: string, cwd: string, input: string): Promise<CliResult> {
  const environment = { ...process.env };
  delete environment.TASK_SYNC_STATE_DIR;
  delete environment.TASK_SYNC_WORKTREE_PATH;
  delete environment.TASK_SYNC_DEVICE_ID;
  delete environment.TASK_SYNC_AGENT_ID;
  environment.TASK_SYNC_CLI_PATH = cliPath;
  environment.PATH = `${join(process.cwd(), "node_modules", ".bin")}:${environment.PATH ?? ""}`;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint, hook], {
      cwd,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      const failure = error as NodeJS.ErrnoException;
      resolve({ exitCode: typeof failure.code === "number" ? failure.code : 1, stdout, stderr: stderr || failure.message });
    });
    child.once("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    child.stdin.end(input);
  });
}

function hookJson<T>(result: CliResult, label: string): T {
  assert.equal(result.exitCode, 0, `${label} failed: ${result.stderr || result.stdout}`);
  assert.equal(result.stderr, "", `${label} wrote unexpected stderr: ${result.stderr}`);
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, 1, `${label} must emit exactly one JSON line`);
  return JSON.parse(lines[0] ?? "") as T;
}

async function filesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  }));
  return nested.flat();
}

function json<T>(result: CliResult, label: string): T {
  assert.equal(result.exitCode, 0, `${label} failed: ${result.stderr || result.stdout}`);
  try {
    return JSON.parse(result.stdout) as T;
  } catch (error) {
    assert.fail(`${label} did not return JSON: ${(error as Error).message}\n${result.stdout}`);
  }
}

async function repositoryFixture(): Promise<RepositoryFixture> {
  const root = await mkdtemp(join(tmpdir(), "agent-task-sync-cli-dual-device-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const mac = join(root, "mac");
  const windows = join(root, "windows");
  await mkdir(seed, { recursive: true });
  await git(root, "init", "--bare", "-q", remote);
  await git(seed, "init", "-q", "-b", "main");
  await git(seed, "config", "user.email", "agent-task-sync@example.com");
  await git(seed, "config", "user.name", "Agent Task Sync Test");
  await writeFile(join(seed, "README.md"), "fixture\n", "utf8");
  await git(seed, "add", "README.md");
  await git(seed, "commit", "-q", "-m", "fixture");
  await git(seed, "remote", "add", "origin", remote);
  await git(seed, "push", "-q", "origin", "main");
  await git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
  await git(root, "clone", "-q", remote, mac);
  await git(root, "clone", "-q", remote, windows);
  for (const checkout of [mac, windows]) {
    await git(checkout, "config", "user.email", "agent-task-sync@example.com");
    await git(checkout, "config", "user.name", "Agent Task Sync Test");
  }
  return { root, remote, mac, windows };
}

test("CLI completes a dual-device continuation flow through a real Git remote", async () => {
  const fixture = await repositoryFixture();
  const macState = join(fixture.root, "mac-state");
  const windowsState = join(fixture.root, "windows-state");
  try {
    json(await runCli(fixture.mac, macState, "mac", "init", "my-project", "Agent Task Sync", "--json"), "Mac init");
    json(await runCli(
      fixture.mac,
      macState,
      "mac",
      "task",
      "create",
      "task-1",
      "实现跨设备接续",
      "--goal",
      "让下一台设备可以从事件和文档继续工作",
      "--acceptance",
      "可以恢复任务上下文",
      "--acceptance",
      "不会丢失并发事件",
      "--yes",
      "--json"
    ), "Mac task create");
    json(await runCli(fixture.mac, macState, "mac", "task", "use", "task-1", "--yes", "--json"), "Mac task use");
    json(await runCli(
      fixture.mac,
      macState,
      "mac",
      "checkpoint",
      "--task",
      "task-1",
      "--summary",
      "完成事件模型和 CLI 主链路",
      "--current-focus",
      "验证 Git 状态分支",
      "--recent-completed",
      "完成 reducer",
      "--next-action",
      "在 Windows 接受 handoff",
      "--file",
      "packages/domain/src/reducer.ts",
      "--uncommitted-change",
      "packages/sync-git/tests/dual-device.e2e.test.ts",
      "--verification",
      "[{\"command\":\"npm test\",\"result\":\"passed\",\"status\":\"passed\"}]",
      "--yes",
      "--json"
    ), "Mac checkpoint");
    const handoffState = json<{ handoff?: { id?: string } }>(await runCli(
      fixture.mac,
      macState,
      "mac",
      "handoff",
      "create",
      "--task",
      "task-1",
      "--completed",
      "完成事件模型和 CLI 主链路",
      "--incomplete",
      "在 Windows 接受 handoff",
      "--next-step",
      "运行 task-sync sync 后接受交接",
      "--file",
      "packages/domain/src/reducer.ts",
      "--test-summary",
      "npm test passed",
      "--target-agent",
      "claude-code",
      "--yes",
      "--json"
    ), "Mac handoff create");
    const handoffId = handoffState.handoff?.id;
    assert.ok(handoffId, "handoff create should return an ID");
    json(await runCli(fixture.mac, macState, "mac", "sync", "--json"), "Mac sync");

    json(await runCli(fixture.windows, windowsState, "windows", "init", "my-project", "Agent Task Sync", "--json"), "Windows init");
    json(await runCli(fixture.windows, windowsState, "windows", "sync", "--json"), "Windows sync");
    const windowsStatus = json<{ tasks: Array<{ id: string; title: string; handoff?: { id?: string } }> }>(
      await runCli(fixture.windows, windowsState, "windows", "status", "--json"),
      "Windows status"
    );
    assert.equal(windowsStatus.tasks[0]?.id, "task-1");
    assert.equal(windowsStatus.tasks[0]?.title, "实现跨设备接续");
    assert.equal(windowsStatus.tasks[0]?.handoff?.id, handoffId);

    const context = json<{ task: { id: string; goal: string }; markdown: string }>(
      await runCli(fixture.windows, windowsState, "windows", "context", "task-1", "--format", "json"),
      "Windows context"
    );
    assert.equal(context.task.id, "task-1");
    assert.match(context.task.goal, /下一台设备/);
    assert.match(context.markdown, /验证 Git 状态分支/);

    const accepted = json<{ status: string; ownership?: { deviceId?: string }; handoff?: { acceptedBy?: { deviceId?: string } } }>(
      await runCli(fixture.windows, windowsState, "windows", "handoff", "accept", "task-1", handoffId, "--yes", "--json"),
      "Windows handoff accept"
    );
    assert.equal(accepted.status, "in_progress");
    assert.equal(accepted.ownership?.deviceId, "windows");
    assert.equal(accepted.handoff?.acceptedBy?.deviceId, "windows");

    const checkpoint = json<{ status: string; currentFocus?: string; nextAction?: string }>(await runCli(
      fixture.windows,
      windowsState,
      "windows",
      "checkpoint",
      "--task",
      "task-1",
      "--summary",
      "已从 Mac 恢复并开始实现",
      "--current-focus",
      "补齐 Windows 测试",
      "--next-action",
      "提交双设备测试结果",
      "--yes",
      "--json"
    ), "Windows checkpoint");
    assert.equal(checkpoint.status, "in_progress");
    assert.equal(checkpoint.currentFocus, "补齐 Windows 测试");
    assert.equal(checkpoint.nextAction, "提交双设备测试结果");
    json(await runCli(fixture.windows, windowsState, "windows", "sync", "--json"), "Windows final sync");

    json(await runCli(fixture.mac, macState, "mac", "sync", "--json"), "Mac final sync");
    const macFinalStatus = json<{ tasks: Array<{ status: string; currentFocus?: string; nextAction?: string }> }>(
      await runCli(fixture.mac, macState, "mac", "status", "--json"),
      "Mac final status"
    );
    assert.equal(macFinalStatus.tasks[0]?.status, "in_progress");
    assert.equal(macFinalStatus.tasks[0]?.currentFocus, "补齐 Windows 测试");
    assert.equal(macFinalStatus.tasks[0]?.nextAction, "提交双设备测试结果");

    assert.match(await readFile(join(windowsState, ".task-sync", "tasks", "task-1", "task_plan.md"), "utf8"), /补齐 Windows 测试/);
    assert.match(await readFile(join(windowsState, ".task-sync", "tasks", "task-1", "handoff.md"), "utf8"), /接受者：claude-code \/ windows/);
    assert.equal(await git(fixture.mac, "status", "--porcelain"), "");
    assert.equal(await git(fixture.windows, "status", "--porcelain"), "");
    await assert.rejects(readFile(join(fixture.mac, ".task-sync", "tasks", "task-1", "task.yaml"), "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(join(fixture.windows, ".task-sync", "tasks", "task-1", "task.yaml"), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("compiled Codex and Pi hooks complete a same-Mac continuation loop", async () => {
  const fixture = await repositoryFixture();
  const stateWorktree = join(fixture.root, "mac-state");
  const codexCheckpoint = join(fixture.root, "codex-checkpoint.json");
  const codexHandoff = join(fixture.root, "codex-handoff.json");
  const piCheckpoint = join(fixture.root, "pi-checkpoint.json");
  const codexHook = fileURLToPath(new URL("../../../adapters/codex/dist/hook.js", import.meta.url));
  const piHook = fileURLToPath(new URL("../../../adapters/pi/dist/hook.js", import.meta.url));
  const hookEnvironment = (sessionId: string, extra: Record<string, string> = {}) => JSON.stringify({
    cwd: fixture.mac,
    ...extra,
    environment: {
      TASK_SYNC_WORKTREE_PATH: stateWorktree,
      TASK_SYNC_DEVICE_ID: "mac",
      TASK_SYNC_SESSION_ID: sessionId
    }
  });
  try {
    json(await runCli(fixture.mac, stateWorktree, "mac", "init", "my-project", "Agent Task Sync", "--json"), "Mac init");
    json(await runCli(
      fixture.mac,
      stateWorktree,
      "mac",
      "task",
      "create",
      "task-1",
      "实现 Mac 多 Agent 接续",
      "--goal",
      "让 Codex 和 Pi 在同一台 Mac 上接力完成任务",
      "--acceptance",
      "Pi 可以从 current-task 恢复上下文",
      "--yes",
      "--json"
    ), "Mac task create");
    json(await runCli(fixture.mac, stateWorktree, "mac", "task", "use", "task-1", "--yes", "--json"), "Mac task use");

    await writeFile(codexCheckpoint, JSON.stringify({
      taskId: "task-1",
      summary: "Codex 已完成状态链路",
      currentFocus: "等待 Pi 接受交接",
      recentCompleted: ["确认同 Mac 状态 worktree"],
      nextAction: "Pi 接受 handoff 并继续实现",
      filesRead: ["README.md"],
      filesChanged: ["packages/adapter-contract/src/adapter.ts"],
      verification: [{ command: "npm test", result: "passed", status: "passed" }]
    }), "utf8");
    const codexStop = hookJson<{ continue: true; hook: string; output?: string }>(await runCompiledHook(
      codexHook,
      "stop",
      fixture.mac,
      hookEnvironment("codex-hook", { taskId: "task-1", checkpointInputFile: codexCheckpoint, confirmed: true })
    ), "Codex checkpoint hook");
    assert.equal(codexStop.continue, true);
    assert.equal(codexStop.hook, "stop");

    await writeFile(codexHandoff, JSON.stringify({
      taskId: "task-1",
      goal: "让 Codex 和 Pi 在同一台 Mac 上接力完成任务",
      constraints: ["只同步任务状态，不同步完整聊天"],
      completedWork: ["Codex 已完成状态链路"],
      incompleteWork: ["Pi 接受 handoff 并继续实现"],
      blockedWork: [],
      keyDecisions: [{ decision: "使用共享 current-task 指针", reason: "避免 Agent 手工复制 taskId" }],
      knownErrors: [],
      nextStep: "运行 Pi checkpoint hook",
      criticalContext: ["同一 Mac 的 Codex 和 Pi 使用同一个状态 worktree"],
      filesRead: ["README.md"],
      filesChanged: ["packages/adapter-contract/src/adapter.ts"],
      relevantFiles: ["packages/adapter-contract/src/adapter.ts"],
      testSummary: "adapter contract passed",
      targetAgent: "pi"
    }), "utf8");
    const codexHandoffResult = hookJson<{ continue: true; hook: string; output?: string }>(await runCompiledHook(
      codexHook,
      "handoff",
      fixture.mac,
      hookEnvironment("codex-hook", { taskId: "task-1", handoffInputFile: codexHandoff, confirmed: true })
    ), "Codex handoff hook");
    assert.equal(codexHandoffResult.continue, true);
    assert.equal(codexHandoffResult.hook, "handoff");
    json(await runCli(fixture.mac, stateWorktree, "mac", "sync", "--json"), "Codex sync");

    const piSession = hookJson<{ continue: true; hook: string; output?: string }>(await runCompiledHook(
      piHook,
      "session_start",
      fixture.mac,
      hookEnvironment("pi-session")
    ), "Pi session start");
    assert.equal(piSession.continue, true);
    assert.equal(piSession.hook, "session_start");
    assert.match(piSession.output ?? "", /实现 Mac 多 Agent 接续/);
    assert.match(piSession.output ?? "", /Pi 接受 handoff/);

    const beforeAccept = json<{ tasks: Array<{ handoff?: { id?: string } }> }>(await runAgentCli(
      fixture.mac,
      stateWorktree,
      "mac",
      "pi",
      "status",
      "--json"
    ), "Pi status");
    const handoffId = beforeAccept.tasks[0]?.handoff?.id;
    assert.ok(handoffId, "Codex handoff should be visible to Pi");
    const accepted = json<{ status: string; ownership?: { agentId?: string; deviceId?: string } }>(await runAgentCli(
      fixture.mac,
      stateWorktree,
      "mac",
      "pi",
      "handoff",
      "accept",
      "task-1",
      handoffId,
      "--yes",
      "--json"
    ), "Pi handoff accept");
    assert.equal(accepted.status, "in_progress");
    assert.equal(accepted.ownership?.agentId, "pi");
    assert.equal(accepted.ownership?.deviceId, "mac");

    await writeFile(piCheckpoint, JSON.stringify({
      taskId: "task-1",
      summary: "Pi 已接续并完成验证",
      currentFocus: "确认 Codex 可以回读 Pi 的 checkpoint",
      recentCompleted: ["接受 Codex handoff"],
      nextAction: "Codex 回读当前上下文",
      filesRead: [".task-sync/tasks/task-1/handoff.md"],
      filesChanged: ["packages/adapter-contract/tests/adapter.test.ts"],
      verification: [{ command: "npm run typecheck", result: "passed", status: "passed" }]
    }), "utf8");
    const piStop = hookJson<{ continue: true; hook: string; output?: string }>(await runCompiledHook(
      piHook,
      "stop",
      fixture.mac,
      hookEnvironment("pi-hook", { taskId: "task-1", checkpointInputFile: piCheckpoint, confirmed: true })
    ), "Pi checkpoint hook");
    assert.equal(piStop.continue, true);
    assert.equal(piStop.hook, "stop");
    json(await runAgentCli(fixture.mac, stateWorktree, "mac", "pi", "sync", "--json"), "Pi sync");

    const codexSession = hookJson<{ continue: true; hook: string; output?: string }>(await runCompiledHook(
      codexHook,
      "session_start",
      fixture.mac,
      hookEnvironment("codex-session")
    ), "Codex session resume");
    assert.equal(codexSession.continue, true);
    assert.match(codexSession.output ?? "", /Pi 已接续并完成验证/);
    assert.match(codexSession.output ?? "", /Codex 回读当前上下文/);

    const eventDirectory = join(stateWorktree, ".task-sync", "tasks", "task-1", "events");
    const eventTexts = await Promise.all((await filesRecursively(eventDirectory)).filter((path) => path.endsWith(".jsonl")).map((path) => readFile(path, "utf8")));
    const events = eventTexts.flatMap((content) => content.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { writer: { agentId: string; deviceId: string } }));
    assert.ok(events.some((event) => event.writer.agentId === "codex"), "event log should include Codex writes");
    assert.ok(events.some((event) => event.writer.agentId === "pi"), "event log should include Pi writes");
    assert.equal(events.every((event) => event.writer.deviceId === "mac"), true);
    assert.equal(await git(fixture.mac, "branch", "--show-current"), "main\n");
    assert.equal(await git(fixture.mac, "status", "--porcelain"), "");
    const handoffDocument = await readFile(join(stateWorktree, ".task-sync", "tasks", "task-1", "handoff.md"), "utf8");
    for (const heading of ["## Goal", "## Constraints", "## Progress", "### Done", "### In Progress", "### Blocked", "## Decisions", "## Next Steps", "## Context"]) {
      assert.match(handoffDocument, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(handoffDocument, /不同步完整聊天/);
    assert.doesNotMatch(handoffDocument, /prompt|token/i);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
