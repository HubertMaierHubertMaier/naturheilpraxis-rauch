import { describe, expect, it } from "vitest";
import {
  buildProvisionalTherapyHierarchy,
  formatProvisionalTherapyHierarchy,
  selectProvisionalHierarchyContext,
  type ProvisionalHierarchyEntry,
} from "../../supabase/functions/_shared/provisionalTherapyHierarchy";

function entry(overrides: Partial<ProvisionalHierarchyEntry>): ProvisionalHierarchyEntry {
  return {
    id: crypto.randomUUID(),
    title: "Testeintrag",
    category: "Praxiswissen",
    tags: [],
    content: "",
    entry_kind: "reference",
    review_status: "unreviewed",
    evidence_level: "unrated",
    dosage_status: "unverified",
    source_citations: [],
    commercial_claims_reviewed: false,
    ...overrides,
  };
}

describe("provisional therapy hierarchy", () => {
  it("puts Klinghardt first and includes Diamond Shield only for an explicit pathogen match", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([
      entry({ title: "Klinghardt-Protokoll Borrelien", content: "Borrelien und Fatigue", tags: ["Klinghardt"] }),
      entry({ title: "BO 2-ChipCard - Borreliose 2", category: "Naturheilpraxis Peter Rauch > Chip Cards", tags: ["Diamond Shield", "Borreliose"], entry_kind: "equipment" }),
      entry({ title: "AIM-ChipCard", category: "Naturheilpraxis Peter Rauch > Chip Cards", tags: ["Diamond Shield", "Autoimmun"], entry_kind: "equipment" }),
      entry({ title: "Samento", category: "NutraMedix", content: "Borrelien", entry_kind: "product" }),
    ], "Borrelia burgdorferi mit Fatigue");

    expect(hierarchy.map((candidate) => candidate.lane)).toEqual([
      "klinghardt",
      "diamond_pathogen",
      "nutramedix",
    ]);
    expect(hierarchy[1].matches).toContain("Borrelien");
    expect(hierarchy.some((candidate) => candidate.entry.title === "AIM-ChipCard")).toBe(false);
  });

  it("keeps all unreviewed product lines in review-only status and limits Heel to three entries", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([
      ...Array.from({ length: 5 }, (_, index) => entry({
        title: `Heel Mittel ${index + 1}`,
        category: "Homotoxikologie",
        content: "Erschoepfung",
        entry_kind: "product",
      })),
      entry({ title: "Biotik Balance", category: "VitaPlace", content: "Erschoepfung", entry_kind: "product" }),
    ], "Erschoepfung");

    expect(hierarchy.filter((candidate) => candidate.lane === "heel")).toHaveLength(3);
    expect(hierarchy.every((candidate) => candidate.status === "REVIEW_ONLY")).toBe(true);
  });

  it("places matching Diamond candidates on safety hold for pregnancy or a pacemaker", () => {
    const candidates = [entry({
      title: "CAN-ChipCard - Candida",
      category: "Naturheilpraxis Peter Rauch > Chip Cards",
      tags: ["Diamond Shield", "Candida"],
      entry_kind: "equipment",
    })];

    expect(buildProvisionalTherapyHierarchy(candidates, "Candida albicans", { pregnancyStatus: "Ja" })[0]).toEqual(expect.objectContaining({
      status: "SAFETY_HOLD",
    }));
    expect(buildProvisionalTherapyHierarchy(candidates, "Candida albicans", { safetyContext: "Herzschrittmacher vorhanden" })[0].reasons.join(" ")).toContain("Herzschrittmacher");
  });

  it("marks a fully reviewed sourced entry as eligible only for subsequent clinical review", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([entry({
      title: "Biotik Balance",
      category: "VitaPlace Probiotika",
      content: "Bifidobacterium longum",
      entry_kind: "product",
      review_status: "reviewed",
      evidence_level: "clinical",
      dosage_status: "verified",
      source_citations: [{ url: "https://example.test/source" }],
      commercial_claims_reviewed: true,
    })], "Bifidobacterium longum erniedrigt");

    expect(hierarchy[0].status).toBe("ELIGIBLE_FOR_CLINICAL_REVIEW");
    expect(formatProvisionalTherapyHierarchy(hierarchy)).toContain(hierarchy[0].entry.id);
    expect(formatProvisionalTherapyHierarchy(hierarchy)).toContain("https://example.test/source");
  });

  it("keeps at least one relevant candidate from each lane in the compact context", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([
      entry({ title: "Klinghardt Candida", tags: ["Klinghardt"], content: "Candida" }),
      entry({ title: "CAN-ChipCard", category: "Chip Cards", tags: ["Diamond Shield", "Candida"], entry_kind: "equipment" }),
      entry({ title: "NutraMedix Cumanda", category: "NutraMedix", content: "Candida" }),
      entry({ title: "VitaPlace Darm", category: "VitaPlace", content: "Candida" }),
      entry({ title: "Heel Darm", category: "Homotoxikologie", content: "Candida" }),
      entry({ title: "Candida Ernaehrung", category: "Ernaehrung", content: "Candida" }),
      entry({ title: "Vitamin C bei Candida", category: "Vitamine", content: "Candida" }),
      entry({ title: "Zink bei Candida", category: "Mineralstoffe", content: "Candida" }),
      entry({ title: "L-Glutamin bei Candida", category: "Aminosaeuren", content: "Candida" }),
    ], "Candida albicans");
    const compact = selectProvisionalHierarchyContext(hierarchy, 9);

    expect(new Set(compact.map((candidate) => candidate.lane))).toEqual(new Set([
      "klinghardt",
      "diamond_pathogen",
      "nutramedix",
      "vitaplace",
      "heel",
      "nutrition",
      "vitamins",
      "minerals",
      "amino_acids",
    ]));
  });

  it("rejects negated, historical and non-Diamond pathogen cards", () => {
    const diamondCandida = entry({
      title: "CAN-ChipCard - Candida",
      category: "Naturheilpraxis Peter Rauch > Chip Cards",
      tags: ["Diamond Shield", "Candida"],
      entry_kind: "equipment",
    });
    const unrelatedCard = entry({
      title: "Candida ChipCard",
      category: "Andere Frequenzkarten",
      tags: ["Candida"],
      entry_kind: "equipment",
    });

    expect(buildProvisionalTherapyHierarchy([diamondCandida, unrelatedCard], "Candida ausgeschlossen")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([diamondCandida], "Candida vor 10 Jahren, ausgeheilt")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([diamondCandida], "Kein Hinweis auf aktuell aktive Infektion mit Candida")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([diamondCandida], "Candida-PCR ohne Nachweis")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([diamondCandida], "Candida in der Kindheit, vollständig behandelt")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([diamondCandida], "Candida konnte nicht nachgewiesen werden")).toHaveLength(0);
    expect(buildProvisionalTherapyHierarchy([unrelatedCard], "Candida albicans nachgewiesen")).toHaveLength(0);
  });

  it("does not conflate HSV with VZV", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([
      entry({ title: "HSX-ChipCard - Herpes simplex", category: "Chip Cards", tags: ["Diamond Shield", "HSV"], entry_kind: "equipment" }),
      entry({ title: "Herpes-Zoster-ChipCard", category: "Chip Cards", tags: ["Diamond Shield", "VZV", "Zoster"], entry_kind: "equipment" }),
    ], "HSV-1 positiv");

    expect(hierarchy.map((candidate) => candidate.entry.title)).toEqual(["HSX-ChipCard - Herpes simplex"]);
  });

  it("uses pathogen boundaries and keeps hepatitis subtypes distinct", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([
      entry({ title: "Archiv-ChipCard", category: "Diamond Shield Chip Cards", tags: ["Diamond Shield"], entry_kind: "equipment" }),
      entry({ title: "Hep-C-ChipCard", category: "Diamond Shield Chip Cards", tags: ["Diamond Shield", "Hepatitis C", "HCV"], entry_kind: "equipment" }),
    ], "HIV und Hepatitis B nachgewiesen");

    expect(hierarchy).toHaveLength(0);
  });

  it("moves a clinically relevant entry with a matching structured contraindication to safety hold", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([entry({
      title: "NutraMedix Testprodukt",
      category: "NutraMedix",
      content: "Candida",
      entry_kind: "product",
      contraindications: ["Epilepsie"],
    })], "Candida", { safetyContext: "Epilepsie diagnostiziert" });

    expect(hierarchy[0]).toEqual(expect.objectContaining({ status: "SAFETY_HOLD" }));
    expect(hierarchy[0].reasons.join(" ")).toContain("Epilepsie");
  });

  it("collects a matching safety hold even when the entry has no positive relevance", () => {
    const hierarchy = buildProvisionalTherapyHierarchy([entry({
      title: "VitaPlace Magnesium",
      category: "VitaPlace",
      content: "Magnesiumversorgung",
      entry_kind: "product",
      contraindications: ["Epilepsie"],
    })], "Candida", { safetyContext: "Epilepsie diagnostiziert" });

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].status).toBe("SAFETY_HOLD");
  });

  it("does not create Diamond device holds from negated safety conditions", () => {
    const candidate = entry({
      title: "CAN-ChipCard - Candida",
      category: "Diamond Shield Chip Cards",
      tags: ["Diamond Shield", "Candida"],
      entry_kind: "equipment",
    });
    for (const safetyContext of ["Epilepsie ausgeschlossen", "kein Herzschrittmacher vorhanden"]) {
      const hierarchy = buildProvisionalTherapyHierarchy([candidate], "Candida positiv", { safetyContext });
      expect(hierarchy[0].status).not.toBe("SAFETY_HOLD");
    }
  });

  it("collects every safety hold before lane and total limits", () => {
    const candidates = Array.from({ length: 4 }, (_, index) => entry({
      title: `VitaPlace Candida ${index + 1}`,
      category: "VitaPlace",
      content: "Candida",
      entry_kind: "product",
      contraindications: ["Epilepsie"],
    }));
    const hierarchy = buildProvisionalTherapyHierarchy(candidates, "Candida", {
      safetyContext: "Epilepsie diagnostiziert",
      maxTotal: 1,
    });

    expect(hierarchy).toHaveLength(4);
    expect(hierarchy.every((candidate) => candidate.status === "SAFETY_HOLD")).toBe(true);
  });

  it("canonicalizes pregnancy and age for structured contraindications", () => {
    const candidates = [
      entry({ title: "NutraMedix Candida", category: "NutraMedix", content: "Candida", contraindications: ["Schwangerschaft"] }),
      entry({ title: "VitaPlace Candida", category: "VitaPlace", content: "Candida", contraindications: ["Kinder"] }),
    ];
    const hierarchy = buildProvisionalTherapyHierarchy(candidates, "Candida", {
      pregnancyStatus: "Ja",
      age: 12,
    });

    expect(hierarchy).toHaveLength(2);
    expect(hierarchy.every((candidate) => candidate.status === "SAFETY_HOLD")).toBe(true);
  });

  it("requires every review gate independently, including a non-empty citation", () => {
    const base = {
      title: "VitaPlace Testprodukt",
      category: "VitaPlace",
      content: "Bifidobacterium",
      entry_kind: "product",
      review_status: "reviewed",
      evidence_level: "clinical",
      dosage_status: "verified",
      source_citations: [{ url: "https://example.test/source" }],
      commercial_claims_reviewed: true,
    } satisfies Partial<ProvisionalHierarchyEntry>;
    const cases: Array<Partial<ProvisionalHierarchyEntry>> = [
      { ...base, review_status: "needs_review" },
      { ...base, evidence_level: "unrated" },
      { ...base, dosage_status: "unverified" },
      { ...base, source_citations: [{}] },
      { ...base, source_citations: [42, "invalid", { url: 42 }] as unknown as Array<{ url?: string; label?: string }> },
      { ...base, commercial_claims_reviewed: false },
    ];

    for (const candidate of cases) {
      expect(buildProvisionalTherapyHierarchy([entry(candidate)], "Bifidobacterium")[0].status).toBe("REVIEW_ONLY");
    }
  });

  it("keeps generic safety and warning sections in review-only status", () => {
    for (const heading of [
      "## Sicherheit",
      "## Sicherheitshinweis",
      "## Warnhinweis",
      "## ⚠️ Sicherheit & Kontraindikationen",
      "**Hinweise / Kontraindikationen:**",
      "- Sicherheit:",
    ]) {
      const hierarchy = buildProvisionalTherapyHierarchy([entry({
        title: "VitaPlace Bifido Produkt",
        category: "VitaPlace",
        content: `Bifidobacterium longum\n\n${heading}\nNicht bei Phenylketonurie.`,
        entry_kind: "product",
        review_status: "reviewed",
        evidence_level: "clinical",
        dosage_status: "verified",
        source_citations: [{ url: "https://example.test/source" }],
        commercial_claims_reviewed: true,
      })], "Bifidobacterium longum");

      expect(hierarchy[0].status).toBe("REVIEW_ONLY");
      expect(hierarchy[0].reasons.join(" ")).toContain("Unstrukturierte Sicherheitsangaben");
    }
  });
});
