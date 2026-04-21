import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CategoryGroup, RemedyRow } from "@/lib/therapyParser";
import { priorityOrder } from "@/lib/therapyParser";

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

export function CategoryCard({ group }: { group: CategoryGroup }) {
  const styles = TONE_STYLES[group.tone];
  const sorted = [...group.remedies].sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

  return (
    <Card className={cn("overflow-hidden shadow-sm", styles.card)}>
      <CardHeader className={cn("py-3 px-4", styles.header)}>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden>{group.emoji}</span>
            <span className={cn("font-serif tracking-tight", styles.accent)}>{group.title}</span>
          </span>
          <Badge variant="outline" className={cn("text-xs font-normal", styles.pill)}>
            {group.remedies.length} Mittel
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[28%]">Mittel</TableHead>
              <TableHead className="w-[15%]">Dosierung</TableHead>
              <TableHead className="w-[15%]">Anwendung</TableHead>
              <TableHead className="w-[10%]">Dauer</TableHead>
              <TableHead className="w-[12%]">Priorität</TableHead>
              <TableHead className="w-[8%] text-right">Kosten</TableHead>
              <TableHead className="w-[12%]">Begründung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={`${row.name}-${i}`} className="align-top">
                <TableCell className="py-3">
                  <div className={cn("text-base md:text-lg font-bold leading-tight font-serif", styles.accent)}>
                    {row.name}
                  </div>
                  {row.latin && (
                    <div className="text-xs italic text-muted-foreground mt-0.5">{row.latin}</div>
                  )}
                </TableCell>
                <TableCell className="py-3 font-mono text-sm">{row.dosage || "—"}</TableCell>
                <TableCell className="py-3 text-sm">{row.application || "—"}</TableCell>
                <TableCell className="py-3 text-sm">{row.duration || "—"}</TableCell>
                <TableCell className="py-3"><PriorityBadge row={row} /></TableCell>
                <TableCell className="py-3 text-right font-mono text-sm whitespace-nowrap">{row.cost || "—"}</TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{row.reason || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
