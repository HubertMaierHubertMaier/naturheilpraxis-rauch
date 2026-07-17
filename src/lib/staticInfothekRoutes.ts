export interface StaticInfothekRoute {
  path: string;
  title: string;
  defaultGated?: boolean;
  internal?: boolean;
}

export const staticInfothekAppPath = (contentPath: string) =>
  `/infothek-dokument${contentPath}`;

export const staticInfothekRoutes: StaticInfothekRoute[] = [
  { path: "/allergiebehandlung.html", title: "Allergiebehandlung", defaultGated: true },
  { path: "/ass-salicylat-histamin.html", title: "ASS, Salicylat und Histamin" },
  { path: "/candida-diaet.html", title: "Candida-Diät", defaultGated: true },
  { path: "/datenschutz-fahrplan.html", title: "Interner Datenschutz-Fahrplan", internal: true },
  { path: "/diabetes-handout.html", title: "Diabetes Typ 1 und Typ 2" },
  { path: "/krankheit-ist-messbar.html", title: "Frequenztherapie" },
  { path: "/kraeuter-schmerz-entzuendung.html", title: "Kräuter und Gewürze gegen Schmerz", defaultGated: true },
  { path: "/logi-ernaehrung-mitochondrien.html", title: "LOGI-Kost und Mitochondrien" },
  { path: "/mitochondropathie-hws.html", title: "Mitochondropathie und instabile HWS" },
  { path: "/muedigkeit-erschoepfung-burnout.html", title: "Müdigkeit, Erschöpfung und Burnout" },
  { path: "/parasiten-deutschland.html", title: "Parasiten in Deutschland" },
  { path: "/patienteninfo-hochohmiges-wasser.html", title: "Hochohmiges Wasser", defaultGated: true },
  { path: "/sibo-duenndarmfehlbesiedlung.html", title: "SIBO und Dünndarmfehlbesiedlung", defaultGated: true },
  { path: "/therapieweg-uebersicht.html", title: "Ihr Therapieweg" },
  { path: "/umwelt-alltag-gesundheit.html", title: "Umwelt, Alltag und Gesundheit" },
  { path: "/vieva-pro-vitalanalyse.html", title: "Vieva Pro Vitalanalyse" },
  { path: "/viren-bakterien-deutschland.html", title: "Viren und Bakterien" },
  { path: "/zapper-diamond-shield.html", title: "Diamond Shield Zapper" },
];
