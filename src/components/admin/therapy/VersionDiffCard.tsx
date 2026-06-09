import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompare, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  parentVersionNumber: number | null;
  parentSnapshot: Record<string, any> | null;
  current: Record<string, any>;
}

// Felder, die wir vergleichen + Anzeige-Label
const FIELDS: Array<{ key: string; label: string; type: "text" | "list" | "pathogens" }> = [
  { key: "symptome", label: "Symptome", type: "text" },
  { key: "erkrankung", label: "Erkrankung", type: "text" },
  { key: "alter", label: "Alter", type: "text" },
  { key: "geschlecht", label: "Geschlecht", type: "text" },
  { key: "groesseCm", label: "Größe (cm)", type: "text" },
  { key: "gewichtKg", label: "Gewicht (kg)", type: "text" },
  { key: "schwanger", label: "Schwanger", type: "text" },
  { key: "medikamente", label: "Medikamente", type: "text" },
  { key: "bisherigeMittel", label: "Bisherige Mittel", type: "text" },
  { key: "budget", label: "Budget", type: "text" },
  { key: "laborKomplett", label: "Labor (komplett)", type: "text" },
  { key: "laborErhoeht", label: "Labor erhöht", type: "text" },
  { key: "laborErniedrigt", label: "Labor erniedrigt", type: "text" },
  { key: "laborDatum", label: "Labor-Datum", type: "text" },
  { key: "stuhlbefund", label: "Stuhlbefund", type: "text" },
  { key: "arztbericht", label: "Arztbericht", type: "text" },
  { key: "arztberichtDatum", label: "Arztbericht-Datum", type: "text" },
  { key: "metatronHeel", label: "Metatron / HEEL", type: "text" },
  { key: "sonstigeUntersuchungen", label: "Sonstige Untersuchungen", type: "text" },
  { key: "perplexityAnalyse", label: "Perplexity-Analyse", type: "text" },
  { key: "selectedCategories", label: "Kategorien", type: "list" },
  { key: "bevorzugteLinie", label: "Bevorzugte Produktlinien", type: "list" },
  { key: "pathogens", label: "Pathogene", type: "pathogens" },
];

type DiffEntry =
  | { kind: "added"; label: string; newValue: string }
  | { kind: "removed"; label: string; oldValue: string }
  | { kind: "changed"; label: string; oldValue: string; newValue: string };

function normText(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function normList(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return [...v].map((x) => String(x).trim()).filter(Boolean).sort();
}
function pathogenSignature(p: any): string {
  if (!p) return "";
  const name = String(p.name || "").trim();
  const intensity = String(p.intensity ?? p.staerke ?? "").trim();
  return name ? `${name}${intensity ? ` (${intensity})` : ""}` : "";
}
function normPathogens(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(pathogenSignature).filter(Boolean).sort();
}

function diffLists(oldList: string[], newList: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldList);
  const newSet = new Set(newList);
  return {
    added: newList.filter((x) => !oldSet.has(x)),
    removed: oldList.filter((x) => !newSet.has(x)),
  };
}

function truncate(s: string, n = 160): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

export function VersionDiffCard({ parentVersionNumber, parentSnapshot, current }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const diffs = useMemo<DiffEntry[]>(() => {
    if (!parentSnapshot) return [];
    const out: DiffEntry[] = [];

    for (const f of FIELDS) {
      if (f.type === "text") {
        const o = normText(parentSnapshot[f.key]);
        const n = normText(current[f.key]);
        if (o === n) continue;
        if (!o && n) out.push({ kind: "added", label: f.label, newValue: truncate(n) });
        else if (o && !n) out.push({ kind: "removed", label: f.label, oldValue: truncate(o) });
        else out.push({ kind: "changed", label: f.label, oldValue: truncate(o), newValue: truncate(n) });
      } else if (f.type === "list" || f.type === "pathogens") {
        const o = f.type === "pathogens" ? normPathogens(parentSnapshot[f.key]) : normList(parentSnapshot[f.key]);
        const n = f.type === "pathogens" ? normPathogens(current[f.key]) : normList(current[f.key]);
        if (o.join("|") === n.join("|")) continue;
        const { added, removed } = diffLists(o, n);
        if (added.length === 0 && removed.length === 0) continue;
        if (o.length === 0 && n.length > 0) {
          out.push({ kind: "added", label: f.label, newValue: n.join(", ") });
        } else if (n.length === 0 && o.length > 0) {
          out.push({ kind: "removed", label: f.label, oldValue: o.join(", ") });
        } else {
          const parts: string[] = [];
          if (added.length) parts.push(`+ ${added.join(", ")}`);
          if (removed.length) parts.push(`− ${removed.join(", ")}`);
          out.push({ kind: "changed", label: f.label, oldValue: o.join(", "), newValue: parts.join("  ·  ") });
        }
      }
    }
    return out;
  }, [parentSnapshot, current]);

  if (!parentSnapshot || parentVersionNumber === null) return null;

  const counts = {
    added: diffs.filter((d) => d.kind === "added").length,
    changed: diffs.filter((d) => d.kind === "changed").length,
    removed: diffs.filter((d) => d.kind === "removed").length,
  };

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <GitCompare className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          Änderungen gegenüber V{parentVersionNumber}
          {diffs.length === 0 ? (
            <Badge variant="outline" className="text-[10px]">keine Änderungen bisher</Badge>
          ) : (
            <>
              {counts.added > 0 && <Badge className="bg-emerald-600 text-white text-[10px]">+{counts.added} neu</Badge>}
              {counts.changed > 0 && <Badge className="bg-amber-600 text-white text-[10px]">~{counts.changed} geändert</Badge>}
              {counts.removed > 0 && <Badge className="bg-rose-600 text-white text-[10px]">−{counts.removed} entfernt</Badge>}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 ml-auto text-xs gap-1"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            {collapsed ? "Anzeigen" : "Einklappen"}
          </Button>
        </CardTitle>
      </CardHeader>
      {!collapsed && diffs.length > 0 && (
        <CardContent className="pt-0">
          <ul className="space-y-1.5 text-xs">
            {diffs.map((d, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-l-2 pl-2 py-0.5"
                  style={{ borderColor: d.kind === "added" ? "rgb(5 150 105)" : d.kind === "removed" ? "rgb(225 29 72)" : "rgb(217 119 6)" }}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] py-0 h-4">
                    {d.kind === "added" ? "NEU" : d.kind === "removed" ? "ENTFERNT" : "GEÄNDERT"}
                  </Badge>
                  <span className="font-medium">{d.label}</span>
                </div>
                {d.kind === "added" && (
                  <div className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">→ {d.newValue}</div>
                )}
                {d.kind === "removed" && (
                  <div className="text-rose-700 dark:text-rose-400 line-through whitespace-pre-wrap">{d.oldValue}</div>
                )}
                {d.kind === "changed" && (
                  <div className="space-y-0.5">
                    <div className="text-muted-foreground line-through whitespace-pre-wrap">vorher: {d.oldValue}</div>
                    <div className="text-amber-800 dark:text-amber-300 whitespace-pre-wrap">jetzt: {d.newValue}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
