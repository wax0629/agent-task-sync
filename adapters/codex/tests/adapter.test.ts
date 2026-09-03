import assert from "node:assert/strict";
import test from "node:test";
import { createCodexAdapter } from "../src/index.js";
import type { CliExecutor, CliInvocation, CliResult } from "@agent-task-sync/adapter-contract";

class FixtureExecutor implements CliExecutor {
  calls: CliInvocation[] = [];
  async run(invocation: CliInvocation): Promise<CliResult> {
    this.calls.push(invocation);
    return invocation.args[0] === "status"
      ? { exitCode: 0, stdout: '{"tasks":[{"id":"task-1"}]}', stderr: "" }
      : { exitCode: 0, stdout: "# 同一份接续上下文", stderr: "" };
  }
}

test("Codex session start reads the shared CLI context contract", async () => {
  const executor = new FixtureExecutor();
  const result = await createCodexAdapter(executor).sessionStart({ cwd: "/repo", taskId: "task-1" });
  assert.equal(result.continue, true);
  assert.equal(result.output, "# 同一份接续上下文");
  assert.deepEqual(executor.calls.map((call) => call.args), [["status", "--json"], ["context", "task-1", "--format", "json"]]);
});
