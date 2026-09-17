import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const files = await collectFiles(ROOT);
const moduleFiles = files.filter((file) => file.endsWith(".mjs"));
const jsonFiles = files.filter((file) => file.endsWith(".json"));
let relativeImportCount = 0;

for (const file of moduleFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = 1;
  }

  const source = await readFile(file, "utf8");
  const importPattern = /(?:from\s+|import\s*)["'](\.[^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    relativeImportCount += 1;
    const target = path.resolve(path.dirname(file), match[1]);
    try {
      await access(target);
    } catch {
      console.error(`Missing relative import: ${path.relative(ROOT, file)} -> ${match[1]}`);
      process.exitCode = 1;
    }
  }
}

for (const file of jsonFiles) {
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    console.error(`Invalid JSON: ${path.relative(ROOT, file)}`);
    console.error(error);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`Checked ${moduleFiles.length} ES modules, ${relativeImportCount} relative imports, and ${jsonFiles.length} JSON files.`);
}
