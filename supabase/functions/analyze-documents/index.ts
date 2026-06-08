// Edge Function: analyze-documents
// Reine Befund-Auswertung (KEINE Therapie-Empfehlung).
// Große Eingaben werden vollständig in Chunks analysiert und danach synthetisiert.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Expose-Headers": "x-model, x-input-chars, x-analysis-mode, x-analysis-chunks",
    "Vary": "Origin",
  };
  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}

interface AnalyzeBody {
  laborKomplett?: string;
  laborErhoeht?: string;
  laborErniedrigt?: string;
  laborDatum?: string;
  stuhlbefund?: string;
  arztbericht?: string;
  arztberichtDatum?: string;
  metatronHeel?: string;
  sonstigeUntersuchungen?: string;
  perplexityAnalyse?: string;
  alter?: string;
  geschlecht?: string;
  pseudonymId?: string;
  useProModel?: boolean;
}

type DocBlock = { label: string; text: string };

const encoder = new TextEncoder();

function cleanText(value?: string) {
  return (value || "").replace(/\r\n/g, "\n").trim();
}

function collectBlocks(b: AnalyzeBody): DocBlock[] {
  const blocks: DocBlock[] = [];
  const push = (label: string, val?: string) => {
    const text = cleanText(val);
    if (text) blocks.push({ label, text });
  };
  push(`Labor (komplett)${b.laborDatum ? ` – ${b.laborDatum}` : ""}`, b.laborKomplett);
  push("Labor – erhöhte Werte", b.laborErhoeht);
  push("Labor – erniedrigte Werte", b.laborErniedrigt);
  push("Stuhlbefund", b.stuhlbefund);
  push(`Arztbericht${b.arztberichtDatum ? ` – ${b.arztberichtDatum}` : ""}`, b.arztbericht);
  push("Metatron / NLS / Bioresonanz", b.metatronHeel);
  push("Sonstige / unsortierte Voruntersuchungen", b.sonstigeUntersuchungen);
  push("Externe Recherche (Perplexity / Studien / Leitlinien)", b.perplexityAnalyse);
  return blocks;
}

function splitBlock(block: DocBlock, maxChars = 18_000): DocBlock[] {
  if (block.text.length <= maxChars) return [block];
  const paragraphs = block.text.split(/\n{2,}/);
  const chunks: DocBlock[] = [];
  let current = "";
  let index = 1;
  const flush = () => {
    if (!current.trim()) return;
    chunks.push({ label: `${block.label} – Teil ${index}`, text: current.trim() });
    current = "";
    index += 1;
  };
  for (const paragraph of paragraphs) {
    const part = paragraph.trim();
    if (!part) continue;
    if (part.length > maxChars) {
      flush();
      for (let i = 0; i < part.length; i += maxChars) {
        chunks.push({ label: `${block.label} – Teil ${index}`, text: part.slice(i, i + maxChars).trim() });
        index += 1;
      }
      continue;
    }
    if ((current + "\n\n" + part).length > maxChars) flush();
    current = current ? `${current}\n\n${part}` : part;
  }
  flush();
  return chunks;
}

function chunkDocuments(blocks: DocBlock[], maxChars = 18_000): DocBlock[] {
  return blocks.flatMap((block) => splitBlock(block, maxChars));
}

function patientContext(b: AnalyzeBody) {
  const patient: string[] = [];
  if (b.alter) patient.push(`Alter: ${b.alter}`);
  if (b.geschlecht) patient.push(`Geschlecht: ${b.geschlecht}`);
  if (b.pseudonymId) patient.push(`Pseudonym: ${b.pseudonymId}`);
  return patient.length ? patient.join(" · ") : "nicht angegeben";
}

function buildChunkPrompt(block: DocBlock, index: number, total: number, b: AnalyzeBody): string {
  return `Du analysierst Teil ${index}/${total} einer großen Vorbefund-Sammlung für Peter Rauch (Heilpraktiker, Physiotherapeut, Hypnotherapeut, Ing. Elektrotechnik).

Patientenkontext: ${patientContext(b)}

Wichtig:
- Es ist eine reine Befund-Auswertung, KEINE Therapie-Empfehlung und KEINE Mittel-Vorschläge.
- Extrahiere nur, was im Text steht. Keine Halluzination.
- Fremdsprachige Befunde (Englisch/Französisch) auf Deutsch zusammenfassen.
- Anonymisierung respektieren.
- Heilpraktiker oder Arzt gleichrangig nennen; "ärztlich" nur bei echtem Arztvorbehalt.

Gib ausschließlich kompaktes JSON zurück:
{
  "documents": [{"datum":"", "quelle":"", "untersuchung":"", "hauptbefund":"", "auffaellig":""}],
  "diagnoses": [{"icd10":"", "diagnose":"", "quelle":"", "status":"gesichert|Verdacht|Z.n.|unklar"}],
  "medicationsTherapies": [{"name":"", "vonWem":"", "datum":"", "indikation":"", "status":"laufend|abgesetzt|unklar"}],
  "findings": ["wichtige Auffälligkeit/Widerspruch/fehlender Befund"],
  "terms": [{"term":"", "plain":"laienverständlich auf Deutsch"}],
  "redFlags": ["dringlicher Sicherheitshinweis, falls vorhanden"],
  "systemsPatterns": ["betroffene Systeme/Muster"],
  "openQuestions": ["konkrete Frage für Erstgespräch"],
  "missingReports": ["nachzureichender Befund"]
}

Dokumentblock: ${block.label}

--- TEXTBEGINN ---
${block.text}
--- TEXTENDE ---`;
}

