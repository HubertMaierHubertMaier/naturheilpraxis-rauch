import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildInternalKnowledgeIlikeFilter,
  compactInternalKnowledgeText,
  hasInternalKnowledgeData,
  internalKnowledgeSearchTerms,
  normalizeInternalKnowledgeSearchText,
} from "@/lib/internalKnowledgeSearch";

describe("internal knowledge search", () => {
  it("builds safe multi-field filters for remedies, symptoms, and diseases", () => {
    expect(internalKnowledgeSearchTerms(" Banderol, Borreliose (chronisch) ")).toEqual([
      "banderol",
      "borreliose",
      "chronisch",
    ]);
    expect(buildInternalKnowledgeIlikeFilter(["title", "original_excerpt"], "Banderol Borreliose")).toBe(
      "and(or(title.ilike.%banderol%,original_excerpt.ilike.%banderol%),or(title.ilike.%borreliose%,original_excerpt.ilike.%borreliose%))",
    );
    expect(buildInternalKnowledgeIlikeFilter(["title", "original_excerpt"], "Banderol")).toBe(
      "title.ilike.%banderol%,original_excerpt.ilike.%banderol%",
    );
    expect(internalKnowledgeSearchTerms("Zeige alles über Banderol Eigenschaften")).toEqual(["banderol"]);
    expect(internalKnowledgeSearchTerms("Was hat die Datenbank über Banderol für Eigenschaften?")).toEqual(["banderol"]);
    expect(internalKnowledgeSearchTerms("Welche Mittel gibt es bei Bluthochdruck?")).toEqual(["bluthochdruck"]);
    expect(internalKnowledgeSearchTerms("Klinghardt, Covid")).toEqual(["klinghardt", "covid"]);
    expect(internalKnowledgeSearchTerms("Buhner, Bandero")).toEqual(["buhner", "bandero"]);
    expect(buildInternalKnowledgeIlikeFilter(["title", "original_excerpt"], "Klinghardt, Covid")).toBe(
      "and(or(title.ilike.%klinghardt%,original_excerpt.ilike.%klinghardt%),or(title.ilike.%covid%,original_excerpt.ilike.%covid%))",
    );
    expect(buildInternalKnowledgeIlikeFilter(["title"], "Süßholz")).toBe(
      "title.ilike.%süßholz%,title.ilike.%suessholz%",
    );
    expect(buildInternalKnowledgeIlikeFilter(["title"], "Suessholz")).toBe(
      "title.ilike.%suessholz%,title.ilike.%süßholz%",
    );
    expect(normalizeInternalKnowledgeSearchText("Süßholz")).toBe("suessholz");
    expect(normalizeInternalKnowledgeSearchText("Suessholz")).toBe("suessholz");
  });

  it("keeps result previews bounded while preserving short text", () => {
    expect(compactInternalKnowledgeText("  kurz   und klar ")).toBe("kurz und klar");
    expect(compactInternalKnowledgeText("x".repeat(20), 10)).toBe("xxxxxxxxxx ...");
  });

  it("recognizes non-empty structured candidate data", () => {
    expect(hasInternalKnowledgeData({ product: { title: "Banderol" } })).toBe(true);
    expect(hasInternalKnowledgeData({})).toBe(false);
    expect(hasInternalKnowledgeData([])).toBe(false);
  });

  it("paginates protected candidate search instead of silently truncating it", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/WikiDatenbank.tsx"), "utf8");
    expect(source).toContain("const IMPORT_SEARCH_PAGE_SIZE = 200");
    expect(source).toContain("async function searchAllImportRows");
    expect(source).toContain(".range(from, from + IMPORT_SEARCH_PAGE_SIZE - 1)");
    expect(source).not.toContain(".limit(12)");
  });

  it("explains combined AND searches in the visible database search", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/WikiDatenbank.tsx"), "utf8");
    expect(source).toContain("Kombinierte UND-Suche:");
    expect(source).toContain("Es erscheinen nur Ergebnisse, in denen alle Suchbegriffe gemeinsam vorkommen.");
    expect(source).toContain("Klinghardt, Covid oder Buhner, Banderol");
  });
});
