import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globaler Datenschutz-Kill-Switch `anamnese_online_enabled` in `app_settings`.
 * Steuert, ob das ONLINE-Anamnese-Formular `/anamnesebogen` benutzt werden darf.
 *
 * Default: false (gesperrt) – Patientendaten dürfen aus Datenschutzgründen NICHT
 * online erfasst werden, bis Peter das DSGVO-konform freigeschaltet hat.
 *
 * Admins werden im Guard separat durchgelassen (Test-/Wartungszwecke).
 */
export function useAnamneseOnlineEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "anamnese_online_enabled")
      .maybeSingle();
    const v = (data?.value as { enabled?: boolean } | null)?.enabled;
    // Default: false (gesperrt) wenn noch kein Eintrag existiert
    setEnabled(v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
    const channel = supabase
      .channel("app_settings_anamnese_online")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.anamnese_online_enabled" },
        () => fetchSetting()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled: enabled ?? false, loading, refresh: fetchSetting };
}
