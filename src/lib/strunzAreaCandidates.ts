import data from "../../docs/wiki/strunz-anwendungsbereiche-produkte-2026-10-07.json";

/** Read-only, source-bound candidates: product listed on a Strunz application-area page. Not an efficacy/indication claim. */
export interface StrunzAreaCandidate {
  area: string; article_id: string; revision_id: string; page_url: string; position: number;
  listed_name: string; product_url: string; product_key: string; entity_id: string;
  product_source_revision_id: string; product_name: string; code: string; status: string;
}

export const STRUNZ_AREA = data as unknown as {
  abgerufen: string; bedeutung: string; kandidaten: StrunzAreaCandidate[];
  produkte_ohne_karte: number; seiten: Record<string, number>;
};

export function groupByProduct(c: StrunzAreaCandidate[]) {
  const m = new Map<string, StrunzAreaCandidate[]>();
  c.forEach((x) => m.set(x.product_key, [...(m.get(x.product_key) ?? []), x]));
  return [...m.entries()].sort((a, b) => a[1][0].product_name.localeCompare(b[1][0].product_name, "de"));
}
