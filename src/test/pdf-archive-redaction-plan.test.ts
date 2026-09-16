import { describe, expect, it } from "vitest";
import { assertPdfOcrEvidence, buildPdfPrivacyReplacements, checkedPdfPrivacyReplacements, groupPdfPrivacyWords } from "../lib/pdfArchiveRedactionPlan";

const line=(text:string,x=20,y=20,width=400,height=15)=>({text,x,y,width,height});
describe("PDF privacy replacements preserve clinical content",()=>{
  it("rejects empty, low-confidence and unpositioned OCR on visible pages",()=>{
    expect(()=>assertPdfOcrEvidence("",99,[],1000,1000)).toThrow(/OCR-Positionen/);
    expect(()=>assertPdfOcrEvidence("Name: Erika",69,[line("Name: Erika")],1000,1000)).toThrow(/Unsichere/);
    expect(()=>assertPdfOcrEvidence("Name: Erika",99,[line("Name: Erika",NaN)],1000,1000)).toThrow(/Ungültige/);
  });
  it("does not overwrite a neighboring clinical row",()=>{
    expect(()=>checkedPdfPrivacyReplacements([line("Name: Erika Muster",20,20,200,15),line("LDL 130 mg/dl",20,36,200,15)])).toThrow(/benachbarten/);
  });
  it("merges agreeing OCR/native spans but rejects conflicting retained values",()=>{
    expect(checkedPdfPrivacyReplacements([line("Muster Erika 12.03.1980 (46)"),line("Muster Erika 12.03.1980 (46)",21,20,398)])).toHaveLength(1);
    expect(()=>checkedPdfPrivacyReplacements([line("Muster Erika 12.03.1980 (46)"),line("Muster Erika 12.03.1980 (48)")])).toThrow(/Widersprüchliche/);
  });
  it("identifies an arbitrary unlabelled personal header and keeps age",()=>{
    const replacements=buildPdfPrivacyReplacements([line("Muster Erika 12.03.1980 (46)")]);
    expect(replacements).toHaveLength(1);
    expect(replacements[0].replacement).not.toContain("Muster");
    expect(replacements[0].replacement).not.toContain("12.03.1980");
    expect(replacements[0].replacement).toContain("(46)");
    expect(replacements[0].categories).toEqual(expect.arrayContaining(["Name","Geburtsdatum"]));
  });
  it("preserves dates, lab measurements, unitless device results and source labels",()=>{
    expect(buildPdfPrivacyReplacements([
      line("29.04.2026"),line("Magnesium 0,75 mmol/l"),line("HERING 2,356"),
      line("Metapathia Hospital 3D"),line("HRV RMSSD 24 ms"),
    ])).toEqual([]);
  });
  it("rejects an identifier without trustworthy coordinates before any upload",()=>{
    expect(()=>buildPdfPrivacyReplacements([line("Muster Erika 12.03.1980 (46)",NaN)])).toThrow(/lokalisiert/);
  });
  it("does not merge separate table columns into a single redaction area",()=>{
    const result=groupPdfPrivacyWords([line("Name:",10,20,30,10),line("Erika",44,20,30,10),line("Muster",78,20,40,10),line("LDL 130 mg/dl",300,20,100,10)]);
    expect(result.map(x=>x.text)).toEqual(["Name: Erika Muster","LDL 130 mg/dl"]);
    expect(result[0].width).toBe(108);
  });
});
