import { expect, it } from "vitest";
import { deidentifyClinicalData, deidentifyClinicalText } from "../../supabase/functions/_shared/clinicalDeidentification";

it("keeps neutral Office document identities and cell provenance through repeated privacy passes", () => {
  const source = "=== KLINISCHES DOKUMENT abcdef123456 ===\nDokumentformat: Excel; Blatt- und Zellangaben\n[Excel-Blatt 1, Zeile 2]\nA2: 2026-09-15\nB2: CRP\nC2: 2.0\nD2: mg/l";
  const first = deidentifyClinicalText(source);
  const second = deidentifyClinicalData({ laborKomplett: first }) as { laborKomplett: string };
  expect(first).toBe(source);
  expect(second.laborKomplett).toBe(source);
});

it("still removes an untrusted original filename marker", () => {
  const cleaned = deidentifyClinicalText("=== 📄 Person-Originalunterlage.docx ===\nUnveränderter Sachtext");
  expect(cleaned).not.toContain("Person-Originalunterlage.docx");
  expect(cleaned).toContain("Unveränderter Sachtext");
});
