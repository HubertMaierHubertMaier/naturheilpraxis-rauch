import { neutralAnalysisSourceLabel, normalizeAnalysisSourceId } from "./analysisSourceHistory";

type DisplaySource = { key: string; text: string; group: "kontext" | "befund" | "dokument" | "recherche" };

const sourceNames: Record<string, string> = {
  anamnese: "Anamnesebogen",
  arztbericht: "Arztbericht",
  laborKomplett: "Laborbefund",
  metatronHeel: "Metatron/Hospital-Analyse",
  sonstigeUntersuchungen: "Sonstige Untersuchung",
  vievaPlus: "Vieva-Plus-Analyse",
};

const approvedDocumentTypes = new Set([
  "Anamnese", "Anamnesebogen", "Arztbericht", "Labor", "Laborbefund",
  "Metatron", "Metatron Hospital", "Vieva Plus", "Sonstige Untersuchung",
]);

export function displayAnalysisSourceLabel(source: DisplaySource): string {
  const sourceId = normalizeAnalysisSourceId(source.key);
  if (sourceId === "patientenkontext") {
    const headings: Array<[RegExp, string]> = [
      [/^Aktuelle Symptome \/ Beschwerden:/m, "Symptome"],
      [/^Bekannte Erkrankungen \/ Diagnosen:/m, "Erkrankungen"],
      [/^Pathogene \/ NLS-EAV-Befunde:/m, "Pathogene"],
      [/^Aktuelle konventionell-medizinische Medikamente:/m, "Medikamente"],
      [/^Aktuelle naturheilkundliche Mittel/m, "naturheilkundliche Mittel"],
      [/^Bisherige naturheilkundliche Mittel:/m, "bisherige Mittel"],
    ];
    const parts = headings.filter(([pattern]) => pattern.test(source.text)).map(([, label]) => label);
    return `Einzelangaben – ${parts.length ? parts.join(", ") : "weitere Angaben"}`;
  }
  if (sourceId === "anamnese:iaa") return "IAA-Angaben aus dem Anamnesebogen";
  if (sourceId === "sonstigeUntersuchungen:pet") return "PET-Untersuchungen aus der Anamnese";

  const [field] = sourceId.split(":");
  const base = sourceNames[field];
  if (!base) return neutralAnalysisSourceLabel(sourceId, source.group);
  if (sourceId.endsWith(":intro")) return `${base} – zusätzlicher Text vor dem Dokument`;
  const documentId = sourceId.match(/:doc:([a-f0-9]{12}|\d+)$/i)?.[1];
  if (!documentId) return base;

  // Nur strukturierte, freigegebene Kopfmetadaten für die Anzeige nutzen.
  // Dateinamen und medizinischen Freitext hier niemals als Label übernehmen.
  const header = source.text.split(/\r?\n/).slice(0, 6);
  const date = header.map((line) => /^Erstellt am:\s*(\d{4})-(\d{2})-(\d{2})\s*$/i.exec(line.trim())).find(Boolean);
  const type = header.map((line) => /^Dokumenttyp:\s*(.+?)\s*$/i.exec(line.trim())?.[1]).find(Boolean);
  const typeDetail = field === "sonstigeUntersuchungen" && type && approvedDocumentTypes.has(type)
    ? ` · Typ: ${type}` : "";
  const dateDetail = date ? ` · Datum: ${date[3]}.${date[2]}.${date[1]}` : " · Datum offen";
  return `${base} – Dokumentkennung ${documentId}${typeDetail}${dateDetail}`;
}
