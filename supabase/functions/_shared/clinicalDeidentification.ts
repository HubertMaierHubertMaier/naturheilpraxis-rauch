const REDACTED = "[personenbezogene Angabe entfernt]";
const nameStopWords = new Set(["patient", "patientin", "mann", "frau", "männlich", "maennlich", "weiblich", "divers", "psa", "testosteron", "prostata", "karzinom", "diagnose", "befund"]);
const ocrNameLabel = String.raw`(?:N(?:a|ä)me|Narne|Vorname|Vornarne|Nachname|Nachnarne|Patientenname|Patient(?:in)?|Patlent(?:in)?|Versicherte(?:r|n)?|Behandler(?:in)?|Arzt|Ärztin)`;
const personNamePart = String.raw`[A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+){0,2}`;
const personNameValue = String.raw`(?:${personNamePart}\s*,\s*[A-ZÄÖÜ][\p{L}'-]+(?:[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+)?|${personNamePart})`;
const nameValueBoundary = String.raw`(?=,|;|\||\n|$|[^\S\r\n]+(?:wohnhaft|geb\.?|geboren|Alter|Anschrift|Adresse)\b)`;
const addressFieldLabel = String.raw`(?:Anschrift|Anschrlft|Adresse|Stra(?:ß|ss|B)e|PLZ(?:[^\S\r\n]*(?:[-/]?[^\S\r\n]*Ort))?|Postleitzahl|Ort|Praxisadresse|Laboradresse)`;
const organizationFieldLabel = String.raw`(?:Praxisname|Laborname|Klinikname|Institutsname|Einrichtungsname|Arztpraxis|Behandlerpraxis|Einsender(?:praxis)?|Absender|Überweisende[^\S\r\n]+Praxis|Ueberweisende[^\S\r\n]+Praxis|(?:Praxis|Labor|Klinik|MVZ|Institut)(?=[^\S\r\n]*(?::|=|-)))`;
const signatureFieldLabel = String.raw`(?:Unterschrift|Signatur|Stempel|Arztunterschrift|Praxisstempel|Arztstempel|Laborstempel)`;
const providerIdentifierFieldLabel = String.raw`(?:LANR|BSNR|Lebenslange[^\S\r\n]+Arztnummer|Arzt(?:nummer|-?Nr\.?)|Betriebsst(?:ä|ae)tten(?:nummer|-?Nr\.?)|IK(?:-?(?:Nummer|Nr\.?))?|Institutionskennzeichen|(?:Labor|Praxis|Einrichtungs|Absender|Leistungserbringer)-?(?:ID|Nummer|Nr\.?))`;
const clinicalUnit = String.raw`(?:%|(?:f|p|n|µ|u|m|c|d|k)?g(?:\/(?:dl|ml|l))?|(?:f|p|n|µ|u|m|k)?mol\/(?:ml|l)|mEq\/l|mmol\/mol|(?:m|µ|u)?IU\/(?:ml|l)|I\.?E\.?\/(?:ml|l)|(?:f|p|n|µ|u|m|k)?[UGT]\/(?:ml|l)|ml\/min(?:\/1[,.]73m(?:2|²))?|l\/min|mmHg|mOsm\/kg|(?:µ|u)?kat\/l)`;
const clinicalMeasurementPattern = new RegExp(
  String.raw`\b[\p{L}][\p{L}\p{N}().+%/-]*[^\S\r\n]+[<>]?=?[^\S\r\n]*\d+(?:[.,]\d+)?[^\S\r\n]*${clinicalUnit}(?=$|[\s,;|)])`,
  "giu",
);
const explicitNameFieldPattern = new RegExp(String.raw`^(\s*)(${ocrNameLabel})\s*(?::|=|-)?\s+(.+?)\s*$`, "iu");
const explicitAddressFieldPattern = new RegExp(String.raw`^(\s*)(${addressFieldLabel})\s*(?::|=|-)?\s+(.+?)\s*$`, "iu");
const explicitSensitiveMetadataFields: Array<[string, RegExp]> = [
  ["Einrichtung", new RegExp(String.raw`^(\s*)(${organizationFieldLabel})\s*(?::|=|-)?\s+(.+?)\s*$`, "iu")],
  ["Unterschrift/Stempel", new RegExp(String.raw`^(\s*)(${signatureFieldLabel})\s*(?::|=|-)?\s+(.+?)\s*$`, "iu")],
  ["Leistungserbringer-Kennung", new RegExp(String.raw`^(\s*)(${providerIdentifierFieldLabel})\s*(?::|=|-)?\s+(.+?)\s*$`, "iu")],
];
const reportColumnHeaderPattern = /^Name(?:[\s|;,-]+(?:Messwert|Wert|Ergebnis|Einheit|Referenz(?:bereich)?|Norm(?:bereich)?|Status|Bewertung|Hinweis|Beschreibung|Bedeutung|Optimalbereich|Istwert|Sollwert)){3,}[\s|;,-]*$/iu;

