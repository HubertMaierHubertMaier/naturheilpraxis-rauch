import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2 } from "lucide-react";

interface Props {
  selected: string[];
  onChange: (cats: string[]) => void;
}

/**
 * Lädt die Top-Level-Kategorien (Hauptordner) aus admin_knowledge_base
 * und erlaubt eine Mehrfachauswahl. Leere Auswahl = Alle Ordner.
 */
export function CategoryFilter({ selected, onChange }: Props) {
  const [topCategories, setTopCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

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
      const map = new Map<string, number>();
      for (const row of data || []) {
        const top = (row.category || "").split(">")[0].trim() || "Allgemein";
        map.set(top, (map.get(top) || 0) + 1);
      }
      const arr = Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
      setTopCategories(arr);
      setLoading(false);
    })();
  }, []);

  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter((c) => c !== name));
    else onChange([...selected, name]);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ordner laden…
      </div>
    );
  }

  const allSelected = selected.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {allSelected
            ? "Alle Ordner werden durchsucht"
            : `${selected.length} Ordner ausgewählt`}
        </p>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
          >
            Alle
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto rounded-md border border-input bg-background p-2">
        {topCategories.map((cat) => {
          const checked = selected.includes(cat.name);
          return (
            <label
              key={cat.name}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(cat.name)}
                aria-label={cat.name}
              />
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{cat.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {cat.count}
              </Badge>
            </label>
          );
        })}
      </div>
    </div>
  );
}
