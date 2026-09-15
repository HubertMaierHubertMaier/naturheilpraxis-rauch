import { expect, it } from "vitest";
import { normalizeAdditionalAnamnesis, formatAdditionalAnamnesis } from "../components/admin/therapy/AnamnesisAdditionalFields";
import { persistVerifiedAnamnesis } from "../lib/anamnesisRecovery";
import { stageIncludesSource, sourceLimitedTherapyInput } from "../../supabase/functions/_shared/therapySourceScope";
import { neutralAnalysisSourceLabel } from "../lib/analysisSourceHistory";

it("retains multiple dated PET examinations through serialization, verified readback and the analysis context", async () => {
  const pid = "P-2099-0401";
  const petExaminations = "12.03.2025 – PET/CT: Thorax und Abdomen\n08.06.2026 – PET: Gehirn, dokumentierte Fragestellung";
  const additional = normalizeAdditionalAnamnesis(JSON.parse(JSON.stringify({ petExaminations, "iaa.1.1": "6", children: "2" })));
  const input = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "Synthetische Anamnese", anamneseZusatz: additional };
  const result = await persistVerifiedAnamnesis(pid, input, async () => "synthetic-row", async () => ({ pseudonym_id: pid, eingabe_daten: input, versionVerified: true }));
  expect(result.stored.eingabe_daten.anamneseZusatz).toEqual(additional);
  expect(stageIncludesSource("all", "sonstigeUntersuchungen:pet")).toBe(true);
  expect(stageIncludesSource("anamnese", "sonstigeUntersuchungen:pet")).toBe(false);
  expect(sourceLimitedTherapyInput({ anamneseZusatzText: formatAdditionalAnamnesis(additional) }, "anamnese").anamneseZusatzText).toBeUndefined();
  expect(neutralAnalysisSourceLabel("sonstigeUntersuchungen:pet", "befund")).toContain("PET-Untersuchungen");
  expect(formatAdditionalAnamnesis(additional)).toContain(`PET-Untersuchungen – Datum und untersuchter Bereich / Fragestellung:\n${petExaminations}`);
  await expect(persistVerifiedAnamnesis(pid, input, async () => "synthetic-row", async () => ({ pseudonym_id: pid, eingabe_daten: { ...input, anamneseZusatz: { ...additional, petExaminations: "12.03.2025 – PET/CT: Thorax und Abdomen" } }, versionVerified: true }))).rejects.toThrow(/zurückgelesen/);
});
