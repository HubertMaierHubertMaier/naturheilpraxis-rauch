export type TherapySafetySeverity = "avoid" | "review" | "monitor";

export type TherapySafetyContext = {
  medications?: unknown;
  conditions?: unknown;
  symptoms?: unknown;
  pregnancy?: unknown;
  age?: unknown;
};

export type TherapySafetyWarning = {
  id: string;
  severity: TherapySafetySeverity;
  title: string;
  message: string;
  action: string;
  source: string;
};

type MedicationGroup = {
  id: string;
  label: string;
  pattern: RegExp;
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const MEDICATION_GROUPS: MedicationGroup[] = [
  { id: "anticoagulant", label: "Antikoagulanzien", pattern: /\b(?:phenprocoumon|marcumar|warfarin|apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|dabigatran|pradaxa|heparin|enoxaparin|clexane)\b/i },
  { id: "antiplatelet", label: "Thrombozytenaggregationshemmer", pattern: /\b(?:acetylsalicylsaure|ass\s*(?:100)?|aspirin|clopidogrel|plavix|ticagrelor|brilique|prasugrel|efient)\b/i },
  { id: "diuretic", label: "Diuretika", pattern: /\b(?:furosemid|lasix|torasemid|hydrochlorothiazid|hct\b|indapamid|chlortalidon)\b/i },
  { id: "potassium_sparing", label: "kaliumsparende Diuretika", pattern: /\b(?:spironolacton|aldactone|eplerenon|amilorid|triamteren)\b/i },
  { id: "ace_arb", label: "ACE-Hemmer/Sartane", pattern: /\b(?:ramipril|enalapril|lisinopril|captopril|perindopril|candesartan|valsartan|losartan|telmisartan|olmesartan|irbesartan)\b/i },
  { id: "cardiac_glycoside", label: "Herzglykoside", pattern: /\b(?:digoxin|digitoxin)\b/i },
  { id: "corticosteroid", label: "systemische Kortikosteroide", pattern: /\b(?:prednison|prednisolon|dexamethason|methylprednisolon|hydrocortison)\b/i },
  { id: "sedative", label: "sedierende Arzneimittel", pattern: /\b(?:diazepam|lorazepam|tavor|oxazepam|alprazolam|bromazepam|zopiclon|zolpidem|quetiapin|promethazin|doxylamin)\b/i },
  { id: "serotonergic", label: "serotonerge Arzneimittel", pattern: /\b(?:sertralin|citalopram|escitalopram|fluoxetin|paroxetin|venlafaxin|duloxetin|tramadol|triptan|sumatriptan)\b/i },
  { id: "immunosuppressant", label: "Immunsuppressiva", pattern: /\b(?:ciclosporin|cyclosporin|tacrolimus|sirolimus|everolimus|mycophenolat|azathioprin)\b/i },
  { id: "antiepileptic", label: "Antiepileptika", pattern: /\b(?:carbamazepin|oxcarbazepin|phenytoin|phenobarbital|valproat|lamotrigin|levetiracetam)\b/i },
  { id: "hormonal_contraceptive", label: "hormonelle Kontrazeptiva", pattern: /\b(?:antibabypille|kontrazeptiv|ethinylestradiol|levonorgestrel|desogestrel|dienogest)\b/i },
  { id: "diabetes", label: "Antidiabetika", pattern: /\b(?:insulin|metformin|glimepirid|gliclazid|empagliflozin|dapagliflozin|semaglutid|ozempic|tirzepatid|mounjaro)\b/i },
  { id: "thyroid", label: "Schilddruesenhormone", pattern: /\b(?:levothyroxin|l-thyroxin|euthyrox|thyronajod|liothyronin)\b/i },
  { id: "oncology", label: "onkologische Arzneimittel", pattern: /\b(?:abemaciclib|verzenios|letrozol|tamoxifen|anastrozol|exemestan|palbociclib|ribociclib|capecitabin|methotrexat|docetaxel|cabazitaxel)\b/i },
  { id: "androgen_deprivation", label: "Androgendeprivation/Prostataonkologie", pattern: /\b(?:leuprorelin|leuprolid|triptorelin|goserelin|degarelix|relugolix|bicalutamid|enzalutamid|apalutamid|darolutamid|abirateron)\b/i },
];

const warning = (
  id: string,
  severity: TherapySafetySeverity,
  title: string,
  message: string,
  action: string,
  source: string,
): TherapySafetyWarning => ({ id, severity, title, message, action, source });

export const recognizeMedicationGroups = (medications: unknown) => {
  const text = normalize(medications);
  return MEDICATION_GROUPS.filter((group) => group.pattern.test(text)).map(({ id, label }) => ({ id, label }));
};

const hasGroup = (groups: Array<{ id: string }>, ...ids: string[]) => groups.some((group) => ids.includes(group.id));

const isPregnantOrBreastfeeding = (value: unknown) => {
  const text = normalize(value).trim();
  return Boolean(text) && !/^(?:nein|no|nicht|keine|unbekannt)$/.test(text);
};

const parsedAge = (value: unknown) => {
  const match = String(value ?? "").match(/\d{1,3}/);
  return match ? Number(match[0]) : null;
};

const prostateCancerPattern = /\b(?:prostatakarzinom|prostata\s*ca|prostate\s+cancer|c61)\b/i;
const prostateCancerNegationPattern = /(?:kein(?:e|en|er|es)?|ohne|ausschluss\s+von)\s+[^.;\n]{0,30}(?:prostatakarzinom|prostata\s*ca|prostate\s+cancer|c61)|(?:prostatakarzinom|prostata\s*ca|prostate\s+cancer|c61)[^.;\n]{0,35}(?:ausgeschlossen|verneint)/i;
const hasPositiveProstateCancerContext = (value: unknown) => normalize(value)
  .split(/[;.\n]+|\b(?:aber|jedoch|hingegen)\b/)
  .map((clause) => clause.trim())
  .filter(Boolean)
  .some((clause) => prostateCancerPattern.test(clause) && !prostateCancerNegationPattern.test(clause));

export const assessRemedySafety = (
  remedyName: unknown,
  context: TherapySafetyContext,
): TherapySafetyWarning[] => {
  const remedy = normalize(remedyName);
  if (!remedy.trim()) return [];
  const medications = recognizeMedicationGroups(context.medications);
  const clinicalText = normalize(`${String(context.conditions ?? "")} ${String(context.symptoms ?? "")}`);
  const warnings: TherapySafetyWarning[] = [];
  const add = (item: TherapySafetyWarning) => {
    if (!warnings.some((existing) => existing.id === item.id)) warnings.push(item);
  };

  const prostateCancerContext = hasPositiveProstateCancerContext(clinicalText);
  const testosteroneSupporting = /\b(?:testosteron|dhea|dehydroepiandrosteron|maca|lepidium\s+meyenii|tribulus)\b/i.test(remedy);
  if (testosteroneSupporting && (prostateCancerContext || hasGroup(medications, "androgen_deprivation"))) {
    add(warning(
      "prostate-cancer-testosterone-support",
      "avoid",
      "Testosteron-stuetzender Kandidat bei Prostatakarzinom/ADT",
      "Eine hormonell ausgerichtete Ergaenzung kann im dokumentierten Prostatakarzinom- oder Androgendeprivationskontext fachlich relevant sein und darf nicht automatisch als Kernkandidat erscheinen.",
      "Nicht automatisch auswaehlen; konkretes Mittel, Behandlungsphase, PSA-/Testosteronverlauf und onkologische Therapie mit dem behandelnden Fachteam pruefen.",
      "Interne onkologische Sicherheitsregel; konkrete Fach- und Produktinformation pruefen.",
    ));
  }

  const liquorice = /\b(?:lakritz|su(?:ss|ß|ess)holz|glycyrrhizin|liquorice|licorice)\b/i.test(remedy);
  if (liquorice && /\b(?:hyperton|bluthochdruck|arterielle\s+hypertonie)\b/i.test(clinicalText)) {
    add(warning(
      "liquorice-hypertension",
      "avoid",
      "Lakritz/Suessholz bei Bluthochdruck",
      "Glycyrrhizin kann Blutdruckanstieg, Natriumretention und Kaliumverlust beguenstigen.",
      "Nicht automatisch auswaehlen; individuelle Eignung und glycyrrhizinfreie Alternative pruefen.",
      "EMA-HMPC-Monographie Glycyrrhizae radix und konkrete Produktinformation pruefen.",
    ));
  }
  if (liquorice && hasGroup(medications, "diuretic", "cardiac_glycoside", "corticosteroid")) {
    add(warning(
      "liquorice-medication",
      "review",
      "Lakritz/Suessholz mit relevanter Medikation",
      "Bei Diuretika, Herzglykosiden oder systemischen Kortikosteroiden sind Kalium- und Blutdruckeffekte besonders zu beachten.",
      "Medikationsplan, Kalium, Blutdruck und konkrete Fachinformation vor Auswahl pruefen.",
      "EMA-HMPC-Monographie Glycyrrhizae radix und Fachinformation der Arzneimittel pruefen.",
    ));
  }

  const bleedingRelevant = /\b(?:ginkgo|knoblauch|ginger|ingwer|curcu|min|kurkuma|bromelain|papain|nattokinase|omega\s*-?\s*3|fischol|weidenrinde|salicyl)\b/i.test(remedy);
  if (bleedingRelevant && hasGroup(medications, "anticoagulant", "antiplatelet")) {
    add(warning(
      "bleeding-medication",
      "review",
      "Moeglicher Einfluss auf Blutung/Gerinnung",
      "Das Mittel kann je nach Produkt, Dosis und Patient die Blutungsneigung oder Gerinnung beeinflussen.",
      "Nicht automatisch auswaehlen; Wirkstoff, Dosis, Operationsplanung und Fachinformation gezielt pruefen.",
      "Fachinformation des Antikoagulans/Thrombozytenhemmers und produktspezifische Sicherheitsinformation pruefen.",
    ));
  }

  const stJohnsWort = /\b(?:johanniskraut|hypericum)\b/i.test(remedy);
  if (stJohnsWort && hasGroup(medications, "anticoagulant", "serotonergic", "immunosuppressant", "antiepileptic", "hormonal_contraceptive", "oncology")) {
    add(warning(
      "st-johns-wort-interaction",
      "avoid",
      "Johanniskraut mit relevanter Arzneimitteltherapie",
      "Johanniskraut kann Arzneimitteltransporter und Enzyme beeinflussen; Wirkverlust oder unerwuenschte serotonerge Effekte sind moeglich.",
      "Nicht automatisch auswaehlen; konkrete Kombination anhand beider Fachinformationen pruefen.",
      "EMA-HMPC-Monographie Hyperici herba und Fachinformation der betroffenen Arzneimittel pruefen.",
    ));
  }

  const potassium = /\b(?:kalium|potassium)\b/i.test(remedy);
  if (potassium && hasGroup(medications, "ace_arb", "potassium_sparing")) {
    add(warning(
      "potassium-medication",
      "review",
      "Kalium mit kaliumsteigernder Medikation",
      "ACE-Hemmer, Sartane und kaliumsparende Diuretika koennen zusammen mit Kalium das Hyperkaliaemie-Risiko erhoehen.",
      "Kaliumwert, Nierenfunktion, Dosis und Fachinformation vor Auswahl pruefen.",
      "Fachinformation der konkreten Arzneimittel und des Kaliumprodukts pruefen.",
    ));
  }

  const sedating = /\b(?:baldrian|valeriana|hopfen|humulus|passionsblume|passiflora|kava|melatonin|lavendel)\b/i.test(remedy);
  if (sedating && hasGroup(medications, "sedative")) {
    add(warning(
      "sedative-combination",
      "review",
      "Moegliche additive Sedierung",
      "Zusammen mit sedierenden Arzneimitteln koennen Muedigkeit und Reaktionsbeeintraechtigung zunehmen.",
      "Einnahmezeit, Dosis, Fahrtuechtigkeit und Sturzrisiko pruefen.",
      "Fach- und Gebrauchsinformation der konkreten Produkte pruefen.",
    ));
  }

  const glucoseLowering = /\b(?:berberin|bittermelone|momordica|chrom(?:ium)?|gluco)\b/i.test(remedy);
  if (glucoseLowering && hasGroup(medications, "diabetes")) {
    add(warning(
      "glucose-medication",
      "review",
      "Moegliche additive Blutzuckersenkung",
      "Bei gleichzeitiger antidiabetischer Therapie kann eine verstaerkte Blutzuckersenkung moeglich sein.",
      "Blutzuckerverlauf, Dosis und individuelle Hypoglykaemie-Risiken pruefen.",
      "Fachinformation der Antidiabetika und produktspezifische Sicherheitsinformation pruefen.",
    ));
  }

  const iodine = /\b(?:jod|iodine|kelp|alge)\b/i.test(remedy);
  if (iodine && (hasGroup(medications, "thyroid") || /\b(?:schilddruse|hyperthyreose|hashimoto|morbus\s+basedow)\b/i.test(clinicalText))) {
    add(warning(
      "iodine-thyroid",
      "review",
      "Jod bei Schilddruesenerkrankung/-medikation",
      "Die Eignung haengt von Diagnose, Jodmenge, Schilddruesenfunktion und Medikation ab.",
      "Produktdosis, TSH/fT3/fT4 und konkrete Diagnose vor Auswahl pruefen.",
      "Fachinformation und produktspezifische Jodmenge pruefen.",
    ));
  }

  const pregnancyRisk = /\b(?:wermut|artemisia|schwarze?\s+walnuss|juglans|beifuss|rainfarn|tanacetum|hochdosiert(?:es)?\s+vitamin\s+a)\b/i.test(remedy);
  if (pregnancyRisk && isPregnantOrBreastfeeding(context.pregnancy)) {
    add(warning(
      "pregnancy-remedy",
      "avoid",
      "Nicht automatisch bei Schwangerschaft/Stillzeit",
      "Fuer dieses Mittel besteht im aktuellen Kontext ein besonderer Sicherheitsvorbehalt.",
      "Nicht auswaehlen, bevor konkrete Produktinformation und individuelle Situation geprueft sind.",
      "Konkrete Fach-/Gebrauchsinformation und aktuelle Fachquelle pruefen.",
    ));
  }

  const age = parsedAge(context.age);
  if (age !== null && age < 6 && /\b(?:atherisch|aetherisch|tinktur|alkohol|wermut|artemisia)\b/i.test(remedy)) {
    add(warning(
      "young-child-remedy",
      "avoid",
      "Altersbezogener Sicherheitsstopp",
      "Aetherische Oele, alkoholische Tinkturen und bestimmte Pflanzenmittel sind bei kleinen Kindern besonders kritisch.",
      "Nicht automatisch auswaehlen; Alter, Produktzulassung und kindgerechte Alternative pruefen.",
      "Konkrete Fach-/Gebrauchsinformation und paediatrische Fachquelle pruefen.",
    ));
  }

  return warnings;
};

export const buildSafetyContextWarnings = (context: TherapySafetyContext): TherapySafetyWarning[] => {
  const medicationText = normalize(context.medications).trim();
  const warnings: TherapySafetyWarning[] = [];
  if (!medicationText) {
    warnings.push(warning(
      "missing-medication-list",
      "monitor",
      "Medikationsliste fehlt",
      "Ohne aktuelle Arzneimittelliste ist keine belastbare Wechselwirkungspruefung moeglich.",
      "Vor Finalisierung aktuelle Arzneimittel, Dosen und Einnahmezeiten erfassen.",
      "Interne Sicherheitsregel.",
    ));
  } else if (!recognizeMedicationGroups(medicationText).length) {
    warnings.push(warning(
      "unrecognized-medication-list",
      "review",
      "Medikation nicht strukturiert erkannt",
      "Die Arzneimittelliste ist vorhanden, konnte aber keiner hinterlegten Wirkstoffgruppe sicher zugeordnet werden.",
      "Wirkstoffnamen und Dosierungen manuell kontrollieren; Warnsystem nicht als vollstaendig betrachten.",
      "Interne Sicherheitsregel.",
    ));
  }
  const clinicalText = normalize(`${String(context.conditions ?? "")} ${String(context.symptoms ?? "")}`);
  const hasProstateCancer = hasPositiveProstateCancerContext(clinicalText);
  const hasAdtMedication = recognizeMedicationGroups(medicationText).some((group) => group.id === "androgen_deprivation");
  if (hasProstateCancer || hasAdtMedication) {
    warnings.push(warning(
      "prostate-cancer-hormonal-candidate-review",
      "review",
      "Prostatakarzinom/Androgendeprivation dokumentiert",
      "Hormonell oder testosteron-stuetzend ausgerichtete Mittel duerfen nicht automatisch als Kernkandidaten uebernommen werden.",
      "PSA, Gesamt-Testosteron, Behandlungsphase und onkologische Medikation vor der finalen Auswahl gemeinsam fachlich pruefen.",
      "Interne onkologische Sicherheitsregel.",
    ));
  }
  return warnings;
};

export const severityLabel = (severity: TherapySafetySeverity) => (
  severity === "avoid" ? "Nicht automatisch auswaehlen" : severity === "review" ? "Fachlich pruefen" : "Beobachten"
);
