import { cp, rm, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "deploy");

const COPY_DIRS = ["_7", "_8", "_9", "ai_3", "ai_cashflow_commander"];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const dir of COPY_DIRS) {
  await cp(join(ROOT, dir), join(OUT, dir), { recursive: true });
}

console.log(`Prepared static assets → ${OUT}`);
