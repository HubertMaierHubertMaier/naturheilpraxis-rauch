/**
 * Shared email sending utility for Supabase Edge Functions.
 * Sends via PHP mail relay on the user's webserver.
 * Persists each attempt to `email_send_log` for post-mortem analysis.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative for clients without HTML rendering. */
  text?: string;
  from?: string;
  /** Free-form context tag for analytics, e.g. "registration", "password_reset", "anamnese". */
  context?: string;
  attachment?: {
    filename: string;
    base64: string;
    contentType: string;
  };
}

async function logEmailAttempt(entry: {
  recipient: string;
  subject: string;
  context?: string;
  from_addr: string;
  http_status: number | null;
  relay_success: boolean | null;
  relay_message: string | null;
  relay_version: string | null;
  error_message: string | null;
  duration_ms: number;
  has_attachment: boolean;
}): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const sb = createClient(url, key);
    await sb.from("email_send_log").insert({
      recipient: entry.recipient,
      subject: entry.subject?.substring(0, 500) ?? null,
      context: entry.context ?? null,
      from_addr: entry.from_addr,
      http_status: entry.http_status,
      relay_success: entry.relay_success,
      relay_message: entry.relay_message?.substring(0, 2000) ?? null,
      relay_version: entry.relay_version,
      error_message: entry.error_message?.substring(0, 2000) ?? null,
      duration_ms: entry.duration_ms,
      has_attachment: entry.has_attachment,
    });
  } catch (e) {
    console.warn("[email_send_log] insert failed:", (e as Error).message);
  }
}

/**
 * Minimal HTML→Text fallback. Strips tags, decodes basic entities, collapses whitespace.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map(l => l.trim()).join("\n")
    .trim();
}


/**
 * RFC 2047 encode subject for UTF-8 (fixes umlaut display)
 */
