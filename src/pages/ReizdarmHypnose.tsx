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
  HeartPulse,
  Headphones,
  AlertTriangle,
} from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";
import { HypnoseAudioPlayer } from "@/components/hypnose/HypnoseAudioPlayer";

const audioFiles = [
  {
    title: "Selbsthypnose – Tägliche Kurzversion",
    description:
      "Sanfte Bauchatmung, Vagus-Aktivierung und wohlige Wärme im Bauchraum. Ideal morgens, abends oder als Mini-Pause am Tag.",
    fileMale: "/therapie/reizdarm/Selbsthypnose-Bauchwohl-Taeglich.mp3",
    fileFemale: "/therapie/reizdarm/Selbsthypnose-Bauchwohl-Taeglich-Frau.mp3",
    duration: "ca. 6 Minuten",
  },
  {
    title: "Selbsthypnose – Tiefe Sitzung",
    description:
      "Vollständige Tiefenentspannung mit sicherem Ort, Lösung im Bauch- und Beckenbodenbereich, Affirmationen und verankerter 3-Atemzüge-Reflex für unruhige Momente. 2–3× pro Woche in ungestörter Umgebung.",
    fileMale: "/therapie/reizdarm/Selbsthypnose-Bauchwohl-Tief.mp3",
    fileFemale: "/therapie/reizdarm/Selbsthypnose-Bauchwohl-Tief-Frau.mp3",
    duration: "ca. 11 Minuten",
  },
];

const documents = [
  {
    title: "Verlaufstagebuch zum Ausdrucken",
    description:
      "Druckbares Tagebuch mit Bristol-Skala, Drang- und Stress-Skala 0–10, Ruhepuls-Spalte und Wochenrückblick. Mindestens 4 Wochen führen.",
    file: "/therapie/reizdarm/Verlaufstagebuch-Bauchwohl.pdf",
    pages: "2 Seiten",
    icon: ClipboardList,
  },
  {
    title: "Begleitskript",
    description:
      "Anwendung der Selbsthypnose, der 3-Atemzüge-Anker für unruhige Momente, Beckenboden-Hinweise und Warnzeichen, bei denen Du Dich melden solltest.",
    file: "/therapie/reizdarm/Begleitskript-Bauchwohl.pdf",
    pages: "1 Seite",
    icon: FileText,
  },
];

const ReizdarmHypnose = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Bauchwohl-Hypnose – Innere Ruhe & Gelassenheit"
        description="Begleitende Materialien zur Hypnose-Behandlung für einen ruhigen, entspannten Bauch: Selbsthypnose-Audios, 3-Atemzüge-Anker, Verlaufstagebuch und Begleitskript."
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
              Bauchwohl-Hypnose
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Innere Ruhe & Gelassenheit – Tiefenentspannung für Bauch, vegetatives
              Nervensystem und Beckenboden.
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
                Die drei Säulen Deiner Begleittherapie
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: HeartPulse,
                    title: "Vegetative Beruhigung",
                    text: "Hypnose senkt Ruhepuls & Sympathikotonus – Dein Bauch bekommt wieder Pausen",
                  },
                  {
                    icon: Wind,
                    title: "3-Atemzüge-Anker",
                    text: "In unruhigen Momenten: 4 Sek. ein, 8 Sek. aus – aktiviert den Vagusnerv sofort",
                  },
                  {
                    icon: ClipboardList,
                    title: "Verlaufstagebuch",
                    text: "Beobachten, was sich verändert – wir machen Fortschritte sichtbar",
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
                  Dein Bauch reagiert direkt auf das vegetative Nervensystem. Steht der
                  Körper dauerhaft unter Anspannung – sichtbar etwa an einem erhöhten
                  Ruhepuls – wird die Bauchmuskulatur unruhig, und es können plötzliche,
                  unangenehme Impulse auftreten.
                </p>
                <p>
                  Die Hypnose arbeitet genau hier: Sie aktiviert den Vagusnerv (Deinen
                  Ruhenerv), entspannt die glatte Muskulatur im Bauchraum und löst die
                  antrainierte Anspannung im Beckenboden. Sie <strong>kann</strong> die
                  Beschwerden deutlich reduzieren und Dir das Sicherheitsgefühl im
                  Alltag zurückgeben.
                </p>
                <p>
                  Über mehrere Wochen entsteht eine neue Konditionierung – Dein Körper
                  lernt wieder, in Ruhe zu sein, und Du gewinnst Vertrauen und
                  Bewegungsfreiheit zurück.
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
                  In ruhiger Umgebung, idealerweise mit Kopfhörern. Nicht beim Autofahren oder
                  bei Tätigkeiten, die Deine volle Aufmerksamkeit erfordern.
                </p>
              </div>
            </div>

            {audioFiles.map((audio) => (
              <Card key={audio.file} className="shadow-card">
                <CardContent className="p-5 md:p-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{audio.title}</h3>
                    <p className="text-xs text-muted-foreground">{audio.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                      <Clock className="h-3 w-3" />
                      {audio.duration}
                    </div>
                  </div>
                  <audio controls className="w-full" preload="none">
                    <source src={audio.file} type="audio/mpeg" />
                    Ihr Browser unterstützt kein Audio-Element.
                  </audio>
                  <a href={audio.file} download>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-3.5 w-3.5" />
                      Herunterladen
                    </Button>
                  </a>
                </CardContent>
              </Card>
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
                    Wann meldest Du Dich in der Praxis?
                  </h2>
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    Bitte melde Dich kurzfristig bei Peter Rauch oder einem Arzt, wenn eines der
                    folgenden Warnzeichen auftritt:
                  </p>
                  <ul className="text-sm text-foreground leading-relaxed space-y-1 mb-4 list-disc pl-5">
                    <li><strong>Blut im Stuhl</strong> oder schwarzer Teerstuhl</li>
                    <li><strong>Ungewollter Gewichtsverlust</strong> oder anhaltendes Fieber</li>
                    <li><strong>Nächtlicher Durchfall</strong>, der Dich aus dem Schlaf reißt</li>
                    <li><strong>Plötzliche Änderung</strong> der Stuhlgewohnheiten ohne Anlass, länger als 2 Wochen</li>
                  </ul>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    In diesen Fällen besprechen wir gemeinsam das weitere Vorgehen und stimmen
                    die naturheilkundliche Begleitung mit eventuellen schulmedizinischen
                    Abklärungen ab.
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

export default ReizdarmHypnose;
