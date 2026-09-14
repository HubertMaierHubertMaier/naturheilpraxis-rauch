// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

describe("complete intake recovery versus history excerpts", () => {
  let database: PGlite;
  beforeAll(async () => {
    database = new PGlite();
    await database.exec(readFileSync(new URL("../../supabase/migrations/20260914083000_preserve_complete_intake_snapshot.sql", import.meta.url), "utf8"));
  }, 20000);
  afterAll(async () => { await database?.close(); });
  const input = {
    pseudonymId: "SYNTH-INTAKE-SNAPSHOT",
    anamnese: "Vollständige synthetische Antwort. ".repeat(3000),
    anamneseDatum: "2026-09-14",
    naturheilMittelHomoeopathie: "Quellenangabe eines Testmittels",
    naturheilMittelPflanzenheilkunde: "Pflanzliches Testpräparat",
    naturheilMittelVitamine: "Vitamin D3 1000 IE täglich",
    naturheilMittelMineralstoffe: "Magnesium 200 mg abends",
    naturheilMittelSpurenelemente: "Zink 10 mg täglich",
    anamneseZusatz: { allergies: "Reaktion laut Anamnese unklar" },
    anamnesisIntakeV1: { hypotheses: [{ text: "Nur eine Hypothese", seite: 2 }] },
    originalArchiveReceiptsV1: [{ archivePath: "synthetic/original.pdf", sha256: "test" }],
    manualMittel: [{ name: "Synthetischer manueller Kandidat", dosis: "manuell prüfen" }],
    mannayanOrders: [{ orderNumber: "SYNTH-ORDER", items: [] }],
    selectedCategories: ["synthetic-category"], bevorzugteLinie: ["synthetic-line"], pinnedMittel: [{ name: "synthetic-pinned" }],
    startPlanExceptionReason: "Synthetische dokumentierte Ausnahme", startPlanPhaseAllocation: "Synthetische Phasenzuordnung",
    noStartRemedyApproved: false, noStartRemedyReason: "Noch nicht freigegeben", useMapReduce: true, useProModel: false,
  };
  it("retains long anamnesis, every natural category and structured provenance", async () => {
    const result = await database.query<{ data: Record<string, unknown> }>("select public.extract_patient_snapshot_fields($1::jsonb) as data", [JSON.stringify(input)]);
    expect(result.rows[0].data).toEqual({ ...input, _pseudonym_id: input.pseudonymId });
  });
  it("detail calls retain full text while history excerpts explicitly identify truncation", async () => {
    const detail = await database.query<{ data: Record<string, unknown> }>("select public.compact_therapy_session_input($1::jsonb, 12000) as data", [JSON.stringify(input)]);
    expect(detail.rows[0].data.anamnese).toBe(input.anamnese);
    expect(detail.rows[0].data._inputTruncatedFields).toBeUndefined();
    const list = await database.query<{ data: Record<string, unknown> }>("select public.compact_therapy_session_input($1::jsonb, 900) as data", [JSON.stringify(input)]);
    expect((list.rows[0].data.anamnese as string).length).toBe(900);
    expect(list.rows[0].data._inputTruncatedFields).toContain("anamnese");
    expect(list.rows[0].data._inputCompleteness).toBe("history_excerpt_not_for_recovery");
    expect(list.rows[0].data.anamneseZusatz).toEqual(input.anamneseZusatz);
  });
});
