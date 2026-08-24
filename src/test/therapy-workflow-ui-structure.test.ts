import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const count = (value: string, pattern: string) => value.split(pattern).length - 1;

describe("therapy workflow UI structure", () => {
  it("renders each primary workflow action only once", () => {
    const source = readSource("src/components/admin/TherapyRecommendation.tsx");

    expect(count(source, "onClick={handleAnalyzeDocuments}")).toBe(1);
    expect(count(source, "onClick={() => handleSubmit()}")).toBe(1);
    expect(count(source, "onClick={handleReAnalyzeAll}")).toBe(1);
    expect(count(source, "Ausgewählte Befunde auswerten ({analysisSourceTotals.selected})")).toBe(1);
    expect(count(source, "Therapie-Empfehlung generieren")).toBe(1);
    expect(source).not.toContain("Start-Aktionen");
    expect(source).not.toContain("fixed bottom-4");
    expect(source).not.toContain("Weitere Befunde nachladen");
    expect(source.indexOf("Nächster Schritt: Therapie aus dem vollständigen Befund ableiten"))
      .toBeGreaterThan(source.indexOf("Befund-Auswertung {isAnalyzingDocs"));
    expect(source).toContain('TabsTrigger value="vieva-plus"');
    expect(source).toContain('TabsTrigger value="metatron"');
    expect(count(source, "requireDocumentDate")).toBe(2);
    expect(source).toContain("applyExtractedToInputs({ forPseudonymId: analysisPid");
    expect(source).toContain("if (docAbortRef.current)");
    expect(source).toContain("if (abortRef.current)");
    expect(source).toContain("disabled={isStreaming || therapyStartBlockedByBefund}");
    expect(source).toContain("hasEffectivelySelectedBefundSources");
    expect(source).toContain("sameBefundSourceRevision(recentlyCompleted.sourceRevision, analysisSources)");
    expect(source).toContain("pathogensText: pathogensText || undefined");
    expect(source).toContain("metatronDatum: metatronDatum.trim() || undefined");
    expect(source).toContain("metatronDatum={metatronDatum}");
    expect(source).toContain("pdfPassword={vievaPlusPdfPassword}");
    expect(source).toContain("onPdfPasswordChange={setVievaPlusPdfPassword}");
    expect(source).toContain("Vor dem PDF-Import zuerst das Analyse-Datum eintragen.");
    expect(source).toContain("Datenschutz- und Sicherheitsprüfung:");
    expect(source).toContain("Nur den zum aktuellen Pseudonym gehörenden Befund verwenden.");
    expect(source).toContain("ersetzt keine fachliche Sicherheits-, Interaktions- oder Therapieprüfung");
    expect(source).toContain("Sicher auslesen und Vorschau erstellen");
    expect(source).toContain("Datenschutzbereinigte Vorschau");
    expect(source).toContain("Geprüfte Inhalte passend übernehmen");
    expect(source).toContain("const inferredType = inferDirectBefundTarget(file.name)");
    expect(source).toContain("if (!documentType) documentType = inferDirectBefundTarget(extracted.text)");
    expect(source).toContain("Dokumentart konnte nicht sicher automatisch erkannt werden");
    expect(source).not.toContain('documentType: "sonstige" as const');
    expect(source).toContain('case "labor": append(setLaborKomplett, text)');
    expect(source).toContain('case "metatron": append(setMetatronHeel, text)');
    expect(source).toContain('case "vieva": append(setVievaPlus, text)');
    expect(source).toContain('case "arzt-anamnese": append(setArztbericht, text)');
    expect(source).toContain('case "sonstige": append(setSonstigeUntersuchungen, text)');
  });

  it("keeps later findings in autosave and transfers all routed document dates", () => {
    const source = readSource("src/components/admin/TherapyRecommendation.tsx");
    const autoSaveBlock = source.slice(
      source.indexOf("// ---- Harte Auto-Sicherung in der Datenbank pro Pseudonym ----"),
      source.indexOf("const manualDiagnosisContext"),
    );

    expect(autoSaveBlock).not.toContain('workflowStage === "finalized"');
    expect(autoSaveBlock).not.toContain("workflowStage, assertPayloadMatchesPseudonym");
    expect(source).toContain('const latestLabDate = latestDateFor("labor")');
    expect(source).toContain('const latestMetatronDate = latestDateFor("metatron")');
    expect(source).toContain('const latestVievaDate = latestDateFor("vieva")');
    expect(source).toContain('const latestDoctorDate = latestDateFor("arzt-anamnese")');
    expect(source).toContain("if (latestLabDate) setLaborDatum(latestLabDate)");
    expect(source).toContain("if (latestMetatronDate) setMetatronDatum(latestMetatronDate)");
    expect(source).toContain("if (latestVievaDate) setVievaPlusDatum(latestVievaDate)");
    expect(source).toContain("if (latestDoctorDate) setArztberichtDatum(latestDoctorDate)");
  });

  it("blocks the synthetic case until a saved patient pseudonym has been restored", () => {
    const source = readSource("src/components/admin/TherapyRecommendation.tsx");

    expect(source).toContain("const [sessionPseudonymRestored, setSessionPseudonymRestored] = useState(false)");
    expect(source).toContain("setSessionPseudonymRestored(true)");
    expect(source).toContain("const syntheticCaseLoadBlocked = !sessionPseudonymRestored");
    expect(source).toContain("|| !!pseudonymId.trim()");
    expect(source).toContain("Warte, bis ein vorhandener Patientenstand sicher erkannt wurde");
  });
});
