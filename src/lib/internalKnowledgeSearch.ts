const INTERNAL_SEARCH_STOPWORDS = new Set([
  "alle", "alles", "anzeigen", "aus", "bei", "bekomme", "bitte", "datenbank",
  "der", "die", "das", "dem", "den", "ein", "eine", "eigenschaft", "eigenschaften",
  "eintrag", "eintraege", "einträge", "es", "finde", "fuer", "für", "gegen", "gibt",
  "haben", "hat", "ich", "information", "informationen", "ist", "mir", "mittel", "mit",
  "moechte", "möchte", "produkt", "produkte", "sind", "ueber", "über", "und", "von",
  "vom", "was", "welche", "welchem", "welchen", "welcher", "welches", "wissen", "zeige",
  "zu", "zum", "zur",
]);

const germanAscii = (value: string) => value
  .replace(/ä/g, "ae")
  .replace(/ö/g, "oe")
  .replace(/ü/g, "ue")
  .replace(/ß/g, "ss");

const germanSearchVariants = (term: string) => {
  const ascii = germanAscii(term);
  const umlaut = ascii
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/ss/g, "ß");
  return [...new Set([term, ascii, umlaut])];
};

export function normalizeInternalKnowledgeSearchText(value: unknown): string {
  return germanAscii(String(value ?? "").toLocaleLowerCase("de"))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function internalKnowledgeSearchTerms(value: string, maximum = 8): string[] {
  const normalized = value
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .trim();

  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/).filter((term) => term.length >= 2 && !INTERNAL_SEARCH_STOPWORDS.has(term)))].slice(0, maximum);
}

export function buildInternalKnowledgeIlikeFilter(columns: string[], value: string): string {
  const termFilters = internalKnowledgeSearchTerms(value)
    .map((term) => germanSearchVariants(term)
      .flatMap((variant) => columns.map((column) => `${column}.ilike.%${variant}%`))
      .join(","));

  if (termFilters.length <= 1) return termFilters[0] || "";
  return `and(${termFilters.map((filter) => `or(${filter})`).join(",")})`;
}

export function compactInternalKnowledgeText(value: unknown, maximum = 1200): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum).trimEnd()} ...`;
}

export function hasInternalKnowledgeData(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}
