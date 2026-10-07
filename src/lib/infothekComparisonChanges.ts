export type ChangeReason = "Inhalt/Recht" | "SEO" | "Lesbarkeit";

/** One marked change. `orig`/`draft` are real text snippets (or img alt snippets) from the two HTML files. */
export interface ComparisonChange {
  id: number;
  reason: ChangeReason[];
  note: string;
  orig?: string;
  draft?: string;
  /** Match against <img alt> instead of text. */
  img?: boolean;
  /** 0-based occurrence when the snippet appears more than once. */
  origNth?: number;
  draftNth?: number;
  /** Only in <head>, not visible in the article. */
  headOnly?: { before: string; after: string };
}

export const KRANKHEIT_IST_MESSBAR_CHANGES: ComparisonChange[] = [
  { id: 1, reason: ["Inhalt/Recht", "SEO"], note: "Seitentitel ohne unbelegtes Messbarkeitsversprechen, ≈60 Zeichen", headOnly: { before: "Krankheit ist messbar | Naturheilpraxis Rauch", after: "Frequenztherapie: Physik, Modelle, Einordnung | Praxis Rauch" } },
  { id: 2, reason: ["SEO"], note: "Meta-Beschreibung sachlich, Abgrenzung belegt/Hypothese", headOnly: { before: "Präsentation: Krankheit ist messbar - Die physikalischen Grundlagen der Frequenztherapie.", after: "E = mc², Muheim-Modell und Frequenztherapie sachlich eingeordnet: was physikalisch belegt ist, was Hypothese und was Erfahrungsheilkunde ist." } },
  { id: 3, reason: ["Inhalt/Recht", "SEO"], note: "H1 = Seitenthema, Modell statt „Grundlagen“", orig: "Frequenztherapie – physikalische Grundlagen", draft: "Frequenztherapie: physikalische Modelle und Erfahrungsheilkunde" },
  { id: 4, reason: ["SEO"], note: "Untertitel ist keine Überschrift mehr (H2 → Absatz)", orig: "Von Energie, Masse und Frequenzen", draft: "Von Energie, Masse und Frequenzen" },
  { id: 5, reason: ["Inhalt/Recht"], note: "Fehlschluss von E = mc² auf Therapiewirkung als Hypothese gekennzeichnet", orig: "Deshalb wirken winzige Frequenzänderungen", draft: "Hypothese der Frequenztherapie (nicht aus" },
  { id: 6, reason: ["Inhalt/Recht"], note: "„Brücke zur Heilung“ ist ein Heilversprechen", orig: "Carlo Rubbia & die Brücke zur Heilung", draft: "Carlo Rubbia & das Modell der Frequenztherapie" },
  { id: 7, reason: ["Inhalt/Recht"], note: "Rubbia belegt keine Therapie – als Modellvorstellung gekennzeichnet", orig: "BRÜCKE ZUR FREQUENZTHERAPIE:", draft: "MODELLVORSTELLUNG DER FREQUENZTHERAPIE" },
  { id: 8, reason: ["Inhalt/Recht"], note: "„können“ → „könnten nach dieser Hypothese“, kein Wirksamkeitsnachweis", orig: "gestörte Muster wieder in eine stabilere", draft: "nach dieser Hypothese gestörte Muster" },
  { id: 9, reason: ["Inhalt/Recht"], note: "„Wissenschaftlicher Beweis“ bezog sich nur auf Physik", orig: "Der wissenschaftliche Beweis: Carlo Rubbia", draft: "Physikalisch belegt: Masse-Energie-Äquivalenz" },
  { id: 10, reason: ["Inhalt/Recht"], note: "Sachliche Formulierung", orig: "Der spektakuläre Beweis", draft: "Der experimentelle Nachweis" },
  { id: 11, reason: ["Inhalt/Recht"], note: "Ergänzt: Teilchenphysik belegt keine Therapiewirkung", orig: "Konsequenz: Einsteins Vorhersage bestätigt", draft: "Einordnung: Das ist ein Ergebnis der Teilchenphysik" },
  { id: 12, reason: ["Inhalt/Recht"], note: "Muheim-Wert ist keine anerkannte Naturkonstante", orig: "berechnete eine Naturkonstante", draft: "beschreibt in seinem Modell eine Kenngröße" },
  { id: 13, reason: ["Inhalt/Recht"], note: "Denkmodell nicht als Therapiegrundlage überhöhen", orig: "Ein faszinierendes Denkmodell", draft: "in der Fachphysik nicht etabliert" },
  { id: 14, reason: ["Inhalt/Recht"], note: "Diagnoseaussage („Energiefehler“) als Deutung gekennzeichnet", orig: "Energiefehler in diesem", draft: "kein Diagnosebefund" },
  { id: 15, reason: ["Inhalt/Recht"], note: "Wirkort als Konzept/Hypothese", orig: "Die Frequenztherapie setzt genau dort an", draft: "will nach ihrem eigenen Konzept" },
  { id: 16, reason: ["Inhalt/Recht"], note: "„Revolution … statt“ → ergänzendes Denkmodell", orig: "Die Revolution: Feld-Therapie statt Masse-Therapie", draft: "Denkmodell: Feld-Therapie ergänzend zur Masse-Therapie" },
  { id: 17, reason: ["Inhalt/Recht"], note: "„Muheim beweist … Deshalb heilt Frequenztherapie“ – Heilversprechen", orig: "Deshalb heilt Frequenztherapie", draft: "kein Heilungsnachweis" },
  { id: 18, reason: ["Inhalt/Recht", "Lesbarkeit"], note: "Zusammenfassung als Modell gekennzeichnet", orig: "Nun was haben wir bis jetzt verstanden", draft: "Zusammengefasst – das Modell" },
  { id: 19, reason: ["Inhalt/Recht"], note: "Krankheitsdefinition als Modell der Informationsmedizin", orig: "Krankheit ist: eine fehlende", draft: "Krankheit wird in diesem Modell" },
  { id: 20, reason: ["Inhalt/Recht"], note: "„Komplettes Körper-WLAN“ suggeriert umfassende Wirkung", orig: "Komplettes Körper-WLAN", draft: "Zusammen eingesetzt nach dem Konzept" },
  { id: 21, reason: ["Inhalt/Recht"], note: "Wirkung als möglich/Modell", orig: "= UNTERSTÜTZUNG DER SELBSTREGULATION", draft: "MÖGLICHE UNTERSTÜTZUNG DER SELBSTREGULATION" },
  { id: 22, reason: ["Inhalt/Recht"], note: "Als Erfahrungsangabe gekennzeichnet", orig: "die durch passende Frequenzen unterstützt werden können", draft: "Erfahrungsangabe, nicht klinisch belegt" },
  { id: 23, reason: ["Inhalt/Recht"], note: "Kinesiologie: keine sichere Identifikation zusagen", orig: "zur Identifikation von Belastungsfaktoren", draft: "Suche nach möglichen Belastungsfaktoren" },
  { id: 24, reason: ["Inhalt/Recht"], note: "Metatron: Diagnoseanspruch abgegrenzt", orig: "Diagnostik und Behandlung in einem System", draft: "ersetzt keine anerkannte Diagnostik" },
  { id: 25, reason: ["SEO", "Lesbarkeit"], note: "Alt-Text als Symbolbild", img: true, orig: "E=mc² – Energie wird zu Materie", draft: "Symbolbild zur Formel E = mc²" },
  { id: 26, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Bild als Symbolbild zum Denkmodell", img: true, orig: "Der menschliche Körper als leuchtendes Energiefeld", draft: "Symbolbild zum Denkmodell: menschlicher Körper" },
  { id: 27, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Vergleich als Denkmodell", img: true, orig: "Vergleich: Konventionelle Medizin vs. Frequenztherapie", draft: "konventionelle Medizin und Frequenztherapie im Vergleich" },
  { id: 28, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text „Steuerpult der Biologie“ als Symbolbild", img: true, orig: "Frequenztherapie als Steuerpult der Biologie", draft: "Symbolbild zum Denkmodell: Frequenzen als Steuerpult" },
  { id: 29, reason: ["SEO", "Lesbarkeit"], note: "Doppelte Überschrift aufgelöst (H3)", orig: "Die professionellen Werkzeuge für die Frequenztherapie", origNth: 1, draft: "Werkzeuge im Überblick" },
  { id: 30, reason: ["SEO"], note: "Interne Links zu geplanten Praxisseiten ergänzt", orig: "Fragen zur Frequenztherapie?", draft: "Weiterlesen:" },
];

export const UNMARKED_NOTES = [
  "SEO: 14 Unterfolien-Überschriften H2 → H3 (Text unverändert, daher nicht einzeln markiert).",
  "SEO: Social-Metadaten (og:*, twitter:card) im Seitenkopf ergänzt.",
  "Lesbarkeit/Ladezeit: Bilder mit loading=\"lazy\", decoding=\"async\", feste Maße.",
];
