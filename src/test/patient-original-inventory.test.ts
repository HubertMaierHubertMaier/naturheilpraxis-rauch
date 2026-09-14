// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/admin/TherapyRecommendation.tsx", "utf8");
const ast = ts.createSourceFile("TherapyRecommendation.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const code = ["normalizeDocumentName", "mergeDocumentInventory"].map(name => {
  const node = ast.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name));
  if (!node) throw new Error(`Inventory helper ${name} missing`);
  return node.getText(ast);
}).join("\n");
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
type Item = { name: string; archivePath?: string };
const merge = new Function(`${js}; return mergeDocumentInventory;`)() as (...groups: Item[][]) => Item[];

describe("complete and unambiguous original-file inventory", () => {
  it("shows one physical original once even when input and storage use different labels", () => {
    const input = { name: "Confirmed laboratory original", archivePath: "SYNTHETIC/2099-01-01/labor-hash.pdf" };
    const storage = { name: "labor-hash.pdf", archivePath: input.archivePath };
    expect(merge([input], [storage])).toEqual([input]);
  });
  it("keeps equally named files at different dates and case-sensitive storage paths", () => {
    const originals = ["2099-01-01/Report.pdf", "2099-02-01/Report.pdf", "2099-01-01/report.pdf"]
      .map(path => ({ name: "Report.pdf", archivePath: `SYNTHETIC/${path}` }));
    expect(merge(originals)).toEqual(originals);
  });
  it("does not silently discard originals beyond the former 80-entry limit", () => {
    const originals = Array.from({ length: 121 }, (_, index) => ({ name: `Original ${index}`, archivePath: `SYNTHETIC/${index}.pdf` }));
    expect(merge(originals.slice(0, 60), originals.slice(60))).toEqual(originals);
  });
  it("keeps text-only evidence separate from a physical archive record", () => {
    const text = { name: "Report.pdf" }; const original = { ...text, archivePath: "SYNTHETIC/Report.pdf" };
    expect(merge([text], [original])).toEqual([text, original]);
  });
});