function buildFinalPrompt(partials: string[], b: AnalyzeBody, totalChars: number, chunkCount: number): string {
  return `Erstelle aus diesen Teilanalysen eine vollständige, print-taugliche HTML-Befund-Auswertung für Peter Rauch.

Patientenkontext: ${patientContext(b)}
Verarbeiteter Umfang: ${totalChars.toLocaleString("de-DE")} Zeichen in ${chunkCount} Teilpaketen. Wichtig: Es wurden alle übergebenen Dokumentblöcke verarbeitet; keine künstliche Seitenbegrenzung.

VERBINDLICHE OUTPUT-STRUKTUR:
- Ausschließlich vollständiges HTML: <!DOCTYPE html> ... </html>
- Deutsche Sprache, eingebettetes CSS, serifenfreie Schrift, Akzentfarbe #6b8e6b, A4/Print-tauglich, Tabellen mit dünner Border.
- Keine Therapie-Empfehlung, keine Mittel-Vorschläge. Es geht um Befundübersicht, Einordnung und Vorbereitung des Erstgesprächs.
- Keine Halluzination: fehlende Angaben mit "—" oder "nicht angegeben" markieren.
- HWG-konform: "kann unterstützen", keine Heilversprechen.
- Praktiker-Gleichrangigkeit: "Heilpraktiker oder Arzt"; "ärztlich" nur bei echtem Arztvorbehalt.

Pflicht-Sektionen in Reihenfolge:
1. <h1>Befund-Auswertung</h1> + Datum + Pseudonym
2. Übersicht der eingereichten Unterlagen — Tabelle: Anzahl Teilpakete/Dokumente, geschätzter Umfang, Sprachen, Zeitraum.
3. Chronologische Untersuchungs-Übersicht — Tabelle: Datum | Arzt/Labor | Untersuchung | Hauptbefund | Auffällig?; neueste zuerst, fehlendes Datum: "ohne Datum".
4. Diagnosen & Verdachtsdiagnosen — Tabelle: ICD-10 | Diagnose | Quelle | Status.
5. Bereits empfohlene / verordnete Mittel & Therapien — Tabelle: Mittel/Therapie | von wem | Datum | Indikation | Status.
6. Auffälligkeiten, Widersprüche, fehlende Befunde — Bullet-Liste.
7. Übersetzung Ärzte-Sprache → Patienten-Sprache — Tabelle: Fachbegriff | Bedeutung; die wichtigsten Begriffe.
8. Gesamtbild & Arbeitshypothese — 1–3 Absätze aus den Vorbefunden, keine Therapie.
9. Empfohlenes Vorgehen für das Erstgespräch — nummeriert: Fragen, eigene Untersuchungen (EAV/NLS/Bioresonanz/Labor-Ergänzung falls passend), fehlende Befunde, Differentialdiagnosen, Priorität.
10. Sicherheitshinweise / Red Flags — falls nichts kritisch: kurz vermerken.

TEILANALYSEN (JSON/Notizen):
${partials.map((p, i) => `\n--- TEILANALYSE ${i + 1} ---\n${p}`).join("\n")}`;
}