const isReportColumnHeader = (line: string) => reportColumnHeaderPattern.test(line.trim());

const findClinicalMeasurementStart = (line: string, fromIndex = 0) => {
  clinicalMeasurementPattern.lastIndex = fromIndex;
  return clinicalMeasurementPattern.exec(line)?.index;
};

const matchSensitiveMetadataField = (line: string) => {
  for (const [category, pattern] of explicitSensitiveMetadataFields) {
    const match = pattern.exec(line);
    if (match) return { category, match };
  }
  return undefined;
};

const sanitizeExplicitSensitiveMetadataLine = (line: string) => {
  const matched = matchSensitiveMetadataField(line);
  if (!matched) return undefined;

  const [, indentation, label, rawValue] = matched.match;
  const marker = /^\[(?:personenbezogene Angabe|Einrichtung|Unterschrift|Stempel|Kennung) entfernt\]/iu.exec(rawValue);
  const valueStart = line.indexOf(rawValue);
  const measurementStart = findClinicalMeasurementStart(line, valueStart);
  const residualEnd = measurementStart ?? line.length;
  if (marker && !/[\p{L}\p{N}]/u.test(line.slice(valueStart + marker[0].length, residualEnd))) return line;

  const clinicalSuffix = measurementStart === undefined ? "" : ` ${line.slice(measurementStart).trim()}`;
  return `${indentation}${label}: ${REDACTED}${clinicalSuffix}`;
};

const unredactedSensitiveMetadataCategory = (line: string) => {
  const matched = matchSensitiveMetadataField(line);
  if (!matched) return undefined;

  const rawValue = matched.match[3];
  const marker = /^\[(?:personenbezogene Angabe|Einrichtung|Unterschrift|Stempel|Kennung) entfernt\]/iu.exec(rawValue);
  if (!marker) return matched.category;
  const measurementStart = findClinicalMeasurementStart(rawValue, marker[0].length);
  const residualPrefix = rawValue.slice(marker[0].length, measurementStart ?? rawValue.length);
  return /[\p{L}\p{N}]/u.test(residualPrefix) ? matched.category : undefined;
};

const clinicalMeasurementRanges = (line: string) => Array.from(line.matchAll(
  new RegExp(clinicalMeasurementPattern.source, clinicalMeasurementPattern.flags),
)).map((match) => ({ start: match.index, end: match.index + match[0].length }));

const barePostalCityPattern = () => /\b\d{5}[^\S\r\n]*\p{Lu}[\p{L}'-]+(?:[^\S\r\n]+\p{Lu}[\p{L}'-]+){0,2}(?=$|[^\S\r\n]|[,;.])/gu;

const hasBarePostalCity = (line: string) => {
  const measurementRanges = clinicalMeasurementRanges(line);
  return Array.from(line.matchAll(barePostalCityPattern())).some((match) => {
    const start = match.index;
    const end = start + match[0].length;
    return !measurementRanges.some((range) => range.start <= start && range.end >= end);
  });
};

const redactBarePostalCities = (value: string) => value
  .split("\n")
  .map((line) => {
    const measurementRanges = clinicalMeasurementRanges(line);
    return line.replace(barePostalCityPattern(), (match, offset: number) => {
      const end = offset + match.length;
      const containingMeasurement = measurementRanges.find((range) => range.start <= offset && range.end >= end);
      if (containingMeasurement) return match;

      const overlappingMeasurement = measurementRanges.find((range) => range.start < end && range.end > offset);
      if (overlappingMeasurement && overlappingMeasurement.start > offset) {
        return `[Ort entfernt] ${match.slice(overlappingMeasurement.start - offset)}`;
      }
      return "[Ort entfernt]";
    });
  })
  .join("\n");

