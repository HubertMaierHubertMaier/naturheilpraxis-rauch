import { escapeIAAFormMarkers } from "./iaaAssessment";

type MedicationWidget = { fieldName?: unknown; fieldType?: unknown; fieldValue?: unknown };
const fields = ["Name", "Dosierung", "tägl.", "pro_Woche", "Grund", "seit"] as const;
type MedicationField = typeof fields[number];
const questionPattern = /^Aktuelle Medikamente – Zeile ([1-9]\d*) \(elektronische Formularfelder, Seite ([1-9]\d*)\)$/;

/** Only the named current-medication controls of the original form are copied.
 * Conflicting duplicate controls and rows without names remain readable, but are
 * not interpreted as a complete medication. No frequency, unit or dose is inferred.
 */
export function medicationFormValuesText(widgets: MedicationWidget[], pageNumber: number): string {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Ungültige Formularseite");
  const rows = new Map<number, Map<MedicationField, Set<string>>>();
  for (const widget of widgets) {
    if (widget.fieldType !== "Tx" || typeof widget.fieldName !== "string" || typeof widget.fieldValue !== "string") continue;
    const match = /^aktuelleMedikamente_([1-9]\d*)_(Name|Dosierung|tägl\.|pro_Woche|Grund|seit)$/.exec(widget.fieldName);
    const value = escapeIAAFormMarkers(widget.fieldValue).replace(/[\r\n]+/g, " ").trim();
    if (!match || !value) continue;
    const number = Number(match[1]); if (!Number.isSafeInteger(number)) continue;
    const row = rows.get(number) || new Map<MedicationField, Set<string>>();
    const key = match[2] as MedicationField; const values = row.get(key) || new Set<string>();
    values.add(value); row.set(key, values); rows.set(number, row);
  }
  return [...rows].sort(([a], [b]) => a - b).map(([number, row]) => {
    const values = Object.fromEntries(fields.filter(key => row.has(key)).map(key => {
      const all = [...row.get(key)!]; return [key, all.length === 1 ? all[0] : all];
    }));
    return `Aktuelle Medikamente – Zeile ${number} (elektronische Formularfelder, Seite ${pageNumber}): ${JSON.stringify(values)}`;
  }).join("\n");
}

export function parseMedicationFormAnswer(question: string, answer: string): {
  recognized: boolean;
  medication?: { name: string; dosis: string; haeufigkeit: string; dauer: string; indikation: string; quelle: string; seite: string; zitat: string; status: string; polarity: "affirmed" };
} {
  const match = questionPattern.exec(question);
  if (!match) return { recognized: /^Aktuelle Medikamente – Zeile\b.*elektronische Formularfelder/.test(question) };
  let value: unknown;
  try { value = JSON.parse(answer); } catch { return { recognized: true }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { recognized: true };
  const row = value as Record<string, unknown>;
  // The native serializer emits compact JSON with unique keys. A duplicate key
  // must not silently replace an earlier dose/name during JSON.parse.
  if (JSON.stringify(row) !== answer.trim()) return { recognized: true };
  if (!Object.keys(row).length || Object.keys(row).some(key => !fields.includes(key as MedicationField) || typeof row[key] !== "string")
    || typeof row.Name !== "string" || !row.Name.trim() || /^(?:[-–—?]+|nein|keine(?:rlei)?(?:\s+Medikamente)?|unbekannt|unklar|unleserlich)$/i.test(row.Name.trim())) return { recognized: true };
  const text = (key: MedicationField) => typeof row[key] === "string" ? row[key].trim() : "";
  return { recognized: true, medication: {
    name: text("Name"), dosis: text("Dosierung"),
    haeufigkeit: [text("tägl.") ? `täglich: ${text("tägl.")}` : "", text("pro_Woche") ? `pro Woche: ${text("pro_Woche")}` : ""].filter(Boolean).join("; "),
    dauer: text("seit") ? `seit ${text("seit")}` : "", indikation: text("Grund"),
    quelle: `Anamnesebogen – ${question}`, seite: match[2], zitat: `Frage/Feld: ${question}\nErkannte Antwort: ${answer}`,
    status: "laufend", polarity: "affirmed",
  } };
}
