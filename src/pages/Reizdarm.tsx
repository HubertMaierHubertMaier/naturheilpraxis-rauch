import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Leaf,
  AlertTriangle,
  Activity,
  BookOpen,
} from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

interface SymptomRow {
  symptom: string;
  schulmedizin: string;
  naturheilkundlich: string;
}

const symptomRows: SymptomRow[] = [
  {
    symptom: "Schmerz",
    schulmedizin:
      "Anticholinergika (Mebeverin), Spasmolytika (Buscopan), 5-HT1-Antagonisten",
    naturheilkundlich: "z. B. Abdomilon Lsg., Medacalm Kps.",
  },
  {
    symptom: "Obstipation (Verstopfung)",
    schulmedizin:
      "Ballaststoffe, osmotische Laxanzien, 5-HT4-Agonisten (Prucaloprid)",
    naturheilkundlich:
      "z. B. Laxatan M, Flosine, Urbitter Bio Granulat Dr. Pandalis, Ballaststoffe",
  },
  {
    symptom: "Diarrhö (Durchfall)",
    schulmedizin: "Cholestyramin, Loperamid",
    naturheilkundlich: "z. B. Diarrhoesan, Myrrhinil-Intest",
  },
  {
    symptom: "Vegetative Belastungen",
    schulmedizin: "Psychopharmaka",
    naturheilkundlich:
      "z. B. Calmvalera Tr., Lavendelöl 10 % Weleda (äußerlich, Darmmassage)",
  },
  {
    symptom: "Ängste",
    schulmedizin: "Anxiolytika",
    naturheilkundlich: "z. B. Metakaveron",
  },
  {
    symptom: "Übelkeit",
    schulmedizin: "5-HT3-Antagonisten (Ondansetron)",
    naturheilkundlich: "z. B. Homvio-Em",
  },
  {
    symptom: "Laktoseintoleranz",
    schulmedizin: "Ernährungsumstellung, z. B. Lactrase",
    naturheilkundlich: "Ernährungsumstellung",
  },
  {
    symptom: "Histaminintoleranz",
    schulmedizin: "Ernährungsumstellung, z. B. Daosin",
    naturheilkundlich: "Ernährungsumstellung",
  },
  {
    symptom: "Leber-/Gallestörungen",
    schulmedizin: "—",
    naturheilkundlich: "z. B. Hepar SL forte 600",
  },
  {
    symptom: "Pankreasinsuffizienz",
    schulmedizin: "Pankreasenzyme, z. B. Panzynorm",
    naturheilkundlich: "z. B. Nortase, Metaharonga, Pankreaticum-Hevert",
  },
  {
    symptom: "Depression (begleitend)",
    schulmedizin: "Trizyklische Antidepressiva (z. B. Amitriptylin)",
    naturheilkundlich: "z. B. Jarsin 300",
  },
  {
    symptom: "Blähungen",
    schulmedizin: "Entschäumer",
    naturheilkundlich: "z. B. Medacalm, Kümmel- und/oder Fenchelöl",
  },
];

