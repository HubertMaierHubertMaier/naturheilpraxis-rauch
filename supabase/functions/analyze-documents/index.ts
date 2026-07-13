// Edge Function: analyze-documents
// Reine Befund-Auswertung (KEINE Therapie-Empfehlung).
// Große Eingaben werden vollständig in Chunks analysiert und danach synthetisiert.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildClinicallyRelevantLabHighlights } from "../_shared/labTrendAnalysis.ts";

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
  mannayanOrdersText?: string;
  alter?: string;
  geschlecht?: string;
  pseudonymId?: string;
  useProModel?: boolean;
  previousResultForCompare?: string;
}

type DocBlock = { label: string; text: string };

const encoder = new TextEncoder();
const ANALYSIS_ANAMNESE_KEYS = ["currentProblems", "pastHistory", "allergies", "presentMedication", "habits", "reviewOfSystems", "recentExaminations", "vaccinationStatus", "familyHistory", "socialStatus", "physicalExamination", "additionalInvestigations"];
const ANALYSIS_REQUIRED_ARRAY_KEYS = ["documents", "diagnoses", "medicationsTherapies", "labValues", "findings", "terms", "redFlags", "systemsPatterns", "openQuestions", "missingReports"];

function countAnalysisObjectItems(source: Record<string, any>) {
  const topLevel = ANALYSIS_REQUIRED_ARRAY_KEYS.reduce((sum, key) => sum + (Array.isArray(source[key]) ? source[key].length : 0), 0);
  const anamnese = source.anamnese && typeof source.anamnese === "object" ? source.anamnese : {};
  const anamnesisItems = ANALYSIS_ANAMNESE_KEYS.reduce((sum, key) => sum + (Array.isArray(anamnese[key]) ? anamnese[key].length : 0), 0);
  return topLevel + anamnesisItems;
}

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
  push("Mannayan-Bestellungen (vom Patienten verordnet/bestellt – PFLICHT in der Auswertung explizit prüfen, ob jedes bestellte Mittel zu den aktuellen Symptomen, Diagnosen und Pathogenen passt; in Sektion 6 als bestelltes/laufendes Mittel markieren und in einer eigenen Bewertung am Ende referenzieren)", b.mannayanOrdersText);
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
- 📝 FORMULAR-REGEL (kritisch, gilt insbesondere für ausgefüllte Anamnesebögen, Fragebögen, Checklisten, IAA-Bögen — inkl. des Praxis-Anamnesebogens Peter Rauch / Naturheilpraxis Rauch mit den römisch nummerierten Sektionen I.–XXV. wie "I. Patientendaten", "II. Aktuelle Beschwerden", "III. Allergien & Unverträglichkeiten", "IV. Kopf/Sinne/Nervensystem", "V. Herz & Kreislauf", "VI. Lunge & Atmung", "VII. Magen & Darm" usw.):
  * Es dürfen NUR Einträge extrahiert werden, bei denen der Patient tatsächlich etwas ausgefüllt oder angekreuzt hat — also freier Text, eine handschriftliche Notiz, ein sichtbares Kreuz/Häkchen (X, ✓, ☑, "ja", ausgefüllter Kreis ●, geschwärztes Kästchen ■) oder eine numerische Skalen-Antwort > 1 (die "1" ist bei IAA/Trikombin die Default-Grundausprägung "nicht/kaum" und zählt NICHT als bejahtes Symptom).
  * Leere Checkbox-Symbole (☐, □, ○, "[ ]", "( )") und gedruckte Diagnose-Listen ohne Kreuz sind UNBEANTWORTET → nicht übernehmen. Nur die tatsächlich markierten Zeilen extrahieren.
  * Gedruckte Formular-Labels, Beispiel-Platzhalter ("(unleserlich)", "(Datum)", "(Jahr)", "seit …", "________", "ICD-10: …" ohne Patient-Kreuz), leere Tabellenzeilen (z.B. leere Medikamenten-Tabelle mit nur Spaltenköpfen "Name | Dosis | seit wann | wegen"), Sektions-Überschriften ohne Patient-Antwort und ganze Kataloge angebotener Diagnosen ohne Kreuz werden STILL VERWORFEN. Niemals als leere Bullet-Punkte, "Keine Angabe"-Zeilen oder "[Datum entfernt]"-Zeilen ausgeben.
  * Wenn eine ganze Sektion vom Patienten leer gelassen wurde: die Sektion komplett weglassen (leeres Array zurückgeben). Nicht die Frage/Label/den Diagnosen-Katalog als vermeintlichen Befund übernehmen.
  * KEINE Datum-Platzhalter erfinden: wenn im Formularabschnitt kein echtes Datum steht, "datum":"" lassen. Niemals "[Datum entfernt]", "[Datum nicht erkennbar]", "(Datum folgt aus …)" o.ä. produzieren.
  * KEINE ICD-10-Codes aus einem gedruckten Diagnose-Katalog übernehmen, wenn der Patient die Zeile NICHT angekreuzt hat — auch wenn Code + Bezeichnung sauber im Formular stehen.
- Für Arztbriefe, Laborbefunde, Bildgebung, Entlassbriefe, Konsile gilt weiterhin: möglichst vollständig extrahieren, was im Text steht (Diagnosen, Werte, Medikamente, Anamnese-Angaben) — inkl. Datum aus Header/Probenabnahme.
- Standard-Anamnese-Kategorien (semantisch zuordnen, EN/FR-Überschriften erkennen — aber nur mit tatsächlich vorhandenen Inhalten füllen, nicht mit leeren Formulartiteln):
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
- ALLE tatsächlich dokumentierten Medikamente, Präparate, Supplemente, Infusionen, Injektionen, OPs, Bestrahlungen, Physio-/Manual-Therapien, Heilpraktiker-Mittel in "medicationsTherapies" listen — inkl. Wirkstoff/Handelsname, Dosis falls genannt, verschreibender Arzt/Therapeut, Datum, Indikation, Status. Für JEDES Medikament zusätzlich: Wirkmechanismus (kurz, laienverständlich), häufigste Nebenwirkungen, Grund der Verordnung. Leere Medikamenten-Tabellenzeilen aus Anamnesebögen NICHT übernehmen.
- Extrahiere nur, was im Text steht (Anamnese-Inhalte). Pharmakologisches Wissen (Wirkmechanismus/Nebenwirkungen) darfst du aus allgemeinem medizinischem Wissen ergänzen, klar als "Pharmakologie" markiert.
- 🇩🇪 PFLICHT-DEUTSCH: ALLE extrahierten Textinhalte (Befund-Texte, Diagnose-Bezeichnungen, Parameter-Namen, Status, Untersuchungs-Bezeichnungen, Hauptbefunde, Wirkmechanismen, Indikationen, Nebenwirkungen, terms.plain) MÜSSEN auf Deutsch sein. Englische/französische/lateinische Originalbegriffe nur in Klammern beibehalten, z.B. "Leukozyten (WBC)", "Cholesterin gesamt (Total Cholesterol)", "Reizdarmsyndrom (IBS)", "Schilddrüsen-stimulierendes Hormon (TSH)", "Gelenkschmerzen (joint pain)". Niemals nur den englischen Originaltext stehen lassen — IMMER deutsch primär. Einheiten (mg/dl, mmol/l, ng/ml …) und Eigennamen (Markennamen, Personennamen) bleiben unverändert.
- Anonymisierung respektieren. Heilpraktiker oder Arzt gleichrangig nennen.

