#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApplicationService,
  ConfirmationRequiredError,
  ConflictNotFoundError,
  EmptyTaskUpdateError,
  HandoffAlreadyExistsError,
  HandoffNotFoundError,
  InvalidConflictResolutionError,
  type BlockTaskInput,
  type CheckpointInput,
  type CompleteTaskInput,
  type DecisionInput,
  type ErrorInput,
  type HandoffInput,
  type ProjectStatus,
  type QuestionInput,
  type UpdateTaskInput,
  type VerificationInput
} from "@agent-task-sync/application";
import type { AcceptanceCriterion, PhaseState, TaskStatus, VerificationResult } from "@agent-task-sync/domain";
import { GitSyncError, GitTextConflictError, NoRemoteError } from "@agent-task-sync/sync-git";
import { ExitCode } from "./exit-codes.js";
import { filterTasks, formatConflicts, formatContext, formatDoctor, formatHandoffCheck, formatRebuild, formatStatus, formatSync, formatTask, formatTaskList, type ConflictListEntry, type TaskAttention } from "./format.js";
import { createRuntime, inspectRuntime } from "./runtime.js";

interface ParsedArgs {
  command?: string;
  args: string[];
  options: Map<string, string[]>;
  json: boolean;
  format?: "markdown" | "json";
}

class CliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliInputError";
  }
}

class UninitializedError extends Error {
  constructor() {
    super("项目尚未初始化，请先运行 task-sync init。");
    this.name = "UninitializedError";
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: string[] = [];
  const options = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args.push(value);
      continue;
    }
    const raw = value.slice(2);
    if (!raw) throw new CliInputError("不支持空选项。");
    const separator = raw.indexOf("=");
    const name = separator >= 0 ? raw.slice(0, separator) : raw;
    let optionValue = separator >= 0 ? raw.slice(separator + 1) : "true";
    if (separator < 0 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      optionValue = argv[index + 1];
      index += 1;
    }
    const values = options.get(name) ?? [];
    values.push(optionValue);
    options.set(name, values);
  }
  const format = option(options, "format");
  if (format !== undefined && format !== "markdown" && format !== "json") {
    throw new CliInputError("--format 只能是 markdown 或 json。");
  }
  return {
    command: args[0],
    args: args.slice(1),
    options,
    json: hasOption(options, "json"),
    format: format as ParsedArgs["format"]
  };
}

function option(options: Map<string, string[]>, name: string): string | undefined {
  const values = options.get(name);
  return values?.[values.length - 1];
}

function hasOption(options: Map<string, string[]>, name: string): boolean {
  return options.has(name);
}

function isEnabled(options: Map<string, string[]>, name: string): boolean {
  return option(options, name) === "true";
}

function optionValues(options: Map<string, string[]>, ...names: string[]): string[] {
  return names.flatMap((name) => options.get(name) ?? []);
}

function ensureAllowed(parsed: ParsedArgs, names: readonly string[]): void {
  const allowed = new Set(["json", "format", ...names]);
  for (const name of parsed.options.keys()) {
    if (!allowed.has(name)) throw new CliInputError(`不支持选项：--${name}`);
  }
}

function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new CliInputError(`缺少${label}。`);
  return value.trim();
}

function requireYes(parsed: ParsedArgs): void {
  if (!isEnabled(parsed.options, "yes")) throw new CliInputError("写入操作需要显式确认，请添加 --yes。");
}

function statusValue(value: string | undefined): TaskStatus | undefined {
  if (value === undefined) return undefined;
  const allowed: TaskStatus[] = ["planned", "in_progress", "blocked", "needs_review", "handoff_ready", "completed", "archived"];
  if (!allowed.includes(value as TaskStatus)) throw new CliInputError(`无效任务状态：${value}`);
  return value as TaskStatus;
}

