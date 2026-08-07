// Complete form sections based on the 41-page Anamnesebogen document
export interface FormSection {
  id: string;
  titleDe: string;
  titleEn: string;
  emoji: string;
  icon: string;
  color: string;
  iconColor: string;
}

export const formSections: FormSection[] = [
  { id: "intro", titleDe: "Willkommen", titleEn: "Welcome", emoji: "👋", icon: "Sparkles", color: "bg-emerald-100 dark:bg-emerald-950/30", iconColor: "text-emerald-500" },
  { id: "patientData", titleDe: "I. Patientendaten", titleEn: "I. Patient Data", emoji: "👤", icon: "User", color: "bg-blue-100 dark:bg-blue-950/30", iconColor: "text-blue-500" },
  { id: "familyHistory", titleDe: "II. Familie", titleEn: "II. Family", emoji: "👨‍👩‍👧", icon: "Users", color: "bg-cyan-100 dark:bg-cyan-950/30", iconColor: "text-cyan-500" },
  { id: "neurology", titleDe: "III. Kopf & Sinne", titleEn: "III. Head & Senses", emoji: "🧠", icon: "Brain", color: "bg-purple-100 dark:bg-purple-950/30", iconColor: "text-purple-500" },
  { id: "heart", titleDe: "IV. Herz & Kreislauf", titleEn: "IV. Heart & Circulation", emoji: "❤️", icon: "Heart", color: "bg-red-100 dark:bg-red-950/30", iconColor: "text-red-500" },
  { id: "lung", titleDe: "V. Lunge & Atmung", titleEn: "V. Lungs & Breathing", emoji: "🫁", icon: "Wind", color: "bg-sky-100 dark:bg-sky-950/30", iconColor: "text-sky-500" },
  { id: "digestive", titleDe: "VI. Magen & Darm", titleEn: "VI. Digestive System", emoji: "🍽️", icon: "Apple", color: "bg-orange-100 dark:bg-orange-950/30", iconColor: "text-orange-500" },
  { id: "liver", titleDe: "VII. Leber & Galle", titleEn: "VII. Liver & Gallbladder", emoji: "🫀", icon: "FlaskConical", color: "bg-amber-100 dark:bg-amber-950/30", iconColor: "text-amber-600" },
  { id: "kidney", titleDe: "VIII. Niere & Blase", titleEn: "VIII. Kidney & Bladder", emoji: "💧", icon: "Droplets", color: "bg-blue-100 dark:bg-blue-950/30", iconColor: "text-blue-500" },
  { id: "hormone", titleDe: "IX. Hormone", titleEn: "IX. Hormones", emoji: "⚡", icon: "Activity", color: "bg-yellow-100 dark:bg-yellow-950/30", iconColor: "text-yellow-600" },
  { id: "musculoskeletal", titleDe: "X. Bewegungsapparat", titleEn: "X. Musculoskeletal", emoji: "🦴", icon: "Bone", color: "bg-stone-100 dark:bg-stone-950/30", iconColor: "text-stone-500" },
  { id: "womenHealth", titleDe: "XI. Frauengesundheit", titleEn: "XI. Women's Health", emoji: "👩", icon: "Heart", color: "bg-pink-100 dark:bg-pink-950/30", iconColor: "text-pink-500" },
  { id: "mensHealth", titleDe: "XI. Männergesundheit", titleEn: "XI. Men's Health", emoji: "👨", icon: "User", color: "bg-blue-100 dark:bg-blue-950/30", iconColor: "text-blue-500" },
  { id: "surgeries", titleDe: "XII. Unfälle & OPs", titleEn: "XII. Accidents & Surgeries", emoji: "🏥", icon: "Building2", color: "bg-red-100 dark:bg-red-950/30", iconColor: "text-red-500" },
  { id: "cancer", titleDe: "XIII. Krebs", titleEn: "XIII. Cancer", emoji: "⚠️", icon: "AlertTriangle", color: "bg-amber-100 dark:bg-amber-950/30", iconColor: "text-amber-600" },
  { id: "allergies", titleDe: "XIV. Allergien", titleEn: "XIV. Allergies", emoji: "🤧", icon: "ShieldAlert", color: "bg-yellow-100 dark:bg-yellow-950/30", iconColor: "text-yellow-600" },
  { id: "medications", titleDe: "XV. Medikamente", titleEn: "XV. Medications", emoji: "💊", icon: "Pill", color: "bg-purple-100 dark:bg-purple-950/30", iconColor: "text-purple-500" },
  { id: "lifestyle", titleDe: "XVI. Lebensweise", titleEn: "XVI. Lifestyle", emoji: "🌿", icon: "Leaf", color: "bg-green-100 dark:bg-green-950/30", iconColor: "text-green-500" },
  { id: "dental", titleDe: "XVII. Zahngesundheit", titleEn: "XVII. Dental Health", emoji: "🦷", icon: "Stethoscope", color: "bg-cyan-100 dark:bg-cyan-950/30", iconColor: "text-cyan-600" },
  { id: "environment", titleDe: "XVIII. Umwelt", titleEn: "XVIII. Environment", emoji: "🌍", icon: "Globe", color: "bg-teal-100 dark:bg-teal-950/30", iconColor: "text-teal-500" },
  { id: "infections", titleDe: "XIX. Infektionen", titleEn: "XIX. Infections", emoji: "🦠", icon: "Bug", color: "bg-rose-100 dark:bg-rose-950/30", iconColor: "text-rose-500" },
  { id: "vaccinations", titleDe: "XX. Impfstatus", titleEn: "XX. Vaccinations", emoji: "💉", icon: "Syringe", color: "bg-indigo-100 dark:bg-indigo-950/30", iconColor: "text-indigo-500" },
  { id: "complaints", titleDe: "XXI. Beschwerden", titleEn: "XXI. Complaints", emoji: "📋", icon: "ClipboardList", color: "bg-slate-100 dark:bg-slate-950/30", iconColor: "text-slate-500" },
  { id: "preferences", titleDe: "XXII. Präferenzen", titleEn: "XXII. Preferences", emoji: "✨", icon: "Wand2", color: "bg-violet-100 dark:bg-violet-950/30", iconColor: "text-violet-500" },
  { id: "social", titleDe: "XXIII. Persönliches", titleEn: "XXIII. Personal", emoji: "🏠", icon: "Home", color: "bg-sky-100 dark:bg-sky-950/30", iconColor: "text-sky-500" },
  { id: "iaa", titleDe: "XXIV. IAA-Fragebogen", titleEn: "XXIV. IAA Questionnaire", emoji: "📊", icon: "Activity", color: "bg-teal-100 dark:bg-teal-950/30", iconColor: "text-teal-500" },
  { id: "signature", titleDe: "XXV. Unterschrift", titleEn: "XXV. Signature", emoji: "✍️", icon: "PenTool", color: "bg-stone-100 dark:bg-stone-950/30", iconColor: "text-stone-500" },
];

