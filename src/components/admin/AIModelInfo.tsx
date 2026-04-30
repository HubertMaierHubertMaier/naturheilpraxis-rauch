import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Zap, Gauge, Coins, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Übersicht der aktuell in der Praxis-App eingesetzten KI-Modelle.
 * Wird nur Admins angezeigt (Tab im Admin-Dashboard).
 *
 * Quellen für Preise:
 * - Lovable AI Gateway: https://docs.lovable.dev/features/ai
 * - Google Gemini Pricing: https://ai.google.dev/gemini-api/docs/pricing
 * Stand: April 2026 — bitte regelmäßig prüfen, da sich Tarife ändern können.
 */
export function AIModelInfo() {
  return (
    <div className="space-y-6">
      {/* Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            KI-Modelle &amp; Kosten in dieser Praxis-App
          </CardTitle>
          <CardDescription>
            Welche KI-Modelle werden wo eingesetzt, was kosten sie und wie schnell sind sie?
            Alle Modelle laufen über den Lovable AI Gateway – es ist KEIN externer OpenAI- oder Google-Account nötig.
            Abrechnung erfolgt zentral über das Lovable-Workspace-Guthaben (Settings → Cloud &amp; AI balance).
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Therapie-Empfehlung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600" />
            Therapie-Empfehlung (Wissensdatenbank → Mittelvorschlag)
          </CardTitle>
          <CardDescription>
            Hauptmodell für die Generierung der personalisierten Therapieempfehlungen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Standard */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-700">Standard (aktiv)</Badge>
              <span className="font-semibold">Google Gemini 2.5 Flash</span>
            </div>
            <ul className="text-sm space-y-1 text-foreground/80">
              <li className="flex gap-2"><Gauge className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Geschwindigkeit:</strong> ca. 20–40 Sek. pro Empfehlung</span></li>
              <li className="flex gap-2"><Coins className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Kosten:</strong> ca. <strong>0,1–0,5 Cent</strong> pro Empfehlung (Bruchteil eines Cents)</span></li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Stärken:</strong> Schnell, günstig, beherrscht Deutsch fließend, gutes Reasoning für die meisten Praxis-Fälle</span></li>
              <li className="flex gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> <span><strong>Schwächen:</strong> Bei sehr komplexen, vielschichtigen Fällen evtl. weniger nuanciert als Pro</span></li>
            </ul>
            <div className="mt-3 text-xs text-muted-foreground">
              Listenpreis (Lovable AI Gateway, Stand 04/2026): ca. 0,30 $ / 1 Mio Input-Tokens · ca. 2,50 $ / 1 Mio Output-Tokens.
            </div>
          </div>

          {/* Pro – optional */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-amber-400 text-amber-700">Optional (Schalter)</Badge>
              <span className="font-semibold">Google Gemini 2.5 Pro</span>
            </div>
            <ul className="text-sm space-y-1 text-foreground/80">
              <li className="flex gap-2"><Gauge className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> <span><strong>Geschwindigkeit:</strong> ca. 60–120 Sek. pro Empfehlung – ⚠️ kann das 150-Sek-Limit der Edge-Function reißen (Timeout)</span></li>
              <li className="flex gap-2"><Coins className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> <span><strong>Kosten:</strong> ca. <strong>2–6 Cent</strong> pro Empfehlung (5–10× teurer als Flash)</span></li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> <span><strong>Stärken:</strong> Tieferes Reasoning, besser bei vielen Quellen + komplexer Symptomlage gleichzeitig</span></li>
              <li className="flex gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> <span><strong>Aktivierung:</strong> Wissensdatenbank → Therapie-Empfehlung → Schalter „Tieferes Reasoning-Modell verwenden (Pro)"</span></li>
            </ul>
            <div className="mt-3 text-xs text-muted-foreground">
              Listenpreis (Lovable AI Gateway, Stand 04/2026): ca. 1,25 $ / 1 Mio Input-Tokens · ca. 10 $ / 1 Mio Output-Tokens.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map-Reduce */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-sky-600" />
            Wiki-Relevanzbewertung (Map-Reduce, Stufe 1)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-sky-600 hover:bg-sky-700">Hintergrund</Badge>
              <span className="font-semibold">Google Gemini 2.5 Flash-Lite</span>
            </div>
            <ul className="text-sm space-y-1 text-foreground/80">
              <li className="flex gap-2"><Gauge className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" /> <span><strong>Aufgabe:</strong> Bewertet alle ~285 Wiki-Einträge in Batches à 40 auf Relevanz (Score 0–10)</span></li>
              <li className="flex gap-2"><Coins className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" /> <span><strong>Kosten:</strong> ca. <strong>0,05–0,1 Cent</strong> pro Empfehlung – kaum messbar</span></li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" /> <span><strong>Vorteil:</strong> Stellt sicher, dass die Haupt-KI nur die relevantesten Wiki-Einträge sieht (kontextoptimiert)</span></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ICD-10 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-600" />
            ICD-10-Codegenerierung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-violet-600 hover:bg-violet-700">Aktiv</Badge>
              <span className="font-semibold">Google Gemini 2.5 Flash</span>
            </div>
            <ul className="text-sm space-y-1 text-foreground/80">
              <li className="flex gap-2"><Gauge className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" /> <span><strong>Aufgabe:</strong> Analysiert Anamnese-Freitexte und schlägt ICD-10-Codes vor (ergänzt zu festen Mappings)</span></li>
              <li className="flex gap-2"><Coins className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" /> <span><strong>Kosten:</strong> ca. <strong>0,1–0,3 Cent</strong> pro Anamnese-Auswertung</span></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Zusammenfassung */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Faustregel pro Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Standard-Workflow</strong> (Anamnese → ICD-10 → Therapie-Empfehlung mit Flash):
            <strong className="text-emerald-700"> ca. 0,5–1 Cent gesamt</strong> pro Patient.
          </p>
          <p>
            <strong>Mit Pro-Modell</strong> bei der Therapie-Empfehlung:
            <strong className="text-amber-700"> ca. 3–7 Cent</strong> pro Patient.
          </p>
          <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
            Hinweis: Preise sind Schätzwerte basierend auf typischen Prompt-Größen (50–80 KB Kontext, ca. 4–8 KB Antwort). Tatsächliche Abrechnung siehe <strong>Lovable Workspace → Settings → Cloud &amp; AI balance</strong>. Tarife können sich ändern – aktuelle Preisliste auf docs.lovable.dev/features/ai.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIModelInfo;
