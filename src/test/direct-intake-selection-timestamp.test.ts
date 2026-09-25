// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { selectionTimestamp } from "@/lib/documentLoadHistory";

const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("current direct intake selection timestamp", () => {
  it("shows the actual selection date and keeps the selection visibly unsaved", () => {
    const start = source.indexOf("const formatDirectSelectionDate =");
    const end = source.indexOf("const pendingSafePreviewKey", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const formatDirectSelectionDate = new Function("selectionTimestamp", `${js}; return formatDirectSelectionDate;`)(selectionTimestamp) as (files: Array<{ id: string; loadedAt?: string }>) => string;
    const stamp = Date.UTC(2026, 8, 24, 12).toString(36);

    expect(formatDirectSelectionDate([{ id: `${stamp}-0-synthetic.pdf` }])).toBe("24.09.2026");
    expect(formatDirectSelectionDate([{ id: "synthetic-id", loadedAt: "2026-09-25T12:00:00Z" }])).toBe("25.09.2026");
    expect(source).toContain("Dokument{pendingDirectBefundFiles.length === 1 ? \"\" : \"e\"} zur Prüfung ausgewählt · noch nicht gespeichert");
    expect(source).toContain("ausgewählt am ${formatDirectSelectionDate(pendingDirectBefundFiles)}");
  });

  it("still records the load event when the local draft cache fails", () => {
    expect(source).toContain('item.localCacheStatus !== "saved" && item.localCacheStatus !== "error"');
    expect(source).toContain('item.loadHistoryStatus !== "saved"');
  });
});
