import { Children, isValidElement, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";

export const PATIENT_INTAKE_STEPS = [
  ["patient-intake-case", "Fall wählen", "Neu anlegen oder wieder öffnen"],
  ["patient-intake-documents", "Unterlagen", "Auswählen, prüfen, übernehmen"],
  ["patient-intake-facts", "Einzelangaben", "Symptome und Präparate prüfen"],
  ["patient-intake-analysis", "Gesamtauswertung", "Vollständigen Bericht erstellen"],
  ["patient-intake-therapy", "Therapie", "Vorschläge getrennt vorbereiten"],
] as const;

/** Slots are ordered in the DOM, so keyboard order matches the visible workflow. */
export function PatientWorkflowLayout({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).map((child, index) => ({ child, index,
    order: isValidElement(child) ? Number((child.props as Record<string, unknown>)["data-workflow-order"] || 0) : 0,
  })).sort((a, b) => a.order - b.order || a.index - b.index);
  return <div className="flex flex-col gap-6">{items.map(item => item.child)}</div>;
}

export function PatientIntakeWorkflow({ pseudonymId, caseReady, saveStatus, hasSources, hasReport, onNavigate }: {
  pseudonymId: string; caseReady: boolean; saveStatus: "idle" | "saving" | "saved" | "error";
  hasSources: boolean; hasReport: boolean; onNavigate: (id: string) => void;
}) {
  const next = !caseReady ? 0 : !hasSources ? 1 : !hasReport ? 2 : 4;
  const status = { idle: "Speicherung bereit", saving: "Speicherung läuft …", saved: "Speicherung bestätigt", error: "Speicherung noch nicht bestätigt" }[saveStatus];
  const Icon = saveStatus === "saved" ? CheckCircle2 : saveStatus === "error" ? ShieldAlert : Clock3;
  return (
    <nav aria-label="Schritte der Patientenaufnahme" className="sticky top-20 z-30 rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-sm backdrop-blur sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><span className="text-muted-foreground">Aktueller Fall:</span> <strong className="font-mono">{pseudonymId.trim() || "noch nicht ausgewählt"}</strong></span>
        <span role="status" className={`flex items-center gap-1.5 ${saveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{caseReady ? status : "Zuerst eine gültige Fall-ID wählen"}</span>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PATIENT_INTAKE_STEPS.map(([id, title, detail], index) => (
          <li key={id}>
            <button type="button" onClick={() => onNavigate(id)} className={`h-full w-full rounded-xl border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${index === next ? "border-primary/50 bg-primary/10" : "border-border bg-background hover:bg-muted/60"}`}>
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{index + 1}</span>{title}</span>
              <span className="mt-1 hidden text-[11px] leading-snug text-muted-foreground sm:block">{detail}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ArrowRight className="h-3 w-3" /> Orientierung: {PATIENT_INTAKE_STEPS[next][1]}. Jeder Bereich bleibt direkt erreichbar.</p>
    </nav>
  );
}
