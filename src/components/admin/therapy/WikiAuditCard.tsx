import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Database, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export interface WikiAuditEntry {
  title: string;
  category: string;
  score: number;
  reason: string;
}

export interface WikiAuditInfo {
  totalInDb: number;
  afterCategoryFilter: number;
  pinnedCount: number;
  relevantCount: number;
  usedCount: number;
  skippedTotalCount: number;
  contextChars: number;
  contextLimit: number;
  cacheHit: boolean;
  queryTokens: string[];
  selectedCategories: string[];
  used: WikiAuditEntry[];
  skippedSample: WikiAuditEntry[];
}

export function WikiAuditCard({ audit }: { audit: WikiAuditInfo }) {
  const [open, setOpen] = useState(false);
  const [showUsed, setShowUsed] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);

  const coverage = audit.afterCategoryFilter > 0
    ? Math.round((audit.usedCount / audit.afterCategoryFilter) * 100)
    : 0;
  const contextFill = Math.round((audit.contextChars / audit.contextLimit) * 100);
  const isFull = audit.usedCount === audit.afterCategoryFilter;

  return (
    <Card className="border-blue-300/50 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-900/30">
      <CardHeader className="py-3 px-4 border-b border-blue-200/60 dark:border-blue-900/30">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-serif flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Database className="h-4 w-4" />
            Wiki-Audit: KI hat {audit.usedCount} von {audit.afterCategoryFilter} Einträgen gelesen
            {isFull ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Vollständig
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertCircle className="h-3 w-3 mr-1" /> {coverage}% Abdeckung
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="h-7 px-2 text-xs">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Zuklappen" : "Details"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Stat label="Wiki gesamt" value={audit.totalInDb} />
            <Stat label="Nach Filter" value={audit.afterCategoryFilter} />
            <Stat label="📌 Gepinnt" value={audit.pinnedCount} />
            <Stat label="✅ Verwendet" value={audit.usedCount} highlight />
            <Stat label="⏭️ Ausgelassen" value={audit.skippedTotalCount} muted />
            <Stat label="Kontext-Größe" value={`${audit.contextChars.toLocaleString("de-DE")} / ${audit.contextLimit.toLocaleString("de-DE")} (${contextFill}%)`} />
            <Stat label="Cache" value={audit.cacheHit ? "HIT" : "frisch geladen"} />
            <Stat label="Query-Tokens" value={audit.queryTokens.length} />
          </div>

          {/* Filter info */}
          {audit.selectedCategories.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <strong>Kategorienfilter:</strong> {audit.selectedCategories.join(", ")}
            </div>
          )}
          {audit.queryTokens.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <strong>Suchbegriffe (aus Belastungen/Symptomen/Labor extrahiert):</strong>{" "}
              <span className="font-mono">{audit.queryTokens.join(", ")}</span>
            </div>
          )}

          {!isFull && (
            <div className="text-xs bg-amber-100/60 dark:bg-amber-950/30 border border-amber-300/50 dark:border-amber-900/40 rounded p-2 text-amber-900 dark:text-amber-200">
              ⚠️ <strong>Hinweis:</strong> Aufgrund des Token-Limits des KI-Gateways konnten nicht alle {audit.afterCategoryFilter} Wiki-Einträge in den Kontext geladen werden.
              Die {audit.usedCount} relevantesten wurden ausgewählt (per Wort-Treffer-Score). Falls ein wichtiger Eintrag fehlt, kann er via "📌 Pinning" oder
              spezifische Kategorienfilterung erzwungen werden.
            </div>
          )}

          {/* Verwendete Einträge */}
          <div>
            <button
              type="button"
              onClick={() => setShowUsed(!showUsed)}
              className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary"
            >
              {showUsed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              ✅ Von der KI gelesene Einträge ({audit.used.length})
            </button>
            {showUsed && (
              <div className="mt-2 max-h-72 overflow-y-auto border rounded bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">Titel</th>
                      <th className="text-left px-2 py-1.5">Kategorie</th>
                      <th className="text-right px-2 py-1.5">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.used.map((e, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1 font-medium">
                          {e.reason === "📌 Gepinnt" && <span className="mr-1">📌</span>}
                          {e.title}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground text-[11px]">{e.category}</td>
                        <td className="px-2 py-1 text-right font-mono">
                          {e.score === 9999 ? "—" : e.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ausgelassene Einträge */}
          {audit.skippedSample.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSkipped(!showSkipped)}
                className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary"
              >
                {showSkipped ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                ⏭️ Nicht gelesene Einträge (Stichprobe Top {audit.skippedSample.length} von {audit.skippedTotalCount})
              </button>
              {showSkipped && (
                <div className="mt-2 max-h-72 overflow-y-auto border rounded bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5">Titel</th>
                        <th className="text-left px-2 py-1.5">Kategorie</th>
                        <th className="text-right px-2 py-1.5">Score</th>
                        <th className="text-left px-2 py-1.5">Grund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.skippedSample.map((e, i) => (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          <td className="px-2 py-1 font-medium">{e.title}</td>
                          <td className="px-2 py-1 text-muted-foreground text-[11px]">{e.category}</td>
                          <td className="px-2 py-1 text-right font-mono">{e.score}</td>
                          <td className="px-2 py-1 text-muted-foreground text-[11px]">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-muted-foreground p-2 border-t">
                    💡 Falls ein wichtiger Eintrag hier auftaucht: Pinnen Sie ihn über "Bevorzugte Mittel & Pinning" oder
                    grenzen Sie die Kategorienauswahl enger ein.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value, highlight, muted }: { label: string; value: string | number; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded border px-2 py-1.5 ${highlight ? "bg-primary/10 border-primary/30" : muted ? "bg-muted/30" : "bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
