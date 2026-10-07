/**
 * Registry of HTML comparison reviews. One shared view (InfothekHtmlVergleich) serves all articles.
 * Decisions stay browser-local per slug (storage key unchanged for krankheit-ist-messbar).
 */
import { KRANKHEIT_IST_MESSBAR_CHANGES, CHANGE_TOPICS as KIM_TOPICS, UNMARKED_NOTES as KIM_NOTES, type ComparisonChange } from "@/lib/infothekComparisonChanges";
import kimDraft from "../../website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html?raw";
import allergieDraft from "../../website-content/infothek/drafts/allergiebehandlung.entwurf.html?raw";
import kieferBase from "../../website-content/infothek/drafts/kieferostitis.basis.html?raw";
import kieferDraft from "../../website-content/infothek/drafts/kieferostitis.entwurf.html?raw";

export interface ComparisonConfig {
  slug: string;
  heading: string;
  /** Left side: currently delivered original (edge function) or – for new articles – a local base draft. */
  base: { kind: "delivered"; route: string } | { kind: "baseDraft"; html: string };
  leftLabel: string;
  draftHtml: string;
  changes: ComparisonChange[];
  topics: Record<number, string>;
  notes: string[];
  /** Only the first article has the naming table. */
  naming?: boolean;
}

const KIEFER: ComparisonChange[] = [
  { id: 1, reason: ["SEO"], note: "HTML-Seitentitel", headOnly: { kind: "title", before: "Kieferostitis | Naturheilpraxis Rauch", after: "Kieferostitis verstehen: Kieferknochen, Entzündung und Erreger | Heilpraktiker Peter Rauch Augsburg" }, why: "Der Titel nennt Thema, Inhalt und Praxis – das ist für Leser und Suchmaschinen eindeutig." },
  { id: 2, reason: ["SEO"], note: "Meta-Beschreibung", headOnly: { kind: "description", before: "Information zur Kieferostitis.", after: "Kieferostitis und Kieferosteomyelitis verständlich erklärt: Formen, typische Erreger, Abklärung beim Zahnarzt/MKG und naturheilkundliche Begleitung in der Praxis Peter Rauch, Augsburg." }, why: "Die Kurzbeschreibung fasst den Artikel sachlich und positiv zusammen, ohne Heilversprechen." },
  { id: 3, reason: ["Lesbarkeit", "SEO"], note: "H1 = Arbeitstitel", orig: "Kieferostitis: Entzündung im Kieferknochen", draft: "Kieferostitis verstehen: Kieferknochen, Entzündung und Erreger", why: "Die Überschrift greift den Arbeitstitel auf und kündigt alle drei Schwerpunkte an." },
  { id: 4, reason: ["Inhalt/Recht"], note: "Häufigkeit an die konkrete Studie gebunden", orig: "In Studien am häufigsten nachgewiesen.", draft: "kanadischen Auswertung über zehn Jahre", why: "„In Studien“ klang allgemeingültig. Jetzt steht die Aussage genau bei der Quelle (37 Fälle, Proben von 33) – ohne Prozentwerte, die sich nicht übertragen lassen." },
  { id: 5, reason: ["Inhalt/Recht"], note: "Praxisangebot konkret und ehrlich", orig: "Ich unterstütze Sie naturheilkundlich.", draft: "Als Heilpraktiker begleite ich Sie naturheilkundlich", why: "Der Satz beschreibt die Rolle der Praxis klar: ergänzend zur zahnärztlichen bzw. MKG-Behandlung, ohne eine Kooperation zu behaupten." },
  { id: 6, reason: ["SEO"], note: "Echte interne Links ergänzt", orig: "0821 2177 2670 · Friedrich-Deffner-Str. 19a", draft: "Weiterlesen:", insertAfter: "self", draftWrap: "nav", why: "Links zu vorhandenen Praxisseiten (Ersttermin, Therapieweg, Viren und Bakterien) helfen Lesern weiter." },
  { id: 7, reason: ["Inhalt/Recht"], note: "Neuer Abschnitt: Kieferhöhle/Nasennebenhöhlen als Nachbarherd", orig: "Welche Erreger eine Rolle spielen", draft: "Kieferhöhle und Nasennebenhöhlen als Nachbarn", insertAfter: "parentNext", draftWrap: "section", why: "Peters Nachtrag: beide Richtungen getrennt. Zahn → Kieferhöhle ist im Expertenkonsens (Int J Oral Sci 2024) beschrieben; Kieferhöhle → Oberkieferknochen nur in seltenen Fallberichten – keine Häufigkeit, kein typischer Erreger, keine Übertragung auf den Unterkiefer. Schleimhautverdickung allein beweist keinen Knochenherd. Kein neues Behandlungsangebot." },
];

