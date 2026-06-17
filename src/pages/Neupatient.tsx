import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import {
  FileText,
  Download,
  PenLine,
  CalendarCheck,
  ShieldCheck,
  ClipboardList,
  ScrollText,
  Info,
  Mail,
  Phone,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SEOHead from "@/components/seo/SEOHead";

const Neupatient = () => {
  const steps = [
    {
      n: "1",
      icon: Download,
      title: "Vorbereiten",
      text: "Komplettpaket herunterladen — Anamnese, Patientenvertrag und Datenschutz-Einwilligung in einem PDF (49 Seiten).",
    },
    {
      n: "2",
      icon: PenLine,
      title: "Ausfüllen & Unterschreiben",
      text: "In Ruhe zu Hause ausfüllen, Datenschutz-Einwilligung und Vertrag unterschreiben. Bei Minderjährigen unterschreiben die Sorgeberechtigten mit.",
    },
    {
      n: "3",
      icon: CalendarCheck,
      title: "Mitbringen oder vorab senden",
      text: "Zum ersten Termin mitbringen — oder vorab eingescannt per Mail an anamnese@art-of-therapy.de senden. So gewinnen wir Zeit für die eigentliche Behandlung.",
    },
  ];

  const docs = [
    {
      icon: ClipboardList,
      title: "Anamnesebogen",
      file: null,
      why: "Damit ich Dich ganzheitlich behandeln kann — Beschwerden, Vorerkrankungen, Medikamente, Lebensumstände. Je vollständiger, desto besser der Therapieplan.",
    },
    {
      icon: ScrollText,
      title: "Patientenvertrag",
      file: "/patientenvertrag-blanko.pdf",
      why: "Rechtlich vorgeschrieben (§ 630a BGB): regelt Honorar, Termine und die 48-Stunden-Absageregelung. Klare Vereinbarung schützt beide Seiten.",
    },
    {
      icon: ShieldCheck,
      title: "Datenschutz-Einwilligung",
      file: "/datenschutz-einwilligung-blanko.pdf",
      why: "Gesundheitsdaten sind nach Art. 9 DSGVO besonders geschützt. Ohne diese Einwilligung darf ich Deine Daten nicht verarbeiten.",
    },
  ];

  return (
    <Layout>
      <SEOHead
        title="Neupatient – Ihr Erstkontakt in 3 Schritten | Naturheilpraxis Rauch"
        description="Anamnesebogen, Patientenvertrag und Datenschutz-Einwilligung als Komplettpaket zum Herunterladen. So bereiten Sie sich auf Ihren ersten Termin vor."
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sage-700 via-sage-600 to-sage-500 py-16 md:py-24">
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center text-primary-foreground">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Willkommen als Neupatient
            </p>
            <h1 className="mb-4 font-serif text-3xl font-semibold leading-tight md:text-5xl">
              In 3 Schritten zu Deinem ersten Termin
            </h1>
            <p className="text-lg leading-relaxed text-sage-100 md:text-xl">
              Damit wir die wertvolle Zeit im Erstgespräch wirklich für Dich nutzen können,
              bitte ich Dich, drei Dokumente bereits zu Hause auszufüllen. Hier findest Du alles
              in einem Paket.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" className="w-full" preserveAspectRatio="none">
            <path d="M0 80V40C240 10 480 0 720 0C960 0 1200 10 1440 40V80H0Z" className="fill-background" />
          </svg>
        </div>
      </section>

      {/* 3-Schritte-Fahrplan */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-border bg-card p-7 shadow-card transition-shadow hover:shadow-elevated"
              >
                <div className="absolute -top-4 left-7 flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-md">
                  {s.n}
                </div>
                <div className="mb-4 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Primary CTA – Komplettpaket */}
      <section className="pb-12 md:pb-16">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-sage-50 via-background to-sand-50 shadow-elevated">
              <CardContent className="p-8 md:p-10">
                <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                      <FileText className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                        Empfohlen
                      </p>
                      <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground md:text-3xl">
                        Komplettpaket herunterladen
                      </h2>
                      <p className="text-sm text-muted-foreground md:text-base">
                        Der Anamnesebogen wird im geschützten Patientenbereich bereitgestellt.
                        Vertrag und Datenschutz bleiben separat verfügbar.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/auth?type=new_patient"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Geschützt registrieren
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Einzeldownloads */}
            <Accordion type="single" collapsible className="mt-6">
              <AccordionItem value="single" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">
                  Lieber einzeln herunterladen? Hier sind die 3 Dokumente separat.
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-5 pt-2">
                  {docs.filter((d) => d.file).map((d) => (
                    <a
                      key={d.file}
                      href={d.file ?? "#"}
                      download
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-primary/40 hover:bg-sage-50"
                    >
                      <span className="flex items-center gap-3">
                        <d.icon className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-foreground">{d.title}</span>
                      </span>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Warum drei Dokumente */}
      <section className="bg-muted/40 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Warum diese drei Dokumente?
            </h2>
            <p className="mb-10 text-center text-muted-foreground">
              Kurze Begründung, damit Du weißt, was Du da unterschreibst.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {docs.map((d) => (
                <div key={d.title} className="rounded-2xl bg-card p-6 shadow-card">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sage-100">
                    <d.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-serif text-lg font-semibold text-foreground">{d.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{d.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Online-Alternative */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <Card className="border-accent/30 bg-accent/5 shadow-card">
              <CardContent className="p-7 md:p-8">
                <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <Info className="mt-1 h-6 w-6 shrink-0 text-accent" />
                    <div>
                      <h3 className="mb-1 font-serif text-lg font-semibold text-foreground">
                        Lieber digital ausfüllen?
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Den Anamnesebogen kannst Du auch online im geschützten Patientenbereich
                        ausfüllen — mit automatischem Zwischenspeichern und verschlüsselter
                        Übertragung.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/auth?type=new_patient"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-accent/40 bg-background px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
                  >
                    Online registrieren
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Häufige Fragen
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              <AccordionItem value="q1" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  Was, wenn ich eine Frage im Anamnesebogen nicht beantworten kann?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  Lass das Feld einfach frei oder schreibe „unklar". Wir klären das gemeinsam im
                  Erstgespräch. Wichtig ist, was Du weißt — nicht, dass jedes Feld ausgefüllt ist.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q2" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  Mein Kind ist Patient — wer unterschreibt?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  Bei Minderjährigen müssen die Sorgeberechtigten (Mutter/Vater bzw. beide) Datenschutz
                  und Patientenvertrag unterschreiben. Im PDF gibt es dafür eigene Felder.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q3" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  Was passiert mit meinen Daten?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  Deine Gesundheitsdaten werden ausschließlich in der Praxis verarbeitet, nach den
                  gesetzlichen Aufbewahrungsfristen (10 Jahre) gespeichert und nicht an Dritte
                  weitergegeben. Details findest Du in der{" "}
                  <Link to="/datenschutz" className="text-primary underline">
                    Datenschutzerklärung
                  </Link>
                  .
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q4" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  Kann ich das PDF am Computer ausfüllen?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  Ja. Das Komplettpaket ist ein ausfüllbares PDF (AcroForm). Mit einem PDF-Reader
                  (Adobe Reader, Foxit, Vorschau auf Mac) kannst Du direkt am Bildschirm tippen.
                  Unterschriften erfolgen klassisch handschriftlich auf dem ausgedruckten Bogen.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q5" className="rounded-xl border border-border bg-card px-5">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  Wie viel Zeit muss ich einplanen?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  Für den vollständigen Anamnesebogen solltest Du Dir 30–45 Minuten in Ruhe nehmen.
                  Patientenvertrag und Datenschutz sind in 10 Minuten gelesen und unterschrieben.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Kontakt-Footer */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-2xl bg-primary p-8 text-center text-primary-foreground shadow-elevated md:p-10">
            <h2 className="mb-3 font-serif text-2xl font-semibold md:text-3xl">
              Fragen? Ruf einfach an.
            </h2>
            <p className="mb-6 text-sage-100">
              Vor dem ersten Termin ist immer ein kurzes Telefonat sinnvoll — so klären wir, ob
              Deine Anliegen zu meinem Therapiespektrum passen.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="tel:08212621462"
                className="inline-flex items-center gap-2 rounded-xl bg-background px-6 py-3 text-base font-semibold text-primary shadow-md transition-transform hover:scale-105"
              >
                <Phone className="h-5 w-5" />
                0821 - 2621462
              </a>
              <a
                href="mailto:info@art-of-therapy.de"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-primary-foreground backdrop-blur transition-colors hover:bg-white/20"
              >
                <Mail className="h-5 w-5" />
                info@art-of-therapy.de
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Neupatient;