function encodeSubjectRfc2047(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Send an email via PHP relay. Supports optional PDF attachment.
 * Falls back to sending without attachment if first attempt fails.
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<{ attachmentSent: boolean }> {
  // WICHTIG: Default-Absender MUSS eine Adresse auf rauch-heilpraktiker.de sein,
  // weil sich der PHP-Relay genau dort per SMTP-Auth (info@) anmeldet.
  // Eine fremde Domain (z.B. icloud.com) als MAIL FROM führt bei QMail/Plesk
  // dazu, dass die Mail abgelehnt oder fälschlich an praxis_rauch@icloud.com
  // zurück-/zugestellt wird statt an den eigentlichen Empfänger.
  const { to, subject, html, text, from = "info@rauch-heilpraktiker.de", context, attachment } = options;

  const relaySecret = Deno.env.get("RELAY_SECRET");
  if (!relaySecret) throw new Error("Email service not configured (missing RELAY_SECRET)");

  const relayUrl = "https://rauch-heilpraktiker.de/mail-relay.php";

  // Auto-derive plain text from HTML if no explicit text provided.
  const plainText = text ?? htmlToPlainText(html);

  const payload: Record<string, unknown> = {
    to,
    subject,
    html,
    text: plainText,
    from,
  };

  if (attachment) {
    payload.attachment = attachment;
  }

  const isLocalDelivery = to.endsWith("@rauch-heilpraktiker.de");
  if (isLocalDelivery) {
    const delaySec = 5;
    console.log(`[relay] delaying ${delaySec}s for local delivery to ${to}`);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  console.log(`[relay] sending email to ${to} (attachment: ${!!attachment}, context: ${context || '-'})`);

  const startedAt = Date.now();
  let resp: Response;
  let text = "";
  try {
    resp = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": relaySecret,
      },
      body: JSON.stringify(payload),
    });
    text = await resp.text();
  } catch (e) {
    const errMsg = (e as Error).message || String(e);
    await logEmailAttempt({
      recipient: to, subject, context, from_addr: from,
      http_status: null, relay_success: false, relay_message: null, relay_version: null,
      error_message: `fetch failed: ${errMsg}`,
      duration_ms: Date.now() - startedAt,
      has_attachment: !!attachment,
    });
    throw e;
  }

  if (!resp.ok || text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    await logEmailAttempt({
      recipient: to, subject, context, from_addr: from,
      http_status: resp.status, relay_success: false, relay_message: text.substring(0, 1000), relay_version: null,
      error_message: `HTTP ${resp.status} or HTML response`,
      duration_ms: Date.now() - startedAt,
      has_attachment: !!attachment,
    });
    if (attachment) {
      console.warn("[relay] Failed with attachment, retrying without. Status:", resp.status, text.substring(0, 200));
      notifyAdminPdfFailure(to, attachment.filename, resp.status, text.substring(0, 200)).catch(() => {});
      return sendEmail({
        ...options,
        html: html + '\n<p style="color:#999;font-size:11px;">⚠️ Hinweis: Der PDF-Anhang konnte aus technischen Gründen nicht beigefügt werden.</p>',
        attachment: undefined,
      });
    }
    console.error("[relay] Error:", resp.status, text.substring(0, 300));
    throw new Error(`Email delivery failed (relay status ${resp.status})`);
  }

  let result: { success?: boolean; message?: string; version?: string } = {};
  try {
    result = JSON.parse(text);
  } catch {
    await logEmailAttempt({
      recipient: to, subject, context, from_addr: from,
      http_status: resp.status, relay_success: false, relay_message: text.substring(0, 1000), relay_version: null,
      error_message: "JSON parse failed",
      duration_ms: Date.now() - startedAt,
      has_attachment: !!attachment,
    });
    console.error("[relay] Failed to parse response:", text.substring(0, 200));
    throw new Error("Email service response error");
  }

  console.log(`[relay] Response for ${to}: version=${result.version || 'unknown'}, success=${result.success}, message=${result.message || '-'}`);

  await logEmailAttempt({
    recipient: to, subject, context, from_addr: from,
    http_status: resp.status,
    relay_success: !!result.success,
    relay_message: result.message ?? null,
    relay_version: result.version ?? null,
    error_message: result.success ? null : (result.message ?? "success=false"),
    duration_ms: Date.now() - startedAt,
    has_attachment: !!attachment,
  });

  if (!result.success) {
    if (attachment) {
      console.warn("[relay] Failed with attachment (success=false), retrying without");
      notifyAdminPdfFailure(to, attachment.filename, 200, result.message || "success=false").catch(() => {});
      return sendEmail({
        ...options,
        html: html + '\n<p style="color:#999;font-size:11px;">⚠️ Hinweis: Der PDF-Anhang konnte aus technischen Gründen nicht beigefügt werden.</p>',
        attachment: undefined,
      });
    }
    throw new Error("Email delivery failed");
  }

  console.log("[relay] Email sent successfully to", to, attachment ? "(with attachment)" : "");
  return { attachmentSent: !!attachment };
}


/**
 * Notify admin that a PDF attachment could not be sent.
 * Sends a lightweight alert email to the practice info address.
 */
async function notifyAdminPdfFailure(
  originalTo: string,
  filename: string,
  statusCode: number,
  errorDetail: string,
): Promise<void> {
  const relaySecret = Deno.env.get("RELAY_SECRET");
  if (!relaySecret) return;

  const relayUrl = "https://rauch-heilpraktiker.de/mail-relay.php";
  
  try {
    await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": relaySecret,
      },
      body: JSON.stringify({
        to: "praxis_rauch@icloud.com",
        subject: `[WARNUNG] PDF-Anhang fehlgeschlagen: ${filename}`,
        html: `<div style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#c0392b;">⚠️ PDF-Anhang konnte nicht gesendet werden</h2>
          <p><strong>Empfänger:</strong> ${originalTo}</p>
          <p><strong>Dateiname:</strong> ${filename}</p>
          <p><strong>HTTP-Status:</strong> ${statusCode}</p>
          <p><strong>Fehlerdetail:</strong> ${errorDetail}</p>
          <p><strong>Zeitpunkt:</strong> ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>
          <hr style="margin:15px 0;border:none;border-top:1px solid #ddd;">
          <p style="color:#666;font-size:12px;">Die E-Mail wurde ohne Anhang gesendet. Bitte prüfen Sie den Vorgang im Admin-Bereich und senden Sie ggf. erneut.</p>
        </div>`,
        from: "info@rauch-heilpraktiker.de",
      }),
    });
    console.log(`[relay] Admin notified about PDF failure for ${originalTo}`);
  } catch (e) {
    console.warn("[relay] Failed to notify admin about PDF failure:", e);
  }
}
