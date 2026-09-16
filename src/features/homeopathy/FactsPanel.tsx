import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Binding, Fact } from "./core";
import { ASSERTION_LABEL, ASSERTION_STYLE, FACT_KIND_LABEL } from "./labels";

type Props = {
  facts: Fact[];
  bindings: Binding[];
  caseLabel: string;
  inputRevision: string;
};

/** Schritt 1: Fallangaben. Reine Anzeige, alle Texte werden als Text ausgegeben. */
export function FactsPanel({ facts, bindings, caseLabel, inputRevision }: Props) {
  const boundCount = new Map<string, number>();
  for (const binding of bindings) {
    if (!binding.confirmed) continue;
    boundCount.set(binding.factId, (boundCount.get(binding.factId) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-base">1. Fallangaben</CardTitle>
        <CardDescription>
          Fall {caseLabel} · Eingabestand {inputRevision}. Angaben bleiben unverändert; verneinte und unsichere
          Aussagen werden angezeigt, aber nicht als bejahte Rubrik gewertet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {facts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Keine Patientenangaben übergeben. Ohne Angaben findet keine Repertorisation statt.
          </p>
        ) : (
          <ul className="space-y-2">
            {facts.map((fact) => (
              <li key={fact.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">{FACT_KIND_LABEL[fact.kind]}</Badge>
                  <Badge variant="outline" className={cn("font-normal", ASSERTION_STYLE[fact.assertion])}>
                    {ASSERTION_LABEL[fact.assertion]}
                  </Badge>
                  {fact.kind === "iaa" && fact.iaaRating !== undefined && (
                    <Badge variant="outline" className="font-normal">
                      IAA-Stärke {fact.iaaRating} · kein Mittelgrad
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(boundCount.get(fact.id) ?? 0) === 0
                      ? "noch keine bestätigte Rubrik"
                      : `${boundCount.get(fact.id)} bestätigte Rubrik(en)`}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-foreground">{fact.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fact.citation.trim() ? `Beleg: ${fact.citation}` : "Beleg fehlt — Angabe wird nicht gewertet."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
