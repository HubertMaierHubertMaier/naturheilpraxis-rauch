import type { DirectBefundTarget } from "@/lib/directBefundHandoff";

export const DIRECT_BEFUND_GROUPS = [
  { id: "anamnese", label: "Anamnese", note: "Anamnesebogen und Anamneseunterlagen", tone: "border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20", addOptions: [{ label: "Anamnese hinzufügen", documentType: "anamnese" }] },
  { id: "patienten", label: "Patientenunterlagen", note: "Laborbefunde, Diagnosen, Arztberichte und weitere Unterlagen", tone: "border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30", addOptions: [{ label: "Laborbefund hinzufügen", documentType: "labor" }, { label: "Diagnose / Arztbericht hinzufügen", documentType: "arzt" }, { label: "Weitere Unterlage hinzufügen", documentType: "sonstige" }] },
  { id: "metatron", label: "Metatron / Hospital Analyse", note: "Metatron- und Hospital-Unterlagen", tone: "border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20", addOptions: [{ label: "Metatron / Hospital hinzufügen", documentType: "metatron" }] },
  { id: "vieva", label: "Vieva Plus Analyse", note: "Vieva-Plus-Unterlagen", tone: "border-teal-300 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/20", addOptions: [{ label: "Vieva Plus hinzufügen", documentType: "vieva" }] },
  { id: "biodiagnostik", label: "Biodiagnostik Laboranalyse", note: "Gesonderte Biodiagnostik-Laborbefunde", tone: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20", addOptions: [{ label: "Biodiagnostik hinzufügen", documentType: "biodiagnostik" }] },
  { id: "unassigned", label: "Unzugeordnet", note: "Dokumentart vor dem Auslesen bewusst wählen", tone: "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20", addOptions: [{ label: "Ohne Zuordnung hinzufügen", documentType: "" }] },
] as const satisfies readonly { id: string; label: string; note: string; tone: string; addOptions: readonly { label: string; documentType: DirectBefundTarget | "" }[] }[];

export type DirectBefundGroupId = (typeof DIRECT_BEFUND_GROUPS)[number]["id"];

export function directBefundGroupId(documentType: DirectBefundTarget | ""): DirectBefundGroupId {
  if (documentType === "anamnese" || documentType === "metatron" || documentType === "vieva" || documentType === "biodiagnostik") return documentType;
  if (documentType === "labor" || documentType === "arzt" || documentType === "sonstige") return "patienten";
  return "unassigned";
}

export function groupDirectBefundFiles<T extends { documentType: DirectBefundTarget | "" }>(items: readonly T[], includeEmpty = false) {
  return DIRECT_BEFUND_GROUPS.map(group => ({ ...group, items: items.filter(item => directBefundGroupId(item.documentType) === group.id) }))
    .filter(group => includeEmpty || group.items.length > 0);
}
