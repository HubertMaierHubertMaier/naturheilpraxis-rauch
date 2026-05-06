import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-Memory-Cache für die Wiki-Rohdaten (überlebt warm starts).
// Invalidierung automatisch, sobald sich Anzahl oder max(updated_at) ändert.
interface WikiEntry {
  title: string;
  category: string;
  tags: string[];
  content: string;
}
interface WikiCache {
  signature: string;
  entries: WikiEntry[];
  builtAt: number;
}
let WIKI_CACHE: WikiCache | null = null;
const WIKI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min Sicherheitsnetz

// Limits sind pro Request (nach Filterung). Das Lovable AI Gateway lehnt sehr große
// Single-Messages ab (400 "Invalid input"), daher konservativ dimensionieren.
const MAX_ENTRY_CHARS = 3000;
const MAX_TOTAL_CHARS = 25_000; // ~6k Tokens – konservativ unter Gateway-Limit
const CACHE_VERSION = "v12";
const FORCE_FULL_WIKI_MAP_REDUCE = true;

// Map-Reduce-Konfiguration (Stufe 1: KI bewertet ALLE Einträge in Batches)
const MAP_REDUCE_BATCH_SIZE = 40; // Einträge pro Batch (nur Titel+Kategorie+Tags+Snippet)
const MAP_REDUCE_TOP_N = 35; // wie viele Einträge nach Stufe 1 in Volltext an Stufe 2 gehen
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
      const match = text.match(/\[[\d\s,.\-]+\]/);
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
        const key = `${e.title}|||${e.category}`;
        const sc = Math.max(0, Math.min(10, Number(scores[i]) || 0));
        scoreMap.set(key, sc);
      });
    } catch (err) {
      console.warn(`Batch ${batchIdx} Fehler:`, err instanceof Error ? err.message : String(err));
    }
  });

  await Promise.all(promises);
  console.log(`Map-Reduce: ${scoreMap.size}/${entries.length} Einträge bewertet`);
  return scoreMap;
}

async function loadWikiEntries(client: any): Promise<{ entries: WikiEntry[]; cacheHit: boolean }> {
  const { data: sigRows, error: sigError } = await client
    .from("admin_knowledge_base")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (sigError) throw new Error("Wiki-Signatur konnte nicht geladen werden: " + sigError.message);

  const { count, error: countError } = await client
    .from("admin_knowledge_base")
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error("Wiki-Anzahl konnte nicht geladen werden: " + countError.message);

  const maxUpdated = sigRows?.[0]?.updated_at ?? "empty";
  const signature = `${CACHE_VERSION}|${count ?? 0}|${maxUpdated}`;
  const now = Date.now();

  if (WIKI_CACHE && WIKI_CACHE.signature === signature && now - WIKI_CACHE.builtAt < WIKI_CACHE_TTL_MS) {
    console.log(`Wiki cache HIT (signature=${signature}, entries=${WIKI_CACHE.entries.length})`);
    return { entries: WIKI_CACHE.entries, cacheHit: true };
  }

  console.log(`Wiki cache MISS (new signature=${signature})`);
  const { data: wikiEntries, error: wikiError } = await client
    .from("admin_knowledge_base")
    .select("title, category, tags, content")
    .order("updated_at", { ascending: false });
  if (wikiError) throw new Error("Wiki-Daten konnten nicht geladen werden: " + wikiError.message);

  const entries = (wikiEntries || []) as WikiEntry[];
  WIKI_CACHE = { signature, entries, builtAt: now };
  return { entries, cacheHit: false };
}

