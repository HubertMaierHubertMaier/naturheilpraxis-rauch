import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liest und beobachtet den globalen Schalter `patient_login_enabled`
 * aus `app_settings`. Default: false (Anmeldung gesperrt).
 */
export function usePatientLoginEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "patient_login_enabled")
      .maybeSingle();
    const v = (data?.value as { enabled?: boolean } | null)?.enabled;
    setEnabled(v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
    const channel = supabase
      .channel("app_settings_patient_login")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.patient_login_enabled" },
        () => fetchSetting()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled: enabled ?? false, loading, refresh: fetchSetting };
}
