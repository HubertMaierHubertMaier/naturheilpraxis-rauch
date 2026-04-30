import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Loader2, AlertTriangle, Baby, Pill, Heart, Send, RotateCcw, Printer, KeyRound, Sparkles, ShieldAlert, FileText, ClipboardList, Plus, X, RefreshCw, Star, Lightbulb } from "lucide-react";
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
  const [stuhlbefund, setStuhlbefund] = useState("");
  const [metatronHeel, setMetatronHeel] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bevorzugteLinie, setBevorzugteLinie] = useState<string[]>([]);
  const [pinnedMittel, setPinnedMittel] = useState<PinnedRemedy[]>([]);
  const [useMapReduce, setUseMapReduce] = useState(true);
  const [useProModel, setUseProModel] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [result, setResult] = useState("");
  const [auditInfo, setAuditInfo] = useState<WikiAuditInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [diagnosen, setDiagnosen] = useState<DiagnoseEntry[]>([]);
  const [isLoadingDiagnosen, setIsLoadingDiagnosen] = useState(false);
  const [therapieNotiz, setTherapieNotiz] = useState("");
  // Nachschlag-Modus
  const [ergaenzung, setErgaenzung] = useState("");
  const [isNachschlag, setIsNachschlag] = useState(false);
  // Manuelle Ergänzungen
  const [manualDiagnosen, setManualDiagnosen] = useState<DiagnoseEntry[]>([]);
  const [manualMittel, setManualMittel] = useState<Array<{ name: string; dosage: string; application: string; duration: string; reason: string; group: string }>>([]);
  // 4-Stufen-Workflow: edit (KI-Auswahl) → addons (eigene Mittel) → preview (Kontrolle) → finalized (gespeichert, Druck)
  const [workflowStage, setWorkflowStage] = useState<"edit" | "addons" | "preview" | "finalized">("edit");
  // Wiki-Autocomplete für manuelle Mittel
  const [wikiRemedies, setWikiRemedies] = useState<Array<{ name: string; latin?: string; dosage?: string; application?: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const manualAddonsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ---- Eingaben in sessionStorage spiegeln, damit ein versehentlicher Re-Mount
  // (z. B. durch Auth-Refresh oder Tab-Wechsel) die Daten nicht verliert. ----
  const DRAFT_KEY = "therapy.draftInputs.v1";
  const draftLoadedRef = useRef(false);
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
      if (typeof d?.stuhlbefund === "string") setStuhlbefund(d.stuhlbefund);
      if (typeof d?.metatronHeel === "string") setMetatronHeel(d.metatronHeel);
      if (Array.isArray(d?.selectedCategories)) setSelectedCategories(d.selectedCategories);
      if (Array.isArray(d?.bevorzugteLinie)) setBevorzugteLinie(d.bevorzugteLinie);
      if (Array.isArray(d?.pinnedMittel)) setPinnedMittel(d.pinnedMittel);
      if (typeof d?.useProModel === "boolean") setUseProModel(d.useProModel);
    } catch {}
  }, []);
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        pseudonymId, pathogens, symptome, erkrankung, alter, geschlecht,
        groesseCm, gewichtKg, schwanger, medikamente, bisherigeMittel, budget,
        laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, metatronHeel,
        selectedCategories, bevorzugteLinie, pinnedMittel, useProModel,
      }));
    } catch {}
  }, [pseudonymId, pathogens, symptome, erkrankung, alter, geschlecht, groesseCm, gewichtKg, schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt, laborKomplett, stuhlbefund, metatronHeel, selectedCategories, bevorzugteLinie, pinnedMittel, useProModel]);

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
      const items: Array<{ name: string; latin?: string; dosage?: string; application?: string }> = [];
      for (const row of data as Array<{ title: string; content: string }>) {
        const title = row.title?.trim();
        if (!title) continue;
        // Latin-Name aus erster Zeile/Klammer
        const latinMatch = row.content?.match(/\(([A-Z][a-zäöü]+\s+[a-zäöü]+)\)/);
        // Erste Dosierung suchen (sehr grob)
        const doseMatch = row.content?.match(/Dosierung[:\s]+([^\n]{3,80})/i);
        items.push({
          name: title,
          latin: latinMatch?.[1],
          dosage: doseMatch?.[1]?.trim().slice(0, 60),
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

  const createEmptyManualRemedy = () => ({ name: "", dosage: "", application: "", duration: "", reason: "", group: "Manuell ergänzt" });

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
    setPseudonymId(generatePseudonymId(existing));
  };

  const handleLoadSession = (session: TherapySession) => {
    const d = session.eingabe_daten || {};
    setSymptome(d.symptome || "");
    setErkrankung(d.erkrankung || "");
    setAlter(d.alter || "");
    setGeschlecht(d.geschlecht || "");
    setGroesseCm(d.groesseCm || "");
    setGewichtKg(d.gewichtKg || "");
    // Hinweis, falls die alte Sitzung die neuen Felder noch nicht enthielt
    const missingNew = !d.geschlecht && !d.groesseCm && !d.gewichtKg;
    if (missingNew) {
      toast({
        title: "Ältere Sitzung – bitte Konstitution ergänzen",
        description: "Geschlecht, Größe und Gewicht waren in dieser Sitzung noch nicht erfasst. Bitte erneut eingeben – die nächste Generierung speichert sie dauerhaft mit.",
      });
    }
    setSchwanger(d.schwanger || "nein");
    setMedikamente(d.medikamente || "");
    setBisherigeMittel(d.bisherigeMittel || "");
    setBudget(d.budget || "");
    setLaborErhoeht(d.laborErhoeht || "");
    setLaborErniedrigt(d.laborErniedrigt || "");
    setLaborKomplett(d.laborKomplett || "");
    setStuhlbefund(d.stuhlbefund || "");
    setMetatronHeel(d.metatronHeel || "");
    if (d.pathogens && Array.isArray(d.pathogens)) setPathogens(d.pathogens);
    if (Array.isArray(d.selectedCategories)) setSelectedCategories(d.selectedCategories);
    else if (Array.isArray(d.categories)) setSelectedCategories(d.categories);
    if (Array.isArray(d.bevorzugteLinie)) setBevorzugteLinie(d.bevorzugteLinie);
    if (Array.isArray(d.pinnedMittel)) setPinnedMittel(d.pinnedMittel);
    setUseMapReduce(d.useMapReduce !== false);
    setResult(session.empfehlung || "");
    setAuditInfo(null);
    toast({ title: "Sitzung geladen", description: `Vom ${new Date(session.created_at).toLocaleDateString("de-DE")}` });
  };

  const handleSubmit = async (opts?: { nachschlag?: string; previousResult?: string }) => {
    const isErweitern = !!(opts?.nachschlag && opts?.previousResult);
    const belastungenText = formatPathogensForAI(pathogens);
    if (!isErweitern && !belastungenText && !symptome.trim() && !erkrankung.trim()) {
      toast({ title: "Bitte mindestens ein Feld ausfüllen", description: "Belastungen, Symptome oder Erkrankung", variant: "destructive" });
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
            stuhlbefund: stuhlbefund.trim() || undefined,
            metatronHeel: metatronHeel.trim() || undefined,
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
            eingabe_daten: {
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
              stuhlbefund,
              metatronHeel,
              selectedCategories,
              useMapReduce,
              bevorzugteLinie,
              pinnedMittel,
              belastungen: formatPathogensForAI(pathogens),
            },
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
    setStuhlbefund("");
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
      eingabe_daten: {
        pathogens, symptome, erkrankung, alter, geschlecht, groesseCm, gewichtKg,
        schwanger, medikamente, bisherigeMittel, budget, laborErhoeht, laborErniedrigt,
        laborKomplett, stuhlbefund, metatronHeel, selectedCategories, bevorzugteLinie,
        pinnedMittel, manualMittel, manualDiagnosen,
        belastungen: formatPathogensForAI(pathogens),
        finalized: true,
      },
      empfehlung: finalMd,
      notiz: therapieNotiz,
    });
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    setWorkflowStage("finalized");
    setHistoryRefresh((n) => n + 1);
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
          </div>
          <div className="flex gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded p-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>DSGVO-Konformität:</strong> Niemals Klarnamen, Adressen, Geburtsdaten oder Kontaktdaten in den Feldern unten eingeben.
              Die Zuordnung Pseudonym ↔ Patient erfolgt ausschließlich in deiner lokalen, geschützten Patientenakte.
              Bei vorhandener Pseudonym-ID wird die Empfehlung automatisch im Verlauf gespeichert.
            </span>
          </div>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
              <label className="text-sm font-medium mb-1 block">🧪 Alle Laborwerte (Klassisches Labor)</label>
              <Textarea
                value={laborKomplett}
                onChange={(e) => setLaborKomplett(e.target.value)}
                placeholder="Komplettes klassisches Labor zur Gesamtbewertung – z.B. Großes Blutbild, Differentialblutbild, Leberwerte (GOT/GPT/GGT), Nierenwerte (Krea/Harnstoff/eGFR), Elektrolyte, TSH/fT3/fT4, HbA1c, Lipidstatus, Gerinnung, CRP, Eisenstatus, B12, Folsäure..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">Vollständige Laborübersicht (auch unauffällige Werte) für Mustererkennung & Plausibilitätsprüfung.</p>
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
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                <Pill className="h-3.5 w-3.5 text-emerald-600" />
                Bisherige Naturheilmittel
              </label>
              <Textarea
                value={bisherigeMittel}
                onChange={(e) => setBisherigeMittel(e.target.value)}
                placeholder="z.B. Schwarzwalnuss 15 Tropfen 3x/Tag, Wermut 200mg morgens, Oreganoöl 2 Kapseln..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Was bekommt der Patient aktuell an Naturheilmitteln? (inkl. Dosis)</p>
            </div>
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
      <LiveInputSummary pathogens={pathogens} symptome={symptome} erkrankung={erkrankung} />

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
                <div className="space-y-2">
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
                  <Button onClick={() => setWorkflowStage("preview")} className="gap-2">
                    Weiter zur Vorschau ▸
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
  entry: { name: string; dosage: string; application: string; duration: string; reason: string; group: string };
  wikiRemedies: Array<{ name: string; latin?: string; dosage?: string; application?: string }>;
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

  return (
    <div className="grid grid-cols-12 gap-2 items-start relative">
      <div className="col-span-3 relative">
        <Input
          placeholder="Mittelname (Wiki-Suche)"
          value={entry.name}
          onChange={(e) => { onChange({ name: e.target.value }); setShowSuggestions(true); }}
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
                  onChange({
                    name: s.name,
                    dosage: entry.dosage || s.dosage || "",
                  });
                  setShowSuggestions(false);
                }}
              >
                <span className="font-medium">{s.name}</span>
                {s.latin && <span className="italic text-muted-foreground ml-1">({s.latin})</span>}
                {s.dosage && <span className="block text-[10px] text-muted-foreground">{s.dosage}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input
        className="col-span-2 font-mono text-sm"
        placeholder="Dosierung"
        value={entry.dosage}
        onChange={(e) => onChange({ dosage: e.target.value })}
      />
      <Input
        className="col-span-2"
        placeholder="Anwendung"
        value={entry.application}
        onChange={(e) => onChange({ application: e.target.value })}
      />
      <Input
        className="col-span-1"
        placeholder="Dauer"
        value={entry.duration}
        onChange={(e) => onChange({ duration: e.target.value })}
      />
      <Input
        className="col-span-3"
        placeholder="Begründung / Indikation"
        value={entry.reason}
        onChange={(e) => onChange({ reason: e.target.value })}
      />
      <Button variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-destructive" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
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

  return (
    <>
      {introSections.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {introSections.map((s, i) => (
            <FreeSectionCard key={`intro-${i}`} section={s} />
          ))}
        </div>
      )}

      {parsed.categories.length > 0 && (
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
          {parsed.categories.map((g, i) => (
            <CategoryCard
              key={`cat-${i}-${g.title}`}
              group={g}
              categoryIndex={isStreaming ? undefined : i}
              selectedKeys={isStreaming ? undefined : selectedKeys}
              onToggleRemedy={onToggleRemedy}
              onToggleAll={onToggleAll}
            />
          ))}
        </div>
      )}

      {parsed.outro.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 mt-2">
          {parsed.outro.map((s, i) => (
            <FreeSectionCard key={`outro-${i}`} section={s} />
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
