import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dev-mode, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check if user is admin via auth header
    let isAdmin = false;
    const authHeader = req.headers.get("authorization");
    
    if (authHeader?.startsWith("Bearer ") && authHeader !== `Bearer ${anonKey}`) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: adminCheck } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        isAdmin = !!adminCheck;
      }
    }

    // Dev mode bypass: only allowed when Origin header matches non-production domains
    const devMode = req.headers.get("x-dev-mode") === "true";
    let devAllowed = false;
    if (devMode) {
      const origin = req.headers.get("origin") || "";
      devAllowed = origin.includes("localhost") || origin.includes("preview") || origin.includes("lovableproject.com");
      if (!devAllowed) {
        console.warn(`[get-patients] dev-mode rejected for origin: ${origin}`);
      }
    }
    
    if (!isAdmin && !devAllowed) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceKey);

    const [profilesResult, loginCountsResult, submissionsResult] = await Promise.all([
      adminClient.from("profiles").select("*").order("created_at", { ascending: false }),
      adminClient.from("audit_log").select("user_id, action").eq("action", "login"),
      adminClient.from("anamnesis_submissions").select("id, user_id").order("submitted_at", { ascending: false }),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const countMap: Record<string, number> = {};
    (loginCountsResult.data || []).forEach((entry: any) => {
      countMap[entry.user_id] = (countMap[entry.user_id] || 0) + 1;
    });

    // Map latest submission per user
    const submissionMap: Record<string, string> = {};
    (submissionsResult.data || []).forEach((s: any) => {
      if (!submissionMap[s.user_id]) submissionMap[s.user_id] = s.id;
    });

    const patients = (profilesResult.data || []).map((p: any) => ({
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      street: p.street,
      postal_code: p.postal_code,
      city: p.city,
      date_of_birth: p.date_of_birth,
      phone: p.phone,
      created_at: p.created_at,
      is_verified_patient: p.is_verified_patient || false,
      login_count: countMap[p.user_id] || 0,
      submission_id: submissionMap[p.user_id] || null,
    }));

    return new Response(JSON.stringify({ patients }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in get-patients:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
