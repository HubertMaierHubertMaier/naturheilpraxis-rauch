import { describe, expect, it } from "vitest";
import { displayAnalysisSourceLabel } from "@/lib/analysisSourceDisplay";

describe("analysis source display labels", () => {
  it("names the source area, document ID and reviewed date without displaying filenames", () => {
    const label = displayAnalysisSourceLabel({
      key: "metatronHeel:doc:0:dokument-7910dd5aeaf4",
      group: "dokument",
      text: "=== 📄 Patientin Beispiel Metatron.pdf ===\nDokumenttyp: Metatron Hospital\nErstellt am: 2026-09-12\nBefundtext",
    });
    expect(label).toBe("Metatron/Hospital-Analyse – Dokumentkennung 7910dd5aeaf4 · Datum: 12.09.2026");
    expect(label).not.toContain("Patientin Beispiel");
  });

  it("shows an explicit missing date for older unlabeled source blocks", () => {
    expect(displayAnalysisSourceLabel({
      key: "sonstigeUntersuchungen:doc:0:dokument-abcdef123456",
      group: "dokument",
      text: "=== KLINISCHES DOKUMENT abcdef123456 (3 S.) ===\nBefundtext",
    })).toBe("Sonstige Untersuchung – Dokumentkennung abcdef123456 · Datum offen");
  });

  it("distinguishes entered context from document introductions without exposing values", () => {
    expect(displayAnalysisSourceLabel({
      key: "patientenkontext", group: "kontext",
      text: "Aktuelle Symptome / Beschwerden:\nBeispieltext\n\nBekannte Erkrankungen / Diagnosen:\nBeispieltext",
    })).toBe("Einzelangaben – Symptome, Erkrankungen");
    expect(displayAnalysisSourceLabel({
      key: "anamnese:intro", group: "befund", text: "langer Einleitungstext",
    })).toBe("Anamnesebogen – zusätzlicher Text vor dem Dokument");
  });
});
