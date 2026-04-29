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

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader === `Bearer ${anonKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleError } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await adminClient
      .from("therapy_sessions")
      .select("id, pseudonym_id, eingabe_daten, notiz, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Gruppieren nach pseudonym_id
    const groups = new Map<string, {
      pseudonym_id: string;
      sessions_count: number;
      last_session_at: string;
      first_session_at: string;
      latest_summary: string;
      latest_notiz: string | null;
    }>();

    for (const row of (data ?? []) as any[]) {
      const pid = row.pseudonym_id;
      const existing = groups.get(pid);
      const summary =
        row.eingabe_daten?.symptome?.slice(0, 100) ||
        row.eingabe_daten?.erkrankung?.slice(0, 100) ||
        row.eingabe_daten?.belastungen?.slice(0, 100) ||
        "—";
      if (!existing) {
        groups.set(pid, {
          pseudonym_id: pid,
          sessions_count: 1,
          last_session_at: row.created_at,
          first_session_at: row.created_at,
          latest_summary: summary,
          latest_notiz: row.notiz,
        });
      } else {
        existing.sessions_count += 1;
        if (row.created_at < existing.first_session_at) existing.first_session_at = row.created_at;
        // data is sorted desc, so first one wins as "latest"
      }
    }

    const list = Array.from(groups.values()).sort((a, b) =>
      a.last_session_at < b.last_session_at ? 1 : -1
    );

    return new Response(JSON.stringify({ pseudonyms: list }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[list-therapy-pseudonyms] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
