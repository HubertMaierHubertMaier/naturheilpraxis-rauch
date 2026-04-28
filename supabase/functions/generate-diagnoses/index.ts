// Generates schulmedizinische ICD-10-orientierte Diagnose-Hypothesen aus Patienteneingaben.
// Nur für Admins (Heilpraktiker-interne Verwendung). KI: Lovable AI Gateway (Gemini Flash).

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-Check
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Nur für Administratoren" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      belastungen = "",
      symptome = "",
      erkrankung = "",
      laborErhoeht = "",
      laborErniedrigt = "",
      laborKomplett = "",
      stuhlbefund = "",
      medikamente = "",
      alter = "",
      schwanger = "",
    } = body;

    const inputBlock = [
      belastungen && `BELASTUNGEN/PATHOGENE:\n${belastungen}`,
      symptome && `SYMPTOME:\n${symptome}`,
      erkrankung && `BEKANNTE DIAGNOSE:\n${erkrankung}`,
      laborErhoeht && `LABOR ERHÖHT:\n${laborErhoeht}`,
      laborErniedrigt && `LABOR ERNIEDRIGT:\n${laborErniedrigt}`,
      laborKomplett && `LABOR GESAMT:\n${laborKomplett}`,
      stuhlbefund && `STUHLBEFUND:\n${stuhlbefund}`,
      medikamente && `MEDIKAMENTE:\n${medikamente}`,
      alter && `ALTER: ${alter}`,
      schwanger && schwanger !== "nein" && `STATUS: ${schwanger}`,
    ].filter(Boolean).join("\n\n");

    if (!inputBlock.trim()) {
      return new Response(JSON.stringify({ diagnosen: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Du bist medizinischer Assistent für einen Heilpraktiker (Peter Rauch).
Erstelle aus den Patienteneingaben eine Liste **schulmedizinischer Verdachtsdiagnosen** (ICD-10-orientiert) – als Arbeitshypothesen für die interne Praxisakte.

REGELN:
- 3-8 plausibelste Diagnosen, sortiert nach Wahrscheinlichkeit
- Format: ICD-10-Code (wenn klar zuordenbar) + deutsche Bezeichnung + 1 Satz Begründung
- Keine Therapieempfehlung, nur Diagnose-Hypothesen
- Differentialdiagnosen mit "DD:" markieren
- Bei unklarer Symptomatik ehrlich "Verdacht auf …" oder "Funktionelle Störung – DD …"
- Reine Beobachtungen (z.B. "Vitamin-D-Mangel") als E55.9 etc. korrekt codieren

Antworte STRIKT als JSON-Array, kein Markdown, kein Text drumherum:
[
  { "icd10": "K58.9", "diagnose": "Reizdarmsyndrom, nicht näher bezeichnet", "begruendung": "Chronische Verdauungsbeschwerden ohne organischen Befund." },
  { "icd10": "E55.9", "diagnose": "Vitamin-D-Mangel", "begruendung": "Laborwert 12 ng/ml deutlich unter Norm." }
]`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI Gateway nicht konfiguriert" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: inputBlock },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: `KI-Fehler: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? "[]";

    // Robust parsen – akzeptiert Array oder { diagnosen: [...] }
    let diagnosen: any[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) diagnosen = parsed;
      else if (Array.isArray(parsed.diagnosen)) diagnosen = parsed.diagnosen;
      else if (Array.isArray(parsed.diagnoses)) diagnosen = parsed.diagnoses;
      else {
        // Fallback: erste Array-Property finden
        for (const v of Object.values(parsed)) {
          if (Array.isArray(v)) { diagnosen = v; break; }
        }
      }
    } catch {
      // Fallback: Markdown-Block extrahieren
      const m = content.match(/\[[\s\S]*\]/);
      if (m) {
        try { diagnosen = JSON.parse(m[0]); } catch { diagnosen = []; }
      }
    }

    return new Response(JSON.stringify({ diagnosen }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Interner Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
