import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Binding, Catalog, Fact } from "./core";
import { ASSERTION_LABEL, FACT_KIND_LABEL } from "./labels";

const MAX_SEARCH_RESULTS = 40;

type Props = {
  facts: Fact[];
  catalog: Catalog;
  bindings: Binding[];
  onBindingsChange: (bindings: Binding[]) => void;
};

/** Schritt 2: Repertorien und Rubriken. Suche ist begrenzt, es werden nie alle
 * Katalogeinträge als Optionen gerendert. Mehrere Rubriken je Angabe sind möglich. */
export function RubricBindingPanel({ facts, catalog, bindings, onBindingsChange }: Props) {
  const [activeFactId, setActiveFactId] = useState<string>(facts[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const sourceTitles = useMemo(
    () => new Map(catalog.sources.map((source) => [source.id, source.title])),
    [catalog.sources],
  );
  const repertorySourceIds = useMemo(
    () => new Set(catalog.sources.filter((source) => source.kind === "repertory").map((source) => source.id)),
    [catalog.sources],
  );

  const activeFact = facts.find((fact) => fact.id === activeFactId) ?? null;

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const hits: typeof catalog.rubrics = [];
    for (const rubric of catalog.rubrics) {
      if (!repertorySourceIds.has(rubric.sourceId)) continue;
      const haystack = `${rubric.path} ${(rubric.searchTerms ?? []).join(" ")}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
      hits.push(rubric);
      if (hits.length >= MAX_SEARCH_RESULTS) break;
    }
    return hits;
  }, [catalog.rubrics, query, repertorySourceIds]);

  const factBindings = bindings.filter((binding) => binding.factId === activeFactId);

  function addBinding(rubricId: string) {
    if (!activeFact) return;
    if (bindings.some((b) => b.factId === activeFact.id && b.rubricId === rubricId)) return;
    onBindingsChange([
      ...bindings,
      {
        factId: activeFact.id,
        rubricId,
        confirmed: false,
        expectedAssertion: activeFact.assertion === "negated" ? "negated" : "affirmed",
        weight: 1,
      },
    ]);
  }

  function updateBinding(rubricId: string, patch: Partial<Binding>) {
    onBindingsChange(
      bindings.map((binding) =>
        binding.factId === activeFactId && binding.rubricId === rubricId ? { ...binding, ...patch } : binding,
      ),
    );
  }

  function removeBinding(rubricId: string) {
    onBindingsChange(bindings.filter((b) => !(b.factId === activeFactId && b.rubricId === rubricId)));
  }

  const rubricPath = (rubricId: string) => catalog.rubrics.find((r) => r.id === rubricId)?.path ?? rubricId;
  const rubricSource = (rubricId: string) => {
    const rubric = catalog.rubrics.find((r) => r.id === rubricId);
    return rubric ? sourceTitles.get(rubric.sourceId) ?? rubric.sourceId : "Quelle unbekannt";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-base">2. Repertorien und Rubriken</CardTitle>
        <CardDescription>
          Ordne einer Angabe eine oder mehrere belegte Rubriken zu und bestätige sie einzeln. Gewichtung ist eine
          bewusste Auswahl, keine Automatik. Angezeigt werden höchstens {MAX_SEARCH_RESULTS} Treffer je Suche.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalog.rubrics.length === 0 || repertorySourceIds.size === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Es sind keine strukturierten Repertoriumsdaten in dieses Modul geladen. Gewünschte Quellen (Kent,
            Bönninghausen, Boger, Boericke) sind noch nicht vorhanden — es werden keine Rubriken, Grade oder Mittel
            ersatzweise angezeigt.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hom-fact">Patientenangabe</Label>
                <Select value={activeFactId} onValueChange={setActiveFactId}>
                  <SelectTrigger id="hom-fact">
                    <SelectValue placeholder="Angabe wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {facts.map((fact) => (
                      <SelectItem key={fact.id} value={fact.id}>
                        {FACT_KIND_LABEL[fact.kind]} · {fact.text.slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hom-search">Rubrik suchen (mind. 2 Zeichen)</Label>
                <Input
                  id="hom-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="z. B. Kopf, schlimmer nachts"
                  autoComplete="off"
                />
              </div>
            </div>

            {activeFact && (
              <p className="text-xs text-muted-foreground">
                Aktive Angabe: {activeFact.text} ({ASSERTION_LABEL[activeFact.assertion]})
              </p>
            )}

            {query.trim().length >= 2 && (
              <ScrollArea className="h-48 rounded-md border border-border">
                {searchResults.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Keine Rubrik zu dieser Suche gefunden.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {searchResults.map((rubric) => (
                      <li key={rubric.id} className="flex items-start justify-between gap-3 p-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{rubric.path}</p>
                          <p className="text-xs text-muted-foreground">{sourceTitles.get(rubric.sourceId) ?? rubric.sourceId}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addBinding(rubric.id)} disabled={!activeFact}>
                          Zuordnen
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Zuordnungen dieser Angabe</p>
              {factBindings.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Noch keine Rubrik zugeordnet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {factBindings.map((binding) => (
                    <li key={binding.rubricId} className="rounded-md border border-border p-3">
                      <p className="text-sm text-foreground">{rubricPath(binding.rubricId)}</p>
                      <p className="text-xs text-muted-foreground">{rubricSource(binding.rubricId)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          variant={binding.confirmed ? "default" : "outline"}
                          onClick={() => updateBinding(binding.rubricId, { confirmed: !binding.confirmed })}
                          aria-pressed={binding.confirmed}
                        >
                          {binding.confirmed ? "Bestätigt" : "Bestätigen"}
                        </Button>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`weight-${binding.rubricId}`} className="text-xs">
                            Gewichtung (1–10)
                          </Label>
                          <Input
                            id={`weight-${binding.rubricId}`}
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            className="h-8 w-20"
                            value={binding.weight ?? 1}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (!Number.isFinite(value)) return;
                              updateBinding(binding.rubricId, { weight: Math.min(10, Math.max(1, Math.round(value))) });
                            }}
                          />
                        </div>
                        {binding.expectedAssertion === "negated" && (
                          <Badge variant="outline" className="font-normal">erwartet: verneint</Badge>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeBinding(binding.rubricId)}>
                          Entfernen
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
