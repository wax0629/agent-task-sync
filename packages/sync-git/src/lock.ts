import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { SyncLockError } from "./errors.js";

export interface SyncLockOptions {
  lockPath: string;
  deviceId: string;
  ttlMs?: number;
  now?: () => number;
}

interface LockRecord {
  pid: number;
  deviceId: string;
  createdAt: number;
  expiresAt: number;
}

export async function withSyncLock<T>(options: SyncLockOptions, operation: () => Promise<T>): Promise<T> {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 30_000;
  await mkdir(dirname(options.lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(options.lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const stale = await isStale(options.lockPath, now());
    if (!stale) throw new SyncLockError(options.lockPath);
    await rm(options.lockPath, { force: true });
    handle = await open(options.lockPath, "wx", 0o600);
  }

  const record: LockRecord = {
    pid: process.pid,
    deviceId: options.deviceId,
    createdAt: now(),
    expiresAt: now() + ttlMs
  };
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    return await operation();
  } finally {
    await rm(options.lockPath, { force: true });
  }
}

async function isStale(path: string, now: number): Promise<boolean> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<LockRecord>;
    return typeof value.expiresAt !== "number" || value.expiresAt <= now;
  } catch {
    return true;
  }
}
