import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cigarette,
  Download,
  Headphones,
  FileText,
  ShieldCheck,
  Heart,
  Wind,
  Brain,
  Clock,
  AlertTriangle,
} from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";
import { HypnoseAudioPlayer } from "@/components/hypnose/HypnoseAudioPlayer";

const audioFiles = [
  {
    title: "Selbsthypnose – Tägliche Kurzversion",
    description:
      "Sanfte tägliche Hypnose mit Atemführung und Affirmationen für freies Atmen und innere Klarheit.",
    file: "/therapie/raucherentwoehnung/Selbsthypnose-Freiheit-Taeglich.mp3",
    fileFemale: "/therapie/raucherentwoehnung/Selbsthypnose-Freiheit-Taeglich-Frau.mp3",
    duration: "ca. 4–5 Minuten",
  },
  {
    title: "Selbsthypnose – Tiefe Sitzung",
    description:
      "Tiefenentspannung mit sicherem Ort, Tür-Metapher, Lungen-Regeneration und Notfall-Anker für Verlangen.",
    file: "/therapie/raucherentwoehnung/Selbsthypnose-Freiheit-Tief.mp3",
    fileFemale: "/therapie/raucherentwoehnung/Selbsthypnose-Freiheit-Tief-Frau.mp3",
    duration: "ca. 9–10 Minuten",
  },
];

const Raucherentwoehnung = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Raucherentwöhnung – Therapiematerialien"
        description="Begleitende Therapiematerialien zur Entwöhnung von der E-Zigarette: Selbsthypnose-Audios und Begleitskript."
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
              Raucherentwöhnung
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Ihre begleitenden Therapiematerialien für den Weg in ein dampffreies Leben.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-4xl space-y-10">

          {/* Die 3 Säulen */}
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6 text-center">
                Die drei Säulen Ihrer Therapie
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Heart,
                    title: "Praxisbehandlung",
                    text: "Trikombin-Therapie in der Naturheilpraxis",
                  },
                  {
                    icon: Headphones,
                    title: "Tägliche Selbsthypnose",
                    text: "MP3-Audiodateien für die Heimanwendung",
                  },
                  {
                    icon: FileText,
                    title: "Eigentherapie",
                    text: "Begleitskript mit Übungen & Strategien",
                  },
                ].map((pillar) => (
                  <div
                    key={pillar.title}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2"
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <pillar.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
                    <p className="text-xs text-muted-foreground">{pillar.text}</p>
                  </div>
                ))}
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
                  Hören Sie täglich eine der Aufnahmen – idealerweise in ruhiger Umgebung mit Kopfhörern.
                </p>
              </div>
            </div>

            {audioFiles.map((audio) => (
              <HypnoseAudioPlayer
                key={audio.title}
                title={audio.title}
                description={audio.description}
                duration={audio.duration}
                fileMale={audio.file}
                fileFemale={audio.fileFemale}
              />
            ))}
            <a
              href="/therapie/raucherentwoehnung/Selbsthypnose-Wortlaut-Audio.pdf"
              download
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" /> Wortlaut der Audios als PDF
            </a>
          </div>

          {/* Begleitskript PDF */}
          <Card className="border-primary/30 shadow-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-foreground">
                      Begleitskript
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Umfassendes Therapie-Begleitskript mit wissenschaftlichen Informationen zu den
                      Auswirkungen der E-Zigarette, Atemtechniken, Notfallbox, Belohnungssystem und
                      Tagesstruktur.
                    </p>
                  </div>
                  <a href="/therapie/raucherentwoehnung/Begleitskript-E-Zigarette.pdf" download>
                    <Button className="gap-2">
                      <Download className="h-4 w-4" />
                      Begleitskript herunterladen (PDF)
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hinweise */}
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Wichtige Hinweise</h3>
                  <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                    <li>
                      • Die Selbsthypnose-Audios sind <strong className="text-foreground">nur für Sie persönlich</strong> bestimmt
                      und dürfen nicht weitergegeben werden.
                    </li>
                    <li>
                      • Hören Sie die Audios <strong className="text-foreground">niemals beim Autofahren</strong> oder bei
                      Tätigkeiten, die Ihre volle Aufmerksamkeit erfordern.
                    </li>
                    <li>
                      • Die Materialien ergänzen Ihre Therapie und ersetzen keine ärztliche oder
                      heilpraktische Beratung.
                    </li>
                    <li>
                      • Bei Fragen kontaktieren Sie bitte die Naturheilpraxis Peter Rauch.
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 h-4 w-4" />
            <p>Naturheilpraxis Peter Rauch · Heilpraktiker · Augsburg</p>
            <p>Stand: März 2026</p>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default Raucherentwoehnung;
