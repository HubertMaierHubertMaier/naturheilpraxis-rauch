import { describe, it, expect } from "vitest";
import { editorialWithRegistry } from "@/lib/infothekEditorialStatus";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
describe("Redaktionsstatus aus Registry", () => {
  const s = editorialWithRegistry(COMPARISON_CONFIGS);
  it("neue Vergleiche sind vorbereitet, nicht abgeschlossen", () => {
    for (const f of ["ass-salicylat-histamin.html", "diabetes-handout.html", "ersttermin-naturheilpraxis.html", "therapieweg-uebersicht.html", "candida-diaet.html", "sibo-duenndarmfehlbesiedlung.html", "muedigkeit-erschoepfung-burnout.html", "kraeuter-schmerz-entzuendung.html"]) {
      const e = s.find((x) => x.file === f)!;
      expect(e.state).toBe("Vergleich vorbereitet"); expect(e.comparePath).toMatch(/infothek-vergleich/);
    }
  });
  it("Allergie-Zahl aus Registry, keine veraltete 9", () => {
    const a = s.find((x) => x.file === "allergiebehandlung.html")!;
    expect(a.state).toBe("in Prüfung"); expect(a.openTopics.join()).not.toMatch(/^9 /); expect(a.openTopics[0]).toMatch(/^12 Vorschläge/);
  });
  it("Zählung", () => {
    expect(s.filter((x) => x.comparePath).length).toBe(11);
    expect(s.filter((x) => x.state === "nicht begonnen").length).toBe(s.length - 11);
  });
});
