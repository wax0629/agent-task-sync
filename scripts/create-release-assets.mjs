import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
}

const argv = process.argv.slice(2);
const outputDirectory = resolve(root, option(argv, "--output-dir", "release"));
const version = option(argv, "--version");
const checkArgs = ["scripts/check-release.mjs"];
if (version) checkArgs.push("--version", version);
const check = spawnSync(process.execPath, checkArgs, { cwd: root, encoding: "utf8" });
if (check.status !== 0) throw new Error(`release check failed\n${check.stdout}\n${check.stderr}`);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const pack = spawnSync(npmCommand, ["pack", "--workspaces=false", "--pack-destination", outputDirectory], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});
if (pack.status !== 0) throw new Error(`npm pack failed\n${pack.stdout}\n${pack.stderr}`);

const tarballs = (await readdir(outputDirectory)).filter((name) => name.endsWith(".tgz"));
if (tarballs.length !== 1) throw new Error(`expected one release tarball, found ${tarballs.length}`);
const tarballName = tarballs[0];
const digest = createHash("sha256").update(await readFile(join(outputDirectory, tarballName))).digest("hex");
await writeFile(join(outputDirectory, "SHA256SUMS.txt"), `${digest}  ${tarballName}\n`, "utf8");
console.log(`Release assets ready: ${tarballName} and SHA256SUMS.txt`);
