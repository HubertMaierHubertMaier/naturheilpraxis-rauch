// Edge Function: analyze-documents
// Reine Befund-Auswertung (KEINE Therapie-Empfehlung).
// Input: alle Dokument-Felder (Labor, Arztberichte, sonstige Untersuchungen, Perplexity, Metatron, Stuhl).
// Output: HTML-Dokument als String — chronologische Aufstellung, Diagnosen, Patientensprache,
// Vorgehensempfehlung. Wird im Frontend in neuem Tab geöffnet.

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

function buildPrompt(b: AnalyzeBody): string {
  const blocks: string[] = [];
  const push = (label: string, val?: string) => {
    if (val && val.trim()) blocks.push(`### ${label}\n${val.trim()}`);
  };
  push(`Labor (komplett)${b.laborDatum ? ` – ${b.laborDatum}` : ""}`, b.laborKomplett);
  push("Labor – erhöhte Werte", b.laborErhoeht);
  push("Labor – erniedrigte Werte", b.laborErniedrigt);
  push("Stuhlbefund", b.stuhlbefund);
  push(`Arztbericht${b.arztberichtDatum ? ` – ${b.arztberichtDatum}` : ""}`, b.arztbericht);
  push("Metatron / NLS / Bioresonanz", b.metatronHeel);
  push("Sonstige / unsortierte Voruntersuchungen", b.sonstigeUntersuchungen);
  push("Externe Recherche (Perplexity / Studien / Leitlinien)", b.perplexityAnalyse);

  const patient: string[] = [];
  if (b.alter) patient.push(`Alter: ${b.alter}`);
  if (b.geschlecht) patient.push(`Geschlecht: ${b.geschlecht}`);
  if (b.pseudonymId) patient.push(`Pseudonym: ${b.pseudonymId}`);

  return `Du bist ein erfahrener Naturheilpraktiker (Peter Rauch, Heilpraktiker + Ing. Elektrotechnik) und sollst eine **reine Befund-Auswertung** durchführen — KEINE Therapie-Empfehlung, KEINE Mittel-Vorschläge.

Der Patient hat **viele Seiten Vorbefunde** geschickt, **bevor** das Erstgespräch stattgefunden hat. Symptome sind noch nicht bekannt. Deine Aufgabe: Vorbefunde durchsehen, sortieren, übersetzen, einordnen.

${patient.length ? `**Patientenkontext:** ${patient.join(" · ")}\n` : ""}

---

## VERBINDLICHE OUTPUT-STRUKTUR (HTML)

Liefere **ausschließlich** ein vollständiges HTML-Dokument (beginnend mit \`<!DOCTYPE html>\`, endend mit \`</html>\`). Kein Markdown, keine Code-Fences, kein Vorspann.

Style: eingebettetes \`<style>\` mit serifenfreier Schrift, Akzentfarbe \`#6b8e6b\` (sage green), Print-tauglich (A4), Tabellen mit dünner Border.

### Pflicht-Sektionen (in dieser Reihenfolge):

1. **\`<h1>\` Befund-Auswertung** + Datum + Pseudonym
2. **\`<section>\` 📋 Übersicht der eingereichten Unterlagen** — Tabelle: Anzahl Dokumente / geschätzter Umfang / Sprachen / Zeitraum.
3. **\`<section>\` 🗂️ Chronologische Untersuchungs-Übersicht** — **Tabelle** sortiert nach Datum (neueste zuerst):
   | Datum | Arzt/Labor | Untersuchung | Hauptbefund | Auffällig? |
   Jedes Datum aus dem Freitext extrahieren (TT.MM.JJJJ, „März 2024", „vor 2 J." …). Bei fehlendem Datum: "ohne Datum".
4. **\`<section>\` 🩺 Diagnosen & Verdachtsdiagnosen (aus den Vorbefunden)** — Tabelle: ICD-10 | Diagnose | Quelle (welcher Befund/Arzt) | Status (gesichert / Verdacht / Z.n.).
5. **\`<section>\` 💊 Bereits empfohlene / verordnete Mittel & Therapien** — Tabelle: Mittel/Therapie | von wem | Datum | Indikation | Status (laufend / abgesetzt / unklar). Falls nichts erwähnt: ausdrücklich vermerken.
6. **\`<section>\` 🔍 Auffälligkeiten, Widersprüche, fehlende Befunde** — Bullet-Liste: was widerspricht sich zwischen den Ärzten? was wurde nie ausgewertet? was fehlt für eine saubere Einordnung?
7. **\`<section>\` 🗣️ Übersetzung Ärzte-Sprache → Patienten-Sprache** — Tabelle: Fachbegriff | Was es bedeutet (1 Satz, laienverständlich, ohne Verharmlosung). Mindestens die 10 wichtigsten Begriffe aus den Dokumenten.
8. **\`<section>\` 🎯 Gesamtbild & Arbeitshypothese** — 1–2 Absätze: Was zeichnet sich aus den Vorbefunden ab? Welche Systeme sind betroffen (Endokrin, GI, Immun, Muskuloskelettal, Psyche, …)? Welche Muster (chronisch-entzündlich, mitochondrial, allergisch, …)?
9. **\`<section>\` 📌 Empfohlenes Vorgehen für das Erstgespräch (Peter Rauch)** — **nummerierte Liste**, sehr konkret:
   - Welche **Fragen** muss Peter im Erstgespräch unbedingt stellen (Symptom-Lücken füllen)?
   - Welche **eigenen Untersuchungen** sinnvoll (EAV / NLS / Bioresonanz / Labor-Ergänzung)?
   - Welche **fehlenden Befunde** sollte der Patient nachreichen?
   - Welche **Differentialdiagnosen** noch abklären lassen (Heilpraktiker ODER Arzt — gleichrangig, "ärztlich" nur bei echtem Arztvorbehalt)?
   - **Reihenfolge / Priorität** der nächsten Schritte.
10. **\`<section>\` ⚠️ Sicherheitshinweise / Red Flags** — alles was nicht warten darf (Notfall-Hinweise, dringliche Abklärung). Falls nichts kritisch: kurz vermerken.

### Regeln:
- **VOLLSTÄNDIG lesen** — wenn der Input sehr groß ist und du nicht alles verarbeiten kannst, **explizit oben in einem \`<div class="warn">\` melden**: "⚠️ Kontextlimit: nur die ersten X% der Dokumente konnten ausgewertet werden."
- **Keine Halluzination** — wenn ein Datum/Arzt/Wert nicht im Input steht: leer lassen oder "—".
- **Anonymisierung respektieren** — Texte wie "(Name entfernt)" / "(Adresse entfernt)" einfach so übernehmen.
- **Sprache: Deutsch.** Fremdsprachige Befunde (EN/FR) übersetzen.
- **HWG-konform**: bei naturheilkundlichen Aussagen "kann unterstützen", keine Heilversprechen.
- **Praktiker-Gleichrangigkeit**: "Heilpraktiker oder Arzt" — "ärztlich" NUR bei echtem Arztvorbehalt (Krebs akut, Notfall, meldepflichtige Infektion, Geburtshilfe).

---

## EINGEREICHTE DOKUMENTE (vollständig):

${blocks.join("\n\n")}
`;
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

    const hasAny = [
      body.laborKomplett, body.laborErhoeht, body.laborErniedrigt,
      body.stuhlbefund, body.arztbericht, body.metatronHeel,
      body.sonstigeUntersuchungen, body.perplexityAnalyse,
    ].some((x) => x && x.trim());
    if (!hasAny) {
      return new Response(JSON.stringify({ error: "Keine Dokumente zur Auswertung übergeben" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalChars = [
      body.laborKomplett, body.laborErhoeht, body.laborErniedrigt,
      body.stuhlbefund, body.arztbericht, body.metatronHeel,
      body.sonstigeUntersuchungen, body.perplexityAnalyse,
    ].reduce((sum, x) => sum + (x?.length ?? 0), 0);

    // Bei großem Kontext IMMER Pro-Modell
    const model = body.useProModel || totalChars > 60_000
      ? "google/gemini-2.5-pro"
      : "google/gemini-2.5-flash";

    const prompt = buildPrompt(body);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Du gibst ausschließlich vollständiges HTML zurück, beginnend mit <!DOCTYPE html>." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        stream: true,
      }),
    });

    if (!aiResp.ok || !aiResp.body) {
      const errText = await aiResp.text().catch(() => "");
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht. Bitte später erneut versuchen." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte im Workspace aufladen." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway ${aiResp.status}: ${errText.slice(0, 500)}`);
    }

    // SSE → plain-text HTML stream weiterreichen.
    // Verhindert IDLE_TIMEOUT (150s) bei großem Input, weil kontinuierlich Bytes fließen.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = aiResp.body.getReader();
    let buffer = "";
    let started = false;
    let wrapped = false;

    const out = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.length) {
              const tail = buffer.replace(/```\s*$/i, "");
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
            } catch { /* ignore */ }
          }
          if (textOut) {
            if (!started) {
              textOut = textOut.replace(/^\s*```html\s*/i, "").replace(/^\s*```\s*/i, "");
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

    return new Response(out, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Model": model,
        "X-Input-Chars": String(totalChars),
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
