// Parser for AI-generated therapy recommendation markdown
// Splits the response into intro sections, categorized remedy groups, and footer sections.

export interface RemedyRow {
  name: string;
  latin?: string;
  manufacturer: string;
  dosage: string;
  application: string;
  duration: string;
  priority: "essential" | "recommended" | "optional" | "unknown";
  priorityRaw: string;
  cost: string;
  reason: string;
  patientExplanation: string;
  safety: string;
}

export interface CategoryGroup {
  emoji: string;
  title: string;
  tone: "sage" | "sand" | "terracotta" | "mist" | "neutral";
  remedies: RemedyRow[];
}

export interface FreeSection {
  emoji: string;
  title: string;
  content: string; // raw markdown
  variant: "info" | "warning" | "danger" | "success" | "muted";
}

export interface ParsedTherapy {
  intro: FreeSection[]; // Analyse, Bewertung, Labor, Sicherheit
  categories: CategoryGroup[];
  outro: FreeSection[]; // Kosten, Protokoll, Begleitmaßnahmen, Ausgeschlossen
}

const CATEGORY_DEFS: Array<{ match: RegExp; tone: CategoryGroup["tone"]; emoji: string; title: string }> = [
  { match: /hausmittel|gewürze/i, tone: "sand", emoji: "🌿", title: "Hausmittel & Gewürze" },
  { match: /vitamine/i, tone: "terracotta", emoji: "🍋", title: "Vitamine" },
  { match: /aminosäuren/i, tone: "terracotta", emoji: "🧬", title: "Aminosäuren" },
  { match: /mineralstoffe|spurenelemente/i, tone: "terracotta", emoji: "🧂", title: "Spurenelemente & Mineralstoffe" },
  { match: /fettsäuren|omega-?3/i, tone: "terracotta", emoji: "🐟", title: "Fettsäuren" },
  { match: /pathogen.*nutramedix|nutramedix.*pathogen|pathogenbezogene mittel/i, tone: "sage", emoji: "🦠", title: "Pathogenbezogene Mittel (NutraMedix)" },
  { match: /symptombezogene mittel|mittel.*symptom/i, tone: "mist", emoji: "🩹", title: "Symptombezogene Mittel" },
  { match: /diagnosebezogene mittel|erkrankungsbezogene mittel|mittel.*diagnos/i, tone: "mist", emoji: "🩺", title: "Diagnosebezogene Mittel" },
  { match: /mannayan/i, tone: "terracotta", emoji: "🏭", title: "Mannayan-Produkte" },
  { match: /phytotherapie|tinktur/i, tone: "sage", emoji: "🌱", title: "Phytotherapie & Tinkturen" },
  { match: /heilpilze|mykotherapie/i, tone: "sage", emoji: "🍄", title: "Heilpilze (Mykotherapie)" },
  { match: /sanum|isopathie|enderlein/i, tone: "sage", emoji: "🧪", title: "Sanum-Therapie" },
  { match: /metatron.*homöopath|homöopath.*metatron/i, tone: "mist", emoji: "🌌", title: "Metatron-Homöopathie" },
  { match: /pascoe|heel|komplexhom/i, tone: "mist", emoji: "💼", title: "Pascoe & Heel (Komplexhomöopathie)" },
  { match: /vitaplace/i, tone: "terracotta", emoji: "🧴", title: "Vitaplace-Apothekenprodukte" },
  { match: /homöopathie|komplexmittel/i, tone: "mist", emoji: "💧", title: "Homöopathie & Komplexmittel" },
  { match: /probiotika|präbiotika|darmaufbau/i, tone: "mist", emoji: "🧫", title: "Probiotika & Darmaufbau" },
  { match: /spezialpräparate/i, tone: "neutral", emoji: "💎", title: "Spezialpräparate" },
  { match: /zapper|frequenztherapie|bioresonanz/i, tone: "neutral", emoji: "⚡", title: "Zapper & Frequenztherapie" },
  { match: /apparativ|klinische therap/i, tone: "neutral", emoji: "🩺", title: "Apparative & klinische Therapien" },
  { match: /onkolog|krebs|cancer|tumor|metasta|karzinom/i, tone: "terracotta", emoji: "🧬", title: "Onkologische Begleittherapie" },
];

