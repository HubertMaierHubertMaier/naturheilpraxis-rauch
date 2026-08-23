import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(repoRoot, "..", "..", "..", "Strunz-Quelleninventur-2026-08-04");
const outputPath = resolve(repoRoot, "docs", "consolidated-research-artifacts-2026-08-12.json");
const files = readdirSync(sourceRoot)
  .filter((name) => /^(?:WIKI|STRUNZ|N2)-.*\.json$/.test(name))
  .sort();
const snapshot = {
  schema_version: 1,
  captured_at: "2026-08-12T00:00:00.000Z",
  source_root_label: "Strunz-Quelleninventur-2026-08-04",
  artifact_count: files.length,
  artifacts: files.map((file) => ({
    file,
    raw_text: readFileSync(resolve(sourceRoot, file), "utf8"),
  })),
};

writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(`${files.length}\n`);
