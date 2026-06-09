import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText, Trash2, Save, ShieldAlert, Loader2, Eye } from "lucide-react";

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
}


interface Props {
  pseudonymId: string;
  onLoadSession: (session: TherapySession) => void;
  onShowBefund?: (session: TherapySession) => void;
}

export function PseudonymHistory({ pseudonymId, onLoadSession, onShowBefund }: Props) {
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(false);
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
      const visibleSessions = ((data as any)?.sessions ?? []).filter((session: TherapySession) => !["befund_checkpoint", "quarantine_patient_mismatch"].includes(String(session.kind || "")));
      setSessions(visibleSessions);
    }
    setLoading(false);
  }, [pseudonymId, toast]);

  useEffect(() => {
    const t = setTimeout(loadSessions, 300);
    return () => clearTimeout(t);
  }, [loadSessions]);

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
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Verlauf: <span className="font-mono text-primary">{pseudonymId}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Badge variant="secondary" className="ml-auto text-xs">
            {sessions.length} Sitzung{sessions.length !== 1 ? "en" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
              const e = s.eingabe_daten || {};
              const summary =
                e.symptome?.slice(0, 60) ||
                e.erkrankung?.slice(0, 60) ||
                e.belastungen?.slice(0, 60) ||
                "—";
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

              const isBefund = s.kind === "befund_auswertung" || !!s.befund_html;
              const meta = s.befund_meta || {};
              const openBefund = () => {
                if (!s.befund_html) return;
                if (onShowBefund) {
                  onShowBefund(s);
                  return;
                }
                const w = window.open("", "_blank");
                if (w) {
                  w.document.open();
                  w.document.write(s.befund_html);
                  w.document.close();
                }
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
                      {!isBefund && labParts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {labParts.map((l, i) => (
                            <Badge key={i} variant={l === "Auto-Sicherung" ? "secondary" : "outline"} className="text-[10px] py-0 h-4">{l}</Badge>
                          ))}
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
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={openBefund}>
                        <FileText className="h-3 w-3" />
                        Auswertung hier anzeigen
                      </Button>
                    )}
                    {!isBefund && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        >
                          <Eye className="h-3 w-3" />
                          {isExpanded ? "Ausblenden" : "Anzeigen"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => onLoadSession(s)}
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
      </CardContent>
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
