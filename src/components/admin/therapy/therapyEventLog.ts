import { supabase } from "@/integrations/supabase/client";

/**
 * Verlaufs-Events (zusätzlich zu den eigentlichen Sitzungen).
 * Werden als zusätzliche Zeilen in therapy_sessions abgelegt
 * (kind='event_log'), damit die Patientenakte einen lückenlosen
 * Audit-Trail hat: Upload → Speichern → Auswertung → PDF.
 */
export type TherapyEventType =
  | "documents_uploaded"
  | "documents_saved"
  | "befund_html_success"
  | "befund_html_failed"
  | "befund_pdf_saved"
  | "full_analysis_started"
  | "full_analysis_success"
  | "full_analysis_failed"
  | "patient_saved";

export interface TherapyEventDetails {
  files?: Array<{ name: string; pages?: number; chars?: number; archivePath?: string; error?: string }>;
  error?: string;
  duration_ms?: number;
  total_chars?: number;
  chunk_count?: number;
  model?: string;
  source?: string;
  note?: string;
  [key: string]: unknown;
}

const labelFor = (t: TherapyEventType): string => {
  switch (t) {
    case "documents_uploaded": return "📥 Dokumente hochgeladen";
    case "documents_saved": return "💾 Dokumente fest gespeichert";
    case "befund_html_success": return "📄 Befund-Auswertung (HTML) erstellt";
    case "befund_html_failed": return "⚠ Befund-Auswertung fehlgeschlagen";
    case "befund_pdf_saved": return "🖨 Befund als PDF gedruckt/gespeichert";
    case "full_analysis_started": return "▶ Alles neu auswerten – gestartet";
    case "full_analysis_success": return "✓ Alles neu auswerten – erfolgreich";
    case "full_analysis_failed": return "✗ Alles neu auswerten – fehlgeschlagen";
    case "patient_saved": return "💾 Therapieplan finalisiert";
  }
};

export async function logTherapyEvent(
  pseudonymId: string | undefined | null,
  type: TherapyEventType,
  details: TherapyEventDetails = {},
): Promise<void> {
  const pid = (pseudonymId || "").trim();
  if (!pid) {
    console.warn("[therapyEventLog] SKIP: pseudonymId leer", { type });
    return;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[therapyEventLog] SKIP: kein eingeloggter User", { type });
      return;
    }
    const label = labelFor(type);
    const ts = new Date().toISOString();
    const { error } = await (supabase as any).from("therapy_sessions").insert({
      pseudonym_id: pid,
      kind: "event_log",
      eingabe_daten: { _pseudonym_id: pid, pseudonymId: pid, kind: "event_log" },
      empfehlung: "",
      notiz: label,
      befund_meta: { event_type: type, label, ts, ...details },
      created_by: user.id,
    });
    if (error) {
      console.error("[therapyEventLog] INSERT FEHLER", { type, message: error.message });
    } else {
      console.info("[therapyEventLog] ✓ gespeichert", { type });
    }
  } catch (e) {
    console.error("[therapyEventLog] EXCEPTION:", (e as Error).message, { type });
  }
}
