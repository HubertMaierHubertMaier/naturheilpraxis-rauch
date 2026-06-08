import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

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
      url.hostname.endsWith(".lovableproject.com") ||
      url.hostname.endsWith(".lovable.app")
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

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  phone: string | null;
  created_at: string | null;
  is_verified_patient: boolean | null;
};

type AuditLoginRow = {
  user_id: string | null;
  action: string | null;
};

type AnamnesisSubmissionRow = {
  id: string;
  user_id: string | null;
};

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function checkRateLimit(key: string, now = Date.now()): boolean {
  for (const [entryKey, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(entryKey);
    }
  }

  const current = rateLimitMap.get(key);
  if (!current) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Validate caller is admin via JWT in Authorization header
    let isAdmin = false;
    let adminUserId: string | null = null;
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
        adminUserId = isAdmin ? userData.user.id : null;
      } else {
        console.log("[get-patients] getUser failed");
      }
    } else {
      console.log("[get-patients] No user token (only anon or missing)");
    }

    if (!isAdmin || !adminUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitKey = `get-patients:admin:${adminUserId}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[get-patients] Admin patient-list rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
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
    ((loginCountsResult.data || []) as AuditLoginRow[]).forEach((entry) => {
      if (entry.user_id) {
        countMap[entry.user_id] = (countMap[entry.user_id] || 0) + 1;
      }
    });

    // Map latest submission per user
    const submissionMap: Record<string, string> = {};
    ((submissionsResult.data || []) as AnamnesisSubmissionRow[]).forEach((submission) => {
      if (submission.user_id && !submissionMap[submission.user_id]) {
        submissionMap[submission.user_id] = submission.id;
      }
    });

    const patients = ((profilesResult.data || []) as ProfileRow[]).map((profile) => ({
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      street: profile.street,
      postal_code: profile.postal_code,
      city: profile.city,
      date_of_birth: profile.date_of_birth,
      phone: profile.phone,
      created_at: profile.created_at,
      is_verified_patient: profile.is_verified_patient || false,
      login_count: countMap[profile.user_id] || 0,
      submission_id: submissionMap[profile.user_id] || null,
    }));

    return new Response(JSON.stringify({ patients }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error: unknown) {
    console.error("[get-patients] Request handling failed");
    return new Response(JSON.stringify({ error: "Ein Fehler ist aufgetreten." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
