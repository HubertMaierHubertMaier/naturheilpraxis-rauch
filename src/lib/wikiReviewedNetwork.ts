/**
 * Redaktionell geprüfte Akteurs- und Quellenbeziehungen (Codex-Routine, 07.10.2026).
 * Dateistand – NICHT in der Datenbank freigegeben (DB-Datensätze bleiben Entwürfe).
 * Grundlage: die 34 Akteursvorschläge des Probelaufs (wikiNetworkDryRun) aus Herausgeber-/Autor-/Herstellerfeldern.
 * Keine Wirk-/Nachweisaussagen; Aliase nur mit konkreter Fundstelle.
 */
import { norm } from "@/lib/wikiTaxonomy";
import type { DryRun } from "@/lib/wikiNetworkDryRun";

export type ActorCategory = "person" | "hersteller" | "anbieter" | "apotheke" | "plattform" | "herausgeber_institution" | "kein_akteur" | "zusammengesetzt_ungeklaert";
export const CATEGORY_LABEL: Record<ActorCategory, string> = {
  person: "Person", hersteller: "Hersteller", anbieter: "Anbieter", apotheke: "Apotheke", plattform: "Plattform",
  herausgeber_institution: "Herausgeber (Verlag/Behörde/Institution)", kein_akteur: "Kein Akteur",
  zusammengesetzt_ungeklaert: "Zusammengesetzte Angabe – ungeklärt",
};
export type Certainty = "sicher" | "wahrscheinlich" | "unsicher";

export interface ActorReview {
  name: string; category: ActorCategory; certainty: Certainty; reason: string;
  /** Verweis auf anderen Akteur – nur mit konkreter Fundstelle, sonst nur Merge-Hinweis. */
  linkedTo?: { name: string; kind: "alias_belegt" | "merge_hinweis_unbelegt" | "website_von"; fundstelle?: string };
}

const r = (name: string, category: ActorCategory, certainty: Certainty, reason: string, linkedTo?: ActorReview["linkedTo"]): ActorReview => ({ name, category, certainty, reason, linkedTo });

/** Aus zusammengesetzten Angaben abgeleitete, getrennte Kandidaten (nicht in den 34 Probelauf-Akteuren). */
export const SPLIT_CANDIDATES = [
  { from: "PubMed / Clinical and Experimental Dental Research", name: "PubMed", category: "plattform" as ActorCategory, certainty: "wahrscheinlich" as Certainty, fundstelle: "Herausgeberfeld der Quellenrevision 6399335a… (Teil vor „/“)" },
  { from: "PubMed / Clinical and Experimental Dental Research", name: "Clinical and Experimental Dental Research", category: "herausgeber_institution" as ActorCategory, certainty: "wahrscheinlich" as Certainty, fundstelle: "Herausgeberfeld der Quellenrevision 6399335a… (Teil nach „/“); Zeitschrift, Verlag nicht im Datensatz" },
];

