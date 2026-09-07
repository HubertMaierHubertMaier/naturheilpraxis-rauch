import { describe, expect, it } from "vitest";
import { buildAnalysisProfile } from "@/lib/analysisProfile";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analysis profile", () => {
  it("describes all three modes without claiming Pro for Befund chunks", () => {
    const quick = buildAnalysisProfile(false, false);
    const complete = buildAnalysisProfile(true, false);
    const deep = buildAnalysisProfile(true, true);

    expect(quick).toMatchObject({ id: "quick", wikiMode: "targeted", befundFinalModel: "google/gemini-2.5-flash" });
    expect(complete).toMatchObject({ id: "complete", wikiMode: "complete-map-reduce", therapyModel: "google/gemini-2.5-flash" });
    expect(deep).toMatchObject({ id: "deep-final", befundChunkModel: "google/gemini-2.5-flash", befundFinalModel: "google/gemini-2.5-pro", therapyModel: "google/gemini-2.5-pro" });
    expect(deep.label).toContain("Pro für Befundabschluss und Therapie");
    expect(Object.isFrozen(deep)).toBe(true);
  });

  it("binds the profile to Befund requests, fingerprint, checkpoint and saved report", () => {
    const client = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const edge = readFileSync(resolve(process.cwd(), "supabase/functions/analyze-documents/index.ts"), "utf8");

    expect(client).toContain("const runProfile = { ...buildAnalysisProfile(useMapReduce, useProModel)");
    expect(client).toContain("JSON.stringify(runProfile");
    expect(client).toContain("analysisProfile: runProfile");
    expect(client).toContain("analysis_profile: runProfile");
    expect(client).toContain('htmlFor="befund-analysis-profile"');
    expect(client).toContain("disabled={isAnalyzingDocs || isStreaming || Boolean(docAnalysisHtml)}");
    expect(edge).not.toContain("body.useProModel || totalChars > 60_000");
    expect(edge).toContain('body.analysisProfile.befundChunkModel !== "google/gemini-2.5-flash"');
    expect(edge).toContain('body.analysisProfile.befundFinalModel !== model');
    expect(edge).toContain('"X-Analysis-Profile"');
  });

  it("keeps the same profile in therapy request, candidate and final plan", () => {
    const client = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const edge = readFileSync(resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"), "utf8");

    expect(client).toContain("const [therapyRunProfile, setTherapyRunProfile]");
    expect(client).toContain("setTherapyRunProfile(runProfile)");
    expect(client).toContain("buildInputData({ autoSavedDraft: false, analysisProfile: runProfile })");
    expect(client).toContain("analysisProfile: therapyRunProfile");
    expect(client).toContain('title: "Analyseprofil fehlt"');
    expect(client).toContain('title: "Analyseprofil stimmt nicht überein"');
    expect(edge).toContain("analysisProfile.therapyModel !== expectedTherapyModel");
    expect(edge).toContain("analysisProfile.wikiMode !== expectedWikiMode");
    expect(edge).toContain("analysisProfile: analysisProfile || null");
  });
});
