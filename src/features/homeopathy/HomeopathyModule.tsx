import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { CandidateCard } from "./CandidateCard";
import { FactsPanel } from "./FactsPanel";
import { RubricBindingPanel } from "./RubricBindingPanel";
import { STATUS_LABEL } from "./labels";
import { assertCurrentHomeopathyResult, repertorize, type Binding, type Candidate, type Catalog, type Fact, type Result } from "./core";

export type HomeopathyModuleProps = {
  /** Pseudonymisierte Fallkennung — niemals ein Personenname. */
  patientId: string;
  inputRevision: string;
  facts: Fact[];
  bindings: Binding[];
  catalog: Catalog;
  onBindingsChange: (bindings: Binding[]) => void;
  onEvaluated?: (result: Result) => void;
  onAdoptCandidate?: (candidate: Candidate) => void;
  isLoading?: boolean;
  loadError?: string | null;
};

/** Ruhige Admin-Oberfläche für die vorhandene deterministische Repertorisationslogik.
 * Die Reihenfolge der Engine wird unverändert übernommen; es wird nicht nachsortiert. */
export function HomeopathyModule({
  patientId,
  inputRevision,
  facts,
  bindings,
  catalog,
  onBindingsChange,
  onEvaluated,
  onAdoptCandidate,
  isLoading = false,
  loadError = null,
}: HomeopathyModuleProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const caseLabel = patientId.trim() || "ohne Kennung";
  const confirmedBindings = bindings.filter((binding) => binding.confirmed).length;
  const catalogEmpty = catalog.entries.length === 0 || !catalog.sources.some((source) => source.kind === "repertory");

  /** Ergebnis nur zeigen, wenn es zur aktuellen Auswahl gehört. */
  const currentResult = useMemo(() => {
    if (!result) return null;
    try {
      assertCurrentHomeopathyResult(result, patientId, inputRevision);
      return result;
    } catch {
      return null;
    }
  }, [result, patientId, inputRevision]);

  const stale = result !== null && currentResult === null;

  function runEvaluation() {
    setError(null);
    try {
      const next = repertorize({ patientId, inputRevision, facts, bindings, limit: 10 }, catalog);
      setResult(next);
      onEvaluated?.(next);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Die Auswertung konnte nicht durchgeführt werden.");
    }
  }

  return (
    <section className="space-y-4" aria-label="Homöopathie-Repertorisation">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-serif text-lg">Homöopathie — Repertorisation</CardTitle>
            <Badge variant="outline" className="font-normal">intern · admin_only</Badge>
          </div>
          <CardDescription>
            Deterministischer Quellenvergleich, keine Wirksamkeits- oder Sicherheitsaussage und keine Verordnung.
            Ergebnisse gelten ausschließlich für Fall {caseLabel}, Eingabestand {inputRevision}. IAA-Stärke bleibt
            getrennt von Repertoriumsgraden.
          </CardDescription>
        </CardHeader>
      </Card>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Daten konnten nicht vollständig geladen werden</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Fallangaben und Katalog werden geladen …
        </div>
      )}

      <FactsPanel facts={facts} bindings={bindings} caseLabel={caseLabel} inputRevision={inputRevision} />

      <RubricBindingPanel facts={facts} catalog={catalog} bindings={bindings} onBindingsChange={onBindingsChange} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">3. Mittelauswahl</CardTitle>
          <CardDescription>
            Angezeigt werden bis zu zehn Ergebnisse in der Reihenfolge der Engine. Weitere gleichrangige und alle
            übrigen Ergebnisse bleiben erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runEvaluation} disabled={isLoading || catalogEmpty || confirmedBindings === 0}>
              Repertorisation auswerten
            </Button>
            <span className="text-xs text-muted-foreground">
              {confirmedBindings} bestätigte Rubrikzuordnung(en) · Katalogversion {catalog.version || "unbekannt"}
            </span>
          </div>

          {catalogEmpty && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Keine Repertoriumsdaten geladen</AlertTitle>
              <AlertDescription>
                In dieses Modul sind noch keine strukturierten Repertoriumdaten geladen. Kent, Bönninghausen, Boger und
                Boericke sind gewünschte Quellen, keine vorhandenen Daten. Solange nichts geladen ist, wird keine
                Auswertung und kein Beispielmittel angezeigt.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Auswertung nicht möglich</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {stale && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ergebnis gesperrt</AlertTitle>
              <AlertDescription>
                Das vorliegende Ergebnis gehört zu einem anderen Fall oder einem überholten Eingabestand und wird
                deshalb nicht angezeigt. Bitte neu auswerten.
              </AlertDescription>
            </Alert>
          )}

          {currentResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-normal">{STATUS_LABEL[currentResult.status]}</Badge>
                <span>Katalogversion {currentResult.catalogVersion}</span>
                <span>{currentResult.allCandidates.length} Ergebnis(se) gesamt</span>
              </div>

              {currentResult.issues.length > 0 && (
                <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-700 dark:text-amber-400">
                  {currentResult.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}

              {currentResult.displayed.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Kein Ergebnis aus belegten Einträgen. Es werden keine Ersatzmittel angezeigt.
                </p>
              ) : (
                <div className="space-y-3">
                  {currentResult.displayed.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.remedyId}
                      candidate={candidate}
                      rank={index + 1}
                      sources={catalog.sources}
                      onAdopt={onAdoptCandidate}
                    />
                  ))}
                  {currentResult.furtherTiedCandidates > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {currentResult.furtherTiedCandidates} weitere gleichrangige Ergebnis(se) sind erhalten, aber nicht
                      angezeigt.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">4. Quellen und Potenz/Einnahme</CardTitle>
          <CardDescription>
            Potenz- und Einnahmeangaben erscheinen nur mit Quelle, Fundstelle, Zitat und Geltungsbereich — jeweils
            getrennt je Quelle, ohne Zusammenführung zu einer einheitlichen Dosierung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {catalog.sources.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Keine Quellen geladen.
            </p>
          ) : (
            <ul className="space-y-2">
              {catalog.sources.map((source) => (
                <li key={source.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground">{source.title}</span>
                    <Badge variant="outline" className="font-normal">
                      {source.kind === "repertory" ? "Repertorium" : "Materia medica"}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {source.maxGrade && source.maxGrade > 0 ? `Skala 0–${source.maxGrade}` : "Skala nicht angegeben"}
                    </Badge>
                  </div>
                  {source.evidenceNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{source.evidenceNote}</p>
                  )}
                  {source.kind === "materia_medica" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Materia medica liefert keine Repertoriumsgrade.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default HomeopathyModule;