export const ACTOR_REVIEWS: ActorReview[] = [
  // Personen
  r("Andreas Kalcker", "person", "sicher", "Personenname im Herausgeberfeld; Quellentitel „Andreas Kalcker – Bye Bye Covid, 2022“ / „– CDS-Protokolle“."),
  r("A. L. Kalcker", "person", "sicher", "Personenname mit Initialen (Quellentitel „A. L. Kalcker – CDS/MMS Heilung ist möglich“).", { name: "Andreas Kalcker", kind: "merge_hinweis_unbelegt", fundstelle: "keine – „Andreas Ludwig Kalcker“ o. ä. in keiner Quelle/Artikelrevision gefunden; getrennt halten" }),
  r("Peter Römer", "person", "sicher", "Personenname im Herausgeberfeld (Quellentitel „Peter Römer – Chlordioxid/CDL – bereitgestellte PDF“)."),
  r("Dr. med. Ralf Kirkamm", "person", "sicher", "Autorfeld der Quellenrevision 30f76a14…"),
  // Hersteller
  r("Mannayan GmbH & Co. KG", "hersteller", "sicher", "Herstellerfeld (proposed_data.manufacturer) von 57 Produkten mit manufacturerSource mannayan.com; zusätzlich Herausgeber der Inventarquellen.", { name: "Mannayan", kind: "alias_belegt", fundstelle: "Herstellerfeld „Mannayan GmbH & Co. KG“ + Produkttitel „Mannayan …“" }),
  r("for you eHealth via Strunz product page", "hersteller", "unsicher", "Markenname „for you eHealth“ auf einer Strunz-Produktseite (strunz.com/for-you-jod.html); Hersteller vs. Marke nicht belegt. Strunz GmbH bleibt getrennt.", { name: "Strunz GmbH", kind: "merge_hinweis_unbelegt", fundstelle: "keine – Vertriebsseite ist kein Herstellerbeleg" }),
  // Anbieter
  r("Strunz GmbH", "anbieter", "wahrscheinlich", "Herausgeber von Produkt-Faktenkarten (Shop strunz.com); Herstellerrolle je Produkt nicht belegt. Person Dr. Strunz NICHT gleichgesetzt."),
  r("Aquintos Wasseraufbereitung", "anbieter", "wahrscheinlich", "Produktseite AQuinDos DuoDES (aquintos-wasseraufbereitung.de); Herstellerrolle nicht belegt."),
  r("Diamond Shield Zapper", "anbieter", "wahrscheinlich", "Herausgeber der ChipCard-Produktseiten (diamondshieldzapper.com); Gerätemarke – Hersteller nicht im Datensatz."),
  r("gehtanders.de", "anbieter", "wahrscheinlich", "Shopseite „Chlordioxid gegen Coronavirus – Sammlung … mit DVD“ (Produktverkauf)."),
  r("mms-seminar.com", "anbieter", "wahrscheinlich", "Website eines Seminar-/E-Book-Angebots („MMS-Seminar E-Book, Version 5.55“)."),
  r("AquaCentrum", "anbieter", "unsicher", "Website hostet PDF von Rainer Taufertshofer; Rolle Anbieter/Hoster unklar. Autor Taufertshofer nur im Titel, nicht im Autorfeld."),
  r("Heilpraktiker Bioresonanz München", "anbieter", "wahrscheinlich", "Praxis-Website (heilpraktiker-bioresonanz-muenchen.de) – Anbieter einer Behandlung, keine Person benannt."),
  r("Bio-Diagnostik", "anbieter", "unsicher", "Herausgeber „Bio-Diagnostik – vier neutrale Laborprofile“; Labor/Anbieter, Rechtsform/Ort nicht im Datensatz.", { name: "Biodiagnostik", kind: "alias_belegt", fundstelle: "Quellentitel „Bio-Diagnostik“ (Schreibweise Biodiagnostik nur Suchalias)" }),
  // Apotheke
  r("Radegundis Apotheke", "apotheke", "sicher", "Herausgeber der Quelle „Radegundis Apotheke – Mittel gegen Pollen …“; Name enthält „Apotheke“; zusätzlich Herstellerbegriff im Bestand."),
  // Plattformen (nie Hersteller)
  r("BitChute", "plattform", "sicher", "Videoplattform („Video laut PDF“) – Fundort, kein Urheber/Hersteller."),
  r("Amazon", "plattform", "sicher", "Handelsplattform („Bezugsquellenangabe Amazon“) – kein Hersteller."),
  r("DocCheck", "plattform", "sicher", "Fachportal (DocCheck Flexikon)."),
  r("Google Patents", "plattform", "sicher", "Patentdatenbank (WO2016074203A1) – Anmelder nicht erfasst."),
  r("PubMed / Clinical and Experimental Dental Research", "zusammengesetzt_ungeklaert", "unsicher", "Herausgeberfeld nennt zwei verschiedene Entitäten: PubMed (Literaturdatenbank, Fundort) und Clinical and Experimental Dental Research (Fachzeitschrift). Nicht als ein Akteur führen; getrennte Kandidaten unten, Verlag der Zeitschrift nicht im Datensatz.", { name: "PubMed | Clinical and Experimental Dental Research", kind: "merge_hinweis_unbelegt", fundstelle: "Quellenrevision 6399335a-b4f2-2938-7e42-05ac2699d2f0, Herausgeberfeld „PubMed / Clinical and Experimental Dental Research“" }),
  r("dr-kirkamm.de", "plattform", "sicher", "Website (Domain) – nicht die Person.", { name: "Dr. med. Ralf Kirkamm", kind: "website_von", fundstelle: "Quellenrevision 30f76a14…: Herausgeber dr-kirkamm.de + Autor Dr. med. Ralf Kirkamm, Titel „Dr. med. Ralf Kirkamm: SIBO …“" }),
  // Herausgeber/Institutionen (außerhalb der fünf Rollen, keine Hersteller)
  r("National Health Service, United Kingdom", "herausgeber_institution", "sicher", "Staatlicher Gesundheitsdienst (Herausgeber)."),
  r("Thieme", "herausgeber_institution", "sicher", "Fachverlag."),
  r("Springer Berlin Heidelberg", "herausgeber_institution", "sicher", "Fachverlag."),
  r("Hilaris Publisher", "herausgeber_institution", "sicher", "Verlag (Zeitschriftenartikel)."),
  r("EFSA", "herausgeber_institution", "sicher", "EU-Behörde."),
  r("European Chemicals Agency", "herausgeber_institution", "sicher", "EU-Behörde."),
  r("European Commission, Directorate-General for Health and Food Safety", "herausgeber_institution", "sicher", "EU-Kommission (DG SANTE)."),
  r("Umweltbundesamt", "herausgeber_institution", "sicher", "Bundesbehörde."),
  r("Commonwealth of Massachusetts", "herausgeber_institution", "sicher", "US-Bundesstaat (Behörde)."),
  r("World Health Organization", "herausgeber_institution", "sicher", "Internationale Organisation."),
  // Keine Akteure
  r("Klinghardt Talks 001-025", "kein_akteur", "sicher", "Talk-Reihe (Sammlungstitel), keine Person. Sprecher „DK“ nur über Tag „Sprecher: DK“ je Quellenkarte; Dr. Klinghardt als Autor erst nach Prüfung je Karte."),
  r("Externe Fachquelle", "kein_akteur", "sicher", "Generischer Quellenplatzhalter."),
  r("Nutzerbereitgestellte Quelle", "kein_akteur", "sicher", "Generischer Platzhalter im Autorfeld."),
];

