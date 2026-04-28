import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

interface Result {
  id: string;
  title: string;
  category: string;
  existing: string[];
  suggested?: string[];
  added?: string[];
  merged?: string[];
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: () => void;
}

const BATCH_SIZE = 20;

export function TagEnrichmentDialog({ open, onOpenChange, onApplied }: Props) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"idle" | "loading" | "review" | "applying">("idle");
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"missing" | "all">("missing");

  const reset = () => {
    setPhase("idle");
    setResults([]);
    setSelected(new Set());
    setProgress(0);
    setProgressMax(0);
  };

  const startScan = async () => {
    setPhase("loading");
    setResults([]);
    setSelected(new Set());

    // Eintrags-IDs holen (Filter)
    const { data: rows, error } = await supabase
      .from("admin_knowledge_base")
      .select("id,tags");
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setPhase("idle");
      return;
    }

    const targets = (rows || [])
      .filter((r: any) => scope === "all" || !r.tags || r.tags.length < 3)
      .map((r: any) => r.id);

    if (targets.length === 0) {
      toast({ title: "Nichts zu tun", description: "Alle Einträge haben bereits ≥3 Tags." });
      setPhase("idle");
      return;
    }

    setProgressMax(targets.length);
    setProgress(0);

    const allResults: Result[] = [];
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("enrich-wiki-tags", {
        body: { mode: "preview", ids: batch },
      });
      if (error) {
        toast({ title: "Batch fehlgeschlagen", description: error.message, variant: "destructive" });
        continue;
      }
      const batchRes: Result[] = data?.results || [];
      allResults.push(...batchRes);
      setProgress(Math.min(targets.length, i + batch.length));
      setResults([...allResults]);
    }

    // Default: alle mit "added" auswählen
    const sel = new Set<string>();
    allResults.forEach((r) => {
      if (r.added && r.added.length > 0) sel.add(r.id);
    });
    setSelected(sel);
    setPhase("review");
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    const toApply = results
      .filter((r) => selected.has(r.id) && r.merged)
      .map((r) => ({ id: r.id, tags: r.merged! }));
    if (toApply.length === 0) {
      toast({ title: "Nichts ausgewählt" });
      return;
    }
    setPhase("applying");
    const { data, error } = await supabase.functions.invoke("enrich-wiki-tags", {
      body: { mode: "apply", ids: toApply },
    });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setPhase("review");
      return;
    }
    toast({ title: `${data?.updated ?? 0} Einträge aktualisiert` });
    onApplied();
    reset();
    onOpenChange(false);
  };

  const totalAdded = results.reduce((s, r) => s + (r.added?.length || 0), 0);
  const errorCount = results.filter((r) => r.error).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && phase !== "loading" && phase !== "applying") {
          reset();
          onOpenChange(false);
        } else if (v) {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            KI-Tag-Anreicherung
          </DialogTitle>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Die KI liest jeden Wiki-Eintrag und schlägt fehlende Schlagworte vor
              (z.B. enthaltene Probiotika-Stämme, Indikationen, Stoffklassen). Du
              entscheidest pro Eintrag, ob die Vorschläge übernommen werden.
              Bestehende Tags bleiben erhalten.
            </p>
            <div className="flex flex-col gap-2 border rounded-lg p-3 bg-muted/30">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={scope === "missing"}
                  onChange={() => setScope("missing")}
                />
                <span className="text-sm">Nur Einträge mit &lt; 3 Tags (empfohlen)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                <span className="text-sm">Alle Einträge (langsamer, mehr Token)</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={startScan} className="gap-2">
                <Sparkles className="h-4 w-4" /> Analyse starten
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "loading" && (
          <div className="space-y-3 py-8">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              KI analysiert {progress} / {progressMax} Einträge…
            </div>
            <Progress value={progressMax > 0 ? (progress / progressMax) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              Du kannst dieses Fenster offen lassen – das läuft im Hintergrund.
            </p>
          </div>
        )}

        {phase === "review" && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-b pb-2">
              <span>{results.length} analysiert</span>
              <span className="text-green-700 dark:text-green-400">
                +{totalAdded} neue Tags vorgeschlagen
              </span>
              {errorCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errorCount} Fehler
                </span>
              )}
              <button
                onClick={() => {
                  const allWithAdded = results.filter((r) => r.added && r.added.length > 0).map((r) => r.id);
                  setSelected(new Set(allWithAdded));
                }}
                className="ml-auto text-primary hover:underline"
              >
                Alle mit Vorschlägen
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-primary hover:underline"
              >
                Keine
              </button>
            </div>
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-2">
                {results.map((r) => {
                  const isSel = selected.has(r.id);
                  const hasNew = (r.added?.length || 0) > 0;
                  return (
                    <div
                      key={r.id}
                      className={`border rounded-lg p-3 ${isSel ? "border-primary bg-primary/5" : ""} ${r.error ? "border-destructive/40 bg-destructive/5" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {!r.error && hasNew && (
                          <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} className="mt-1" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{r.title}</span>
                            <span className="text-xs text-muted-foreground">{r.category}</span>
                            {!r.error && hasNew && (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white">
                                +{r.added!.length} neu
                              </Badge>
                            )}
                            {!r.error && !hasNew && (
                              <Badge variant="secondary">keine Änderung nötig</Badge>
                            )}
                          </div>
                          {r.error ? (
                            <p className="text-xs text-destructive mt-1">{r.error}</p>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              {r.existing.length > 0 && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] uppercase text-muted-foreground w-16">Vorhanden:</span>
                                  {r.existing.map((t) => (
                                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                                  ))}
                                </div>
                              )}
                              {hasNew && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] uppercase text-green-700 dark:text-green-400 w-16">Neu:</span>
                                  {r.added!.map((t) => (
                                    <Badge key={t} className="text-xs bg-green-600 hover:bg-green-700 text-white">{t}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter className="border-t pt-3">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                Abbrechen
              </Button>
              <Button onClick={apply} disabled={selected.size === 0} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {selected.size} Einträge übernehmen
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "applying" && (
          <div className="py-8 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Speichere Änderungen…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
