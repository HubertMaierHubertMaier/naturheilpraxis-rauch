const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RELAY_SECRET = Deno.env.get("RELAY_SECRET")!;

type NotifyExistingPatientBody = {
  email?: unknown;
  patientType?: unknown;
};

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

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return false;

  current.count += 1;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractAuthenticatedSubject(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const [, payloadSegment] = authHeader.replace("Bearer ", "").split(".");
  if (!payloadSegment) return null;

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as unknown;
    if (!isRecord(payload) || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authenticatedSubject = extractAuthenticatedSubject(req);
    if (!authenticatedSubject) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rateLimitKey = `notify-existing-patient:auth-user:${authenticatedSubject}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[notify-existing-patient] authenticated notification rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as NotifyExistingPatientBody;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const patientType = body.patientType === "existing_patient" ? "existing_patient" : "new_patient";

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing email or patientType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send notification email to the practice
    const notificationTo = "anamnese@rauch-heilpraktiker.de";
    const safeEmail = escapeHtml(email);
    const isExistingPatient = patientType === "existing_patient";
    const subject = isExistingPatient
      ? `Bestehender Patient möchte Zugang: ${email}`
      : `Neuer Patient registriert: ${email}`;

    const htmlBody = `
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #4a7c59;">${isExistingPatient ? "Bestehender Patient - Freischaltung erforderlich" : "Neue Patientenregistrierung"}</h2>
        <p>Ein ${isExistingPatient ? "bestehender" : "neuer"} Patient hat sich registriert:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 16px; font-weight: bold; background: #f0f7f0;">E-Mail:</td>
            <td style="padding: 8px 16px; background: #f0f7f0;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; font-weight: bold;">Typ:</td>
            <td style="padding: 8px 16px;">${isExistingPatient ? "Bestehender Patient" : "Neupatient"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; font-weight: bold; background: #f0f7f0;">Datum:</td>
            <td style="padding: 8px 16px; background: #f0f7f0;">${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td>
          </tr>
        </table>
        ${isExistingPatient
          ? `<p style="color: #c0392b; font-weight: bold;">⚠️ Bitte prüfen Sie, ob dieser Patient bereits in der Praxis bekannt ist und schalten Sie ihn ggf. in der Patientenverwaltung frei.</p>
             <p>Zur Freischaltung öffnen Sie die Patientenübersicht im Admin-Bereich.</p>`
          : `<p>Der Patient kann nun den Erstanmeldungs- und Anamnesebogen ausfüllen.</p>`
        }
      </body>
      </html>
    `;

    // Use the PHP relay to send email
    const relayUrl = "https://naturheilpraxis-rauch.de/api/mail-relay-v3-smtp.php";

    const relayResponse = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Secret": RELAY_SECRET,
      },
      body: JSON.stringify({
        to: notificationTo,
        subject,
        html: htmlBody,
        from_name: "Praxis-App Benachrichtigung",
        from_email: "anamnese@rauch-heilpraktiker.de",
      }),
    });

    await relayResponse.text();
    if (!relayResponse.ok) {
      console.error("[notify-existing-patient] relay failed");
      return new Response(
        JSON.stringify({ error: "Notification failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[notify-existing-patient] relay notification sent");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    console.error("[notify-existing-patient] request failed");
    return new Response(
      JSON.stringify({ error: "Notification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
