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
  headOnly?: { before: string; after: string; kind: "title" | "description" };
  /** Plain-language reason: problem of the original and benefit of the proposal. */
  why: string;
  /** Composition: also swap the neighbouring element (multi-element changes). */
  withPrev?: boolean;
  withNext?: boolean;
  /** Composition: draft text is an addition, inserted after this anchor in the original. */
  insertAfter?: "self" | "parentNext";
  /** Composition: insert the closest draft ancestor matching this selector. */
  draftWrap?: string;
}

export const KRANKHEIT_IST_MESSBAR_CHANGES: ComparisonChange[] = [
  { id: 1, reason: ["Inhalt/Recht", "SEO"], note: "Seitentitel ohne unbelegtes Messbarkeitsversprechen, ≈60 Zeichen", headOnly: { before: "Krankheit ist messbar | Naturheilpraxis Rauch", after: "Frequenztherapie: Physik, Modelle, Einordnung | Praxis Rauch", kind: "title" }, why: "„Krankheit ist messbar“ verspricht etwas, das der Artikel nicht belegt. Der neue Titel sagt sachlich, worum es geht, und ist kurz genug für die Anzeige in Suchergebnissen." },
  { id: 2, reason: ["SEO"], note: "Meta-Beschreibung sachlich, Abgrenzung belegt/Hypothese", headOnly: { before: "Präsentation: Krankheit ist messbar - Die physikalischen Grundlagen der Frequenztherapie.", after: "E = mc², Muheim-Modell und Frequenztherapie sachlich eingeordnet: was physikalisch belegt ist, was Hypothese und was Erfahrungsheilkunde ist.", kind: "description" }, why: "Die alte Beschreibung nennt Physik als „Grundlagen“ der Therapie. Die neue erklärt in einem Satz, was belegt ist und was Hypothese, und liefert dazu Angaben für Link-Vorschauen." },
  { id: 3, reason: ["Inhalt/Recht", "SEO"], note: "H1 = Seitenthema, Modell statt „Grundlagen“", orig: "Frequenztherapie – physikalische Grundlagen", draft: "Frequenztherapie: physikalische Modelle und Erfahrungsheilkunde", why: "„Physikalische Grundlagen“ klingt, als sei die Therapie physikalisch bewiesen. „Modelle und Erfahrungsheilkunde“ beschreibt den Inhalt genauer und passt zum Seitentitel." },
  { id: 4, reason: ["SEO"], note: "Untertitel ist keine Überschrift mehr (H2 → Absatz)", orig: "Von Energie, Masse und Frequenzen", draft: "Von Energie, Masse und Frequenzen", why: "Der Untertitel war als eigene Überschrift ausgezeichnet und störte die Gliederung. Als normaler Text bleibt er sichtbar, die Überschriftenstruktur wird klarer." },
  { id: 5, reason: ["Inhalt/Recht"], note: "Fehlschluss von E = mc² auf Therapiewirkung als Hypothese gekennzeichnet", orig: "Deshalb wirken winzige Frequenzänderungen", draft: "Hypothese der Frequenztherapie (nicht aus", withNext: true, why: "Aus E = mc² folgt nicht, dass kleine Frequenzänderungen große Wirkung auf Organe haben. Der Vorschlag benennt das ehrlich als Hypothese." },
  { id: 6, reason: ["Inhalt/Recht"], note: "„Brücke zur Heilung“ ist ein Heilversprechen", orig: "Carlo Rubbia & die Brücke zur Heilung", draft: "Carlo Rubbia & das Modell der Frequenztherapie", why: "„Brücke zur Heilung“ verspricht Heilung, die Rubbias Physik nicht zeigt. Die neue Überschrift sagt, dass hier ein Modell vorgestellt wird." },
  { id: 7, reason: ["Inhalt/Recht"], note: "Rubbia belegt keine Therapie – als Modellvorstellung gekennzeichnet", orig: "BRÜCKE ZUR FREQUENZTHERAPIE:", draft: "MODELLVORSTELLUNG DER FREQUENZTHERAPIE", why: "Rubbias Experimente betreffen Teilchenphysik, nicht Therapie. Die Kennzeichnung „Modellvorstellung“ verhindert den falschen Eindruck eines Belegs." },
  { id: 8, reason: ["Inhalt/Recht"], note: "„können“ → „könnten nach dieser Hypothese“; Modell und Wirkung verständlich unterschieden", orig: "gestörte Muster wieder in eine stabilere", draft: "nach dieser Hypothese gestörte Muster", withPrev: true, why: "„Können … bringen“ klang wie eine gesicherte Wirkung. Jetzt bleibt der Ansatz anschaulich und verständlich, und Modell und Wirkung werden in einem Satz unterschieden – ohne Fachjargon wie „klinischer Wirksamkeitsnachweis“." },
  { id: 9, reason: ["Inhalt/Recht"], note: "„Wissenschaftlicher Beweis“ bezog sich nur auf Physik", orig: "Der wissenschaftliche Beweis: Carlo Rubbia", draft: "Physikalisch belegt: Masse-Energie-Äquivalenz", why: "„Wissenschaftlicher Beweis“ wirkt wie ein Beweis für die Therapie, bewiesen ist aber nur die Masse-Energie-Äquivalenz. Die neue Überschrift sagt genau das." },
  { id: 10, reason: ["Inhalt/Recht"], note: "Sachliche Formulierung", orig: "Der spektakuläre Beweis", draft: "Der experimentelle Nachweis", why: "„Spektakulärer Beweis“ ist werblich. „Experimenteller Nachweis“ ist sachlich und trifft dasselbe." },
  { id: 11, reason: ["Inhalt/Recht"], note: "Physik präzisiert, Übertragung auf Denkmodelle knapp abgegrenzt (ganzer Satz inkl. „umwandelbar“)", orig: "umwandelbar", origNth: 1, draft: "Frequenz-Denkmodelle knüpfen gedanklich", withPrev: true, why: "Erhalten bleibt die physikalische Kernaussage: Am CERN entstanden aus Bewegungsenergie neue Teilchen mit Masse – sachlich genauer als „völlig umwandelbar“, denn Erhaltungssätze gelten weiter. Danach wird kurz unterschieden, dass Frequenz-Denkmodelle gedanklich daran anknüpfen, ohne den Nobelpreis mit einem Therapiebeleg zu verwechseln." },
  { id: 12, reason: ["Inhalt/Recht"], note: "Muheim-Wert ist keine anerkannte Naturkonstante", orig: "berechnete eine Naturkonstante", draft: "beschreibt in seinem Modell eine Kenngröße", why: "Muheims Wert ist keine anerkannte Naturkonstante. Als „Kenngröße seines Modells“ bleibt die Idee erhalten, ohne Physik vorzutäuschen." },
  { id: 13, reason: ["Inhalt/Recht"], note: "Denkmodell nicht als Therapiegrundlage überhöhen", orig: "Ein faszinierendes Denkmodell", draft: "in der Fachphysik nicht etabliert", why: "„Faszinierendes Denkmodell für einen erweiterten Therapieansatz“ wertet das Modell auf. Der Vorschlag sagt offen, dass es in der Physik nicht etabliert ist." },
  { id: 14, reason: ["Inhalt/Recht"], note: "Diagnoseaussage („Energiefehler“) als Deutung gekennzeichnet", orig: "Energiefehler in diesem", draft: "kein Diagnosebefund", why: "„Energiefehler“ klingt wie eine Diagnose von Rückenschmerzen. Der Vorschlag macht daraus eine Deutung der Erfahrungsheilkunde." },
  { id: 15, reason: ["Inhalt/Recht"], note: "Wirkort als Konzept/Hypothese", orig: "Die Frequenztherapie setzt genau dort an", draft: "will nach ihrem eigenen Konzept", why: "„Setzt genau dort an“ behauptet einen Wirkort als Tatsache. „Will nach ihrem Konzept“ beschreibt den Ansatz, ohne ihn zu belegen." },
  { id: 16, reason: ["Inhalt/Recht"], note: "„Revolution … statt“ → ergänzendes Denkmodell", orig: "Die Revolution: Feld-Therapie statt Masse-Therapie", draft: "Denkmodell: Feld-Therapie ergänzend zur Masse-Therapie", why: "„Revolution … statt“ suggeriert Ersatz der Schulmedizin. „Ergänzend“ passt zu den übrigen Hinweisen im Artikel." },
  { id: 17, reason: ["Inhalt/Recht"], note: "„Muheim beweist … Deshalb heilt Frequenztherapie“ – Heilversprechen", orig: "Deshalb heilt Frequenztherapie", draft: "kein Heilungsnachweis", why: "„Deshalb heilt Frequenztherapie“ ist ein klares Heilversprechen ohne Beleg. Der Vorschlag beschreibt dasselbe Modell als Hypothese." },
  { id: 18, reason: ["Inhalt/Recht", "Lesbarkeit"], note: "Zusammenfassung als Modell gekennzeichnet", orig: "Nun was haben wir bis jetzt verstanden", draft: "Zusammengefasst – das Modell", why: "Die Zusammenfassung wirkt wie gesichertes Wissen. Die neue Überschrift erinnert daran, dass es um ein Modell geht, und ist sprachlich klarer." },
  { id: 19, reason: ["Inhalt/Recht"], note: "Krankheitsdefinition als Modell der Informationsmedizin", orig: "Krankheit ist: eine fehlende", draft: "Krankheit wird in diesem Modell", withPrev: true, why: "Der Satz definiert Krankheit allgemein als Informationsfehler. Der Vorschlag ordnet das als Modell der Informationsmedizin ein und glättet den holprigen Satz davor." },
  { id: 20, reason: ["Inhalt/Recht"], note: "„Komplettes Körper-WLAN“ suggeriert umfassende Wirkung", orig: "Komplettes Körper-WLAN", draft: "Zusammen eingesetzt nach dem Konzept", why: "„Komplettes Körper-WLAN“ suggeriert eine umfassende Wirkung. Die neue Zeile beschreibt sachlich den gemeinsamen Einsatz und den fehlenden Nachweis." },
  { id: 21, reason: ["Inhalt/Recht"], note: "Wirkung als möglich/Modell", orig: "= UNTERSTÜTZUNG DER SELBSTREGULATION", draft: "MÖGLICHE UNTERSTÜTZUNG DER SELBSTREGULATION", why: "Die Gleichung klingt wie ein sicheres Ergebnis. „Mögliche Unterstützung (Modell)“ ist vorsichtiger und passt zum Text darunter." },
  { id: 22, reason: ["Inhalt/Recht"], note: "Als Erfahrungsangabe gekennzeichnet", orig: "die durch passende Frequenzen unterstützt werden können", draft: "Erfahrungsangabe, nicht klinisch belegt", why: "Die Wirkaussage stand ohne Einordnung da. Als Erfahrungsangabe der Praxis gekennzeichnet, ist klar, worauf sie beruht." },
  { id: 23, reason: ["Inhalt/Recht"], note: "Kinesiologie: keine sichere Identifikation zusagen", orig: "zur Identifikation von Belastungsfaktoren", draft: "Suche nach möglichen Belastungsfaktoren", why: "„Identifikation von Belastungsfaktoren“ verspricht eine sichere Erkennung. „Suche nach möglichen Belastungsfaktoren nach dem Konzept der Methode“ ist genauer." },
  { id: 24, reason: ["Inhalt/Recht"], note: "Metatron: Diagnoseanspruch abgegrenzt", orig: "Diagnostik und Behandlung in einem System", draft: "ersetzt keine anerkannte Diagnostik", why: "„Diagnostik und Behandlung in einem System“ klingt wie anerkannte Diagnostik. Der Vorschlag beschreibt das Gerät und grenzt es davon ab." },
  { id: 25, reason: ["SEO", "Lesbarkeit"], note: "Alt-Text als Symbolbild", img: true, orig: "E=mc² – Energie wird zu Materie", draft: "Symbolbild zur Formel E = mc²", why: "Der alte Alt-Text stellte das Bild als Tatsache dar. „Symbolbild“ ist für Screenreader und Suchmaschinen genauer." },
  { id: 26, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Bild als Symbolbild zum Denkmodell", img: true, orig: "Der menschliche Körper als leuchtendes Energiefeld", draft: "Symbolbild zum Denkmodell: menschlicher Körper", why: "Das Bild zeigt eine Vorstellung, keine Messung. Als Symbolbild zum Denkmodell beschrieben, entsteht kein falscher Eindruck." },
  { id: 27, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Vergleich als Denkmodell", img: true, orig: "Vergleich: Konventionelle Medizin vs. Frequenztherapie", draft: "konventionelle Medizin und Frequenztherapie im Vergleich", why: "Der Vergleich ist eine Illustration des Modells. Der neue Alt-Text sagt das und beschreibt das Bild verständlicher." },
  { id: 28, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text „Steuerpult der Biologie“ als Symbolbild", img: true, orig: "Frequenztherapie als Steuerpult der Biologie", draft: "Symbolbild zum Denkmodell: Frequenzen als Steuerpult", why: "„Steuerpult der Biologie“ als Bildbeschreibung wiederholt das Heilversprechen. Als Symbolbild gekennzeichnet, bleibt das Bild ohne diese Aussage nutzbar." },
  { id: 29, reason: ["SEO", "Lesbarkeit"], note: "Doppelte Überschrift aufgelöst (H3)", orig: "Die professionellen Werkzeuge für die Frequenztherapie", origNth: 1, draft: "Werkzeuge im Überblick", why: "Dieselbe Überschrift stand zweimal hintereinander. „Werkzeuge im Überblick“ unterscheidet die zweite Folie und hilft der Gliederung." },
  { id: 30, reason: ["SEO"], note: "Interne Links zu geplanten Praxisseiten ergänzt", orig: "Fragen zur Frequenztherapie?", draft: "Weiterlesen:", insertAfter: "self", draftWrap: "nav", why: "Am Ende fehlte ein Weg zu weiteren Praxisseiten. Die Links helfen Lesern weiter und verbinden die Seiten untereinander." },
  { id: 31, reason: ["Inhalt/Recht"], note: "Separater Vorschlag zu Ä8: Patientensatz als Denkmodell statt Tatsache", orig: "Schwingungen; Frequenztherapie versucht", draft: "Frequenztherapie greift dafür das Bild", withPrev: true, withNext: true, why: "Direkt nach Ä8 stand „Der Körper ist … ein geordnetes Feld“ als Tatsache – damit wäre der Wirkungseindruck sofort zurück. Jetzt bleibt das Bild vom Instrument erhalten, wird aber klar als Vergleich des Denkmodells erkennbar." },
];

export const UNMARKED_NOTES = [
  "SEO: 14 Unterfolien-Überschriften H2 → H3 (Text unverändert, daher nicht einzeln markiert).",
  "SEO: Social-Metadaten (og:*, twitter:card) im Seitenkopf ergänzt.",
  "Lesbarkeit/Ladezeit: Bilder mit loading=\"lazy\", decoding=\"async\", feste Maße.",
];
