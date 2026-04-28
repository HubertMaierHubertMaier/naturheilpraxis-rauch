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
const CACHE_VERSION = "v6";

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

function buildContext(entries: WikiEntry[]): string {
  let context = entries
    .map((e) => {
      const content = (e.content || "").slice(0, MAX_ENTRY_CHARS);
      return `### ${e.title} [${e.category}] Tags: ${(e.tags || []).join(", ")}\n${content}`;
    })
    .join("\n\n---\n\n");

  if (context.length > MAX_TOTAL_CHARS) {
    context = context.slice(0, MAX_TOTAL_CHARS) + "\n\n[... Wissensdatenbank gekürzt ...]";
  }
  if (!context.trim()) context = "(Keine relevanten Wissensdatenbank-Einträge gefunden)";
  return context;
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
    const { belastungen, symptome, erkrankung, alter, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, categories, bevorzugteLinie, pinnedMittel, useMapReduce } = await req.json();

    if (!belastungen && !symptome && !erkrankung) {
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

    const queryText = [belastungen, symptome, erkrankung, bisherigeMittel, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, preferredLines.join(" "), pinnedTitles.join(" ")]
      .filter(Boolean)
      .join(" ");

    // ===== AUTO-PINNING: bei Stuhlbefund nur Stuhl-/Mikrobiom-spezifische Einträge mit aufnehmen =====
    // WICHTIG: NICHT die gesamte Kategorie "Labordiagnostik" matchen, sonst werden alle
    // Blutdiagnostik-Einträge (HbA1c, TSH, Hormone …) fälschlich mitgezogen.
    // Mikrobiom-/Stuhl-Stichworte: prüft Titel/Kategorie/Tags UND Content
    // (Probiotika-Produkte listen Stämme oft nur im Content, nicht in Tags – z.B. Vitaplace Biotik Balance)
    const STUHL_REGEX = /stuhl|mikrobiom|darmflora|calprotectin|zonulin|s-?iga|pankreas-?elastase|lactobacillus|bifidobacterium|akkermansia|faecalibacterium|enterococcus|escherichia|klebsiella|alpha-?1-?antitrypsin|probiotik|präbiotik|praebiotik|symbiose|darmsanier|darmaufbau/i;
    const autoPinnedFromStuhl: WikiEntry[] = stuhlbefund && stuhlbefund.trim().length > 0
      ? filteredByCategory.filter((e) => {
          const meta = (e.category + " " + e.title + " " + (e.tags || []).join(" ")).toLowerCase();
          if (STUHL_REGEX.test(meta)) return true;
          // Zusätzlich: Content prüfen, aber NUR bei klaren Mikrobiom-/Probiotika-Treffern,
          // damit nicht zufällige Erwähnungen alles aufblähen.
          const content = (e.content || "").toLowerCase();
          return /probiotik|präbiotik|praebiotik/.test(content) &&
            /bifidobacterium|lactobacillus|akkermansia|faecalibacterium|enterococcus|escherichia coli/.test(content);
        })
      : [];
    if (autoPinnedFromStuhl.length > 0) {
      console.log(`Auto-Pin: ${autoPinnedFromStuhl.length} Stuhl-/Mikrobiom-Einträge wegen Stuhlbefund (inkl. Content-Treffer)`);
    }

    // Force-include all pinned wiki entries (manual + auto + boost-folders)
    const manualPinned = pinnedTitles.length > 0
      ? allEntries.filter((e) => pinnedTitles.some((t) => e.title.toLowerCase() === t.toLowerCase()))
      : [];
    const sameEntry = (a: WikiEntry, b: WikiEntry) => a.title === b.title && a.category === b.category;
    const pinnedEntries = [
      ...manualPinned,
      ...autoPinnedFromStuhl.filter((a) => !manualPinned.some((m) => sameEntry(m, a))),
      ...boostEntries.filter(
        (b) =>
          !manualPinned.some((m) => sameEntry(m, b)) &&
          !autoPinnedFromStuhl.some((a) => sameEntry(a, b))
      ),
    ];
    const pinnedReserveChars = pinnedEntries.reduce(
      (sum, e) => sum + Math.min((e.content || "").length, MAX_ENTRY_CHARS) + 200,
      0
    );

    // Score the rest, but exclude already-pinned entries
    const restPool = filteredByCategory.filter(
      (e) => !pinnedEntries.some((p) => p.title === e.title && p.category === e.category)
    );
    const remainingBudget = Math.max(2000, MAX_TOTAL_CHARS - pinnedReserveChars);

    let restRelevant: WikiEntry[];
    let restScored: ScoredEntry[];
    let mapReduceUsed = false;

    if (useMapReduce === true && restPool.length > 0) {
      // ===== MAP-REDUCE STUFE 1: KI bewertet ALLE restlichen Einträge in Batches =====
      mapReduceUsed = true;
      const aiScores = await scoreEntriesViaAI(restPool, queryText, LOVABLE_API_KEY);

      // Kombiniere KI-Score (×10 Gewicht) + Wort-Score (Fallback für unbewertete Einträge)
      const wordScored = restPool.map((e) => {
        const haystack = (e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || "")).toLowerCase();
        const tokens = tokenizeQuery(queryText);
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
      const r = selectRelevantEntriesScored(restPool, queryText, remainingBudget);
      restRelevant = r.selected;
      restScored = r.scored;
    }

    const relevantEntries = [...pinnedEntries, ...restRelevant];
    const wikiContext = buildContext(relevantEntries);
    console.log(
      `Wiki: ${allEntries.length} total (full DB search) → ` +
      `${pinnedEntries.length} pinned (${manualPinned.length} manual + ${autoPinnedFromStuhl.length} auto-stuhl + ${boostEntries.length} boost-folder) + ${restRelevant.length} relevant, ` +
      `context=${wikiContext.length} chars, cacheHit=${cacheHit}, mapReduce=${mapReduceUsed}, ` +
      `preferredLines=[${preferredLines.join(",")}]`
    );

    // ========= AUDIT-DATEN für Transparenz im Frontend =========
    const reasonFor = (e: WikiEntry) => {
      if (manualPinned.some((m) => sameEntry(m, e))) return "📌 Manuell gepinnt";
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
        boostCategories: selectedCats,
        selectedCategories: selectedCats, // legacy alias
        used: usedEntries,
        skippedSample: skippedEntries,
      },
    };


    // Build patient context
    const patientInfo: string[] = [];
    if (alter) patientInfo.push(`Alter: ${alter} Jahre`);
    if (schwanger) patientInfo.push(`Schwangerschaft/Stillzeit: ${schwanger}`);
    if (medikamente) patientInfo.push(`Aktuelle Medikamente: ${medikamente}`);
    if (bisherigeMittel) patientInfo.push(`Bisherige Naturheilmittel: ${bisherigeMittel}`);
    if (budget) patientInfo.push(`Maximales Budget: ${budget} Euro`);
    if (laborErhoeht) patientInfo.push(`Erhöhte Laborwerte: ${laborErhoeht}`);
    if (laborErniedrigt) patientInfo.push(`Erniedrigte Laborwerte: ${laborErniedrigt}`);
    if (laborKomplett) patientInfo.push(`Komplettes klassisches Labor: ${laborKomplett}`);
    if (stuhlbefund) patientInfo.push(`Stuhlbefund/Mikrobiom: ${stuhlbefund}`);

    const systemPrompt = `Du bist ein erfahrener naturheilkundlicher Therapeut und Berater und arbeitest ALS FACHLICHE UNTERSTÜTZUNG für den Heilpraktiker Peter Rauch (Ing. Elektrotechnik + Heilpraktiker + Physiotherapeut + Hypnotherapeut, 20+ Jahre Erfahrung). Diese Empfehlung wird von IHM in der Praxis verwendet — der Patient ist BEREITS in seiner Behandlung.

🚫 ABSOLUT VERBOTENE FORMULIERUNGEN (kritisch!):
- "Bitte ärztlich abklären lassen" / "zwingend ärztliche Abklärung" / "Besuch beim Arzt erforderlich"
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

DEINE AUFGABE:
Analysiere die Belastungen/Symptome/Erkrankung des Patienten und erstelle eine individuelle Therapie-Empfehlung basierend NUR auf den Mitteln und Protokollen aus der Wissensdatenbank.

⭐ BEVORZUGTE MITTEL & PRODUKTLINIEN DES THERAPEUTEN (HÖCHSTE PRIORITÄT):
${preferredLines.length > 0
  ? `- Bevorzugte Produktlinien: ${preferredLines.join(", ")}.\n  → Bei vergleichbarer Wirkung MUSST du Mittel aus diesen Linien priorisieren (vor anderen Marken). Nenne die Linie explizit im Mittelnamen (z.B. "Biotik Balance (Vitaplace)").`
  : "- Keine Linien-Präferenz angegeben."}
${pinnedTitles.length > 0
  ? `- ZWINGEND in die Empfehlung aufzunehmende Mittel (vom Therapeuten gepinnt): ${pinnedTitles.join("; ")}.
  → Diese Mittel MÜSSEN in der Empfehlung erscheinen, mit korrekter Dosierung aus dem Wiki-Eintrag, plausibler Indikationsbegründung im Patientenkontext und Einordnung in die passende Mittel-Gruppe (Hausmittel, Probiotika, Vitamine etc.).
  → Falls ein gepinntes Mittel im aktuellen Patientenfall kontraindiziert wäre (Schwangerschaft, Wechselwirkung, Alter), nimm es trotzdem auf, kennzeichne es aber mit ⚠️ und begründe die Kontraindikation transparent.`
  : "- Keine spezifischen Mittel gepinnt."}


SICHERHEITSREGELN (ZWINGEND BEACHTEN):
1. **Alter**: ${alter ? `Patient ist ${alter} Jahre alt.` : "Alter unbekannt."}
   - Kinder unter 2: KEINE ätherischen Öle, KEIN Wermut, KEINE alkoholischen Tinkturen
   - Kinder unter 6: Sehr eingeschränktes Spektrum, nur milde Mittel, reduzierte Dosen
   - Kinder unter 12: Reduzierte Dosierungen (ca. 50% der Erwachsenendosis)
   - Kinder unter 16: Leicht reduzierte Dosen

2. **Schwangerschaft/Stillzeit**: ${schwanger || "Nicht angegeben"}
   - Falls schwanger/stillend: KEIN Wermut (Artemisia), KEINE Schwarzwalnuss, KEIN Beifuß, KEIN Rainfarn, generell KEINE antiparasitären Kuren, KEIN hochdosiertes Vitamin A
   - Nur absolut sichere Mittel empfehlen

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

INNERHALB JEDER GRUPPE: Gib jedes Mittel ZWINGEND in folgendem strukturierten Format aus, damit das Frontend es als Tabellenzeile darstellen kann. Trenne die Felder mit ` | ` (Pipe-Zeichen) und beginne JEDE Mittel-Zeile mit `- ` (Bindestrich + Leerzeichen):

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

    const userMessage = `Patientendaten:
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
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: safeSystem },
          { role: "user", content: safeUser },
        ],
        max_tokens: 16384,
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

    // Prepend audit info as the FIRST SSE-Frame so the client can show
    // exactly which wiki entries the AI saw. Then forward the AI stream.
    const auditLine = `data: ${JSON.stringify(auditPayload)}\n\n`;
    const encoder = new TextEncoder();
    const aiStream = response.body!;
    const wrapped = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(auditLine));
        const reader = aiStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
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
