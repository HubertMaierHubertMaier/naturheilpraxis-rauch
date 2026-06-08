// Generates schulmedizinische ICD-10-orientierte Diagnose-Hypothesen aus Patienteneingaben.
// Nur für Admins (Heilpraktiker-interne Verwendung). KI: Lovable AI Gateway (Gemini Flash).

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

type DiagnosisRequestBody = Partial<Record<
  | "belastungen"
  | "symptome"
  | "erkrankung"
  | "laborErhoeht"
  | "laborErniedrigt"
  | "laborKomplett"
  | "stuhlbefund"
  | "medikamente"
  | "alter"
  | "schwanger",
  string
>>;

type DiagnosisCandidate = Record<string, unknown>;

type AiMessageResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDiagnosisCandidateArray(value: unknown): value is DiagnosisCandidate[] {
  return Array.isArray(value) && value.every(isRecord);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    const rateLimitKey = `generate-diagnoses:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[generate-diagnoses] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as DiagnosisRequestBody;
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
      await aiResp.body?.cancel();
      return new Response(JSON.stringify({ error: "KI-Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = (await aiResp.json()) as AiMessageResponse;
    const content: string = aiJson.choices?.[0]?.message?.content ?? "[]";

    // Robust parsen – akzeptiert Array oder { diagnosen: [...] }
    let diagnosen: DiagnosisCandidate[] = [];
    try {
      const parsed: unknown = JSON.parse(content);
      if (isDiagnosisCandidateArray(parsed)) diagnosen = parsed;
      else if (isRecord(parsed) && isDiagnosisCandidateArray(parsed.diagnosen)) diagnosen = parsed.diagnosen;
      else if (isRecord(parsed) && isDiagnosisCandidateArray(parsed.diagnoses)) diagnosen = parsed.diagnoses;
      else if (isRecord(parsed)) {
        // Fallback: erste Array-Property finden
        for (const v of Object.values(parsed)) {
          if (isDiagnosisCandidateArray(v)) { diagnosen = v; break; }
        }
      }
    } catch {
      // Fallback: Markdown-Block extrahieren
      const m = content.match(/\[[\s\S]*\]/);
      if (m) {
        try {
          const parsedFallback: unknown = JSON.parse(m[0]);
          diagnosen = isDiagnosisCandidateArray(parsedFallback) ? parsedFallback : [];
        } catch {
          diagnosen = [];
        }
      }
    }

    return new Response(JSON.stringify({ diagnosen }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Interner Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
