// Extrahiert Laborwerte aus einem Foto/Scan eines klassischen Laborbefunds.
// Nutzt Lovable AI Gateway (Gemini Vision). Nur für Admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
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

    const { images, mode } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Bilder übergeben" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "AI Gateway nicht konfiguriert" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isDoctor = mode === "doctor";

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
- Antworte NUR mit dem extrahierten Text, kein Vorwort, kein Kommentar.`;

    const doctorPrompt = `Du extrahierst aus Fotos/Scans eines ärztlichen Berichts (Arztbrief, Entlassbrief, Facharzt-Befund, Bildgebungsbefund, OP-Bericht, Histologie) ALLE relevanten medizinischen Informationen wortgetreu.

Struktur (Markdown, ## Überschriften):
## BERICHT VOM
Datum, Klinik/Praxis, Facharzt-Disziplin (falls erkennbar)
## DIAGNOSEN
Alle Diagnosen mit ICD-10 (sofern angegeben)
## ANAMNESE / VORGESCHICHTE
Relevante Vorerkrankungen, OPs, Familienanamnese
## BEFUND
Klinischer Befund, Bildgebung, Labor (knapp), Histologie
## BEURTEILUNG
Zusammenfassung des Arztes
## THERAPIE / EMPFEHLUNG
Medikation (mit Dosis), Verlaufskontrollen, weitere Maßnahmen

Regeln:
- Nichts erfinden, nichts interpretieren. Was unleserlich ist: "(unleserlich)" notieren.
- Mehrere Seiten in der Reihenfolge zusammenführen.
- Persönliche Daten (Name, Geburtsdatum, Adresse) NICHT übernehmen – nur "(Patientendaten anonymisiert)".
- Antworte NUR mit dem extrahierten Text, kein Vorwort, kein Kommentar.`;

    const systemPrompt = isDoctor ? doctorPrompt : labPrompt;

    const userText = isDoctor
      ? "Extrahiere bitte den vollständigen Inhalt dieses ärztlichen Berichts:"
      : "Extrahiere bitte alle Laborwerte aus diesem/diesen Befund(en):";

    const content: any[] = [{ type: "text", text: userText }];
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
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: `KI-Fehler: ${errText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiResp.json();
    const text: string = aiJson.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Interner Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
