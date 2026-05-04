import { useState, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bone,
  BookOpen,
  CheckCircle,
  Ban,
  Leaf,
  Apple,
  ChevronLeft,
  ChevronRight,
  Scale,
  Microscope,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useContentProtection } from "@/hooks/useContentProtection";

/* ─── Calcium-Quellen ─── */
const calciumQuellen = [
  { name: "Kuhmilch (3,5 %)", ca: "~120 mg/100 ml", bio: "~30–35 %", netto: "~38 mg", kategorie: "Milch" },
  { name: "Grünkohl (gekocht)", ca: "~210 mg/100 g", bio: "~60 %", netto: "~126 mg", kategorie: "Pflanzlich" },
  { name: "Brokkoli (gekocht)", ca: "~47 mg/100 g", bio: "~60 %", netto: "~28 mg", kategorie: "Pflanzlich" },
  { name: "Sesam / Tahin", ca: "~780 mg/100 g", bio: "~20 %", netto: "~156 mg", kategorie: "Pflanzlich" },
  { name: "Mineralwasser (Ca-reich)", ca: "bis 600 mg/L", bio: "~40 %", netto: "~240 mg/L", kategorie: "Getränk" },
  { name: "Tofu (Ca-gesetzt)", ca: "~350 mg/100 g", bio: "~30 %", netto: "~105 mg", kategorie: "Pflanzlich" },
  { name: "Sardinen (mit Gräten)", ca: "~380 mg/100 g", bio: "~25 %", netto: "~95 mg", kategorie: "Tierisch" },
  { name: "Parmesan", ca: "~1.180 mg/100 g", bio: "~30 %", netto: "~354 mg", kategorie: "Milch" },
];

/* ─── Knochen-Cofaktoren ─── */
const cofaktoren = [
  { name: "Vitamin D₃", funktion: "Steigert Ca-Resorption im Darm um das 2–5-fache. Ohne D₃ werden nur ~10–15 % des Calciums aufgenommen.", empfehlung: "800–2.000 IE/Tag (DGE: 800 IE)" },
  { name: "Vitamin K₂ (MK-7)", funktion: "Aktiviert Osteocalcin → lenkt Calcium in Knochen statt in Gefäße. Verhindert Gefäßverkalkung.", empfehlung: "100–200 µg/Tag" },
  { name: "Magnesium", funktion: "Notwendig für PTH-Sekretion und Vitamin-D-Aktivierung. Mg-Mangel = Ca kann nicht verwertet werden.", empfehlung: "300–400 mg/Tag (DGE)" },
  { name: "Bewegung (mechanisch)", funktion: "Piezoelektrischer Effekt: Druck auf Knochen → Osteoblasten-Aktivierung → Knochenneubildung.", empfehlung: "30 Min./Tag gewichtstragende Aktivität" },
];

