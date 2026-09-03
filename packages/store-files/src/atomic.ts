import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, open, rename, rm } from "node:fs/promises";

export async function writeFileAtomically(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${path.split(/[\\/]/).pop() ?? "file"}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, path);
  } catch (error) {
    // Windows cannot always replace an existing file with rename; the retry keeps the operation explicit.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" && (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    await rm(path, { force: true });
    await rename(temporary, path);
  }
  try {
    await chmod(path, 0o600);
  } catch {
    // Permissions are best effort on platforms that do not expose POSIX modes.
  }
}
