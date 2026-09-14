// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("src/components/admin/therapy/MultiDocUpload.tsx", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  const addFiles =");
const end = source.indexOf("\n  const removeAt", start);
if (start < 0 || end <= start) throw new Error("Actual file selection handler not found");
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup() {
  let selected: Array<{ name: string }> = [];
  const updates: Array<(previous: unknown[]) => unknown[]> = [];
  const list = { get length() { return selected.length; }, [Symbol.iterator]: () => selected[Symbol.iterator]() };
  const input = { set value(_value: string) { selected = []; } };
  const env = { inputRef: { current: input }, setPendingReview: vi.fn(), setPrivacyConfirmed: vi.fn(), setPrivacyFindingsRevealed: vi.fn(),
    setFiles: (update: (previous: unknown[]) => unknown[]) => updates.push(update) };
  const addFiles = new Function(...Object.keys(env), `${js}; return addFiles;`)(...Object.values(env));
  return { env, select: (files: Array<{ name: string }>) => { selected = files; addFiles(list); },
    flush: (previous: unknown[] = []) => updates.reduce((state, update) => update(state), previous),
    selectedCount: () => selected.length, updateCount: () => updates.length };
}

describe("selected originals survive a deferred React update", () => {
  it("snapshots the live FileList before clearing the chooser and preserves earlier queued originals", () => {
    const test = setup(); const original = { name: "synthetic-new.pdf" }; const earlier = { file: { name: "synthetic-earlier.pdf" }, status: "queued" };
    test.select([original]); expect(test.selectedCount()).toBe(0);
    expect(test.flush([earlier])).toEqual([earlier, { file: original, status: "queued" }]);
  });
  it("keeps two successive selections when both state updates are deferred", () => {
    const test = setup(); const first = { name: "synthetic-one.pdf" }; const second = { name: "synthetic-two.pdf" };
    test.select([first]); test.select([second]);
    expect(test.flush()).toEqual([{ file: first, status: "queued" }, { file: second, status: "queued" }]);
  });
  it("leaves a pending review intact when the file chooser is cancelled", () => {
    const test = setup(); test.select([]);
    expect(test.updateCount()).toBe(0); expect(test.env.setPendingReview).not.toHaveBeenCalled();
    expect(test.env.setPrivacyConfirmed).not.toHaveBeenCalled();
  });
});
