import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Search, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PinnedRemedy {
  title: string;
  category: string;
}

interface Props {
  bevorzugteLinie: string[];
  onBevorzugteLinieChange: (lines: string[]) => void;
  pinnedMittel: PinnedRemedy[];
  onPinnedMittelChange: (mittel: PinnedRemedy[]) => void;
}

const QUICK_LINES = [
  { key: "Vitaplace", label: "Vitaplace-Linie", hint: "Praxis-Eigenmarke" },
  { key: "NutraMedix", label: "NutraMedix", hint: "Cowden-Protokoll" },
  { key: "Sanum", label: "Sanum (Isopathie)", hint: "Enderlein" },
  { key: "Heel", label: "Heel-Komplexmittel", hint: "Antihomotoxisch" },
  { key: "CERES", label: "CERES-Urtinkturen", hint: "Spagyrik" },
];

interface WikiItem {
  title: string;
  category: string;
}

export function PreferredRemediesCard({
  bevorzugteLinie,
  onBevorzugteLinieChange,
  pinnedMittel,
  onPinnedMittelChange,
}: Props) {
  const [allEntries, setAllEntries] = useState<WikiItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_knowledge_base")
        .select("title, category")
        .order("title", { ascending: true });
      if (active && data) setAllEntries(data as WikiItem[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allEntries.slice(0, 30);
    const q = search.toLowerCase();
    return allEntries
      .filter((e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      .slice(0, 50);
  }, [search, allEntries]);

  const isPinned = (title: string) => pinnedMittel.some((p) => p.title === title);

  const togglePin = (item: WikiItem) => {
    if (isPinned(item.title)) {
      onPinnedMittelChange(pinnedMittel.filter((p) => p.title !== item.title));
    } else {
      onPinnedMittelChange([...pinnedMittel, item]);
    }
  };

  const toggleLine = (key: string) => {
    if (bevorzugteLinie.includes(key)) {
      onBevorzugteLinieChange(bevorzugteLinie.filter((l) => l !== key));
    } else {
      onBevorzugteLinieChange([...bevorzugteLinie, key]);
    }
  };

  return (
    <Card className="border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-600 fill-amber-500" />
          Bevorzugte Mittel / Hausapotheke
          <span className="text-xs font-normal text-muted-foreground">(optional, beeinflusst die KI)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bevorzugte Produktlinien */}
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            Bevorzugte Produktlinien
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Bei vergleichbarer Wirkung priorisiert die KI Mittel aus diesen Linien.
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_LINES.map((line) => {
              const active = bevorzugteLinie.includes(line.key);
              return (
                <button
                  key={line.key}
                  type="button"
                  onClick={() => toggleLine(line.key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    active
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-background border-border hover:border-amber-400"
                  }`}
                  title={line.hint}
                >
                  {active ? "★ " : ""}
                  {line.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gepinnte Mittel anzeigen */}
        {pinnedMittel.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              📌 Zwingend in Empfehlung aufnehmen ({pinnedMittel.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {pinnedMittel.map((p) => (
                <Badge
                  key={p.title}
                  variant="default"
                  className="gap-1 bg-amber-500 hover:bg-amber-600 text-white pr-1"
                >
                  {p.title}
                  <button
                    type="button"
                    onClick={() => onPinnedMittelChange(pinnedMittel.filter((x) => x.title !== p.title))}
                    className="hover:bg-amber-700 rounded p-0.5"
                    aria-label={`${p.title} entfernen`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suche & Auswahl */}
        <div>
          <label className="text-sm font-medium mb-1 block">Mittel aus Wiki anpinnen</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche nach Wirkstoff, Produkt, Kategorie..."
              className="pl-8 h-9"
            />
          </div>
          <ScrollArea className="h-48 mt-2 border rounded-md bg-background">
            {loading && <p className="p-3 text-xs text-muted-foreground">Lade Wiki...</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">Keine Treffer.</p>
            )}
            {!loading && filtered.map((item) => {
              const pinned = isPinned(item.title);
              return (
                <label
                  key={item.title + item.category}
                  className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 border-b border-border/50 last:border-0 ${
                    pinned ? "bg-amber-50 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <Checkbox
                    checked={pinned}
                    onCheckedChange={() => togglePin(item)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.category}</div>
                  </div>
                </label>
              );
            })}
          </ScrollArea>
          <p className="text-xs text-muted-foreground mt-1">
            Tipp: Erst „Vitaplace" oder „Nahrung" suchen, um deine Eigenprodukte schnell zu pinnen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
