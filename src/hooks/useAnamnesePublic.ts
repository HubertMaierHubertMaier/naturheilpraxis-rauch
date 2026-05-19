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
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "anamnese_public")
      .maybeSingle();
    const v = (data?.value as { enabled?: boolean } | null)?.enabled;
    setEnabled(v === true);
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
    const channel = supabase
      .channel("app_settings_anamnese_public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.anamnese_public" },
        () => fetchSetting()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled: enabled ?? false, loading, refresh: fetchSetting };
}
