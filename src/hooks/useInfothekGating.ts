import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { infothekGroups } from "@/lib/infothekContent";
import { staticInfothekRoutes } from "@/lib/staticInfothekRoutes";

export type InfothekVisibility = "public" | "new_patient" | "patient";

const knownInfothekHrefs = [
  ...new Set([
    ...infothekGroups.flatMap((group) => group.items.map((item) => item.href)),
    ...staticInfothekRoutes.map((route) => route.path),
  ]),
];

/**
 * Lädt die admin-konfigurierten Sichtbarkeits-Regeln aus `infothek_gating`.
 * Map: href -> visibility
 *   - "public"      = für alle Besucher sichtbar (auch ohne Login, gut für SEO)
 *   - "new_patient" = nur für angemeldete Nutzer (auch unverifizierte Neuanmeldung)
 *   - "patient"     = nur für freigeschaltete Patienten
 *
 * Wichtig: Die Admin-Einstellung ist Source of Truth. `gated` im Code ist nur
 * ein Fallback, falls für einen Beitrag noch keine DB-Regel existiert.
 */
export function useInfothekGating() {
  const [overrides, setOverrides] = useState<Record<string, InfothekVisibility>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const client = supabase as unknown as {
      rpc: (
        name: "get_infothek_gating_for_routes",
        args: { _hrefs: string[] },
      ) => Promise<{
        data: Array<{ href: string; visibility: InfothekVisibility | null; gated: boolean | null }> | null;
        error: unknown;
      }>;
    };
    if (typeof client.rpc !== "function") {
      setLoading(false);
      return;
    }
    const { data, error } = await client.rpc("get_infothek_gating_for_routes", {
      _hrefs: knownInfothekHrefs,
    });

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
