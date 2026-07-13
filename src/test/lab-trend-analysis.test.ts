import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildClinicallyRelevantLabHighlights,
  extractLabQuintessenceSection,
  extractSensitiveLabValuesFromText,
  hasAndrogenDeprivationContext,
  hasPostProstatectomyContext,
  hasTreatedProstateCancerContext,
  isPsaParameter,
  isTotalTestosteroneParameter,
  parseLabNumber,
} from "../../supabase/functions/_shared/labTrendAnalysis";
import {
  deidentifyClinicalData,
  deidentifyClinicalText,
  directIdentifierCategories,
} from "../../supabase/functions/_shared/clinicalDeidentification";

const psa = (datum: string, wert: string, bewertung = "normal") => ({
  datum,
  parameter: "PSA (prostataspezifisches Antigen)",
  wert,
  einheit: "ng/ml",
  referenz: "< 4,0",
  bewertung,
  quelle: "Synthetischer Testbefund",
});

describe("laboratory trend analysis", () => {
  it("invalidates checkpoints created with the previous laboratory prompt", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    expect(source).toContain('ANALYSIS_PROMPT_VERSION = "befund-deidentified-sensitive-labs-v8"');
    expect(source).not.toContain('ANALYSIS_PROMPT_VERSION = "befund-sensitive-lab-extraction-v7"');
  });

  it("recognizes common PSA labels and German decimal values", () => {
    expect(isPsaParameter("PSA")).toBe(true);
    expect(isPsaParameter("iPSA")).toBe(true);
    expect(isPsaParameter("Prostataspezifisches Antigen")).toBe(true);
    expect(parseLabNumber("< 0,10 ng/ml")).toBe(0.1);
  });

  it("recognizes total testosterone aliases but excludes free and index values", () => {
    expect(isTotalTestosteroneParameter("Testosteron")).toBe(true);
    expect(isTotalTestosteroneParameter("Gesamt-Testosteron")).toBe(true);
    expect(isTotalTestosteroneParameter("Total Testosterone")).toBe(true);
    expect(isTotalTestosteroneParameter("Freies Testosteron")).toBe(false);
    expect(isTotalTestosteroneParameter("Freier Androgen-Index (Testosteron/SHBG)")).toBe(false);
  });

  it("recovers directly evidenced PSA and total testosterone measurements from chunk text", () => {
    const source = [
      "Befunddatum: 04.08.2031",
      "PSA - ultrasensitiv: 0,31 (Methode CLIA) Ergebnis ng/ml; Normbereich bis 4,0 ng/ml",
      "Gesamt-Testosteron Ergebnis 650 ng/dl; Referenz 90-800 ng/dl",
    ].join("\n");
    const result = extractSensitiveLabValuesFromText(source, "Synthetischer Laborbefund", "2/3");

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.parameter)).toEqual(["PSA (gesamt)", "Testosteron (gesamt)"]);
    expect(result.map((item) => item.wert)).toEqual(["0,31", "650"]);
    expect(result.every((item) => item.datum === "04.08.2031")).toBe(true);
    expect(result.every((item) => item.quelle === "Synthetischer Laborbefund")).toBe(true);
  });

  it("pairs a flattened multi-date PSA series without dropping the latest value", () => {
    const source = "01.01.2031 10.07.2031 iPSA 0,10 0,24 ng/ml";
    const result = extractSensitiveLabValuesFromText(source, "Synthetischer Verlauf");

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.datum)).toEqual(["01.01.2031", "10.07.2031"]);
    expect(result.map((item) => item.wert)).toEqual(["0,10", "0,24"]);
  });

  it("does not promote a PSA reference limit to a dated measurement", () => {
    const source = "01.01.2031 10.07.2031 PSA 0,24 <4,0 ng/ml";
    const result = extractSensitiveLabValuesFromText(source, "Synthetischer Verlauf");

    expect(result).toHaveLength(1);
    expect(result[0].datum).toBe("10.07.2031");
    expect(result[0].wert).toBe("0,24");

    const interval = extractSensitiveLabValuesFromText("10.07.2031 PSA 0,24 0,00-4,00 ng/ml", "Synthetischer Befund");
    expect(interval).toHaveLength(1);
    expect(interval[0].wert).toBe("0,24");

    const detectionLimitThenValue = extractSensitiveLabValuesFromText("PSA <0,10 ng/ml 0,24 ng/ml", "Synthetischer Befund");
    expect(detectionLimitThenValue.map((item) => item.wert)).toEqual(["<0,10", "0,24"]);

    const labelledDetectionLimit = extractSensitiveLabValuesFromText("PSA 0,24 ng/ml Nachweisgrenze <0,10 ng/ml", "Synthetischer Befund");
    expect(labelledDetectionLimit.map((item) => item.wert)).toEqual(["0,24"]);
  });

  it("removes direct identifiers while preserving pseudonym and medically relevant dates and values", () => {
    const source = [
      "Patient: Erika Beispiel",
      "wohnhaft Musterweg 7, 12345 Musterstadt",
      "Geburtsdatum: 01.02.1950",
      "Telefon: 01234 567890, E-Mail: erika@example.test",
      "Versicherten-Nr.: A123456789",
      "Pseudonym: P-2031-0042",
      "Prostatektomie am 12.03.2030",
      "Befunddatum: 04.08.2031, PSA 0,31 ng/ml, Gesamt-Testosteron 650 ng/dl",
    ].join("\n");
    const result = deidentifyClinicalText(source);

    expect(result).not.toContain("Erika Beispiel");
    expect(result).not.toContain("Musterweg");
    expect(result).not.toContain("01.02.1950");
    expect(result).not.toContain("01234 567890");
    expect(result).not.toContain("A123456789");
    expect(result).toContain("P-2031-0042");
    expect(result).toContain("12.03.2030");
    expect(result).toContain("04.08.2031");
    expect(result).toContain("PSA 0,31 ng/ml");
    expect(result).toContain("Gesamt-Testosteron 650 ng/dl");
    expect(directIdentifierCategories(result)).toEqual([]);
  });

  it("sanitizes nested source labels and direct identifier fields before persistence", () => {
    const result = deidentifyClinicalData({
      pseudonymId: "P-2031-0042",
      source: "Erika_Beispiel_Labor.pdf",
      patientName: "Erika Beispiel",
      dateOfBirth: "01.02.1950",
      phoneNumber: "01234 567890",
      insuranceNumber: "A123456789",
      qrCode: "opaque-payload",
      files: [{ name: "Erika_Beispiel_Labor.pdf", pages: 2 }],
      report: { text: "Geburtsdatum 01.02.1950; Labor vom 04.08.2031: PSA 0,31 ng/ml" },
    }) as {
      pseudonymId: string;
      source: string;
      patientName: string;
      dateOfBirth: string;
      phoneNumber: string;
      insuranceNumber: string;
      qrCode: string;
      files: Array<{ name: string; pages: number }>;
      report: { text: string };
    };

    expect(result.pseudonymId).toBe("P-2031-0042");
    expect(result.source).toBe("Dokument");
    expect(result.patientName).toContain("entfernt");
    expect(result.dateOfBirth).toContain("entfernt");
    expect(result.phoneNumber).toContain("entfernt");
    expect(result.insuranceNumber).toContain("entfernt");
    expect(result.qrCode).toContain("entfernt");
    expect(result.files).toEqual([{ name: "Dokument", pages: 2 }]);
    expect(result.report.text).not.toContain("01.02.1950");
    expect(result.report.text).toContain("04.08.2031");
    expect(result.report.text).toContain("PSA 0,31 ng/ml");
  });

  it("does not consume sex, diagnoses, or laboratory labels after a patient field", () => {
    const withName = deidentifyClinicalText("Patient: Erika Beispiel Prostata Karzinom PSA 0,24 ng/ml");
    expect(withName).toContain("Erika Beispiel");
    expect(withName).toContain("Prostata Karzinom PSA 0,24 ng/ml");
    expect(directIdentifierCategories(withName)).toContain("Name");

    const withoutName = deidentifyClinicalText("Patient: Weiblich PSA 0,24 ng/ml");
    expect(withoutName).toContain("Weiblich PSA 0,24 ng/ml");

    const ambiguousDiagnosis = deidentifyClinicalText("Patient: Chronische Gastritis PSA 0,24 ng/ml");
    expect(ambiguousDiagnosis).toContain("Chronische Gastritis PSA 0,24 ng/ml");
    expect(directIdentifierCategories(ambiguousDiagnosis)).toContain("Name");
  });

  it("removes identifier values separated by HTML table tags", () => {
    const html = "<table><tr><th>Patient:</th><td>Erika Beispiel</td></tr><tr><th>PSA</th><td>0,24 ng/ml</td></tr></table>";
    const result = deidentifyClinicalText(html);
    expect(result).not.toContain("Erika Beispiel");
    expect(result).toContain("PSA");
    expect(result).toContain("0,24 ng/ml");

    const inline = deidentifyClinicalText("<p><strong>Patient:</strong> Erika Beispiel</p>");
    expect(inline).not.toContain("Erika Beispiel");

    const nested = deidentifyClinicalText("<p>Patient: <span><b>Erika Beispiel</b></span></p>");
    expect(nested).not.toContain("Erika Beispiel");

    const definitionList = deidentifyClinicalText("<dl><dt>Patient</dt><dd>Erika Beispiel</dd></dl>");
    expect(definitionList).not.toContain("Erika Beispiel");

    const pseudonym = deidentifyClinicalText("<table><tr><th>Patient:</th><td>P-2031-0042</td></tr></table>");
    expect(pseudonym).toContain("P-2031-0042");
    expect(pseudonym).not.toContain("personenbezogene Angabe entfernt");
    expect(directIdentifierCategories(pseudonym)).toEqual([]);
  });

  it("removes single, multi-part, clinician names, and international phone numbers", () => {
    const source = [
      "Patient: Mustermann",
      "Patient: Anna Maria Beispiel, wohnhaft Beispielweg 8, 12345 Beispielstadt",
      "Behandler: Dr. Max Beispiel",
      "Rückruf unter +49 821 1234567",
      "Alternative Nummer 0821 1234567",
      "Rückrufnummer 08211234567",
      "Dr. Maria Beispiel",
      "Dr. med. Henrik Muster behandelt seit 04.08.2031; PSA 0,24 ng/ml",
      "Dr. med. H. Beispiel kontrolliert am 05.08.2031; Testosteron 650 ng/dl",
      "Anna Beispiel, geb. 01.02.1950",
    ].join("\n");
    const result = deidentifyClinicalText(source);
    expect(result).not.toContain("Mustermann");
    expect(result).not.toContain("Anna Maria Beispiel");
    expect(result).not.toContain("Max Beispiel");
    expect(result).not.toContain("+49 821 1234567");
    expect(result).not.toContain("0821 1234567");
    expect(result).not.toContain("08211234567");
    expect(result).not.toContain("Maria Beispiel");
    expect(result).not.toContain("Henrik Muster");
    expect(result).toContain("behandelt seit 04.08.2031; PSA 0,24 ng/ml");
    expect(result).not.toContain("H. Beispiel");
    expect(result).toContain("kontrolliert am 05.08.2031; Testosteron 650 ng/dl");
    expect(result).not.toContain("Anna Beispiel");
    expect(directIdentifierCategories(result)).toEqual([]);
  });

  it("requires documented post-prostatectomy context for contextual PSA highlighting", () => {
    expect(hasPostProstatectomyContext("Z. n. radikaler Prostatektomie")).toBe(true);
    expect(hasPostProstatectomyContext({ diagnose: "Radikale Prostatektomie", status: "Z. n." })).toBe(true);
    expect(hasPostProstatectomyContext({ medicationsTherapies: [{ name: "Radikale Prostatektomie", status: "durchgeführt" }] })).toBe(true);
    expect(hasPostProstatectomyContext("Prostatektomie als mögliche spätere Option besprochen")).toBe(false);
    expect(hasPostProstatectomyContext("Keine Prostatektomie durchgeführt")).toBe(false);
    expect(hasPostProstatectomyContext("Prostatektomie nicht erfolgt")).toBe(false);
    expect(hasPostProstatectomyContext("Prostatektomie durchgeführt: nein")).toBe(false);
    expect(hasPostProstatectomyContext({ diagnose: "Prostatektomie geplant", status: "Z. n. Appendektomie" })).toBe(false);

    const withoutContext = buildClinicallyRelevantLabHighlights(
      [psa("2026-07-10", "0,24")],
      "Allgemeine Vorsorge ohne dokumentierte Prostatektomie",
    );
    expect(withoutContext).toHaveLength(0);
  });

  it("highlights a PSA value of 0.24 after documented prostatectomy without diagnosing recurrence", () => {
    const result = buildClinicallyRelevantLabHighlights(
      [psa("2025-12-01", "< 0,10"), psa("2026-07-10", "0,24")],
      { pastHistory: ["Zustand nach radikaler Prostatektomie"] },
    );

    expect(result).toHaveLength(1);
    expect(result[0].item.wert).toBe("0,24");
    expect(result[0].direction).toBe("Verlauf");
    expect(result[0].derivedFromContext).toBe(true);
    expect(result[0].significance).toContain("urologisch kontrollieren");
    expect(result[0].significance).toContain("Keine automatische Rezidivdiagnose");
  });

  it("highlights a PSA value of 0.17 after documented prostatectomy", () => {
    const result = buildClinicallyRelevantLabHighlights(
      [psa("2026-07-10", "0,17")],
      { pastHistory: ["Zustand nach radikaler Prostatektomie"] },
    );

    expect(result).toHaveLength(1);
    expect(result[0].item.wert).toBe("0,17");
    expect(result[0].direction).toBe("Verlauf");
  });

  it("does not apply a generic percentage rule to normal non-PSA values", () => {
    const result = buildClinicallyRelevantLabHighlights([
      { datum: "2026-01-01", parameter: "Kreatinin", wert: "0,50", bewertung: "normal" },
      { datum: "2026-07-01", parameter: "Kreatinin", wert: "0,75", bewertung: "normal" },
    ], "Zustand nach radikaler Prostatektomie");

    expect(result).toHaveLength(0);
  });

  it("keeps very small PSA changes below 0.1 in the timeline without automatic highlighting", () => {
    const result = buildClinicallyRelevantLabHighlights(
      [psa("2026-01-01", "0,05"), psa("2026-07-01", "0,08")],
      { pastHistory: ["Zustand nach radikaler Prostatektomie"] },
    );

    expect(result).toHaveLength(0);
  });

  it("marks a documented PSA rise after another prostate cancer treatment without applying the prostatectomy threshold", () => {
    const context = {
      diagnoses: [{ diagnose: "Prostatakarzinom", status: "gesichert" }],
      medicationsTherapies: [{ name: "Strahlentherapie", indikation: "Prostatakarzinom", status: "abgeschlossen" }],
    };
    expect(hasTreatedProstateCancerContext(context)).toBe(true);

    const result = buildClinicallyRelevantLabHighlights(
      [psa("2026-01-01", "0,10"), psa("2026-07-01", "0,17")],
      context,
    );
    expect(result).toHaveLength(1);
    expect(result[0].significance).toContain("behandlungsspezifisch");
  });

  it("rejects planned, excluded, unrelated, and ambiguous prostate cancer treatment context", () => {
    expect(hasTreatedProstateCancerContext({
      medicationsTherapies: [{ name: "Strahlentherapie", indikation: "Prostatakarzinom", status: "geplant" }],
    })).toBe(false);
    expect(hasTreatedProstateCancerContext("Prostatakarzinom ausgeschlossen, Strahlentherapie 2025 abgeschlossen")).toBe(false);
    expect(hasTreatedProstateCancerContext("Prostatakarzinom, keine Strahlentherapie, Kontrolle 2025")).toBe(false);
    expect(hasTreatedProstateCancerContext("Prostatakarzinom, ohne Hormontherapie, Verlauf seit 2025")).toBe(false);
    expect(hasTreatedProstateCancerContext({
      diagnoses: [{ diagnose: "Prostatakarzinom", status: "gesichert" }],
      medicationsTherapies: [{ name: "Strahlentherapie", indikation: "Mammakarzinom", status: "abgeschlossen" }],
    })).toBe(false);
    expect(hasTreatedProstateCancerContext({
      medicationsTherapies: [{ name: "Hormontherapie", indikation: "Prostatakarzinom", status: "abgesetzt vor Beginn" }],
    })).toBe(false);
  });

  it("recognizes an atomically linked past treatment with schema status abgesetzt", () => {
    expect(hasTreatedProstateCancerContext({
      medicationsTherapies: [{ name: "Hormontherapie", indikation: "Prostatakarzinom", status: "abgesetzt" }],
    })).toBe(true);
  });

  it("links total testosterone aliases and compatible units after documented ADT", () => {
    const context = {
      diagnoses: [{ diagnose: "Prostatakarzinom", status: "gesichert" }],
      medicationsTherapies: [{ name: "GnRH-Analogon", indikation: "Androgendeprivation bei Prostatakarzinom", status: "abgesetzt" }],
    };
    expect(hasAndrogenDeprivationContext(context)).toBe(true);

    const result = buildClinicallyRelevantLabHighlights([
      { datum: "2030-01-10", parameter: "Testosteron", wert: "0,20", einheit: "ng/ml", bewertung: "normal" },
      { datum: "2030-06-10", parameter: "Gesamt-Testosteron", wert: "650", einheit: "ng/dl", bewertung: "normal" },
      { datum: "2030-07-10", parameter: "Total Testosterone", wert: "650", einheit: "ng/dl", bewertung: "normal" },
    ], context);

    expect(result).toHaveLength(1);
    expect(result[0].item.datum).toBe("2030-07-10");
    expect(result[0].direction).toBe("Verlauf");
    expect(result[0].significance).toContain("Testosteron-Anstieg");
    expect(result[0].significance).toContain("Keine automatische Aussage über Erkrankungsaktivität");
  });

  it("does not flag testosterone without performed and linked ADT", () => {
    const values = [
      { datum: "2030-01-10", parameter: "Testosteron", wert: "0,20", einheit: "ng/ml", bewertung: "normal" },
      { datum: "2030-07-10", parameter: "Gesamt-Testosteron", wert: "650", einheit: "ng/dl", bewertung: "normal" },
    ];
    expect(hasAndrogenDeprivationContext("Prostatakarzinom, Hormontherapie nur geplant")).toBe(false);
    expect(buildClinicallyRelevantLabHighlights(values, "Prostatakarzinom ohne Hormontherapie")).toHaveLength(0);
  });

  it("does not infer a rise from a lower-bounded previous PSA value", () => {
    const context = {
      medicationsTherapies: [{ name: "Strahlentherapie", indikation: "Prostatakarzinom", status: "abgeschlossen" }],
    };
    const result = buildClinicallyRelevantLabHighlights(
      [psa("2026-01-01", "> 0,10"), psa("2026-07-01", "0,17")],
      context,
    );
    expect(result).toHaveLength(0);
  });

  it("requires a qualifying total-PSA measurement and compatible unit", () => {
    const context = { pastHistory: ["Zustand nach radikaler Prostatektomie"] };
    expect(buildClinicallyRelevantLabHighlights([psa("2026-07-01", "< 0,20")], context)).toHaveLength(0);
    expect(buildClinicallyRelevantLabHighlights([{ ...psa("2026-07-01", "0,24"), einheit: "ng/dl" }], context)).toHaveLength(0);
    expect(buildClinicallyRelevantLabHighlights([{ ...psa("2026-07-01", "0,24"), parameter: "Freies PSA" }], context)).toHaveLength(0);
    expect(buildClinicallyRelevantLabHighlights([{ ...psa("2026-07-01", "0,24"), einheit: "µg/l" }], context)).toHaveLength(1);
  });

  it("keeps conventionally abnormal laboratory values in the highlights", () => {
    const result = buildClinicallyRelevantLabHighlights([
      { datum: "2026-01-01", parameter: "CRP", wert: "22", bewertung: "↑" },
      { datum: "2026-07-01", parameter: "CRP", wert: "4", bewertung: "normal" },
    ], "Kein besonderer Kontext");

    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("↑");
    expect(result[0].item.wert).toBe("22");
    expect(result[0].derivedFromContext).toBe(false);
  });

  it("detects when an existing quintessence still omits PSA", () => {
    const withoutPsa = `<html><body><h2>⚠️ Auffällige oder kontextrelevante Laborwerte — Quintessenz</h2><table><tr><td>CRP</td></tr></table><h2>Weitere Daten</h2></body></html>`;
    const sectionWithoutPsa = extractLabQuintessenceSection(withoutPsa);
    expect(sectionWithoutPsa).toContain("CRP");

    const withPsa = `<html><body><h2>⚠️ Auffällige oder kontextrelevante Laborwerte — Quintessenz</h2><table><tr><td>PSA</td><td>0,24 ng/ml</td></tr></table></body></html>`;
    expect(extractLabQuintessenceSection(withPsa)).toContain("0,24 ng/ml");

    const revisedHeading = `<html><body><h2><span>⚠️ Auffällige oder erkrankungs-/therapiebezogen sensible Laborwerte</span></h2><table><tr><td>CRP</td></tr></table><h2>Weiter</h2></body></html>`;
    expect(extractLabQuintessenceSection(revisedHeading)).toContain("CRP");
  });

  it("wires deterministic sensitive-lab recovery and de-identification into both edge chunk paths", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/analyze-documents/index.ts"), "utf8");
    expect(source).toContain("extractSensitiveLabValuesFromText(block.text, block.label, part)");
    expect(source).toContain("normalizePartialAnalysisJson(partial, chunks[i]");
    expect(source).toContain("normalizePartialAnalysisJson(partial, { label, text }");
    expect(source).toContain("deidentifyClinicalData(normalized)");
    expect(source).toContain("deidentifyClinicalData(JSON.parse(raw))");
    expect(source).toContain("deidentifyClinicalText(finalHtml)");
  });

  it("does not archive original analysis documents or send scans to external OCR", () => {
    const uploadSource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/MultiDocUpload.tsx"), "utf8");
    const imageUploadSource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/LabImageUpload.tsx"), "utf8");
    const clientSource = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    expect(uploadSource).not.toContain("archiveClinicalDocumentOriginal");
    expect(uploadSource).not.toContain("extract-lab-image");
    expect(uploadSource).not.toContain('from("therapy-documents")');
    expect(uploadSource).toContain("Datenschutz-Stopp: Bilder werden nicht an eine externe OCR gesendet");
    expect(uploadSource).toContain("pagesWithInsufficientImageText.length");
    expect(uploadSource).toContain("rasterImageOperatorIds.has(operatorId)");
    expect(clientSource).toContain("directIdentifierCategories");
    expect(clientSource).toContain("original_archived: false");
    expect(clientSource).not.toContain("await archiveClinicalDocumentOriginal(item.file, pid)");
    expect(imageUploadSource).not.toContain("extract-lab-image");
    expect(imageUploadSource).toContain("Foto-, Screenshot- und Scan-OCR ist deaktiviert");
  });

  it("adds database-side de-identification for future therapy session writes", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260713140500_redact_therapy_session_identifiers.sql"), "utf8");
    const followUpMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260713144500_redact_doctor_names_in_running_text.sql"), "utf8");
    expect(migration).toContain("BEFORE INSERT OR UPDATE ON public.therapy_sessions");
    expect(migration).toContain("redact_therapy_pii_jsonb(NEW.eingabe_daten)");
    expect(migration).toContain("redact_therapy_pii_text(NEW.befund_html)");
    expect(migration).toContain("nicht eindeutig anonymisiertes Patientenfeld");
    expect(migration).toContain("P-[[:digit:]]{4}-[[:digit:]]{1,4}");
    expect(migration).toContain("regexp_replace(concat_ws");
    expect(migration).toContain("Existing rows are intentionally not rewritten");
    expect(followUpMigration).toContain("CREATE OR REPLACE FUNCTION public.redact_therapy_pii_text");
    expect(followUpMigration).toContain("{0,2}', '[Name entfernt]', 'g');");
  });
});
