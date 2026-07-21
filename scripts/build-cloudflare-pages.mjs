import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await assertInsideRoot(dist);
await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

const files = ["index.html", "precedent-search.html", "case-status.html", "registries.html"];
const directories = [
  ["assets", "assets"],
  [path.join("data", "sample"), path.join("data", "sample")],
];

for (const file of files) {
  await cp(path.join(root, file), path.join(dist, file));
}

for (const [source, target] of directories) {
  await cp(path.join(root, source), path.join(dist, target), { recursive: true });
}

console.log(`Cloudflare Pages output ready: ${path.relative(root, dist)}`);

async function assertInsideRoot(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside project root: ${target}`);
  }
}