📅 DATUMS-PFLICHT (zeitlicher Verlauf ist kritisch — STRENG!):
- Bei JEDEM Eintrag in documents, diagnoses, medicationsTherapies, anamnese.recentExaminations, anamnese.additionalInvestigations, findings, labValues UNBEDINGT das Untersuchungs-/Befunddatum mitgeben (Feld "datum", Format ISO YYYY-MM-DD wenn möglich, sonst original wie "12.03.2025" oder "03/2025").
- ⚠️ KRITISCH: JEDER EINZELNE Laborwert / jede Einzel-Messung / jeder Einzel-Befund braucht ein Datum — NICHT NUR die übergeordnete Untersuchung. Beispiel: Wenn ein Stuhlbefund vom 26.05.2025 zehn Einzelparameter (Calprotectin, sIgA, Zonulin, Bakterienstämme, Pilze …) enthält, dann erhält JEDER dieser zehn Parameter "datum":"2025-05-26" — auch wenn das Datum nur EINMAL oben im Befund steht. NIEMALS Einzelwerte ohne Datum ausgeben.
- DATUMS-PROPAGATION: Erkenne das übergeordnete Befunddatum (aus "BEFUND VOM:", Header, Probenabnahme, Eingangsdatum, Endbefund-Datum) und übernimm es automatisch auf ALLE Einzelwerte/Befunde dieses Dokumentblocks, sofern kein spezifischeres Einzeldatum am Wert selbst steht.
- Wenn ein Dokument mehrere Untersuchungstage enthält (z.B. Verlaufslabor mit Spalten 12.03.2024 | 28.09.2024): die Werte pro Tag getrennt extrahieren — NICHT zusammenwerfen. Bei Verlaufslabor: pro Parameter so viele Einträge wie Messzeitpunkte.
- Im Dokumentblock-Label und im "BEFUND VOM:"-Header steht meist das Datum. Wenn wirklich nirgends auffindbar (auch nicht im Header oder Quellenlabel): datum = "" und in openQuestions notieren ("Datum von … fehlt").
- Für Laborwerte zusätzlich die strukturierte Liste "labValues" füllen: pro Parameter EIN Eintrag pro Messdatum (also bei Verlauf 3× = 3 Einträge), JEDER mit gefülltem "datum".
- ALLE erkannten Laborwerte in "labValues" übernehmen, auch Werte innerhalb des allgemeinen Referenzbereichs. Normale Werte niemals allein wegen ihrer Bewertung auslassen, weil sie für einen dokumentübergreifenden Verlauf relevant sein können.
- Die Bewertung in diesem isolierten Teilpaket nur anhand des vorliegenden Werts, Referenzbereichs und direkt vorhandenen Kontexts vergeben. Keine fehlenden Vorwerte aus anderen Teilpaketen erfinden; die dokumentübergreifende Verlaufsbewertung erfolgt erst nach der Zusammenführung.
- Vor dem Antworten Selbst-Check: "Hat JEDER labValues-/findings-/diagnoses-Eintrag ein nicht-leeres datum-Feld? Wenn nein → Datum aus Dokumentblock-Header übernehmen oder leeres datum dokumentieren."



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
    "reviewOfSystems": [{"system":"","befund":"","datum":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "recentExaminations": [{"text":"","datum":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "vaccinationStatus": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "familyHistory": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "socialStatus": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "physicalExamination": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}],
    "additionalInvestigations": [{"text":"","beleg":{"quelle":"","teil":"","zitat":""}}]
  },
  "diagnoses": [{"icd10":"","diagnose":"","quelle":"","datum":"","status":"gesichert|Verdacht|Z.n.|unklar","beleg":{"quelle":"","teil":"","zitat":""}}],
  "medicationsTherapies": [{"name":"","dosis":"","vonWem":"","datum":"","indikation":"","wirkmechanismus":"","nebenwirkungen":"","grundVerordnung":"","status":"laufend|abgesetzt|unklar","beleg":{"quelle":"","teil":"","zitat":""}}],
  "labValues": [{"datum":"","parameter":"","wert":"","einheit":"","referenz":"","bewertung":"normal|↑|↓|kritisch|unklar","quelle":"","beleg":{"quelle":"","teil":"","zitat":""}}],
  "findings": [{"text":"","datum":"","beleg":{"quelle":"","teil":"","zitat":""}}],

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
  const prevCompareRaw = typeof b.previousResultForCompare === "string" ? b.previousResultForCompare.trim() : "";
  const prevCompare = prevCompareRaw ? prevCompareRaw.slice(0, 18000) : "";
  const compareBlock = prevCompare
    ? `\n\n🔁 VERGLEICHSANKER — VORHERIGE BEFUND-AUSWERTUNG (NUR REFERENZ, KEINE QUELLE DER WAHRHEIT):\nDie folgende Auswertung wurde zu einem früheren Zeitpunkt aus älteren Quellen erstellt. Sie ist KEIN Beleg — Belege kommen ausschließlich aus den TEILANALYSEN unten. Nutze den Vergleichsanker NUR, um festzustellen, was im Vergleich zur jetzigen Auswertung gleich geblieben, geändert, neu oder widerlegt ist.\n\nPFLICHT: Direkt nach <h1>Befund-Auswertung</h1> und vor Sektion 2 eine neue Sektion einfügen:\n<h2>0. Vergleich zur vorherigen Auswertung</h2>\nmit kurzer Tabelle: Punkt | Status | Begründung. Status-Marker:\n  ✅ bestätigt — Aussage steht weiterhin und ist durch aktuelle Quellen belegt\n  🔄 geändert — Aussage existiert weiter, aber Wert/Datum/Bewertung hat sich geändert\n  🆕 neu — kommt nur aus neuen Quellen, war im Vorbefund nicht enthalten\n  ❌ widerlegt — alte Aussage wird durch neue Quellen nicht mehr gestützt\n  ⚠️ offen — aus alten Quellen erwähnt, in neuen Quellen weder bestätigt noch widerlegt\nDanach NORMAL mit Sektion 2 fortfahren. Die Inhalte der restlichen Sektionen kommen AUSSCHLIESSLICH aus den aktuellen Teilanalysen, nicht aus dem Vorbefund.\n\n--- VORBEFUND (Referenz, gekürzt auf ${prevCompare.length.toLocaleString("de-DE")} Zeichen) ---\n${prevCompare}\n--- ENDE VORBEFUND ---\n`
    : "";
  return `Erstelle aus diesen Teilanalysen eine vollständige, print-taugliche HTML-Befund-Auswertung für den Heilpraktiker Peter Rauch (Behandler). Peter Rauch ist NICHT der Patient — der Patient bleibt im gesamten Output anonym ("der Patient" / "die Patientin"). Verwende NIEMALS "Herr Rauch" oder andere echte Patientennamen, selbst wenn diese in den Teilanalysen auftauchen.${compareBlock}

Patientenkontext: ${patientContext(b)}
Verarbeiteter Umfang: ${totalChars.toLocaleString("de-DE")} Zeichen in ${chunkCount} Teilpaketen. Wichtig: Es wurden alle übergebenen Dokumentblöcke verarbeitet; keine künstliche Seitenbegrenzung.
${cleanText(b.mannayanOrdersText) ? `\nPatientenbezogene Mannayan-Bestellungen (PFLICHT in Sektion 6b sichtbar prüfen):\n${cleanText(b.mannayanOrdersText)}\n` : ""}

VERBINDLICHE OUTPUT-STRUKTUR:
- Ausschließlich vollständiges HTML: <!DOCTYPE html> ... </html>
- Deutsche Sprache, eingebettetes CSS, serifenfreie Schrift, Akzentfarbe #6b8e6b, A4/Print-tauglich, Tabellen mit dünner Border, h2 mit linker Bordleiste. Belege/Zitate in kleinerer Schrift (font-size:0.85em, color:#5a6b5a, kursiv) darstellen.
- Keine Therapie-Empfehlung, keine Mittel-Vorschläge. Es geht um Befundübersicht, Einordnung und Vorbereitung des Erstgesprächs.
- Sektions-Struktur ist vorgegeben; Sektionsüberschriften erscheinen immer. ABER: eine Unter-Kategorie/Zeile innerhalb einer Sektion nur dann anlegen, wenn dazu tatsächlich Patient-/Befund-Inhalt aus den Teilanalysen vorliegt. Wenn eine gesamte Unterkategorie leer ist (z.B. Patient hat "IV. Herz & Kreislauf" im Anamnesebogen komplett leer gelassen), einen einzigen kurzen Satz schreiben: "Vom Patienten nicht ausgefüllt." — KEINE aufgezählten Formularlabels, KEINE "[Datum entfernt]"-Platzhalterzeilen, KEINE leeren Bullet-Listen.
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
1. <h1>Befund-Auswertung</h1> + Auswertungs-Zeitpunkt (Datum **und** Uhrzeit, Format TT.MM.JJJJ HH:MM Uhr) + Pseudonym
2. Übersicht der eingereichten Unterlagen — Tabelle: Anzahl Teilpakete/Dokumente, geschätzter Umfang, Sprachen, Zeitraum.
3. Chronologische Untersuchungs-Übersicht — Tabelle: Datum | Arzt/Labor | Untersuchung | Hauptbefund | Auffällig? | Beleg (Quelle+Teil+Zitat); neueste zuerst.
4. Strukturierte Anamnese-Übersicht — pro Unterkategorie <h3> + Tabelle mit Spalten: Eintrag | Beleg. ALLE folgenden Unterpunkte sind PFLICHT in dieser Reihenfolge:
   4.1 Aktuelle Beschwerden (Current medical problems)
   4.2 Vorerkrankungen / OPs / Z.n. (Past medical history)
   4.3 Allergien & Unverträglichkeiten (Allergies)
   4.4 Aktuelle Medikation — Kurzliste (Details in Sektion 6)
   4.5 Genussmittel & Lebensgewohnheiten (Habits)
   4.6 Systemanamnese (Review of systems) — Tabelle System | Befund | **Datum** | Beleg. ⚠️ Das Datum-Feld ist PFLICHT: Wenn der Befund aus einem datierten Dokumentblock stammt (z.B. „Stuhlbefund 26.05.2025"), genau dieses Datum übernehmen — niemals leer lassen, sondern bei wirklich fehlendem Datum "(Datum unbekannt)" eintragen und unter Sektion 10 als offene Frage erfassen. Werte/Symptome, die zu unterschiedlichen Zeitpunkten erhoben wurden, ERSCHEINEN ALS MEHRERE ZEILEN, eine pro Datum — niemals zusammenfassen.
   4.7 Letzte Untersuchungen / Kontrollen (Recent examinations) — Spalte Datum PFLICHT.
   4.8 Impfstatus (Vaccination status)
   4.9 Familienanamnese (Family history)
   4.10 Sozialanamnese (Social status)
   4.11 Körperliche Untersuchung (Physical examination)
   4.12 Weiterführende Untersuchungen (Additional investigations)
5. Diagnosen & Verdachtsdiagnosen — Tabelle: ICD-10 | Diagnose | Quelle | Status | Beleg.
6. Medikamente, Präparate & Therapien — DETAIL-Tabelle ALLER Mittel. Spalten: Mittel/Wirkstoff (Dosis) | von wem | Datum | Indikation | Wirkmechanismus | Nebenwirkungen | Grund | Status | Beleg. Standard-Pharmakologie markieren. Wenn keinerlei Mittel: "Keine Medikamente/Therapien in den Unterlagen dokumentiert."
6b. 🧾 Prüfung der Mannayan-Bestellungen (PFLICHT, wenn im Quellblock „Mannayan-Bestellungen" Inhalte vorhanden sind) — Tabelle: Bestelldatum | Bestell-Nr. | Mittel | Bezug zu Symptom/Pathogen/Diagnose aus diesem Befund | Bewertung (✅ passt · 🔄 anpassen · ❓ unklare Indikation · ⚠️ Risiko/Wechselwirkung · ❌ nicht passend) | Beleg. Pro Mittel klare Begründung. Wenn keine Mannayan-Bestellungen übergeben wurden: kurzen Satz "Keine Mannayan-Bestellungen zugeordnet." schreiben.
7. Auffälligkeiten, Widersprüche, fehlende Befunde — Bullet-Liste mit Beleg pro Punkt.
8. Übersetzung Ärzte-Sprache → Patienten-Sprache — Tabelle: Fachbegriff | Bedeutung.
9. Gesamtbild & Arbeitshypothese — 1–3 Absätze. JEDER Satz mit Beleg(en) am Ende ODER mit "🟡 Hypothese" markiert. Keine Therapie.
10. Empfohlenes Vorgehen für das Erstgespräch — nummeriert: Fragen, eigene Untersuchungen (EAV/NLS/Bioresonanz/Labor-Ergänzung), fehlende Befunde, Differentialdiagnosen (jede DD mit Beleg ODER 🟡-Hypothese-Marker + Begründung warum sie zu prüfen ist), Priorität.
11. Sicherheitshinweise / Red Flags — falls nichts kritisch: kurz vermerken. Mit Beleg.
12. Laborwert-Verlauf (chronologisch) — PFLICHT, sortierbar pro Parameter. Tabelle: Parameter | Datum | Wert | Einheit | Referenz | Bewertung (↑/↓/normal/kritisch) | Quelle/Beleg. Werte desselben Parameters über mehrere Daten hinweg DIREKT untereinander gruppieren (z.B. Vitamin D · 12.03.2024 · 18 ng/ml ↓ — Vitamin D · 28.09.2024 · 34 ng/ml normal), damit der Verlauf sofort sichtbar ist. Der jeweils neueste Wert pro Parameter wird zusätzlich fett markiert. Wenn kein Datum auffindbar: "(Datum unbekannt)" eintragen UND in Sektion 10 als offene Frage führen.
13. ⚠️ Auffällige oder erkrankungs-/therapiebezogen sensible Laborwerte — Kurzfassung & klinische Einordnung (PFLICHT, kommt am Schluss als Quintessenz). Parameter mit Bewertung ↑, ↓ oder „kritisch" aufnehmen. ZUSAETZLICH für jede belegte Erkrankung, Operation oder laufende/abgeschlossene Therapie prüfen, welche Laborparameter auch innerhalb des allgemeinen Referenzbereichs besonders sensibel oder verlaufsrelevant sind. Diese Werte mit dokumentiertem Kontext, Verlauf, neutraler Begründung und Beleg aufnehmen. Für PSA gilt: Bei dokumentiert behandeltem Prostatakarzinom den Verlauf behandlungsspezifisch beurteilen. Nach dokumentierter Prostatektomie bereits einen nachvollziehbaren Anstieg oder einen nachweisbaren Wert ab 0,1 ng/ml, ausdrücklich auch 0,17 oder 0,24 ng/ml, als „sensibler PSA-Verlauf — zeitnah ärztlich/urologisch kontrollieren und bestätigen" kennzeichnen. Nach Bestrahlung oder Hormontherapie keine Prostatektomie-Schwelle übertragen, sondern den belegten Verlauf neutral als kontrollbedürftig markieren. Daraus NIEMALS automatisch die Diagnose „Rezidiv" ableiten. Keine pauschale Prozent- oder Deltaregel auf andere Laborparameter anwenden. Tabelle mit Spalten: Parameter (deutsch) | Aktueller Wert + Einheit | Datum | Referenz | Richtung (↑/↓/kritisch/Verlauf) | Erkrankungs-/Therapiebezug und mögliche Bedeutung (1–2 Sätze, neutral, keine Diagnose, keine Therapie) | Beleg. Bei Verlaufslabor IMMER den neuesten Wert nehmen. Wenn weder pathologische noch kontextrelevante Werte vorhanden sind: einen entsprechenden kurzen Satz ausgeben. Diese Sektion ist die zentrale Quintessenz für das Erstgespräch.

TEILANALYSEN (JSON/Notizen):
${partials.map((p, i) => `\n--- TEILANALYSE ${i + 1} ---\n${p}`).join("\n")}`;
}

