import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Candidate, Source } from "./core";
import { formatOriginalGrade } from "./labels";

type Props = {
  candidate: Candidate;
  rank: number;
  sources: Source[];
  onAdopt?: (candidate: Candidate) => void;
};

/** Schritt 3 + 4 je Mittel: Begründung, Fundstellen mit Originalgrad,
 * anschließend Quellen für Potenz/Einnahme — ohne Zusammenführung zu einer Dosierung. */
export function CandidateCard({ candidate, rank, sources, onAdopt }: Props) {
  const maxGradeOf = (sourceId: string) => sources.find((source) => source.id === sourceId)?.maxGrade;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="font-serif text-base">
            {rank}. {candidate.name}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {candidate.matchedFactCount} abgedeckte Angabe(n) · {candidate.repertoryCount} Repertorium/Repertorien ·
            gewichtete Abdeckung {candidate.weightedCoverage}
          </p>
        </div>
        {onAdopt && (
          <Button size="sm" variant="outline" onClick={() => onAdopt(candidate)}>
            In Fallnotiz übernehmen
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{candidate.explanation}</p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Zugeordnete Patientenangaben und Fundstellen</p>
          <ul className="space-y-2">
            {candidate.matches.map((match, index) => (
              <li key={`${match.factId}-${match.rubricId}-${index}`} className="rounded-md border border-border p-3">
                <p className="text-sm text-foreground">{match.factText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {match.sourceTitle} · {match.rubricPath}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-normal">
                    {formatOriginalGrade(match.originalGrade, maxGradeOf(match.sourceId))}
                  </Badge>
                  <Badge variant="outline" className="font-normal">Gewichtung {match.weight}</Badge>
                  {match.normalizedGrade === null && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 font-normal text-amber-700 dark:text-amber-400">
                      Grad nicht quellenübergreifend vergleichbar
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Fundstelle: {match.citation.locator}</p>
                <blockquote className="mt-1 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                  {match.citation.quote}
                </blockquote>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Potenz und Einnahme (nur belegte Quellenangaben)</p>
          {candidate.administrations.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Keine belegte Potenz- oder Einnahmeangabe geladen. Dieser Punkt bleibt offen; es wird keine Dosierung
              abgeleitet.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidate.administrations.map((administration, index) => (
                <li key={`${administration.remedyId}-${index}`} className="rounded-md border border-border p-3 text-sm">
                  <p>Potenz: {administration.potency?.trim() ? administration.potency : "nicht angegeben"}</p>
                  <p>Einnahme: {administration.intake?.trim() ? administration.intake : "nicht angegeben"}</p>
                  <p className="text-xs text-muted-foreground">Geltungsbereich: {administration.applicability}</p>
                  <p className="text-xs text-muted-foreground">Fundstelle: {administration.citation.locator}</p>
                  <blockquote className="mt-1 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                    {administration.citation.quote}
                  </blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>

        {candidate.missing.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-700 dark:text-amber-400">
            {candidate.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