function attentionValue(value: string | undefined): TaskAttention | undefined {
  if (value === undefined) return undefined;
  const allowed: TaskAttention[] = ["active", "handoff", "blocked", "conflict", "unsynced"];
  if (!allowed.includes(value as TaskAttention)) throw new CliInputError(`无效待处理筛选：${value}，可选 active、handoff、blocked、conflict、unsynced。`);
  return value as TaskAttention;
}

function parseJsonValue(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new CliInputError(`${label} 不是有效 JSON：${(error as Error).message}`);
  }
}

function stringList(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new CliInputError(`${label} 必须是字符串数组。`);
  return value.map((item) => item.trim()).filter(Boolean);
}

function optionList(parsed: ParsedArgs, names: string[]): string[] | undefined {
  const values = optionValues(parsed.options, ...names);
  return values.length ? values : undefined;
}

function mergeList(input: unknown, cli: string[] | undefined, label: string): string[] | undefined {
  if (cli !== undefined) return cli.map((value) => value.trim()).filter(Boolean);
  return stringList(input, label);
}

function objectInput(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CliInputError(`${label} 必须是 JSON 对象。`);
  return value as Record<string, unknown>;
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const text = path === "-" ? await readStdin() : await readFile(resolve(path), "utf8");
  return objectInput(parseJsonValue(text, path), path);
}

async function readStdin(): Promise<string> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk.toString();
  return text;
}

function inputString(input: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") throw new CliInputError(`${key} 必须是字符串。`);
    return value;
  }
  return undefined;
}

function optionalString(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new CliInputError(`${label} 必须是字符串或 null。`);
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new CliInputError(`${label} 必须是布尔值。`);
}

function conflictChoice(value: string | undefined): "keep_first" | "keep_last" | "merge" {
  if (value === "keep_first" || value === "keep_last" || value === "merge") return value;
  throw new CliInputError("冲突选择必须是 keep_first、keep_last 或 merge。");
}

function inputValue(input: Record<string, unknown>, ...keys: string[]): unknown {
  return keys.map((key) => input[key]).find((value) => value !== undefined);
}

function normalizeVerification(value: unknown, label: string): VerificationResult[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new CliInputError(`${label} 必须是数组。`);
  return value.map((item, index) => {
    const record = objectInput(item, `${label}[${index}]`);
    const command = required(typeof record.command === "string" ? record.command : undefined, `${label}[${index}].command`);
    const result = typeof record.result === "string" ? record.result : "";
    const status = record.status;
    if (status !== "passed" && status !== "failed" && status !== "skipped") throw new CliInputError(`${label}[${index}].status 无效。`);
    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id : `verification-input-${index + 1}`,
      command,
      result,
      status,
      checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date().toISOString()
    };
  });
}

function normalizeCriteria(values: string[] | undefined): AcceptanceCriterion[] | undefined {
  return values?.map((text, index) => ({ id: `criterion-${index + 1}`, text, completed: false }));
}

function normalizeInputCriteria(value: unknown): AcceptanceCriterion[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return normalizeCriteria(stringList(value, "acceptanceCriteria"));
  if (value.every((item) => typeof item === "string")) return normalizeCriteria(value as string[]);
  return value.map((item, index) => {
    const record = objectInput(item, `acceptanceCriteria[${index}]`);
    return {
      id: required(typeof record.id === "string" ? record.id : undefined, `acceptanceCriteria[${index}].id`),
      text: required(typeof record.text === "string" ? record.text : undefined, `acceptanceCriteria[${index}].text`),
      completed: typeof record.completed === "boolean" ? record.completed : false
    };
  });
}

function normalizePhases(value: unknown): PhaseState[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new CliInputError("phases 必须是数组。");
  return value.map((item, index) => {
    const record = objectInput(item, `phases[${index}]`);
    const phaseStatus = record.status;
    if (phaseStatus !== undefined && phaseStatus !== "planned" && phaseStatus !== "in_progress" && phaseStatus !== "blocked" && phaseStatus !== "completed") {
      throw new CliInputError(`phases[${index}].status 无效。`);
    }
    return {
      id: required(typeof record.id === "string" ? record.id : undefined, `phases[${index}].id`),
      order: typeof record.order === "number" ? record.order : index + 1,
      title: required(typeof record.title === "string" ? record.title : undefined, `phases[${index}].title`),
      status: phaseStatus ?? "planned",
      goal: typeof record.goal === "string" ? record.goal : undefined,
      criteria: typeof record.criteria === "string" ? record.criteria : undefined
    };
  });
}

