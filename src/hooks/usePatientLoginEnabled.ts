import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liest und beobachtet den globalen Schalter `patient_login_enabled`
 * aus `app_settings`. Default: false (Anmeldung gesperrt).
 *
 * Sicherheitshärtung: Besucher lesen NICHT mehr direkt aus der Tabelle,
 * sondern über die SECURITY-DEFINER-Funktion `get_public_app_setting`,
 * damit interne Spalten (z. B. updated_by) nicht offengelegt werden.
 */
export function usePatientLoginEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase.rpc("get_public_app_setting", {
      _key: "patient_login_enabled",
    });
    const v = (data as { enabled?: boolean } | null)?.enabled;
    setEnabled(v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
    // Realtime auf app_settings ist für anon nicht mehr verfügbar.
    // Wir refetchen beim Tabwechsel / Window-Focus, damit Admin-Änderungen
    // bei Besuchern zeitnah sichtbar werden.
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchSetting();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchSetting);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchSetting);
    };
  }, []);

  return { enabled: enabled ?? false, loading, refresh: fetchSetting };
}
