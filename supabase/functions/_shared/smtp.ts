/**
 * Shared email sending utility for Supabase Edge Functions.
 * Sends via PHP mail relay on the user's webserver.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachment?: {
    filename: string;
    base64: string;
    contentType: string;
  };
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
  const { to, subject, html, from = "info@rauch-heilpraktiker.de", attachment } = options;

  const relaySecret = Deno.env.get("RELAY_SECRET");
  if (!relaySecret) throw new Error("Email service not configured (missing RELAY_SECRET)");

  const relayUrl = "https://rauch-heilpraktiker.de/mail-relay.php";

  const payload: Record<string, unknown> = {
    to,
    subject, // Send subject as plain text (RFC 2047 encoding is done by PHP relay if needed)
    html,
    from,
  };

  if (attachment) {
    payload.attachment = attachment;
  }

  // Delay for local delivery addresses to avoid QMail timeout on same-domain routing
  // Reduced from 60s to 5s to avoid edge function timeouts when sending multiple local emails
  const isLocalDelivery = to.endsWith("@rauch-heilpraktiker.de");
  if (isLocalDelivery) {
    const delaySec = 5;
    console.log(`[relay] delaying ${delaySec}s for local delivery to ${to}`);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  console.log(`[relay] sending email to ${to} (attachment: ${!!attachment})`);

  const resp = await fetch(relayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relay-Token": relaySecret,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();

  if (!resp.ok || text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    // If sending WITH attachment failed, retry WITHOUT and notify admin
    if (attachment) {
      console.warn("[relay] Failed with attachment, retrying without. Status:", resp.status, text.substring(0, 200));
      
      // Send admin notification about the fallback (fire-and-forget, don't block)
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

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    console.error("[relay] Failed to parse response:", text.substring(0, 200));
    throw new Error("Email service response error");
  }

  // Log full relay response for debugging
  console.log(`[relay] Response for ${to}: version=${result.version || 'unknown'}, success=${result.success}, message=${result.message || '-'}, full=${JSON.stringify(result).substring(0, 500)}`);

  if (!result.success) {
    if (attachment) {
      console.warn("[relay] Failed with attachment (success=false), retrying without");
      
      // Send admin notification about the fallback (fire-and-forget)
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
        from: "praxis_rauch@icloud.com",
      }),
    });
    console.log(`[relay] Admin notified about PDF failure for ${originalTo}`);
  } catch (e) {
    console.warn("[relay] Failed to notify admin about PDF failure:", e);
  }
}
