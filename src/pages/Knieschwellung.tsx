import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Leaf,
  AlertTriangle,
  Droplets,
  Pill,
  BookOpen,
} from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

interface Remedy {
  name: string;
  details: string;
}

const homoeopathisch: Remedy[] = [
  {
    name: "Traumeel® S Salbe (Biologische Heilmittel Heel GmbH)",
    details:
      "100 g Tube, PZN 01292358 (~14 €). Wirkung: entzündungshemmend, abschwellend, schmerzlindernd (u. a. Arnica). Anwendung: dünn 2–3× täglich einreiben.",
  },
  {
    name: "Traumeel® S Tabletten",
    details:
      "250 St., PZN 01292300 (~45 €). Anwendung: 1 Tablette 3× täglich oral lutschen.",
  },
  {
    name: "Arnica montana D12 Globuli (DHU-Arzneimittel)",
    details:
      "10 g Glas, PZN 02110230 (~8 €). Abschwellend bei Hämatomen. Anwendung: 5 Globuli 3× täglich.",
  },
];

const phytotherapie: Remedy[] = [
  {
    name: "Kytta® Schmerzsalbe (Beiersdorf)",
    details:
      "100 g Tube, PZN 02795148 (~10 €). Beinwell-Extrakt (35 g/100 g); schmerzlindernd, abschwellend, entzündungshemmend. Anwendung: 2–3× täglich einreiben.",
  },
  {
    name: "Teufelskralle-ratiopharm® 480 mg Filmtabletten",
    details:
      "100 St., PZN 2940730 (~20 €). Wirkstoff Harpagosid; schmerzlindernd bei Gelenkentzündungen. Anwendung: 1 Tablette 2× täglich zu den Mahlzeiten.",
  },
  {
    name: "Arnika Gel forte 20 % (z. B. Weleda)",
    details:
      "25 ml Tube; ätherische Öle; durchblutungsfördernd, abschwellend. Anwendung: 2× täglich sanft einmassieren.",
  },
  {
    name: "Fichtennadelöl (Abies alba)",
    details:
      "Ätherisches Öl; entzündungshemmend. Anwendung: verdünnt mehrmals täglich einreiben.",
  },
];

const hausmittel: Remedy[] = [
  {
    name: "Quarkwickel",
    details:
      "Enthält Kasein und Milchsäure; kühlt, hemmt Entzündung, reduziert Schwellung und lindert Schmerzen durch Gefäßverengung. 15–20 Minuten einwirken lassen.",
  },
  {
    name: "Kohlwickel (Weißkohl/Wirsing)",
    details:
      "Flavonoide und schwefelhaltige Stoffe; entzündungshemmend, abschwellend, schmerzlindernd und toxinentziehend. Blätter frisch klopfen, über Nacht auflegen.",
  },
  {
    name: "Kamillentee-Wickel",
    details:
      "Kamille (Matricaria chamomilla); beruhigt, entzündungshemmend, kühlt. Teebeutel aufbrühen, 20 Minuten ziehen lassen, mehrmals erneuern.",
  },
  {
    name: "Essigsaure Tonerde-Wickel",
    details:
      "Tonerde mit Essig; zieht Flüssigkeit ab, kühlt und wirkt entzündungshemmend. Etwa 15 Minuten einwirken lassen.",
  },
];

const RemedyList = ({ items }: { items: Remedy[] }) => (
  <ul className="space-y-3">
    {items.map((r) => (
      <li
        key={r.name}
        className="rounded-lg border border-border bg-card/40 p-4"
      >
        <p className="font-semibold text-foreground">{r.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>
      </li>
    ))}
  </ul>
);

const Knieschwellung = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Knieschwellung ohne Befund – Naturheilkundliche Mittel"
        description="Übersicht über homöopathische Mittel, Phytotherapie und bewährte Hausmittel bei unklarer Knieschwellung. Patienteninformation der Naturheilpraxis Peter Rauch."
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
              Knieschwellung ohne Befund
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Unterstützende naturheilkundliche Möglichkeiten – Homöopathie,
              Phytotherapie und Hausmittel – als Begleitinformation zu Ihrer
              individuellen Therapie.
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
                  individuellen Befunde abgestimmt.
                </p>
                <p className="text-muted-foreground">
                  Naturheilkundliche Präparate <em>können unterstützen</em>;
                  sie ersetzen keine notwendige Abklärung bei anhaltender,
                  zunehmender oder schmerzhafter Schwellung, bei Rötung,
                  Überwärmung, Fieber oder eingeschränkter Beweglichkeit.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Homöopathie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Pill className="h-5 w-5 text-primary" />
                Homöopathische Mittel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RemedyList items={homoeopathisch} />
            </CardContent>
          </Card>

          {/* Phytotherapie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Leaf className="h-5 w-5 text-primary" />
                Phytotherapie-Präparate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RemedyList items={phytotherapie} />
              <p className="text-sm text-muted-foreground">
                Diese Produkte sind standardisiert. Bei anhaltender Schwellung
                bitte Heilpraktiker oder Arzt konsultieren.
              </p>
            </CardContent>
          </Card>

          {/* Hausmittel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Droplets className="h-5 w-5 text-primary" />
                Hausmittel mit spezifischer Wirkung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RemedyList items={hausmittel} />
            </CardContent>
          </Card>

          {/* Quellenhinweis */}
          <Card className="bg-muted/30">
            <CardContent className="flex gap-3 p-5 text-sm text-muted-foreground">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p>
                  Markennennungen und PZN dienen ausschließlich der Orientierung
                  und stellen keine Werbung im Sinne des HWG dar. Preise sind
                  Richtwerte und können abweichen. Eine Anwendung erfolgt stets
                  nach individueller Abstimmung mit Ihrem Heilpraktiker oder
                  Arzt.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default Knieschwellung;
