import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globaler Schalter `anamnese_enabled` in `app_settings`.
 * Default: true (Anamnesebogen zugänglich).
 */
export function useAnamneseEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "anamnese_enabled")
      .maybeSingle();
    const v = (data?.value as { enabled?: boolean } | null)?.enabled;
    // Default: true wenn noch kein Eintrag existiert
    setEnabled(v === undefined ? true : v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
    const channel = supabase
      .channel("app_settings_anamnese")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.anamnese_enabled" },
        () => fetchSetting()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled: enabled ?? true, loading, refresh: fetchSetting };
}
