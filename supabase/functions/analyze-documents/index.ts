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
  analysisMode?: "chunk" | "final";
  chunk?: { label?: string; text?: string; index?: number | string; total?: number | string };
  partials?: string[];
  duplicateNotes?: string[];
  totalChars?: number;
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

function splitBlock(block: DocBlock, maxChars = 6_000): DocBlock[] {
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

function chunkDocuments(blocks: DocBlock[], maxChars = 6_000): DocBlock[] {
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
  return `Du analysierst Teil ${index}/${total} einer großen Vorbefund-Sammlung für den Heilpraktiker Peter Rauch (Physiotherapeut, Hypnotherapeut, Ing. Elektrotechnik). Peter Rauch ist der BEHANDLER, NICHT der Patient. Der Patient bleibt im Output strikt anonym und wird als "der Patient" / "die Patientin" bezeichnet (niemals "Herr Rauch" o.ä., auch wenn im Quelltext echte Namen auftauchen).

Patientenkontext: ${patientContext(b)}

Wichtig:
- Es ist eine reine Befund-Auswertung, KEINE eigene Therapie-Empfehlung und KEINE neuen Mittel-Vorschläge.
- VOLLSTÄNDIGKEIT IST PFLICHT. Extrahiere ALLES, was an folgenden Standard-Anamnese-Kategorien im Text vorkommt (auch wenn die Überschriften englisch, französisch oder anders benannt sind — semantisch zuordnen):
  * Current medical problems / Aktuelle Beschwerden
  * Past medical history / Vorerkrankungen, OPs, stationäre Aufenthalte
  * Allergies / Allergien & Unverträglichkeiten
  * Present medication / Aktuelle Medikation (inkl. OTC, Supplemente, Phyto, HP-Mittel)
  * Habits / Genussmittel, Lebensgewohnheiten (Rauchen, Alkohol, Drogen, Sport, Schlaf, Ernährung)
  * Review of systems / Systemanamnese (Kopf, HNO, Herz/Lunge, GI, Uro, Neuro, Haut, MSK, Psyche)
  * Recent medical examinations / controls — letzte Untersuchungen, Kontrollen, Screenings
  * Vaccination status / Impfstatus
  * Medical family history / Familienanamnese
  * Social status / Sozialanamnese (Beruf, Wohnsituation, Familie, Belastungen)
  * Physical examination / körperlicher Untersuchungsbefund
  * Additional medical investigation / weiterführende Untersuchungen (Labor, Bildgebung, Funktionsdiagnostik)
- ALLE Medikamente, Präparate, Supplemente, Infusionen, Injektionen, OPs, Bestrahlungen, Physio-/Manual-Therapien, Heilpraktiker-Mittel vollständig in "medicationsTherapies" listen — inkl. Wirkstoff/Handelsname, Dosis falls genannt, verschreibender Arzt/Therapeut, Datum, Indikation, Status. Für JEDES Medikament zusätzlich: Wirkmechanismus (kurz, laienverständlich), häufigste Nebenwirkungen, Grund der Verordnung. Lieber zu viel als zu wenig.
- Extrahiere nur, was im Text steht (Anamnese-Inhalte). Pharmakologisches Wissen (Wirkmechanismus/Nebenwirkungen) darfst du aus allgemeinem medizinischem Wissen ergänzen, klar als "Pharmakologie" markiert.
- Fremdsprachige Befunde (Englisch/Französisch) auf Deutsch zusammenfassen.
- Anonymisierung respektieren. Heilpraktiker oder Arzt gleichrangig nennen.

🔎 BELEG-PFLICHT (Rückverfolgbarkeit für Patientengespräch):
- Zu JEDEM Eintrag in documents, anamnese.*, diagnoses, medicationsTherapies, findings, redFlags, systemsPatterns ein Objekt "beleg":
  * quelle = das Dokumentblock-Label (s.u.),
  * teil = "${index}/${total}",
  * zitat = WÖRTLICHES Kurzzitat (max. 220 Zeichen) aus dem Originaltext — KEINE Umformulierung. Wählt das prägnanteste Zitat.
- 🚫 HALLUZINATIONSVERBOT: Was nicht im Text steht, NICHT erfinden, NICHT aus anderen Befunden schließen, KEINE Untersuchungen oder Symptome ergänzen, die nicht explizit dokumentiert sind. Lieber [] lassen. Vor dem Antworten selbst prüfen: "Steht das wörtlich/sinngemäß im Text? Wenn nein → entfernen."

Gib ausschließlich kompaktes JSON zurück (jeder Listeneintrag ist ein Objekt mit "text" + "beleg", außer wo unten anders strukturiert):
{
  "documents": [{"datum":"","quelle":"","untersuchung":"","hauptbefund":"","auffaellig":"","beleg":{"quelle":"","teil":"","zitat":""}}],
  "anamnese": {
    "currentProblems": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "pastHistory": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "allergies": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "presentMedication": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "habits": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "reviewOfSystems": [{"system":"","befund":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "recentExaminations": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "vaccinationStatus": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "familyHistory": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "socialStatus": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "physicalExamination": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "additionalInvestigations": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}]
  },
  "diagnoses": [{"icd10":"","diagnose":"","quelle":"","status":"gesichert|Verdacht|Z.n.|unklar","beleg":{"quelle":"","teil":"","zitat":""}}],
  "medicationsTherapies": [{"name":"","dosis":"","vonWem":"","datum":"","indikation":"","wirkmechanismus":"","nebenwirkungen":"","grundVerordnung":"","status":"laufend|abgesetzt|unklar","beleg":{"quelle":"","teil":"","zitat":""}}],
  "findings": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
  "terms": [{"term":"","plain":"laienverständlich auf Deutsch"}],
  "redFlags": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
  "systemsPatterns": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
  "openQuestions": ["konkrete Frage für Erstgespräch"],
  "missingReports": ["nachzureichender Befund"]
}

Leere Felder als [] zurückgeben — Kategorien NIE weglassen.

Dokumentblock: ${block.label}

--- TEXTBEGINN ---
${block.text}
--- TEXTENDE ---`;
}


function buildFinalPrompt(partials: string[], b: AnalyzeBody, totalChars: number, chunkCount: number): string {
  const duplicateNotes = Array.isArray(b.duplicateNotes) ? b.duplicateNotes.filter((x) => typeof x === "string" && x.trim()) : [];
  return `Erstelle aus diesen Teilanalysen eine vollständige, print-taugliche HTML-Befund-Auswertung für den Heilpraktiker Peter Rauch (Behandler). Peter Rauch ist NICHT der Patient — der Patient bleibt im gesamten Output anonym ("der Patient" / "die Patientin"). Verwende NIEMALS "Herr Rauch" oder andere echte Patientennamen, selbst wenn diese in den Teilanalysen auftauchen.

Patientenkontext: ${patientContext(b)}
Verarbeiteter Umfang: ${totalChars.toLocaleString("de-DE")} Zeichen in ${chunkCount} Teilpaketen. Wichtig: Es wurden alle übergebenen Dokumentblöcke verarbeitet; keine künstliche Seitenbegrenzung.

VERBINDLICHE OUTPUT-STRUKTUR:
- Ausschließlich vollständiges HTML: <!DOCTYPE html> ... </html>
- Deutsche Sprache, eingebettetes CSS, serifenfreie Schrift, Akzentfarbe #6b8e6b, A4/Print-tauglich, Tabellen mit dünner Border, h2 mit linker Bordleiste. Belege/Zitate in kleinerer Schrift (font-size:0.85em, color:#5a6b5a, kursiv) darstellen.
- Keine Therapie-Empfehlung, keine Mittel-Vorschläge. Es geht um Befundübersicht, Einordnung und Vorbereitung des Erstgesprächs.
- VOLLSTÄNDIGKEIT IST PFLICHT. Jede Sektion + Unterpunkt muss erscheinen, auch wenn leer (dann explizit "In den vorliegenden Unterlagen nicht dokumentiert.").
- Keine Halluzination bei Anamnese-Inhalten. Pharmakologie (Wirkmechanismus/Nebenwirkungen/Indikation) darf aus medizinischem Standardwissen ergänzt und in Sektion 6 als "(Standard-Pharmakologie)" markiert werden.
- HWG-konform: "kann unterstützen". Praktiker-Gleichrangigkeit: "Heilpraktiker oder Arzt".

🔎 BELEG-PFLICHT IM HTML:
- Jeder Eintrag in Sektion 3, 4, 5, 6, 7, 11 bekommt eine zusätzliche Spalte/Zeile "Beleg" mit Quelle + Teilpaket + wörtlichem Kurzzitat (aus den Teilanalysen übernehmen, NICHT umformulieren). Format z. B.: <span class="beleg">📄 Arztbericht 12.03.2025, Teil 4/12: „…wörtliches Zitat…"</span>.
- Wenn ein Eintrag in mehreren Teilpaketen vorkommt: mehrere Belege auflisten.
- Folgende identische Textabschnitte wurden vorab als Duplikate erkannt und nur einmal analysiert. Im HTML in Sektion 2 kurz transparent dokumentieren, aber NICHT als fehlende Daten werten:
${duplicateNotes.length ? duplicateNotes.map((note) => `  * ${note}`).join("\n") : "  * Keine vorab erkannten identischen Duplikate."}

🚫 ANTI-HALLUZINATIONS-SELBSTCHECK (vor dem Output zwingend durchführen):
- Jeder Satz in Sektion 9 (Gesamtbild/Arbeitshypothese) und Sektion 10 (Differentialdiagnosen, Vorgehen) muss entweder:
  (a) durch mindestens einen Beleg aus den Teilanalysen abgedeckt sein → Beleg direkt anhängen, ODER
  (b) explizit als "🟡 Hypothese – nicht im Befund dokumentiert" markiert werden.
- NIEMALS Untersuchungen, Symptome, Ausfälle, Werte erfinden, die nicht in den Teilanalysen vorkommen. Beispielsweise dürfen "neurologische Teilausfälle" nur erwähnt werden, wenn ein Teilpaket sie als Beleg liefert — sonst weglassen oder als offene Frage in Sektion 10 stellen.
- Vor Ausgabe selbst prüfen: Für jede Aussage in Sektion 9/10 → gibt es einen Beleg? Wenn nein → entfernen oder als Hypothese kennzeichnen.

Pflicht-Sektionen in Reihenfolge:
1. <h1>Befund-Auswertung</h1> + Datum + Pseudonym
2. Übersicht der eingereichten Unterlagen — Tabelle: Anzahl Teilpakete/Dokumente, geschätzter Umfang, Sprachen, Zeitraum.
3. Chronologische Untersuchungs-Übersicht — Tabelle: Datum | Arzt/Labor | Untersuchung | Hauptbefund | Auffällig? | Beleg (Quelle+Teil+Zitat); neueste zuerst.
4. Strukturierte Anamnese-Übersicht — pro Unterkategorie <h3> + Tabelle mit Spalten: Eintrag | Beleg. ALLE folgenden Unterpunkte sind PFLICHT in dieser Reihenfolge:
   4.1 Aktuelle Beschwerden (Current medical problems)
   4.2 Vorerkrankungen / OPs / Z.n. (Past medical history)
   4.3 Allergien & Unverträglichkeiten (Allergies)
   4.4 Aktuelle Medikation — Kurzliste (Details in Sektion 6)
   4.5 Genussmittel & Lebensgewohnheiten (Habits)
   4.6 Systemanamnese (Review of systems) — Tabelle System | Befund | Beleg
   4.7 Letzte Untersuchungen / Kontrollen (Recent examinations)
   4.8 Impfstatus (Vaccination status)
   4.9 Familienanamnese (Family history)
   4.10 Sozialanamnese (Social status)
   4.11 Körperliche Untersuchung (Physical examination)
   4.12 Weiterführende Untersuchungen (Additional investigations)
5. Diagnosen & Verdachtsdiagnosen — Tabelle: ICD-10 | Diagnose | Quelle | Status | Beleg.
6. Medikamente, Präparate & Therapien — DETAIL-Tabelle ALLER Mittel. Spalten: Mittel/Wirkstoff (Dosis) | von wem | Datum | Indikation | Wirkmechanismus | Nebenwirkungen | Grund | Status | Beleg. Standard-Pharmakologie markieren. Wenn keinerlei Mittel: "Keine Medikamente/Therapien in den Unterlagen dokumentiert."
7. Auffälligkeiten, Widersprüche, fehlende Befunde — Bullet-Liste mit Beleg pro Punkt.
8. Übersetzung Ärzte-Sprache → Patienten-Sprache — Tabelle: Fachbegriff | Bedeutung.
9. Gesamtbild & Arbeitshypothese — 1–3 Absätze. JEDER Satz mit Beleg(en) am Ende ODER mit "🟡 Hypothese" markiert. Keine Therapie.
10. Empfohlenes Vorgehen für das Erstgespräch — nummeriert: Fragen, eigene Untersuchungen (EAV/NLS/Bioresonanz/Labor-Ergänzung), fehlende Befunde, Differentialdiagnosen (jede DD mit Beleg ODER 🟡-Hypothese-Marker + Begründung warum sie zu prüfen ist), Priorität.
11. Sicherheitshinweise / Red Flags — falls nichts kritisch: kurz vermerken. Mit Beleg.

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
      max_tokens: 32000,
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
        { role: "system", content: "Du gibst ausschließlich vollständiges HTML zurück, beginnend mit <!DOCTYPE html>. Keine Vorrede, keine Erklärung, keine Code-Fences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 32000,
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
  let emittedChars = 0;
  let lastFinishReason = "";

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.length) {
            const tail = stripHtmlFence(buffer);
            if (tail) { controller.enqueue(encoder.encode(tail)); emittedChars += tail.length; }
          }
          // Fallback: Stream lieferte kein/zu wenig sichtbares HTML → einmal non-streaming auf Flash retry
          if (emittedChars < 300) {
            console.warn(`analyze-documents final stream empty (chars=${emittedChars}, finish=${lastFinishReason}) – fallback to non-stream flash`);
            try {
              const fallback = await callGatewayText(apiKey, "google/gemini-2.5-flash", prompt, 0.2);
              const html = stripHtmlFence(fallback);
              if (html && html.length > 100) {
                if (!started) {
                  if (!/^<!DOCTYPE/i.test(html) && !/^<html/i.test(html)) {
                    controller.enqueue(encoder.encode(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body>`));
                    wrapped = true;
                  }
                }
                controller.enqueue(encoder.encode(html));
              } else {
                controller.enqueue(encoder.encode(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body><h1>Befund-Auswertung</h1><p style="color:#a33">⚠ Die KI hat keine HTML-Antwort geliefert (finish_reason=${lastFinishReason || "unknown"}). Bitte erneut versuchen oder Umfang reduzieren.</p>`));
                wrapped = true;
              }
            } catch (fbErr) {
              console.error("fallback flash failed:", (fbErr as Error).message);
              controller.enqueue(encoder.encode(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body><h1>Befund-Auswertung</h1><p style="color:#a33">⚠ Stream leer und Fallback fehlgeschlagen: ${(fbErr as Error).message.replace(/[<>]/g, "")}</p>`));
              wrapped = true;
            }
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
            const fr = j.choices?.[0]?.finish_reason;
            if (fr) lastFinishReason = String(fr);
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
          emittedChars += textOut.length;
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

    let body: AnalyzeBody;
    try {
      const raw = await req.text();
      if (!raw || !raw.trim()) {
        return new Response(JSON.stringify({ error: "Leerer Request-Body" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = JSON.parse(raw) as AnalyzeBody;
    } catch (e) {
      console.error("analyze-documents: JSON parse error", e);
      return new Response(JSON.stringify({ error: "Ungültiger JSON-Body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.analysisMode === "chunk") {
      const text = cleanText(body.chunk?.text);
      const label = cleanText(body.chunk?.label) || "Dokument-Teil";
      const rawIndex = Number.parseFloat(String(body.chunk?.index || "1"));
      const index = Number.isFinite(rawIndex) ? Math.max(1, rawIndex) : 1;
      const rawTotal = Number.parseFloat(String(body.chunk?.total || index));
      const total = Number.isFinite(rawTotal) ? Math.max(index, rawTotal) : index;
      if (!text) {
        return new Response(JSON.stringify({ error: "Leeres Dokument-Teilpaket" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let partial = "";
      try {
        partial = await callGatewayText(
          LOVABLE_API_KEY,
          "google/gemini-2.5-flash",
          buildChunkPrompt({ label, text }, index, total, body),
        );
      } catch (error) {
        return new Response(JSON.stringify({ error: String((error as Error)?.message || error || "Teilpaket konnte nicht vollständig ausgewertet werden") }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ partial: extractJsonish(partial), chars: text.length, recovered: false }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Model": "google/gemini-2.5-flash",
          "X-Input-Chars": String(text.length),
          "X-Analysis-Mode": "chunk",
          "X-Analysis-Chunks": String(total),
        },
      });
    }

    if (body.analysisMode === "final") {
      const partials = Array.isArray(body.partials) ? body.partials.filter((x) => typeof x === "string" && x.trim()) : [];
      if (!partials.length) {
        return new Response(JSON.stringify({ error: "Keine Teilanalysen zur Zusammenführung übergeben" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const totalChars = Number(body.totalChars || 0);
      const model = body.useProModel || totalChars > 60_000
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash";
      const htmlStream = await streamGatewayHtml(LOVABLE_API_KEY, model, buildFinalPrompt(partials, body, totalChars, partials.length));
      return new Response(htmlStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "X-Model": model,
          "X-Input-Chars": String(totalChars),
          "X-Analysis-Mode": "client-chunked-final",
          "X-Analysis-Chunks": String(partials.length),
          "Cache-Control": "no-cache",
        },
      });
    }

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