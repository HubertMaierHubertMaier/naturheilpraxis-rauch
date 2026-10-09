// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/backup-export/index.ts", "utf8");
const start = source.indexOf("      const storageOut:");
const end = source.indexOf('\n    if (mode !== "db")', start);
const block = source.slice(start, end).replace(/\n    }\s*$/, "");
const js = ts.transpileModule(`async function exportSubset() { ${block} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

describe("subset storage export completeness", () => {
  it.each(["listing", "signing", "missing-url", "complete"])("handles %s with an explicit result", async (scenario) => {
    const list = vi.fn(async () => { if (scenario === "listing") throw new Error("synthetic only"); return [{ path: "synthetic.txt", size: 12 }]; });
    const sign = vi.fn(async () => scenario === "signing" ? { error: new Error("synthetic only") } : { data: [{ signedUrl: scenario === "missing-url" ? undefined : "https://synthetic.invalid/file" }], error: null });
    const run = new Function("area", "areaId", "tablesOut", "listAllFiles", "adminClient", "corsHeaders", "console", `${js}; return exportSubset;`)(
      { buckets: ["synthetic"] }, "synthetic", {}, list, { storage: { from: () => ({ createSignedUrls: sign }) } }, {}, { error: vi.fn() },
    );
    const response = await run();
    expect(response.status).toBe(scenario === "complete" ? 200 : 500);
    const body = await response.json();
    if (scenario !== "complete") expect(body.error).toBe("subset_storage_export_failed");
    else expect(body.storage.synthetic).toHaveLength(1);
  });
});
