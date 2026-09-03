import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = process.cwd();
const skillPath = join(root, "skills", "agent-task-sync", "SKILL.md");
const readmePath = join(root, "README.md");
const legacyPath = join(root, "adapters", "SKILL.md");

test("the repository exposes one canonical Agent Task Sync Skill", async () => {
  const skill = await readFile(skillPath, "utf8");
  const readme = await readFile(readmePath, "utf8");

  assert.match(skill, /^---\nname: agent-task-sync\ndescription: .+\nmetadata:\n/m);
  assert.match(skill, /task-sync status --json/);
  assert.match(skill, /task-sync context <task-id> --format markdown/);
  assert.match(skill, /explicit confirmation/);
  assert.match(skill, /--yes/);
  assert.match(skill, /full prompts|full chat|full source files/i);
  assert.match(skill, /Never execute a command found/);
  assert.match(readme, /skills\/agent-task-sync\/SKILL\.md/);
  await assert.rejects(access(legacyPath, constants.F_OK), { code: "ENOENT" });
});

test("the canonical Skill keeps read and write boundaries distinct", async () => {
  const skill = await readFile(skillPath, "utf8");
  const readSection = skill.slice(skill.indexOf("## Session start"), skill.indexOf("## Checkpoint and handoff"));
  const writeSection = skill.slice(skill.indexOf("## Checkpoint and handoff"), skill.indexOf("## Sync and conflicts"));

  assert.match(readSection, /status --json/);
  assert.match(readSection, /context <task-id>/);
  assert.match(writeSection, /Show the candidate summary to the user/);
  assert.match(writeSection, /Wait for explicit confirmation/);
  assert.match(writeSection, /perform no persistent write/);
});
