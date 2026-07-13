import { describe, expect, it } from "vitest";
import {
  buildClinicallyRelevantLabHighlights,
  extractLabQuintessenceSection,
  hasPostProstatectomyContext,
  hasTreatedProstateCancerContext,
  isPsaParameter,
  parseLabNumber,
} from "../../supabase/functions/_shared/labTrendAnalysis";

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
  it("recognizes common PSA labels and German decimal values", () => {
    expect(isPsaParameter("PSA")).toBe(true);
    expect(isPsaParameter("Prostataspezifisches Antigen")).toBe(true);
    expect(parseLabNumber("< 0,10 ng/ml")).toBe(0.1);
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
});
