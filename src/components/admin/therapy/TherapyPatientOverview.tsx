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

interface PseudonymRow {
  pseudonym_id: string;
  sessions_count: number;
  last_session_at: string;
  first_session_at: string;
  latest_summary: string;
  latest_notiz: string | null;
}

interface SessionRow {
  id: string;
  pseudonym_id: string;
  eingabe_daten: any;
  empfehlung: string;
  notiz: string | null;
  created_at: string;
  updated_at: string;
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

      const sessions = ((data as any)?.sessions ?? []) as SessionRow[];
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
    await loadSessionsFor(pid);
  };

  const refreshPid = async (pid: string) => {
    return loadSessionsFor(pid, true);
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
                          {loadingSessions === p.pseudonym_id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                              <Loader2 className="h-4 w-4 animate-spin" /> Lade Sitzungen...
                            </div>
                          ) : sessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Keine Sitzungen.</p>
                          ) : (
                            sessions.map((s) => {
                              const isExp = expandedSessionId === s.id;
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
                                  {s.notiz && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
                                      📝 {s.notiz}
                                    </p>
                                  )}

                                  <div className="flex gap-1 mt-2 flex-wrap">
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={() => setExpandedSessionId(isExp ? null : s.id)}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {isExp ? "Ausblenden" : "Empfehlung anzeigen"}
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={async () => {
                                        const freshSessions = await refreshPid(p.pseudonym_id);
                                        const fresh = freshSessions.find((row) => row.id === s.id) || s;
                                        handlePrint(fresh, "praxis");
                                      }}
                                    >
                                      <Printer className="h-3 w-3" />
                                      Praxis-PDF
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                      onClick={() => handlePrint(s, "patient")}
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
                                    <div className="mt-2 pt-2 border-t border-border">
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
