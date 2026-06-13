import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText, Trash2, Save, ShieldAlert, Loader2, Eye, X } from "lucide-react";
import { logTherapyEvent } from "./therapyEventLog";

export interface TherapySession {
  id: string;
  pseudonym_id: string;
  eingabe_daten: any;
  empfehlung: string;
  notiz: string | null;
  created_at: string;
  updated_at: string;
  kind?: string | null;
  befund_html?: string | null;
  befund_meta?: any;
  version_number?: number | null;
  version_label?: string | null;
  parent_session_id?: string | null;
  /** Server-side flags for the slim list view */
  is_truncated?: boolean;
  has_befund_html?: boolean;
  has_empfehlung?: boolean;
}



interface Props {
  pseudonymId: string;
  onLoadSession: (session: TherapySession) => void;
  onShowBefund?: (session: TherapySession) => void;
}

type StoredDetail = { label: string; value: string };
type LoadSourceRow = { label?: string; chars?: number; lines?: number; key?: string };

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const countTextLines = (value: string) => value.split(/\n+/).filter((line) => line.trim()).length;
const formatLoadSourceAmount = (source: LoadSourceRow) => {
  const chars = Number(source.chars || 0);
  const lines = Number(source.lines || 0);
  if (chars > 0) return `${chars.toLocaleString("de-DE")} Zeichen · ${lines.toLocaleString("de-DE")} Zeile(n)`;
  if (lines > 0) return `${lines.toLocaleString("de-DE")} Eintrag(e)`;
  return "geladen";
};

const isEmptyAutosaveOnly = (session: TherapySession): boolean => {
  if (session.kind === "event_log") return false;
  const input = session.eingabe_daten || {};
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === "autoSavedDraft" && input.autoSavedDraft === true;
};

const summarizeGenericArray = (value: unknown): string => {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      const parts = [row.name, row.title, row.label, row.index, row.organe]
        .map((part) => asText(part))
        .filter(Boolean);
      return parts.join(" · ");
    })
    .filter(Boolean)
    .join("\n");
};