const sanitizeExplicitIdentifierLine = (line: string) => {
  const nameMatch = explicitNameFieldPattern.exec(line);
  const addressMatch = explicitAddressFieldPattern.exec(line);
  const match = nameMatch || addressMatch;
  if (!match) return undefined;

  const [, indentation, label, rawValue] = match;
  if (/^(?:P-\d{4}-\d{1,4}|Männlich\b|Maennlich\b|Weiblich\b|Divers\b)/iu.test(rawValue)) return line;
  const valueStart = line.indexOf(rawValue);
  const measurementStart = findClinicalMeasurementStart(line, valueStart);
  if (measurementStart !== undefined) {
    let clinicalStart = measurementStart;
    if (nameMatch) {
      const beforeMeasurement = line.slice(valueStart, measurementStart);
      const context = /\b(?:Prostata|Karzinom|Diagnose|Befund|Therapie|Status|Anamnese)\b/iu.exec(beforeMeasurement);
      if (context?.index !== undefined) clinicalStart = valueStart + context.index;
    }
    const clinicalSuffix = line.slice(clinicalStart).trim();
    return `${indentation}${label}: ${REDACTED} ${clinicalSuffix}`;
  }

  if (nameMatch) {
    if (/^\[(?:personenbezogene Angabe|Name) entfernt\]/iu.test(rawValue)) return `${indentation}${label}: ${REDACTED}`;
    const tokens = rawValue.split(/[\s,]+/).filter(Boolean);
    if (/\d/.test(rawValue) || tokens.length > 4) return line;
  } else if (/\d/.test(rawValue)) {
    const plainAddress = /^(?:(?:(?:Am|An[^\S\r\n]+der|Auf[^\S\r\n]+dem)[^\S\r\n]+[\p{L}][\p{L}\t .'-]*|[\p{L}][\p{L}\t .'-]*(?:stra(?:ß|ss|b)e|str\.|weg|platz|allee|gasse|ring|damm))[^\S\r\n]*\d+[a-z]?|\d{5}(?:[^\S\r\n]*[\p{L}][\p{L}\t .'-]*)?)$/iu;
    if (!plainAddress.test(rawValue)) return line;
  }
  return `${indentation}${label}: ${REDACTED}`;
};

const hasNameLikeResidualPrefix = (value: string) => /[\p{L}\p{N}]/u.test(value
  .replace(/\[[^\]\n]*entfernt\]/giu, "")
  .replace(/\b(?:Prostata|Karzinom|Diagnose|Befund|Therapie|Status|Anamnese|wohnhaft|geb\.?|geboren|Alter)\b/giu, ""));

const hasUnredactedExplicitNameField = (line: string) => {
  const match = explicitNameFieldPattern.exec(line);
  if (!match || /^(?:P-\d{4}-\d{1,4}|Männlich\b|Maennlich\b|Weiblich\b|Divers\b)/iu.test(match[3])) return false;
  const marker = /^\[(?:personenbezogene Angabe|Name) entfernt\]/iu.exec(match[3]);
  if (!marker) return true;
  const measurementStart = findClinicalMeasurementStart(match[3], marker[0].length);
  const residualPrefix = match[3].slice(marker[0].length, measurementStart ?? match[3].length);
  return hasNameLikeResidualPrefix(residualPrefix);
};

const hasUnredactedExplicitAddressField = (line: string) => {
  const match = explicitAddressFieldPattern.exec(line);
  if (!match) return false;
  const marker = /^\[(?:personenbezogene Angabe|Anschrift|Ort) entfernt\]/iu.exec(match[3]);
  if (!marker) return true;
  const measurementStart = findClinicalMeasurementStart(match[3], marker[0].length);
  const residualPrefix = match[3].slice(marker[0].length, measurementStart ?? match[3].length);
  return /[\p{L}\p{N}]/u.test(residualPrefix);
};

const collectLikelyPersonNames = (value: string) => {
  const names = new Set<string>();
  const add = (candidate: string) => {
    const tokens = candidate.trim().split(/\s+/);
    if (tokens.length < 1 || tokens.length > 3 || tokens.some((token) => nameStopWords.has(token.toLowerCase()))) return;
    names.add(candidate.trim());
  };
  for (const match of value.matchAll(new RegExp(
    String.raw`\b${ocrNameLabel}\s*(?::|=|-)?\s+((?:(?:Dr|Prof)\.?[^\S\r\n]*)?${personNameValue})${nameValueBoundary}`,
    "giu",
  ))) add(match[1].replace(/^(?:(?:Dr|Prof)\.?\s*)/iu, ""));
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
  const safeDocumentMarkers: string[] = [];
  const markerProtected = protectedValue.text.replace(/===\s*(?:📄|📷)\s*Dokument-[a-f0-9]{12}\s*\(\d+\s*S\.?\)\s*===/giu, (match) => {
    const token = `__CLINICAL_DOCUMENT_MARKER_${safeDocumentMarkers.length}__`;
    safeDocumentMarkers.push(match);
    return token;
  });
  const safeColumnHeaders: string[] = [];
  const headerProtected = markerProtected.replace(/^.*$/gmu, (line) => {
    if (!isReportColumnHeader(line)) return line;
    const token = `__CLINICAL_COLUMN_HEADER_${safeColumnHeaders.length}__`;
    safeColumnHeaders.push(line);
    return token;
  });
  let redacted = headerProtected
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
    .replace(new RegExp(
      String.raw`\b(${ocrNameLabel})\s*(?::|=|-)?\s+(?!__CLINICAL_PSEUDONYM_)((?:(?:Dr|Prof)\.?[^\S\r\n]*)?${personNameValue})${nameValueBoundary}`,
      "giu",
    ), (match, label: string, candidate: string) => (
      candidate.split(/[\s,]+/).some((token) => nameStopWords.has(token.toLowerCase()))
        ? match
        : `${label}: ${REDACTED}`
    ))
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
    .replace(/\bwohnhaft[^\S\r\n]+[^,.;\n]{2,100},?[^\S\r\n]*\d{5}[^\S\r\n]+[\p{L}][\p{L}\t .'-]{1,60}(?=,|;|\.|$)/giu, "wohnhaft [Anschrift entfernt]")
    .replace(/\b[\p{L}][\p{L}\t .'-]{1,50}(?:stra(?:ß|ss|b)e|str\.|weg|platz|allee|gasse|ring|damm)[^\S\r\n]*\d+[a-z]?\b(?:[^\S\r\n]*,?[^\S\r\n]*\d{5}[^\S\r\n]*[\p{L}][\p{L}\t .'-]{1,50})?/giu, "[Anschrift entfernt]")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  redacted = redacted.split("\n").map((line) => sanitizeExplicitSensitiveMetadataLine(line) ?? line).join("\n");
  redacted = redactBarePostalCities(redacted);
  for (const name of detectedNames) redacted = redacted.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "giu"), "[Name entfernt]");
  const restoredPseudonyms = protectedValue.restore(redacted);
  const restoredDocumentMarkers = safeDocumentMarkers.reduce(
    (current, marker, index) => current.split(`__CLINICAL_DOCUMENT_MARKER_${index}__`).join(marker),
    restoredPseudonyms,
  );
  return safeColumnHeaders.reduce(
    (current, header, index) => current.split(`__CLINICAL_COLUMN_HEADER_${index}__`).join(header),
    restoredDocumentMarkers,
  ).trim();
};

const normalizedSensitiveKeys = new Set([
  "vorname", "firstname", "nachname", "lastname", "patientenname", "patientname",
  "geburtsdatum", "birthdate", "dateofbirth", "dob", "adresse", "address", "anschrift",
  "strasse", "straße", "street", "plz", "postleitzahl", "postalcode", "ort", "city",
  "telefon", "phone", "phonenumber", "mobil", "mobile", "email", "emailaddress",
  "versichertennummer", "insurancenumber", "insuranceid", "patientenid", "patientid",
  "fallnummer", "casenumber", "qrcode", "barcode", "strichcode",
  "arztname", "doctorname", "physicianname", "behandlername", "praxisname", "practicename",
  "laborname", "labname", "laboratoryname", "klinikname", "clinicname", "institutsname",
  "institutionname", "einrichtungsname", "facilityname", "providername", "einsender",
  "einsendername", "sendername", "absender", "absendername", "unterschrift", "signature",
  "signatur", "stempel", "stamp", "lanr", "bsnr", "arztnummer", "providernumber",
  "providerid", "betriebsstättennummer", "betriebsstaettennummer", "facilityid",
  "institutionskennzeichen", "iknummer", "laborid", "labid", "praxisid", "practiceid",
]);
const sourceObjectKeys = /^(?:quelle|source|label|key|filename|file_name|dateiname|archivePath)$/i;
const documentContainerKeys = /^(?:files|documents|document_inventory|documentInventory|uploads)$/i;
const providerContainerKeys = /^(?:provider|doctor|physician|behandler|practice|praxis|laboratory|labor|clinic|klinik|facility|einrichtung|sender|submitter|einsender|absender)$/i;

export const deidentifyClinicalData = (value: unknown, key = "", parentKey = ""): unknown => {
  const normalizedKey = key.replace(/[^a-z0-9äöüß]/gi, "").toLowerCase();
  if (normalizedSensitiveKeys.has(normalizedKey)) return REDACTED;
  if (normalizedKey === "name" && documentContainerKeys.test(parentKey)) return "Dokument";
  if (normalizedKey === "name" && providerContainerKeys.test(parentKey)) return REDACTED;
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
    ["Anschrift", /\b[\p{L}][\p{L}\t .'-]{1,50}(?:stra(?:ß|ss|b)e|str\.|weg|platz|allee|gasse|ring|damm)[^\S\r\n]*\d+[a-z]?/iu],
    ["Geburtsdatum", /\b(?:geb(?:oren)?\.?|geburtsdatum|geb\.?-?datum|geb\.?-?tag)\s*[:.]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/iu],
    ["Kontaktdaten", /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:telefon(?:nummer)?|tel\.?|mobil|handy|fon|fax|rufnummer|rückrufnummer)\s*[:.]?\s*[+()\d][\d\s()/-]{5,}|(?:\+49|0049)\s*\(?\d{2,5}\)?(?:[\s/-]*\d){5,}\b|(?<!\d)0\d{2,5}(?:[\s/-]\d{2,}){1,3}\b/iu],
    ["Name", /\b(?:Dr|Prof)\.?[^\S\r\n]+(?:med\.?[^\S\r\n]+)?(?:[A-ZÄÖÜ]\.[^\S\r\n]+){0,3}[A-ZÄÖÜ][\p{L}'-]+|\b[A-ZÄÖÜ][\p{L}'-]+[^\S\r\n]+[A-ZÄÖÜ][\p{L}'-]+(?=,?[^\S\r\n]+(?:geb\.?|geboren|Geburtsdatum)\b)/iu],
    ["Name", /\b(?:Patient(?:in)?|Versicherte(?:r|n)?)\s*[:=-](?!\s*(?:P-\d{4}-\d{1,4}|Männlich\b|Maennlich\b|Weiblich\b|Divers\b|\[personenbezogene Angabe entfernt\]|<))/iu],
    ["Name", new RegExp(String.raw`\b${ocrNameLabel}\s*(?::|=|-)?\s+(?!P-\d{4}-\d{1,4}\b|Männlich\b|Maennlich\b|Weiblich\b|Divers\b|\[personenbezogene Angabe entfernt\])(?:(?:Dr|Prof)\.?[^\S\r\n]*)?${personNameValue}${nameValueBoundary}`, "iu")],
    ["Identifikationsnummer", /\b(?:versicherten(?:nummer|-?nr\.?)?|kv-?nr\.?|patienten-?nr\.?|patienten-?id|fall-?nr\.?)\s*[:.]?\s*(?!P-\d{4}-\d{1,4}\b)[A-Z0-9][A-Z0-9 ./-]{4,}/iu],
    ["Bankverbindung", /\bIBAN\s*[:.]?\s*[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/iu],
    ["Code", /\b(?:QR-?Code|Barcode|Strichcode)\s*[:.]?\s*[^\n]{3,160}/iu],
  ];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const identifierText = lines.filter((line) => !isReportColumnHeader(line)).join("\n");
  if (collectLikelyPersonNames(identifierText).length) categories.add("Name");
  for (const [category, pattern] of checks) if (pattern.test(identifierText)) categories.add(category);
  for (const line of lines) {
    const category = unredactedSensitiveMetadataCategory(line);
    if (category) categories.add(category);
  }
  if (lines.some((line) => !isReportColumnHeader(line) && hasUnredactedExplicitNameField(line))) categories.add("Name");
  if (lines.some(hasUnredactedExplicitAddressField)) categories.add("Anschrift");
  if (lines.some(hasBarePostalCity)) categories.add("Anschrift");
  return Array.from(categories);
};

export const removeResidualDirectIdentifierLines = (value: unknown) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .map((line) => {
    if (isReportColumnHeader(line)) return line;
    if (!directIdentifierCategories(line).length) return line;

    const retried = deidentifyClinicalText(line);
    if (!directIdentifierCategories(retried).length) return retried;

    const sanitized = sanitizeExplicitIdentifierLine(line);
    if (sanitized !== undefined) {
      const fullySanitized = deidentifyClinicalText(sanitized);
      if (!directIdentifierCategories(fullySanitized).length) return fullySanitized;
    }

    // Keep unresolved content so the caller's mandatory residual check fails closed.
    return retried;
  })
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

export const redactEvidenceQuote = deidentifyClinicalText;
