import assert from "node:assert/strict";
import test from "node:test";
import { checkpointInvocation, contextInvocation, createCliAgentAdapter, handoffInvocation, statusInvocation } from "../src/index.js";
import type { CliExecutor, CliInvocation, CliResult } from "../src/index.js";

class FakeExecutor implements CliExecutor {
  readonly calls: CliInvocation[] = [];
  constructor(private readonly response: CliResult | ((invocation: CliInvocation) => CliResult | Promise<CliResult>)) {}

  async run(invocation: CliInvocation): Promise<CliResult> {
    this.calls.push(invocation);
    if (typeof this.response === "function") return this.response(invocation);
    return this.response;
  }
}

const ok = (stdout = "{}"): CliResult => ({ exitCode: 0, stdout, stderr: "" });

test("CLI contract builds explicit, shell-free invocations", () => {
  assert.deepEqual(statusInvocation("/repo"), { executable: "task-sync", args: ["status", "--json"], cwd: "/repo" });
  assert.deepEqual(contextInvocation("task-1", "/repo"), { executable: "task-sync", args: ["context", "task-1", "--format", "json"], cwd: "/repo" });
  assert.deepEqual(checkpointInvocation({ taskId: "task-1", inputFile: "/tmp/checkpoint.json", confirmed: true }, "/repo").args, ["checkpoint", "--task", "task-1", "--input", "/tmp/checkpoint.json", "--yes"]);
  assert.deepEqual(handoffInvocation({ taskId: "task-1", inputFile: "/tmp/handoff.json" }, "/repo").args, ["handoff", "create", "--task", "task-1", "--input", "/tmp/handoff.json"]);
});

test("session start reads status and context through the same CLI contract", async () => {
  const executor = new FakeExecutor((invocation) => invocation.args[0] === "status" ? ok('{"tasks":[{"id":"task-1"}]}') : ok("# Continuation"));
  const adapter = createCliAgentAdapter({ name: "codex", executor });
  const result = await adapter.sessionStart({ cwd: "/repo", taskId: "task-1" });
  assert.equal(result.continue, true);
  assert.equal(result.output, "# Continuation");
  assert.deepEqual(executor.calls.map((call) => call.args), [["status", "--json"], ["context", "task-1", "--format", "json"]]);
});

test("unconfirmed stop only returns a candidate and never invokes a write", async () => {
  const executor = new FakeExecutor(ok("written"));
  const adapter = createCliAgentAdapter({ name: "claude-code", executor });
  const result = await adapter.stop({ cwd: "/repo", taskId: "task-1", checkpointInputFile: "/tmp/checkpoint.json" });
  assert.equal(result.continue, true);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(executor.calls.length, 0);
  assert.equal(result.invocations[0]?.args.includes("--yes"), false);
});

test("confirmed stop invokes checkpoint and hook failures remain non-blocking", async () => {
  const executor = new FakeExecutor(async () => { throw new Error("CLI unavailable"); });
  const adapter = createCliAgentAdapter({ name: "codex", executor });
  const result = await adapter.stop({ cwd: "/repo", taskId: "task-1", checkpointInputFile: "/tmp/checkpoint.json", confirmed: true });
  assert.equal(result.continue, true);
  assert.match(result.warning ?? "", /CLI unavailable/);
  assert.equal(executor.calls.length, 1);
  assert.equal(executor.calls[0]?.args.at(-1), "--yes");
});

test("handoff follows the same confirmation boundary as checkpoint", async () => {
  const executor = new FakeExecutor(ok("written"));
  const adapter = createCliAgentAdapter({ name: "claude-code", executor });
  const candidate = await adapter.handoff({ cwd: "/repo", taskId: "task-1", handoffInputFile: "/tmp/handoff.json" });
  assert.equal(candidate.requiresConfirmation, true);
  assert.equal(executor.calls.length, 0);
  const accepted = await adapter.handoff({ cwd: "/repo", taskId: "task-1", handoffInputFile: "/tmp/handoff.json", confirmed: true });
  assert.equal(accepted.continue, true);
  assert.equal(executor.calls.length, 1);
  assert.deepEqual(executor.calls[0]?.args, ["handoff", "create", "--task", "task-1", "--input", "/tmp/handoff.json", "--yes"]);
});
