import { useState } from "react";
import { Button } from "@/components/ui/button";
import { draftConflictFields, mergeReviewedDraft } from "@/lib/patientDraftConflict";

const labels: Record<string, string> = {
  anamnese: "Anamnese", anamneseDatum: "Anamnese – Datum", symptome: "Symptome", erkrankung: "Erkrankungen und Diagnosen",
  laborKomplett: "Laborbefund", laborDatum: "Labor – Datum", laborErhoeht: "Erhöhte Laborwerte", laborErniedrigt: "Erniedrigte Laborwerte",
  arztbericht: "Arztbericht", arztberichtDatum: "Arztbericht – Datum", stuhlbefund: "Stuhlbefund", metatronHeel: "Metatron / NLS",
  metatronDatum: "Metatron – Datum", vievaPlus: "Vieva", vievaPlusDatum: "Vieva – Datum", sonstigeUntersuchungen: "Weitere Untersuchungen",
  alter: "Alter", geschlecht: "Geschlecht", groesseCm: "Größe", gewichtKg: "Gewicht", schwanger: "Schwangerschaft",
  medikamente: "Konventionell-medizinische Medikamente", naturheilMittelHomoeopathie: "Homöopathie", naturheilMittelPflanzenheilkunde: "Pflanzenheilkunde",
  naturheilMittelVitamine: "Vitamine", naturheilMittelMineralstoffe: "Mineralstoffe", naturheilMittelSpurenelemente: "Spurenelemente",
  bisherigeMittel: "Bisherige Mittel", budget: "Budget", pathogens: "Erfasste Belastungen", pathogenBulkText: "Eingegebene Belastungen",
  manualDiagnosen: "Ergänzte Diagnosen", manualMittel: "Ergänzte Mittel", pinnedMittel: "Festgelegte Mittel", selectedCategories: "Gewählte Kategorien",
  bevorzugteLinie: "Bevorzugte Produktlinien", mannayanOrders: "Zugeteilte Bestellungen", perplexityAnalyse: "Zusätzliche Analyse",
  eigeneTherapieVorlage: "Eigene Therapievorgabe", apothekerRezept: "Rezept", zusatzTherapie: "Therapieergänzung", analysisProfile: "Auswertungsprofil",
};
const showValue = (value: unknown) => value === undefined || value === null || value === "" ? "Nicht enthalten" : typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function PatientDraftConflictReview({ local, remote, onResolve, onCancel }: {
  local: Record<string, unknown>; remote: Record<string, unknown>;
  onResolve: (merged: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, "local" | "remote">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = draftConflictFields(local, remote);
  const allChosen = fields.every(key => choices[key] === "local" || choices[key] === "remote");
  return <section aria-label="Speicherfassungen vergleichen" className="mx-auto max-w-5xl space-y-4 rounded-lg border-2 border-amber-500 bg-amber-50 p-5 text-amber-950">
    <h2 className="text-xl font-semibold">Welche Inhalte sollen weiterverwendet werden?</h2>
    <p>Links stehen Ihre Eingaben aus diesem Fenster, rechts die zuletzt geladene gespeicherte Fassung. Wählen Sie bei jedem Unterschied bewusst aus. Beim Speichern wird erneut geprüft, ob zwischenzeitlich jemand den gespeicherten Stand geändert hat.</p>
    {!fields.length && <p>Die bearbeitbaren Inhalte stimmen überein. Sie können diesen Ausgangsstand bestätigen.</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {fields.map(key => <fieldset key={key} className="min-w-0 rounded border border-amber-300 p-3">
        <legend className="px-2 font-semibold">{labels[key] || key}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(["local", "remote"] as const).map(side => <label key={side} className="block min-w-0 cursor-pointer rounded border bg-white p-3">
            <span className="flex min-h-11 items-center gap-2 font-medium"><input type="radio" name={`conflict-${key}`} checked={choices[key] === side}
              onChange={() => setChoices(current => ({ ...current, [key]: side }))} />{side === "local" ? "Meine Eingaben" : "Gespeicherte Fassung"}</span>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-base">{showValue((side === "local" ? local : remote)[key])}</pre>
          </label>)}
        </div>
      </fieldset>)}
      <p className="text-sm">Vor dem Kopieren oder Weitergeben erneut Datenschutz prüfen: Namen, Initialen, Diagnosen, Geburtsdaten, Adressen, Dateinamen und Anlagen kontrollieren.</p>
      {error && <p role="alert" className="font-semibold text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!allChosen || busy} onClick={async () => {
          setBusy(true); setError("");
          try { await onResolve(mergeReviewedDraft(local, remote, choices)); }
          catch (failure: any) { setError(failure?.message || "Der Abgleich konnte nicht gespeichert werden."); }
          finally { setBusy(false); }
        }}>{busy ? "Speichern und prüfen…" : "Ausgewählte Fassung speichern"}</Button>
        <Button variant="outline" onClick={onCancel}>Vergleich schließen – Eingaben behalten</Button>
      </div>
    </fieldset>
  </section>;
}
