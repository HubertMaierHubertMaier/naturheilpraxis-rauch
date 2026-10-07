/** Fundstelle: HTML page + real section (X of Y); head-only items are outside the article text. Never invents page numbers. */
export function fundstelle(c: { id: number; headOnly?: { kind: string } }, p: { sectionOf: Map<number, number>; sectionCount: number } | undefined, page: string): string {
  if (c.headOnly) return `${page} · ${c.headOnly.kind === "title" ? "Seitentitel" : "Meta-Beschreibung"}: Seiteneinstellungen / Google-Suchvorschau – außerhalb des Artikeltexts`;
  const sec = p?.sectionOf.get(c.id);
  return sec && p ? `${page} · Abschnitt ${sec} von ${p.sectionCount}` : `${page} · Abschnitt nicht ermittelbar`;
}
