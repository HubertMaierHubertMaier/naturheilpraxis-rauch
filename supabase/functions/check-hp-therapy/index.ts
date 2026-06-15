// Sinnhaftigkeits-Check für die EIGENE Heilpraktiker-Therapie von Peter Rauch.
// Prüft den eingegebenen HP-Therapieplan gegen Symptome/Pathogene/Diagnosen/Labor/Medikamente.
// HP-freundlich: Bioresonanz/Frequenz/Phyto/Orthomolekular/EAV/NLS gleichrangig, keine Pharma-Bias-Floskeln.
// Nur für Admins. KI: Lovable AI Gateway (Gemini Flash, optional Pro).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

function checkRateLimit(key: string, now = Date.now()): boolean {
  for (const [k, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) rateLimitMap.delete(k);
  }
  const cur = rateLimitMap.get(key);
  if (!cur) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  cur.count += 1;
  return true;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mdToHtml(md: string): string {
  // Sehr leichter Markdown→HTML-Renderer (Headings, Listen, Bold, Italic, Tabellen, Absätze)
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHeaderDone = false;

  const flush = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
    if (inTable) { html += "</tbody></table>"; inTable = false; tableHeaderDone = false; }
  };

  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) { flush(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) { flush(); html += "<ul>"; inUl = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { flush(); html += "<ol>"; inOl = true; }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      if (!inTable) { flush(); html += "<table><thead>"; inTable = true; tableHeaderDone = false; }
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (/^[-:\s|]+$/.test(line.replace(/^\||\|$/g, ""))) {
        if (!tableHeaderDone) { html += "</thead><tbody>"; tableHeaderDone = true; }
        continue;
      }
      const tag = tableHeaderDone ? "td" : "th";
      html += "<tr>" + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
      continue;
    }
    flush();
    html += `<p>${inline(line)}</p>`;
  }
  flush();
  return html;
}

