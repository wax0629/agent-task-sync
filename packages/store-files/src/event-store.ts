import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { EventStore } from "@agent-task-sync/application";
import { assertValidTaskEvent, type TaskEvent } from "@agent-task-sync/domain";
import { eventFile, taskDirectory } from "./paths.js";
import { writeFileAtomically } from "./atomic.js";

async function filesRecursively(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = `${root}/${entry.name}`;
      if (entry.isDirectory()) files.push(...await filesRecursively(path));
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
    }
    return files.sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function parseJsonl(content: string, file: string): TaskEvent[] {
  const events: TaskEvent[] = [];
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL at ${file}:${index + 1}: ${(error as Error).message}`);
    }
    try {
      assertValidTaskEvent(value);
    } catch (error) {
      throw new Error(`Invalid task event at ${file}:${index + 1}: ${(error as Error).message}`);
    }
    events.push(value);
  }
  return events;
}

export class FileEventStore implements EventStore {
  private readonly writes = new Map<string, Promise<void>>();

  constructor(public readonly rootDir: string) {}

  async append(event: TaskEvent): Promise<void> {
    assertValidTaskEvent(event);
    const path = eventFile(this.rootDir, event);
    const previous = this.writes.get(path) ?? Promise.resolve();
    const next = previous.then(async () => {
      let content = "";
      try {
        content = await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const existing = content ? parseJsonl(content, path) : [];
      if (existing.some((candidate) => candidate.eventId === event.eventId)) return;
      await mkdir(dirname(path), { recursive: true });
      const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n*$/, "");
      await writeFileAtomically(`${path}`, `${normalized ? `${normalized}\n` : ""}${JSON.stringify(event)}\n`);
    });
    this.writes.set(path, next);
    try {
      await next;
    } finally {
      if (this.writes.get(path) === next) this.writes.delete(path);
    }
  }

  async readTaskEvents(taskId: string): Promise<TaskEvent[]> {
    const files = await filesRecursively(`${taskDirectory(this.rootDir, taskId)}/events`);
    const events: TaskEvent[] = [];
    for (const file of files) events.push(...parseJsonl(await readFile(file, "utf8"), file));
    return events.sort((left, right) => left.eventId.localeCompare(right.eventId));
  }

  async readProjectEvents(projectId?: string): Promise<TaskEvent[]> {
    const tasksRoot = `${this.rootDir}/tasks`;
    const taskEntries = await readdir(tasksRoot, { withFileTypes: true }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const events: TaskEvent[] = [];
    for (const task of taskEntries) {
      if (!task.isDirectory()) continue;
      for (const event of await this.readTaskEvents(task.name)) {
        if (!projectId || event.projectId === projectId) events.push(event);
      }
    }
    return events.sort((left, right) => left.eventId.localeCompare(right.eventId));
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  static newEventId(): string {
    return randomUUID();
  }
}
