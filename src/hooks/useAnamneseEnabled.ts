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
    const { data } = await supabase.rpc("get_public_app_setting", {
      _key: "anamnese_enabled",
    });
    const v = (data as { enabled?: boolean } | null)?.enabled;
    // Default: true wenn noch kein Eintrag existiert
    setEnabled(v === undefined ? true : v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
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

  return { enabled: enabled ?? true, loading, refresh: fetchSetting };
}
