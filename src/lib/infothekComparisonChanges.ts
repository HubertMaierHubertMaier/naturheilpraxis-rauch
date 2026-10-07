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
  /** Alternative to an earlier proposal; when accepted it replaces that one in the working version. */
  supersedes?: number;
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
  { id: 5, reason: ["Inhalt/Recht"], note: "Energie-Bild aus der Physik bleibt erhalten, die Frequenztherapie knüpft daran an", orig: "Deshalb wirken winzige Frequenzänderungen", draft: "Die Frequenztherapie greift diese Energie-Perspektive", withNext: true, why: "Das Energie-Bild bleibt verständlich und führt zur Frequenztherapie hin. Korrigiert wird nur der falsche Schluss „Deshalb wirken …“: Aus E = mc² folgt physikalisch keine Wirkung auf Zellen – das steht einmal, genau an dieser Stelle." },
  { id: 6, reason: ["Inhalt/Recht"], note: "„Brücke zur Heilung“ ist ein Heilversprechen", orig: "Carlo Rubbia & die Brücke zur Heilung", draft: "Carlo Rubbia & das Modell der Frequenztherapie", why: "„Brücke zur Heilung“ verspricht Heilung, die Rubbias Physik nicht zeigt. Die neue Überschrift sagt, dass hier ein Modell vorgestellt wird." },
  { id: 7, reason: ["Inhalt/Recht"], note: "Rubbia belegt keine Therapie – als Modellvorstellung gekennzeichnet", orig: "BRÜCKE ZUR FREQUENZTHERAPIE:", draft: "MODELLVORSTELLUNG DER FREQUENZTHERAPIE", why: "Rubbias Experimente betreffen Teilchenphysik, nicht Therapie. Die Kennzeichnung „Modellvorstellung“ verhindert den falschen Eindruck eines Belegs." },
  { id: 8, reason: ["Inhalt/Recht"], note: "„können“ → „könnten nach dieser Hypothese“; Modell und Wirkung verständlich unterschieden", orig: "gestörte Muster wieder in eine stabilere", draft: "nach dieser Hypothese gestörte Muster", withPrev: true, why: "„Können … bringen“ klang wie eine gesicherte Wirkung. Jetzt bleibt der Ansatz anschaulich und verständlich, und Modell und Wirkung werden in einem Satz unterschieden – ohne Fachjargon wie „klinischer Wirksamkeitsnachweis“." },
  { id: 9, reason: ["Inhalt/Recht"], note: "„Wissenschaftlicher Beweis“ bezog sich nur auf Physik", orig: "Der wissenschaftliche Beweis: Carlo Rubbia", draft: "Physikalisch belegt: Masse-Energie-Äquivalenz", why: "„Wissenschaftlicher Beweis“ wirkt wie ein Beweis für die Therapie, bewiesen ist aber nur die Masse-Energie-Äquivalenz. Die neue Überschrift sagt genau das." },
  { id: 10, reason: ["Inhalt/Recht"], note: "Sachliche Formulierung", orig: "Der spektakuläre Beweis", draft: "Der experimentelle Nachweis", why: "„Spektakulärer Beweis“ ist werblich. „Experimenteller Nachweis“ ist sachlich und trifft dasselbe." },
  { id: 11, reason: ["Inhalt/Recht"], note: "Ganzer Satz physikalisch richtig und anschaulich", orig: "umwandelbar", origNth: 1, draft: "wie eng Energie und Materie zusammenhängen", withPrev: true, why: "Die Kernaussage bleibt positiv und anschaulich: Aus der Energie der Kollision entstanden neue Teilchen mit Masse. Präziser als „völlig umwandelbar“, weil Erhaltungssätze gelten. Kein angehängter Negativsatz – die Abgrenzung zur Therapie steht schon einmal am Übergang „Modellvorstellung der Frequenztherapie“ (Ä7)." },
  { id: 12, reason: ["Inhalt/Recht"], note: "Muheim-Wert ist keine anerkannte Naturkonstante", orig: "berechnete eine Naturkonstante", draft: "beschreibt in seinem Modell eine Kenngröße", why: "Muheims Wert ist keine anerkannte Naturkonstante. Als „Kenngröße seines Modells“ bleibt die Idee erhalten, ohne Physik vorzutäuschen." },
  { id: 13, reason: ["Inhalt/Recht"], note: "Einladender Gedankenanstoß ohne angehängte Negativformel", orig: "Ein faszinierendes Denkmodell", draft: "ganzheitlichen Blick auf den Menschen", why: "„Faszinierend“ und der ganzheitliche Blick bleiben. Gestrichen ist der angehängte Zusatz – die nötige Einordnung steht jetzt einmal direkt davor im Vergleichssatz (Ä34, „nach ihrem Denkmodell“)." },
  { id: 14, reason: ["Inhalt/Recht"], note: "Deutung dem Energiefeld-Modell der Frequenztherapie zugeordnet, nicht als Ursache dargestellt", orig: "Energiefehler in diesem", draft: "Energiefeld-Modell der Frequenztherapie", why: "Das Bild vom Energiefeld bleibt anschaulich. Neu ist nur die genaue Zuordnung: Es ist eine Deutung aus dem Energiefeld-Modell der Frequenztherapie – nicht die ganze Erfahrungsheilkunde, keine Diagnose und keine belegte Ursache der Rückenschmerzen. „Energiefehler … !“ hatte dagegen eine Ursache als Tatsache behauptet." },
  { id: 15, reason: ["Inhalt/Recht"], note: "Praxisangebot und persönliches Gespräch statt behaupteter Wirkort", orig: "Die Frequenztherapie setzt genau dort an", draft: "Frequenztherapie gehört zum naturheilkundlichen Angebot", why: "„Setzt genau dort an“ behauptete einen Wirkmechanismus als Tatsache. Jetzt steht, was sicher stimmt und einlädt: Frequenztherapie wird in der Praxis angeboten, und im Gespräch klären Sie gemeinsam, ob sie für Ihr Anliegen passt – ohne Erfolgszusage." },
  { id: 16, reason: ["Inhalt/Recht"], note: "Überschrift ergänzend statt „Revolution … statt“", orig: "Die Revolution: Feld-Therapie statt Masse-Therapie", draft: "Feld und Masse: ein ergänzender Blick", why: "„Revolution: Feld-Therapie statt Masse-Therapie“ stellte die übrige Medizin als überholt dar. Die neue Überschrift weckt Neugier und lässt beide Sichtweisen nebeneinander stehen." },
  { id: 17, reason: ["Inhalt/Recht"], note: "„Deshalb heilt“ → Idee der Frequenztherapie", orig: "Deshalb heilt Frequenztherapie", draft: "regulierend auf dieses Feld einzuwirken", why: "„Muheim beweist … Deshalb heilt Frequenztherapie“ war ein Heilversprechen aus einem Physikmodell. Jetzt wird die Idee der Methode beschrieben, ohne Heilung zu behaupten – und ohne zusätzlichen Warnsatz." },
  { id: 18, reason: ["Inhalt/Recht", "Lesbarkeit"], note: "Zusammenfassung freundlich als Modellüberblick", orig: "Nun was haben wir bis jetzt verstanden", draft: "das Modell im Überblick", why: "Die Überschrift ordnet den Abschnitt klar als Modell ein. „(nicht belegt)“ ist entbehrlich, weil die Einordnung schon in den Abschnitten davor steht." },
  { id: 19, reason: ["Inhalt/Recht"], note: "Krankheitsverständnis der Informationsmedizin zugeordnet", orig: "Krankheit ist: eine fehlende", draft: "eine Sichtweise der Informationsmedizin", withPrev: true, why: "Der Satz bleibt als Sichtweise der Informationsmedizin erkennbar und wird nicht als allgemeine Krankheitsdefinition behauptet. Die lange Klammer mit Fachbegriffen fällt weg." },
  { id: 20, reason: ["Inhalt/Recht"], note: "Praxisangebot statt „Komplettes Körper-WLAN“ – Ablauf von Peter zu bestätigen", orig: "Komplettes Körper-WLAN", draft: "Diese Geräte stehen in meiner Praxis zur Verfügung", why: "„Komplettes Körper-WLAN“ suggerierte eine umfassende Wirkung. Jetzt steht nur, was der Artikel selbst belegt (Geräteliste der Praxis), plus Einladung zum Gespräch. Bitte bestätigen, dass diese Geräte aktuell vorhanden sind." },
  { id: 21, reason: ["Inhalt/Recht"], note: "Formel als Idee des Modells", orig: "= UNTERSTÜTZUNG DER SELBSTREGULATION", draft: "so die Idee des Modells", why: "Die Formel bleibt einprägsam. Der kurze Zusatz zeigt, dass es die Idee des Modells ist, nicht ein gesichertes Ergebnis." },
  { id: 22, reason: ["Inhalt/Recht"], note: "Selbstregulation: Ziel der Methode statt Wirkbehauptung", orig: "die durch passende Frequenzen unterstützt werden können", draft: "anregen möchte", why: "„Unterstützt werden können“ klang nach belegter Wirkung. „Anregen möchte“ beschreibt verständlich das Ziel der Methode, ohne neuen Warnhinweis." },
  { id: 23, reason: ["Inhalt/Recht"], note: "Kinesiologie: keine sichere Identifikation zusagen", orig: "zur Identifikation von Belastungsfaktoren", draft: "Suche nach möglichen Belastungsfaktoren", why: "„Identifikation von Belastungsfaktoren“ verspricht eine sichere Erkennung. „Suche nach möglichen Belastungsfaktoren nach dem Konzept der Methode“ ist genauer." },
  { id: 24, reason: ["Inhalt/Recht"], note: "Metatron: Angebot und Erläuterung beim Termin, keine Diagnoseleistung behauptet", orig: "Diagnostik und Behandlung in einem System", draft: "wie es angewendet wird, erläutere ich Ihnen beim Termin", why: "„Diagnostik und Behandlung in einem System“ behauptete eine diagnostische Leistung. Jetzt wird das Angebot beschrieben und die Erläuterung beim Termin – ohne Aussage über diagnostischen Nutzen." },
  { id: 25, reason: ["SEO", "Lesbarkeit"], note: "Alt-Text als Symbolbild", img: true, orig: "E=mc² – Energie wird zu Materie", draft: "Symbolbild zur Formel E = mc²", why: "Der alte Alt-Text stellte das Bild als Tatsache dar. „Symbolbild“ ist für Screenreader und Suchmaschinen genauer." },
  { id: 26, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Bild als Symbolbild zum Denkmodell", img: true, orig: "Der menschliche Körper als leuchtendes Energiefeld", draft: "Symbolbild zum Denkmodell: menschlicher Körper", why: "Das Bild zeigt eine Vorstellung, keine Messung. Als Symbolbild zum Denkmodell beschrieben, entsteht kein falscher Eindruck." },
  { id: 27, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text: Vergleich als Denkmodell", img: true, orig: "Vergleich: Konventionelle Medizin vs. Frequenztherapie", draft: "konventionelle Medizin und Frequenztherapie im Vergleich", why: "Der Vergleich ist eine Illustration des Modells. Der neue Alt-Text sagt das und beschreibt das Bild verständlicher." },
  { id: 28, reason: ["Inhalt/Recht", "SEO"], note: "Alt-Text „Steuerpult der Biologie“ als Symbolbild", img: true, orig: "Frequenztherapie als Steuerpult der Biologie", draft: "Symbolbild zum Denkmodell: Frequenzen als Steuerpult", why: "„Steuerpult der Biologie“ als Bildbeschreibung wiederholt das Heilversprechen. Als Symbolbild gekennzeichnet, bleibt das Bild ohne diese Aussage nutzbar." },
  { id: 29, reason: ["SEO", "Lesbarkeit"], note: "Doppelte Überschrift aufgelöst (H3)", orig: "Die professionellen Werkzeuge für die Frequenztherapie", origNth: 1, draft: "Werkzeuge im Überblick", why: "Dieselbe Überschrift stand zweimal hintereinander. „Werkzeuge im Überblick“ unterscheidet die zweite Folie und hilft der Gliederung." },
  { id: 30, reason: ["SEO"], note: "Interne Links zu geplanten Praxisseiten ergänzt", orig: "Fragen zur Frequenztherapie?", draft: "Weiterlesen:", insertAfter: "self", draftWrap: "nav", why: "Am Ende fehlte ein Weg zu weiteren Praxisseiten. Die Links helfen Lesern weiter und verbinden die Seiten untereinander." },
  { id: 31, reason: ["Inhalt/Recht"], note: "Separater Vorschlag zu Ä8: Patientensatz als Denkmodell statt Tatsache", orig: "Schwingungen; Frequenztherapie versucht", draft: "Frequenztherapie greift dafür das Bild", withPrev: true, withNext: true, why: "Direkt nach Ä8 stand „Der Körper ist … ein geordnetes Feld“ als Tatsache – damit wäre der Wirkungseindruck sofort zurück. Jetzt bleibt das Bild vom Instrument erhalten, wird aber klar als Vergleich des Denkmodells erkennbar." },
  { id: 32, reason: ["Inhalt/Recht"], note: "Frequenztherapie als Methode der eigenen Praxis, Abklärung im Einzelfall einmal im Kontext", orig: "kein Ersatz für ärztliche Behandlung", draft: "zu den Behandlungsmethoden meiner Naturheilpraxis", why: "Sie sind der behandelnde Heilpraktiker – die Frequenztherapie gehört zu Ihren Methoden und steht nicht neben „Ihrer eigenen Behandlung“. Der Satz lädt zum Gespräch ein und nennt weitere Abklärung einmal dort, wo sie im Einzelfall nötig ist." },
  { id: 33, supersedes: 17, reason: ["Inhalt/Recht"], note: "Alternative zu Ä17 (Ä17 bleibt unverändert)", orig: "Deshalb heilt Frequenztherapie", draft: "gedanklichen Rahmen für ihr Arbeiten", why: "Zusatzvorschlag zur bereits übernommenen Ä17: „Daraus entwickelt … regulierend einzuwirken“ kann noch wie eine Herleitung der Wirkung aus der Physik klingen. Hier dient Muheims Bild nur als gedanklicher Rahmen. Wird Ä33 übernommen, ersetzt sie Ä17 in der Arbeitsfassung; Ä17 selbst bleibt gespeichert." },
  { id: 34, reason: ["Inhalt/Recht"], note: "Kontext zu Ä13: Vergleich der Ansätze ohne Abwertung, Energiefeld als Denkmodell", orig: "Behandelt vorwiegend die Materie", draft: "richtet sich nach ihrem Denkmodell", why: "„Behandelt vorwiegend die Materie“ verkürzt die konventionelle Medizin, „setzt am Energiefeld an“ klang wie ein belegter Wirkort. Jetzt werden beide Ansätze fair beschrieben, und „nach ihrem Denkmodell“ ordnet einmal klar ein – deshalb braucht Ä13 keinen Nachsatz." },
];

export const UNMARKED_NOTES = [
  "SEO: 14 Unterfolien-Überschriften H2 → H3 (Text unverändert, daher nicht einzeln markiert).",
  "SEO: Social-Metadaten (og:*, twitter:card) im Seitenkopf ergänzt.",
  "Lesbarkeit/Ladezeit: Bilder mit loading=\"lazy\", decoding=\"async\", feste Maße.",
];

/** Plain-language subject of each proposal (display only; ids unchanged). */
export const CHANGE_TOPICS: Record<number, string> = {
  1: "Seitentitel für Browser und Suche", 2: "Beschreibung für Suchergebnisse", 3: "Hauptüberschrift des Artikels",
  4: "Untertitel auf der Titelseite", 5: "E = mc² und Frequenzen", 6: "Überschrift Carlo Rubbia",
  7: "Rubbia und das Modell der Frequenztherapie", 8: "Schwingung und Ordnung im Modell", 9: "Überschrift: physikalischer Nachweis",
  10: "Das CERN-Experiment", 11: "Was das CERN-Ergebnis bedeutet", 12: "Muheims Kenngröße",
  13: "Ein faszinierendes Denkmodell", 14: "Rückenschmerzen im Energiefeld-Modell", 15: "Frequenztherapie in meiner Praxis",
  16: "Feld und Masse als Denkmodell", 17: "Muheim und Frequenztherapie", 18: "Zusammenfassung des Modells",
  19: "Krankheit in der Informationsmedizin", 20: "Geräte in meiner Praxis", 21: "Mögliche Wirkung im Modell",
  22: "Erfahrungen aus der Praxis", 23: "Kinesiologische Testung", 24: "Metatron-Messung",
  25: "Bildbeschreibung E = mc²", 26: "Bildbeschreibung Energiefeld", 27: "Bildbeschreibung Medizin-Vergleich",
  28: "Bildbeschreibung „Steuerpult“", 29: "Doppelte Überschrift", 30: "Weiterlesen: Praxisseiten",
  31: "Körper als Schwingungsgefüge (Patientensatz)", 32: "Frequenztherapie als Methode meiner Praxis", 33: "Alternative zu Vorschlag 17: Muheims Bild als gedanklicher Rahmen", 34: "Konventionelle Medizin und Frequenztherapie im Vergleich",
};
