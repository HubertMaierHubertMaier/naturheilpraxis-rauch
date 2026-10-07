import { describe, it, expect } from "vitest";
import { ACTOR_REVIEWS, SOURCE_RELATIONS, SPLIT_CANDIDATES, reviewOf, splitDryRunActors } from "@/lib/wikiReviewedNetwork";

describe("geprüfte Akteurszuordnung", () => {
  it("34 Akteure, keine Dubletten", () => {
    expect(ACTOR_REVIEWS).toHaveLength(34);
    expect(new Set(ACTOR_REVIEWS.map((a) => a.name)).size).toBe(34);
  });
  it("Kalcker und Römer sind Personen, Aliase nicht ohne Fundstelle zusammengeführt", () => {
    expect(reviewOf("Andreas Kalcker")?.category).toBe("person");
    expect(reviewOf("Peter Römer")?.category).toBe("person");
    expect(reviewOf("A. L. Kalcker")?.linkedTo?.kind).toBe("merge_hinweis_unbelegt");
  });
  it("Talk-Reihe und Platzhalter sind keine Akteure; Plattformen nie Hersteller", () => {
    expect(reviewOf("Klinghardt Talks 001-025")?.category).toBe("kein_akteur");
    expect(reviewOf("Externe Fachquelle")?.category).toBe("kein_akteur");
    expect(reviewOf("Nutzerbereitgestellte Quelle")?.category).toBe("kein_akteur");
    for (const n of ["Amazon", "BitChute", "DocCheck", "Google Patents", "dr-kirkamm.de"]) expect(reviewOf(n)?.category).toBe("plattform");
  });
  it("PubMed/Zeitschrift: nicht ein sicherer Plattform-Akteur, sondern getrennte Kandidaten", () => {
    const pm = reviewOf("PubMed / Clinical and Experimental Dental Research")!;
    expect(pm.category).toBe("zusammengesetzt_ungeklaert"); expect(pm.certainty).not.toBe("sicher");
    const parts = SPLIT_CANDIDATES.filter((c) => c.from === pm.name);
    expect(parts.map((p) => p.name)).toEqual(["PubMed", "Clinical and Experimental Dental Research"]);
    expect(new Set(parts.map((p) => p.category)).size).toBe(2);
    for (const p of parts) expect(p.fundstelle).toMatch(/6399335a/);
  });
  it("belegte Aliase haben eine Fundstelle", () => {
    for (const a of ACTOR_REVIEWS) if (a.linkedTo?.kind === "alias_belegt") expect(a.linkedTo.fundstelle).toBeTruthy();
  });
  it("neue Probelauf-Akteure bleiben ungeprüft", () => {
    const s = splitDryRunActors({ actors: [{ display_name: "Thieme" }, { display_name: "Neue Firma X" }] as never });
    expect(s.reviewed.map((x) => x.display_name)).toEqual(["Thieme"]);
    expect(s.unreviewed).toEqual(["Neue Firma X"]);
  });
});

describe("Quellenbeziehungen", () => {
  it("6 vollständig, 2 unvollständig mit Grund; keine Wirkcodes ohne Quelle", () => {
    expect(SOURCE_RELATIONS).toHaveLength(8);
    expect(SOURCE_RELATIONS.filter((s) => s.complete)).toHaveLength(6);
    for (const s of SOURCE_RELATIONS.filter((x) => !x.complete)) expect(s.missing).toBeTruthy();
    const codes = SOURCE_RELATIONS.flatMap((s) => s.relations.map((r) => r.code));
    expect(codes).not.toContain("may_support");
    expect(codes).not.toContain("indicated_for");
  });
});
