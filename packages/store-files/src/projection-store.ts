import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import type { ProjectionStore, RenderedDocuments } from "@agent-task-sync/application";
import { assertValidTaskState, type TaskState } from "@agent-task-sync/domain";
import { writeFileAtomically } from "./atomic.js";
import { taskDirectory } from "./paths.js";

export class FileProjectionStore implements ProjectionStore {
  constructor(public readonly rootDir: string) {}

  async writeTaskState(state: TaskState): Promise<void> {
    assertValidTaskState(state);
    await writeFileAtomically(join(taskDirectory(this.rootDir, state.id), "task.yaml"), stringify(state, { sortMapEntries: true }));
  }

  async writeMarkdown(taskId: string, documents: RenderedDocuments): Promise<void> {
    const directory = taskDirectory(this.rootDir, taskId);
    await writeFileAtomically(join(directory, "task_plan.md"), ensureLf(documents.taskPlan));
    await writeFileAtomically(join(directory, "progress.md"), ensureLf(documents.progress));
    if (documents.handoff !== undefined) await writeFileAtomically(join(directory, "handoff.md"), ensureLf(documents.handoff));
  }

  async readTaskState(taskId: string): Promise<TaskState | undefined> {
    try {
      const value: unknown = parse(await readFile(join(taskDirectory(this.rootDir, taskId), "task.yaml"), "utf8"));
      assertValidTaskState(value);
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}

function ensureLf(value: string): string {
  return `${value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n*$/, "")}\n`;
}