// Initial form state with all fields
export const initialFormData = {
  // I. Patientendaten - Personalia
  nachname: "",
  vorname: "",
  geburtsdatum: "",
  nationalitaet: "",
  geschlecht: "",
  zivilstand: "",
  
  // Kontaktdaten
  strasse: "",
  plz: "",
  wohnort: "",
  telefonPrivat: "",
  telefonBeruflich: "",
  mobil: "",
  email: "",
  
  // Mitversicherte
  mitversicherte: [] as { name: string; verhaeltnis: string; geburtsdatum: string }[],
  
  // Versicherungsdaten
  versicherungstyp: "", // privat | gesetzlich
  versicherungsname: "",
  versicherungsnummer: "",
  tarif: "",
  kostenuebernahmeNaturheilkunde: false,
  
  // Berufliche Situation
  beruf: "",
  arbeitgeber: "",
  branche: "",
  arbeitsunfaehigSeit: "",
  berentnerSeit: "",
  unfallrenteProzent: "",
  schwerbehinderungProzent: "",
  
  // Körperliche Grunddaten
  koerpergroesse: "",
  gewicht: "",
  
  // Sorgeberechtigter (bei Minderjährigen unter 18)
  sorgeberechtigterTyp: "" as string, // "mutter" | "vater" | ""
  sorgeberechtigterVorname: "",
  sorgeberechtigterNachname: "",
  sorgeberechtigterAbweichendeAdresse: false, // Kind wohnt woanders (z.B. Heim)
  sorgeberechtigterStrasse: "",
  sorgeberechtigterPlz: "",
  sorgeberechtigterOrt: "",
  sorgeberechtigterTelefon: "",
  sorgeberechtigterEmail: "",
  sorgeberechtigterFestnetz: "", // Festnetz bei abweichender Adresse
  
  // Informationsquelle
  informationsquelle: [] as string[],
  empfehlungVon: "",
  
  // Vorbehandler
  hausarzt: "",
  fachaerzte: "",
  heilpraktiker: "",
  physiotherapeut: "",
  psychotherapeut: "",
  sonstigeTherapeutenn: "",
  facharztListe: [] as { fachrichtung: string; name: string }[],
  
  // II. Familiengeschichte
  familyHistory: {
    hoherBlutdruck: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    herzinfarkt: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    schlaganfall: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    diabetes: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    gicht: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    lungenasthma: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    lungentuberkulose: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    nervenleiden: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    krebs: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false, welches: "" },
    allergien: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    sucht: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
    autoimmun: { ja: false, vater: false, mutter: false, grosseltern: false, geschwister: false },
  },
  
  // III. Eigene Erkrankungen - Kopf, Sinne & Nervensystem
  kopfErkrankungen: {
    augenerkrankung: { 
      ja: false, jahr: "", 
      netzhaut: false, grauerStar: false, gruenerStar: false, makula: false,
      bindehautentzuendung: false, hornhautentzuendung: false, iritis: false, 
      sehnerventzuendung: false, trockeneAugen: false, sehstoerung: false,
      sonstige: ""
    },
    schwerhoerig: { ja: false, jahr: "", links: false, rechts: false, beidseitig: false },
    ohrenerkrankung: { 
      ja: false, jahr: "", 
      tinnitus: false, hoersturz: false, mittelohrentzuendung: false, 
      morbusMeniere: false, otosklerose: false, gehoergangentzuendung: false,
      trommelfell: false,
      sonstige: "" 
    },
    sinusitis: { ja: false, jahr: "", chronisch: false, akut: false, sonstige: "" },
    mandelentzuendung: { ja: false, jahr: "" },
    kopfschmerzen: { 
      ja: false, seit: "", 
      rechts: false, links: false, hinterkopf: false, stirn: false, 
      migraene: false, spannungskopfschmerz: false, clusterkopfschmerz: false,
      medikamenteninduziert: false, sonstige: ""
    },
    schwindel: { 
      ja: false, seit: "", 
      lagerung: false, dreh: false, schwank: false,
      vestibularisausfall: false, phobischerSchwankschwindel: false, sonstige: "" 
    },
    geruchsminderung: { ja: false, seit: "", vollverlust: false, teilminderung: false },
    geschmacksminderung: { ja: false, seit: "" },
    neuralgien: {
      ja: false, seit: "",
      trigeminus: false, glossopharyngeus: false, occipitalis: false,
      postzoster: false, atypischerGesichtsschmerz: false, sonstige: ""
    },
  },
  
  // Schlaf & Psychische Symptome
  schlafSymptome: {
    schlafstörung: { ja: false, seit: "", status: "", bisJahr: "", einschlaf: false, durchschlaf: false, einUndDurchschlaf: false, aufwachZeit: "" },
    einschlafstörung: { ja: false, dauerMinuten: "" },
    durchschlafstörung: { ja: false, wieOft: "", aufwachZeit: "" },
    fruehAufwachen: { ja: false, uhrzeit: "" },
    konzentrationsstörung: { ja: false, seit: "", status: "", bisJahr: "", morgens: false, tagsueber: false, abends: false },
    muedigkeit: { ja: false, seit: "", staendig: false, prozentVergleich: "" },
    leistungsabfall: { ja: false, seit: "", kurzfristig: false, langfristig: false },
    vergesslichkeit: { ja: false, seit: "" },
    angstzustaende: { ja: false, seit: "" },
    stress: { ja: false, seit: "", beruflich: false, privat: false, beides: false },
    partnerschaftsprobleme: { ja: false, seit: "" },
    sexualprobleme: { ja: false, seit: "", libidoverlust: false, potenzstörung: false },
  },
  
  // Psychische Erkrankungen
  psychischeErkrankungen: {
    depression: { ja: false, jahr: "", behandlung: false },
    schizophrenie: { ja: false, jahr: "", behandlung: false },
    psychose: { ja: false, jahr: "", behandlung: false },
    zwangsgedanken: { ja: false, jahr: "", behandlung: false },
    phobien: { ja: false, jahr: "", behandlung: false, agoraphobie: false, sozialePhobie: false, spezifisch: "" },
    epilepsie: { ja: false, jahr: "", behandlung: false },
    trauma: { ja: false, jahr: "", psychotherapie: false },
    mobbing: { ja: false, beruflich: false, schulisch: false, privat: false },
  },
  
  // Herz & Kreislauf
  herzKreislauf: {
    blutdruckWechselhaft: { ja: false, jahr: "", systolisch: "", diastolisch: "" },
    blutdruckNiedrig: { ja: false, jahr: "", symptome: "" },
    blutdruckHoch: { ja: false, jahr: "", grad: "" },
    herzrhythmusstörung: { ja: false, jahr: "", vorhofflimmern: false, extrasystolen: false },
    herzschrittmacher: { ja: false, jahr: "" },
    herzschmerzen: { ja: false, jahr: "", belastung: false, ruhe: false },
    herzinfarkt: { ja: false, jahr: "" },
    stent: { ja: false, jahr: "", anzahl: "" },
    herzklappenfehler: { ja: false, jahr: "", aorta: false, mitral: false, trikuspidal: false },
    herzklappenersatz: { ja: false, jahr: "", aortenklappe: false, mitralklappe: false, trikuspidalklappe: false, pulmonalklappe: false },
    krampfadern: { ja: false, jahr: "", reUnterschenkel: false, liUnterschenkel: false, reOberschenkel: false, liOberschenkel: false },
    thrombose: { ja: false, jahr: "", tiefeBeinvene: false, reUnterschenkel: false, liUnterschenkel: false, reOberschenkel: false, liOberschenkel: false, armvene: false, reArm: false, liArm: false, lungenembolie: false, sinusvene: false, pfortader: false, mesenterialvene: false, oberflaechlich: false },
    oedeme: { ja: false, seit: "", morgens: false, abends: false, staendig: false },
    sonstige: "",
  },
  
  // Lunge & Atmung
  lungeAtmung: {
    asthma: { ja: false, jahr: "", allergisch: false, nichtAllergisch: false },
    lungenentzuendung: { ja: false, jahr: "" },
    rippenfellentzuendung: { ja: false, jahr: "" },
    bronchitis: { ja: false, jahr: "", akut: false, chronisch: false },
    tuberkulose: { ja: false, jahr: "" },
    sarkoidose: { ja: false, jahr: "", stadium: "" },
    husten: { ja: false, seit: "", trocken: false, mitAuswurf: false },
    auswurf: { ja: false, seit: "", farbe: "" },
    atemnot: { ja: false, seit: "", belastung: false, ruhe: false },
    copd: { ja: false, jahr: "", stadium: "" },
    lungenembolie: { ja: false, jahr: "" },
    sonstige: "",
  },
  
  // Magen & Darm
  magenDarm: {
    magengeschwuer: { ja: false, jahr: "" },
    duennDarmgeschwuer: { ja: false, jahr: "" },
    sodbrennen: { ja: false, jahr: "", regelmaessig: false, gelegentlich: false },
    magensaeurehemmer: { ja: false, seit: "" },
    uebelkeit: { ja: false, seit: "", morgens: false, nachEssen: false, staendig: false },
    erbrechen: { ja: false, seit: "", haeufigkeit: "" },
    verstopfung: { ja: false, seit: "", haeufigkeit: "" },
    durchfall: { ja: false, seit: "", haeufigkeit: "" },
    blaehungen: { ja: false, seit: "", morgens: false, nachEssen: false, staendig: false },
    bauchschmerzen: { ja: false, seit: "", lokalisation: "" },
    zoeliakie: { ja: false, diagnostiziert: false },
    morbusCrohn: { ja: false, jahr: "", stadium: "" },
    colitis: { ja: false, jahr: "", bereich: "" },
    reizdarm: { ja: false, jahr: "", diarrhoe: false, obstipation: false, wechselnd: false },
    sonstige: "",
  },
  durst: "",
  appetit: "",
  ernaehrungstyp: "",
  
  // Leber & Gallenblase
  leberGalle: {
    lebererkrankung: { ja: false, jahr: "", hepatitisA: false, hepatitisB: false, hepatitisC: false, fettleber: false },
    leberzirrhose: { ja: false, jahr: "", stadium: "" },
    leberkrebs: { ja: false, jahr: "" },
    gelbsucht: { ja: false, jahr: "" },
    gallensteine: { ja: false, jahr: "" },
    gallenleiden: { ja: false, jahr: "", symptomatisch: false, asymptomatisch: false },
    gallenblasenentfernung: { ja: false, jahr: "", grund: "" },
    gallengangentzuendung: { ja: false, jahr: "" },
    sonstige: "",
  },
  
  // Niere & Blase
  niereBlase: {
    nierenerkrankung: { ja: false, jahr: "", stadium: "", blasenentzuendung: false, chronisch: false },
    blasenleiden: { ja: false, jahr: "" },
    miktionsfrequenz: "",
    nykturie: { ja: false, seit: "", anzahlProNacht: "" },
    miktionsbeschwerden: { ja: false, seit: "", brennen: false, schmerz: false, drang: false },
    inkontinenz: { ja: false, seit: "", belastung: false, drang: false, ueberlauf: false },
    haematurie: { ja: false, seit: "" },
    nierensteine: { ja: false, jahr: "" },
    sonstige: "",
  },
  
  // Männergesundheit
  maennergesundheit: {
    prostata: { 
      ja: false, jahr: "", 
      bph: false, prostatitis: false, prostatakarzinom: false, 
      psa: "", sonstige: ""
    },
    hoden: {
      ja: false, jahr: "",
      hodenentzuendung: false, hodentorsion: false, hodenkrebs: false,
      varikozele: false, hydrozele: false, sonstige: ""
    },
    nebenhoden: {
      ja: false, jahr: "",
      epididymitis: false, nebenhodenzyste: false, sonstige: ""
    },
    erektionsstoerung: { ja: false, seit: "" },
    sonstige: "",
  },
  
  // Hormongesundheit
  hormongesundheit: {
    schilddruese: {
      ja: false, jahr: "",
      unterfunktion: false, ueberfunktion: false, hashimoto: false, basedow: false,
      knoten: false, schilddruesenkrebs: false, schilddruesenop: false, radiojodtherapie: false,
      sonstige: ""
    },
    hypophyse: {
      ja: false, jahr: "",
      hypophysenadenom: false, prolaktinom: false, akromegalie: false,
      hypophyseninsuffizienz: false, diabetesInsipidus: false, sonstige: ""
    },
    nebenniere: {
      ja: false, jahr: "",
      nebenniereninsuffizienz: false, cushingSyndrom: false, phaeochromozytom: false,
      nebennierenerschoepfung: false, sonstige: ""
    },
    sonstige: "",
  },
  
  // Wirbelsäule & Gelenke
  wirbelsaeuleGelenke: {
    hws: { ja: false, seit: "", verspannung: false, bsv: false, arthrose: false },
    bws: { ja: false, seit: "", verspannung: false, bsv: false, arthrose: false },
    lws: { ja: false, seit: "", verspannung: false, bsv: false, arthrose: false },
    iliosakral: { ja: false, seit: "" },
    schulter: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    ellbogen: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    handgelenk: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    finger: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    huefte: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    knie: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    fuss: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    zehen: { ja: false, seit: "", rechts: false, links: false, beidseitig: false },
    rheuma: { ja: false, seit: "", stadium: "" },
    sonstige: "",
  },
  
  // Haut & Infektionen
  hautInfektionen: {
    hauterkrankung: { ja: false, jahr: "", details: "" },
    ekzem: { ja: false, jahr: "", atopisch: false, kontakt: false, sonstige: false },
    psoriasis: { ja: false, jahr: "", leicht: false, mittel: false, schwer: false },
    urticaria: { ja: false, seit: "", akut: false, chronisch: false },
    juckreiz: { ja: false, seit: "" },
    akne: { ja: false, seit: "", mild: false, moderat: false, schwer: false },
    rosazea: { ja: false, seit: "" },
    geschlechtskrankheit: { ja: false, jahr: "", behandlung: "" },
    hyperhidrose: { ja: false, seit: "", haende: false, fuesse: false, achseln: false, gesicht: false },
    nachtschweiss: false,
    stressSchweiss: false,
    staendigSchweiss: false,
  },
  
  // IV. Frauengesundheit
  frauengesundheit: {
    geburtsgewicht: "",
    fruehgeburt: { ja: false, woche: "" },
    gebaermuttererkrankung: { ja: false, welche: "" },
    gebaermutterentfernung: { ja: false, jahr: "", teilweise: false, vollstaendig: false },
    eierstockentfernung: { ja: false, jahr: "", einseitig: false, beidseitig: false },
    gebaermutterausschabung: { ja: false, jahr: "", grund: "" },
    eierstockzyste: { ja: false, jahr: "" },
    endometriose: { ja: false, jahr: "", stadium: "" },
    myome: { ja: false, jahr: "" },
    pille: { ja: false, von: "", bis: "" },
    hormonbehandlung: { ja: false, welche: "" },
    periodeNormal: { ja: false, zyklusTage: "" },
    periodeSchwach: { ja: false, tageBlutung: "" },
    periodeStark: false,
    periodeUnregelmaessig: { ja: false, muster: "" },
    periodenbeschwerden: { ja: false, schmerz: false, uebelkeit: false, kopf: false, sonstige: false },
    menopause: { ja: false, beginn: "", symptome: "" },
    schwangerschaften: { anzahl: "", letzte: "" },
    fehlgeburten: { anzahl: "", wann: "" },
    geburten: { anzahl: "", vaginal: false, kaiserschnitt: false },
    wochenbettdepression: { ja: false, nachGeburt: "" },
    sonstige: "",
  },
  
  // V. Unfälle, Operationen & Hospitalisierung
  unfaelleOperationen: {
    unfall: { ja: false, jahr: "", lokalisation: "" },
    knochenbruch: { ja: false, jahr: "", welcher: "" },
    kopfverletzung: { ja: false, jahr: "", schweregrad: "" },
    operationen: [] as { jahr: string; grund: string }[],
    krankenhausaufenthalt: { ja: false, jahr: "", grund: "" },
    kuraufenthalt: { ja: false, jahr: "", art: "" },
    bluttransfusion: { ja: false, jahr: "", grund: "" },
    chemotherapie: { ja: false, jahr: "", art: "" },
    strahlentherapie: { ja: false, bereich: "" },
    ctKontrastmittel: { ja: false, datum: "", grund: "", termine: [] as { datum: string; grund: string; dosis: string }[] },
    szintigraphie: { ja: false, datum: "", grund: "", termine: [] as { datum: string; grund: string; dosis: string }[] },
    petCt: { ja: false, datum: "", grund: "", termine: [] as { datum: string; grund: string; dosis: string }[] },
    radioioddiagnostik: { ja: false, datum: "", grund: "", dosis: "", termine: [] as { datum: string; grund: string; dosis: string }[] },
    radioiodtherapie: { ja: false, datum: "", grund: "", dosis: "", termine: [] as { datum: string; grund: string; dosis: string }[] },
  },
  
  // VI. Krebserkrankung
  krebserkrankung: {
    hatKrebs: false,
    welche: "",
    welcheTyp: "",
    diagnoseJahr: "",
    betroffeneOrgane: "",
    betroffeneOrganeList: [] as string[],
    tnmStadium: { t: "", n: "", m: "" },
    operationDurchgefuehrt: { ja: false, welche: "" },
    operationenList: [] as { jahr: string; art: string }[],
    chemotherapieErhalten: { ja: false, von: "", bis: "", welche: "", typen: [] as string[] },
    strahlentherapieErhalten: { ja: false, bereich: "", dauerWochen: "", typen: [] as string[] },
    metastasen: { ja: false, organe: "", organeList: [] as string[] },
    aktuelleTumortherapie: { ja: false, welche: "", typen: [] as string[] },
    krebsBestaetigung: false,
  },
  
  // VII. Allergien & Unverträglichkeiten
  allergien: {
    inhalation: { ja: false, pollen: false, staub: false, tierhaare: false, schimmel: false },
    tierepithelien: { ja: false, hund: false, katze: false, pferd: false, sonstige: "" },
    nahrungsmittel: { ja: false, details: "", allergene: [] as string[] },
    medikamente: { ja: false, details: "", allergene: [] as string[] },
    kontakt: { ja: false, nickel: false, latex: false, sonstige: "", allergene: [] as string[] },
    laktose: { ja: false, mild: false, moderat: false, schwer: false },
    gluten: { ja: false, diagnostiziert: false },
    fruktose: { ja: false, details: "" },
    histamin: { ja: false, mild: false, moderat: false, schwer: false },
    sonstigeUnvertraeglichkeit: "",
  },
  
  // VIII. Medikamente & Ärztliche Behandlung
  medikamente: {
    inAerztlicherBehandlung: { ja: false, beiWem: "" },
    fachaerzte: "",
    aktuelle: [] as { name: string; dosierung: string; taeglich: boolean; proWoche: string; grund: string; seit: string }[],
    unvertraeglichkeiten: [] as { name: string; allergie: boolean; unvertraeglichkeit: boolean; reaktion: string }[],
  },
  
  // IX. Lebensweise & Gewohnheiten
  lebensweise: {
    raucher: "", // aktiv | ehemals | nein
    raucherSeitWann: "",
    zigarettenProTag: "",
    exRaucherBisWann: "",
    passivRauchen: "",
    passivRauchenTypen: [] as string[],
    passivRauchenSonstiges: "",
    alkohol: { 
      ja: false, 
      seitWann: "", 
      mengeProTag: "", 
      typ: "",
      typen: [] as { typ: string; menge: string }[]
    },
    sport: { 
      ja: false, 
      proWoche: "", 
      art: "",
      arten: [] as string[],
      sonstige: ""
    },
    taeglicheBewegung: { ja: false, details: "" },
    spaziergang: { ja: false, proWoche: "", dauerMinuten: "" },
    meterZuFuss: "",
    schlafQualitaet: "",
    schlafDauer: "",
    stressLevel: "",
    ernaehrungsgewohnheiten: "",
    ernaehrungsTypen: [] as string[],
    ernaehrungSonstiges: "",
  },
  
  // X. Umweltbelastungen & Sensitivitäten
  umweltbelastungen: {
    chemosensibilitaet: {
      dieselAbgase: { ja: false, staerke: "" },
      tabakrauch: { ja: false, staerke: "" },
      pestizide: { ja: false, staerke: "" },
      benzin: { ja: false, staerke: "" },
      farben: { ja: false, staerke: "" },
      desinfektionsmittel: { ja: false, staerke: "" },
      reiniger: { ja: false, staerke: "" },
      parfuems: { ja: false, staerke: "" },
      teer: { ja: false, staerke: "" },
      nagellack: { ja: false, staerke: "" },
      haarspray: { ja: false, staerke: "" },
      neueRaumausstattung: { ja: false, staerke: "" },
      kunststoff: { ja: false, staerke: "" },
      neuesAuto: { ja: false, staerke: "" },
    },
    koerperbelastungen: {
      strahlung: { ja: false, geopathie: false, elektrosmog: false, hochspannung: false, funkmasten: false, wlan: false },
      zahnherde: { ja: false, wurzelbehandlungen: false, welcheZaehne: "" },
      quecksilber: { ja: false, welcheZaehne: "" },
      zahnbeschwerden: { ja: false, welcheZaehne: "" },
      metalleImMund: { ja: false, welcheZaehne: "" },
      implantate: { ja: false, welcheZaehne: "" },
      nebenhoehlen: { ja: false, stirn: false, kiefer: false, beide: false },
      tonsillen: { ja: false, details: "" },
      narben: { ja: false, lokalisation: "" },
      mangelzustaende: { ja: false, vitamine: false, mineralien: false, spurenelemente: false, enzyme: false, fluessigkeit: false },
      mikroorganismen: { ja: false, viren: false, bakterien: false, pilze: false, parasiten: false },
      toxisch: { ja: false, schwermetalle: false, chemikalien: false, pestizide: false, erbtoxine: false },
    },
  },
  
  // XI. Infektionskrankheiten & Zoonosen
  infektionen: {
    tropenReise: { ja: false, jahr: "", laender: "", laenderList: [] as string[] },
    zeckenbiss: { ja: false, seit: "", roterHof: false },
    borreliose: { ja: false, jahr: "", stadium: "" },
    fsmeImpfung: { ja: false, jahr: "" },
    hund: { ja: false, rasse: "" },
    katze: { ja: false, rasse: "" },
    pferd: { ja: false, kontakt: "" },
    andereHaustiere: { ja: false, welche: "" },
  },
  
  // XII. Impfstatus & COVID-19
  impfungen: {
    mmr: { ja: false, jahr: "" },
    tetanus: { ja: false, jahr: "" },
    diphtherie: { ja: false, jahr: "" },
    keuchhusten: { ja: false, jahr: "" },
    polio: { ja: false, jahr: "" },
    hepatitisA: { ja: false, jahr: "" },
    hepatitisB: { ja: false, jahr: "" },
    windpocken: { ja: false, jahr: "" },
    influenza: { ja: false, zuletzt: "" },
    pneumokokken: { ja: false, jahr: "" },
    covid: {
      geimpft: false,
      dosis1: { ja: false, datum: "", hersteller: "" },
      dosis2: { ja: false, datum: "", hersteller: "" },
      dosis3: { ja: false, datum: "", hersteller: "" },
      dosis4: { ja: false, datum: "", hersteller: "" },
      weitereAnzahl: "",
      impfreaktionen: { ja: false, art: "" },
      infiziert: { ja: false, wann: "", schwere: "" },
      longCovid: { ja: false, welche: "" },
    },
  },
  
  // XIII. Beschwerden & Beschwerdebeschreibung
  beschwerden: {
    hauptbeschwerde: "",
    weitereBeschwerden: "",
    beginnDerBeschwerden: "",
    verlauf: "", // konstant | zunehmend | abnehmend | wechselhaft
    auftreten: [] as string[], // ständig, tagsüber, nachts, nach Mahlzeiten, bei Belastung, in Ruhephasen, unregelmäßig
    ausstrahlung: "",
    artDerBeschwerden: [] as string[], // Schmerz, körperliche Störung, Funktionsstörung, psychische Belastung
    schmerzqualitaet: [] as string[], // dumpf, stechend, brennend, ziehend, krampfartig, elektrisierend
    schmerzintensitaet: "", // 0-10
    verschlimmerung: [] as string[], // Kälte, Wärme, Anstrengung, Ruhe, Mahlzeiten, bestimmte Nahrung, Stress, Wetter, Tageszeit
    verbesserung: [] as string[], // Kälte, Wärme, Bewegung, Ruhe, spezifische Nahrung, Lagerung, Meditation, bestimmte Aktivität
    bisherigeBehandlungen: "",
    ergebnisBisherigerBehandlungen: "", // gut geholfen, teilweise geholfen, nicht geholfen, verschlimmert
  },
  
  // XIV. Behandlungspräferenzen
  behandlungspraeferenzen: {
    homoeopathie: { interesse: false, erfahren: false },
    biophysikalisch: { interesse: false, erfahren: false },
    metatron: { interesse: false, erfahren: false },
    trikombin: { interesse: false, erfahren: false },
    zapper: { interesse: false, erfahren: false },
    eav: { interesse: false, erfahren: false },
    mineralTestung: { interesse: false, erfahren: false },
    akupunktur: { interesse: false, erfahren: false },
    phytotherapie: { interesse: false, erfahren: false },
    bachblueten: { interesse: false, erfahren: false },
    sanum: { interesse: false, erfahren: false },
    hypnotherapie: { interesse: false, erfahren: false },
  },
  therapieerwartungen: "",
  gesundheitsziele: "",
  
  // Zahngesundheit
  zahngesundheit: {
    gebissTyp: "", // vollstaendig | teilprothese | vollprothese
    protheseKiefer: { oberkiefer: false, unterkiefer: false, beideKiefer: false },
    protheseSeit: "",
    zahnbefunde: {} as Record<string, { diagnoses: string[]; seit?: string; bemerkung?: string }>,
    parodontitis: { ja: false, seitYear: "", seitMonth: "", status: "", bisYear: "", bisMonth: "", leicht: false, mittel: false, schwer: false },
    zahnfleischbluten: { ja: false, seitYear: "", seitMonth: "", status: "", bisYear: "", bisMonth: "" },
    kiefergelenk: { ja: false, knacken: false, schmerzen: false, eingeschraenkt: false },
    bruxismus: { ja: false, nachts: false, tagsueber: false, schiene: false },
    letzterZahnarztbesuch: "",
    zahnarztName: "",
    bemerkungen: "",
  },

  // XV. Weitere Erkrankungen/Symptome
  weitereErkrankungen: "",
  
  // Persönliche Umstände & Soziales
  soziales: {
    familienstand: "",
    kinderAnzahl: "",
    kinderAlter: "",
    wohnumfeld: "", // Stadt, Vorstadt, Land
    wohntyp: "", // Haus, Wohnung, Sonstige
    berufStress: "", // keine, mild, moderat, extrem
    finanzBelastung: "", // keine, mild, moderat, erheblich
    sozialesNetzwerk: "", // gut, ausreichend, begrenzt, isoliert
    hobbys: "",
  },
  
  // XVI. Unterschrift & Bestätigung
  unterschrift: {
    ort: "Augsburg",
    datum: "",
    nameInDruckbuchstaben: "",
    geburtsdatumUnterzeichner: "", // Bei Minderjährigen: Geb.datum des Sorgeberechtigten
    bestaetigung: false,
    datenschutzEinwilligung: false,
    patientenaufklaerungAkzeptiert: false,
    bestaetigung2fa: false,
    erziehungsberechtigter: "",
  },
  
  // Zusätzliche Informationen
  zusaetzlicheInfos: "",
};

export type AnamneseFormData = typeof initialFormData;
