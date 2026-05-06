import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Bug, Activity, Stethoscope, FlaskConical, FileText, Microscope, Radio } from "lucide-react";
import { classifyPathogenIndex, type PathogenEntry } from "./PathogenInput";

const indexBadgeClass = (level: ReturnType<typeof classifyPathogenIndex>["level"]) => {
  switch (level) {
    case "sehr hoch": return "border-red-500 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30";
    case "hoch": return "border-orange-500 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30";
    case "mittel": return "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30";
    case "gering": return "border-sky-400 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30";
    case "sehr gering": return "border-muted text-muted-foreground bg-muted/40";
    default: return "";
  }
};

interface Props {
  pathogens: PathogenEntry[];
  symptome: string;
  erkrankung: string;
  laborErhoeht?: string;
  laborErniedrigt?: string;
  laborKomplett?: string;
  laborDatum?: string;
  stuhlbefund?: string;
  arztbericht?: string;
  arztberichtDatum?: string;
  metatronHeel?: string;
}

const splitLines = (s?: string) =>
  (s || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Live-Übersicht der erfassten Pathogene + Symptome + Erkrankung + Labor + Arztbericht.
 * Wird direkt unter den Eingabefeldern angezeigt, damit der Therapeut
 * jederzeit sieht, was wirklich an die KI übergeben wird.
 */
export function LiveInputSummary({
  pathogens, symptome, erkrankung,
  laborErhoeht = "", laborErniedrigt = "", laborKomplett = "", laborDatum = "",
  stuhlbefund = "", arztbericht = "", arztberichtDatum = "", metatronHeel = "",
}: Props) {
  const filledPathogens = pathogens.filter((p) => p.name.trim());

  const symptomList = symptome.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean);
  const erkrankungList = erkrankung.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean);

  const laborErhoehtList = splitLines(laborErhoeht);
  const laborErniedrigtList = splitLines(laborErniedrigt);
  const laborKomplettList = splitLines(laborKomplett);
  const stuhlList = splitLines(stuhlbefund);
  const arztberichtList = splitLines(arztbericht);
  const metatronList = splitLines(metatronHeel);

  const hasLabor = laborErhoehtList.length + laborErniedrigtList.length + laborKomplettList.length > 0;
  const hasStuhl = stuhlList.length > 0;
  const hasArzt = arztberichtList.length > 0;
  const hasMetatron = metatronList.length > 0;

  const totalCount =
    filledPathogens.length + symptomList.length + erkrankungList.length +
    laborErhoehtList.length + laborErniedrigtList.length + laborKomplettList.length +
    stuhlList.length + arztberichtList.length + metatronList.length;

  const hasAny = totalCount > 0;
  if (!hasAny) return null;

  return (
    <Card className="border-emerald-300/60 bg-gradient-to-br from-emerald-50/60 via-background to-sky-50/40 dark:from-emerald-950/15 dark:via-background dark:to-sky-950/15 dark:border-emerald-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-emerald-600" />
          <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent font-semibold">
            Erfasste Eingaben – Übersicht
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {totalCount} Einträge
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {filledPathogens.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Bug className="h-3.5 w-3.5" />
              Pathogene / Belastungen ({filledPathogens.length})
            </div>
            <ol className="space-y-1.5 list-decimal list-inside">
              {filledPathogens.map((p) => {
                const c = p.index.trim() ? classifyPathogenIndex(p.index) : null;
                return (
                  <li key={p.id} className="leading-snug">
                    <span className="font-medium text-foreground">{p.name.trim()}</span>
                    {p.organe.trim() && (
                      <span className="text-muted-foreground"> · Organe: <em>{p.organe.trim().replace(/\n+/g, ", ")}</em></span>
                    )}
                    {c && (
                      <Badge
                        variant="outline"
                        className={`ml-1.5 text-[10px] py-0 px-1.5 font-mono ${indexBadgeClass(c.level)}`}
                        title={`Metatron/NLS-Index ${p.index.trim()} – Wahrscheinlichkeit ${c.level}: ${c.hint}`}
                      >
                        {p.index.trim()} · {c.level}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {symptomList.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              <Activity className="h-3.5 w-3.5" />
              Symptome ({symptomList.length})
            </div>
            <ol className="space-y-1 list-decimal list-inside">
              {symptomList.map((s, i) => (
                <li key={i} className="leading-snug text-foreground">{s}</li>
              ))}
            </ol>
          </div>
        )}

        {erkrankungList.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              <Stethoscope className="h-3.5 w-3.5" />
              Erkrankung / Diagnose ({erkrankungList.length})
            </div>
            <ol className="space-y-1 list-decimal list-inside">
              {erkrankungList.map((s, i) => (
                <li key={i} className="leading-snug text-foreground">{s}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
