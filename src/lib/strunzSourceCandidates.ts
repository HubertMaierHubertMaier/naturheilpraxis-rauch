import data from "../../docs/wiki/strunz-quellkandidaten-53-2026-10-07.json";

/** Read-only review of the 53 staged Strunz source candidates (batch ffe44e71). Product key only from identical product URL or explicit product token, never from a shared nutrient. */
export interface StrunzSourceCandidate {
  candidate_id: string; candidate_key: string; candidate_status: string; source_type: string;
  typ: string; product_key: string | null; zuordnung: "eindeutig" | "offen"; begruendung: string;
  source_url: string | null; fundstelle: string | null; core_source_id: string | null;
  core_source_revision_id: string | null; materialization_status: string | null;
}

export const STRUNZ_SOURCES = data as unknown as {
  geprueft: string; batch_id: string; modus: string; anzahl: number; regel: string;
  nach_typ: Record<string, number>; kandidaten: StrunzSourceCandidate[];
};

export const TYP_LABEL: Record<string, string> = {
  produkt_quelle: "Produktquelle (Herstellerseite)",
  produktvorpruefung_form_population: "Produktvorprüfung Form/Zielgruppe",
  sicherheitspruefung: "Sicherheitsprüfung",
  einzelstoff_referenz: "Einzelstoff-Referenz",
  regulatorische_referenz: "Regulatorische Referenz",
  sonstig_audit: "Sonstiger Prüfbericht",
};

export function sourcesByProduct(c: StrunzSourceCandidate[]) {
  const m = new Map<string, StrunzSourceCandidate[]>();
  c.forEach((x) => { if (x.product_key) m.set(x.product_key, [...(m.get(x.product_key) ?? []), x]); });
  return m;
}