function buildReportHtml(params: {
  pseudonymId: string;
  modelLabel: string;
  body: string; // bereits HTML
}): string {
  const ts = new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  return `
<div style="font-family:Source Sans 3,system-ui,sans-serif;max-width:920px;margin:0 auto;color:#1f2a24">
  <style>
    h1{font-family:Playfair Display,Georgia,serif;color:#3d5a45;margin:0 0 4px 0}
    h2{font-family:Playfair Display,Georgia,serif;color:#3d5a45;margin-top:24px;border-bottom:1px solid #d9e1d6;padding-bottom:4px}
    h3{color:#4b6b53;margin-top:18px}
    table{border-collapse:collapse;width:100%;margin:10px 0;font-size:.92rem}
    th,td{border:1px solid #d9e1d6;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#eef3ec}
    ul,ol{padding-left:22px}
    code{background:#f3f6f2;padding:1px 4px;border-radius:3px;font-size:.9em}
    .meta{color:#5b6b62;font-size:.85rem;margin-bottom:18px}
    .hp-badge{display:inline-block;background:#3d5a45;color:#fff;padding:2px 10px;border-radius:99px;font-size:.78rem;letter-spacing:.04em;margin-right:8px}
  </style>
  <h1>🌿 Meine Therapie – Sinnhaftigkeits-Check</h1>
  <div class="meta">
    <span class="hp-badge">Heilpraktiker-Perspektive</span>
    Pseudonym: <strong>${escapeHtml(params.pseudonymId || "—")}</strong> · Modell: ${escapeHtml(params.modelLabel)} · ${escapeHtml(ts)}
  </div>
  ${params.body}
  <hr style="margin-top:30px;border:none;border-top:1px solid #d9e1d6"/>
  <p style="font-size:.78rem;color:#5b6b62">Interne Arbeitshilfe für Naturheilpraxis Peter Rauch. Bewertung im naturheilkundlichen Rahmen – keine pharmakologische Standardempfehlung.</p>
</div>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Nur für Administratoren" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(`check-hp-therapy:${user.id}`)) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen – bitte kurz warten." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      pseudonymId?: string;
      meineTherapie?: string;
      symptome?: string;
      erkrankung?: string;
      pathogensText?: string;
      diagnosenText?: string;
      laborErhoeht?: string;
      laborErniedrigt?: string;
      laborKomplett?: string;
      stuhlbefund?: string;
      arztbericht?: string;
      metatronHeel?: string;
      medikamente?: string;
      bisherigeMittel?: string;
      alter?: string;
      geschlecht?: string;
      schwanger?: string;
      usePro?: boolean;
    };

    const meineTherapie = (body.meineTherapie || "").trim();
    if (!meineTherapie) {
      return new Response(JSON.stringify({ error: "Bitte zuerst deinen Therapieplan im Feld „Meine Therapie" eingeben." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctxBlock = [
      body.alter && `ALTER: ${body.alter}`,
      body.geschlecht && `GESCHLECHT: ${body.geschlecht}`,
      body.schwanger && body.schwanger !== "nein" && `STATUS: ${body.schwanger}`,
      body.symptome && `SYMPTOME:\n${body.symptome}`,
      body.erkrankung && `BEKANNTE ERKRANKUNG:\n${body.erkrankung}`,
      body.pathogensText && `PATHOGENE / BELASTUNGEN (Metatron/NLS/EAV):\n${body.pathogensText}`,
      body.diagnosenText && `DIAGNOSEN (Verdacht/ICD-10):\n${body.diagnosenText}`,
      body.laborErhoeht && `LABOR ERHÖHT:\n${body.laborErhoeht}`,
      body.laborErniedrigt && `LABOR ERNIEDRIGT:\n${body.laborErniedrigt}`,
      body.laborKomplett && `LABOR GESAMT:\n${body.laborKomplett}`,
      body.stuhlbefund && `STUHLBEFUND:\n${body.stuhlbefund}`,
      body.arztbericht && `ARZTBERICHT:\n${body.arztbericht}`,
      body.metatronHeel && `METATRON/HEEL/NLS:\n${body.metatronHeel}`,
      body.medikamente && `AKTUELLE MEDIKAMENTE (Schulmedizin):\n${body.medikamente}`,
      body.bisherigeMittel && `BISHERIGE NATURHEILMITTEL:\n${body.bisherigeMittel}`,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `Du bist fachlicher Sparringspartner für Peter Rauch – Heilpraktiker, Physiotherapeut, Hypnotherapeut, Ing. Elektrotechnik (20+ Jahre Erfahrung). Du arbeitest IM naturheilkundlichen Rahmen, NICHT aus pharmazeutischer Sicht.

GRUNDHALTUNG (verbindlich):
- Bioresonanz, Frequenztherapie (Diamond Shield Zapper), Phytotherapie, Orthomolekulare Medizin, EAV, NLS/Metapathia, Homöopathie, Mykotherapie und ausleitende Verfahren sind GLEICHRANGIGE Therapieoptionen.
- Schulmedizinische Studien sind EINE Quelle unter mehreren. Pharma-finanzierte Reviews bewertest du kritisch, nicht als Goldstandard.
- KEINE pauschalen „bitte ärztlich abklären"-Floskeln. „Heilpraktiker oder Arzt" nur, wenn es um echten Arztvorbehalt geht (z.B. Verdacht auf akutes Abdomen, Karzinom, Suizidalität, schwere Niereninsuffizienz).
- Symptome, Pathogene aus NLS/Metatron, EAV-Messwerte und Laborbefunde sind GLEICHWERTIGE diagnostische Hinweise.

DEINE AUFGABE:
Prüfe Peters EIGENEN Therapieplan („MEINE THERAPIE") auf Sinnhaftigkeit im Bezug zu Symptomen, Pathogenen, Diagnosen, Labor und bisherigen Mitteln.

LIEFERE STRUKTURIERT IN MARKDOWN:

## 1. Gesamteinschätzung
Kurzes Fazit (3-5 Sätze): Wie gut adressiert der Plan das Beschwerdebild? Was ist die therapeutische Logik dahinter? Ist die Reihenfolge stimmig (z.B. erst Ausleitung/Mukosa-Aufbau, dann Mikronährstoffe)?

## 2. Stärken des Plans
Tabelle: | Maßnahme | Wofür sinnvoll | Bezug zu Befund/Symptom/Pathogen |

## 3. Lücken & Vorschläge
Was fehlt im Bezug zum Befund? Konkrete naturheilkundliche Ergänzungen (Phyto, Ortho, Frequenz, Bioresonanz, Ausleitung, Mykotherapie). Mit Begründung pro Vorschlag.

## 4. Redundanzen & Überschneidungen
Welche Mittel überlappen sich (gleicher Wirkmechanismus, doppelte Belastung der Entgiftungsorgane)? Was kann zusammengeführt oder weggelassen werden?

## 5. Wechselwirkungen & Sicherheit
NUR ECHTE Risiken benennen:
- Wechselwirkungen mit eingenommenen Schulmedikamenten (z.B. Johanniskraut + Antidepressiva, Bitterstoffe + PPI)
- Kontraindikationen (Schwangerschaft, Niereninsuffizienz, Antikoagulation)
- Reihenfolge-Fehler (z.B. Ausleitung bei verschlossenen Ausscheidungsorganen)
KEINE generischen Warnungen.

## 6. Therapeutische Reihenfolge
Vorschlag für sinnvolle Sequenz (Phase 1: Drainage/Ausleitung → Phase 2: antiparasitär/antimikrobiell → Phase 3: Mukosa/Mikrobiom → Phase 4: Mitochondrien/Mikronährstoffe – oder patienten-spezifisch anders begründet).

## 7. Kosten/Nutzen-Hinweis
Wenn der Plan teure Mittel enthält, wo es preiswerte Äquivalente gibt: nennen. Sonst weglassen.

STIL: Du-Form, kollegial, technisch-naturwissenschaftlich fundiert. Bei biophysikalischen Themen (Frequenz, EAV, NLS) darfst du fachlich tief gehen – Peter ist Ing. Elektrotechnik.`;

    const userBlock = `=== MEINE THERAPIE (zu prüfen) ===
${meineTherapie}

=== PATIENTENKONTEXT ===
${ctxBlock || "(keine weiteren Befunddaten eingegeben)"}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI Gateway nicht konfiguriert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = body.usePro ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const modelLabel = body.usePro ? "Gemini 2.5 Pro" : "Gemini 2.5 Flash";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userBlock },
        ],
      }),
    });

    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht. Bitte Credits aufladen." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "KI-Ratenlimit erreicht – bitte gleich erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      await aiResp.body?.cancel();
      return new Response(JSON.stringify({ error: `KI-Fehler (${aiResp.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const markdown = (aiJson.choices?.[0]?.message?.content || "").trim();

    if (!markdown) {
      return new Response(JSON.stringify({ error: "KI hat leere Antwort geliefert." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildReportHtml({
      pseudonymId: body.pseudonymId || "",
      modelLabel,
      body: mdToHtml(markdown),
    });

    return new Response(JSON.stringify({ html, markdown, modelLabel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Interner Fehler" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
