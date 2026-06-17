import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PatientAccess {
  has_access: boolean;
  email?: string;
  anamnese_download: boolean;
  infothek_all: boolean;
  infothek_items: string[];
  library_access: boolean;
  note?: string;
}

const EMPTY: PatientAccess = {
  has_access: false,
  anamnese_download: false,
  infothek_all: false,
  infothek_items: [],
  library_access: false,
};

/**
 * Liefert die individuell freigeschalteten Bereiche für die eingeloggte Patienten-E-Mail.
 * Quelle: SECURITY-DEFINER-Funktion `get_my_patient_access`.
 */
export function usePatientAccess() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [access, setAccess] = useState<PatientAccess>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccess(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_patient_access");
    if (error || !data) {
      setAccess(EMPTY);
    } else {
      const d = data as Record<string, unknown>;
      setAccess({
        has_access: !!d.has_access,
        email: d.email as string | undefined,
        anamnese_download: !!d.anamnese_download,
        infothek_all: !!d.infothek_all,
        infothek_items: Array.isArray(d.infothek_items) ? (d.infothek_items as string[]) : [],
        library_access: !!d.library_access,
        note: d.note as string | undefined,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  /** Helper: darf der aktuelle Nutzer ein bestimmtes Infothek-Item (per href) sehen? */
  const canSeeInfothekItem = useCallback(
    (href: string) => {
      if (isAdmin) return true;
      if (access.infothek_all) return true;
      return access.infothek_items.includes(href);
    },
    [isAdmin, access]
  );

  return {
    access,
    loading: authLoading || loading,
    refresh,
    canSeeInfothekItem,
    canDownloadAnamnese: isAdmin || access.anamnese_download,
    canUseLibrary: isAdmin || access.library_access,
  };
}
