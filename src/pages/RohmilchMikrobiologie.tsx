import { useState, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Shield,
  Users,
  BookOpen,
  Microscope,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

/* ─── Pathogene ─── */
const pathogeneData = [
  { keim: "Campylobacter jejuni", dosis: "500–800 KbE", symptome: "Blutiger Durchfall, Fieber, Guillain-Barré-Syndrom", hitze: "72 °C / 15 Sek." },
  { keim: "Salmonella spp.", dosis: "10⁴–10⁶ KbE", symptome: "Gastroenteritis, Sepsis bei Immunschwäche", hitze: "72 °C / 15 Sek." },
  { keim: "Listeria monocytogenes", dosis: "Variabel", symptome: "Meningitis, Sepsis, Fehlgeburt. Letalität 20–30 %!", hitze: "72 °C / 15 Sek." },
  { keim: "EHEC / STEC", dosis: "10–100 KbE (!)", symptome: "HUS → Nierenversagen, v.a. bei Kindern", hitze: "70 °C / 2 Min." },
  { keim: "S. aureus (Toxin)", dosis: "Toxin ab ~100 ng", symptome: "Erbrechen, Durchfall. Toxin überlebt bis 121 °C!", hitze: "Bakterium 72 °C, Toxin hitzestabil!" },
];

const pasteurisierungsVerfahren = [
  { verfahren: "Dauererhitzung (LTLT)", temp: "63 °C / 30 Min.", anwendung: "Kleinstbetriebe" },
  { verfahren: "Kurzzeiterhitzung (HTST)", temp: "72–75 °C / 15–30 Sek.", anwendung: "Standard (90 % der Trinkmilch)" },
  { verfahren: "Hocherhitzung (ESL)", temp: "85–127 °C / 1–4 Sek.", anwendung: 'ESL-Milch „länger frisch"' },
  { verfahren: "Ultrahocherhitzung (UHT)", temp: "135–150 °C / 2–4 Sek.", anwendung: "H-Milch (steril)" },
];

/* ─── Quellen ─── */
const quellen = [
  { nr: 1, text: "BfR. Erhitzen macht Milch sicher. Mitteilung 008/2025." },
  { nr: 2, text: "BfR. Verzehr von Rohmilch. Bewertung 06.09.2024." },
  { nr: 3, text: "Luk CH et al. Salmonella dormant state. PLoS Pathog. 2021;17(4):e1009550." },
  { nr: 4, text: "Keithlin J et al. Campylobacter chronic sequelae. BMC Public Health. 2014;14:1203." },
  { nr: 5, text: "PMC. Listeria cognitive impairment. Brain Behav Immun. 2023;110:74-85." },
  { nr: 6, text: "Ped. Nephrol. STEC-HUS 10-year outcome. 2024;39:2459-2465." },
  { nr: 7, text: "RKI. Campylobacter-Enteritis: Ratgeber für Ärzte. rki.de." },
];

/* ─── Slide-Komponente ─── */
const SlideWrapper = ({ children, slideNumber, totalSlides }: { children: React.ReactNode; slideNumber: number; totalSlides: number }) => (
  <div className="min-w-0 shrink-0 grow-0 basis-full px-2 md:px-4">
    <div className="relative min-h-[70vh] md:min-h-[75vh] flex flex-col">
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sage-300 scrollbar-track-transparent">
        {children}
      </div>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        {slideNumber} / {totalSlides}
      </div>
    </div>
  </div>
);

const RohmilchMikrobiologie = () => {
  const totalSlides = 5;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start", containScroll: "trimSnaps" });
  const [currentSlide, setCurrentSlide] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  if (emblaApi) {
    emblaApi.on("select", onSelect);
  }

  return (
    <Layout>
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-8 md:py-12">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
              <Microscope className="mr-1.5 h-3.5 w-3.5" />
              Patienteninformation
            </Badge>
            <h1 className="mb-3 font-serif text-2xl font-semibold text-foreground md:text-4xl leading-tight">
              Mikrobiologische Aspekte von Rohmilch
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground leading-relaxed">
              Wissenschaftliche Informationen zu Keimen in nicht pasteurisierter Milch.
            </p>
            <p className="mx-auto max-w-3xl mt-2 text-xs text-muted-foreground italic">
              Die folgenden Informationen beziehen sich auf wissenschaftlich dokumentierte Risiken 
              von nicht pasteurisierter Milch gemäß BfR und RKI. 
              Sie stellen keine Bewertung der Milchwirtschaft oder pasteurisierter Standardprodukte dar.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-4 md:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={scrollPrev} disabled={currentSlide === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={`h-2 rounded-full transition-all ${i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={scrollNext} disabled={currentSlide === totalSlides - 1} className="gap-1">
              <span className="hidden sm:inline">Weiter</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div ref={emblaRef} className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
            <div className="flex">

              {/* ═══ SLIDE 1: Pathogene ═══ */}
              <SlideWrapper slideNumber={1} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <AlertTriangle className="mb-1 mr-2 inline-block h-6 w-6 text-destructive" />
                    Pathogene Keime in Rohmilch
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-3 py-2 text-left font-medium text-foreground">Keim</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Infektionsdosis</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Symptome</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Abtötung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pathogeneData.map((p) => (
                          <tr key={p.keim} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{p.keim}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.dosis}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.symptome}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.hitze}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: BfR 2024/2025 [1, 2], RKI [7]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 2: Pasteurisierung ═══ */}
              <SlideWrapper slideNumber={2} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Pasteurisierung – Verfahren &amp; Produktsicherheit
                  </h2>
                  <p className="text-center text-xs text-muted-foreground max-w-3xl mx-auto italic">
                    Die Pasteurisierung ist ein bewährtes, gesetzlich vorgeschriebenes Verfahren 
                    zur Gewährleistung der Lebensmittelsicherheit. Die überwiegende Mehrheit der im deutschen 
                    Handel erhältlichen Milchprodukte ist pasteurisiert und gilt als mikrobiologisch sicher.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-3 py-2 text-left font-medium text-foreground">Verfahren</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Temperatur / Zeit</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Anwendung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pasteurisierungsVerfahren.map((v) => (
                          <tr key={v.verfahren} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground">{v.verfahren}</td>
                            <td className="px-3 py-2 text-muted-foreground font-bold">{v.temp}</td>
                            <td className="px-3 py-2 text-muted-foreground">{v.anwendung}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-primary/20 p-4">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1 mb-2">
                        <CheckCircle className="h-4 w-4 text-primary" /> Pasteurisiert (sicher)
                      </h3>
                      <p className="text-xs text-muted-foreground">Trinkmilch, H-Milch, ESL, Joghurt, Quark, Sahne, Frischkäse, Butter (Standard), Schmelzkäse, Kondensmilch</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1 mb-2">
                        <XCircle className="h-4 w-4 text-destructive" /> Nicht pasteurisiert (Risiko)
                      </h3>
                      <p className="text-xs text-muted-foreground">Rohmilch (ab Hof), Vorzugsmilch, Rohmilchkäse (Camembert de Normandie, Roquefort etc.), Büffelmozzarella (teils)</p>
                    </div>
                  </div>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 3: Latente Infektionen ═══ */}
              <SlideWrapper slideNumber={3} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Microscope className="mb-1 mr-2 inline-block h-6 w-6 text-destructive" />
                    Latente &amp; persistierende Infektionen
                  </h2>
                  <p className="text-center text-xs text-muted-foreground max-w-3xl mx-auto italic">
                    Viele milchrelevante Erreger können intrazellulär persistieren und chronische, schwer 
                    zuordenbare Beschwerden verursachen. Dies betrifft primär Expositionen mit 
                    nicht pasteurisierten Produkten.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Salmonella enterica</h3>
                      <p className="text-xs text-muted-foreground">Überlebt intrazellulär in Makrophagen (SCVs), persistiert in Gallenblase. Chronische Symptome: Unspezifische Bauchbeschwerden, reaktive Arthritis, chronische Müdigkeit, Dauerausscheidertum [3].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Campylobacter jejuni</h3>
                      <p className="text-xs text-muted-foreground">Molekulare Mimikry (LOS ≈ Ganglioside) → Autoimmun. 9–13 % entwickeln Reizdarmsyndrom, ~1:1.000 Guillain-Barré-Syndrom [4].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Listeria monocytogenes</h3>
                      <p className="text-xs text-muted-foreground">Intrazellulärer Parasit (Listeriolysin O). Langzeitfolgen: Progressive kognitive Beeinträchtigung, Immundysregulation [5].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> EHEC / STEC</h3>
                      <p className="text-xs text-muted-foreground">Shiga-Toxin → mikrovaskuläre Schäden. 10-J.-Follow-up: 25 % HUS-Überlebende mit Nierenauffälligkeiten, Hypertonie [6].</p>
                    </div>
                  </div>
                  <Card className="bg-accent/5 border-accent/20">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <strong className="text-foreground">Einordnung:</strong> Latente Infektionen betreffen primär den Konsum <em>nicht pasteurisierter</em> Milchprodukte. Die industrielle Pasteurisierung eliminiert die beschriebenen Erreger zuverlässig.
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 4: Risikogruppen ═══ */}
              <SlideWrapper slideNumber={4} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Users className="mb-1 mr-2 inline-block h-6 w-6 text-destructive" />
                    Risikogruppen &amp; Empfehlungen
                  </h2>
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-serif text-base font-medium text-foreground">Besonders gefährdete Personen</h3>
                      <p className="text-sm text-muted-foreground">
                        <strong>Schwangere, Säuglinge, Kleinkinder, ältere Menschen und Immunsupprimierte</strong> sollten 
                        konsequent auf Rohmilch und Rohmilchprodukte verzichten [1, 2].
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                        <div className="rounded bg-background p-3">
                          <strong className="text-foreground">Schwangere:</strong> Listerien können die Plazenta überwinden → Fehl-/Totgeburt.
                        </div>
                        <div className="rounded bg-background p-3">
                          <strong className="text-foreground">Kleinkinder:</strong> EHEC kann das lebensbedrohliche HUS auslösen.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-5 text-sm text-muted-foreground space-y-2">
                      <h3 className="font-serif text-base font-medium text-foreground">Hinweis zur Einordnung</h3>
                      <p>
                        Die beschriebenen Risiken beziehen sich auf den wissenschaftlich dokumentierten Konsum 
                        <strong className="text-foreground"> nicht pasteurisierter</strong> Milchprodukte. 
                        Pasteurisierte Milch und daraus hergestellte Produkte des regulären Handels gelten gemäß 
                        BfR und EFSA als <strong className="text-foreground">sichere Lebensmittel</strong>, 
                        sofern die Kühlkette eingehalten wird.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 5: Quellen & Disclaimer ═══ */}
              <SlideWrapper slideNumber={5} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <BookOpen className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Quellenverzeichnis &amp; rechtliche Hinweise
                  </h2>
                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                      <h3 className="font-serif text-sm font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-accent" />
                        Wichtige Hinweise
                      </h3>
                      <p>
                        <strong className="text-foreground">Heilmittelwerbegesetz (HWG):</strong> Diese Informationen 
                        dienen ausschließlich der allgemeinen wissenschaftlichen Aufklärung und stellen kein 
                        Heilversprechen dar. Sie sind weder als Werbung für oder gegen bestimmte Lebensmittel 
                        oder Produkte zu verstehen, noch richten sie sich gegen einzelne Branchen, Erzeuger 
                        oder Berufsgruppen.
                      </p>
                      <p>
                        <strong className="text-foreground">Fachliche Beratung:</strong> Die dargestellten 
                        Informationen können eine individuelle Diagnostik und Therapie nicht ersetzen. 
                        In der <strong>Naturheilpraxis Peter Rauch</strong> besprechen wir Ihre persönliche 
                        Situation gerne im Detail.
                      </p>
                      <p>
                        <strong className="text-foreground">Haftungsausschluss gem. § 630a ff. BGB:</strong> Die 
                        eigenständige Anwendung ohne fachliche Begleitung erfolgt auf eigenes Risiko.
                      </p>
                      <p>
                        <strong className="text-foreground">Quellen &amp; Transparenz:</strong>{" "}
                        <a href="/quellenhinweis" className="text-primary underline">Quellenhinweis &amp; Haftungsausschluss</a>
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="p-4">
                      <ol className="space-y-1 text-xs text-muted-foreground leading-relaxed list-none">
                        {quellen.map((q) => (
                          <li key={q.nr} className="flex gap-2">
                            <span className="shrink-0 font-mono font-medium text-foreground">[{q.nr}]</span>
                            <span>{q.text}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={scrollPrev} disabled={currentSlide === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Zurück</span>
            </Button>
            <span className="text-sm text-muted-foreground">{currentSlide + 1} / {totalSlides}</span>
            <Button variant="outline" size="sm" onClick={scrollNext} disabled={currentSlide === totalSlides - 1} className="gap-1">
              <span className="hidden sm:inline">Weiter</span> <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RohmilchMikrobiologie;
