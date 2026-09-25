import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_LOAD_EVENT, type DocumentLoadEntry } from "@/lib/documentLoadHistory";

const EVENT = DOCUMENT_LOAD_EVENT;
type Row = { id: string; created_at: string; befund_meta: { loads?: DocumentLoadEntry[] } };
const names: Record<string, string> = { anamnese: "Anamnese", metatron: "Metatron / Hospital", vieva: "VIEVA", labor: "Labor", arzt: "Arztbefund" };

export function DocumentLoadHistory({ userId, pid, revision, saveError }: {
  userId?: string; pid: string; revision: number; saveError: string;
}) {
  const [state, setState] = useState<{ scope: string; rows: Row[]; loading: boolean; error: boolean }>({ scope: "", rows: [], loading: false, error: false });
  const [page, setPage] = useState(0);
  const scope = JSON.stringify([userId, pid]);
  useEffect(() => { setPage(0); }, [scope]);
  useEffect(() => {
    let cancelled = false;
    if (!userId || !pid) return;
    setState({ scope, rows: [], loading: true, error: false });
    void (async () => {
      const { data, error } = await (supabase as any).from("therapy_sessions")
        .select("id,created_at,befund_meta").eq("created_by", userId).eq("pseudonym_id", pid)
        .eq("kind", "event_log").eq("befund_meta->>event_type", EVENT)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 20, page * 20 + 19);
      if (!cancelled) setState({ scope, rows: error ? [] : data || [], loading: false, error: !!error });
    })().catch(() => { if (!cancelled) setState({ scope, rows: [], loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [scope, userId, pid, revision, page]);
  if (!userId || !pid) return null;
  const current = state.scope === scope ? state : { rows: [], loading: true, error: false };
  return <section aria-label="Ladeverlauf" className="rounded-md border border-sky-400 bg-sky-50 p-3 text-slate-900 space-y-2">
    <h3 className="font-semibold">Ladeverlauf – jede neue Dateiauswahl</h3>
    <p className="text-xs">Gespeicherte Auswahlzeitpunkte, getrennt vom Anamnese- oder Befunddatum. Neue Auswahl ergänzt einen Eintrag; Wiederherstellen und Neuladen erzeugen keinen neuen. Keine Datei-Inhalte werden hierfür übertragen.</p>
    {saveError && <p role="alert" className="text-red-800">{saveError} Die Dateiauswahl bleibt erhalten; dieser Ladevorgang ist nicht als protokolliert bestätigt.</p>}
    {current.loading ? <p>Ladeverlauf wird geladen …</p> : current.error ? <p role="alert">Ladeverlauf konnte nicht abgerufen werden.</p> : !current.rows.length ? <p>Noch keine protokollierten Ladevorgänge auf dieser Seite. Frühere Auswahlzeitpunkte werden nicht nachträglich erfunden.</p> :
      <ol className="space-y-2">{current.rows.map(row => <li key={row.id} className="border-t border-sky-200 pt-2">
        {(Array.isArray(row.befund_meta?.loads) ? row.befund_meta.loads : []).filter(entry => typeof entry?.documentKey === "string" && typeof entry?.loadedAt === "string").map((entry, index) => <p key={`${row.id}-${index}`} className="text-sm">
          {names[entry.documentType] || "Dokument"} · Kennung {entry.documentKey.slice(0, 10)} · Ladedatum: {Number.isFinite(Date.parse(entry.loadedAt)) ? new Date(entry.loadedAt).toLocaleString("de-DE") : "unbekannt"}
        </p>)}
      </li>)}</ol>}
    <div className="flex gap-3 text-sm">
      <button type="button" disabled={!page || current.loading} onClick={() => setPage(p => p - 1)}>Neuere Einträge</button>
      <button type="button" disabled={current.rows.length < 20 || current.loading} onClick={() => setPage(p => p + 1)}>Ältere Einträge</button>
    </div>
  </section>;
}
