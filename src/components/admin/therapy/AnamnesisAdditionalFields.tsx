import { Textarea } from "@/components/ui/textarea";
import { formatIAAAssessment } from "@/lib/iaaAssessment";

export const ADDITIONAL_ANAMNESIS_FIELDS = [
  ["diagnoses", "Dokumentierte Diagnosen"],
  ["labPathogens", "Labor-Pathogene"],
  ["petExaminations", "PET-Untersuchungen – Datum und untersuchter Bereich / Fragestellung"],
  ["children", "Kinderzahl und Angaben zu Kindern"],
  ["menopause", "Menopause und Zyklus"],
  ["pregnancy", "Schwangerschaft und Stillzeit laut Anamnese"],
  ["allergies", "Allergien und Unverträglichkeiten"],
  ["pastHistory", "Vorgeschichte und Operationen"],
  ["hypotheses", "Diagnosevorschläge und ungeklärte Diagnosen"],
  ["negativeOrUncertainFindings", "Verneinte, unsichere oder ungeklärte Angaben"],
  ["familyHistory", "Familienanamnese"],
  ["habits", "Lebensgewohnheiten, Schlaf und Ernährung"],
  ["socialStatus", "Sozialanamnese und Belastungen"],
  ["vaccinationStatus", "Impfstatus"],
  ["physicalExamination", "Körperlicher Untersuchungsbefund"],
  ["recentExaminations", "Letzte Untersuchungen und Kontrollen"],
  ["additionalInvestigations", "Weitere Untersuchungen"],
  ["historicalMedications", "Frühere oder abgesetzte Präparate und Therapien"],
  ["uncertainMedications", "Präparate und Therapien mit ungeklärtem Status"],
  ["presentMedication", "Weitere Originalangaben zur Einnahme"],
] as const;

export function normalizeAdditionalAnamnesis(input: unknown): Record<string, string> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
}

export function formatAdditionalAnamnesis(values: Record<string, string>): string {
  return [...ADDITIONAL_ANAMNESIS_FIELDS.flatMap(([key, label]) => values[key]?.trim() ? [`${label}:\n${values[key]}`] : []), formatIAAAssessment(values)].filter(Boolean).join("\n\n");
}

export function AnamnesisAdditionalFields({ values, onChange, disabled }: {
  values: Record<string, string>; onChange: (values: Record<string, string>) => void; disabled: boolean;
}) {
  const count = ADDITIONAL_ANAMNESIS_FIELDS.filter(([key]) => values[key]?.trim()).length;
  return (
    <details className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Weitere Anamneseangaben · {count} Bereiche erfasst</summary>
      <p className="mt-2 text-xs text-muted-foreground">Diese Einzelangaben ergänzen die vorhandenen Felder. Der vollständige Anamnesebogen und seine Gesamtauswertung bleiben erhalten. Nicht angegeben, verneint und unsicher sind unterschiedliche Angaben.</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {ADDITIONAL_ANAMNESIS_FIELDS.filter(([key]) => !["diagnoses", "labPathogens", "petExaminations", "children", "menopause"].includes(key)).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`anamnesis-extra-${key}`} className="text-sm font-medium">{label}</label>
            <Textarea id={`anamnesis-extra-${key}`} value={values[key] || ""} disabled={disabled}
              onChange={event => onChange({ ...values, [key]: event.target.value })}
              placeholder="Noch nicht angegeben – nicht automatisch verneint" className="min-h-[100px] bg-background text-sm" />
          </div>
        ))}
      </div>
    </details>
  );
}
