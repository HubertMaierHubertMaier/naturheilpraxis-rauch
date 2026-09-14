// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { deidentifyClinicalReportHtml } from "../../supabase/functions/_shared/clinicalDeidentification";

const source = readFileSync("supabase/functions/analyze-documents/index.ts", "utf8");
const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "streamGatewayHtml");
if (!fn) throw new Error("Actual final-stream implementation missing");
const js = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const pid = "SYNTH-REPORT-991";
async function stream(html: string, fallback?: string) {
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: html }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
  const env = { fetch: vi.fn(async () => new Response(sse)), encoder: new TextEncoder(), stripHtmlFence: (value: string) => value.trim(),
    isCompleteFinalHtml: () => true, deidentifyClinicalReportHtml, callGatewayText: vi.fn(), escapeHtml: (value: string) => value };
  const create = new Function(...Object.keys(env), `${js}; return streamGatewayHtml;`)(...Object.values(env));
  return create("synthetic-key", "synthetic-model", "synthetic-prompt", fallback, pid) as Promise<ReadableStream<Uint8Array>>;
}

describe("final analysis stream cannot emit a privacy stop as a completed report", () => {
  it("emits a validated report for the exact selected pseudonym", async () => {
    const output = await new Response(await stream(`<html><body><p>Patient: ${pid}</p><h2>Anamnese</h2></body></html>`)).text();
    expect(output).not.toContain(pid); expect(output).toContain("[personenbezogene Angabe entfernt]"); expect(output).toContain("Anamnese");
  });
  it("errors before emitting any chunk if the only output is a blocked placeholder", async () => {
    const reader = (await stream("<html><body><h1>Datenschutz-Sicherheitsstopp</h1></body></html>")).getReader();
    await expect(reader.read()).rejects.toThrow(/keine vollständige Auswertung/);
  });
  it("does not emit an unresolved foreign identifier", async () => {
    const reader = (await stream("<html><body><p>Patient: OTHER-991</p></body></html>")).getReader();
    await expect(reader.read()).rejects.toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("may use a separately validated deterministic fallback", async () => {
    const output = await new Response(await stream("<html><body><p>Patient: OTHER-991</p></body></html>",
      `<html><body><p>Patient: ${pid}</p><h2>Gespeicherte Teilanalysen</h2></body></html>`)).text();
    expect(output).toContain("Gespeicherte Teilanalysen"); expect(output).not.toContain("OTHER-991");
  });
});
