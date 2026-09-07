import { mkdtemp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: process.platform === "win32" && command.endsWith(".cmd"),
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

function assertOk(result, label) {
  if (result.code !== 0) {
    throw new Error(`${label} failed with code ${result.code}\n${result.stdout}\n${result.stderr}`);
  }
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}\n${result.stdout}\n${result.stderr}`);
  }
}

function installedBin(rootDir, name) {
  return join(rootDir, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
}

const smokeRoot = await mkdtemp(join(tmpdir(), "agent-task-sync-release-"));
try {
  const packDir = join(smokeRoot, "pack");
  const installDir = join(smokeRoot, "install");
  await mkdir(packDir);
  await mkdir(installDir);

  const pack = await run(npmCommand, ["pack", "--workspaces=false", "--pack-destination", packDir], { cwd: root });
  assertOk(pack, "npm pack");
  const tarballs = (await readdir(packDir)).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) throw new Error(`Expected one release tarball, found ${tarballs.length}.`);

  const tarball = join(packDir, tarballs[0]);
  const install = await run(npmCommand, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installDir });
  assertOk(install, "npm install tarball");

  const pathPrefix = join(installDir, "node_modules", ".bin");
  const env = { ...process.env, PATH: `${pathPrefix}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}` };
  const doctor = await run(installedBin(installDir, "task-sync"), ["doctor", "--json"], { cwd: installDir, env });
  if (doctor.code !== 3) throw new Error(`task-sync doctor expected exit code 3, got ${doctor.code}.\n${doctor.stdout}\n${doctor.stderr}`);
  const doctorReport = parseJson(doctor, "task-sync doctor");
  if (doctorReport.initialized !== false || doctorReport.ok !== false) throw new Error("doctor should report an uninitialized project.");

  for (const adapter of ["codex", "claude", "pi"]) {
    const hook = await run(installedBin(installDir, `task-sync-adapter-${adapter}`), ["session_start"], {
      cwd: installDir,
      env,
      input: `${JSON.stringify({ cwd: installDir })}\n`
    });
    assertOk(hook, `${adapter} adapter session_start`);
    const hookResult = parseJson(hook, `${adapter} adapter`);
    if (hookResult.continue !== true) throw new Error(`${adapter} adapter must keep continue=true.`);
  }

  const bundlePaths = [
    "apps/cli/dist/bundle.js",
    "adapters/codex/dist/bundle.js",
    "adapters/claude-code/dist/bundle.js",
    "adapters/pi/dist/bundle.js"
  ];
  for (const bundlePath of bundlePaths) {
    const bundle = await readFile(join(root, bundlePath), "utf8");
    if (bundle.includes("@agent-task-sync/")) throw new Error(`${bundlePath} still references a private workspace package.`);
  }

  console.log(`Release smoke passed: ${tarballs[0]}; doctor JSON and ${3} adapter entrypoints verified.`);
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}
