import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp.ts";

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

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type JsonRecord = Record<string, unknown>;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

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

type Icd10Code = {
  code: string;
  descDe: string;
  category: string;
  source: string;
};

type AiIcd10Code = Icd10Code & {
  confidence: number;
};

type AiIcd10Item = {
  code?: unknown;
  descDe?: unknown;
  category?: unknown;
  confidence?: unknown;
};

type ResendSubmissionBody = {
  submissionId?: unknown;
};

type AnamnesisSubmission = {
  form_data: JsonRecord | null;
  submitted_at: string;
  user_id: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getStringField(record: JsonRecord, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function getOptionalFormRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function isAiIcd10Item(value: unknown): value is AiIcd10Item {
  return isRecord(value);
}

// ─── ICD-10 Fixed Mapping (subset for inline use) ───
const icd10FixedMapping: Record<string, { code: string; descDe: string; category: string }[]> = {
  "kopfErkrankungen.augenerkrankung.grauerStar": [{ code: "H25.9", descDe: "Grauer Star (Katarakt)", category: "Auge" }],
  "kopfErkrankungen.augenerkrankung.gruenerStar": [{ code: "H40.9", descDe: "Grüner Star (Glaukom)", category: "Auge" }],
  "kopfErkrankungen.augenerkrankung.makula": [{ code: "H35.3", descDe: "Makuladegeneration", category: "Auge" }],
  "kopfErkrankungen.schwerhoerig.ja": [{ code: "H91.9", descDe: "Schwerhörigkeit", category: "Ohr" }],
  "kopfErkrankungen.ohrenerkrankung.tinnitus": [{ code: "H93.1", descDe: "Tinnitus", category: "Ohr" }],
  "kopfErkrankungen.ohrenerkrankung.hoersturz": [{ code: "H91.2", descDe: "Hörsturz", category: "Ohr" }],
  "kopfErkrankungen.sinusitis.ja": [{ code: "J32.9", descDe: "Sinusitis", category: "HNO" }],
  "kopfErkrankungen.kopfschmerzen.migraene": [{ code: "G43.9", descDe: "Migräne", category: "Neurologie" }],
  "kopfErkrankungen.kopfschmerzen.spannungskopfschmerz": [{ code: "G44.2", descDe: "Spannungskopfschmerz", category: "Neurologie" }],
  "kopfErkrankungen.schwindel.ja": [{ code: "R42", descDe: "Schwindel", category: "Neurologie" }],
  "schlafSymptome.schlafstörung.ja": [{ code: "G47.0", descDe: "Schlafstörung", category: "Schlaf" }],
  "schlafSymptome.angstzustaende.ja": [{ code: "F41.9", descDe: "Angststörung", category: "Psyche" }],
  "psychischeErkrankungen.depression.ja": [{ code: "F32.9", descDe: "Depression", category: "Psyche" }],
  "psychischeErkrankungen.epilepsie.ja": [{ code: "G40.9", descDe: "Epilepsie", category: "Neurologie" }],
  "herzKreislauf.blutdruckHoch.ja": [{ code: "I10", descDe: "Arterielle Hypertonie", category: "Herz" }],
  "herzKreislauf.blutdruckNiedrig.ja": [{ code: "I95.9", descDe: "Hypotonie", category: "Herz" }],
  "herzKreislauf.herzrhythmusstörung.vorhofflimmern": [{ code: "I48.9", descDe: "Vorhofflimmern", category: "Herz" }],
  "herzKreislauf.herzinfarkt.ja": [{ code: "I25.2", descDe: "Z.n. Herzinfarkt", category: "Herz" }],
  "herzKreislauf.thrombose.ja": [{ code: "I80.9", descDe: "Thrombose", category: "Gefäße" }],
  "lungeAtmung.asthma.ja": [{ code: "J45.9", descDe: "Asthma bronchiale", category: "Lunge" }],
  "lungeAtmung.copd.ja": [{ code: "J44.9", descDe: "COPD", category: "Lunge" }],
  "magenDarm.sodbrennen.ja": [{ code: "K21.0", descDe: "Gastroösophagealer Reflux", category: "Magen-Darm" }],
  "magenDarm.morbusCrohn.ja": [{ code: "K50.9", descDe: "Morbus Crohn", category: "Magen-Darm" }],
  "magenDarm.colitis.ja": [{ code: "K51.9", descDe: "Colitis ulcerosa", category: "Magen-Darm" }],
  "magenDarm.reizdarm.ja": [{ code: "K58.9", descDe: "Reizdarmsyndrom", category: "Magen-Darm" }],
  "magenDarm.zoeliakie.ja": [{ code: "K90.0", descDe: "Zöliakie", category: "Magen-Darm" }],
  "leberGalle.lebererkrankung.fettleber": [{ code: "K76.0", descDe: "Fettleber", category: "Leber" }],
  "leberGalle.leberzirrhose.ja": [{ code: "K74.6", descDe: "Leberzirrhose", category: "Leber" }],
  "leberGalle.gallensteine.ja": [{ code: "K80.2", descDe: "Gallensteine", category: "Galle" }],
  "niereBlase.nierensteine.ja": [{ code: "N20.0", descDe: "Nierensteine", category: "Niere" }],
  "niereBlase.inkontinenz.ja": [{ code: "R32", descDe: "Harninkontinenz", category: "Niere" }],
  "hormongesundheit.schilddruese.unterfunktion": [{ code: "E03.9", descDe: "Hypothyreose", category: "Hormone" }],
  "hormongesundheit.schilddruese.ueberfunktion": [{ code: "E05.9", descDe: "Hyperthyreose", category: "Hormone" }],
  "hormongesundheit.schilddruese.hashimoto": [{ code: "E06.3", descDe: "Hashimoto-Thyreoiditis", category: "Hormone" }],
  "wirbelsaeuleGelenke.rheuma.ja": [{ code: "M06.9", descDe: "Rheumatoide Arthritis", category: "Gelenke" }],
  "hautInfektionen.psoriasis.ja": [{ code: "L40.9", descDe: "Psoriasis", category: "Haut" }],
  "hautInfektionen.ekzem.atopisch": [{ code: "L20.9", descDe: "Neurodermitis", category: "Haut" }],
  "frauengesundheit.endometriose.ja": [{ code: "N80.9", descDe: "Endometriose", category: "Gynäkologie" }],
  "maennergesundheit.prostata.bph": [{ code: "N40", descDe: "Prostatahyperplasie", category: "Urologie" }],
};

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function extractFixedICD10(formData: JsonRecord): Icd10Code[] {
  const results: { code: string; descDe: string; category: string; source: string }[] = [];
  const seen = new Set<string>();
  for (const [path, entries] of Object.entries(icd10FixedMapping)) {
    const value = getNestedValue(formData, path);
    if (value === true) {
      for (const entry of entries) {
        if (!seen.has(entry.code)) {
          seen.add(entry.code);
          results.push({ ...entry, source: "Feste Zuordnung" });
        }
      }
    }
  }
  return results;
}

function collectFreeText(formData: JsonRecord): string[] {
  const fields = [
    "weitereErkrankungen", "zusaetzlicheInfos",
    "herzKreislauf.sonstige", "lungeAtmung.sonstige", "magenDarm.sonstige",
    "leberGalle.sonstige", "niereBlase.sonstige", "hormongesundheit.sonstige",
    "wirbelsaeuleGelenke.sonstige", "maennergesundheit.sonstige",
    "beschwerden.hauptbeschwerde", "beschwerden.weitereBeschwerden",
  ];
  const texts: string[] = [];
  for (const f of fields) {
    const v = getNestedValue(formData, f);
    if (typeof v === "string" && v.trim().length > 2) texts.push(v.trim());
  }
  return texts;
}

async function generateAIICD10(freeTexts: string[]): Promise<AiIcd10Code[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey || freeTexts.length === 0) return [];

  try {
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
            content: `Du bist ein medizinischer Kodierer. Analysiere Symptombeschreibungen und ordne ICD-10-GM Codes zu.
REGELN:
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Array
- Jedes Element: {"code": "ICD-10 Code", "descDe": "Deutsche Beschreibung", "category": "Kategorie", "confidence": 0.0-1.0}
- Nur medizinisch begründbare Zuordnungen (confidence >= 0.6)
- Maximal 10 Codes
- Keine Patientendaten wiedergeben`,
          },
          {
            role: "user",
            content: `Symptombeschreibungen (anonymisiert):\n${symptomText}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) return [];

    const aiData = await aiResponse.json();
    const aiRecord = isRecord(aiData) ? aiData : {};
    const choices = Array.isArray(aiRecord.choices) ? aiRecord.choices : [];
    const firstChoice = isRecord(choices[0]) ? choices[0] : {};
    const message = isRecord(firstChoice.message) ? firstChoice.message : {};
    const content = typeof message.content === "string" ? message.content : "";
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1];

    const parsed: unknown = JSON.parse(jsonStr.trim());
    const items = Array.isArray(parsed) ? parsed : [];
    return items
      .filter((item): item is AiIcd10Item => {
        if (!isAiIcd10Item(item)) return false;
        return typeof item.code === "string" && typeof item.confidence === "number" && item.confidence >= 0.6;
      })
      .map((item) => ({
        code: item.code as string,
        descDe: typeof item.descDe === "string" ? item.descDe : item.code as string,
        category: typeof item.category === "string" ? item.category : "KI-Analyse",
        source: `KI-Analyse (${Math.round((item.confidence as number) * 100)}%)`,
        confidence: item.confidence as number,
      }));
  } catch {
    console.error("[resend] AI ICD-10 generation failed");
    return [];
  }
}

function buildICD10HtmlTable(codes: Icd10Code[]): string {
  if (codes.length === 0) return "<p><em>Keine ICD-10 Codes aus den Angaben ableitbar.</em></p>";
  
  let html = `<table style="width:100%;border-collapse:collapse;margin:15px 0;">
    <tr style="background:#4a7c59;color:white;">
      <th style="padding:8px;text-align:left;border:1px solid #ddd;">ICD-10</th>
      <th style="padding:8px;text-align:left;border:1px solid #ddd;">Diagnose</th>
      <th style="padding:8px;text-align:left;border:1px solid #ddd;">Kategorie</th>
      <th style="padding:8px;text-align:left;border:1px solid #ddd;">Quelle</th>
    </tr>`;

  for (const c of codes) {
    const bg = c.source.startsWith("KI") ? "#fff8e1" : "#f0f7f0";
    html += `<tr style="background:${bg};">
      <td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;font-family:monospace;">${escapeHtml(c.code)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(c.descDe)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(c.category)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">${escapeHtml(c.source)}</td>
    </tr>`;
  }

  html += "</table>";
  html += `<p style="color:#999;font-size:11px;margin-top:5px;">⚕️ <em>Diese ICD-10-Codes wurden automatisch generiert und dienen ausschließlich als Vorschlag. Die endgültige Diagnose obliegt dem behandelnden Therapeuten.</em></p>`;
  return html;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Admin auth check
    let isAdmin = false;
    let adminUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    
    if (authHeader && authHeader !== `Bearer ${supabaseKey}`) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminCheck } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        isAdmin = !!adminCheck;
        adminUserId = isAdmin ? user.id : null;
      }
    }

    if (!isAdmin || !adminUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rateLimitKey = `resend-submission:admin:${adminUserId}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[resend] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as ResendSubmissionBody;
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from("anamnesis_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = getOptionalFormRecord((submission as AnamnesisSubmission).form_data);
    const patientName = `${getStringField(formData, "vorname")} ${getStringField(formData, "nachname")}`.trim() || "Unbekannt";
    const patientEmail = getStringField(formData, "email", "-");
    const patientPhone = getStringField(formData, "telefon", getStringField(formData, "telefonPrivat", getStringField(formData, "mobil", "-")));
    const patientDob = getStringField(formData, "geburtsdatum", "-");
    const submittedAt = new Date((submission as AnamnesisSubmission).submitted_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    // Fetch IAA data
    const { data: iaaSubmission } = await adminClient
      .from("iaa_submissions")
      .select("form_data")
      .eq("user_id", (submission as AnamnesisSubmission).user_id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const iaaData = getOptionalFormRecord(iaaSubmission?.form_data);

    // Generate ICD-10 codes
    console.log("[resend] Generating ICD-10 codes...");
    const fixedCodes = extractFixedICD10(formData);
    const freeTexts = collectFreeText(formData);
    const aiCodes = await generateAIICD10(freeTexts);

    // Deduplicate
    const allCodes = [...fixedCodes, ...aiCodes];
    const deduped = new Map<string, typeof allCodes[0]>();
    for (const c of allCodes) {
      if (!deduped.has(c.code)) deduped.set(c.code, c);
    }
    const finalCodes = Array.from(deduped.values()).sort((a, b) => a.code.localeCompare(b.code));
    console.log(`[resend] Generated ${finalCodes.length} ICD-10 codes (${fixedCodes.length} fixed, ${aiCodes.length} AI)`);

    const icd10Html = buildICD10HtmlTable(finalCodes);

    // Try to retrieve stored PDFs from storage
    let anamnesePdfBase64: string | undefined;
    let patientPdfBase64: string | undefined;
    let iaaPdfBase64: string | undefined;

    const pdfStoragePath = submissionId;
    const pdfNames = ['anamnese-full.pdf', 'anamnese-patient.pdf', 'iaa.pdf'];
    
    console.log("[resend] Retrieving stored PDFs");
    const pdfResults = await Promise.all(
      pdfNames.map(name => 
        adminClient.storage.from('anamnesis-pdfs').download(`${pdfStoragePath}/${name}`)
      )
    );

    if (pdfResults[0].data) {
      const buf = await pdfResults[0].data.arrayBuffer();
      anamnesePdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      console.log(`[resend] Retrieved anamnese-full.pdf (${anamnesePdfBase64.length} base64 chars)`);
    }
    if (pdfResults[1].data) {
      const buf = await pdfResults[1].data.arrayBuffer();
      patientPdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      console.log(`[resend] Retrieved anamnese-patient.pdf`);
    }
    if (pdfResults[2].data) {
      const buf = await pdfResults[2].data.arrayBuffer();
      iaaPdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      console.log(`[resend] Retrieved iaa.pdf`);
    }

    if (!anamnesePdfBase64) {
      console.warn("[resend] No stored PDFs found – sending without attachments");
    }

    const pdfFilename = `Anamnesebogen_${patientName.replace(/\s+/g, '_')}_${new Date((submission as AnamnesisSubmission).submitted_at).toISOString().split('T')[0]}.pdf`;
    const iaaPdfFilename = `IAA_${patientName.replace(/\s+/g, '_')}_${new Date((submission as AnamnesisSubmission).submitted_at).toISOString().split('T')[0]}.pdf`;

    // Build IAA summary HTML
    let iaaSummaryHtml = "";
    if (Object.keys(iaaData).length > 0) {
      iaaSummaryHtml = `<h3 style="color:#4a7c59;margin-top:20px;">IAA-Auswertung</h3>
        <table style="width:100%;border-collapse:collapse;margin:10px 0;">
        <tr style="background:#e8f5e9;">
          <th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Frage-Nr.</th>
          <th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Wert (1-6)</th>
        </tr>`;
      for (const [key, rawVal] of Object.entries(iaaData).sort()) {
        const val = typeof rawVal === "number" ? rawVal : Number(rawVal);
        const displayVal = Number.isFinite(val) ? val : "—";
        const bg = typeof displayVal === "number" && displayVal >= 4 ? "#fff3e0" : "#fff";
        iaaSummaryHtml += `<tr style="background:${bg};">
          <td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(key)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">${displayVal}</td>
        </tr>`;
      }
      iaaSummaryHtml += "</table>";
    }

    // Send emails in parallel
    const emailPromises: Promise<unknown>[] = [];

    // 1. Anamnese to practice (with PDF if available)
    emailPromises.push(sendEmail({
      to: "anamnese@art-of-therapy.de",
      subject: `[Erneut] Anamnesebogen: ${escapeHtml(patientName)}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:20px 0;border-bottom:2px solid #4a7c59;">
    <h1 style="color:#4a7c59;margin:0;">Anamnesebogen (erneut gesendet)</h1>
  </div>
  <div style="background:#f0f7f0;border:1px solid #4a7c59;border-radius:8px;padding:15px;margin:20px 0;">
    <p><strong style="color:#4a7c59;">Patient:</strong> ${escapeHtml(patientName)}</p>
    <p><strong style="color:#4a7c59;">E-Mail:</strong> ${escapeHtml(patientEmail)}</p>
    <p><strong style="color:#4a7c59;">Telefon:</strong> ${escapeHtml(patientPhone)}</p>
    <p><strong style="color:#4a7c59;">Geburtsdatum:</strong> ${escapeHtml(patientDob)}</p>
    <p><strong style="color:#4a7c59;">Eingereicht am:</strong> ${escapeHtml(submittedAt)}</p>
    <p><strong style="color:#4a7c59;">Status:</strong> Digital verifiziert ✅</p>
  </div>
  <h3 style="color:#4a7c59;">ICD-10 Vorschläge</h3>
  ${icd10Html}
  <p style="margin-top:20px;color:#666;font-size:12px;">Automatische Benachrichtigung - Naturheilpraxis Rauch<br>
  <em>Erneut gesendet aus dem Admin-Bereich.${anamnesePdfBase64 ? ' PDF-Anhang beigefügt.' : ''}</em></p>
</div></body></html>`,
      attachment: anamnesePdfBase64 ? { filename: pdfFilename, base64: anamnesePdfBase64, contentType: 'application/pdf' } : undefined,
    }));

    // 2. IAA to practice (with IAA PDF if available)
    emailPromises.push(sendEmail({
      to: "iaa@art-of-therapy.de",
      subject: `[Erneut] IAA + ICD-10 Bericht: ${escapeHtml(patientName)}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;">
<div style="max-width:700px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:20px 0;border-bottom:2px solid #4a7c59;">
    <h1 style="color:#4a7c59;margin:0;">IAA-Fragebogen + ICD-10 Analyse</h1>
  </div>
  <div style="background:#f0f7f0;border:1px solid #4a7c59;border-radius:8px;padding:15px;margin:20px 0;">
    <p><strong style="color:#4a7c59;">Patient:</strong> ${escapeHtml(patientName)}</p>
    <p><strong style="color:#4a7c59;">E-Mail:</strong> ${escapeHtml(patientEmail)}</p>
    <p><strong style="color:#4a7c59;">Geburtsdatum:</strong> ${escapeHtml(patientDob)}</p>
    <p><strong style="color:#4a7c59;">Eingereicht am:</strong> ${escapeHtml(submittedAt)}</p>
  </div>
  
  ${iaaSummaryHtml || "<p><em>Keine IAA-Daten vorhanden.</em></p>"}
  
  <h3 style="color:#4a7c59;margin-top:25px;">ICD-10 Vorschläge (basierend auf Anamnese-Angaben)</h3>
  ${icd10Html}
  
  <div style="margin-top:25px;background:#fff3e0;border:1px solid #f0a000;border-radius:8px;padding:15px;">
    <p style="margin:0;font-size:13px;color:#7a5500;">
      <strong>⚕️ Wichtiger Hinweis:</strong> Die ICD-10-Codes wurden automatisch aus den Anamnese-Angaben des Patienten abgeleitet.
      Feste Zuordnungen basieren auf validierten medizinischen Mappings. KI-generierte Vorschläge (gelb markiert) wurden
      mittels Gemini AI erstellt und dienen ausschließlich als Orientierungshilfe. Die endgültige Diagnose obliegt dem behandelnden Therapeuten.
    </p>
  </div>
  
  <p style="margin-top:20px;color:#666;font-size:12px;">Automatische Benachrichtigung - Naturheilpraxis Rauch<br>
  <em>Erneut gesendet aus dem Admin-Bereich.${iaaPdfBase64 ? ' IAA-PDF beigefügt.' : ''}</em></p>
</div></body></html>`,
      attachment: iaaPdfBase64 ? { filename: iaaPdfFilename, base64: iaaPdfBase64, contentType: 'application/pdf' } : undefined,
    }));

    // 3. Confirmation copy to patient (with patient PDF, without ICD-10 / IAA data)
    emailPromises.push(sendEmail({
      to: patientEmail,
      subject: `[Erneut] Bestätigung: Ihr Anamnesebogen – Naturheilpraxis Rauch`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:20px 0;border-bottom:2px solid #4a7c59;">
    <h1 style="color:#4a7c59;margin:0;">Bestätigung Ihres Anamnesebogens</h1>
  </div>
  <p style="margin-top:20px;">Sehr geehrte/r ${escapeHtml(patientName)},</p>
  <p>Ihr Anamnesebogen wurde erfolgreich an die Naturheilpraxis Rauch übermittelt.</p>
  <div style="background:#f0f7f0;border:1px solid #4a7c59;border-radius:8px;padding:15px;margin:20px 0;">
    <p><strong style="color:#4a7c59;">Eingereicht am:</strong> ${escapeHtml(submittedAt)}</p>
    <p><strong style="color:#4a7c59;">Status:</strong> Digital verifiziert ✅</p>
  </div>
  ${patientPdfBase64 ? '<p>📎 Eine Kopie Ihres Anamnesebogens finden Sie als <strong>PDF im Anhang</strong>.</p>' : ''}
  <p>Bei Fragen erreichen Sie uns unter:</p>
  <ul style="list-style:none;padding:0;">
    <li>📧 E-Mail: info@rauch-heilpraktiker.de</li>
    <li>📞 Telefon: 0821-4504050</li>
  </ul>
  <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;color:#999;font-size:12px;">
    <p>Mit freundlichen Grüßen,<br>Ihre Naturheilpraxis Rauch</p>
    <p><em>Hinweis: Diese Bestätigung wurde erneut gesendet.</em></p>
  </div>
</div></body></html>`,
      attachment: patientPdfBase64 ? { filename: pdfFilename, base64: patientPdfBase64, contentType: 'application/pdf' } : undefined,
    }));

    await Promise.all(emailPromises);

    const pdfInfo = anamnesePdfBase64 ? 'mit PDF-Anhängen' : 'ohne PDF (keine gespeicherten PDFs gefunden)';
    console.log(`[resend] Emails sent successfully ${pdfInfo}`);

    return new Response(JSON.stringify({
      success: true,
      message: `E-Mails erfolgreich erneut gesendet (${pdfInfo})`,
      icd10Count: finalCodes.length,
      iaaEntries: Object.keys(iaaData).length,
      pdfsAttached: !!anamnesePdfBase64,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("[resend] request failed");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
