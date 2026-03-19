import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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
    color: "destructive" as const,
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
    color: "secondary" as const,
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
    beschreibung: "Physiologischer Rückgang der Laktase-Produktion nach dem Abstillen. Genetisch durch LCT-Gen (Chromosom 2) gesteuert. Der Polymorphismus C/T-13910 bestimmt, ob die Laktase-Aktivität im Erwachsenenalter erhalten bleibt (Laktase-Persistenz) oder abnimmt.",
    icon: Brain,
  },
  {
    typ: "Sekundär (erworben)",
    haeufigkeit: "Variabel",
    beschreibung: "Durch Schädigung der Dünndarmschleimhaut: Zöliakie, Morbus Crohn, Infektionen, Chemotherapie, Antibiotika. Kann reversibel sein, wenn die Grunderkrankung behandelt wird.",
    icon: Heart,
  },
  {
    typ: "Kongenital (angeboren)",
    haeufigkeit: "Extrem selten (<100 Fälle weltweit)",
    beschreibung: "Vollständiges Fehlen der Laktase ab Geburt. Autosomal-rezessiv vererbt. Säugling kann keine Muttermilch vertragen – sofortige laktosefreie Ernährung nötig.",
    icon: Baby,
  },
];

/* ─── Sahne & Butter ─── */
const sahneButterData = [
  {
    produkt: "Butter",
    laktose: "~0,6–0,7 g / 100 g",
    protein: "~0,7 g / 100 g",
    laktoseRisiko: "Sehr gering",
    allergieRisiko: "Gering (Spuren von Kasein/Molke)",
    details: "Butter besteht zu ~82 % aus Milchfett. Durch das Buttern wird die Molke weitgehend entfernt. Für die meisten Laktoseintoleranten ist Butter in üblichen Mengen verträglich. Bei schwerer Milchproteinallergie können die verbleibenden Proteinspuren (~0,7 g/100 g) dennoch eine Reaktion auslösen.",
    icon: CheckCircle,
    farbe: "text-primary",
  },
  {
    produkt: "Ghee (Butterschmalz)",
    laktose: "~0 g",
    protein: "~0 g",
    laktoseRisiko: "Praktisch null",
    allergieRisiko: "Praktisch null",
    details: "Durch langes Erhitzen und Filtrieren werden Laktose, Kasein und Molkenproteine nahezu vollständig entfernt. Ghee gilt als sicher für die meisten Betroffenen beider Erkrankungen.",
    icon: CheckCircle,
    farbe: "text-primary",
  },
  {
    produkt: "Sahne (Schlagsahne 30 %)",
    laktose: "~3,1 g / 100 g",
    protein: "~2,4 g / 100 g",
    laktoseRisiko: "Moderat",
    allergieRisiko: "Hoch (enthält Kasein + Molkenproteine)",
    details: "Sahne enthält weniger Laktose als Milch (~4,7 g/100 g), aber immer noch genug, um bei empfindlichen Personen Symptome auszulösen. Der Proteingehalt ist ebenfalls relevant – Sahne ist NICHT sicher bei Milchproteinallergie.",
    icon: AlertTriangle,
    farbe: "text-accent",
  },
  {
    produkt: "Crème fraîche / Schmand",
    laktose: "~2,5–3,5 g / 100 g",
    protein: "~2,5–3 g / 100 g",
    laktoseRisiko: "Moderat",
    allergieRisiko: "Hoch",
    details: "Ähnlich wie Sahne. Die bakterielle Fermentation bei Crème fraîche baut etwas Laktose ab, aber nicht ausreichend für empfindliche Personen. Alle Milchproteine bleiben erhalten.",
    icon: AlertTriangle,
    farbe: "text-accent",
  },
  {
    produkt: "Hartkäse (Parmesan, Emmentaler)",
    laktose: "<0,1 g / 100 g",
    protein: "~25–35 g / 100 g",
    laktoseRisiko: "Sehr gering",
    allergieRisiko: "Sehr hoch (konzentriertes Kasein)",
    details: "Durch die lange Reifung wird Laktose fast vollständig abgebaut. Hartkäse wird von den meisten Laktoseintoleranten gut vertragen. Bei Milchproteinallergie ist er jedoch NICHT geeignet, da Kasein hoch konzentriert ist.",
    icon: CircleAlert,
    farbe: "text-accent",
  },
];

