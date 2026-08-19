import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deidentifyClinicalData, directIdentifierCategories } from "../_shared/clinicalDeidentification.ts";
import { recognizeMedicationGroups } from "../_shared/therapySafety.ts";
import {
  INFOTHEK_KNOWLEDGE_FILES,
  buildInfothekKnowledgeContext,
  buildStagingKnowledgeContext,
  infothekHtmlToKnowledgeDocument,
  normalizeTherapyKnowledgeSearchText,
  selectRelevantInfothekDocuments,
  selectRelevantStagingCandidates,
  type InfothekKnowledgeDocument,
  type StagingKnowledgeCandidate,
} from "../_shared/therapyKnowledgeContext.ts";

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

function isAllowedCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const isLocalDev =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      ["5173", "4173", "5174", "4174"].includes(url.port);

    return (
      isLocalDev ||
      allowedCorsHostnames.has(url.hostname) ||
      url.hostname.endsWith(".lovableproject.com") ||
      url.hostname.endsWith(".lovable.app")
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };

  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }

  return headers;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function checkRateLimit(key: string, now = Date.now()): boolean {
  for (const [entryKey, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(entryKey);
    }
  }

  const current = rateLimitMap.get(key);
  if (!current) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

// In-Memory-Cache für die Wiki-Rohdaten (überlebt warm starts).
// Invalidierung automatisch, sobald sich Anzahl oder max(updated_at) ändert.
interface WikiEntry {
  id: string;
  entry_kind?: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  review_status?: string;
  evidence_level?: string;
  dosage_status?: string;
  rights_status?: string;
  source_citations?: Array<{ url?: string; label?: string }>;
  therapeutic_topics?: string[];
  contraindications?: string[];
  interaction_tags?: string[];
  safety_notes?: string;
  patient_facing_allowed?: boolean;
  commercial_claims_reviewed?: boolean;
}
interface WikiCache {
  signature: string;
  entries: WikiEntry[];
  builtAt: number;
}
let WIKI_CACHE: WikiCache | null = null;
const WIKI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min Sicherheitsnetz

interface InfothekCache {
  documents: InfothekKnowledgeDocument[];
  errors: string[];
  builtAt: number;
}
let INFOTHEK_CACHE: InfothekCache | null = null;
const INFOTHEK_CACHE_TTL_MS = 10 * 60 * 1000;

// Limits sind pro Request (nach Filterung). Das Lovable AI Gateway lehnt sehr große
// Single-Messages ab (400 "Invalid input"), daher konservativ dimensionieren.
const MAX_ENTRY_CHARS = 3000;
const MAX_TOTAL_CHARS = 25_000; // ~6k Tokens – konservativ unter Gateway-Limit
const MAX_KNOWLEDGE_QUERY_TOKENS = 256;
const CACHE_VERSION = "v14-structured-kb";

// Map-Reduce-Konfiguration (Stufe 1: KI bewertet ALLE Einträge in Batches)
const MAP_REDUCE_BATCH_SIZE = 40; // Einträge pro Batch (nur Titel+Kategorie+Tags+Snippet)
const MAP_REDUCE_TOP_N = 18; // begrenzter Fachkontext statt moeglichst vieler Mittel
const MAP_REDUCE_MODEL = "google/gemini-2.5-flash-lite"; // billigstes Modell für Bewertung
const MAP_REDUCE_SNIPPET_CHARS = 350; // wie viel Content-Vorschau pro Eintrag in Stufe 1

// Stufe 1 (Map): KI bekommt Batches mit nur Titel/Kategorie/Tags/Snippet und gibt Score 0-10 zurück
async function scoreEntriesViaAI(
  entries: WikiEntry[],
  queryText: string,
  apiKey: string,
): Promise<Map<string, number>> {
  const scoreMap = new Map<string, number>();
  const batches: WikiEntry[][] = [];
  for (let i = 0; i < entries.length; i += MAP_REDUCE_BATCH_SIZE) {
    batches.push(entries.slice(i, i + MAP_REDUCE_BATCH_SIZE));
  }
  console.log(`Map-Reduce: bewerte ${entries.length} Einträge in ${batches.length} Batches à ${MAP_REDUCE_BATCH_SIZE}`);

  const promises = batches.map(async (batch, batchIdx) => {
    const list = batch.map((e, i) => {
      const snippet = (e.content || "").slice(0, MAP_REDUCE_SNIPPET_CHARS).replace(/\s+/g, " ");
      const tags = (e.tags || []).join(", ");
      return `${i}. [${e.category}] ${e.title} (Tags: ${tags})\n   ${snippet}`;
    }).join("\n\n");

    const sys = `Du bist ein medizinischer Relevanz-Filter. Bewerte jeden der folgenden Wissensdatenbank-Einträge auf einer Skala 0-10 für die Relevanz zu der Patienten-Anfrage. 0=völlig irrelevant, 10=hochrelevant. Antworte AUSSCHLIESSLICH mit einem JSON-Array von Zahlen, gleiche Reihenfolge wie die Einträge, exakt ${batch.length} Werte. Beispiel: [8,0,3,10,0,2]. Keine Erklärungen.`;
    const usr = `PATIENTEN-ANFRAGE:\n${queryText.slice(0, 2000)}\n\nEINTRÄGE (${batch.length} Stück):\n${list}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MAP_REDUCE_MODEL,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: usr },
          ],
          max_tokens: 500,
          stream: false,
        }),
      });
      if (!resp.ok) {
        console.warn(`Batch ${batchIdx}: Gateway ${resp.status} – fallback auf Wort-Score für diesen Batch`);
        return;
      }
      const json = await resp.json();
      const text: string = json?.choices?.[0]?.message?.content || "";
      const match = text.match(/\[[\d\s,.-]+\]/);
      if (!match) {
        console.warn(`Batch ${batchIdx}: kein JSON-Array gefunden – Text:`, text.slice(0, 200));
        return;
      }
      const scores: number[] = JSON.parse(match[0]);
      if (!Array.isArray(scores) || scores.length !== batch.length) {
        console.warn(`Batch ${batchIdx}: Score-Anzahl falsch (got ${scores?.length}, expected ${batch.length})`);
        return;
      }
      batch.forEach((e, i) => {
        const sc = Math.max(0, Math.min(10, Number(scores[i]) || 0));
        scoreMap.set(e.id, sc);
      });
    } catch (err) {
      console.warn(`Batch ${batchIdx} Fehler:`, err instanceof Error ? err.message : String(err));
    }
  });

  await Promise.all(promises);
  console.log(`Map-Reduce: ${scoreMap.size}/${entries.length} Einträge bewertet`);
  return scoreMap;
}

type SupabaseQueryError = { message: string };
type SupabaseQueryResult<T> = {
  data: T | null;
  error: SupabaseQueryError | null;
  count?: number | null;
};
type SupabaseQueryBuilder<T> = PromiseLike<SupabaseQueryResult<T>> & {
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryBuilder<T>;
  limit: (count: number) => SupabaseQueryBuilder<T>;
};
type SupabaseQueryClient = {
  from: (table: string) => {
    select: (...args: unknown[]) => SupabaseQueryBuilder<unknown[]>;
  };
};

type StructuredArticleRow = {
  id: string;
  article_kind: string;
  current_revision_id: string | null;
  updated_at: string;
};

type StructuredRevisionRow = {
  id: string;
  title: string;
  category_path: string;
  tags: unknown;
  content_markdown: string;
  review_status: string;
  metadata: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const asString = (value: unknown): string => typeof value === "string" ? value : "";

const asStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const asCitations = (value: unknown): Array<{ url?: string; label?: string }> => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      const source = asRecord(item);
      const url = asString(source.url);
      const label = asString(source.label);
      return url || label ? [{ ...(url ? { url } : {}), ...(label ? { label } : {}) }] : [];
    })
    : []
);

function mapStructuredWikiEntries(articles: StructuredArticleRow[], revisions: StructuredRevisionRow[]): WikiEntry[] {
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  return articles.flatMap((article) => {
    const revision = article.current_revision_id ? revisionById.get(article.current_revision_id) : undefined;
    if (!revision) return [];
    const metadata = asRecord(revision.metadata);
    const legacy = asRecord(metadata.legacy_record);
    const field = (key: string) => legacy[key] ?? metadata[key];
    return [{
      id: article.id,
      entry_kind: article.article_kind,
      title: revision.title,
      category: revision.category_path,
      tags: asStringArray(revision.tags),
      content: revision.content_markdown,
      review_status: revision.review_status === "draft" ? "unreviewed" : revision.review_status,
      evidence_level: asString(field("evidence_level")),
      dosage_status: asString(field("dosage_status")),
      rights_status: asString(field("rights_status")),
      source_citations: asCitations(field("source_citations")),
      therapeutic_topics: asStringArray(field("therapeutic_topics")),
      contraindications: asStringArray(field("contraindications")),
      interaction_tags: asStringArray(field("interaction_tags")),
      safety_notes: asString(field("safety_notes")),
      patient_facing_allowed: field("patient_facing_allowed") === true,
      commercial_claims_reviewed: field("commercial_claims_reviewed") === true,
    }];
  });
}

async function loadWikiEntries(client: SupabaseQueryClient): Promise<{ entries: WikiEntry[]; cacheHit: boolean }> {
  const { data: sigRows, error: sigError } = await client
    .from("kb_articles")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (sigError) throw new Error("Strukturierte Wiki-Signatur konnte nicht geladen werden: " + sigError.message);

  const { count, error: countError } = await client
    .from("kb_articles")
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error("Strukturierte Wiki-Anzahl konnte nicht geladen werden: " + countError.message);

  const maxUpdated = sigRows?.[0]?.updated_at ?? "empty";
  const signature = `${CACHE_VERSION}|${count ?? 0}|${maxUpdated}`;
  const now = Date.now();

  if (WIKI_CACHE && WIKI_CACHE.signature === signature && now - WIKI_CACHE.builtAt < WIKI_CACHE_TTL_MS) {
    console.log(`Wiki cache HIT (signature=${signature}, entries=${WIKI_CACHE.entries.length})`);
    return { entries: WIKI_CACHE.entries, cacheHit: true };
  }

  console.log(`Wiki cache MISS (new signature=${signature})`);
  const { data: articleRows, error: articleError } = await client
    .from("kb_articles")
    .select("id, article_kind, current_revision_id, updated_at")
    .order("updated_at", { ascending: false });
  if (articleError) throw new Error("Strukturierte Wiki-Artikel konnten nicht geladen werden: " + articleError.message);
  const { data: revisionRows, error: revisionError } = await client
    .from("kb_article_revisions")
    .select("id, title, category_path, tags, content_markdown, review_status, metadata")
    .order("created_at", { ascending: false });
  if (revisionError) throw new Error("Strukturierte Wiki-Revisionen konnten nicht geladen werden: " + revisionError.message);

  const entries = mapStructuredWikiEntries(
    (articleRows || []) as StructuredArticleRow[],
    (revisionRows || []) as StructuredRevisionRow[],
  );
  WIKI_CACHE = { signature, entries, builtAt: now };
  return { entries, cacheHit: false };
}

// Tokenisiert eine Query (Belastungen + Symptome + Erkrankung) für das Relevanz-Scoring.
function tokenizeQuery(text: string): string[] {
  const STOPWORDS = new Set([
    "und", "oder", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "mit", "ohne", "von", "vom", "zur", "zum", "fuer", "auf", "bei", "auch", "ist", "sind",
    "im", "in", "an", "am", "auf", "als", "wie", "noch", "nicht", "kein", "keine",
    "organe", "organ", "index", "nicht", "angegeben", "li", "re", "rechts", "links",
  ]);
  return Array.from(new Set(
    normalizeTherapyKnowledgeSearchText(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  )).slice(0, MAX_KNOWLEDGE_QUERY_TOKENS);
}

type SymptomTarget = {
  label: string;
  terms: RegExp;
  wikiTitles: string[];
  keywords: string[];
};

const SYMPTOM_TARGETS: SymptomTarget[] = [
  {
    label: "Erschöpfung/Fatigue/Schwäche",
    terms: /erschöpf|fatigue|müde|mued|schwäche|schwaeche|krafter|antrieb|lebensqualität|lebensqualitaet|cfids|cfs/i,
    wikiTitles: ["Therapeutischer Index: Immunsystem", "Therapeutischer Index: Psyche", "Therapeutischer Index: Sonstige"],
    keywords: ["erschöpfung", "fatigue", "cfids", "cfs", "müdigkeit", "schwäche", "aletris-heel", "tonico-heel", "coenzyme compositum", "ubichinon compositum"],
  },
  {
    label: "Appetit/Gewicht/Abmagerung",
    terms: /appetit|gewichtsverlust|abmager|kachex|untergewicht|gewichtsabnahme/i,
    wikiTitles: ["Therapeutischer Index: Sonstige", "Therapeutischer Index: Verdauung", "Therapeutischer Index: Endokrinologie"],
    keywords: ["appetit", "gewichtsverlust", "gewichtsabnahme", "abmagerung", "kachexie", "untergewicht", "hepeel", "arsuraneel", "china-homaccord", "nux vomica-homaccord"],
  },
  {
    label: "Verdauung/Druck/Blähung/Reflux",
    terms: /verdau|darm|stuhl|bläh|blaeh|druck|spannung|aufsto|reflux|g[äa]rung|dysbio|candida|verstopf|durchfall|krampf|kolik|entleerung/i,
    wikiTitles: ["Therapeutischer Index: Verdauung", "Therapeutischer Index: Sonstige"],
    keywords: ["verdauung", "dyspepsie", "blähungen", "bauchbeschwerden", "druck", "spannung", "aufstoßen", "nux vomica-homaccord", "gastricumeel", "diarrheel", "hepeel", "spascupreel", "mucosa compositum"],
  },
  {
    label: "Schlaf/Regeneration",
    terms: /schlaf|insom|regeneration|ruhe|nacht|night relax|melatonin|tryptophan/i,
    wikiTitles: ["Therapeutischer Index: Psyche", "Therapeutischer Index: Neurologie"],
    keywords: ["schlaf", "regeneration", "night relax", "nervoheel", "neurexan", "tonico-heel", "passionsblume", "lavendel", "melatonin"],
  },
  {
    label: "Psyche/Angst/Depression/Isolation",
    terms: /angst|depress|psyche|nerv|isolation|sozial|stimmung|konzentration|rückzug|rueckzug/i,
    wikiTitles: ["Therapeutischer Index: Psyche", "Therapeutischer Index: Neurologie"],
    keywords: ["psyche", "depression", "emotionale belastungen", "angst", "nervoheel", "neuro-heel", "tonico-heel", "ignatia-homaccord", "cerebrum compositum"],
  },
  {
    label: "Schmerz/Bewegungsapparat",
    terms: /gelenk|muskel|schmerz|rücken|ruecken|neuralg|arthr|fibromy/i,
    wikiTitles: ["Therapeutischer Index: Bewegungsapparat", "Therapeutischer Index: Neurologie"],
    keywords: ["schmerz", "gelenk", "muskel", "neuralgie", "traumeel", "discus compositum", "zeel", "colocynthis"],
  },
  {
    label: "Haut/Allergie/Schleimhaut",
    terms: /haut|ekzem|juck|allerg|schleimhaut|rhinitis|hno|atemweg/i,
    wikiTitles: ["Therapeutischer Index: Haut", "Therapeutischer Index: HNO", "Therapeutischer Index: Atemwege"],
    keywords: ["haut", "ekzem", "allergie", "schleimhaut", "rhinitis", "mucosa compositum", "lymphomyosot", "galium-heel"],
  },
  {
    label: "Onkologie/Krebs/Metastasen",
    terms: /\b(krebs|karzinom|carcinom|tumor|metasta|onko|cancer|mamma[\s-]?ca|brustkrebs|endometrium|prostata[\s-]?ca|leuk[äa]m|lymphom|sarkom|z\.?n\.?\s*mamma|zn\.?\s*mamma|rezidiv)\b/i,
    wikiTitles: [
      "Cancer – Therapieprotokoll (Ausleitung, Papainkur, Antioxidative Therapie)",
      "Diamond Shield – Begleitprotokoll bei Cancer",
      "Cancer",
    ],
    keywords: [
      "cancer", "krebs", "karzinom", "tumor", "metastasen", "onkologie",
      "malonsäure", "papain", "wermut", "l-cystein",
      "mannavan antioxi", "mannavan vit c", "mannavan beta", "mannavan b6", "mannavan glucan", "mannavan curcu", "mannavan oligo",
      "vitamin c hochdosis", "glutathion", "selen", "zink", "q10", "coenzym q10",
      "mistel", "viscum", "diamond shield", "fve-chipcard", "br-chipcard", "tum-chipcard", "clst-chipcard",
      "nk-zellen", "interferon", "papainkur",
    ],
  },
];

function getActiveSymptomTargets(queryText: string): SymptomTarget[] {
  return SYMPTOM_TARGETS.filter((target) => target.terms.test(queryText));
}

function expandQueryForScoring(queryText: string): string {
  const extra = getActiveSymptomTargets(queryText)
    .flatMap((target) => [...target.wikiTitles, ...target.keywords])
    .join(" ");
  return [extra, queryText].filter(Boolean).join(" ");
}

// Scored-Auswahl der relevantesten Wiki-Einträge basierend auf Query-Tokens.
// Liefert auch das vollständige Scoring zurück, damit das Frontend transparent
// anzeigen kann, welche Einträge die KI gesehen hat (und welche aussortiert wurden).
export interface ScoredEntry { entry: WikiEntry; score: number; included: boolean; reason?: string }

function selectRelevantEntriesScored(
  entries: WikiEntry[],
  queryText: string,
  maxChars: number,
): { selected: WikiEntry[]; scored: ScoredEntry[] } {
  const tokens = tokenizeQuery(queryText);

  const scored = entries.map((e) => {
    const haystack = normalizeTherapyKnowledgeSearchText(
      e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || "")
    );
    let score = 0;
    if (tokens.length === 0) {
      score = 1; // Fallback gleich gewichten
    } else {
      for (const tok of tokens) {
        if (normalizeTherapyKnowledgeSearchText(e.title || "").includes(tok)) score += 10;
        if ((e.tags || []).some((t) => normalizeTherapyKnowledgeSearchText(t).includes(tok))) score += 5;
        const matches = haystack.split(tok).length - 1;
        score += Math.min(matches, 8);
      }
    }
    return { entry: e, score, included: false } as ScoredEntry;
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: WikiEntry[] = [];
  let totalChars = 0;
  for (const s of scored) {
    const entryLen = Math.min((s.entry.content || "").length, MAX_ENTRY_CHARS) + 200;
    if (totalChars + entryLen > maxChars) {
      s.included = false;
      s.reason = "Zeichenlimit erreicht – nicht im Kontext";
      continue;
    }
    // Mindestrelevanz: mind. ein Tag-Treffer (5) oder Titel-Treffer (10).
    // Reine Substring-Treffer im Content (Score 1-4) sind zu schwach und blähen
    // den Kontext mit irrelevanten Einträgen auf.
    if (s.score < 5) {
      s.included = false;
      s.reason = s.score === 0
        ? "Kein Treffer für die Query-Tokens"
        : `Unter Mindestrelevanz (Score ${s.score}, nur schwacher Content-Treffer)`;
      continue;
    }
    selected.push(s.entry);
    s.included = true;
    totalChars += entryLen;
  }

  console.log(
    `Wiki filter: ${selected.length}/${entries.length} entries selected (` +
    `query tokens=${tokens.length}, top scores=${scored.slice(0, 3).map((s) => s.score).join(",")})`
  );
  return { selected, scored };
}

function buildEntryContent(entry: WikiEntry, queryText: string): string {
  const content = entry.content || "";
  if (content.length <= MAX_ENTRY_CHARS) return content;
  const tokens = tokenizeQuery(queryText);
  const lines = content.split("\n");
  const picked = new Set<number>();

  lines.forEach((line, idx) => {
    const normalized = normalizeTherapyKnowledgeSearchText(line);
    const isHeading = /^#{2,4}\s/.test(line);
    const hit = tokens.some((tok) => normalized.includes(tok));
    if (hit || (isHeading && tokens.some((tok) => normalized.includes(tok)))) {
      for (let i = Math.max(0, idx - 2); i <= Math.min(lines.length - 1, idx + 8); i++) picked.add(i);
    }
  });

  const snippets = Array.from(picked).sort((a, b) => a - b).map((i) => lines[i]).join("\n").trim();
  const head = content.slice(0, Math.min(MAX_ENTRY_CHARS, snippets ? 1200 : MAX_ENTRY_CHARS));
  const combined = snippets && !head.includes(snippets.slice(0, 120))
    ? `${head}\n\n### Relevante Trefferstellen im Eintrag\n${snippets}`
    : head;
  const marker = `\n\n[WIKI-AUSZUG GEKUERZT: Originaleintrag ${content.length} Zeichen; der vollstaendige Text bleibt im internen Wiki erhalten.]`;
  const available = MAX_ENTRY_CHARS - marker.length;
  const candidate = combined.slice(0, available);
  const wordBoundary = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
  const cutoff = wordBoundary >= Math.floor(available * 0.7) ? wordBoundary : available;
  return `${candidate.slice(0, cutoff).trimEnd()}${marker}`;
}

function buildEntryMetadata(entry: WikiEntry): string {
  const sources = Array.isArray(entry.source_citations)
    ? entry.source_citations.map((source) => source?.url || source?.label || "").filter(Boolean)
    : [];
  return [
    `Eintragsart: ${entry.entry_kind || "unknown"}`,
    `Pruefstatus: ${entry.review_status || "unreviewed"}`,
    `Evidenz: ${entry.evidence_level || "unrated"}`,
    `Dosierungsstatus: ${entry.dosage_status || "unverified"}`,
    `Rechtestatus: ${entry.rights_status || "unknown"}`,
    entry.therapeutic_topics?.length ? `Therapiethemen: ${entry.therapeutic_topics.join(", ")}` : "",
    entry.contraindications?.length ? `Kontraindikationen: ${entry.contraindications.join(", ")}` : "",
    entry.interaction_tags?.length ? `Interaktions-Tags: ${entry.interaction_tags.join(", ")}` : "",
    entry.safety_notes ? `Sicherheit: ${entry.safety_notes}` : "",
    `Patientenausgabe: ${entry.patient_facing_allowed === true ? "freigegeben" : "nicht freigegeben"}`,
    `Werbe-/Produktaussagen: ${entry.commercial_claims_reviewed === true ? "geprueft" : "nicht geprueft"}`,
    sources.length ? `Quellen: ${sources.join("; ")}` : "Quellen: nicht strukturiert hinterlegt",
  ].filter(Boolean).join("\n");
}

function buildContext(entries: WikiEntry[], queryText: string, maximumCharacters = MAX_TOTAL_CHARS) {
  const separator = "\n\n---\n\n";
  const blocks: string[] = [];
  const includedEntryIds = new Set<string>();
  const omittedEntryIds = new Set<string>();
  let used = 0;

  entries.forEach((entry) => {
    const content = buildEntryContent(entry, queryText);
    const block = `### ${entry.title} [${entry.category}] Wiki-ID: ${entry.id} Tags: ${(entry.tags || []).join(", ")}\n${buildEntryMetadata(entry)}\n\n${content}`;
    const additional = (blocks.length > 0 ? separator.length : 0) + block.length;
    if (used + additional > maximumCharacters) {
      omittedEntryIds.add(entry.id);
      return;
    }
    blocks.push(block);
    includedEntryIds.add(entry.id);
    used += additional;
  });

  return {
    text: blocks.length > 0 ? blocks.join(separator) : "(Keine relevanten Wissensdatenbank-Einträge gefunden)",
    includedEntryIds,
    omittedEntryIds,
  };
}

function buildPhaseOneShortlist(scored: ScoredEntry[], maxItems = 80): string {
  const relevant = scored
    .filter((s) => s.score > 0)
    .slice(0, maxItems);
  if (relevant.length === 0) return "";
  return `### PHASE 1 – Gesamt-Wiki-Sichtung (alle Kategorien)\nDie folgenden Kandidaten wurden aus der gesamten Wissensdatenbank bewertet. Phase 2 muss daraus fachlich auswählen; keine Kategorie oder Produktlinie ist exklusiv.\n${relevant.map((s, idx) => `${idx + 1}. [${s.entry.category}] ${s.entry.title} – ${s.reason || `Score ${s.score}`}${s.included ? " → Volltext in Phase 2" : ""}`).join("\n")}`;
}

function entryText(e: WikiEntry): string {
  return normalizeTherapyKnowledgeSearchText(`${e.title} ${e.category} ${(e.tags || []).join(" ")} ${(e.therapeutic_topics || []).join(" ")} ${(e.interaction_tags || []).join(" ")} ${e.content || ""}`);
}

function isVitaplaceProbiotic(e: WikiEntry): boolean {
  const text = entryText(e);
  const title = (e.title || "").toLowerCase();
  return (
    text.includes("vitaplace") &&
    (
      title.includes("biotik") ||
      text.includes("probiotik") ||
      text.includes("bifidobacterium") ||
      text.includes("lactobacillus") ||
      text.includes("inulin") ||
      text.includes(normalizeTherapyKnowledgeSearchText("resistente stärke"))
    )
  );
}

function extractProbioticHighlights(e: WikiEntry): string {
  const matches = (e.content || "").match(/(Bifidobacterium\s+[A-Za-z0-9\- ]+|Lactobacillus\s+[A-Za-z0-9\- ]+|Akkermansia\s+muciniphila|Faecalibacterium\s+prausnitzii|Inulin|Resistente Stärke)/gi) || [];
  return Array.from(new Set(matches.map((m) => m.trim().replace(/\s+/g, " ")))).slice(0, 14).join(", ");
}

function prioritySortEntries(entries: WikiEntry[], queryText: string, preferredLines: string[], manualTitles: string[], symptomTargets: SymptomTarget[] = []): WikiEntry[] {
  const query = normalizeTherapyKnowledgeSearchText(queryText);
  const probioticTerms = ["bifidobacterium", "lactobacillus", "akkermansia", "faecalibacterium", "enterococcus", "probiotik", "präbiotik", "mikrobiom", "darmflora", "darmaufbau"].map(normalizeTherapyKnowledgeSearchText);
  const preferred = preferredLines.map(normalizeTherapyKnowledgeSearchText);
  const manual = manualTitles.map(normalizeTherapyKnowledgeSearchText);
  const score = (e: WikiEntry) => {
    const text = entryText(e);
    let s = 0;
    if (manual.includes(normalizeTherapyKnowledgeSearchText(e.title || ""))) s += 100_000;
    for (const target of symptomTargets) {
      if (target.wikiTitles.some((title) => normalizeTherapyKnowledgeSearchText(title) === normalizeTherapyKnowledgeSearchText(e.title || ""))) s += 80_000;
      if (/homotoxikologie/i.test(e.category || "") && target.keywords.some((kw) => text.includes(normalizeTherapyKnowledgeSearchText(kw)))) s += 60_000;
    }
    if (/homotoxikologie/i.test(e.category || "") && /therapeutischer\s+index/i.test(e.title || "")) s += 70_000;
    if (isVitaplaceProbiotic(e)) s += 50_000;
    for (const line of preferred) if (line && text.includes(line)) s += 5_000;
    for (const term of probioticTerms) {
      if (query.includes(term) && text.includes(term)) s += 2_000;
      if (text.includes(term)) s += 100;
    }
    if ((e.category || "").toLowerCase().includes("stuhldiagnostik")) s += 500;
    return s;
  };
  return [...entries].sort((a, b) => score(b) - score(a));
}

async function loadInfothekKnowledgeDocuments(adminClient: any): Promise<{ documents: InfothekKnowledgeDocument[]; errors: string[]; cacheHit: boolean }> {
  const now = Date.now();
  if (INFOTHEK_CACHE && now - INFOTHEK_CACHE.builtAt < INFOTHEK_CACHE_TTL_MS) {
    return { documents: INFOTHEK_CACHE.documents, errors: INFOTHEK_CACHE.errors, cacheHit: true };
  }

  const loaded = await Promise.all(INFOTHEK_KNOWLEDGE_FILES.map(async (filename) => {
    const { data, error } = await adminClient.storage.from("website-content").download(`infothek/${filename}`);
    if (error || !data) return { error: `${filename}: ${error?.message || "nicht gefunden"}` };
    return { document: infothekHtmlToKnowledgeDocument(filename, await data.text()) };
  }));
  const documents = loaded.flatMap((item) => "document" in item && item.document ? [item.document] : []);
  const errors = loaded.flatMap((item) => "error" in item && item.error ? [item.error] : []);
  INFOTHEK_CACHE = { documents, errors, builtAt: now };
  return { documents, errors, cacheHit: false };
}

function stagingSearchFilter(columns: string[], tokens: string[]): string {
  const variants = (token: string) => {
    const umlaut = token
      .replace(/ae/g, "ä")
      .replace(/oe/g, "ö")
      .replace(/ue/g, "ü")
      .replace(/ss/g, "ß");
    return [...new Set([token, umlaut])];
  };
  return tokens.flatMap((token) => variants(token)
    .flatMap((variant) => columns.map((column) => `${column}.ilike.%${variant}%`)))
    .join(",");
}

async function loadRelevantStagingKnowledgeCandidates(
  adminClient: any,
  queryText: string,
): Promise<{ candidates: StagingKnowledgeCandidate[]; errors: string[] }> {
  const genericTerms = new Set(["aktuelle", "bekannte", "symptome", "erkrankungen", "diagnosen", "patientenkontext", "befund", "auswertung", "quelle", "datum"]);
  const searchTokens = tokenizeQuery(queryText)
    .map((token) => token.replace(/[^\p{L}\p{N}-]+/gu, ""))
    .filter((token) => token.length >= 4 && !genericTerms.has(token))
    .slice(0, 8);
  if (searchTokens.length === 0) return { candidates: [], errors: [] };

  const statuses = ["imported_unreviewed", "needs_clarification", "accepted_as_draft"];
  const configs = [
    {
      table: "kb_source_candidates",
      kind: "source" as const,
      select: "id, candidate_status, title, publisher, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data",
      columns: ["title", "publisher", "source_locator", "original_excerpt", "ambiguity_notes"],
      label: (row: any) => row.title,
      text: (row: any) => [row.publisher, row.original_excerpt, row.ambiguity_notes].filter(Boolean).join("\n"),
    },
    {
      table: "kb_entity_candidates",
      kind: "entity" as const,
      select: "id, candidate_status, display_name, aliases, description_markdown, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data",
      columns: ["display_name", "description_markdown", "source_locator", "original_excerpt", "ambiguity_notes"],
      label: (row: any) => row.display_name,
      text: (row: any) => [Array.isArray(row.aliases) ? row.aliases.join(", ") : "", row.description_markdown, row.original_excerpt, row.ambiguity_notes].filter(Boolean).join("\n"),
    },
    {
      table: "kb_relation_candidates",
      kind: "relation" as const,
      select: "id, candidate_status, candidate_key, proposed_relation_type_code, assignment_strength, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data",
      columns: ["candidate_key", "proposed_relation_type_code", "assignment_strength", "source_locator", "original_excerpt", "ambiguity_notes"],
      label: (row: any) => row.proposed_relation_type_code || row.candidate_key,
      text: (row: any) => [row.assignment_strength, row.original_excerpt, row.ambiguity_notes].filter(Boolean).join("\n"),
    },
    {
      table: "kb_dosage_candidates",
      kind: "dosage" as const,
      select: "id, candidate_status, application_route, minimum_dose, maximum_dose, dose_unit, reference_period, frequency_text, duration_text, timing_text, application_text, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data",
      columns: ["application_route", "dose_unit", "reference_period", "frequency_text", "duration_text", "timing_text", "application_text", "source_locator", "original_excerpt", "ambiguity_notes"],
      label: (row: any) => row.application_text || "Dosierung pruefen",
      text: (row: any) => [row.application_route, row.minimum_dose, row.maximum_dose, row.dose_unit, row.reference_period, row.frequency_text, row.duration_text, row.timing_text, row.original_excerpt, row.ambiguity_notes].filter((value) => value !== null && value !== undefined && value !== "").join(" | "),
    },
    {
      table: "kb_safety_candidates",
      kind: "safety" as const,
      select: "id, candidate_status, rule_type, severity, action_text, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data",
      columns: ["rule_type", "severity", "action_text", "source_locator", "original_excerpt", "ambiguity_notes"],
      label: (row: any) => row.action_text || "Sicherheit pruefen",
      text: (row: any) => [row.rule_type, row.severity, row.original_excerpt, row.ambiguity_notes].filter(Boolean).join("\n"),
    },
  ];

  const results = await Promise.all(configs.map(async (config) => {
    const { data, error } = await adminClient.from(config.table)
      .select(config.select)
      .in("candidate_status", statuses)
      .or(stagingSearchFilter(config.columns, searchTokens))
      .limit(8);
    if (error) return { config, rows: [] as any[], error: `${config.table}: ${error.message}` };
    return { config, rows: Array.isArray(data) ? data : [], error: "" };
  }));
  const candidates = results.flatMap(({ config, rows }) => rows.map((row: any) => ({
    id: String(row.id),
    kind: config.kind,
    status: String(row.candidate_status || "imported_unreviewed"),
    label: String(config.label(row) || "Kandidat ohne Bezeichnung"),
    text: String(config.text(row) || ""),
    sourceLocator: typeof row.source_locator === "string" ? row.source_locator : undefined,
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    proposedData: row.proposed_data,
  })));
  return {
    candidates: selectRelevantStagingCandidates(candidates, tokenizeQuery(queryText)),
    errors: results.flatMap((result) => result.error ? [result.error] : []),
  };
}

function sanitizeRecommendation(text: string): string {
  return text.trim();
}

function buildSymptomDirective(queryText: string, hasHomotoxContext: boolean): string {
  const directives = getActiveSymptomTargets(queryText).map(
    (target) => `- ${target.label}: Prüfe gezielt ${target.wikiTitles.join(", ")} und leite daraus zusätzlich zu Darmmitteln passende Mittel ab.`
  );
  if (!hasHomotoxContext || directives.length === 0) return "";
  return `\n\n🎯 SYMPTOM-ÜBERSETZUNG IN HOMOTOXIKOLOGIE/HEEL (KANDIDATENPRÜFUNG):\n${directives.join("\n")}\n- Nur fachlich passende, belegte und sichere Treffer innerhalb des Mengenlimits nennen.\n- Darmaufbau darf Symptome nicht vollständig überdecken; Labor/Stuhl, Symptome und Schwerpunkt-Ordner getrennt bewerten.`;
}

async function readAiStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          accumulated += parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || "";
        } catch {
          // Ignore malformed stream fragments; gateway frames are newline-delimited.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return accumulated;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-context client – validates JWT via RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify token by getting user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service role client (bypasses RLS)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Nur für Administratoren" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitKey = `therapy-recommend:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[therapy-recommend] Admin AI recommendation rate limit exceeded");
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Patientenkontext vor jeder externen KI-Verarbeitung deterministisch bereinigen.
    const requestBody = deidentifyClinicalData(await req.json()) as Record<string, any>;
    const residualIdentifiers = directIdentifierCategories(JSON.stringify(requestBody));
    if (residualIdentifiers.length) {
      return new Response(JSON.stringify({ error: `Datenschutz-Sicherheitsstopp: ${residualIdentifiers.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { belastungen, symptome, erkrankung, manualDiagnosen, alter, geschlecht, groesseCm, gewichtKg, bmi, bmiKategorie, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, metatronDatum, sonstigeUntersuchungen, vievaPlus, vievaPlusDatum, befundAuswertung, perplexityAnalyse, eigeneTherapieVorlage, mannayanOrders, categories, bevorzugteLinie, pinnedMittel, useMapReduce, useProModel, nachschlag, previousResult, previousResultForCompare } = requestBody;
    const manualDiagnosesText = Array.isArray(manualDiagnosen)
      ? manualDiagnosen.map((entry: any) => [entry?.icd10, entry?.diagnose, entry?.begruendung]
          .map((value) => String(value || "").trim()).filter(Boolean).join(" | ")).filter(Boolean).join("\n")
      : "";
    const metatronHeelText: string = typeof metatronHeel === "string" ? metatronHeel.trim() : "";
    const sonstigeUntersuchungenText: string = typeof sonstigeUntersuchungen === "string" ? sonstigeUntersuchungen.trim() : "";
    const vievaPlusText: string = typeof vievaPlus === "string" ? vievaPlus.trim() : "";
    const befundAuswertungText: string = typeof befundAuswertung === "string" ? befundAuswertung.trim() : "";
    const perplexityAnalyseText: string = typeof perplexityAnalyse === "string" ? perplexityAnalyse.trim() : "";
    const eigeneTherapieText: string = typeof eigeneTherapieVorlage === "string" ? eigeneTherapieVorlage.trim() : "";
    const mannayanOrdersText: string = Array.isArray(mannayanOrders)
      ? mannayanOrders.map((order: any) => {
          const items = Array.isArray(order?.items) ? order.items.map((it: any) => `- ${Number(it?.quantity) || 1}× ${String(it?.name || "").trim()}${it?.unit ? ` (${it.unit})` : ""}${it?.sku ? ` · Art.-Nr. ${it.sku}` : ""}`).join("\n") : "";
          return `Bestellung ${order?.orderNumber || "—"} vom ${order?.createdAt || "Datum unbekannt"}${order?.notes ? ` · Notiz: ${order.notes}` : ""}\n${items}`.trim();
        }).filter(Boolean).join("\n\n")
      : "";
    // Hinweis-Log für sehr große Patienten-Kontexte (KEIN Trimmen – Gemini-Pro-Modell hat 1M Token Kontext).
    const totalPatientChars = (sonstigeUntersuchungenText.length + vievaPlusText.length + befundAuswertungText.length + perplexityAnalyseText.length + eigeneTherapieText.length + mannayanOrdersText.length + (typeof arztbericht === "string" ? arztbericht.length : 0) + (typeof laborKomplett === "string" ? laborKomplett.length : 0));
    if (totalPatientChars > 80_000) {
      console.warn(`[therapy-recommend] Großer Patienten-Kontext: ${totalPatientChars} Zeichen (sonstige=${sonstigeUntersuchungenText.length}, perplexity=${perplexityAnalyseText.length}). Verarbeitet vollständig${useProModel ? " (Pro-Modell aktiv)" : " — Pro-Modell empfohlen"}.`);
    }

    const isNachschlag = typeof nachschlag === "string" && nachschlag.trim().length > 0 && typeof previousResult === "string" && previousResult.trim().length > 0;

    if (!belastungen && !symptome && !erkrankung && !manualDiagnosesText && !sonstigeUntersuchungenText && !vievaPlusText && !befundAuswertungText && !perplexityAnalyseText && !eigeneTherapieText && !mannayanOrdersText && !isNachschlag) {
      throw new Error("Bitte geben Sie mindestens Belastungen, Symptome oder eine Erkrankung an.");
    }

    // Fetch structured wiki entries (cached) and select only the relevant ones for this query.
    const { entries: cachedEntries, cacheHit } = await loadWikiEntries(userClient);
    let allEntries = cachedEntries.filter((entry) => entry.review_status !== "restricted");

    // Nur fachlich freigegebene Produktverknuepfungen als Zusatzkontext laden.
    // Die Verknuepfung ist ausdruecklich kein Wirksamkeitsnachweis.
    const { data: linkRows, error: linkError } = await userClient
      .from("knowledge_product_links")
      .select("knowledge_entry_id, relation_type, clinical_topics, confidence, safety_notes, mannayan_products(name, sku, unit, is_active)")
      .eq("review_status", "reviewed");
    if (linkError) {
      console.warn("Mannayan-Zuordnungen nicht geladen:", linkError.message);
    } else if (Array.isArray(linkRows) && linkRows.length) {
      const linksByKnowledge = new Map<string, string[]>();
      linkRows.forEach((row: any) => {
        const product = Array.isArray(row.mannayan_products) ? row.mannayan_products[0] : row.mannayan_products;
        if (!product?.is_active) return;
        const lines = linksByKnowledge.get(row.knowledge_entry_id) || [];
        lines.push([
          `${product.name}${product.sku ? ` (Art.-Nr. ${product.sku})` : ""}`,
          `Beziehung: ${row.relation_type}`,
          `Vertrauen: ${row.confidence}%`,
          Array.isArray(row.clinical_topics) && row.clinical_topics.length ? `Themen: ${row.clinical_topics.join(", ")}` : "",
          row.safety_notes ? `Sicherheit: ${row.safety_notes}` : "",
        ].filter(Boolean).join(" | "));
        linksByKnowledge.set(row.knowledge_entry_id, lines);
      });
      allEntries = allEntries.map((entry) => {
        const links = linksByKnowledge.get(entry.id);
        return links?.length
          ? { ...entry, content: `${entry.content}\n\n### Gepruefte Mannayan-Zuordnung (kein Wirksamkeitsnachweis)\n${links.map((line) => `- ${line}`).join("\n")}` }
          : entry;
      });
    }

    // Schwerpunkt-Ordner priorisieren die Gesamtsuche, ohne andere Kategorien auszuschliessen.
    const selectedCats: string[] = Array.isArray(categories)
      ? categories.filter((c: unknown) => typeof c === "string" && c.trim().length > 0)
      : [];
    // WICHTIG: Suchpool bleibt IMMER die gesamte Datenbank.
    const filteredByCategory = allEntries;
    const boostEntries: WikiEntry[] = selectedCats.length === 0
      ? []
      : allEntries.filter((e) =>
          selectedCats.some((c) => e.category === c || e.category.startsWith(c + " >"))
        );
    console.log(
      `Boost folders: ${selectedCats.length === 0 ? "NONE" : selectedCats.join(", ")} → ` +
      `${boostEntries.length} boost matches (search pool: ${allEntries.length})`
    );

    // Pinned remedies: titles to ALWAYS include in context
    const pinnedTitles: string[] = Array.isArray(pinnedMittel)
      ? pinnedMittel
          .map((p: unknown) => {
            if (typeof p !== "object" || p === null || !("title" in p)) return "";
            const title = (p as { title?: unknown }).title;
            return typeof title === "string" ? title.trim() : "";
          })
          .filter((t: string) => t.length > 0)
      : [];

    // Bevorzugte Produktlinien (Tags / Kategorie-Hinweise für die KI)
    const preferredLines: string[] = Array.isArray(bevorzugteLinie)
      ? bevorzugteLinie.filter((l: unknown) => typeof l === "string" && (l as string).trim().length > 0)
      : [];

    const queryText = [belastungen, symptome, erkrankung, manualDiagnosesText, laborErhoeht, laborErniedrigt, befundAuswertungText, stuhlbefund, laborKomplett, arztbericht, metatronHeelText, vievaPlusText, sonstigeUntersuchungenText, bisherigeMittel, perplexityAnalyseText, eigeneTherapieText, mannayanOrdersText, isNachschlag ? nachschlag : "", preferredLines.join(" "), pinnedTitles.join(" "), selectedCats.join(" ")]
      .filter(Boolean)
      .join(" ");
    const activeSymptomTargets = getActiveSymptomTargets(queryText);
    const scoringQueryText = expandQueryForScoring(queryText);
    const knowledgeQueryTokens = tokenizeQuery(scoringQueryText);
    const infothekLoad = await loadInfothekKnowledgeDocuments(adminClient);
    const selectedInfothekDocuments = selectRelevantInfothekDocuments(infothekLoad.documents, knowledgeQueryTokens);
    const infothekContext = buildInfothekKnowledgeContext(selectedInfothekDocuments);
    const stagingLoad = await loadRelevantStagingKnowledgeCandidates(adminClient, scoringQueryText);
    const stagingContext = buildStagingKnowledgeContext(stagingLoad.candidates);
    if (infothekLoad.errors.length > 0) console.warn("Infothek-Kontext teilweise nicht geladen:", infothekLoad.errors);
    if (stagingLoad.errors.length > 0) console.warn("Staging-Kontext teilweise nicht geladen:", stagingLoad.errors);
    console.log(`Zusatzwissen: Infothek ${selectedInfothekDocuments.length}/${infothekLoad.documents.length}, Staging ${stagingLoad.candidates.length}, Zeichen ${infothekContext.length + stagingContext.length}`);
    const hasHomotoxContext = activeSymptomTargets.length > 0 || selectedCats.some((c) => /homotoxikologie/i.test(c)) || preferredLines.some((l) => /heel|homotox/i.test(l));
    const symptomDirective = buildSymptomDirective(queryText, hasHomotoxContext);

    // ===== AUTO-PINNING: bei Stuhlbefund nur Stuhl-/Mikrobiom-spezifische Einträge mit aufnehmen =====
    // WICHTIG: NICHT die gesamte Kategorie "Labordiagnostik" matchen, sonst werden alle
    // Blutdiagnostik-Einträge (HbA1c, TSH, Hormone …) fälschlich mitgezogen.
    // Mikrobiom-/Stuhl-Stichworte: prüft Titel/Kategorie/Tags UND Content
    // (Probiotika-Produkte listen Stämme oft nur im Content, nicht in Tags – z.B. Vitaplace Biotik Balance)
    const STUHL_REGEX = /stuhl|mikrobiom|darmflora|calprotectin|zonulin|s-?iga|pankreas-?elastase|lactobacillus|bifidobacterium|akkermansia|faecalibacterium|enterococcus|escherichia|klebsiella|alpha-?1-?antitrypsin|probiotik|präbiotik|praebiotik|symbiose|darmsanier|darmaufbau/i;
    const hasMicrobiomeSignal = Boolean(stuhlbefund && stuhlbefund.trim().length > 0) || STUHL_REGEX.test(queryText);
    const autoPinnedFromStuhlCandidates: WikiEntry[] = hasMicrobiomeSignal
      ? filteredByCategory.filter((e) => {
          const text = entryText(e);
          if (STUHL_REGEX.test(text)) return true;
          // Vitaplace-Probiotika immer mitnehmen, sobald ein Stuhlbefund/Mikrobiom vorliegt:
          // sie enthalten die gesuchten Bifido-/Lacto-Stämme oft nur im Content.
          return isVitaplaceProbiotic(e);
        })
      : [];
    const autoPinnedFromStuhl = prioritySortEntries(autoPinnedFromStuhlCandidates, scoringQueryText, preferredLines, pinnedTitles, activeSymptomTargets).slice(0, 6);
    if (autoPinnedFromStuhl.length > 0) {
      console.log(`Auto-Pin: ${autoPinnedFromStuhl.length} Stuhl-/Mikrobiom-Einträge wegen Stuhlbefund (inkl. Content-Treffer)`);
    }

    // ===== AUTO-PINNING: Symptomachsen erzwingen, damit Labor/Stuhl die klinischen Symptome nicht verdrängt =====
    const symptomPinnedCandidates: WikiEntry[] = activeSymptomTargets.length === 0
      ? []
      : allEntries.filter((e) => {
          const title = normalizeTherapyKnowledgeSearchText(e.title || "");
          const text = entryText(e);
          return activeSymptomTargets.some((target) =>
            target.wikiTitles.some((t) => normalizeTherapyKnowledgeSearchText(t) === title) ||
            (/homotoxikologie/i.test(e.category || "") && target.keywords.some((kw) => text.includes(normalizeTherapyKnowledgeSearchText(kw))))
          );
        });
    const symptomPinnedEntries = prioritySortEntries(symptomPinnedCandidates, scoringQueryText, preferredLines, pinnedTitles, activeSymptomTargets).slice(0, 6);
    if (symptomPinnedEntries.length > 0) {
      console.log(`Auto-Pin: ${symptomPinnedEntries.length} Symptom-/Homotoxikologie-Einträge wegen Symptomen (${activeSymptomTargets.map((t) => t.label).join(", ")})`);
    }

    // Force-include only truly mandatory entries.
    // WICHTIG: Boost-Ordner sind KEIN Filter und KEINE Exklusiv-Auswahl; sie markieren nur Schwerpunktbereiche.
    // Die eigentliche Phase-1-Sichtung läuft unten immer über die gesamte Wiki.
    const manualPinned = pinnedTitles.length > 0
      ? allEntries.filter((e) => pinnedTitles.some((t) => normalizeTherapyKnowledgeSearchText(e.title) === normalizeTherapyKnowledgeSearchText(t)))
      : [];
    const sameEntry = (a: WikiEntry, b: WikiEntry) => a.id === b.id;
    const pinnedEntries = [
      ...manualPinned,
      ...symptomPinnedEntries.filter((s) => !manualPinned.some((m) => sameEntry(m, s))),
      ...autoPinnedFromStuhl.filter((a) =>
        !manualPinned.some((m) => sameEntry(m, a)) &&
        !symptomPinnedEntries.some((s) => sameEntry(s, a))
      ),
    ];
    const pinnedReserveChars = pinnedEntries.reduce(
      (sum, e) => sum + Math.min((e.content || "").length, MAX_ENTRY_CHARS) + 200,
      0
    );

    // Score the rest, but exclude already-pinned entries
    const restPool = filteredByCategory.filter((entry) => !pinnedEntries.some((pinned) => sameEntry(pinned, entry)));
    const remainingBudget = Math.max(2000, MAX_TOTAL_CHARS - pinnedReserveChars);

    let restRelevant: WikiEntry[];
    let restScored: ScoredEntry[];
    let mapReduceUsed = false;
    const mustUseFullWikiMapReduce = useMapReduce === true;

    if (mustUseFullWikiMapReduce && restPool.length > 0) {
      // ===== MAP-REDUCE STUFE 1: KI bewertet IMMER ALLE Wiki-Einträge in Batches =====
      mapReduceUsed = true;
      const aiScores = await scoreEntriesViaAI(restPool, queryText, LOVABLE_API_KEY);

      // Kombiniere KI-Score (×10 Gewicht) + Wort-Score (Fallback für unbewertete Einträge)
      const wordScoreTokens = tokenizeQuery(scoringQueryText);
      const wordScored = restPool.map((e) => {
        const haystack = normalizeTherapyKnowledgeSearchText(e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || ""));
        let s = 0;
        for (const tok of wordScoreTokens) {
          if (normalizeTherapyKnowledgeSearchText(e.title || "").includes(tok)) s += 10;
          if ((e.tags || []).some((t) => normalizeTherapyKnowledgeSearchText(t).includes(tok))) s += 5;
          s += Math.min(haystack.split(tok).length - 1, 8);
        }
        const aiScore = aiScores.get(e.id);
        // KI-Score dominiert; Wort-Score nur als Fallback wenn KI nicht antwortete
        const finalScore = aiScore !== undefined ? aiScore * 100 : s;
        return { entry: e, score: finalScore, included: false, reason: aiScore !== undefined ? `KI-Score ${aiScore}/10` : `Wort-Score ${s} (KI keine Antwort)` } as ScoredEntry;
      });
      wordScored.sort((a, b) => b.score - a.score);

      // Nimm Top-N nach Score, solange Zeichenbudget reicht UND Mindestrelevanz erfüllt
      // Mindestrelevanz: KI-Score >= 4/10 (= finalScore >= 400) ODER reiner Wort-Score >= 5.
      // Damit verhindern wir, dass KI-Scores 1-3 (z.B. Blutdiagnostik bei reinem Stuhlbefund)
      // den Kontext mit irrelevanten Einträgen aufblähen.
      const MIN_AI_SCORE = 400;   // entspricht KI-Score 4/10
      const MIN_WORD_SCORE = 5;   // mindestens ein klarer Tag-/Titel-Treffer
      restRelevant = [];
      let totalChars = 0;
      let taken = 0;
      let droppedLowRelevance = 0;
      for (const s of wordScored) {
        if (pinnedEntries.some((p) => sameEntry(p, s.entry))) {
          s.included = false;
          s.reason = `Bereits als Pflichtkontext enthalten (${s.reason})`;
          continue;
        }
        const isAiScored = s.reason?.startsWith("KI-Score");
        const meetsMinimum = isAiScored
          ? s.score >= MIN_AI_SCORE
          : s.score >= MIN_WORD_SCORE;
        if (!meetsMinimum) {
          s.included = false;
          s.reason = `Unter Mindestrelevanz (${s.reason})`;
          droppedLowRelevance++;
          continue;
        }
        if (taken >= MAP_REDUCE_TOP_N) {
          s.included = false;
          s.reason = `Top-${MAP_REDUCE_TOP_N}-Limit erreicht (${s.reason})`;
          continue;
        }
        const entryLen = Math.min((s.entry.content || "").length, MAX_ENTRY_CHARS) + 200;
        if (totalChars + entryLen > remainingBudget) {
          s.included = false;
          s.reason = `Zeichenlimit erreicht (${s.reason})`;
          continue;
        }
        restRelevant.push(s.entry);
        s.included = true;
        totalChars += entryLen;
        taken++;
      }
      restScored = wordScored;
      console.log(`Map-Reduce ausgewählt: ${restRelevant.length}/${restPool.length} Einträge (${droppedLowRelevance} unter Mindestrelevanz verworfen)`);
    } else {
      // ===== Klassisch: nur Wort-Score-Filter =====
      const r = selectRelevantEntriesScored(restPool, scoringQueryText, remainingBudget);
      restRelevant = r.selected;
      restScored = r.scored;
    }

    const relevantEntries = prioritySortEntries([...pinnedEntries, ...restRelevant], scoringQueryText, preferredLines, pinnedTitles, activeSymptomTargets);
    const vitaplaceContextFor = (entries: WikiEntry[]) => entries.length > 0
      ? `\n\n### ZWANGSKONTEXT – Vitaplace-Probiotika bei Mikrobiom-/Bifido-/Lacto-Befund\n${entries.map((entry) => `- ${entry.title}: ${extractProbioticHighlights(entry) || "Vitaplace-Probiotikum/Darmaufbau"}`).join("\n")}`
      : "";
    const vitaplaceReserve = vitaplaceContextFor(relevantEntries.filter(isVitaplaceProbiotic)).slice(0, 3000);
    const builtWikiContext = buildContext(relevantEntries, scoringQueryText, MAX_TOTAL_CHARS - vitaplaceReserve.length);
    const entriesInContext = relevantEntries.filter((entry) => builtWikiContext.includedEntryIds.has(entry.id));
    const vitaplaceProbioticsInContext = entriesInContext.filter(isVitaplaceProbiotic);
    const vitaplaceContext = vitaplaceContextFor(vitaplaceProbioticsInContext).slice(0, vitaplaceReserve.length);
    const wikiContext = builtWikiContext.text + vitaplaceContext;
    restScored.forEach((scoredEntry) => {
      if (scoredEntry.included && builtWikiContext.omittedEntryIds.has(scoredEntry.entry.id)) {
        scoredEntry.included = false;
        scoredEntry.reason = "Finales Kontextlimit erreicht – vollständiger Eintrag nicht gesendet";
      }
    });
    const includedPinnedEntries = pinnedEntries.filter((entry) => builtWikiContext.includedEntryIds.has(entry.id));
    const phaseOneShortlist = buildPhaseOneShortlist(restScored, 30);
    console.log(
      `Wiki: ${allEntries.length} total (full DB search) → ` +
      `${includedPinnedEntries.length}/${pinnedEntries.length} pinned im Kontext (${manualPinned.length} manual + ${symptomPinnedEntries.length} auto-symptom + ${autoPinnedFromStuhl.length} auto-stuhl + ${boostEntries.length} boost-folder) + ${restScored.filter((entry) => entry.included).length} relevant, ` +
      `context=${wikiContext.length} chars, cacheHit=${cacheHit}, mapReduce=${mapReduceUsed}, ` +
      `preferredLines=[${preferredLines.join(",")}], symptomAxes=[${activeSymptomTargets.map((t) => t.label).join(",")}]`
    );

    // ========= AUDIT-DATEN für Transparenz im Frontend =========
    const reasonFor = (e: WikiEntry) => {
      if (manualPinned.some((m) => sameEntry(m, e))) return "📌 Manuell gepinnt";
      if (symptomPinnedEntries.some((s) => sameEntry(s, e))) return "🧭 Auto-Pin (Symptome/Homotoxikologie)";
      if (autoPinnedFromStuhl.some((a) => sameEntry(a, e))) return "🔬 Auto-Pin (Stuhlbefund)";
      if (boostEntries.some((b) => sameEntry(b, e))) return "⭐ Schwerpunktordner";
      return "📌 Pinned";
    };
    const usedEntries = [
      ...includedPinnedEntries.map((e) => ({
        title: e.title, category: e.category, score: 9999,
        reason: reasonFor(e)
      })),
      ...restScored.filter((s) => s.included).map((s) => ({
        title: s.entry.title, category: s.entry.category, score: s.score, reason: s.reason || "✅ Relevant"
      })),
    ];
    const skippedPinnedEntries = pinnedEntries
      .filter((entry) => !builtWikiContext.includedEntryIds.has(entry.id))
      .map((entry) => ({
        title: entry.title,
        category: entry.category,
        score: 9999,
        reason: "Finales Kontextlimit erreicht – vollständiger Pflichtkontext nicht gesendet",
      }));
    const skippedEntries = [...skippedPinnedEntries, ...restScored
      .filter((s) => !s.included)
      .slice(0, 50)
      .map((s) => ({
        title: s.entry.title, category: s.entry.category, score: s.score, reason: s.reason || "—"
      }))].slice(0, 50);

    const auditPayload = {
      __audit__: {
        totalInDb: allEntries.length,
        afterCategoryFilter: allEntries.length, // legacy field: search pool = full DB
        boostFolderCount: boostEntries.length,
        pinnedCount: includedPinnedEntries.length,
        pinnedRequestedCount: pinnedEntries.length,
        relevantCount: restScored.filter((entry) => entry.included).length,
        usedCount: usedEntries.length,
        skippedTotalCount: skippedPinnedEntries.length + restScored.filter((s) => !s.included).length,
        contextChars: wikiContext.length,
        contextLimit: MAX_TOTAL_CHARS,
        cacheHit,
        mapReduceUsed,
        queryTokens: tokenizeQuery(queryText),
        queryTokenLimit: MAX_KNOWLEDGE_QUERY_TOKENS,
        symptomAxes: activeSymptomTargets.map((t) => t.label),
        metatronHeelInput: metatronHeelText || null,
        sonstigeUntersuchungenChars: sonstigeUntersuchungenText.length,
        vievaPlusChars: vievaPlusText.length,
        befundAuswertungChars: befundAuswertungText.length,
        perplexityAnalyseChars: perplexityAnalyseText.length,
        eigeneTherapieChars: eigeneTherapieText.length,
        mannayanOrdersCount: Array.isArray(mannayanOrders) ? mannayanOrders.length : 0,
        infothekTotal: infothekLoad.documents.length,
        infothekUsedCount: selectedInfothekDocuments.length,
        infothekContextChars: infothekContext.length,
        infothekCacheHit: infothekLoad.cacheHit,
        infothekErrors: infothekLoad.errors,
        infothekUsed: selectedInfothekDocuments.map((document) => ({ filename: document.filename, title: document.title, score: document.score })),
        stagingUsedCount: stagingLoad.candidates.length,
        stagingContextChars: stagingContext.length,
        stagingErrors: stagingLoad.errors,
        stagingUsed: stagingLoad.candidates.map((candidate) => ({ id: candidate.id, kind: candidate.kind, label: candidate.label, status: candidate.status })),
        boostCategories: selectedCats,
        selectedCategories: selectedCats, // legacy alias
        used: usedEntries,
        skippedSample: skippedEntries,
      },
    };


    // Build patient context
    const patientInfo: string[] = [];
    if (alter) patientInfo.push(`Alter: ${alter} Jahre`);
    if (geschlecht) patientInfo.push(`Geschlecht: ${geschlecht}`);
    if (groesseCm) patientInfo.push(`Körpergröße: ${groesseCm} cm`);
    if (gewichtKg) patientInfo.push(`Körpergewicht: ${gewichtKg} kg`);
    if (typeof bmi === "number") patientInfo.push(`BMI: ${bmi}${bmiKategorie ? ` (${bmiKategorie})` : ""}`);
    if (schwanger) patientInfo.push(`Schwangerschaft/Stillzeit: ${schwanger}`);
    if (medikamente) patientInfo.push(`Aktuelle Medikamente: ${medikamente}`);
    if (bisherigeMittel) patientInfo.push(`Bisherige Naturheilmittel: ${bisherigeMittel}`);
    if (budget) patientInfo.push(`Maximales Budget: ${budget} Euro`);
    if (laborErhoeht) patientInfo.push(`Erhöhte Laborwerte: ${laborErhoeht}`);
    if (laborErniedrigt) patientInfo.push(`Erniedrigte Laborwerte: ${laborErniedrigt}`);
    if (laborKomplett) patientInfo.push(`Komplettes klassisches Labor${laborDatum ? ` (Befunddatum: ${laborDatum})` : ""}: ${laborKomplett}`);
    if (stuhlbefund) patientInfo.push(`Stuhlbefund/Mikrobiom: ${stuhlbefund}`);
    if (arztbericht) patientInfo.push(`Arztbericht/Arztbrief${arztberichtDatum ? ` (Berichtsdatum: ${arztberichtDatum})` : ""} (schulmedizinische Diagnostik & Therapie): ${arztbericht}`);
    if (metatronHeelText) patientInfo.push(`Metatron-Hospital-/NLS-Analyse${metatronDatum ? ` (erstellt am: ${metatronDatum})` : ""} (Resonanzhinweise getrennt von gesicherten Befunden bewerten): ${metatronHeelText}`);
    if (sonstigeUntersuchungenText) patientInfo.push(`Sonstige / unsortierte Voruntersuchungen (gemischte Befunde – Bildgebung/Funktionstests/EAV/NLS/Selbstmessungen/Fremdberichte, ${sonstigeUntersuchungenText.length} Zeichen): ${sonstigeUntersuchungenText}`);
    if (vievaPlusText) patientInfo.push(`Vieva-Plus-Auswertung${vievaPlusDatum ? ` (erstellt am: ${vievaPlusDatum})` : ""} (Vitamin-/Mineralstoffstatus, Aminosäuren und HRV, ${vievaPlusText.length} Zeichen): ${vievaPlusText}`);
    if (perplexityAnalyseText) patientInfo.push(`Externe Perplexity-/AI-Recherche & Literaturauswertung (Zusatzkontext, ${perplexityAnalyseText.length} Zeichen): ${perplexityAnalyseText}`);
    if (eigeneTherapieText) patientInfo.push(`Eigene Therapie-/Verordnungs-Vorlage des Therapeuten (zur fachlichen Plausibilitätsprüfung, NICHT automatisch übernehmen): ${eigeneTherapieText}`);
    if (mannayanOrdersText) patientInfo.push(`Bereits bestellte Mannayan-Präparate für diesen Patienten (als real verordnete/ausgewählte Mittel berücksichtigen): ${mannayanOrdersText}`);

    // Vom Therapeuten uebernommene Resonanzhinweise bleiben Kandidaten und muessen
    // dieselbe Sicherheitspruefung wie alle anderen Mittel durchlaufen.
    const metatronHeelDirective = metatronHeelText
      ? `\n\n🎯 METATRON-HOSPITAL-/NLS-ANALYSE (RESONANZHINWEISE ALS INTERNEN KANDIDATENKONTEXT PRÜFEN):
Der folgende Text kann Organ-/Resonanzbefunde, Belastungshinweise und vorgeschlagene Heel-Komplexmittel enthalten. Extrahiere Mittel nur, wenn sie im Text tatsächlich als Mittel genannt sind:
${metatronDatum ? `Erstellt am: ${metatronDatum}\n` : ""}
${metatronHeelText}

REGELN:
1. Nur fachlich passende Mittel als Kandidaten aufnehmen; keine automatische Pflichtaufnahme.
2. Dosierung nur aus einem konkreten Wiki-/Produktbeleg übernehmen. Fehlt sie, schreibe "Dosierung nicht belegt – manuell prüfen" und erfinde keinen Erfahrungswert.
3. Begründung mit "Resonanzhinweis – nicht alleinige Auswahlgrundlage" kennzeichnen.
4. Bei Kontraindikation, Wechselwirkung, Schwangerschaft oder unklarer Sicherheit NICHT in die auswählbare Kernliste aufnehmen, sondern unter "Manuelle Sicherheitsprüfung" nennen.`
      : "";

    const medicationGroups = recognizeMedicationGroups(medikamente).map((group) => group.label);
    const systemPrompt = `Du erstellst eine INTERNE naturheilkundliche KANDIDATENLISTE zur fachlichen Prüfung durch den behandelnden Heilpraktiker. Du triffst keine endgültige Therapieentscheidung und gibst nichts direkt an Patienten aus.

🛡️ SICHERHEIT UND ESKALATION:
- Red Flags, Notfälle, meldepflichtige Infektionen, unklare Tumorzeichen, akutes Abdomen und notwendige fachärztliche/ärztliche Diagnostik klar benennen. Solche Hinweise niemals unterdrücken.
- Keine Diagnose- oder Behandlungskompetenz behaupten, die aus dem vorliegenden Kontext nicht sicher folgt.
- Kontraindizierte oder potenziell interagierende Mittel nicht als Kernkandidaten ausgeben. Unter "Manuelle Sicherheitsprüfung" mit Grund aufführen.
- Fehlende oder unklare Arzneimittelnamen ausdrücklich als Sicherheitslücke nennen.
- Wiki-Eintraege mit Pruefstatus "unreviewed"/"needs_review" oder Evidenz "unrated" nicht als essentielle Kernkandidaten ausgeben.
- Dosierungen nur verwenden, wenn der Wiki-Metadatensatz "Dosierungsstatus: verified" ausweist; sonst "Dosierung manuell pruefen" schreiben.
- Eine Mannayan-Zuordnung ist nur Produktkontext und niemals alleiniger Wirksamkeits- oder Indikationsnachweis.
- Import-Pruefkandidaten mit Kennung [UNREVIEWED_STAGING:...] bleiben als interne Quellenhinweise erhalten, duerfen aber nie allein ein Kernmittel, eine Dosierung oder eine Freigabe begruenden. Quelleninhalt, Evidenz und Sicherheit getrennt dokumentieren.
- Infothek-Inhalte mit Kennung [INFOTHEK:datei.html] sind ergaenzender Praxis- und Lebensstilkontext. Mittel, Dosierungen oder Wirksamkeitsaussagen daraus nur uebernehmen, wenn ein passender Wiki-Beleg sie traegt; sonst als internen Quellenhinweis oder Wissensluecke ausgeben.
- Erkannte Arzneimittelgruppen: ${medicationGroups.length ? medicationGroups.join(", ") : "keine sicher erkannt"}.
- Disclaimer: "Interne Kandidatenliste – jede Auswahl wird fachlich, produktspezifisch und anhand der aktuellen Medikation geprüft."

Du hast Zugriff auf die folgende Wissensdatenbank mit Naturheilmitteln, Pathogenen und Therapieprotokollen.

WISSENSDATENBANK:
${wikiContext}

${stagingContext || "INTERNE IMPORT-PRUEFKANDIDATEN: Keine relevanten Treffer fuer diesen Fall."}

${infothekContext || "ERGÄNZENDER INFOTHEK-KONTEXT: Keine relevanten HTML-Treffer fuer diesen Fall."}

${phaseOneShortlist ? `\n${phaseOneShortlist}\n` : ""}

DEINE AUFGABE:
Analysiere Belastungen, Labor/Stuhl und Symptome. Erstelle eine priorisierte interne Kandidatenliste basierend auf belegten Wiki-Inhalten. Trenne klar zwischen Kernkandidaten, Reserve und manueller Sicherheitspruefung.

MENGENLIMIT:
- Hoechstens 3 essentielle und 3 empfohlene Kernkandidaten.
- Hoechstens 4 weitere optionale Reservekandidaten.
- Pro klinischem Hauptthema hoechstens 2 Mittel; wirkgleiche oder inhaltsgleiche Produkte nicht doppeln.
- Ein Wiki-Treffer ist nur ein Kandidat und keine Pflichtaufnahme.
- Der Startplan darf hoechstens 3 gleichzeitig neu beginnende Mittel enthalten. Weitere passende Kandidaten muessen klar als Reserve oder spaetere Phase gekennzeichnet werden, nicht parallel angesetzt werden.
- Ernaehrung und Verhalten sind gleichwertige Therapiebausteine und zaehlen nicht als zusaetzliche Mittel. Formuliere dort jeweils hoechstens 3 konkret umsetzbare, zum Befund passende Schritte.

ZWEISTUFIGER WIKI-PROZESS (VERBINDLICH FÜR ALLE PATIENTEN):
- Phase 1 ist die Gesamt-Wiki-Sichtung: ALLE Einträge aus ALLEN Kategorien werden gegen die Eingabe aus der Therapie-Maske bewertet. Es gibt keine Beschränkung auf Homotoxikologie, Heel, Vitaplace oder Stuhldiagnostik.
- Phase 2 ist die fachliche Auswahl: Verwende die Volltexte im Wiki-Kontext UND die Phase-1-Shortlist, um Mittel aus allen passenden Kategorien auszuwählen.
- Produktlinien/Fokusordner sind nur Priorisierung/Boost, niemals Ausschluss anderer Wiki-Mittel.
- Phase-1-Treffer duerfen verworfen werden, wenn sie schwach, redundant, unbelegt oder sicherheitsrelevant sind.

BALANCE-REGEL:
- Teile deine interne Auswertung in drei gleichwertige Spuren: (A) Pathogene/Belastungen, (B) Symptome/klinisches Bild, (C) Labor/Stuhl.
- Wenn Index-, Homotoxikologie- oder symptombezogene Eintraege passen, bewerte sie gegen die anderen Kandidaten; keine automatische Pflichtzeile.
- Haupt-, Ergaenzungs- und Phasenmittel konkurrieren innerhalb des Mengenlimits nach Relevanz, Sicherheit und Beleglage.
- Nur wenn im tatsächlich gelieferten Wiki-Kontext zu einer Symptomspur gar kein passender Eintrag steht, darfst du dafür eine Wissensdatenbank-Lücke melden.
- Eine Darm-/Mikrobiomstrategie darf Symptome nicht verdraengen; trotzdem keine zusaetzlichen Mittel nur zur Vollstaendigkeit erfinden.

🧬 ONKOLOGIE-SICHERHEITSREGEL:
- Keine fest codierten Cancer-Protokolle, Dosierungen oder Wirkversprechen automatisch uebernehmen.
- Bei aktiver oder vorausgegangener Krebserkrankung jeden naturheilkundlichen Kandidaten gegen die konkrete onkologische Medikation, Organfunktion und Behandlungsphase pruefen.
- Antioxidantien, Enzyme, Pflanzenextrakte und apparative Verfahren bei unklarer Wechselwirkung ausschliesslich unter "Manuelle Sicherheitspruefung" auffuehren.
- Dringliche Befunde und erforderliche onkologische/fachaerztliche Abstimmung klar benennen.

🔬 METATRON/NLS INDEX-INTERPRETATION (INTERNER ORIENTIERUNGSHINWEIS):
Bei Pathogenen mit "Index"-Wert aus der Hospital Metatron HR / NLS-Resonanzanalyse gilt eine INVERSE Skala:
  • KLEINER Wert = HOHE Wahrscheinlichkeit für materielles/aktives Vorhandensein
  • GROSSER Wert = GERINGE Wahrscheinlichkeit (nur Hintergrundbelastung oder rein informativ)
Konkrete Schwellen:
  - 0.000 – 0.250 → hoher interner Resonanzhinweis → nur zusammen mit klinischem Kontext priorisieren
  - 0.251 – 0.425 → erhoehter interner Resonanzhinweis → fachlich plausibilisieren
  - 0.426 – 0.600 → mittlere Wahrscheinlichkeit → berücksichtigen, ggf. zusammenfassen
  - 0.601 – 0.700 → geringe Wahrscheinlichkeit → nur ergänzend / Drainage
  - > 0.700      → sehr gering, nur informativ → NICHT als aktive Belastung behandeln, NICHT priorisieren
Der Index allein belegt weder Diagnose noch aktive Infektion und darf keine Mittelwahl ohne klinische Plausibilisierung ausloesen.

⭐ BEVORZUGTE MITTEL & PRODUKTLINIEN DES THERAPEUTEN (HÖCHSTE PRIORITÄT):
${preferredLines.length > 0
  ? `- Bevorzugte Produktlinien: ${preferredLines.join(", ")}.\n  → Bei vergleichbarer Wirkung MUSST du Mittel aus diesen Linien priorisieren (vor anderen Marken). Nenne die Linie explizit im Mittelnamen (z.B. "Biotik Balance (Vitaplace)").`
  : "- Keine Linien-Präferenz angegeben."}
${pinnedTitles.length > 0
  ? `- Vom Therapeuten vorgemerkte Kandidaten: ${pinnedTitles.join("; ")}.
  → Gegen Patientenkontext, Medikation und Wiki-Beleg pruefen; Vormerkung ist keine Pflichtaufnahme.
  → Bei Kontraindikation oder Wechselwirkung nicht als Kernkandidat ausgeben, sondern unter "Manuelle Sicherheitspruefung" auffuehren.`
  : "- Keine spezifischen Mittel gepinnt."}
${symptomDirective}
${metatronHeelDirective}


SICHERHEITSREGELN (ZWINGEND BEACHTEN):
1. **Alter**: ${alter ? `Patient ist ${alter} Jahre alt.` : "Alter unbekannt."}
   - Kinder unter 2: KEINE ätherischen Öle, KEIN Wermut, KEINE alkoholischen Tinkturen
   - Kinder unter 6: Sehr eingeschränktes Spektrum, nur milde Mittel, reduzierte Dosen
   - Kinder unter 12: Reduzierte Dosierungen (ca. 50% der Erwachsenendosis)
   - Kinder unter 16: Leicht reduzierte Dosen

2. **Schwangerschaft/Stillzeit**: ${schwanger || "Nicht angegeben"}
   - Falls schwanger/stillend: KEIN Wermut (Artemisia), KEINE Schwarzwalnuss, KEIN Beifuß, KEIN Rainfarn, generell KEINE antiparasitären Kuren, KEIN hochdosiertes Vitamin A
   - Nur absolut sichere Mittel empfehlen

2b. **Geschlecht**: ${geschlecht || "Nicht angegeben"}
   - Bei "weiblich": gynäkologische Mittel (Aletris-Heel, Sepia, Pulsatilla, Lachesis, Cimicifuga, Mönchspfeffer/Vitex) bei passender Indikation berücksichtigen.
   - Bei "männlich": KEINE primär gynäkologischen Mittel (z.B. Aletris-Heel) – bei Erschöpfung stattdessen China-Homaccord, Nux vomica-Homaccord, Coenzyme/Ubichinon compositum.
   - Männerspezifika: Prostata (Sabal, Brennnesselwurzel, Kürbiskern, Lycopin). Testosteron-stuetzende Kandidaten nur bei passender, fachlich belegter Indikation; bei dokumentiertem Prostatakarzinom oder Androgendeprivation niemals automatisch als Kernkandidat, sondern ausschliesslich zur manuellen onkologischen Sicherheitspruefung.

2c. **Körperkonstitution & BMI**: ${typeof bmi === "number" ? `BMI ${bmi} (${bmiKategorie})` : (groesseCm && gewichtKg ? `Größe ${groesseCm} cm, Gewicht ${gewichtKg} kg` : "Nicht angegeben")}
   - **BMI < 18.5 (Untergewicht)**: Aufbau-/Mitochondrienstrategie, Eiweiß (Whey/Lupinen), B-Komplex, Coenzyme compositum, Zink, kein zusätzliches Fasten/Detox, KEINE appetithemmenden Bitterstoffe in hoher Dosis. Eigene Sektion "🥗 Ernährung & Aufbau" mit konkreten Empfehlungen (3–5 Mahlzeiten, kalorisch dichte gesunde Fette, Eiweißanteil ≥1.2 g/kg).
   - **BMI 25–29.9 (Übergewicht)**: Insulinresistenz prüfen, LOGI/Low-Carb-Empfehlung, Bitterstoffe (Amara), Berberin, Mariendistel zur Leberentlastung, Bewegungsempfehlung. Sektion "🥗 Ernährung & Stoffwechsel".
   - **BMI 30–34.9 (Adipositas I)**: zusätzlich Hinweis auf metabolisches Syndrom (HbA1c, Lipidstatus, Leberenzyme prüfen), NAFLD-Risiko, Schilddrüse (TSH, fT3/fT4) abklären lassen.
   - **BMI ≥ 35 (Adipositas II/III)**: hohe kardiometabolische Gefahr – konsequente Ernährungsumstellung, Empfehlung zur engmaschigen praxisinternen Begleitung; Bildgebung/Diagnostik nur bei zusätzlichem Verdacht.
   - **BMI ≥ 25 + Hashimoto/SD-Verdacht**: explizit Selen, Zink, Tyrosin, Jodstatus prüfen.
    - **Bei BMI ≥ 25**: Leite im internen Block "🥗 Ernährung" hoechstens drei konkrete und befundbezogene Schritte ab. Pruefe passende Wiki-Kandidaten gegen Medikation, Sicherheit und Budget, statt automatisch Produkte vorzusehen.
    - Falls BMI nicht angegeben: KEINE Annahmen treffen und keinen Ernaehrungsblock erzwingen.

3. **Medikamente**: ${medikamente || "Keine angegeben"}
   - Blutverdünner (Marcumar, Warfarin, Eliquis, Xarelto etc.): KEINE Gewürznelke, KEIN Ingwer hochdosiert, KEIN Kurkuma hochdosiert, KEIN Omega-3 hochdosiert, KEIN Ginkgo
   - Immunsuppressiva: KEINE immunstimulierenden Mittel (Echinacea, Katzenkralle)
   - Schilddrüsenmedikamente: Wechselwirkungen mit Selen, Jod beachten
   - Antidepressiva (SSRI): KEIN Johanniskraut
   - Diabetes-Medikamente: Blutzuckersenkende Mittel mit Vorsicht

4. **Bisherige Naturheilmittel**: ${bisherigeMittel || "Keine angegeben"}
   - Falls der Patient bereits Naturheilmittel einnimmt, bewerte diese kritisch:
     a) Sind die bisherigen Mittel sinnvoll für die aktuellen Belastungen? Wenn ja, bestätige und begründe.
     b) Stimmen die Dosierungen? Falls nicht, empfehle angepasste Dosierungen mit Begründung.
     c) Fehlen wichtige Mittel? Ergänze mit Begründung.
     d) Gibt es Mittel die überflüssig oder kontraindiziert sind? Empfehle Absetzung mit Begründung.
     e) Gibt es bessere Alternativen aus der Wissensdatenbank? Empfehle den Wechsel mit Begründung.
     f) Gibt es problematische Wechselwirkungen zwischen den bisherigen Mitteln?

4b. **Eigene Therapie-/Verordnungs-Vorlage des Therapeuten**: ${eigeneTherapieText || "Nicht angegeben"}
   - Falls vorhanden: Erstelle eine eigene Sektion "## 🧾 Prüfung der eingebrachten Therapie/Verordnung".
   - Vergleiche JEDES genannte Mittel / jede Maßnahme mit Befund, Symptomen, Labor/Stuhl, Voruntersuchungen, Medikamenten, Kontraindikationen und Wiki-Kontext.
   - Klassifiziere pro Eintrag: ✅ passt gut / 🔄 passt, aber anpassen / ❓ unklare Indikation / ⚠️ Risiko-Wechselwirkung / ❌ eher nicht passend.
   - Begründe konkret: Für welches Patiententhema passt es (z.B. Darmbarriere, Entzündung, Leber, Mitochondrien, Schlaf, Onkologie-Begleitung), welche Befunde sprechen dafür/dagegen, welche Verbesserung des Befundes realistisch unterstützt werden kann.
   - Falls ein Mittel nicht im Wiki-Kontext vorkommt: als "💡 externe/therapeutische Vorgabe – Wiki-Eintrag prüfen/ergänzen" markieren, nicht halluzinieren.

4c. **Mannayan-Bestellungen / bereits bestellte Präparate**: ${mannayanOrdersText || "Keine passenden Bestellungen gefunden"}
   - Falls vorhanden: Diese Präparate sind bereits für den Patienten bestellt bzw. vorgesehen und müssen in derselben Prüflogik berücksichtigt werden.
   - Erstelle im Abschnitt "## 🧾 Prüfung der eingebrachten Therapie/Verordnung" zusätzlich eine Untergruppe "Mannayan-Bestellungen".
   - Für jedes bestellte Produkt angeben: passt zu welchem Thema/Befund, erwarteter Nutzen, mögliche Lücke, mögliche Doppelung mit anderen empfohlenen Mitteln, Sicherheits-/Interaktionshinweis.
   - Nicht automatisch alles bestätigen: Wenn ein Mannayan-Produkt für das Krankheitsbild nicht plausibel ist, klar als ❓/❌ markieren und sagen, welche Daten fehlen oder warum es nicht Priorität hat.

5. **Laborwerte**: 
   - Erhöhte Werte: ${laborErhoeht || "Keine angegeben"}
   - Erniedrigte Werte: ${laborErniedrigt || "Keine angegeben"}
    - Komplettes klassisches Labor (Gesamtübersicht inkl. unauffälliger Werte)${laborDatum ? ` – Befunddatum: ${laborDatum}` : ""}: ${laborKomplett || "Nicht angegeben"}
    - Falls Laborwerte angegeben: Beziehe diese in die Therapieempfehlung mit ein. Erkläre, welche Werte auffällig sind und welche Naturheilmittel oder Ernährungsmaßnahmen diese verbessern können. Bei vorhandenem komplettem Labor: nutze auch unauffällige Werte zur Mustererkennung (z.B. Subklinik, Verlaufstendenzen, Plausibilitätsprüfung) und nenne explizit, welche Werte unauffällig/normal sind. Berücksichtige das Befunddatum (alte Werte ggf. nicht mehr aktuell – Verlaufskontrolle empfehlen).

6. **Stuhlbefund / Mikrobiom / Laborwerte**: ${stuhlbefund || "Nicht angegeben"}

6b. **Arztbericht / Arztbrief / Facharzt-Befund (schulmedizinische Diagnostik & Therapie)${arztberichtDatum ? ` – Berichtsdatum: ${arztberichtDatum}` : ""}**: ${arztbericht || "Nicht angegeben"}
   - Falls vorhanden: Werte Diagnosen (inkl. ICD-10), Befunde (Bildgebung/Histologie/OP), ärztliche Beurteilung und bereits verordnete Schulmedizin-Therapie aus.
   - Berücksichtige diese Diagnosen im Therapieplan: Naturheilkundliche Mittel müssen mit der bestehenden Schulmedizin (Wechselwirkungen, Kontraindikationen, Karenzen) verträglich sein.
   - Verwende die ärztlichen Diagnosen als gesicherten Befund (nicht erneut in Frage stellen) und leite ergänzende naturheilkundliche Strategien daraus ab.

6c. **Sonstige / unsortierte Voruntersuchungen (gemischte Befunde, ${sonstigeUntersuchungenText.length} Zeichen)**: ${sonstigeUntersuchungenText || "Nicht angegeben"}
   - VERBINDLICH: Dieser Block ist VOLLSTÄNDIG zu lesen — auch wenn er sehr lang ist (5–60 Seiten / bis 200.000+ Zeichen). NICHTS überspringen, NICHTS überfliegen, KEINE Stichproben. Wenn du am Limit deines Kontextes ankommst, melde das explizit als "⚠️ Kontextlimit erreicht – folgende Abschnitte konnten nicht ausgewertet werden: [...]" — aber täusche niemals eine vollständige Auswertung vor.
   - **DATUMS-EXTRAKTION (PFLICHT):** Lies systematisch jedes Untersuchungsdatum aus dem Freitext (Formate: TT.MM.JJJJ, JJJJ-MM-TT, "März 2024", "vor 2 Jahren", "Q1/25" usw.). Ordne JEDEM Befund sein Datum + den Untersuchungstyp zu. Erstelle dazu im Output unter "🗂️ Voruntersuchungen – chronologische Auswertung" eine **chronologisch sortierte Liste** (neueste zuerst) im Format:
     - **[TT.MM.JJJJ] – [Untersuchungstyp] ([Quelle/Praxis falls genannt])** → Befund: [Kernbefund kurz]. Therapierelevanz: [konkret]. Einordnung: [a/b/c].
   - Sortiere intern, was davon (a) **gesicherter schulmedizinischer Befund** (Bildgebung, Histologie, Labor mit Arztstempel), (b) **komplementär-/bioenergetische Resonanzaussage** (EAV, NLS, Bioresonanz, Kinesiologie) oder (c) **Verlaufs-/Selbstmessung** (RR, HRV, CGM, Schmerztagebuch) ist – jede Gruppe wird unterschiedlich gewichtet.
     - **Tiefen-Diff.-Diagnostik (PFLICHT bei diesem Block):** Leite aus den Befunden eine eigene Sektion "## 🔎 Differentialdiagnostik (vertieft)" ab — mindestens 3–6 Differentialdiagnosen mit (i) passenden Befunden DAFÜR, (ii) Befunden DAGEGEN, (iii) zusätzlich nötigen Untersuchungen zur Abklärung, (iv) Wahrscheinlichkeit (gering/mittel/hoch). Verwende ICD-10-Codes wenn möglich. Quelle: Wiki-Einträge + genannte Voruntersuchungen + Perplexity-Recherche (6e), niemals erfundene Werte.
   - Leite konkrete Therapie-Konsequenzen ab: Organfokus aus Bildgebung, Resonanz-Hinweise aus EAV/NLS, Verlaufstrends aus Selbstmessungen, Anamnese-Kontext aus Reha-/Kurberichten.
   - Bei NLS-/Bioresonanz-Hinweisen: kennzeichne Empfehlungen klar als „resonanz-basiert" und vermische sie nicht mit gesicherten schulmedizinischen Diagnosen.
   - Bei onkologischen, kardiovaskulären, neurologischen oder anderen schwerwiegenden Diagnosen: Strikte begleitende Therapie, keine Empfehlungen, die mit ärztlicher Behandlung kollidieren.

6d. **Vieva Plus${vievaPlusDatum ? ` – erstellt am ${vievaPlusDatum}` : ""} (Vitamin-/Mineralstoffstatus, Aminosäuren und HRV, ${vievaPlusText.length} Zeichen)**: ${vievaPlusText || "Nicht angegeben"}
   - Werte vollständig mit Einheit, Referenz-/Zielbereich und Messdatum übernehmen, soweit im Befund vorhanden; fehlende Angaben nicht erfinden.
   - Vitamin-, Mineralstoff- und Aminosäurehinweise mit klassischem Labor, Beschwerden, Diagnosen und Medikation abgleichen. Messmethodisch nicht gleichwertige Aussagen ausdrücklich kennzeichnen.
   - HRV-Werte als Verlaufs-/Regulationsmessung einordnen, nicht als alleinigen Diagnosenachweis. Auffällige kardiovaskuläre Hinweise ärztlich abklären lassen.

6e. **Externe Perplexity-/AI-Recherche & Literaturauswertung (${perplexityAnalyseText.length} Zeichen)**: ${perplexityAnalyseText || "Nicht angegeben"}
   - VERBINDLICH: Auch dieser Block ist VOLLSTÄNDIG zu lesen – egal wie lang. KEIN Trimmen, KEIN Stichprobenlesen.
   - Inhalt sind in der Regel: Perplexity-Antworten mit Zitaten, PubMed-Treffer, S3-Leitlinien-Auszüge, Cochrane-Reviews, Lehrbuch-Exzerpte, Spezialisten-Forenposts, AI-generierte Differentialdiagnose-Listen.
   - Verwendung im Therapieplan:
     1. **Differentialdiagnostik (Sektion 🔎):** Differentialdiagnosen aus der Recherche MÜSSEN in die Liste übernommen und gewichtet werden.
     2. **Evidenz-Hinweise:** Studien/Leitlinien aus diesem Block dürfen zitiert werden — IMMER mit der Originalquelle ("lt. Perplexity-Recherche: PMID xxxxxxxx" oder "S3-LL DGP 2023").
     3. **Wiki-Vorrang bleibt:** Wenn die Recherche Mittel nennt, die NICHT in der Wissensdatenbank stehen, gib einen Hinweis "💡 Recherche-Anregung (nicht im Wiki): [Mittel] – [Quelle]. Vor Empfehlung Wiki-Eintrag prüfen/ergänzen." aber EMPFIEHL es nicht als Hauptmittel.
     4. **Widersprüche zwischen Recherche und Wiki:** Transparent machen ("Wiki sagt X, Perplexity-Recherche sagt Y – Praxis-Entscheidung: ..."). Wiki gewinnt im Zweifel.
     5. **Anti-Halluzinations-Regel:** Nichts aus dem Modellwissen erfinden, was nicht entweder in Wiki oder in der Perplexity-Recherche steht.

   
   **ZWINGENDE QUELLENREGEL für Labor-/Stuhlwerte:**
   - Für jeden im Befund genannten Parameter MUSST du prüfen, ob in der oben gelieferten WISSENSDATENBANK ein Eintrag aus der Kategorie "Labordiagnostik" zu genau diesem Parameter existiert (z.B. "Calprotectin", "Zonulin", "sIgA", "Pankreas-Elastase", "Lactobacillus", "Bifidobacterium", "Akkermansia muciniphila", "Faecalibacterium prausnitzii", "alpha-1-Antitrypsin", "Stuhl-pH" usw.).
   - WENN ein Eintrag existiert: Verwende AUSSCHLIESSLICH die dort hinterlegten Referenzbereiche, Bedeutungen (↑/↓), Therapieprotokolle, Dosierungen, Dauern, Kontraindikationen und Quellen. ZITIERE die Quelle (z.B. "PMID 18936492" oder "AWMF S3 021/016") explizit am Ende der Bewertung jedes Wertes.
   - WENN KEIN Eintrag existiert: Gib für diesen Parameter ZWINGEND aus: "⚠️ Kein hinterlegter Referenzwert in der Wissensdatenbank für [Parameter] – bitte vor der Therapieentscheidung manuell prüfen oder Wiki ergänzen." Erfinde KEINE Werte, Bereiche oder Therapien aus deinem allgemeinen Modellwissen.
   - Strukturiere die Auswertung im Abschnitt "🧫 Stuhlbefund-Analyse" pro Parameter wie folgt:
     **[Parameter]: [gemessener Wert]** 
     - Bewertung: [normal/erhöht/erniedrigt anhand Wiki-Referenzbereich]
     - Bedeutung: [Wiki-Inhalt, kurz]
     - Therapie: [Wiki-Protokoll, kurz – die konkreten Mittel werden dann strukturiert in den Mittel-Gruppen aufgelistet]
     - Quelle: [Wiki-Quellenangabe]
    - Übertrage die im Wiki-Eintrag genannten Therapie-Mittel anschließend in die strukturierten Mittel-Gruppen (Hausmittel, Probiotika, Sanum etc.) mit den dort angegebenen Dosierungen.
    - WICHTIG BEI Bifidobacterium/Lactobacillus-Mangel: Die Vitaplace-Einträge **Biotik Balance Kapseln** und **Biotik Sensitiv Pulver** gelten als vorhandene Substitutionspräparate, wenn sie im Kontext stehen. Dann KEINE Substitutions-Lücke für Bifidobacterium oder Lactobacillus melden, sondern diese Mittel unter "Probiotika, Präbiotika & Darmaufbau" aufführen.
   - Verwende das 4-R-Konzept (Remove – Replace – Reinoculate – Repair) als Strukturhilfe, wenn Leaky-Gut-Marker (Zonulin, alpha-1-AT) oder Entzündungsmarker (Calprotectin) erhöht sind.

KOSTENRICHTLINIEN (ZWINGEND BEACHTEN):
- NutraMedix-Produkte kosten ca. 35-45 € pro 30ml Flasche
- ${budget ? `Das maximale Budget des Patienten beträgt ${budget} Euro.` : "Kein Budget angegeben – trotzdem kostenbewusst empfehlen."}
- **Günstige Alternativen zuerst prüfen**, aber nur bei passendem Wiki-Beleg und bestandener Sicherheitsprüfung: z.B. Gewürze und Hausmittel wie Knoblauch, Kurkuma, Oregano, Ingwer, Nelken, Thymian, Zimt, Meerrettich oder Schwarzkümmelöl.
- Teure Spezialpräparate (NutraMedix, Biopure etc.) NUR empfehlen wenn:
  a) keine günstige Alternative existiert
  b) die günstige Alternative fachlich nicht passend oder nicht ausreichend belegt ist
  c) das Budget es erlaubt
- Schätze die ungefähren Gesamtkosten pro Monat für die empfohlenen Mittel
- Priorisiere Mittel nach Wichtigkeit: Die wichtigsten 2-3 Mittel zuerst, optionale Ergänzungen kennzeichnen

AUSGABEFORMAT:
Ein vollstaendiger interner Therapieentwurf MUSS alle folgenden Abschnitte enthalten, auch wenn fuer einen Bereich nur fehlende Daten oder ein gezielter Klaerungsschritt dokumentiert werden kann: Priorisierung & Therapieziele, Sicherheitshinweise, Therapieprotokoll, Ernaehrung, Verhalten & Alltag und Verlaufskontrolle.

SYSTEMATISCHE ABLEITUNG (VERBINDLICH):
1. Ordne jeden Kandidaten genau einem dokumentierten Befund, Laborwert, Pathogen, Symptom oder einer Diagnose zu. Ohne konkreten Bezug keine Aufnahme.
2. Pruefe nacheinander Vitamine, Aminosaeuren, Spurenelemente/Mineralstoffe, Fettsaeuren, Pathogene, Symptome, Diagnosen, Darm/Mikrobiom, Pflanzenmittel und weitere passende Wiki-Kategorien. Diese Liste ist eine erweiterbare Grundstruktur: Zusaetzliche Datenbankkategorien duerfen als eigene fachlich benannte Gruppe erscheinen. Eine leere Kategorie wird nicht mit allgemeinen Standardmitteln gefuellt.
3. Gib Firma/Hersteller nur an, wenn sie im Wiki, im geprueften Produktlink oder im offiziellen Produktnamen belegt ist; sonst schreibe "nicht belegt".
4. Ordne passende Mannayan- und Vitaplace-Apothekenprodukte in die fachlich passende Stoff- oder Therapiegruppe ein und nenne die Produktlinie als Firma. Nutze einen eigenen Produktlinien-Abschnitt nur, wenn eine fachliche Gruppe nicht eindeutig ist. Dasselbe Produkt nie doppelt auffuehren.
5. NutraMedix-Mittel bei Pathogenen nur bei einem konkret genannten Pathogen und passendem geprueften Wiki-Mittelbeleg. Laborbestaetigung und Metatron/NLS-Resonanzhinweis in der Begruendung strikt unterscheiden; ein Resonanzhinweis ist kein Infektionsnachweis.
6. Bei allgemeinen Symptomen Homoeopathie und Komplexmittel als eigene Kandidatengruppe mitpruefen, aber nur bei konkretem Wiki-Beleg, passender Indikation und bestandener Sicherheitspruefung.
7. Trenne die interne fachliche Begruendung vom einfachen Patiententext: Befundbezug nennt den konkreten Messwert, das Symptom oder die Diagnose plus Wiki-ID; Patientenerklaerung beantwortet ohne Fachjargon "Warum soll ich das einnehmen?". Keine Heilungszusage und keine unbelegte Wirksamkeitsbehauptung.
8. Fuehre bei jedem Mittel Gefahren, Gegenanzeigen und relevante Wechselwirkungen auf. Beispiel: Suessholz bei dokumentiertem Bluthochdruck nicht als Kernkandidat ausgeben und den Blutdruckhinweis sichtbar nennen. Wenn im verwendeten Beleg keine konkrete Sicherheitsangabe steht, schreibe "Keine konkrete Angabe im verwendeten Beleg – individuell pruefen" statt "keine Gefahren".
9. Ernaehrung immer aus einem konkreten Befundmuster ableiten. Beispiel: Nur bei dokumentiert erhoehtem HbA1c/Glukosemuster eine kohlenhydratreduzierte LOGI-orientierte Kost pruefen und die passende Quelle [INFOTHEK:logi-ernaehrung-mitochondrien.html] sichtbar nennen; fehlende Messwerte nicht erfinden.

## 🎯 Priorisierung & Therapieziele
Nenne hoechstens drei Ziele in Reihenfolge 1 bis 3. Begruende die Reihenfolge mit gesicherten Diagnosen, Symptomen, Alter, Medikation sowie Labor-/Stuhlbefunden. Resonanzhinweise bleiben klar getrennt und duerfen die Reihenfolge nicht allein bestimmen.

## 🔍 Analyse der Belastungen
Kurze Zusammenfassung der identifizierten Probleme.

## 📊 Bewertung der bisherigen Therapie
(Nur falls bisherige Mittel angegeben) Detaillierte Bewertung jedes bisherigen Mittels:
- ✅ Sinnvoll beibehalten (mit Begründung)
- 🔄 Dosisanpassung empfohlen (alt → neu, mit Begründung)
- ❌ Absetzen empfohlen (mit Begründung)
- 🔀 Alternative empfohlen (Wechsel zu X, mit Begründung)

## 🧾 Prüfung der eingebrachten Therapie/Verordnung
(PFLICHT, sobald eigene Therapie-/Verordnungs-Vorlage ODER Mannayan-Bestellungen angegeben sind.) Tabelle/strukturierte Liste mit: Mittel/Maßnahme | Herkunft (eigene Eingabe/Mannayan/Datei) | Patiententhema/Befundbezug | Bewertung (✅/🔄/❓/⚠️/❌) | Begründung | Anpassung/fehlende Daten.

## 🔬 Laborwert-Analyse
(Nur falls Laborwerte angegeben) Bewertung der auffälligen Werte mit naturheilkundlichen Empfehlungen zur Verbesserung.

## 🧫 Stuhlbefund-Analyse
(Nur falls Stuhlbefund angegeben) Bewertung von Mikrobiom-Dysbiose, Verdauungs-, Entzündungs- und Barriere-Markern. Konkrete Ableitung der Darmsanierungs-Strategie (4-R-Konzept: Remove – Replace – Reinoculate – Repair).

## 🗂️ Voruntersuchungen – chronologische Auswertung
(Nur falls "Sonstige Voruntersuchungen" angegeben) Chronologisch sortierte Liste ALLER aus dem Freitext extrahierten Untersuchungen mit Datum, Untersuchungstyp, Kernbefund, Therapierelevanz und Einordnung (a/b/c). Bei fehlendem Datum: "(Datum nicht im Text genannt)". KEINE Befunde überspringen.

## 🔎 Differentialdiagnostik (vertieft)
(PFLICHT, sobald "Sonstige Voruntersuchungen" ODER "Perplexity-Recherche" Inhalte enthalten — sonst optional)
Mindestens 3–6 Differentialdiagnosen, jeweils mit:
- **DD [Nr.]: [Bezeichnung]** (ICD-10: [Code falls möglich]) — Wahrscheinlichkeit: gering/mittel/hoch
  - **Dafür spricht:** [Befunde aus Anamnese/Labor/Bildgebung/NLS/Perplexity]
  - **Dagegen spricht:** [...]
  - **Zusätzlich nötige Abklärung:** [konkrete Untersuchung/Marker]
  - **Naturheilkundliche Konsequenz wenn zutreffend:** [Wiki-Mittel/Strategie]



## 🕳️ Wissensdatenbank-Lücken (ZWINGEND – diesen Abschnitt FRÜH ausgeben, vor den Mittel-Tabellen, damit er nicht durch Längenkürzung verloren geht)
Liste hier transparent ALLE Punkte auf, an denen die Wissensdatenbank für diesen konkreten Fall unvollständig ist. Nichts erfinden – nur melden.

Prüfe systematisch und gib pro Lücke EINE Zeile aus, beginnend mit \`- \`:

1. **Substitutions-Lücken (Mikrobiom/Stuhl):** Für jedes im Stuhlbefund als "erniedrigt/fehlend" markierte Bakterium (z.B. Akkermansia muciniphila, Faecalibacterium prausnitzii, Bifidobacterium longum, Lactobacillus rhamnosus, E. coli, Enterokokken) prüfe, ob in der Wissensdatenbank ein konkretes Substitutions-Präparat (Probiotikum mit genau diesem Stamm oder gezieltes Präbiotikum) hinterlegt ist. Wenn nein → Lücke melden.
   - SONDERREGEL: Für **Bifidobacterium** und **Lactobacillus** sind **Vitaplace Biotik Balance Kapseln** und **Vitaplace Biotik Sensitiv Pulver** vorhandene Substitutionspräparate. Hier niemals "keine klare Substitution" melden, wenn einer dieser Vitaplace-Einträge im Kontext steht.
2. **Ursachen-Lücken:** Für jedes auffällige Pathogen / jeden auffälligen Marker (zu viel ODER zu wenig) prüfe, ob in der Wiki erklärt ist, WARUM dieser Wert verschoben sein kann. Wenn keine Ursachen-Hypothese im Wiki vorhanden → Lücke melden.
3. **Pathogen-Mittel-Lücken:** Für jedes genannte Pathogen prüfe, ob mindestens ein wirksames Mittel in der Wiki hinterlegt ist. Wenn nein → Lücke melden.
4. **Referenzwert-Lücken / Dosierungs-Lücken** sammeln.

FORMAT pro Lücke:
- ⚠️ **[Kategorie]** – [Was fehlt konkret] → **Empfehlung Wiki-Ergänzung:** [Welcher Wiki-Eintrag sollte angelegt/erweitert werden]

BEISPIELE:
- ⚠️ **Substitution** – Akkermansia muciniphila erniedrigt, kein Akkermansia-Präparat in Wiki → **Empfehlung Wiki-Ergänzung:** Eintrag "Akkermansia muciniphila (Substitution)" mit Präparaten (Pendulum Akkermansia, Daily Health), Dosierung, Präbiotika-Kombination.
- ⚠️ **Pathogen-Mittel** – Klebsiella pneumoniae genannt, kein gezieltes Wiki-Mittel → **Empfehlung Wiki-Ergänzung:** Eintrag "Klebsiella – naturheilkundliche Therapie" mit Oregano-Öl, Berberin, Allicin.

Falls KEINE Lücken: Schreibe genau "✅ Für diesen Fall sind alle relevanten Wiki-Einträge vorhanden."

## 📚 Weitere interne Quellenhinweise
Fuehre hier fallbezogen relevante Angaben aus Infothek und Import-Pruefbereich auf, die wegen fehlender fachlicher Pruefung oder fehlendem Wiki-Beleg nicht als Kernmittel oder Dosierung verwendet werden duerfen.
- Infothek-Angaben immer mit [INFOTHEK:datei.html] kennzeichnen.
- Importangaben immer mit [UNREVIEWED_STAGING:art:id] und ihrem Pruefstatus kennzeichnen.
- Wissenschaftliche und naturheilkundliche Quellenaussagen intern erhalten; Evidenz, Sicherheit und offene Pruefung getrennt nennen.
- Wenn keine solchen Hinweise relevant sind, schreibe: "Keine zusaetzlichen internen Quellenhinweise fuer diesen Fall."

## ⚠️ Sicherheitshinweise
Spezifische Kontraindikationen für diesen Patienten basierend auf Alter, Schwangerschaft, Medikamenten.

## 💊 Interne Mittel-Kandidaten – gegliedert nach Stoffgruppe / Wiki-Kategorie

WICHTIG: Gruppiere die empfohlenen Mittel ZWINGEND nach den folgenden Überschriften (nur die Gruppen ausgeben, in denen Du tatsächlich etwas empfiehlst). Die Reihenfolge ist verbindlich:

### 🍋 Vitamine
(Vitamin C, D, B-Komplex, A, E, K2 usw.)

### 🧬 Aminosäuren
(L-Carnitin, Taurin, Lysin, NAC, Glycin, Tryptophan usw.)

### 🧂 Spurenelemente & Mineralstoffe
(Magnesium, Zink, Selen, Eisen, Jod, Kalium usw.)

### 🐟 Fettsäuren
(Omega-3, EPA/DHA, Krill-Öl usw.)

### 🦠 Pathogenbezogene Mittel (NutraMedix)
(z.B. Samento, Banderol oder Cumanda nur bei konkret genanntem Pathogen, passendem Wiki-Beleg und klarer Kennzeichnung der Befundart)

### 🩹 Symptombezogene Mittel
(Nur Kandidaten, deren konkreter Symptombezug in Befund und Wiki belegt ist.)

### 🩺 Diagnosebezogene Mittel
(Nur ergänzende Kandidaten zu einer dokumentierten Diagnose; bestehende ärztliche Behandlung und Wechselwirkungen beachten.)

### 🌿 Hausmittel & Gewürze
(Knoblauch, Kurkuma, Oregano, Ingwer, Nelken, Thymian, Zimt, Meerrettich, Schwarzkümmelöl, Zitrone usw.)

### 🌱 Phytotherapie & Tinkturen
(CERES-Urtinkturen, Ceylon-Zimt, Manuka, Kapuzinerkresse, Schwarzwalnuss, Wermut, Beifuß usw. – sofern nicht reine Hausmittel)

### 🍄 Heilpilze (Mykotherapie)
(Reishi, Maitake, Shiitake, Coriolus, Pleurotus, Auricularia, Champignon, Mandelpilz)

### 🧪 Sanum-Therapie (Isopathie nach Enderlein)
(MUCOKEHL, NIGERSAN, NOTAKEHL, FORTAKEHL, PEFRAKEHL, ALBICANSAN, EXMYKEHL, SANUVIS, CITROKEHL, ACIDUM TARTARICUM, FORMASAN, ALKALA N, ZINKOKEHL, UTILIN, RECARCIN, LATENSIN, BOVISAN, LEPTUCIN, ARTHROKEHLAN, SANUKEHL-Haptene usw.)

### 💧 Homöopathie & Komplexmittel
(Bei allgemeinen Symptomen gezielt mitpruefen: Heel-Präparate wie Mucosa comp., Lymphomyosot, Traumeel, Engystol; klassische Homöopathika; spagyrische Mittel. Nur belegte, passende Einzelkandidaten ausgeben.)

### 🧫 Probiotika, Präbiotika & Darmaufbau
(Vitaplace **Biotik Sensitiv Pulver** und **Biotik Balance Kapseln** = Mehrstamm-Probiotika der Praxis-Eigenmarke mit *Bifidobacterium bifidum/infantis/lactis/longum* und *Lactobacillus acidophilus/casei/lactis/paracasei/plantarum* — bei Bifido-/Lacto-Mangel BEVORZUGT empfehlen; Symbioflor 1+2, Mutaflor, RMS-Biofrid, EM-Ferment, Flohsamen, Inulin)

### 💎 Spezialpräparate
(Biopure, Quicksilver Scientific u.ä. – nur wenn eine fachlich passendere Gruppe nicht greift und günstigere Alternativen nicht ausreichen)

### 🏭 Mannayan-Produkte
(Nur fuer geprueft verknuepfte Mannayan-Produkte ohne eindeutig passende Stoffgruppe; nicht zusaetzlich zu einer bereits erfolgten Einordnung ausgeben.)

### 🧴 Vitaplace-Apothekenprodukte
(Vitaplace-Produkte sind vielfaeltig und werden bevorzugt ihrer fachlich passenden Gruppe zugeordnet. Dieser Abschnitt ist nur fuer Produkte ohne eindeutige Stoff- oder Therapiegruppe.)

### 🩺 Apparative & klinische Therapien
(Infusionen, Ozon, IHHT, Colon-Hydrotherapie, Frequenztherapie, Bioresonanz)

INNERHALB JEDER GRUPPE: Gib jedes Mittel ZWINGEND in folgendem strukturierten Format aus, damit das Frontend es als Tabellenzeile darstellen kann. Trenne die Felder mit Pipe-Zeichen " | " und beginne JEDE Mittel-Zeile mit Bindestrich + Leerzeichen:

- **Mittelname** | Hersteller/Firma | Dosierung | Anwendung/Einnahme | Dauer | Priorität | Kosten/Monat | Interner Befundbezug | Einfache Patientenerklärung | Gefahren / Gegenanzeigen / Wechselwirkungen

WO:
- **Mittelname**: Name in doppelten Sternchen, ggf. mit lateinischem Namen in Klammern
- Hersteller/Firma: belegte Firma aus Wiki, geprueftem Produktlink oder offiziellem Produktnamen; sonst "nicht belegt"
- Dosierung: z.B. "2×1 Tbl. tgl." oder "3×8 Tropfen"
- Anwendung/Einnahme: z.B. "oral, vor dem Essen" oder "in Wasser einnehmen"
- Dauer: z.B. "4 Wochen" oder "dauerhaft"
- Priorität: NUR eines von: 🔴 Essentiell | 🟡 Empfohlen | 🟢 Optional
- Kosten/Monat: z.B. "~5 €" oder "~40 €"
- Interner Befundbezug: KURZ (max 1 Satz) mit dem konkreten Laborwert, Pathogen, Symptom oder Diagnosebezug. Am Ende zwingend die exakte Quellenkennung aus dem Wiki-Kontext ergänzen: [WIKI_ID:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
- Einfache Patientenerklärung: KURZ (max 1 Satz), ohne Fachjargon und ohne interne Quellenkennung; beantwortet "Warum soll ich das einnehmen?"
- Gefahren / Gegenanzeigen / Wechselwirkungen: patientenbezogen aus Wiki-Sicherheit, Medikation, Alter, Schwangerschaft und Diagnosen; keine Entwarnung erfinden

BEISPIELFORMAT (nur Struktur, keine Therapievorlage):
- **Wiki-Mittel A** | nicht belegt | Dosierung manuell prüfen | oral | Verlauf prüfen | 🟡 Empfohlen | unbekannt | Bezug zum dokumentierten Symptom. [WIKI_ID:00000000-0000-0000-0000-000000000000] | Dieses Mittel wird geprüft, weil es zu Ihren beschriebenen Beschwerden passen kann. | Keine konkrete Angabe im verwendeten Beleg – individuell prüfen

WICHTIG: KEINE Unterpunkte, KEIN Fließtext zwischen den Mittel-Zeilen. Nur die strukturierten Pipe-Zeilen, eine pro Mittel. Innerhalb eines Feldes niemals ein weiteres Pipe-Zeichen verwenden.

🚫 ABSOLUT VERBOTEN – EIN MITTEL PRO ZEILE:
- NIEMALS mehrere eigenständige Präparate in einem **Mittelname**-Feld zusammenfassen (kein "Hepeel / Arsuraneel", kein "Gastricumeel / Hepeel / Spascupreel", kein "Coenzyme compositum / Ubichinon compositum").
- Auch wenn mehrere Heel-/Homotoxikologie-Mittel ähnliche Indikationen haben: JEDES Mittel bekommt eine EIGENE Pipe-Zeile mit eigener Dosierung, eigener Priorität und eigener Begründung.
- Slash "/" im Mittelnamen ist NUR erlaubt, wenn es Teil des offiziellen Produktnamens ist (z.B. "Vitamin B6/B12-Komplex" als ein Produkt). Nicht als Trenner zwischen zwei verschiedenen Präparaten.
- Klammer-Zusatz "(Latein)" ist erlaubt für die botanische/lateinische Bezeichnung EINES Mittels, nicht für Alternativen.

## 💰 Kostenübersicht
- Gesamtkosten Essentiell: ca. XX €/Monat
- Gesamtkosten mit Empfohlen: ca. XX €/Monat  
- Gesamtkosten komplett: ca. XX €/Monat
${budget ? `- **Budget-Check**: Passt die Empfehlung in das Budget von ${budget} €? Falls nicht, welche Mittel weglassen?` : ""}

## 📋 Therapieprotokoll
Zeitlicher Ablauf in Phasen: Startphase (maximal 3 gleichzeitig neu beginnende Mittel), anschliessende Aufbau-/Erweiterungsphase und Verlaufskontrolle. Nenne klar, welche Reservekandidaten nicht parallel in der Startphase eingesetzt werden.

## 🥗 Ernährung
Hoechstens drei priorisierte, konkrete und zum Befund passende Massnahmen. Fuer jede Massnahme zwingend in dieser Reihenfolge: **Befundbezug**, **Massnahme**, **Warum fuer den Patienten**, **Quelle** und **Kontrolle**. Infothek-Verweise als [INFOTHEK:datei.html] nennen. Keine allgemeine Standardliste und keine unbelegten Wirkversprechen. Wenn die Datenlage keine individuelle Ernaehrungspriorisierung erlaubt, nenne genau die fehlenden Informationen statt allgemeine Empfehlungen zu erfinden.

## 🚶 Verhalten & Alltag
Hoechstens drei priorisierte, konkrete Schritte zu Schlaf, Bewegung, Belastungssteuerung oder anderen passenden Gewohnheiten. Keine allgemeinen Standardlisten. Wenn die Datenlage keine individuelle Priorisierung erlaubt, nenne genau die fehlenden Informationen statt allgemeine Empfehlungen zu erfinden.

## 📈 Verlaufskontrolle
Nenne fuer die Startphase konkret: Was wird kontrolliert, wann wird kontrolliert, woran wird Nutzen oder Unvertraeglichkeit erkannt und wann muss pausiert beziehungsweise aerztlich abgeklärt werden. Keine neuen Laborwerte oder Zeitpunkte erfinden; bei fehlender Grundlage einen manuellen Kontrolltermin verlangen.

## 🔄 Begleitmaßnahmen
Nur ergänzende Maßnahmen, die nicht bereits unter Ernährung oder Verhalten & Alltag stehen. Hausmittel nur bei Wiki-Beleg und innerhalb des Mengenlimits nennen.

## ❌ Ausgeschlossene Mittel
Mittel die NICHT gegeben werden dürfen mit Begründung (Alter, Schwangerschaft, Medikamente).

WICHTIG: 
- Empfehle NUR Mittel die in der Wissensdatenbank vorhanden sind. Erfinde keine neuen Mittel oder Dosierungen.
- Als Mittel automatisch ausgeben darfst du nur Wiki-Eintraege mit Eintragsart remedy oder product oder ein ueber eine gepruefte exact_product-Verknuepfung benanntes Produkt. Diagnose-, Protokoll-, Geraete- und allgemeine Referenzeintraege duerfen nur als Kontext dienen.
- Infothek- und Import-Pruefhinweise ohne passenden geprueften Wiki-Mittelbeleg duerfen nicht in die Mittel-Tabellen gelangen; sie bleiben im Abschnitt "Weitere interne Quellenhinweise" oder werden als Wissensluecke markiert.
- WENN ein notwendiges Mittel fehlt: NICHT improvisieren, sondern als Lücke unter "🕳️ Wissensdatenbank-Lücken" (Abschnitt früh oben) melden.
- Gewürze und Hausmittel nur nach denselben Relevanz-, Quellen- und Sicherheitsregeln wie andere Kandidaten aufnehmen.
- Bei jedem Mittel erklären, warum es als interner Kandidat geprüft wird; keine Wirksamkeit als gesichert darstellen, wenn die Evidenzmetadaten dies nicht tragen.
- Schreibe KOMPAKT: pro Mittel max. 1 Begründungssatz, keine doppelten Erklärungen.`;

    const befundContext = befundAuswertungText
      ? `\n\nVORHANDENE BEFUND-AUSWERTUNG – PRIMÄRER ZUSAMMENFASSENDER KONTEXT:\n${befundAuswertungText}\n\nVerwende diese bereits erstellte Befund-Auswertung als zentrale Grundlage für die Priorisierung. Prüfe sie gegen die darunter gelieferten Rohfelder, aber baue die Befundauswertung nicht erneut und ersetze keine vorhandenen Befunde durch Vermutungen. Übernimm alle für die Therapie relevanten Diagnosen, Symptome, Labor-/Messwertmuster, Zeitbezüge, Warnhinweise und offenen Fragen.\n`
      : "";

    const userMessage = isNachschlag
      ? `Patientendaten:
${patientInfo.join("\n")}

${befundContext}

Belastungen/Pathogene: ${belastungen || "Nicht angegeben"}
Symptome: ${symptome || "Nicht angegeben"}
Erkrankung: ${erkrankung || "Nicht angegeben"}
Manuell/aus Befund übernommene Diagnosen: ${manualDiagnosesText || "Nicht angegeben"}
Bisherige Naturheilmittel: ${bisherigeMittel || "Keine"}
Stuhlbefund/Mikrobiom: ${stuhlbefund || "Nicht angegeben"}
Arztbericht/Arztbrief: ${arztbericht || "Nicht angegeben"}
Budget: ${budget ? budget + " Euro" : "Nicht angegeben"}

🔄 NACHSCHLAG-MODUS – ERWEITERUNG EINER BESTEHENDEN EMPFEHLUNG

NEUE ZUSATZ-INFORMATION (vom Therapeuten ergänzt):
${nachschlag}

BISHERIGE EMPFEHLUNG (gilt weiterhin):
\`\`\`
${(previousResult as string).slice(0, 18000)}
\`\`\`

DEINE AUFGABE JETZT:
1. **Behalte die bisherige Empfehlung vollständig bei** – wiederhole alle bestehenden Mittel mit identischer Dosierung/Anwendung/Dauer/Begründung.
2. **Ergänze NUR die Mittel/Maßnahmen, die durch die neue Zusatz-Information zusätzlich nötig werden.**
3. **Markiere jedes neue oder geänderte Mittel mit dem Präfix 🆕** direkt vor dem Mittelnamen, z.B. \`- 🆕 **Magnesium-Citrat**\`.
4. Wenn die neue Info ein bestehendes Mittel inhaltlich anpasst (Dosis, Dauer), markiere die geänderte Zeile mit 🔄 und gib in der Begründung an, was sich geändert hat.
5. Halte das gleiche Ausgabeformat ein (Gruppen, Pipe-Tabellenstruktur).
6. Ergänze einen kurzen Abschnitt **## 🔄 Nachschlag-Begründung** ganz oben, der erklärt, was die neue Info therapeutisch bedeutet und welche Mittel deshalb dazukommen.

Erfinde keine Mittel – nutze ausschließlich die Wissensdatenbank.`
      : `Patientendaten:
${patientInfo.join("\n")}

${befundContext}

Belastungen/Pathogene: ${belastungen || "Nicht angegeben"}
Symptome: ${symptome || "Nicht angegeben"}  
Erkrankung: ${erkrankung || "Nicht angegeben"}
Manuell/aus Befund übernommene Diagnosen: ${manualDiagnosesText || "Nicht angegeben"}
Bisherige Naturheilmittel: ${bisherigeMittel || "Keine"}
Stuhlbefund/Mikrobiom: ${stuhlbefund || "Nicht angegeben"}
Arztbericht/Arztbrief: ${arztbericht || "Nicht angegeben"}
Budget: ${budget ? budget + " Euro" : "Nicht angegeben"}

Bitte erstelle eine individuelle Therapie-Empfehlung basierend auf der Wissensdatenbank. ${bisherigeMittel ? "Bewerte zusätzlich die bisherigen Mittel und Dosierungen kritisch." : ""} Priorisiere günstige Hausmittel und Gewürze (Knoblauch, Kurkuma, Oregano etc.) vor teuren Spezialpräparaten.${typeof previousResultForCompare === "string" && previousResultForCompare.trim().length > 200 ? `

🔁 VERGLEICHSANKER – VORHERIGE AUSWERTUNG (nur als Referenz, NICHT als Faktenquelle)

Die folgende Auswertung wurde in einem früheren Lauf erstellt. Sie dient ausschließlich dem Soll-/Ist-Vergleich.
**Wichtig:** Behandle sie NICHT als gesicherte Wahrheit. Maßgeblich sind ausschließlich die oben gelieferten Patientendaten, Befunde und die Wissensdatenbank. Wenn die neuen Quellen einer früheren Aussage widersprechen, gilt die neue Bewertung.

\`\`\`
${(previousResultForCompare as string).slice(0, 18000)}
\`\`\`

ZUSÄTZLICHE PFLICHT-SEKTION GANZ OBEN im Output (vor allen anderen Sektionen):

## 🔁 Vergleich zur vorherigen Auswertung
- **✅ Bestätigt:** Welche Empfehlungen/Diagnosen aus der Vorauswertung werden durch die aktuellen Quellen erneut gestützt? (Stichpunkte)
- **🔄 Geändert / präzisiert:** Welche Mittel, Dosierungen, Schwerpunkte wurden angepasst und warum (Bezug auf konkrete neue Befunde)?
- **🆕 Neu hinzugekommen:** Was ergibt sich erstmals aus den neuen/zusätzlichen Quellen?
- **❌ Widerlegt / nicht mehr empfohlen:** Welche frühere Empfehlung entfällt, mit Begründung aus den neuen Daten?
- **⚠️ Offen / weiter zu beobachten:** Punkte, die noch unklar sind und in der nächsten Sitzung geklärt werden sollten.

Danach folgt die normale, vollständige neue Auswertung wie unten beschrieben.` : ""}`;

    // Defensive: ensure both messages are non-empty strings (gateway rejects empty/null content)
    const safeSystem = typeof systemPrompt === "string" && systemPrompt.length > 0
      ? systemPrompt
      : "Du bist ein erfahrener naturheilkundlicher Therapeut. Erstelle eine Therapie-Empfehlung.";
    const safeUser = typeof userMessage === "string" && userMessage.length > 0
      ? userMessage
      : "Bitte erstelle eine allgemeine Therapie-Empfehlung.";

    console.log(
      `System prompt: ${safeSystem.length} chars (type=${typeof systemPrompt}), ` +
      `User: ${safeUser.length} chars (type=${typeof userMessage})`
    );

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Modell-Wahl: Standard = Flash (schnell, hält 150s Edge-Limit ein, ~1/8 der Pro-Kosten).
        // Pro = tiefere Reasoning-Qualität, aber langsamer und teurer (Risiko Timeout bei großen Prompts).
        model: useProModel === true ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: safeSystem },
          { role: "user", content: safeUser },
        ],
        // Pro: Gemini 2.5 Pro verbraucht intern viel "Thinking"-Tokens; daher großzügig dimensionieren,
        // sonst wird die sichtbare Ausgabe abgeschnitten (z. B. fehlende Onkologie-Sektion am Ende).
        max_tokens: useProModel === true ? 32768 : 8192,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`KI-Gateway Fehler (${response.status}): ${t.slice(0, 300)}`);
    }

    // SSE-Stream der KI direkt durchreichen → vermeidet 150s IDLE_TIMEOUT bei langen Pro-Antworten.
    // Es wird nur die Audit-Info vorangestellt; regelbasierte Mittel werden nie direkt injiziert.
    const encoder = new TextEncoder();
    const auditLine = `data: ${JSON.stringify(auditPayload)}\n\n`;

    const upstream = response.body!.getReader();
    const wrapped = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(auditLine));
        try {
          while (true) {
            const { done, value } = await upstream.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
        } catch (err) {
          console.error("Stream-Fehler beim Durchreichen:", err);
        } finally {
          controller.close();
        }
      },
      cancel() { upstream.cancel().catch(() => {}); },
    });

    return new Response(wrapped, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("therapy-recommend error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