const ALLERGIE: ComparisonChange[] = [
  { id: 1, reason: ["SEO"], note: "HTML-Seitentitel", headOnly: { kind: "title", before: "Allergiebehandlung in der Naturheilpraxis | Heilpraktiker Rauch Augsburg", after: "Allergien verstehen und naturheilkundlich begleiten | Heilpraktiker Peter Rauch Augsburg" }, why: "„Allergiebehandlung“ kann als Behandlungsversprechen gelesen werden; „verstehen und begleiten“ beschreibt den Inhalt genauer." },
  { id: 2, reason: ["SEO", "Inhalt/Recht"], note: "Meta-Beschreibung", headOnly: { kind: "description", before: "Ganzheitliche Allergiebehandlung in der Naturheilpraxis Peter Rauch Augsburg: Allergie-Typen, Diagnostik, Naturheilkunde, Orthomolekulare Therapie, TCM und Psychosomatik.", after: "Allergien verständlich erklärt: Allergie-Typen, Symptome, schulmedizinische Behandlung und naturheilkundliche Begleitung in der Naturheilpraxis Peter Rauch, Augsburg-Hochzoll." }, why: "Nennt, was öffentlich sichtbar ist; die geschützten Praxisabschnitte werden nicht als frei zugänglicher Inhalt angekündigt." },
  { id: 3, reason: ["Lesbarkeit"], note: "Einladende Unterzeile statt Pauschal-Disclaimer", orig: "Informationsmaterial – kein Heilversprechen gemäß HWG", draft: "Patienteninformation der Naturheilpraxis Peter Rauch", why: "Der rechtliche Hinweis steht ausführlich am Ende. Auf der Titelfolie wirkt er abschreckend." },
  { id: 4, reason: ["Inhalt/Recht"], note: "Prozentangabe nur mit Primärquelle", orig: "Schätzungsweise 20–30 % der europäischen Bevölkerung", draft: "häufigsten chronischen Gesundheitsproblemen", why: "Die Zahl stammt aus einem Sekundärwerk und Wikipedia. Ohne Primärquelle ist die allgemeine Aussage sicherer; mit belegter Quelle kann die Zahl bleiben – Peters Entscheidung." },
  { id: 5, reason: ["Inhalt/Recht"], note: "Metatron als ergänzendes Verfahren", orig: "Metatron-Analyse – biophysikalisches Analyseverfahren", draft: "Metatron-Analyse – erfahrungsheilkundliches Verfahren", why: "„Biophysikalisches Analyseverfahren“ klingt nach messtechnischer Diagnose. Die neue Beschreibung ordnet es ehrlich als Ergänzung im Gesamtbild ein." },
  { id: 6, reason: ["Inhalt/Recht"], note: "Austestung der Erfahrungsheilkunde zugeordnet", orig: "Kinesiologisch-frequenztherapeutische Austestung", draft: "Kinesiologische und frequenzbasierte Austestung", why: "Verständlicher und klar als Erfahrungsheilkunde gekennzeichnet." },
  { id: 7, reason: ["Inhalt/Recht", "Lesbarkeit"], note: "Labor: übliche Allergieparameter genannt", orig: "Labordiagnostik – konventionelle Blutanalyse", draft: "Gesamt-IgE und spezifisches IgE", why: "Nennt die konventionell üblichen Allergie-Laborwerte und zeigt, dass die Praxis auch schulmedizinische Befunde nutzt." },
  { id: 8, reason: ["Inhalt/Recht"], note: "EAV als Begleitung statt „Allergie-Behandlung“", orig: "EAV-Allergie-Behandlung", draft: "Elektroakupunktur nach Voll (EAV) als Begleitung", why: "„Allergie-Behandlung“ verspricht eine Behandlung der Allergie durch EAV. „Als Begleitung“ beschreibt das Angebot ohne Wirkversprechen." },
  { id: 9, reason: ["Inhalt/Recht"], note: "Zusammenarbeit mit bisheriger Behandlung", orig: "mit individueller Diagnostik, Beratung und naturheilkundlicher Unterstützung.", draft: "abgestimmt auf Ihre bisherige ärztliche Behandlung", why: "Zeigt positiv, dass die Begleitung die bestehende Behandlung ergänzt – ohne eine Kooperation zu behaupten." },
];

const topicsOf = (c: ComparisonChange[]) => Object.fromEntries(c.map((x) => [x.id, x.note]));

export const COMPARISON_CONFIGS: ComparisonConfig[] = [
  { slug: "krankheit-ist-messbar", heading: "Frequenztherapie („Krankheit ist messbar“)", base: { kind: "delivered", route: "/krankheit-ist-messbar.html" }, leftLabel: "Original (aktuell ausgeliefert)", draftHtml: kimDraft, changes: KRANKHEIT_IST_MESSBAR_CHANGES, topics: KIM_TOPICS, notes: KIM_NOTES, naming: true },
  { slug: "allergiebehandlung", heading: "Allergiebehandlung", base: { kind: "delivered", route: "/allergiebehandlung.html" }, leftLabel: "Original (aktuell ausgeliefert)", draftHtml: allergieDraft, changes: ALLERGIE, topics: topicsOf(ALLERGIE), notes: ["Geschützte Patientenfolien (TCM, Orthomolekular, Psychosomatik) bleiben unverändert und wurden nicht bearbeitet."] },
  { slug: "kieferostitis", heading: "Kieferostitis (neuer Artikel)", base: { kind: "baseDraft", html: kieferBase }, leftLabel: "Basisentwurf (Arbeitsstand – nie veröffentlicht)", draftHtml: kieferDraft, changes: KIEFER, topics: topicsOf(KIEFER), notes: ["Neuer Artikel: Es gibt keine bisher veröffentlichte Fassung. Links steht der erste Arbeitsstand, rechts der überarbeitete Entwurf.", "Freigabe von Textänderungen und Veröffentlichung sind getrennte Schritte; der Entwurf ist noindex und nicht verlinkt."] },
];
export const configFor = (slug: string | undefined) => COMPARISON_CONFIGS.find((c) => c.slug === slug) ?? COMPARISON_CONFIGS[0];
