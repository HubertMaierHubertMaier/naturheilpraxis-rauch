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

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

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

type TherapySessionRow = {
  pseudonym_id: string | null;
  eingabe_daten: {
    symptome?: string | null;
    erkrankung?: string | null;
    belastungen?: string | null;
  } | null;
  notiz: string | null;
  created_at: string;
};

type PseudonymGroup = {
  pseudonym_id: string;
  sessions_count: number;
  last_session_at: string;
  first_session_at: string;
  latest_summary: string;
  latest_notiz: string | null;
};

function buildSummary(row: TherapySessionRow): string {
  return (
    row.eingabe_daten?.symptome?.slice(0, 100) ||
    row.eingabe_daten?.erkrankung?.slice(0, 100) ||
    row.eingabe_daten?.belastungen?.slice(0, 100) ||
    "—"
  );
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
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

    const rateLimitKey = `list-therapy-pseudonyms:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[list-therapy-pseudonyms] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await adminClient
      .from("therapy_sessions")
      .select("id, pseudonym_id, eingabe_daten, notiz, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Datenbankfehler");

    // Gruppieren nach pseudonym_id
    const groups = new Map<string, PseudonymGroup>();

    for (const row of (data ?? []) as TherapySessionRow[]) {
      if (!row.pseudonym_id) continue;

      const existing = groups.get(row.pseudonym_id);
      const summary = buildSummary(row);
      if (!existing) {
        groups.set(row.pseudonym_id, {
          pseudonym_id: row.pseudonym_id,
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
      a.last_session_at < b.last_session_at ? 1 : -1,
    );

    return new Response(JSON.stringify({ pseudonyms: list }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("[list-therapy-pseudonyms] request failed");
    return new Response(JSON.stringify({ error: "Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