const Reizdarm = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Reizdarm – Symptome & naturheilkundliche Mittel"
        description="Übersicht über Reizdarm-Symptome und mögliche naturheilkundliche bzw. schulmedizinische Behandlungsoptionen. Patienteninformation der Naturheilpraxis Peter Rauch."
      />

      {/* Hero */}
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Nur für Patienten
            </Badge>
            <h1 className="font-serif text-3xl font-semibold text-foreground md:text-5xl">
              Reizdarm – Symptome & naturheilkundliche Mittel
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Übersicht ausgewählter Reizdarm-Symptome mit schulmedizinischen
              und naturheilkundlichen Behandlungsmöglichkeiten – als
              Begleitinformation zu Ihrer individuellen Therapie.
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 md:py-16">
        <div className="container max-w-5xl space-y-10">
          {/* Disclaimer */}
          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="flex gap-3 p-5 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="space-y-2">
                <p>
                  Diese Übersicht ersetzt <strong>kein</strong> persönliches
                  Beratungsgespräch. Welche Mittel im Einzelfall sinnvoll sind,
                  wird gemeinsam mit Ihrem Heilpraktiker oder Arzt anhand Ihrer
                  individuellen Befunde und bestehenden Medikamente abgestimmt.
                </p>
                <p className="text-muted-foreground">
                  Naturheilkundliche Präparate können <em>kann unterstützen</em>
                  ; sie ersetzen keine notwendige medizinische Abklärung
                  bei anhaltenden, neu auftretenden oder schweren Beschwerden
                  (z. B. Blut im Stuhl, ungewollter Gewichtsverlust, nächtliche
                  Beschwerden, Fieber).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Symptom-Tabelle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Activity className="h-5 w-5 text-primary" />
                Behandlungsmöglichkeiten einzelner Symptome
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop-Tabelle */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-sage-50/60 text-left">
                      <th className="p-3 font-semibold text-foreground">Symptom</th>
                      <th className="p-3 font-semibold text-foreground">Schulmedizinisch</th>
                      <th className="p-3 font-semibold text-foreground">Naturheilkundlich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symptomRows.map((row) => (
                      <tr key={row.symptom} className="border-b border-border align-top">
                        <td className="p-3 font-medium text-foreground">{row.symptom}</td>
                        <td className="p-3 text-muted-foreground">{row.schulmedizin}</td>
                        <td className="p-3 text-foreground">{row.naturheilkundlich}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile-Karten */}
              <div className="space-y-3 md:hidden">
                {symptomRows.map((row) => (
                  <div key={row.symptom} className="rounded-lg border border-border p-4">
                    <p className="font-semibold text-foreground">{row.symptom}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>
                        <span className="font-medium text-muted-foreground">Schulmedizinisch: </span>
                        {row.schulmedizin}
                      </p>
                      <p>
                        <span className="font-medium text-muted-foreground">Naturheilkundlich: </span>
                        {row.naturheilkundlich}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Probiotika */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Leaf className="h-5 w-5 text-primary" />
                Probiotika beim Reizdarm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-foreground">
              <p>
                Lässt sich eine gestörte Darmflora als Mitursache eines
                Reizdarmsyndroms feststellen, können sogenannte{" "}
                <strong>Probiotika</strong> therapeutisch sinnvoll sein. Ein
                Probiotikum enthält ausgewählte Mikroorganismen, die im Darm
                natürlicherweise vorkommen und pathogene Keime zurückdrängen
                können, sodass sich eine gesunde Darmflora besser
                wiederherstellt.
              </p>

              <div>
                <p className="mb-2 font-medium">Häufig eingesetzte Stämme:</p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                  <li>Laktobazillen (Milchsäurebakterien)</li>
                  <li>Bifidobakterien</li>
                  <li>Escherichia-coli-Bakterien (nicht-pathogene Stämme)</li>
                </ul>
              </div>

              <p>
                Insbesondere Präparate mit nicht-pathogenen{" "}
                <em>E.-coli</em>-Bakterien zeigen in Untersuchungen einen
                günstigen Effekt beim Reizdarmsyndrom. Ein möglicher
                Wirkmechanismus ist die <strong>Stabilisierung der Mastzellen</strong>:
                Bei vielen Patienten mit therapierefraktärem Reizdarm finden
                sich Hinweise auf eine gesteigerte Freisetzung von Botenstoffen
                (z. B. Histamin, Heparin) aus Mastzellen. Hohe Konzentrationen
                lebender, nicht-pathogener E.-coli-Bakterien können diese
                Freisetzung direkt vermindern.
              </p>

              <div>
                <p className="mb-2 font-medium">
                  Beobachtete Effekte von <em>E. coli</em> Nissle 1917 im Darm:
                </p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                  <li>Erhöhung der Muzin- und Defensin-Produktion</li>
                  <li>
                    Invasionshemmung gegenüber z. B. Salmonellen, Shigellen und
                    enteroinvasiven E. coli (EIEC)
                  </li>
                  <li>Modulation des Immunsystems (z. B. IL-10)</li>
                  <li>
                    Antientzündliche Effekte (z. B. günstige Wirkung auf IL-5,
                    IL-6, IFN-γ, TNF-α, IL-8 ↓)
                  </li>
                  <li>Stärkung der epithelialen Barriere (Tight Junctions)</li>
                  <li>Verringerung von Leaky-Gut-typischen Symptomen</li>
                  <li>Verbesserung der Transportleistung der Darmzellen</li>
                </ul>
              </div>

              <p>
                <strong>Laktobazillen und Bifidobakterien</strong> tragen
                insgesamt zu einer Verbesserung der Darmflora bei, indem sie
                pathogene Keime zurückdrängen und die Barrierefunktion des
                Darms unterstützen.
              </p>
            </CardContent>
          </Card>

          {/* Quellenhinweis */}
          <Card className="bg-muted/30">
            <CardContent className="flex gap-3 p-5 text-sm text-muted-foreground">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p>
                  Inhaltliche Grundlage: Fachliteratur zur Naturheilkunde bei
                  funktionellen Erkrankungen sowie Studien u. a. von
                  Frieling et al. (2011) und Margerl et al. (2008) zur
                  Mastzell-Aktivität und zu E.-coli-Bakterien beim Reizdarm.
                </p>
                <p>
                  Markennennungen dienen ausschließlich der Orientierung und
                  stellen keine Werbung im Sinne des HWG dar. Eine Anwendung
                  erfolgt stets nach individueller Abstimmung mit Ihrem
                  Heilpraktiker oder Arzt.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default Reizdarm;
