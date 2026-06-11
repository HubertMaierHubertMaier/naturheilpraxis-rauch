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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.code, record.details, record.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return parts.join(" | ");
  }
  return "Fehler";
}

Deno.serve(async (req) => {
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

    const rateLimitKey = `get-therapy-sessions:admin:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[get-therapy-sessions] Admin session access rate limit exceeded");
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const pseudonymId = (body?.pseudonym_id ?? "").toString().trim();
    const sessionId = (body?.session_id ?? "").toString().trim();

    // ----- Mode B: single-row full fetch (lazy load on expand / Befund / Empfehlung) -----
    if (sessionId) {
      const { data: row, error } = await adminClient
        .from("therapy_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ session: row ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pseudonymId) {
      return new Response(JSON.stringify({ sessions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- Mode A: slim list -----
    // Avoid worker memory blow-ups: project eingabe_daten to only the keys
    // actually rendered in the list, drop befund_html entirely (lazy-loaded),
    // and truncate empfehlung. Full data is fetched per-row via session_id.
    const SLIM_KEYS = [
      "symptome", "erkrankung", "belastungen",
      "laborKomplett", "laborErhoeht", "laborErniedrigt", "laborDatum",
      "stuhlbefund", "arztbericht", "arztberichtDatum",
      "metatronHeel", "autoSavedDraft",
    ];

    const PAGE_SIZE = 50;
    const MAX_ROWS = 200;
    const slimRows: Array<Record<string, unknown>> = [];

    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const { data: page, error } = await adminClient
        .from("therapy_sessions")
        .select(
          "id, pseudonym_id, eingabe_daten, empfehlung, notiz, created_at, updated_at, kind, befund_meta, version_number, version_label, parent_session_id",
        )
        .eq("pseudonym_id", pseudonymId)
        .neq("kind", "befund_checkpoint")
        .neq("kind", "quarantine_patient_mismatch")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!page || page.length === 0) break;

      for (const r of page as Array<Record<string, unknown>>) {
        const raw = (r.eingabe_daten ?? {}) as Record<string, unknown>;
        const slim: Record<string, unknown> = {};
        for (const k of SLIM_KEYS) if (raw[k] !== undefined) slim[k] = raw[k];

        const empfehlung = typeof r.empfehlung === "string" ? r.empfehlung : "";
        slimRows.push({
          ...r,
          eingabe_daten: slim,
          empfehlung: empfehlung.length > 400 ? empfehlung.slice(0, 400) + "…" : empfehlung,
          has_empfehlung: empfehlung.length > 0,
          is_truncated: true,
          has_befund_html: false,
        });
      }
      if (page.length < PAGE_SIZE) break;
    }

    // Proxy flag: kind === 'befund_auswertung' is reliably set when befund_html exists.
    for (const r of slimRows) {
      r.has_befund_html = r.kind === "befund_auswertung";
    }


    return new Response(JSON.stringify({ sessions: slimRows }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[get-therapy-sessions] Session lookup failed:", getErrorMessage(error));
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
