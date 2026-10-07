/**
 * Klinghardt-Navigator: Ordnung der vorhandenen 62 Praxis-Quellenkarten (kb_source_revisions, Herausgeber
 * „Klinghardt Talks 001-025“). Rein lesend. Suchachsen sind Textachsen – keine Diagnose-/Wirkrelation.
 */
export const KLINGHARDT_PUBLISHER = "Klinghardt Talks 001-025";
export const COMPENDIUM = {
  file: "000_Klinghardt_Gesamtkompendium_001_bis_025_Praxisnavigator_Grossschrift.pdf",
  pages: 903, sourceCards: 586, themeRows: 516, practiceCards: 62, episodes: 25,
  pdfSha256: "20dce7162cc99a44b12d988f2adbb12dc471a5fd67aecf66786bc4196e71c26b",
  docxSha256: "fb2631f0effde4a05d74a0c1b114340f0e91839f24a04416f8a53a5006e6b2f7",
  note: "586 Quellenkarten = Kompendium-Bestand (PDF). Im Wiki importiert sind nur die 62 Praxiskarten.",
} as const;

export const CHAPTERS = ["Therapieverfahren", "Pathogene und Infektionen", "Pflanzenheilkunde", "Erkrankungen und Symptome", "Ausleitung", "Medikamente und Nährstoffe"] as const;
export type Chapter = (typeof CHAPTERS)[number];
export const CHAPTER_EXPECTED: Record<Chapter, number> = { Therapieverfahren: 13, "Pathogene und Infektionen": 14, Pflanzenheilkunde: 7, "Erkrankungen und Symptome": 13, Ausleitung: 9, "Medikamente und Nährstoffe": 6 };

export type AxisKey = "viren" | "bakterien" | "pilze" | "metalle";
export const AXES: Array<{ key: AxisKey; label: string; re: RegExp }> = [
  { key: "viren", label: "Viren", re: /\b(vir(us|en|al)|covid|corona|sars|epstein|ebv|herpes|hhv|influenza|long covid)/i },
  { key: "bakterien", label: "Bakterien", re: /\b(bakteri|borreli|lyme|strepto|staphylo|chlamyd|mykoplasm|bartonell|clostridi|helicobacter|antibioti)/i },
  { key: "pilze", label: "Pilze/Schimmel/Mykotoxine", re: /\b(pilz|schimmel|mykotox|candida|aspergill|mould|mold)/i },
  { key: "metalle", label: "Schwermetalle/Umweltmetalle", re: /\b(schwermetall|quecksilber|amalgam|blei\b|cadmium|arsen|alumini|metall)/i },
];

/** Sprachpaare laut Kompendium: gleiche Inhalte in zwei Folgen → eine unabhängige Quelle. */
export const LANGUAGE_PAIRS: Array<[string, string]> = [["010", "011"], ["012", "013"], ["018", "019"]];
export const episodeGroup = (f: string) => { const p = LANGUAGE_PAIRS.find((x) => x.includes(f)); return p ? p.join("/") : f; };

export interface KCard {
  revisionId: string; revisionNo: number; key: string; title: string; chapters: string[]; episodes: string[];
  locator: string; eIds: string[]; speaker: string | null; content: string;
  claim: string; remedies: string; dose: string; evidence: string; safety: string;
}

export function sections(content: string): Record<string, string> {
  const out: Record<string, string> = {}; let cur = "_intro";
  for (const line of content.split("\n")) { const m = /^##\s+(.+)$/.exec(line); if (m) { cur = m[1].trim(); out[cur] = ""; } else out[cur] = (out[cur] ?? "") + line + "\n"; }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}
const pick = (s: Record<string, string>, prefix: string) => Object.entries(s).find(([k]) => k.toLowerCase().startsWith(prefix.toLowerCase()))?.[1] ?? "";

export interface RawCard { id: string; revision_no: number; title: string; key: string | null; locator: string | null; tags: string[] | null; topics: string[] | null; content: string | null }
export function toCard(r: RawCard): KCard {
  const content = r.content ?? ""; const s = sections(content); const tags = r.tags ?? [];
  const locator = r.locator ?? "";
  const episodes = [...new Set([...tags.filter((t) => /^Folge \d{3}$/.test(t)).map((t) => t.slice(6)), ...[...locator.matchAll(/Folge (\d{3})/g)].map((m) => m[1])])].sort();
  return {
    revisionId: r.id, revisionNo: r.revision_no, key: r.key ?? "", title: r.title.replace(/^Klinghardt-Quellenkarte:\s*/, ""),
    chapters: r.topics ?? [], episodes, locator, eIds: [...new Set([...locator.matchAll(/E\d{3}-\d{3}/g), ...content.matchAll(/E\d{3}-\d{3}/g)].map((m) => m[0]))],
    speaker: tags.find((t) => t.startsWith("Sprecher: "))?.slice(10) ?? null, content,
    claim: pick(s, "Sprecherbehauptung"), remedies: pick(s, "Genannte Mittel"), dose: pick(s, "Dosis"), evidence: pick(s, "Unabhängige Evidenz"), safety: pick(s, "Sicherheit"),
  };
}

export const axesOf = (c: KCard): AxisKey[] => AXES.filter((a) => a.re.test(`${c.title}\n${c.claim}\n${c.remedies}`)).map((a) => a.key);

export interface KFilter { chapter?: string | null; axes?: AxisKey[]; q?: string }
export function filterCards(cards: KCard[], f: KFilter): KCard[] {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((c) => (!f.chapter || c.chapters.includes(f.chapter))
    && (f.axes ?? []).every((a) => axesOf(c).includes(a))
    && words.every((w) => `${c.title} ${c.content} ${c.locator}`.toLowerCase().includes(w)));
}

/** Achsen-Überschneidung: Anzahl Karten, die beide Achsen im Text nennen (keine Kausal-/Diagnoserelation). */
export function overlapMatrix(cards: KCard[]): Record<AxisKey, Record<AxisKey, number>> {
  const m = Object.fromEntries(AXES.map((a) => [a.key, Object.fromEntries(AXES.map((b) => [b.key, 0]))])) as Record<AxisKey, Record<AxisKey, number>>;
  for (const c of cards) { const ax = axesOf(c); for (const a of ax) for (const b of ax) m[a][b]++; }
  return m;
}

/** Unabhängige Folgen: Sprachpaare zählen einmal. */
export const independentEpisodes = (cards: KCard[]) => new Set(cards.flatMap((c) => c.episodes.map(episodeGroup))).size;

/** Abgleich gespeicherte Karten ↔ Importdatei (nach candidate_key). */
export function reconcile(dbKeys: string[], fileKeys: string[]) {
  const d = new Set(dbKeys), f = new Set(fileKeys);
  return { onlyInDb: [...d].filter((k) => !f.has(k)).sort(), onlyInFile: [...f].filter((k) => !d.has(k)).sort(), both: [...d].filter((k) => f.has(k)).length, duplicatesInDb: dbKeys.length - d.size };
}

/** Filtert auf aktuelle Revisionen. Ohne geladenes Modell (currentIds null) → "loading", nie ungefiltert. */
export function currentCardsOnly(raw: KCard[] | "loading" | "error" | null, currentIds: Set<string> | null): KCard[] | "loading" | "error" | null {
  if (raw === null || raw === "loading" || raw === "error") return raw;
  if (!currentIds) return "loading";
  return raw.filter((c) => currentIds.has(c.revisionId)).sort((a, b) => a.title.localeCompare(b.title, "de"));
}
