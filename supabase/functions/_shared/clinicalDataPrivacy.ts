import { deidentifyClinicalData, directIdentifierCategories } from "./clinicalDeidentification.ts";

const fieldProbe = "__CLINICAL_PRIVACY_FIELD_PROBE__";
const removedField = "[personenbezogene Angabe entfernt]";
const removedValue = /^\[(?:(?:personenbezogene Angabe|Name|Geburtsdatum|Anschrift|Ort|Kontaktdaten|E-Mail|Identifikationsnummer|Bankverbindung|Code) entfernt|geschwärzt)\]$/iu;

function fieldCategory(key: string): string {
  const normalized = key.replace(/[^a-z0-9äöüß]/gi, "").toLowerCase();
  if (/geburt|birth|^dob$/.test(normalized)) return "Geburtsdatum";
  if (/name/.test(normalized)) return "Name";
  if (/^(adresse|address|anschrift|strasse|straße|street|plz|postleitzahl|postalcode|ort|city)$/.test(normalized)) return "Anschrift";
  if (/telefon|phone|mobil|email/.test(normalized)) return "Kontaktdaten";
  return "Personenbezogenes Feld";
}

/**
 * Check clinical values rather than JSON wire syntax. JSON escaping destroys
 * line boundaries needed to distinguish measurement rows from addresses.
 * Explicit identity keys remain checked even when their value has no label.
 * This function only inspects data; it never changes or clears clinical text.
 */
export function clinicalDataIdentifierCategories(value: unknown): string[] {
  const categories = new Set<string>();
  const ancestors = new Set<object>();
  let visited = 0;
  const visit = (entry: unknown, key = "", parentKey = "", depth = 0): void => {
    if (depth > 64 || ++visited > 100000) {
      categories.add("Nicht prüfbare Datenstruktur");
      return;
    }
    if (entry === null || entry === undefined || entry === "") return;
    if (deidentifyClinicalData(fieldProbe, key, parentKey) === removedField
      && !(typeof entry === "string" && (!entry.trim() || removedValue.test(entry.trim())))) {
      categories.add(fieldCategory(key));
    }
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        // Decode only a complete JSON object/array; invalid or surrounding text
        // still goes through the ordinary text detector without being discarded.
        let parsed: unknown;
        try { parsed = JSON.parse(trimmed); } catch { /* Plain clinical text. */ }
        if (parsed && typeof parsed === "object") {
          visit(parsed, key, parentKey, depth + 1);
          return;
        }
      }
      directIdentifierCategories(entry).forEach(category => categories.add(category));
      return;
    }
    if (typeof entry !== "object") return;
    if (ancestors.has(entry)) {
      categories.add("Nicht prüfbare Datenstruktur");
      return;
    }
    ancestors.add(entry);
    if (Array.isArray(entry)) {
      entry.forEach(child => visit(child, "", key || parentKey, depth + 1));
    } else {
      for (const [childKey, child] of Object.entries(entry)) visit(child, childKey, key || parentKey, depth + 1);
    }
    ancestors.delete(entry);
  };
  visit(value);
  return Array.from(categories);
}
