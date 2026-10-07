/** Editorial progress of all Infothek HTMLs (source: website-content/infothek/manifest.json). Repo-stored, not publication status. */
export type EditorialState = "nicht begonnen" | "Vergleich vorbereitet" | "in Prüfung" | "redaktionell abgeschlossen";
export interface EditorialEntry { file: string; title: string; visibility: string; reviewStatus: string; indexable: boolean; state: EditorialState; comparePath?: string; openTopics: string[] }
export const EDITORIAL_STATUS: EditorialEntry[] = [
  { file: "drafts/kieferostitis (neu)", title: "Kieferostitis verstehen: Kieferknochen, Entzündung und Erreger", visibility: "Entwurf", reviewStatus: "pending", indexable: false, state: "in Prüfung", comparePath: "/admin/infothek-vergleich/kieferostitis", openTopics: ["neuer Artikel – keine veröffentlichte Fassung", "Veröffentlichung separat"] },
  { file: "allergiebehandlung.html", title: "Allergiebehandlung in der Naturheilpraxis | Heilpraktiker Rauch Augsburg", visibility: "patient", reviewStatus: "pending", indexable: false, state: "in Prüfung", comparePath: "/admin/infothek-vergleich/allergiebehandlung", openTopics: ["Veröffentlichung separat"] },
  { file: "ass-salicylat-histamin.html", title: "ASS-Intoleranz, Salicylat- & Histamin-Unverträglichkeit | Naturheilpraxis Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "candida-diaet.html", title: "Candida-Diät | Naturheilpraxis Rauch", visibility: "patient", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "dankbarkeit-alltag.html", title: "Dankbarkeit im Alltag | Naturheilpraxis Peter Rauch", visibility: "patient", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "diabetes-handout.html", title: "Diabetes Typ 1 & Typ 2 – Patientenhandout | Naturheilpraxis Peter Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "ersttermin-naturheilpraxis.html", title: "Ihr erster Termin | Naturheilpraxis Peter Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "fit-gesund-herbst-winter-7-minuten.html", title: "7-Minuten-Vortrag: Fit und gesund durch Herbst und Winter", visibility: "internal", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "fit-gesund-herbst-winter-infothek.html", title: "Infothek-Entwurf: Fit und gesund durch Herbst und Winter", visibility: "internal", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "krankheit-ist-messbar.html", title: "Krankheit ist messbar | Naturheilpraxis Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "in Prüfung", comparePath: "/admin/infothek-vergleich/krankheit-ist-messbar", openTopics: ["offene Vorschläge siehe Vergleich", "Seitentitel/Meta/Links noch offen", "Veröffentlichung separat"] },
  { file: "kraeuter-schmerz-entzuendung.html", title: "Kräuter & Gewürze gegen Schmerz & Entzündung | Naturheilpraxis Rauch", visibility: "patient", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "logi-ernaehrung-mitochondrien.html", title: "LOGI-Kost & Mitochondrien-Ernährung | Naturheilpraxis Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "mitochondropathie-hws.html", title: "Mitochondropathie & instabile HWS – nach Dr. Kuklinski | Heilpraktiker Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "muedigkeit-erschoepfung-burnout.html", title: "Müdigkeit, Erschöpfung & Burnout – Zahlen, Ursachen, Versorgung | Heilpraktiker Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "parasiten-deutschland.html", title: "Parasiten in Deutschland – Vorkommen, Arten & Symptome | Naturheilpraxis Peter Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "patienteninfo-hochohmiges-wasser.html", title: "Hochohmiges Wasser nach der Behandlung | Patienteninfo Naturheilpraxis Peter Rauch Augsburg", visibility: "patient", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "sibo-duenndarmfehlbesiedlung.html", title: "SIBO / Duenndarmfehlbesiedlung - Atemtest, Symptome, H2S | Heilpraktiker Rauch Augsburg", visibility: "patient", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "therapieweg-uebersicht.html", title: "Ihr Therapieweg – Naturheilpraxis Peter Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "umwelt-alltag-gesundheit.html", title: "Umwelt, Alltag & Gesundheit – Belastungen & Alternativen | Heilpraktiker Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "vieva-pro-vitalanalyse.html", title: "Vieva Pro Vitalanalyse | Naturheilpraxis Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "viren-bakterien-deutschland.html", title: "Viren & Bakterien – Akute und latente Belastungen | Naturheilpraxis Peter Rauch Augsburg", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
  { file: "zapper-diamond-shield.html", title: "Zapper – Diamond Shield (Mannayan) | Präsentation Naturheilpraxis Rauch", visibility: "public", reviewStatus: "pending", indexable: false, state: "nicht begonnen", openTopics: [] },
];

/** Status derived from the comparison registry: a configured comparison is at least "Vergleich vorbereitet"; proposal count comes from the registry, never hardcoded. */
export function editorialWithRegistry(configs: { slug: string; changes: unknown[]; base: { kind: string; route?: string } }[]): EditorialEntry[] {
  return EDITORIAL_STATUS.map((e) => {
    const c = configs.find((x) => (x.base.kind === "delivered" && x.base.route === `/${e.file}`) || (e.comparePath?.endsWith(`/${x.slug}`)));
    if (!c) return e;
    return { ...e, comparePath: `/admin/infothek-vergleich/${c.slug}`, state: e.state === "nicht begonnen" ? "Vergleich vorbereitet" : e.state, openTopics: [`${c.changes.length} Vorschläge im Vergleich`, ...e.openTopics.filter((t) => !/Vorschläge vorbereitet/.test(t))] };
  });
}
