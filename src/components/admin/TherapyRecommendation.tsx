import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Loader2, AlertTriangle, Baby, Pill, Heart, Send, RotateCcw, Printer, KeyRound, Sparkles, ShieldAlert, FileText, ClipboardList, Plus, X, RefreshCw, Star, Lightbulb, Search, FileUp, CheckCircle2 } from "lucide-react";
import { parseTherapyMarkdown, type FreeSection } from "@/lib/therapyParser";
import type { DiagnoseEntry } from "./therapy/printRecipe";
import { CategoryCard } from "./therapy/CategoryCard";
import { FreeSectionCard } from "./therapy/FreeSectionCard";
import { PatientContextBar } from "./therapy/PatientContextBar";
import { openPrintRecipe } from "./therapy/printRecipe";
import { PathogenInput, emptyEntry, formatPathogensForAI, type PathogenEntry } from "./therapy/PathogenInput";
import { CategoryFilter } from "./therapy/CategoryFilter";
import { PseudonymHistory, generatePseudonymId, type TherapySession } from "./therapy/PseudonymHistory";
import { PreferredRemediesCard, type PinnedRemedy } from "./therapy/PreferredRemediesCard";
import { WikiAuditCard, type WikiAuditInfo } from "./therapy/WikiAuditCard";
import { LiveInputSummary } from "./therapy/LiveInputSummary";
import { LabImageUpload } from "./therapy/LabImageUpload";
import { WorkloadBadge, WorkloadTotal } from "./therapy/WorkloadBadge";
import { MultiDocUpload } from "./therapy/MultiDocUpload";

type ManualRemedyEntry = { name: string; dosage: string; application: string; duration: string; reason: string; group: string };
type WikiRemedyEntry = { name: string; latin?: string; dosage?: string; application?: string; reason?: string };

