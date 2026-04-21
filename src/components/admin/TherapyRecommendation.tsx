import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Loader2, AlertTriangle, Baby, Pill, Heart, Send, RotateCcw, Printer } from "lucide-react";
import { parseTherapyMarkdown } from "@/lib/therapyParser";
import { CategoryCard } from "./therapy/CategoryCard";
import { FreeSectionCard } from "./therapy/FreeSectionCard";
import { PatientContextBar } from "./therapy/PatientContextBar";
import { openPrintRecipe } from "./therapy/printRecipe";
import { PathogenInput, emptyEntry, formatPathogensForAI, type PathogenEntry } from "./therapy/PathogenInput";

export function TherapyRecommendation() {
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

  const [result, setResult] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!belastungen.trim() && !symptome.trim() && !erkrankung.trim()) {
      toast({ title: "Bitte mindestens ein Feld ausfüllen", description: "Belastungen, Symptome oder Erkrankung", variant: "destructive" });
      return;
    }

    setResult("");
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
            belastungen: belastungen.trim(),
            symptome: symptome.trim(),
            erkrankung: erkrankung.trim(),
            alter: alter.trim() || undefined,
            schwanger: schwanger !== "nein" ? schwanger : undefined,
            bisherigeMittel: bisherigeMittel.trim() || undefined,
            medikamente: medikamente.trim() || undefined,
            budget: budget.trim() || undefined,
            laborErhoeht: laborErhoeht.trim() || undefined,
            laborErniedrigt: laborErniedrigt.trim() || undefined,
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
    setBelastungen("");
    setSymptome("");
    setErkrankung("");
    setAlter("");
    setSchwanger("nein");
    setMedikamente("");
    setBisherigeMittel("");
    setBudget("");
    setLaborErhoeht("");
    setLaborErniedrigt("");
    setResult("");
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

      {/* Input Form */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Main inputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patientenbefund</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Belastungen / Pathogene
              </label>
              <Textarea
                value={belastungen}
                onChange={(e) => setBelastungen(e.target.value)}
                placeholder="z.B. Borrelia burgdorferi, Candida albicans, Blei, Quecksilber, Trichomonaden..."
                rows={3}
              />
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={isStreaming} className="gap-2">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isStreaming ? "Analyse läuft..." : "Therapie-Empfehlung generieren"}
        </Button>
        {isStreaming && (
          <Button variant="outline" onClick={handleCancel}>Abbrechen</Button>
        )}
        {result && !isStreaming && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                openPrintRecipe({
                  parsed: parseTherapyMarkdown(result),
                  patient: { alter, schwanger, medikamente, budget, belastungen, symptome, erkrankung },
                })
              }
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Als Rezept drucken
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
          />
          <ParsedResultView result={result} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  );
}

function ParsedResultView({ result, isStreaming }: { result: string; isStreaming: boolean }) {
  const parsed = useMemo(() => parseTherapyMarkdown(result), [result]);
  const hasParsed = parsed.intro.length + parsed.categories.length + parsed.outro.length > 0;

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
      {parsed.intro.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {parsed.intro.map((s, i) => (
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
          </h2>
          {parsed.categories.map((g, i) => (
            <CategoryCard key={`cat-${i}-${g.title}`} group={g} />
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

      {!hasParsed && result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ergebnis</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{result}</pre>
          </CardContent>
        </Card>
      )}
    </>
  );
}
