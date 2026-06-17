import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { infothekGroups, type InfothekItem } from "@/lib/infothekContent";
import { useInfothekGating } from "@/hooks/useInfothekGating";
import { Loader2, Lock, Globe, LayoutList, Eye } from "lucide-react";

/**
 * Admin-UI: pro Infothek-Beitrag entscheiden, ob er öffentlich (☐) oder
 * nur für freigeschaltete Patienten (☑) sichtbar ist.
 * Speichert Overrides in `infothek_gating`.
 */
export function InfothekGatingManager() {
  const { overrides, loading, refresh } = useInfothekGating();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"group" | "visibility">("group");

  // initial draft = defaults überlagert mit DB-Overrides
  useEffect(() => {
    if (loading) return;
    const initial: Record<string, boolean> = {};
    for (const g of infothekGroups) {
      for (const i of g.items) {
        initial[i.href] = Object.prototype.hasOwnProperty.call(overrides, i.href)
          ? overrides[i.href]
          : !!i.gated;
      }
    }
    setDraft(initial);
  }, [loading, overrides]);

  const dirty = useMemo(() => {
    for (const g of infothekGroups) {
      for (const i of g.items) {
        const effective = Object.prototype.hasOwnProperty.call(overrides, i.href)
          ? overrides[i.href]
          : !!i.gated;
        if (draft[i.href] !== effective) return true;
      }
    }
    return false;
  }, [draft, overrides]);

  const toggle = (href: string) => {
    setDraft((d) => ({ ...d, [href]: !d[href] }));
  };

  const saveAll = async () => {
    setSaving(true);
    const rows = Object.entries(draft).map(([href, gated]) => ({
      href,
      gated,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        upsert: (
          rows: unknown,
          opts: { onConflict: string }
        ) => Promise<{ error: unknown }>;
      };
    })
      .from("infothek_gating")
      .upsert(rows, { onConflict: "href" });

    setSaving(false);
    if (error) {
      toast({
        title: "Fehler beim Speichern",
        description: String((error as { message?: string }).message ?? error),
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Sichtbarkeit gespeichert" });
    refresh();
  };

  const setAllInGroup = (groupIdx: number, gated: boolean) => {
    const next = { ...draft };
    for (const i of infothekGroups[groupIdx].items) next[i.href] = gated;
    setDraft(next);
  };

  // Für die "Nach Sichtbarkeit"-Ansicht alle Items flach sammeln
  const allItems = useMemo(() => {
    const out: Array<{ group: string; item: InfothekItem }> = [];
    for (const g of infothekGroups) {
      for (const i of g.items) out.push({ group: g.title.de, item: i });
    }
    return out;
  }, []);

  const publicItems = useMemo(
    () => allItems.filter(({ item }) => !draft[item.href]),
    [allItems, draft]
  );
  const gatedItems = useMemo(
    () => allItems.filter(({ item }) => !!draft[item.href]),
    [allItems, draft]
  );

  const renderItemRow = (
    { group, item }: { group: string; item: InfothekItem },
    mode: "gated" | "public" = "gated"
  ) => {
    const isGated = !!draft[item.href];
    // In der Sichtbarkeits-Ansicht heißt "Häkchen = gehört in diese Liste".
    // In der Themen-Ansicht heißt "Häkchen = gesperrt" (mode === "gated").
    const checked = mode === "public" ? !isGated : isGated;
    return (
      <li
        key={item.href}
        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30"
      >
        <Checkbox
          id={`gate-${item.href}`}
          checked={checked}
          onCheckedChange={() => toggle(item.href)}
          className="mt-1"
        />
        <label
          htmlFor={`gate-${item.href}`}
          className="flex-1 cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.label.de}</span>
            {isGated ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> gesperrt
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" /> öffentlich
              </Badge>
            )}
            {item.external && (
              <Badge variant="outline" className="text-[10px]">extern</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.description.de} · <span className="text-[10px] text-sage-500">{group}</span>
          </div>
        </label>
      </li>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Sichtbarkeits-Einstellungen …
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ansichts-Wechsler */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Ansicht:</span>
        <div className="inline-flex rounded-lg border bg-card p-1">
          <button
            onClick={() => setViewMode("group")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
              viewMode === "group"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" /> Nach Thema
          </button>
          <button
            onClick={() => setViewMode("visibility")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
              viewMode === "visibility"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Nach Sichtbarkeit
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-sage-200 bg-sage-50/60 p-4 text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">So funktioniert es:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <Globe className="mr-1 inline h-3.5 w-3.5 text-primary" />
            Häkchen <strong>aus</strong> = Beitrag ist <strong>öffentlich</strong> für alle Besucher sichtbar (gut für Google/SEO).
          </li>
          <li>
            <Lock className="mr-1 inline h-3.5 w-3.5 text-primary" />
            Häkchen <strong>an</strong> = Beitrag ist <strong>gesperrt</strong> und nur für Patienten sichtbar,
            die du im Tab „Zugänge" freigeschaltet hast (oder mit „Alle Infothek-Inhalte").
          </li>
          <li>Änderungen wirken erst nach „Speichern".</li>
        </ul>
      </div>

      {viewMode === "group" ? (
        /* ─── Nach Thema gruppieren ─── */
        <>
          {infothekGroups.map((group, gi) => {
            const gatedCount = group.items.filter((i) => draft[i.href]).length;
            return (
              <div key={group.title.de} className="rounded-lg border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <h3 className="font-serif text-base font-semibold">{group.title.de}</h3>
                    <p className="text-xs text-muted-foreground">
                      {gatedCount} von {group.items.length} gesperrt
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAllInGroup(gi, false)}>
                      <Globe className="mr-1 h-3.5 w-3.5" /> Alle öffentlich
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAllInGroup(gi, true)}>
                      <Lock className="mr-1 h-3.5 w-3.5" /> Alle sperren
                    </Button>
                  </div>
                </div>
                <ul className="divide-y">
                  {group.items.map((item) => renderItemRow({ group: group.title.de, item }))}
                </ul>
              </div>
            );
          })}
        </>
      ) : (
        /* ─── Nach Sichtbarkeit gruppieren ─── */
        <>
          {/* Öffentlich */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Globe className="h-4 w-4 text-primary" />
              <div>
                <h3 className="font-serif text-base font-semibold">Öffentlich sichtbar</h3>
                <p className="text-xs text-muted-foreground">
                  {publicItems.length} Artikel — für alle Besucher & Suchmaschinen erreichbar
                </p>
              </div>
            </div>
            {publicItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aktuell sind alle Artikel gesperrt.
              </div>
            ) : (
              <ul className="divide-y">{publicItems.map((row) => renderItemRow(row, "public"))}</ul>
            )}
          </div>

          {/* Gesperrt */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Lock className="h-4 w-4 text-destructive" />
              <div>
                <h3 className="font-serif text-base font-semibold">Nur für Patienten</h3>
                <p className="text-xs text-muted-foreground">
                  {gatedItems.length} Artikel — nur nach Freischaltung sichtbar
                </p>
              </div>
            </div>
            {gatedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aktuell sind alle Artikel öffentlich.
              </div>
            ) : (
              <ul className="divide-y">{gatedItems.map((row) => renderItemRow(row, "gated"))}</ul>
            )}
          </div>
        </>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={saveAll} disabled={!dirty || saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {dirty ? "Änderungen speichern" : "Keine Änderungen"}
        </Button>
      </div>
    </div>
  );
}

