// Offline-Kandidaten für die Wiki-Kachel „3 Gasprofile“. Keine DB-Writes, keine Dosen.
// Status: kandidat | praxiszuordnung | abgelehnt | dupliziert | pruefbestaetigt (aktuell keiner prüfbestätigt).
export const SIBO_GAS_ARTICLE_KEY = "reference:sibo-gasprofile-drei-formen-pdf-kirkamm";

export type ProfileKey = "h2" | "ch4" | "h2s";
export type Belegart = "Primärstudie (Volltext)" | "Primärstudie (Abstract)" | "Leitlinie (Volltext)" | "Praxisquelle (PDF-Liste)";
export type CandStatus = "kandidat" | "praxiszuordnung" | "abgelehnt" | "dupliziert" | "pruefbestaetigt";

export interface GasSource { id: string; url?: string; belegart: Belegart; kurz: string; grenzen: string }
export interface GasCandidate {
  id: string; profile: ProfileKey; mittel: string; mikroorganismen: string;
  ergebnis: string; sourceId: string; status: CandStatus; pruefbedarf: string;
}

export const PROFILES: Record<ProfileKey, { label: string; gas: string; hinweis: string }> = {
  h2: { label: "Wasserstoff-Profil", gas: "H₂", hinweis: "Gasprofil identifiziert keine Spezies. H₂ wird von Bakterien gebildet; Candida ist ein Pilz und gesondert zu betrachten." },
  ch4: { label: "Methan-Profil / IMO", gas: "CH₄", hinweis: "Methanbildner sind Archaeen (keine Bakterien); H₂-liefernde Bakterien sind separat. IMO kann Dünn- und Dickdarm betreffen." },
  h2s: { label: "Schwefelwasserstoff-Profil", gas: "H₂S", hinweis: "H₂S-Profil nicht aus Symptomen allein diagnostizieren; kein allgemein konsentierter Grenzwert." },
};

