import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryGroup, RemedyRow } from "@/lib/therapyParser";
import { priorityOrder } from "@/lib/therapyParser";
import { severityLabel, type TherapySafetyWarning } from "../../../../supabase/functions/_shared/therapySafety";

const TONE_STYLES: Record<CategoryGroup["tone"], { card: string; header: string; accent: string; pill: string }> = {
  sage: {
    card: "border-primary/30 bg-primary/[0.03]",
    header: "bg-primary/10 border-b border-primary/20",
    accent: "text-primary",
    pill: "bg-primary/15 text-primary border-primary/30",
  },
  sand: {
    card: "border-secondary/40 bg-secondary/[0.04]",
    header: "bg-secondary/20 border-b border-secondary/40",
    accent: "text-secondary-foreground",
    pill: "bg-secondary/30 text-secondary-foreground border-secondary/40",
  },
  terracotta: {
    card: "border-accent/30 bg-accent/[0.03]",
    header: "bg-accent/10 border-b border-accent/20",
    accent: "text-accent",
    pill: "bg-accent/15 text-accent border-accent/30",
  },
  mist: {
    card: "border-muted bg-muted/30",
    header: "bg-muted/60 border-b border-border",
    accent: "text-foreground",
    pill: "bg-background text-foreground border-border",
  },
  neutral: {
    card: "border-border bg-card",
    header: "bg-muted/40 border-b border-border",
    accent: "text-foreground",
    pill: "bg-muted text-foreground border-border",
  },
};

function PriorityBadge({ row }: { row: RemedyRow }) {
  const map = {
    essential: "bg-destructive/15 text-destructive border-destructive/30",
    recommended: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    optional: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    unknown: "bg-muted text-muted-foreground border-border",
  } as const;
  const label = {
    essential: "Essentiell",
    recommended: "Empfohlen",
    optional: "Optional",
    unknown: row.priorityRaw || "—",
  } as const;
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", map[row.priority])}>
      {label[row.priority]}
    </Badge>
  );
}

interface CategoryCardProps {
  group: CategoryGroup;
  /** Index der Kategorie in der Gesamtliste (für Selection-Key) */
  categoryIndex?: number;
  /** Set der ausgewählten "categoryIndex|remedyIndex"-Keys */
  selectedKeys?: Set<string>;
  onToggleRemedy?: (key: string) => void;
  onToggleAll?: (categoryIndex: number, remedyIndices: number[], selectAll: boolean) => void;
  safetyWarningsByKey?: Map<string, TherapySafetyWarning[]>;
  wikiEntries?: Array<{
    id?: string;
    title: string;
    entryKind?: string;
    reviewStatus?: string;
    evidenceLevel?: string;
    dosageStatus?: string;
    contraindications?: string[];
    interactionTags?: string[];
    safetyNotes?: string;
  }>;
}

