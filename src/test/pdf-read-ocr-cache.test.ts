import { describe, expect, it } from "vitest";
import { readPdfOcrCache, rememberPdfOcrRead } from "@/lib/pdfReadOcrCache";

describe("local PDF OCR position cache", () => {
  it("keeps only page-bound line and word boxes needed for manual text binding", () => {
    const file = new Blob(["synthetic"]);
    const data: any = {
      text: "Empfohlen von\nErika",
      confidence: 84,
      blocks: [{ paragraphs: [{ lines: [
        { text: "Empfohlen von", bbox: { x0: 1, y0: 2, x1: 40, y1: 10 }, words: [{ text: "Empfohlen", bbox: { x0: 1, y0: 2, x1: 25, y1: 10 } }], symbols: [{ text: "E" }] },
        { text: "Erika", bbox: { x0: 1, y0: 20, x1: 20, y1: 30 }, words: [{ text: "Erika", bbox: { x0: 1, y0: 20, x1: 20, y1: 30 } }], symbols: [{ text: "E" }] },
      ] }] }],
    };
    rememberPdfOcrRead(file, 1, 100, 100, data);
    const cached = readPdfOcrCache(file, 1)!;
    expect(cached.data.blocks?.[0].paragraphs?.[0].lines?.[1].words?.[0]).toEqual({ text: "Erika", bbox: { x0: 1, y0: 20, x1: 20, y1: 30 } });
    expect(JSON.stringify(cached.data)).not.toContain("symbols");
    expect(readPdfOcrCache(new Blob(["synthetic"]), 1)).toBeUndefined();
  });
});
