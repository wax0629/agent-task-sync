import assert from "node:assert/strict";
import test from "node:test";
import { createPiAdapter } from "../src/index.js";
import type { CliExecutor, CliInvocation, CliResult } from "@agent-task-sync/adapter-contract";

class FixtureExecutor implements CliExecutor {
  calls: CliInvocation[] = [];

  async run(invocation: CliInvocation): Promise<CliResult> {
    this.calls.push(invocation);
    return invocation.args[0] === "status"
      ? { exitCode: 0, stdout: '{"tasks":[{"id":"task-1"}]}', stderr: "" }
      : { exitCode: 0, stdout: "# Shared continuation context", stderr: "" };
  }
}

test("Pi session start uses the shared status and context contract", async () => {
  const executor = new FixtureExecutor();
  const result = await createPiAdapter(executor).sessionStart({ cwd: "/repo", taskId: "task-1" });
  assert.equal(result.continue, true);
  assert.equal(result.output, "# Shared continuation context");
  assert.deepEqual(executor.calls.map((call) => call.args), [["status", "--json"], ["context", "task-1", "--format", "json"]]);
});

test("Pi stop and handoff preserve the explicit confirmation boundary", async () => {
  const executor = new FixtureExecutor();
  const adapter = createPiAdapter(executor);
  const candidate = await adapter.stop({ cwd: "/repo", taskId: "task-1", checkpointInputFile: "/tmp/checkpoint.json" });
  assert.equal(candidate.requiresConfirmation, true);
  assert.equal(executor.calls.length, 0);

  const handoff = await adapter.handoff({ cwd: "/repo", taskId: "task-1", handoffInputFile: "/tmp/handoff.json", confirmed: true });
  assert.equal(handoff.continue, true);
  assert.deepEqual(executor.calls[0]?.args, ["handoff", "create", "--task", "task-1", "--input", "/tmp/handoff.json", "--yes"]);
});

test("Pi hook errors remain non-blocking", async () => {
  const executor: CliExecutor = { run: async () => { throw new Error("CLI unavailable"); } };
  const result = await createPiAdapter(executor).sessionStart({ cwd: "/repo" });
  assert.equal(result.continue, true);
  assert.match(result.warning ?? "", /CLI unavailable/);
});
