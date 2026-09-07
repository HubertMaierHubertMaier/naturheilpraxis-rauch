export type AnalysisProfileId = "quick" | "complete" | "deep-final";

export type AnalysisProfile = {
  version: 1;
  id: AnalysisProfileId;
  label: string;
  befundChunkModel: "google/gemini-2.5-flash";
  befundFinalModel: "google/gemini-2.5-flash" | "google/gemini-2.5-pro";
  therapyModel: "google/gemini-2.5-flash" | "google/gemini-2.5-pro";
  wikiMode: "targeted" | "complete-map-reduce";
};

export const buildAnalysisProfile = (useMapReduce: boolean, useProModel: boolean): AnalysisProfile => {
  const isDeep = useMapReduce && useProModel;
  if (!useMapReduce) {
    return Object.freeze({
      version: 1,
      id: "quick",
      label: "Schnellprüfung",
      befundChunkModel: "google/gemini-2.5-flash",
      befundFinalModel: "google/gemini-2.5-flash",
      therapyModel: "google/gemini-2.5-flash",
      wikiMode: "targeted",
    });
  }
  return Object.freeze({
    version: 1,
    id: isDeep ? "deep-final" : "complete",
    label: isDeep ? "Tiefenprüfung (Pro für Befundabschluss und Therapie)" : "Vollständige Auswertung",
    befundChunkModel: "google/gemini-2.5-flash",
    befundFinalModel: isDeep ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
    therapyModel: isDeep ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
    wikiMode: "complete-map-reduce",
  });
};
