// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  const addDirectBefundFiles =");
const end = source.indexOf("\n  const processDirectBefundFiles =", start);
if (start < 0 || end <= start) throw new Error("Direct intake file handler not found");
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(mode: "single" | "batch", existingCount: number) {
  const existing = Array.from({ length: existingCount }, (_, index) => ({ id: `existing-${index}`, status: "queued" }));
  const updates: Array<(previous: unknown[]) => unknown[]> = [];
  const toast = vi.fn();
  const input = { value: "selected" };
  let nextId = 0;
  const env = {
    documentEntryMode: mode,
    pendingDirectBefundFiles: existing,
    isAnalyzingDocs: false,
    isImportingAnamnesis: false,
    localSelectionCacheUserResolved: true,
    localSelectionCacheUserId: "synthetic-user",
    pseudonymId: "P-2099-0001",
    localSelectionCacheRunRef: { current: 0 },
    directBefundFileRef: { current: input },
    toast,
    normalizePseudonymId: (value: string) => value,
    isPatientScopedStorageReady: () => true,
    inferDirectBefundTarget: () => "anamnesis",
    crypto: { randomUUID: () => `new-${++nextId}` },
    setPendingDirectBefundFiles: (update: (previous: unknown[]) => unknown[]) => updates.push(update),
  };
  const addFiles = new Function(...Object.keys(env), `${js}; return addDirectBefundFiles;`)(...Object.values(env)) as (files: Array<{ name: string; webkitRelativePath: string }>) => void;
  return { addFiles, existing, updates, toast, input };
}

describe("direct intake selections", () => {
  it("appends one new file in single mode without replacing restored selections", () => {
    const test = setup("single", 7);
    const file = { name: "P-2099-0001-synthetic-anamnese.pdf", webkitRelativePath: "" };
    test.addFiles([file]);

    expect(test.toast).not.toHaveBeenCalled();
    expect(test.updates).toHaveLength(1);
    const result = test.updates[0](test.existing) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(8);
    expect(result.slice(0, 7)).toEqual(test.existing);
    expect(result[7]).toMatchObject({ file, id: "new-1", loadEventId: "new-2", documentDate: "", localCacheStatus: "saving", loadHistoryStatus: "pending" });
    expect(Number.isNaN(Date.parse(String(result[7].loadedAt)))).toBe(false);
    expect(test.input.value).toBe("");
  });

  it("still rejects selecting several files at once in single mode", () => {
    const test = setup("single", 7);
    test.addFiles([
      { name: "P-2099-0001-one.pdf", webkitRelativePath: "" },
      { name: "P-2099-0001-two.pdf", webkitRelativePath: "" },
    ]);

    expect(test.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Bitte Sammeleingabe wählen" }));
    expect(test.updates).toHaveLength(0);
    expect(test.existing).toHaveLength(7);
  });
});
