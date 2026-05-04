import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Apple, Droplets, Leaf, Sun, Moon, Heart, AlertTriangle, CheckCircle } from "lucide-react";
import { useContentProtection } from "@/hooks/useContentProtection";

const tipps = [
  {
    icon: Droplets,
    title: "Ausreichend Trinken",
    description: "Trinken Sie täglich mindestens 1,5–2 Liter Wasser oder ungesüßten Kräutertee. Beginnen Sie den Tag mit einem Glas lauwarmem Wasser, um den Stoffwechsel anzuregen.",
  },
  {
    icon: Leaf,
    title: "Frisches Gemüse & Obst",
    description: "Essen Sie täglich mindestens 5 Portionen Gemüse und Obst, möglichst saisonal und regional. Gemüse sollte den größeren Anteil ausmachen.",
  },
  {
    icon: Sun,
    title: "Regelmäßige Mahlzeiten",
    description: "Essen Sie zu regelmäßigen Zeiten und nehmen Sie sich Zeit für Ihre Mahlzeiten. Vermeiden Sie Essen im Stehen oder vor dem Bildschirm.",
  },
  {
    icon: Moon,
    title: "Leichtes Abendessen",
    description: "Das Abendessen sollte die leichteste Mahlzeit des Tages sein. Essen Sie nicht zu spät, idealerweise 3 Stunden vor dem Schlafengehen.",
  },
];

const empfehlungen = [
  { item: "Vollkornprodukte statt Weißmehl", good: true },
  { item: "Hochverarbeitete Lebensmittel meiden", good: false },
  { item: "Gute Öle (Olivenöl, Leinöl, Kokosöl)", good: true },
  { item: "Transfette und gehärtete Fette meiden", good: false },
  { item: "Kräuter und Gewürze nutzen", good: true },
  { item: "Zu viel Zucker und Salz meiden", good: false },
  { item: "Hülsenfrüchte regelmäßig einbauen", good: true },
  { item: "Fast Food und Fertiggerichte meiden", good: false },
];

const Ernaehrung = () => {
  useContentProtection();
  return (
    <Layout>
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              Ernährungsratschläge
            </h1>
            <p className="text-lg text-muted-foreground">
              Gesunde Ernährung als Basis für Ihre Gesundheit
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl space-y-12">
          {/* Einleitung */}
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage-100">
              <Apple className="h-8 w-8 text-primary" />
            </div>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              "Lass die Nahrung deine Medizin sein und Medizin deine Nahrung" – Hippokrates.
              Eine ausgewogene Ernährung ist die Grundlage für Gesundheit und Wohlbefinden.
            </p>
          </div>

          {/* Grundlegende Tipps */}
          <div>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground">
              Grundlegende Ernährungstipps
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {tipps.map((tipp) => (
                <Card key={tipp.title} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                      <tipp.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 font-serif text-xl font-medium text-foreground">
                      {tipp.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tipp.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Empfehlungen */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-serif">
                <Heart className="h-6 w-6 text-primary" />
                Empfehlungen auf einen Blick
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {empfehlungen.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg bg-background p-3"
                  >
                    {item.good ? (
                      <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 shrink-0 text-accent" />
                    )}
                    <span className="text-sm text-foreground">{item.item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Spezielle Hinweise */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-sage-200 bg-sage-50 shadow-card">
              <CardContent className="p-6">
                <h3 className="mb-3 font-serif text-lg font-medium text-foreground">
                  Bei Verdauungsbeschwerden
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Speisen gut kauen – mindestens 20-mal
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Bittere Lebensmittel und Kräuter einbauen
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Probiotische Lebensmittel (Sauerkraut, Kefir)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Ballaststoffe langsam steigern
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-sage-200 bg-sage-50 shadow-card">
              <CardContent className="p-6">
                <h3 className="mb-3 font-serif text-lg font-medium text-foreground">
                  Für mehr Energie
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Komplexe Kohlenhydrate bevorzugen
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Ausreichend Eiweiß zu jeder Mahlzeit
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Nüsse und Samen als Snack
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Blutzuckerspitzen vermeiden
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Hinweis */}
          <Card className="border-terracotta/30 bg-terracotta/10 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h3 className="mb-2 font-serif text-lg font-medium text-foreground">
                    Individuelle Beratung
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Diese allgemeinen Tipps ersetzen keine individuelle Ernährungsberatung.
                    Bei besonderen Erkrankungen, Unverträglichkeiten oder Fragen sprechen Sie
                    mich gerne an – gemeinsam entwickeln wir einen auf Sie zugeschnittenen Ernährungsplan.
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

export default Ernaehrung;
