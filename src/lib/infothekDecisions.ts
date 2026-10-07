import type { ComparisonChange } from "@/lib/infothekComparisonChanges";

/** Browser-local decisions per proposal. "kept" = explicit decision to keep the original wording. */
export interface Decisions { accepted: Set<number>; kept: Set<number>; savedAt?: string }

export function parseDecisions(raw: string | null, valid: number[]): Decisions {
  const ok = (ids?: number[]) => new Set((ids ?? []).filter((id) => valid.includes(id)));
  if (!raw) return { accepted: new Set(), kept: new Set() };
  try {
    const p = JSON.parse(raw) as { accepted?: number[]; kept?: number[]; savedAt?: string };
    const accepted = ok(p.accepted);
    const kept = ok(p.kept);
    accepted.forEach((id) => kept.delete(id));
    return { accepted, kept, savedAt: p.savedAt };
  } catch {
    return { accepted: new Set(), kept: new Set() };
  }
}

export const serializeDecisions = (d: Decisions) =>
  JSON.stringify({ accepted: [...d.accepted].sort((a, b) => a - b), kept: [...d.kept].sort((a, b) => a - b), savedAt: d.savedAt });

/** An alternative is optional when the proposal it would replace is already accepted. */
export const isOptionalAlternative = (c: ComparisonChange, d: Decisions) => c.supersedes !== undefined && d.accepted.has(c.supersedes);

/** Accepted alternative that replaces this proposal (its own decision stays stored unchanged). */
export const replacedBy = (c: ComparisonChange, changes: ComparisonChange[], d: Decisions) =>
  changes.find((x) => x.supersedes === c.id && d.accepted.has(x.id))?.id;

/** Still undecided (neither accepted nor explicitly kept). Not the same as rejected. */
export const undecided = (changes: ComparisonChange[], d: Decisions) => changes.filter((c) => !d.accepted.has(c.id) && !d.kept.has(c.id) && replacedBy(c, changes, d) === undefined);

/** Points not covered by the numbered proposals; shown visibly, never as hidden HTML comments. */
export const EXTRA_CHECKS = [
  "Geräteliste (Trikombin, Metatron Hospital, EAV nach Dr. Voll, 150 MHz nach Broehrs, Multiwave Oscillator): aktuell in der Praxis vorhanden? – von Peter zu bestätigen.",
  "Anrede uneinheitlich: Artikel duzt („Stell dir vor“), Praxissätze (Vorschlag 15, 20, 24, 32) siezen.",
  "Vorschlag 15 und 32 laden beide zum Gespräch ein – bei Übernahme beider ggf. eine Stelle kürzen.",
  "Muheim-Werte (99,9999999 %, 974 Milliarden Energiequanten „steuern ihn“) und „der allergrößte Teil unseres Seins ist Energie“: physikalisch nicht belegt, noch ohne Vorschlag.",
  "„Aus reiner Strahlung wird Materie“ (Abschnitt 9): am CERN kollidierten Protonen und Antiprotonen – noch ohne Vorschlag.",
  "Alte Hinweisblöcke am Schluss („nicht schulmedizinisch anerkannt“, Transparenz-Hinweis, Rechtlicher Hinweis) wiederholen sich – Zusammenfassung zu einem kurzen Schlusshinweis offen.",
  "Beschreibung für Suchergebnisse (Vorschlag 2) wirkt defensiv („was Hypothese … ist“). Freundlichere Fassung zur Prüfung: „Frequenztherapie verständlich erklärt: von E = mc² und Muheims Energiefeld-Modell bis zum Angebot der Naturheilpraxis Rauch in Augsburg.“ – bei Bedarf als eigener Vorschlag.",
  "Interne Links (Vorschlag 30) zeigen auf geplante Praxisseiten, die noch nicht online sind.",
  "Öffentliche Seite: Seitentitel/Meta im ausgelieferten Seitenkopf, Autor-/Prüfdatum (von Peter), noindex/Sitemap erst nach Freigabe.",
];

export function buildProgressReport(opts: {
  changes: ComparisonChange[]; topics: Record<number, string>; d: Decisions; storageKey: string; sectionOf?: Map<number, number>; title?: string; extraChecks?: string[];
}): string {
  const { changes, topics, d, storageKey, sectionOf, title = "Krankheit ist messbar", extraChecks = EXTRA_CHECKS } = opts;
  const line = (c: ComparisonChange) => {
    const where = c.headOnly ? "im Artikel nicht sichtbar" : sectionOf?.get(c.id) ? `Abschnitt ${sectionOf.get(c.id)}` : "";
    const rep = replacedBy(c, changes, d);
    const state = rep !== undefined ? `ersetzt durch Vorschlag ${rep}` : d.accepted.has(c.id) ? "übernommen" : d.kept.has(c.id) ? "Original beibehalten" : isOptionalAlternative(c, d) ? "offen (optionale Alternative)" : "offen";
    const before = c.headOnly?.before ?? c.orig ?? "";
    const after = c.headOnly?.after ?? c.draft ?? "";
    return `- Vorschlag ${c.id} – ${topics[c.id] ?? c.note}${where ? ` (${where})` : ""}: **${state}**\n  - Vorher (Ausschnitt): „${before}“\n  - Nachher (Ausschnitt): „${after}“`;
  };
  const open = undecided(changes, d);
  return [
    `# Fortschrittsbericht – ${title}`,
    ``,
    `Erstellt: ${new Date().toLocaleString("de-DE")}`,
    `Speicherort der Entscheidungen: nur dieser Browser (localStorage, Schlüssel \`${storageKey}\`), nicht auf dem Server. Dieser Bericht sichert den Stand als Datei.`,
    `Letzte Speicherung: ${d.savedAt ? new Date(d.savedAt).toLocaleString("de-DE") : "–"}`,
    ``,
    `Status: in Prüfung – ${d.accepted.size} übernommen, ${d.kept.size} Original beibehalten, ${open.length} noch zu entscheiden (von ${changes.length}).`,
    `Nicht veröffentlicht, keine Inhalts- oder Rechtsfreigabe. Abschluss erst nach bewussten Entscheidungen und Restprüfung.`,
    ``,
    `## Vorschläge`,
    ...changes.map(line),
    ``,
    `## Zusätzlich zu prüfen`,
    ...extraChecks.map((x) => `- ${x}`),
    ``,
  ].join("\n");
}

/** Derived, read-only projection of stored decisions. Never mutates decisions. */
export function progressProjection(changes: ComparisonChange[], d: Decisions, failed: number[] = []) {
  const ids = new Set(changes.map((c) => c.id));
  const replaced = changes.filter((c) => replacedBy(c, changes, d) !== undefined).map((c) => c.id);
  const rep = new Set(replaced);
  const accepted = changes.filter((c) => d.accepted.has(c.id) && !rep.has(c.id)).map((c) => c.id);
  const kept = changes.filter((c) => d.kept.has(c.id) && !d.accepted.has(c.id) && !rep.has(c.id)).map((c) => c.id);
  const open = undecided(changes, d).map((c) => c.id);
  const optionalOpen = changes.filter((c) => open.includes(c.id) && isOptionalAlternative(c, d)).map((c) => c.id);
  const fail = new Set(failed);
  const appliedFailed = accepted.filter((id) => fail.has(id));
  const applied = accepted.filter((id) => !fail.has(id));
  const unknownStored = [...d.accepted, ...d.kept].filter((id) => !ids.has(id));
  return { total: changes.length, accepted, kept, replaced, open, optionalOpen, applied, appliedFailed, unknownStored };
}