/* ─── Ausweichprodukte ─── */
const alternativProdukte = [
  {
    kategorie: "Pflanzenmilch",
    icon: Milk,
    produkte: [
      { name: "Haferdrink", ca_mg: "~120 (angereichert)", hinweis: "Cremig, mild. Beliebteste Alternative in Deutschland. Auf Calciumanreicherung achten." },
      { name: "Sojadrink", ca_mg: "~120 (angereichert)", hinweis: "Proteinreich (~3,5 g/100 ml). Am nährstoffreichsten unter den Alternativen." },
      { name: "Mandeldrink", ca_mg: "~120 (angereichert)", hinweis: "Kalorienarm, nussig. Proteinarm (~0,5 g/100 ml)." },
      { name: "Reisdrink", ca_mg: "~120 (angereichert)", hinweis: "Allergenarm, sehr mild. Enthält kaum Protein. Nicht für Säuglinge (Arsengehalt)." },
      { name: "Kokosdrink", ca_mg: "~10 (natürlich)", hinweis: "Geringe Nährstoffdichte. Gut zum Kochen, weniger als Milchersatz." },
    ],
  },
  {
    kategorie: "Pflanzliche Sahne & Butter",
    icon: Leaf,
    produkte: [
      { name: "Hafersahne", ca_mg: "Variabel", hinweis: "Gut aufschäumbar. Für Soßen und Suppen geeignet." },
      { name: "Sojasahne", ca_mg: "Variabel", hinweis: "Hitzebeständig, gut zum Kochen. Proteinreich." },
      { name: "Pflanzliche Margarine", ca_mg: "Variabel", hinweis: "Auf milchfreie Varianten achten – viele enthalten Molke!" },
    ],
  },
  {
    kategorie: "Calciumreiche Lebensmittel (natürlich)",
    icon: Apple,
    produkte: [
      { name: "Sesam / Tahin", ca_mg: "~780 mg/100 g", hinweis: "Außergewöhnlich calciumreich. 2 EL Tahin ≈ 1 Glas Milch." },
      { name: "Grünkohl", ca_mg: "~210 mg/100 g", hinweis: "Hohe Bioverfügbarkeit (~60 %), da oxalatarm." },
      { name: "Brokkoli", ca_mg: "~60 mg/100 g", hinweis: "Bioverfügbarkeit ~50 %. Gute tägliche Calciumquelle." },
      { name: "Mandeln", ca_mg: "~265 mg/100 g", hinweis: "Zusätzlich Magnesium und Vitamin E." },
      { name: "Mineralwasser", ca_mg: "bis 600 mg/L", hinweis: "Calciumreiche Mineralwässer (>150 mg/L) als einfache Quelle." },
      { name: "Sardinen (mit Gräten)", ca_mg: "~380 mg/100 g", hinweis: "Exzellente Quelle mit gleichzeitig Vitamin D." },
    ],
  },
];

/* ─── Calcium-Phosphor-Kontroverse ─── */
const calciumPhosphorArgumente = {
  pro: {
    title: "Traditionelle Sichtweise: „Milch stärkt die Knochen"",
    punkte: [
      "Kuhmilch enthält ~120 mg Calcium/100 ml – eine der konzentriertesten Quellen",
      "Calcium-Bioverfügbarkeit aus Milch ist mit ~30–35 % relativ gut",
      "Die Deutsche Gesellschaft für Ernährung (DGE) empfiehlt Milch als Calciumquelle [16]",
      "Metaanalysen zeigen einen positiven Effekt auf die Knochendichte bei Kindern (Huncharek et al. 2008) [14]",
    ],
  },
  contra: {
    title: "Kritische Wissenschaft: „Das Calcium-Phosphor-Paradoxon"",
    punkte: [
      "Milch enthält ~90 mg Phosphor/100 ml – das Ca:P-Verhältnis liegt bei ~1,3:1",
      "Hoher Phosphorgehalt kann die renale Calciumausscheidung steigern (Kemi et al. 2006) [12]",
      "Milchprotein (v.a. Kasein) erhöht die Säurelast → Calcium wird als Puffer aus Knochen mobilisiert (Frassetto et al. 2000) [13]",
      "Die Harvard Nurses' Health Study (77.761 Frauen, 12 Jahre) fand KEINEN Schutzeffekt von Milch vor Hüftfrakturen (Feskanich et al. 1997) [10]",
      "Länder mit höchstem Milchkonsum (Skandinavien) haben paradoxerweise die höchsten Osteoporose-Raten (Michaëlsson et al. 2014, BMJ) [11]",
      "Galaktose (Spaltprodukt der Laktose) steht im Verdacht, oxidativen Stress und chronische Entzündung zu fördern [11]",
    ],
  },
  fazit: "Die aktuelle Studienlage ist widersprüchlich. Sicher ist: Calcium allein reicht für die Knochengesundheit nicht aus – Vitamin D, Vitamin K₂, Magnesium, Bewegung und ein ausgeglichener Säure-Basen-Haushalt sind ebenso entscheidend. Die Empfehlung, Milch als primäre Calciumquelle zu betrachten, wird zunehmend hinterfragt.",
};

