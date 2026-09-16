import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { prepareClinicalReportHtml } from "@/lib/clinicalReportHtml";
import { buildAnalysisProfile, parseStartedAnalysisProfile } from "@/lib/analysisProfile";
import { buildAnamnesisIntake } from "@/lib/anamnesisIntakeFields";
import { normalizeNativeIaaClaims } from "../../supabase/functions/_shared/nativeIaaEvidence";

const source = readFileSync("src/components/admin/TherapyRecommendation.tsx", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  const handleRebuildCurrentAnamnesisView =");
const end = source.indexOf("\n  const handleReAnalyzeAll", start);
if (start < 0 || end <= start) throw new Error("Actual checkpoint rebuild implementation missing");
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const pid = "SYNTH-REBUILD-991";
const profile = { ...buildAnalysisProfile(true, false), startedAt: "2099-01-01T00:00:00.000Z" };
const row = { eingabe_daten: { checkpoint: { pseudonymId: pid, partials: ["{}"], totalChunks: 1, completedChunks: 1,
  totalChars: 100, sourceManifestV1: [{ sourceId: "synthetic", contentSha256: "a".repeat(64) }], analysisProfile: profile } } };

function setup(html: string, queryResult: Promise<unknown> = Promise.resolve({ data: [row], error: null })) {
  const insert = vi.fn(async () => ({ error: null }));
  const query: any = { select: () => query, eq: () => query, order: () => query, limit: () => queryResult, insert };
  const env = { pseudonymId: pid, normalizePseudonymId: (value: string) => value, isPatientScopedStorageReady: () => true, isAnalyzingDocs: false,
    patientScopeGenerationRef: { current: 1 }, pseudonymIdRef: { current: pid }, PATIENT_DATA_MISMATCH_ERROR: "owner mismatch",
    setDocAnalysisProgress: vi.fn(), toast: vi.fn(), supabase: { from: () => query, auth: { getUser: async () => ({ data: { user: { id: "synthetic-user" } } }) } },
    assertStrictPartialAnalysis: vi.fn(), parseLlmJson: JSON.parse, normalizeNativeIaaClaims, alter: "", geschlecht: "", mannayanOrders: [],
    buildClientFallbackAnalysisHtml: () => html, sanitizeFinalAnalysisHtml: prepareClinicalReportHtml, parseStartedAnalysisProfile,
    setDocAnalysisHtml: vi.fn(), setBefundRunProfile: vi.fn(), setDisplayedBefundSourceStand: vi.fn(), setIsDocAnalysisPanelMinimized: vi.fn(),
    setLatestBefundLoadedFrom: vi.fn(), writeLatestBefundDisplay: vi.fn(), applyExtractedToInputs: vi.fn(), applyAndPersistExtractedInputs: vi.fn(async () => {}), buildAnamnesisIntake, setHistoryRefresh: vi.fn(),
    window: { setTimeout: vi.fn() }, docAnalysisRef: { current: null },
  };
  const rebuild = new Function(...Object.keys(env), `${js}; return handleRebuildCurrentAnamnesisView;`)(...Object.values(env));
  return { env, insert, rebuild };
}

describe("checkpoint rebuild respects privacy, ownership and analysis profile", () => {
  it("does not reinsert an old model-invented IAA symptom when rebuilding saved partials", async () => {
    const saved = structuredClone(row);
    saved.eingabe_daten.checkpoint.partials = [JSON.stringify({ findings: [], openQuestions: [], anamnese: {
      currentProblems: [{ text: "Invented back complaint", beleg: {
        quelle: "Synthetic source", zitat: "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]", quoteMatched: true, pruefstatus: "quellenzitat_bestaetigt",
      } }],
    } })];
    const test = setup(`<h2>Strukturierte Anamnese</h2><p>Patient: ${pid}</p>`, Promise.resolve({ data: [saved], error: null }));
    await test.rebuild();
    expect(test.env.applyAndPersistExtractedInputs).toHaveBeenCalledWith(expect.objectContaining({ symptoms: [], intake: expect.objectContaining({ symptoms: [] }) }));
    expect(test.insert).toHaveBeenCalled();
  });
  it("does not display or insert a success record after privacy rejection", async () => {
    const test = setup("<p>Patient: OTHER-991</p>"); await test.rebuild();
    expect(test.env.setDocAnalysisHtml).not.toHaveBeenCalled(); expect(test.insert).not.toHaveBeenCalled();
    expect(test.env.writeLatestBefundDisplay).not.toHaveBeenCalled();
    expect(test.env.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Neuer Aufbau nicht möglich" }));
  });
  it("does not apply a late checkpoint after switching patients", async () => {
    let resolve!: (value: unknown) => void; const pending = new Promise(done => { resolve = done; });
    const test = setup(`<p>Patient: ${pid}</p>`, pending); const rebuilding = test.rebuild();
    test.env.patientScopeGenerationRef.current += 1; test.env.pseudonymIdRef.current = "SYNTH-OTHER-992";
    resolve({ data: [row], error: null }); await rebuilding;
    expect(test.env.setDocAnalysisHtml).not.toHaveBeenCalled(); expect(test.insert).not.toHaveBeenCalled();
  });
  it("preserves the started profile when saving a validated rebuild", async () => {
    const test = setup(`<h2>Strukturierte Anamnese</h2><p>Patient: ${pid}</p>`); await test.rebuild();
    expect(test.insert).toHaveBeenCalledWith(expect.objectContaining({ befund_meta: expect.objectContaining({ analysis_profile: profile, strict_complete: true }) }));
    expect(test.env.setBefundRunProfile).toHaveBeenCalledWith(profile);
    expect(test.env.applyAndPersistExtractedInputs).toHaveBeenCalledWith(expect.objectContaining({ forPseudonymId: pid }));
  });
});
