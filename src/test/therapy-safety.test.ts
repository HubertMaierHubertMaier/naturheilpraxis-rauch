import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTherapyMarkdown } from "@/lib/therapyParser";
import { parseBulkPaste } from "@/components/admin/therapy/PathogenInput";
import { assessRemedyWithWikiSafety, assessSelectedCombinationSafety, buildInitialRemedySelection, buildRemedySafetyMap, MAX_START_PLAN_REMEDIES, patientOutputRestrictionsForRemedy } from "@/lib/therapySelection";
import { assessRemedySafety, buildSafetyContextWarnings } from "../../supabase/functions/_shared/therapySafety";

describe("therapy safety", () => {
  it("keeps the structure verification fixture synthetic and privacy-safe", () => {
    const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "docs/therapy-recommendation-structure-synthetic-case-2026-08-18.json"), "utf8"));
    expect(fixture.syntheticOnly).toBe(true);
    expect(fixture.containsPatientData).toBe(false);
    expect(fixture.expectedPerRemedyFields).toEqual(expect.arrayContaining([
      "Hersteller/Firma",
      "Einfache Patientenerklaerung",
      "Gefahren/Gegenanzeigen/Wechselwirkungen",
    ]));
    expect(fixture.forbiddenOutcomes).toContain("Patientenausgabe ohne fachliche und datenschutzbezogene Freigabe");
  });

  it("keeps the edge prompt candidate-based and privacy-gated", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"), "utf8");
    expect(source).toContain("INTERNE naturheilkundliche KANDIDATENLISTE");
    expect(source).toContain("deidentifyClinicalData(await req.json())");
    expect(source).toContain("directIdentifierCategories(JSON.stringify(requestBody))");
    expect(source).toContain("Hoechstens 3 essentielle und 3 empfohlene Kernkandidaten");
    expect(source).toContain('.from("kb_articles")');
    expect(source).toContain('.from("kb_article_revisions")');
    expect(source).toContain("Der Startplan darf hoechstens 3 gleichzeitig neu beginnende Mittel enthalten");
    expect(source).toContain("Ein vollstaendiger interner Therapieentwurf MUSS alle folgenden Abschnitte enthalten");
    expect(source).toContain("## 🥗 Ernährung");
    expect(source).toContain("## 🚶 Verhalten & Alltag");
    expect(source).toContain("## 📈 Verlaufskontrolle");
    expect(source).toContain("### 🧬 Aminosäuren");
    expect(source).toContain("### 🦠 Pathogenbezogene Mittel (NutraMedix)");
    expect(source).toContain("### 🩹 Symptombezogene Mittel");
    expect(source).toContain("### 🧴 Vitaplace-Apothekenprodukte");
    expect(source).toContain("## 📈 Vieva-Auswertung");
    expect(source).toContain("## 🦠 Metatron-Pathogene und Therapieprüfung");
    expect(source).toContain("### Candida: Ernährung und Zapper-Prüfung");
    expect(source).toContain("[INFOTHEK:candida-diaet.html]");
    expect(source).toContain("Nur wenn in den Eingaben ausdrücklich dokumentiert ist, dass die Person einen kompatiblen Zapper besitzt");
    expect(source).toContain("Fehlt die Zapper-Angabe, CAN-Chip nicht empfehlen");
    expect(source).toContain("nicht als \"Entfernung\" oder gesicherte Eradikation formulieren");
    expect(source).toContain("Dauer, Energie- und Nährstoffversorgung");
    expect(source).toContain("## 🌿 Metatron-Bakterienprotokoll");
    expect(source).toContain("Tage 1 bis 10 Mannayan Oregano-Kapseln mit insgesamt 2 Kapseln pro Tag");
    expect(source).toContain("Tage 11 bis 30 oregano-frei und Banderol mit insgesamt 20 Tropfen pro Tag");
    expect(source).toContain("Oregano und Banderol nicht gleichzeitig ansetzen");
    expect(source).toContain("[PETER_PRAXISSCHEMA:2026-08-26]");
    expect(source).toContain("Viren, Pilze und Parasiten allein lösen es nicht aus");
    expect(source).toContain("### Candida-Diät");
    expect(source).toContain("[INFOTHEK:candida-diaet.html]");
    expect(source).toContain("vollständig meiden, nur mäßig, erlaubt und Getränke");
    expect(source).toContain("Die Formulierung \"Entfernung des Candida-Pilzes\" als Quellenwortlaut erhalten");
    expect(source).toContain("CAN (Candida-Chip)");
    expect(source).toContain("bei fehlender Zapper-Angabe CAN nicht nennen");
    expect(source).toContain("[INFOTHEK:zapper-diamond-shield.html]");
    expect(source).toContain("## 🌾 Allergien und Unverträglichkeiten");
    expect(source).toContain("[INFOTHEK:allergiebehandlung.html]");
    expect(source).toContain("[INFOTHEK:ass-salicylat-histamin.html]");
    expect(source).toContain("DHISTA bei passendem Allergie-/Histaminkontext");
    expect(source).toContain("IAKU bei fachlich passendem Haut-, Nahrungsmittelunverträglichkeits- oder Insektenstich-Kontext");
    expect(source).toContain("Biotik Sensitiv Pulver nur bei Nahrungsmittelunverträglichkeit mit dokumentiertem Darm-, Mikrobiom- oder Barrierebezug");
    expect(source).toContain("Für DHISTA liegt keine konkrete Dosis vor");
    expect(source).toContain("LOGI-orientierte Kost grundsätzlich als anpassbaren Praxis-Basisbaustein");
    expect(source).toContain("[INFOTHEK:logi-ernaehrung-mitochondrien.html]");
    expect(source).toContain("## 🌸 Psychoemotionale Metatron-Auswertung & Bachblüten");
    expect(source).toContain("### 🌌 Metatron-Homöopathie");
    expect(source).toContain("Bachblüten ausschließlich übernehmen, wenn sie in der Metatron-Auswertung ausdrücklich genannt sind");
    expect(source).toContain("zuerst fachlich passende, geprüfte Mannayan-Produkte");
    expect(source).toContain("danach vorhandene passende Vitaplace-Apothekenprodukte");
    expect(source).toContain("NutraMedix nur bei einem passenden geprüften Wiki-Beleg");
    expect(source).toContain("Hersteller/Firma | Dosierung");
    expect(source).toContain("Einfache Patientenerklärung | Gefahren / Gegenanzeigen / Wechselwirkungen");
    expect(source).toContain("Suessholz bei dokumentiertem Bluthochdruck nicht als Kernkandidat");
    expect(source).not.toContain('.from("admin_knowledge_base")');
    expect(source).not.toContain("forcedWikiRemedySection");
    expect(source).not.toContain("nimm es trotzdem auf");
    expect(source).not.toContain("ca. 600 % wirksamer");
    expect(source).not.toContain("ABSOLUT VERBOTENE FORMULIERUNGEN");
    expect(source).toContain("bei dokumentiertem Prostatakarzinom oder Androgendeprivation niemals automatisch als Kernkandidat");
    expect(source).toContain("normalizeTherapyKnowledgeSearchText");
    expect(source).toContain("const sameEntry = (a: WikiEntry, b: WikiEntry) => a.id === b.id");
    expect(source).toContain("const wordScoreTokens = tokenizeQuery(scoringQueryText)");
    expect(source).toContain("scoreMap.set(e.id, sc)");
    expect(source).toContain("const aiScore = aiScores.get(e.id)");
    expect(source).toContain("includedEntryIds");
    expect(source).toContain("Finales Kontextlimit erreicht – vollständiger Eintrag nicht gesendet");
    expect(source).toContain("[WIKI-AUSZUG GEKUERZT: Originaleintrag");
    expect(source).toContain("der vollstaendige Text bleibt im internen Wiki erhalten");
    expect(source).toContain("MAX_KNOWLEDGE_QUERY_TOKENS = 256");
    expect(source).toContain("scoreEntriesViaAI(restPool, queryText, LOVABLE_API_KEY)");
    expect(source).not.toContain("context = context.slice(0, MAX_TOTAL_CHARS)");
    expect(source).not.toContain("return combined.slice(0, MAX_ENTRY_CHARS)");
    expect(source).not.toContain("Boost-Ordner (garantiert)");
  });

  it("parses Vieva, Metatron pathogen, bacterial protocol, psychoemotional, and Metatron homeopathy chapters separately", () => {
    const parsed = parseTherapyMarkdown([
      "## Vieva-Auswertung",
      "Vitamin- und Aminosäureangaben wurden gegen den synthetischen Kontext geprüft.",
      "## Metatron-Pathogene und Therapieprüfung",
      "Ein synthetischer Resonanzhinweis ist kein Infektionsnachweis.",
      "## Metatron-Bakterienprotokoll",
      "Ein synthetischer Phasenplan bleibt intern und sicherheitsgeprüft.",
      "## Allergien und Unverträglichkeiten",
      "Eine synthetische Patientenangabe bleibt von einem Resonanzhinweis getrennt.",
      "## Psychoemotionale Metatron-Auswertung & Bachblüten",
      "Eine ausdrücklich genannte synthetische Emotion bleibt Quellenhinweis und keine Diagnose.",
      "### Metatron-Homöopathie",
      "- **Synthetisches Mittel** | nicht belegt | Dosierung manuell prüfen | oral | Verlauf prüfen | 🟢 Optional | unbekannt | Teilweise passend zum synthetischen Symptom; Metatron-Quelle. [WIKI_ID:00000000-0000-0000-0000-000000000000] | Wird nur intern geprüft. | Sicherheit individuell prüfen",
    ].join("\n"));

    expect(parsed.intro.map((section) => section.title)).toEqual(expect.arrayContaining([
      "Vieva-Auswertung",
      "Metatron-Pathogene und Therapieprüfung",
      "Metatron-Bakterienprotokoll",
      "Allergien und Unverträglichkeiten",
      "Psychoemotionale Metatron-Auswertung & Bachblüten",
    ]));
    expect(parsed.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Metatron-Homöopathie",
        remedies: [expect.objectContaining({ name: "Synthetisches Mittel", priority: "optional" })],
      }),
    ]));
  });

  it("passes the completed Befund-Auswertung into the structured therapy workflow", () => {
    const recommendationSource = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const edgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"), "utf8");

    expect(recommendationSource).toContain("extractClinicalReportText(docAnalysisHtml)");
    expect(recommendationSource).toContain("befundAuswertung: befundAuswertungText || undefined");
    expect(edgeSource).toContain("befundAuswertung");
    expect(edgeSource).toContain("VORHANDENE BEFUND-AUSWERTUNG – PRIMÄRER ZUSAMMENFASSENDER KONTEXT");
    expect(edgeSource).toContain("befundAuswertungChars");
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
    const vitaminC = parsed.categories[0].remedies[0];
    expect(vitaminC).toEqual(expect.objectContaining({
      name: "Vitamin C",
      priority: "essential",
    }));
    expect(vitaminC.reason).toContain("kurz");
    expect(vitaminC.reason).toContain("ausfuehrlichere Begruendung");
  });

  it("keeps every distinct warning when duplicate remedy rows are merged", () => {
    const parsed = parseTherapyMarkdown([
      "## Hausmittel & Gewürze",
      "- **Süßholz** (Glycyrrhiza glabra) | Firma A | 1×1 | oral | 1 Woche | Empfohlen | 10 € | Erster Befundbezug. | Erste Erklärung. | Nicht bei Bluthochdruck.",
      "## Phytotherapie",
      "- **Suessholz** (Glycyrrhiza uralensis) | Firma B | 2×1 | als Tee | 2 Wochen | Optional | 15 € | Zweiter Befundbezug. | Zweite Erklärung. | Wechselwirkungen zusätzlich prüfen.",
    ].join("\n"));

    expect(parsed.categories).toHaveLength(1);
    const remedy = parsed.categories[0].remedies[0];
    expect(remedy.reason).toContain("Erster Befundbezug.");
    expect(remedy.reason).toContain("Zweiter Befundbezug.");
    expect(remedy.patientExplanation).toContain("Erste Erklärung.");
    expect(remedy.patientExplanation).toContain("Zweite Erklärung.");
    expect(remedy.safety).toContain("Nicht bei Bluthochdruck.");
    expect(remedy.safety).toContain("Wechselwirkungen zusätzlich prüfen.");
    expect(remedy.latin).toContain("Glycyrrhiza glabra");
    expect(remedy.latin).toContain("Glycyrrhiza uralensis");
    expect(remedy.manufacturer).toContain("Firma A");
    expect(remedy.manufacturer).toContain("Firma B");
    expect(remedy.dosage).toContain("1×1");
    expect(remedy.dosage).toContain("2×1");
    expect(remedy.application).toContain("oral");
    expect(remedy.application).toContain("als Tee");
    expect(remedy.duration).toContain("1 Woche");
    expect(remedy.duration).toContain("2 Wochen");
    expect(remedy.priority).toBe("recommended");
    expect(remedy.priorityRaw).toContain("Empfohlen");
    expect(remedy.priorityRaw).toContain("Optional");
    expect(remedy.cost).toContain("10 €");
    expect(remedy.cost).toContain("15 €");
  });

  it("keeps current structured columns aligned when the priority label is unknown", () => {
    const parsed = parseTherapyMarkdown([
      "## Enzyme aus der Wissensdatenbank",
      "- **Testenzym** | Musterfirma | Dosierung fachlich prüfen | oral | Verlauf prüfen | Nicht empfohlen | unbekannt | Interner Befundbezug. | Einfache Erklärung. | Bei ungeklärten Wechselwirkungen nicht empfohlen.",
    ].join("\n"));

    expect(parsed.categories[0].remedies[0]).toEqual(expect.objectContaining({
      name: "Testenzym",
      manufacturer: "Musterfirma",
      dosage: "Dosierung fachlich prüfen",
      application: "oral",
      duration: "Verlauf prüfen",
      priority: "unknown",
      priorityRaw: "Nicht empfohlen",
      cost: "unbekannt",
      reason: "Interner Befundbezug.",
      patientExplanation: "Einfache Erklärung.",
      safety: "Bei ungeklärten Wechselwirkungen nicht empfohlen.",
    }));
  });

  it("never treats extended negative priority phrases as positive recommendations", () => {
    for (const priority of ["Nicht empfohlen", "Nicht automatisch empfohlen", "Nicht als Kernkandidat empfohlen", "Keinesfalls essentiell", "Weder empfohlen noch optional"]) {
      const parsed = parseTherapyMarkdown([
        "## Enzyme aus der Wissensdatenbank",
        `- **Testenzym** | Musterfirma | Dosierung fachlich prüfen | oral | Verlauf prüfen | ${priority} | unbekannt | Interner Befundbezug. | Einfache Erklärung. | Fachlich prüfen.`,
      ].join("\n"));

      expect(parsed.categories[0].remedies[0]).toEqual(expect.objectContaining({
        priority: "unknown",
        priorityRaw: priority,
        manufacturer: "Musterfirma",
        cost: "unbekannt",
      }));
    }
  });

  it("keeps amino acids separate and parses the manufacturer in the structured row", () => {
    const parsed = parseTherapyMarkdown([
      "## Aminosäuren",
      "- **L-Lysin** | Musterfirma | 2×1 Kapsel | oral | 4 Wochen | Empfohlen | ~20 € | Befundbezug. [WIKI_ID:11111111-1111-4111-8111-111111111111] | Einfache Erklärung. | Bei Unverträglichkeit pausieren.",
      "## Fettsäuren",
      "- **Omega-3** | Andere Firma | 1×1 Kapsel | oral | 8 Wochen | Optional | ~25 € | Befundbezug. [WIKI_ID:22222222-2222-4222-8222-222222222222] | Einfache Erklärung. | Blutverdünnung prüfen.",
    ].join("\n"));

    expect(parsed.categories.map((category) => category.title)).toEqual(["Aminosäuren", "Fettsäuren"]);
    expect(parsed.categories[0].remedies[0]).toEqual(expect.objectContaining({
      name: "L-Lysin",
      manufacturer: "Musterfirma",
      dosage: "2×1 Kapsel",
      priority: "recommended",
      patientExplanation: "Einfache Erklärung.",
      safety: "Bei Unverträglichkeit pausieren.",
    }));
  });

  it("renders additional database categories as structured remedy groups", () => {
    const parsed = parseTherapyMarkdown([
      "## Enzyme aus der Wissensdatenbank",
      "- **Belegtes Enzym** | Musterfirma | Dosierung manuell prüfen | oral | Verlauf prüfen | Optional | unbekannt | Befundbezug. [WIKI_ID:33333333-3333-4333-8333-333333333333] | Einfache Erklärung. | Individuell prüfen.",
    ].join("\n"));

    expect(parsed.categories).toEqual([
      expect.objectContaining({ title: "Enzyme aus der Wissensdatenbank", remedies: [expect.objectContaining({ name: "Belegtes Enzym" })] }),
    ]);
  });

  it("does not mistake a pipe-formatted review list for a remedy category", () => {
    const parsed = parseTherapyMarkdown([
      "## Prüfung der eingebrachten Therapie/Verordnung",
      "- Mittel | Herkunft | Patiententhema | Bewertung | Begründung | Anpassung",
    ].join("\n"));

    expect(parsed.categories).toHaveLength(0);
    expect(parsed.intro).toEqual([
      expect.objectContaining({ title: "Prüfung der eingebrachten Therapie/Verordnung" }),
    ]);
  });

  it("keeps therapy goals, nutrition and behaviour as separate plan sections", () => {
    const parsed = parseTherapyMarkdown([
      "## 🎯 Priorisierung & Therapieziele",
      "1. Erstes Ziel",
      "## 🥗 Ernährung",
      "- Erste Massnahme",
      "## 🚶 Verhalten & Alltag",
      "- Zweite Massnahme",
      "## 📈 Verlaufskontrolle",
      "- Nach vier Wochen fachlich kontrollieren",
    ].join("\n"));

    expect(parsed.intro.map((section) => section.title)).toContain("Priorisierung & Therapieziele");
    expect(parsed.outro.map((section) => section.title)).toEqual(expect.arrayContaining(["Ernährung", "Verhalten & Alltag", "Verlaufskontrolle"]));
  });

  it("parses the advertised spaced-hyphen pathogen format", () => {
    expect(parseBulkPaste("Borrelia burgdorferi - Gel, ZNS, Hz")).toEqual([
      expect.objectContaining({ name: "Borrelia burgdorferi", organe: "Gelenke, Zentrales Nervensystem, Herz" }),
    ]);
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
      entryKind: "remedy",
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

  it("matches German remedy spelling variants and counts a repeated Wiki ID only once", () => {
    const wikiEntries = [{
      id: "44444444-4444-4444-8444-444444444444",
      title: "Süßholz",
      entryKind: "remedy",
      reviewStatus: "reviewed",
      evidenceLevel: "moderate",
      dosageStatus: "verified",
      contraindications: ["Hypertonie"],
      productLinks: [],
    }];
    const warnings = assessRemedyWithWikiSafety(
      "Suessholz",
      { conditions: "Bluthochdruck", medications: "Ramipril 5 mg" },
      wikiEntries,
      "Quelle A [WIKI_ID:44444444-4444-4444-8444-444444444444] | Quelle B [WIKI_ID:44444444-4444-4444-8444-444444444444]",
      true,
    );

    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-contraindication", severity: "avoid" }),
    ]));
    expect(warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-source-id-missing" }),
    ]));
    expect(warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-source-remedy-mismatch" }),
    ]));
  });

  it("keeps distinct Wiki warning details that share the same warning class", () => {
    const warnings = assessRemedyWithWikiSafety("Testmittel", {}, [
      { title: "Testmittel", entryKind: "remedy", reviewStatus: "needs_review", evidenceLevel: "moderate", dosageStatus: "verified" },
      { title: "Testmittel", entryKind: "remedy", reviewStatus: "draft", evidenceLevel: "moderate", dosageStatus: "verified" },
    ]);
    const reviewWarning = warnings.find((warning) => warning.id === "wiki-unreviewed");

    expect(reviewWarning?.message).toContain("needs_review");
    expect(reviewWarning?.message).toContain("draft");
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
    const printSource = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/printRecipe.ts"), "utf8");

    for (const label of ["Wiki-ID:", "Art:", "Review:", "Evidenz:", "Dosierung:", "Kontraindikationen:", "Interaktionen:"]) {
      expect(categorySource).toContain(label);
    }
    expect(categorySource).toContain("wikiEntry?.safetyNotes");
    expect(categorySource).toContain("Für den Patienten:");
    expect(categorySource).toContain("Gefahren / Gegenanzeigen:");
    expect(recommendationSource).toContain("wikiEntries={wikiRemedies}");
    expect(printSource).toContain("withoutInternalSourceMarkers");
    expect(printSource).toContain("INFOTHEK-AUSZUG");
    expect(printSource).toContain("WIKI-AUSZUG GEKUERZT");
    expect(printSource).toContain('r.patientExplanation || clinicalReason');
    expect(printSource).toContain("r.safety");
    expect(printSource).toContain('isPraxis ? r.reason : withoutInternalSourceMarkers(r.reason)');
    expect(printSource).toContain('withoutInternalSourceMarkers(m.patientExplanation || m.reason || "")');
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
    expect(assessRemedySafety("DHEA", {
      conditions: "Prostatakarzinom 2020 ausgeschlossen; Prostatakarzinom 2024 gesichert",
      medications: "keine Medikamente",
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "prostate-cancer-testosterone-support", severity: "avoid" }),
    ]));
  });

  it("requires manual medication review when no known active ingredient is recognized", () => {
    expect(buildSafetyContextWarnings({ medications: "Unbekannte Tablette morgens" })).toEqual([
      expect.objectContaining({ id: "unrecognized-medication-list" }),
    ]);
  });

  it("selects at most three safe remedies for the initial phase", () => {
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

    expect(selected.size).toBe(MAX_START_PLAN_REMEDIES);
    expect(MAX_START_PLAN_REMEDIES).toBe(3);
    expect(selected.has("0|3")).toBe(false);
    expect(warnings.get("0|3")?.[0].id).toBe("liquorice-hypertension");
    expect(selected.has("0|8")).toBe(false);
  });

  it("fills remaining initial-phase slots with recommended remedies", () => {
    const parsed = parseTherapyMarkdown([
      "## Mineralstoffe",
      "- **Magnesium** | 1 | oral | 1 Woche | Essentiell | - | A [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Zink** | 1 | oral | 1 Woche | Essentiell | - | B [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Selen** | 1 | oral | 1 Woche | Empfohlen | - | C [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      "- **Kalium** | 1 | oral | 1 Woche | Empfohlen | - | D [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    const wiki = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testquelle",
      reviewStatus: "reviewed",
      evidenceLevel: "moderate",
      dosageStatus: "verified",
      productLinks: ["Magnesium", "Zink", "Selen", "Kalium"].map((productName) => ({ productName, relationType: "exact_product", reviewStatus: "reviewed" })),
    }];

    expect(Array.from(buildInitialRemedySelection(parsed, {}, wiki))).toEqual(["0|0", "0|1", "0|2"]);
  });

  it("does not auto-select a candidate with unrated evidence even if the Wiki review is otherwise complete", () => {
    const parsed = parseTherapyMarkdown([
      "## Phytotherapie",
      "- **Testmittel** | 1 | oral | 1 Woche | Essentiell | - | Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    const wiki = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testmittel",
      entryKind: "remedy",
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

  it("does not auto-select a remedy without verified dosage metadata", () => {
    const parsed = parseTherapyMarkdown([
      "## Phytotherapie",
      "- **Testmittel** | Dosierung manuell prüfen | oral | Verlauf prüfen | Essentiell | - | Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
    ].join("\n"));
    const wiki = [{
      id: "11111111-1111-4111-8111-111111111111",
      title: "Testmittel",
      entryKind: "remedy",
      reviewStatus: "reviewed",
      evidenceLevel: "moderate",
    }];

    expect(buildInitialRemedySelection(parsed, {}, wiki).size).toBe(0);
    expect(buildRemedySafetyMap(parsed, {}, wiki).get("0|0")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-dosage-unverified", severity: "review" }),
    ]));
    expect(patientOutputRestrictionsForRemedy(
      "Testmittel",
      wiki,
      "Quelle [WIKI_ID:11111111-1111-4111-8111-111111111111]",
      true,
    )).toContain("Testmittel: Dosierung nicht verifiziert");
  });

  it("does not auto-select diagnostic or reference Wiki entries as remedies", () => {
    const parsed = parseTherapyMarkdown([
      "## Spezialpräparate",
      "- **Diagnostik-Eintrag** | 1 | oral | 1 Woche | Essentiell | - | Quelle [WIKI_ID:22222222-2222-4222-8222-222222222222]",
    ].join("\n"));
    const wiki = [{
      id: "22222222-2222-4222-8222-222222222222",
      title: "Diagnostik-Eintrag",
      entryKind: "diagnostic",
      reviewStatus: "reviewed",
      evidenceLevel: "clinical",
      dosageStatus: "not_applicable",
    }];
    const context = { medications: "Ramipril 5 mg" };

    expect(buildInitialRemedySelection(parsed, context, wiki).size).toBe(0);
    expect(buildRemedySafetyMap(parsed, context, wiki).get("0|0")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wiki-entry-kind-ineligible", severity: "avoid" }),
    ]));
  });
});
