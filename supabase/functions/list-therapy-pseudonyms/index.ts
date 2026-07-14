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
      ["5173", "4173", "5174", "4174", "8080"].includes(url.port);

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
  kind: string | null;
  eingabe_daten: {
    autoSavedDraft?: boolean | null;
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
  orders_count?: number;
  order_numbers?: string[];
  mannayan_orders?: MannayanOrderSummary[];
};

type MannayanOrderSummary = {
  order_number: string;
  created_at: string;
  total_eur: number | null;
  items_count: number;
  items_preview: string[];
};


function buildSummary(row: TherapySessionRow): string {
  return (
    row.eingabe_daten?.symptome?.slice(0, 100) ||
    row.eingabe_daten?.erkrankung?.slice(0, 100) ||
    row.eingabe_daten?.belastungen?.slice(0, 100) ||
    "—"
  );
}

function buildOrderSummary(o: {
  order_number: string | null;
  created_at: string;
  total_eur: number | null;
  items: unknown;
}): MannayanOrderSummary {
  const items = Array.isArray(o.items) ? o.items : [];
  const itemNames = items
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      const quantity = Number(row.quantity || 0);
      const amount = Number.isFinite(quantity) && quantity > 0 ? `${quantity}× ` : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const sku = typeof row.sku === "string" ? row.sku.trim() : "";
      return name || sku ? `${amount}${name || sku}` : "";
    })
    .filter(Boolean)
    .slice(0, 8);

  return {
    order_number: o.order_number ?? "—",
    created_at: o.created_at,
    total_eur: typeof o.total_eur === "number" ? o.total_eur : null,
    items_count: items.length,
    items_preview: itemNames,
  };
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

    const [therapyRes, ordersRes] = await Promise.all([
      adminClient
        .from("therapy_sessions")
        .select("id, pseudonym_id, kind, eingabe_daten, notiz, created_at, updated_at")
        .order("created_at", { ascending: false }),
      adminClient
        .from("mannayan_orders")
        .select("pseudonym_id, patient_label, order_number, created_at, total_eur, items")
        .order("created_at", { ascending: false }),
    ]);
    if (therapyRes.error) throw new Error("Datenbankfehler");
    if (ordersRes.error) throw new Error("Datenbankfehler");

    // Gruppieren nach pseudonym_id
    const groups = new Map<string, PseudonymGroup>();

    for (const row of (therapyRes.data ?? []) as TherapySessionRow[]) {
      if (!row.pseudonym_id) continue;
      if (row.eingabe_daten?.autoSavedDraft) continue;
      if (["therapy_candidate_draft", "event_log", "befund_checkpoint", "quarantine_patient_mismatch", "befund_auswertung", "hp_therapy_check"].includes(row.kind || "")) continue;

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

    // Mannayan-Bestellungen einklinken (auch Pseudonyme ohne Therapie-Session)
    const PSEUDO_RE = /P-\d{4}-\d{4}/;
    for (const o of (ordersRes.data ?? []) as Array<{ pseudonym_id: string | null; patient_label: string | null; order_number: string | null; created_at: string; total_eur: number | null; items: unknown }>) {
      const pid = o.pseudonym_id || (o.patient_label?.match(PSEUDO_RE)?.[0] ?? null);
      if (!pid) continue;
      const orderSummary = buildOrderSummary(o);

      const existing = groups.get(pid);
      if (!existing) {
        groups.set(pid, {
          pseudonym_id: pid,
          sessions_count: 0,
          last_session_at: o.created_at,
          first_session_at: o.created_at,
          latest_summary: `Nur Mannayan-Bestellung (${o.order_number ?? "—"})`,
          latest_notiz: null,
          orders_count: 1,
          order_numbers: o.order_number ? [o.order_number] : [],
          mannayan_orders: [orderSummary],
        });
      } else {
        existing.orders_count = (existing.orders_count ?? 0) + 1;
        if (o.order_number) {
          existing.order_numbers = [...(existing.order_numbers ?? []), o.order_number];
        }
        existing.mannayan_orders = [...(existing.mannayan_orders ?? []), orderSummary];
        if (o.created_at < existing.first_session_at) existing.first_session_at = o.created_at;
        if (o.created_at > existing.last_session_at) existing.last_session_at = o.created_at;
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
