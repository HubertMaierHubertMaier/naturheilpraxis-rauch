const REDACTED = "[personenbezogene Angabe entfernt]";
const nameStopWords = new Set(["patient", "patientin", "mann", "frau", "männlich", "maennlich", "weiblich", "divers", "psa", "testosteron", "prostata", "karzinom", "diagnose", "befund"]);

const collectLikelyPersonNames = (value: string) => {
  const names = new Set<string>();
  const add = (candidate: string) => {
    const tokens = candidate.trim().split(/\s+/);
    if (tokens.length < 1 || tokens.length > 3 || tokens.some((token) => nameStopWords.has(token.toLowerCase()))) return;
    names.add(candidate.trim());
  };
  for (const match of value.matchAll(/\b(?:Name|Nachname|Vorname|Patientenname|Behandler(?:in)?|Arzt|Ärztin)\s*[:=-]\s*(?:(?:Dr|Prof)\.?[^\S\r\n]*)?([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|;|\n|$)/giu)) add(match[1]);
  for (const match of value.matchAll(/\b(?:Patient(?:in)?|Versicherte(?:r|n)?)\s*[:=-]\s*([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|[^\S\r\n]+(?:wohnhaft|geb\.?|Alter)\b|;|\n|$)/giu)) add(match[1]);
  for (const match of value.matchAll(/\b(?:Herrn?|Frau)[^\S\r\n]+(?:(?:Dr|Prof)\.?[^\S\r\n]*)?(?:med\.?[^\S\r\n]+)?([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|[^\S\r\n]+(?:wohnhaft|geb\.?|Alter)\b|$)/giu)) add(match[1]);
  for (const match of value.matchAll(/\b(?:Dr|Prof)\.?[^\S\r\n]+(?:med\.?[^\S\r\n]+)?([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|;|\n|$)/giu)) add(match[1]);
  for (const match of value.matchAll(/\b([A-ZÄÖÜ][\p{L}'-]+[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+)(?=,?[^\S\r\n]+(?:geb\.?|geboren|Geburtsdatum)\b)/giu)) add(match[1]);
  return Array.from(names);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const protectPseudonyms = (value: string) => {
  const pseudonyms: string[] = [];
  const text = value.replace(/\bP-\d{4}-\d{1,4}\b/gi, (match) => {
    const token = `__CLINICAL_PSEUDONYM_${pseudonyms.length}__`;
    pseudonyms.push(match.toUpperCase());
    return token;
  });
  return {
    text,
    restore: (result: string) => pseudonyms.reduce(
      (current, pseudonym, index) => current.split(`__CLINICAL_PSEUDONYM_${index}__`).join(pseudonym),
      result,
    ),
  };
};

export const deidentifyClinicalText = (value: unknown) => {
  const raw = String(value ?? "");
  const detectedNames = collectLikelyPersonNames(raw);
  const protectedValue = protectPseudonyms(raw);
  let redacted = protectedValue.text
    .replace(/===\s*(?:📄|📷)\s*[^=\n]+\s*===/gu, "=== Dokument ===")
    .replace(/^\s*\[Originaldatei[^\]\n]*\]\s*$/gimu, "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[E-Mail entfernt]")
    .replace(/\b(?:telefon(?:nummer)?|tel\.?|mobil|handy|fon|fax|rufnummer|rückrufnummer)\s*[:.]?\s*[+()\d][\d\s()/-]{5,}/gi, "[Kontaktdaten entfernt]")
    .replace(/(?:\+49|0049)\s*\(?\d{2,5}\)?(?:[\s/-]*\d){5,}\b/g, "[Kontaktdaten entfernt]")
    .replace(/(?<!\d)0\d{2,5}(?:[\s/-]\d{2,}){1,3}\b/g, "[Kontaktdaten entfernt]")
    .replace(/\b(?:geb(?:oren)?\.?\s*(?:am)?|geburtsdatum|geb\.?-?datum|geb\.?-?tag)\s*[:.]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gi, "[Geburtsdatum entfernt]")
    .replace(/\b(?:versicherten(?:nummer|-?nr\.?)?|kv-?nr\.?|krankenkassen-?nr\.?|patienten-?nr\.?|patienten-?id|fall-?nr\.?|aktenzeichen|mitgliedsnummer)\s*[:.]?\s*[A-Z0-9][A-Z0-9 ./-]{4,}/gi, "[Identifikationsnummer entfernt]")
    .replace(/\bIBAN\s*[:.]?\s*[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/gi, "[Bankverbindung entfernt]")
    .replace(/\b(?:QR-?Code|Barcode|Strichcode)\s*[:.]?\s*[^\n]{3,160}/gi, "[Code entfernt]")
    .replace(/\b(Name|Nachname|Vorname|Patientenname|Behandler(?:in)?|Arzt|Ärztin)\s*[:=-]\s*(?!__CLINICAL_PSEUDONYM_)(?:(?:Dr|Prof)\.?[^\S\r\n]*)?([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|;|\n|$)/giu, `$1: ${REDACTED}`)
    .replace(/\b(Patient(?:in)?|Versicherte(?:r|n)?)\s*[:=-]\s*(?!__CLINICAL_PSEUDONYM_)([A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2})(?=,|[^\S\r\n]+(?:wohnhaft|geb\.?|Alter)\b|;|\n|$)/giu, (match, label: string, candidate: string) => (
      candidate.split(/\s+/).some((token) => nameStopWords.has(token.toLowerCase())) ? match : `${label}: ${REDACTED}`
    ))
    .replace(/\b(Herrn?|Frau)[^\S\r\n]+(?:(?:Dr|Prof)\.?[^\S\r\n]*)?(?:med\.?[^\S\r\n]+)?[A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2}(?=,|[^\S\r\n]+(?:wohnhaft|geb\.?|Alter)\b|$)/giu, "$1 [Name entfernt]")
    .replace(/\b(?:[Dd][Rr]|[Pp][Rr][Oo][Ff])\.?[^\S\r\n]+(?:[Mm][Ee][Dd]\.?[^\S\r\n]+)?(?:[A-ZÄÖÜ]\.[^\S\r\n]+){0,3}[A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2}/gu, "[Name entfernt]")
    .replace(/\b[A-ZÄÖÜ][\p{L}'-]+[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+(?=,?[^\S\r\n]+(?:geb\.?|geboren|Geburtsdatum)\b)/giu, "[Name entfernt]")
    .replace(/((?:Name|Nachname|Vorname|Patientenname|Patient(?:in)?|Versicherte(?:r|n)?|Behandler(?:in)?|Arzt|Ärztin)\s*:?\s*<\/(?:td|th|dt|span|strong|label)>\s*<(?:td|th|dd|span|div|p)[^>]*>)(?!\s*__CLINICAL_PSEUDONYM_)\s*[^<]{2,100}/giu, `$1${REDACTED}`)
    .replace(/((?:Name|Nachname|Vorname|Patientenname|Patient(?:in)?|Versicherte(?:r|n)?|Behandler(?:in)?|Arzt|Ärztin)\s*:?\s*<\/(?:strong|span|label)>)(?!\s*__CLINICAL_PSEUDONYM_)\s*[^<]{2,100}(?=<\/(?:p|div|td|dd)>)/giu, `$1 ${REDACTED}`)
    .replace(/((?:Name|Nachname|Vorname|Patientenname|Patient(?:in)?|Versicherte(?:r|n)?|Behandler(?:in)?|Arzt|Ärztin)\s*:?\s*)(?![\s\S]{0,100}__CLINICAL_PSEUDONYM_)(?:<[^>]+>\s*)+[\s\S]{2,100}?(?=<\/(?:p|div|td|dd)>)/giu, `$1${REDACTED}`)
    .replace(/((?:Geburtsdatum|geb\.?|geboren|Telefon|Telefonnummer|Tel\.?|Mobil|E-Mail|Versicherten-?Nr\.?)\s*:?\s*<\/(?:td|th|dt|span|strong|label)>\s*<(?:td|th|dd|span|div|p)[^>]*>)(?!\s*__CLINICAL_PSEUDONYM_)\s*[^<]{2,120}/giu, `$1${REDACTED}`)
    .replace(/\bwohnhaft\s+[^,.;\n]{2,100},?\s*\d{5}\s+[\p{L}][\p{L}\s.'-]{1,60}(?=,|;|\.|$)/giu, "wohnhaft [Anschrift entfernt]")
    .replace(/\b[\p{L}][\p{L}\s.'-]{1,50}(?:stra(?:ß|ss)e|str\.|weg|platz|allee|gasse|ring|damm)\s+\d+[a-z]?\b(?:\s*,?\s*\d{5}\s+[\p{L}][\p{L}\s.'-]{1,50})?/giu, "[Anschrift entfernt]")
    .replace(/\b\d{5}\s+[A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+){0,2}\b/gu, "[Ort entfernt]")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  for (const name of detectedNames) redacted = redacted.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "giu"), "[Name entfernt]");
  return protectedValue.restore(redacted).trim();
};

const normalizedSensitiveKeys = new Set([
  "vorname", "firstname", "nachname", "lastname", "patientenname", "patientname",
  "geburtsdatum", "birthdate", "dateofbirth", "dob", "adresse", "address", "anschrift",
  "strasse", "straße", "street", "plz", "postleitzahl", "postalcode", "ort", "city",
  "telefon", "phone", "phonenumber", "mobil", "mobile", "email", "emailaddress",
  "versichertennummer", "insurancenumber", "insuranceid", "patientenid", "patientid",
  "fallnummer", "casenumber", "qrcode", "barcode", "strichcode",
]);
const sourceObjectKeys = /^(?:quelle|source|label|key|filename|file_name|dateiname|archivePath)$/i;
const documentContainerKeys = /^(?:files|documents|document_inventory|documentInventory|uploads)$/i;

export const deidentifyClinicalData = (value: unknown, key = "", parentKey = ""): unknown => {
  const normalizedKey = key.replace(/[^a-z0-9äöüß]/gi, "").toLowerCase();
  if (normalizedSensitiveKeys.has(normalizedKey)) return REDACTED;
  if (normalizedKey === "name" && documentContainerKeys.test(parentKey)) return "Dokument";
  if (typeof value === "string") {
    if (sourceObjectKeys.test(key) && /\.(?:pdf|jpe?g|png|docx?|txt)\b/i.test(value)) return "Dokument";
    return deidentifyClinicalText(value);
  }
  if (Array.isArray(value)) return value.map((entry) => deidentifyClinicalData(entry, "", key || parentKey));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entry]) => [
    entryKey,
    deidentifyClinicalData(entry, entryKey, key || parentKey),
  ]));
};

export const directIdentifierCategories = (value: unknown) => {
  const text = String(value ?? "");
  const categories = new Set<string>();
  const checks: Array<[string, RegExp]> = [
    ["Name", /(?:Name|Nachname|Vorname|Patientenname|Patient(?:in)?|Versicherte(?:r|n)?|Behandler(?:in)?|Arzt|Ärztin)\s*:?\s*<\/(?:td|th|dt|span|strong|label)>\s*(?:<(?:td|th|dd|span|div|p)[^>]*>)?(?!\s*P-\d{4}-\d{1,4})\s*[^<]{2,100}/iu],
    ["Anschrift", /\b[\p{L}][\p{L}\s.'-]{1,50}(?:stra(?:ß|ss)e|str\.|weg|platz|allee|gasse|ring|damm)\s+\d+[a-z]?|\b\d{5}\s+[A-ZÄÖÜ][\p{L}'-]+/iu],
    ["Geburtsdatum", /\b(?:geb(?:oren)?\.?|geburtsdatum|geb\.?-?datum|geb\.?-?tag)\s*[:.]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/iu],
    ["Kontaktdaten", /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:telefon(?:nummer)?|tel\.?|mobil|handy|fon|fax|rufnummer|rückrufnummer)\s*[:.]?\s*[+()\d][\d\s()/-]{5,}|(?:\+49|0049)\s*\(?\d{2,5}\)?(?:[\s/-]*\d){5,}\b|(?<!\d)0\d{2,5}(?:[\s/-]\d{2,}){1,3}\b/iu],
    ["Name", /\b(?:Dr|Prof)\.?[^\S\r\n]+(?:med\.?[^\S\r\n]+)?(?:[A-ZÄÖÜ]\.[^\S\r\n]+){0,3}[A-ZÄÖÜ][\p{L}'-]+|\b[A-ZÄÖÜ][\p{L}'-]+[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+(?=,?[^\S\r\n]+(?:geb\.?|geboren|Geburtsdatum)\b)/iu],
    ["Name", /\b(?:Patient(?:in)?|Versicherte(?:r|n)?)\s*[:=-](?!\s*(?:P-\d{4}-\d{1,4}|Männlich\b|Maennlich\b|Weiblich\b|Divers\b|\[personenbezogene Angabe entfernt\]|<))/iu],
    ["Identifikationsnummer", /\b(?:versicherten(?:nummer|-?nr\.?)?|kv-?nr\.?|patienten-?nr\.?|patienten-?id|fall-?nr\.?)\s*[:.]?\s*[A-Z0-9][A-Z0-9 ./-]{4,}/iu],
  ];
  if (collectLikelyPersonNames(text).length) categories.add("Name");
  for (const [category, pattern] of checks) if (pattern.test(text)) categories.add(category);
  return Array.from(categories);
};

export const redactEvidenceQuote = deidentifyClinicalText;
