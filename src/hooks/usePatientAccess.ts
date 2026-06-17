import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSimulatedPreset,
  getSimulatedRole,
  onSimulatedRoleChange,
} from "@/lib/roleSimulator";

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
 *
 * Der Rollen-Simulator (siehe `lib/roleSimulator.ts`) kann diese Werte clientseitig
 * für Test-Zwecke überschreiben. Das hat keinen Einfluss auf RLS oder Backend-Rechte.
 */
export function usePatientAccess() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [access, setAccess] = useState<PatientAccess>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [simTick, setSimTick] = useState(0);

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

  // Re-render bei Simulator-Änderungen
  useEffect(() => onSimulatedRoleChange(() => setSimTick((n) => n + 1)), []);

  // Effektive Werte: Simulator > echte Daten
  const sim = getSimulatedPreset();
  const simActive = sim !== null;
  const effectiveAccess: PatientAccess = sim
    ? {
        has_access:
          sim.anamnese_download || sim.infothek_all || sim.library_access,
        email: access.email,
        anamnese_download: sim.anamnese_download,
        infothek_all: sim.infothek_all,
        infothek_items: [],
        library_access: sim.library_access,
        note: `Simuliert: ${getSimulatedRole()}`,
      }
    : access;

  // Wenn der Simulator aktiv ist, sollen Admin-Kurzschlüsse NICHT mehr greifen –
  // sonst sieht der Admin trotzdem alles.
  const effectiveIsAdmin = simActive ? false : isAdmin;

  const canSeeInfothekItem = useCallback(
    (href: string) => {
      if (effectiveIsAdmin) return true;
      if (effectiveAccess.infothek_all) return true;
      return effectiveAccess.infothek_items.includes(href);
    },
    [effectiveIsAdmin, effectiveAccess]
  );

  return {
    access: effectiveAccess,
    loading: authLoading || loading,
    refresh,
    canSeeInfothekItem,
    canDownloadAnamnese: effectiveIsAdmin || effectiveAccess.anamnese_download,
    canUseLibrary: effectiveIsAdmin || effectiveAccess.library_access,
    // Information für UI-Komponenten, ob ein Simulator-Override aktiv ist
    isSimulated: simActive,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _simTick: simTick,
  };
}
