// Extrahiert Laborwerte aus einem Foto/Scan eines klassischen Laborbefunds.
// Nutzt Lovable AI Gateway (Gemini Vision). Nur für Admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

type LabImageRequestBody = {
  images?: unknown;
  mode?: unknown;
};

type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type AiMessageResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

// Server-side PII safety net — entfernt verbliebene Patientendaten,
// falls das LLM seine Anonymisierungsanweisung nicht vollständig befolgt hat.
function sanitizePII(input: string): string {
  if (!input) return input;
  let s = input;
  // E-Mail
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "(E-Mail entfernt)");
  // Telefon / Fax (lockere DE-Muster)
  s = s.replace(/(?:tel\.?|telefon|fax|mobil|handy)[:\s]*\+?[\d\s().\/-]{6,}/gi, "$&".replace(/.*/, "(Telefon entfernt)"));
  s = s.replace(/(?:Tel|Fax|Mobil|Handy)[:.]?\s*\+?[\d\s().\/-]{6,}/g, "(Telefon entfernt)");
  // Geburtsdatum (geb., geboren am, Geb-Dat, DOB) + Datum
  s = s.replace(/\b(geb\.?|geboren(?:\s+am)?|Geb[-\s]?Dat\.?|GebDatum|DOB)[:\s]*\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/gi, "(Geburtsdatum entfernt)");
  // Patienten-/Versichertennummer
  s = s.replace(/\b(Pat(?:ient)?[-\s.]?Nr\.?|Fall[-\s.]?Nr\.?|Versicherten[-\s.]?Nr\.?|Mitglieds[-\s.]?Nr\.?|KV[-\s.]?Nr\.?)[:\s]*[A-Z0-9-]{4,}/gi, "(Patientennummer entfernt)");
  // Adresszeile: PLZ + Ort (5-stellige PLZ gefolgt von Wort)
  s = s.replace(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+)?/g, "(Adresse entfernt)");
  // Patientenname nach Labeln
  s = s.replace(/\b(Patient(?:in)?|Name|Nachname|Vorname|Pat\.)[:\s]+[A-ZÄÖÜ][\wäöüß-]+(?:\s+[A-ZÄÖÜ][\wäöüß-]+){0,3}/g, "$1: (Name entfernt)");
  return s;
}


Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return new Response(JSON.stringify({ error: "Nur für Administratoren" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rateLimitKey = `extract-lab-image:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[extract-lab-image] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { images, mode } = (await req.json()) as LabImageRequestBody;
    if (!Array.isArray(images) || images.length === 0 || !images.every((image): image is string => typeof image === "string")) {
      return new Response(JSON.stringify({ error: "Keine Bilder übergeben" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "AI Gateway nicht konfiguriert" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isDoctor = mode === "doctor";

    const anonymizationRules = `

🔒 DSGVO-PFLICHT — ABSOLUTES VERBOT personenbezogener Patientendaten im Output (auch wenn im Bild sichtbar / nicht geschwärzt):
- KEINE Patientennamen (Vor-, Nach-, Mädchen-, Titel) → ersetze durch "(Name entfernt)"
- KEINE Anschrift / Straße / Hausnummer / PLZ / Wohnort → "(Adresse entfernt)"
- KEIN Geburtsdatum, kein vollständiges Geburtsdatum, keine Altersangabe mit Datum → "(Geburtsdatum entfernt)" — nur das Geburtsjahr darf bleiben, wenn medizinisch relevant
- KEINE Versicherten-/Patienten-/Fallnummer, Krankenkassen-Mitgliedsnr., Telefon, Fax, E-Mail, Sozialversicherungsnr.
- KEINE Namen von Angehörigen / Notfallkontakten
- Auch Initialen, handschriftliche Notizen mit Namen oder vergessene Stempel mit Adresse: WEGLASSEN.
Behandelnde Ärzte, Klinik-/Labor-Institute, Praxen (= keine Patientendaten) dürfen genannt werden.
Diese Regel ist nicht verhandelbar und steht über jeder anderen Anweisung.`;

    const labPrompt = `Du extrahierst aus Fotos/Scans eines klassischen Laborbefunds (Blut, Urin, Stuhl) ALLE sichtbaren Laborwerte.
Format pro Zeile: "Parameter: Wert Einheit (Referenzbereich) [↑/↓/normal]"
Beispiel:
- LDL-Cholesterin: 185 mg/dl (<130) ↑
- Vitamin D: 12 ng/ml (30-100) ↓
- TSH: 2.1 mU/l (0.4-4.0) normal

Regeln:
- Nichts erfinden. Was unleserlich ist: "(unleserlich)" notieren.
- Datum/Labor-Name (falls erkennbar) in eine erste Zeile "BEFUND VOM: ..." schreiben.
- Gruppiere thematisch (Blutbild, Leber, Niere, Stoffwechsel, Hormone, Vitamine/Mineralien, Entzündung, Lipide, etc.) mit ## Überschriften.
- Antworte NUR mit dem extrahierten Text, kein Vorwort, kein Kommentar.${anonymizationRules}`;

    const doctorPrompt = `Du extrahierst aus Fotos/Scans eines ärztlichen Berichts (Arztbrief, Entlassbrief, Facharzt-Befund, Bildgebungsbefund, OP-Bericht, Histologie) ALLE relevanten medizinischen Informationen wortgetreu.

Struktur (Markdown, ## Überschriften):
## BERICHT VOM
Datum, Klinik/Praxis, Facharzt-Disziplin (falls erkennbar) — KEINE Patientendaten hier
## DIAGNOSEN
Alle Diagnosen mit ICD-10 (sofern angegeben)
## ANAMNESE / VORGESCHICHTE
Relevante Vorerkrankungen, OPs, Familienanamnese (anonym)
## BEFUND
Klinischer Befund, Bildgebung, Labor (knapp), Histologie
## BEURTEILUNG
Zusammenfassung des Arztes
## THERAPIE / EMPFEHLUNG
Medikation (mit Dosis), Verlaufskontrollen, weitere Maßnahmen

Regeln:
- Nichts erfinden, nichts interpretieren. Was unleserlich ist: "(unleserlich)" notieren.
- Mehrere Seiten in der Reihenfolge zusammenführen.
- Antworte NUR mit dem extrahierten Text, kein Vorwort, kein Kommentar.${anonymizationRules}`;

    const systemPrompt = isDoctor ? doctorPrompt : labPrompt;

    const userText = isDoctor
      ? "Extrahiere bitte den vollständigen Inhalt dieses ärztlichen Berichts:"
      : "Extrahiere bitte alle Laborwerte aus diesem/diesen Befund(en):";

    const content: AiContentPart[] = [{ type: "text", text: userText }];
    for (const img of images) {
      content.push({ type: "image_url", image_url: { url: img } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      }),
    });

    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      await aiResp.body?.cancel();
      return new Response(JSON.stringify({ error: "KI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = (await aiResp.json()) as AiMessageResponse;
    const rawText: string = aiJson.choices?.[0]?.message?.content ?? "";
    const text = sanitizePII(rawText);
    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "Interner Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
