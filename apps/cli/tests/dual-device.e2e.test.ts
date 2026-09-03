import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const environment = { ...process.env };
  delete environment.TASK_SYNC_STATE_DIR;
  environment.TASK_SYNC_WORKTREE_PATH = stateWorktree;
  environment.TASK_SYNC_DEVICE_ID = deviceId;
  environment.TASK_SYNC_AGENT_ID = deviceId === "mac" ? "codex" : "claude-code";
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
