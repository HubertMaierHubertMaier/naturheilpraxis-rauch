import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const therapySource = readFileSync(resolve(root, "supabase/functions/therapy-recommend/index.ts"), "utf8");
const searchSource = readFileSync(resolve(root, "src/pages/WikiDatenbank.tsx"), "utf8");

describe("shared knowledge integration policy", () => {
  it("uses the existing Befund, structured Wiki, Infothek, and protected staging context", () => {
    expect(therapySource).toContain("VORHANDENE BEFUND-AUSWERTUNG – PRIMÄRER ZUSAMMENFASSENDER KONTEXT");
    expect(therapySource).toContain("loadWikiEntries(userClient)");
    expect(therapySource).toContain("loadInfothekKnowledgeDocuments(adminClient)");
    expect(therapySource).toContain("loadRelevantStagingKnowledgeCandidates(adminClient, scoringQueryText)");
    expect(therapySource).toContain("[UNREVIEWED_STAGING:...]");
    expect(therapySource).toContain("Infothek- und Import-Pruefhinweise ohne passenden geprueften Wiki-Mittelbeleg");
  });

  it("searches detailed internal fields without offering a write or release action", () => {
    expect(searchSource).toContain('original_excerpt", "ambiguity_notes"');
    expect(searchSource).toContain('.from("kb_relation_candidates")');
    expect(searchSource).toContain("queryTerms.every");
    expect(searchSource).toContain("safeExternalUrl");
    expect(searchSource).toContain("Alle strukturierten Originalfelder anzeigen");
    expect(searchSource).toContain("Nur intern / ungeprueft");
    expect(searchSource).toContain("Keine Schreib-, Loesch- oder Freigabeaktionen in dieser Ansicht");
  });
});
