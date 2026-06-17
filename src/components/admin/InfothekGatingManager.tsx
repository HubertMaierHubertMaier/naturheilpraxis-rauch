import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { infothekGroups, type InfothekItem } from "@/lib/infothekContent";
import {
  useInfothekGating,
  type InfothekVisibility,
} from "@/hooks/useInfothekGating";
import {
  Loader2,
  Lock,
  Globe,
  UserPlus,
  LayoutList,
  Eye,
  ChevronDown,
} from "lucide-react";

/**
 * Admin-UI: pro Infothek-Beitrag eine von drei Sichtbarkeiten setzen:
 *   - public      → für alle Besucher (auch ohne Login)
 *   - new_patient → nur für angemeldete Nutzer (Neuanmeldung + Patient)
 *   - patient     → nur für freigeschaltete Patienten
 *
 * Speichert in `infothek_gating` (Spalten visibility + gated für Backward-Compat).
 */
const VIS_META: Record<
  InfothekVisibility,
  { label: string; short: string; icon: typeof Globe; tone: string; help: string }
> = {
  public: {
    label: "Öffentlich",
    short: "Alle",
    icon: Globe,
    tone: "text-emerald-600",
    help: "Für alle Besucher sichtbar – auch ohne Login. Gut für SEO.",
  },
  new_patient: {
    label: "Neuanmeldung",
    short: "Login",
    icon: UserPlus,
    tone: "text-blue-600",
    help: "Nur für angemeldete Nutzer – auch Neuanmeldungen, die noch nicht freigeschaltet sind.",
  },
  patient: {
    label: "Patienten",
    short: "Freigeschaltet",
    icon: Lock,
    tone: "text-amber-600",
    help: 'Nur für freigeschaltete Patienten (Tab „Zugänge"). Einzelne Beiträge können dort pro Patient extra freigegeben werden.',
  },
};

const ALL_VIS: InfothekVisibility[] = ["public", "new_patient", "patient"];

