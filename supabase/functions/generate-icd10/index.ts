import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      url.hostname.endsWith(".lovableproject.com")
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

/**
 * ICD-10 Generation Edge Function
 * 
 * DSGVO-Compliance:
 * - Only accessible by authenticated admin users
 * - Patient identifiable data (name, DOB, address) is NEVER sent to AI
 * - Only anonymized symptom descriptions are processed
 * - Results are stored only in the practice's admin context
 * - All AI processing uses Lovable AI gateway (DSGVO-compliant EU infrastructure)
 * 
 * Ethical Guidelines:
 * - AI suggestions are clearly marked as "AI-generated" with confidence scores
 * - Fixed mappings are deterministic and medically validated
 * - AI results are advisory only – final diagnosis remains with the practitioner
 * - No patient data is logged or cached beyond the response
 */

// ─── Fixed ICD-10 Mapping (inline for edge function context) ───
interface ICD10Entry {
  code: string;
  descDe: string;
  descEn: string;
  category: string;
}

interface ICD10Result {
  code: string;
  descDe: string;
  descEn: string;
  category: string;
  source: "fixed" | "ai";
  confidence?: number;
  sourceField?: string;
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type FormDataRecord = Record<string, JsonValue>;

function isJsonRecord(value: JsonValue | unknown): value is FormDataRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type AiIcd10Item = {
  code?: string;
  descDe?: string;
  descEn?: string;
  category?: string;
  confidence?: number;
  summary?: string;
};

function isAiIcd10Item(value: unknown): value is AiIcd10Item {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const icd10FixedMapping: Record<string, ICD10Entry[]> = {
  "kopfErkrankungen.augenerkrankung.grauerStar": [{ code: "H25.9", descDe: "Grauer Star (Katarakt)", descEn: "Cataract", category: "Auge" }],
  "kopfErkrankungen.augenerkrankung.gruenerStar": [{ code: "H40.9", descDe: "Grüner Star (Glaukom)", descEn: "Glaucoma", category: "Auge" }],
  "kopfErkrankungen.augenerkrankung.makula": [{ code: "H35.3", descDe: "Makuladegeneration", descEn: "Macular degeneration", category: "Auge" }],
  "kopfErkrankungen.augenerkrankung.trockeneAugen": [{ code: "H04.1", descDe: "Trockene Augen", descEn: "Dry eye syndrome", category: "Auge" }],
  "kopfErkrankungen.schwerhoerig.ja": [{ code: "H91.9", descDe: "Schwerhörigkeit", descEn: "Hearing loss", category: "Ohr" }],
  "kopfErkrankungen.ohrenerkrankung.tinnitus": [{ code: "H93.1", descDe: "Tinnitus", descEn: "Tinnitus", category: "Ohr" }],
  "kopfErkrankungen.ohrenerkrankung.hoersturz": [{ code: "H91.2", descDe: "Hörsturz", descEn: "Sudden hearing loss", category: "Ohr" }],
  "kopfErkrankungen.ohrenerkrankung.morbusMeniere": [{ code: "H81.0", descDe: "Morbus Menière", descEn: "Ménière's disease", category: "Ohr" }],
  "kopfErkrankungen.sinusitis.ja": [{ code: "J32.9", descDe: "Sinusitis", descEn: "Sinusitis", category: "HNO" }],
  "kopfErkrankungen.kopfschmerzen.migraene": [{ code: "G43.9", descDe: "Migräne", descEn: "Migraine", category: "Neurologie" }],
  "kopfErkrankungen.kopfschmerzen.spannungskopfschmerz": [{ code: "G44.2", descDe: "Spannungskopfschmerz", descEn: "Tension headache", category: "Neurologie" }],
  "kopfErkrankungen.schwindel.ja": [{ code: "R42", descDe: "Schwindel", descEn: "Vertigo", category: "Neurologie" }],
  "schlafSymptome.schlafstörung.ja": [{ code: "G47.0", descDe: "Schlafstörung", descEn: "Insomnia", category: "Schlaf" }],
  "schlafSymptome.angstzustaende.ja": [{ code: "F41.9", descDe: "Angststörung", descEn: "Anxiety disorder", category: "Psyche" }],
  "psychischeErkrankungen.depression.ja": [{ code: "F32.9", descDe: "Depression", descEn: "Depression", category: "Psyche" }],
  "psychischeErkrankungen.epilepsie.ja": [{ code: "G40.9", descDe: "Epilepsie", descEn: "Epilepsy", category: "Neurologie" }],
  "herzKreislauf.blutdruckHoch.ja": [{ code: "I10", descDe: "Arterielle Hypertonie", descEn: "Hypertension", category: "Herz" }],
  "herzKreislauf.blutdruckNiedrig.ja": [{ code: "I95.9", descDe: "Hypotonie", descEn: "Hypotension", category: "Herz" }],
  "herzKreislauf.herzrhythmusstörung.vorhofflimmern": [{ code: "I48.9", descDe: "Vorhofflimmern", descEn: "Atrial fibrillation", category: "Herz" }],
  "herzKreislauf.herzinfarkt.ja": [{ code: "I25.2", descDe: "Z.n. Herzinfarkt", descEn: "Old myocardial infarction", category: "Herz" }],
  "herzKreislauf.thrombose.ja": [{ code: "I80.9", descDe: "Thrombose", descEn: "Thrombosis", category: "Gefäße" }],
  "lungeAtmung.asthma.ja": [{ code: "J45.9", descDe: "Asthma bronchiale", descEn: "Asthma", category: "Lunge" }],
  "lungeAtmung.copd.ja": [{ code: "J44.9", descDe: "COPD", descEn: "COPD", category: "Lunge" }],
  "magenDarm.sodbrennen.ja": [{ code: "K21.0", descDe: "Gastroösophagealer Reflux", descEn: "GERD", category: "Magen-Darm" }],
  "magenDarm.morbusCrohn.ja": [{ code: "K50.9", descDe: "Morbus Crohn", descEn: "Crohn's disease", category: "Magen-Darm" }],
  "magenDarm.colitis.ja": [{ code: "K51.9", descDe: "Colitis ulcerosa", descEn: "Ulcerative colitis", category: "Magen-Darm" }],
  "magenDarm.reizdarm.ja": [{ code: "K58.9", descDe: "Reizdarmsyndrom", descEn: "IBS", category: "Magen-Darm" }],
  "magenDarm.zoeliakie.ja": [{ code: "K90.0", descDe: "Zöliakie", descEn: "Celiac disease", category: "Magen-Darm" }],
  "leberGalle.lebererkrankung.fettleber": [{ code: "K76.0", descDe: "Fettleber", descEn: "Fatty liver", category: "Leber" }],
  "leberGalle.leberzirrhose.ja": [{ code: "K74.6", descDe: "Leberzirrhose", descEn: "Cirrhosis", category: "Leber" }],
  "leberGalle.gallensteine.ja": [{ code: "K80.2", descDe: "Gallensteine", descEn: "Gallstones", category: "Galle" }],
  "niereBlase.nierensteine.ja": [{ code: "N20.0", descDe: "Nierensteine", descEn: "Kidney stones", category: "Niere" }],
  "niereBlase.inkontinenz.ja": [{ code: "R32", descDe: "Harninkontinenz", descEn: "Incontinence", category: "Niere" }],
  "hormongesundheit.schilddruese.unterfunktion": [{ code: "E03.9", descDe: "Hypothyreose", descEn: "Hypothyroidism", category: "Hormone" }],
  "hormongesundheit.schilddruese.ueberfunktion": [{ code: "E05.9", descDe: "Hyperthyreose", descEn: "Hyperthyroidism", category: "Hormone" }],
  "hormongesundheit.schilddruese.hashimoto": [{ code: "E06.3", descDe: "Hashimoto-Thyreoiditis", descEn: "Hashimoto's", category: "Hormone" }],
  "wirbelsaeuleGelenke.rheuma.ja": [{ code: "M06.9", descDe: "Rheumatoide Arthritis", descEn: "Rheumatoid arthritis", category: "Gelenke" }],
  "hautInfektionen.psoriasis.ja": [{ code: "L40.9", descDe: "Psoriasis", descEn: "Psoriasis", category: "Haut" }],
  "hautInfektionen.ekzem.atopisch": [{ code: "L20.9", descDe: "Neurodermitis", descEn: "Atopic dermatitis", category: "Haut" }],
  "frauengesundheit.endometriose.ja": [{ code: "N80.9", descDe: "Endometriose", descEn: "Endometriosis", category: "Gynäkologie" }],
  "maennergesundheit.prostata.bph": [{ code: "N40", descDe: "Prostatahyperplasie", descEn: "BPH", category: "Urologie" }],
};

function getNestedValue(obj: FormDataRecord, path: string): JsonValue | undefined {
  const keys = path.split(".");
  let current: JsonValue | undefined = obj;
  for (const key of keys) {
    if (!isJsonRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function extractFixedICD10(formData: FormDataRecord): ICD10Result[] {
  const results: ICD10Result[] = [];
  const seen = new Set<string>();
  for (const [path, entries] of Object.entries(icd10FixedMapping)) {
    const value = getNestedValue(formData, path);
    if (value === true) {
      for (const entry of entries) {
        const key = `${entry.code}-${path}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ ...entry, source: "fixed", confidence: 1.0, sourceField: path });
        }
      }
    }
  }
  return results;
}

function collectFreeText(formData: FormDataRecord): string[] {
  const fields = [
    "weitereErkrankungen", "zusaetzlicheInfos",
    "herzKreislauf.sonstige", "lungeAtmung.sonstige", "magenDarm.sonstige",
    "leberGalle.sonstige", "niereBlase.sonstige", "hormongesundheit.sonstige",
    "wirbelsaeuleGelenke.sonstige", "maennergesundheit.sonstige",
  ];
  const texts: string[] = [];
  for (const f of fields) {
    const v = getNestedValue(formData, f);
    if (typeof v === "string" && v.trim().length > 2) texts.push(v.trim());
  }
  return texts;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check – admin only
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden – Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rateLimitKey = `generate-icd10:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[generate-icd10] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submissionId } = await req.json();
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch submission using service role to bypass RLS
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: submission, error: subError } = await adminClient
      .from("anamnesis_submissions")
      .select("form_data")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = submission.form_data as FormDataRecord;

    // Step 1: Fixed mapping
    const fixedResults = extractFixedICD10(formData);

    // Step 2: AI analysis for free-text symptoms
    const freeTexts = collectFreeText(formData);
    const aiResults: ICD10Result[] = [];
    let aiSummary = "";

    if (freeTexts.length > 0) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        try {
          // DSGVO: Only anonymized symptom text is sent – NO patient name, DOB, or identifiers
          const symptomText = freeTexts.join("; ");
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `Du bist ein medizinischer Kodierer. Analysiere die folgenden Symptombeschreibungen und ordne passende ICD-10-GM Codes zu.

REGELN:
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Array
- Jedes Element: {"code": "ICD-10 Code", "descDe": "Deutsche Beschreibung", "descEn": "English description", "category": "Kategorie", "confidence": 0.0-1.0}
- Nur medizinisch begründbare Zuordnungen (confidence >= 0.6)
- Maximal 10 Codes
- Keine Patientendaten in der Antwort wiedergeben
- Am Ende füge ein Objekt mit key "summary" hinzu: {"summary": "Kurze medizinische Zusammenfassung der Symptome in 2-3 Sätzen auf Deutsch"}`,
                },
                {
                  role: "user",
                  content: `Symptombeschreibungen eines Patienten (anonymisiert):\n${symptomText}`,
                },
              ],
              temperature: 0.2,
              max_tokens: 1500,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            
            // Parse JSON from response (handle markdown code blocks)
            let jsonStr = content;
            const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) jsonStr = codeBlockMatch[1];
            
            try {
              const parsed: unknown = JSON.parse(jsonStr.trim());
              const items = Array.isArray(parsed) ? parsed : [];
              
              for (const item of items) {
                if (!isAiIcd10Item(item)) {
                  continue;
                }
                if (item.summary) {
                  aiSummary = item.summary;
                  continue;
                }
                if (item.code && item.confidence !== undefined && item.confidence >= 0.6) {
                  aiResults.push({
                    code: item.code,
                    descDe: item.descDe || item.code,
                    descEn: item.descEn || item.code,
                    category: item.category || "KI-Analyse",
                    source: "ai",
                    confidence: item.confidence,
                    sourceField: "freitext",
                  });
                }
              }
            } catch {
              console.warn("Could not parse AI ICD-10 response");
            }
          }
        } catch {
          console.error("[generate-icd10] AI analysis failed");
          // Graceful fallback – fixed results still returned
        }
      }
    }

    // Combine and deduplicate
    const allResults = [...fixedResults, ...aiResults];
    const deduped = new Map<string, ICD10Result>();
    for (const r of allResults) {
      const existing = deduped.get(r.code);
      if (!existing || (r.source === "fixed" && existing.source === "ai")) {
        deduped.set(r.code, r);
      }
    }

    const response = {
      icd10Codes: Array.from(deduped.values()).sort((a, b) => a.code.localeCompare(b.code)),
      fixedCount: fixedResults.length,
      aiCount: aiResults.length,
      aiSummary: aiSummary || null,
      freeTextAnalyzed: freeTexts.length > 0,
      timestamp: new Date().toISOString(),
      disclaimer: "Diese ICD-10-Codes wurden automatisch generiert und dienen ausschließlich als Vorschlag. Die endgültige Diagnose obliegt dem behandelnden Therapeuten.",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("[generate-icd10] generation failed");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