function extractJsonish(text: string) {
  return text.replace(/^\s*```json\s*/i, "").replace(/^\s*```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function stripHtmlFence(text: string) {
  return text.replace(/^\s*```html\s*/i, "").replace(/^\s*```\s*/i, "").replace(/```\s*$/i, "").trim();
}

async function callGatewayText(apiKey: string, model: string, prompt: string, temperature = 0.2): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Du antwortest exakt im geforderten Format. Keine Vorrede." },
        { role: "user", content: prompt },
      ],
      temperature,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error("Rate-Limit erreicht. Bitte später erneut versuchen.");
    if (resp.status === 402) throw new Error("AI-Guthaben aufgebraucht. Bitte im Workspace aufladen.");
    throw new Error(`AI Gateway ${resp.status}: ${errText.slice(0, 500)}`);
  }
  const json = await resp.json();
  return String(json.choices?.[0]?.message?.content || "").trim();
}

async function streamGatewayHtml(apiKey: string, model: string, prompt: string): Promise<ReadableStream<Uint8Array>> {
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Du gibst ausschließlich vollständiges HTML zurück, beginnend mit <!DOCTYPE html>." },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      stream: true,
    }),
  });
  if (!aiResp.ok || !aiResp.body) {
    const errText = await aiResp.text().catch(() => "");
    if (aiResp.status === 429) throw new Error("Rate-Limit erreicht. Bitte später erneut versuchen.");
    if (aiResp.status === 402) throw new Error("AI-Guthaben aufgebraucht. Bitte im Workspace aufladen.");
    throw new Error(`AI Gateway ${aiResp.status}: ${errText.slice(0, 500)}`);
  }

  const decoder = new TextDecoder();
  const reader = aiResp.body.getReader();
  let buffer = "";
  let started = false;
  let wrapped = false;

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.length) {
            const tail = stripHtmlFence(buffer);
            if (tail) controller.enqueue(encoder.encode(tail));
          }
          if (wrapped) controller.enqueue(encoder.encode("</body></html>"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        let textOut = "";
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) textOut += delta;
          } catch { /* ignore malformed SSE frame */ }
        }
        if (textOut) {
          if (!started) {
            textOut = stripHtmlFence(textOut);
            if (!/^<!DOCTYPE/i.test(textOut) && !/^<html/i.test(textOut)) {
              controller.enqueue(encoder.encode(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body>`));
              wrapped = true;
            }
            started = true;
          }
          controller.enqueue(encoder.encode(textOut));
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

function progressStream(chunks: DocBlock[], b: AnalyzeBody, apiKey: string, model: string, totalChars: number) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        send(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung läuft…</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:32px;color:#28342d;line-height:1.5}.box{border:1px solid #d8e2d3;background:#f8faf6;padding:18px;border-radius:8px;max-width:900px}.bar{height:10px;background:#e5eadf;border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:#6b8e6b;width:8%}.muted{color:#667063}</style></head><body><main class="box"><h1>Befund-Auswertung wird vollständig erstellt…</h1><p>Alle übergebenen Seiten werden in ${chunks.length} Teilpaketen gelesen und anschließend zusammengeführt.</p><div class="bar"><span></span></div><p class="muted">Bitte Fenster offen lassen. Bei sehr vielen Seiten kann das einige Minuten dauern.</p><ul>`);
        const partials: string[] = [];
        for (let i = 0; i < chunks.length; i += 1) {
          send(`<li>Teil ${i + 1}/${chunks.length}: ${chunks[i].label.replace(/[<>&]/g, "")} wird gelesen…</li>`);
          const partial = await callGatewayText(apiKey, "google/gemini-2.5-flash", buildChunkPrompt(chunks[i], i + 1, chunks.length, b));
          partials.push(extractJsonish(partial).slice(0, 12_000));
        }
        send(`</ul><p><strong>Zusammenführung läuft…</strong></p></main>`);
        const finalPrompt = buildFinalPrompt(partials, b, totalChars, chunks.length);
        const htmlStream = await streamGatewayHtml(apiKey, model, finalPrompt);
        const reader = htmlStream.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        send(`</ul><h2 style="color:#a33">❌ Fehler</h2><p>${String((error as Error).message || error).replace(/[<>&]/g, "")}</p></body></html>`);
        controller.close();
      }
    },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Nur Admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AnalyzeBody;
    const blocks = collectBlocks(body);
    if (!blocks.length) {
      return new Response(JSON.stringify({ error: "Keine Dokumente zur Auswertung übergeben" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalChars = blocks.reduce((sum, block) => sum + block.text.length, 0);
    const chunks = chunkDocuments(blocks);
    const largeMode = chunks.length > 1 || totalChars > 24_000;
    const model = body.useProModel || totalChars > 60_000
      ? "google/gemini-2.5-pro"
      : "google/gemini-2.5-flash";

    const stream = largeMode
      ? progressStream(chunks, body, LOVABLE_API_KEY, model, totalChars)
      : await streamGatewayHtml(LOVABLE_API_KEY, model, buildFinalPrompt([
          JSON.stringify({ rawDocument: blocks.map((block) => `### ${block.label}\n${block.text}`).join("\n\n") }),
        ], body, totalChars, 1));

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Model": model,
        "X-Input-Chars": String(totalChars),
        "X-Analysis-Mode": largeMode ? "chunked-full" : "single-pass",
        "X-Analysis-Chunks": String(chunks.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("analyze-documents error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message || "Fehler" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});