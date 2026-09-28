import type { DirectBefundTarget } from "@/lib/directBefundHandoff";

export const DIRECT_BEFUND_GROUPS = [
  { id: "anamnese", label: "Anamnese", note: "Anamnesebogen und Anamneseunterlagen", tone: "border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20" },
  { id: "patienten", label: "Patientenunterlagen", note: "Allgemeines Labor, Arztberichte und weitere Unterlagen", tone: "border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30" },
  { id: "metatron", label: "Metatron / Hospital Analyse", note: "Ausdrücklich zugeordnete Metatron-Unterlagen", tone: "border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20" },
  { id: "vieva", label: "Vieva Pro Analyse", note: "Ausdrücklich zugeordnete Vieva-Pro-Unterlagen", tone: "border-teal-300 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/20" },
  { id: "biodiagnostik", label: "Biodiagnostik Laboranalyse", note: "Gesondert gekennzeichnete Biodiagnostik-Unterlagen", tone: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" },
  { id: "unassigned", label: "Noch nicht zugeordnet", note: "Dokumentart vor dem Auslesen bewusst wählen", tone: "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" },
] as const;

export type DirectBefundGroupId = (typeof DIRECT_BEFUND_GROUPS)[number]["id"];

export function directBefundGroupId(documentType: DirectBefundTarget | ""): DirectBefundGroupId {
  if (documentType === "anamnese" || documentType === "metatron" || documentType === "vieva" || documentType === "biodiagnostik") return documentType;
  if (documentType === "labor" || documentType === "arzt" || documentType === "sonstige") return "patienten";
  return "unassigned";
}

export function groupDirectBefundFiles<T extends { documentType: DirectBefundTarget | "" }>(items: readonly T[]) {
  return DIRECT_BEFUND_GROUPS.map(group => ({ ...group, items: items.filter(item => directBefundGroupId(item.documentType) === group.id) }))
    .filter(group => group.items.length > 0);
}
