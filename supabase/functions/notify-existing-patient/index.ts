import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;
const RELAY_SECRET = Deno.env.get("RELAY_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, patientType } = await req.json();

    if (!email || !patientType) {
      return new Response(
        JSON.stringify({ error: "Missing email or patientType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification email to the practice
    const notificationTo = "anamnese@rauch-heilpraktiker.de";
    const subject = patientType === "existing_patient"
      ? `Bestehender Patient möchte Zugang: ${email}`
      : `Neuer Patient registriert: ${email}`;

    const htmlBody = `
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #4a7c59;">${patientType === "existing_patient" ? "Bestehender Patient - Freischaltung erforderlich" : "Neue Patientenregistrierung"}</h2>
        <p>Ein ${patientType === "existing_patient" ? "bestehender" : "neuer"} Patient hat sich registriert:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 16px; font-weight: bold; background: #f0f7f0;">E-Mail:</td>
            <td style="padding: 8px 16px; background: #f0f7f0;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; font-weight: bold;">Typ:</td>
            <td style="padding: 8px 16px;">${patientType === "existing_patient" ? "Bestehender Patient" : "Neupatient"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; font-weight: bold; background: #f0f7f0;">Datum:</td>
            <td style="padding: 8px 16px; background: #f0f7f0;">${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td>
          </tr>
        </table>
        ${patientType === "existing_patient" 
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

    const relayResult = await relayResponse.text();
    console.log("Relay response:", relayResult);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
