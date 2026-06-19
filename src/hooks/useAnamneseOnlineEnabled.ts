import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globaler Datenschutz-Kill-Switch `anamnese_online_enabled` in `app_settings`.
 * Default: false (gesperrt).
 */
export function useAnamneseOnlineEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase.rpc("get_public_app_setting", {
      _key: "anamnese_online_enabled",
    });
    const v = (data as { enabled?: boolean } | null)?.enabled;
    setEnabled(v === true);
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

  return { enabled: enabled ?? false, loading, refresh: fetchSetting };
}
