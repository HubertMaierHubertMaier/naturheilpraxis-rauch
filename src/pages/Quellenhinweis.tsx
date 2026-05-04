import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Brain,
  Users,
  Scale,
  ShieldCheck,
  MessageCircle,
  FileWarning,
} from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const Quellenhinweis = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Quellenhinweis & Haftungsausschluss"
        description="Informationen zur Herkunft, Qualität und Einordnung der bereitgestellten Gesundheitsinformationen in der Naturheilpraxis Peter Rauch."
      />

      {/* Hero */}
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <Scale className="mr-1.5 h-3.5 w-3.5" />
              Transparenzhinweis
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Quellenhinweis &amp; Haftungsausschluss
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Transparenz über Herkunft, Qualität und Grenzen der hier bereitgestellten 
              Gesundheitsinformationen.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-4xl space-y-10">

          {/* Herkunft der Informationen */}
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                    Herkunft der Informationen
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Die auf dieser Website bereitgestellten Gesundheitsinformationen basieren auf 
                    einer Vielzahl von Quellen und Erfahrungswerten. Im Sinne der Transparenz möchte 
                    ich offenlegen, wie diese Inhalte entstanden sind:
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: GraduationCap,
                    title: "Fachliche Ausbildung",
                    text: "Die Inhalte fußen auf meiner Ausbildung zum Heilpraktiker gemäß § 1 Heilpraktikergesetz (HeilprG), einschließlich Anatomie, Physiologie, Pathologie und naturheilkundlicher Verfahren.",
                  },
                  {
                    icon: BookOpen,
                    title: "Fachliteratur & Studien",
                    text: "Ich stütze mich auf veröffentlichte wissenschaftliche Studien, Fachliteratur, medizinische Leitlinien (z. B. AWMF) sowie Veröffentlichungen anerkannter Institutionen (RKI, BfR, DGE).",
                  },
                  {
                    icon: Brain,
                    title: "KI-gestützte Recherche",
                    text: "Teile der Recherche wurden unter Zuhilfenahme von KI-basierten Werkzeugen durchgeführt. Die Ergebnisse wurden von mir auf Plausibilität geprüft, können jedoch Fehler enthalten.",
                  },
                  {
                    icon: Users,
                    title: "Praxiserfahrung & Fortbildung",
                    text: "Beobachtungen aus meinem Praxisalltag, Erfahrungsaustausch mit Kolleginnen und Kollegen, Fortbildungen sowie Kongressbesuche fließen ebenfalls in die Inhalte ein.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Einschränkungen & Grenzen */}
          <Card className="border-accent/30 shadow-card">
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <FileWarning className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                    Einschränkungen &amp; Grenzen der Informationen
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ich bin bestrebt, die Inhalte nach bestem Wissen und Gewissen sorgfältig 
                    zusammenzustellen. Gleichwohl weise ich ausdrücklich auf folgende Einschränkungen hin:
                  </p>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                {[
                  {
                    bold: "Kein Anspruch auf Vollständigkeit:",
                    text: "Die bereitgestellten Informationen stellen einen Ausschnitt des aktuellen Wissensstandes dar und erheben keinen Anspruch auf Vollständigkeit. Medizinisches Wissen entwickelt sich stetig weiter; einzelne Darstellungen können daher zwischenzeitlich überholt sein.",
                  },
                  {
                    bold: "Möglichkeit von Fehlern:",
                    text: "Trotz sorgfältiger Prüfung können die Informationen sachliche Fehler, Ungenauigkeiten oder vereinfachte Darstellungen enthalten – insbesondere dort, wo komplexe wissenschaftliche Sachverhalte allgemeinverständlich zusammengefasst werden.",
                  },
                  {
                    bold: "Keine individuelle Anwendbarkeit:",
                    text: "Jeder Mensch ist einzigartig. Die allgemeinen Informationen auf dieser Website können und sollen eine individuelle Anamnese, Diagnostik und Therapieplanung nicht ersetzen. Was für eine Person zutreffend ist, muss auf eine andere nicht zutreffen.",
                  },
                  {
                    bold: "Keine ärztliche oder heilpraktische Beratung:",
                    text: "Die Inhalte dieser Website ersetzen keine persönliche Beratung, Untersuchung oder Behandlung durch einen approbierten Arzt oder zugelassenen Heilpraktiker. Bei gesundheitlichen Beschwerden wenden Sie sich bitte stets an eine qualifizierte Fachperson.",
                  },
                  {
                    bold: "KI-generierte Inhalte:",
                    text: "Wo KI-gestützte Recherche zum Einsatz kam, wurde diese auf Plausibilität und Konsistenz mit der Fachliteratur geprüft. Dennoch können KI-basierte Zusammenfassungen Fehler oder Halluzinationen enthalten, die trotz Prüfung nicht ausgeschlossen werden können.",
                  },
                ].map((item) => (
                  <li key={item.bold} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>
                      <strong className="text-foreground">{item.bold}</strong> {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Rechtliche Hinweise */}
          <Card className="border-destructive/20 shadow-card">
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <Scale className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                    Rechtliche Hinweise
                  </h2>
                </div>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <div className="rounded-xl bg-destructive/5 p-4 space-y-3">
                  <p>
                    <strong className="text-foreground">Heilmittelwerbegesetz (HWG):</strong> Sämtliche 
                    Informationen auf dieser Website dienen ausschließlich der allgemeinen Aufklärung 
                    und Gesundheitsbildung. Sie stellen keine Werbung für bestimmte Heilverfahren, 
                    Arzneimittel oder Medizinprodukte dar und beinhalten keinerlei Heilversprechen 
                    oder Garantien für Therapieerfolge im Sinne des § 3 HWG.
                  </p>
                  <p>
                    <strong className="text-foreground">Haftungsausschluss gem. § 630a ff. BGB:</strong> Die 
                    eigenständige Anwendung der hier dargestellten Informationen ohne vorherige 
                    individuelle fachliche Beratung und Begleitung erfolgt ausdrücklich auf eigenes 
                    Risiko. Für Schäden, die aus der eigenständigen Umsetzung allgemeiner 
                    Informationen ohne persönliche Konsultation entstehen, wird keine Haftung übernommen.
                  </p>
                  <p>
                    <strong className="text-foreground">Urheberrecht:</strong> Die Inhalte dieser Website 
                    sind urheberrechtlich geschützt. Die Vervielfältigung, Bearbeitung, Verbreitung 
                    oder jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedarf der 
                    vorherigen schriftlichen Zustimmung des Verfassers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Persönliche Beratung */}
          <Card className="border-primary/30 bg-primary/5 shadow-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <MessageCircle className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div className="space-y-3">
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    Persönliche Beratung empfohlen
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Die hier bereitgestellten Informationen ersetzen <strong className="text-foreground">niemals</strong> das 
                    persönliche Gespräch. In der <strong className="text-foreground">Naturheilpraxis Peter Rauch</strong> nehme 
                    ich mir die Zeit, Ihre <strong className="text-foreground">individuelle gesundheitliche Situation</strong> zu 
                    verstehen und die allgemeinen Informationen auf Ihren konkreten Fall anzupassen. 
                    Was in der Fachliteratur beschrieben wird, muss nicht zwangsläufig auf Sie persönlich 
                    zutreffen – und umgekehrt können für Sie relevante Aspekte bestehen, die in allgemeinen 
                    Darstellungen nicht abgebildet sind.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sprechen Sie mich gerne an – ich beantworte Ihre Fragen persönlich und ordne die 
                    Informationen für Sie individuell ein.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Letzte Aktualisierung */}
          <div className="text-center text-xs text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 h-4 w-4" />
            <p>Stand der Information: März 2026</p>
            <p>Naturheilpraxis Peter Rauch · Heilpraktiker · Augsburg</p>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default Quellenhinweis;
