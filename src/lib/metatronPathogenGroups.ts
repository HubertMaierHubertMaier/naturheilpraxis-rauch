export const METATRON_PATHOGEN_GROUPS = [
  { value: "bacteria", label: "Bakterien" },
  { value: "viruses", label: "Viren" },
  { value: "yeasts", label: "Hefepilze (Candida-Arten)" },
  { value: "moulds", label: "Schimmelpilze" },
  { value: "parasites", label: "Parasiten" },
] as const;

export type MetatronPathogenGroup = typeof METATRON_PATHOGEN_GROUPS[number]["value"] | "unassigned";

export function parseMetatronGroup(value: unknown): MetatronPathogenGroup | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase("de-DE").replace(/[:\s]+$/g, "");
  if (normalized === "unassigned" || normalized === "noch zuzuordnen") return "unassigned";
  if (/^(bacteria|bakterien)$/.test(normalized)) return "bacteria";
  if (/^(viruses|viren)$/.test(normalized)) return "viruses";
  if (/^(yeasts|hefepilze|hefen|candida-arten|hefepilze\s*\(candida-arten\))$/.test(normalized)) return "yeasts";
  if (/^(moulds|molds|schimmelpilze)$/.test(normalized)) return "moulds";
  if (/^(parasites|parasiten)$/.test(normalized)) return "parasites";
  return undefined;
}

/** Taxonomic grouping only, not a diagnosis or a claim that an organism is present. */
export function inferMetatronGroup(name: string): MetatronPathogenGroup {
  const value = name.trim().toLocaleLowerCase("de-DE");
  if (/\b(?:candida|candidozyma|saccharomyces|cryptococcus|malassezia|trichosporon|rhodotorula)\b/.test(value)) return "yeasts";
  if (/\b(?:aspergillus|penicillium|alternaria|cladosporium|fusarium|mucor|rhizopus|stachybotrys)\b/.test(value)) return "moulds";
  if (/\b(?:giardia|lamblia|entamoeba|blastocystis|toxoplasma|cryptosporidium|trichomonas|plasmodium|babesia|leishmania|trypanosoma|ascaris|enterobius|strongyloides|schistosoma|taenia|echinococcus|fasciola|opisthorchis|ancylostoma|trichuris)\b/.test(value)) return "parasites";
  if (/\b[\p{L}-]*virus(?:en|es)?\b|\b(?:ebv|cmv|hsv|hhv|hpv|hiv|hepatitis\s+[abcde]|sars-cov-?2)\b/iu.test(value)) return "viruses";
  if (/\b(?:helicobacter|borrelia|staphylococcus|streptococcus|escherichia|klebsiella|enterococcus|enterobacter|pseudomonas|salmonella|shigella|campylobacter|clostridium|clostridioides|mycoplasma|chlamydia|chlamydophila|ureaplasma|bartonella|brucella|yersinia|rickettsia|mycobacterium|corynebacterium|proteus|serratia|bacteroides|neisseria|treponema|vibrio|haemophilus|listeria|legionella)\b|^e\.?\s+coli\b/.test(value)) return "bacteria";
  return "unassigned";
}

export function metatronGroupFor(entry: { name: string; category?: unknown }): MetatronPathogenGroup {
  return parseMetatronGroup(entry.category) ?? inferMetatronGroup(entry.name);
}

export function metatronGroupLabel(group: MetatronPathogenGroup): string {
  return METATRON_PATHOGEN_GROUPS.find(item => item.value === group)?.label || "Noch zuzuordnen";
}