export const GAS_SOURCES: GasSource[] = [
  { id: "S-H2S-2025", url: "https://link.springer.com/article/10.1007/s10620-025-09156-y", belegart: "Primärstudie (Volltext)", kurz: "110 Duodenalproben, 109 mit H₂S-Messung; Zusammenhänge u. a. mit Proteus mirabilis, Desulfovibrio desulfuricans, Desulfobulbus.", grenzen: "Keine Therapieprüfung, keine gesunde Kontrollgruppe, kein konsentierter H₂S-Grenzwert." },
  { id: "S-CHEDID-2014", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4030608/", belegart: "Primärstudie (Volltext)", kurz: "Retrospektiv, selbstgewählte Pflanzenkombination (37) vs. Rifaximin (67): negative Folgeatemtests 46 % vs. 34 %, nicht signifikant.", grenzen: "Keine bewiesene Gleichwertigkeit; Mehrstoffpräparate – keine Einzelmittel-, Gasprofil- oder Spezieswirkung ableitbar." },
  { id: "S-WISMUT-1998", url: "https://pubmed.ncbi.nlm.nih.gov/9558280/", belegart: "Primärstudie (Abstract)", kurz: "Zehn Gesunde: fäkale H₂S-Freisetzung unter Wismutsubsalicylat vermindert.", grenzen: "Kein Nachweis einer H₂S-SIBO-Heilung; nicht auf alle Wismutverbindungen übertragbar." },
  { id: "S-METHAN-RCT-2014", url: "https://pubmed.ncbi.nlm.nih.gov/24788320/", belegart: "Primärstudie (Abstract)", kurz: "31 methanpositive IBS-C: Rifaximin+Neomycin vs. Neomycin allein; Symptome besser außer Bauchschmerz.", grenzen: "Alter Methangrenzwert, kein Archaeen-Speziesnachweis, kein Allgemeinprotokoll." },
  { id: "S-ACG", belegart: "Leitlinie (Volltext)", kurz: "ACG-Leitlinie (bereits im Quellenpaket): IMO als eigene Entität, Methanbildung durch Archaeen.", grenzen: "Einordnung, keine Empfehlung der hier gelisteten Naturstoffe." },
  { id: "S-PRAXIS-PDF", belegart: "Praxisquelle (PDF-Liste)", kurz: "Peters bestehende PDF-Listen: Mittel diesem Profil zugeordnet.", grenzen: "Praxiszuordnung – klinische Einzelbelegprüfung offen, keine Aussage „wirkt gegen Art X“." },
];

const P = (id: string, profile: ProfileKey, mittel: string, pruefbedarf = "Klinische Einzelbelegprüfung offen"): GasCandidate =>
  ({ id, profile, mittel, mikroorganismen: "nicht spezifiziert (Profil ≠ Spezies)", ergebnis: "Praxisquelle: diesem Profil zugeordnet", sourceId: "S-PRAXIS-PDF", status: "praxiszuordnung", pruefbedarf });

export const GAS_CANDIDATES: GasCandidate[] = [
  ...["Oregano", "Berberin", "Wermut", "Thymian", "Phellodendron"].map((x, i) => P(`H2-P${i + 1}`, "h2", x)),
  { id: "H2-S1", profile: "h2", mittel: "Pflanzliche Mehrstoffkombination", mikroorganismen: "nicht bestimmt", ergebnis: "Folgeatemtest negativ 46 % vs. 34 % Rifaximin, nicht signifikant", sourceId: "S-CHEDID-2014", status: "kandidat", pruefbedarf: "Retrospektiv; keine Einzelmittelaussage" },
  ...["Oregano", "Berberin", "Wismut", "Molybdän", "Zinkacetat", "Tributyrat"].map((x, i) => P(`H2S-P${i + 1}`, "h2s", x)),
  P("H2S-P7", "h2s", "L. plantarum", "Stammangabe erforderlich; Einzelbelegprüfung offen"),
  { id: "H2S-S1", profile: "h2s", mittel: "Wismutsubsalicylat", mikroorganismen: "nicht bestimmt", ergebnis: "Fäkale H₂S-Freisetzung bei Gesunden vermindert", sourceId: "S-WISMUT-1998", status: "kandidat", pruefbedarf: "Gesunde, n=10; kein SIBO-Nachweis" },
  { id: "H2S-S2", profile: "h2s", mittel: "– (Beobachtung, keine Therapie)", mikroorganismen: "Proteus mirabilis, Desulfovibrio desulfuricans, Desulfobulbus (Zusammenhang)", ergebnis: "Assoziation in Duodenalproben", sourceId: "S-H2S-2025", status: "kandidat", pruefbedarf: "Keine Kausalität, keine Kontrollgruppe" },
  ...["Allicin", "Oregano", "Berberin", "Neem"].map((x, i) => P(`CH4-P${i + 1}`, "ch4", x)),
  P("CH4-P5", "ch4", "Ingwer/Artischocke", "Motilitätsansatz, keine Keimtötung"),
  { id: "CH4-S1", profile: "ch4", mittel: "Rifaximin + Neomycin (Arzneimittelvergleich)", mikroorganismen: "Archaeen (nicht speziesbestimmt)", ergebnis: "Symptome besser außer Bauchschmerz", sourceId: "S-METHAN-RCT-2014", status: "kandidat", pruefbedarf: "Alter Grenzwert, n=31" },
  { id: "CH4-S2", profile: "ch4", mittel: "– (Einordnung)", mikroorganismen: "Archaeen (z. B. Methanbildner)", ergebnis: "IMO als eigene Entität", sourceId: "S-ACG", status: "kandidat", pruefbedarf: "Leitlinienzitat im Quellenpaket belegt" },
];

export const uniqueCount = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size;
export const byProfile = (p: ProfileKey) => GAS_CANDIDATES.filter((c) => c.profile === p);
export const statusCounts = () => GAS_CANDIDATES.reduce<Record<CandStatus, number>>((a, c) => (a[c.status]++, a), { kandidat: 0, praxiszuordnung: 0, abgelehnt: 0, dupliziert: 0, pruefbestaetigt: 0 });