const FREE_SECTION_DEFS: Array<{ match: RegExp; variant: FreeSection["variant"]; emoji: string; title: string; placement: "intro" | "outro" }> = [
  { match: /umfassende anamnese|anamnese/i, variant: "info", emoji: "🧾", title: "Umfassende Anamnese", placement: "intro" },
  { match: /vieva.*auswertung|auswertung.*vieva/i, variant: "info", emoji: "📈", title: "Vieva-Auswertung", placement: "intro" },
  { match: /metatron.*pathogen|pathogen.*metatron/i, variant: "warning", emoji: "🦠", title: "Metatron-Pathogene und Therapieprüfung", placement: "intro" },
  { match: /metatron.*bakterienprotokoll|bakterienprotokoll.*metatron/i, variant: "warning", emoji: "🌿", title: "Metatron-Bakterienprotokoll", placement: "intro" },
  { match: /allergien?.*unverträglichkeiten?|unverträglichkeiten?.*allergien?/i, variant: "warning", emoji: "🌾", title: "Allergien und Unverträglichkeiten", placement: "intro" },
  { match: /psychoemotional.*metatron|metatron.*psychoemotional|bachblüten.*metatron|metatron.*bachblüten/i, variant: "info", emoji: "🌸", title: "Psychoemotionale Metatron-Auswertung & Bachblüten", placement: "intro" },
  { match: /priorisier.*therapieziele|therapieziele.*priorisier|therapieziele/i, variant: "success", emoji: "🎯", title: "Priorisierung & Therapieziele", placement: "intro" },
  { match: /folge.?termine|woche\s*4|evaluierung|anpassung|phase\s*2/i, variant: "info", emoji: "📅", title: "Phase 2: Folge-Termine", placement: "intro" },
  { match: /analyse.*belastung/i, variant: "info", emoji: "🔍", title: "Analyse der Belastungen", placement: "intro" },
  { match: /bewertung.*bisherig|bewertung der bisherigen/i, variant: "info", emoji: "📊", title: "Bewertung der bisherigen Therapie", placement: "intro" },
  { match: /laborwert/i, variant: "info", emoji: "🔬", title: "Laborwert-Analyse", placement: "intro" },
  { match: /stuhlbefund|mikrobiom/i, variant: "info", emoji: "🧫", title: "Stuhlbefund-Analyse", placement: "intro" },
  { match: /arztbericht|arztbrief|facharzt|entlassbrief|bildgebung|histolog/i, variant: "info", emoji: "📄", title: "Arztbrief-Auswertung", placement: "intro" },
  { match: /sicherheitshinweis/i, variant: "warning", emoji: "⚠️", title: "Sicherheitshinweise", placement: "intro" },
  { match: /kostenübersicht/i, variant: "muted", emoji: "💰", title: "Kostenübersicht", placement: "outro" },
  { match: /therapieprotokoll|zeitlicher ablauf/i, variant: "success", emoji: "📋", title: "Therapieprotokoll", placement: "outro" },
  { match: /ernährung(?!.*typ)/i, variant: "info", emoji: "🥗", title: "Ernährung", placement: "outro" },
  { match: /verhalten.*alltag|alltag.*verhalten|bewegung.*schlaf/i, variant: "info", emoji: "🚶", title: "Verhalten & Alltag", placement: "outro" },
  { match: /verlaufskontrolle|kontrollplan|therapiekontrolle/i, variant: "success", emoji: "📈", title: "Verlaufskontrolle", placement: "outro" },
  { match: /begleitmaßnahmen/i, variant: "info", emoji: "🔄", title: "Begleitmaßnahmen", placement: "outro" },
  { match: /ausgeschlossen/i, variant: "danger", emoji: "❌", title: "Ausgeschlossene Mittel", placement: "outro" },
  { match: /wissensdatenbank.?lücken|wiki.?lücken|wissensdatenbank.?abgleich|^lücken/i, variant: "warning", emoji: "🕳️", title: "Wissensdatenbank-Lücken", placement: "intro" },
];

function detectCategory(heading: string): { tone: CategoryGroup["tone"]; emoji: string; title: string } | null {
  for (const def of CATEGORY_DEFS) {
    if (def.match.test(heading)) return { tone: def.tone, emoji: def.emoji, title: def.title };
  }
  return null;
}

function detectFreeSection(heading: string) {
  for (const def of FREE_SECTION_DEFS) {
    if (def.match.test(heading)) return def;
  }
  return null;
}

