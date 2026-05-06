// Parser for AI-generated therapy recommendation markdown
// Splits the response into intro sections, categorized remedy groups, and footer sections.

export interface RemedyRow {
  name: string;
  latin?: string;
  dosage: string;
  application: string;
  duration: string;
  priority: "essential" | "recommended" | "optional" | "unknown";
  priorityRaw: string;
  cost: string;
  reason: string;
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
  { match: /mineralstoffe|spurenelemente/i, tone: "terracotta", emoji: "🧂", title: "Mineralstoffe & Spurenelemente" },
  { match: /fettsäuren|aminosäuren/i, tone: "terracotta", emoji: "🐟", title: "Fettsäuren & Aminosäuren" },
  { match: /phytotherapie|tinktur/i, tone: "sage", emoji: "🌱", title: "Phytotherapie & Tinkturen" },
  { match: /heilpilze|mykotherapie/i, tone: "sage", emoji: "🍄", title: "Heilpilze (Mykotherapie)" },
  { match: /sanum|isopathie|enderlein/i, tone: "sage", emoji: "🧪", title: "Sanum-Therapie" },
  { match: /pascoe|heel|komplexhom/i, tone: "mist", emoji: "💼", title: "Pascoe & Heel (Komplexhomöopathie)" },
  { match: /vitaplace/i, tone: "terracotta", emoji: "🏭", title: "Vitaplace" },
  { match: /homöopathie|komplexmittel/i, tone: "mist", emoji: "💧", title: "Homöopathie & Komplexmittel" },
  { match: /probiotika|präbiotika|darmaufbau/i, tone: "mist", emoji: "🧫", title: "Probiotika & Darmaufbau" },
  { match: /spezialpräparate/i, tone: "neutral", emoji: "💎", title: "Spezialpräparate" },
  { match: /zapper|frequenztherapie|bioresonanz/i, tone: "neutral", emoji: "⚡", title: "Zapper & Frequenztherapie" },
  { match: /apparativ|klinische therap/i, tone: "neutral", emoji: "🩺", title: "Apparative & klinische Therapien" },
  { match: /onkolog|krebs|cancer|tumor|metasta|karzinom/i, tone: "terracotta", emoji: "🧬", title: "Onkologische Begleittherapie" },
];

const FREE_SECTION_DEFS: Array<{ match: RegExp; variant: FreeSection["variant"]; emoji: string; title: string; placement: "intro" | "outro" }> = [
  { match: /analyse.*belastung/i, variant: "info", emoji: "🔍", title: "Analyse der Belastungen", placement: "intro" },
  { match: /bewertung.*bisherig|bewertung der bisherigen/i, variant: "info", emoji: "📊", title: "Bewertung der bisherigen Therapie", placement: "intro" },
  { match: /laborwert/i, variant: "info", emoji: "🔬", title: "Laborwert-Analyse", placement: "intro" },
  { match: /stuhlbefund|mikrobiom/i, variant: "info", emoji: "🧫", title: "Stuhlbefund-Analyse", placement: "intro" },
  { match: /sicherheitshinweis/i, variant: "warning", emoji: "⚠️", title: "Sicherheitshinweise", placement: "intro" },
  { match: /kostenübersicht/i, variant: "muted", emoji: "💰", title: "Kostenübersicht", placement: "outro" },
  { match: /therapieprotokoll|zeitlicher ablauf/i, variant: "success", emoji: "📋", title: "Therapieprotokoll", placement: "outro" },
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
  if (/essentiell/i.test(raw)) return "essential";
  if (/empfohlen/i.test(raw)) return "recommended";
  if (/optional/i.test(raw)) return "optional";
  return "unknown";
}

function parseRemedyLine(line: string): RemedyRow | null {
  // Expected: - **Name** (Latin) | Dosage | Application | Duration | Priority | Cost | Reason
  const cleaned = line.replace(/^[-*]\s+/, "").trim();
  const parts = cleaned.split("|").map((p) => p.trim());
  if (parts.length < 4) return null;

  const namePart = parts[0];
  const nameMatch = namePart.match(/\*\*(.+?)\*\*\s*(?:\((.+?)\))?/);
  const name = nameMatch ? nameMatch[1].trim() : namePart.replace(/\*\*/g, "").trim();
  const latin = nameMatch?.[2]?.trim();

  const [, dosage = "", application = "", duration = "", priorityRaw = "", cost = "", ...reasonParts] = parts;

  return {
    name,
    latin,
    dosage,
    application,
    duration,
    priority: parsePriority(priorityRaw),
    priorityRaw,
    cost,
    reason: reasonParts.join(" | ").trim(),
  };
}

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

  for (const block of blocks) {
    if (block.kind === "category" && block.def) {
      const remedies: RemedyRow[] = [];
      for (const l of block.lines) {
        const trimmed = l.trim();
        if (!trimmed.startsWith("-") && !trimmed.startsWith("*")) continue;
        if (!trimmed.includes("|")) continue;
        const row = parseRemedyLine(trimmed);
        if (row && row.name) remedies.push(row);
      }
      if (remedies.length === 0) continue;
      result.categories.push({
        emoji: block.def.emoji,
        title: block.def.title,
        tone: block.def.tone,
        remedies,
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
    }
  }

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