/* ─── Quellen ─── */
const quellen = [
  { nr: 1, text: "Feskanich D et al. Milk and bone fractures in women. Am J Public Health. 1997;87(6):992-997." },
  { nr: 2, text: "Michaëlsson K et al. Milk intake and mortality. BMJ. 2014;349:g6015." },
  { nr: 3, text: "Kemi VE et al. High phosphorus and Ca metabolism. Br J Nutr. 2006;96(3):545-552." },
  { nr: 4, text: "Bischoff-Ferrari HA et al. Calcium intake and hip fracture risk. Am J Clin Nutr. 2007;86(6):1780-1790." },
  { nr: 5, text: "Weaver CM et al. Calcium bioavailability from high oxalate vegetables. J Food Sci. 1999;64(3):500-502." },
  { nr: 6, text: "DGE. Referenzwerte Calcium. dge.de (März 2026)." },
  { nr: 7, text: "Lanou AJ et al. Calcium, dairy, and bone health. Pediatrics. 2005;115(3):736-743." },
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

const MilchKnochengesundheit = () => {
  useContentProtection();
  const totalSlides = 6;
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
              <Bone className="mr-1.5 h-3.5 w-3.5" />
              Patienteninformation
            </Badge>
            <h1 className="mb-3 font-serif text-2xl font-semibold text-foreground md:text-4xl leading-tight">
              Milch &amp; Knochengesundheit
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground leading-relaxed">
              Die wissenschaftliche Debatte um Calcium, Phosphor und Knochengesundheit.
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

              {/* ═══ SLIDE 1: Die Kontroverse ═══ */}
              <SlideWrapper slideNumber={1} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
                    Das Calcium-Paradoxon
                  </h2>
                  <p className="text-center text-muted-foreground text-sm">Schützt Milch wirklich vor Osteoporose? Die Studienlage überrascht.</p>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Traditionelle Sichtweise
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        <p>• ~120 mg Calcium/100 ml, Bioverfügbarkeit ~30–35 %</p>
                        <p>• DGE empfiehlt Milch als Calciumquelle [6]</p>
                        <p>• Positiver Effekt auf Knochendichte bei Kindern (Metaanalyse)</p>
                        <p>• Milch liefert zusätzlich Protein, Vitamin B₂, B₁₂</p>
                      </CardContent>
                    </Card>
                    <Card className="border-accent/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif flex items-center gap-2">
                          <Ban className="h-4 w-4 text-accent" />
                          Kritische Wissenschaft
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        <p>• Milch: Ca:P-Verhältnis 1,3:1 – Phosphor steigert renale Ca-Ausscheidung [3]</p>
                        <p>• Kasein erhöht Säurelast → Ca wird als Puffer aus Knochen mobilisiert</p>
                        <p>• Harvard-Studie (77.761 Frauen): KEIN Schutz vor Hüftfrakturen [1]</p>
                        <p>• Höchster Milchkonsum (Skandinavien) = höchste Osteoporose-Rate [2]</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-sage-50">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">Einordnung:</strong> Die Studienlage ist wissenschaftlich kontrovers. Die hier dargestellten Ergebnisse geben den aktuellen wissenschaftlichen Diskurs wieder und richten sich nicht gegen ein bestimmtes Produkt oder eine Branche.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 2: Calcium-Phosphor-Mechanismus ═══ */}
              <SlideWrapper slideNumber={2} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Microscope className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Der Calcium-Phosphor-Mechanismus
                  </h2>
                  <div className="space-y-4">
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                      <h3 className="font-medium text-foreground mb-3">Warum „viel Calcium" nicht automatisch „starke Knochen" bedeutet</h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>1. Kuhmilch enthält ~120 mg Ca und ~95 mg Phosphor pro 100 ml (Verhältnis 1,3:1)</p>
                        <p>2. Hohe Phosphatzufuhr → Serum-Phosphat steigt → Parathormon (PTH) wird stimuliert [3]</p>
                        <p>3. PTH aktiviert Osteoklasten → <strong className="text-foreground">Calcium wird aus Knochen freigesetzt</strong></p>
                        <p>4. Gleichzeitig: Kasein erzeugt metabolische Säurelast → zusätzlicher Ca-Verlust über die Niere</p>
                        <p>5. Netto-Bilanz: Ein Teil des aufgenommenen Calciums geht als Ausgleich wieder verloren</p>
                      </div>
                    </div>
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4 text-xs text-muted-foreground">
                        <p><strong className="text-foreground">Vergleich Grünkohl:</strong> Ca:P-Verhältnis ~2,8:1, kaum Säurelast, Bioverfügbarkeit ~60 %. 100 g gekochter Grünkohl liefern effektiv mehr verwertbares Calcium als 100 ml Milch.</p>
                      </CardContent>
                    </Card>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Kemi et al. 2006 [3], Weaver et al. 1999 [5]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 3: Calcium-Quellen Vergleich ═══ */}
              <SlideWrapper slideNumber={3} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Apple className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Calcium-Quellen im Vergleich
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-3 py-2 text-left font-medium text-foreground">Lebensmittel</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Ca-Gehalt</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Bioverfügb.</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Netto-Ca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calciumQuellen.map((d) => (
                          <tr key={d.name} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground">{d.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.ca}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.bio}</td>
                            <td className="px-3 py-2 text-muted-foreground font-medium">{d.netto}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Card className="bg-sage-50">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">DGE-Empfehlung:</strong> 1.000 mg Calcium/Tag für Erwachsene [6]. Dies ist auch ohne Milchprodukte durch eine ausgewogene, calciumreiche Ernährung erreichbar.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 4: Cofaktoren ═══ */}
              <SlideWrapper slideNumber={4} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Knochengesundheit – Mehr als nur Calcium
                  </h2>
                  <p className="text-center text-sm text-muted-foreground">Calcium allein reicht nicht – diese Cofaktoren sind entscheidend.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {cofaktoren.map((c) => (
                      <Card key={c.name} className="shadow-sm">
                        <CardContent className="p-4">
                          <h3 className="text-sm font-medium text-foreground mb-1">{c.name}</h3>
                          <p className="text-xs text-muted-foreground mb-2">{c.funktion}</p>
                          <Badge variant="outline" className="text-xs">{c.empfehlung}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: DGE 2026 [6], Bischoff-Ferrari et al. 2007 [4]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 5: Skandinavien-Paradoxon ═══ */}
              <SlideWrapper slideNumber={5} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Das skandinavische Paradoxon
                  </h2>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                      <h3 className="font-medium text-foreground mb-2">Die Beobachtung</h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>• Schweden & Norwegen: höchster Pro-Kopf-Milchkonsum weltweit (~350 kg/Jahr)</p>
                        <p>• Gleichzeitig: höchste Hüftfrakturraten weltweit</p>
                        <p>• Schwedische Kohortenstudie (61.433 Frauen): ≥3 Gläser/Tag = <strong className="text-foreground">höheres</strong> Fraktur- und Mortalitätsrisiko [2]</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                      <h3 className="font-medium text-foreground mb-2">Mögliche Erklärungen</h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>• Phosphor-induzierter Ca-Verlust (s. Folie 2)</p>
                        <p>• D-Galactose (aus Laktose) → oxidativer Stress → Entzündung [2]</p>
                        <p>• Vitamin-D-Mangel (wenig Sonnenlicht) kompensiert Ca-Aufnahme nicht</p>
                        <p>• Korrelation ≠ Kausalität – weitere Faktoren möglich</p>
                      </div>
                    </div>
                  </div>
                  <Card className="bg-sage-50">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">Wissenschaftliche Einordnung:</strong> Epidemiologische Studien zeigen Korrelationen, keine bewiesene Kausalität. Die Ergebnisse unterstreichen jedoch, dass die Gleichung „mehr Milch = stärkere Knochen" wissenschaftlich nicht haltbar ist. Die Darstellung dient der Patientenaufklärung und richtet sich nicht gegen die Milchwirtschaft.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 6: Quellen & Disclaimer ═══ */}
              <SlideWrapper slideNumber={6} totalSlides={totalSlides}>
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

export default MilchKnochengesundheit;
