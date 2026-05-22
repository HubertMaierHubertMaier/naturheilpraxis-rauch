import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Download,
  FileText,
  ShieldCheck,
  Wind,
  ClipboardList,
  Hand,
  Headphones,
  Clock,
  AlertTriangle,
} from "lucide-react";

const audioFiles = [
  {
    title: "Selbsthypnose – Tägliche Kurzversion",
    description:
      "Sanfte Selbsthypnose mit goldenem Licht im Halsbereich. Ideal zur täglichen Anwendung — morgens, abends oder zur Mittagspause.",
    file: "/therapie/schilddruese/Selbsthypnose-Schilddruese-Taeglich.mp3",
    duration: "ca. 4–5 Minuten",
  },
  {
    title: "Selbsthypnose – Tiefe Sitzung",
    description:
      "Vollständige Tiefenentspannung mit Countdown, sicherem Ort, Heilungsaffirmationen und sanfter Rückführung. Ideal 2–3× pro Woche in ungestörter Umgebung.",
    file: "/therapie/schilddruese/Selbsthypnose-Schilddruese-Tief.mp3",
    duration: "ca. 8–9 Minuten",
  },
];
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const documents = [
  {
    title: "Verlaufstagebuch zum Ausdrucken",
    description:
      "Druckbares Tagebuch mit Größenskala (Linsenkorn bis Walnuss + mm), Stimmungsskala 1–10 und Platz für mehrere Knoten pro Eintrag. Bringe es zum nächsten Praxistermin mit.",
    file: "/therapie/schilddruese/Verlaufstagebuch-Schilddruese.pdf",
    pages: "6 Seiten",
    icon: ClipboardList,
  },
  {
    title: "Begleitskript",
    description:
      "Anwendung der Selbsthypnose, Anleitung zur Bhramari-Atmung (Bienenatem) und Hinweise, wann du dich in der Praxis melden solltest.",
    file: "/therapie/schilddruese/Begleitskript-Schilddruese.pdf",
    pages: "2 Seiten",
    icon: FileText,
  },
];

const SchilddrueseHypnose = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Schilddrüsen-Hypnose – Therapiematerialien"
        description="Begleitende Therapiematerialien zur Hypnose-Begleittherapie bei Schilddrüsen-Knoten: Verlaufstagebuch und Begleitskript zum Ausdrucken."
      />

      {/* Hero */}
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Nur für Patienten
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Schilddrüsen-Hypnose
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Deine begleitenden Therapiematerialien für die Hypnose-Behandlung von Schilddrüsen-Knoten.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-4xl space-y-10">

          {/* Drei Säulen */}
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6 text-center">
                Die drei Säulen deiner Begleittherapie
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Hand,
                    title: "Praxisbehandlung",
                    text: "Hypnose-Sitzung & ggf. begleitende Verfahren in der Praxis",
                  },
                  {
                    icon: Wind,
                    title: "Bhramari-Atmung",
                    text: "Tägliche Atemübung als aktive körperliche Ergänzung",
                  },
                  {
                    icon: ClipboardList,
                    title: "Verlaufstagebuch",
                    text: "Wöchentliche Selbstbeobachtung — sichtbar machen, was sich verändert",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <div
                    key={title}
                    className="rounded-lg border border-border bg-sage-50/40 p-4 text-center"
                  >
                    <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Einleitung */}
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-3 mb-4">
                <Activity className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  Worum es geht
                </h2>
              </div>
              <div className="space-y-3 text-foreground leading-relaxed">
                <p>
                  Die Hypnose bei Schilddrüsen-Knoten arbeitet auf einer tiefen, vegetativen Ebene.
                  Sie nutzt die Verbindung zwischen Unterbewusstsein, vegetativem Nervensystem und
                  Hormonsystem — und kann Selbstheilungsprozesse <strong>begleiten und unterstützen</strong>.
                </p>
                <p>
                  Damit dein Therapieverlauf sichtbar wird, dokumentierst du wöchentlich deine
                  Beobachtungen im Verlaufstagebuch. Die Bhramari-Atmung („Bienenatem") ergänzt die
                  Hypnose als aktive Übung zwischen den Sitzungen — die Vibration im Halsbereich wird
                  als sehr wohltuend empfunden.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Selbsthypnose-Audios */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  Selbsthypnose-Audios
                </h2>
                <p className="text-sm text-muted-foreground">
                  In ruhiger Umgebung, idealerweise mit Kopfhörern. Nicht beim Autofahren oder bei Tätigkeiten, die deine volle Aufmerksamkeit erfordern.
                </p>
              </div>
            </div>

            {audioFiles.map((audio) => (
              <HypnoseAudioPlayer
                key={audio.file}
                title={audio.title}
                description={audio.description}
                duration={audio.duration}
                fileMale={audio.file}
              />
            ))}
          </div>

          {/* Materialien zum Download */}
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Materialien zum Download & Ausdrucken
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {documents.map(({ title, description, file, pages, icon: Icon }) => (
                <Card key={file} className="shadow-card flex flex-col">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{pages} · PDF</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                      {description}
                    </p>
                    <Button asChild size="sm" className="w-full">
                      <a href={file} download>
                        <Download className="mr-2 h-4 w-4" />
                        PDF herunterladen
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Hinweis-Box */}
          <Card className="shadow-card border-accent/30 bg-accent/5">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-serif text-lg font-semibold text-foreground mb-2">
                    Wann meldest du dich in der Praxis?
                  </h2>
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    Melde dich in der Praxis, wenn du eine der folgenden Veränderungen bemerkst:
                  </p>
                  <ul className="text-sm text-foreground leading-relaxed space-y-1 mb-4 list-disc pl-5">
                    <li><strong>Deutliche Größenzunahme</strong> eines Knotens innerhalb weniger Wochen</li>
                    <li><strong>Neuer Druck</strong> oder Engegefühl im Hals</li>
                    <li><strong>Schluckbeschwerden</strong>, die vorher nicht da waren</li>
                    <li><strong>Heiserkeit</strong> ohne erkennbaren Anlass</li>
                  </ul>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Wir besprechen dann gemeinsam das weitere Vorgehen. In solchen Fällen ist eine
                    ärztliche Kontrolle (Sonografie, ggf. Labor) sinnvoll — diese veranlasst dein Arzt.
                    Anschließend stimmen wir die naturheilkundliche Begleitung neu ab.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
};

export default SchilddrueseHypnose;
