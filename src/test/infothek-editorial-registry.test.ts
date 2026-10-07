import { describe, it, expect } from "vitest";
import { editorialWithRegistry } from "@/lib/infothekEditorialStatus";
import { COMPARISON_CONFIGS, OFFLINE_COMPARISONS } from "@/lib/infothekComparisonConfigs";
describe("Redaktionsstatus aus Registry", () => {
  const s = editorialWithRegistry(COMPARISON_CONFIGS, OFFLINE_COMPARISONS);
  it("neue Vergleiche sind vorbereitet, nicht abgeschlossen", () => {
    for (const f of ["ass-salicylat-histamin.html", "diabetes-handout.html", "ersttermin-naturheilpraxis.html", "therapieweg-uebersicht.html", "candida-diaet.html", "sibo-duenndarmfehlbesiedlung.html", "muedigkeit-erschoepfung-burnout.html", "kraeuter-schmerz-entzuendung.html", "dankbarkeit-alltag.html", "umwelt-alltag-gesundheit.html"]) {
      const e = s.find((x) => x.file === f)!;
      expect(e.state).toMatch(/^Vergleich vorbereitet/);
    }
  });
  it("Allergie-Zahl aus Registry, keine veraltete 9", () => {
    const a = s.find((x) => x.file === "allergiebehandlung.html")!;
    expect(a.state).toBe("in Prüfung"); expect(a.openTopics.join()).not.toMatch(/^9 /); expect(a.openTopics[0]).toMatch(/offline/);
  });
  it("Zählung", () => {
    expect(s.filter((x) => x.comparePath).length).toBeGreaterThanOrEqual(14);
    expect(s.filter((x) => x.openTopics[0]?.includes("offline")).length).toBe(OFFLINE_COMPARISONS.filter((o) => s.some((x) => x.file === `${o.slug}.html`)).length);
  });
});
