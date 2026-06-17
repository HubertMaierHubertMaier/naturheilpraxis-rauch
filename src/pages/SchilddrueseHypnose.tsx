import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck, BookOpen, Headphones, FileText, AlertTriangle } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const SchilddrueseHypnose = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Schilddrüsen-Hypnose – Therapiematerialien"
        description="Begleitende Hypnose-Materialien bei Schilddrüsen-Knoten – ausschließlich über die geschützte Patienten-Bibliothek erreichbar."
      />
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Nur für Patienten
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Schilddrüsen-Hypnose
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Begleitende Therapiematerialien für die Hypnose-Behandlung von Schilddrüsen-Knoten.
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
                    Selbsthypnose-Audios (Tägliche Kurzversion, Tiefe Sitzung – männlich & weiblich),
                    Verlaufstagebuch, Begleitskript und Wortlaut der Hypnosen stehen
                    <strong> ausschließlich</strong> im geschützten Bereich für freigeschaltete
                    Patientinnen und Patienten bereit.
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
                <div className="space-y-2 text-sm text-foreground leading-relaxed">
                  <p className="font-semibold">Wann meldest du dich in der Praxis?</p>
                  <ul className="space-y-1 list-disc pl-5 text-muted-foreground">
                    <li>Deutliche Größenzunahme eines Knotens innerhalb weniger Wochen</li>
                    <li>Neuer Druck oder Engegefühl im Hals</li>
                    <li>Schluckbeschwerden, die vorher nicht da waren</li>
                    <li>Heiserkeit ohne erkennbaren Anlass</li>
                  </ul>
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
