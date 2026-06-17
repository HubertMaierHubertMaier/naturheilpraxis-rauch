import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
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

const requestSchema = z.object({
  action: z.enum(["submit", "confirm"]),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .max(255)
    .transform((v) => v.trim().toLowerCase()),
  formData: z.record(z.any()).optional(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/)
    .optional(),
  submissionId: z.string().uuid().optional().nullable(),
  tempUserId: z.string().uuid().optional().nullable(),
  pdfBase64: z.string().optional(),
  pdfBase64WithoutIAA: z.string().optional(),
  iaaPdfBase64: z.string().optional(),
});

// In-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const r = rateLimitMap.get(key);
  if (!r || now > r.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (r.count >= max) return false;
  r.count++;
  return true;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── ICD-10 Fixed Mapping ───
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

function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function extractFixedICD10(formData: Record<string, any>): { code: string; descDe: string; category: string; source: string }[] {
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

function collectFreeText(formData: Record<string, any>): string[] {
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

async function generateAIICD10(freeTexts: string[]): Promise<{ code: string; descDe: string; category: string; source: string; confidence: number }[]> {
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
    const content = aiData.choices?.[0]?.message?.content || "";
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1];

    const parsed = JSON.parse(jsonStr.trim());
    const items = Array.isArray(parsed) ? parsed : [];
    return items
      .filter((item: any) => item.code && item.confidence >= 0.6)
      .map((item: any) => ({
        code: item.code,
        descDe: item.descDe || item.code,
        category: item.category || "KI-Analyse",
        source: `KI-Analyse (${Math.round(item.confidence * 100)}%)`,
        confidence: item.confidence,
      }));
  } catch (e) {
    console.error("AI ICD-10 error:", e);
    return [];
  }
}

function buildICD10HtmlTable(codes: { code: string; descDe: string; category: string; source: string }[]): string {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Ungültiges Anfrageformat" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = requestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Ungültige Eingabe";
      console.error("Validation error: invalid submit-anamnesis request payload");
      return new Response(JSON.stringify({ error: firstError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, formData, code, submissionId, tempUserId, pdfBase64, pdfBase64WithoutIAA, iaaPdfBase64 } =
      parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Der Anamnesebogen ist nicht mehr öffentlich: gültige Sitzung erforderlich.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch { /* not authenticated - ok for dev mode */ }
    }
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Anmeldung erforderlich" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: SUBMIT ──────────────────────────────────────────────
    if (action === "submit") {
      if (!formData) {
        return new Response(
          JSON.stringify({ error: "Formulardaten fehlen" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!checkRateLimit(`submit:${email}`)) {
        return new Response(
          JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie 15 Minuten." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const effectiveUserId = userId;
      let submId: string | null = null;

      if (userId) {
        const { data: existing } = await supabase
          .from("anamnesis_submissions")
          .select("id")
          .eq("user_id", userId)
          .in("status", ["draft", "pending_verification"])
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from("anamnesis_submissions")
            .update({ form_data: formData, status: "pending_verification" })
            .eq("id", existing.id);
          if (updateError) { console.error("DB update error:", updateError); throw new Error("Failed to save submission"); }
          submId = existing.id;
        } else {
          const { data: sub, error: subError } = await supabase
            .from("anamnesis_submissions")
            .insert({ user_id: userId, form_data: formData, status: "pending_verification" })
            .select("id")
            .single();
          if (subError) { console.error("DB insert error:", subError); throw new Error("Failed to save submission"); }
          submId = sub.id;
        }
      }

      const verCode = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase
        .from("verification_codes")
        .delete()
        .eq("user_id", effectiveUserId)
        .eq("type", "anamnesis")
        .eq("used", false);

      const { error: codeError } = await supabase
        .from("verification_codes")
        .insert({
          user_id: effectiveUserId,
          code: verCode,
          type: "anamnesis",
          expires_at: expiresAt.toISOString(),
        });

      if (codeError) { console.error("Code insert error:", codeError); throw new Error("Failed to create verification code"); }

      const patientName = `${formData.vorname || ""} ${formData.nachname || ""}`.trim() || "Patient";

      console.log("[SMTP] sending anamnesis verification code");

      await sendEmail({
        to: email,
        subject: "Ihr Bestätigungscode – Anamnesebogen – Naturheilpraxis Rauch",
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4a7c59; }
  .code-box { background: #f5f5f5; border: 2px solid #4a7c59; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
  .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4a7c59; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head><body>
<div class="container">
  <div class="header"><h1 style="color: #4a7c59; margin: 0;">Naturheilpraxis Rauch</h1></div>
  <p>Guten Tag ${escapeHtml(patientName)},</p>
  <p>vielen Dank für das Ausfüllen des Anamnesebogens. Um Ihre digitale Unterschrift rechtssicher zu bestätigen (§&nbsp;126a BGB), verwenden Sie bitte den folgenden Code:</p>
  <div class="code-box"><div class="code">${verCode}</div></div>
  <p>Dieser Code ist <strong>10 Minuten</strong> gültig.</p>
  <p>Falls Sie diesen Anamnesebogen nicht ausgefüllt haben, können Sie diese E-Mail ignorieren.</p>
  <div class="footer"><p>Mit freundlichen Grüßen,<br>Ihre Naturheilpraxis Rauch</p></div>
</div></body></html>`,
      });

      console.log("Anamnesis verification code sent");

      return new Response(
        JSON.stringify({
          success: true,
          submissionId: submId,
          tempUserId: undefined,
          message: "Bestätigungscode wurde gesendet",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: CONFIRM ─────────────────────────────────────────────
    if (action === "confirm") {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code ist erforderlich" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!checkRateLimit(`verify:${email}`, 10, 60 * 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "Zu viele Versuche. Bitte warten Sie eine Stunde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const effectiveUserId = userId;

      // Verify code
      const { data: vc, error: vcError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("code", code)
        .eq("type", "anamnesis")
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (vcError || !vc) {
        return new Response(
          JSON.stringify({ error: "Ungültiger oder abgelaufener Code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark code as used
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", vc.id);

      // Update submission status if exists
      if (submissionId) {
        await supabase
          .from("anamnesis_submissions")
          .update({
            status: "verified",
            signature_data: JSON.stringify({
              verified_at: new Date().toISOString(),
              method: "email_2fa",
              legal_basis: "§ 126a BGB",
            }),
          })
          .eq("id", submissionId);
      }

      console.log("PDF attachment status:", {
        hasPdfBase64: !!pdfBase64,
        pdfBase64Length: pdfBase64?.length || 0,
      });

      // Extract patient info
      const fd = formData || {};
      const patientName = `${fd.vorname || ""} ${fd.nachname || ""}`.trim() || "Unbekannt";
      const patientEmail = email;
      const patientPhone = String(fd.telefon || fd.mobil || "-");
      const patientDob = String(fd.geburtsdatum || "-");
      const submittedAt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

      const pdfFilename = `Anamnesebogen_${escapeHtml(patientName).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const iaaPdfFilename = `IAA_${escapeHtml(patientName).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Anamnese PDF (with IAA) for practice anamnese address
      const anamnesePdfAttachment = pdfBase64 ? {
        filename: pdfFilename,
        base64: pdfBase64,
        contentType: "application/pdf",
      } : undefined;

      // Anamnese PDF WITHOUT IAA for patient
      const patientPdfAttachment = (pdfBase64WithoutIAA || pdfBase64) ? {
        filename: pdfFilename,
        base64: pdfBase64WithoutIAA || pdfBase64,
        contentType: "application/pdf",
      } : undefined;

      // IAA-only PDF for iaa@ address
      const iaaPdfAttachment = iaaPdfBase64 ? {
        filename: iaaPdfFilename,
        base64: iaaPdfBase64,
        contentType: "application/pdf",
      } : undefined;

      // ── Generate ICD-10 codes from form data ──
      console.log("[submit-anamnesis] Generating ICD-10 codes from form data...");
      const fixedCodes = extractFixedICD10(fd);
      const freeTexts = collectFreeText(fd);
      let aiCodes: { code: string; descDe: string; category: string; source: string; confidence: number }[] = [];
      try {
        aiCodes = await generateAIICD10(freeTexts);
      } catch (e) {
        console.error("[submit-anamnesis] AI ICD-10 generation failed, continuing with fixed codes only:", e);
      }
      const allCodes = [...fixedCodes, ...aiCodes];
      const deduped = new Map<string, typeof allCodes[0]>();
      for (const c of allCodes) {
        if (!deduped.has(c.code)) deduped.set(c.code, c);
      }
      const finalCodes = Array.from(deduped.values()).sort((a, b) => a.code.localeCompare(b.code));
      console.log(`[submit-anamnesis] Generated ${finalCodes.length} ICD-10 codes (${fixedCodes.length} fixed, ${aiCodes.length} AI)`);
      const icd10Html = buildICD10HtmlTable(finalCodes);

      // ── Send practice emails in parallel to avoid timeout from sequential delays ──
      const practiceEmails: Promise<any>[] = [];
      
      // Anamnese notification to practice (anamnese@ address)
      practiceEmails.push(sendEmail({
        to: "anamnese@art-of-therapy.de",
        subject: `Neuer Anamnesebogen eingegangen: ${escapeHtml(patientName)}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4a7c59; }
  .info-box { background: #f0f7f0; border: 1px solid #4a7c59; border-radius: 8px; padding: 15px; margin: 20px 0; }
  .label { font-weight: bold; color: #4a7c59; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head><body>
<div class="container">
  <div class="header"><h1 style="color: #4a7c59; margin: 0;">Neuer Anamnesebogen</h1></div>
  <p>Ein neuer Anamnesebogen wurde eingereicht und digital verifiziert:</p>
  <div class="info-box">
    <p><span class="label">Patient:</span> ${escapeHtml(patientName)}</p>
    <p><span class="label">E-Mail:</span> ${escapeHtml(patientEmail)}</p>
    <p><span class="label">Telefon:</span> ${escapeHtml(patientPhone)}</p>
    <p><span class="label">Geburtsdatum:</span> ${escapeHtml(patientDob)}</p>
    <p><span class="label">Eingereicht am:</span> ${escapeHtml(submittedAt)}</p>
    <p><span class="label">Status:</span> Digital verifiziert</p>
  </div>
  <p>Der vollstaendige Anamnesebogen ist als PDF im Anhang beigefuegt.</p>
  <div class="footer"><p>Automatische Benachrichtigung - Naturheilpraxis Rauch</p></div>
</div></body></html>`,
        attachment: anamnesePdfAttachment,
      }));

      // IAA + ICD-10 notification to practice (iaa@ address) - ALWAYS send with ICD-10 codes
      practiceEmails.push(sendEmail({
        to: "iaa@art-of-therapy.de",
        subject: `Neuer IAA-Fragebogen + ICD-10: ${escapeHtml(patientName)}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4a7c59; }
  .info-box { background: #f0f7f0; border: 1px solid #4a7c59; border-radius: 8px; padding: 15px; margin: 20px 0; }
  .label { font-weight: bold; color: #4a7c59; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head><body>
<div class="container">
  <div class="header"><h1 style="color: #4a7c59; margin: 0;">IAA-Fragebogen + ICD-10 Analyse</h1></div>
  <p>Ein neuer IAA-Fragebogen wurde eingereicht:</p>
  <div class="info-box">
    <p><span class="label">Patient:</span> ${escapeHtml(patientName)}</p>
    <p><span class="label">E-Mail:</span> ${escapeHtml(patientEmail)}</p>
    <p><span class="label">Geburtsdatum:</span> ${escapeHtml(patientDob)}</p>
    <p><span class="label">Eingereicht am:</span> ${escapeHtml(submittedAt)}</p>
  </div>
  
  <h3 style="color:#4a7c59;margin-top:25px;">ICD-10 Vorschläge (basierend auf Anamnese-Angaben)</h3>
  ${icd10Html}
  
  <div style="margin-top:25px;background:#fff3e0;border:1px solid #f0a000;border-radius:8px;padding:15px;">
    <p style="margin:0;font-size:13px;color:#7a5500;">
      <strong>⚕️ Wichtiger Hinweis:</strong> Die ICD-10-Codes wurden automatisch aus den Anamnese-Angaben des Patienten abgeleitet.
      Feste Zuordnungen (grün) basieren auf validierten medizinischen Mappings. KI-generierte Vorschläge (gelb) wurden
      mittels Gemini AI erstellt und dienen ausschließlich als Orientierungshilfe. Die endgültige Diagnose obliegt dem behandelnden Therapeuten.
    </p>
  </div>
  
  ${iaaPdfAttachment ? '<p style="margin-top:15px;">Der IAA-Fragebogen ist als PDF im Anhang beigefügt.</p>' : '<p style="margin-top:15px;"><em>Kein separates IAA-PDF vorhanden.</em></p>'}
  <div class="footer"><p>Automatische Benachrichtigung - Naturheilpraxis Rauch</p></div>
</div></body></html>`,
        attachment: iaaPdfAttachment,
      }));

      // Send all practice emails in parallel
      await Promise.all(practiceEmails);

      // ── Send confirmation to patient ──
      await sendEmail({
        to: patientEmail,
        subject: "Bestätigung: Ihr Anamnesebogen wurde erfolgreich übermittelt – Naturheilpraxis Rauch",
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4a7c59; }
  .success-box { background: #f0f7f0; border: 2px solid #4a7c59; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head><body>
<div class="container">
  <div class="header"><h1 style="color: #4a7c59; margin: 0;">Naturheilpraxis Rauch</h1></div>
  <p>Guten Tag ${escapeHtml(patientName)},</p>
  <div class="success-box">
    <h2 style="color: #4a7c59;">✅ Anamnesebogen erfolgreich übermittelt</h2>
    <p>Ihr Anamnesebogen wurde am ${escapeHtml(submittedAt)} erfolgreich übermittelt und digital verifiziert.</p>
  </div>
  <p>Ihre Angaben werden vor Ihrem Termin von Peter Rauch geprüft, um eine optimale Behandlung zu gewährleisten.</p>
  <p>Bei Fragen erreichen Sie uns unter:</p>
  <ul>
    <li>E-Mail: info@rauch-heilpraktiker.de</li>
    <li>Telefon: 0821-4504050</li>
  </ul>
   <p>📎 Eine Kopie Ihres Anamnesebogens finden Sie als <strong>PDF im Anhang</strong> dieser E-Mail.</p>
  <div class="footer">
    <p>Mit freundlichen Grüßen,<br>Ihre Naturheilpraxis Rauch</p>
    <p style="font-size: 11px; color: #999;">Diese E-Mail wurde automatisch generiert. Ihre Gesundheitsdaten werden gemäß DSGVO geschützt und mit einer Aufbewahrungsfrist von 10 Jahren gespeichert.</p>
  </div>
</div></body></html>`,
        attachment: patientPdfAttachment,
      });

      // Store PDFs in storage for future resend capability
      const storePdfPromises: Promise<any>[] = [];
      const pdfStoragePath = submissionId || effectiveUserId;
      
      if (pdfBase64) {
        const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
        storePdfPromises.push(
          supabase.storage.from('anamnesis-pdfs').upload(
            `${pdfStoragePath}/anamnese-full.pdf`, pdfBytes,
            { contentType: 'application/pdf', upsert: true }
          ).then(r => { if (r.error) console.warn('[pdf-store] anamnese-full:', r.error.message); })
        );
      }
      if (pdfBase64WithoutIAA) {
        const pdfBytes = Uint8Array.from(atob(pdfBase64WithoutIAA), c => c.charCodeAt(0));
        storePdfPromises.push(
          supabase.storage.from('anamnesis-pdfs').upload(
            `${pdfStoragePath}/anamnese-patient.pdf`, pdfBytes,
            { contentType: 'application/pdf', upsert: true }
          ).then(r => { if (r.error) console.warn('[pdf-store] anamnese-patient:', r.error.message); })
        );
      }
      if (iaaPdfBase64) {
        const pdfBytes = Uint8Array.from(atob(iaaPdfBase64), c => c.charCodeAt(0));
        storePdfPromises.push(
          supabase.storage.from('anamnesis-pdfs').upload(
            `${pdfStoragePath}/iaa.pdf`, pdfBytes,
            { contentType: 'application/pdf', upsert: true }
          ).then(r => { if (r.error) console.warn('[pdf-store] iaa:', r.error.message); })
        );
      }
      
      // Await PDF storage before returning – edge functions shut down after response,
      // so fire-and-forget promises would be killed before completing the upload.
      if (storePdfPromises.length > 0) {
        try {
          await Promise.all(storePdfPromises);
          console.log(`[pdf-store] ${storePdfPromises.length} PDFs stored`);
        } catch (e) {
          console.warn('[pdf-store] Error storing PDFs:', e);
        }
      }

      // Audit log entry for DSGVO compliance
      await supabase.from("audit_log").insert({
        user_id: effectiveUserId,
        action: "anamnesis_submitted",
        details: {
          submission_id: submissionId || null,
          patient_name: patientName,
          verified_at: new Date().toISOString(),
          icd10_count: finalCodes.length,
          pdfs_stored: storePdfPromises.length,
        },
      });

      console.log("Anamnesis confirmed and emails sent");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Anamnesebogen erfolgreich übermittelt",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ungültige Aktion" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in submit-anamnesis:", error);
    return new Response(
      JSON.stringify({
        error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
