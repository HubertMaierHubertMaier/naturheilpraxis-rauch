import { useState, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Droplets,
  Shield,
  Beaker,
  Heart,
  Brain,
  Baby,
  Users,
  TrendingUp,
  BookOpen,
  Microscope,
  Activity,
  CircleAlert,
  CheckCircle,
  XCircle,
  Milk,
  Leaf,
  Bone,
  Apple,
  Ban,
  Scale,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

/* ─── Statistik-Daten ─── */
const prevalenceData = [
  { region: "Deutschland", laktose: "15–20 %", protein: "2–3 % (Kinder), <1 % (Erwachsene)" },
  { region: "Nordeuropa (Skandinavien)", laktose: "2–5 %", protein: "~2 % (Kinder)" },
  { region: "Südeuropa (Italien, Griechenland)", laktose: "50–70 %", protein: "2–3 %" },
  { region: "Asien", laktose: "80–100 %", protein: "~1 %" },
  { region: "Afrika", laktose: "70–95 %", protein: "~1 %" },
  { region: "Weltweit", laktose: "~68 %", protein: "2–3 % (Kinder)" },
];

/* ─── Milchproteine ─── */
const milchProteine = [
  {
    name: "Kasein (αs1, αs2, β, κ)",
    anteil: "~80 % des Milchproteins",
    problem: "Häufigstes Allergen in Kuhmilch. Hitzebeständig – bleibt auch in gekochter Milch allergen. Kann IgE-vermittelte Sofortreaktionen auslösen.",
    icon: Shield,
  },
  {
    name: "β-Laktoglobulin (β-Lg)",
    anteil: "~10 % (Molkenprotein)",
    problem: "Kommt in menschlicher Muttermilch NICHT vor. Körper erkennt es als fremd → starke Immunantwort möglich. Hauptallergen der Molke.",
    icon: Microscope,
  },
  {
    name: "α-Laktalbumin (α-La)",
    anteil: "~5 % (Molkenprotein)",
    problem: "Kreuzreaktion mit humanem α-Laktalbumin möglich. Seltener Allergie-Auslöser als β-Lg, aber klinisch relevant.",
    icon: Activity,
  },
  {
    name: "Rinderserumalbumin (BSA)",
    anteil: "~1 %",
    problem: "Kann Kreuzreaktionen mit Rindfleisch auslösen (Beef-Milk-Syndrom). Hitzelabil – wird durch Kochen weitgehend zerstört.",
    icon: AlertTriangle,
  },
];

/* ─── Symptom-Vergleich ─── */
const symptomVergleich = {
  allergie: {
    title: "Milchproteinallergie (immunologisch)",
    zeitraum: "Minuten bis 2 Stunden (IgE) oder 2–72 Stunden (nicht-IgE)",
    symptome: [
      { bereich: "Haut", details: "Nesselsucht, Ekzem, Rötung, Schwellung, Juckreiz" },
      { bereich: "Atemwege", details: "Asthma, Rhinitis, Kehlkopfschwellung, Stridor" },
      { bereich: "Magen-Darm", details: "Erbrechen, Durchfall, Blut im Stuhl, Koliken" },
      { bereich: "Kreislauf", details: "Anaphylaxie (lebensbedrohlich!), Blutdruckabfall" },
      { bereich: "Allgemein", details: "Gedeihstörung bei Säuglingen, chronische Müdigkeit" },
    ],
  },
  intoleranz: {
    title: "Laktoseintoleranz (enzymatisch)",
    zeitraum: "30 Minuten bis 2 Stunden nach Verzehr",
    symptome: [
      { bereich: "Bauchschmerzen", details: "Krämpfe, Druckgefühl, Blähbauch" },
      { bereich: "Blähungen", details: "Starke Gasbildung durch bakterielle Fermentation" },
      { bereich: "Durchfall", details: "Osmotischer Durchfall durch unverdauten Milchzucker" },
      { bereich: "Übelkeit", details: "Übelkeit, selten Erbrechen" },
      { bereich: "Allgemein", details: "Kopfschmerzen, Müdigkeit, Konzentrationsprobleme" },
    ],
  },
};

/* ─── Formen der Laktoseintoleranz ─── */
const laktoseFormen = [
  {
    typ: "Primär (genetisch)",
    haeufigkeit: "~15–20 % in Deutschland",
    beschreibung: "Physiologischer Rückgang der Laktase-Produktion nach dem Abstillen. Genetisch durch LCT-Gen (Chromosom 2) gesteuert.",
    icon: Brain,
  },
  {
    typ: "Sekundär (erworben)",
    haeufigkeit: "Variabel",
    beschreibung: "Durch Schädigung der Dünndarmschleimhaut: Zöliakie, Morbus Crohn, Infektionen, Chemotherapie. Kann reversibel sein.",
    icon: Heart,
  },
  {
    typ: "Kongenital (angeboren)",
    haeufigkeit: "Extrem selten (<100 Fälle weltweit)",
    beschreibung: "Vollständiges Fehlen der Laktase ab Geburt. Autosomal-rezessiv vererbt.",
    icon: Baby,
  },
];

/* ─── Sahne & Butter ─── */
const sahneButterData = [
  { produkt: "Butter", laktose: "~0,6–0,7 g/100 g", protein: "~0,7 g/100 g", laktoseRisiko: "Sehr gering", allergieRisiko: "Gering (Spuren)", icon: CheckCircle, farbe: "text-primary" },
  { produkt: "Ghee (Butterschmalz)", laktose: "~0 g", protein: "~0 g", laktoseRisiko: "Praktisch null", allergieRisiko: "Praktisch null", icon: CheckCircle, farbe: "text-primary" },
  { produkt: "Sahne (30 %)", laktose: "~3,1 g/100 g", protein: "~2,4 g/100 g", laktoseRisiko: "Moderat", allergieRisiko: "Hoch", icon: AlertTriangle, farbe: "text-accent" },
  { produkt: "Hartkäse", laktose: "<0,1 g/100 g", protein: "~25–35 g/100 g", laktoseRisiko: "Sehr gering", allergieRisiko: "Sehr hoch (Kasein)", icon: CircleAlert, farbe: "text-accent" },
];

/* ─── Ausweichprodukte ─── */
const alternativProdukte = [
  { name: "Haferdrink", ca: "~120 mg (angereichert)", hinweis: "Cremig, mild. Beliebteste Alternative." },
  { name: "Sojadrink", ca: "~120 mg (angereichert)", hinweis: "Proteinreich (~3,5 g/100 ml)." },
  { name: "Sesam / Tahin", ca: "~780 mg/100 g", hinweis: "2 EL Tahin ≈ 1 Glas Milch." },
  { name: "Grünkohl", ca: "~210 mg/100 g", hinweis: "Hohe Bioverfügbarkeit (~60 %)." },
  { name: "Mineralwasser", ca: "bis 600 mg/L", hinweis: "Calciumreiche Sorten wählen (>150 mg/L)." },
];

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
  { verfahren: "Hocherhitzung (ESL)", temp: "85–127 °C / 1–4 Sek.", anwendung: "ESL-Milch „länger frisch"" },
  { verfahren: "Ultrahocherhitzung (UHT)", temp: "135–150 °C / 2–4 Sek.", anwendung: "H-Milch (steril)" },
];

/* ─── Quellen ─── */
const quellen = [
  { nr: 1, text: "Mattar R et al. Lactose intolerance. Clin Exp Gastroenterol. 2012;5:113-121." },
  { nr: 2, text: "Deng Y et al. Lactose Intolerance in Adults. Nutrients. 2015;7(9):8020-8035." },
  { nr: 3, text: "Wal JM. Cow's milk proteins/allergens. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):3-10." },
  { nr: 4, text: "Host A. Frequency of cow's milk allergy in childhood. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):33-37." },
  { nr: 5, text: "Enattah NS et al. Variant associated with adult-type hypolactasia. Nat Genet. 2002;30(2):233-237." },
  { nr: 6, text: "Koletzko S et al. Leitlinie Kuhmilchproteinallergie (S2k). AWMF 061/010, 2021." },
  { nr: 7, text: "Feskanich D et al. Milk and bone fractures in women. Am J Public Health. 1997;87(6):992-997." },
  { nr: 8, text: "Michaëlsson K et al. Milk intake and mortality. BMJ. 2014;349:g6015." },
  { nr: 9, text: "Kemi VE et al. High phosphorus and Ca metabolism. Br J Nutr. 2006;96(3):545-552." },
  { nr: 10, text: "BfR. Erhitzen macht Milch sicher. Mitteilung 008/2025." },
  { nr: 11, text: "BfR. Verzehr von Rohmilch. Bewertung 06.09.2024." },
  { nr: 12, text: "Luk CH et al. Salmonella dormant state. PLoS Pathog. 2021;17(4):e1009550." },
  { nr: 13, text: "Keithlin J et al. Campylobacter chronic sequelae. BMC Public Health. 2014;14:1203." },
  { nr: 14, text: "PMC. Listeria cognitive impairment. Brain Behav Immun. 2023;110:74-85." },
  { nr: 15, text: "Ped. Nephrol. STEC-HUS 10-year outcome. 2024;39:2459-2465." },
  { nr: 16, text: "DGE. Referenzwerte Calcium. dge.de (März 2026)." },
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

const MilchUnvertraeglichkeit = () => {
  const totalSlides = 14;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start", containScroll: "trimSnaps" });
  const [currentSlide, setCurrentSlide] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Register onSelect
  if (emblaApi) {
    emblaApi.on("select", onSelect);
  }

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-8 md:py-12">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
              <Microscope className="mr-1.5 h-3.5 w-3.5" />
              Patienteninformation
            </Badge>
            <h1 className="mb-3 font-serif text-2xl font-semibold text-foreground md:text-4xl leading-tight">
              Milchprotein-Allergie &amp; Laktose&shy;intoleranz
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground leading-relaxed">
              Wischen oder klicken Sie sich durch die Folien – nach links und rechts navigieren.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-4 md:py-8">
        <div className="mx-auto max-w-5xl">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollPrev}
              disabled={currentSlide === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={scrollNext}
              disabled={currentSlide === totalSlides - 1}
              className="gap-1"
            >
              <span className="hidden sm:inline">Weiter</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Carousel */}
          <div ref={emblaRef} className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
            <div className="flex">

              {/* ═══ SLIDE 1: Überblick ═══ */}
              <SlideWrapper slideNumber={1} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
                    Allergie vs. Intoleranz
                  </h2>
                  <p className="text-center text-muted-foreground text-sm">Der entscheidende Unterschied – zwei völlig verschiedene Erkrankungen.</p>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Card className="border-destructive/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 font-serif text-base">
                          <Shield className="h-5 w-5 text-destructive" />
                          Milchprotein-Allergie
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p><strong className="text-foreground">Mechanismus:</strong> Immunsystem stuft Milchproteine als Bedrohung ein → IgE-Antikörper oder T-Zellen.</p>
                        <p><strong className="text-foreground">Betrifft:</strong> V.a. Säuglinge (2–3 %). ~80 % entwickeln Toleranz bis Schulalter.</p>
                        <div className="rounded bg-destructive/5 p-2 text-xs text-destructive font-medium flex items-center gap-1">
                          <CircleAlert className="h-3.5 w-3.5" /> Kann lebensbedrohlich sein (Anaphylaxie)!
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 font-serif text-base">
                          <Droplets className="h-5 w-5 text-primary" />
                          Laktoseintoleranz
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p><strong className="text-foreground">Mechanismus:</strong> Mangel des Enzyms Laktase → Laktose wird im Dickdarm fermentiert → Gase.</p>
                        <p><strong className="text-foreground">Betrifft:</strong> ~15–20 % in Deutschland, weltweit ~68 %.</p>
                        <div className="rounded bg-primary/5 p-2 text-xs text-primary font-medium flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Unangenehm, aber nicht gefährlich
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Wal 2002 [3], Host 2002 [4], Mattar et al. 2012 [1], Koletzko et al. AWMF 2021 [6]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 2: Milchproteine ═══ */}
              <SlideWrapper slideNumber={2} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Die Milchproteine – Warum reagiert der Körper?
                  </h2>
                  <p className="text-center text-sm text-muted-foreground">Kuhmilch enthält über 25 verschiedene Proteine, von denen mehrere als Allergene wirken können.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {milchProteine.map((p) => (
                      <Card key={p.name} className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100">
                              <p.icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-foreground">{p.name}</h3>
                              <span className="text-xs text-muted-foreground">{p.anteil}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{p.problem}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Wal 2002 [3], Roth-Walter et al. 2021</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 3: Laktose-Mechanismus ═══ */}
              <SlideWrapper slideNumber={3} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Laktose &amp; Laktase – Der enzymatische Weg
                  </h2>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">Laktase vorhanden</span>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>1. Laktose gelangt in den Dünndarm</p>
                        <p>2. Laktase spaltet → Glukose + Galaktose</p>
                        <p>3. Einfachzucker werden resorbiert → Energie ✓</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5 text-accent" />
                        <span className="font-medium text-foreground">Laktasemangel</span>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>1. Laktose gelangt in den Dünndarm</p>
                        <p>2. Laktase fehlt → keine Spaltung</p>
                        <p>3. Laktose gelangt in den Dickdarm</p>
                        <p>4. Bakterien fermentieren → H₂, CO₂, CH₄</p>
                        <p>5. Osmotischer Wassereinstrom → <strong className="text-foreground">Durchfall, Blähungen, Krämpfe</strong></p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    {laktoseFormen.map((f) => (
                      <div key={f.typ} className="rounded-xl border border-border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <f.icon className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-medium text-foreground">{f.typ}</h3>
                        </div>
                        <Badge variant="outline" className="mb-2 text-xs">{f.haeufigkeit}</Badge>
                        <p className="text-xs text-muted-foreground">{f.beschreibung}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Enattah et al. 2002 [5], Deng et al. 2015 [2]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 4: Symptom-Vergleich ═══ */}
              <SlideWrapper slideNumber={4} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Symptom-Vergleich im Detail
                  </h2>
                  <div className="grid gap-5 md:grid-cols-2">
                    {Object.values(symptomVergleich).map((cat) => (
                      <Card key={cat.title} className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-serif">{cat.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">Onset: {cat.zeitraum}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {cat.symptome.map((s) => (
                              <div key={s.bereich} className="flex items-start gap-2 text-xs">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                <span><strong className="text-foreground">{s.bereich}:</strong> {s.details}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground"><strong className="text-destructive">Allergie-Mechanismus:</strong> IgE → Mastzellen → Histamin → Gefäßerweiterung, Schwellung, Bronchospasmus. Bei Anaphylaxie: Adrenalin-Autoinjektor!</p>
                      <p className="text-xs text-muted-foreground mt-1"><strong className="text-primary">Intoleranz-Mechanismus:</strong> Unverdaute Laktose → bakterielle Fermentation → Gase + osmotischer Durchfall. Dosisabhängig, 6–12 g oft toleriert.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 5: Sahne & Butter ═══ */}
              <SlideWrapper slideNumber={5} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Milk className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Sahne, Butter &amp; Käse – Wie betroffen?
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-3 py-2 text-left font-medium text-foreground">Produkt</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Laktose</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Protein</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Lakt.-Risiko</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Allergie-Risiko</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sahneButterData.map((d) => (
                          <tr key={d.produkt} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground flex items-center gap-1">
                              <d.icon className={`h-3.5 w-3.5 ${d.farbe}`} /> {d.produkt}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{d.laktose}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{d.protein}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{d.laktoseRisiko}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{d.allergieRisiko}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                      <p><strong className="text-foreground">Ghee</strong> ist durch Erhitzen und Filtrieren nahezu frei von Laktose und Proteinen – gilt als sicher für beide Erkrankungen.</p>
                      <p><strong className="text-foreground">Hartkäse</strong> (Parmesan, Emmentaler) ist laktosefrei durch Reifung, enthält aber hochkonzentriertes Kasein → bei Allergie nicht geeignet.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 6: Alternativen ═══ */}
              <SlideWrapper slideNumber={6} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Leaf className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Ausweichprodukte &amp; Alternativen
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-4 py-2 text-left font-medium text-foreground">Produkt</th>
                          <th className="px-4 py-2 text-left font-medium text-foreground">Calcium</th>
                          <th className="px-4 py-2 text-left font-medium text-foreground">Hinweis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alternativProdukte.map((p) => (
                          <tr key={p.name} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">{p.ca}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">{p.hinweis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Card className="bg-sage-50">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">Wichtig:</strong> Bei vollständiger Milchmeidung auf ausreichende Calciumzufuhr achten (DGE-Empfehlung: 1.000 mg/Tag für Erwachsene) [16]. Pflanzliche Alternativen sollten mit Calcium angereichert sein.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 7: Calcium-Kontroverse ═══ */}
              <SlideWrapper slideNumber={7} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Bone className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Milch &amp; Knochengesundheit – Die wissenschaftliche Debatte
                  </h2>
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
                        <p>• DGE empfiehlt Milch als Calciumquelle [16]</p>
                        <p>• Positiver Effekt auf Knochendichte bei Kindern (Metaanalyse)</p>
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
                        <p>• Milch: Ca:P-Verhältnis 1,3:1 – Phosphor steigert renale Ca-Ausscheidung [9]</p>
                        <p>• Kasein erhöht Säurelast → Ca wird als Puffer aus Knochen mobilisiert</p>
                        <p>• Harvard-Studie (77.761 Frauen): KEIN Schutz vor Hüftfrakturen [7]</p>
                        <p>• Höchster Milchkonsum (Skandinavien) = höchste Osteoporose-Rate [8]</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-sage-50">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">Einordnung:</strong> Die Studienlage ist wissenschaftlich kontrovers. Calcium allein reicht für Knochengesundheit nicht aus – Vitamin D, K₂, Magnesium und Bewegung sind ebenso entscheidend. <em>Die hier dargestellten Studienergebnisse richten sich nicht gegen ein bestimmtes Produkt oder eine Branche, sondern geben den aktuellen wissenschaftlichen Diskurs wieder.</em></p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 8: Prävalenz weltweit ═══ */}
              <SlideWrapper slideNumber={8} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <TrendingUp className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Häufigkeit weltweit
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-sage-50/50">
                          <th className="px-4 py-2 text-left font-medium text-foreground">Region</th>
                          <th className="px-4 py-2 text-left font-medium text-foreground">Laktoseintoleranz</th>
                          <th className="px-4 py-2 text-left font-medium text-foreground">Milchproteinallergie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prevalenceData.map((d) => (
                          <tr key={d.region} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium text-foreground">{d.region}</td>
                            <td className="px-4 py-2 text-muted-foreground">{d.laktose}</td>
                            <td className="px-4 py-2 text-muted-foreground">{d.protein}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Laktase-Persistenz (Fähigkeit, Milchzucker im Erwachsenenalter zu verdauen) ist eine genetische Anpassung 
                    an Viehzucht-Kulturen (LCT-Gen, Polymorphismus C/T-13910) – die weltweite Ausnahme, nicht die Regel [5].
                  </p>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Mattar et al. 2012 [1], Enattah et al. 2002 [5], Host 2002 [4]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 9: Diagnostik ═══ */}
              <SlideWrapper slideNumber={9} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Beaker className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Diagnostik
                  </h2>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif">Laktoseintoleranz</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {["H₂-Atemtest (Goldstandard)", "Laktose-Toleranztest (Blutzucker)", "Genetischer Test (LCT-13910 C/T)", "Stuhl-pH (<6 = Hinweis)", "Eliminationsdiät (2–4 Wochen)"].map((t) => (
                            <li key={t} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    <Card className="border-destructive/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif">Milchproteinallergie</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {["Prick-Test (Hauttest)", "Spezifisches IgE (RAST / ImmunoCAP)", "Atopy-Patch-Test (nicht-IgE)", "DBPCFC (doppelblinde Provokation)", "Eliminationsdiät + Provokation"].map((t) => (
                            <li key={t} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />{t}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Quellen: Koletzko et al. AWMF 2021 [6], Deng et al. 2015 [2]</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 10: Pathogene ═══ */}
              <SlideWrapper slideNumber={10} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <AlertTriangle className="mb-1 mr-2 inline-block h-6 w-6 text-destructive" />
                    Mikrobiologische Aspekte von Rohmilch
                  </h2>
                  <p className="text-center text-xs text-muted-foreground max-w-3xl mx-auto">
                    <em>Die folgenden Informationen beziehen sich auf wissenschaftlich dokumentierte Risiken 
                    von <strong className="text-foreground">nicht pasteurisierter</strong> Milch gemäß den Bewertungen 
                    des Bundesinstituts für Risikobewertung (BfR) und des Robert Koch-Instituts (RKI). 
                    Sie stellen keine Bewertung der Milchwirtschaft oder pasteurisierter Standardprodukte dar.</em>
                  </p>
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
                  <p className="text-xs text-muted-foreground text-center">Quellen: BfR 2024/2025 [10, 11], RKI Campylobacter-Ratgeber</p>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 11: Pasteurisierung ═══ */}
              <SlideWrapper slideNumber={11} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    Pasteurisierung – Verfahren &amp; Produktsicherheit
                  </h2>
                  <p className="text-center text-xs text-muted-foreground max-w-3xl mx-auto">
                    <em>Die Pasteurisierung ist ein bewährtes, gesetzlich vorgeschriebenes Verfahren 
                    zur Gewährleistung der Lebensmittelsicherheit. Die überwiegende Mehrheit der im deutschen 
                    Handel erhältlichen Milchprodukte ist pasteurisiert und gilt als mikrobiologisch sicher.</em>
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

              {/* ═══ SLIDE 12: Latente Infektionen ═══ */}
              <SlideWrapper slideNumber={12} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <Microscope className="mb-1 mr-2 inline-block h-6 w-6 text-destructive" />
                    Latente &amp; persistierende Infektionen
                  </h2>
                  <p className="text-center text-xs text-muted-foreground max-w-3xl mx-auto">
                    <em>Viele milchrelevante Erreger können intrazellulär persistieren und chronische, schwer 
                    zuordenbare Beschwerden verursachen. Dies betrifft primär Expositionen mit 
                    <strong className="text-foreground"> nicht pasteurisierten</strong> Produkten.</em>
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Salmonella enterica</h3>
                      <p className="text-xs text-muted-foreground">Überlebt intrazellulär in Makrophagen (SCVs), persistiert in Gallenblase. Chronische Symptome: Unspezifische Bauchbeschwerden, reaktive Arthritis, chronische Müdigkeit, Dauerausscheidertum [12].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Campylobacter jejuni</h3>
                      <p className="text-xs text-muted-foreground">Molekulare Mimikry (LOS ≈ Ganglioside) → Autoimmun. 9–13 % entwickeln Reizdarmsyndrom, ~1:1.000 Guillain-Barré-Syndrom [13].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> Listeria monocytogenes</h3>
                      <p className="text-xs text-muted-foreground">Intrazellulärer Parasit (Listeriolysin O). Langzeitfolgen: Progressive kognitive Beeinträchtigung, Immundysregulation [14].</p>
                    </div>
                    <div className="rounded-xl border border-destructive/20 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-4 w-4 text-destructive" /> EHEC / STEC</h3>
                      <p className="text-xs text-muted-foreground">Shiga-Toxin → mikrovaskuläre Schäden. 10-J.-Follow-up: 25 % HUS-Überlebende mit Nierenauffälligkeiten, Hypertonie [15].</p>
                    </div>
                  </div>
                  <Card className="bg-accent/5 border-accent/20">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      <strong className="text-foreground">Einordnung:</strong> Latente Infektionen betreffen primär den Konsum <em>nicht pasteurisierter</em> Milchprodukte. Die industrielle Pasteurisierung eliminiert die beschriebenen Erreger zuverlässig. Die Darstellung dient der wissenschaftlichen Aufklärung über wenig bekannte Langzeitrisiken.
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 13: Risikogruppen ═══ */}
              <SlideWrapper slideNumber={13} totalSlides={totalSlides}>
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
                        konsequent auf Rohmilch und Rohmilchprodukte verzichten [10, 11].
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

              {/* ═══ SLIDE 14: Quellen & Disclaimer ═══ */}
              <SlideWrapper slideNumber={14} totalSlides={totalSlides}>
                <div className="p-6 md:p-10 space-y-6">
                  <h2 className="text-center font-serif text-2xl font-semibold text-foreground">
                    <BookOpen className="mb-1 mr-2 inline-block h-6 w-6 text-primary" />
                    Quellenverzeichnis &amp; rechtliche Hinweise
                  </h2>

                  {/* Rechtlicher Disclaimer */}
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
                        Für die Richtigkeit und Vollständigkeit wird keine Gewähr übernommen.
                      </p>
                      <p>
                        <strong className="text-foreground">Quellen &amp; Transparenz:</strong> Weitere Informationen 
                        zur Herkunft und Einordnung der bereitgestellten Inhalte finden Sie unter{" "}
                        <a href="/quellenhinweis" className="text-primary underline">Quellenhinweis &amp; Haftungsausschluss</a>.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Quellen */}
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

          {/* Bottom navigation */}
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

export default MilchUnvertraeglichkeit;
