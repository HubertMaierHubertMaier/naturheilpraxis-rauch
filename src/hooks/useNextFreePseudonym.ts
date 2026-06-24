import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PSEUDO_RE = /P-\d{4}-\d{4}/;

/** Findet die niedrigste freie P-YYYY-NNNN ab 0001 (Test-Range ≥ 2000 ignoriert). */
export function findFirstFreePseudonym(existing: Iterable<string>, year = new Date().getFullYear()): string {
  const prefix = `P-${year}-`;
  const taken = new Set<number>();
  for (const id of existing) {
    if (!id?.startsWith(prefix)) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!isNaN(n) && n > 0 && n < 2000) taken.add(n);
  }
  let n = 1;
  while (taken.has(n)) n++;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export async function fetchUsedPseudonymsForYear(year = new Date().getFullYear()): Promise<Set<string>> {
  const yearPrefix = `P-${year}-`;
  const [therapyRes, ordersRes] = await Promise.all([
    (supabase as any).from("therapy_sessions").select("pseudonym_id").like("pseudonym_id", `${yearPrefix}%`),
    (supabase as any).from("mannayan_orders").select("pseudonym_id, patient_label"),
  ]);
  const set = new Set<string>();
  for (const r of (therapyRes.data || []) as Array<{ pseudonym_id: string | null }>) {
    if (r.pseudonym_id?.startsWith(yearPrefix)) set.add(r.pseudonym_id);
  }
  for (const o of (ordersRes.data || []) as Array<{ pseudonym_id: string | null; patient_label: string | null }>) {
    const pid = o.pseudonym_id || (o.patient_label?.match(PSEUDO_RE)?.[0] ?? null);
    if (pid && pid.startsWith(yearPrefix)) set.add(pid);
  }
  return set;
}

export function useNextFreePseudonym() {
  const [nextFree, setNextFree] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const used = await fetchUsedPseudonymsForYear();
      setNextFree(findFirstFreePseudonym(used));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { nextFree, loading, refresh };
}