function parsePriority(raw: string): RemedyRow["priority"] {
  if (/\b(?:nicht|niemals|keinesfalls|weder|kein(?:e|en|er|es)?)\b[^|]{0,60}\b(?:essentiell|empfohlen|optional)\b/i.test(raw)) return "unknown";
  if (/\bessentiell\b/i.test(raw)) return "essential";
  if (/\bempfohlen\b/i.test(raw)) return "recommended";
  if (/\boptional\b/i.test(raw)) return "optional";
  return "unknown";
}

function parseRemedyLine(line: string): RemedyRow | null {
  // Current: - **Name** (Latin) | Manufacturer | Dosage | Application | Duration | Priority | Cost | Clinical reason | Patient explanation | Safety
  // Persisted plans without the manufacturer column remain readable.
  const cleaned = line.replace(/^[-*]\s+/, "").trim();
  const parts = cleaned.split("|").map((p) => p.trim());
  if (parts.length < 4) return null;

  const namePart = parts[0];
  const nameMatch = namePart.match(/\*\*(.+?)\*\*\s*(?:\((.+?)\))?/);
  const name = nameMatch ? nameMatch[1].trim() : namePart.replace(/\*\*/g, "").trim();
  const latin = nameMatch?.[2]?.trim();

  // Only the two documented priority columns may affect field alignment.
  const currentPriority = parsePriority(parts[5] || "");
  const legacyPriority = parsePriority(parts[4] || "");
  const hasManufacturer = currentPriority !== "unknown" || parts.length >= 10;
  const priorityIndex = hasManufacturer
    ? currentPriority !== "unknown" ? 5 : -1
    : legacyPriority !== "unknown" ? 4 : -1;
  const manufacturer = hasManufacturer ? parts[1] || "" : "";
  const dosage = parts[hasManufacturer ? 2 : 1] || "";
  const application = parts[hasManufacturer ? 3 : 2] || "";
  const duration = parts[hasManufacturer ? 4 : 3] || "";
  const priorityRaw = priorityIndex > 0 ? parts[priorityIndex] : parts[hasManufacturer ? 5 : 4] || "";
  const cost = parts[priorityIndex > 0 ? priorityIndex + 1 : hasManufacturer ? 6 : 5] || "";
  const reasonParts = parts.slice(priorityIndex > 0 ? priorityIndex + 2 : hasManufacturer ? 7 : 6);
  const hasSeparatePatientExplanation = hasManufacturer && reasonParts.length >= 2;
  const hasSeparateSafety = hasManufacturer && reasonParts.length >= 3;
  const reason = (hasSeparatePatientExplanation ? reasonParts.slice(0, 1) : reasonParts).join(" | ").trim();
  const patientExplanation = hasSeparatePatientExplanation ? reasonParts[1] : reason;
  const safety = hasSeparateSafety ? reasonParts.slice(2).join(" | ").trim() : "";

  return {
    name,
    latin,
    manufacturer,
    dosage,
    application,
    duration,
    priority: parsePriority(priorityRaw),
    priorityRaw,
    cost,
    reason,
    patientExplanation,
    safety,
  };
}

const remedyIdentity = (value: string) => value
  .toLowerCase()
  .replace(/ä/g, "ae")
  .replace(/ö/g, "oe")
  .replace(/ü/g, "ue")
  .replace(/ß/g, "ss")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const mergeDistinctText = (current: string, candidate: string): string => {
  const left = current.trim();
  const right = candidate.trim();
  if (!left) return right;
  if (!right) return left;
  const normalizedLeft = left.toLocaleLowerCase("de").replace(/\s+/g, " ");
  const normalizedRight = right.toLocaleLowerCase("de").replace(/\s+/g, " ");
  if (normalizedLeft.includes(normalizedRight)) return left;
  if (normalizedRight.includes(normalizedLeft)) return right;
  return `${left} | ${right}`;
};

const mergeRemedyRows = (current: RemedyRow, candidate: RemedyRow): RemedyRow => ({
  ...current,
  latin: mergeDistinctText(current.latin || "", candidate.latin || "") || undefined,
  manufacturer: mergeDistinctText(current.manufacturer, candidate.manufacturer),
  dosage: mergeDistinctText(current.dosage, candidate.dosage),
  application: mergeDistinctText(current.application, candidate.application),
  duration: mergeDistinctText(current.duration, candidate.duration),
  priority: priorityOrder(current.priority) <= priorityOrder(candidate.priority) ? current.priority : candidate.priority,
  priorityRaw: mergeDistinctText(current.priorityRaw, candidate.priorityRaw),
  cost: mergeDistinctText(current.cost, candidate.cost),
  reason: mergeDistinctText(current.reason, candidate.reason),
  patientExplanation: mergeDistinctText(current.patientExplanation, candidate.patientExplanation),
  safety: mergeDistinctText(current.safety, candidate.safety),
});

