import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("anamnesis PDF package download", () => {
  it("requests and downloads the complete patient package", () => {
    const source = readSource("src/lib/anamnesePdfDownload.ts");

    expect(source).toContain("downloadAnamnesePackagePdf");
    expect(source).toContain('{ body: { document: "patientenpaket" } }');
    expect(source).toContain('link.download = "patientenpaket-blanko.pdf"');
  });

  it("serves the patient package for current and older clients", () => {
    const source = readSource("supabase/functions/download-anamnesis-pdf/index.ts");

    expect(source).toContain('["anamnesebogen", "patientenpaket"]');
    expect(source).toContain('createSignedUrl("blanko/patientenpaket-blanko.pdf"');
    expect(source).toContain('download: "patientenpaket-blanko.pdf"');
  });

  it("keeps the published pricing in the generated patient contract", () => {
    const source = readSource("scripts/build-vertrag-datenschutz.py");
    const signatureSource = readSource("scripts/refresh-clear-signature-pages.py");

    expect(source).toContain('pdf.h1("III. Aktuelle Preise")');
    expect(source).toContain('("Haupttherapien / Analyseverfahren", "90–110 € pro Stunde", "")');
    expect(source).toContain('("Vieva Pro Analyse", "200 €", "")');
    expect(source).toContain('("Omega-3 Test", "60 €", "")');
    expect(source).toContain('("Versand der Analysen", "15 € pro Analyse", "wenn gewünscht")');
    expect(source).toContain('("150MHz Befeldung (Erstaufnahme)", "110 €", "inkl. Anamnese, Dauer ca. 1,5 Stunden")');
    expect(source).toContain('("150MHz Befeldung (Folgetermine)", "55 € pro Stunde", "")');
    expect(source).toContain('("Ausfallentschädigung", "80–110 € pro Stunde", "bei Absage unter 48 Stunden")');
    expect(signatureSource).toContain("writer.reattach_fields()");
  });

  it("distinguishes CT contrast from radioiodine and supports repeated examinations", () => {
    const formData = readSource("src/lib/anamneseFormData.ts");
    const form = readSource("src/components/anamnese/SurgeriesSection.tsx");
    const pdfBuilder = readSource("scripts/build-anamnese-fillable.py");
    const exportSource = readSource("src/lib/pdfExportEnhanced.ts");

    expect(formData).toContain("ctKontrastmittel:");
    expect(formData).toContain("radioioddiagnostik:");
    expect(formData).toContain("termine: [] as");
    expect(form).toContain("CT mit jodhaltigem Kontrastmittel");
    expect(form).toContain("Das Kontrastmittel enthält nicht-radioaktives Jod");
    expect(form).toContain("Radiojoddiagnostik / Ganzkörperszintigrafie, ggf. SPECT/CT");
    expect(form).toContain("Weitere Untersuchung hinzufügen");
    expect(pdfBuilder).toContain("for entry_index in range(1, 5)");
    expect(pdfBuilder).toContain("mindestens etwa 6 Wochen");
    expect(exportSource).toContain("renderProcedureHistory");
    expect(exportSource).toContain("uo.radioioddiagnostik");
  });
});
