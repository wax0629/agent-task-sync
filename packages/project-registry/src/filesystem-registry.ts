import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { InitProjectInput, ProjectInfo, ProjectRegistry } from "@agent-task-sync/application";
import { writeFileAtomically } from "@agent-task-sync/store-files";

interface ProjectManifest extends ProjectInfo {
  protocolVersion: 1;
}

export class FileProjectRegistry implements ProjectRegistry {
  constructor(private readonly rootDir: string) {}

  async init(input: InitProjectInput): Promise<ProjectInfo> {
    if (!input.projectId.trim() || !input.name.trim() || !input.rootPath.trim()) throw new Error("projectId, name, and rootPath are required");
    const manifest: ProjectManifest = { ...input, protocolVersion: 1 };
    await mkdir(this.rootDir, { recursive: true });
    await writeFileAtomically(join(this.rootDir, "project.yaml"), stringify(manifest, { sortMapEntries: true }));
    return input;
  }

  async current(): Promise<ProjectInfo | undefined> {
    try {
      const manifest = parse(await readFile(join(this.rootDir, "project.yaml"), "utf8")) as ProjectManifest;
      if (manifest.protocolVersion !== 1) throw new Error(`Unsupported project protocol: ${manifest.protocolVersion}`);
      return {
        projectId: manifest.projectId,
        name: manifest.name,
        rootPath: manifest.rootPath,
        remoteUrl: manifest.remoteUrl,
        defaultBranch: manifest.defaultBranch
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}
