import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lädt die admin-konfigurierten Gating-Overrides aus `infothek_gating`.
 * Map: href -> gated (true = nur für Freigeschaltete, false = öffentlich)
 * Ist ein Item nicht in der Tabelle, fällt die UI auf den hardgecodeten
 * `gated`-Default aus `infothekContent.ts` zurück.
 */
export function useInfothekGating() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Types werden erst nach Migration-Approval regeneriert -> cast
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => Promise<{
          data: Array<{ href: string; gated: boolean }> | null;
          error: unknown;
        }>;
      };
    })
      .from("infothek_gating")
      .select("href,gated");

    if (!error && data) {
      const map: Record<string, boolean> = {};
      for (const row of data) map[row.href] = !!row.gated;
      setOverrides(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isGated = useCallback(
    (href: string, defaultGated: boolean) => {
      if (Object.prototype.hasOwnProperty.call(overrides, href)) {
        return overrides[href];
      }
      return defaultGated;
    },
    [overrides]
  );

  return { overrides, isGated, loading, refresh: load };
}
