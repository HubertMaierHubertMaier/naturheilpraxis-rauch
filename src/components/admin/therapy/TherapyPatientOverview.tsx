import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, RefreshCw, Search, Loader2, FileText, Eye, Printer,
  ShieldAlert, ChevronRight, ChevronDown, Trash2, Calendar
} from "lucide-react";
import { parseTherapyMarkdown } from "@/lib/therapyParser";
import { openPrintRecipe } from "./printRecipe";
import { formatPathogensForAI } from "./PathogenInput";
import { buildStoredDetails } from "./PseudonymHistory";

interface PseudonymRow {
  pseudonym_id: string;
  sessions_count: number;
  last_session_at: string;
  first_session_at: string;
  latest_summary: string;
  latest_notiz: string | null;
  orders_count?: number;
  order_numbers?: string[];
}


interface SessionRow {
  id: string;
  pseudonym_id: string;
  eingabe_daten: any;
  empfehlung: string;
  notiz: string | null;
  created_at: string;
  updated_at: string;
  kind?: string | null;
  is_truncated?: boolean;
  befund_meta?: any;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const fmtDateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const isEmptyAutosaveOnly = (session: SessionRow): boolean => {
  if (session.kind === "event_log") return false;
  const input = session.eingabe_daten || {};
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === "autoSavedDraft" && input.autoSavedDraft === true;
};

export function TherapyPatientOverview() {
  const [pseudonyms, setPseudonyms] = useState<PseudonymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sessionsByPid, setSessionsByPid] = useState<Record<string, SessionRow[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setSessionsByPid({});
    setOpenId(null);
    setExpandedSessionId(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      toast({ title: "Nicht angemeldet", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("list-therapy-pseudonyms", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      setPseudonyms([]);
    } else {
      setPseudonyms((data as any)?.pseudonyms ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadSessionsFor = async (pid: string, force = false): Promise<SessionRow[]> => {
    if (!force && sessionsByPid[pid]) return sessionsByPid[pid];
    setLoadingSessions(pid);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke("get-therapy-sessions", {
        body: { pseudonym_id: pid },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return [];
      }

      const sessions = (((data as any)?.sessions ?? []) as SessionRow[]).filter((session) => !isEmptyAutosaveOnly(session));
      setSessionsByPid((p) => ({ ...p, [pid]: sessions }));
      return sessions;
    } finally {
      setLoadingSessions(null);
    }
  };

  const togglePid = async (pid: string) => {
    if (openId === pid) {
      setOpenId(null);
      return;
    }
    setOpenId(pid);
    await loadSessionsFor(pid, true);
  };

  const fetchFullSession = async (sessionId: string, pid: string): Promise<SessionRow | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return null;

    const { data, error } = await supabase.functions.invoke("get-therapy-sessions", {
      body: { session_id: sessionId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return null;
    }

    const full = (data as any)?.session as SessionRow | null;
    if (full) {
      setSessionsByPid((prev) => ({
        ...prev,
        [pid]: (prev[pid] || []).map((row) => (row.id === sessionId ? { ...row, ...full, is_truncated: false } : row)),
      }));
    }
    return full;
  };

  const handleDelete = async (sessionId: string, pid: string) => {
    if (!confirm("Diese Sitzung endgültig löschen?")) return;
    const { error } = await (supabase as any).from("therapy_sessions").delete().eq("id", sessionId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gelöscht" });
    setSessionsByPid((p) => ({ ...p, [pid]: (p[pid] || []).filter((s) => s.id !== sessionId) }));
    loadOverview();
  };

  const handlePrint = (s: SessionRow, mode: "patient" | "praxis") => {
    if (!s.empfehlung?.trim()) {
      toast({ title: "Keine Empfehlung gespeichert", variant: "destructive" });
      return;
    }
    const parsed = parseTherapyMarkdown(s.empfehlung);
    const d = s.eingabe_daten || {};
    const belastungen = d.belastungen
      || (Array.isArray(d.pathogens) ? formatPathogensForAI(d.pathogens) : "");
    openPrintRecipe({
      parsed,
      patient: {
        alter: d.alter,
        schwanger: d.schwanger,
        medikamente: d.medikamente,
        budget: d.budget,
        belastungen,
        symptome: d.symptome,
        erkrankung: d.erkrankung,
        pseudonymId: s.pseudonym_id,
        notiz: s.notiz || undefined,
      },
      mode,
      // Keine selectedKeys → alle Mittel werden gedruckt (so wie sie gespeichert wurden)
    });
  };

  const filtered = pseudonyms.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.pseudonym_id.toLowerCase().includes(q) ||
      p.latest_summary.toLowerCase().includes(q) ||
      (p.latest_notiz || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Patientenübersicht – Therapieempfehlungen</h1>
          <p className="text-sm text-muted-foreground">
            Alle gespeicherten Therapieempfehlungen, gruppiert nach Pseudonym (P-JJJJ-NNNN).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadOverview} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="flex gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>DSGVO:</strong> Es werden ausschließlich Pseudonyme angezeigt. Die Zuordnung Pseudonym → Patient erfolgt
          nur in deiner geschützten lokalen Patientenakte.
        </span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Suche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pseudonym, Symptome, Erkrankung oder Notiz..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {loading ? "Lade..." : `${filtered.length} Pseudonym${filtered.length === 1 ? "" : "e"}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Noch keine gespeicherten Therapieempfehlungen vorhanden.
            </p>
          ) : (
            <ScrollArea className="max-h-[700px]">
              <div className="space-y-2">
                {filtered.map((p) => {
                  const isOpen = openId === p.pseudonym_id;
                  const sessions = sessionsByPid[p.pseudonym_id] || [];
                  return (
                    <div key={p.pseudonym_id} className="border border-border rounded-md">
                      <button
                        type="button"
                        onClick={() => togglePid(p.pseudonym_id)}
                        className="w-full text-left p-3 hover:bg-muted/40 transition flex items-start gap-2"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-primary">{p.pseudonym_id}</span>
                            <Badge variant="secondary" className="text-xs">
                              {p.sessions_count} Sitzung{p.sessions_count === 1 ? "" : "en"}
                            </Badge>
                            {(p.orders_count ?? 0) > 0 && (
                              <Badge className="text-xs" title={(p.order_numbers ?? []).join(", ")}>
                                {p.orders_count} Bestellung{p.orders_count === 1 ? "" : "en"}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              zuletzt: {fmtDateOnly(p.last_session_at)}
                            </span>

                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{p.latest_summary}</p>
                          {p.latest_notiz && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic truncate">
                              📝 {p.latest_notiz}
                            </p>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                          <div className="flex justify-end">
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => { setOpenId(null); setExpandedSessionId(null); }}
                            >
                              Verlauf schließen
                            </Button>
                          </div>
                          {loadingSessions === p.pseudonym_id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                              <Loader2 className="h-4 w-4 animate-spin" /> Lade Sitzungen...
                            </div>
                          ) : sessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Keine Sitzungen.</p>
                          ) : (
                            sessions.map((s) => {
                              const isExp = expandedSessionId === s.id;
                              const hasSlimPlaceholder = s.is_truncated && Object.keys(s.eingabe_daten || {}).length === 0;
                              const storedDetails = buildStoredDetails(s.eingabe_daten || {});
                              const storedLabels = storedDetails.slice(0, 4).map((detail) => detail.label);

                              // ─── Verlaufs-Event (Upload / Save / Befund-HTML / PDF / Re-Analyse) ───
                              if (s.kind === "event_log") {
                                const meta: any = s.befund_meta || {};
                                const type: string = meta.event_type || "event";
                                const label: string = meta.label || s.notiz || "Verlaufs-Event";
                                const files: Array<{ name: string; pages?: number; archivePath?: string }> = Array.isArray(meta.files) ? meta.files : [];
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
                                      <span className="text-muted-foreground">{fmtDate(s.created_at)}</span>
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
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-5 px-1 ml-auto text-destructive hover:text-destructive"
                                        title="Event aus Verlauf entfernen"
                                        onClick={() => handleDelete(s.id, p.pseudonym_id)}
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
                                    {meta.note && !files.length && (
                                      <p className="mt-0.5 text-muted-foreground italic">{String(meta.note)}</p>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div key={s.id} className="border border-border rounded bg-background p-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-medium">{fmtDate(s.created_at)}</span>
                                    <span className="text-[11px] text-muted-foreground">aktualisiert: {fmtDate(s.updated_at || s.created_at)}</span>
                                    {s.eingabe_daten?.erkrankung && (
                                      <Badge variant="outline" className="text-xs">
                                        {s.eingabe_daten.erkrankung}
                                      </Badge>
                                    )}
                                  </div>
                                  {(s.eingabe_daten?.symptome || s.eingabe_daten?.belastungen) && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {s.eingabe_daten.symptome || s.eingabe_daten.belastungen}
                                    </p>
                                  )}
                                  {hasSlimPlaceholder && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Details werden erst beim Öffnen geladen.
                                    </p>
                                  )}
                                  {!hasSlimPlaceholder && storedLabels.length > 0 && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      Gespeichert: {storedLabels.join(" · ")}{storedDetails.length > storedLabels.length ? ` · +${storedDetails.length - storedLabels.length} weitere` : ""}
                                    </p>
                                  )}
                                  {s.notiz && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
                                      📝 {s.notiz}
                                    </p>
                                  )}

                                  <div className="flex gap-1 mt-2 flex-wrap">
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={async () => {
                                        if (isExp) {
                                          setExpandedSessionId(null);
                                          return;
                                        }
                                        setExpandedSessionId(s.id);
                                        if (s.is_truncated) await fetchFullSession(s.id, p.pseudonym_id);
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {isExp ? "Ausblenden" : "Empfehlung anzeigen"}
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={async () => {
                                        const full = s.is_truncated ? await fetchFullSession(s.id, p.pseudonym_id) : s;
                                        if (full) handlePrint(full, "praxis");
                                      }}
                                    >
                                      <Printer className="h-3 w-3" />
                                      Praxis-PDF
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={async () => {
                                        const full = s.is_truncated ? await fetchFullSession(s.id, p.pseudonym_id) : s;
                                        if (full) handlePrint(full, "patient");
                                      }}
                                    >
                                      <Printer className="h-3 w-3" />
                                      Patienten-PDF
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                                      onClick={() => handleDelete(s.id, p.pseudonym_id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>

                                  {isExp && (
                                    <div className="mt-2 pt-2 border-t border-border space-y-2">
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
                                      <div className="text-xs bg-muted/40 p-2 rounded max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                                        {s.empfehlung || "—"}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
