import { escapeIAAFormMarkers } from "./iaaAssessment";
import { medicationFormValuesText } from "./anamnesisMedicationForm";

type ProfileWidget = { fieldName?: unknown; fieldType?: unknown; fieldValue?: unknown; checkBox?: boolean; exportValue?: unknown };
const profileLabels: Record<string, string> = {
  intro_freitext_anlass: "Anliegen / Beschwerden",
  beschwerden_hauptbeschwerde: "Hauptbeschwerde",
  soziales_kinderAnzahl: "Kinderzahl",
  soziales_kinderAlter: "Alter der Kinder",
  frauen_menopause_seit: "Menopause seit",
  frauen_menopause_details: "Menopause Beschwerden / Angaben",
};

/** Supplement OCR with exact clinical profile controls from the current original form.
 * Unknown controls (including identity/contact controls) are not copied by this mapper.
 * The assembled document still goes through the normal deidentification and review.
 */
export function anamnesisProfileFormValuesText(widgets: ProfileWidget[], pageNumber: number): string {
  const lines: string[] = [];
  for (const widget of widgets) {
    if (typeof widget.fieldName !== "string") continue;
    let label = Object.prototype.hasOwnProperty.call(profileLabels, widget.fieldName) ? profileLabels[widget.fieldName] : "";
    let value = "";
    if (label && widget.fieldType === "Tx" && typeof widget.fieldValue === "string") value = widget.fieldValue.trim();
    if (/^frauen_menopause_(?:ja|nein)$/.test(widget.fieldName) && widget.fieldType === "Btn" && widget.checkBox === true
      && typeof widget.exportValue === "string" && widget.exportValue !== "Off" && widget.fieldValue === widget.exportValue) {
      label = "Menopause";
      value = widget.fieldName.endsWith("_ja") ? "Ja" : "Nein";
    }
    if (!label || !value) continue;
    const safeValue = escapeIAAFormMarkers(value).replace(/[\r\n]+/g, " ");
    lines.push(`${label} (elektronisches Formularfeld, Seite ${pageNumber}): ${safeValue}`);
  }
  const medicationText = medicationFormValuesText(widgets, pageNumber);
  return [...lines, medicationText].filter(Boolean).join("\n");
}
