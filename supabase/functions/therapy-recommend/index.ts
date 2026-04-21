import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-Memory-Cache für den Wiki-Kontext (überlebt warm starts der Edge Function).
// Invalidierung automatisch, sobald sich Anzahl oder max(updated_at) ändert.
interface WikiCache {
  signature: string;   // count + max(updated_at)
  context: string;     // fertig formatierter Kontext-String
  entryCount: number;
  builtAt: number;     // ms epoch
}
let WIKI_CACHE: WikiCache | null = null;
const WIKI_CACHE_TTL_MS = 10 * 60 * 1000; // Hard-TTL 10 min als Sicherheitsnetz

const MAX_ENTRY_CHARS = 6000;
const MAX_TOTAL_CHARS = 400_000; // ~100k tokens – sicher für gemini-2.5-pro (1M ctx)
const CACHE_VERSION = "v3";

async function getWikiContext(client: any): Promise<{ context: string; entryCount: number; cacheHit: boolean }> {
  // 1) Signatur ermitteln (leichtgewichtig: nur updated_at holen)
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
  if (
    WIKI_CACHE &&
    WIKI_CACHE.signature === signature &&
    now - WIKI_CACHE.builtAt < WIKI_CACHE_TTL_MS
  ) {
    console.log(`Wiki cache HIT (signature=${signature}, age=${Math.round((now - WIKI_CACHE.builtAt) / 1000)}s)`);
    return { context: WIKI_CACHE.context, entryCount: WIKI_CACHE.entryCount, cacheHit: true };
  }

  console.log(`Wiki cache MISS (new signature=${signature})`);

  // 2) Vollständig neu laden und Kontext bauen
  const { data: wikiEntries, error: wikiError } = await client
    .from("admin_knowledge_base")
    .select("title, category, tags, content")
    .order("updated_at", { ascending: false });

  if (wikiError) throw new Error("Wiki-Daten konnten nicht geladen werden: " + wikiError.message);

  let context = (wikiEntries || [])
    .map((e: any) => {
      const content = (e.content || "").slice(0, MAX_ENTRY_CHARS);
      return `### ${e.title} [${e.category}] Tags: ${(e.tags || []).join(", ")}\n${content}`;
    })
    .join("\n\n---\n\n");

  if (context.length > MAX_TOTAL_CHARS) {
    context = context.slice(0, MAX_TOTAL_CHARS) + "\n\n[... Wissensdatenbank gekürzt ...]";
  }
  if (!context.trim()) context = "(Wissensdatenbank ist leer)";

  WIKI_CACHE = {
    signature,
    context,
    entryCount: wikiEntries?.length || 0,
    builtAt: now,
  };

  return { context, entryCount: WIKI_CACHE.entryCount, cacheHit: false };
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
    const { belastungen, symptome, erkrankung, alter, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt } = await req.json();

    if (!belastungen && !symptome && !erkrankung) {
      throw new Error("Bitte geben Sie mindestens Belastungen, Symptome oder eine Erkrankung an.");
    }

    // Fetch wiki context (cached)
    const { context: wikiContext, entryCount, cacheHit } = await getWikiContext(userClient);
    console.log(`Wiki entries: ${entryCount}, context size: ${wikiContext.length} chars, cacheHit=${cacheHit}`);

    // Build patient context
    const patientInfo: string[] = [];
    if (alter) patientInfo.push(`Alter: ${alter} Jahre`);
    if (schwanger) patientInfo.push(`Schwangerschaft/Stillzeit: ${schwanger}`);
    if (medikamente) patientInfo.push(`Aktuelle Medikamente: ${medikamente}`);
    if (bisherigeMittel) patientInfo.push(`Bisherige Naturheilmittel: ${bisherigeMittel}`);
    if (budget) patientInfo.push(`Maximales Budget: ${budget} Euro`);
    if (laborErhoeht) patientInfo.push(`Erhöhte Laborwerte: ${laborErhoeht}`);
    if (laborErniedrigt) patientInfo.push(`Erniedrigte Laborwerte: ${laborErniedrigt}`);

    const systemPrompt = `Du bist ein erfahrener naturheilkundlicher Therapeut und Berater. Du hast Zugriff auf die folgende Wissensdatenbank mit Naturheilmitteln, Pathogenen und Therapieprotokollen.

WISSENSDATENBANK:
${wikiContext}

DEINE AUFGABE:
Analysiere die Belastungen/Symptome/Erkrankung des Patienten und erstelle eine individuelle Therapie-Empfehlung basierend NUR auf den Mitteln und Protokollen aus der Wissensdatenbank.

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
   - Falls Laborwerte angegeben: Beziehe diese in die Therapieempfehlung mit ein. Erkläre, welche Werte auffällig sind und welche Naturheilmittel oder Ernährungsmaßnahmen diese verbessern können.

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
Budget: ${budget ? budget + " Euro" : "Nicht angegeben"}

Bitte erstelle eine individuelle Therapie-Empfehlung basierend auf der Wissensdatenbank. ${bisherigeMittel ? "Bewerte zusätzlich die bisherigen Mittel und Dosierungen kritisch." : ""} Priorisiere günstige Hausmittel und Gewürze (Knoblauch, Kurkuma, Oregano etc.) vor teuren Spezialpräparaten.`;

    console.log(`System prompt: ${systemPrompt.length} chars, User: ${userMessage.length} chars`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
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
