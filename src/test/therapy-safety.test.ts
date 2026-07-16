import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTherapyMarkdown } from "@/lib/therapyParser";
import { assessRemedyWithWikiSafety, assessSelectedCombinationSafety, buildInitialRemedySelection, buildRemedySafetyMap, patientOutputRestrictionsForRemedy } from "@/lib/therapySelection";
import { assessRemedySafety, buildSafetyContextWarnings } from "../../supabase/functions/_shared/therapySafety";

describe("therapy safety", () => {
  it("keeps the edge prompt candidate-based and privacy-gated", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"), "utf8");
    expect(source).toContain("INTERNE naturheilkundliche KANDIDATENLISTE");
    expect(source).toContain("deidentifyClinicalData(await req.json())");
    expect(source).toContain("directIdentifierCategories(JSON.stringify(requestBody))");
    expect(source).toContain("Hoechstens 3 essentielle und 3 empfohlene Kernkandidaten");
    expect(source).not.toContain("forcedWikiRemedySection");
    expect(source).not.toContain("nimm es trotzdem auf");
    expect(source).not.toContain("ca. 600 % wirksamer");
    expect(source).not.toContain("ABSOLUT VERBOTENE FORMULIERUNGEN");
    expect(source).toContain("bei dokumentiertem Prostatakarzinom oder Androgendeprivation niemals automatisch als Kernkandidat");
  });

  it("keeps wiki-product links admin-only and reviewed before AI use", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260715155222_728b55a8-4b41-4449-9e5b-976c711ed4ed.sql"), "utf8");
    const edgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"), "utf8");

    expect(migration).toContain("ALTER TABLE public.knowledge_product_links ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(migration).toContain("patient_facing_allowed boolean NOT NULL DEFAULT false");
    expect(migration).toContain("CHECK (review_status IN ('needs_review', 'reviewed', 'restricted'))");
    expect(edgeSource).toContain('.eq("review_status", "reviewed")');
    expect(edgeSource).toContain('entry.review_status !== "restricted"');
    expect(edgeSource).toContain("kein Wirksamkeitsnachweis");
    expect(migration).toContain("'therapy_candidate_draft'");
    expect(migration).toContain("reviewed_by uuid");
    expect(migration).toContain("admin_knowledge_base_patient_release_check");
    expect(migration).toContain("NEW.reviewed_by := auth.uid()");
    expect(migration).toContain("'safetyReview', CASE");
  });

  it("keeps generated candidates distinct from finalized therapy plans", () => {
    const recommendationSource = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const overviewSource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/TherapyPatientOverview.tsx"), "utf8");
    const historySource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/PseudonymHistory.tsx"), "utf8");
    const overviewEdgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/list-therapy-pseudonyms/index.ts"), "utf8");

    expect(recommendationSource).toContain('kind: "therapy_candidate_draft"');
    expect(recommendationSource).toContain('kind: "therapy_plan_finalized"');
    expect(overviewSource).toContain('session.kind === "therapy_candidate_draft"');
    expect(historySource).toContain("KI-Rohentwurf · nicht finalisiert");
    expect(overviewEdgeSource).toContain('"therapy_candidate_draft"');
    expect(overviewEdgeSource).toContain("row.eingabe_daten?.autoSavedDraft");
  });

  it("merges repeated category blocks and duplicate remedy names", () => {
    const parsed = parseTherapyMarkdown([
      "## Vitamine",
      "- **Vitamin C** | 1 | oral | 1 Woche | Empfohlen | - | kurz",
      "## Mineralstoffe",
      "- **Magnesium** | 1 | oral | 1 Woche | Empfohlen | - | Grund",
      "## Vitamine",
      "- **Vitamin C** | 1 | oral | 1 Woche | Essentiell | - | ausfuehrlichere Begruendung",
    ].join("\n"));

    expect(parsed.categories).toHaveLength(2);
    expect(parsed.categories[0].remedies).toHaveLength(1);
    expect(parsed.categories[0].remedies[0]).toEqual(expect.objectContaining({
      name: "Vitamin C",
      priority: "essential",
      reason: "ausfuehrlichere Begruendung",
    }));
  });

  it("blocks liquorice from automatic selection when hypertension is documented", () => {
    for (const name of ["Süßholz", "Suessholz", "Lakritz"]) {
      const warnings = assessRemedySafety(name, {
        conditions: "Arterielle Hypertonie",
        medications: "Ramipril 5 mg",
      });
      expect(warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "liquorice-hypertension", severity: "avoid" }),
      ]));
    }
  });

  it("enforces structured wiki safety and patient-output metadata", () => {
    const wikiEntries = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testmittel",
      reviewStatus: "reviewed",
      dosageStatus: "verified",
      contraindications: ["Hypertonie"],
      interactionTags: [],
      patientFacingAllowed: false,
      commercialClaimsReviewed: false,
      productLinks: [],
    }];
    const warnings = assessRemedyWithWikiSafety("Testmittel", { conditions: "Bluthochdruck", medications: "keine Medikamente" }, wikiEntries);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-contraindication", severity: "avoid" }),
    ]));
    expect(patientOutputRestrictionsForRemedy("Testmittel", wikiEntries)).toHaveLength(2);
    expect(assessRemedyWithWikiSafety("Testmittel", { medications: "keine Medikamente" }, wikiEntries, "", true)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-source-id-missing", severity: "avoid" }),
    ]));
    const combinationParsed = parseTherapyMarkdown([
      "## Phytotherapie",
      "- **Testmittel** | 1 | oral | 1 Woche | Empfohlen | - | Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Anderes Produkt** | 1 | oral | 1 Woche | Empfohlen | - | Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    expect(assessSelectedCombinationSafety(
      combinationParsed,
      new Set(["0|0", "0|1"]),
      [{ ...wikiEntries[0], contraindications: [], productLinks: [{ productName: "Anderes Produkt", relationType: "do_not_combine", reviewStatus: "reviewed", safetyNotes: "Nicht kombinieren" }] }],
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-product-do-not-combine", severity: "avoid" }),
    ]));
  });

  it("warns about bleeding-relevant remedies with anticoagulants", () => {
    const warnings = assessRemedySafety("Mannayan Curcu Forte +", {
      medications: "Apixaban (Eliquis) 5 mg 1-0-1",
    });
    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bleeding-medication", severity: "review" }),
    ]));
  });

  it("shows source, review, evidence, dosage and interaction metadata for each Wiki candidate", () => {
    const categorySource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/CategoryCard.tsx"), "utf8");
    const recommendationSource = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");

    for (const label of ["Wiki-ID:", "Review:", "Evidenz:", "Dosierung:", "Kontraindikationen:", "Interaktionen:"]) {
      expect(categorySource).toContain(label);
    }
    expect(categorySource).toContain("wikiEntry?.safetyNotes");
    expect(recommendationSource).toContain("wikiEntries={wikiRemedies}");
  });

  it("blocks testosterone-supporting candidates from automatic selection in prostate cancer or ADT context", () => {
    const context = {
      conditions: "Prostatakarzinom, Zustand nach Behandlung",
      medications: "Leuprorelin Depot laufend",
    };
    for (const remedy of ["Maca", "DHEA", "Testosteron Support", "Tribulus terrestris"]) {
      expect(assessRemedySafety(remedy, context)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "prostate-cancer-testosterone-support", severity: "avoid" }),
      ]));
    }
    expect(buildSafetyContextWarnings(context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "prostate-cancer-hormonal-candidate-review" }),
    ]));
    expect(assessRemedySafety("Maca", {
      conditions: "Prostatakarzinom ausgeschlossen",
      medications: "keine Medikamente",
    })).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "prostate-cancer-testosterone-support" }),
    ]));
  });

  it("requires manual medication review when no known active ingredient is recognized", () => {
    expect(buildSafetyContextWarnings({ medications: "Unbekannte Tablette morgens" })).toEqual([
      expect.objectContaining({ id: "unrecognized-medication-list" }),
    ]);
  });

  it("selects at most three essential and three recommended safe candidates", () => {
    const parsed = parseTherapyMarkdown([
      "## Vitamine",
      "- **Vitamin C** | 1 | oral | 1 Woche | Essentiell | - | A [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Vitamin D** | 1 | oral | 1 Woche | Essentiell | - | B [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Vitamin B12** | 1 | oral | 1 Woche | Essentiell | - | C [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Lakritz** | 1 | oral | 1 Woche | Essentiell | - | D [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Magnesium** | 1 | oral | 1 Woche | Empfohlen | - | E [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Zink** | 1 | oral | 1 Woche | Empfohlen | - | F [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Selen** | 1 | oral | 1 Woche | Empfohlen | - | G [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Omega 3** | 1 | oral | 1 Woche | Empfohlen | - | H [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Optionales Mittel** | 1 | oral | 1 Woche | Optional | - | I [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    const context = { conditions: "Bluthochdruck", medications: "Ramipril 5 mg" };
    const wiki = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testquelle",
      reviewStatus: "reviewed",
      evidenceLevel: "moderate",
      dosageStatus: "verified",
      productLinks: ["Vitamin C", "Vitamin D", "Vitamin B12", "Lakritz", "Magnesium", "Zink", "Selen", "Omega 3", "Optionales Mittel"].map((productName) => ({ productName, relationType: "exact_product", reviewStatus: "reviewed" })),
    }];
    const selected = buildInitialRemedySelection(parsed, context, wiki);
    const warnings = buildRemedySafetyMap(parsed, context, wiki);

    expect(selected.size).toBe(6);
    expect(selected.has("0|3")).toBe(false);
    expect(warnings.get("0|3")?.[0].id).toBe("liquorice-hypertension");
    expect(selected.has("0|8")).toBe(false);
  });

  it("does not auto-select a candidate with unrated evidence even if the Wiki review is otherwise complete", () => {
    const parsed = parseTherapyMarkdown([
      "## Phytotherapie",
      "- **Testmittel** | 1 | oral | 1 Woche | Essentiell | - | Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    const wiki = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testmittel",
      reviewStatus: "reviewed",
      evidenceLevel: "unrated",
      dosageStatus: "verified",
    }];
    const context = { medications: "Ramipril 5 mg" };

    expect(buildInitialRemedySelection(parsed, context, wiki).size).toBe(0);
    expect(buildRemedySafetyMap(parsed, context, wiki).get("0|0")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-evidence-unrated", severity: "review" }),
    ]));
  });
});
