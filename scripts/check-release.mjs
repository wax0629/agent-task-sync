import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const packagePaths = [join(root, "package.json")];

async function workspacePackagePaths() {
  for (const directory of ["packages", "apps", "adapters"]) {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      packagePaths.push(join(root, directory, entry.name, "package.json"));
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function expectedVersionFromArgs(argv) {
  const index = argv.indexOf("--version");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  const version = (raw ?? "").replace(/^v/, "");
  if (raw !== undefined && !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`--version must be a semver triplet, got ${raw}`);
  }
  return version || undefined;
}

async function assertRequiredFiles() {
  for (const path of [
    join(root, "LICENSE"),
    join(root, "CHANGELOG.md"),
    join(root, "docs", "release", "agent-task-sync-v0.2.0-release-notes.md"),
    join(root, "docs", "release", "agent-task-sync-v0.2.0-release-checklist.md")
  ]) {
    try {
      await access(path);
    } catch {
      throw new Error(`required release file is missing: ${relative(root, path)}`);
    }
  }
}

export async function checkRelease(expectedVersion) {
  await workspacePackagePaths();
  const packages = await Promise.all(packagePaths.map(async (path) => ({ path, package: await readJson(path) })));
  const rootPackage = packages[0].package;
  const version = expectedVersion ?? rootPackage.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`release version must be a semver triplet, got ${version}`);

  const mismatches = [];
  for (const { path, package: manifest } of packages) {
    if (manifest.version !== version) mismatches.push(`${relative(root, path)} has version ${manifest.version}`);
    for (const dependencies of [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies]) {
      for (const [name, dependencyVersion] of Object.entries(dependencies ?? {})) {
        if (name.startsWith("@agent-task-sync/") && dependencyVersion !== version) {
          mismatches.push(`${relative(root, path)} depends on ${name}@${dependencyVersion}`);
        }
      }
    }
  }

  const lock = await readJson(join(root, "package-lock.json"));
  if (lock.version !== version || lock.packages?.[""].version !== version) mismatches.push("package-lock.json root version does not match");
  for (const { path } of packages) {
    const relativePackagePath = relative(root, path).split(sep).join("/");
    const lockPath = relativePackagePath === "package.json"
      ? ""
      : relativePackagePath.replace(/\/package\.json$/, "");
    if (!lockPath) continue;
    const lockPackage = lock.packages?.[lockPath];
    if (!lockPackage || lockPackage.version !== version) mismatches.push(`package-lock.json entry ${lockPath} does not match`);
  }
  if (mismatches.length) throw new Error(`release version mismatch:\n- ${mismatches.join("\n- ")}`);
  await assertRequiredFiles();
  return { version, packageCount: packages.length, packageName: rootPackage.name };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkRelease(expectedVersionFromArgs(process.argv.slice(2)));
    console.log(`Release check passed: ${result.packageName} v${result.version}; ${result.packageCount} package manifests aligned.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
