import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, FolderOpen, Folder, Loader2 } from "lucide-react";

interface Props {
  selected: string[];
  onChange: (cats: string[]) => void;
}

interface SubNode {
  /** Vollständiger Pfad, exakt wie in der Wiki-Kategorie gespeichert (z.B. "Naturheilpraxis Peter Rauch > Sanum") */
  fullPath: string;
  /** Anzeigename (letztes Pfadsegment) */
  label: string;
  count: number;
}
interface TopNode {
  name: string;
  /** Anzahl der Einträge inkl. aller Unterordner */
  totalCount: number;
  /** Anzahl der Einträge direkt im Hauptordner (ohne Unterordner) */
  directCount: number;
  subs: SubNode[];
}

/**
 * Lädt alle Wiki-Kategorien und baut einen 2-stufigen Baum:
 * - Top: Erster Pfad-Bestandteil (vor " > ")
 * - Sub: Alles dahinter (komplett, inkl. weiterer ">"-Tiefen)
 *
 * Auswahl-Modell:
 * - Klick auf Top-Ordner → übergibt nur den Top-Namen → Edge-Function matcht alle Sub-Ordner
 * - Klick auf Sub-Ordner → übergibt den vollen Pfad → exakter Sub-Filter
 * - Top + einzelne Subs schließen sich gegenseitig sinnvoll aus (Top entfernt einzelne Subs)
 */
export function CategoryFilter({ selected, onChange }: Props) {
  const [tree, setTree] = useState<TopNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_knowledge_base")
        .select("category");
      if (error) {
        console.error("CategoryFilter load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, TopNode>();
      for (const row of data || []) {
        const raw = (row.category || "").trim() || "Allgemein";
        const parts = raw.split(">").map((p) => p.trim()).filter(Boolean);
        const top = parts[0] || "Allgemein";
        if (!map.has(top)) {
          map.set(top, { name: top, totalCount: 0, directCount: 0, subs: [] });
        }
        const node = map.get(top)!;
        node.totalCount += 1;
        if (parts.length === 1) {
          node.directCount += 1;
        } else {
          const subPath = parts.slice(1).join(" > ");
          const fullPath = `${top} > ${subPath}`;
          const existing = node.subs.find((s) => s.fullPath === fullPath);
          if (existing) existing.count += 1;
          else node.subs.push({ fullPath, label: subPath, count: 1 });
        }
      }
      const arr = Array.from(map.values())
        .map((n) => ({
          ...n,
          subs: n.subs.sort((a, b) => a.label.localeCompare(b.label, "de")),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
      setTree(arr);
      setLoading(false);
    })();
  }, []);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const isTopSelected = (name: string) => selected.includes(name);
  const isSubSelected = (fullPath: string) => selected.includes(fullPath);

  const toggleTop = (name: string, _subs: SubNode[]) => {
    if (isTopSelected(name)) {
      onChange(selected.filter((c) => c !== name));
    } else {
      // Boost-Modell: Top und Subs dürfen unabhängig markiert werden
      onChange([...selected, name]);
    }
  };

  const toggleSub = (fullPath: string, _topName: string) => {
    if (isSubSelected(fullPath)) {
      onChange(selected.filter((c) => c !== fullPath));
    } else {
      onChange([...selected, fullPath]);
    }
  };

  const summary = useMemo(() => {
    if (selected.length === 0) return "Keine Schwerpunkte – ganze Datenbank wird normal durchsucht";
    return `${selected.length} Schwerpunkt-${selected.length === 1 ? "Ordner" : "Ordner"} garantiert geprüft (zusätzlich zur Gesamtsuche)`;
  }, [selected]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ordner laden…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{summary}</p>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
          >
            Alle zurücksetzen
          </Button>
        )}
      </div>

      <div className="rounded-md border border-input bg-background p-1.5 max-h-72 overflow-y-auto">
        {tree.map((top) => {
          const open = expanded.has(top.name);
          const topChecked = isTopSelected(top.name);
          const hasSubs = top.subs.length > 0;
          const selectedSubsCount = top.subs.filter((s) => isSubSelected(s.fullPath)).length;

          return (
            <div key={top.name} className="mb-0.5 last:mb-0">
              {/* Top-Zeile */}
              <div className="flex items-center gap-1 px-1.5 py-1.5 rounded hover:bg-muted/50 text-sm">
                {hasSubs ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(top.name)}
                    className="flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground"
                    aria-label={open ? "Einklappen" : "Ausklappen"}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <Checkbox
                  checked={topChecked}
                  onCheckedChange={() => toggleTop(top.name, top.subs)}
                  aria-label={top.name}
                />
                <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                <button
                  type="button"
                  onClick={() => toggleTop(top.name, top.subs)}
                  className="truncate flex-1 text-left font-medium"
                >
                  {top.name}
                </button>
                {selectedSubsCount > 0 && !topChecked && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {selectedSubsCount}/{top.subs.length}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {top.totalCount}
                </Badge>
              </div>

              {/* Sub-Ordner */}
              {hasSubs && open && (
                <div className="ml-7 border-l border-border pl-2 py-0.5 space-y-0.5">
                  {top.directCount > 0 && (
                    <p className="text-[11px] text-muted-foreground py-0.5">
                      ({top.directCount} Eintrag{top.directCount === 1 ? "" : "e"} direkt im Hauptordner)
                    </p>
                  )}
                  {top.subs.map((sub) => {
                    const checked = isSubSelected(sub.fullPath);
                    return (
                      <label
                        key={sub.fullPath}
                        className="flex items-center gap-2 px-1.5 py-1 rounded text-sm hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSub(sub.fullPath, top.name)}
                          aria-label={sub.label}
                        />
                        <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{sub.label}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {sub.count}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