function currentTaskPath(root: string): string {
  return join(root, "current-task");
}

async function saveCurrentTask(root: string, taskId: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(currentTaskPath(root), `${taskId}\n`, "utf8");
}

async function loadCurrentTask(root: string): Promise<string | undefined> {
  try {
    const value = (await readFile(currentTaskPath(root), "utf8")).trim();
    return value || undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function print(value: unknown, json: boolean, text: string): void {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n`);
}

async function requireProject(app: ApplicationService): Promise<ProjectStatus> {
  const status = await app.status();
  if (!status.project) throw new UninitializedError();
  return status;
}

function taskIdFrom(parsed: ParsedArgs, input: Record<string, unknown> = {}, positionalIndex = 0): string {
  return required(option(parsed.options, "task") ?? parsed.args[positionalIndex] ?? inputString(input, "taskId", "task_id"), "任务 ID");
}

async function runTaskCreate(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "project", "title", "goal", "background", "acceptance", "phases", "status", "input", "task"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  const projectStatus = await requireProject(runtime.app);
  const projectId = required(option(parsed.options, "project") ?? inputString(input, "projectId", "project_id") ?? projectStatus.project?.projectId, "项目 ID");
  const taskId = required(parsed.args[0] ?? option(parsed.options, "task") ?? inputString(input, "taskId", "task_id"), "任务 ID");
  const title = required(parsed.args[1] ?? option(parsed.options, "title") ?? inputString(input, "title"), "任务标题");
  const goal = required(option(parsed.options, "goal") ?? inputString(input, "goal"), "任务目标");
  const acceptanceValue = optionList(parsed, ["acceptance"]);
  const acceptanceCriteria = acceptanceValue
    ? normalizeCriteria(acceptanceValue)
    : normalizeInputCriteria(inputValue(input, "acceptanceCriteria", "acceptance_criteria"));
  const phases = option(parsed.options, "phases") ? normalizePhases(parseJsonValue(required(option(parsed.options, "phases"), "phases"), "phases")) : normalizePhases(inputValue(input, "phases"));
  const state = await runtime.app.createTask({
    projectId,
    taskId,
    title,
    goal,
    background: option(parsed.options, "background") ?? inputString(input, "background"),
    acceptanceCriteria,
    phases,
    status: statusValue(option(parsed.options, "status") ?? inputString(input, "status")),
    confirmed: true
  }, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, state.id);
  print(state, parsed.json, formatTask(state));
  return ExitCode.ok;
}

async function runTaskUse(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "phase", "release"]);
  requireYes(parsed);
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed);
  const state = await runtime.app.claimTask({
    taskId,
    phaseId: option(parsed.options, "phase"),
    released: isEnabled(parsed.options, "release"),
    confirmed: true
  }, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, `已选择任务：${state.title}`);
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskUpdate(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, [
    "yes",
    "task",
    "input",
    "title",
    "goal",
    "background",
    "clear-background",
    "status",
    "current-focus",
    "clear-current-focus",
    "recent-completed",
    "next-action",
    "clear-next-action",
    "acceptance",
    "phases",
    "current-phase",
    "clear-current-phase"
  ]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const update: UpdateTaskInput = { taskId, confirmed: true };
  const title = option(parsed.options, "title") ?? inputString(input, "title");
  const goal = option(parsed.options, "goal") ?? inputString(input, "goal");
  const background = hasOption(parsed.options, "clear-background")
    ? null
    : optionalString(option(parsed.options, "background") ?? inputValue(input, "background"), "background");
  const currentFocus = hasOption(parsed.options, "clear-current-focus")
    ? null
    : optionalString(option(parsed.options, "current-focus") ?? inputValue(input, "currentFocus", "current_focus"), "currentFocus");
  const nextAction = hasOption(parsed.options, "clear-next-action")
    ? null
    : optionalString(option(parsed.options, "next-action") ?? inputValue(input, "nextAction", "next_action"), "nextAction");
  const currentPhaseId = hasOption(parsed.options, "clear-current-phase")
    ? null
    : optionalString(option(parsed.options, "current-phase") ?? inputValue(input, "currentPhaseId", "current_phase_id"), "currentPhaseId");
  const acceptanceValue = optionList(parsed, ["acceptance"]);
  const acceptanceCriteria = acceptanceValue
    ? normalizeCriteria(acceptanceValue)
    : normalizeInputCriteria(inputValue(input, "acceptanceCriteria", "acceptance_criteria"));
  const phases = option(parsed.options, "phases")
    ? normalizePhases(parseJsonValue(required(option(parsed.options, "phases"), "phases"), "phases"))
    : normalizePhases(inputValue(input, "phases"));
  const recentCompleted = mergeList(inputValue(input, "recentCompleted", "recent_completed"), optionList(parsed, ["recent-completed"]), "recentCompleted");
  if (title !== undefined) update.title = required(title, "任务标题");
  if (goal !== undefined) update.goal = required(goal, "任务目标");
  if (background !== undefined) update.background = background;
  if (currentFocus !== undefined) update.currentFocus = currentFocus;
  if (nextAction !== undefined) update.nextAction = nextAction;
  if (currentPhaseId !== undefined) update.currentPhaseId = currentPhaseId;
  if (acceptanceCriteria !== undefined) update.acceptanceCriteria = acceptanceCriteria;
  if (phases !== undefined) update.phases = phases;
  if (recentCompleted !== undefined) update.recentCompleted = recentCompleted;
  const status = statusValue(option(parsed.options, "status") ?? inputString(input, "status"));
  if (status !== undefined) update.status = status;
  const state = await runtime.app.updateTask(update, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskBlock(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "reason"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const block: BlockTaskInput = {
    taskId,
    reason: option(parsed.options, "reason") ?? inputString(input, "reason"),
    confirmed: true
  };
  const state = await runtime.app.blockTask(block, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskComplete(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "summary"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const complete: CompleteTaskInput = {
    taskId,
    summary: option(parsed.options, "summary") ?? inputString(input, "summary"),
    confirmed: true
  };
  const state = await runtime.app.completeTask(complete, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskDecision(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "decision", "reason"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const decision: DecisionInput = {
    taskId,
    decision: required(option(parsed.options, "decision") ?? inputString(input, "decision"), "决策内容"),
    reason: option(parsed.options, "reason") ?? inputString(input, "reason"),
    confirmed: true
  };
  const state = await runtime.app.recordDecision(decision, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskQuestion(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "question", "answer", "resolved"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const resolved = optionalBoolean(option(parsed.options, "resolved") ?? inputValue(input, "resolved"), "resolved");
  const question: QuestionInput = {
    taskId,
    question: required(option(parsed.options, "question") ?? inputString(input, "question"), "问题内容"),
    answer: option(parsed.options, "answer") ?? inputString(input, "answer"),
    resolved,
    confirmed: true
  };
  const state = await runtime.app.recordQuestion(question, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskError(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "error", "attempts", "resolved"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const resolved = optionalBoolean(option(parsed.options, "resolved") ?? inputValue(input, "resolved"), "resolved");
  const error: ErrorInput = {
    taskId,
    error: required(option(parsed.options, "error") ?? inputString(input, "error"), "错误内容"),
    attempts: option(parsed.options, "attempts") ?? inputString(input, "attempts"),
    resolved,
    confirmed: true
  };
  const state = await runtime.app.recordError(error, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runTaskVerify(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "command", "result", "status"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const status = option(parsed.options, "status") ?? inputString(input, "status");
  if (status !== "passed" && status !== "failed" && status !== "skipped") throw new CliInputError("验证状态必须是 passed、failed 或 skipped。");
  const verification: VerificationInput = {
    taskId,
    command: required(option(parsed.options, "command") ?? inputString(input, "command"), "验证命令"),
    result: option(parsed.options, "result") ?? inputString(input, "result") ?? "",
    status,
    confirmed: true
  };
  const state = await runtime.app.recordVerification(verification, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runConflicts(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["task"]);
  if (parsed.args.length > 1) throw new CliInputError("usage: task-sync conflicts [<task-id>] [--json]");
  const status = await requireProject(runtime.app);
  const requestedTaskId = option(parsed.options, "task") ?? parsed.args[0];
  if (requestedTaskId && !status.tasks.some((task) => task.id === requestedTaskId)) {
    throw new CliInputError(`任务不存在：${requestedTaskId}`);
  }
  const conflicts: ConflictListEntry[] = status.tasks
    .filter((task) => !requestedTaskId || task.id === requestedTaskId)
    .flatMap((task) => task.conflicts
      .filter((conflict) => !conflict.resolved)
      .map((conflict) => ({ ...conflict, taskTitle: task.title, taskStatus: task.status })));
  print({ conflicts }, parsed.json, formatConflicts(conflicts));
  return conflicts.length ? ExitCode.conflict : ExitCode.ok;
}

async function runConflictResolve(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "conflict", "input", "choice", "resolved-event-id", "summary", "status", "next-action", "clear-next-action"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const conflictId = required(option(parsed.options, "conflict") ?? parsed.args[1] ?? inputString(input, "conflictId", "conflict_id"), "冲突 ID");
  const choice = conflictChoice(option(parsed.options, "choice") ?? inputString(input, "choice"));
  const resolvedEventIds = mergeList(
    inputValue(input, "resolvedEventIds", "resolved_event_ids"),
    optionList(parsed, ["resolved-event-id"]),
    "resolvedEventIds"
  );
  if (!resolvedEventIds?.length) throw new CliInputError("缺少竞争事件 ID，请重复传入 --resolved-event-id 或在 JSON 中提供 resolvedEventIds。");
  const nextActionInput = inputValue(input, "nextAction", "next_action");
  const nextAction = hasOption(parsed.options, "clear-next-action")
    ? null
    : optionalString(option(parsed.options, "next-action") ?? nextActionInput, "nextAction");
  const resolution = {
    taskId,
    conflictId,
    choice,
    resolvedEventIds,
    summary: option(parsed.options, "summary") ?? inputString(input, "summary"),
    status: statusValue(option(parsed.options, "status") ?? inputString(input, "status")),
    nextAction,
    confirmed: true
  };
  const state = await runtime.app.resolveConflict(resolution, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runCheckpoint(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "summary", "current-focus", "recent-completed", "next-action", "clear-next-action", "file", "files", "commit", "verification", "uncommitted-change", "uncommitted", "status"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const files = optionList(parsed, ["file", "files"]);
  const uncommitted = optionList(parsed, ["uncommitted-change", "uncommitted"]);
  const verificationInput = option(parsed.options, "verification")
    ? parseJsonValue(required(option(parsed.options, "verification"), "verification"), "verification")
    : inputValue(input, "verification");
  const nextActionInput = inputValue(input, "nextAction", "next_action");
  if (nextActionInput !== undefined && nextActionInput !== null && typeof nextActionInput !== "string") throw new CliInputError("nextAction 必须是字符串或 null。");
  const checkpoint: CheckpointInput = {
    taskId,
    summary: option(parsed.options, "summary") ?? inputString(input, "summary"),
    currentFocus: option(parsed.options, "current-focus") ?? inputString(input, "currentFocus", "current_focus"),
    recentCompleted: mergeList(inputValue(input, "recentCompleted", "recent_completed"), optionList(parsed, ["recent-completed"]), "recentCompleted"),
    nextAction: hasOption(parsed.options, "clear-next-action") ? null : option(parsed.options, "next-action") ?? nextActionInput,
    filesChanged: mergeList(inputValue(input, "filesChanged", "files_changed"), files, "filesChanged"),
    commit: option(parsed.options, "commit") ?? inputString(input, "commit"),
    verification: normalizeVerification(verificationInput, "verification"),
    uncommittedChanges: mergeList(inputValue(input, "uncommittedChanges", "uncommitted_changes"), uncommitted, "uncommittedChanges"),
    status: statusValue(option(parsed.options, "status") ?? inputString(input, "status")),
    confirmed: true
  };
  const state = await runtime.app.recordCheckpoint(checkpoint, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

function decisionList(value: unknown, label: string): Array<{ decision: string; reason?: string }> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new CliInputError(`${label} 必须是数组。`);
  return value.map((item, index) => {
    const record = objectInput(item, `${label}[${index}]`);
    return {
      decision: required(typeof record.decision === "string" ? record.decision : undefined, `${label}[${index}].decision`),
      reason: typeof record.reason === "string" ? record.reason : undefined
    };
  });
}

function errorList(value: unknown, label: string): Array<{ error: string; attempts?: string }> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new CliInputError(`${label} 必须是数组。`);
  return value.map((item, index) => {
    const record = objectInput(item, `${label}[${index}]`);
    return {
      error: required(typeof record.error === "string" ? record.error : undefined, `${label}[${index}].error`),
      attempts: typeof record.attempts === "string" ? record.attempts : undefined
    };
  });
}

async function runHandoffCreate(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "input", "handoff-id", "completed", "incomplete", "next-step", "file", "files", "test-summary", "target-agent", "decisions", "errors"]);
  requireYes(parsed);
  const input = option(parsed.options, "input") ? await readJsonObject(required(option(parsed.options, "input"), "输入文件")) : {};
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed, input);
  const decisions = option(parsed.options, "decisions") ? decisionList(parseJsonValue(required(option(parsed.options, "decisions"), "decisions"), "decisions"), "decisions") : decisionList(inputValue(input, "keyDecisions", "key_decisions"), "keyDecisions");
  const errors = option(parsed.options, "errors") ? errorList(parseJsonValue(required(option(parsed.options, "errors"), "errors"), "errors"), "errors") : errorList(inputValue(input, "knownErrors", "known_errors"), "knownErrors");
  const nextStepInput = inputValue(input, "nextStep", "next_step");
  if (nextStepInput !== undefined && nextStepInput !== null && typeof nextStepInput !== "string") throw new CliInputError("nextStep 必须是字符串或 null。");
  const handoff: HandoffInput = {
    taskId,
    handoffId: option(parsed.options, "handoff-id") ?? inputString(input, "handoffId", "handoff_id"),
    completedWork: mergeList(inputValue(input, "completedWork", "completed_work"), optionList(parsed, ["completed"]), "completedWork"),
    incompleteWork: mergeList(inputValue(input, "incompleteWork", "incomplete_work"), optionList(parsed, ["incomplete"]), "incompleteWork"),
    keyDecisions: decisions,
    knownErrors: errors,
    nextStep: option(parsed.options, "next-step") ?? nextStepInput,
    relevantFiles: mergeList(inputValue(input, "relevantFiles", "relevant_files"), optionList(parsed, ["file", "files"]), "relevantFiles"),
    testSummary: option(parsed.options, "test-summary") ?? inputString(input, "testSummary", "test_summary"),
    targetAgent: option(parsed.options, "target-agent") ?? inputString(input, "targetAgent", "target_agent"),
    confirmed: true
  };
  const state = await runtime.app.createHandoff(handoff, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runHandoffAccept(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["yes", "task", "handoff-id"]);
  requireYes(parsed);
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed);
  const handoffId = required(option(parsed.options, "handoff-id") ?? parsed.args[1], "Handoff ID");
  const state = await runtime.app.acceptHandoff({ taskId, handoffId, confirmed: true }, { ...runtime.actor(), confirmed: true });
  await saveCurrentTask(runtime.root, taskId);
  print(state, parsed.json, formatTask(state));
  return state.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : ExitCode.ok;
}

async function runHandoffCheck(parsed: ParsedArgs, runtime: ReturnType<typeof createRuntime>): Promise<number> {
  ensureAllowed(parsed, ["task"]);
  await requireProject(runtime.app);
  const taskId = taskIdFrom(parsed);
  const check = await runtime.app.checkHandoff(taskId);
  print(check, parsed.json, formatHandoffCheck(check));
  return check.blockers.some((blocker) => blocker.includes("冲突")) ? ExitCode.conflict : ExitCode.ok;
}

async function runCommand(argv: readonly string[], cwd: string): Promise<number> {
  const parsed = parseArgs(argv);
  const runtime = createRuntime(cwd);
  if (parsed.command === "init") {
    ensureAllowed(parsed, ["project", "name", "remote", "default-branch"]);
    if (parsed.args.length > 2) throw new CliInputError("usage: task-sync init [project-id] [project-name]");
    const projectId = required(parsed.args[0] ?? option(parsed.options, "project") ?? basename(cwd), "项目 ID");
    const name = parsed.args[1] ?? option(parsed.options, "name") ?? projectId;
    if (typeof runtime.sync.initialize === "function") await runtime.sync.initialize();
    const project = await runtime.app.init({
      projectId,
      name,
      rootPath: cwd,
      remoteUrl: option(parsed.options, "remote") ?? runtime.metadata.remoteUrl,
      defaultBranch: option(parsed.options, "default-branch") ?? runtime.metadata.defaultBranch ?? "main"
    });
    await runtime.app.rebuild();
    if (typeof runtime.sync.initialize === "function") {
      try {
        await runtime.sync.push();
      } catch (error) {
        if (!(error instanceof NoRemoteError)) throw error;
      }
    }
    print(project, parsed.json, `已初始化项目：${project.name}`);
    return ExitCode.ok;
  }
  if (parsed.command === "status") {
    ensureAllowed(parsed, []);
    const status = await runtime.app.status();
    if (!status.project) {
      print(status, parsed.json, formatStatus(status));
      return ExitCode.uninitialized;
    }
    print(status, parsed.json, formatStatus(status));
    return status.sync.conflict ? ExitCode.conflict : status.sync.remoteAhead ? ExitCode.needsSync : ExitCode.ok;
  }
  if (parsed.command === "doctor") {
    ensureAllowed(parsed, []);
    const report = await inspectRuntime(runtime);
    print(report, parsed.json, formatDoctor(report));
    return report.ok ? ExitCode.ok : ExitCode.uninitialized;
  }
  if (parsed.command === "conflicts") return runConflicts(parsed, runtime);
  if (parsed.command === "conflict") {
    const subcommand = parsed.args[0];
    const nested: ParsedArgs = { ...parsed, args: parsed.args.slice(1) };
    if (subcommand === "resolve") return runConflictResolve(nested, runtime);
    throw new CliInputError("usage: task-sync conflict resolve <task-id> <conflict-id> ...");
  }
  if (parsed.command === "task") {
    const subcommand = parsed.args[0];
    const nested: ParsedArgs = { ...parsed, args: parsed.args.slice(1) };
    if (subcommand === "create") return runTaskCreate(nested, runtime);
    if (subcommand === "list") {
      ensureAllowed(nested, ["status", "attention"]);
      const status = await requireProject(runtime.app);
      const tasks = filterTasks(status.tasks, {
        status: statusValue(option(nested.options, "status")),
        attention: attentionValue(option(nested.options, "attention"))
      });
      print(tasks, nested.json, formatTaskList(tasks));
      return tasks.some((task) => task.conflicts.some((conflict) => !conflict.resolved)) ? ExitCode.conflict : ExitCode.ok;
    }
    if (subcommand === "use") return runTaskUse(nested, runtime);
    if (subcommand === "update") return runTaskUpdate(nested, runtime);
    if (subcommand === "block") return runTaskBlock(nested, runtime);
    if (subcommand === "complete") return runTaskComplete(nested, runtime);
    if (subcommand === "decision") return runTaskDecision(nested, runtime);
    if (subcommand === "question") return runTaskQuestion(nested, runtime);
    if (subcommand === "error") return runTaskError(nested, runtime);
    if (subcommand === "verify") return runTaskVerify(nested, runtime);
    throw new CliInputError("usage: task-sync task create|list|use|update|block|complete|decision|question|error|verify");
  }
  if (parsed.command === "context") {
    ensureAllowed(parsed, ["task"]);
    const taskId = required(option(parsed.options, "task") ?? parsed.args[0] ?? await loadCurrentTask(runtime.root), "任务 ID");
    await requireProject(runtime.app);
    const context = await runtime.app.getContext(taskId);
    if (parsed.format === "json" || parsed.json) print(context, true, "");
    else print(context, false, formatContext(context));
    return context.task.conflicts.some((conflict) => !conflict.resolved) ? ExitCode.conflict : context.warning ? ExitCode.needsSync : ExitCode.ok;
  }
  if (parsed.command === "checkpoint") return runCheckpoint(parsed, runtime);
  if (parsed.command === "handoff") {
    const subcommand = parsed.args[0];
    const nested: ParsedArgs = { ...parsed, args: parsed.args.slice(1) };
    if (subcommand === "create") return runHandoffCreate(nested, runtime);
    if (subcommand === "accept") return runHandoffAccept(nested, runtime);
    if (subcommand === "check") return runHandoffCheck(nested, runtime);
    throw new CliInputError("usage: task-sync handoff create|accept|check");
  }
  if (parsed.command === "rebuild") {
    ensureAllowed(parsed, ["task"]);
    await requireProject(runtime.app);
    const result = await runtime.app.rebuild(option(parsed.options, "task") ?? parsed.args[0]);
    print(result, parsed.json, formatRebuild(result));
    return result.states.some((state) => state.conflicts.some((conflict) => !conflict.resolved)) ? ExitCode.conflict : ExitCode.ok;
  }
  if (parsed.command === "sync") {
    ensureAllowed(parsed, []);
    await requireProject(runtime.app);
    const result = await runtime.app.sync();
    print(result, parsed.json, formatSync(result));
    return result.inspection.conflict ? ExitCode.conflict : ExitCode.ok;
  }
  throw new CliInputError("usage: task-sync init|status|task|conflicts|conflict|context|checkpoint|handoff|rebuild|sync|doctor");
}

function errorCode(error: unknown): number {
  if (error instanceof UninitializedError) return ExitCode.uninitialized;
  if (error instanceof GitTextConflictError) return ExitCode.conflict;
  if (error instanceof NoRemoteError || error instanceof GitSyncError) return ExitCode.gitFailure;
  if (error instanceof ConfirmationRequiredError || error instanceof CliInputError || error instanceof EmptyTaskUpdateError || error instanceof HandoffNotFoundError || error instanceof HandoffAlreadyExistsError || error instanceof ConflictNotFoundError || error instanceof InvalidConflictResolutionError) return ExitCode.invalidInput;
  if (error instanceof Error && /unsupported project protocol|protocol version/i.test(error.message)) return ExitCode.incompatible;
  return ExitCode.unexpected;
}

export async function run(argv: readonly string[], cwd = process.cwd()): Promise<number> {
  try {
    return await runCommand(argv, cwd);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return errorCode(error);
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  const modulePath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(entrypoint) === realpathSync(modulePath);
  } catch {
    return resolve(entrypoint) === resolve(modulePath);
  }
}

if (isMainModule()) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