const byName = new Map(ACTOR_REVIEWS.map((a) => [norm(a.name), a]));
export const reviewOf = (name: string) => byName.get(norm(name));

/** Teilt Probelauf-Akteure in redaktionell geprüft vs. ungeprüft (neu hinzugekommen). */
export function splitDryRunActors(d: Pick<DryRun, "actors">) {
  const reviewed: Array<{ display_name: string; review: ActorReview }> = []; const unreviewed: string[] = [];
  for (const a of d.actors) { const rv = reviewOf(a.display_name); if (rv) reviewed.push({ display_name: a.display_name, review: rv }); else unreviewed.push(a.display_name); }
  return { reviewed, unreviewed };
}

/** Quellenbeziehungen der 8 Stichprobenkandidaten (Stand docs/wiki/vernetzung-vorschlag-stichprobe.json). */
export interface SourceRelation {
  key: string; label: string; complete: boolean; certainty: Certainty;
  subject: { kind: "entity" | "article" | "source_revision"; id: string };
  sourceRevisionId?: string; fundstelle: string; relations: Array<{ ui: string; code: string | null; note?: string }>; missing?: string;
}
export const SOURCE_RELATIONS: SourceRelation[] = [
  { key: "mannayan-zink", label: "Mannayan ZINK + (60 Tabletten)", complete: true, certainty: "sicher", subject: { kind: "entity", id: "1d454818-0bda-5c22-a82b-a3cc5c2a3440" }, sourceRevisionId: "5fb3b98e-1133-53d9-b0f6-021bb6d889cb",
    fundstelle: "Herstelleraussagen „ingredients“ und „zinc-form: Zinkcitrat“ (source: manufacturer, mannayan.com/…/010104)",
    relations: [{ ui: "hergestellt von Mannayan GmbH & Co. KG", code: "manufactured_by" }, { ui: "enthält Zink (als Zinkcitrat, laut Herstellerdeklaration)", code: "contains" }, { ui: "enthält Kupfer (Kupfersulphat, laut Deklaration) – neuer Kandidat", code: "contains", note: "Kupfer-Entität vor Anlage prüfen" }] },
  { key: "radegundis-nase-frei", label: "Radegundis Nase frei", complete: true, certainty: "wahrscheinlich", subject: { kind: "entity", id: "b2bda25d-27de-52b5-0afa-3121d763e8da" }, sourceRevisionId: "c8aa4a29-25bb-3a71-e25a-7be80e148e2e",
    fundstelle: "S. 2, Spalte „Akute Phase“", relations: [{ ui: "geführt von Radegundis Apotheke", code: "offered_by", note: "Beziehungstyp noch inaktiv" }, { ui: "Herausgeber der Quelle", code: null, note: "Quellen-Akteur publisher" }] },
  { key: "banderol", label: "Banderol", complete: true, certainty: "wahrscheinlich", subject: { kind: "entity", id: "e8455b88-2003-654d-a76b-b7dc7fe15d86" }, sourceRevisionId: "7ba2f517-0b7c-5c12-b8d7-776d8cfa45eb",
    fundstelle: "Artikelrevision 42bc0f0c… („NutraMedix Banderol“, aktuelle Rev. 1): Zeile „**Hersteller:** NutraMedix Ltd“; Quelle „NutraMedix – vorhandene interne Produktübersicht“ nennt Banderol",
    relations: [{ ui: "hergestellt von NutraMedix Ltd (laut Herstellerzeile im Wiki-Artikel)", code: "manufactured_by", note: "interne Sekundärangabe; Primärquelle (Herstellerseite) fehlt" }] },
  { key: "ochsengalle-heel", label: "Ochsengalle (Felis tauri D6, Heel)", complete: false, certainty: "unsicher", subject: { kind: "article", id: "26b7f387-164d-4f05-a17f-f04376e32bfd" },
    fundstelle: "Artikeltext „Gallensäuren im Stuhl“, aktuelle Rev.", relations: [{ ui: "im Artikel empfohlen", code: "recommends" }, { ui: "Hersteller Heel (laut Artikeltext)", code: "manufactured_by" }],
    missing: "Keine Produktentität, keine Quellrevision mit Herstellerangabe – in Bestand gesucht (Titel/Metadaten/Artikel), nur dieser Artikel nennt es." },
  { key: "medacalm-pascoe", label: "Medacalm Kps. (Pascoe)", complete: false, certainty: "unsicher", subject: { kind: "article", id: "1530835d-b0c6-4e69-b3d0-a6ab6c71dc6f" },
    fundstelle: "Artikeltext „Reizdarm – Symptome & naturheilkundliche Mittel“, aktuelle Rev.", relations: [{ ui: "im Artikel erwähnt", code: "mentions" }, { ui: "Hersteller Pascoe (laut Artikeltext)", code: "manufactured_by" }],
    missing: "Keine Produktentität, keine Quellrevision; Produktart unklar. may_support ohne Quelle nicht vorgeschlagen." },
  { key: "night-relax-vitaplace", label: "Night Relax Kapseln", complete: true, certainty: "wahrscheinlich", subject: { kind: "article", id: "fbca0501-7f87-440d-982e-48b2051c6d63" },
    fundstelle: "Ordner „Vitaplace > Nahrungsergänzungsmittel“ + externe Betreiberzuordnung 07.10.2026", relations: [{ ui: "geführt von Vitaplace (Versandapotheke)", code: "offered_by", note: "Beziehungstyp noch inaktiv" }, { ui: "Hauptthema des Artikels", code: "about" }] },
  { key: "erythromycin-klinghardt", label: "Erythromycin (Klinghardt-Quellenkarte)", complete: true, certainty: "sicher", subject: { kind: "source_revision", id: "20e451aa-3ea9-5e71-b90c-ba724af155ec" }, sourceRevisionId: "20e451aa-3ea9-5e71-b90c-ba724af155ec",
    fundstelle: "Abschnitt „Sprecher und Fundstellen“: Folge 020 · 16:26–18:54 · E020-008 · DK",
    relations: [{ ui: "in Quelle genannt (Sprecheraussage, SAFETY_HOLD)", code: null, note: "nur als Aussage mit source_role=mentions; keine Wirkrelation" }, { ui: "Herausgeber: Reihe Klinghardt Talks", code: null }, { ui: "Sprecher DK", code: null, note: "Gleichsetzung DK = Dr. Klinghardt nur über Tag „Sprecher: DK“ – Autor erst nach Prüfung" }] },
  { key: "hno-chipcard", label: "HNO-ChipCard", complete: true, certainty: "wahrscheinlich", subject: { kind: "entity", id: "ad6b83bf-70c8-0895-2b93-0a7298395133" }, sourceRevisionId: "e4436fac-cfd8-5948-9567-7f7a554db0a2",
    fundstelle: "Artikel d3cc3e16… „HNO-ChipCard – Hals-Nase-Ohren“ (Ordner Chip Cards, aktuelle Rev. 1); Quelle diamondshieldzapper.com/…chipcard-hno-hals-nase-ohren",
    relations: [{ ui: "Hauptthema des Artikels d3cc3e16…", code: "about" }, { ui: "angeboten von Diamond Shield Zapper (Website)", code: null, note: "offered_by gilt nur für Produkte; Programm-Typ bleibt" }, { ui: "Hersteller", code: null, note: "nicht im Datensatz" }] },
];
