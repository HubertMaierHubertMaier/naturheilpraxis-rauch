import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type InfothekVisibility = "public" | "new_patient" | "patient";

/**
 * Lädt die admin-konfigurierten Sichtbarkeits-Overrides aus `infothek_gating`.
 * Map: href -> visibility
 *   - "public"      = für alle Besucher sichtbar (auch ohne Login, gut für SEO)
 *   - "new_patient" = nur für angemeldete Nutzer (auch unverifizierte Neuanmeldung)
 *   - "patient"     = nur für freigeschaltete Patienten
 *
 * Ist ein Item nicht in der Tabelle, fällt die UI auf den Default
 * (`gated` aus infothekContent.ts → "patient", sonst → "public") zurück.
 */
export function useInfothekGating() {
  const [overrides, setOverrides] = useState<Record<string, InfothekVisibility>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => Promise<{
          data: Array<{ href: string; visibility: InfothekVisibility | null; gated: boolean | null }> | null;
          error: unknown;
        }>;
      };
    })
      .from("infothek_gating")
      .select("href,visibility,gated");

    if (!error && data) {
      const map: Record<string, InfothekVisibility> = {};
      for (const row of data) {
        // visibility ist Source of Truth, gated nur Fallback für alte Daten
        const v: InfothekVisibility =
          row.visibility && ["public", "new_patient", "patient"].includes(row.visibility)
            ? row.visibility
            : row.gated
              ? "patient"
              : "public";
        map[row.href] = v;
      }
      setOverrides(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getVisibility = useCallback(
    (href: string, defaultGated: boolean): InfothekVisibility => {
      if (Object.prototype.hasOwnProperty.call(overrides, href)) {
        return overrides[href];
      }
      return defaultGated ? "patient" : "public";
    },
    [overrides]
  );

  // Backwards-compat-Helper
  const isGated = useCallback(
    (href: string, defaultGated: boolean) => getVisibility(href, defaultGated) !== "public",
    [getVisibility]
  );

  return { overrides, getVisibility, isGated, loading, refresh: load };
}
