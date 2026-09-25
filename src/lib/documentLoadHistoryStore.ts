import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_LOAD_EVENT, documentLoadEntries, type DocumentLoadEntry } from "./documentLoadHistory";

export async function recordDocumentLoad(userId: string, pid: string, eventId: string,
  file: File, documentType: string, loadedAt: string): Promise<DocumentLoadEntry> {
  if (!userId.trim() || !pid.trim() || !/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error("Ungültige Fallzuordnung.");
  const [entry] = await documentLoadEntries(JSON.stringify([userId, pid]), [{ arrayBuffer: () => file.arrayBuffer(), documentType }], loadedAt);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error("Anmeldung hat sich geändert.");
  const row = {
    id: eventId, pseudonym_id: pid, created_by: userId, kind: "event_log",
    eingabe_daten: { kind: "event_log", _pseudonym_id: pid, pseudonymId: pid }, empfehlung: "",
    notiz: "Dateiauswahl protokolliert – keine Inhaltsübernahme",
    befund_meta: { event_type: DOCUMENT_LOAD_EVENT, loads: [entry] },
  };
  const { error } = await supabase.from("therapy_sessions").insert(row);
  if (error && error.code !== "23505") throw new Error("Ladeverlauf konnte nicht gespeichert werden.");
  // Replaying an outbox entry after reload uses the same primary key. Never upsert
  // or update history: an acknowledged row must remain unchanged.
  const { data, error: readError } = await supabase.from("therapy_sessions")
    .select("befund_meta").eq("id", eventId).eq("pseudonym_id", pid).eq("created_by", userId).single();
  const meta = data?.befund_meta as { event_type?: string; loads?: DocumentLoadEntry[] } | undefined;
  const stored = meta?.loads?.[0];
  if (readError || meta?.event_type !== DOCUMENT_LOAD_EVENT || stored?.documentKey !== entry.documentKey || stored?.loadedAt !== loadedAt) {
    throw new Error("Speicherung des Ladeverlaufs ist nicht bestätigt.");
  }
  return stored;
}
