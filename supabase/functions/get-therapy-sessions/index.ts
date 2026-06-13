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

type DocumentInventoryItem = {
  name: string;
  datum?: string;
  pages?: number;
  chars?: number;
  archivePath?: string;
  loadedAt?: string;
  source: string;
  location: "current_draft" | "snapshot" | "event_log" | "analysis_meta";
  note?: string;
};

function extractDocumentInventoryFromText(text: unknown, source: string, location: DocumentInventoryItem["location"], loadedAt?: string): DocumentInventoryItem[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const items: DocumentInventoryItem[] = [];
  const lines = text.split(/\n+/);
  let contextDate = "";
  for (const line of lines) {
    const group = line.match(/^===\s*📎\s*(.+?)(?:\s*·\s*([^=]+?))?\s*===/);
    if (group?.[2]) contextDate = group[2].trim();
    const file = line.match(/^===\s*📄\s*(.+?)(?:\s*\((\d+)\s*S\.?\))?\s*===/);
    if (file?.[1]) {
      items.push({
        name: file[1].trim(),
        datum: contextDate || undefined,
        pages: file[2] ? Number(file[2]) : undefined,
        loadedAt,
        source,
        location,
      });
    }
  }
  return items;
}

function dedupeDocumentInventory(items: DocumentInventoryItem[]): DocumentInventoryItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.name, item.archivePath || "", item.datum || "", item.location].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

async function buildDocumentInventory(adminClient: any, pseudonymId: string, draftInput: Record<string, unknown>): Promise<DocumentInventoryItem[]> {
  const items: DocumentInventoryItem[] = [];
  for (const key of ["sonstigeUntersuchungen", "arztbericht", "laborKomplett", "metatronHeel", "perplexityAnalyse"]) {
    items.push(...extractDocumentInventoryFromText(draftInput[key], `Aktueller Auto-Entwurf · ${key}`, "current_draft"));
  }

  const { data: snapshot } = await adminClient
    .from("patient_snapshot")
    .select("data,updated_at")
    .eq("pseudonym_id", pseudonymId)
    .maybeSingle();
  const snapshotData = snapshot?.data && typeof snapshot.data === "object" ? snapshot.data as Record<string, unknown> : {};
  for (const key of ["sonstigeUntersuchungen", "arztbericht", "laborKomplett", "metatronHeel", "perplexityAnalyse"]) {
    items.push(...extractDocumentInventoryFromText(snapshotData[key], `Patienten-Snapshot · ${key}`, "snapshot", snapshot?.updated_at));
  }

  const { data: eventRows } = await adminClient
    .from("therapy_sessions")
    .select("created_at,befund_meta")
    .eq("pseudonym_id", pseudonymId)
    .eq("kind", "event_log")
    .order("created_at", { ascending: false })
    .limit(80);
  for (const row of Array.isArray(eventRows) ? eventRows : []) {
    const meta = row?.befund_meta || {};
    const eventType = String(meta.event_type || "");
    if (!["documents_uploaded", "documents_saved"].includes(eventType) || !Array.isArray(meta.files)) continue;
    for (const file of meta.files) {
      if (!file?.name) continue;
      items.push({
        name: String(file.name),
        pages: typeof file.pages === "number" ? file.pages : undefined,
        chars: typeof file.chars === "number" ? file.chars : undefined,
        archivePath: typeof file.archivePath === "string" ? file.archivePath : undefined,
        loadedAt: row.created_at,
        source: eventType === "documents_uploaded" ? "Dokument-Upload-Event" : "Archivierungs-Event",
        location: "event_log",
      });
    }
  }

  const { data: analysisRows } = await adminClient
    .from("therapy_sessions")
    .select("created_at,befund_meta")
    .eq("pseudonym_id", pseudonymId)
    .eq("kind", "befund_auswertung")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const row of Array.isArray(analysisRows) ? analysisRows : []) {
    const summary = row?.befund_meta?.source_summary;
    if (!Array.isArray(summary)) continue;
    for (const source of summary) {
      const label = String(source?.label || "").trim();
      if (!label) continue;
      items.push({
        name: label,
        chars: typeof source.chars === "number" ? source.chars : undefined,
        loadedAt: row.created_at,
        source: "Befund-Auswertung · Quellenliste",
        location: "analysis_meta",
        note: "Quellenblock, nicht zwingend Originaldateiname",
      });
    }
  }

  return dedupeDocumentInventory(items);
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
    const draftPseudonymId = (body?.draft_pseudonym_id ?? "").toString().trim();
    const snapshotPseudonymId = (body?.snapshot_pseudonym_id ?? "").toString().trim();
    const sessionId = (body?.session_id ?? "").toString().trim();

    // ----- Mode B: single-row safe fetch (lazy load on expand / Befund / Empfehlung) -----
    if (sessionId) {
      const includeBefundHtml = body?.include_befund_html === true;
      const { data: row, error } = await adminClient.rpc("get_therapy_session_safe_detail", {
        _session_id: sessionId,
        _include_befund_html: includeBefundHtml,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ session: row ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- Mode C1: latest full autosave draft for restoring the working form -----
    // This is intentionally separate from the lightweight history list: the list must
    // never pull large JSON payloads, but restoring one current draft by pseudonym is safe.
    if (draftPseudonymId) {
      const { data: draft, error } = await adminClient
        .from("therapy_sessions")
        .select("id,pseudonym_id,eingabe_daten,created_at,updated_at,kind,notiz")
        .eq("pseudonym_id", draftPseudonymId)
        .eq("notiz", "Auto-Sicherung der Eingaben")
        .eq("empfehlung", "Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      return new Response(JSON.stringify({ draft: draft ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- Mode C: compact latest-filled patient snapshot for restoring form fields -----
    if (snapshotPseudonymId) {
      const { data: snapshot, error } = await adminClient.rpc("get_therapy_patient_safe_snapshot", {
        _pseudonym_id: snapshotPseudonymId,
        _max_rows: 300,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ snapshot: snapshot ?? {} }), {
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

    // ----- Mode A: lightweight list with safe Zusatzangaben -----
    // Important: do NOT select the whole eingabe_daten or befund_html here.
    // Some rows contain embedded document payloads that can exhaust the worker
    // before TypeScript-side trimming can run.
    const { data: slimRows, error } = await adminClient.rpc("get_therapy_sessions_safe_list", {
      _pseudonym_id: pseudonymId,
      _max_rows: 500,
    });

    if (error) throw error;

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
