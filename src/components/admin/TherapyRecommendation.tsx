import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Loader2, AlertTriangle, Baby, Pill, Heart, Send, RotateCcw, Printer, KeyRound, Sparkles, ShieldAlert, FileText, ClipboardList, Plus, X, RefreshCw } from "lucide-react";
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

export function TherapyRecommendation() {
  const [pseudonymId, setPseudonymId] = useState("");
  const [pathogens, setPathogens] = useState<PathogenEntry[]>([emptyEntry()]);
  const [symptome, setSymptome] = useState("");
  const [erkrankung, setErkrankung] = useState("");
  const [alter, setAlter] = useState("");
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
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
  }, [result]);

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
            nachschlag: isErweitern ? opts!.nachschlag : undefined,
            previousResult: isErweitern ? opts!.previousResult : undefined,
          }),
          signal: controller.signal,
        }
      );

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
          if (jsonStr === "[DONE]") break;

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
              schwanger,
              medikamente,
              bisherigeMittel,
              budget,
              laborErhoeht,
              laborErniedrigt,
              laborKomplett,
              stuhlbefund,
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
    setSchwanger("nein");
    setMedikamente("");
    setBisherigeMittel("");
    setBudget("");
    setLaborErhoeht("");
    setLaborErniedrigt("");
    setLaborKomplett("");
    setStuhlbefund("");
    setSelectedCategories([]);
    setBevorzugteLinie([]);
    setPinnedMittel([]);
    setUseMapReduce(true);
    setResult("");
    setAuditInfo(null);
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patientenbefund</CardTitle>
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
        <Card className="border-orange-200 dark:border-orange-900/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Sicherheitsabfrage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                <Baby className="h-3.5 w-3.5 text-blue-500" />
                Alter des Patienten
              </label>
              <Input
                type="number"
                value={alter}
                onChange={(e) => setAlter(e.target.value)}
                placeholder="Alter in Jahren"
                min={0}
                max={120}
              />
              {alter && parseInt(alter) < 12 && (
                <p className="text-xs text-orange-600 mt-1">⚠️ Pädiatrische Einschränkungen werden berücksichtigt</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Schwangerschaft / Stillzeit</label>
              <Select value={schwanger} onValueChange={setSchwanger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nein">Nein</SelectItem>
                  <SelectItem value="schwanger">Schwanger</SelectItem>
                  <SelectItem value="stillend">Stillend</SelectItem>
                  <SelectItem value="kinderwunsch">Kinderwunsch</SelectItem>
                </SelectContent>
              </Select>
              {schwanger !== "nein" && (
                <p className="text-xs text-red-600 mt-1">⚠️ Viele Naturheilmittel sind kontraindiziert!</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                <Pill className="h-3.5 w-3.5 text-purple-500" />
                Aktuelle Medikamente
              </label>
              <Textarea
                value={medikamente}
                onChange={(e) => setMedikamente(e.target.value)}
                placeholder="z.B. Marcumar, Metformin, L-Thyroxin, SSRI..."
                rows={3}
              />
              {medikamente.toLowerCase().match(/marcumar|warfarin|eliquis|xarelto|pradaxa|blutverdün/i) && (
                <p className="text-xs text-red-600 mt-1">⚠️ Blutverdünner erkannt – strenge Einschränkungen!</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                💰 Maximales Budget
              </label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="z.B. 150 (in Euro)"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">NutraMedix-Produkte kosten ca. 40 €/30ml. Bei knappem Budget werden günstige Alternativen (Gewürze, Hausmittel) bevorzugt.</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={() => handleSubmit()} disabled={isStreaming} className="gap-2">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isStreaming ? (useMapReduce ? "Stufe 1+2 läuft (kann 30-60 Sek dauern)..." : "Analyse läuft...") : "Therapie-Empfehlung generieren"}
        </Button>
        {isStreaming && (
          <Button variant="outline" onClick={handleCancel}>Abbrechen</Button>
        )}
        {result && !isStreaming && (
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
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </Button>
          </>
        )}
      </div>

      {/* Result – Card layout */}
      {(result || isStreaming) && (
        <div ref={resultRef} className="space-y-4">
          <PatientContextBar
            alter={alter}
            schwanger={schwanger}
            medikamente={medikamente}
            budget={budget}
            laborErhoeht={laborErhoeht}
            laborErniedrigt={laborErniedrigt}
            stuhlbefund={stuhlbefund}
          />
          {auditInfo && <WikiAuditCard audit={auditInfo} />}
          {result && !isStreaming && (
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

          {/* 🔄 Nachschlag-Modus: KI-gestützte Erweiterung mit Kontext-Erhalt */}
          {result && !isStreaming && (
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

          {/* ➕ Manuelle Diagnosen (kommen aufs Praxis-PDF) */}
          {result && !isStreaming && (
            <Card className="border-secondary/40 bg-secondary/[0.04]">
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

          {/* ➕ Manuelle Mittel (kommen auf BEIDE PDFs sofern angehakt im Patienten-PDF) */}
          {result && !isStreaming && (
            <Card className="border-accent/30 bg-accent/[0.03]">
              <CardContent className="pt-4 pb-4 space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  💊 Eigene Mittel ergänzen <span className="text-xs font-normal text-muted-foreground">(erscheinen auf beiden PDFs als &quot;Manuell ergänzt&quot;)</span>
                </label>
                {manualMittel.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Noch keine eigenen Mittel ergänzt.</p>
                )}
                <div className="space-y-2">
                  {manualMittel.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                      <Input
                        className="col-span-3"
                        placeholder="Mittelname"
                        value={m.name}
                        onChange={(e) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-2 font-mono text-sm"
                        placeholder="Dosierung"
                        value={m.dosage}
                        onChange={(e) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="Anwendung"
                        value={m.application}
                        onChange={(e) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, application: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-1"
                        placeholder="Dauer"
                        value={m.duration}
                        onChange={(e) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, duration: e.target.value } : x))}
                      />
                      <Input
                        className="col-span-3"
                        placeholder="Begründung / Indikation"
                        value={m.reason}
                        onChange={(e) => setManualMittel((arr) => arr.map((x, i) => i === idx ? { ...x, reason: e.target.value } : x))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="col-span-1 h-9 w-9 text-destructive"
                        onClick={() => setManualMittel((arr) => arr.filter((_, i) => i !== idx))}
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
                  onClick={() => setManualMittel((arr) => [...arr, { name: "", dosage: "", application: "", duration: "", reason: "", group: "Manuell ergänzt" }])}
                >
                  <Plus className="h-4 w-4" /> Mittel hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}
          <ParsedResultView
            result={result}
            isStreaming={isStreaming}
            stuhlbefund={stuhlbefund}
            selectedKeys={selectedKeys}
            onToggleRemedy={toggleRemedy}
            onToggleAll={toggleAllInCategory}
          />
        </div>
      )}
    </div>
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
