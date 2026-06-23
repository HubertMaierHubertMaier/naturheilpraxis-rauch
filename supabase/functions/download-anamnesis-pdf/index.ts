import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  document?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Bitte zuerst anmelden." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user?.id || !user.email) {
      return json({ error: "Bitte erneut anmelden." }, 401);
    }

    const email = user.email.trim().toLowerCase();
    const { data: accessRow, error: accessError } = await adminClient
      .from("patient_access")
      .select("anamnese_download")
      .eq("email", email)
      .maybeSingle();

    if (accessError) {
      return json({ error: "Freischaltung konnte nicht geprüft werden." }, 500);
    }

    if (accessRow?.anamnese_download !== true) {
      return json(
        { error: "PDF-Download ist für diese E-Mail-Adresse noch nicht freigeschaltet." },
        403
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (body.document && body.document !== "anamnesebogen") {
      return json({ error: "Unbekanntes Dokument." }, 400);
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from("anamnesis-pdfs")
      .createSignedUrl("blanko/anamnesebogen-blanko.pdf", 300, {
        download: "anamnesebogen-blanko.pdf",
      });

    if (signedError || !signed?.signedUrl) {
      return json({ error: "PDF-Link konnte nicht erstellt werden." }, 500);
    }

    return json({ signedUrl: signed.signedUrl });
  } catch {
    return json({ error: "Download momentan nicht möglich." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}