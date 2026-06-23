import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const verificationRequestSchema = z.object({
  email: z.string()
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse zu lang")
    .transform(val => val.trim().toLowerCase()),
  type: z.enum(["login", "registration", "password_reset"], {
    errorMap: () => ({ message: "Ungültiger Anfrage-Typ" })
  }),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort zu lang")
    .optional(),
  userId: z.string()
    .uuid("Ungültige Benutzer-ID")
    .optional(),
  turnstileToken: z.string().min(10).max(4096).optional(),
});

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    return false;
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = await res.json();
    if (!json.success) {
      console.warn("Turnstile verify failed", json["error-codes"]);
    }
    return !!json.success;
  } catch (e) {
    console.error("Turnstile verify error", e);
    return false;
  }
}

type VerificationRequest = z.infer<typeof verificationRequestSchema>;

// Simple in-memory rate limiting (per function instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email: string, code: string, type: "login" | "registration" | "password_reset"): Promise<void> {
  let subject: string;
  let bodyText: string;

  switch (type) {
    case "registration":
      subject = "Ihr Bestätigungscode für die Registrierung - Naturheilpraxis Rauch";
      bodyText = "vielen Dank für Ihre Registrierung. Bitte verwenden Sie den folgenden Code, um Ihre E-Mail-Adresse zu bestätigen:";
      break;
    case "login":
      subject = "Ihr Anmeldecode (2FA) - Naturheilpraxis Rauch";
      bodyText = "um Ihre Anmeldung abzuschließen, verwenden Sie bitte den folgenden Bestätigungscode:";
      break;
    case "password_reset":
      subject = "Passwort zurücksetzen - Naturheilpraxis Rauch";
      bodyText = "Sie haben angefordert, Ihr Passwort zurückzusetzen. Verwenden Sie den folgenden Code:";
      break;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4a7c59; }
        .code-box { background: #f5f5f5; border: 2px solid #4a7c59; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4a7c59; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #4a7c59; margin: 0;">Naturheilpraxis Rauch</h1>
        </div>
        
        <p>Guten Tag,</p>
        
        <p>${bodyText}</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        
        <p>Dieser Code ist <strong>10 Minuten</strong> gültig.</p>
        
        <p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
        
        <div class="footer">
          <p>Mit freundlichen Grüßen,<br>Ihre Naturheilpraxis Rauch</p>
          <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`[SMTP] sending ${type} verification code`);
  await sendEmail({ to: email, subject, html: htmlContent, context: `2fa_${type}` });
}

const handler = async (req: Request): Promise<Response> => {
  cleanupRateLimitMap();
  
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
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const parseResult = verificationRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Ungültige Eingabe";
      console.error("Validation error: invalid verification-code request payload");
      return new Response(
        JSON.stringify({ error: firstError }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, type, password, userId: providedUserId, turnstileToken } = parseResult.data;

    // Require Turnstile for registration to block bot account floods
    if (type === "registration") {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: "Bot-Schutz fehlt. Bitte Captcha abschließen." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const ok = await verifyTurnstile(turnstileToken, clientIp);
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "Bot-Schutz-Prüfung fehlgeschlagen. Bitte Captcha erneut lösen." }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const rateLimitKey = `${email}:${type}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("Rate limit exceeded for verification-code request");
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie 15 Minuten." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("profile lookup error:", profileError);
      throw new Error("User verification failed");
    }

    const existingUserId = profile?.user_id || null;
    let userId: string;

    if (type === "login") {
      userId = providedUserId || existingUserId || "";
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Benutzer nicht gefunden. Bitte registrieren Sie sich zuerst." }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else if (type === "registration") {
      if (!password || password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Passwort muss mindestens 8 Zeichen lang sein" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if a confirmed user already exists (has profile = fully registered)
      if (existingUserId) {
        // Check if the auth user's email is confirmed
        const { data: authUser } = await supabase.auth.admin.getUserById(existingUserId);
        if (authUser?.user?.email_confirmed_at) {
          return new Response(
            JSON.stringify({ error: "Diese E-Mail-Adresse ist bereits registriert." }),
            { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // Unconfirmed user with profile – clean up and re-create
        console.log("Cleaning up unconfirmed user for re-registration");
        await supabase.from("verification_codes").delete().eq("user_id", existingUserId);
        await supabase.from("profiles").delete().eq("user_id", existingUserId);
        await supabase.from("user_roles").delete().eq("user_id", existingUserId);
        await supabase.auth.admin.deleteUser(existingUserId);
      }

      // Try to create user
      let createResult = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

      // If user exists in auth but not in profiles (ghost account), clean up and retry
      if (createResult.error && (createResult.error.message?.toLowerCase().includes("already") || 
          createResult.error.message?.toLowerCase().includes("registered"))) {
        console.log("Ghost auth user detected, attempting cleanup...");
        // List users by email to find the ghost
        const { data: listData } = await supabase.auth.admin.listUsers();
        const ghostUser = listData?.users?.find(u => u.email === email);
        if (ghostUser && !ghostUser.email_confirmed_at) {
          await supabase.from("verification_codes").delete().eq("user_id", ghostUser.id);
          await supabase.from("profiles").delete().eq("user_id", ghostUser.id);
          await supabase.from("user_roles").delete().eq("user_id", ghostUser.id);
          await supabase.auth.admin.deleteUser(ghostUser.id);
          // Retry creation
          createResult = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
          });
        } else if (ghostUser?.email_confirmed_at) {
          return new Response(
            JSON.stringify({ error: "Diese E-Mail-Adresse ist bereits registriert." }),
            { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      if (createResult.error || !createResult.data?.user?.id) {
        console.error("createUser error:", createResult.error);
        throw new Error("Registration failed");
      }

      userId = createResult.data.user.id;
    } else if (type === "password_reset") {
      if (!existingUserId) {
        return new Response(
          JSON.stringify({ success: true, message: "Falls ein Konto existiert, wurde ein Code gesendet." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      userId = existingUserId;
    } else {
      throw new Error("Invalid request type");
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await supabase
      .from("verification_codes")
      .delete()
      .eq("user_id", userId)
      .eq("type", type)
      .eq("used", false);

    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        user_id: userId,
        code,
        type,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("insert verification_codes error:", insertError);
      throw insertError;
    }

    await sendVerificationEmail(email, code, type);

    console.log(`Verification code sent for ${type}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Bestätigungscode wurde gesendet",
        userId,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error requesting verification code:", error);
    return new Response(
      JSON.stringify({ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
