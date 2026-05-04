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
  TrendingUp,
  BookOpen,
  Microscope,
  Activity,
  CircleAlert,
  CheckCircle,
  XCircle,
  Milk,
  Leaf,
  Scale,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useContentProtection } from "@/hooks/useContentProtection";

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

/* ─── Quellen ─── */
const quellen = [
  { nr: 1, text: "Mattar R et al. Lactose intolerance. Clin Exp Gastroenterol. 2012;5:113-121." },
  { nr: 2, text: "Deng Y et al. Lactose Intolerance in Adults. Nutrients. 2015;7(9):8020-8035." },
  { nr: 3, text: "Wal JM. Cow's milk proteins/allergens. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):3-10." },
  { nr: 4, text: "Host A. Frequency of cow's milk allergy in childhood. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):33-37." },
  { nr: 5, text: "Enattah NS et al. Variant associated with adult-type hypolactasia. Nat Genet. 2002;30(2):233-237." },
  { nr: 6, text: "Koletzko S et al. Leitlinie Kuhmilchproteinallergie (S2k). AWMF 061/010, 2021." },
  { nr: 7, text: "DGE. Referenzwerte Calcium. dge.de (März 2026)." },
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
  useContentProtection();
  const totalSlides = 9;
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
                      <p><strong className="text-foreground">Wichtig:</strong> Bei vollständiger Milchmeidung auf ausreichende Calciumzufuhr achten (DGE-Empfehlung: 1.000 mg/Tag für Erwachsene) [7]. Pflanzliche Alternativen sollten mit Calcium angereichert sein.</p>
                    </CardContent>
                  </Card>
                </div>
              </SlideWrapper>

              {/* ═══ SLIDE 7: Häufigkeit weltweit ═══ */}
              <SlideWrapper slideNumber={7} totalSlides={totalSlides}>
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

              {/* ═══ SLIDE 8: Diagnostik ═══ */}
              <SlideWrapper slideNumber={8} totalSlides={totalSlides}>
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

              {/* ═══ SLIDE 9: Quellen & Disclaimer ═══ */}
              <SlideWrapper slideNumber={9} totalSlides={totalSlides}>
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
                        Für die Richtigkeit und Vollständigkeit wird keine Gewähr übernommen.
                      </p>
                      <p>
                        <strong className="text-foreground">Quellen &amp; Transparenz:</strong> Weitere Informationen 
                        zur Herkunft und Einordnung der bereitgestellten Inhalte finden Sie unter{" "}
                        <a href="/quellenhinweis" className="text-primary underline">Quellenhinweis &amp; Haftungsausschluss</a>.
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

export default MilchUnvertraeglichkeit;