export function InfothekGatingManager() {
  const { overrides, loading, refresh } = useInfothekGating();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, InfothekVisibility>>({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"group" | "visibility">("group");

  useEffect(() => {
    if (loading) return;
    const initial: Record<string, InfothekVisibility> = {};
    for (const g of infothekGroups) {
      for (const i of g.items) {
        initial[i.href] = Object.prototype.hasOwnProperty.call(overrides, i.href)
          ? overrides[i.href]
          : i.gated
            ? "patient"
            : "public";
      }
    }
    setDraft(initial);
  }, [loading, overrides]);

  const dirty = useMemo(() => {
    for (const g of infothekGroups) {
      for (const i of g.items) {
        const effective: InfothekVisibility = Object.prototype.hasOwnProperty.call(
          overrides,
          i.href
        )
          ? overrides[i.href]
          : i.gated
            ? "patient"
            : "public";
        if (draft[i.href] !== effective) return true;
      }
    }
    return false;
  }, [draft, overrides]);

  const setVis = (href: string, v: InfothekVisibility) =>
    setDraft((d) => ({ ...d, [href]: v }));

  const saveAll = async () => {
    setSaving(true);
    const rows = Object.entries(draft).map(([href, visibility]) => ({
      href,
      visibility,
      gated: visibility !== "public", // Backward-Compat für alte Spalte
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

  const setAllInGroup = (groupIdx: number, v: InfothekVisibility) => {
    const next = { ...draft };
    for (const i of infothekGroups[groupIdx].items) next[i.href] = v;
    setDraft(next);
  };

  const allItems = useMemo(() => {
    const out: Array<{ group: string; item: InfothekItem }> = [];
    for (const g of infothekGroups) {
      for (const i of g.items) out.push({ group: g.title.de, item: i });
    }
    return out;
  }, []);

  const itemsByVis = useMemo(() => {
    const out: Record<InfothekVisibility, Array<{ group: string; item: InfothekItem }>> = {
      public: [],
      new_patient: [],
      patient: [],
    };
    for (const row of allItems) {
      const v = draft[row.item.href] ?? "patient";
      out[v].push(row);
    }
    return out;
  }, [allItems, draft]);

  const VisPicker = ({ href, readOnly = false }: { href: string; readOnly?: boolean }) => {
    const current = draft[href] ?? "patient";
    const currentMeta = VIS_META[current];
    const CurrentIcon = currentMeta.icon;

    return (
      <div className="relative inline-block shrink-0">
        <select
          value={current}
          disabled={readOnly}
          onChange={(e) => setVis(href, e.target.value as InfothekVisibility)}
          className={`appearance-none rounded-md border bg-background pl-2 pr-8 py-1.5 text-sm transition cursor-pointer
            ${readOnly ? "opacity-60 cursor-default" : "hover:border-sage-300"}
            ${current === "public" ? "border-emerald-200 text-emerald-700" : ""}
            ${current === "new_patient" ? "border-blue-200 text-blue-700" : ""}
            ${current === "patient" ? "border-amber-200 text-amber-700" : ""}
          `}
        >
          {ALL_VIS.map((v) => {
            const m = VIS_META[v];
            return (
              <option key={v} value={v}>
                {m.label} — {m.help}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  };

  const renderItemRow = (
    { group, item }: { group: string; item: InfothekItem },
    readOnly = false
  ) => {
    const v = draft[item.href] ?? "patient";
    const m = VIS_META[v];
    const Icon = m.icon;
    return (
      <li
        key={item.href}
        className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.label.de}</span>
            <Badge variant="outline" className={`gap-1 ${m.tone}`}>
              <Icon className="h-3 w-3" /> {m.label}
            </Badge>
            {item.external && (
              <Badge variant="outline" className="text-[10px]">extern</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.description.de} ·{" "}
            <span className="text-[10px] text-sage-500">{group}</span>
          </div>
        </div>
        <VisPicker href={item.href} readOnly={readOnly} />
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
            onClick={() => setViewMode("visibility")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
              viewMode === "visibility"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Nach Sichtbarkeit
          </button>
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
        </div>
      </div>

      {/* Legende */}
      <div className="rounded-lg border border-sage-200 bg-sage-50/60 p-4 text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Drei Sichtbarkeits-Stufen:</p>
        <ul className="ml-1 space-y-1">
          {ALL_VIS.map((v) => {
            const m = VIS_META[v];
            const Icon = m.icon;
            return (
              <li key={v} className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.tone}`} />
                <span>
                  <strong>{m.label}</strong> – {m.help}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs">
          Tipp: Im Tab „Zugänge" kannst du einzelne <em>patient</em>-Beiträge zusätzlich
          pro E-Mail freischalten.
        </p>
      </div>

      {viewMode === "visibility" ? (
        /* ─── Nach Sichtbarkeit ─── */
        <>
          {ALL_VIS.map((v) => {
            const m = VIS_META[v];
            const Icon = m.icon;
            const rows = itemsByVis[v];
            return (
              <div key={v} className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <Icon className={`h-4 w-4 ${m.tone}`} />
                  <div className="flex-1">
                    <h3 className="font-serif text-base font-semibold">{m.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {rows.length} Artikel — {m.help}
                    </p>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Aktuell keine Artikel in dieser Stufe.
                  </div>
                ) : (
                  <ul className="divide-y">{rows.map(renderItemRow)}</ul>
                )}
              </div>
            );
          })}
        </>
      ) : (
        /* ─── Nach Thema ─── */
        <>
          {infothekGroups.map((group, gi) => (
            <div key={group.title.de} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h3 className="font-serif text-base font-semibold">{group.title.de}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.items.length} Artikel
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_VIS.map((v) => {
                    const m = VIS_META[v];
                    const Icon = m.icon;
                    return (
                      <Button
                        key={v}
                        size="sm"
                        variant="outline"
                        onClick={() => setAllInGroup(gi, v)}
                      >
                        <Icon className={`mr-1 h-3.5 w-3.5 ${m.tone}`} />
                        Alle: {m.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <ul className="divide-y">
                {group.items.map((item) =>
                  renderItemRow({ group: group.title.de, item })
                )}
              </ul>
            </div>
          ))}
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
