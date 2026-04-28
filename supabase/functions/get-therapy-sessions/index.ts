import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin check
    let isAdmin = false;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && authHeader !== `Bearer ${anonKey}`) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: adminCheck } = await userClient.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        isAdmin = !!adminCheck;
      }
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const pseudonymId = (body?.pseudonym_id ?? "").toString().trim();

    if (!pseudonymId) {
      return new Response(JSON.stringify({ sessions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data, error } = await adminClient
      .from("therapy_sessions")
      .select("*")
      .eq("pseudonym_id", pseudonymId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ sessions: data ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[get-therapy-sessions] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