const extractWikiField = (content: string, labels: string[]) => {
  const labelPattern = labels.join("|");
  const match = content.match(new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:\\*\\*)?(?:${labelPattern})(?:\\*\\*)?\\s*[:：-]?\\s*([^\\n]{3,220})`, "i"));
  return match?.[1]?.replace(/^[-–—\s]+/, "").trim().slice(0, 160) || "";
};

const DOSAGE_UNITS = ["Tropfen pro Tag", "Kap-Tabl pro Tag", "Teelöffel pro Tag", "Eßlöffel pro Tag"];
const INTAKE_PATTERNS = ["1-0-1", "1-0-0", "1-1-1", "über den Tag verteilt"];

const textFromClinicalValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim() ? value : "";
  if (Array.isArray(value)) return value.map(textFromClinicalValue).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["text", "content", "markdown", "value", "raw", "extractedText", "befund", "bericht", "labor", "laborKomplett", "arztbericht"]) {
      const found = textFromClinicalValue(obj[key]);
      if (found) return found;
    }
  }
  return "";
};

const pickClinicalText = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = textFromClinicalValue(source[key]);
    if (value) return value;
  }
  return "";
};

const normalizeTherapyInput = (input: unknown) => {
  const d = input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {};
  const laborText = pickClinicalText(d, ["laborKomplett", "labordaten", "laborDaten", "laborwerte", "laborWerte", "labor", "laborText", "extractedLaborText"]);
  const arztText = pickClinicalText(d, ["arztbericht", "arztbrief", "arztBrief", "arztBefund", "doctorReport", "doctorText", "extractedDoctorText"]);
  if (!textFromClinicalValue(d.laborKomplett) && laborText) d.laborKomplett = laborText;
  if (!textFromClinicalValue(d.arztbericht) && arztText) d.arztbericht = arztText;
  return d;
};

const asText = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const countClinicalLines = (value?: string) => (value || "").split(/\n+/).map((x) => x.trim()).filter(Boolean).length;

type AnalysisDocChunk = { label: string; text: string };

const ANALYSIS_CHUNK_MAX_CHARS = 3500;
const ANALYSIS_RETRY_CHUNK_MAX_CHARS = 1800;

const splitAnalysisText = (label: string, value: string, maxChars = ANALYSIS_CHUNK_MAX_CHARS): AnalysisDocChunk[] => {
  const text = value.trim();
  if (!text) return [];
  if (text.length <= maxChars) return [{ label, text }];
  const chunks: AnalysisDocChunk[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  let current = "";
  let index = 1;
  const flush = () => {
    if (!current.trim()) return;
    chunks.push({ label: `${label} – Teil ${index}`, text: current.trim() });
    current = "";
    index += 1;
  };
  for (const paragraph of paragraphs) {
    const part = paragraph.trim();
    if (!part) continue;
    if (part.length > maxChars) {
      flush();
      for (let i = 0; i < part.length; i += maxChars) {
        chunks.push({ label: `${label} – Teil ${index}`, text: part.slice(i, i + maxChars).trim() });
        index += 1;
      }
      continue;
    }
    if ((current + "\n\n" + part).length > maxChars) flush();
    current = current ? `${current}\n\n${part}` : part;
  }
  flush();
  return chunks;
};

const isRecoverableAnalysisTimeout = (message: string) => /401|Nicht autorisiert|JWT|expired|429|500|502|503|504|AI Gateway|IDLE_TIMEOUT|idle timeout|timeout|NetworkError|Failed to fetch|Zeitlimit|Leere Antwort|Ungültige JSON|ungültige\/unkomplette Teilanalyse|unvollständig/i.test(message);

type AnalysisCheckpoint = {
  version: 2 | 3;
  fingerprint: string;
  pseudonymId: string;
  totalChunks: number;
  totalChars: number;
  completedChunks: number;
  partials: string[];
  duplicateNotes?: string[];
  status?: "in_progress" | "all_chunks_complete" | "final_complete";
  updatedAt: string;
};

type PreparedAnalysis = {
  chunks: AnalysisDocChunk[];
  duplicateNotes: string[];
  originalChars: number;
  analyzedChars: number;
};

const normalizePseudonymId = (value: string) => value.trim();

const PATIENT_DATA_MISMATCH_ERROR = "Sicherheitsstopp: Patientendaten und Pseudonym-ID passen nicht zusammen.";

const analysisDelay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const buildAnalysisFingerprint = (chunks: AnalysisDocChunk[], context: string) => {
  let hash = 2166136261;
  const update = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  };
  update(context);
  chunks.forEach((chunk) => {
    update(chunk.label);
    update(String(chunk.text.length));
    update(chunk.text);
  });
  return (hash >>> 0).toString(36);
};

const getAnalysisCheckpointKey = (pseudonymId: string, fingerprint: string) => `therapy.befundAnalysis.v2.${pseudonymId.trim() || "ohne-pseudonym"}.${fingerprint}`;

const readAnalysisCheckpoint = (key: string, fingerprint: string, totalChunks: number): AnalysisCheckpoint | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const checkpoint = JSON.parse(raw) as AnalysisCheckpoint;
    if (![2, 3].includes(checkpoint?.version) || checkpoint.fingerprint !== fingerprint || checkpoint.totalChunks !== totalChunks || !Array.isArray(checkpoint.partials)) return null;
    if (checkpoint.partials.some((p) => /technisch nicht ausgewertet|technische Lücke/i.test(String(p)))) return null;
    return checkpoint;
  } catch {
    return null;
  }
};

const writeAnalysisCheckpoint = (key: string, checkpoint: AnalysisCheckpoint) => {
  try {
    localStorage.setItem(key, JSON.stringify(checkpoint));
  } catch { /* lokale Sicherung optional */ }
};

const parseAnalysisCheckpoint = (value: unknown, fingerprint: string, totalChunks: number): AnalysisCheckpoint | null => {
  const checkpoint = value as AnalysisCheckpoint | null;
  if (!checkpoint || ![2, 3].includes(checkpoint.version) || checkpoint.fingerprint !== fingerprint || checkpoint.totalChunks !== totalChunks || !Array.isArray(checkpoint.partials)) return null;
  if (checkpoint.partials.some((p) => /technisch nicht ausgewertet|technische Lücke/i.test(String(p)))) return null;
  return checkpoint;
};

const readAnalysisError = async (resp: Response) => {
  const text = await resp.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    return parsed.error || parsed.message || `HTTP ${resp.status}`;
  } catch {
    return text || `HTTP ${resp.status}`;
  }
};

const stripAnalysisFence = (value: string) => value.replace(/^\s*```(?:json|html)?\s*/i, "").replace(/```\s*$/i, "").trim();

const sanitizeFinalAnalysisHtml = (value: string) => stripAnalysisFence(value).trim();

const normalizeForDuplicateCheck = (value: string) => value
  .toLowerCase()
  .replace(/\s+/g, " ")
  .replace(/[\u00a0\t]+/g, " ")
  .trim();

const dedupeAnalysisBlockText = (block: AnalysisDocChunk, seen: Map<string, string>, duplicateNotes: string[]) => {
  const paragraphs = block.text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const kept: string[] = [];
  for (const raw of paragraphs) {
    const paragraph = raw.trim();
    if (!paragraph) continue;
    const key = normalizeForDuplicateCheck(paragraph);
    if (key.length >= 180 && seen.has(key)) {
      duplicateNotes.push(`${block.label}: identischer Abschnitt bereits berücksichtigt in ${seen.get(key)}`);
      continue;
    }
    if (key.length >= 180) seen.set(key, block.label);
    kept.push(paragraph);
  }
  return kept.join("\n\n").trim();
};

const prepareAnalysisChunks = (blocks: AnalysisDocChunk[]): PreparedAnalysis => {
  const seen = new Map<string, string>();
  const duplicateNotes: string[] = [];
  const originalChars = blocks.reduce((sum, block) => sum + block.text.trim().length, 0);
  const cleanedBlocks = blocks
    .map((block) => ({ label: block.label, text: dedupeAnalysisBlockText(block, seen, duplicateNotes) }))
    .filter((block) => block.text.trim());
  const chunks = cleanedBlocks.flatMap((block) => splitAnalysisText(block.label, block.text));
  return {
    chunks,
    duplicateNotes,
    originalChars,
    analyzedChars: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
  };
};

const assertStrictPartialAnalysis = (partial: string) => {
  if (/technisch nicht ausgewertet|technische Lücke|Teilpaket konnte technisch/i.test(partial)) {
    throw new Error("Teilpaket wurde nur als technische Lücke beantwortet – strikte Auswertung stoppt hier.");
  }
  try {
    const parsed = JSON.parse(stripAnalysisFence(partial));
    const hasRequiredArrays = Array.isArray(parsed?.documents) && Array.isArray(parsed?.diagnoses) && Array.isArray(parsed?.medicationsTherapies) && Array.isArray(parsed?.findings) && Array.isArray(parsed?.redFlags) && Array.isArray(parsed?.openQuestions) && Array.isArray(parsed?.missingReports);
    if (!hasRequiredArrays || !parsed?.anamnese || typeof parsed.anamnese !== "object") {
      throw new Error("Teilanalysen-JSON unvollständig");
    }
  } catch (error) {
    throw new Error(`Ungültige/unkomplette Teilanalyse: ${(error as Error).message}`);
  }
};

export function TherapyRecommendation() {
  const [pseudonymId, setPseudonymId] = useState("");
  const [pathogens, setPathogens] = useState<PathogenEntry[]>([emptyEntry()]);
  const [symptome, setSymptome] = useState("");
  const [erkrankung, setErkrankung] = useState("");
  const [alter, setAlter] = useState("");
  const [geschlecht, setGeschlecht] = useState("");
  const [groesseCm, setGroesseCm] = useState("");
  const [gewichtKg, setGewichtKg] = useState("");
  const [schwanger, setSchwanger] = useState("nein");
  const [medikamente, setMedikamente] = useState("");
  const [bisherigeMittel, setBisherigeMittel] = useState("");
  const [budget, setBudget] = useState("");
  const [laborErhoeht, setLaborErhoeht] = useState("");
  const [laborErniedrigt, setLaborErniedrigt] = useState("");
  const [laborKomplett, setLaborKomplett] = useState("");
  const [laborDatum, setLaborDatum] = useState("");
  const [stuhlbefund, setStuhlbefund] = useState("");
  const [arztbericht, setArztbericht] = useState("");
  const [arztberichtDatum, setArztberichtDatum] = useState("");
  const [metatronHeel, setMetatronHeel] = useState("");
  const [sonstigeUntersuchungen, setSonstigeUntersuchungen] = useState("");
  const [perplexityAnalyse, setPerplexityAnalyse] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bevorzugteLinie, setBevorzugteLinie] = useState<string[]>([]);
  const [pinnedMittel, setPinnedMittel] = useState<PinnedRemedy[]>([]);
  const [useMapReduce, setUseMapReduce] = useState(true);
  const [useProModel, setUseProModel] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [clinicalLoadInfo, setClinicalLoadInfo] = useState<{
    pid: string;
    sessionCount: number;
    laborLines: number;
    arztChars: number;
    loadedAt: string;
  } | null>(null);

  const [result, setResult] = useState("");
  const [auditInfo, setAuditInfo] = useState<WikiAuditInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzingDocs, setIsAnalyzingDocs] = useState(false);
  const [extractedFromDocs, setExtractedFromDocs] = useState<{
    diagnoses: Array<{ icd10?: string; diagnose: string; quelle?: string; status?: string; datum?: string; zitat?: string }>;
    symptoms: Array<{ text: string; quelle?: string; datum?: string; zitat?: string }>;
    medications: Array<{ name: string; dosis?: string; vonWem?: string; datum?: string; indikation?: string; wirkmechanismus?: string; nebenwirkungen?: string; grundVerordnung?: string; status?: string; quelle?: string; zitat?: string }>;
  } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [diagnosen, setDiagnosen] = useState<DiagnoseEntry[]>([]);
  const [isLoadingDiagnosen, setIsLoadingDiagnosen] = useState(false);
  const [therapieNotiz, setTherapieNotiz] = useState("");
  // Nachschlag-Modus
  const [ergaenzung, setErgaenzung] = useState("");
  const [isNachschlag, setIsNachschlag] = useState(false);
  // Manuelle Ergänzungen
  const [manualDiagnosen, setManualDiagnosen] = useState<DiagnoseEntry[]>([]);
  const [manualMittel, setManualMittel] = useState<ManualRemedyEntry[]>([]);
  // 4-Stufen-Workflow: edit (KI-Auswahl) → addons (eigene Mittel) → preview (Kontrolle) → finalized (gespeichert, Druck)
  const [workflowStage, setWorkflowStage] = useState<"edit" | "addons" | "preview" | "finalized">("edit");
  // Wiki-Autocomplete für manuelle Mittel
  const [wikiRemedies, setWikiRemedies] = useState<WikiRemedyEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const manualAddonsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveRunIdRef = useRef(0);
  const autoSaveSessionIdRef = useRef<string | null>(null);
  const checkpointSessionIdRef = useRef<string | null>(null);
  const lastAutoSavedPayloadRef = useRef("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const buildInputData = useCallback((extra: Record<string, unknown> = {}) => ({
    _pseudonym_id: normalizePseudonymId(pseudonymId),
    pseudonymId: normalizePseudonymId(pseudonymId),
    pathogens,
    symptome,
    erkrankung,
    alter,
    geschlecht,
    groesseCm,
    gewichtKg,
    schwanger,
    medikamente,
    bisherigeMittel,
    budget,
    laborErhoeht,
    laborErniedrigt,
    laborKomplett,
    laborDatum,
    stuhlbefund,
    arztbericht,
    arztberichtDatum,
    metatronHeel,
    sonstigeUntersuchungen,
    perplexityAnalyse,
    selectedCategories,
    useMapReduce,
    bevorzugteLinie,
    pinnedMittel,
    belastungen: formatPathogensForAI(pathogens),
    ...extra,
  }), [pseudonymId, pathogens, symptome, erkrankung, alter, geschlecht, groesseCm, gewichtKg, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse, selectedCategories, useMapReduce, bevorzugteLinie, pinnedMittel]);

  const assertPayloadMatchesPseudonym = useCallback((pid: string, payload: Record<string, unknown>) => {
    const embedded = normalizePseudonymId(String(payload._pseudonym_id || payload.pseudonymId || ""));
    if (embedded && embedded !== pid) throw new Error(PATIENT_DATA_MISMATCH_ERROR);
  }, []);

  const saveClinicalSnapshot = useCallback(async (extra: Record<string, unknown>, label: string) => {
    const pid = pseudonymId.trim();
    if (!pid) {
      toast({ title: "Pseudonym-ID fehlt", description: `${label} wurde ins Formular geladen, aber noch nicht in der Cloud gespeichert.`, variant: "destructive" });
      return;
    }
    autoSaveRunIdRef.current += 1;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setAutoSaveStatus("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const payload = buildInputData({ ...extra, autoSavedDraft: true, finalized: false, immediateClinicalSave: true, lastAutoSaveAt: new Date().toISOString() });
      const saveBody = {
        pseudonym_id: pid,
        created_by: user.id,
        eingabe_daten: payload,
        empfehlung: "Automatische Eingabe-Sicherung – Labor/Arztbrief sofort gespeichert.",
        notiz: `Sofort-Sicherung: ${label}`,
      };
      const { data, error } = await (supabase as any).from("therapy_sessions").insert(saveBody).select("id").single();
      if (error) throw error;
      autoSaveSessionIdRef.current = data?.id ?? autoSaveSessionIdRef.current;
      lastAutoSavedPayloadRef.current = JSON.stringify({ ...payload, lastAutoSaveAt: undefined });
      setAutoSaveStatus("saved");
      setHistoryRefresh((n) => n + 1);
      toast({ title: "Sofort gespeichert", description: `${label} wurde für ${pid} in der Cloud gesichert.` });
    } catch (error: any) {
      setAutoSaveStatus("error");
      toast({ title: "Sofort-Speicherung fehlgeschlagen", description: error?.message || "Bitte erneut anmelden.", variant: "destructive" });
    }
  }, [pseudonymId, buildInputData, toast]);

  // ---- Eingaben in sessionStorage spiegeln, damit ein versehentlicher Re-Mount
  // (z. B. durch Auth-Refresh oder Tab-Wechsel) die Daten nicht verliert. ----
  const DRAFT_KEY = "therapy.draftInputs.v1";
  const inputDraftKey = pseudonymId.trim() ? `therapy.inputs.draft.${pseudonymId.trim()}` : "";
  const draftLoadedRef = useRef(false);
  const loadedInputDraftForPidRef = useRef("");
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d?.pseudonymId === "string") setPseudonymId(d.pseudonymId);
      if (Array.isArray(d?.pathogens) && d.pathogens.length) setPathogens(d.pathogens);
      if (typeof d?.symptome === "string") setSymptome(d.symptome);
      if (typeof d?.erkrankung === "string") setErkrankung(d.erkrankung);
      if (typeof d?.alter === "string") setAlter(d.alter);
      if (typeof d?.geschlecht === "string") setGeschlecht(d.geschlecht);
      if (typeof d?.groesseCm === "string") setGroesseCm(d.groesseCm);
      if (typeof d?.gewichtKg === "string") setGewichtKg(d.gewichtKg);
      if (typeof d?.schwanger === "string") setSchwanger(d.schwanger);
      if (typeof d?.medikamente === "string") setMedikamente(d.medikamente);
      if (typeof d?.bisherigeMittel === "string") setBisherigeMittel(d.bisherigeMittel);
      if (typeof d?.budget === "string") setBudget(d.budget);
      if (typeof d?.laborErhoeht === "string") setLaborErhoeht(d.laborErhoeht);
      if (typeof d?.laborErniedrigt === "string") setLaborErniedrigt(d.laborErniedrigt);
      if (typeof d?.laborKomplett === "string") setLaborKomplett(d.laborKomplett);
      if (typeof d?.laborDatum === "string") setLaborDatum(d.laborDatum);
      if (typeof d?.stuhlbefund === "string") setStuhlbefund(d.stuhlbefund);
      if (typeof d?.arztbericht === "string") setArztbericht(d.arztbericht);
      if (typeof d?.arztberichtDatum === "string") setArztberichtDatum(d.arztberichtDatum);
      if (typeof d?.metatronHeel === "string") setMetatronHeel(d.metatronHeel);
      if (typeof d?.sonstigeUntersuchungen === "string") setSonstigeUntersuchungen(d.sonstigeUntersuchungen);
      if (typeof d?.perplexityAnalyse === "string") setPerplexityAnalyse(d.perplexityAnalyse);
      if (Array.isArray(d?.selectedCategories)) setSelectedCategories(d.selectedCategories);
      if (Array.isArray(d?.bevorzugteLinie)) setBevorzugteLinie(d.bevorzugteLinie);
      if (Array.isArray(d?.pinnedMittel)) setPinnedMittel(d.pinnedMittel);
      if (typeof d?.useProModel === "boolean") setUseProModel(d.useProModel);
    } catch {}
  }, []);
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    try {
      const draftPayload = {
        pseudonymId, pathogens, symptome, erkrankung, alter, geschlecht,
        groesseCm, gewichtKg, schwanger, medikamente, bisherigeMittel, budget,
        laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse,
        selectedCategories, bevorzugteLinie, pinnedMittel, useProModel,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));
      if (inputDraftKey) localStorage.setItem(inputDraftKey, JSON.stringify({ ...draftPayload, savedAt: new Date().toISOString() }));
    } catch {}
  }, [pseudonymId, pathogens, symptome, erkrankung, alter, geschlecht, groesseCm, gewichtKg, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse, selectedCategories, bevorzugteLinie, pinnedMittel, useProModel, inputDraftKey]);

  const applyDraftPayload = useCallback((d: any) => {
    const data = normalizeTherapyInput(d);
    if (!Object.keys(data).length) return;
    if (Array.isArray(data.pathogens) && data.pathogens.length) setPathogens(data.pathogens as PathogenEntry[]);
    if (typeof data.symptome === "string") setSymptome(data.symptome);
    if (typeof data.erkrankung === "string") setErkrankung(data.erkrankung);
    if (typeof data.alter === "string") setAlter(data.alter);
    if (typeof data.geschlecht === "string") setGeschlecht(data.geschlecht);
    if (typeof data.groesseCm === "string") setGroesseCm(data.groesseCm);
    if (typeof data.gewichtKg === "string") setGewichtKg(data.gewichtKg);
    if (typeof data.schwanger === "string") setSchwanger(data.schwanger);
    if (typeof data.medikamente === "string") setMedikamente(data.medikamente);
    if (typeof data.bisherigeMittel === "string") setBisherigeMittel(data.bisherigeMittel);
    if (typeof data.budget === "string") setBudget(data.budget);
    if (typeof data.laborErhoeht === "string") setLaborErhoeht(data.laborErhoeht);
    if (typeof data.laborErniedrigt === "string") setLaborErniedrigt(data.laborErniedrigt);
    if (typeof data.laborKomplett === "string") setLaborKomplett(data.laborKomplett);
    if (typeof data.laborDatum === "string") setLaborDatum(data.laborDatum);
    if (typeof data.stuhlbefund === "string") setStuhlbefund(data.stuhlbefund);
    if (typeof data.arztbericht === "string") setArztbericht(data.arztbericht);
    if (typeof data.arztberichtDatum === "string") setArztberichtDatum(data.arztberichtDatum);
    if (typeof data.metatronHeel === "string") setMetatronHeel(data.metatronHeel);
    if (typeof data.sonstigeUntersuchungen === "string") setSonstigeUntersuchungen(data.sonstigeUntersuchungen);
    if (typeof data.perplexityAnalyse === "string") setPerplexityAnalyse(data.perplexityAnalyse);
    if (Array.isArray(data.selectedCategories)) setSelectedCategories(data.selectedCategories as string[]);
    if (Array.isArray(data.bevorzugteLinie)) setBevorzugteLinie(data.bevorzugteLinie as string[]);
    if (Array.isArray(data.pinnedMittel)) setPinnedMittel(data.pinnedMittel as PinnedRemedy[]);
  }, []);

  useEffect(() => {
    const pid = pseudonymId.trim();
    if (!pid || loadedInputDraftForPidRef.current === pid) return;
    loadedInputDraftForPidRef.current = pid;

    // 1) Lokale Sicherung sofort laden (falls vorhanden)
    let localTs = 0;
    let localData: any = null;
    try {
      const raw = localStorage.getItem(`therapy.inputs.draft.${pid}`);
      if (raw) {
        localData = JSON.parse(raw);
        localTs = localData?.savedAt ? new Date(localData.savedAt).getTime() : 0;
      }
    } catch {}
    if (localData) applyDraftPayload(localData);

    // 2) Cloud-Sicherung (DB) prüfen — funktioniert für ALLE Patienten/Geräte
    loadCloudDraft(pid, localData, localTs);
  }, [pseudonymId, toast, applyDraftPayload]);

  const loadCloudDraft = useCallback(async (pid: string, localData: any = null, localTs = 0) => {
    try {
      const { data } = await (supabase as any)
        .from("therapy_sessions")
        .select("id, eingabe_daten, updated_at")
        .eq("pseudonym_id", pid)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (!Array.isArray(data) || !data.length) {
        if (localData) toast({ title: "Eingaben wiederhergestellt", description: `Lokale Sicherung für ${pid} geladen.` });
        return;
      }
      // Strategie: Jüngste Sitzung gewinnt. Fehlende Felder werden aus den
      // nächstälteren Sitzungen ergänzt (z. B. Labor in Sitzung A, Arztbericht in Sitzung B).
      const merged: any = {};
      const stringKeys = [
        "symptome","erkrankung","alter","geschlecht","groesseCm","gewichtKg","schwanger",
        "medikamente","bisherigeMittel","budget","laborErhoeht","laborErniedrigt","laborKomplett",
        "laborDatum","stuhlbefund","arztbericht","arztberichtDatum","metatronHeel","sonstigeUntersuchungen","perplexityAnalyse",
      ];
      const mergeTextKeys = new Set(["symptome","erkrankung","medikamente","bisherigeMittel","laborErhoeht","laborErniedrigt","laborKomplett","stuhlbefund","arztbericht","metatronHeel","sonstigeUntersuchungen","perplexityAnalyse"]);
      const textCollections: Record<string, Array<{ label: string; text: string }>> = {};
      const arrayKeys = ["pathogens","selectedCategories","bevorzugteLinie","pinnedMittel"];
      for (const row of data) {
        const e = normalizeTherapyInput(row?.eingabe_daten);
        for (const k of stringKeys) {
          if (mergeTextKeys.has(k)) {
            if (typeof e[k] === "string" && e[k].trim()) {
              const dateLabel = row?.updated_at ? new Date(row.updated_at).toLocaleDateString("de-DE") : "unbekannt";
              if (!textCollections[k]) textCollections[k] = [];
              textCollections[k].push({ label: `Sitzung ${dateLabel}`, text: e[k].trim() });
            }
          } else if (!merged[k] && typeof e[k] === "string" && e[k].trim()) merged[k] = e[k];
        }
        for (const k of arrayKeys) {
          if ((!merged[k] || (Array.isArray(merged[k]) && merged[k].length === 0)) && Array.isArray(e[k]) && e[k].length) {
            merged[k] = e[k];
          }
        }
      }
      for (const [key, blocks] of Object.entries(textCollections)) {
        const seenText = new Map<string, string>();
        const duplicateNotes: string[] = [];
        const mergedText = blocks
          .map((block) => {
            const text = dedupeAnalysisBlockText({ label: block.label, text: block.text }, seenText, duplicateNotes);
            return text ? `### ${block.label}\n${text}` : "";
          })
          .filter(Boolean)
          .join("\n\n")
          .trim();
        if (mergedText) merged[key] = mergedText;
      }
      const newest = data[0];
      const cloudTs = newest?.updated_at ? new Date(newest.updated_at).getTime() : 0;
      if (cloudTs >= localTs) {
        applyDraftPayload(merged);
        const autoRow = data.find((r: any) => r?.eingabe_daten?.autoSavedDraft);
        if (autoRow) autoSaveSessionIdRef.current = autoRow.id;
        const filledFields = Object.keys(merged).filter((k) => {
          const v = (merged as any)[k];
          return typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false;
        }).length;
        setClinicalLoadInfo({
          pid,
          sessionCount: data.length,
          laborLines: countClinicalLines([merged.laborKomplett, merged.laborErhoeht, merged.laborErniedrigt].filter(Boolean).join("\n")),
          arztChars: typeof merged.arztbericht === "string" ? merged.arztbericht.trim().length : 0,
          loadedAt: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        });
        toast({
          title: "Eingaben wiederhergestellt",
          description: `${filledFields} Felder aus ${data.length} Sitzung${data.length !== 1 ? "en" : ""} für ${pid} zusammengeführt · Labor: ${countClinicalLines([merged.laborKomplett, merged.laborErhoeht, merged.laborErniedrigt].filter(Boolean).join("\n"))} Zeilen · Arztbrief: ${typeof merged.arztbericht === "string" && merged.arztbericht.trim() ? "geladen" : "nicht vorhanden"}.`,
        });
      } else if (localData) {
        toast({ title: "Eingaben wiederhergestellt", description: `Lokale Sicherung für ${pid} geladen.` });
      }
    } catch {
      if (localData) toast({ title: "Eingaben wiederhergestellt", description: `Lokale Sicherung für ${pid} geladen.` });
    }
  }, [applyDraftPayload, toast]);

  // ---- Harte Auto-Sicherung in der Datenbank pro Pseudonym ----
  // Damit Labor/Arztbericht nicht verschwinden, auch wenn Tab/Browser/Session weg ist.
  const hasMeaningfulInput = useMemo(() => {
    const textFields = [symptome, erkrankung, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse];

    return textFields.some((v) => v.trim()) || pathogens.some((p) => p.name.trim() || p.organe.trim() || p.index.trim()) || selectedCategories.length > 0 || bevorzugteLinie.length > 0 || pinnedMittel.length > 0;
  }, [symptome, erkrankung, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, laborDatum, stuhlbefund, arztbericht, arztberichtDatum, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse, pathogens, selectedCategories, bevorzugteLinie, pinnedMittel]);

  useEffect(() => {
    const pid = pseudonymId.trim();
    if (!pid || !hasMeaningfulInput || workflowStage === "finalized") return;
    const runId = autoSaveRunIdRef.current + 1;
    autoSaveRunIdRef.current = runId;

    const payload = JSON.stringify(buildInputData({
      autoSavedDraft: true,
      finalized: false,
    }));
    if (payload === lastAutoSavedPayloadRef.current) return;

    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (runId !== autoSaveRunIdRef.current) return;
      setAutoSaveStatus("saving");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht angemeldet");
        const eingabe_daten = JSON.parse(payload);
        const updateBody = {
          pseudonym_id: pid,
          created_by: user.id,
          eingabe_daten: { ...eingabe_daten, lastAutoSaveAt: new Date().toISOString() },
          empfehlung: "Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.",
          notiz: "Auto-Sicherung der Eingaben",
        };

        if (autoSaveSessionIdRef.current) {
          const { error } = await (supabase as any)
            .from("therapy_sessions")
            .update(updateBody)
            .eq("id", autoSaveSessionIdRef.current)
            .eq("pseudonym_id", pid);
          if (runId !== autoSaveRunIdRef.current) return;
          if (!error) {
            lastAutoSavedPayloadRef.current = payload;
            setAutoSaveStatus("saved");
            return;
          }
        }

        const { data, error } = await (supabase as any)
          .from("therapy_sessions")
          .insert(updateBody)
          .select("id")
          .single();
        if (error) throw error;
        if (runId !== autoSaveRunIdRef.current) return;
        autoSaveSessionIdRef.current = data?.id ?? null;
        lastAutoSavedPayloadRef.current = payload;
        setAutoSaveStatus("saved");
        setHistoryRefresh((n) => n + 1);
      } catch {
        setAutoSaveStatus("error");
      }
    }, 250);

    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [pseudonymId, hasMeaningfulInput, buildInputData, workflowStage]);

  // Selektion: bei neuem `result` initialisieren bzw. erweitern (Nachschlag).
  // - Erste Generierung: alle Mittel anhaken.
  // - Nachschlag: bisherige Häkchen erhalten, neu hinzugekommene Keys automatisch anhaken.
  const lastInitResultRef = useRef<string>("");
  useEffect(() => {
    if (!result) {
      setSelectedKeys(new Set());
      setDiagnosen([]);
      lastInitResultRef.current = "";
      return;
    }
    if (lastInitResultRef.current === result) return;
    const isFirstInit = lastInitResultRef.current === "";
    lastInitResultRef.current = result;
    const parsed = parseTherapyMarkdown(result);
    setSelectedKeys((prev) => {
      const next = isFirstInit ? new Set<string>() : new Set(prev);
      parsed.categories.forEach((g, ci) => {
        g.remedies.forEach((r, ri) => {
          const key = `${ci}|${ri}`;
          if (isFirstInit) {
            next.add(key);
          } else if (!next.has(key)) {
            // Beim Nachschlag: neue Mittel automatisch anhaken (sind oft mit 🆕 markiert)
            next.add(key);
          }
        });
      });
      return next;
    });
    // Bei neuer KI-Generierung: zurück zur ersten Workflow-Stufe
    if (isFirstInit) setWorkflowStage("edit");
  }, [result]);

  // ---- Wiki-Mittel für Autocomplete laden (einmalig) ----
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("admin_knowledge_base")
        .select("title, content")
        .limit(2000);
      if (!data) return;
      const items: WikiRemedyEntry[] = [];
      for (const row of data as Array<{ title: string; content: string }>) {
        const title = row.title?.trim();
        if (!title) continue;
        // Latin-Name aus erster Zeile/Klammer
        const latinMatch = row.content?.match(/\(([A-Z][a-zäöü]+\s+[a-zäöü]+)\)/);
        const content = row.content || "";
        items.push({
          name: title,
          latin: latinMatch?.[1],
          dosage: extractWikiField(content, ["Dosierung", "Dosis", "Einnahmeempfehlung"]),
          application: extractWikiField(content, ["Anwendung", "Einnahme", "Applikation"]),
          reason: extractWikiField(content, ["Indikation", "Begründung", "Einsatz", "Wirkung", "Eigenschaften", "Geeignet für", "Anwendungsgebiet", "Anwendungsgebiete"]),
        });
      }
      setWikiRemedies(items);
    })();
  }, []);

  // ---- Auto-Draft pro Pseudonym in localStorage (überlebt Tab-Schließen) ----
  const draftStageKey = pseudonymId.trim() ? `therapy.workflow.draft.${pseudonymId.trim()}` : "";
  const draftStageLoadedRef = useRef<string>("");
  useEffect(() => {
    if (!draftStageKey) return;
    if (draftStageLoadedRef.current === draftStageKey) return;
    draftStageLoadedRef.current = draftStageKey;
    try {
      const raw = localStorage.getItem(draftStageKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d?.result === "string" && d.result.trim() && !result) {
        lastInitResultRef.current = d.result;
        setResult(d.result);
      }
      if (Array.isArray(d?.selectedKeys)) setSelectedKeys(new Set(d.selectedKeys));
      if (Array.isArray(d?.manualMittel)) setManualMittel(d.manualMittel);
      if (Array.isArray(d?.manualDiagnosen)) setManualDiagnosen(d.manualDiagnosen);
      if (typeof d?.therapieNotiz === "string") setTherapieNotiz(d.therapieNotiz);
      if (typeof d?.workflowStage === "string") setWorkflowStage(d.workflowStage);
      toast({ title: "Entwurf wiederhergestellt", description: "Deine Bearbeitungen aus der letzten Sitzung wurden geladen." });
    } catch {}
  }, [draftStageKey, result]);

  useEffect(() => {
    if (!draftStageKey || !result || workflowStage === "finalized") return;
    try {
      localStorage.setItem(draftStageKey, JSON.stringify({
        result,
        selectedKeys: Array.from(selectedKeys),
        manualMittel,
        manualDiagnosen,
        therapieNotiz,
        workflowStage,
      }));
    } catch {}
  }, [draftStageKey, selectedKeys, manualMittel, manualDiagnosen, therapieNotiz, workflowStage, result]);



  const toggleRemedy = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllInCategory = (categoryIndex: number, remedyIndices: number[], selectAll: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      remedyIndices.forEach((ri) => {
        const k = `${categoryIndex}|${ri}`;
        if (selectAll) next.add(k);
        else next.delete(k);
      });
      return next;
    });
  };

  const createEmptyManualRemedy = (): ManualRemedyEntry => ({ name: "", dosage: "", application: "", duration: "", reason: "", group: "Manuell ergänzt" });

  const goToPreviewFromAddons = () => {
    setManualMittel((arr) => arr.filter((m) => m.name.trim() || m.dosage.trim() || m.application.trim() || m.duration.trim() || m.reason.trim()));
    setWorkflowStage("preview");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    toast({ title: "Ergänzungen übernommen", description: "Die Vorschau enthält jetzt die zusätzlich eingetragenen Mittel." });
  };

  const openManualAddons = (ensureInputRow = false) => {
    if (ensureInputRow) {
      setManualMittel((arr) => {
        const hasBlankRow = arr.some((m) => !m.name.trim() && !m.dosage.trim() && !m.application.trim() && !m.duration.trim() && !m.reason.trim());
        return hasBlankRow ? arr : [...arr, createEmptyManualRemedy()];
      });
    }
    setWorkflowStage("addons");
    setTimeout(() => {
      manualAddonsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const fetchDiagnosen = async (): Promise<DiagnoseEntry[]> => {
    setIsLoadingDiagnosen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Nicht angemeldet", variant: "destructive" });
        return [];
      }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-diagnoses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            belastungen: formatPathogensForAI(pathogens),
            symptome,
            erkrankung,
            laborErhoeht,
            laborErniedrigt,
            laborKomplett,
            stuhlbefund,
            medikamente,
            alter,
            schwanger,
          }),
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        toast({ title: "Diagnose-Generierung fehlgeschlagen", description: err.error, variant: "destructive" });
        return [];
      }
      const json = await resp.json();
      const list: DiagnoseEntry[] = Array.isArray(json.diagnosen) ? json.diagnosen : [];
      setDiagnosen(list);
      return list;
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
      return [];
    } finally {
      setIsLoadingDiagnosen(false);
    }
  };

  const handlePrintPatient = () => {
    openPrintRecipe({
      parsed: parseTherapyMarkdown(result),
      patient: { alter, schwanger, medikamente, budget, belastungen: formatPathogensForAI(pathogens), symptome, erkrankung },
      mode: "patient",
      selectedKeys,
      manualMittel: manualMittel.filter((m) => m.name.trim()),
    });
  };

  const handlePrintPraxis = async () => {
    let diag = diagnosen;
    if (diag.length === 0) {
      diag = await fetchDiagnosen();
    }
    openPrintRecipe({
      parsed: parseTherapyMarkdown(result),
      patient: {
        alter, schwanger, medikamente, budget,
        belastungen: formatPathogensForAI(pathogens),
        symptome, erkrankung,
        pseudonymId: pseudonymId.trim() || undefined,
        notiz: therapieNotiz.trim() || undefined,
      },
      mode: "praxis",
      selectedKeys,
      diagnosen: [...diag, ...manualDiagnosen.filter((d) => d.diagnose.trim()).map((d) => ({ ...d, diagnose: `${d.diagnose} (manuell)` }))],
      manualMittel: manualMittel.filter((m) => m.name.trim()),
    });
  };
  // BMI-Berechnung & Klassifikation
  const bmiInfo = useMemo(() => {
    const h = parseFloat(groesseCm);
    const w = parseFloat(gewichtKg);
    if (!h || !w || h < 50 || h > 250 || w < 10 || w > 400) return null;
    const m = h / 100;
    const bmi = w / (m * m);
    let kategorie = "";
    let tone: "ok" | "warn" | "danger" = "ok";
    let hinweis = "";
    if (bmi < 16) { kategorie = "Starkes Untergewicht"; tone = "danger"; hinweis = "Mangelernährung, Sarkopenie, Immunschwäche – Aufbaukost & Mikronährstoffe zwingend"; }
    else if (bmi < 18.5) { kategorie = "Untergewicht"; tone = "warn"; hinweis = "Aufbau-/Mitochondrien-Strategie, Eiweiß & B-Vitamine"; }
    else if (bmi < 25) { kategorie = "Normalgewicht"; tone = "ok"; hinweis = ""; }
    else if (bmi < 30) { kategorie = "Übergewicht"; tone = "warn"; hinweis = "Insulinresistenz möglich – LOGI/Low-Carb, Bewegung, Leberentlastung"; }
    else if (bmi < 35) { kategorie = "Adipositas Grad I"; tone = "danger"; hinweis = "Metabolisches Syndrom Risiko – Stoffwechsel-/Schilddrüsen-Check, NAFLD, HbA1c"; }
    else if (bmi < 40) { kategorie = "Adipositas Grad II"; tone = "danger"; hinweis = "Hohes kardiometabolisches Risiko – konsequente Ernährungsumstellung & Begleitlabor"; }
    else { kategorie = "Adipositas Grad III"; tone = "danger"; hinweis = "Sehr hohes Risiko – multimodale Begleitung, ärztliche Mitbeurteilung sinnvoll"; }
    return { bmi: Math.round(bmi * 10) / 10, kategorie, tone, hinweis };
  }, [groesseCm, gewichtKg]);


  const handleGeneratePseudonym = async () => {
    const { data } = await (supabase as any)
      .from("therapy_sessions")
      .select("pseudonym_id")
      .like("pseudonym_id", `P-${new Date().getFullYear()}-%`);
    const existing = ((data || []) as Array<{ pseudonym_id: string }>).map((r) => r.pseudonym_id);
    handlePseudonymChange(generatePseudonymId(existing));
  };

  const clearPatientScopedState = useCallback(() => {
    autoSaveRunIdRef.current += 1;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveSessionIdRef.current = null;
    checkpointSessionIdRef.current = null;
    lastAutoSavedPayloadRef.current = "";
    loadedInputDraftForPidRef.current = "";
    draftStageLoadedRef.current = "";
    setPathogens([emptyEntry()]);
    setSymptome("");
    setErkrankung("");
    setAlter("");
    setGeschlecht("");
    setGroesseCm("");
    setGewichtKg("");
    setSchwanger("nein");
    setMedikamente("");
    setBisherigeMittel("");
    setBudget("");
    setLaborErhoeht("");
    setLaborErniedrigt("");
    setLaborKomplett("");
    setLaborDatum("");
    setStuhlbefund("");
    setArztbericht("");
    setArztberichtDatum("");
    setMetatronHeel("");
    setSonstigeUntersuchungen("");
    setPerplexityAnalyse("");
    setSelectedCategories([]);
    setBevorzugteLinie([]);
    setPinnedMittel([]);
    setUseMapReduce(true);
    setResult("");
    setAuditInfo(null);
    setManualMittel([]);
    setManualDiagnosen([]);
    setTherapieNotiz("");
    setExtractedFromDocs(null);
    setClinicalLoadInfo(null);
    setWorkflowStage("edit");
    setAutoSaveStatus("idle");
  }, []);

  const handlePseudonymChange = useCallback((nextValue: string) => {
    const previous = normalizePseudonymId(pseudonymId);
    const next = normalizePseudonymId(nextValue);
    if (previous && next && previous !== next) {
      clearPatientScopedState();
      toast({
        title: "Patient gewechselt – Formular geleert",
        description: `Vorherige Eingaben wurden entfernt, damit nichts von ${previous} nach ${next} übernommen wird.`,
      });
    } else if (!next) {
      clearPatientScopedState();
    }
    setPseudonymId(nextValue);
  }, [pseudonymId, clearPatientScopedState, toast]);

  const handleLoadSession = (session: TherapySession) => {
    if (normalizePseudonymId(session.pseudonym_id) !== normalizePseudonymId(pseudonymId)) {
      toast({ title: "Sicherheitsstopp", description: "Diese Sitzung gehört nicht zur aktuell gewählten Pseudonym-ID.", variant: "destructive" });
      return;
    }
    const d = normalizeTherapyInput(session.eingabe_daten || {});
    autoSaveSessionIdRef.current = d.autoSavedDraft ? session.id : null;
    lastAutoSavedPayloadRef.current = d.autoSavedDraft ? JSON.stringify({ ...d, lastAutoSaveAt: undefined }) : "";
    setSymptome(asText(d.symptome));
    setErkrankung(asText(d.erkrankung));
    setAlter(asText(d.alter));
    setGeschlecht(asText(d.geschlecht));
    setGroesseCm(asText(d.groesseCm));
    setGewichtKg(asText(d.gewichtKg));
    // Hinweis, falls die alte Sitzung die neuen Felder noch nicht enthielt
    const missingNew = !d.geschlecht && !d.groesseCm && !d.gewichtKg;
    if (missingNew) {
      toast({
        title: "Ältere Sitzung – bitte Konstitution ergänzen",
        description: "Geschlecht, Größe und Gewicht waren in dieser Sitzung noch nicht erfasst. Bitte erneut eingeben – die nächste Generierung speichert sie dauerhaft mit.",
      });
    }
    setSchwanger(asText(d.schwanger, "nein"));
    setMedikamente(asText(d.medikamente));
    setBisherigeMittel(asText(d.bisherigeMittel));
    setBudget(asText(d.budget));
    setLaborErhoeht(asText(d.laborErhoeht));
    setLaborErniedrigt(asText(d.laborErniedrigt));
    setLaborKomplett(asText(d.laborKomplett));
    setLaborDatum(asText(d.laborDatum));
    setStuhlbefund(asText(d.stuhlbefund));
    setArztbericht(asText(d.arztbericht));
    setArztberichtDatum(asText(d.arztberichtDatum));
    setMetatronHeel(asText(d.metatronHeel));
    setSonstigeUntersuchungen(asText(d.sonstigeUntersuchungen));
    setPerplexityAnalyse(asText(d.perplexityAnalyse));
    if (Array.isArray(d.pathogens)) setPathogens(d.pathogens as PathogenEntry[]);
    if (Array.isArray(d.selectedCategories)) setSelectedCategories(d.selectedCategories as string[]);
    else if (Array.isArray(d.categories)) setSelectedCategories(d.categories as string[]);
    if (Array.isArray(d.bevorzugteLinie)) setBevorzugteLinie(d.bevorzugteLinie as string[]);
    if (Array.isArray(d.pinnedMittel)) setPinnedMittel(d.pinnedMittel as PinnedRemedy[]);
    setUseMapReduce(d.useMapReduce !== false);
    setResult(session.empfehlung || "");
    setAuditInfo(null);
    setClinicalLoadInfo({
      pid: session.pseudonym_id,
      sessionCount: 1,
      laborLines: countClinicalLines([d.laborKomplett, d.laborErhoeht, d.laborErniedrigt].filter(Boolean).join("\n")),
      arztChars: typeof d.arztbericht === "string" ? d.arztbericht.trim().length : 0,
      loadedAt: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    });
    toast({ title: "Sitzung geladen", description: `Vom ${new Date(session.created_at).toLocaleDateString("de-DE")}` });
  };

  const handleAnalyzeDocuments = async () => {
    const rawBlocks = [
      { label: laborDatum.trim() ? `Labor komplett – ${laborDatum.trim()}` : "Labor komplett", text: laborKomplett.trim() },
      { label: "Labor – erhöhte Werte", text: laborErhoeht.trim() },
      { label: "Labor – erniedrigte Werte", text: laborErniedrigt.trim() },
      { label: "Stuhlbefund", text: stuhlbefund.trim() },
      { label: arztberichtDatum.trim() ? `Arztbericht – ${arztberichtDatum.trim()}` : "Arztbericht", text: arztbericht.trim() },
      { label: "Metatron / NLS / Bioresonanz", text: metatronHeel.trim() },
      { label: "Sonstige / unsortierte Voruntersuchungen", text: sonstigeUntersuchungen.trim() },
      { label: "Externe Recherche / Perplexity", text: perplexityAnalyse.trim() },
    ].filter((block) => block.text);
    const prepared = prepareAnalysisChunks(rawBlocks);
    const chunks = prepared.chunks;
    if (!chunks.length) {
      toast({ title: "Keine Dokumente vorhanden", description: "Bitte mindestens ein Dokument-Feld füllen (Labor, Arztbericht, sonstige Untersuchungen, Perplexity …).", variant: "destructive" });
      return;
    }
    const totalChars = prepared.analyzedChars;
    const fingerprint = buildAnalysisFingerprint(chunks, [alter, geschlecht, pseudonymId, prepared.duplicateNotes.join("|")].join("|"));
    const checkpointKey = getAnalysisCheckpointKey(pseudonymId, fingerprint);
    let checkpoint = readAnalysisCheckpoint(checkpointKey, fingerprint, chunks.length);
    setIsAnalyzingDocs(true);
    // Tab sofort öffnen (Pop-up-Blocker umgehen)
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Befund-Auswertung läuft…</title><style>body{font-family:system-ui;padding:32px;color:#344238;line-height:1.5}h2{color:#6b8e6b}.box{border:1px solid #d8e2d3;background:#f8faf6;padding:18px;border-radius:8px;max-width:900px}.muted{color:#667063}.ok{color:#476b47;font-weight:600}pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;color:#52605a;max-height:55vh;overflow:auto;border:1px solid #d8e2d3;padding:10px;border-radius:6px;background:white}</style></head><body><div class="box"><h2>⏳ Strikte Befund-Auswertung läuft…</h2><p>Alle Befundseiten werden in ${chunks.length} Teilpaket(en) gelesen und danach erst zusammengeführt, wenn wirklich alle Teilanalysen vollständig vorliegen.</p><p class="muted">Umfang: ${totalChars.toLocaleString("de-DE")} analysierte Zeichen${prepared.originalChars !== totalChars ? ` von ${prepared.originalChars.toLocaleString("de-DE")} Rohzeichen` : ""}. Fertige Teilpakete werden laufend zwischengesichert.</p><p class="ok">Kein Lückenbericht: Bei Fehler stoppt die Analyse und macht beim nächsten Klick an derselben Stelle weiter.</p><pre id="__live">Start…${prepared.duplicateNotes.length ? `\n✓ ${prepared.duplicateNotes.length} doppelte(r) Textabschnitt(e) erkannt und nur einmal analysiert.` : ""}${checkpoint?.partials?.length ? `\n✓ ${checkpoint.partials.length}/${chunks.length} Teilpaket(e) aus Sicherung gefunden – ich mache dort weiter.` : ""}</pre></div></body></html>`);
      w.document.close();
    }
    try {
      const getFreshAuthHeaders = async () => {
        // Token bei jedem Aufruf neu holen – verhindert 401 nach langer Laufzeit (Token-Ablauf)
        const { data: { session: s }, error: e } = await supabase.auth.getSession();
        if (e || !s) throw new Error("Nicht angemeldet");
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        } as Record<string, string>;
      };
      // Initial einmal prüfen, ob überhaupt eine Session existiert
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session) throw new Error("Nicht angemeldet");
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-documents`;
      if (pseudonymId.trim()) {
        try {
          const { data: cloudRows } = await (supabase as any)
            .from("therapy_sessions")
            .select("id, eingabe_daten, updated_at")
            .eq("pseudonym_id", pseudonymId.trim())
            .eq("kind", "befund_checkpoint")
            .order("updated_at", { ascending: false })
            .limit(1);
          const cloudRow = Array.isArray(cloudRows) ? cloudRows[0] : null;
          const cloudCheckpoint = parseAnalysisCheckpoint(cloudRow?.eingabe_daten?.checkpoint, fingerprint, chunks.length);
          if (cloudCheckpoint && (!checkpoint || new Date(cloudCheckpoint.updatedAt).getTime() > new Date(checkpoint.updatedAt).getTime())) {
            checkpoint = cloudCheckpoint;
            checkpointSessionIdRef.current = cloudRow.id;
            writeAnalysisCheckpoint(checkpointKey, cloudCheckpoint);
          }
        } catch { /* lokale Sicherung genügt, falls Cloud-Checkpoint nicht lesbar ist */ }
      }
      const live = w?.document.getElementById("__live") as HTMLElement | null;
      const writeProgress = (line: string) => {
        if (!live) return;
        live.textContent = `${live.textContent || ""}\n${line}`;
        live.scrollTop = live.scrollHeight;
      };
      if (checkpoint?.partials?.length) {
        writeProgress(`✓ ${checkpoint.partials.length}/${chunks.length} Teilpaket(e) aus Zwischen-Sicherung geladen.`);
      }
      const analyzeChunk = async (chunk: AnalysisDocChunk, indexLabel: string, totalLabel: number) => {
        let lastError = "Unbekannter Analysefehler";
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const headers = await getFreshAuthHeaders();
            const chunkResp = await fetch(endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify({
                analysisMode: "chunk",
                chunk: { ...chunk, index: indexLabel, total: totalLabel },
                alter: alter.trim() || undefined,
                geschlecht: geschlecht || undefined,
                pseudonymId: pseudonymId || undefined,
              }),
            });
            const responseText = await chunkResp.text().catch(() => "");
            if (!chunkResp.ok) {
              let errorMessage = responseText || `HTTP ${chunkResp.status}`;
              try {
                const parsedError = JSON.parse(responseText);
                errorMessage = parsedError.error || parsedError.message || errorMessage;
              } catch { /* Antwort war kein JSON */ }
              throw new Error(errorMessage);
            }
            if (!responseText.trim()) throw new Error("Leere Antwort vom Analyse-Dienst");
            let chunkJson: { partial?: string };
            try {
              chunkJson = JSON.parse(responseText);
            } catch {
              throw new Error("Ungültige JSON-Antwort vom Analyse-Dienst");
            }
            const partial = String(chunkJson.partial || "").trim();
            if (!partial) throw new Error("Leere Teilanalyse vom Analyse-Dienst");
            assertStrictPartialAnalysis(partial);
            return partial;
          } catch (err) {
            lastError = (err as Error).message || String(err);
            if (/401|Nicht autorisiert|JWT|expired/i.test(lastError)) await supabase.auth.refreshSession().catch(() => null);
            if (attempt === 3 || !isRecoverableAnalysisTimeout(lastError)) break;
            writeProgress(`  ↳ Versuch ${attempt + 1}/3 nach kurzer Pause…`);
            await analysisDelay(1200 * attempt);
          }
        }
        throw new Error(lastError);
      };


      const saveCheckpoint = async (checkpointData: AnalysisCheckpoint) => {
        writeAnalysisCheckpoint(checkpointKey, checkpointData);
        const pid = pseudonymId.trim();
        if (!pid) return;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const row = {
            pseudonym_id: pid,
            kind: "befund_checkpoint",
            eingabe_daten: { kind: "befund_checkpoint", fingerprint, checkpoint: checkpointData },
            empfehlung: "Automatische Zwischen-Sicherung der Befund-Auswertung.",
            notiz: `Befund-Zwischenstand: ${checkpointData.completedChunks}/${checkpointData.totalChunks} Teilpakete`,
            created_by: user.id,
          };
          const existingId = checkpointSessionIdRef.current;
          if (existingId) {
            const { error } = await (supabase as any).from("therapy_sessions").update(row).eq("id", existingId);
            if (!error) return;
          }
          const { data, error } = await (supabase as any).from("therapy_sessions").insert(row).select("id").single();
          if (!error && data?.id) checkpointSessionIdRef.current = data.id;
        } catch { /* Cloud-Checkpoint ist Zusatzsicherung; lokale Sicherung bleibt maßgeblich */ }
      };

      const partials: string[] = checkpoint?.partials?.slice() ?? [];
      for (let i = Math.min(checkpoint?.completedChunks ?? 0, chunks.length); i < chunks.length; i += 1) {
        writeProgress(`Teil ${i + 1}/${chunks.length} wird gelesen: ${chunks[i].label}`);
        try {
          const partial = await analyzeChunk(chunks[i], String(i + 1), chunks.length);
          assertStrictPartialAnalysis(partial);
          partials.push(partial);
        } catch (error) {
          const message = (error as Error).message || "";
          if (!isRecoverableAnalysisTimeout(message) || chunks[i].text.length <= ANALYSIS_RETRY_CHUNK_MAX_CHARS) {
            await saveCheckpoint({ version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: i, partials, duplicateNotes: prepared.duplicateNotes, status: "in_progress", updatedAt: new Date().toISOString() });
            throw new Error(`Strikte Auswertung gestoppt bei Teil ${i + 1}/${chunks.length} (${chunks[i].label}): ${message}. ${partials.length} Teilanalyse(n) sind gespeichert; bitte später erneut klicken, dann geht es genau hier weiter.`);
          } else {
            const retryChunks = splitAnalysisText(chunks[i].label, chunks[i].text, ANALYSIS_RETRY_CHUNK_MAX_CHARS);
            writeProgress(`⚠ Teil ${i + 1} war zu groß/langsam (${message}). Teile automatisch in ${retryChunks.length} kleinere Pakete auf – ohne Lückenbericht…`);
            for (let r = 0; r < retryChunks.length; r += 1) {
              writeProgress(`  ↳ Teil ${i + 1}.${r + 1}/${retryChunks.length} wird gelesen…`);
              try {
                const retryPartial = await analyzeChunk(retryChunks[r], `${i + 1}.${r + 1}`, chunks.length + retryChunks.length - 1);
                assertStrictPartialAnalysis(retryPartial);
                partials.push(retryPartial);
              } catch (retryError) {
                const retryMessage = (retryError as Error).message || String(retryError);
                await saveCheckpoint({ version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: i, partials, duplicateNotes: prepared.duplicateNotes, status: "in_progress", updatedAt: new Date().toISOString() });
                throw new Error(`Strikte Auswertung gestoppt bei Unter-Teil ${i + 1}.${r + 1}/${retryChunks.length} (${retryChunks[r].label}): ${retryMessage}. ${partials.length} Teilanalyse(n) sind gespeichert; bitte erneut klicken, dann geht es am letzten vollständigen Hauptteil weiter.`);
              }
            }
          }
        }
        await saveCheckpoint({ version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: i + 1, partials, duplicateNotes: prepared.duplicateNotes, status: i + 1 === chunks.length ? "all_chunks_complete" : "in_progress", updatedAt: new Date().toISOString() });
        writeProgress(`✓ Teil ${i + 1}/${chunks.length} ausgewertet`);
      }

      // Diagnosen + Symptome aus den Teilanalysen extrahieren für Auto-Übernahme in Eingabemaske
      try {
        const extDiag: Array<{ icd10?: string; diagnose: string; quelle?: string; status?: string; datum?: string; zitat?: string }> = [];
        const extSym: Array<{ text: string; quelle?: string; datum?: string; zitat?: string }> = [];
        const extMed: Array<{ name: string; dosis?: string; vonWem?: string; datum?: string; indikation?: string; wirkmechanismus?: string; nebenwirkungen?: string; grundVerordnung?: string; status?: string; quelle?: string; zitat?: string }> = [];
        const stripFence = (s: string) => s.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        for (const p of partials) {
          if (!p) continue;
          try {
            const obj = JSON.parse(stripFence(p));
            if (Array.isArray(obj?.diagnoses)) {
              for (const d of obj.diagnoses) {
                if (!d?.diagnose) continue;
                extDiag.push({
                  icd10: d.icd10 || "",
                  diagnose: String(d.diagnose).trim(),
                  quelle: d.quelle || d?.beleg?.quelle || "",
                  status: d.status || "",
                  datum: d?.beleg?.zitat ? "" : "",
                  zitat: d?.beleg?.zitat || "",
                });
              }
            }
            const cp = obj?.anamnese?.currentProblems;
            if (Array.isArray(cp)) {
              for (const s of cp) {
                const text = typeof s === "string" ? s : s?.text;
                if (!text) continue;
                extSym.push({
                  text: String(text).trim(),
                  quelle: s?.beleg?.quelle || "",
                  zitat: s?.beleg?.zitat || "",
                });
              }
            }
            if (Array.isArray(obj?.medicationsTherapies)) {
              for (const m of obj.medicationsTherapies) {
                if (!m?.name) continue;
                extMed.push({
                  name: String(m.name).trim(),
                  dosis: m.dosis || "",
                  vonWem: m.vonWem || "",
                  datum: m.datum || "",
                  indikation: m.indikation || "",
                  wirkmechanismus: m.wirkmechanismus || "",
                  nebenwirkungen: m.nebenwirkungen || "",
                  grundVerordnung: m.grundVerordnung || "",
                  status: m.status || "",
                  quelle: m?.beleg?.quelle || "",
                  zitat: m?.beleg?.zitat || "",
                });
              }
            }
          } catch { /* partial war kein JSON – ignorieren */ }
        }
        // Duplikate ausdünnen (case-insensitive)
        const dedupDiag = Array.from(new Map(extDiag.map((d) => [d.diagnose.toLowerCase(), d])).values());
        const dedupSym = Array.from(new Map(extSym.map((s) => [s.text.toLowerCase(), s])).values());
        const dedupMed = Array.from(new Map(extMed.map((m) => [`${m.name.toLowerCase()}|${(m.dosis||"").toLowerCase()}`, m])).values());
        if (dedupDiag.length || dedupSym.length || dedupMed.length) {
          setExtractedFromDocs({ diagnoses: dedupDiag, symptoms: dedupSym, medications: dedupMed });
        }
      } catch { /* nicht kritisch */ }

      let full = "";
      let model = "pending";
      let analysisMode = "client-checkpoint-strict";
      writeProgress("Alle Teile gelesen. Abschluss-HTML wird zusammengeführt…");
      try {
        let resp: Response | null = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const finalHeaders = await getFreshAuthHeaders();
          resp = await fetch(endpoint, {
            method: "POST",
            headers: finalHeaders,
            body: JSON.stringify({
              analysisMode: "final",
              partials,
              duplicateNotes: prepared.duplicateNotes,
              totalChars,
              alter: alter.trim() || undefined,
              geschlecht: geschlecht || undefined,
              pseudonymId: pseudonymId || undefined,
              useProModel: useProModel || undefined,
            }),
          });
          if (resp.ok && resp.body) break;
          const finalError = await readAnalysisError(resp);
          if (attempt === 2 || !isRecoverableAnalysisTimeout(finalError)) throw new Error(finalError);
          writeProgress(`⚠ Abschluss-Zusammenführung fehlgeschlagen (${finalError}). Neuer Versuch…`);
          await supabase.auth.refreshSession().catch(() => null);
          await analysisDelay(1500);
        }
        if (!resp?.ok || !resp.body) throw new Error("Abschluss-Zusammenführung fehlgeschlagen");
        model = resp.headers.get("x-model") || "?";
        analysisMode = resp.headers.get("x-analysis-mode") || "single-pass";
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          if (live) {
            live.textContent = (live.textContent || "") + chunk;
            live.scrollTop = live.scrollHeight;
          }
        }
        full += decoder.decode();
      } catch (finalError) {
        writeAnalysisCheckpoint(checkpointKey, { version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: chunks.length, partials, duplicateNotes: prepared.duplicateNotes, status: "all_chunks_complete", updatedAt: new Date().toISOString() });
        throw new Error(`Alle ${chunks.length} Teilanalysen sind gespeichert, aber die finale HTML-Zusammenführung ist fehlgeschlagen: ${(finalError as Error).message}. Bitte erneut klicken – dann wird nur die finale Zusammenführung neu gestartet.`);
      }
      full = sanitizeFinalAnalysisHtml(full);
      const visibleFinalText = full.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const hasMeaningfulAnalysisContent = /(<h1|<h2|<table|<li|Diagnosen|Medikamente|Symptome|Befund-Auswertung)/i.test(full) && visibleFinalText.length > 120;
      if (!hasMeaningfulAnalysisContent) {
        writeAnalysisCheckpoint(checkpointKey, { version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: chunks.length, partials, duplicateNotes: prepared.duplicateNotes, status: "all_chunks_complete", updatedAt: new Date().toISOString() });
        throw new Error("Die finale HTML-Auswertung war leer oder unvollständig. Alle Teilanalysen sind gespeichert; bitte erneut klicken, dann wird nur die finale Zusammenführung neu gestartet.");
      }
      if (full.includes("❌ Fehler")) {
        writeAnalysisCheckpoint(checkpointKey, { version: 3, fingerprint, pseudonymId: pseudonymId.trim(), totalChunks: chunks.length, totalChars, completedChunks: chunks.length, partials, duplicateNotes: prepared.duplicateNotes, status: "all_chunks_complete", updatedAt: new Date().toISOString() });
        throw new Error("Die finale HTML-Auswertung enthält eine Fehlermeldung. Alle Teilanalysen sind gespeichert; bitte erneut klicken, dann wird nur die finale Zusammenführung neu gestartet.");
      }

      // Finales HTML ins Tab schreiben
      if (w) {
        w.document.open();
        w.document.write(full);
        w.document.close();
      }
      {
        toast({ title: "Befund-Auswertung vollständig fertig", description: `${totalChars.toLocaleString("de-DE")} Zeichen ausgewertet · ${chunks.length} Teilpaket(e) · ${analysisMode} · ${model}${prepared.duplicateNotes.length ? ` · ${prepared.duplicateNotes.length} Duplikat(e) erkannt` : ""}` });

        // Auto-Save in therapy_sessions (DSGVO-konform, nur Pseudonym)
        const pid = pseudonymId.trim();
        if (pid) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { error: saveErr } = await (supabase as any).from("therapy_sessions").insert({
                pseudonym_id: pid,
                kind: "befund_auswertung",
                eingabe_daten: { kind: "befund_auswertung", sources: chunks.map((c) => c.label) },
                empfehlung: "",
                befund_html: full,
                befund_meta: {
                  model,
                  analysis_mode: analysisMode,
                  chunk_count: chunks.length,
                  total_chars: totalChars,
                  original_chars: prepared.originalChars,
                  duplicate_notes: prepared.duplicateNotes,
                  strict_complete: true,
                  saved_at: new Date().toISOString(),
                },
                created_by: user.id,
              });
              if (saveErr) {
                toast({ title: "Speichern fehlgeschlagen", description: saveErr.message, variant: "destructive" });
              } else {
                try { localStorage.removeItem(checkpointKey); } catch { /* optional */ }
                toast({ title: "📄 Auswertung gespeichert", description: `Im Verlauf von ${pid} abrufbar.` });
              }
            }
          } catch (saveEx) {
            toast({ title: "Speichern fehlgeschlagen", description: (saveEx as Error).message, variant: "destructive" });
          }
        } else {
          toast({ title: "Nicht gespeichert", description: "Ohne Pseudonym-ID wird die Auswertung nicht im Verlauf abgelegt.", variant: "default" });
        }
      }

    } catch (e) {
      const msg = (e as Error).message;
      if (w) {
        w.document.open();
        w.document.write(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;color:#a33"><h2>❌ Fehler</h2><p>${msg.replace(/</g, "&lt;")}</p></body></html>`);
        w.document.close();
      }
      toast({ title: "Auswertung fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setIsAnalyzingDocs(false);
    }
  };

  // Übernimmt extrahierte Diagnosen + Symptome aus der Befund-Auswertung in die Eingabemaske
  const applyExtractedToInputs = () => {
    if (!extractedFromDocs) return;
    const { diagnoses, symptoms, medications } = extractedFromDocs;
    // Diagnosen → manualDiagnosen (Duplikate vermeiden anhand diagnose-Text)
    if (diagnoses.length) {
      setManualDiagnosen((existing) => {
        const known = new Set(existing.map((d) => d.diagnose.trim().toLowerCase()));
        const additions: DiagnoseEntry[] = [];
        for (const d of diagnoses) {
          const key = d.diagnose.trim().toLowerCase();
          if (known.has(key)) continue;
          known.add(key);
          const begrParts: string[] = [];
          if (d.quelle) begrParts.push(`📄 ${d.quelle}`);
          if (d.status) begrParts.push(`Status: ${d.status}`);
          if (d.zitat) begrParts.push(`„${d.zitat}"`);
          additions.push({
            icd10: d.icd10 || "",
            diagnose: d.diagnose,
            begruendung: begrParts.join(" · ") || "aus Befund-Auswertung übernommen",
          });
        }
        return [...existing, ...additions];
      });
    }
    // Symptome → Textarea (mit Quelle/Datum) — vorhandenen Text bewahren
    if (symptoms.length) {
      setSymptome((prev) => {
        const existingLines = new Set(
          prev.split(/\n+/).map((l) => l.replace(/^[•\-\s]+/, "").trim().toLowerCase()).filter(Boolean)
        );
        const newLines: string[] = [];
        for (const s of symptoms) {
          if (existingLines.has(s.text.toLowerCase())) continue;
          existingLines.add(s.text.toLowerCase());
          const meta: string[] = [];
          if (s.quelle) meta.push(s.quelle);
          if (s.zitat) meta.push(`„${s.zitat}"`);
          newLines.push(`• ${s.text}${meta.length ? ` (📄 ${meta.join(" · ")})` : ""}`);
        }
        if (!newLines.length) return prev;
        return prev.trim() ? `${prev.trim()}\n${newLines.join("\n")}` : newLines.join("\n");
      });
    }
    // Medikamente → Textarea "medikamente" (mit Arzt/„unbekannt", Datum, Indikation, Wirkmech., NW)
    if (medications.length) {
      setMedikamente((prev) => {
        const existingLines = new Set(
          prev.split(/\n+/).map((l) => l.replace(/^[•\-\s]+/, "").trim().toLowerCase()).filter(Boolean)
        );
        const newLines: string[] = [];
        for (const m of medications) {
          const head = `${m.name}${m.dosis ? ` ${m.dosis}` : ""}`.trim();
          if (existingLines.has(head.toLowerCase())) continue;
          existingLines.add(head.toLowerCase());
          const meta: string[] = [];
          meta.push(`verordnet von: ${m.vonWem?.trim() || "unbekannt"}`);
          meta.push(`Datum: ${m.datum?.trim() || "unbekannt"}`);
          if (m.indikation?.trim()) meta.push(`Indikation: ${m.indikation.trim()}`);
          if (m.grundVerordnung?.trim()) meta.push(`Grund: ${m.grundVerordnung.trim()}`);
          if (m.wirkmechanismus?.trim()) meta.push(`Wirkung: ${m.wirkmechanismus.trim()}`);
          if (m.nebenwirkungen?.trim()) meta.push(`NW: ${m.nebenwirkungen.trim()}`);
          if (m.status?.trim()) meta.push(`Status: ${m.status.trim()}`);
          if (m.quelle?.trim()) meta.push(`📄 ${m.quelle.trim()}`);
          if (m.zitat?.trim()) meta.push(`„${m.zitat.trim()}"`);
          newLines.push(`• ${head} — ${meta.join(" · ")}`);
        }
        if (!newLines.length) return prev;
        return prev.trim() ? `${prev.trim()}\n${newLines.join("\n")}` : newLines.join("\n");
      });
    }
    toast({
      title: "Automatisch in Eingabemaske eingetragen",
      description: `${diagnoses.length} Diagnose(n), ${symptoms.length} Symptom(e), ${medications.length} Medikament(e) ergänzt — jeweils mit Quelle (Dokument), Datum (sonst „unbekannt") und wörtlichem Zitat.`,
    });

    setExtractedFromDocs(null);
  };

  // Auto-Übernahme: sobald aus den Befunden Diagnosen/Symptome/Medikamente extrahiert wurden,
  // direkt in die Eingabemaske (Symptome / Medikamente / Diagnosen) eintragen — mit Quelle, Datum, Zitat.
  // Banner bleibt sichtbar bis applyExtractedToInputs den State auf null setzt → dient als Bestätigung/Undo.
  useEffect(() => {
    if (!extractedFromDocs) return;
    const { diagnoses, symptoms, medications } = extractedFromDocs;
    if (!diagnoses.length && !symptoms.length && !medications.length) return;
    applyExtractedToInputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedFromDocs]);


  // Weitere Dokumente nachladen: extrahierter Text wird mit Zeitstempel an "Sonstige Voruntersuchungen" angehängt
  const appendNachgereicht = (text: string) => {
    if (!text.trim()) return;
    const ts = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const header = `\n\n=== 📎 Nachgereichte Befunde · ${ts} ===\n`;
    setSonstigeUntersuchungen((prev) => (prev.trim() ? `${prev.trim()}${header}${text}` : `${header.trim()}\n${text}`));
    toast({ title: "Nachgereichte Befunde angehängt", description: `${text.length.toLocaleString("de-DE")} Zeichen ergänzt. Jetzt erneut „Nur Befund-Auswertung" ausführen.` });
  };



  const handleSubmit = async (opts?: { nachschlag?: string; previousResult?: string }) => {
    const isErweitern = !!(opts?.nachschlag && opts?.previousResult);
    const belastungenText = formatPathogensForAI(pathogens);
    const hasAnyDoc = [laborKomplett, laborErhoeht, laborErniedrigt, stuhlbefund, arztbericht, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse].some((x) => x.trim());
    if (!isErweitern && !belastungenText && !symptome.trim() && !erkrankung.trim() && !hasAnyDoc) {
      toast({ title: "Bitte mindestens ein Feld ausfüllen", description: "Belastungen, Symptome, Erkrankung oder ein Dokument (Labor / Arztbericht / sonstige Untersuchungen)", variant: "destructive" });
      return;
    }

    if (!isErweitern) {
      setResult("");
      setAuditInfo(null);
    }
    setIsNachschlag(isErweitern);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let activeSession = session;
      const expiresSoon = activeSession?.expires_at
        ? activeSession.expires_at * 1000 < Date.now() + 60_000
        : true;

      if (!activeSession || expiresSoon) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          toast({ title: "Sitzung abgelaufen", description: "Bitte erneut anmelden.", variant: "destructive" });
          setIsStreaming(false);
          return;
        }
        activeSession = refreshData.session;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/therapy-recommend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeSession.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            belastungen: belastungenText,
            symptome: symptome.trim(),
            erkrankung: erkrankung.trim(),
            alter: alter.trim() || undefined,
            geschlecht: geschlecht || undefined,
            groesseCm: groesseCm.trim() || undefined,
            gewichtKg: gewichtKg.trim() || undefined,
            bmi: bmiInfo ? bmiInfo.bmi : undefined,
            bmiKategorie: bmiInfo ? bmiInfo.kategorie : undefined,
            schwanger: schwanger !== "nein" ? schwanger : undefined,
            bisherigeMittel: bisherigeMittel.trim() || undefined,
            medikamente: medikamente.trim() || undefined,
            budget: budget.trim() || undefined,
            laborErhoeht: laborErhoeht.trim() || undefined,
            laborErniedrigt: laborErniedrigt.trim() || undefined,
            laborKomplett: laborKomplett.trim() || undefined,
            laborDatum: laborDatum.trim() || undefined,
            stuhlbefund: stuhlbefund.trim() || undefined,
            arztbericht: arztbericht.trim() || undefined,
            arztberichtDatum: arztberichtDatum.trim() || undefined,
            metatronHeel: metatronHeel.trim() || undefined,
            sonstigeUntersuchungen: sonstigeUntersuchungen.trim() || undefined,
            perplexityAnalyse: perplexityAnalyse.trim() || undefined,
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            bevorzugteLinie: bevorzugteLinie.length > 0 ? bevorzugteLinie : undefined,
            pinnedMittel: pinnedMittel.length > 0 ? pinnedMittel : undefined,
            useMapReduce: useMapReduce || undefined,
            useProModel: useProModel || undefined,
            nachschlag: isErweitern ? opts!.nachschlag : undefined,
            previousResult: isErweitern ? opts!.previousResult : undefined,
          }),
          signal: controller.signal,
        }
      );

      let completed = false;

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        if (resp.status === 401) {
          toast({ title: "Sitzung abgelaufen", description: "Bitte erneut anmelden.", variant: "destructive" });
        } else if (resp.status === 403) {
          toast({ title: "Keine Berechtigung", description: err.error || "Nur für Administratoren", variant: "destructive" });
        } else {
          toast({ title: "Fehler", description: err.error || `HTTP ${resp.status}`, variant: "destructive" });
        }
        setIsStreaming(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            completed = true;
            continue;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            // Audit-Frame (zuerst gesendet vor dem KI-Stream)
            if (parsed && parsed.__audit__) {
              const audit = parsed.__audit__ as WikiAuditInfo;
              setAuditInfo(audit);
              const usedTitles = (audit.used || []).map((e) => e.title.toLowerCase());
              const homotoxExpected = selectedCategories.some((c) => /homotoxikologie/i.test(c)) || bevorzugteLinie.some((l) => /heel|homotox/i.test(l));
              if (homotoxExpected && !usedTitles.some((t) => t.includes("therapeutischer index") || t.includes("homotox"))) {
                toast({ title: "Hinweis", description: "Homotoxikologie/Heel wurde gewählt, erscheint aber nicht im gelesenen Wiki-Kontext – bitte Audit öffnen.", variant: "destructive" });
              }
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
              // Auto-scroll
              if (resultRef.current) {
                resultRef.current.scrollTop = resultRef.current.scrollHeight;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (!completed && accumulated.trim()) {
        setResult(accumulated);
        toast({
          title: "Zwischenstand gesichert",
          description: "Die Verbindung wurde unterbrochen, aber der bisherige Therapieplan bleibt zur Bearbeitung erhalten.",
        });
      }

      // Auto-Save wenn Pseudonym vorhanden
      if (pseudonymId.trim() && accumulated.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: saveErr } = await (supabase as any).from("therapy_sessions").insert({
            pseudonym_id: pseudonymId.trim(),
            created_by: user.id,
            eingabe_daten: buildInputData({ autoSavedDraft: false }),
            empfehlung: accumulated,
            notiz: "",
          });
          if (saveErr) {
            toast({ title: "Speichern fehlgeschlagen", description: saveErr.message, variant: "destructive" });
          } else {
            toast({ title: "Sitzung gespeichert", description: `Pseudonym ${pseudonymId.trim()}` });
            setHistoryRefresh((n) => n + 1);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Fehler", description: e.message, variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleReset = () => {
    const currentInputDraftKey = inputDraftKey;
    setPseudonymId("");
    setPathogens([emptyEntry()]);
    setSymptome("");
    setErkrankung("");
    setAlter("");
    setGeschlecht("");
    setGroesseCm("");
    setGewichtKg("");
    setSchwanger("nein");
    setMedikamente("");
    setBisherigeMittel("");
    setBudget("");
    setLaborErhoeht("");
    setLaborErniedrigt("");
    setLaborKomplett("");
    setLaborDatum("");
    setStuhlbefund("");
    setArztbericht("");
    setArztberichtDatum("");
    setMetatronHeel("");
    setSelectedCategories([]);
    setBevorzugteLinie([]);
    setPinnedMittel([]);
    setUseMapReduce(true);
    setResult("");
    setAuditInfo(null);
    setManualMittel([]);
    setManualDiagnosen([]);
    setTherapieNotiz("");
    setWorkflowStage("edit");
    try { sessionStorage.removeItem("therapy.draftInputs.v1"); } catch {}
    if (currentInputDraftKey) { try { localStorage.removeItem(currentInputDraftKey); } catch {} }
    if (draftStageKey) { try { localStorage.removeItem(draftStageKey); } catch {} }
  };

  // Kombinierter Markdown-String (KI-Auswahl + manuelle Mittel) für finale Speicherung
  const buildFinalMarkdown = (): string => {
    const parsed = parseTherapyMarkdown(result);
    const filteredCategories = parsed.categories
      .map((g, ci) => ({
        ...g,
        remedies: g.remedies.filter((_, ri) => selectedKeys.has(`${ci}|${ri}`)),
      }))
      .filter((g) => g.remedies.length > 0);
    const lines: string[] = [];
    parsed.intro.forEach((s) => {
      lines.push(`## ${s.emoji} ${s.title}`, s.content, "");
    });
    filteredCategories.forEach((g) => {
      lines.push(`## ${g.emoji} ${g.title}`);
      g.remedies.forEach((r) => {
        const name = r.latin ? `**${r.name}** (${r.latin})` : `**${r.name}**`;
        lines.push(`- ${name} | ${r.dosage} | ${r.application} | ${r.duration} | ${r.priorityRaw} | ${r.cost} | ${r.reason}`);
      });
      lines.push("");
    });
    const mm = manualMittel.filter((m) => m.name.trim());
    if (mm.length) {
      lines.push(`## ✍️ Manuell ergänzte Mittel (Therapeut)`);
      mm.forEach((m) => {
        lines.push(`- **${m.name}** | ${m.dosage || "—"} | ${m.application || "—"} | ${m.duration || "—"} | manuell | — | ${m.reason || ""}`);
      });
      lines.push("");
    }
    parsed.outro.forEach((s) => {
      lines.push(`## ${s.emoji} ${s.title}`, s.content, "");
    });
    if (therapieNotiz.trim()) {
      lines.push(`## 📝 Notiz Therapeut`, therapieNotiz.trim(), "");
    }
    return lines.join("\n");
  };

  const handleFinalize = async () => {
    if (!pseudonymId.trim()) {
      toast({ title: "Pseudonym-ID fehlt", description: "Bitte oben eine Pseudonym-ID vergeben oder generieren.", variant: "destructive" });
      return;
    }
    const finalMd = buildFinalMarkdown();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Nicht angemeldet", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("therapy_sessions").insert({
      pseudonym_id: pseudonymId.trim(),
      created_by: user.id,
      eingabe_daten: buildInputData({ manualMittel, manualDiagnosen, finalized: true, autoSavedDraft: false }),
      empfehlung: finalMd,
      notiz: therapieNotiz,
    });
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    setWorkflowStage("finalized");
    setHistoryRefresh((n) => n + 1);
    if (inputDraftKey) { try { localStorage.removeItem(inputDraftKey); } catch {} }
    if (draftStageKey) { try { localStorage.removeItem(draftStageKey); } catch {} }
    toast({ title: "✓ Therapieplan gespeichert", description: `Finalisiert für Pseudonym ${pseudonymId.trim()}. Druck jetzt verfügbar.` });
  };


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Stethoscope className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Therapie-Empfehlung</h1>
        <Badge variant="secondary" className="text-xs">KI-gestützt</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Geben Sie die Belastungen, Symptome oder Erkrankung des Patienten ein. Die KI analysiert Ihre Wissensdatenbank und erstellt eine individuelle Therapie-Empfehlung mit Sicherheitsprüfung.
      </p>

      {/* Pseudonym & DSGVO-Hinweis */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Pseudonym-ID
            <span className="text-xs font-normal text-muted-foreground">(zur Wiedererkennung des Patienten)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                value={pseudonymId}
                onChange={(e) => setPseudonymId(e.target.value)}
                placeholder="z. B. P-2026-0042 oder eigener Code"
                className="font-mono"
              />
            </div>
            <Button variant="outline" onClick={handleGeneratePseudonym} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-ID
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const pid = pseudonymId.trim();
                if (!pid) {
                  toast({ title: "Pseudonym-ID fehlt", description: "Bitte zuerst eine Pseudonym-ID eingeben.", variant: "destructive" });
                  return;
                }
                loadedInputDraftForPidRef.current = "";
                loadCloudDraft(pid);
              }}
              className="gap-1.5"
              disabled={!pseudonymId.trim()}
              title="Alle bisher gespeicherten Eingaben (Labor, Arztbericht, etc.) für diese Pseudonym-ID erneut zusammenführen und ins Formular laden"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Daten neu laden
            </Button>
          </div>
          <div className="flex gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded p-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>DSGVO-Konformität:</strong> Niemals Klarnamen, Adressen, Geburtsdaten oder Kontaktdaten in den Feldern unten eingeben.
              Die Zuordnung Pseudonym ↔ Patient erfolgt ausschließlich in deiner lokalen, geschützten Patientenakte.
              Bei vorhandener Pseudonym-ID wird die Empfehlung automatisch im Verlauf gespeichert.
            </span>
          </div>
          {pseudonymId.trim() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={autoSaveStatus === "error" ? "destructive" : "secondary"} className="h-5">
                {autoSaveStatus === "saving" && "Auto-Sicherung läuft…"}
                {autoSaveStatus === "saved" && "Auto-Sicherung gespeichert"}
                {autoSaveStatus === "error" && "Auto-Sicherung fehlgeschlagen"}
                {autoSaveStatus === "idle" && "Auto-Sicherung bereit"}
              </Badge>
              <span>Labor, Arztbericht und alle Eingaben werden laufend unter diesem Pseudonym gesichert.</span>
            </div>
          )}
          {clinicalLoadInfo?.pid === pseudonymId.trim() && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Zusammengeführt:</span>{" "}
                  <strong>{clinicalLoadInfo.sessionCount}</strong> Sitzung{clinicalLoadInfo.sessionCount !== 1 ? "en" : ""}
                </div>
                <div>
                  <span className="text-muted-foreground">Labor geladen:</span>{" "}
                  <strong>{clinicalLoadInfo.laborLines}</strong> Zeile{clinicalLoadInfo.laborLines !== 1 ? "n" : ""}
                </div>
                <div>
                  <span className="text-muted-foreground">Arztbrief:</span>{" "}
                  <strong>{clinicalLoadInfo.arztChars > 0 ? `${clinicalLoadInfo.arztChars} Zeichen` : "nicht gespeichert"}</strong>
                  <span className="text-muted-foreground"> · {clinicalLoadInfo.loadedAt}</span>
                </div>
              </div>
              {clinicalLoadInfo.laborLines === 0 && clinicalLoadInfo.arztChars === 0 && (
                <div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                  Für diese Pseudonym-ID sind aktuell keine Labor- oder Arztbriefdaten in der Cloud gespeichert.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verlauf bei vorhandenem Pseudonym */}
      {pseudonymId.trim() && (
        <PseudonymHistory
          key={`${pseudonymId}-${historyRefresh}`}
          pseudonymId={pseudonymId}
          onLoadSession={handleLoadSession}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            ⭐ Schwerpunkt-Ordner
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Die KI durchsucht <strong>immer die gesamte Wissensdatenbank</strong>. Hier markierte Ordner werden <strong>garantiert vollständig</strong> berücksichtigt – z.B. <em>Vitaplace</em> bei Stuhldiagnostik oder <em>Homotoxikologie</em> bei diffusen Symptomen. Andere Treffer gehen dadurch nicht verloren.
          </p>
          <CategoryFilter selected={selectedCategories} onChange={setSelectedCategories} />
        </CardContent>
      </Card>

      {/* Bevorzugte Mittel / Pinning */}
      <PreferredRemediesCard
        bevorzugteLinie={bevorzugteLinie}
        onBevorzugteLinieChange={setBevorzugteLinie}
        pinnedMittel={pinnedMittel}
        onPinnedMittelChange={setPinnedMittel}
      />

      {/* Input Form */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Main inputs */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-semibold">
                Patientenbefund
              </span>
              <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                {[symptome, erkrankung, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, arztbericht, metatronHeel, sonstigeUntersuchungen, perplexityAnalyse, bisherigeMittel]
                  .filter((s) => s && s.trim()).length}/11 Felder
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <Tabs defaultValue="befund" className="w-full">
              <TabsList className="grid w-full grid-cols-5 h-auto gap-1 bg-muted/60">
                <TabsTrigger value="befund" className="text-[11px] sm:text-xs px-1 py-2 flex flex-col gap-0.5 leading-tight whitespace-normal">
                  <span>🩺 Befund</span>
                  <span className="text-[9px] opacity-70 font-mono">
                    {[symptome, erkrankung].filter((s) => s.trim()).length + pathogens.filter((p) => p.name.trim()).length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="labor" className="text-[11px] sm:text-xs px-1 py-2 flex flex-col gap-0.5 leading-tight whitespace-normal">
                  <span>🧪 Labor</span>
                  <span className="text-[9px] opacity-70 font-mono">
                    {[laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund].filter((s) => s.trim()).length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="arzt" className="text-[11px] sm:text-xs px-1 py-2 flex flex-col gap-0.5 leading-tight whitespace-normal">
                  <span>📄 Arzt/NLS</span>
                  <span className="text-[9px] opacity-70 font-mono">
                    {[arztbericht, metatronHeel].filter((s) => s.trim()).length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="grossdaten" className="text-[11px] sm:text-xs px-1 py-2 flex flex-col gap-0.5 leading-tight whitespace-normal data-[state=active]:bg-indigo-100 dark:data-[state=active]:bg-indigo-950/40">
                  <span>📚 Großdaten</span>
                  <span className="text-[9px] opacity-70 font-mono">
                    {((sonstigeUntersuchungen.length + perplexityAnalyse.length) / 1000).toFixed(0)}k Z.
                  </span>
                </TabsTrigger>
                <TabsTrigger value="mittel" className="text-[11px] sm:text-xs px-1 py-2 flex flex-col gap-0.5 leading-tight whitespace-normal">
                  <span>💊 Mittel</span>
                  <span className="text-[9px] opacity-70 font-mono">
                    {bisherigeMittel.trim() ? "1" : "0"}
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* ===== TAB: Befund ===== */}
              <TabsContent value="befund" className="space-y-3 mt-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                    Belastungen / Pathogene
                  </label>
                  <PathogenInput entries={pathogens} onChange={setPathogens} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Symptome</label>
                  <Textarea
                    value={symptome}
                    onChange={(e) => setSymptome(e.target.value)}
                    placeholder="z.B. chronische Müdigkeit, Gelenkschmerzen, Verdauungsbeschwerden..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Erkrankung / Diagnose</label>
                  <Input
                    value={erkrankung}
                    onChange={(e) => setErkrankung(e.target.value)}
                    placeholder="z.B. Borreliose, Hashimoto, CFS..."
                  />
                </div>
              </TabsContent>

              {/* ===== TAB: Labor ===== */}
              <TabsContent value="labor" className="space-y-3 mt-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">🔬 Erhöhte Laborwerte</label>
                  <Textarea
                    value={laborErhoeht}
                    onChange={(e) => setLaborErhoeht(e.target.value)}
                    placeholder="z.B. LDL 185 mg/dl, Triglyzeride 210 mg/dl, hsCRP 4.2, Homocystein 18..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">🔬 Erniedrigte Laborwerte</label>
                  <Textarea
                    value={laborErniedrigt}
                    onChange={(e) => setLaborErniedrigt(e.target.value)}
                    placeholder="z.B. Vitamin D 12 ng/ml, Ferritin 8, Omega-3-Index 3.2%, HDL 35..."
                    rows={2}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                    <label className="text-sm font-medium block">🧪 Alle Laborwerte (Klassisches Labor)</label>
                    <div className="flex items-center gap-2 ml-auto">
                      <WorkloadBadge chars={laborKomplett.length} hint="Labor: Werte abgleichen, Referenzbereiche, Verlauf" />
                      <LabImageUpload onExtracted={(t) => {
                        const next = laborKomplett ? `${laborKomplett.trim()}\n\n${t}` : t;
                        setLaborKomplett(next);
                        saveClinicalSnapshot({ laborKomplett: next }, "Laborwerte");
                      }} />
                    </div>
                  </div>
                  <Textarea
                    value={laborKomplett}
                    onChange={(e) => setLaborKomplett(e.target.value)}
                    placeholder="Komplettes klassisches Labor zur Gesamtbewertung – z.B. Großes Blutbild, Differentialblutbild, Leberwerte (GOT/GPT/GGT), Nierenwerte (Krea/Harnstoff/eGFR), Elektrolyte, TSH/fT3/fT4, HbA1c, Lipidstatus, Gerinnung, CRP, Eisenstatus, B12, Folsäure..."
                    rows={5}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">📅 Labor erstellt am:</label>
                    <Input
                      type="date"
                      value={laborDatum}
                      onChange={(e) => setLaborDatum(e.target.value)}
                      className="h-8 w-auto text-xs"
                    />
                    {laborDatum && (
                      <button type="button" onClick={() => setLaborDatum("")} className="text-xs text-muted-foreground underline">zurücksetzen</button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Vollständige Laborübersicht (auch unauffällige Werte) – manuell eintragen oder Fotos/Scans hochladen (KI extrahiert automatisch).</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">🧫 Stuhlbefund / Mikrobiom</label>
                  <Textarea
                    value={stuhlbefund}
                    onChange={(e) => setStuhlbefund(e.target.value)}
                    placeholder="z.B. Candida albicans ++, Klebsiella ++, Lactobacillus ↓, Bifidobacterium ↓, sIgA 280 (niedrig), Calprotectin 95 µg/g, pH 6.8, Zonulin erhöht, Pankreas-Elastase 180 (vermindert)..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Mikrobiom-Befund, Verdauungsmarker (Elastase, Gallensäuren), Entzündungsmarker (Calprotectin, sIgA, Zonulin), Pilze, Parasiten.</p>
                </div>
              </TabsContent>

              {/* ===== TAB: Arzt & NLS ===== */}
              <TabsContent value="arzt" className="space-y-3 mt-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <label className="text-sm font-medium block">📄 Arztbericht / Arztbrief / Facharzt-Befund</label>
                    <div className="flex items-center gap-2 ml-auto">
                      <WorkloadBadge chars={arztbericht.length} hint="Arztbrief: Diagnosen, Anamnese, Beurteilung, Therapie verstehen" />
                      <LabImageUpload mode="doctor" onExtracted={(t) => {
                        const next = arztbericht ? `${arztbericht.trim()}\n\n${t}` : t;
                        setArztbericht(next);
                        saveClinicalSnapshot({ arztbericht: next }, "Arztbrief");
                      }} />
                    </div>
                  </div>
                  <Textarea
                    value={arztbericht}
                    onChange={(e) => setArztbericht(e.target.value)}
                    placeholder="z.B. Diagnosen mit ICD-10, Anamnese, Befund (Bildgebung/Histologie), Beurteilung des Arztes, Therapieempfehlung mit Medikation..."
                    rows={6}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">📅 Arztbericht erstellt am:</label>
                    <Input
                      type="date"
                      value={arztberichtDatum}
                      onChange={(e) => setArztberichtDatum(e.target.value)}
                      className="h-8 w-auto text-xs"
                    />
                    {arztberichtDatum && (
                      <button type="button" onClick={() => setArztberichtDatum("")} className="text-xs text-muted-foreground underline">zurücksetzen</button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Arztbrief, Entlassbrief, Facharzt-/Bildgebungs-/OP-/Histologie-Befund. Manuell eintragen oder Fotos/Scans hochladen (KI extrahiert strukturiert in Diagnosen, Anamnese, Befund, Beurteilung, Therapie).</p>
                </div>
                <div className="rounded-md border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/10 p-3">
                  <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                    <Star className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                    Heel-Mittel aus Metatron-/NLS-Auswertung
                  </label>
                  <Textarea
                    value={metatronHeel}
                    onChange={(e) => setMetatronHeel(e.target.value)}
                    placeholder="z.B. Lymphomyosot, Traumeel S, Hepeel, Nux vomica-Homaccord, Engystol, Mucosa compositum, Coenzyme compositum, Galium-Heel..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Die Metatron-/NLS-Resonanzanalyse listet u.a. Heel-Komplexmittel. Hier eingegebene Mittel werden <strong>zwingend</strong> in die KI-Auswertung übernommen (passend zur Indikation, mit Wiki-Dosierung sofern hinterlegt) und in der Empfehlung mit der Begründung „aus Metatron/NLS-Resonanz" markiert.
                  </p>
                </div>
              </TabsContent>

              {/* ===== TAB: Großdaten (Sonstige + Perplexity) — viel Platz, 100+ Seiten ===== */}
              <TabsContent value="grossdaten" className="space-y-4 mt-4">
                <WorkloadTotal
                  chars={laborKomplett.length + arztbericht.length + metatronHeel.length + sonstigeUntersuchungen.length + perplexityAnalyse.length}
                  label="Gesamter Sichtungs-/Auswertungsaufwand (Honorar-Basis 100 €/h)"
                />
                <div className="rounded-md border border-indigo-300/70 bg-gradient-to-br from-indigo-50/60 to-background dark:from-indigo-950/15 dark:border-indigo-900/40 p-3">
                  <label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <ClipboardList className="h-4 w-4 text-indigo-600" />
                    Sonstige / unsortierte Voruntersuchungen
                    <span className="ml-auto flex items-center gap-2 text-[11px] font-mono">
                      <WorkloadBadge chars={sonstigeUntersuchungen.length} hint="Mehrere Arzt-Befunde (DE/EN/FR) sichten, einordnen, chronologisch bewerten" />
                      {sonstigeUntersuchungen.length > 80_000 && !useProModel && (
                        <button
                          type="button"
                          onClick={() => setUseProModel(true)}
                          className="px-2 py-0.5 rounded border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-semibold"
                          title="Aktiviert Gemini-2.5-Pro (1 Mio Token Kontext) für die KI-Auswertung"
                        >
                          → Pro-Modell aktivieren
                        </button>
                      )}
                      {useProModel && sonstigeUntersuchungen.length > 80_000 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">✓ Pro aktiv</span>
                      )}
                    </span>
                  </label>
                  <div className="mb-2">
                    <MultiDocUpload
                      ocrMode="doctor"
                      label="📂 PDFs / Bilder hochladen (auto-extrahieren)"
                      onExtracted={(t) => {
                        const next = sonstigeUntersuchungen ? `${sonstigeUntersuchungen.trim()}\n\n${t}` : t;
                        setSonstigeUntersuchungen(next);
                      }}
                    />
                  </div>
                  <Textarea
                    value={sonstigeUntersuchungen}
                    onChange={(e) => setSonstigeUntersuchungen(e.target.value)}
                    placeholder={"Gemischte Befunde mit eigenen Untersuchungsdaten – KI extrahiert Datum + Typ automatisch:\n\n— MRT LWS vom 14.03.2024: ...\n— Sono Abdomen vom 02.11.2025: ...\n— EAV-Messung vom 08.06.2026: ...\n— Bioresonanz/NLS-Auswertung vom ...\n— EKG/Lufu/Allergietest/Knochendichte vom ...\n— Reha-/Kurbericht vom ...\n— Selbstmessungen (RR, HRV, CGM) Zeitraum ...\n\n100+ Seiten kein Problem – wird VOLLSTÄNDIG verarbeitet (kein Trimmen, kein Stichproben)."}
                    rows={22}
                    className="font-sans text-[13px] leading-relaxed resize-y max-h-[70vh]"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <strong className="text-indigo-700 dark:text-indigo-300">100% vollständig verarbeitet</strong> – auch 100+ Seiten. Die KI extrahiert die Untersuchungsdaten selbständig (TT.MM.JJJJ, „März 2024", „vor 2 Jahren" …) und ordnet jeden Befund seinem Datum / Typ zu (Bildgebung → Organfokus, EAV/NLS → Resonanz-Hinweis, Selbstmessung → Verlaufstrend, Reha-Bericht → Anamnesekontext). Output-Sektion <em>🗂️ Voruntersuchungen – chronologische Auswertung</em> entsteht automatisch. <strong>Bei &gt; 80 k Zeichen unbedingt Pro-Modell</strong> (Gemini-2.5-Pro, 1 Mio Token Kontext) – Schalter weiter unten oder oben rechts.
                  </p>
                </div>

                <div className="rounded-md border border-teal-300/70 bg-gradient-to-br from-teal-50/60 to-background dark:from-teal-950/15 dark:border-teal-900/40 p-3">
                  <label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <Search className="h-4 w-4 text-teal-600" />
                    Perplexity-Recherche / externe AI-Zusatzauswertung
                    <span className="ml-auto">
                      <WorkloadBadge chars={perplexityAnalyse.length} hint="Recherche-Auswertung lesen, Quellen prüfen, in DDx einarbeiten" />
                    </span>
                  </label>
                  <Textarea
                    value={perplexityAnalyse}
                    onChange={(e) => setPerplexityAnalyse(e.target.value)}
                    placeholder={"Komplette Perplexity-/Recherche-Auswertung 1:1 einfügen (mit Zitaten/Quellen).\n\nZ.B. Literaturrecherche zu seltener Diagnose, aktuelle Studienlage zu einem Wirkstoff, Differentialdiagnose-Liste aus AI-Search, S3-Leitlinien-Auszug, PubMed-Treffer (PMIDs), Cochrane-Reviews ...\n\nWird als zusätzlicher Evidenz-Kontext berücksichtigt – Wiki-Mittel haben weiterhin Vorrang, aber Hinweise aus der Recherche fließen in die Differentialdiagnostik & Begründung ein."}
                    rows={14}
                    className="font-sans text-[13px] leading-relaxed resize-y max-h-[60vh]"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Externer Recherche-Kontext (Perplexity, PubMed, Leitlinien). Quellen daraus dürfen zitiert werden, ersetzen aber NICHT die hauseigene Wissensdatenbank. Output-Sektion <em>🔎 Differentialdiagnostik (vertieft)</em> wird automatisch erzeugt, sobald hier oder im Sonstige-Feld Inhalt steht – mit 3–6 DDs, ICD-10, Wahrscheinlichkeit, Dafür/Dagegen-Befunden.
                  </p>
                </div>

                {(sonstigeUntersuchungen.length + perplexityAnalyse.length) > 80_000 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <strong>Großer Patienten-Kontext erkannt</strong> ({((sonstigeUntersuchungen.length + perplexityAnalyse.length) / 1000).toFixed(0)} k Zeichen ≈ {Math.round((sonstigeUntersuchungen.length + perplexityAnalyse.length) / 2500)} Seiten). Für tiefenpräzise Auswertung <strong>Gemini-2.5-Pro</strong> empfohlen – Schalter „🧠 Tieferes Reasoning-Modell (Pro)" unter der Live-Übersicht.
                      {!useProModel && (
                        <button
                          type="button"
                          onClick={() => setUseProModel(true)}
                          className="ml-2 px-2 py-0.5 rounded border border-amber-500 bg-white hover:bg-amber-100 text-amber-800 font-semibold"
                        >
                          Jetzt aktivieren
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ===== TAB: Mittel ===== */}
              <TabsContent value="mittel" className="space-y-3 mt-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                    <Pill className="h-3.5 w-3.5 text-emerald-600" />
                    Bisherige Naturheilmittel
                  </label>
                  <Textarea
                    value={bisherigeMittel}
                    onChange={(e) => setBisherigeMittel(e.target.value)}
                    placeholder="z.B. Schwarzwalnuss 15 Tropfen 3x/Tag, Wermut 200mg morgens, Oreganoöl 2 Kapseln..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Was bekommt der Patient aktuell an Naturheilmitteln? (inkl. Dosis) – Die KI bewertet diese kritisch und integriert / ersetzt / ergänzt sie.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>


        {/* Right: Safety checks */}
        <Card className="border-orange-300/60 bg-gradient-to-br from-orange-50/40 via-background to-rose-50/30 dark:from-orange-950/10 dark:via-background dark:to-rose-950/10 dark:border-orange-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <span className="bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent font-semibold">
                Patientenprofil & Sicherheit
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Block 1: Konstitution */}
            <div className="rounded-lg border border-sky-300/60 bg-sky-50/60 dark:bg-sky-950/15 dark:border-sky-900/40 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Baby className="h-3.5 w-3.5" /> Konstitution
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Alter (Jahre)</label>
                  <Input
                    type="number"
                    value={alter}
                    onChange={(e) => setAlter(e.target.value)}
                    placeholder="z.B. 45"
                    min={0}
                    max={120}
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Geschlecht</label>
                  <Select value={geschlecht} onValueChange={setGeschlecht}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weiblich">♀ Weiblich</SelectItem>
                      <SelectItem value="maennlich">♂ Männlich</SelectItem>
                      <SelectItem value="divers">⚧ Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Größe (cm)</label>
                  <Input
                    type="number"
                    value={groesseCm}
                    onChange={(e) => setGroesseCm(e.target.value)}
                    placeholder="z.B. 175"
                    min={50}
                    max={250}
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Gewicht (kg)</label>
                  <Input
                    type="number"
                    value={gewichtKg}
                    onChange={(e) => setGewichtKg(e.target.value)}
                    placeholder="z.B. 78"
                    min={10}
                    max={400}
                    step="0.1"
                    className="bg-background"
                  />
                </div>
              </div>

              {bmiInfo && (
                <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 border ${
                  bmiInfo.tone === "danger"
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : bmiInfo.tone === "warn"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                }`}>
                  <span className="font-bold text-sm">BMI {bmiInfo.bmi}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{bmiInfo.kategorie}</div>
                    {bmiInfo.hinweis && <div className="opacity-90 mt-0.5">{bmiInfo.hinweis}</div>}
                  </div>
                </div>
              )}

              {alter && parseInt(alter) < 12 && (
                <p className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100/70 dark:bg-orange-950/30 rounded px-2 py-1">⚠️ Pädiatrische Einschränkungen werden berücksichtigt</p>
              )}
            </div>

            {/* Block 2: Reproduktion (nur weiblich) */}
            <div className="rounded-lg border border-pink-300/60 bg-pink-50/60 dark:bg-pink-950/15 dark:border-pink-900/40 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Schwangerschaft / Stillzeit
              </div>
              <Select value={schwanger} onValueChange={setSchwanger}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nein">Nein / nicht relevant</SelectItem>
                  <SelectItem value="schwanger">Schwanger</SelectItem>
                  <SelectItem value="stillend">Stillend</SelectItem>
                  <SelectItem value="kinderwunsch">Kinderwunsch</SelectItem>
                </SelectContent>
              </Select>
              {schwanger !== "nein" && (
                <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/30 rounded px-2 py-1">⚠️ Viele Naturheilmittel sind kontraindiziert!</p>
              )}
            </div>

            {/* Block 3: Medikation */}
            <div className="rounded-lg border border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/15 dark:border-violet-900/40 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5" /> Aktuelle Medikamente
              </div>
              <Textarea
                value={medikamente}
                onChange={(e) => setMedikamente(e.target.value)}
                placeholder="z.B. Marcumar, Metformin, L-Thyroxin, SSRI..."
                rows={3}
                className="bg-background"
              />
              {medikamente.toLowerCase().match(/marcumar|warfarin|eliquis|xarelto|pradaxa|blutverdün/i) && (
                <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/30 rounded px-2 py-1">⚠️ Blutverdünner erkannt – strenge Einschränkungen!</p>
              )}
            </div>

            {/* Block 4: Budget */}
            <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/15 dark:border-emerald-900/40 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                💰 Maximales Budget (€)
              </div>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="z.B. 150"
                min={0}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">NutraMedix-Produkte ≈ 40 €/30ml. Bei knappem Budget werden günstige Alternativen (Gewürze, Hausmittel) bevorzugt.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live-Übersicht der erfassten Eingaben (Pathogene, Symptome, Erkrankung) */}
      <LiveInputSummary
        pathogens={pathogens}
        symptome={symptome}
        erkrankung={erkrankung}
        laborErhoeht={laborErhoeht}
        laborErniedrigt={laborErniedrigt}
        laborKomplett={laborKomplett}
        laborDatum={laborDatum}
        stuhlbefund={stuhlbefund}
        arztbericht={arztbericht}
        arztberichtDatum={arztberichtDatum}
        metatronHeel={metatronHeel}
        sonstigeUntersuchungen={sonstigeUntersuchungen}
        perplexityAnalyse={perplexityAnalyse}
      />

      {/* Map-Reduce-Schalter: KI bewertet ALLE 270 Einträge in Batches */}

      <Card className="border-blue-300/50 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-900/40">
        <CardContent className="pt-4 pb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={true}
              readOnly
              disabled
              className="mt-1 h-4 w-4 accent-blue-600 disabled:opacity-80"
            />
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                🚀 Vollständige KI-Auswertung aller Wiki-Einträge (Map-Reduce)
                <Badge variant="outline" className="text-[10px] h-4">Experimentell</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>VERBINDLICH AN:</strong> Stufe 1 = ein günstiges KI-Modell bewertet ALLE Einträge in Batches auf Relevanz.
                Stufe 2 = die Top-{35} kommen in Volltext an die finale Empfehlungs-KI.
                <br />
                Die schnelle Wort-Treffer-Filterung ist deaktiviert, weil sie Symptom-/Mittel-Einträge übersehen kann.
                <br />
                ⏱️ <strong>Dauer:</strong> 30–60 Sek. statt 10 Sek. &nbsp;|&nbsp; 💰 ~1–2 Cent extra pro Empfehlung
              </p>
            </div>
          </label>

          {/* Pro-Modell Schalter */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border border-amber-200 bg-amber-50/60 hover:bg-amber-50 transition-colors mt-3">
            <input
              type="checkbox"
              checked={useProModel}
              onChange={(e) => setUseProModel(e.target.checked)}
              className="mt-1 h-4 w-4 accent-amber-600"
            />
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                🧠 Tieferes Reasoning-Modell verwenden (Pro)
                <Badge variant="outline" className="text-[10px] h-4 border-amber-400 text-amber-700">Optional</Badge>
                <Popover>
                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-amber-300 bg-white hover:bg-amber-100 text-amber-800 transition-colors"
                    >
                      <Lightbulb className="h-3 w-3" />
                      Welches Modell wann?
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[420px] text-xs"
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-3">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        KI-Empfehlung pro Arbeitsschritt
                      </div>

                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                        <div className="font-semibold text-emerald-800">Stufe 1 · Wiki-Sichtung (Map-Reduce)</div>
                        <div className="text-emerald-900/80 mt-0.5">
                          <strong>Gemini 2.5 Flash-Lite</strong> – bewertet alle 280 Wiki-Einträge in Batches.
                          Schnell &amp; sehr günstig, fest verdrahtet (kein Schalter nötig).
                        </div>
                      </div>

                      <div className="rounded-md border border-sky-200 bg-sky-50 p-2">
                        <div className="font-semibold text-sky-800">Stufe 2 · Standard-Empfehlung</div>
                        <div className="text-sky-900/80 mt-0.5">
                          <strong>Gemini 2.5 Flash</strong> (Pro-Schalter <em>aus</em>) – empfohlen für
                          ~90% der Fälle: einfache bis mittlere Anamnesen, klare Pathogen-Liste, Standard-Symptome.
                          <br />⏱ 20–40 Sek &nbsp;|&nbsp; 💰 Bruchteil eines Cents
                        </div>
                      </div>

                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                        <div className="font-semibold text-amber-800">Stufe 2 · Pro-Empfehlung</div>
                        <div className="text-amber-900/80 mt-0.5">
                          <strong>Gemini 2.5 Pro</strong> (Pro-Schalter <em>an</em>) – empfohlen bei:
                          <ul className="list-disc pl-4 mt-1 space-y-0.5">
                            <li>multimorbiden Patienten (≥ 4 Diagnosen)</li>
                            <li>vielen Pathogenen (&gt; 8) oder komplexer Stuhl-/Laborlage</li>
                            <li>Schwangerschaft, Kindern, vielen Medikamenten (Interaktionen)</li>
                            <li>widersprüchlichen Vorbefunden / Therapieversagen</li>
                          </ul>
                          ⏱ 60–120 Sek &nbsp;|&nbsp; 💰 ca. 5–10× teurer
                        </div>
                      </div>

                      <div className="rounded-md border border-muted bg-muted/40 p-2 text-muted-foreground">
                        <strong className="text-foreground">Faustregel:</strong> Erst <em>Flash</em> probieren.
                        Wenn die Empfehlung zu oberflächlich oder widersprüchlich wirkt → erneut mit <em>Pro</em>.
                        <br />Vollständige Preisliste: Admin-Dashboard → Tab <strong>„KI-Modell &amp; Kosten"</strong>.
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Standard (aus):</strong> schnelles Modell – ca. 20–40 Sek., günstig (Bruchteil eines Cents pro Empfehlung).
                <br />
                <strong>Pro (an):</strong> tieferes Reasoning für komplexe Fälle – ca. 60–120 Sek., ungefähr 5–10× teurer pro Empfehlung. ⚠️ Bei sehr großem Kontext besteht Timeout-Risiko (150 s Edge-Limit).
                <br />
                Details &amp; aktuelle Preise: Admin-Dashboard → Tab <strong>„KI-Modell &amp; Kosten"</strong>.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => handleSubmit()} disabled={isStreaming} className="gap-2">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isStreaming ? (useMapReduce ? "Stufe 1+2 läuft (kann 30-60 Sek dauern)..." : "Analyse läuft...") : "Therapie-Empfehlung generieren"}
        </Button>
        <Button
          onClick={handleAnalyzeDocuments}
          disabled={isAnalyzingDocs || isStreaming}
          variant="outline"
          className="gap-2 border-sage-600 text-sage-700 hover:bg-sage-50"
          title="Reine Befund-Auswertung aller eingereichten Dokumente (ohne Therapie-Empfehlung) — große Mengen werden vollständig in Teilpaketen verarbeitet"
        >
          {isAnalyzingDocs ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
          {isAnalyzingDocs ? "Befund-Auswertung läuft…" : "Nur Befund-Auswertung (HTML)"}
        </Button>
        {isStreaming && (
          <Button variant="outline" onClick={handleCancel}>Abbrechen</Button>
        )}
        {result && !isStreaming && workflowStage === "finalized" && (
          <>
            <Button onClick={handlePrintPatient} className="gap-2 bg-primary hover:bg-primary/90">
              <FileText className="h-4 w-4" /> PDF Patient
              <Badge variant="secondary" className="ml-1 text-[10px]">{selectedKeys.size} Mittel</Badge>
            </Button>
            <Button onClick={handlePrintPraxis} disabled={isLoadingDiagnosen} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              {isLoadingDiagnosen ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              PDF Praxis
              {diagnosen.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{diagnosen.length} Dx</Badge>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWorkflowStage("edit");
                // Kurz warten, bis der Edit-View gerendert ist, dann zur Empfehlungsliste scrollen
                setTimeout(() => {
                  resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
                toast({
                  title: "Bearbeitung wieder geöffnet",
                  description: "Häkchen anpassen, dann mit „Auswahl übernehmen ▸\" zurück zur Vorschau.",
                });
              }}
              className="gap-2"
            >
              ◂ Zurück zur Bearbeitung
            </Button>
          </>
        )}
        {result && !isStreaming && (
          <Button variant="outline" onClick={handleReset} className="gap-2 ml-auto">
            <RotateCcw className="h-4 w-4" /> Neue Sitzung
          </Button>
        )}
      </div>

      {/* 📎 Weitere Dokumente nachladen */}
      <div className="rounded-md border border-sage-300/70 bg-sage-50/40 dark:bg-sage-950/10 p-3 flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <FileUp className="h-4 w-4 text-sage-700" />
            Weitere Befunde nachladen
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Patient hat zusätzliche Unterlagen geschickt? Hier hochladen — der extrahierte Text wird mit Zeitstempel an „Sonstige Voruntersuchungen" angehängt. Danach erneut <strong>„Nur Befund-Auswertung (HTML)"</strong> klicken, um die Auswertung zu ergänzen.
          </p>
        </div>
        <div className="shrink-0">
          <MultiDocUpload
            ocrMode="doctor"
            label="📎 Nachgereichte PDFs / Bilder hochladen"
            onExtracted={appendNachgereicht}
          />
        </div>
      </div>

      {/* 📥 Diagnosen + Symptome aus Befund-Auswertung in Eingabemaske übernehmen */}
      {extractedFromDocs && (extractedFromDocs.diagnoses.length > 0 || extractedFromDocs.symptoms.length > 0 || extractedFromDocs.medications.length > 0) && (
        <div className="rounded-md border border-emerald-300/70 bg-emerald-50/60 dark:bg-emerald-950/15 p-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="text-sm font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Aus der Befund-Auswertung extrahiert
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong>{extractedFromDocs.diagnoses.length}</strong> Diagnose(n), <strong>{extractedFromDocs.symptoms.length}</strong> Beschwerde(n) und <strong>{extractedFromDocs.medications.length}</strong> ärztlich verordnete(s) Medikament(e) gefunden — inkl. Quelle, Datum (sonst „unbekannt") und wörtlichem Zitat. In die Eingabemaske oben übernehmen?
              </p>
              {extractedFromDocs.medications.length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs cursor-pointer text-emerald-800 dark:text-emerald-300">Vorschau Medikamente</summary>
                  <ul className="text-xs mt-1 space-y-0.5 list-disc pl-5">
                    {extractedFromDocs.medications.slice(0, 8).map((m, i) => (
                      <li key={i}>
                        <strong>{m.name}</strong>{m.dosis ? ` ${m.dosis}` : ""}
                        <span className="text-muted-foreground"> · von: {m.vonWem?.trim() || "unbekannt"} · {m.datum?.trim() || "unbekannt"}</span>
                      </li>
                    ))}
                    {extractedFromDocs.medications.length > 8 && <li className="text-muted-foreground italic">… und {extractedFromDocs.medications.length - 8} weitere</li>}
                  </ul>
                </details>
              )}
              {extractedFromDocs.diagnoses.length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs cursor-pointer text-emerald-800 dark:text-emerald-300">Vorschau Diagnosen</summary>
                  <ul className="text-xs mt-1 space-y-0.5 list-disc pl-5">
                    {extractedFromDocs.diagnoses.slice(0, 8).map((d, i) => (
                      <li key={i}>
                        {d.icd10 && <code className="mr-1">{d.icd10}</code>}
                        <strong>{d.diagnose}</strong>
                        {d.quelle && <span className="text-muted-foreground"> · 📄 {d.quelle}</span>}
                      </li>
                    ))}
                    {extractedFromDocs.diagnoses.length > 8 && <li className="text-muted-foreground italic">… und {extractedFromDocs.diagnoses.length - 8} weitere</li>}
                  </ul>
                </details>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={applyExtractedToInputs} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white">
                <Plus className="h-3.5 w-3.5" /> In Eingabemaske übernehmen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setExtractedFromDocs(null)}>verwerfen</Button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow-Stage-Indikator */}
      {result && !isStreaming && (
        <WorkflowStepper stage={workflowStage} />
      )}

      {/* Result – Card layout */}
      {(result || isStreaming) && (
        <div ref={resultRef} className="space-y-4">
          <PatientContextBar
            alter={alter}
            geschlecht={geschlecht}
            bmi={bmiInfo?.bmi}
            bmiKategorie={bmiInfo?.kategorie}
            bmiTone={bmiInfo?.tone}
            schwanger={schwanger}
            medikamente={medikamente}
            budget={budget}
            laborErhoeht={laborErhoeht}
            laborErniedrigt={laborErniedrigt}
            stuhlbefund={stuhlbefund}
          />
          {auditInfo && <WikiAuditCard audit={auditInfo} />}
          {result && !isStreaming && workflowStage !== "finalized" && (
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardContent className="pt-4 pb-4 space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  📝 Notiz Therapeut <span className="text-xs font-normal text-muted-foreground">(erscheint nur auf Praxis-PDF)</span>
                </label>
                <Textarea
                  value={therapieNotiz}
                  onChange={(e) => setTherapieNotiz(e.target.value)}
                  placeholder="Interne Notizen, Beobachtungen, weiterer Behandlungsplan..."
                  rows={2}
                />
              </CardContent>
            </Card>
          )}

          {/* 🔄 Nachschlag-Modus: nur in Stage 'edit' */}
          {result && !isStreaming && workflowStage === "edit" && (
            <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10">
              <CardContent className="pt-4 pb-4 space-y-3">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                  Nachschlag – KI-Empfehlung erweitern
                  <span className="text-xs font-normal text-muted-foreground">(neue Symptome / Laborwerte / Befunde → KI ergänzt passende Wiki-Mittel)</span>
                </label>
                <Textarea
                  value={ergaenzung}
                  onChange={(e) => setErgaenzung(e.target.value)}
                  placeholder="z.B. Patient erinnert sich: nachts Wadenkrämpfe + Magnesium-Spiegel im Labor 0,68 mmol/l (niedrig); oder: Stuhlbefund nachgereicht – Akkermansia stark erniedrigt …"
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Bestehende Mittel & Häkchen bleiben erhalten. Neue Mittel werden mit 🆕 markiert und automatisch angehakt.
                  </p>
                  <Button
                    onClick={() => {
                      const txt = ergaenzung.trim();
                      if (!txt) {
                        toast({ title: "Leere Ergänzung", description: "Bitte Zusatz-Info eintragen.", variant: "destructive" });
                        return;
                      }
                      handleSubmit({ nachschlag: txt, previousResult: result });
                      setErgaenzung("");
                    }}
                    disabled={isStreaming || !ergaenzung.trim()}
                    className="gap-2 bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Empfehlung erweitern
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ➕ Manuelle Diagnosen – nur in Stage 'addons' */}
          {result && !isStreaming && workflowStage === "addons" && (
            <Card ref={manualAddonsRef} className="border-secondary/40 bg-secondary/[0.04] scroll-mt-24">
              <CardContent className="pt-4 pb-4 space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  🩺 Eigene Diagnosen ergänzen <span className="text-xs font-normal text-muted-foreground">(nur Praxis-PDF, kombiniert mit KI-Diagnosen)</span>
                </label>
                {manualDiagnosen.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Noch keine eigenen Diagnosen ergänzt.</p>
                )}
                <div className="space-y-2">
                  {manualDiagnosen.map((d, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                      <Input
                        className="col-span-2 font-mono text-sm"
                        placeholder="ICD-10 (opt.)"
                        value={d.icd10 || ""}
                        onChange={(e) => setManualDiagnosen((arr) => arr.map((x, i) => i === idx ? { ...x, icd10: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-4"
                        placeholder="Diagnose / Verdachtsdiagnose"
                        value={d.diagnose}
                        onChange={(e) => setManualDiagnosen((arr) => arr.map((x, i) => i === idx ? { ...x, diagnose: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-5"
                        placeholder="Begründung (optional)"
                        value={d.begruendung || ""}
                        onChange={(e) => setManualDiagnosen((arr) => arr.map((x, i) => i === idx ? { ...x, begruendung: e.target.value } : x))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="col-span-1 h-9 w-9 text-destructive"
                        onClick={() => setManualDiagnosen((arr) => arr.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setManualDiagnosen((arr) => [...arr, { diagnose: "", icd10: "", begruendung: "" }])}
                >
                  <Plus className="h-4 w-4" /> Diagnose hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ➕ Manuelle Mittel – nur in Stage 'addons' (mit Wiki-Autocomplete) */}
          {result && !isStreaming && workflowStage === "addons" && (
            <Card className="border-accent/30 bg-accent/[0.03]">
              <CardContent className="pt-4 pb-4 space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  💊 Eigene Mittel ergänzen
                  <span className="text-xs font-normal text-muted-foreground">
                    (Wiki-Suche oder freie Eingabe – {wikiRemedies.length} Wiki-Einträge verfügbar)
                  </span>
                </label>
                {manualMittel.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Noch keine eigenen Mittel ergänzt. Klick auf „Mittel hinzufügen" – tippe im Namensfeld, um Wiki-Vorschläge zu bekommen.</p>
                )}
                <div className="space-y-3">
                  {manualMittel.map((m, idx) => (
                    <ManualRemedyRow
                      key={idx}
                      entry={m}
                      wikiRemedies={wikiRemedies}
                      onChange={(patch) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, ...patch } : x))}
                      onRemove={() => setManualMittel((arr) => arr.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setManualMittel((arr) => [...arr, createEmptyManualRemedy()])}
                >
                  <Plus className="h-4 w-4" /> Mittel hinzufügen
                </Button>
                <div className="flex justify-end border-t pt-3 mt-2">
                  <Button onClick={goToPreviewFromAddons} className="gap-2">
                    ✓ Ergänzungen übernehmen und Vorschau anzeigen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stage 'edit' & 'addons': interaktive Empfehlungs-Liste mit Häkchen */}
          {workflowStage !== "preview" && workflowStage !== "finalized" && (
            <ParsedResultView
              result={result}
              isStreaming={isStreaming}
              stuhlbefund={stuhlbefund}
              selectedKeys={selectedKeys}
              onToggleRemedy={toggleRemedy}
              onToggleAll={toggleAllInCategory}
            />
          )}

          {/* Stage 'preview': read-only kombinierte Vorschau */}
          {workflowStage === "preview" && (
            <TherapyPreview
              result={result}
              selectedKeys={selectedKeys}
              manualMittel={manualMittel.filter((m) => m.name.trim())}
              manualDiagnosen={manualDiagnosen.filter((d) => d.diagnose.trim())}
              therapieNotiz={therapieNotiz}
            />
          )}

          {/* Stage 'finalized': Erfolg + read-only Vorschau */}
          {workflowStage === "finalized" && (
            <>
              <Card className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
                  <div>
                    <div className="font-semibold text-emerald-900 dark:text-emerald-200">Therapieplan finalisiert &amp; gespeichert</div>
                    <div className="text-xs text-emerald-800/80 dark:text-emerald-300/80">Pseudonym {pseudonymId.trim()} – Druck oben verfügbar.</div>
                  </div>
                </CardContent>
              </Card>
              <TherapyPreview
                result={result}
                selectedKeys={selectedKeys}
                manualMittel={manualMittel.filter((m) => m.name.trim())}
                manualDiagnosen={manualDiagnosen.filter((d) => d.diagnose.trim())}
                therapieNotiz={therapieNotiz}
              />
            </>
          )}

          {/* Stage-Navigation am Ende */}
          {result && !isStreaming && (
            <div className="sticky bottom-2 z-20 flex justify-between gap-3 bg-background/95 backdrop-blur border border-primary/30 rounded-lg p-3 shadow-elevated">
              {workflowStage === "edit" && (
                <>
                  <span className="text-xs text-muted-foreground self-center">
                    Stufe 1 von 3 · {selectedKeys.size} Mittel angehakt
                  </span>
                  <Button onClick={() => openManualAddons(true)} className="gap-2">
                    Auswahl übernehmen ▸
                  </Button>
                </>
              )}
              {workflowStage === "addons" && (
                <>
                  <Button variant="outline" onClick={() => setWorkflowStage("edit")} className="gap-2">
                    ◂ Zurück zur Auswahl
                  </Button>
                  <span className="text-xs text-muted-foreground self-center">
                    Stufe 2 von 3 · {manualMittel.filter((m) => m.name.trim()).length} eigene Mittel
                  </span>
                  <Button onClick={goToPreviewFromAddons} className="gap-2">
                    ✓ Ergänzungen übernehmen
                  </Button>
                </>
              )}
              {workflowStage === "preview" && (
                <>
                  <Button variant="outline" onClick={() => setWorkflowStage("edit")} className="gap-2">
                    ◂ Häkchen bearbeiten
                  </Button>
                  <Button variant="secondary" onClick={() => openManualAddons(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Mittel ergänzen
                  </Button>
                  <span className="text-xs text-muted-foreground self-center">
                    Stufe 3 von 3 · Vorschau – stimmt alles?
                  </span>
                  <Button onClick={handleFinalize} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    ✓ Plan ist OK – speichern
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Workflow-Stepper-Indikator ---
function WorkflowStepper({ stage }: { stage: "edit" | "addons" | "preview" | "finalized" }) {
  const steps: Array<{ key: typeof stage; label: string }> = [
    { key: "edit", label: "1. KI-Auswahl" },
    { key: "addons", label: "2. Eigene Ergänzungen" },
    { key: "preview", label: "3. Vorschau" },
    { key: "finalized", label: "✓ Gespeichert" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full border font-medium ${
              i === activeIdx
                ? "bg-primary text-primary-foreground border-primary"
                : i < activeIdx
                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">›</span>}
        </div>
      ))}
    </div>
  );
}

// --- Wiki-Autocomplete-Zeile für manuelle Mittel ---
function ManualRemedyRow({
  entry,
  wikiRemedies,
  onChange,
  onRemove,
}: {
  entry: ManualRemedyEntry;
  wikiRemedies: WikiRemedyEntry[];
  onChange: (patch: Partial<typeof entry>) => void;
  onRemove: () => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useMemo(() => {
    const q = entry.name.trim().toLowerCase();
    if (q.length < 2) return [];
    return wikiRemedies
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [entry.name, wikiRemedies]);

  const applyDosageSelect = (unit: string) => {
    if (!unit) return;
    onChange({ dosage: entry.dosage ? `${entry.dosage} · ${unit}` : unit });
  };

  const applyIntakePattern = (pattern: string) => {
    if (!pattern) return;
    onChange({ application: entry.application ? `${entry.application} · ${pattern}` : pattern });
  };

  // Merken, welcher Reason/Application zuletzt aus der Wiki gesetzt wurde.
  // Solange der Wert unverändert ist, dürfen wir ihn beim Mittel-Wechsel überschreiben.
  const wikiSetRef = useRef<{ reason: string; application: string; dosage: string }>({ reason: "", application: "", dosage: "" });

  const applyWikiRemedy = (s: WikiRemedyEntry) => {
    const newReason = s.reason || s.application || "";
    const newApplication = s.application || "";
    const newDosage = s.dosage || "";
    // Nur überschreiben, wenn das Feld leer ist ODER noch den letzten Wiki-Wert enthält
    // (d.h. der User hat es nicht selbst geändert).
    const keepReason = entry.reason && entry.reason !== wikiSetRef.current.reason;
    const keepApplication = entry.application && entry.application !== wikiSetRef.current.application;
    const keepDosage = entry.dosage && entry.dosage !== wikiSetRef.current.dosage;
    onChange({
      name: s.name,
      dosage: keepDosage ? entry.dosage : newDosage,
      application: keepApplication ? entry.application : newApplication,
      reason: keepReason ? entry.reason : newReason,
    });
    wikiSetRef.current = {
      reason: keepReason ? entry.reason : newReason,
      application: keepApplication ? entry.application : newApplication,
      dosage: keepDosage ? entry.dosage : newDosage,
    };
  };

  return (
    <div className="rounded-md border bg-background/80 p-3 space-y-2 relative">
      <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-12 md:col-span-3 relative">
        <Input
          placeholder="Mittelname (Wiki-Suche)"
          value={entry.name}
          onChange={(e) => {
            const val = e.target.value;
            onChange({ name: val });
            setShowSuggestions(true);
            // Exakter Wiki-Treffer? -> automatisch Felder synchronisieren
            const exact = wikiRemedies.find((r) => r.name.toLowerCase() === val.trim().toLowerCase());
            if (exact) applyWikiRemedy(exact);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent border-b last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyWikiRemedy(s);
                  setShowSuggestions(false);
                }}
              >
                <span className="font-medium">{s.name}</span>
                {s.latin && <span className="italic text-muted-foreground ml-1">({s.latin})</span>}
                {s.dosage && <span className="block text-[10px] text-muted-foreground">{s.dosage}</span>}
                {s.reason && <span className="block text-[10px] text-muted-foreground">Indikation: {s.reason}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input
        className="col-span-12 md:col-span-2 font-mono text-sm"
        placeholder="Dosierung"
        value={entry.dosage}
        onChange={(e) => onChange({ dosage: e.target.value })}
      />
      <Input
        className="col-span-12 md:col-span-2"
        placeholder="Anwendung"
        value={entry.application}
        onChange={(e) => onChange({ application: e.target.value })}
      />
      <Input
        className="col-span-10 md:col-span-1"
        placeholder="Dauer"
        value={entry.duration}
        onChange={(e) => onChange({ duration: e.target.value })}
      />
      <Input
        className="col-span-12 md:col-span-3"
        placeholder="Begründung / Indikation"
        value={entry.reason}
        onChange={(e) => onChange({ reason: e.target.value })}
      />
      <Button variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-destructive" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Select onValueChange={applyDosageSelect}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Dosierungsart auswählen" />
          </SelectTrigger>
          <SelectContent>
            {DOSAGE_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={applyIntakePattern}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Einnahmeschema auswählen" />
          </SelectTrigger>
          <SelectContent>
            {INTAKE_PATTERNS.map((pattern) => (
              <SelectItem key={pattern} value={pattern}>{pattern}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// --- Read-only Vorschau des kombinierten Plans ---
function TherapyPreview({
  result,
  selectedKeys,
  manualMittel,
  manualDiagnosen,
  therapieNotiz,
}: {
  result: string;
  selectedKeys: Set<string>;
  manualMittel: Array<{ name: string; dosage: string; application: string; duration: string; reason: string; group: string }>;
  manualDiagnosen: DiagnoseEntry[];
  therapieNotiz: string;
}) {
  const parsed = useMemo(() => parseTherapyMarkdown(result), [result]);
  const filteredCats = parsed.categories
    .map((g, ci) => ({ ...g, remedies: g.remedies.filter((_, ri) => selectedKeys.has(`${ci}|${ri}`)) }))
    .filter((g) => g.remedies.length > 0);

  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Vorschau – kombinierter Therapieplan
          <Badge variant="secondary" className="text-[10px]">{filteredCats.reduce((n, g) => n + g.remedies.length, 0) + manualMittel.length} Mittel</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {manualDiagnosen.length > 0 && (
          <section>
            <h3 className="font-semibold text-foreground mb-1">🩺 Eigene Diagnosen</h3>
            <ul className="space-y-1 text-xs">
              {manualDiagnosen.map((d, i) => (
                <li key={i}>
                  <span className="font-mono text-muted-foreground">{d.icd10 || "—"}</span> · <strong>{d.diagnose}</strong>
                  {d.begruendung && <span className="text-muted-foreground"> – {d.begruendung}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {filteredCats.map((g, i) => (
          <section key={i}>
            <h3 className="font-semibold text-primary mb-1">{g.emoji} {g.title}</h3>
            <ul className="space-y-1 text-xs">
              {g.remedies.map((r, j) => (
                <li key={j} className="border-l-2 border-primary/30 pl-2">
                  <strong>{r.name}</strong>{r.latin && <em className="text-muted-foreground"> ({r.latin})</em>}
                  <span className="text-muted-foreground"> · {r.dosage} · {r.application} · {r.duration}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {manualMittel.length > 0 && (
          <section>
            <h3 className="font-semibold text-accent-foreground mb-1">✍️ Manuell ergänzte Mittel</h3>
            <ul className="space-y-1 text-xs">
              {manualMittel.map((m, i) => (
                <li key={i} className="border-l-2 border-accent/40 pl-2">
                  <strong>{m.name}</strong>
                  <span className="text-muted-foreground"> · {m.dosage || "—"} · {m.application || "—"} · {m.duration || "—"}</span>
                  {m.reason && <span className="text-muted-foreground italic"> – {m.reason}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {therapieNotiz.trim() && (
          <section>
            <h3 className="font-semibold text-foreground mb-1">📝 Notiz Therapeut</h3>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{therapieNotiz}</p>
          </section>
        )}
        {filteredCats.length === 0 && manualMittel.length === 0 && (
          <p className="text-muted-foreground italic">Keine Mittel ausgewählt.</p>
        )}
      </CardContent>
    </Card>
  );
}


function ParsedResultView({
  result,
  isStreaming,
  stuhlbefund,
  selectedKeys,
  onToggleRemedy,
  onToggleAll,
}: {
  result: string;
  isStreaming: boolean;
  stuhlbefund: string;
  selectedKeys?: Set<string>;
  onToggleRemedy?: (key: string) => void;
  onToggleAll?: (categoryIndex: number, remedyIndices: number[], selectAll: boolean) => void;
}) {
  const parsed = useMemo(() => parseTherapyMarkdown(result), [result]);
  const deterministicGapSection = useMemo(() => buildStoolGapSection(stuhlbefund, result), [stuhlbefund, result]);
  const hasAiParsed = parsed.intro.length + parsed.categories.length + parsed.outro.length > 0;
  const hasGapCard = [...parsed.intro, ...parsed.outro].some((s) => /wissensdatenbank-lücken/i.test(s.title));
  const introSections = deterministicGapSection && !hasGapCard
    ? [...parsed.intro, deterministicGapSection]
    : parsed.intro;
  const hasParsed = introSections.length + parsed.categories.length + parsed.outro.length > 0;

  // Sichtbarkeits-Filter (Toggle-Chips). Standard: alles an.
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    introSections.forEach((s) => keys.push(`intro:${s.title}`));
    parsed.categories.forEach((g) => keys.push(`cat:${g.title}`));
    parsed.outro.forEach((s) => keys.push(`outro:${s.title}`));
    return keys;
  }, [introSections, parsed.categories, parsed.outro]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Neue Schlüssel automatisch sichtbar lassen, verschwundene aufräumen
  useEffect(() => {
    setHidden((prev) => {
      const next = new Set<string>();
      prev.forEach((k) => { if (allKeys.includes(k)) next.add(k); });
      return next;
    });
  }, [allKeys.join("|")]);

  const isVisible = (k: string) => !hidden.has(k);
  const toggle = (k: string) =>
    setHidden((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  const visibleIntro = introSections.filter((s) => isVisible(`intro:${s.title}`));
  const visibleCats = parsed.categories.filter((g) => isVisible(`cat:${g.title}`));
  const visibleOutro = parsed.outro.filter((s) => isVisible(`outro:${s.title}`));

  if (isStreaming && !hasParsed) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Analysiere Wissensdatenbank und erstelle Empfehlung…</span>
        </CardContent>
      </Card>
    );
  }

  const Chip = ({ k, label, emoji }: { k: string; label: string; emoji: string }) => {
    const active = isVisible(k);
    return (
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
          active
            ? "bg-primary/10 border-primary/40 text-foreground"
            : "bg-muted/40 border-border text-muted-foreground line-through opacity-70 hover:opacity-100"
        }`}
        aria-pressed={active}
        title={active ? "Klicken zum Ausblenden" : "Klicken zum Einblenden"}
      >
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <>
      {hasParsed && !isStreaming && (
        <Card className="border-dashed">
          <CardContent className="py-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="text-xs font-medium text-muted-foreground mt-1 mr-1 whitespace-nowrap">
                👁️ Anzeige filtern:
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {introSections.map((s) => (
                  <Chip key={`c-intro-${s.title}`} k={`intro:${s.title}`} label={s.title} emoji={s.emoji} />
                ))}
                {parsed.categories.map((g) => (
                  <Chip key={`c-cat-${g.title}`} k={`cat:${g.title}`} label={g.title} emoji={g.emoji} />
                ))}
                {parsed.outro.map((s) => (
                  <Chip key={`c-outro-${s.title}`} k={`outro:${s.title}`} label={s.title} emoji={s.emoji} />
                ))}
              </div>
              {hidden.size > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setHidden(new Set())}>
                  Alle anzeigen
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Per Klick aus-/einblenden. Ausgeblendete Bereiche werden auch im Druck/PDF nicht mehr angezeigt.
            </p>
          </CardContent>
        </Card>
      )}

      {visibleIntro.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleIntro.map((s, i) => (
            <FreeSectionCard key={`intro-${i}-${s.title}`} section={s} />
          ))}
        </div>
      )}

      {visibleCats.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-serif text-foreground flex items-center gap-2 mt-2">
            <Pill className="h-4 w-4 text-primary" />
            Empfohlene Mittel
            {isStreaming && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {!isStreaming && selectedKeys && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                ({selectedKeys.size} ausgewählt für Patienten-PDF – Häkchen entfernen, was nicht mit soll)
              </span>
            )}
          </h2>
          {visibleCats.map((g) => {
            const originalIndex = parsed.categories.findIndex((c) => c.title === g.title);
            return (
              <CategoryCard
                key={`cat-${originalIndex}-${g.title}`}
                group={g}
                categoryIndex={isStreaming ? undefined : originalIndex}
                selectedKeys={isStreaming ? undefined : selectedKeys}
                onToggleRemedy={onToggleRemedy}
                onToggleAll={onToggleAll}
              />
            );
          })}
        </div>
      )}

      {visibleOutro.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 mt-2">
          {visibleOutro.map((s, i) => (
            <FreeSectionCard key={`outro-${i}-${s.title}`} section={s} />
          ))}
        </div>
      )}

      {!hasAiParsed && result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Therapietext</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{result}</pre>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function buildStoolGapSection(stuhlbefund: string, result: string): FreeSection | null {
  if (!stuhlbefund.trim()) return null;

  const text = stuhlbefund.toLowerCase();
  const recommendation = result.toLowerCase();
  const lines: string[] = [];
  const addIfDetected = (label: string, detect: RegExp, expected: RegExp, wikiHint: string) => {
    if (!detect.test(text)) return;
    if (expected.test(recommendation)) {
      lines.push(`- ✅ **Substitution vorhanden** – ${label} auffällig/erniedrigt; passende Substitution wurde in der Empfehlung gefunden.`);
    } else {
      lines.push(`- ⚠️ **Substitution prüfen** – ${label} auffällig/erniedrigt, aber keine klare Substitution im Ergebnis erkannt → **Empfehlung Wiki-Ergänzung/Prüfung:** ${wikiHint}`);
    }
  };

  // Vitaplace-Produkte, die mehrere Probiotika-Stämme enthalten (Biotik Sensitiv, Biotik Balance, Vitaplace Darmsanierung).
  // Wenn die KI diese Produkte empfiehlt, gelten Lacto- und Bifido-Substitution als abgedeckt.
  const vitaplaceProbioticPattern = /biotik\s*(sensitiv|balance)|vitaplace\s*(sensitiv|balance|darmsanier)|colovital/i;
  const vitaplaceCovers = vitaplaceProbioticPattern.test(result);

  addIfDetected("Escherichia coli", /escherichia\s+coli|e\.\s*coli/, /mutaflor|symbioflor\s*2|nissle/, "E. coli-Aufbau mit Präparat, Dosierung, Dauer, Kontraindikationen.");
  addIfDetected("Enterokokken", /enterokokken|enterococcus/, /symbioflor\s*1|enterococcus|enterokokk/, "Enterococcus-Aufbau mit Präparat, Dosierung, Dauer, Kontraindikationen.");
  addIfDetected(
    "Lactobacillus",
    /lactobacillus.*↓|lactobacillus[^\n]*10\^([0-4])/,
    vitaplaceCovers ? /.*/ : /lactobacillus|l\.\s*(rhamnosus|acidophilus|plantarum|casei|paracasei|lactis)|biotik\s*(sensitiv|balance)|vitaplace\s*(sensitiv|balance|darmsanier)/,
    "Lactobacillus-spezifische Stämme und Präbiotika."
  );
  addIfDetected(
    "Bifidobacterium",
    /bifidobacterium.*↓|bifidobacterium[^\n]*10\^([0-8])/,
    vitaplaceCovers ? /.*/ : /bifidobacterium|b\.\s*(longum|lactis|bifidum|infantis)|biotik\s*(sensitiv|balance)|vitaplace\s*(sensitiv|balance|darmsanier)|cncm\s*i-?509[07]/,
    "Bifidobacterium-spezifische Stämme und Präbiotika."
  );

  if (/stuhl\s*ph[^\n]*(↓|5\.0|5,0)/i.test(stuhlbefund) && !/stuhl.?ph|gärungs|saccharolytisch/i.test(result)) {
    lines.push("- ⚠️ **Ursachen-/Referenzwert prüfen** – Stuhl-pH erniedrigt, aber keine klare Wiki-basierte Ursachenableitung im Ergebnis erkannt → **Empfehlung Wiki-Ergänzung:** Stuhl-pH mit Ursachen, Referenzen und Milieu-Therapie.");
  }
  if (/candida|geotrichum|hefen/i.test(stuhlbefund) && !/candida|geotrichum|hefen|antimyk/i.test(result)) {
    lines.push("- ⚠️ **Pathogen-Mittel prüfen** – Hefen/Pilze auffällig, aber kein klares Wiki-Mittel im Ergebnis erkannt → **Empfehlung Wiki-Ergänzung:** Candida/Geotrichum mit naturheilkundlicher Therapie und Grenzen.");
  }

  if (lines.length === 0) return null;
  return {
    emoji: "🕳️",
    title: "Wissensdatenbank-Lücken",
    variant: "warning",
    content: [
      "Automatisch aus dem Stuhlbefund geprüft, damit dieser Abschnitt sichtbar bleibt, auch wenn die KI ihn nicht als eigene Überschrift ausgibt.",
      "",
      ...lines,
    ].join("\n"),
  };
}