/* ─── Quellen ─── */
const quellen = [
  { nr: 1, text: "Mattar R, de Campos Mazo DF, Carrilho FJ. Lactose intolerance: diagnosis, genetic and clinical factors. Clin Exp Gastroenterol. 2012;5:113-121." },
  { nr: 2, text: "Deng Y, Misselwitz B, Dai N, Fox M. Lactose Intolerance in Adults: Biological Mechanism and Dietary Management. Nutrients. 2015;7(9):8020-8035." },
  { nr: 3, text: "Wal JM. Cow's milk proteins/allergens. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):3-10." },
  { nr: 4, text: "Host A. Frequency of cow's milk allergy in childhood. Ann Allergy Asthma Immunol. 2002;89(6 Suppl 1):33-37." },
  { nr: 5, text: "Enattah NS et al. Identification of a variant associated with adult-type hypolactasia. Nat Genet. 2002;30(2):233-237." },
  { nr: 6, text: "Koletzko S et al. Leitlinie Kuhmilchproteinallergie (S2k). AWMF-Register Nr. 061/010, 2021." },
  { nr: 7, text: "Wikipedia: Laktoseintoleranz. https://de.wikipedia.org/wiki/Laktoseintoleranz (abgerufen März 2026)." },
  { nr: 8, text: "AMBOSS: Lactoseintoleranz. https://www.amboss.com/de/wissen/lactoseintoleranz (abgerufen März 2026)." },
  { nr: 9, text: "Roth-Walter F et al. Cow's milk protein β-lactoglobulin prevents allergy development via immune modulation. J Allergy Clin Immunol. 2021;147(3):1024-1032." },
  { nr: 10, text: "Feskanich D, Willett WC, Stampfer MJ, Colditz GA. Milk, dietary calcium, and bone fractures in women: a 12-year prospective study. Am J Public Health. 1997;87(6):992-997." },
  { nr: 11, text: "Michaëlsson K et al. Milk intake and risk of mortality and fractures in women and men: cohort studies. BMJ. 2014;349:g6015." },
  { nr: 12, text: "Kemi VE et al. High phosphorus intakes acutely and negatively affect Ca and bone metabolism in a dose-dependent manner in healthy young females. Br J Nutr. 2006;96(3):545-552." },
  { nr: 13, text: "Frassetto LA et al. Worldwide incidence of hip fracture in elderly women: relation to consumption of animal and vegetable foods. J Gerontol A Biol Sci Med Sci. 2000;55(10):M585-M592." },
  { nr: 14, text: "Huncharek M, Muscat J, Kupelnick B. Impact of dairy products and dietary calcium on bone-mineral content in children: results of a meta-analysis. Bone. 2008;43(2):312-321." },
  { nr: 15, text: "Weaver CM et al. Calcium plus vitamin D supplementation and risk of fractures. Osteoporos Int. 2016;27(1):367-376." },
  { nr: 16, text: "DGE (Deutsche Gesellschaft für Ernährung). Referenzwerte Calcium. https://www.dge.de/wissenschaft/referenzwerte/calcium/ (abgerufen März 2026)." },
];

