import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
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
    const { patientName, submissionDate, pdfBase64, aiSummary, codeCount, language } = body;

    if (!pdfBase64 || !patientName) {
      return new Response(JSON.stringify({ error: "PDF-Daten und Patientenname erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language || "de";
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `ICD10_${patientName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").replace(/\s+/g, "_")}_${dateStr}.pdf`;
    const sentAt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    const summaryHtml = aiSummary
      ? `<div style="background:#f0f7f0;border:1px solid #4a7c59;border-radius:8px;padding:15px;margin:20px 0;">
           <p style="font-weight:bold;color:#4a7c59;">🧠 ${lang === "de" ? "KI-Zusammenfassung" : "AI Summary"}:</p>
           <p style="color:#333;font-size:14px;">${aiSummary}</p>
         </div>`
      : "";

    const htmlContent = `<!DOCTYPE html>
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
  <div class="header"><h1 style="color: #4a7c59; margin: 0;">ICD-10 Diagnoseübersicht</h1></div>
  <p>${lang === "de" ? "Eine neue ICD-10 Auswertung wurde generiert:" : "A new ICD-10 report was generated:"}</p>
  <div class="info-box">
    <p><span class="label">${lang === "de" ? "Patient" : "Patient"}:</span> ${patientName}</p>
    <p><span class="label">${lang === "de" ? "Einreichungsdatum" : "Submission date"}:</span> ${submissionDate || "-"}</p>
    <p><span class="label">${lang === "de" ? "Anzahl Codes" : "Code count"}:</span> ${codeCount || "-"}</p>
    <p><span class="label">${lang === "de" ? "Erstellt am" : "Generated"}:</span> ${sentAt}</p>
  </div>
  ${summaryHtml}
  <p>📎 ${lang === "de" ? "Der vollständige ICD-10 Bericht ist als <strong>PDF im Anhang</strong> beigefügt." : "The complete ICD-10 report is attached as a <strong>PDF</strong>."}</p>
  <div class="footer">
    <p>${lang === "de" ? "Automatische Benachrichtigung – Naturheilpraxis Rauch" : "Automatic notification – Naturopathic Practice Rauch"}</p>
    <p style="font-size:11px;color:#999;">⚠️ ${lang === "de" ? "KI-basierte Codes dienen als Vorschlag und müssen vom Therapeuten validiert werden." : "AI-based codes are suggestions and must be validated by the therapist."}</p>
  </div>
</div></body></html>`;

    const practiceEmails = ["info@rauch-heilpraktiker.de", "praxis_rauch@icloud.com"];
    const attachment = {
      filename,
      base64: pdfBase64,
      contentType: "application/pdf",
    };

    for (const email of practiceEmails) {
      await sendEmail({
        to: email,
        subject: `ICD-10 Diagnoseübersicht: ${patientName}`,
        html: htmlContent,
        attachment,
      });
    }

    console.log(`ICD-10 report sent for ${patientName} to practice emails`);

    return new Response(
      JSON.stringify({ success: true, message: lang === "de" ? "ICD-10 Bericht per E-Mail versendet" : "ICD-10 report sent via email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-icd10-report:", error);
    return new Response(
      JSON.stringify({ error: "Fehler beim Versand des ICD-10 Berichts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
