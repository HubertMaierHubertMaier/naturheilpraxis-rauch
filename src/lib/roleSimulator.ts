/**
 * Rollen-Simulator (nur für echte Admins gedacht).
 *
 * Speichert clientseitig eine simulierte Patientenrolle in localStorage und
 * sendet ein Event "role-sim-changed", auf das Hooks/Components reagieren.
 *
 * Hinweise:
 *  - Verändert NICHTS in der Datenbank.
 *  - Überschreibt das Ergebnis von `usePatientAccess` und (optional) die
 *    Admin-Anzeige im UI, damit der Admin sieht, was ein normaler Patient sieht.
 *  - Server-seitige Rechte (RLS) bleiben unverändert.
 */

export type SimulatedRole =
  | "off" // kein Override – echte Daten anzeigen
  | "visitor" // Besucher ohne Freischaltung (Admin-UI wird zusätzlich versteckt)
  | "anamnese_only" // Neuer Patient: nur Anamnesebogen-Download freigeschaltet
  | "altpatient_partial" // Altpatient: Bibliothek + Infothek vollständig
  | "verified_full"; // Verifizierter Patient: alles offen

export interface SimulatedAccessPreset {
  hideAdminUi: boolean;
  anamnese_download: boolean;
  infothek_all: boolean;
  library_access: boolean;
}

export const SIM_PRESETS: Record<Exclude<SimulatedRole, "off">, SimulatedAccessPreset> = {
  visitor: {
    hideAdminUi: true,
    anamnese_download: false,
    infothek_all: false,
    library_access: false,
  },
  anamnese_only: {
    hideAdminUi: true,
    anamnese_download: true,
    infothek_all: false,
    library_access: false,
  },
  altpatient_partial: {
    hideAdminUi: true,
    anamnese_download: false,
    infothek_all: true,
    library_access: true,
  },
  verified_full: {
    hideAdminUi: true,
    anamnese_download: true,
    infothek_all: true,
    library_access: true,
  },
};

export const SIM_ROLE_LABELS: Record<SimulatedRole, string> = {
  off: "Echte Sicht (Admin)",
  visitor: "Besucher (nicht freigeschaltet)",
  anamnese_only: "Neupatient – nur Anamnese frei",
  altpatient_partial: "Altpatient – Bibliothek + Infothek",
  verified_full: "Verifizierter Patient – alles offen",
};

const STORAGE_KEY = "role_simulator_v1";
const EVENT_NAME = "role-sim-changed";

export function getSimulatedRole(): SimulatedRole {
  if (typeof window === "undefined") return "off";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (
      v === "visitor" ||
      v === "anamnese_only" ||
      v === "altpatient_partial" ||
      v === "verified_full"
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "off";
}

export function setSimulatedRole(role: SimulatedRole) {
  try {
    if (role === "off") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, role);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function onSimulatedRoleChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getSimulatedPreset(): SimulatedAccessPreset | null {
  const role = getSimulatedRole();
  if (role === "off") return null;
  return SIM_PRESETS[role];
}
