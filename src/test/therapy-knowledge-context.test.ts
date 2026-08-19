import { describe, expect, it } from "vitest";
import {
  buildInfothekKnowledgeContext,
  buildStagingKnowledgeContext,
  infothekHtmlToKnowledgeDocument,
  normalizeTherapyKnowledgeSearchText,
  selectRelevantInfothekDocuments,
  selectRelevantStagingCandidates,
} from "../../supabase/functions/_shared/therapyKnowledgeContext";

describe("therapy knowledge context", () => {
  it("extracts and selects the relevant Infothek passage without scripts", () => {
    const banderol = infothekHtmlToKnowledgeDocument("ass.html", `
      <html><head><title>ASS und Histamin</title><style>.hidden{}</style></head>
      <body><h1>Vertraeglichkeit</h1><p>Banderol ist Otoba parvifolia.</p><script>secret()</script></body></html>
    `);
    const unrelated = infothekHtmlToKnowledgeDocument("other.html", "<html><title>Termine</title><body>Oeffnungszeiten</body></html>");
    const selected = selectRelevantInfothekDocuments([unrelated, banderol], ["banderol"]);
    expect(selected).toHaveLength(1);
    expect(selected[0].filename).toBe("ass.html");
    expect(selected[0].excerpt).toContain("Banderol");
    expect(selected[0].excerpt).not.toContain("secret()");
    expect(buildInfothekKnowledgeContext(selected)).toContain("[INFOTHEK:ass.html]");
    expect(buildInfothekKnowledgeContext(selected)).toContain("Kontextauszug aus der Praxis-HTML");
    expect(buildInfothekKnowledgeContext(selected)).toContain("die vollstaendige Datei bleibt intern erhalten");
  });

  it("keeps relevant staging data while marking it as unreviewed", () => {
    const candidates = [
      { id: "one", kind: "entity" as const, status: "imported_unreviewed", label: "Banderol", text: "Otoba parvifolia", sourceLocator: "Quelle 1", confidence: 80 },
      { id: "two", kind: "entity" as const, status: "imported_unreviewed", label: "Unverbunden", text: "Anderer Inhalt" },
    ];
    const selected = selectRelevantStagingCandidates(candidates, ["banderol"]);
    expect(selected.map((candidate) => candidate.id)).toEqual(["one"]);
    const context = buildStagingKnowledgeContext(selected);
    expect(context).toContain("[UNREVIEWED_STAGING:entity:one]");
    expect(context).toContain("nie alleinige Grundlage");
    expect(context).toContain("Pruefstatus: imported_unreviewed");
  });

  it("finds German remedy spelling variants in Infothek and staging context", () => {
    const infothek = infothekHtmlToKnowledgeDocument(
      "suessholz.html",
      "<html><title>Süßholz</title><body>Glycyrrhiza glabra mit Sicherheitshinweisen.</body></html>",
    );
    const staging = [{
      id: "liquorice",
      kind: "safety" as const,
      status: "imported_unreviewed",
      label: "Süßholz-Sicherheit",
      text: "Bei Bluthochdruck prüfen",
    }];

    expect(selectRelevantInfothekDocuments([infothek], ["Suessholz"])).toHaveLength(1);
    expect(selectRelevantStagingCandidates(staging, ["Suessholz"])).toHaveLength(1);
    expect(normalizeTherapyKnowledgeSearchText("Süßholz")).toBe("suessholz");
    expect(normalizeTherapyKnowledgeSearchText("Suessholz")).toBe("suessholz");
  });

  it("keeps staging candidates as complete blocks at the context limit", () => {
    const candidates = [
      { id: "first", kind: "source" as const, status: "imported_unreviewed", label: "Banderol Quelle", text: `Erster Beleg ${"A".repeat(180)} ENDE-ERSTER-BELEG` },
      { id: "second", kind: "source" as const, status: "imported_unreviewed", label: "Banderol Zusatzquelle", text: `Zweiter Beleg ${"B".repeat(180)} ENDE-ZWEITER-BELEG` },
    ];
    const firstOnly = buildStagingKnowledgeContext([candidates[0]]);
    const maximum = firstOnly.length + 10;
    const selected = selectRelevantStagingCandidates(candidates, ["banderol"], 12, maximum);
    const context = buildStagingKnowledgeContext(selected, maximum);

    expect(selected.map((candidate) => candidate.id)).toEqual(["first"]);
    expect(context).toContain("ENDE-ERSTER-BELEG");
    expect(context).not.toContain("second");
    expect(context).not.toContain("Zweiter Beleg");
    expect(context.length).toBeLessThanOrEqual(maximum);
    expect(buildStagingKnowledgeContext([candidates[0]], firstOnly.length - 1)).toBe("");
  });
});
