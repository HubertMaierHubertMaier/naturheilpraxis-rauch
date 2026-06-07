// Edge Function: enrich-wiki-tags
// Schlägt fehlende Tags für Wiki-Einträge per Lovable AI vor.
// Liest Title + Category + Content (gekürzt), extrahiert Wirkstoffe,
// Indikationen, Stoffklassen, lateinische Erreger.
// Bewahrt vorhandene Tags. Speichert NICHT direkt – nur Vorschläge zurück.

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
const RATE_LIMIT_MAX_REQUESTS = 20;

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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type UserRoleRow = {
  role?: string | null;
};

type EnrichWikiTagsRequestBody = {
  mode?: unknown;
  ids?: unknown;
};

type KnowledgeBaseRow = {
  id: string;
  title: string | null;
  category: string | null;
  tags: string[] | null;
  content: string | null;
};

type WikiTagUpdate = {
  id: string;
  tags: string[];
};

type EnrichWikiTagsResult = {
  id: string;
  title: string | null;
  category: string | null;
  existing: string[];
  suggested?: string[];
  added?: string[];
  merged?: string[];
  error?: string;
};

type AiToolCall = {
  function?: {
    arguments?: string;
  };
};

type AiMessageResponse = {
  choices?: Array<{
    message?: {
      tool_calls?: AiToolCall[];
    };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isWikiTagUpdate(value: unknown): value is WikiTagUpdate {
  return isRecord(value) && typeof value.id === "string" && isStringArray(value.tags);
}

function toStringArray(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}

const SYSTEM = `Du bist Tag-Extraktor für eine naturheilkundliche Wissensdatenbank.
Aus Titel, Kategorie und Inhalt extrahierst du präzise Schlagworte, die für die spätere KI-Suche & Therapie-Empfehlung nützlich sind.

REGELN:
- 5–20 Tags pro Eintrag, jeder Tag 1–3 Wörter, KEINE Sätze.
- Enthalte ALLE: Wirkstoffe / Inhaltsstoffe (auch lateinisch, z.B. "Bifidobacterium bifidum"), Indikationen / Symptome, Stoffklassen ("Probiotika", "Homotoxikologie", "Komplexmittel", "Phytotherapie", "Orthomolekular", "Spagyrik", "Isopathie"), Organbezug ("Darm", "Leber", "Lymphsystem"), Produktlinie wenn erkennbar (Vitaplace, Heel, Sanum, NutraMedix, CERES).
- Bei Probiotika: ALLE enthaltenen Bakterienstämme als Einzeltags ("Lactobacillus acidophilus", "Bifidobacterium lactis" etc.) UND Oberbegriff ("Probiotika", "Mikrobiom").
- Bei Homotoxikologie-Mitteln: Wirkungsbereich ("Schmerz", "Entzündung", "Lymphstau", "Schlaf") + "Homotoxikologie" + "Komplexmittel".
- Keine Dosierungen, keine Markenzusätze wie "Kapseln"/"Pulver" als eigenen Tag.
- Deutsche Begriffe bevorzugt, lateinische Nomenklatur ergänzend.

Antworte AUSSCHLIESSLICH via Tool-Call.`;

async function callAI(title: string, category: string, content: string): Promise<string[]> {
  const trimmed = content.length > 6000 ? content.slice(0, 6000) : content;
  const prompt = `TITEL: ${title}\nKATEGORIE: ${category}\n\nINHALT:\n${trimmed}`;

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "set_tags",
          description: "Liefert die extrahierten Tags zurück.",
          parameters: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Schlagworte (5–20).",
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "set_tags" } },
  };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("KI-Fehler");
  }

  const json = (await response.json()) as AiMessageResponse;
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("KI-Fehler");

  const args: unknown = JSON.parse(toolCall.function.arguments);
  const tags = isRecord(args) && isStringArray(args.tags) ? args.tags : [];
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 1 && tag.length <= 60);
}

function mergeTags(existing: string[], suggested: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...existing, ...suggested]) {
    const key = norm(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
  }
  const existingNorm = new Set(existing.map(norm));
  const added = suggested.filter((tag) => !existingNorm.has(norm(tag)));
  return { merged, added };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userResult } = await userClient.auth.getUser();
    if (!userResult?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userResult.user.id);
    const roles = (roleRows ?? []) as UserRoleRow[];
    if (!roles.some((roleRow) => roleRow.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitKey = `enrich-wiki-tags:admin:${userResult.user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn("[enrich-wiki-tags] admin rate limit exceeded");
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, ids } = (await req.json()) as EnrichWikiTagsRequestBody;
    // mode: "preview" -> nur Vorschläge | "apply" -> mit übergebenen ids speichern (tags aus Body)
    if (mode === "apply") {
      const updates = Array.isArray(ids) ? ids.filter(isWikiTagUpdate) : [];
      let ok = 0;
      for (const update of updates) {
        const { error: updateError } = await admin
          .from("admin_knowledge_base")
          .update({ tags: update.tags })
          .eq("id", update.id);
        if (!updateError) ok++;
      }
      return new Response(JSON.stringify({ updated: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // preview
    const targetIds = isStringArray(ids) && ids.length > 0 ? ids : [];
    let query = admin.from("admin_knowledge_base").select("id,title,category,tags,content");
    if (targetIds.length > 0) query = query.in("id", targetIds);
    const { data: rawRows, error: queryError } = await query;
    if (queryError) throw new Error("Datenbankfehler");

    const rows = (rawRows ?? []) as KnowledgeBaseRow[];
    const results: EnrichWikiTagsResult[] = [];
    for (const row of rows) {
      try {
        const suggested = await callAI(row.title ?? "", row.category ?? "", row.content ?? "");
        const existing = toStringArray(row.tags);
        const { merged, added } = mergeTags(existing, suggested);
        results.push({
          id: row.id,
          title: row.title,
          category: row.category,
          existing,
          suggested,
          added,
          merged,
        });
        // sanftes Throttling
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch {
        results.push({
          id: row.id,
          title: row.title,
          category: row.category,
          existing: toStringArray(row.tags),
          error: "KI-Fehler",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