function extractJsonish(text: string) {
  const cleaned = text.replace(/^\s*```json\s*/i, "").replace(/^\s*```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) return cleaned;
  const closer = cleaned[start] === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  return end > start ? cleaned.slice(start, end + 1).trim() : cleaned.slice(start).trim();
}

function normalizeJsonText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\(?!["\\/bfnrtu])/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/(["}\]\d])\s+(?="[A-Za-zÄÖÜäöüß_][^"\n]{0,80}"\s*:)/g, "$1,")
    .replace(/,\s*([}\]])/g, "$1");
}

function repairJsonStringSyntax(value: string) {
  let out = "";
  let inString = false;
  let escape = false;
  let role: "key" | "value" = "value";
  const stack: Array<{ type: "object" | "array"; expect: "key" | "value" | "colon" | "commaOrEnd" }> = [];
  const nextNonWhitespace = (from: number) => {
    for (let j = from; j < value.length; j += 1) if (!/\s/.test(value[j])) return value[j];
    return "";
  };
  const top = () => stack[stack.length - 1];

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (!inString) {
      if (ch === "{") stack.push({ type: "object", expect: "key" });
      else if (ch === "[") stack.push({ type: "array", expect: "value" });
      else if (ch === "}" || ch === "]") stack.pop();
      else if (ch === ":" && top()?.type === "object") top()!.expect = "value";
      else if (ch === "," && top()) top()!.expect = top()!.type === "object" ? "key" : "value";
      if (ch === '"') {
        role = top()?.type === "object" && top()?.expect === "key" ? "key" : "value";
        inString = true;
      }
      out += ch;
      continue;
    }
    if (escape) { out += ch; escape = false; continue; }
    if (ch === "\\") { out += ch; escape = true; continue; }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }
    if (ch === '"') {
      const next = nextNonWhitespace(i + 1);
      const closes = role === "key" ? next === ":" : !next || next === "," || next === "}" || next === "]";
      if (closes) {
        inString = false;
        if (top()) top()!.expect = role === "key" ? "colon" : "commaOrEnd";
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

function parseJsonPrefix(value: string): any {
  for (let cut = value.length; cut > Math.max(0, value.length - 5000); cut -= 1) {
    try { return JSON.parse(value.slice(0, cut)); } catch { /* scan backward */ }
  }
  return JSON.parse(value);
}

/** LLM-tolerant JSON parser: repariert die typischen Müll-Fälle (ungültige Escapes, trailing commas, abgeschnittenes JSON). */
function parseLlmJson(raw: string): any {
  const cleaned = extractJsonish(raw);
  try { return JSON.parse(cleaned); } catch { /* repair */ }
  let r = normalizeJsonText(cleaned);
  try { return JSON.parse(r); } catch { /* try bracket fix */ }
  r = normalizeJsonText(repairJsonStringSyntax(r));
  try { return JSON.parse(r); } catch { /* try bracket fix */ }
  const opens = (r.match(/[{[]/g) || []).length;
  const closes = (r.match(/[}\]]/g) || []).length;
  if (opens > closes) {
    const stack: string[] = [];
    let inString = false; let escape = false;
    for (const ch of r) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
    let suffix = "";
    if (inString) suffix += '"';
    while (stack.length) {
      const open = stack.pop();
      suffix += open === "{" ? "}" : "]";
    }
    try { return JSON.parse(r + suffix); } catch { /* fall through */ }
  }
  try { return parseJsonPrefix(r); } catch { /* original error */ }
  return JSON.parse(cleaned);
}

function normalizePartialAnalysisJson(raw: string) {
  const parsed = parseLlmJson(raw);
  const candidates = [parsed, parsed?.analysis, parsed?.teilauswertung, parsed?.teilauswertungJson, parsed?.result, parsed?.data].filter(Boolean);
  const source = candidates.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) as Record<string, any> | undefined;
  if (!source) throw new Error("Teilanalysen-JSON ist kein Objekt");
  // Hinweis: leere Teilanalysen sind erlaubt (z.B. Deckblatt/Whitespace-Chunk).
  // Wir normalisieren zu einem leeren Objekt statt einen Fehler zu werfen,
  // damit ein einzelnes „inhaltloses" Teilpaket nicht die gesamte Analyse killt.
  const normalized: Record<string, any> = {};
  for (const key of ANALYSIS_REQUIRED_ARRAY_KEYS) normalized[key] = Array.isArray(source[key]) ? source[key] : [];
  const sourceAnamnese = source.anamnese && typeof source.anamnese === "object" ? source.anamnese : {};
  normalized.anamnese = Object.fromEntries(ANALYSIS_ANAMNESE_KEYS.map((key) => [key, Array.isArray(sourceAnamnese[key]) ? sourceAnamnese[key] : []]));
  return JSON.stringify(normalized);
}

function countPartialExtractionItems(partials: string[]) {
  return partials.reduce((sum, partial) => {
    try {
      const parsed = parseLlmJson(partial);
      return sum + countAnalysisObjectItems(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
    } catch {
      return sum;
    }
  }, 0);
}

function stripHtmlFence(text: string) {
  return text.replace(/^\s*```html\s*/i, "").replace(/^\s*```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCompleteFinalHtml(html: string) {
  const cleaned = stripHtmlFence(html);
  const visible = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /<\/?html[\s>]/i.test(cleaned)
    && /<\/?body[\s>]/i.test(cleaned)
    && /<\/body>|<\/html>/i.test(cleaned)
    && /Befund-Auswertung|Diagnosen|Medikamente|Anamnese/i.test(visible)
    && visible.length > 600;
}

function buildDeterministicFinalHtml(partials: string[], b: AnalyzeBody, totalChars: number, chunkCount: number) {
  const aggregate: Record<string, unknown[]> = {
    documents: [], diagnoses: [], medicationsTherapies: [], labValues: [], findings: [], terms: [], redFlags: [], systemsPatterns: [], openQuestions: [], missingReports: [],
  };
  const anamneseKeys = [
    "currentProblems", "pastHistory", "allergies", "presentMedication", "habits", "reviewOfSystems",
    "recentExaminations", "vaccinationStatus", "familyHistory", "socialStatus", "physicalExamination", "additionalInvestigations",
  ];
  const anamnese: Record<string, unknown[]> = Object.fromEntries(anamneseKeys.map((key) => [key, []]));

  for (const partial of partials) {
    try {
      const parsed = parseLlmJson(partial);
      for (const key of Object.keys(aggregate)) {
        if (Array.isArray(parsed?.[key])) aggregate[key].push(...parsed[key]);
      }
      for (const key of anamneseKeys) {
        if (Array.isArray(parsed?.anamnese?.[key])) anamnese[key].push(...parsed.anamnese[key]);
      }
    } catch {
      aggregate.missingReports.push("Eine Teilanalyse war nicht als JSON lesbar und wurde im Fallback nur als technische Quelle berücksichtigt.");
    }
  }

  const labHighlights = buildClinicallyRelevantLabHighlights(
    aggregate.labValues as Record<string, unknown>[],
    {
      documents: aggregate.documents,
      diagnoses: aggregate.diagnoses,
      medicationsTherapies: aggregate.medicationsTherapies,
      findings: aggregate.findings,
      systemsPatterns: aggregate.systemsPatterns,
      anamnese,
    },
  );

  const beleg = (item: any) => {
    const b = item?.beleg || {};
    const parts = [b.quelle, b.teil ? `Teil ${b.teil}` : "", b.zitat ? `„${b.zitat}“` : ""].filter(Boolean).join(" · ");
    return parts ? `<span class="beleg">📄 ${escapeHtml(parts)}</span>` : `<span class="beleg">Kein Einzelbeleg in der Teilanalyse ausgewiesen.</span>`;
  };
  const dateOf = (item: any) => String(
    item?.datum || item?.date || item?.befunddatum || item?.untersuchungsdatum ||
    (String(item?.quelle || item?.beleg?.quelle || item?.beleg?.zitat || "").match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{4}\b/)?.[0]) ||
    "(Datum unbekannt)"
  );
  const parseMannayanRows = (text?: string) => {
    const rows: Array<{ order: string; date: string; item: string }> = [];
    const source = cleanText(text);
    if (!source) return rows;
    for (const block of source.split(/\n{2,}(?=Bestellung\s+)/i)) {
      const header = block.match(/^Bestellung\s+(.+?)\s+vom\s+([^\n]+)/i);
      const order = header?.[1]?.trim() || "—";
      const date = header?.[2]?.replace(/·.*$/, "").trim() || "Datum unbekannt";
      for (const line of block.split(/\n/).filter((l) => /^\s*-\s+/.test(l))) rows.push({ order, date, item: line.replace(/^\s*-\s+/, "").trim() });
    }
    return rows;
  };
  const val = (item: any, key = "text") => escapeHtml(typeof item === "string" ? item : item?.[key] || item?.diagnose || item?.name || "In den vorliegenden Unterlagen nicht dokumentiert.");
  const rows = (items: unknown[], cells: (item: any) => string) => items.length
    ? items.map((item) => `<tr>${cells(item)}</tr>`).join("\n")
    : `<tr><td colspan="9" class="empty">In den vorliegenden Unterlagen nicht dokumentiert.</td></tr>`;
  const bullets = (items: unknown[]) => items.length
    ? `<ul>${items.map((item: any) => `<li>${val(item)} ${typeof item === "object" ? beleg(item) : ""}</li>`).join("")}</ul>`
    : `<p class="empty">In den vorliegenden Unterlagen nicht dokumentiert.</p>`;
  const anamnesisTable = (title: string, key: string, options?: { system?: boolean; date?: boolean }) => {
    const system = !!options?.system;
    const showDate = !!options?.date || system;
    const header = `${system ? "<th>System</th><th>Befund</th>" : "<th>Eintrag</th>"}${showDate ? "<th>Datum</th>" : ""}<th>Beleg</th>`;
    return `
    <h3>${escapeHtml(title)}</h3>
    <table><thead><tr>${header}</tr></thead><tbody>
      ${rows(anamnese[key], (item: any) => system
        ? `<td>${escapeHtml(item?.system || "—")}</td><td>${escapeHtml(item?.befund || item?.text || "—")}</td>${showDate ? `<td>${escapeHtml(dateOf(item))}</td>` : ""}<td>${beleg(item)}</td>`
        : `<td>${val(item)}</td>${showDate ? `<td>${escapeHtml(dateOf(item))}</td>` : ""}<td>${beleg(item)}</td>`)}
    </tbody></table>`;
  };

  const duplicateNotes = Array.isArray(b.duplicateNotes) ? b.duplicateNotes.filter((x) => typeof x === "string" && x.trim()) : [];
  const today = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) + " Uhr";
  const mannayanRows = parseMannayanRows(b.mannayanOrdersText);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Befund-Auswertung</title>
  <style>
    @page { size: A4; margin: 1.7cm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #263128; line-height: 1.48; margin: 0; padding: 28px; background: #fff; }
    h1 { color: #4f744f; border-bottom: 3px solid #6b8e6b; padding-bottom: 10px; margin: 0 0 12px; }
    h2 { color: #4f744f; border-left: 5px solid #6b8e6b; padding-left: 10px; margin-top: 28px; page-break-after: avoid; }
    h3 { color: #52614f; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 0.92rem; }
    th, td { border: 1px solid #d9e1d6; padding: 7px 8px; vertical-align: top; }
    th { background: #eef4eb; text-align: left; color: #394a37; }
    .meta, .notice { background: #f7faf4; border: 1px solid #d9e1d6; padding: 10px 12px; margin: 10px 0; }
    .beleg { display: block; margin-top: 4px; font-size: 0.84em; color: #5a6b5a; font-style: italic; }
    .empty { color: #6f786c; font-style: italic; }
    .red { color: #a33; font-weight: 700; }
    ul, ol { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>Befund-Auswertung</h1>
  <div class="meta"><strong>Datum:</strong> ${escapeHtml(today)} · <strong>Patient:</strong> ${escapeHtml(patientContext(b))} · <strong>Umfang:</strong> ${escapeHtml(totalChars.toLocaleString("de-DE"))} Zeichen / ${escapeHtml(chunkCount)} Teilpaket(e)</div>
  <div class="notice"><strong>Hinweis:</strong> Diese Ausgabe wurde aus den vollständig gespeicherten Teilanalysen stabil rekonstruiert, weil die KI-HTML-Zusammenführung unvollständig ausgeliefert wurde. Die Extraktionsdaten bleiben erhalten; keine Therapie-Empfehlung.</div>

  <h2>1. Übersicht der eingereichten Unterlagen</h2>
  <table><tbody><tr><th>Teilpakete</th><td>${escapeHtml(chunkCount)}</td></tr><tr><th>Verarbeiteter Umfang</th><td>${escapeHtml(totalChars.toLocaleString("de-DE"))} Zeichen</td></tr><tr><th>Duplikate</th><td>${duplicateNotes.length ? duplicateNotes.map(escapeHtml).join("<br>") : "Keine vorab erkannten identischen Duplikate."}</td></tr></tbody></table>

  <h2>2. Chronologische Untersuchungs-Übersicht</h2>
  <table><thead><tr><th>Datum</th><th>Quelle</th><th>Untersuchung</th><th>Hauptbefund</th><th>Auffällig?</th><th>Beleg</th></tr></thead><tbody>${rows(aggregate.documents, (item: any) => `<td>${escapeHtml(item?.datum || "—")}</td><td>${escapeHtml(item?.quelle || item?.beleg?.quelle || "—")}</td><td>${escapeHtml(item?.untersuchung || "—")}</td><td>${escapeHtml(item?.hauptbefund || "—")}</td><td>${escapeHtml(item?.auffaellig || "—")}</td><td>${beleg(item)}</td>`)}</tbody></table>

  <h2>3. Strukturierte Anamnese-Übersicht</h2>
  ${anamnesisTable("Aktuelle Beschwerden", "currentProblems")}
  ${anamnesisTable("Vorerkrankungen / OPs / Z.n.", "pastHistory")}
  ${anamnesisTable("Allergien & Unverträglichkeiten", "allergies")}
  ${anamnesisTable("Aktuelle Medikation — Kurzliste", "presentMedication")}
  ${anamnesisTable("Genussmittel & Lebensgewohnheiten", "habits")}
  ${anamnesisTable("Systemanamnese", "reviewOfSystems", { system: true })}
  ${anamnesisTable("Letzte Untersuchungen / Kontrollen", "recentExaminations", { date: true })}
  ${anamnesisTable("Impfstatus", "vaccinationStatus")}
  ${anamnesisTable("Familienanamnese", "familyHistory")}
  ${anamnesisTable("Sozialanamnese", "socialStatus")}
  ${anamnesisTable("Körperliche Untersuchung", "physicalExamination")}
  ${anamnesisTable("Weiterführende Untersuchungen", "additionalInvestigations")}

  <h2>4. Diagnosen & Verdachtsdiagnosen</h2>
  <table><thead><tr><th>ICD-10</th><th>Diagnose</th><th>Datum</th><th>Quelle</th><th>Status</th><th>Beleg</th></tr></thead><tbody>${rows(aggregate.diagnoses, (item: any) => `<td>${escapeHtml(item?.icd10 || "—")}</td><td>${escapeHtml(item?.diagnose || "—")}</td><td>${escapeHtml(dateOf(item))}</td><td>${escapeHtml(item?.quelle || item?.beleg?.quelle || "—")}</td><td>${escapeHtml(item?.status || "unklar")}</td><td>${beleg(item)}</td>`)}</tbody></table>

  <h2>5. Medikamente, Präparate & Therapien</h2>
  <table><thead><tr><th>Mittel/Wirkstoff</th><th>Dosis</th><th>von wem</th><th>Datum</th><th>Indikation</th><th>Wirkmechanismus</th><th>Nebenwirkungen</th><th>Status</th><th>Beleg</th></tr></thead><tbody>${rows(aggregate.medicationsTherapies, (item: any) => `<td>${escapeHtml(item?.name || "—")}</td><td>${escapeHtml(item?.dosis || "—")}</td><td>${escapeHtml(item?.vonWem || "—")}</td><td>${escapeHtml(item?.datum || "—")}</td><td>${escapeHtml(item?.indikation || item?.grundVerordnung || "—")}</td><td>${escapeHtml(item?.wirkmechanismus || "—")}</td><td>${escapeHtml(item?.nebenwirkungen || "—")}</td><td>${escapeHtml(item?.status || "unklar")}</td><td>${beleg(item)}</td>`)}</tbody></table>

  <h2>6. Laborwert-Verlauf (chronologisch)</h2>
  ${(() => {
    const lv = (aggregate.labValues as any[]).slice();
    lv.sort((a, b) => String(a?.parameter || "").localeCompare(String(b?.parameter || ""), "de") || String(b?.datum || "").localeCompare(String(a?.datum || "")));
    // markiere neuesten Wert pro Parameter
    const newestByParam = new Map<string, string>();
    for (const v of lv) {
      const p = String(v?.parameter || "");
      const d = String(v?.datum || "");
      if (!newestByParam.has(p) || d > (newestByParam.get(p) || "")) newestByParam.set(p, d);
    }
    return `<table><thead><tr><th>Parameter</th><th>Datum</th><th>Wert</th><th>Einheit</th><th>Referenz</th><th>Bewertung</th><th>Quelle</th><th>Beleg</th></tr></thead><tbody>${rows(lv, (item: any) => {
      const isNewest = newestByParam.get(String(item?.parameter || "")) === String(item?.datum || "") && item?.datum;
      const w = (s: string) => isNewest ? `<strong>${s}</strong>` : s;
      return `<td>${w(escapeHtml(item?.parameter || "—"))}</td><td>${w(escapeHtml(item?.datum || "(Datum unbekannt)"))}</td><td>${w(escapeHtml(item?.wert || "—"))}</td><td>${escapeHtml(item?.einheit || "")}</td><td>${escapeHtml(item?.referenz || "")}</td><td>${escapeHtml(item?.bewertung || "—")}</td><td>${escapeHtml(item?.quelle || item?.beleg?.quelle || "—")}</td><td>${beleg(item)}</td>`;
    })}</tbody></table>`;
  })()}

  <h2>⚠️ Auffällige oder kontextrelevante Laborwerte — Quintessenz für das Erstgespräch</h2>
  ${(() => {
    if (!labHighlights.length) return `<p class="empty">Keine pathologischen oder im dokumentierten Behandlungskontext relevanten Laborverläufe erkannt.</p>`;
    return `<table><thead><tr><th>Parameter</th><th>Wert</th><th>Datum</th><th>Referenz</th><th>Richtung</th><th>Mögliche klinische Bedeutung</th><th>Beleg</th></tr></thead><tbody>${labHighlights.map((highlight) => {
      const item = highlight.item;
      return `<tr><td><strong>${escapeHtml(item?.parameter || "—")}</strong></td><td>${escapeHtml(item?.wert || "—")} ${escapeHtml(item?.einheit || "")}</td><td>${escapeHtml(item?.datum || "(Datum unbekannt)")}</td><td>${escapeHtml(item?.referenz || "—")}</td><td>${escapeHtml(highlight.direction)}</td><td>${escapeHtml(highlight.significance)}</td><td>${beleg(item)}</td></tr>`;
    }).join("\n")}</tbody></table>`;
  })()}

  <h2>6b. 🧾 Prüfung der Mannayan-Bestellungen</h2>
  ${mannayanRows.length
    ? `<table><thead><tr><th>Bestelldatum</th><th>Bestell-Nr.</th><th>Mittel</th><th>Bezug zu Befund/Symptom/Pathogen</th><th>Bewertung</th><th>Beleg</th></tr></thead><tbody>${rows(mannayanRows, (row: any) => `<td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.order)}</td><td>${escapeHtml(row.item)}</td><td>Gegen dokumentierte Beschwerden, Diagnosen, Pathogene und Laborauffälligkeiten prüfen.</td><td>❓ unklare Indikation / manuell prüfen</td><td>📄 Mannayan-Bestellung ${escapeHtml(row.order)}</td>`)}</tbody></table>`
    : `<p class="empty">Keine Mannayan-Bestellungen zugeordnet.</p>`}

  <h2>7. Auffälligkeiten, Widersprüche, fehlende Befunde</h2>${bullets([...aggregate.findings, ...aggregate.systemsPatterns])}

  <h2>8. Übersetzung Ärzte-Sprache → Patienten-Sprache</h2><table><thead><tr><th>Fachbegriff</th><th>Bedeutung</th></tr></thead><tbody>${rows(aggregate.terms, (item: any) => `<td>${escapeHtml(item?.term || "—")}</td><td>${escapeHtml(item?.plain || "—")}</td>`)}</tbody></table>
  <h2>9. Gesamtbild & Arbeitshypothese</h2><p>Das Gesamtbild ist anhand der belegten Einzelextraktionen oben zu beurteilen. Für interpretative Hypothesen bitte die Befunde im Erstgespräch mit den Originalunterlagen gegenprüfen.</p>
  <h2>10. Empfohlenes Vorgehen für das Erstgespräch</h2>${bullets([...aggregate.openQuestions, ...aggregate.missingReports])}
  <h2>11. Sicherheitshinweise / Red Flags</h2><div class="red">${bullets(aggregate.redFlags)}</div>
  <h2>12. Dokumentationshinweis</h2><p>Heilpraktiker oder Arzt sollten fehlende Originalbefunde bei Bedarf nachfordern. Diese Befund-Auswertung ersetzt keine persönliche Untersuchung.</p>
</body>
</html>`;
}

async function callGatewayText(apiKey: string, model: string, prompt: string, temperature = 0.2, opts?: { maxTokens?: number; timeoutMs?: number; attempts?: number }): Promise<string> {
  const maxTokens = opts?.maxTokens ?? 32000;
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const attempts = opts?.attempts ?? 3;
  let lastError = "AI Gateway lieferte keine verwertbare Antwort";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
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
          max_tokens: maxTokens,
        }),
        signal: ac.signal,
      });
      const bodyText = await resp.text().catch(() => "");
      if (!resp.ok) {
        if (resp.status === 429) throw new Error("Rate-Limit erreicht. Bitte später erneut versuchen.");
        if (resp.status === 402) throw new Error("AI-Guthaben aufgebraucht. Bitte im Workspace aufladen.");
        throw new Error(`AI Gateway ${resp.status}: ${bodyText.slice(0, 500)}`);
      }
      if (!bodyText.trim()) throw new Error("AI Gateway lieferte eine leere Antwort");
      let json: any;
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error(`AI Gateway lieferte unvollständiges JSON (${bodyText.length} Zeichen)`);
      }
      const content = String(json.choices?.[0]?.message?.content || "").trim();
      if (!content) throw new Error("AI Gateway lieferte leeren Inhalt");
      return content;
    } catch (error) {
      lastError = String((error as Error)?.message || error || lastError);
      const isAbort = (error as Error)?.name === "AbortError" || /aborted/i.test(lastError);
      if (isAbort) lastError = `AI Gateway timeout nach ${Math.round(timeoutMs / 1000)}s`;
      const retryable = isAbort || /leere Antwort|unvollständiges JSON|leeren Inhalt|Unexpected end|500|502|503|504|timeout|NetworkError|Failed to fetch/i.test(lastError);
      if (attempt >= attempts || !retryable) break;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}


async function streamGatewayHtml(apiKey: string, model: string, prompt: string, deterministicFallbackHtml?: string): Promise<ReadableStream<Uint8Array>> {
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
  let outputBuffer = "";
  let lastFinishReason = "";

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.length) {
            const tail = stripHtmlFence(buffer);
            if (tail) outputBuffer += tail;
          }
          let finalHtml = stripHtmlFence(outputBuffer);
          // Wichtig: unfertiges HTML nicht ausliefern. Sonst speichert der Client eine scheinbar „fertige“, aber leere Seite.
          if (!isCompleteFinalHtml(finalHtml)) {
            console.warn(`analyze-documents final stream incomplete (chars=${finalHtml.length}, finish=${lastFinishReason}) – fallback to non-stream flash/deterministic`);
            try {
              const fallback = await callGatewayText(apiKey, "google/gemini-2.5-flash", prompt, 0.2);
              const html = stripHtmlFence(fallback);
              finalHtml = isCompleteFinalHtml(html) ? html : (deterministicFallbackHtml || html);
            } catch (fbErr) {
              console.error("fallback flash failed:", (fbErr as Error).message);
              finalHtml = deterministicFallbackHtml || `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body><h1>Befund-Auswertung</h1><p style="color:#a33">⚠ Stream leer und Fallback fehlgeschlagen: ${escapeHtml((fbErr as Error).message)}</p></body></html>`;
            }
          }
          if (!/^<!DOCTYPE/i.test(finalHtml) && !/^<html/i.test(finalHtml)) {
            finalHtml = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Befund-Auswertung</title></head><body>${finalHtml}</body></html>`;
          }
          controller.enqueue(encoder.encode(finalHtml));
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
          outputBuffer += textOut;
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
          partials.push(normalizePartialAnalysisJson(partial));
        }
        if (countPartialExtractionItems(partials) === 0) throw new Error("Die KI hat keine verwertbaren Befunddaten extrahiert; es wird kein leerer Bericht erzeugt.");
        send(`</ul><p><strong>Zusammenführung läuft…</strong></p></main>`);
        const finalPrompt = buildFinalPrompt(partials, b, totalChars, chunks.length);
        const htmlStream = await streamGatewayHtml(apiKey, model, finalPrompt, buildDeterministicFinalHtml(partials, b, totalChars, chunks.length));
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
          0.2,
          { maxTokens: 8000, timeoutMs: 55_000, attempts: 2 },
        );
      } catch (error) {
        return new Response(JSON.stringify({ error: String((error as Error)?.message || error || "Teilpaket konnte nicht vollständig ausgewertet werden") }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let normalizedPartial = "";
      try {
        normalizedPartial = normalizePartialAnalysisJson(partial);
      } catch (error) {
        return new Response(JSON.stringify({ error: `Ungültige/unkomplette Teilanalyse: ${(error as Error).message}` }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ partial: normalizedPartial, chars: text.length, recovered: false }), {
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
      if (countPartialExtractionItems(partials) === 0) {
        return new Response(JSON.stringify({ error: "Keine verwertbaren Befunddaten in den Teilanalysen; leerer Bericht wird blockiert." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const totalChars = Number(body.totalChars || 0);
      const model = body.useProModel || totalChars > 60_000
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash";
      const htmlStream = await streamGatewayHtml(
        LOVABLE_API_KEY,
        model,
        buildFinalPrompt(partials, body, totalChars, partials.length),
        buildDeterministicFinalHtml(partials, body, totalChars, partials.length),
      );
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
