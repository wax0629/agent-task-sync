import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const entries = [
  ["apps/cli/src/main.ts", "apps/cli/dist/bundle.js"],
  ["adapters/codex/src/hook.ts", "adapters/codex/dist/bundle.js"],
  ["adapters/claude-code/src/hook.ts", "adapters/claude-code/dist/bundle.js"],
  ["adapters/pi/src/hook.ts", "adapters/pi/dist/bundle.js"]
];

await Promise.all(entries.map(async ([entryPoint, outfile]) => {
  await mkdir(dirname(resolve(root, outfile)), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    packages: "bundle",
    external: ["yaml"],
    platform: "node",
    format: "esm",
    target: "node20",
    sourcemap: false,
    legalComments: "none"
  });
}));

console.log(`Built ${entries.length} release bundles.`);
