import type { PathogenEntry } from "@/components/admin/therapy/PathogenInput";
import { inferMetatronGroup, type MetatronPathogenGroup } from "./metatronPathogenGroups";

const RESULT_HEADINGS: Record<string, MetatronPathogenGroup | "fungi"> = {
  BAKTERIEN: "bacteria",
  VIREN: "viruses",
  PARASITEN: "parasites",
  PILZE: "fungi",
  HEFEPILZE: "yeasts",
  SCHIMMELPILZE: "moulds",
};

const pageMarker = /^---\s*Seite\s+(\d+)\s*---$/i;
const resultRow = /^(.{3,120}?)\s+(\d{1,2}[.,]\d{3})$/u;
const otherTableHeading = /^[\p{Lu}\s\-/&()]{3,80}$/u;

function stableId(value: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `metatron-${(hash >>> 0).toString(36)}`;
}

const identity = (entry: Pick<PathogenEntry, "name" | "index">) =>
  `${entry.name.normalize("NFKC").trim().toLocaleLowerCase("de-DE")}|${entry.index.trim().replace(",", ".")}`;

/** Read only numbered result-table rows from a reviewed, privacy-clean Metatron PDF preview. */
export function extractMetatronResultPathogens(previewText: string): PathogenEntry[] {
  if (!/^---\s*Seite\s+\d+\s*---$/im.test(previewText)) return [];
  const found: PathogenEntry[] = [];
  let page = 0;
  let group: MetatronPathogenGroup | "fungi" | null = null;
  for (const raw of previewText.split(/\r?\n/)) {
    const line = raw.trim();
    const marker = line.match(pageMarker);
    if (marker) { page = Number(marker[1]); continue; }
    if (line.startsWith("===")) { group = null; continue; }
    const heading = RESULT_HEADINGS[line.toLocaleUpperCase("de-DE")];
    if (heading) { group = heading; continue; }
    if (!group || !page) continue;
    if (otherTableHeading.test(line)) { group = null; continue; }
    const row = line.match(resultRow);
    if (!row) continue;
    const name = row[1].replace(/\s+/g, " ").trim();
    if (!/\p{L}{2}/u.test(name) || /^(?:index|wert|seite|datum)\b/i.test(name)) continue;
    const index = row[2].replace(",", ".");
    const category = group === "fungi" ? inferMetatronGroup(name) : group;
    found.push({ id: stableId(`${page}|${identity({ name, index })}`), name, organe: "", index, category,
      source: `Metatron Hospital, Seite ${page}` });
  }
  return [...new Map(found.map(entry => [identity(entry), entry])).values()];
}

/** Keep manual corrections when the same reviewed result is imported again. */
export function mergeMetatronResultPathogens(existing: PathogenEntry[], incoming: PathogenEntry[]): PathogenEntry[] {
  const retained = existing.filter(entry => entry.name.trim() || entry.organe.trim() || entry.index.trim());
  const known = new Set(retained.filter(entry => entry.name.trim()).map(identity));
  return [...retained, ...incoming.filter(entry => {
    const key = identity(entry);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  })];
}