const MilchUnvertraeglichkeit = () => {
  return (
    <Layout>
      {/* Hero */}
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <Microscope className="mr-1.5 h-3.5 w-3.5" />
              Patienteninformation
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Milchprotein-Allergie &amp; Laktose&shy;intoleranz
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Zwei völlig unterschiedliche Erkrankungen – oft verwechselt.
              Hier erfahren Sie die wissenschaftlichen Hintergründe, Symptome und Häufigkeiten in Deutschland.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-5xl space-y-16">

          {/* ═══════════════ Überblick: Allergie vs Intoleranz ═══════════════ */}
          <section>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Allergie vs. Intoleranz – Der entscheidende Unterschied
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Allergie */}
              <Card className="border-destructive/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                      <Shield className="h-5 w-5 text-destructive" />
                    </div>
                    Milchprotein-Allergie
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground">Mechanismus:</strong> Das <em>Immunsystem</em> stuft
                    Milchproteine (v.a. Kasein, β-Laktoglobulin) fälschlich als Bedrohung ein und bildet
                    IgE-Antikörper oder aktiviert T-Zellen.
                  </p>
                  <p>
                    <strong className="text-foreground">Reaktionstyp:</strong> IgE-vermittelt (Soforttyp, Typ I)
                    oder nicht-IgE-vermittelt (verzögert, Typ IV). Bereits <strong>kleinste Mengen</strong> können
                    eine Reaktion auslösen.
                  </p>
                  <p>
                    <strong className="text-foreground">Betrifft:</strong> Vor allem Säuglinge und Kleinkinder
                    (2–3 %). Ca. 80 % der Betroffenen entwickeln bis zum Schulalter eine Toleranz.
                  </p>
                  <div className="rounded-lg bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <CircleAlert className="h-4 w-4" />
                      Kann lebensbedrohlich sein (Anaphylaxie)!
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Intoleranz */}
              <Card className="border-primary/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    Laktoseintoleranz
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground">Mechanismus:</strong> Mangel oder Fehlen des Enzyms
                    <em> Laktase</em> im Dünndarm. Laktose (Milchzucker) wird nicht gespalten, gelangt
                    unverändert in den Dickdarm und wird dort von Bakterien fermentiert → Gase (H₂, CO₂, CH₄).
                  </p>
                  <p>
                    <strong className="text-foreground">Reaktionstyp:</strong> <strong>Keine</strong> Immunreaktion.
                    Rein enzymatischer Defekt. Die Schwere hängt von der <em>Restaktivität</em> der Laktase
                    und der aufgenommenen Menge ab.
                  </p>
                  <p>
                    <strong className="text-foreground">Betrifft:</strong> ~15–20 % der deutschen Bevölkerung
                    (primäre Form). Weltweit sind ~68 % betroffen – Laktase-Persistenz ist die Ausnahme.
                  </p>
                  <div className="rounded-lg bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Unangenehm, aber nicht gefährlich
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ═══════════════ Warum macht Milchprotein Probleme? ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Die Milchproteine – Warum reagiert der Körper?
            </h2>
            <p className="mb-8 text-center text-muted-foreground">
              Kuhmilch enthält über 25 verschiedene Proteine, von denen mehrere als Allergene wirken können.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {milchProteine.map((p) => (
                <Card key={p.name} className="shadow-card transition-shadow hover:shadow-elevated">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                        <p.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-medium text-foreground">{p.name}</h3>
                        <span className="text-xs text-muted-foreground">{p.anteil}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.problem}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Laktose-Mechanismus ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Laktose &amp; Laktase – Der enzymatische Weg
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Laktose (C₁₂H₂₂O₁₁) ist ein Disaccharid aus Glukose und Galaktose. 
              Das Enzym Laktase (β-Galactosidase) spaltet sie im Dünndarm.
            </p>

            {/* Schematische Darstellung */}
            <Card className="mb-8 overflow-hidden shadow-card">
              <CardContent className="p-0">
                <div className="bg-sage-50 p-6 md:p-8">
                  <h3 className="mb-6 text-center font-serif text-lg font-medium text-foreground">
                    Verdauungsweg – Normal vs. Laktasemangel
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Normal */}
                    <div className="rounded-xl border border-primary/20 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">Laktase vorhanden</span>
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">1</div>
                          <span>Laktose gelangt in den <strong className="text-foreground">Dünndarm</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">2</div>
                          <span><strong className="text-foreground">Laktase</strong> spaltet → Glukose + Galaktose</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</div>
                          <span>Einfachzucker werden <strong className="text-foreground">resorbiert</strong> → Energie</span>
                        </div>
                      </div>
                    </div>
                    {/* Mangel */}
                    <div className="rounded-xl border border-accent/30 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-accent" />
                        <span className="font-medium text-foreground">Laktasemangel</span>
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">1</div>
                          <span>Laktose gelangt in den <strong className="text-foreground">Dünndarm</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">2</div>
                          <span>Laktase fehlt/vermindert → <strong className="text-foreground">keine Spaltung</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">3</div>
                          <span>Laktose gelangt in den <strong className="text-foreground">Dickdarm</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-bold text-destructive">4</div>
                          <span>Bakterien fermentieren → <strong className="text-foreground">H₂, CO₂, CH₄, kurzkettige FS</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-bold text-destructive">5</div>
                          <span>Osmotischer Wassereinstrom → <strong className="text-foreground">Durchfall, Blähungen, Krämpfe</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══════════════ Formen der Laktoseintoleranz ═══════════════ */}
          <section>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Drei Formen der Laktoseintoleranz
            </h2>
            <div className="grid gap-5 md:grid-cols-3">
              {laktoseFormen.map((form) => (
                <Card key={form.typ} className="shadow-card">
                  <CardContent className="p-5">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                      <form.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-1 font-serif text-lg font-medium text-foreground">{form.typ}</h3>
                    <Badge variant="outline" className="mb-3 text-xs">{form.haeufigkeit}</Badge>
                    <p className="text-sm text-muted-foreground leading-relaxed">{form.beschreibung}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Symptom-Vergleich ═══════════════ */}
          <section>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Symptom-Vergleich
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {Object.values(symptomVergleich).map((cat) => (
                <Card key={cat.title} className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-base">{cat.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">Onset: {cat.zeitraum}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {cat.symptome.map((s) => (
                        <div key={s.bereich} className="rounded-lg bg-muted/50 p-3">
                          <div className="mb-1 text-sm font-medium text-foreground">{s.bereich}</div>
                          <div className="text-xs text-muted-foreground leading-relaxed">{s.details}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Prävalenz-Tabelle ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Users className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Häufigkeit im Vergleich
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Prävalenz von Laktoseintoleranz und Milchproteinallergie nach Region
            </p>
            <Card className="overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-sage-50">
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">Region</th>
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">
                        <Droplets className="mr-1.5 inline h-4 w-4 text-primary" />
                        Laktoseintoleranz
                      </th>
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">
                        <Shield className="mr-1.5 inline h-4 w-4 text-destructive" />
                        Milchproteinallergie
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {prevalenceData.map((row, i) => (
                      <tr
                        key={row.region}
                        className={`border-b last:border-0 ${i === 0 ? "bg-primary/5 font-medium" : ""}`}
                      >
                        <td className="px-5 py-3 text-foreground">{row.region}</td>
                        <td className="px-5 py-3 text-muted-foreground">{row.laktose}</td>
                        <td className="px-5 py-3 text-muted-foreground">{row.protein}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Quellen: Mattar et al. 2012, Deng et al. 2015, Host 2002 [1,2,4]
            </p>
          </section>

          {/* ═══════════════ Visuelle Statistik – Deutschland ═══════════════ */}
          <section>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <TrendingUp className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Deutschland im Fokus
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Laktoseintolerant", value: "15–20 %", sub: "~12–16 Mio. Menschen", color: "bg-primary" },
                { label: "Milchproteinallergie (Kinder)", value: "2–3 %", sub: "unter 3 Jahren", color: "bg-accent" },
                { label: "Toleranzentwicklung", value: "~80 %", sub: "bis zum 6. Lebensjahr", color: "bg-primary" },
                { label: "Laktase-Persistenz", value: "~80 %", sub: "in Nordeuropa (Genmutation)", color: "bg-sage-500" },
              ].map((stat) => (
                <Card key={stat.label} className="shadow-card text-center">
                  <CardContent className="p-5">
                    <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${stat.color}/10`}>
                      <span className={`text-xl font-bold ${stat.color === "bg-accent" ? "text-accent" : "text-primary"}`}>
                        {stat.value}
                      </span>
                    </div>
                    <h3 className="mb-1 text-sm font-medium text-foreground">{stat.label}</h3>
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Genetik / Laktase-Persistenz ═══════════════ */}
          <section>
            <Card className="shadow-card overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="bg-sage-50 p-6 md:p-8">
                  <Badge variant="outline" className="mb-3 border-primary/30 text-primary text-xs">Genetik</Badge>
                  <h3 className="mb-3 font-serif text-xl font-semibold text-foreground">
                    Das LCT-Gen &amp; Laktase-Persistenz
                  </h3>
                  <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                    <p>
                      Alle Säugetiere verlieren nach dem Abstillen ihre Laktase-Aktivität – 
                      das ist der <strong className="text-foreground">biologische Normalzustand</strong>.
                    </p>
                    <p>
                      Vor ca. 7.500 Jahren entwickelte sich in Nordeuropa eine Mutation im 
                      <strong className="text-foreground"> MCM6-Gen</strong> (Regulatorregion des LCT-Gens, 
                      Polymorphismus <code className="rounded bg-background px-1.5 py-0.5 text-xs font-mono">C/T-13910</code>), 
                      die den Laktase-Abbau verhindert.
                    </p>
                    <p>
                      Diese <em>Laktase-Persistenz</em> setzte sich in Bevölkerungen mit Milchvieh-Haltung 
                      durch natürliche Selektion durch – ein Paradebeispiel der <strong className="text-foreground">
                      Gen-Kultur-Koevolution</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center p-6 md:p-8">
                  <div className="w-full space-y-4">
                    <h4 className="text-center font-serif text-sm font-medium text-foreground">
                      Laktase-Aktivität nach Alter
                    </h4>
                    {[
                      { alter: "Säugling", pct: 100, label: "100 %" },
                      { alter: "5 Jahre", pct: 85, label: "~85 %" },
                      { alter: "10 Jahre (mit Persistenz)", pct: 80, label: "~80 %" },
                      { alter: "10 Jahre (ohne Persistenz)", pct: 25, label: "~25 %" },
                      { alter: "Erwachsener (ohne P.)", pct: 8, label: "5–10 %" },
                    ].map((bar) => (
                      <div key={bar.alter} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{bar.alter}</span>
                          <span className="font-medium text-foreground">{bar.label}</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${bar.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* ═══════════════ Diagnostik ═══════════════ */}
          <section>
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              Diagnostik
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base">Laktoseintoleranz</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {[
                      "H₂-Atemtest (Goldstandard bei Erwachsenen)",
                      "Gentest (LCT-13910 C/T Polymorphismus)",
                      "Laktose-Belastungstest (Blutzuckermessung)",
                      "Dünndarmbiopsie (Laktase-Aktivität im Gewebe)",
                      "Eliminationsdiät mit Provokation",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base">Milchproteinallergie</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {[
                      "Prick-Test (Hauttest mit Milchprotein-Extrakt)",
                      "Spezifisches IgE im Blut (RAST / ImmunoCAP)",
                      "Atopy-Patch-Test (nicht-IgE-vermittelte Formen)",
                      "Doppelblind placebokontrollierte Provokation (DBPCFC)",
                      "Eliminationsdiät (2–4 Wochen) mit anschließender Provokation",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ═══════════════ Rechtlicher Disclaimer ═══════════════ */}
          <Card className="border-accent/30 bg-accent/5 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <h3 className="font-serif text-lg font-medium text-foreground">
                    Wichtige Hinweise
                  </h3>
                  <p>
                    <strong>Heilmittelwerbegesetz (HWG):</strong> Diese Informationen dienen der allgemeinen 
                    Aufklärung und stellen kein Heilversprechen dar. Die beschriebenen Zusammenhänge können 
                    individuelle Diagnostik und Therapie nicht ersetzen.
                  </p>
                  <p>
                    <strong>Fachliche Beratung:</strong> Bei Verdacht auf eine Milchprotein-Allergie oder 
                    Laktoseintoleranz sollte stets eine fachärztliche Abklärung erfolgen. 
                    In der <strong className="text-foreground">Naturheilpraxis Peter Rauch</strong> besprechen 
                    wir Ihre individuelle Situation gerne persönlich.
                  </p>
                  <p>
                    <strong>Haftungsausschluss gem. § 630a ff. BGB:</strong> Die eigenständige Anwendung der 
                    hier dargestellten Informationen ohne fachliche Begleitung erfolgt auf eigenes Risiko.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ Quellenverzeichnis ═══════════════ */}
          <section>
            <h2 className="mb-4 font-serif text-xl font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Quellenverzeichnis
            </h2>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <ol className="space-y-2 text-xs text-muted-foreground leading-relaxed list-none">
                  {quellen.map((q) => (
                    <li key={q.nr} className="flex gap-2">
                      <span className="shrink-0 font-mono font-medium text-foreground">[{q.nr}]</span>
                      <span>{q.text}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default MilchUnvertraeglichkeit;