export function parseTherapyMarkdown(markdown: string): ParsedTherapy {
  const result: ParsedTherapy = { intro: [], categories: [], outro: [] };
  if (!markdown) return result;

  const lines = markdown.split("\n");

  type Block =
    | { kind: "free"; def: ReturnType<typeof detectFreeSection>; lines: string[] }
    | { kind: "category"; def: ReturnType<typeof detectCategory>; lines: string[] }
    | { kind: "unknown"; heading: string; lines: string[] };

  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    const headingMatch = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (headingMatch) {
      if (current) blocks.push(current);
      const headingText = headingMatch[2].replace(/[#*]/g, "").trim();
      const cat = detectCategory(headingText);
      const free = detectFreeSection(headingText);
      if (cat) {
        current = { kind: "category", def: cat, lines: [] };
      } else if (free) {
        current = { kind: "free", def: free, lines: [] };
      } else {
        current = { kind: "unknown", heading: headingText, lines: [] };
      }
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
  }
  if (current) blocks.push(current);

  const categoryByTitle = new Map<string, CategoryGroup>();
  const remedyByIdentity = new Map<string, RemedyRow>();

  for (const block of blocks) {
    const dynamicCategory = block.kind === "unknown" && block.lines.some((line) => {
      const trimmed = line.trim();
      if ((!trimmed.startsWith("-") && !trimmed.startsWith("*")) || !trimmed.includes("|")) return false;
      const row = parseRemedyLine(trimmed);
      const fieldCount = trimmed.split("|").length;
      return Boolean(row && (row.priority !== "unknown" || (fieldCount >= 10 && /\*\*.+?\*\*/.test(trimmed))));
    });
    if ((block.kind === "category" && block.def) || dynamicCategory) {
      const categoryDef = block.kind === "category" && block.def
        ? block.def
        : { tone: "neutral" as const, emoji: "💊", title: block.kind === "unknown" ? block.heading : "Weitere Mittel" };
      const remedies: RemedyRow[] = [];
      for (const l of block.lines) {
        const trimmed = l.trim();
        if (!trimmed.startsWith("-") && !trimmed.startsWith("*")) continue;
        if (!trimmed.includes("|")) continue;
        const row = parseRemedyLine(trimmed);
        if (row && row.name) remedies.push(row);
      }
      if (remedies.length === 0) continue;
      let category = categoryByTitle.get(categoryDef.title);
      if (!category) {
        category = {
          emoji: categoryDef.emoji,
          title: categoryDef.title,
          tone: categoryDef.tone,
          remedies: [],
        };
        categoryByTitle.set(categoryDef.title, category);
        result.categories.push(category);
      }
      remedies.forEach((remedy) => {
        const identity = remedyIdentity(remedy.name);
        const previous = remedyByIdentity.get(identity);
        if (previous) {
          const merged = mergeRemedyRows(previous, remedy);
          Object.assign(previous, merged);
          return;
        }
        remedyByIdentity.set(identity, remedy);
        category!.remedies.push(remedy);
      });
    } else if (block.kind === "free" && block.def) {
      const content = block.lines.join("\n").trim();
      if (!content) continue;
      const section: FreeSection = {
        emoji: block.def.emoji,
        title: block.def.title,
        content,
        variant: block.def.variant,
      };
      if (block.def.placement === "intro") result.intro.push(section);
      else result.outro.push(section);
    } else if (block.kind === "unknown") {
      const content = block.lines.join("\n").trim();
      if (!content) continue;
      result.intro.push({
        emoji: "🧾",
        title: block.heading,
        content,
        variant: "info",
      });
    }
  }

  result.categories = result.categories.filter((category) => category.remedies.length > 0);
  return result;
}

export function priorityOrder(p: RemedyRow["priority"]): number {
  switch (p) {
    case "essential":
      return 0;
    case "recommended":
      return 1;
    case "optional":
      return 2;
    default:
      return 3;
  }
}
