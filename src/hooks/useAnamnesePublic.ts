import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globaler Schalter `anamnese_public` in `app_settings`.
 * Wenn true: `/anamnesebogen` ist OHNE Login zugänglich (nur zum Ausprobieren).
 * Default: false.
 */
export function useAnamnesePublic() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase.rpc("get_public_app_setting", {
      _key: "anamnese_public",
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
