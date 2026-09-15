export type MannayanOrderRow = {
  id: string; pseudonym_id: string | null; patient_label?: string | null;
  order_number: string; created_at: string; items: unknown; notes?: string | null;
};

/** A label may identify one complete pseudonym, never a prefix or a guessed name. */
export function extractUniquePatientPseudonym(value: string | null | undefined): string | null {
  const candidates = Array.from((value || "").matchAll(/(?<![\p{L}\p{N}])P-\d{4}-[\p{L}\p{N}_-]+/giu), match => match[0].toUpperCase());
  if (!candidates.length || candidates.some(id => !/^P-\d{4}-\d{4}$/.test(id))) return null;
  const unique = [...new Set(candidates)]; return unique.length === 1 ? unique[0] : null;
}

export function mannayanOrderMatchesPatient(row: Pick<MannayanOrderRow, "pseudonym_id" | "patient_label">, pid: string): boolean {
  const canonical = row.pseudonym_id?.trim();
  if (!canonical) return extractUniquePatientPseudonym(row.patient_label) === pid;
  if (canonical.toUpperCase() !== pid) return false;
  // Earlier entry code could truncate malformed IDs; contradictory explicit labels need review.
  if (/P-\d{4}-/i.test(row.patient_label || "")) return extractUniquePatientPseudonym(row.patient_label) === pid;
  return true;
}

/** Preserve canonical links and unambiguous legacy labels; paginate instead of hiding older orders. */
export async function loadPatientMannayanOrders(client: { from: (table: string) => any }, pseudonymId: string, isCurrent: () => boolean = () => true): Promise<MannayanOrderRow[]> {
  const pid = pseudonymId.trim().toUpperCase();
  if (!/^P-\d{4}-\d{4}$/.test(pid)) throw new Error("Für Mannayan-Bestellungen ist ein vollständiges Pseudonym erforderlich.");
  const size = 200; const found = new Map<string, MannayanOrderRow>();
  for (const legacy of [false, true]) {
    const visited = new Set<string>();
    for (let offset = 0; ; offset += size) {
      if (!isCurrent()) return [];
      let query = client.from("mannayan_orders").select("id, pseudonym_id, order_number, created_at, items, notes, patient_label");
      query = legacy ? query.or('pseudonym_id.is.null,pseudonym_id.eq.""').ilike("patient_label", `%${pid}%`) : query.eq("pseudonym_id", pid);
      const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + size - 1);
      if (error) throw error;
      if (!isCurrent()) return [];
      const rows = (data || []) as MannayanOrderRow[];
      if (!Array.isArray(rows)) throw new Error("Die Bestellungsantwort ist nicht lesbar.");
      let newPageIds = 0;
      for (const row of rows) {
        if (!row.id) throw new Error("Eine Bestellung hat keine eindeutige Kennung.");
        if (!visited.has(row.id)) { visited.add(row.id); newPageIds++; }
        if (!mannayanOrderMatchesPatient(row, pid)) {
          if (!legacy) throw new Error("Eine Bestellung gehört nicht zum angefragten Fall; keine Übernahme.");
          continue;
        }
        if (!found.has(row.id)) found.set(row.id, row);
      }
      if (rows.length < size) break;
      // Also detect repeated pages that contain only rejected legacy candidates.
      if (!newPageIds) throw new Error("Die Bestellungsabfrage wiederholt dieselbe Seite; bitte erneut prüfen.");
    }
  }
  return [...found.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

export function orderNumberOrMissing(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const number = Number(value); return Number.isFinite(number) ? number : undefined;
}
