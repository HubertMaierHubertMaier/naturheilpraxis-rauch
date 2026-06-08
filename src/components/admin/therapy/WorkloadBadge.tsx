// Schätzt Lese-/Auswertungsaufwand für medizinische Befunde (oft fremdsprachig)
// und rechnet ihn in Honorar bei 100 €/h um.
//
// Annahmen (konservativ, für Fach-Befunde mit Diagnostik & Differentialdiagnostik):
//   • 2 500 Zeichen ≈ 1 Druckseite A4
//   • 8 min/Seite (Lesen + medizinische Bewertung, EN/FR-Fremdsprachen-Aufschlag inkludiert)
//     → ca. 7,5 Seiten/Stunde
//   • Stundensatz 100 €
//
// Die Werte sind als Anhaltspunkt für die Aufwandsabschätzung gegenüber dem Patienten gedacht
// (Honorarbasis, Zeitplanung). Konkrete Zeit kann je nach Komplexität abweichen.

import { Clock, FileText, Euro } from "lucide-react";

export const CHARS_PER_PAGE = 2500;
export const MIN_PER_PAGE = 8;
export const HOURLY_RATE_EUR = 100;

export function estimateWorkload(chars: number) {
  const pages = chars / CHARS_PER_PAGE;
  const hours = (pages * MIN_PER_PAGE) / 60;
  const euro = hours * HOURLY_RATE_EUR;
  return { pages, hours, euro };
}

const fmtHours = (h: number) =>
  h < 1
    ? `${Math.max(1, Math.round(h * 60))} min`
    : h < 10
      ? `${h.toFixed(1).replace(".", ",")} h`
      : `${Math.round(h)} h`;

const fmtEuro = (e: number) =>
  e.toLocaleString("de-DE", { maximumFractionDigits: 0 });

interface Props {
  chars: number;
  /** Zusätzlicher Hinweis-Text im Tooltip (z.B. "Fremdsprachen-Aufschlag inkl.") */
  hint?: string;
  /** kompakter Modus (nur Zahlen, kleinere Schrift) */
  compact?: boolean;
  className?: string;
}

export function WorkloadBadge({ chars, hint, compact, className }: Props) {
  if (chars <= 0) return null;
  const { pages, hours, euro } = estimateWorkload(chars);
  const tooltip = [
    `${chars.toLocaleString("de-DE")} Zeichen`,
    `≈ ${pages.toFixed(1).replace(".", ",")} Seiten (à ${CHARS_PER_PAGE} Zeichen)`,
    `Lese-/Auswertungsaufwand: ${MIN_PER_PAGE} min/Seite (Fach-Befund, ggf. Fremdsprache)`,
    `→ ${fmtHours(hours)} bei ${HOURLY_RATE_EUR} €/h = ${fmtEuro(euro)} €`,
    hint ? `\n${hint}` : "",
  ].filter(Boolean).join("\n");

  const size = compact ? "text-[10px]" : "text-[11px]";

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono ${size} ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-0.5" title="Seitenzahl">
        <FileText className="h-3 w-3 opacity-70" />
        {pages < 10 ? pages.toFixed(1).replace(".", ",") : Math.round(pages)} S.
      </span>
      <span className="opacity-40">·</span>
      <span className="inline-flex items-center gap-0.5" title="geschätzter Aufwand">
        <Clock className="h-3 w-3 opacity-70" />
        {fmtHours(hours)}
      </span>
      <span className="opacity-40">·</span>
      <span className="inline-flex items-center gap-0.5 font-semibold text-foreground" title="Honorar à 100 €/h">
        <Euro className="h-3 w-3 opacity-70" />
        {fmtEuro(euro)}
      </span>
    </span>
  );
}

/**
 * Großer Total-Block für mehrere Felder gleichzeitig (z.B. ganzer Patienten-Kontext).
 */
export function WorkloadTotal({ chars, label = "Gesamter Sichtungs-/Auswertungsaufwand" }: { chars: number; label?: string }) {
  if (chars <= 0) return null;
  const { pages, hours, euro } = estimateWorkload(chars);
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 font-medium">
        <Clock className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="flex items-center gap-3 ml-auto font-mono text-[13px]">
        <span title="Zeichen total">{chars.toLocaleString("de-DE")} Z.</span>
        <span className="opacity-40">·</span>
        <span title="Seitenzahl à 2500 Zeichen">≈ {pages < 10 ? pages.toFixed(1).replace(".", ",") : Math.round(pages)} Seiten</span>
        <span className="opacity-40">·</span>
        <span title={`${MIN_PER_PAGE} min/Seite (Fach-Befund inkl. Fremdsprache)`}>⏱ {fmtHours(hours)}</span>
        <span className="opacity-40">·</span>
        <span className="font-semibold text-primary" title="Honorar à 100 €/h">💶 {fmtEuro(euro)} €</span>
      </div>
    </div>
  );
}
