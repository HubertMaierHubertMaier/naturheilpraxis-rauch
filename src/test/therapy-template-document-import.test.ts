// @vitest-environment node
import JSZip from "jszip";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { extractTherapyTemplateDocument } from "@/components/admin/therapy/MultiDocUpload";

vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, OPS: {}, getDocument: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
// Exercise Mammoth's real browser API: the Node entry expects Buffer instead of ArrayBuffer.
vi.mock("mammoth", async () => ({ default: (await import("mammoth/mammoth.browser.js")).default }));
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("reviewed local therapy-template documents", () => {
  it("reads a real DOCX package locally and emits a neutral document marker", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetischer Therapieplan zur Überprüfung.</w:t></w:r></w:p></w:body></w:document>');
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const file = { name: "private-synthetic-source.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", arrayBuffer: async () => bytes } as File;
    const result = await extractTherapyTemplateDocument(file);
    expect(result.text).toContain("Synthetischer Therapieplan zur Überprüfung.");
    expect(result.text).toMatch(/Dokument-[a-f0-9]{12}/);
    expect(result.text).not.toContain(file.name);
  });
  it.each(["txt", "md"])("retains local %s text without exposing its original filename", async extension => {
    const file = Object.assign(new Blob(["Synthetischer Inhalt mit überprüfbaren Umlauten."], { type: "text/plain" }), { name: `private-synthetic.${extension}` }) as File;
    const result = await extractTherapyTemplateDocument(file);
    expect(result.text).toContain("Synthetischer Inhalt mit überprüfbaren Umlauten.");
    expect(result.text).not.toContain(file.name);
  });
  it("does not read a cancelled Word import", async () => {
    const controller = new AbortController(); controller.abort();
    const arrayBuffer = vi.fn();
    const file = { name: "synthetic.docx", type: "", arrayBuffer } as unknown as File;
    await expect(extractTherapyTemplateDocument(file, "doctor", undefined, undefined, { signal: controller.signal })).rejects.toThrow(/abgebrochen/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it("rejects a format outside the existing template importer", async () => {
    const file = { name: "synthetic.bin", type: "application/octet-stream" } as File;
    await expect(extractTherapyTemplateDocument(file)).rejects.toThrow(/PDF, Word/);
  });
});