export function CategoryCard({ group, categoryIndex, selectedKeys, onToggleRemedy, onToggleAll, safetyWarningsByKey, wikiEntries = [] }: CategoryCardProps) {
  const styles = TONE_STYLES[group.tone];
  // Wir behalten Original-Indizes für stabile Selection-Keys
  const indexed = group.remedies.map((r, i) => ({ row: r, originalIndex: i }));
  const sorted = [...indexed].sort((a, b) => priorityOrder(a.row.priority) - priorityOrder(b.row.priority));
  const selectionEnabled = selectedKeys !== undefined && categoryIndex !== undefined;

  const groupKeys = sorted.map((s) => `${categoryIndex}|${s.originalIndex}`);
  const allSelected = selectionEnabled && groupKeys.every((k) => selectedKeys!.has(k));
  const someSelected = selectionEnabled && groupKeys.some((k) => selectedKeys!.has(k));

  return (
    <Card className={cn("overflow-hidden shadow-sm", styles.card)}>
      <CardHeader className={cn("py-3 px-4", styles.header)}>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            {selectionEnabled && (
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) =>
                  onToggleAll?.(categoryIndex!, sorted.map((s) => s.originalIndex), checked === true)
                }
                aria-label={`Alle Mittel in ${group.title} an-/abwählen`}
                className="mr-1"
              />
            )}
            <span className="text-2xl leading-none" aria-hidden>{group.emoji}</span>
            <span className={cn("font-serif tracking-tight", styles.accent)}>{group.title}</span>
          </span>
          <Badge variant="outline" className={cn("text-xs font-normal", styles.pill)}>
            {selectionEnabled ? `${groupKeys.filter((k) => selectedKeys!.has(k)).length}/${group.remedies.length}` : `${group.remedies.length}`} Mittel
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectionEnabled && <TableHead className="w-[40px]"></TableHead>}
              <TableHead className="w-[26%]">Mittel</TableHead>
              <TableHead className="w-[14%]">Dosierung</TableHead>
              <TableHead className="w-[14%]">Anwendung</TableHead>
              <TableHead className="w-[10%]">Dauer</TableHead>
              <TableHead className="w-[12%]">Priorität</TableHead>
              <TableHead className="w-[8%] text-right">Kosten</TableHead>
              <TableHead className="w-[12%]">Begründung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {sorted.map(({ row, originalIndex }) => {
               const key = `${categoryIndex}|${originalIndex}`;
               const isChecked = selectionEnabled && selectedKeys!.has(key);
               const safetyWarnings = safetyWarningsByKey?.get(key) || [];
               const wikiId = row.reason.match(/\[WIKI_ID:([0-9a-f-]{36})\]/i)?.[1]?.toLowerCase();
               const wikiEntry = wikiId ? wikiEntries.find((entry) => entry.id?.toLowerCase() === wikiId) : undefined;
               const visibleReason = row.reason.replace(/\s*\[WIKI_ID:[0-9a-f-]{36}\]\s*/gi, " ").trim();
               return (
                <TableRow key={key} className={cn("align-top", selectionEnabled && !isChecked && "opacity-60", safetyWarnings.length && "bg-amber-50/70 dark:bg-amber-950/20")}>
                  {selectionEnabled && (
                    <TableCell className="py-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onToggleRemedy?.(key)}
                        aria-label={`${row.name} aus-/abwählen`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <div className={cn("text-base md:text-lg font-bold leading-tight font-serif", styles.accent)}>
                      {row.name}
                    </div>
                     {row.latin && (
                       <div className="text-xs italic text-muted-foreground mt-0.5">{row.latin}</div>
                     )}
                     {wikiId && (
                       <div className="mt-2 rounded border border-blue-300/60 bg-blue-50/60 p-2 text-[11px] leading-snug text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100">
                         <div className="font-mono break-all"><strong>Wiki-ID:</strong> {wikiId}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span><strong>Art:</strong> {wikiEntry?.entryKind || "unbekannt"}</span>
                            <span><strong>Review:</strong> {wikiEntry?.reviewStatus || "nicht auflösbar"}</span>
                           <span><strong>Evidenz:</strong> {wikiEntry?.evidenceLevel || "unrated"}</span>
                           <span><strong>Dosierung:</strong> {wikiEntry?.dosageStatus || "unverified"}</span>
                         </div>
                         <div className="mt-1"><strong>Kontraindikationen:</strong> {wikiEntry?.contraindications?.length ? wikiEntry.contraindications.join(", ") : "keine strukturiert hinterlegt"}</div>
                         <div><strong>Interaktionen:</strong> {wikiEntry?.interactionTags?.length ? wikiEntry.interactionTags.join(", ") : "keine strukturiert hinterlegt"}</div>
                         {wikiEntry?.safetyNotes && <div><strong>Sicherheit:</strong> {wikiEntry.safetyNotes}</div>}
                       </div>
                     )}
                    {safetyWarnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {safetyWarnings.map((warning) => (
                          <div key={warning.id} className={cn(
                            "rounded border px-2 py-1.5 text-[11px] leading-snug",
                            warning.severity === "avoid"
                              ? "border-destructive/50 bg-destructive/10 text-destructive"
                              : "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          )}>
                            <div className="flex items-center gap-1 font-semibold">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {severityLabel(warning.severity)}: {warning.title}
                            </div>
                            <div className="mt-0.5">{warning.action}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-sm">{row.dosage || "—"}</TableCell>
                  <TableCell className="py-3 text-sm">{row.application || "—"}</TableCell>
                  <TableCell className="py-3 text-sm">{row.duration || "—"}</TableCell>
                  <TableCell className="py-3"><PriorityBadge row={row} /></TableCell>
                  <TableCell className="py-3 text-right font-mono text-sm whitespace-nowrap">{row.cost || "—"}</TableCell>
                   <TableCell className="py-3 text-xs text-muted-foreground">{visibleReason || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
