import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Headphones, FileText, ShieldCheck, AlertTriangle, BookOpen } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const Raucherentwoehnung = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Raucherentwöhnung – Therapiematerialien"
        description="Begleitende Therapiematerialien zur Entwöhnung von der E-Zigarette: Selbsthypnose-Audios und Begleitskript – ausschließlich über die geschützte Patienten-Bibliothek."
      />

      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Nur für Patienten
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Raucherentwöhnung
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Begleitende Therapiematerialien zur Entwöhnung von der E-Zigarette.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <Card className="border-primary/30 shadow-card">
            <CardContent className="p-6 md:p-8 space-y-4">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-1 h-6 w-6 text-primary shrink-0" />
                <div className="space-y-2">
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    Materialien jetzt in deiner Patienten-Bibliothek
                  </h2>
                  <p className="text-sm text-foreground leading-relaxed">
                    Aus rechtlichen und Datenschutz-Gründen sind sämtliche Selbsthypnose-Audios
                    (Tägliche Kurzversion, Tiefe Sitzung – jeweils männliche & weibliche Stimme,
                    Tiefenentspannung, Zielarbeit) sowie das Begleitskript und der
                    Audio-Wortlaut <strong>ausschließlich</strong> im geschützten Bereich verfügbar.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Login erforderlich – Freischaltung erfolgt nach persönlicher Rücksprache mit
                    Peter Rauch.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild>
                  <Link to="/patienten-bibliothek">
                    <Headphones className="mr-2 h-4 w-4" /> Zur Patienten-Bibliothek
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/auth?redirect=%2Fpatienten-bibliothek">
                    <FileText className="mr-2 h-4 w-4" /> Anmelden / Registrieren
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                  <li>• Selbsthypnose-Audios sind ausschließlich für die persönliche Anwendung und nicht für die Weitergabe bestimmt.</li>
                  <li>• Nicht beim Autofahren oder bei Tätigkeiten anhören, die volle Aufmerksamkeit erfordern.</li>
                  <li>• Die Materialien ergänzen die Therapie und ersetzen keine ärztliche oder heilpraktische Beratung.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 h-4 w-4" />
            <p>Naturheilpraxis Peter Rauch · Heilpraktiker · Augsburg</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Raucherentwoehnung;
