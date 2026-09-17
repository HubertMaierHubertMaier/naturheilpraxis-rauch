import { describe, expect, it } from "vitest";
import { applyManualPdfTextRedactions, clearManualPdfTextRedactions, rememberManualPdfTextRedactions } from "@/lib/manualPdfTextRedaction";

const source = () => Object.assign(new Blob(["synthetic source"], { type: "application/pdf" }), { name: "synthetic.pdf" });
const rectangle = { x: 10, y: 10, width: 30, height: 12 };
const words = [{ text: "Erika Beispiel", x: 10, y: 10, width: 30, height: 12 }];

describe("manual PDF redaction text binding", () => {
  it("redacts only the bound page context and preserves an identical word on another page", () => {
    const file = source();
    rememberManualPdfTextRedactions(file, 1, [rectangle], 100, 100, words, "P-2099-0001");
    const result = applyManualPdfTextRedactions(file, [
      "--- Seite 1 ---",
      "Empfohlen von: Erika Beispiel",
      "LDL 130 mg/dl",
      "",
      "--- Seite 2 ---",
      "Klinische Kontrollnotiz: Erika Beispiel",
      "RMSSD 24 ms",
    ].join("\n"), "P-2099-0001");
    expect(result).toContain("Empfohlen von: [personenbezogene Angabe entfernt]");
    expect(result).toContain("LDL 130 mg/dl");
    expect(result).toContain("Klinische Kontrollnotiz: Erika Beispiel");
    expect(result).toContain("RMSSD 24 ms");
  });

  it("supports provider labels while preserving native IAA/form values", () => {
    const file = source();
    rememberManualPdfTextRedactions(file, 1, [rectangle], 100, 100, words, "P-2099-0001");
    const result = applyManualPdfTextRedactions(file, [
      "--- Seite 1 ---",
      "Hausarzt Erika Beispiel",
      "Fachgebiet: Innere Medizin",
      "IAA-Bewertung: Stufe 4",
      "Frage/Feld: Schlaf\nErkannte Antwort: verneint",
    ].join("\n"), "P-2099-0001");
    expect(result).toContain("Hausarzt [personenbezogene Angabe entfernt]");
    expect(result).toContain("Fachgebiet: Innere Medizin");
    expect(result).toContain("IAA-Bewertung: Stufe 4");
    expect(result).toContain("Erkannte Antwort: verneint");
  });

  it("fails closed for unbound geometry, wrong case, or an ambiguous clinical occurrence", () => {
    const unbound = source();
    rememberManualPdfTextRedactions(unbound, 1, [rectangle], 100, 100, [], "P-2099-0001");
    expect(() => applyManualPdfTextRedactions(unbound, "--- Seite 1 ---\nName: Erika Beispiel", "P-2099-0001")).toThrow(/eindeutig bindbare Textposition/);

    const wrongCase = source();
    rememberManualPdfTextRedactions(wrongCase, 1, [rectangle], 100, 100, words, "P-2099-0001");
    expect(() => applyManualPdfTextRedactions(wrongCase, "--- Seite 1 ---\nName: Erika Beispiel", "P-2099-0002")).toThrow(/aktuellen Patientenfall/);

    const ambiguous = source();
    rememberManualPdfTextRedactions(ambiguous, 1, [rectangle], 100, 100, words, "P-2099-0001");
    expect(() => applyManualPdfTextRedactions(ambiguous, "--- Seite 1 ---\nName: Erika Beispiel\nKlinische Notiz: Erika Beispiel", "P-2099-0001")).toThrow(/klinischen Text/);
  });

  it("binds OCR-only word boxes to a nearby provider label without touching another page", () => {
    const file = source();
    const ocrWord = { text: "Erika", x: 10, y: 30, width: 18, height: 8, lineText: "Erika" };
    const providerLine = { text: "Empfohlen von", x: 10, y: 10, width: 50, height: 8 };
    rememberManualPdfTextRedactions(file, 1, [{ x: 10, y: 30, width: 18, height: 8 }], 100, 100, [], "P-2099-0001", [ocrWord], [providerLine]);
    const result = applyManualPdfTextRedactions(file, [
      "--- Seite 1 ---",
      "Empfohlen von",
      "Erika",
      "CRP 2 mg/l",
      "",
      "--- Seite 2 ---",
      "Erika",
      "RMSSD 24 ms",
    ].join("\n"), "P-2099-0001");
    expect(result).toContain("[personenbezogene Angabe entfernt]\nCRP 2 mg/l");
    expect(result).toContain("--- Seite 2 ---\nErika\nRMSSD 24 ms");
  });

  it("fails for repeated OCR words or a partially hit mixed native run, then permits a corrected retry", () => {
    const repeated = source();
    const ocrWord = { text: "Erika", x: 10, y: 30, width: 18, height: 8, lineText: "Erika" };
    const providerLine = { text: "Hausarzt", x: 10, y: 10, width: 50, height: 8 };
    rememberManualPdfTextRedactions(repeated, 1, [{ x: 10, y: 30, width: 18, height: 8 }], 100, 100, [], "P-2099-0001", [ocrWord], [providerLine]);
    expect(() => applyManualPdfTextRedactions(repeated, "--- Seite 1 ---\nHausarzt\nErika\nKlinische Notiz: Erika", "P-2099-0001")).toThrow(/klinischen Text/);

    const mixed = source();
    rememberManualPdfTextRedactions(mixed, 1, [{ x: 10, y: 10, width: 15, height: 10 }], 100, 100, [{ text: "Erika LDL 130 mg/l", x: 10, y: 10, width: 90, height: 10 }], "P-2099-0001");
    expect(() => applyManualPdfTextRedactions(mixed, "--- Seite 1 ---\nName: Erika LDL 130 mg/l", "P-2099-0001")).toThrow(/eindeutig bindbare Textposition/);

    clearManualPdfTextRedactions(repeated);
    rememberManualPdfTextRedactions(repeated, 1, [{ x: 10, y: 30, width: 18, height: 8 }], 100, 100, [], "P-2099-0001", [ocrWord], [providerLine]);
    expect(applyManualPdfTextRedactions(repeated, "--- Seite 1 ---\nHausarzt\nErika", "P-2099-0001")).toContain("[personenbezogene Angabe entfernt]");
  });

  it("clears a failed attempt instead of applying stale page bindings to a later copy", () => {
    const file = source();
    rememberManualPdfTextRedactions(file, 1, [rectangle], 100, 100, words, "P-2099-0001");
    clearManualPdfTextRedactions(file);
    expect(applyManualPdfTextRedactions(file, "--- Seite 1 ---\nName: Erika Beispiel", "P-2099-0001")).toContain("Name: Erika Beispiel");
  });

  it("never removes a name substring from a clinical word after automatic name removal", () => {
    const file=source();
    rememberManualPdfTextRedactions(file,1,[rectangle],100,100,[],"synthetic-case",[{text:"Rose",...rectangle,lineText:"Name: Rose"}],[]);
    const text="--- Seite 1 ---\nName: [personenbezogene Angabe entfernt]\nBefund: Arthrose";
    expect(applyManualPdfTextRedactions(file,text,"synthetic-case")).toBe(text);
    expect(()=>applyManualPdfTextRedactions(file,"--- Seite 1 ---\nName: [personenbezogene Angabe entfernt]\nTherapie: Rose","synthetic-case")).toThrow(/Quellzeile/);
  });

  it("binds both OCR name words against the original line while preserving adjacent findings", () => {
    const file=source(),lineText="Hausarzt Erika Beispiel LDL 130 mg/dl";
    rememberManualPdfTextRedactions(file,1,[{x:10,y:10,width:40,height:12}],200,100,[],"synthetic-case",[
      {text:"Erika",x:10,y:10,width:15,height:12,lineText},
      {text:"Beispiel",x:30,y:10,width:20,height:12,lineText},
    ],[]);
    const result=applyManualPdfTextRedactions(file,`--- Seite 1 ---\n${lineText}`,"synthetic-case");
    expect(result).not.toContain("Erika");expect(result).not.toContain("Beispiel");
    expect(result).toContain("LDL 130 mg/dl");
  });

  it("uses the Name/Ort provider-table header without removing the specialty", () => {
    const file=source();
    rememberManualPdfTextRedactions(file,1,[{x:50,y:60,width:20,height:8}],200,100,[],"synthetic-scan",[
      {text:"Beispiel",x:50,y:60,width:20,height:8,lineText:"Orthopädie Beispiel"},
    ],[{text:"Fachrichtung Name / Ort",x:10,y:10,width:100,height:8}]);
    expect(applyManualPdfTextRedactions(file,"--- Seite 1 ---\nFachrichtung Name / Ort\nOrthopädie Beispiel","synthetic-scan"))
      .toContain("Orthopädie [personenbezogene Angabe entfernt]");
  });
});
