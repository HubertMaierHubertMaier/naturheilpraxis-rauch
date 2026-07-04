import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const verifyCodeSchema = z.object({
  email: z.string()
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse zu lang")
    .transform(val => val.trim().toLowerCase()),
  code: z.string()
    .length(6, "Code muss 6 Ziffern haben")
    .regex(/^\d{6}$/, "Code muss aus 6 Ziffern bestehen"),
  type: z.enum(["login", "registration", "password_reset"], {
    errorMap: () => ({ message: "Ungültiger Anfrage-Typ" })
  }),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort zu lang")
    .optional(),
  newPassword: z.string()
    .min(8, "Neues Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort zu lang")
    .optional(),
});

function normalizePassword(value: string): string {
  return value.normalize("NFC").trim();
}

function generateBindingToken(): string {
  return crypto.randomUUID();
}

type VerifyCodeRequest = z.infer<typeof verifyCodeSchema>;

// Rate limiting for verification attempts (prevents brute force)
const verifyAttemptMap = new Map<string, { count: number; resetTime: number }>();
const VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_VERIFY_ATTEMPTS_PER_WINDOW = 10;

function checkVerifyRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = verifyAttemptMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    verifyAttemptMap.set(identifier, { count: 1, resetTime: now + VERIFY_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_VERIFY_ATTEMPTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

function cleanupVerifyAttemptMap() {
  const now = Date.now();
  for (const [key, value] of verifyAttemptMap.entries()) {
    if (now > value.resetTime) {
      verifyAttemptMap.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Periodic cleanup
  cleanupVerifyAttemptMap();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Ungültiges Anfrageformat" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const parseResult = verifyCodeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Ungültige Eingabe";
      console.error("Validation error: invalid verify-code request payload");
      return new Response(
        JSON.stringify({ error: firstError }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, code, type } = parseResult.data;
    const newPassword = parseResult.data.newPassword ? normalizePassword(parseResult.data.newPassword) : undefined;

    // Rate limiting check for verification attempts
    const rateLimitKey = `verify:${email}`;
    if (!checkVerifyRateLimit(rateLimitKey)) {
      console.warn("Verify rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "Zu viele Versuche. Bitte warten Sie eine Stunde." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (type === "registration") {
      // Resolve userId via profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("profile lookup error:", profileError);
        throw new Error("User verification failed");
      }

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ error: "Benutzer nicht gefunden" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find valid verification code
      const { data: verificationCode, error: codeError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("code", code)
        .eq("type", "registration")
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (codeError || !verificationCode) {
        return new Response(
          JSON.stringify({ error: "Ungültiger oder abgelaufener Code" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark code as used
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", verificationCode.id);

      const bindingToken = generateBindingToken();
      const { error: bindingError } = await supabase
        .from("two_factor_pending_bindings")
        .insert({
          user_id: profile.user_id,
          purpose: "registration",
          binding_token: bindingToken,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (bindingError) {
        throw bindingError;
      }

      // Confirm email
      const { error: confirmError } = await supabase.auth.admin.updateUserById(profile.user_id, {
        email_confirm: true,
      });

      if (confirmError) {
        throw confirmError;
      }

      console.log("User verified successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Registrierung erfolgreich",
          userId: profile.user_id,
          bindingToken,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (type === "login") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("profile lookup error:", profileError);
        throw new Error("User verification failed");
      }

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ error: "Benutzer nicht gefunden" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find valid verification code
      const { data: verificationCode, error: codeError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("code", code)
        .eq("type", "login")
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (codeError || !verificationCode) {
        return new Response(
          JSON.stringify({ error: "Ungültiger oder abgelaufener Code" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark code as used
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", verificationCode.id);

      const bindingToken = generateBindingToken();
      const { error: bindingError } = await supabase
        .from("two_factor_pending_bindings")
        .insert({
          user_id: profile.user_id,
          purpose: "login",
          binding_token: bindingToken,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (bindingError) {
        throw bindingError;
      }

      // Generate a magic link for sign-in
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email,
      });

      if (linkError) {
        throw linkError;
      }

      const token = linkData.properties.hashed_token;

      console.log("2FA verified successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "2FA erfolgreich verifiziert",
          token,
          userId: profile.user_id,
          bindingToken,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (type === "password_reset") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("profile lookup error:", profileError);
        throw new Error("User verification failed");
      }

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ error: "Benutzer nicht gefunden" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find valid verification code
      const { data: verificationCode, error: codeError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("code", code)
        .eq("type", "password_reset")
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (codeError || !verificationCode) {
        return new Response(
          JSON.stringify({ error: "Ungültiger oder abgelaufener Code" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Neues Passwort muss mindestens 8 Zeichen lang sein" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update password AND confirm email (in case user reset password before confirming registration)
      const { error: updateError } = await supabase.auth.admin.updateUserById(profile.user_id, {
        password: newPassword,
        email_confirm: true,
      });

      if (updateError) {
        throw updateError;
      }

      // Mark code as used only after the password was definitely accepted by Auth.
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", verificationCode.id);

      console.log("Password reset successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Passwort erfolgreich zurückgesetzt",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else {
      throw new Error("Invalid request type");
    }
  } catch (error: unknown) {
    console.error("Error verifying code:", error);
    // Return generic error message to prevent information leakage
    return new Response(
      JSON.stringify({ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
