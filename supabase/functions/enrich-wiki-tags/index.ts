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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function callAI(title: string, category: string, content: string) {
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

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const call = j.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("Kein Tool-Call zurück");
  const args = JSON.parse(call.function.arguments || "{}");
  const tags: string[] = Array.isArray(args.tags) ? args.tags : [];
  return tags
    .map((t) => String(t).trim())
    .filter((t) => t.length > 1 && t.length <= 60);
}

function mergeTags(existing: string[], suggested: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const t of [...(existing || []), ...suggested]) {
    const k = norm(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(t);
  }
  const existingNorm = new Set((existing || []).map(norm));
  const added = suggested.filter((t) => !existingNorm.has(norm(t)));
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
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", ures.user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, ids } = await req.json();
    // mode: "preview" -> nur Vorschläge | "apply" -> mit übergebenen ids speichern (tags aus Body)
    if (mode === "apply") {
      const updates: { id: string; tags: string[] }[] = ids;
      let ok = 0;
      for (const u of updates) {
        const { error } = await admin
          .from("admin_knowledge_base")
          .update({ tags: u.tags })
          .eq("id", u.id);
        if (!error) ok++;
      }
      return new Response(JSON.stringify({ updated: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // preview
    const targetIds: string[] = Array.isArray(ids) && ids.length > 0 ? ids : [];
    let q = admin.from("admin_knowledge_base").select("id,title,category,tags,content");
    if (targetIds.length > 0) q = q.in("id", targetIds);
    const { data: rows, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const row of rows || []) {
      try {
        const suggested = await callAI(row.title, row.category, row.content || "");
        const { merged, added } = mergeTags(row.tags || [], suggested);
        results.push({
          id: row.id,
          title: row.title,
          category: row.category,
          existing: row.tags || [],
          suggested,
          added,
          merged,
        });
        // sanftes Throttling
        await new Promise((r) => setTimeout(r, 250));
      } catch (e) {
        results.push({
          id: row.id,
          title: row.title,
          category: row.category,
          existing: row.tags || [],
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
