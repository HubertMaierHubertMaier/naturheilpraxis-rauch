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
function selectRelevantEntries(entries: WikiEntry[], queryText: string, maxChars: number): WikiEntry[] {
  const tokens = tokenizeQuery(queryText);
  if (tokens.length === 0) {
    // Fallback: einfach so viele wie passen
    return entries;
  }

  const scored = entries.map((e) => {
    const haystack = (
      e.title + " " + e.category + " " + (e.tags || []).join(" ") + " " + (e.content || "")
    ).toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      // Title/Tags zählen mehr
      if ((e.title || "").toLowerCase().includes(tok)) score += 10;
      if ((e.tags || []).some((t) => t.toLowerCase().includes(tok))) score += 5;
      // Content-Treffer
      const matches = haystack.split(tok).length - 1;
      score += Math.min(matches, 8);
    }
    return { entry: e, score };
  });

  // Nach Score sortieren (höchster zuerst), Score 0 ans Ende
  scored.sort((a, b) => b.score - a.score);

  // Solange aufnehmen, bis maxChars erreicht – Einträge mit Score > 0 priorisieren
  const selected: WikiEntry[] = [];
  let totalChars = 0;
  for (const s of scored) {
    const entryLen = Math.min((s.entry.content || "").length, MAX_ENTRY_CHARS) + 200;
    if (totalChars + entryLen > maxChars) continue;
    selected.push(s.entry);
    totalChars += entryLen;
  }

  console.log(
    `Wiki filter: ${selected.length}/${entries.length} entries selected (` +
    `query tokens=${tokens.length}, top scores=${scored.slice(0, 3).map((s) => s.score).join(",")})`
  );
  return selected;
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
    const { belastungen, symptome, erkrankung, alter, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, categories, bevorzugteLinie, pinnedMittel } = await req.json();

    if (!belastungen && !symptome && !erkrankung) {
      throw new Error("Bitte geben Sie mindestens Belastungen, Symptome oder eine Erkrankung an.");
    }

    // Fetch wiki entries (cached) and select only the relevant ones for this query
    const { entries: allEntries, cacheHit } = await loadWikiEntries(userClient);

    // Optional: Filter nach gewählten Hauptordnern (Top-Level-Kategorien).
    const selectedCats: string[] = Array.isArray(categories)
      ? categories.filter((c: unknown) => typeof c === "string" && c.trim().length > 0)
      : [];
    const filteredByCategory = selectedCats.length === 0
      ? allEntries
      : allEntries.filter((e) =>
          selectedCats.some((c) => e.category === c || e.category.startsWith(c + " >"))
        );
    console.log(
      `Category filter: ${selectedCats.length === 0 ? "ALL" : selectedCats.join(", ")} → ` +
      `${filteredByCategory.length}/${allEntries.length} entries`
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

    // Force-include all pinned wiki entries (never drop them)
    const pinnedEntries = pinnedTitles.length > 0
      ? allEntries.filter((e) => pinnedTitles.some((t) => e.title.toLowerCase() === t.toLowerCase()))
      : [];
    const pinnedReserveChars = pinnedEntries.reduce(
      (sum, e) => sum + Math.min((e.content || "").length, MAX_ENTRY_CHARS) + 200,
      0
    );

    // Score the rest, but exclude already-pinned entries
    const restPool = filteredByCategory.filter(
      (e) => !pinnedEntries.some((p) => p.title === e.title && p.category === e.category)
    );
    const remainingBudget = Math.max(2000, MAX_TOTAL_CHARS - pinnedReserveChars);
    const restRelevant = selectRelevantEntries(restPool, queryText, remainingBudget);

    const relevantEntries = [...pinnedEntries, ...restRelevant];
    const wikiContext = buildContext(relevantEntries);
    console.log(
      `Wiki: ${allEntries.length} total → ${filteredByCategory.length} after category → ` +
      `${pinnedEntries.length} pinned + ${restRelevant.length} relevant, ` +
      `context=${wikiContext.length} chars, cacheHit=${cacheHit}, ` +
      `preferredLines=[${preferredLines.join(",")}]`
    );

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

    const systemPrompt = `Du bist ein erfahrener naturheilkundlicher Therapeut und Berater. Du hast Zugriff auf die folgende Wissensdatenbank mit Naturheilmitteln, Pathogenen und Therapieprotokollen.

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
(Symbioflor, Mutaflor, Lactobacillus-Stämme, RMS-Biofrid, EM-Ferment, Flohsamen, Inulin)

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
- Gewürze und Hausmittel IMMER mit aufnehmen wenn sie therapeutisch relevant sind – sie sind günstig und leicht verfügbar.
- Bei JEDEM Mittel erklären WARUM es empfohlen wird und WOGEGEN es wirkt.`;

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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: safeSystem },
          { role: "user", content: safeUser },
        ],
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

    return new Response(response.body, {
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
