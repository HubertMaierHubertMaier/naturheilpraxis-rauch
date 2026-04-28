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

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Validate caller is admin via JWT in Authorization header
    let isAdmin = false;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token && token !== anonKey) {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (!userErr && userData?.user) {
        const { data: adminCheck } = await adminClient.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        isAdmin = !!adminCheck;
      } else {
        console.log("[get-patients] getUser failed:", userErr?.message);
      }
    } else {
      console.log("[get-patients] No user token (only anon or missing)");
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    console.error("[get-patients] Error:", error);
    return new Response(JSON.stringify({ error: "Ein Fehler ist aufgetreten." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
