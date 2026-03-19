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
    title: 'Traditionelle Sichtweise: „Milch stärkt die Knochen"',
    punkte: [
      "Kuhmilch enthält ~120 mg Calcium/100 ml – eine der konzentriertesten Quellen",
      "Calcium-Bioverfügbarkeit aus Milch ist mit ~30–35 % relativ gut",
      "Die Deutsche Gesellschaft für Ernährung (DGE) empfiehlt Milch als Calciumquelle [16]",
      "Metaanalysen zeigen einen positiven Effekt auf die Knochendichte bei Kindern (Huncharek et al. 2008) [14]",
    ],
  },
  contra: {
    title: 'Kritische Wissenschaft: „Das Calcium-Phosphor-Paradoxon"',
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

/* ─── Pathogene in Milch ─── */
const pathogeneData = [
  {
    keim: "Campylobacter jejuni",
    infektionsdosis: "500–800 KbE",
    symptome: "Wässriger bis blutiger Durchfall, Fieber, Krämpfe, Erbrechen. Komplikationen: Guillain-Barré-Syndrom, reaktive Arthritis",
    inkubation: "2–5 Tage",
    haeufigkeit: "~60.000–70.000 Fälle/Jahr in Deutschland (häufigste bakterielle Durchfallerkrankung, RKI)",
    hitze: "Abgetötet bei 72 °C / 15 Sek.",
    gefahr: "destructive" as const,
  },
  {
    keim: "Salmonella spp.",
    infektionsdosis: "10⁴–10⁶ KbE (bei Immunschwäche weniger)",
    symptome: "Akute Gastroenteritis: Durchfall, Erbrechen, Fieber, Bauchkrämpfe. Komplikation: Sepsis bei Immunsupprimierten",
    inkubation: "6–72 Stunden",
    haeufigkeit: "~13.000–15.000 Fälle/Jahr (RKI, IfSG-Meldedaten)",
    hitze: "Abgetötet bei 72 °C / 15 Sek.",
    gefahr: "destructive" as const,
  },
  {
    keim: "Listeria monocytogenes",
    infektionsdosis: "Variabel (immunabhängig)",
    symptome: "Fieber, Muskelschmerzen, Meningitis, Sepsis. Schwangere: Fehl-/Totgeburt, Neugeborenen-Sepsis. Letalität: 20–30 %!",
    inkubation: "3–70 Tage (!)",
    haeufigkeit: "~600–700 Fälle/Jahr (RKI), hohe Letalität",
    hitze: "Abgetötet bei 72 °C / 15 Sek.",
    gefahr: "destructive" as const,
  },
  {
    keim: "EHEC / STEC (E. coli)",
    infektionsdosis: "10–100 KbE (extrem niedrig!)",
    symptome: "Blutig-wässriger Durchfall, HUS (hämolytisch-urämisches Syndrom) → Nierenversagen, v.a. bei Kindern lebensbedrohlich",
    inkubation: "2–10 Tage",
    haeufigkeit: "~1.500–2.000 EHEC-Fälle/Jahr (RKI)",
    hitze: "Abgetötet bei 70 °C / 2 Min.",
    gefahr: "destructive" as const,
  },
  {
    keim: "Staphylococcus aureus (Enterotoxin)",
    infektionsdosis: "Toxin ab ~100 ng",
    symptome: "Heftiges Erbrechen, Durchfall, Bauchkrämpfe. Toxin ist hitzestabil – überlebt Pasteurisierung!",
    inkubation: "1–6 Stunden",
    haeufigkeit: "Untererfasst (keine Meldepflicht für S. aureus-Toxin)",
    hitze: "Bakterium bei 72 °C abgetötet, aber Enterotoxin überlebt bis 121 °C!",
    gefahr: "destructive" as const,
  },
  {
    keim: "Coxiella burnetii (Q-Fieber)",
    infektionsdosis: "1–10 Organismen",
    symptome: "Fieber, Kopfschmerzen, atypische Pneumonie, Hepatitis. Chronisch: Endokarditis",
    inkubation: "14–21 Tage",
    haeufigkeit: "~80–120 Fälle/Jahr (RKI)",
    hitze: "Referenzkeim für Pasteurisierung: 71,7 °C / 15 Sek. (HTST-Standard)",
    gefahr: "secondary" as const,
  },
  {
    keim: "Mycobacterium bovis (Rindertuberkulose)",
    infektionsdosis: "Variabel",
    symptome: "Tuberkulose (Lunge, Darm, Lymphknoten). Historisch häufigste durch Milch übertragene Erkrankung",
    inkubation: "Wochen bis Monate",
    haeufigkeit: "Sehr selten durch Milch in Deutschland (dank Pasteurisierung)",
    hitze: "Abgetötet bei 63 °C / 30 Min. oder 72 °C / 15 Sek.",
    gefahr: "secondary" as const,
  },
];

const pasteurisierungsVerfahren = [
  {
    verfahren: "Dauererhitzung (LTLT)",
    temperatur: "63 °C",
    dauer: "30 Minuten",
    anwendung: "Kleinstbetriebe, Hofkäsereien. Seltener in Großproduktion.",
  },
  {
    verfahren: "Kurzzeiterhitzung (HTST)",
    temperatur: "72–75 °C",
    dauer: "15–30 Sekunden",
    anwendung: "Standard für Frischmilch, Trinkmilch, Joghurt, Quark, Sahne – ca. 90 % der deutschen Trinkmilch.",
  },
  {
    verfahren: "Hocherhitzung (ESL)",
    temperatur: "85–127 °C",
    dauer: "1–4 Sekunden",
    anwendung: "ESL-Milch (\"länger frisch\"). Zunehmend im deutschen Handel.",
  },
  {
    verfahren: "Ultrahocherhitzung (UHT)",
    temperatur: "135–150 °C",
    dauer: "2–4 Sekunden",
    anwendung: "H-Milch. Keimfrei (steril). Monatelang ungekühlt haltbar.",
  },
];

const pasteurisierteProdukte = {
  ja: [
    { produkt: "Trinkmilch (Frischmilch)", verfahren: "HTST (72 °C / 15 Sek.)" },
    { produkt: "H-Milch", verfahren: "UHT (135–150 °C / 2–4 Sek.)" },
    { produkt: "ESL-Milch", verfahren: "Hocherhitzung (85–127 °C)" },
    { produkt: "Joghurt (Standard)", verfahren: "Milch vor Fermentation pasteurisiert" },
    { produkt: "Quark", verfahren: "Milch vor Säuerung pasteurisiert" },
    { produkt: "Sahne / Schlagsahne", verfahren: "HTST oder UHT" },
    { produkt: "Frischkäse (Philadelphia etc.)", verfahren: "Aus pasteurisierter Milch" },
    { produkt: "Butter (Standard)", verfahren: "Aus pasteurisierter Sahne (Süßrahm/Sauerrahm)" },
    { produkt: "Schmelzkäse", verfahren: "Durch Erhitzung beim Schmelzen (>80 °C)" },
    { produkt: "Kondensmilch", verfahren: "UHT oder Sterilisation" },
  ],
  nein: [
    { produkt: "Rohmilch (ab Hof / Milchtankstelle)", risiko: "Alle Pathogene möglich" },
    { produkt: "Vorzugsmilch", risiko: "Kontrolliert, aber NICHT pasteurisiert. Strenge Auflagen, aber Restrisiko" },
    { produkt: "Rohmilchkäse (Camembert de Normandie, Brie de Meaux, Roquefort, Appenzeller, Gruyère u.v.m.)", risiko: "Listerien, EHEC, Salmonellen. Besonders gefährlich für Schwangere!" },
    { produkt: "Mozzarella (aus Rohmilch, z.B. Büffelmozzarella)", risiko: "Listeriengefahr – auf Kennzeichnung achten" },
    { produkt: "Feta (traditionell aus Rohmilch)", risiko: "Listerien, Brucella (selten). EU-Ware meist pasteurisiert" },
    { produkt: "Weichkäse-Rinde (Schimmelrinde)", risiko: "Listerien bevorzugen feuchte Oberfläche von Weichkäse" },
    { produkt: "Rohmilch-Butter (selten, ab Hof)", risiko: "Gering, aber bei Allergie/Immunschwäche relevant" },
  ],
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
  { nr: 17, text: "BfR (Bundesinstitut für Risikobewertung). Erhitzen macht Milch zu einem sicheren Lebensmittel. Mitteilung Nr. 008/2025, 06.03.2025." },
  { nr: 18, text: "BfR. Infektionen vermeiden – Was ist beim Verzehr von Rohmilch zu beachten? Aktualisierte Bewertung, 06.09.2024." },
  { nr: 19, text: "Stingl K. Ausbruchsuntersuchungen zu Campylobacter in Rohmilch. BfR-Präsentation, 10.04.2019." },
  { nr: 20, text: "RKI. Campylobacter-Enteritis. RKI-Ratgeber, Stand 28.11.2019." },
  { nr: 21, text: "Rosner B et al. A combined case-control and molecular source attribution study of human Campylobacter infections in Germany, 2011–2014. Sci Rep. 2017;7:5139." },
  { nr: 22, text: "LAVES Niedersachsen. Rohmilch – ein unterschätztes Risiko? https://www.laves.niedersachsen.de/ (abgerufen März 2026)." },
  { nr: 23, text: "Rabbani A et al. Effect of Heat Pasteurization and Sterilization on Milk Safety, Composition, Sensory Properties, and Nutritional Quality. Foods. 2025;14(8):1342." },
  { nr: 24, text: "Cerf O, Condron R. Coxiella burnetii and milk pasteurization: an early application of the precautionary principle? Epidemiol Infect. 2006;134(5):946-951." },
  { nr: 25, text: "BVL/RKI. Gemeinsamer nationaler Bericht zu lebensmittelbedingten Krankheitsausbrüchen in Deutschland, 2015." },
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

          {/* ═══════════════ Detaillierte Symptome ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Activity className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Symptome im Detail
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Warum treten diese Symptome auf? Die Mechanismen hinter den Beschwerden.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Allergie-Symptome erklärt */}
              <Card className="border-destructive/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                      <Shield className="h-5 w-5 text-destructive" />
                    </div>
                    Allergie-Symptome &amp; ihre Ursachen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <div className="rounded-lg bg-destructive/5 p-4 space-y-3">
                    <div>
                      <strong className="text-foreground">Haut (Nesselsucht, Ekzem, Juckreiz):</strong>
                      <p>IgE-Antikörper aktivieren Mastzellen → Histaminfreisetzung → Gefäßerweiterung, Schwellung, Rötung und Juckreiz der Haut.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Atemwege (Asthma, Rhinitis, Kehlkopfschwellung):</strong>
                      <p>Histamin und Leukotriene verursachen Bronchospasmus und Schleimhautschwellung. Bei schweren Fällen droht Atemwegsobstruktion.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Magen-Darm (Erbrechen, Durchfall, Blut im Stuhl):</strong>
                      <p>Entzündungsreaktion der Darmschleimhaut durch Immunzellen. Bei nicht-IgE-vermittelter Allergie: T-Zell-vermittelte verzögerte Entzündung → eosinophile Infiltration.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Anaphylaxie (lebensbedrohlich!):</strong>
                      <p>Massive, systemische Histaminfreisetzung → Blutdruckabfall, Kreislaufschock, Bewusstlosigkeit. Sofortmaßnahme: Adrenalin-Autoinjektor!</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-destructive/20 p-3">
                    <p className="text-xs">
                      <strong className="text-destructive">Wichtig:</strong> Bereits Spuren von Milchprotein (z.B. in Medikamenten, Wurstwaren, Backwaren) 
                      können bei sensibilisierten Personen eine Reaktion auslösen. Vollständige Meidung aller Milchprodukte ist bei echter Allergie erforderlich.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Intoleranz-Symptome erklärt */}
              <Card className="border-primary/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    Intoleranz-Symptome &amp; ihre Ursachen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <div className="rounded-lg bg-primary/5 p-4 space-y-3">
                    <div>
                      <strong className="text-foreground">Blähungen &amp; Gasbildung:</strong>
                      <p>Unverdaute Laktose gelangt in den Dickdarm → Darmbakterien fermentieren sie zu H₂, CO₂ und CH₄ (Methan). Diese Gase dehnen den Darm → Schmerzen und hörbares Rumoren.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Durchfall (osmotisch):</strong>
                      <p>Laktose und kurzkettige Fettsäuren (Fermentationsprodukte) sind osmotisch aktiv → sie ziehen Wasser in den Darm → wässriger, oft säuerlich riechender Durchfall.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Bauchkrämpfe:</strong>
                      <p>Gasausdehnung und beschleunigte Peristaltik führen zu krampfartigen Schmerzen, oft im Unterbauch.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Übelkeit &amp; Kopfschmerzen:</strong>
                      <p>Toxische Gärungsprodukte und biogene Amine (Histamin) aus der bakteriellen Fermentation können systemische Beschwerden verursachen.</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 p-3">
                    <p className="text-xs">
                      <strong className="text-primary">Gut zu wissen:</strong> Die Symptomstärke ist dosisabhängig. Viele Betroffene vertragen 
                      kleine Mengen Laktose (z.B. 6–12 g, entspricht ~120–250 ml Milch) ohne Beschwerden. Joghurt wird oft besser vertragen, 
                      da die Bakterienkulturen eigene Laktase mitbringen.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ═══════════════ Sahne & Butter ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Milk className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Sahne, Butter &amp; Käse – Wie betroffen?
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Nicht alle Milchprodukte sind gleich problematisch. Laktose- und Proteingehalt variieren erheblich.
            </p>

            <div className="space-y-4">
              {sahneButterData.map((item) => (
                <Card key={item.produkt} className="shadow-card overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-[280px_1fr]">
                      <div className="bg-sage-50 p-5 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                          <item.icon className={`h-5 w-5 ${item.farbe}`} />
                          <h3 className="font-serif text-lg font-medium text-foreground">{item.produkt}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded bg-background p-2">
                            <span className="text-muted-foreground">Laktose:</span>
                            <div className="font-medium text-foreground">{item.laktose}</div>
                          </div>
                          <div className="rounded bg-background p-2">
                            <span className="text-muted-foreground">Protein:</span>
                            <div className="font-medium text-foreground">{item.protein}</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex flex-wrap gap-3 text-xs">
                          <Badge variant="outline" className="border-primary/30">
                            Laktose-Risiko: {item.laktoseRisiko}
                          </Badge>
                          <Badge variant="outline" className="border-destructive/30">
                            Allergie-Risiko: {item.allergieRisiko}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.details}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Ausweichprodukte ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Leaf className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Ausweichprodukte &amp; Alternativen
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Wer Milch meiden muss oder möchte, hat heute eine große Auswahl an Alternativen – 
              wichtig ist die Sicherstellung der Calciumzufuhr.
            </p>

            <div className="space-y-6">
              {alternativProdukte.map((gruppe) => (
                <Card key={gruppe.kategorie} className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 font-serif text-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100">
                        <gruppe.icon className="h-5 w-5 text-primary" />
                      </div>
                      {gruppe.kategorie}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-sage-50/50">
                            <th className="px-4 py-2 text-left font-medium text-foreground">Produkt</th>
                            <th className="px-4 py-2 text-left font-medium text-foreground">Calcium (mg)</th>
                            <th className="px-4 py-2 text-left font-medium text-foreground">Hinweis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gruppe.produkte.map((p) => (
                            <tr key={p.name} className="border-b last:border-0">
                              <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{p.name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{p.ca_mg}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{p.hinweis}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══════════════ Calcium-Phosphor-Kontroverse ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Bone className="mb-1 mr-2 inline-block h-7 w-7 text-primary" />
              Milch &amp; Knochengesundheit – Die Kontroverse
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Ist Milch wirklich gut für die Knochen? Die wissenschaftliche Debatte um Calcium, 
              Phosphor und Knochengesundheit.
            </p>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Pro */}
              <Card className="border-primary/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-base">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    {calciumPhosphorArgumente.pro.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {calciumPhosphorArgumente.pro.punkte.map((punkt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="leading-relaxed">{punkt}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Contra */}
              <Card className="border-accent/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-base">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <Ban className="h-5 w-5 text-accent" />
                    </div>
                    {calciumPhosphorArgumente.contra.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {calciumPhosphorArgumente.contra.punkte.map((punkt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="leading-relaxed">{punkt}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Mechanismus-Grafik */}
            <Card className="shadow-card overflow-hidden mb-6">
              <CardContent className="p-0">
                <div className="bg-sage-50 p-6 md:p-8">
                  <h3 className="mb-6 text-center font-serif text-lg font-medium text-foreground">
                    <Scale className="mb-1 mr-2 inline-block h-5 w-5 text-primary" />
                    Das Calcium-Phosphor-Paradoxon – Schematisch
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border border-primary/20 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">Optimale Ca-Aufnahme</span>
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">1</div>
                          <span>Calcium aus Nahrung (z.B. <strong className="text-foreground">Grünkohl, Sesam</strong>)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">2</div>
                          <span><strong className="text-foreground">Günstiges Ca:P-Verhältnis</strong> → keine Störung</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">3</div>
                          <span><strong className="text-foreground">Vitamin D + K₂</strong> fördern Einbau in Knochen</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">4</div>
                          <span>Ca wird in <strong className="text-foreground">Knochenmatrix eingebaut</strong> ✓</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-accent/30 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-accent" />
                        <span className="font-medium text-foreground">Gestörte Ca-Bilanz (Milch)</span>
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">1</div>
                          <span>Milch: Ca (~120 mg) + <strong className="text-foreground">Phosphor (~90 mg)</strong>/100 ml</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">2</div>
                          <span>Phosphor ↑ → <strong className="text-foreground">Parathormon (PTH) ↑</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">3</div>
                          <span>PTH mobilisiert Ca <strong className="text-foreground">AUS dem Knochen</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-bold text-destructive">4</div>
                          <span>Kasein erzeugt <strong className="text-foreground">Säurelast</strong> → weiterer Ca-Verlust</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-bold text-destructive">5</div>
                          <span><strong className="text-foreground">Netto-Ca-Bilanz kann negativ sein</strong> ✗</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fazit */}
            <Card className="border-primary/30 bg-primary/5 shadow-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Bone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="space-y-2">
                    <h3 className="font-serif text-lg font-medium text-foreground">Fazit der aktuellen Forschung</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {calciumPhosphorArgumente.fazit}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Quellen: Feskanich et al. 1997 [10], Michaëlsson et al. 2014 [11], Kemi et al. 2006 [12], 
                      Frassetto et al. 2000 [13], Huncharek et al. 2008 [14], Weaver et al. 2016 [15]
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══════════════ Pathogene in Milch ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <CircleAlert className="mb-1 mr-2 inline-block h-7 w-7 text-destructive" />
              Mikrobiologische Risiken – Pathogene in Milch
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Das Euter einer Kuh kann nicht sterilgehalten werden. Fäkalkeime, Umweltkeime und 
              Erreger aus dem Tier selbst kontaminieren die Milch bereits beim Melken. Erst die 
              Erhitzung (Pasteurisierung) macht Milch zu einem sicheren Lebensmittel [17, 18].
            </p>

            {/* Kontaminationswege */}
            <Card className="shadow-card mb-8 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-destructive/5 p-6 md:p-8">
                  <h3 className="mb-4 font-serif text-lg font-medium text-foreground">
                    Kontaminationswege – Warum ist Rohmilch nie „steril"?
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { weg: "Euter-Innenseite", detail: "Subklinische Mastitis (Euterentzündung) → S. aureus, Streptokokken, E. coli direkt im Eutergewebe. ~30 % aller Kühe haben subklinische Mastitis (BfR) [17]." },
                      { weg: "Fäkale Kontamination", detail: "Kühe liegen in Einstreu, die mit Kot kontaminiert ist. Fäkalkeime (Salmonellen, Campylobacter, EHEC) gelangen beim Melken auf Zitzen und in die Milch [18, 22]." },
                      { weg: "Umwelt & Wasser", detail: "Listerien (ubiquitär in Erde, Silage, Wasser) kontaminieren Melkequipment und Milchtanks. Biofilmbildung auf Oberflächen [22]." },
                      { weg: "Tier selbst (systemisch)", detail: "Coxiella burnetii (Q-Fieber), Brucella, M. bovis werden über die Milch ausgeschieden, auch bei klinisch gesundem Tier [24]." },
                    ].map((item) => (
                      <div key={item.weg} className="rounded-xl border border-destructive/15 bg-background p-4">
                        <h4 className="mb-2 text-sm font-medium text-foreground">{item.weg}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pathogene Tabelle */}
            <h3 className="mb-4 font-serif text-xl font-semibold text-foreground text-center">
              Die wichtigsten Milch-Pathogene und ihre Erkrankungen
            </h3>
            <div className="space-y-4 mb-8">
              {pathogeneData.map((p) => (
                <Card key={p.keim} className="shadow-card overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-[300px_1fr]">
                      <div className={`p-5 ${p.gefahr === "destructive" ? "bg-destructive/5" : "bg-sage-50"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className={`h-4 w-4 ${p.gefahr === "destructive" ? "text-destructive" : "text-accent"}`} />
                          <h4 className="font-serif text-base font-medium text-foreground">{p.keim}</h4>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div><span className="text-muted-foreground">Infektionsdosis:</span> <span className="font-medium text-foreground">{p.infektionsdosis}</span></div>
                          <div><span className="text-muted-foreground">Inkubation:</span> <span className="font-medium text-foreground">{p.inkubation}</span></div>
                          <div><span className="text-muted-foreground">Fälle/Jahr (DE):</span> <span className="font-medium text-foreground">{p.haeufigkeit}</span></div>
                        </div>
                      </div>
                      <div className="p-5 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-foreground">Symptome &amp; Komplikationen:</span>
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.symptome}</p>
                        </div>
                        <Badge variant="outline" className="text-xs border-primary/30">
                          🔥 {p.hitze}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pasteurisierungsverfahren */}
            <h3 className="mb-4 font-serif text-xl font-semibold text-foreground text-center">
              Pasteurisierungsverfahren – Temperatur &amp; Zeit
            </h3>
            <Card className="shadow-card mb-8 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-sage-50">
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">Verfahren</th>
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">Temperatur</th>
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">Dauer</th>
                      <th className="px-5 py-3 text-left font-serif font-medium text-foreground">Anwendung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasteurisierungsVerfahren.map((v, i) => (
                      <tr key={v.verfahren} className={`border-b last:border-0 ${i === 1 ? "bg-primary/5 font-medium" : ""}`}>
                        <td className="px-5 py-3 text-foreground font-medium">{v.verfahren}</td>
                        <td className="px-5 py-3 text-foreground font-bold">{v.temperatur}</td>
                        <td className="px-5 py-3 text-muted-foreground">{v.dauer}</td>
                        <td className="px-5 py-3 text-muted-foreground">{v.anwendung}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="mb-8 text-center text-xs text-muted-foreground">
              Referenzkeim: Coxiella burnetii – Pasteurisierung ist so ausgelegt, dass dieser hitzeresistenteste 
              milchrelevante Erreger sicher abgetötet wird (71,7 °C / 15 Sek.) [23, 24].
            </p>

            {/* Pasteurisiert vs. Nicht pasteurisiert */}
            <h3 className="mb-4 font-serif text-xl font-semibold text-foreground text-center">
              Welche Milchprodukte sind pasteurisiert – und welche nicht?
            </h3>
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Pasteurisiert */}
              <Card className="border-primary/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-base">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    Pasteurisiert (sicher)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {pasteurisierteProdukte.ja.map((p) => (
                      <li key={p.produkt} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span><strong className="text-foreground">{p.produkt}</strong> – {p.verfahren}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Nicht pasteurisiert */}
              <Card className="border-destructive/20 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 font-serif text-base">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                      <Ban className="h-5 w-5 text-destructive" />
                    </div>
                    NICHT pasteurisiert (Risiko)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {pasteurisierteProdukte.nein.map((p) => (
                      <li key={p.produkt} className="flex items-start gap-2">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <span>
                          <strong className="text-foreground">{p.produkt}</strong>
                          <br />
                          <span className="text-xs">{p.risiko}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Risikogruppen-Warnung */}
            <Card className="border-destructive/30 bg-destructive/5 shadow-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <h4 className="font-serif text-base font-medium text-foreground">
                      Besonders gefährdete Personengruppen
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong>Schwangere, Säuglinge, Kleinkinder, ältere Menschen und Immunsupprimierte</strong> sollten 
                      konsequent auf Rohmilch und Rohmilchprodukte verzichten. Listerien können bei Schwangeren die 
                      Plazenta überwinden und zu Fehl-/Totgeburten führen. EHEC kann bei Kleinkindern das lebensbedrohliche 
                      hämolytisch-urämische Syndrom (HUS) auslösen [17, 18, 25].
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quellen: BfR 2024/2025 [17, 18], RKI Campylobacter-Ratgeber [20], Stingl 2019 [19], 
                      Rosner et al. 2017 [21], LAVES Niedersachsen [22], Rabbani et al. 2025 [23]
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══════════════ Latente Infektionen ═══════════════ */}
          <section>
            <h2 className="mb-2 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
              <Microscope className="mb-1 mr-2 inline-block h-7 w-7 text-destructive" />
              Die übersehene Gefahr: Latente &amp; persistierende Infektionen
            </h2>
            <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto">
              Die Medizin fokussiert sich meist auf <strong className="text-foreground">akute Symptome</strong>. 
              Doch viele milchrelevante Erreger können <em>intrazellulär persistieren</em> – oft über Monate 
              bis Jahre – und chronische, schwer zuordenbare Beschwerden verursachen.
            </p>

            {/* Grundprinzip */}
            <Card className="shadow-card mb-8 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-sage-50 p-6 md:p-8">
                  <h3 className="mb-6 text-center font-serif text-lg font-medium text-foreground">
                    Akute vs. Latente Infektion – Das Prinzip
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border border-destructive/20 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="font-medium text-foreground">Akute Infektion (bekannt)</span>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Erreger vermehren sich rasch → Immunsystem reagiert mit <strong className="text-foreground">Entzündung</strong> → klare Symptome (Durchfall, Fieber, Erbrechen).</p>
                        <p>Dauer: Tage bis Wochen. Wird diagnostiziert und behandelt.</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-accent/30 bg-background p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Brain className="h-5 w-5 text-accent" />
                        <span className="font-medium text-foreground">Latente/Persistierende Infektion (übersehen)</span>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Erreger ziehen sich <strong className="text-foreground">intrazellulär</strong> zurück (Makrophagen, Epithelzellen, Gallenblase). Sie gehen in einen <em>Ruhezustand</em> (dormant state) und entziehen sich dem Immunsystem.</p>
                        <p>Folge: <strong className="text-foreground">Chronische Entzündung niedrigen Grades</strong> → diffuse Symptome, die selten dem ursprünglichen Erreger zugeordnet werden.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Erreger-spezifische latente Infektionen */}
            <h3 className="mb-4 font-serif text-xl font-semibold text-foreground text-center">
              Latente Persistenz der wichtigsten Milch-Pathogene
            </h3>
            <div className="space-y-5 mb-8">
              {/* Salmonella */}
              <Card className="shadow-card overflow-hidden border-destructive/15">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-[280px_1fr]">
                    <div className="bg-destructive/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-destructive" />
                        <h4 className="font-serif text-base font-medium text-foreground">Salmonella enterica</h4>
                      </div>
                      <Badge variant="outline" className="text-xs border-destructive/30 mb-2">Intrazelluläre Persistenz</Badge>
                      <p className="text-xs text-muted-foreground">
                        Salmonellen können in einen <strong className="text-foreground">Ruhezustand (dormant state)</strong> in 
                        menschlichen Epithelzellen eintreten und dort über Monate persistieren [26].
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-destructive">Mechanismus der Persistenz:</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Salmonellen überleben <strong className="text-foreground">intrazellulär in Makrophagen</strong> innerhalb 
                          sogenannter <em>Salmonella-containing vacuoles</em> (SCVs). Sie manipulieren die Immunantwort, 
                          verhindern die Fusion mit Lysosomen und können sich im <strong className="text-foreground">Gallenblasenepithel</strong> und 
                          in <strong className="text-foreground">mesenterialen Lymphknoten</strong> langfristig einnisten. 
                          Biofilmbildung auf Gallensteinen ermöglicht chronisches Trägertum [27, 28].
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-accent">Latente/chronische Symptome:</span>
                        <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>Chronische, unspezifische <strong className="text-foreground">Bauchbeschwerden</strong> (Blähungen, wechselnde Stuhlkonsistenz)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Reaktive Arthritis</strong> (Gelenkentzündungen Wochen nach Infektion, ~2–7 % der Fälle)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Chronische Müdigkeit</strong>, Leistungsminderung, subfebrile Temperaturen</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>Asymptomatisches <strong className="text-foreground">Dauerausscheidertum</strong> (bis zu 1 % werden chronische Träger, scheiden Salmonellen &gt;12 Monate aus)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>Assoziation mit <strong className="text-foreground">Gallenblasen-Karzinom</strong> bei chronischem Trägertum (Salmonella Typhi) [28]</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Campylobacter */}
              <Card className="shadow-card overflow-hidden border-destructive/15">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-[280px_1fr]">
                    <div className="bg-destructive/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-destructive" />
                        <h4 className="font-serif text-base font-medium text-foreground">Campylobacter jejuni</h4>
                      </div>
                      <Badge variant="outline" className="text-xs border-destructive/30 mb-2">Postinfektiöse Sequelae</Badge>
                      <p className="text-xs text-muted-foreground">
                        Campylobacter verursacht die <strong className="text-foreground">höchste Rate an chronischen Folgeerkrankungen</strong> aller 
                        lebensmittelbedingten Erreger [29, 30].
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-destructive">Mechanismus:</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Campylobacter-Lipooligosaccharide (LOS) ähneln strukturell menschlichen <strong className="text-foreground">Gangliosiden</strong> (Nervengewebe). 
                          Dies löst eine <em>molekulare Mimikry</em> aus → das Immunsystem greift eigenes Nervengewebe an. 
                          Zusätzlich verändert die Infektion das <strong className="text-foreground">Darmmikrobiom</strong> und die 
                          Darmpermeabilität langfristig [30, 31].
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-accent">Latente/chronische Symptome (Metaanalyse-Daten):</span>
                        <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Postinfektiöses Reizdarmsyndrom (PI-IBS)</strong>: ~9–13 % aller Campylobacter-Patienten entwickeln ein chronisches Reizdarmsyndrom [29, 31]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Guillain-Barré-Syndrom (GBS)</strong>: Autoimmune Nervenschädigung → aufsteigende Lähmungen. ~1 von 1.000 Campylobacter-Infektionen [30]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Reaktive Arthritis</strong>: Gelenkentzündungen 1–6 Wochen nach Akutinfektion, ~2–5 % der Fälle [30]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Chronische Müdigkeit und Schmerzsyndrome</strong> (Fibromyalgie-ähnlich)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Listeria */}
              <Card className="shadow-card overflow-hidden border-destructive/15">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-[280px_1fr]">
                    <div className="bg-destructive/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-destructive" />
                        <h4 className="font-serif text-base font-medium text-foreground">Listeria monocytogenes</h4>
                      </div>
                      <Badge variant="outline" className="text-xs border-destructive/30 mb-2">Intrazellulärer Parasit</Badge>
                      <p className="text-xs text-muted-foreground">
                        Listerien sind <strong className="text-foreground">fakultativ intrazelluläre Erreger</strong>, die sich 
                        aktiv in Wirtszellen bewegen und von Zelle zu Zelle ausbreiten, ohne dem Immunsystem ausgesetzt zu sein [32].
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-destructive">Mechanismus der Persistenz:</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Listerien entkommen dem Phagosom mittels <strong className="text-foreground">Listeriolysin O (LLO)</strong>, 
                          vermehren sich im Zytoplasma und nutzen <strong className="text-foreground">Aktin-Polymerisation</strong> zur 
                          Zell-zu-Zell-Ausbreitung. Sie können in Biofilmen und in infizierten Zellen langfristig persistieren. 
                          Neonatale Infektionen führen zu <strong className="text-foreground">langfristigen Veränderungen der Immunzell-Zusammensetzung</strong> [33].
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-accent">Latente/chronische Symptome:</span>
                        <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Progressive kognitive Beeinträchtigung</strong> nach überstandener Infektion – auch bei nicht-neuroinvasiven Formen nachgewiesen [34]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Chronische Müdigkeit</strong> und Konzentrationsstörungen über Monate</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Langfristige Immundysregulation</strong>: Veränderte T-Zell- und NK-Zell-Zusammensetzung [33]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>Subklinische <strong className="text-foreground">rezidivierende Infektionen</strong> bei Immunsupprimierten</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EHEC */}
              <Card className="shadow-card overflow-hidden border-destructive/15">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-[280px_1fr]">
                    <div className="bg-destructive/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-destructive" />
                        <h4 className="font-serif text-base font-medium text-foreground">EHEC / STEC (E. coli)</h4>
                      </div>
                      <Badge variant="outline" className="text-xs border-destructive/30 mb-2">Langzeit-Organschäden</Badge>
                      <p className="text-xs text-muted-foreground">
                        Shiga-Toxine verursachen <strong className="text-foreground">mikrovaskuläre Endothelschäden</strong>, 
                        deren Langzeitfolgen oft erst Jahre nach der Akutinfektion klinisch relevant werden [35, 36].
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-destructive">Mechanismus der Langzeitschäden:</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Shiga-Toxine binden an <strong className="text-foreground">Gb3-Rezeptoren</strong> auf renalen Endothelzellen → 
                          thrombotische Mikroangiopathie (TMA) → <strong className="text-foreground">Nierenschädigung</strong>. 
                          Auch nach klinischer Erholung bleiben oft subklinische Nephronschäden bestehen, 
                          die erst nach Jahren zu Proteinurie oder Hypertonie führen [35, 36].
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-accent">Langzeitfolgen (10-Jahres-Follow-up-Studien):</span>
                        <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Chronische Niereninsuffizienz</strong>: ~25 % der HUS-Überlebenden zeigen nach 10 Jahren renale Auffälligkeiten (Proteinurie, reduzierte GFR) [35]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Hypertonie</strong>: Erhöhtes Risiko auch bei initial „mild" verlaufenen STEC-Infektionen [36]</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Neurologische Spätfolgen</strong>: Kognitive Defizite, epileptische Anfälle bei Kindern nach schwerem HUS</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Diabetes mellitus Typ 1</strong>: Erhöhte Inzidenz bei HUS-Überlebenden (Pankreas-Beteiligung) [36]</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Coxiella */}
              <Card className="shadow-card overflow-hidden border-primary/15">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-[280px_1fr]">
                    <div className="bg-sage-50 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <h4 className="font-serif text-base font-medium text-foreground">Coxiella burnetii (Q-Fieber)</h4>
                      </div>
                      <Badge variant="outline" className="text-xs border-primary/30 mb-2">Obligat intrazellulär</Badge>
                      <p className="text-xs text-muted-foreground">
                        Coxiella ist ein <strong className="text-foreground">obligat intrazellulärer Erreger</strong>, der in 
                        Makrophagen innerhalb saurer Vakuolen überlebt – ein Paradebeispiel für latente Persistenz [24].
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-accent">Latente/chronische Symptome:</span>
                        <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Chronisches Q-Fieber</strong>: Entwickelt sich bei ~1–5 % der akut Infizierten, oft erst Monate/Jahre später</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Endokarditis</strong> (lebensbedrohlich, erfordert monatelange Antibiotikatherapie)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Post-Q-Fieber-Fatigue-Syndrom</strong>: Chronische Erschöpfung über Jahre bei ~20 % der Patienten</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span><strong className="text-foreground">Hepatitis, Osteomyelitis, vaskuläre Infektionen</strong> als Manifestationen chronischer Persistenz</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zusammenfassung latente Infektionen */}
            <Card className="border-accent/30 bg-accent/5 shadow-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Brain className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="space-y-2">
                    <h4 className="font-serif text-base font-medium text-foreground">
                      Klinische Relevanz: Warum latente Infektionen so wichtig sind
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Die klassische Infektiologie betrachtet eine Infektion als „ausgeheilt", wenn die akuten 
                      Symptome abklingen. Doch die aktuelle Forschung zeigt: Viele milchrelevante Erreger 
                      <strong className="text-foreground"> persistieren intrazellulär</strong> und verursachen eine 
                      <strong className="text-foreground">chronische niedriggradige Entzündung (low-grade inflammation)</strong>, 
                      die mit unspezifischen Beschwerden einhergeht – chronische Müdigkeit, Gelenkschmerzen, 
                      Reizdarmsyndrom, kognitive Beeinträchtigungen. Da diese Symptome selten mit einer Milchprodukt-Exposition 
                      in Verbindung gebracht werden, bleiben sie häufig <em>unerkannt und unbehandelt</em>.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Quellen: Luk et al. 2021 [26], González et al. 2022 [27], Maciel et al. 2017 [28], 
                      Schorling et al. 2024 [29], Keithlin et al. 2014 [30], Zautner et al. 2014 [31], 
                      Frontiers Review 2026 [32], PMC 2020 [33], PMC 2023 [34], 
                      Ped. Nephrol. 2024 [35], Ped. Nephrol. 2025 [36]
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
