import { describe, expect, it } from "vitest";
import { collectLocalPrivacyFindings, deidentifyClinicalText, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";

describe("device-export personal headers for arbitrary patients", () => {
  it.each([
    ["Muster Erika", "12.03.1980", "46"],
    ["Östermann Anne-Marie", "7/9/1962", "64"],
    ["Beispiel, Jonas", "21-11-1991", "34"],
    ["Lena von Beispiel", "03.05.1970", "56"],
  ])("removes every occurrence of %s and its birth date, retaining age and clinical values", (name, birth, age) => {
    const raw = `--- Seite 1 ---\n${name} ${birth} (${age})\n29.04.2026\nMesswert 0,123\n--- Seite 8 ---\n${name} ${birth} (${age})\nMesswert 1,250`;
    expect(directIdentifierCategories(raw)).toEqual(expect.arrayContaining(["Name", "Geburtsdatum"]));
    expect(collectLocalPrivacyFindings(raw).filter(f => f.categories.includes("Geburtsdatum")).map(f => f.pageNumber)).toEqual([1,8]);
    const safe = deidentifyClinicalText(raw);
    expect(safe).not.toContain(name);
    expect(safe).not.toContain(birth);
    expect(safe).toContain(`(${age})`);
    expect(safe).toContain("29.04.2026");
    expect(safe).toContain("Messwert 0,123");
    expect(safe).toContain("Messwert 1,250");
    expect(directIdentifierCategories(safe)).toEqual([]);
    expect(deidentifyClinicalText(safe)).toBe(safe);
  });
  it("does not classify a device title, examination date, measurement or pseudonym as a personal header", () => {
    const raw = "Metapathia Hospital 3D 29.04.2026\nUntersuchung 29.04.2026\nP-2026-0001\nMesswert 0,123 (54)";
    expect(deidentifyClinicalText(raw)).toBe(raw);
    expect(directIdentifierCategories(raw)).toEqual([]);
  });
});