// Tokenisiert eine Query (Belastungen + Symptome + Erkrankung) für das Relevanz-Scoring.
function tokenizeQuery(text: string): string[] {
  const STOPWORDS = new Set([
    "und", "oder", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "mit", "ohne", "von", "vom", "zur", "zum", "für", "auf", "bei", "auch", "ist", "sind",
    "im", "in", "an", "am", "auf", "als", "wie", "noch", "nicht", "kein", "keine",
    "organe", "organ", "index", "nicht", "angegeben", "li", "re", "rechts", "links",
  ]);
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^\wäöüß\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  ));
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
  return [queryText, extra].filter(Boolean).join(" ");
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
    const haystack = (
      e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || "")
    ).toLowerCase();
    let score = 0;
    if (tokens.length === 0) {
      score = 1; // Fallback gleich gewichten
    } else {
      for (const tok of tokens) {
        if ((e.title || "").toLowerCase().includes(tok)) score += 10;
        if ((e.tags || []).some((t) => t.toLowerCase().includes(tok))) score += 5;
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
  const tokens = tokenizeQuery(queryText);
  const lines = content.split("\n");
  const picked = new Set<number>();

  lines.forEach((line, idx) => {
    const normalized = line.toLowerCase();
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
  return combined.slice(0, MAX_ENTRY_CHARS);
}

function buildContext(entries: WikiEntry[], queryText: string): string {
  let context = entries
    .map((e) => {
      const content = buildEntryContent(e, queryText);
      return `### ${e.title} [${e.category}] Tags: ${(e.tags || []).join(", ")}\n${content}`;
    })
    .join("\n\n---\n\n");

  if (context.length > MAX_TOTAL_CHARS) {
    context = context.slice(0, MAX_TOTAL_CHARS) + "\n\n[... Wissensdatenbank gekürzt ...]";
  }
  if (!context.trim()) context = "(Keine relevanten Wissensdatenbank-Einträge gefunden)";
  return context;
}

function buildPhaseOneShortlist(scored: ScoredEntry[], maxItems = 80): string {
  const relevant = scored
    .filter((s) => s.score > 0)
    .slice(0, maxItems);
  if (relevant.length === 0) return "";
  return `### PHASE 1 – Gesamt-Wiki-Sichtung (alle Kategorien)\nDie folgenden Kandidaten wurden aus der gesamten Wissensdatenbank bewertet. Phase 2 muss daraus fachlich auswählen; keine Kategorie oder Produktlinie ist exklusiv.\n${relevant.map((s, idx) => `${idx + 1}. [${s.entry.category}] ${s.entry.title} – ${s.reason || `Score ${s.score}`}${s.included ? " → Volltext in Phase 2" : ""}`).join("\n")}`;
}

function entryText(e: WikiEntry): string {
  return `${e.title} ${e.category} ${(e.tags || []).join(" ")} ${e.content || ""}`.toLowerCase();
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
      text.includes("resistente stärke")
    )
  );
}

function extractProbioticHighlights(e: WikiEntry): string {
  const matches = (e.content || "").match(/(Bifidobacterium\s+[A-Za-z0-9\- ]+|Lactobacillus\s+[A-Za-z0-9\- ]+|Akkermansia\s+muciniphila|Faecalibacterium\s+prausnitzii|Inulin|Resistente Stärke)/gi) || [];
  return Array.from(new Set(matches.map((m) => m.trim().replace(/\s+/g, " ")))).slice(0, 14).join(", ");
}

function prioritySortEntries(entries: WikiEntry[], queryText: string, preferredLines: string[], manualTitles: string[], symptomTargets: SymptomTarget[] = []): WikiEntry[] {
  const query = queryText.toLowerCase();
  const probioticTerms = ["bifidobacterium", "lactobacillus", "akkermansia", "faecalibacterium", "enterococcus", "probiotik", "präbiotik", "mikrobiom", "darmflora", "darmaufbau"];
  const preferred = preferredLines.map((l) => l.toLowerCase());
  const manual = manualTitles.map((t) => t.toLowerCase());
  const score = (e: WikiEntry) => {
    const text = entryText(e);
    let s = 0;
    if (manual.includes((e.title || "").toLowerCase())) s += 100_000;
    for (const target of symptomTargets) {
      if (target.wikiTitles.some((title) => title.toLowerCase() === (e.title || "").toLowerCase())) s += 80_000;
      if (/homotoxikologie/i.test(e.category || "") && target.keywords.some((kw) => text.includes(kw.toLowerCase()))) s += 60_000;
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

function sanitizeRecommendation(text: string): string {
  let out = text;
  out = out.replace(/\*{0,2}WICHTIGER HINWEIS ZUERST:?\*{0,2}[\s\S]*?(?=\n\s*##\s|\n\s*#\s|$)/gi, "");
  out = out
    .split(/\n{2,}/)
    .filter((p) => !/(Red Flags|Gastroenterolog|Koloskopie|zwingend.{0,40}ärzt|Bitte\s+suchen\s+Sie.{0,80}Arzt|organische Erkrankungen.{0,80}ausschließen|ersetzt.{0,40}Arzt)/i.test(p))
    .join("\n\n");
  out = out.replace(
    /(?:[-*]\s*)?Substitution prüfen\s*[–-]\s*Bifidobacterium[^\n]*/gi,
    "- ✅ **Substitution** – Bifidobacterium auffällig/erniedrigt → Vitaplace **Biotik Balance Kapseln** bzw. **Biotik Sensitiv Pulver** sind in der Wissensdatenbank als Bifidobacterium-/Lactobacillus-haltige Praxispräparate hinterlegt."
  );
  return out.trim();
}

type ForcedRemedy = { group: string; line: string };

function hasWikiTitle(entries: WikiEntry[], title: string): boolean {
  return entries.some((e) => (e.title || "").toLowerCase() === title.toLowerCase());
}

function buildForcedWikiRemedies(entries: WikiEntry[], queryText: string): string {
  const query = queryText.toLowerCase();
  const has = (re: RegExp) => re.test(query);
  const add = (items: ForcedRemedy[], title: string, group: string, line: string) => {
    if (hasWikiTitle(entries, title) && !items.some((i) => i.line.includes(`**${title}`) || i.line.includes(`**${title} (`))) {
      items.push({ group, line });
    }
  };

  const items: ForcedRemedy[] = [];
  const microbiome = has(/stuhl|mikrobiom|darmflora|bifido|lacto|enterococcus|escherichia|ph\s*5|pH|candida|geotrichum|dysbio|gärung|gaerung|probiotik|präbiotik|praebiotik/i);
  const digestive = has(/bläh|blaeh|druck|spannung|aufsto|reflux|dyspeps|gastro|verdau|krampf|kolik|verstopf|durchfall|entleerung|bauch/i);
  const weight = has(/appetit|gewichtsverlust|gewichtsabnahme|abmager|untergewicht|kachex/i);
  const fatigue = has(/erschöpf|erschoepf|müde|mued|schwäche|schwaeche|energie|kraft|lebensqualität|lebensqualitaet/i);
  const psyche = has(/psyche|depress|angst|unruhe|rückzug|rueckzug|sozial|isolation|belastung/i);
  const sleep = has(/schlaf|insom|nacht|regeneration/i);
  // Geschlechts-Heuristik: Aletris-Heel ist primär ein Frauenmittel (Gebärmuttersenkung,
  // Anämie, Menstruation, postpartale Erschöpfung). Nur bei klar weiblichem Kontext forcieren.
  const femaleContext = has(/\b(frau|weiblich|patientin|gebärmutter|gebaermutter|uterus|menstruation|menstruell|zyklus|menopause|wechseljahr|prämenopaus|praemenopaus|postmenopaus|postpartal|wochenbett|schwanger|stillzeit|pms|dysmenor|amenor|mens(es|truation)|prolaps uteri)\b/i);

  if (microbiome) {
    add(items, "Biotik Balance Kapseln", "### 🦠 Probiotika, Präbiotika & Darmaufbau", "- **Biotik Balance Kapseln (Vitaplace)** | abends 2 Kapseln | oral, abends | 8–12 Wochen, Verlauf prüfen | 🔴 Essentiell | laut Bezug | Wiki: enthält Bifidobacterium bifidum/infantis/lactis/longum, Lactobacillus-Stämme, Inulin und resistente Stärke – daher KEINE Bifidobacterium-Substitutionslücke.");
    add(items, "Biotik Sensitiv Pulver", "### 🦠 Probiotika, Präbiotika & Darmaufbau", "- **Biotik Sensitiv Pulver (Vitaplace)** | einschleichen: 1 gestr. Dosierlöffel, innerhalb 10 Tagen auf 3 Dosierlöffel steigern | morgens vor einer Mahlzeit in kalter/lauwarmer Flüssigkeit | 8–12 Wochen | 🟡 Empfohlen | laut Bezug | Wiki: Bifidobacterium infantis/longum plus Lactobacillus rhamnosus/gasseri/salivarius/reuteri, besonders bei empfindlichem/histaminrelevantem Darmaufbau.");
    add(items, "DARM + LEBER Pulver", "### 🦠 Probiotika, Präbiotika & Darmaufbau", "- **DARM + LEBER Pulver (Vitaplace)** | mit ¼ Messlöffel beginnen, über 1 Woche auf 1 Messlöffel täglich steigern | in 200 ml Wasser, vormittags | ca. 3 Monate | 🟡 Empfohlen | laut Bezug | Wiki: Akazienfaser und resistente Stärke fördern Butyrat-bildende/mukonutritive Keime und unterstützen Darmschleimhaut plus Leberentgiftung.");
  }
  if (digestive) {
    add(items, "Glutamin & Fenchel Kapseln", "### 🦠 Probiotika, Präbiotika & Darmaufbau", "- **Glutamin & Fenchel Kapseln (Vitaplace)** | 2× täglich 1 Kapsel (1–0–1) | oral | 3 Monate | 🟡 Empfohlen | laut Bezug | Wiki: Fenchel karminativ bei Blähungen/Flatulenz, L-Glutamin als Repair-Baustein der Darmschleimhaut.");
    add(items, "Vitaplace Komplex BLAE", "### ⚕️ Homöopathie & Komplexmittel", "- **Vitaplace Komplex BLAE** | 5× täglich 10 Globuli | oral | symptomorientiert, Verlauf prüfen | 🟡 Empfohlen | laut Bezug | Wiki: explizit gegen Blähungen hinterlegt; passt zu Druck-/Spannungsgefühl und Gärungsbeschwerden.");
  }
  if (sleep) {
    add(items, "Night Relax Kapseln", "### 🧠 Schlaf, Nerven & Regeneration", "- **Night Relax Kapseln (Vitaplace)** | 1 rote + 2 transparente Kapseln | abends ½–1 Stunde vor dem Schlafen mit Flüssigkeit | 4–8 Wochen, Verlauf prüfen | 🟡 Empfohlen | laut Bezug | Wiki: für Schlaf, Regeneration bei Anspannung/Überlastung/Stress mit Melatonin, Tryptophan, Magnesium, Lavendel, Passionsblume.");
  }

  if (weight && hasWikiTitle(entries, "Therapeutischer Index: Sonstige")) {
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Hepeel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟡 Empfohlen | laut Bezug | Wiki Homotoxikologie/Sonstige: Hauptmittel bei Leberbelastung und Abmagerung; passend bei Gewichtsverlust/Appetitverlust." });
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Arsuraneel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟡 Empfohlen | laut Bezug | Wiki Homotoxikologie/Sonstige: bei Erschöpfung, Abmagerung und chronischen Schwächezuständen mit Arsen-Symptomatik." });
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **China-Homaccord** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Sonstige: Ergänzungsmittel bei Abmagerung und Schwächezuständen." });
  }
  if (digestive && hasWikiTitle(entries, "Therapeutischer Index: Verdauung")) {
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Nux vomica-Homaccord** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟡 Empfohlen | laut Bezug | Wiki Homotoxikologie/Verdauung: Haupt-/Ergänzungsmittel bei Blähungen, Darmstauung, Dyspepsie und Verdauungsbeschwerden." });
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Gastricumeel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral je nach Praxisstandard | symptomorientiert | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Verdauung: bei Dyspepsie, Hyperazidität und Magenbeschwerden." });
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Spascupreel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | symptomorientiert | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Verdauung: bei Krämpfen, Koliken und spastischen Beschwerden." });
    items.push({ group: "### ⚕️ Homöopathie & Komplexmittel", line: "- **Mucosa compositum** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Repair-Phase prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Verdauung/Sonstige: Phasenmittel bei chronischer Schleimhaut-/Verdauungsbelastung." });
  }
  if (fatigue && hasWikiTitle(entries, "Therapeutischer Index: Psyche")) {
    if (femaleContext) {
      items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Aletris-Heel** | 3× tgl. 10 Tropfen, akut stündlich (max. 12×/Tag) | oral, ½ h vor/nach den Mahlzeiten | Verlauf 4–6 Wochen prüfen | 🟡 Empfohlen | laut Bezug | Wiki Homotoxikologie: Frauenmittel bei Schwäche/Anämie/Gebärmuttersenkung – im weiblichen Kontext indiziert." });
    }
    items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Coenzyme compositum** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–8 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie: Phasenmittel zur Aktivierung des Citratzyklus bei Energiestoffwechsel-Belastung." });
    items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Ubichinon compositum** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral/injektiv je nach Praxisstandard | Verlauf 4–8 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie: Phasenmittel bei mitochondrialer Schwäche, Müdigkeit und chronischer Erschöpfung." });
  }
  if (psyche && hasWikiTitle(entries, "Therapeutischer Index: Psyche")) {
    items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Tonico-Heel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Psyche: Tonikum bei nervöser Erschöpfung und reaktiver depressiver Stimmung." });
    items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Ignatia-Homaccord** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Psyche: bei emotionaler Belastung, Kummer, Rückzug und Trauerreaktionen." });
    items.push({ group: "### 🧠 Schlaf, Nerven & Regeneration", line: "- **Neuro-Heel** | Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen | oral je nach Praxisstandard | Verlauf 4–6 Wochen prüfen | 🟢 Optional | laut Bezug | Wiki Homotoxikologie/Psyche: bei nervöser Unruhe, Reizbarkeit und psychovegetativer Belastung." });
  }

  // === Onkologie / Krebs / Metastasen ===
  const oncology = has(/\b(krebs|karzinom|carcinom|tumor|metasta|onko|cancer|mamma[\s-]?ca|brustkrebs|endometrium|prostata[\s-]?ca|leuk[äa]m|lymphom|sarkom|z\.?n\.?\s*mamma|zn\.?\s*mamma|rezidiv)\b/i);
  if (oncology) {
    const oncGroup = "### 🧬 Onkologische Begleittherapie (Cancer-Protokoll)";
    if (hasWikiTitle(entries, "Cancer – Therapieprotokoll (Ausleitung, Papainkur, Antioxidative Therapie)")) {
      items.push({ group: oncGroup, line: "- **Vitamin C + Glutathion (Malonsäure-Ausleitung)** | nach Praxisstandard (Wiki: hochdosiert) | oral/infusionsbegleitend | Daueranwendung im Therapiezyklus | 🔴 Essentiell | laut Bezug | Wiki Cancer-Protokoll Schritt 1: Ausleitung der Malonsäure." });
      items.push({ group: oncGroup, line: "- **Mega-Papainkur (Papain 1000 mg + L-Cystein 500 mg + Wermut 300 mg)** | stündlich über 6 h, 6 Tage Kur / 6 Tage Pause, Wiederholung | oral, 2 h nüchtern, danach eiweißarm | Zyklen austesten | 🔴 Essentiell | laut Bezug | Wiki Cancer-Protokoll Schritt 2 (Spulwurm-/Tumorbiologie). ⚠️ Wermut nicht in Schwangerschaft." });
      items.push({ group: oncGroup, line: "- **Mannavan Antioxi+ (Q10 100 mg + Selen 200 µg + Zink 4 mg)** | 1-0-1 | oral | begleitend dauerhaft | 🔴 Essentiell | laut Bezug | Wiki Cancer-Protokoll Schritt 3: antioxidative Basis." });
      items.push({ group: oncGroup, line: "- **Mannavan Vit C+ (500 mg Vit C + 160 mg Bioflavonoide)** | 1-0-1 | oral | begleitend | 🔴 Essentiell | laut Bezug | Wiki: reduziert Metastasenaktivität, ca. 600 % wirksamer, 13 h Verweildauer." });
      items.push({ group: oncGroup, line: "- **Mannavan Beta+ (Polyphenol-/Carotinoid-Komplex)** | 1-0-1 | oral | begleitend | 🟡 Empfohlen | laut Bezug | Wiki Cancer-Protokoll: Pinienrinde, Heidelbeere, Lutein, Lycopin, Brokkoli, grüner Tee." });
      items.push({ group: oncGroup, line: "- **Mannavan B6+** | 1-0-1 | oral | begleitend | 🟡 Empfohlen | laut Bezug | Wiki: obligater Bestandteil jeder Krebstherapie – Interferon-Synthese, Leber-Phase-2." });
      items.push({ group: oncGroup, line: "- **Mannavan Glucan (Beta-Glucan)** | 1-0-1 | oral | begleitend | 🟡 Empfohlen | laut Bezug | Wiki: aktiviert NK-Zellen und CD8+-Zellen gegen Tumor-/Virusbelastung." });
      items.push({ group: oncGroup, line: "- **Mannavan Curcu forte+ / Oligo+ (2. Stufe)** | nach Praxisstandard | oral | Steigerungsphase | 🟢 Optional | laut Bezug | Wiki Cancer-Stufe 2: Curcumin antiviral/antitumoral, Oligo+ als 50× Vit C / 20× Vit E Verstärker." });
    }
    if (hasWikiTitle(entries, "Diamond Shield – Begleitprotokoll bei Cancer")) {
      items.push({ group: oncGroup, line: "- **Diamond Shield Grundprogramm + Impuls-Entladung** | 2–7×/Woche | bioenergetisch | Daueranwendung | 🟡 Empfohlen | laut Bezug | Wiki Diamond-Shield-Cancer-Protokoll plus tägliches Erden ≥ 50 min." });
      items.push({ group: oncGroup, line: "- **Diamond Shield ChipCards (BR täglich, TUM jeden 2. Tag, CLST 3–7×/Woche, FvE lokal 7 min auf Tumor/Metastasen)** | wie Wiki | bioenergetisch | begleitend | 🟡 Empfohlen | laut Bezug | Wiki: ⚠️ FvE-ChipCard NICHT am Tag vor schulmedizinischer Therapie." });
      items.push({ group: oncGroup, line: "- **Milchsauer vergorene Gemüsesäfte (Sauerkraut-/Rote-Bete-Saft) nach FvE-Anwendung** | täglich 1 Glas | oral | begleitend | 🟢 Optional | laut Bezug | Wiki Diamond-Shield-Protokoll: Darmmilieu/Ausleitung." });
    }
  }

  if (items.length === 0) return "";
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return `## ✅ Verbindliche Wiki-Mittelsektion (automatisch aus Datenbanktreffern)\nDiese Mittel wurden regelbasiert aus vorhandenen Wiki-Einträgen ergänzt, damit die KI relevante Datenbanktreffer nicht wieder übergeht. Diese Sicherung ist NICHT exklusiv: Die KI muss zusätzlich alle in Phase 1 gefundenen Kandidaten aus ALLEN Wiki-Kategorien prüfen und daraus auswählen.\n\n${groups.map((g) => `${g}\n${items.filter((i) => i.group === g).map((i) => i.line).join("\n")}`).join("\n\n")}\n\n⚠️ **Wiki-Hinweis:** Bei Homotoxikologie-Indexmitteln sind teils Mittel/Indikation, aber keine genaue Dosierung hinterlegt. Diese Dosierungen bitte in der Praxis oder durch ergänzende Wiki-Einträge präzisieren.`;
}

function buildSymptomDirective(queryText: string, hasHomotoxContext: boolean): string {
  const directives = getActiveSymptomTargets(queryText).map(
    (target) => `- ${target.label}: Prüfe gezielt ${target.wikiTitles.join(", ")} und leite daraus zusätzlich zu Darmmitteln passende Mittel ab.`
  );
  if (!hasHomotoxContext || directives.length === 0) return "";
  return `\n\n🎯 SYMPTOM-ÜBERSETZUNG IN HOMOTOXIKOLOGIE/HEEL (ZWINGEND):\n${directives.join("\n")}\n- Diese Symptomachsen sind NICHT optional: Nenne mindestens 2 passende Heel-/Homotoxikologie-Mittel zusätzlich zur Darmbehandlung, sofern sie im Wiki-Kontext stehen.\n- Darmaufbau darf Symptome nicht vollständig überdecken; Labor/Stuhl, Symptome und gewählte Schwerpunkt-Ordner müssen sichtbar getrennt ausgewertet werden.`;
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

    // Parse request
    const { belastungen, symptome, erkrankung, alter, geschlecht, groesseCm, gewichtKg, bmi, bmiKategorie, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, arztbericht, metatronHeel, categories, bevorzugteLinie, pinnedMittel, useMapReduce, useProModel, nachschlag, previousResult } = await req.json();
    const metatronHeelText: string = typeof metatronHeel === "string" ? metatronHeel.trim() : "";

    const isNachschlag = typeof nachschlag === "string" && nachschlag.trim().length > 0 && typeof previousResult === "string" && previousResult.trim().length > 0;

    if (!belastungen && !symptome && !erkrankung && !isNachschlag) {
      throw new Error("Bitte geben Sie mindestens Belastungen, Symptome oder eine Erkrankung an.");
    }

    // Fetch wiki entries (cached) and select only the relevant ones for this query
    const { entries: allEntries, cacheHit } = await loadWikiEntries(userClient);

    // Boost-Ordner: gewählte Ordner werden GARANTIERT vollständig in den Kontext aufgenommen
    // (zusätzlich zur normalen Score-/Map-Reduce-Auswahl auf der GESAMTEN Datenbank).
    // → Ersetzt das frühere "Filter"-Verhalten. Default = ganze DB wird durchsucht.
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
      `${boostEntries.length} forced entries (search pool: ${allEntries.length})`
    );

    // Pinned remedies: titles to ALWAYS include in context
    const pinnedTitles: string[] = Array.isArray(pinnedMittel)
      ? pinnedMittel
          .map((p: any) => (typeof p?.title === "string" ? p.title.trim() : ""))
          .filter((t: string) => t.length > 0)
      : [];

    // Bevorzugte Produktlinien (Tags / Kategorie-Hinweise für die KI)
    const preferredLines: string[] = Array.isArray(bevorzugteLinie)
      ? bevorzugteLinie.filter((l: unknown) => typeof l === "string" && (l as string).trim().length > 0)
      : [];

    const queryText = [belastungen, symptome, erkrankung, bisherigeMittel, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, arztbericht, metatronHeelText, isNachschlag ? nachschlag : "", preferredLines.join(" "), pinnedTitles.join(" ")]
      .filter(Boolean)
      .join(" ");
    const activeSymptomTargets = getActiveSymptomTargets(queryText);
    const scoringQueryText = expandQueryForScoring(queryText);
    const hasHomotoxContext = activeSymptomTargets.length > 0 || selectedCats.some((c) => /homotoxikologie/i.test(c)) || preferredLines.some((l) => /heel|homotox/i.test(l));
    const symptomDirective = buildSymptomDirective(queryText, hasHomotoxContext);

    // ===== AUTO-PINNING: bei Stuhlbefund nur Stuhl-/Mikrobiom-spezifische Einträge mit aufnehmen =====
    // WICHTIG: NICHT die gesamte Kategorie "Labordiagnostik" matchen, sonst werden alle
    // Blutdiagnostik-Einträge (HbA1c, TSH, Hormone …) fälschlich mitgezogen.
    // Mikrobiom-/Stuhl-Stichworte: prüft Titel/Kategorie/Tags UND Content
    // (Probiotika-Produkte listen Stämme oft nur im Content, nicht in Tags – z.B. Vitaplace Biotik Balance)
    const STUHL_REGEX = /stuhl|mikrobiom|darmflora|calprotectin|zonulin|s-?iga|pankreas-?elastase|lactobacillus|bifidobacterium|akkermansia|faecalibacterium|enterococcus|escherichia|klebsiella|alpha-?1-?antitrypsin|probiotik|präbiotik|praebiotik|symbiose|darmsanier|darmaufbau/i;
    const hasMicrobiomeSignal = Boolean(stuhlbefund && stuhlbefund.trim().length > 0) || STUHL_REGEX.test(queryText);
    const autoPinnedFromStuhl: WikiEntry[] = hasMicrobiomeSignal
      ? filteredByCategory.filter((e) => {
          const text = entryText(e);
          if (STUHL_REGEX.test(text)) return true;
          // Vitaplace-Probiotika immer mitnehmen, sobald ein Stuhlbefund/Mikrobiom vorliegt:
          // sie enthalten die gesuchten Bifido-/Lacto-Stämme oft nur im Content.
          return isVitaplaceProbiotic(e);
        })
      : [];
    if (autoPinnedFromStuhl.length > 0) {
      console.log(`Auto-Pin: ${autoPinnedFromStuhl.length} Stuhl-/Mikrobiom-Einträge wegen Stuhlbefund (inkl. Content-Treffer)`);
    }

    // ===== AUTO-PINNING: Symptomachsen erzwingen, damit Labor/Stuhl die klinischen Symptome nicht verdrängt =====
    const symptomPinnedEntries: WikiEntry[] = activeSymptomTargets.length === 0
      ? []
      : allEntries.filter((e) => {
          const title = (e.title || "").toLowerCase();
          const text = entryText(e);
          return activeSymptomTargets.some((target) =>
            target.wikiTitles.some((t) => t.toLowerCase() === title) ||
            (/homotoxikologie/i.test(e.category || "") && target.keywords.some((kw) => text.includes(kw.toLowerCase())))
          );
        });
    if (symptomPinnedEntries.length > 0) {
      console.log(`Auto-Pin: ${symptomPinnedEntries.length} Symptom-/Homotoxikologie-Einträge wegen Symptomen (${activeSymptomTargets.map((t) => t.label).join(", ")})`);
    }

    // Force-include only truly mandatory entries.
    // WICHTIG: Boost-Ordner sind KEIN Filter und KEINE Exklusiv-Auswahl; sie markieren nur Schwerpunktbereiche.
    // Die eigentliche Phase-1-Sichtung läuft unten immer über die gesamte Wiki.
    const manualPinned = pinnedTitles.length > 0
      ? allEntries.filter((e) => pinnedTitles.some((t) => e.title.toLowerCase() === t.toLowerCase()))
      : [];
    const sameEntry = (a: WikiEntry, b: WikiEntry) => a.title === b.title && a.category === b.category;
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
    const restPool = filteredByCategory;
    const remainingBudget = Math.max(2000, MAX_TOTAL_CHARS - pinnedReserveChars);

    let restRelevant: WikiEntry[];
    let restScored: ScoredEntry[];
    let mapReduceUsed = false;
    const mustUseFullWikiMapReduce = FORCE_FULL_WIKI_MAP_REDUCE || useMapReduce === true;

    if (mustUseFullWikiMapReduce && restPool.length > 0) {
      // ===== MAP-REDUCE STUFE 1: KI bewertet IMMER ALLE Wiki-Einträge in Batches =====
      mapReduceUsed = true;
      const aiScores = await scoreEntriesViaAI(restPool, scoringQueryText, LOVABLE_API_KEY);

      // Kombiniere KI-Score (×10 Gewicht) + Wort-Score (Fallback für unbewertete Einträge)
      const wordScored = restPool.map((e) => {
        const haystack = (e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || "")).toLowerCase();
          const tokens = tokenizeQuery(scoringQueryText);
        let s = 0;
        for (const tok of tokens) {
          if ((e.title || "").toLowerCase().includes(tok)) s += 10;
          if ((e.tags || []).some((t) => t.toLowerCase().includes(tok))) s += 5;
          s += Math.min(haystack.split(tok).length - 1, 8);
        }
        const key = `${e.title}|||${e.category}`;
        const aiScore = aiScores.get(key);
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
    const vitaplaceProbioticsInContext = relevantEntries.filter(isVitaplaceProbiotic);
    const vitaplaceContext = vitaplaceProbioticsInContext.length > 0
      ? `\n\n### ZWANGSKONTEXT – Vitaplace-Probiotika bei Mikrobiom-/Bifido-/Lacto-Befund\n${vitaplaceProbioticsInContext.map((e) => `- ${e.title}: ${extractProbioticHighlights(e) || "Vitaplace-Probiotikum/Darmaufbau"}`).join("\n")}`
      : "";
    const wikiContext = buildContext(relevantEntries, scoringQueryText) + vitaplaceContext;
    const forcedWikiRemedySection = buildForcedWikiRemedies(allEntries, scoringQueryText);
    const phaseOneShortlist = buildPhaseOneShortlist(restScored, 80);
    console.log(
      `Wiki: ${allEntries.length} total (full DB search) → ` +
      `${pinnedEntries.length} pinned (${manualPinned.length} manual + ${symptomPinnedEntries.length} auto-symptom + ${autoPinnedFromStuhl.length} auto-stuhl + ${boostEntries.length} boost-folder) + ${restRelevant.length} relevant, ` +
      `context=${wikiContext.length} chars, cacheHit=${cacheHit}, mapReduce=${mapReduceUsed}, ` +
      `preferredLines=[${preferredLines.join(",")}], symptomAxes=[${activeSymptomTargets.map((t) => t.label).join(",")}]`
    );

    // ========= AUDIT-DATEN für Transparenz im Frontend =========
    const reasonFor = (e: WikiEntry) => {
      if (manualPinned.some((m) => sameEntry(m, e))) return "📌 Manuell gepinnt";
      if (symptomPinnedEntries.some((s) => sameEntry(s, e))) return "🧭 Auto-Pin (Symptome/Homotoxikologie)";
      if (autoPinnedFromStuhl.some((a) => sameEntry(a, e))) return "🔬 Auto-Pin (Stuhlbefund)";
      if (boostEntries.some((b) => sameEntry(b, e))) return "⭐ Boost-Ordner (garantiert)";
      return "📌 Pinned";
    };
    const usedEntries = [
      ...pinnedEntries.map((e) => ({
        title: e.title, category: e.category, score: 9999,
        reason: reasonFor(e)
      })),
      ...restScored.filter((s) => s.included).map((s) => ({
        title: s.entry.title, category: s.entry.category, score: s.score, reason: s.reason || "✅ Relevant"
      })),
    ];
    const skippedEntries = restScored
      .filter((s) => !s.included)
      .slice(0, 50)
      .map((s) => ({
        title: s.entry.title, category: s.entry.category, score: s.score, reason: s.reason || "—"
      }));

    const auditPayload = {
      __audit__: {
        totalInDb: allEntries.length,
        afterCategoryFilter: allEntries.length, // legacy field: search pool = full DB
        boostFolderCount: boostEntries.length,
        pinnedCount: pinnedEntries.length,
        relevantCount: restRelevant.length,
        usedCount: usedEntries.length,
        skippedTotalCount: restScored.filter((s) => !s.included).length,
        contextChars: wikiContext.length,
        contextLimit: MAX_TOTAL_CHARS,
        cacheHit,
        mapReduceUsed,
        queryTokens: tokenizeQuery(queryText),
        symptomAxes: activeSymptomTargets.map((t) => t.label),
        metatronHeelInput: metatronHeelText || null,
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
    if (laborKomplett) patientInfo.push(`Komplettes klassisches Labor: ${laborKomplett}`);
    if (stuhlbefund) patientInfo.push(`Stuhlbefund/Mikrobiom: ${stuhlbefund}`);
    if (arztbericht) patientInfo.push(`Arztbericht/Arztbrief (schulmedizinische Diagnostik & Therapie): ${arztbericht}`);
    if (metatronHeelText) patientInfo.push(`Heel-Mittel aus Metatron-/NLS-Resonanzauswertung: ${metatronHeelText}`);

    // Heel/Metatron-Direktive: vom Therapeuten manuell aus der Metatron-Resonanzanalyse übernommene Heel-Mittel
    // werden zwingend in die Empfehlung übernommen, mit Wiki-Dosierung sofern hinterlegt.
    const metatronHeelDirective = metatronHeelText
      ? `\n\n🎯 METATRON/NLS HEEL-RESONANZ (ZWINGEND BERÜCKSICHTIGEN):
Der Therapeut hat aus der Hospital Metatron HR (NLS) Resonanzanalyse folgende Heel-Komplexmittel als energetisch passend identifiziert:
${metatronHeelText}

VERBINDLICHE REGELN für diese Mittel:
1. JEDES dieser Mittel MUSS in der finalen Empfehlung unter "💧 Homöopathie & Komplexmittel" als eigene Pipe-Zeile erscheinen.
2. Wenn das Mittel in der Wissensdatenbank (Homotoxikologie, Therapeutischer Index ...) hinterlegt ist: Übernimm Dosierung, Indikation und Begründung exakt aus dem Wiki-Eintrag und zitiere die Wiki-Quelle.
3. Wenn keine Dosierung im Wiki hinterlegt ist: Schreibe "Dosierung im Wiki-Index nicht hinterlegt – Praxisdosierung prüfen" und gib als Standard-Erfahrungswert "3× tgl. 10 Tropfen oral" oder "3× tgl. 1 Tbl. einspeicheln" an, klar als Erfahrungsdosierung markiert.
4. Begründung MUSS am Ende den Zusatz enthalten: "(aus Metatron/NLS-Resonanzauswertung übernommen)".
5. Diese Mittel sind NICHT exklusiv – ergänze zusätzlich passende Mittel aus den anderen Wiki-Kategorien (Hausmittel, Vitamine, Mineralstoffe, Probiotika etc.).
6. Falls eines der Mittel im aktuellen Patientenkontext kontraindiziert wäre (Schwangerschaft, Wechselwirkung), nimm es trotzdem auf, kennzeichne es mit ⚠️ und erkläre die Kontraindikation kurz.`
      : "";

    const systemPrompt = `Du bist ein erfahrener naturheilkundlicher Therapeut und Berater und arbeitest ALS FACHLICHE UNTERSTÜTZUNG für den Heilpraktiker Peter Rauch (Ing. Elektrotechnik + Heilpraktiker + Physiotherapeut + Hypnotherapeut, 20+ Jahre Erfahrung). Diese Empfehlung wird von IHM in der Praxis verwendet — der Patient ist BEREITS in seiner Behandlung.

🚫 ABSOLUT VERBOTENE FORMULIERUNGEN (kritisch!):
- "Bitte ärztlich abklären lassen" / "zwingend ärztliche Abklärung" / "Besuch beim Arzt erforderlich"
- "Wichtiger Hinweis zuerst" / "Red Flags" / "Gastroenterologe" / "organische Erkrankungen sicher ausschließen" / "Koloskopie"
- "professionelle Hilfe holen" (impliziert, der Heilpraktiker sei nicht professionell — FALSCH)
- "ersetzt nicht den Arzt" / "konsultieren Sie einen Arzt"
- Jede Formulierung, die den Heilpraktiker als nachgeordnet, weniger qualifiziert oder als bloßen "Komplementär-Anbieter" darstellt.

✅ KORREKTE SPRACHREGELUNG (Memory practitioner-equality-language):
- Heilpraktiker und Arzt sind GLEICHRANGIGE Heilberufe (HeilprG). Peter Rauch hat eigenständige Diagnose- und Behandlungsbefugnis.
- Der Patient ist bei Peter Rauch RICHTIG aufgehoben — die meisten kommen, WEIL Ärzte ihnen nicht helfen konnten.
- Bei tatsächlich akut bedrohlichen Symptomen (V.a. Tumor, akutes Abdomen, Notfall, meldepflichtige Infektion) formuliere: "In der Praxis besprechen — ggf. ergänzende ärztliche Bildgebung (Sono/MRT) veranlassen, da Bildgebung Arztvorbehalt ist. Die naturheilkundliche Begleitung stimmen wir parallel ab."
- Standard bei unklaren Befunden: "Bitte in der nächsten Sitzung mit Peter Rauch besprechen" oder "Praxisinterne Abklärung empfohlen (Bioresonanz/EAV/NLS/Labor)".
- NIE den Patienten "wegschicken". Symptome wie Gewichtsverlust, Erschöpfung, soziale Isolation sind GENAU der Grund, warum jemand zum Heilpraktiker kommt — nicht der Grund, ihn abzuweisen.
- Disclaimer am Ende NUR kurz: "Diese Empfehlung dient als Arbeitsgrundlage für Peter Rauch und wird in der Praxis individuell angepasst."

Du hast Zugriff auf die folgende Wissensdatenbank mit Naturheilmitteln, Pathogenen und Therapieprotokollen.

WISSENSDATENBANK:
${wikiContext}

${phaseOneShortlist ? `\n${phaseOneShortlist}\n` : ""}

${forcedWikiRemedySection ? `\n${forcedWikiRemedySection}\n` : ""}

DEINE AUFGABE:
Analysiere Belastungen, Labor/Stuhl UND Symptome gleichrangig. Erstelle eine individuelle Therapie-Empfehlung basierend NUR auf den Mitteln und Protokollen aus der Wissensdatenbank. Ein auffälliger Stuhlbefund darf die übrigen Symptome nicht verdrängen: Nach der Darmstrategie musst du zusätzlich symptom-/organbezogene Mittel aus passenden Wiki-Einträgen prüfen.

ZWEISTUFIGER WIKI-PROZESS (VERBINDLICH FÜR ALLE PATIENTEN):
- Phase 1 ist die Gesamt-Wiki-Sichtung: ALLE Einträge aus ALLEN Kategorien werden gegen die Eingabe aus der Therapie-Maske bewertet. Es gibt keine Beschränkung auf Homotoxikologie, Heel, Vitaplace oder Stuhldiagnostik.
- Phase 2 ist die fachliche Auswahl: Verwende die Volltexte im Wiki-Kontext UND die Phase-1-Shortlist, um Mittel aus allen passenden Kategorien auszuwählen.
- Produktlinien/Fokusordner sind nur Priorisierung/Boost, niemals Ausschluss anderer Wiki-Mittel.
- Wenn Phase 1 relevante Mittel aus anderen Kategorien findet, müssen diese entweder empfohlen oder fachlich begründet verworfen werden.

ZWINGENDE BALANCE-REGEL:
- Teile deine interne Auswertung in drei gleichwertige Spuren: (A) Pathogene/Belastungen, (B) Symptome/klinisches Bild, (C) Labor/Stuhl.
- Wenn in der Wissensdatenbank therapeutische Index-Einträge, Homotoxikologie/Heel-Einträge oder symptombezogene Mittel stehen, MÜSSEN daraus konkrete Mittelzeilen entstehen – nicht nur Analyse-Fließtext.
- Bei Symptomtreffern wie Erschöpfung, Appetitlosigkeit, Gewichtsverlust, Schwäche, Psyche/Isolation oder Verdauungsbeschwerden: Extrahiere die dort genannten **Hauptmittel**, **Ergänzungsmittel** und ggf. **Phasenmittel** aus dem Wiki-Kontext und ordne sie unter "Homöopathie & Komplexmittel" ein.
- Nur wenn im tatsächlich gelieferten Wiki-Kontext zu einer Symptomspur gar kein passender Eintrag steht, darfst du dafür eine Wissensdatenbank-Lücke melden.
- Eine Darm-/Mikrobiomstrategie allein ist unvollständig, sobald Symptome angegeben sind; ergänze dann immer symptom-/organbezogene Mittel aus der Datenbank.

🧬 ONKOLOGIE-REGEL (ZWINGEND, wenn Krebs/Karzinom/Tumor/Metastasen/"z.n. Mamma-Ca"/"Z.n. Endometrium-Ca" etc. in Erkrankung, Symptomen oder Belastungen vorkommen):
- Du MUSST eine eigene Sektion "## 🧬 Onkologische Begleittherapie" erzeugen, in der die Wiki-Einträge "Cancer – Therapieprotokoll (Ausleitung, Papainkur, Antioxidative Therapie)" und "Diamond Shield – Begleitprotokoll bei Cancer" 1:1 in strukturierte Mittelzeilen überführt werden (Vitamin C/Glutathion-Ausleitung, Mega-Papainkur, Mannavan Antioxi+/Vit C+/Beta+/B6+/Glucan, Stufe 2 Curcu forte+/Oligo+, Diamond-Shield-Grundprogramm + ChipCards BR/TUM/CLST/FvE, milchsauer vergorene Säfte).
- Auch bei "Z.n." (Zustand nach) Brustkrebs/Endometriumkarzinom mit Knochenmetastasen oder unter laufender CDK4/6-/Aromatase-/Bisphosphonat-Therapie (Abemaciclib, Letrozol, Zometa) MUSS diese Begleittherapie erscheinen – als naturheilkundliche Begleitung, nicht als Ersatz.
- Wechselwirkungen explizit kennzeichnen: hochdosiertes Vit C / Glutathion / Antioxidantien können mit laufender zytostatischer/zielgerichteter Therapie interagieren → Hinweis "Zeitliche Abstimmung mit onkologischer Therapie in der Praxis besprechen". KEIN pauschales "bitte ärztlich abklären".
- Wermut/Schwarzwalnuss in der Papainkur: Kontraindikation Schwangerschaft/Stillzeit prüfen.
- FvE-ChipCard: Hinweis "nicht am Tag vor schulmedizinischer Therapie" mitgeben.
- Diese Onkologie-Sektion darf NICHT durch eine Darm-/Symptomstrategie verdrängt werden.

🔬 METATRON/NLS INDEX-INTERPRETATION (ZWINGEND – HÄUFIGE FEHLERQUELLE!):
Bei Pathogenen mit "Index"-Wert aus der Hospital Metatron HR / NLS-Resonanzanalyse gilt eine INVERSE Skala:
  • KLEINER Wert = HOHE Wahrscheinlichkeit für materielles/aktives Vorhandensein
  • GROSSER Wert = GERINGE Wahrscheinlichkeit (nur Hintergrundbelastung oder rein informativ)
Konkrete Schwellen:
  - 0.000 – 0.250 → sehr hohe Wahrscheinlichkeit (akut/materiell) → ZWINGEND priorisieren, Hauptmittel
  - 0.251 – 0.425 → hohe Wahrscheinlichkeit (klinisch relevant) → behandeln, eigenes Mittel pro Pathogen
  - 0.426 – 0.600 → mittlere Wahrscheinlichkeit → berücksichtigen, ggf. zusammenfassen
  - 0.601 – 0.700 → geringe Wahrscheinlichkeit → nur ergänzend / Drainage
  - > 0.700      → sehr gering, nur informativ → NICHT als aktive Belastung behandeln, NICHT priorisieren
Reihenfolge der Mittelempfehlung pro Pathogen MUSS dieser Priorität folgen. Pathogene mit Index > 0.700 dürfen nur erwähnt werden, wenn sie das klinische Bild plausibel ergänzen – nicht als Hauptindikation.

⭐ BEVORZUGTE MITTEL & PRODUKTLINIEN DES THERAPEUTEN (HÖCHSTE PRIORITÄT):
${preferredLines.length > 0
  ? `- Bevorzugte Produktlinien: ${preferredLines.join(", ")}.\n  → Bei vergleichbarer Wirkung MUSST du Mittel aus diesen Linien priorisieren (vor anderen Marken). Nenne die Linie explizit im Mittelnamen (z.B. "Biotik Balance (Vitaplace)").`
  : "- Keine Linien-Präferenz angegeben."}
${pinnedTitles.length > 0
  ? `- ZWINGEND in die Empfehlung aufzunehmende Mittel (vom Therapeuten gepinnt): ${pinnedTitles.join("; ")}.
  → Diese Mittel MÜSSEN in der Empfehlung erscheinen, mit korrekter Dosierung aus dem Wiki-Eintrag, plausibler Indikationsbegründung im Patientenkontext und Einordnung in die passende Mittel-Gruppe (Hausmittel, Probiotika, Vitamine etc.).
  → Falls ein gepinntes Mittel im aktuellen Patientenfall kontraindiziert wäre (Schwangerschaft, Wechselwirkung, Alter), nimm es trotzdem auf, kennzeichne es aber mit ⚠️ und begründe die Kontraindikation transparent.`
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
   - Männerspezifika: Prostata (Sabal, Brennnesselwurzel, Kürbiskern, Lycopin), Testosteron-Stützung (Zink, Maca) bei passender Indikation.

2c. **Körperkonstitution & BMI**: ${typeof bmi === "number" ? `BMI ${bmi} (${bmiKategorie})` : (groesseCm && gewichtKg ? `Größe ${groesseCm} cm, Gewicht ${gewichtKg} kg` : "Nicht angegeben")}
   - **BMI < 18.5 (Untergewicht)**: Aufbau-/Mitochondrienstrategie, Eiweiß (Whey/Lupinen), B-Komplex, Coenzyme compositum, Zink, kein zusätzliches Fasten/Detox, KEINE appetithemmenden Bitterstoffe in hoher Dosis. Eigene Sektion "🥗 Ernährung & Aufbau" mit konkreten Empfehlungen (3–5 Mahlzeiten, kalorisch dichte gesunde Fette, Eiweißanteil ≥1.2 g/kg).
   - **BMI 25–29.9 (Übergewicht)**: Insulinresistenz prüfen, LOGI/Low-Carb-Empfehlung, Bitterstoffe (Amara), Berberin, Mariendistel zur Leberentlastung, Bewegungsempfehlung. Sektion "🥗 Ernährung & Stoffwechsel".
   - **BMI 30–34.9 (Adipositas I)**: zusätzlich Hinweis auf metabolisches Syndrom (HbA1c, Lipidstatus, Leberenzyme prüfen), NAFLD-Risiko, Schilddrüse (TSH, fT3/fT4) abklären lassen.
   - **BMI ≥ 35 (Adipositas II/III)**: hohe kardiometabolische Gefahr – konsequente Ernährungsumstellung, Empfehlung zur engmaschigen praxisinternen Begleitung; Bildgebung/Diagnostik nur bei zusätzlichem Verdacht.
   - **BMI ≥ 25 + Hashimoto/SD-Verdacht**: explizit Selen, Zink, Tyrosin, Jodstatus prüfen.
   - **PFLICHT bei BMI ≥ 25**: In der Sektion "🥗 Ernährung & Stoffwechsel" (oder im Begleitmaßnahmen-Block) MUSS folgender Patientenhinweis stehen:
     > "Bitte lesen Sie zur Ernährungsumstellung die Patienteninfos in unserer Infothek – insbesondere **LOGI-Kost & Mitochondrien**: https://naturheilpraxis-rauch.lovable.app/logi-ernaehrung-mitochondrien.html sowie das **Diabetes-Handout** https://naturheilpraxis-rauch.lovable.app/diabetes-handout.html"
     Zusätzlich passende Vitaplace-Mittel prüfen: **Vitaplace Komplex FiguWo** (Gewichtsregulation) und **Vitaplace Darm + Leber Pulver** (Mikrobiom, Hungergefühl, Leberentlastung).
   - **Allgemein (jede BMI-Kategorie)**: Am Ende der Empfehlung im Block "🔄 Begleitmaßnahmen" einen kurzen Verweis auf die Patienten-Infothek (https://naturheilpraxis-rauch.lovable.app) ergänzen, damit der Patient weiterführende Informationen selbständig nachlesen kann.
   - Falls BMI nicht angegeben: KEINE Annahmen treffen, kein Ernährungsblock erzwingen – aber den allgemeinen Infothek-Verweis dennoch im Begleitmaßnahmen-Block aufnehmen.

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

5. **Laborwerte**: 
   - Erhöhte Werte: ${laborErhoeht || "Keine angegeben"}
   - Erniedrigte Werte: ${laborErniedrigt || "Keine angegeben"}
   - Komplettes klassisches Labor (Gesamtübersicht inkl. unauffälliger Werte): ${laborKomplett || "Nicht angegeben"}
   - Falls Laborwerte angegeben: Beziehe diese in die Therapieempfehlung mit ein. Erkläre, welche Werte auffällig sind und welche Naturheilmittel oder Ernährungsmaßnahmen diese verbessern können. Bei vorhandenem komplettem Labor: nutze auch unauffällige Werte zur Mustererkennung (z.B. Subklinik, Verlaufstendenzen, Plausibilitätsprüfung) und nenne explizit, welche Werte unauffällig/normal sind.

6. **Stuhlbefund / Mikrobiom / Laborwerte**: ${stuhlbefund || "Nicht angegeben"}
   
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
- **IMMER günstige Alternativen zuerst empfehlen**: Gewürze und Hausmittel wie Knoblauch (frisch, roh – stark antimikrobiell), Kurkuma, Oregano (frisch/getrocknet), Ingwer, Nelken, Thymian, Zimt, Meerrettich, Schwarzkümmelöl etc.
- Teure Spezialpräparate (NutraMedix, Biopure etc.) NUR empfehlen wenn:
  a) keine günstige Alternative existiert
  b) die günstige Alternative nicht ausreichend wirksam ist
  c) das Budget es erlaubt
- Schätze die ungefähren Gesamtkosten pro Monat für die empfohlenen Mittel
- Priorisiere Mittel nach Wichtigkeit: Die wichtigsten 2-3 Mittel zuerst, optionale Ergänzungen kennzeichnen

AUSGABEFORMAT:
## 🔍 Analyse der Belastungen
Kurze Zusammenfassung der identifizierten Probleme.

## 📊 Bewertung der bisherigen Therapie
(Nur falls bisherige Mittel angegeben) Detaillierte Bewertung jedes bisherigen Mittels:
- ✅ Sinnvoll beibehalten (mit Begründung)
- 🔄 Dosisanpassung empfohlen (alt → neu, mit Begründung)
- ❌ Absetzen empfohlen (mit Begründung)
- 🔀 Alternative empfohlen (Wechsel zu X, mit Begründung)

## 🔬 Laborwert-Analyse
(Nur falls Laborwerte angegeben) Bewertung der auffälligen Werte mit naturheilkundlichen Empfehlungen zur Verbesserung.

## 🧫 Stuhlbefund-Analyse
(Nur falls Stuhlbefund angegeben) Bewertung von Mikrobiom-Dysbiose, Verdauungs-, Entzündungs- und Barriere-Markern. Konkrete Ableitung der Darmsanierungs-Strategie (4-R-Konzept: Remove – Replace – Reinoculate – Repair).

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

## ⚠️ Sicherheitshinweise
Spezifische Kontraindikationen für diesen Patienten basierend auf Alter, Schwangerschaft, Medikamenten.

## 💊 Empfohlene Mittel – gegliedert nach Stoffgruppe / Wiki-Kategorie

WICHTIG: Gruppiere die empfohlenen Mittel ZWINGEND nach den folgenden Überschriften (nur die Gruppen ausgeben, in denen Du tatsächlich etwas empfiehlst). Die Reihenfolge ist verbindlich:

### 🌿 Hausmittel & Gewürze
(Knoblauch, Kurkuma, Oregano, Ingwer, Nelken, Thymian, Zimt, Meerrettich, Schwarzkümmelöl, Zitrone usw.)

### 🍋 Vitamine
(Vitamin C, D, B-Komplex, A, E, K2 usw.)

### 🧂 Mineralstoffe & Spurenelemente
(Magnesium, Zink, Selen, Eisen, Jod, Kalium usw.)

### 🐟 Fettsäuren & Aminosäuren
(Omega-3, Krill-Öl, L-Carnitin, Taurin, Lysin, NAC usw.)

### 🌱 Phytotherapie & Tinkturen
(CERES-Urtinkturen, Ceylon-Zimt, Manuka, Kapuzinerkresse, Schwarzwalnuss, Wermut, Beifuß usw. – sofern nicht reine Hausmittel)

### 🍄 Heilpilze (Mykotherapie)
(Reishi, Maitake, Shiitake, Coriolus, Pleurotus, Auricularia, Champignon, Mandelpilz)

### 🧪 Sanum-Therapie (Isopathie nach Enderlein)
(MUCOKEHL, NIGERSAN, NOTAKEHL, FORTAKEHL, PEFRAKEHL, ALBICANSAN, EXMYKEHL, SANUVIS, CITROKEHL, ACIDUM TARTARICUM, FORMASAN, ALKALA N, ZINKOKEHL, UTILIN, RECARCIN, LATENSIN, BOVISAN, LEPTUCIN, ARTHROKEHLAN, SANUKEHL-Haptene usw.)

### 💧 Homöopathie & Komplexmittel
(Heel-Präparate wie Mucosa comp., Lymphomyosot, Traumeel, Engystol; Klassische Homöopathika; spagyrische Mittel)

### 🧫 Probiotika, Präbiotika & Darmaufbau
(Vitaplace **Biotik Sensitiv Pulver** und **Biotik Balance Kapseln** = Mehrstamm-Probiotika der Praxis-Eigenmarke mit *Bifidobacterium bifidum/infantis/lactis/longum* und *Lactobacillus acidophilus/casei/lactis/paracasei/plantarum* — bei Bifido-/Lacto-Mangel BEVORZUGT empfehlen; Symbioflor 1+2, Mutaflor, RMS-Biofrid, EM-Ferment, Flohsamen, Inulin)

### 💎 Spezialpräparate
(NutraMedix Samento/Banderol/Cumanda, Biopure, Quicksilver Scientific u.ä. – nur wenn günstige Alternativen nicht ausreichen)

### 🩺 Apparative & klinische Therapien
(Infusionen, Ozon, IHHT, Colon-Hydrotherapie, Frequenztherapie, Bioresonanz)

INNERHALB JEDER GRUPPE: Gib jedes Mittel ZWINGEND in folgendem strukturierten Format aus, damit das Frontend es als Tabellenzeile darstellen kann. Trenne die Felder mit Pipe-Zeichen " | " und beginne JEDE Mittel-Zeile mit Bindestrich + Leerzeichen:

- **Mittelname** | Dosierung | Anwendung/Einnahme | Dauer | Priorität | Kosten/Monat | Begründung

WO:
- **Mittelname**: Name in doppelten Sternchen, ggf. mit lateinischem Namen in Klammern
- Dosierung: z.B. "2×1 Tbl. tgl." oder "3×8 Tropfen"
- Anwendung/Einnahme: z.B. "oral, vor dem Essen" oder "in Wasser einnehmen"
- Dauer: z.B. "4 Wochen" oder "dauerhaft"
- Priorität: NUR eines von: 🔴 Essentiell | 🟡 Empfohlen | 🟢 Optional
- Kosten/Monat: z.B. "~5 €" oder "~40 €"
- Begründung: KURZ (max 1 Satz) warum dieses Mittel und wogegen es wirkt

BEISPIEL:
- **MUCOKEHL D5** (Mucor racemosus) | 2×1 Tbl. tgl. | oral, einspeicheln | 6 Wochen | 🔴 Essentiell | ~28 € | Verflüssigt geronnenes Blut, verbessert Mikrozirkulation bei KHK
- **Knoblauch** (Allium sativum) | 1-2 Zehen tgl. roh | mit Speisen | dauerhaft | 🟡 Empfohlen | ~3 € | Antimikrobiell, gefäßprotektiv, blutdrucksenkend

WICHTIG: KEINE Unterpunkte, KEIN Fließtext zwischen den Mittel-Zeilen. Nur die strukturierten Pipe-Zeilen, eine pro Mittel.

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
Zeitlicher Ablauf der Einnahme (welche Mittel wann, in welcher Reihenfolge).

## 🔄 Begleitmaßnahmen
Empfehlungen zu Ernährung, Darmaufbau, Entgiftungsunterstützung. Hier auch günstige Hausmittel wie Knoblauch-Zitronen-Kur, Kurkuma-Paste, Ingwertee etc.

## ❌ Ausgeschlossene Mittel
Mittel die NICHT gegeben werden dürfen mit Begründung (Alter, Schwangerschaft, Medikamente).

WICHTIG: 
- Empfehle NUR Mittel die in der Wissensdatenbank vorhanden sind. Erfinde keine neuen Mittel oder Dosierungen.
- WENN ein notwendiges Mittel fehlt: NICHT improvisieren, sondern als Lücke unter "🕳️ Wissensdatenbank-Lücken" (Abschnitt früh oben) melden.
- Gewürze und Hausmittel IMMER mit aufnehmen wenn sie therapeutisch relevant sind – sie sind günstig und leicht verfügbar.
- Bei JEDEM Mittel erklären WARUM es empfohlen wird und WOGEGEN es wirkt.
- Schreibe KOMPAKT: pro Mittel max. 1 Begründungssatz, keine doppelten Erklärungen.`;

    const userMessage = isNachschlag
      ? `Patientendaten:
${patientInfo.join("\n")}

Belastungen/Pathogene: ${belastungen || "Nicht angegeben"}
Symptome: ${symptome || "Nicht angegeben"}
Erkrankung: ${erkrankung || "Nicht angegeben"}
Bisherige Naturheilmittel: ${bisherigeMittel || "Keine"}
Stuhlbefund/Mikrobiom: ${stuhlbefund || "Nicht angegeben"}
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

Belastungen/Pathogene: ${belastungen || "Nicht angegeben"}
Symptome: ${symptome || "Nicht angegeben"}  
Erkrankung: ${erkrankung || "Nicht angegeben"}
Bisherige Naturheilmittel: ${bisherigeMittel || "Keine"}
Stuhlbefund/Mikrobiom: ${stuhlbefund || "Nicht angegeben"}
Budget: ${budget ? budget + " Euro" : "Nicht angegeben"}

Bitte erstelle eine individuelle Therapie-Empfehlung basierend auf der Wissensdatenbank. ${bisherigeMittel ? "Bewerte zusätzlich die bisherigen Mittel und Dosierungen kritisch." : ""} Priorisiere günstige Hausmittel und Gewürze (Knoblauch, Kurkuma, Oregano etc.) vor teuren Spezialpräparaten.`;

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
    // Audit-Info + ggf. erzwungene Wiki-Mittelsektion als allererste SSE-Frames vorangestellt.
    const encoder = new TextEncoder();
    const auditLine = `data: ${JSON.stringify(auditPayload)}\n\n`;
    const forcedFrame = forcedWikiRemedySection
      ? `data: ${JSON.stringify({ choices: [{ delta: { content: `${forcedWikiRemedySection}\n\n---\n\n` } }] })}\n\n`
      : "";

    const upstream = response.body!.getReader();
    const wrapped = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(auditLine));
        if (forcedFrame) controller.enqueue(encoder.encode(forcedFrame));
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