const summarizeMannayanOrders = (orders: unknown): string => {
  if (!Array.isArray(orders) || orders.length === 0) return "";
  const items = orders.flatMap((order: any) => (Array.isArray(order?.items) ? order.items : []));
  if (!items.length) return `${orders.length} Bestellung(en) gespeichert`;
  const total = items.reduce((sum: number, item: any) => {
    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price_eur || 0);
    return sum + (Number.isFinite(quantity * price) ? quantity * price : 0);
  }, 0);
  const lines = items.slice(0, 30).map((item: any) => {
    const quantity = Number(item?.quantity || 0);
    const amount = quantity > 0 ? `${quantity}× ` : "";
    const name = asText(item?.name) || asText(item?.sku) || "Mittel";
    const unit = asText(item?.unit);
    return `${amount}${name}${unit ? ` · ${unit}` : ""}`;
  });
  const suffix = items.length > 30 ? `\n… und ${items.length - 30} weitere Position(en)` : "";
  return `${items.length} Position(en)${total > 0 ? ` · ca. ${total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : ""}\n${lines.join("\n")}${suffix}`;
};

export const buildStoredDetails = (input: any): StoredDetail[] => {
  const e = input || {};
  const details: StoredDetail[] = [];
  const add = (label: string, value: unknown) => {
    const text = asText(value);
    if (text) details.push({ label, value: text });
  };

  const summarizeDiagnoses = (value: unknown): string => {
    if (!Array.isArray(value)) return "";
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        const row = item as Record<string, unknown>;
        const diagnose = asText(row.diagnose) || asText(row.label) || asText(row.name);
        const icd10 = asText(row.icd10);
        const begruendung = asText(row.begruendung);
        return [icd10, diagnose, begruendung].filter(Boolean).join(" · ");
      })
      .filter(Boolean)
      .join("\n");
  };

  add("Alter", e.alter ? `${e.alter} J.` : "");
  add("Geschlecht", e.geschlecht === "maennlich" ? "männlich" : e.geschlecht === "weiblich" ? "weiblich" : e.geschlecht);
  add("Beschwerden / Symptome", e.symptome);
  add("Erkrankung / Diagnose", e.erkrankung);
  add("Diagnosen aus Befundauswertung", summarizeDiagnoses(e.manualDiagnosen) || summarizeDiagnoses(e.diagnosen));
  add("Aktuelle Medikamente", e.medikamente);
  add("Bisherige Mittel", e.bisherigeMittel);
  add("Budget / Priorität", e.budget);
  add("Belastungen / Pathogene", e.belastungen || summarizeGenericArray(e.pathogens));
  add("Laborwerte", e.laborKomplett || [e.laborErhoeht && `↑ Erhöht:\n${e.laborErhoeht}`, e.laborErniedrigt && `↓ Erniedrigt:\n${e.laborErniedrigt}`].filter(Boolean).join("\n\n"));
  add("Stuhlbefund", e.stuhlbefund);
  add("Arztbericht", e.arztbericht);
  add("Metatron / HEEL", e.metatronHeel);
  add("Sonstige Untersuchungen / hochgeladene Dokumente", e.sonstigeUntersuchungen);
  add("Zusätzliche Analyse", e.perplexityAnalyse);
  add("Eigene Therapievorlage", e.eigeneTherapieVorlage);
  add("Ausgewählte Kategorien", summarizeGenericArray(e.selectedCategories));
  add("Bevorzugte Produktlinien", summarizeGenericArray(e.bevorzugteLinie));
  add("Fixierte Mittel", summarizeGenericArray(e.pinnedMittel));
  add("Mannayan-Bestellung", summarizeMannayanOrders(e.mannayanOrders));

  return details;
};

export function PseudonymHistory({ pseudonymId, onLoadSession, onShowBefund }: Props) {
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const { toast } = useToast();

  const loadSessions = useCallback(async () => {
    if (!pseudonymId.trim()) {
      setSessions([]);
      return;
    }
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      toast({ title: "Nicht angemeldet", description: "Bitte erneut einloggen.", variant: "destructive" });
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("get-therapy-sessions", {
      body: { pseudonym_id: pseudonymId.trim() },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      setSessions([]);
    } else {
      const visibleSessions = ((data as any)?.sessions ?? []).filter((session: TherapySession) => (
        !["befund_checkpoint", "quarantine_patient_mismatch"].includes(String(session.kind || "")) &&
        !isEmptyAutosaveOnly(session)
      ));
      setSessions(visibleSessions);
    }
    setLoading(false);
  }, [pseudonymId, toast]);

  useEffect(() => {
    setHistoryOpen(true);
    setExpandedId(null);
    setEditNoteId(null);
    const t = setTimeout(loadSessions, 300);
    return () => clearTimeout(t);
  }, [loadSessions]);

  /**
   * Lazy-load the full row. The backend returns only safe extracted
   * Zusatzangaben from eingabe_daten, never embedded document/base64 payloads.
   * for one slim list entry. Merges the result back into `sessions` so the UI
   * keeps working with the same TherapySession shape.
   */
  const fetchFullSession = useCallback(async (id: string, includeBefundHtml = false): Promise<TherapySession | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return null;
    const { data, error } = await supabase.functions.invoke("get-therapy-sessions", {
      body: { session_id: id, include_befund_html: includeBefundHtml },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      return null;
    }
    const full = (data as any)?.session as TherapySession | null;
    if (full) {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...full, is_truncated: false } : s)));
    }
    return full;
  }, [toast]);


  const handleDelete = async (id: string) => {
    if (!confirm("Diese Sitzung endgültig löschen?")) return;
    const { error } = await (supabase as any).from("therapy_sessions").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gelöscht" });
      loadSessions();
    }
  };

  const handleSaveNote = async (id: string) => {
    const { error } = await (supabase as any)
      .from("therapy_sessions")
      .update({ notiz: noteDraft })
      .eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notiz gespeichert" });
      setEditNoteId(null);
      loadSessions();
    }
  };

  if (!pseudonymId.trim()) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <History className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Pseudonym-ID eingeben, um Verlauf zu laden
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <History className="h-4 w-4 text-primary" />
            Verlauf: <span className="font-mono text-primary">{pseudonymId}</span>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Badge variant="secondary" className="text-xs">
              {sessions.length} Sitzung{sessions.length !== 1 ? "en" : ""}
            </Badge>
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1 text-xs"
            onClick={() => {
              setHistoryOpen((open) => !open);
              setExpandedId(null);
              setEditNoteId(null);
            }}
          >
            {historyOpen ? <X className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
            {historyOpen ? "Verlauf schließen" : "Verlauf öffnen"}
          </Button>
        </div>
      </CardHeader>
      {historyOpen && <CardContent>
        {sessions.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine gespeicherten Sitzungen für dieses Pseudonym.
          </p>
        )}
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {sessions.map((s) => {
              const isExpanded = expandedId === s.id;
              const date = new Date(s.created_at).toLocaleString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              // ─── Verlaufs-Event (Upload / Save / Befund-HTML / PDF / Re-Analyse) ───
              if (s.kind === "event_log") {
                const meta: any = s.befund_meta || {};
                const type: string = meta.event_type || "event";
                const label: string = meta.label || "Verlaufs-Event";
                const files: Array<{ name: string; pages?: number; chars?: number; archivePath?: string }> = Array.isArray(meta.files) ? meta.files : [];
                const sourceSummary: LoadSourceRow[] = Array.isArray(meta.source_summary)
                  ? meta.source_summary
                  : Array.isArray(meta.loaded_fields) ? meta.loaded_fields : [];
                const isPatientContextLoad = type === "patient_context_loaded";
                const visibleSourceSummary = isPatientContextLoad ? sourceSummary : sourceSummary.slice(0, 8);
                const success = type.endsWith("_success") || type === "documents_uploaded" || type === "documents_saved" || type === "befund_pdf_saved" || type === "patient_saved";
                const failed = type.endsWith("_failed");
                const started = type.endsWith("_started");
                const borderClass = failed
                  ? "border-destructive/40 bg-destructive/5"
                  : success
                  ? "border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : started
                  ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/15"
                  : "border-border bg-muted/20";
                return (
                  <div key={s.id} className={`border rounded-md p-2 text-xs ${borderClass}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground">{date}</span>
                      {typeof meta.duration_ms === "number" && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">{Math.round(meta.duration_ms / 1000)}s</Badge>
                      )}
                      {meta.model && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">{meta.model}</Badge>
                      )}
                      {typeof meta.total_chars === "number" && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {Number(meta.total_chars).toLocaleString("de-DE")} Z.
                        </Badge>
                      )}
                      {isPatientContextLoad && typeof meta.field_count === "number" && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4">
                          {Number(meta.field_count).toLocaleString("de-DE")} Feldgruppe(n)
                        </Badge>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        className="h-5 px-1 ml-auto text-destructive hover:text-destructive"
                        title="Event aus Verlauf entfernen"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {files.length > 0 && (
                      <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                        {files.slice(0, 8).map((f, i) => (
                          <li key={i}>
                            <span className="font-mono">{f.name}</span>
                            {f.pages ? <span> · {f.pages} S.</span> : null}
                            {f.archivePath ? <span> · ✓ archiviert</span> : null}
                          </li>
                        ))}
                        {files.length > 8 && <li className="italic">… und {files.length - 8} weitere</li>}
                      </ul>
                    )}
                    {meta.error && (
                      <p className="mt-1 text-destructive">Fehler: {String(meta.error)}</p>
                    )}
                    {isPatientContextLoad && (
                      <div className="mt-2 rounded-md border border-primary/25 bg-primary/5 p-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span><strong className="text-foreground">Quelle:</strong> {String(meta.source || "nicht angegeben")}</span>
                          {typeof meta.total_chars === "number" && <span><strong className="text-foreground">Umfang:</strong> {Number(meta.total_chars).toLocaleString("de-DE")} Zeichen</span>}
                          {typeof meta.diagnose_count === "number" && <span><strong className="text-foreground">Diagnosen:</strong> {Number(meta.diagnose_count).toLocaleString("de-DE")}</span>}
                          {typeof meta.labor_lines === "number" && <span><strong className="text-foreground">Labor:</strong> {Number(meta.labor_lines).toLocaleString("de-DE")} Zeile(n)</span>}
                        </div>
                      </div>
                    )}
                    {meta.note && !files.length && !isPatientContextLoad && (
                      <p className="mt-0.5 text-muted-foreground italic">{String(meta.note)}</p>
                    )}
                    {sourceSummary.length > 0 && (
                      <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                        {visibleSourceSummary.map((source, i) => (
                          <li key={i}>
                            {String(source.label || "Quelle")} · {formatLoadSourceAmount(source)}
                          </li>
                        ))}
                        {!isPatientContextLoad && sourceSummary.length > 8 && <li className="italic">… und {sourceSummary.length - 8} weitere Quellen</li>}
                      </ul>
                    )}
                  </div>
                );
              }
              const e = s.eingabe_daten || {};
              const hasSlimPlaceholder = s.is_truncated && Object.keys(e).length === 0;
              const summary =
                e.symptome?.slice(0, 60) ||
                e.erkrankung?.slice(0, 60) ||
                e.belastungen?.slice(0, 60) ||
                (hasSlimPlaceholder ? "Details werden erst beim Öffnen geladen" : "—");
              const labParts: string[] = [];
              if (e.laborKomplett?.trim()) labParts.push(`Labor (${String(e.laborKomplett).split(/\n+/).filter(Boolean).length} Werte)`);
              else {
                if (e.laborErhoeht?.trim()) labParts.push(`Labor↑ (${String(e.laborErhoeht).split(/[\n,;]+/).filter((x:string)=>x.trim()).length})`);
                if (e.laborErniedrigt?.trim()) labParts.push(`Labor↓ (${String(e.laborErniedrigt).split(/[\n,;]+/).filter((x:string)=>x.trim()).length})`);
              }
              if (e.stuhlbefund?.trim()) labParts.push("Stuhlbefund");
              if (e.arztbericht?.trim()) labParts.push("Arztbericht");
              if (e.metatronHeel?.trim()) labParts.push("Metatron/HEEL");
              if (e.autoSavedDraft) labParts.push("Auto-Sicherung");
              const labPreview =
                e.laborKomplett?.trim() ||
                [e.laborErhoeht, e.laborErniedrigt].filter((x:string)=>x?.trim()).join("\n") ||
                "";
              const storedDetails = buildStoredDetails(e);
              const visibleDetailLabels = storedDetails.slice(0, 4).map((detail) => {
                const lineCount = countTextLines(detail.value);
                return lineCount > 1 ? `${detail.label} (${lineCount} Zeilen)` : detail.label;
              });
              const visibleDetailPreviews = storedDetails.slice(0, 2).map((detail) => ({
                ...detail,
                value: detail.value.length > 220 ? `${detail.value.slice(0, 220).trim()} …` : detail.value,
              }));

              const isBefund = s.kind === "befund_auswertung" || s.has_befund_html === true || !!s.befund_html;
              const meta = s.befund_meta || {};
              const befundSources: Array<{ label?: string; chars?: number; lines?: number }> = Array.isArray(meta.source_summary)
                ? meta.source_summary
                : Array.isArray(e.sourceSummary) ? e.sourceSummary : [];
              const openBefund = async () => {
                let row: TherapySession | null = s;
                if (!row.befund_html) {
                  row = await fetchFullSession(s.id, true);
                  if (!row?.befund_html) return;
                }
                if (onShowBefund) {
                  onShowBefund(row);
                  return;
                }
                const w = window.open("", "_blank");
                if (w) {
                  w.document.open();
                  w.document.write(row.befund_html as string);
                  w.document.close();
                }
              };

              const saveBefundPdf = async () => {
                let row: TherapySession | null = s;
                if (!row.befund_html) {
                  row = await fetchFullSession(s.id, true);
                  if (!row?.befund_html) return;
                }
                const w = window.open("", "_blank");
                if (!w) return;
                const d = new Date(s.created_at);
                const pad = (n: number) => String(n).padStart(2, "0");
                const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
                const filename = `Befund-Auswertung_${pseudonymId}_${dateStr}`;
                const html = row.befund_html as string;
                // Inject print trigger + filename hint (browser uses document.title as default PDF name)
                const injected = html.includes("</body>")
                  ? html.replace(
                      "</body>",
                      `<script>document.title=${JSON.stringify(filename)};window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body>`,
                    )
                  : `<!doctype html><html><head><title>${filename}</title></head><body>${html}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body></html>`;
                w.document.open();
                w.document.write(injected);
                w.document.close();
                await logTherapyEvent(pseudonymId, "befund_pdf_saved", {
                  note: `PDF-Druckdialog für „${filename}" geöffnet`,
                  source: "Verlauf · Als PDF speichern",
                });
                // Verlauf neu laden, damit das Event sofort sichtbar ist
                loadSessions();
              };


              return (
                <div key={s.id} className={`border rounded-md p-3 hover:bg-muted/30 transition ${isBefund ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <div className="flex items-start gap-2">
                    <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${isBefund ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!isBefund && typeof s.version_number === "number" && (
                          <Badge variant="default" className="text-[10px] py-0 h-4 bg-primary/80">
                            V{s.version_number}
                          </Badge>
                        )}
                        <span className="text-xs font-medium text-foreground">{date}</span>
                        {isBefund && (
                          <Badge variant="default" className="text-[10px] py-0 h-4">📄 Befund-Auswertung</Badge>
                        )}
                        {s.version_label && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/40">
                            🏷 {s.version_label}
                          </Badge>
                        )}
                        {s.parent_session_id && (
                          <span className="text-[10px] text-muted-foreground">
                            ⤴ basiert auf Vorversion
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {isBefund
                          ? `${(meta.total_chars || 0).toLocaleString("de-DE")} Zeichen · ${meta.chunk_count || "?"} Teilpaket(e)${meta.model ? ` · ${meta.model}` : ""}`
                          : summary}
                      </p>
                      {!isBefund && s.is_truncated && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4 mt-1 border-primary/40">
                          schlanke Liste · Volltext auf Klick
                        </Badge>
                      )}
                      {!isBefund && labParts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {labParts.map((l, i) => (
                            <Badge key={i} variant={l === "Auto-Sicherung" ? "secondary" : "outline"} className="text-[10px] py-0 h-4">{l}</Badge>
                          ))}
                        </div>
                      )}
                      {!isBefund && visibleDetailLabels.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Gespeichert: {visibleDetailLabels.join(" · ")}{storedDetails.length > visibleDetailLabels.length ? ` · +${storedDetails.length - visibleDetailLabels.length} weitere` : ""}
                        </p>
                      )}
                      {!isBefund && hasSlimPlaceholder && (
                        <p className="text-[11px] text-primary mt-1">
                          Zusatzangaben werden automatisch in die Verlaufsanzeige geladen …
                        </p>
                      )}
                      {!isBefund && visibleDetailPreviews.length > 0 && (
                        <div className="mt-2 rounded-md border border-primary/25 bg-primary/5 p-2 space-y-1">
                          <p className="text-[11px] font-medium text-foreground">Zusatzangaben im Verlauf</p>
                          {visibleDetailPreviews.map((detail) => (
                            <div key={detail.label} className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{detail.label}: </span>
                              <span className="whitespace-pre-wrap">{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isBefund && befundSources.length > 0 && (
                        <div className="mt-2 rounded-md border border-primary/25 bg-primary/5 p-2 space-y-1">
                          <p className="text-[11px] font-medium text-foreground">Für diese Auswertung geladen</p>
                          {befundSources.slice(0, 6).map((source, i) => (
                            <div key={`${source.label || "Quelle"}-${i}`} className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{String(source.label || "Quelle")}: </span>
                              {Number(source.chars || 0).toLocaleString("de-DE")} Zeichen · {Number(source.lines || 0).toLocaleString("de-DE")} Zeile(n)
                            </div>
                          ))}
                          {befundSources.length > 6 && <p className="text-[11px] text-muted-foreground italic">… und {befundSources.length - 6} weitere Quellen</p>}
                        </div>
                      )}
                      {s.notiz && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
                          📝 {s.notiz}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 mt-2 flex-wrap">
                    {isBefund && (
                      <>
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={openBefund}>
                          <FileText className="h-3 w-3" />
                          Auswertung hier anzeigen
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={saveBefundPdf}>
                          <FileText className="h-3 w-3" />
                          Als PDF speichern
                        </Button>
                      </>
                    )}
                    {!isBefund && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={async () => {
                            if (isExpanded) {
                              setExpandedId(null);
                              return;
                            }
                            setExpandedId(s.id);
                            if (s.is_truncated) await fetchFullSession(s.id);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          {isExpanded ? "Ausblenden" : "Anzeigen"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={async () => {
                            const full = s.is_truncated ? await fetchFullSession(s.id) : s;
                            if (full) onLoadSession(full);
                          }}
                        >
                          In neue Version übernehmen
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditNoteId(s.id);
                        setNoteDraft(s.notiz || "");
                      }}
                    >
                      Notiz
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>

                  </div>

                  {editNoteId === s.id && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="z. B. Re-Test in 4 Wochen, Verlauf gut..."
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSaveNote(s.id)}>
                          <Save className="h-3 w-3" />
                          Speichern
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditNoteId(null)}>
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {storedDetails.length > 0 && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-2">
                          <p className="text-xs font-medium text-foreground">Für dich gespeicherte Zusatzangaben</p>
                          {storedDetails.map((detail) => (
                            <details key={detail.label} open={detail.value.length < 1200}>
                              <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                                {detail.label} · {detail.value.length.toLocaleString("de-DE")} Zeichen
                              </summary>
                              <div className="text-xs bg-background/70 p-2 rounded mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap">
                                {detail.value}
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                      {(e.laborKomplett?.trim() || e.laborErhoeht?.trim() || e.laborErniedrigt?.trim()) && (
                        <details open>
                          <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                            🧪 Laborwerte{e.laborDatum ? ` (Befund vom ${e.laborDatum})` : ""}
                          </summary>
                          <div className="text-xs bg-muted/50 p-2 rounded mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {e.laborKomplett?.trim() ? e.laborKomplett : [
                              e.laborErhoeht?.trim() && `↑ Erhöht:\n${e.laborErhoeht}`,
                              e.laborErniedrigt?.trim() && `↓ Erniedrigt:\n${e.laborErniedrigt}`,
                            ].filter(Boolean).join("\n\n")}
                          </div>
                        </details>
                      )}
                      {e.stuhlbefund?.trim() && (
                        <details>
                          <summary className="text-xs font-medium cursor-pointer text-muted-foreground">💩 Stuhlbefund</summary>
                          <div className="text-xs bg-muted/50 p-2 rounded mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap">{e.stuhlbefund}</div>
                        </details>
                      )}
                      {e.arztbericht?.trim() && (
                        <details>
                          <summary className="text-xs font-medium cursor-pointer text-muted-foreground">🩺 Arztbericht{e.arztberichtDatum ? ` (Bericht vom ${e.arztberichtDatum})` : ""}</summary>
                          <div className="text-xs bg-muted/50 p-2 rounded mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap">{e.arztbericht}</div>
                        </details>
                      )}
                      {e.metatronHeel?.trim() && (
                        <details>
                          <summary className="text-xs font-medium cursor-pointer text-muted-foreground">🔬 Metatron / HEEL</summary>
                          <div className="text-xs bg-muted/50 p-2 rounded mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap">{e.metatronHeel}</div>
                        </details>
                      )}
                      <details>
                        <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                          Eingabe-Daten
                        </summary>
                        <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(s.eingabe_daten, null, 2)}
                        </pre>
                      </details>
                      <details open>
                        <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                          Empfehlung (Volltext)
                        </summary>
                        <div className="text-xs bg-muted/50 p-2 rounded mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap">
                          {s.empfehlung}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded text-xs text-amber-800 dark:text-amber-300 flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>DSGVO-Hinweis:</strong> Hier nur Pseudonyme verwenden. Die Zuordnung Pseudonym → Patient
            führst du ausschließlich in deiner lokalen Patientenakte (offline/verschlüsselt).
          </span>
        </div>
      </CardContent>}
    </Card>
  );
}

/** Generiert eine Pseudonym-ID nach Schema P-YYYY-NNNN */
export function generatePseudonymId(existing: string[] = []): string {
  const year = new Date().getFullYear();
  const prefix = `P-${year}-`;
  const numbers = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
