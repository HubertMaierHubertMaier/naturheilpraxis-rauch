import jsPDF from "jspdf";
import { AnamneseFormData } from "./anamneseFormData";
import { iaaCategories } from "./iaaQuestions";

const BRAND_PRIMARY = { r: 76, g: 140, b: 74 };
const BRAND_SECONDARY = { r: 91, g: 173, b: 88 };
const BRAND_TEXT = { r: 51, g: 51, b: 51 };
const BRAND_MUTED = { r: 120, g: 120, b: 120 };

interface PdfExportOptions {
  formData: AnamneseFormData;
  language: "de" | "en";
  logoBase64?: string;
  iaaData?: Record<string, number>;
}

const PRACTICE_INFO = {
  name: "Naturheilpraxis Peter Rauch",
  owner: "Peter Rauch, Heilpraktiker",
  street: "Friedrich-Deffner-Straße 19a",
  city: "86163 Augsburg",
  phone: "0821-2621462",
  email: "praxis_rauch@icloud.com",
  web: "www.rauch-heilpraktiker.de"
};

// ============ Shared PDF builder ============

class AnamnesePdfBuilder {
  private doc: jsPDF;
  private yPos: number;
  private language: "de" | "en";
  private pageWidth: number;
  private pageHeight: number;
  private margin = 20;
  private contentWidth: number;
  private headerHeight = 35;
  private footerHeight = 25;
  private lineHeight = 6;

  constructor(language: "de" | "en") {
    this.doc = new jsPDF();
    this.language = language;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.yPos = this.headerHeight + 10;
  }

  t(de: string, en: string) { return this.language === "de" ? de : en; }

  /** Strip emojis and replace problematic Unicode chars for jsPDF Helvetica */
  sanitizeForPdf(text: string): string {
    return text
      // Remove emojis and other non-BMP characters
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
      .replace(/[\u{200D}]/gu, "")
      // Common German char replacements that Helvetica handles
      .replace(/\u00A0/g, " ") // non-breaking space
      .replace(/\u2013/g, "-") // en dash
      .replace(/\u2014/g, "-") // em dash
      .replace(/\u201C/g, '"') // left double quote
      .replace(/\u201D/g, '"') // right double quote
      .replace(/\u2018/g, "'") // left single quote
      .replace(/\u2019/g, "'") // right single quote
      .replace(/\u2026/g, "...") // ellipsis
      .trim()
      .replace(/\s{2,}/g, " ");
  }

  addHeader() {
    this.doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.rect(0, 0, this.pageWidth, this.headerHeight, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(PRACTICE_INFO.name, this.margin, 15);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(PRACTICE_INFO.owner, this.margin, 22);
    this.doc.setFontSize(8);
    this.doc.text(PRACTICE_INFO.street, this.pageWidth - this.margin, 12, { align: "right" });
    this.doc.text(PRACTICE_INFO.city, this.pageWidth - this.margin, 17, { align: "right" });
    this.doc.text(`Tel: ${PRACTICE_INFO.phone}`, this.pageWidth - this.margin, 22, { align: "right" });
    this.doc.text(PRACTICE_INFO.email, this.pageWidth - this.margin, 27, { align: "right" });
    this.doc.setDrawColor(BRAND_SECONDARY.r, BRAND_SECONDARY.g, BRAND_SECONDARY.b);
    this.doc.setLineWidth(1);
    this.doc.line(0, this.headerHeight, this.pageWidth, this.headerHeight);
  }

  addFooter(pageNum: number, totalPages: number) {
    const footerY = this.pageHeight - this.footerHeight;
    this.doc.setDrawColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);
    this.doc.setTextColor(BRAND_MUTED.r, BRAND_MUTED.g, BRAND_MUTED.b);
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(PRACTICE_INFO.web, this.margin, footerY + 8);
    this.doc.text(this.t(`Seite ${pageNum} von ${totalPages}`, `Page ${pageNum} of ${totalPages}`), this.pageWidth / 2, footerY + 8, { align: "center" });
    const dateStr = new Date().toLocaleDateString(this.language === "de" ? "de-DE" : "en-US");
    this.doc.text(this.t(`Erstellt: ${dateStr}`, `Created: ${dateStr}`), this.pageWidth - this.margin, footerY + 8, { align: "right" });
    this.doc.setFontSize(7);
    this.doc.text(this.t("Dieses Dokument wurde elektronisch erstellt und ist ohne Unterschrift gültig.", "This document was created electronically and is valid without signature."), this.pageWidth / 2, footerY + 14, { align: "center" });
  }

  checkPageBreak(requiredSpace: number) {
    if (this.yPos + requiredSpace > this.pageHeight - this.footerHeight - 10) {
      this.doc.addPage();
      this.addHeader();
      this.yPos = this.headerHeight + 10;
    }
  }

  addSectionHeader(text: string, emoji?: string) {
    this.checkPageBreak(25);
    this.doc.setFillColor(245, 250, 245);
    this.doc.rect(this.margin - 2, this.yPos - 5, this.contentWidth + 4, 12, "F");
    this.doc.setDrawColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, this.yPos + 5, this.pageWidth - this.margin, this.yPos + 5);
    this.doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    // Strip emojis – jsPDF Helvetica doesn't support them
    this.doc.text(this.sanitizeForPdf(text), this.margin, this.yPos + 2);
    this.yPos += 15;
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
  }

  addSubHeader(text: string) {
    this.checkPageBreak(15);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(BRAND_SECONDARY.r, BRAND_SECONDARY.g, BRAND_SECONDARY.b);
    this.doc.text(text, this.margin, this.yPos);
    this.yPos += this.lineHeight + 2;
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
  }

  addField(label: string, value: string | boolean | number | undefined | null, indent = 0) {
    if (value === undefined || value === null || value === "" || value === false) return;
    this.checkPageBreak(10);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    const displayValue = value === true ? this.t("Ja", "Yes") : this.sanitizeForPdf(String(value));
    const safeLabel = this.sanitizeForPdf(label);
    const labelText = `${safeLabel}: `;
    this.doc.text(labelText, this.margin + indent, this.yPos);
    // Measure label width while still in bold font to match rendered width
    const labelWidth = this.doc.getTextWidth(labelText);
    this.doc.setFont("helvetica", "normal");
    const valueX = this.margin + indent + labelWidth;
    const maxValueWidth = this.contentWidth - labelWidth - indent;
    const lines = this.doc.splitTextToSize(displayValue, Math.max(maxValueWidth, 30));
    this.doc.text(lines, valueX, this.yPos);
    this.yPos += lines.length * this.lineHeight;
  }

  addFieldAlways(label: string, value: string | boolean | number | undefined | null, indent = 0) {
    this.checkPageBreak(10);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    const displayValue = value === true ? this.t("Ja", "Yes") : value === false ? this.t("Nein", "No") : this.sanitizeForPdf(String(value || "-"));
    const safeLabel = this.sanitizeForPdf(label);
    const labelText = `${safeLabel}: `;
    this.doc.text(labelText, this.margin + indent, this.yPos);
    // Measure label width while still in bold font to match rendered width
    const labelWidth = this.doc.getTextWidth(labelText);
    this.doc.setFont("helvetica", "normal");
    const valueX = this.margin + indent + labelWidth;
    const maxValueWidth = this.contentWidth - labelWidth - indent;
    const lines = this.doc.splitTextToSize(String(displayValue), Math.max(maxValueWidth, 30));
    this.doc.text(lines, valueX, this.yPos);
    this.yPos += lines.length * this.lineHeight;
  }

  addCheckboxField(label: string, checked: boolean | undefined, indent = 5) {
    if (!checked) return;
    this.checkPageBreak(8);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    const s = 3;
    this.doc.setDrawColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.rect(this.margin + indent, this.yPos - 3, s, s);
    this.doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    this.doc.rect(this.margin + indent + 0.5, this.yPos - 2.5, s - 1, s - 1, "F");
    this.doc.text(this.sanitizeForPdf(label), this.margin + indent + s + 3, this.yPos);
    this.yPos += this.lineHeight;
  }

  addSpacing(space: number = this.lineHeight) { this.yPos += space; }

  addNoData(text?: string) {
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "italic");
    this.doc.setTextColor(BRAND_MUTED.r, BRAND_MUTED.g, BRAND_MUTED.b);
    this.doc.text(text || this.t("Keine Angaben", "No information provided"), this.margin, this.yPos);
    this.yPos += this.lineHeight;
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    this.doc.setFont("helvetica", "normal");
  }

  /** Convert camelCase keys to readable labels */
  private prettifyKey(key: string): string {
    // Known label map for common sub-field keys (DE/EN)
    const labelMap: Record<string, [string, string]> = {
      // Head & Senses
      hinterkopf: ["Hinterkopf", "Back of Head"], stirn: ["Stirn", "Forehead"],
      rechts: ["rechts", "right"], links: ["links", "left"], beidseitig: ["beidseitig", "bilateral"],
      migraene: ["Migräne", "Migraine"], spannungskopfschmerz: ["Spannungskopfschmerz", "Tension Headache"],
      clusterkopfschmerz: ["Clusterkopfschmerz", "Cluster Headache"], medikamenteninduziert: ["medikamenteninduziert", "medication-induced"],
      trigeminus: ["Trigeminus", "Trigeminal"], glossopharyngeus: ["Glossopharyngeus", "Glossopharyngeal"],
      occipitalis: ["Occipitalis", "Occipital"], postzoster: ["Post-Zoster", "Post-Zoster"],
      atypischerGesichtsschmerz: ["Atypischer Gesichtsschmerz", "Atypical Facial Pain"],
      netzhaut: ["Netzhaut", "Retina"], grauerStar: ["Grauer Star", "Cataract"], gruenerStar: ["Grüner Star", "Glaucoma"],
      makula: ["Makula", "Macula"], bindehautentzuendung: ["Bindehautentzündung", "Conjunctivitis"],
      hornhautentzuendung: ["Hornhautentzündung", "Keratitis"], iritis: ["Iritis", "Iritis"],
      sehnerventzuendung: ["Sehnerventzündung", "Optic Neuritis"], trockeneAugen: ["Trockene Augen", "Dry Eyes"],
      sehstoerung: ["Sehstörung", "Vision Disorder"],
      tinnitus: ["Tinnitus", "Tinnitus"], hoersturz: ["Hörsturz", "Sudden Hearing Loss"],
      mittelohrentzuendung: ["Mittelohrentzündung", "Otitis Media"], morbusMeniere: ["Morbus Menière", "Menière's Disease"],
      otosklerose: ["Otosklerose", "Otosclerosis"], gehoergangentzuendung: ["Gehörgangentzündung", "External Otitis"],
      trommelfell: ["Trommelfelldefekt", "Eardrum Defect"],
      chronisch: ["chronisch", "chronic"], akut: ["akut", "acute"],
      // Sleep & Psyche
      einschlaf: ["Einschlaf", "Falling asleep"], durchschlaf: ["Durchschlaf", "Staying asleep"],
      einUndDurchschlaf: ["Ein- und Durchschlaf", "Both"], aufwachZeit: ["Aufwachzeit", "Wake-up time"],
      morgens: ["morgens", "morning"], tagsueber: ["tagsüber", "daytime"], abends: ["abends", "evening"],
      staendig: ["ständig", "constant"], beruflich: ["beruflich", "work-related"], privat: ["privat", "private"],
      beides: ["beides", "both"], kurzfristig: ["kurzfristig", "short-term"], langfristig: ["langfristig", "long-term"],
      libidoverlust: ["Libidoverlust", "Loss of Libido"], potenzstörung: ["Potenzstörung", "Potency Disorder"],
      prozentVergleich: ["Leistung %", "Performance %"],
      // Psyche
      behandlung: ["In Behandlung", "Under Treatment"], psychotherapie: ["Psychotherapie", "Psychotherapy"],
      agoraphobie: ["Agoraphobie", "Agoraphobia"], sozialePhobie: ["Soziale Phobie", "Social Phobia"],
      spezifisch: ["Spezifisch", "Specific"], schulisch: ["schulisch", "at school"],
      // Heart
      systolisch: ["Systolisch", "Systolic"], diastolisch: ["Diastolisch", "Diastolic"],
      symptome: ["Symptome", "Symptoms"], grad: ["Grad", "Grade"],
      vorhofflimmern: ["Vorhofflimmern", "Atrial Fibrillation"], extrasystolen: ["Extrasystolen", "Extrasystoles"],
      belastung: ["bei Belastung", "on exertion"], ruhe: ["in Ruhe", "at rest"],
      anzahl: ["Anzahl", "Count"], aorta: ["Aorta", "Aortic"], mitral: ["Mitral", "Mitral"],
      trikuspidal: ["Trikuspidal", "Tricuspid"], aortenklappe: ["Aortenklappe", "Aortic Valve"],
      mitralklappe: ["Mitralklappe", "Mitral Valve"], trikuspidalklappe: ["Trikuspidalklappe", "Tricuspid Valve"],
      pulmonalklappe: ["Pulmonalklappe", "Pulmonary Valve"],
      reUnterschenkel: ["re. Unterschenkel", "rt. Lower Leg"], liUnterschenkel: ["li. Unterschenkel", "lt. Lower Leg"],
      reOberschenkel: ["re. Oberschenkel", "rt. Upper Leg"], liOberschenkel: ["li. Oberschenkel", "lt. Upper Leg"],
      tiefeBeinvene: ["Tiefe Beinvene", "Deep Leg Vein"], armvene: ["Armvene", "Arm Vein"],
      reArm: ["re. Arm", "rt. Arm"], liArm: ["li. Arm", "lt. Arm"],
      lungenembolie: ["Lungenembolie", "Pulmonary Embolism"], sinusvene: ["Sinusvene", "Sinus Vein"],
      pfortader: ["Pfortader", "Portal Vein"], mesenterialvene: ["Mesenterialvene", "Mesenteric Vein"],
      oberflaechlich: ["Oberflächlich", "Superficial"],
      // Lung
      allergisch: ["allergisch", "allergic"], nichtAllergisch: ["nicht-allergisch", "non-allergic"],
      trocken: ["trocken", "dry"], mitAuswurf: ["mit Auswurf", "with sputum"],
      farbe: ["Farbe", "Color"], stadium: ["Stadium", "Stage"],
      // Digestive
      regelmaessig: ["regelmäßig", "regular"], gelegentlich: ["gelegentlich", "occasional"],
      nachEssen: ["nach dem Essen", "after eating"], haeufigkeit: ["Häufigkeit", "Frequency"],
      lokalisation: ["Lokalisation", "Location"], diagnostiziert: ["diagnostiziert", "diagnosed"],
      bereich: ["Bereich", "Area"], diarrhoe: ["Diarrhoe", "Diarrhea"],
      obstipation: ["Obstipation", "Constipation"], wechselnd: ["wechselnd", "alternating"],
      // Liver
      hepatitisA: ["Hepatitis A", "Hepatitis A"], hepatitisB: ["Hepatitis B", "Hepatitis B"],
      hepatitisC: ["Hepatitis C", "Hepatitis C"], fettleber: ["Fettleber", "Fatty Liver"],
      symptomatisch: ["symptomatisch", "symptomatic"], asymptomatisch: ["asymptomatisch", "asymptomatic"],
      // Kidney
      blasenentzuendung: ["Blasenentzündung", "Bladder Infection"],
      brennen: ["Brennen", "Burning"], schmerz: ["Schmerz", "Pain"], drang: ["Drang", "Urgency"],
      ueberlauf: ["Überlauf", "Overflow"], anzahlProNacht: ["pro Nacht", "per night"],
      // Hormones
      unterfunktion: ["Unterfunktion", "Hypothyroidism"], ueberfunktion: ["Überfunktion", "Hyperthyroidism"],
      hashimoto: ["Hashimoto", "Hashimoto's"], basedow: ["Basedow", "Graves' Disease"],
      knoten: ["Knoten", "Nodules"], schilddruesenkrebs: ["Schilddrüsenkrebs", "Thyroid Cancer"],
      schilddruesenop: ["Schilddrüsen-OP", "Thyroid Surgery"], radiojodtherapie: ["Radiojodtherapie", "Radioiodine"],
      hypophysenadenom: ["Hypophysenadenom", "Pituitary Adenoma"], prolaktinom: ["Prolaktinom", "Prolactinoma"],
      akromegalie: ["Akromegalie", "Acromegaly"], hypophyseninsuffizienz: ["Hypophyseninsuffizienz", "Pituitary Insufficiency"],
      diabetesInsipidus: ["Diabetes Insipidus", "Diabetes Insipidus"],
      nebenniereninsuffizienz: ["Nebenniereninsuffizienz", "Adrenal Insufficiency"],
      cushingSyndrom: ["Cushing-Syndrom", "Cushing's Syndrome"], phaeochromozytom: ["Phäochromozytom", "Pheochromocytoma"],
      nebennierenerschoepfung: ["Nebennierenerschöpfung", "Adrenal Fatigue"],
      // Musculoskeletal
      verspannung: ["Verspannung", "Tension"], bsv: ["BSV (Bandscheibenvorfall)", "Disc Herniation"],
      arthrose: ["Arthrose", "Arthritis"],
      // Skin
      atopisch: ["atopisch", "atopic"], kontakt: ["Kontakt", "contact"],
      leicht: ["leicht", "mild"], mittel: ["mittel", "moderate"], schwer: ["schwer", "severe"],
      haende: ["Hände", "Hands"], fuesse: ["Füße", "Feet"], achseln: ["Achseln", "Armpits"], gesicht: ["Gesicht", "Face"],
      // Women's health
      teilweise: ["teilweise", "partial"], vollstaendig: ["vollständig", "complete"],
      einseitig: ["einseitig", "unilateral"],
      vaginal: ["vaginal", "vaginal"], kaiserschnitt: ["Kaiserschnitt", "C-section"],
      uebelkeit: ["Übelkeit", "Nausea"], kopf: ["Kopfschmerzen", "Headaches"],
      // Men's health
      bph: ["BPH", "BPH"], prostatitis: ["Prostatitis", "Prostatitis"], prostatakarzinom: ["Prostatakarzinom", "Prostate Cancer"],
      psa: ["PSA-Wert", "PSA Level"],
      hodenentzuendung: ["Hodenentzündung", "Orchitis"], hodentorsion: ["Hodentorsion", "Testicular Torsion"],
      hodenkrebs: ["Hodenkrebs", "Testicular Cancer"], varikozele: ["Varikozele", "Varicocele"],
      hydrozele: ["Hydrozele", "Hydrocele"], epididymitis: ["Epididymitis", "Epididymitis"],
      nebenhodenzyste: ["Nebenhodenzyste", "Epididymal Cyst"],
      // Infections
      roterHof: ["Roter Hof (Wanderröte)", "Erythema migrans"],
      // Surgeries
      wurzelbehandlungen: ["Wurzelbehandlungen", "Root Canals"],
    };
    const mapped = labelMap[key];
    if (mapped) return this.t(mapped[0], mapped[1]);
    // Fallback: capitalize first letter, add spaces before uppercase
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  /** Render a medical condition object: { ja, seit/jahr, ...booleanSubItems, sonstige/details } */
  renderCondition(label: string, cond: any, indent = 5) {
    if (!cond || (typeof cond === 'object' && !cond.ja)) return false;
    if (typeof cond === 'boolean') {
      if (cond) this.addCheckboxField(label, true, indent);
      return cond;
    }
    // Build detail string from sub-fields
    const details: string[] = [];
    const skipKeys = new Set(["ja", "seit", "jahr", "status", "bisJahr", "seitYear", "seitMonth", "bisYear", "bisMonth"]);
    for (const [k, v] of Object.entries(cond)) {
      if (skipKeys.has(k)) continue;
      if (typeof v === 'boolean' && v) {
        details.push(this.prettifyKey(k));
      } else if (typeof v === 'string' && v && k !== 'sonstige' && k !== 'details' && k !== 'welche' && k !== 'grund') {
        details.push(`${this.prettifyKey(k)}: ${v}`);
      } else if (typeof v === 'number' && v) {
        details.push(`${this.prettifyKey(k)}: ${v}`);
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        // Render nested sub-objects (e.g., protheseKiefer, severity levels)
        const subDetails: string[] = [];
        for (const [sk, sv] of Object.entries(v as Record<string, any>)) {
          if (skipKeys.has(sk)) continue;
          if (typeof sv === 'boolean' && sv) {
            subDetails.push(this.prettifyKey(sk));
          } else if (typeof sv === 'string' && sv) {
            subDetails.push(`${this.prettifyKey(sk)}: ${sv}`);
          }
        }
        if (subDetails.length > 0) {
          details.push(`${this.prettifyKey(k)}: ${subDetails.join(", ")}`);
        }
      }
    }
    // Time info – support both legacy (seit/jahr) and new (seitYear/seitMonth) formats
    let zeit = cond.seit || cond.jahr || "";
    if (!zeit && cond.seitYear) {
      zeit = cond.seitMonth ? `${cond.seitMonth}/${cond.seitYear}` : cond.seitYear;
    }
    const zeitStr = zeit ? ` (${this.t("seit", "since")} ${zeit})` : "";
    
    let bisStr = "";
    if (cond.bisYear) {
      const bis = cond.bisMonth ? `${cond.bisMonth}/${cond.bisYear}` : cond.bisYear;
      bisStr = ` ${this.t("bis", "until")} ${bis}`;
    }
    
    const statusLabel = cond.status === "nochVorhanden" ? this.t("noch vorhanden", "still present")
      : cond.status === "geendet" ? this.t("geendet", "ended")
      : cond.status || "";
    const statusStr = statusLabel ? ` [${statusLabel}${bisStr}]` : "";
    
    const detailStr = details.length > 0 ? ` – ${details.join(", ")}` : "";
    const sonstigeStr = (cond.sonstige || cond.details || cond.welche || cond.grund || "");
    const extra = sonstigeStr ? ` – ${sonstigeStr}` : "";
    
    this.addCheckboxField(`${label}${zeitStr}${statusStr}${detailStr}${extra}`, true, indent);
    return true;
  }

  /** Render a group of conditions under a sub-header */
  renderConditionGroup(title: string, data: Record<string, any> | undefined, labelMap: Record<string, [string, string]>) {
    if (!data) return;
    let hasAny = false;
    for (const [key, [de, en]] of Object.entries(labelMap)) {
      const val = data[key];
      if (val !== undefined) {
        if (this.renderCondition(this.t(de, en), val)) hasAny = true;
      }
    }
    // Check for sonstige text field at group level
    if (data.sonstige && typeof data.sonstige === 'string' && data.sonstige.trim()) {
      this.addField(this.t("Sonstiges", "Other"), data.sonstige, 5);
      hasAny = true;
    }
    if (!hasAny) this.addNoData();
  }

  // ============ Build all sections ============

  buildDocument(formData: AnamneseFormData, iaaData?: Record<string, number>, options?: { excludeIAA?: boolean }) {
    this.addHeader();

    // Title
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    this.doc.setFontSize(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(this.t("Anamnesebogen", "Medical History Form"), this.pageWidth / 2, this.yPos + 5, { align: "center" });
    this.yPos += 15;

    // Patient box
    if (formData.vorname || formData.nachname) {
      this.doc.setFillColor(240, 248, 240);
      this.doc.roundedRect(this.margin, this.yPos - 2, this.contentWidth, 18, 3, 3, "F");
      this.doc.setDrawColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(this.margin, this.yPos - 2, this.contentWidth, 18, 3, 3, "S");
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${this.t("Patient/in", "Patient")}: ${formData.vorname} ${formData.nachname}`, this.margin + 5, this.yPos + 5);
      if (formData.geburtsdatum) {
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(`${this.t("Geburtsdatum", "Date of Birth")}: ${formData.geburtsdatum}`, this.margin + 5, this.yPos + 12);
      }
      this.yPos += 25;
    }

    this.buildPatientData(formData);
    this.buildFamilyHistory(formData);
    this.buildNeurology(formData);
    this.buildHeart(formData);
    this.buildLung(formData);
    this.buildDigestive(formData);
    this.buildLiver(formData);
    this.buildKidney(formData);
    this.buildHormone(formData);
    this.buildMusculoskeletal(formData);
    this.buildWomenHealth(formData);
    this.buildMensHealth(formData);
    this.buildSurgeries(formData);
    this.buildCancer(formData);
    this.buildAllergies(formData);
    this.buildMedications(formData);
    this.buildLifestyle(formData);
    this.buildDental(formData);
    this.buildEnvironment(formData);
    this.buildInfections(formData);
    this.buildVaccinations(formData);
    this.buildComplaints(formData);
    this.buildPreferences(formData);
    this.buildSocial(formData);
    // IAA section – only if not excluded
    if (!options?.excludeIAA && iaaData && Object.keys(iaaData).length > 0) {
      this.buildIAA(iaaData);
    }
    this.buildSignature(formData);

    // Footers
    const pageCount = (this.doc.internal as any).pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.addFooter(i, pageCount);
    }
  }

  /** Build an IAA-only document */
  buildIAADocument(formData: AnamneseFormData, iaaData: Record<string, number>) {
    this.addHeader();

    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    this.doc.setFontSize(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(this.t("IAA - Individuelle Austestung und Analyse", "IAA - Individual Testing and Analysis"), this.pageWidth / 2, this.yPos + 5, { align: "center" });
    this.yPos += 15;

    // Patient info box
    if (formData.vorname || formData.nachname) {
      this.doc.setFillColor(240, 248, 240);
      this.doc.roundedRect(this.margin, this.yPos - 2, this.contentWidth, 18, 3, 3, "F");
      this.doc.setDrawColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(this.margin, this.yPos - 2, this.contentWidth, 18, 3, 3, "S");
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${this.t("Patient/in", "Patient")}: ${formData.vorname} ${formData.nachname}`, this.margin + 5, this.yPos + 5);
      if (formData.geburtsdatum) {
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(`${this.t("Geburtsdatum", "Date of Birth")}: ${formData.geburtsdatum}`, this.margin + 5, this.yPos + 12);
      }
      this.yPos += 25;
    }

    this.buildIAA(iaaData);

    const pageCount = (this.doc.internal as any).pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.addFooter(i, pageCount);
    }
  }

  // === I. Patient Data ===
  buildPatientData(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("I. Patientendaten", "I. Patient Data"), "👤");
    this.addFieldAlways(this.t("Name", "Name"), `${fd.vorname} ${fd.nachname}`);
    this.addFieldAlways(this.t("Geburtsdatum", "Date of Birth"), fd.geburtsdatum);
    this.addFieldAlways(this.t("Geschlecht", "Gender"), fd.geschlecht);
    this.addField(this.t("Nationalität", "Nationality"), fd.nationalitaet);
    this.addField(this.t("Zivilstand", "Marital Status"), fd.zivilstand);
    this.addSpacing();
    this.addSubHeader(this.t("Kontaktdaten", "Contact Information"));
    this.addField(this.t("Straße", "Street"), fd.strasse, 5);
    this.addField(this.t("PLZ / Wohnort", "ZIP / City"), `${fd.plz} ${fd.wohnort}`.trim(), 5);
    this.addField(this.t("E-Mail", "Email"), fd.email, 5);
    this.addField(this.t("Telefon privat", "Phone (private)"), fd.telefonPrivat, 5);
    this.addField(this.t("Telefon beruflich", "Phone (work)"), fd.telefonBeruflich, 5);
    this.addField(this.t("Mobil", "Mobile"), fd.mobil, 5);
    this.addSpacing();
    this.addSubHeader(this.t("Versicherung", "Insurance"));
    this.addField(this.t("Typ", "Type"), fd.versicherungstyp, 5);
    this.addField(this.t("Name", "Name"), fd.versicherungsname, 5);
    this.addField(this.t("Nummer", "Number"), fd.versicherungsnummer, 5);
    this.addField(this.t("Tarif", "Plan"), fd.tarif, 5);
    this.addCheckboxField(this.t("Kostenübernahme Naturheilkunde", "Coverage for naturopathy"), fd.kostenuebernahmeNaturheilkunde, 5);
    // Mitversicherte
    if (fd.mitversicherte?.length > 0) {
      this.addSpacing();
      this.addSubHeader(this.t("Mitversicherte", "Co-insured Persons"));
      fd.mitversicherte.forEach((mv, i) => {
        this.addField(`${i + 1}.`, `${mv.name} (${mv.verhaeltnis}), ${this.t("geb.", "DOB")} ${mv.geburtsdatum}`, 5);
      });
    }
    this.addSpacing();
    this.addSubHeader(this.t("Berufliche Situation", "Professional Situation"));
    this.addField(this.t("Beruf", "Occupation"), fd.beruf, 5);
    this.addField(this.t("Arbeitgeber", "Employer"), fd.arbeitgeber, 5);
    this.addField(this.t("Branche", "Industry"), fd.branche, 5);
    this.addField(this.t("Arbeitsunfähig seit", "Unable to work since"), fd.arbeitsunfaehigSeit, 5);
    this.addField(this.t("Berentet seit", "Retired since"), fd.berentnerSeit, 5);
    this.addField(this.t("Unfallrente %", "Accident pension %"), fd.unfallrenteProzent, 5);
    this.addField(this.t("Schwerbehinderung %", "Disability %"), fd.schwerbehinderungProzent, 5);
    this.addField(this.t("Körpergröße", "Height"), fd.koerpergroesse ? `${fd.koerpergroesse} cm` : "", 5);
    this.addField(this.t("Gewicht", "Weight"), fd.gewicht ? `${fd.gewicht} kg` : "", 5);
    this.addSpacing();
    if (fd.informationsquelle?.length > 0) {
      this.addField(this.t("Wie von uns erfahren", "How did you find us"), fd.informationsquelle.join(", "), 5);
    }
    this.addField(this.t("Empfohlen von", "Recommended by"), fd.empfehlungVon, 5);
    this.addSpacing();
    this.addSubHeader(this.t("Vorbehandler", "Previous Practitioners"));
    this.addField(this.t("Hausarzt", "Family Doctor"), fd.hausarzt, 5);
    this.addField(this.t("Fachärzte", "Specialists"), fd.fachaerzte, 5);
    this.addField(this.t("Heilpraktiker", "Naturopath"), fd.heilpraktiker, 5);
    this.addField(this.t("Physiotherapeut", "Physiotherapist"), fd.physiotherapeut, 5);
    this.addField(this.t("Psychotherapeut", "Psychotherapist"), fd.psychotherapeut, 5);
    this.addField(this.t("Sonstige", "Other"), fd.sonstigeTherapeutenn, 5);
    if (fd.facharztListe?.length > 0) {
      fd.facharztListe.forEach((fa, i) => {
        this.addField(`${this.t("Facharzt", "Specialist")} ${i + 1}`, `${fa.fachrichtung} – ${fa.name}`, 5);
      });
    }
    this.addSpacing(10);
  }

  // === II. Family History ===
  buildFamilyHistory(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("II. Familiengeschichte", "II. Family History"), "👨‍👩‍👧‍👦");
    const conditions: [string, string, string][] = [
      ["hoherBlutdruck", "Hoher Blutdruck", "High Blood Pressure"],
      ["herzinfarkt", "Herzinfarkt", "Heart Attack"],
      ["schlaganfall", "Schlaganfall", "Stroke"],
      ["diabetes", "Diabetes", "Diabetes"],
      ["gicht", "Gicht", "Gout"],
      ["lungenasthma", "Lungenasthma", "Lung Asthma"],
      ["lungentuberkulose", "Lungentuberkulose", "Lung Tuberculosis"],
      ["nervenleiden", "Nervenleiden", "Neurological Disorders"],
      ["krebs", "Krebs", "Cancer"],
      ["allergien", "Allergien", "Allergies"],
      ["sucht", "Suchterkrankung", "Addiction"],
      ["autoimmun", "Autoimmunerkrankung", "Autoimmune Disease"],
    ];
    let hasAny = false;
    conditions.forEach(([key, de, en]) => {
      const c = fd.familyHistory?.[key as keyof typeof fd.familyHistory];
      if (c && typeof c === 'object' && 'ja' in c && c.ja) {
        hasAny = true;
        const rel: string[] = [];
        if ('vater' in c && c.vater) rel.push(this.t("Vater", "Father"));
        if ('mutter' in c && c.mutter) rel.push(this.t("Mutter", "Mother"));
        if ('grosseltern' in c && c.grosseltern) rel.push(this.t("Großeltern", "Grandparents"));
        if ('geschwister' in c && c.geschwister) rel.push(this.t("Geschwister", "Siblings"));
        let extra = "";
        if ('welches' in c && (c as any).welches) extra = ` (${(c as any).welches})`;
        this.addCheckboxField(`${this.t(de, en)}: ${rel.join(", ") || this.t("Ja", "Yes")}${extra}`, true);
      }
    });
    if (!hasAny) this.addNoData(this.t("Keine relevanten Familienerkrankungen angegeben", "No relevant family conditions specified"));
    this.addSpacing(10);
  }

  // === III. Neurology ===
  buildNeurology(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("III. Kopf & Sinne", "III. Head & Senses"), "🧠");
    this.addSubHeader(this.t("Kopf & Sinnesorgane", "Head & Sensory Organs"));
    this.renderConditionGroup("", fd.kopfErkrankungen, {
      augenerkrankung: ["Augenerkrankung", "Eye Disease"],
      schwerhoerig: ["Schwerhörigkeit", "Hearing Loss"],
      ohrenerkrankung: ["Ohrenerkrankung", "Ear Disease"],
      sinusitis: ["Sinusitis", "Sinusitis"],
      mandelentzuendung: ["Mandelentzündung", "Tonsillitis"],
      kopfschmerzen: ["Kopfschmerzen", "Headaches"],
      schwindel: ["Schwindel", "Dizziness"],
      geruchsminderung: ["Geruchsminderung", "Reduced Smell"],
      geschmacksminderung: ["Geschmacksminderung", "Reduced Taste"],
      neuralgien: ["Neuralgien", "Neuralgia"],
    });
    this.addSpacing();
    this.addSubHeader(this.t("Schlaf & Psychische Symptome", "Sleep & Psychological Symptoms"));
    this.renderConditionGroup("", fd.schlafSymptome, {
      schlafstörung: ["Schlafstörung", "Sleep Disorder"],
      einschlafstörung: ["Einschlafstörung", "Difficulty Falling Asleep"],
      durchschlafstörung: ["Durchschlafstörung", "Difficulty Staying Asleep"],
      fruehAufwachen: ["Frühes Aufwachen", "Early Awakening"],
      konzentrationsstörung: ["Konzentrationsstörung", "Concentration Issues"],
      muedigkeit: ["Müdigkeit", "Fatigue"],
      leistungsabfall: ["Leistungsabfall", "Performance Decline"],
      vergesslichkeit: ["Vergesslichkeit", "Forgetfulness"],
      angstzustaende: ["Angstzustände", "Anxiety"],
      stress: ["Stress", "Stress"],
      partnerschaftsprobleme: ["Partnerschaftsprobleme", "Relationship Issues"],
      sexualprobleme: ["Sexualprobleme", "Sexual Issues"],
    });
    this.addSpacing();
    this.addSubHeader(this.t("Psychische Erkrankungen", "Mental Health"));
    this.renderConditionGroup("", fd.psychischeErkrankungen, {
      depression: ["Depression", "Depression"],
      schizophrenie: ["Schizophrenie", "Schizophrenia"],
      psychose: ["Psychose", "Psychosis"],
      zwangsgedanken: ["Zwangsgedanken", "Obsessive Thoughts"],
      phobien: ["Phobien", "Phobias"],
      epilepsie: ["Epilepsie", "Epilepsy"],
      trauma: ["Trauma/PTBS", "Trauma/PTSD"],
      mobbing: ["Mobbing", "Bullying"],
    });
    this.addSpacing(10);
  }

  // === IV. Heart ===
  buildHeart(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("IV. Herz & Kreislauf", "IV. Heart & Circulation"), "❤️");
    this.renderConditionGroup("", fd.herzKreislauf, {
      blutdruckWechselhaft: ["Blutdruck wechselhaft", "Fluctuating Blood Pressure"],
      blutdruckNiedrig: ["Niedriger Blutdruck", "Low Blood Pressure"],
      blutdruckHoch: ["Hoher Blutdruck", "High Blood Pressure"],
      herzrhythmusstörung: ["Herzrhythmusstörung", "Heart Arrhythmia"],
      herzschrittmacher: ["Herzschrittmacher", "Pacemaker"],
      herzschmerzen: ["Herzschmerzen", "Heart Pain"],
      herzinfarkt: ["Herzinfarkt", "Heart Attack"],
      stent: ["Stent", "Stent"],
      herzklappenfehler: ["Herzklappenfehler", "Heart Valve Defect"],
      herzklappenersatz: ["Herzklappenersatz", "Heart Valve Replacement"],
      krampfadern: ["Krampfadern", "Varicose Veins"],
      thrombose: ["Thrombose", "Thrombosis"],
      oedeme: ["Ödeme", "Edema"],
    });
    this.addSpacing(10);
  }

  // === V. Lung ===
  buildLung(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("V. Lunge & Atmung", "V. Lungs & Breathing"), "🫁");
    this.renderConditionGroup("", fd.lungeAtmung, {
      asthma: ["Asthma", "Asthma"],
      lungenentzuendung: ["Lungenentzündung", "Pneumonia"],
      rippenfellentzuendung: ["Rippenfellentzündung", "Pleurisy"],
      bronchitis: ["Bronchitis", "Bronchitis"],
      tuberkulose: ["Tuberkulose", "Tuberculosis"],
      sarkoidose: ["Sarkoidose", "Sarcoidosis"],
      husten: ["Husten", "Cough"],
      auswurf: ["Auswurf", "Sputum"],
      atemnot: ["Atemnot", "Shortness of Breath"],
      copd: ["COPD", "COPD"],
      lungenembolie: ["Lungenembolie", "Pulmonary Embolism"],
    });
    this.addSpacing(10);
  }

  // === VI. Digestive ===
  buildDigestive(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("VI. Magen & Darm", "VI. Digestive System"), "🍽️");
    this.renderConditionGroup("", fd.magenDarm, {
      magengeschwuer: ["Magengeschwür", "Stomach Ulcer"],
      duennDarmgeschwuer: ["Dünndarmgeschwür", "Duodenal Ulcer"],
      sodbrennen: ["Sodbrennen", "Heartburn"],
      magensaeurehemmer: ["Magensäurehemmer", "Acid Blockers"],
      uebelkeit: ["Übelkeit", "Nausea"],
      erbrechen: ["Erbrechen", "Vomiting"],
      verstopfung: ["Verstopfung", "Constipation"],
      durchfall: ["Durchfall", "Diarrhea"],
      blaehungen: ["Blähungen", "Bloating"],
      bauchschmerzen: ["Bauchschmerzen", "Abdominal Pain"],
      zoeliakie: ["Zöliakie", "Celiac Disease"],
      morbusCrohn: ["Morbus Crohn", "Crohn's Disease"],
      colitis: ["Colitis ulcerosa", "Ulcerative Colitis"],
      reizdarm: ["Reizdarm", "Irritable Bowel"],
    });
    this.addField(this.t("Durst", "Thirst"), fd.durst, 5);
    this.addField(this.t("Appetit", "Appetite"), fd.appetit, 5);
    this.addField(this.t("Ernährungstyp", "Diet Type"), fd.ernaehrungstyp, 5);
    this.addSpacing(10);
  }

  // === VII. Liver ===
  buildLiver(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("VII. Leber & Galle", "VII. Liver & Gallbladder"), "🫀");
    this.renderConditionGroup("", fd.leberGalle, {
      lebererkrankung: ["Lebererkrankung", "Liver Disease"],
      leberzirrhose: ["Leberzirrhose", "Liver Cirrhosis"],
      leberkrebs: ["Leberkrebs", "Liver Cancer"],
      gelbsucht: ["Gelbsucht", "Jaundice"],
      gallensteine: ["Gallensteine", "Gallstones"],
      gallenleiden: ["Gallenleiden", "Gallbladder Disease"],
      gallenblasenentfernung: ["Gallenblasenentfernung", "Gallbladder Removal"],
      gallengangentzuendung: ["Gallengangentzündung", "Bile Duct Inflammation"],
    });
    this.addSpacing(10);
  }

  // === VIII. Kidney ===
  buildKidney(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("VIII. Niere & Blase", "VIII. Kidney & Bladder"), "💧");
    this.renderConditionGroup("", fd.niereBlase, {
      nierenerkrankung: ["Nierenerkrankung", "Kidney Disease"],
      blasenleiden: ["Blasenleiden", "Bladder Disease"],
      nykturie: ["Nykturie", "Nocturia"],
      miktionsbeschwerden: ["Miktionsbeschwerden", "Urination Problems"],
      inkontinenz: ["Inkontinenz", "Incontinence"],
      haematurie: ["Hämaturie", "Hematuria"],
      nierensteine: ["Nierensteine", "Kidney Stones"],
    });
    this.addField(this.t("Miktionsfrequenz", "Urination Frequency"), fd.niereBlase?.miktionsfrequenz, 5);
    this.addSpacing(10);
  }

  // === IX. Hormones ===
  buildHormone(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("IX. Hormone", "IX. Hormones"), "⚡");
    this.renderConditionGroup("", fd.hormongesundheit, {
      schilddruese: ["Schilddrüse", "Thyroid"],
      hypophyse: ["Hypophyse", "Pituitary"],
      nebenniere: ["Nebenniere", "Adrenal Gland"],
    });
    this.addSpacing(10);
  }

  // === X. Musculoskeletal ===
  buildMusculoskeletal(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("X. Bewegungsapparat", "X. Musculoskeletal System"), "🦴");
    this.renderConditionGroup("", fd.wirbelsaeuleGelenke, {
      hws: ["HWS (Halswirbelsäule)", "Cervical Spine"],
      bws: ["BWS (Brustwirbelsäule)", "Thoracic Spine"],
      lws: ["LWS (Lendenwirbelsäule)", "Lumbar Spine"],
      iliosakral: ["ISG (Iliosakralgelenk)", "Sacroiliac Joint"],
      schulter: ["Schulter", "Shoulder"],
      ellbogen: ["Ellbogen", "Elbow"],
      handgelenk: ["Handgelenk", "Wrist"],
      finger: ["Finger", "Fingers"],
      huefte: ["Hüfte", "Hip"],
      knie: ["Knie", "Knee"],
      fuss: ["Fuß", "Foot"],
      zehen: ["Zehen", "Toes"],
      rheuma: ["Rheuma", "Rheumatism"],
    });
    this.addSpacing();
    this.addSubHeader(this.t("Haut & Infektionen", "Skin & Infections"));
    this.renderConditionGroup("", fd.hautInfektionen, {
      hauterkrankung: ["Hauterkrankung", "Skin Disease"],
      ekzem: ["Ekzem", "Eczema"],
      psoriasis: ["Psoriasis", "Psoriasis"],
      urticaria: ["Urtikaria", "Urticaria"],
      juckreiz: ["Juckreiz", "Itching"],
      akne: ["Akne", "Acne"],
      rosazea: ["Rosazea", "Rosacea"],
      geschlechtskrankheit: ["Geschlechtskrankheit", "STD"],
      hyperhidrose: ["Hyperhidrose", "Hyperhidrosis"],
    });
    this.addCheckboxField(this.t("Nachtschweiß", "Night Sweats"), fd.hautInfektionen?.nachtschweiss);
    this.addCheckboxField(this.t("Stressschweiß", "Stress Sweating"), fd.hautInfektionen?.stressSchweiss);
    this.addCheckboxField(this.t("Ständiges Schwitzen", "Constant Sweating"), fd.hautInfektionen?.staendigSchweiss);
    this.addSpacing(10);
  }

  // === XI. Women's Health ===
  buildWomenHealth(fd: AnamneseFormData) {
    if (fd.geschlecht && fd.geschlecht !== "weiblich" && fd.geschlecht !== "female") return;
    this.addSectionHeader(this.t("XI. Frauengesundheit", "XI. Women's Health"), "👩");
    const fg = fd.frauengesundheit;
    if (!fg) { this.addNoData(); this.addSpacing(10); return; }
    this.addField(this.t("Geburtsgewicht", "Birth Weight"), fg.geburtsgewicht, 5);
    this.renderCondition(this.t("Frühgeburt", "Premature Birth"), fg.fruehgeburt);
    this.renderCondition(this.t("Gebärmuttererkrankung", "Uterine Disease"), fg.gebaermuttererkrankung);
    this.renderCondition(this.t("Gebärmutterentfernung", "Hysterectomy"), fg.gebaermutterentfernung);
    this.renderCondition(this.t("Eierstockentfernung", "Oophorectomy"), fg.eierstockentfernung);
    this.renderCondition(this.t("Gebärmutterausschabung", "Curettage"), fg.gebaermutterausschabung);
    this.renderCondition(this.t("Eierstockzyste", "Ovarian Cyst"), fg.eierstockzyste);
    this.renderCondition(this.t("Endometriose", "Endometriosis"), fg.endometriose);
    this.renderCondition(this.t("Myome", "Fibroids"), fg.myome);
    this.renderCondition(this.t("Pille", "Birth Control Pill"), fg.pille);
    this.renderCondition(this.t("Hormonbehandlung", "Hormone Treatment"), fg.hormonbehandlung);
    this.renderCondition(this.t("Menopause", "Menopause"), fg.menopause);
    // Period details
    this.renderCondition(this.t("Periode normal", "Period Normal"), fg.periodeNormal);
    this.renderCondition(this.t("Periode schwach", "Period Light"), fg.periodeSchwach);
    if (fg.periodeStark) this.addCheckboxField(this.t("Periode stark", "Period Heavy"), true);
    this.renderCondition(this.t("Periode unregelmäßig", "Period Irregular"), fg.periodeUnregelmaessig);
    this.renderCondition(this.t("Periodenbeschwerden", "Period Complaints"), fg.periodenbeschwerden);
    if (fg.schwangerschaften?.anzahl) this.addField(this.t("Schwangerschaften", "Pregnancies"), fg.schwangerschaften.anzahl, 5);
    if (fg.fehlgeburten?.anzahl) this.addField(this.t("Fehlgeburten", "Miscarriages"), fg.fehlgeburten.anzahl, 5);
    if (fg.geburten?.anzahl) this.addField(this.t("Geburten", "Births"), fg.geburten.anzahl, 5);
    this.renderCondition(this.t("Wochenbettdepression", "Postpartum Depression"), fg.wochenbettdepression);
    this.addField(this.t("Sonstiges", "Other"), fg.sonstige, 5);
    this.addSpacing(10);
  }

  // === XI. Men's Health ===
  buildMensHealth(fd: AnamneseFormData) {
    if (fd.geschlecht && fd.geschlecht !== "männlich" && fd.geschlecht !== "male") return;
    this.addSectionHeader(this.t("XI. Männergesundheit", "XI. Men's Health"), "👨");
    this.renderConditionGroup("", fd.maennergesundheit, {
      prostata: ["Prostata", "Prostate"],
      hoden: ["Hodenerkrankung", "Testicular Disease"],
      nebenhoden: ["Nebenhodenerkrankung", "Epididymal Disease"],
      erektionsstoerung: ["Erektionsstörung", "Erectile Dysfunction"],
    });
    this.addSpacing(10);
  }

  // === XII. Surgeries ===
  buildSurgeries(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XII. Unfälle & Operationen", "XII. Accidents & Surgeries"), "🏥");
    const uo = fd.unfaelleOperationen;
    if (!uo) { this.addNoData(); this.addSpacing(10); return; }
    this.renderCondition(this.t("Unfall", "Accident"), uo.unfall);
    this.renderCondition(this.t("Knochenbruch", "Bone Fracture"), uo.knochenbruch);
    this.renderCondition(this.t("Kopfverletzung", "Head Injury"), uo.kopfverletzung);
    if (uo.operationen?.length > 0) {
      this.addSubHeader(this.t("Operationen", "Surgeries"));
      uo.operationen.forEach((op, i) => {
        this.addField(`${i + 1}.`, `${op.jahr} – ${op.grund}`, 5);
      });
    }
    this.renderCondition(this.t("Krankenhausaufenthalt", "Hospitalization"), uo.krankenhausaufenthalt);
    this.renderCondition(this.t("Kur/Reha", "Rehabilitation"), uo.kuraufenthalt);
    this.renderCondition(this.t("Bluttransfusion", "Blood Transfusion"), uo.bluttransfusion);
    this.renderCondition(this.t("Chemotherapie", "Chemotherapy"), uo.chemotherapie);
    this.renderCondition(this.t("Strahlentherapie", "Radiation Therapy"), uo.strahlentherapie);
    this.addSpacing();
    this.addSubHeader(this.t("Nuklearmedizinische Untersuchungen", "Nuclear Medicine"));
    this.renderCondition(this.t("Szintigraphie", "Scintigraphy"), uo.szintigraphie);
    this.renderCondition("PET-CT", uo.petCt);
    this.renderCondition(this.t("Radioiodtherapie", "Radioiodine Therapy"), uo.radioiodtherapie);
    this.addSpacing(10);
  }

  // === XIII. Cancer ===
  buildCancer(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XIII. Krebs", "XIII. Cancer"), "⚠️");
    const kr = fd.krebserkrankung;
    if (!kr || !kr.hatKrebs) { this.addNoData(this.t("Keine Krebserkrankung angegeben", "No cancer reported")); this.addSpacing(10); return; }
    this.addCheckboxField(this.t("Krebserkrankung", "Cancer"), true);
    this.addField(this.t("Art", "Type"), kr.welche || kr.welcheTyp, 5);
    this.addField(this.t("Diagnosejahr", "Year of Diagnosis"), kr.diagnoseJahr, 5);
    this.addField(this.t("Betroffene Organe", "Affected Organs"), kr.betroffeneOrgane || kr.betroffeneOrganeList?.join(", "), 5);
    if (kr.tnmStadium?.t || kr.tnmStadium?.n || kr.tnmStadium?.m) {
      this.addField("TNM", `T${kr.tnmStadium.t} N${kr.tnmStadium.n} M${kr.tnmStadium.m}`, 5);
    }
    this.renderCondition(this.t("Operation durchgeführt", "Surgery Performed"), kr.operationDurchgefuehrt);
    if (kr.operationenList?.length > 0) {
      kr.operationenList.forEach((op, i) => this.addField(`OP ${i + 1}`, `${op.jahr} – ${op.art}`, 10));
    }
    if (kr.chemotherapieErhalten?.ja) {
      this.addCheckboxField(this.t("Chemotherapie erhalten", "Chemotherapy Received"), true);
      this.addField(this.t("Zeitraum", "Period"), `${kr.chemotherapieErhalten.von} – ${kr.chemotherapieErhalten.bis}`, 10);
      this.addField(this.t("Art", "Type"), kr.chemotherapieErhalten.welche || kr.chemotherapieErhalten.typen?.join(", "), 10);
    }
    if (kr.strahlentherapieErhalten?.ja) {
      this.addCheckboxField(this.t("Strahlentherapie erhalten", "Radiation Received"), true);
      this.addField(this.t("Bereich", "Area"), kr.strahlentherapieErhalten.bereich, 10);
      this.addField(this.t("Dauer (Wochen)", "Duration (weeks)"), kr.strahlentherapieErhalten.dauerWochen, 10);
      this.addField(this.t("Typen", "Types"), kr.strahlentherapieErhalten.typen?.join(", "), 10);
    }
    if (kr.metastasen?.ja) {
      this.addCheckboxField(this.t("Metastasen", "Metastases"), true);
      this.addField(this.t("Organe", "Organs"), kr.metastasen.organe || kr.metastasen.organeList?.join(", "), 10);
    }
    if (kr.aktuelleTumortherapie?.ja) {
      this.addCheckboxField(this.t("Aktuelle Tumortherapie", "Current Tumor Therapy"), true);
      this.addField(this.t("Art", "Type"), kr.aktuelleTumortherapie.welche || kr.aktuelleTumortherapie.typen?.join(", "), 10);
    }
    this.addSpacing(10);
  }

  // === XIV. Allergies ===
  buildAllergies(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XIV. Allergien & Unverträglichkeiten", "XIV. Allergies & Intolerances"), "🤧");
    const a = fd.allergien;
    if (!a) { this.addNoData(); this.addSpacing(10); return; }
    let hasAny = false;
    if (a.inhalation?.ja) {
      hasAny = true;
      const types: string[] = [];
      if (a.inhalation.pollen) types.push(this.t("Pollen", "Pollen"));
      if (a.inhalation.staub) types.push(this.t("Staub", "Dust"));
      if (a.inhalation.tierhaare) types.push(this.t("Tierhaare", "Animal Hair"));
      if (a.inhalation.schimmel) types.push(this.t("Schimmel", "Mold"));
      this.addField(this.t("Inhalationsallergien", "Inhalation Allergies"), types.join(", "), 5);
    }
    if (a.tierepithelien?.ja) {
      hasAny = true;
      const types: string[] = [];
      if (a.tierepithelien.hund) types.push(this.t("Hund", "Dog"));
      if (a.tierepithelien.katze) types.push(this.t("Katze", "Cat"));
      if (a.tierepithelien.pferd) types.push(this.t("Pferd", "Horse"));
      if (a.tierepithelien.sonstige) types.push(a.tierepithelien.sonstige);
      this.addField(this.t("Tierepithelien", "Animal Epithelial"), types.join(", "), 5);
    }
    if (a.nahrungsmittel?.ja) {
      hasAny = true;
      this.addField(this.t("Nahrungsmittelallergien", "Food Allergies"), a.nahrungsmittel.details || a.nahrungsmittel.allergene?.join(", "), 5);
    }
    if (a.medikamente?.ja) {
      hasAny = true;
      this.addField(this.t("Medikamentenallergien", "Drug Allergies"), a.medikamente.details || a.medikamente.allergene?.join(", "), 5);
    }
    if (a.kontakt?.ja) {
      hasAny = true;
      const types: string[] = [];
      if (a.kontakt.nickel) types.push("Nickel");
      if (a.kontakt.latex) types.push("Latex");
      if (a.kontakt.sonstige) types.push(a.kontakt.sonstige);
      this.addField(this.t("Kontaktallergien", "Contact Allergies"), types.join(", "), 5);
    }
    if (a.laktose?.ja) { hasAny = true; this.addCheckboxField(this.t("Laktoseintoleranz", "Lactose Intolerance"), true); }
    if (a.gluten?.ja) { hasAny = true; this.addCheckboxField(this.t("Glutenunverträglichkeit", "Gluten Intolerance"), true); }
    if (a.fruktose?.ja) { hasAny = true; this.addCheckboxField(this.t("Fruktoseintoleranz", "Fructose Intolerance"), true); }
    if (a.histamin?.ja) { hasAny = true; this.addCheckboxField(this.t("Histaminintoleranz", "Histamine Intolerance"), true); }
    this.addField(this.t("Sonstige Unverträglichkeiten", "Other Intolerances"), a.sonstigeUnvertraeglichkeit, 5);
    if (!hasAny && !a.sonstigeUnvertraeglichkeit) this.addNoData(this.t("Keine Allergien angegeben", "No allergies specified"));
    this.addSpacing(10);
  }

  // === XV. Medications ===
  buildMedications(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XV. Medikamente", "XV. Medications"), "💊");
    const m = fd.medikamente;
    if (m?.inAerztlicherBehandlung?.ja) {
      this.addField(this.t("In ärztlicher Behandlung bei", "Under medical treatment with"), m.inAerztlicherBehandlung.beiWem, 5);
    }
    this.addField(this.t("Fachärzte", "Specialists"), m?.fachaerzte, 5);
    if (m?.aktuelle?.length > 0) {
      this.addSubHeader(this.t("Aktuelle Medikamente", "Current Medications"));
      m.aktuelle.forEach((med, i) => {
        const parts = [med.name, med.dosierung, med.grund, med.seit ? `${this.t("seit", "since")} ${med.seit}` : ""].filter(Boolean);
        this.addField(`${i + 1}.`, parts.join(" – "), 5);
      });
    } else {
      this.addNoData(this.t("Keine aktuellen Medikamente", "No current medications"));
    }
    if (m?.unvertraeglichkeiten?.length > 0) {
      this.addSubHeader(this.t("Medikamentenunverträglichkeiten", "Drug Intolerances"));
      m.unvertraeglichkeiten.forEach((u, i) => {
        this.addField(`${i + 1}. ${u.name}`, u.reaktion, 5);
      });
    }
    this.addSpacing(10);
  }

  // === XVI. Lifestyle ===
  buildLifestyle(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XVI. Lebensweise", "XVI. Lifestyle"), "🌿");
    const l = fd.lebensweise;
    if (!l) { this.addNoData(); this.addSpacing(10); return; }
    this.addFieldAlways(this.t("Raucher", "Smoker"), l.raucher || this.t("Nein", "No"));
    if (l.raucher === "aktiv" || l.raucher === "ehemals") {
      this.addField(this.t("Seit wann", "Since when"), l.raucherSeitWann, 5);
      this.addField(this.t("Zigaretten/Tag", "Cigarettes/day"), l.zigarettenProTag, 5);
      this.addField(this.t("Ex-Raucher bis", "Ex-smoker until"), l.exRaucherBisWann, 5);
    }
    this.addField(this.t("Passivrauchen", "Passive Smoking"), l.passivRauchen, 5);
    if (l.alkohol?.ja) {
      this.addCheckboxField(this.t("Alkoholkonsum", "Alcohol Consumption"), true);
      this.addField(this.t("Seit wann", "Since when"), l.alkohol.seitWann, 10);
      this.addField(this.t("Menge/Tag", "Amount/day"), l.alkohol.mengeProTag, 10);
      if (l.alkohol.typen?.length > 0) {
        l.alkohol.typen.forEach(t => this.addField(t.typ, t.menge, 10));
      }
    }
    if (l.sport?.ja) {
      this.addCheckboxField(this.t("Sport", "Sports"), true);
      this.addField(this.t("Art", "Type"), l.sport.art || l.sport.arten?.join(", "), 10);
      this.addField(this.t("Pro Woche", "Per week"), l.sport.proWoche ? `${l.sport.proWoche}x` : "", 10);
    }
    if (l.taeglicheBewegung?.ja) {
      this.addField(this.t("Tägliche Bewegung", "Daily Activity"), l.taeglicheBewegung.details, 5);
    }
    if (l.spaziergang?.ja) {
      this.addField(this.t("Spaziergang", "Walk"), `${l.spaziergang.proWoche}x, ${l.spaziergang.dauerMinuten} min`, 5);
    }
    this.addField(this.t("Meter zu Fuß/Tag", "Meters walked/day"), l.meterZuFuss, 5);
    this.addFieldAlways(this.t("Schlafqualität", "Sleep Quality"), l.schlafQualitaet);
    this.addFieldAlways(this.t("Schlafdauer", "Sleep Duration"), l.schlafDauer);
    this.addField(this.t("Stresslevel", "Stress Level"), l.stressLevel, 5);
    this.addField(this.t("Ernährung", "Diet"), l.ernaehrungsgewohnheiten || l.ernaehrungsTypen?.join(", "), 5);
    this.addField(this.t("Ernährung Sonstiges", "Diet Other"), l.ernaehrungSonstiges, 5);
    this.addSpacing(10);
  }

  // === XVII. Dental ===
  buildDental(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XVII. Zahngesundheit", "XVII. Dental Health"), "🦷");
    const z = fd.zahngesundheit;
    if (!z) { this.addNoData(); this.addSpacing(10); return; }
    this.addField(this.t("Gebisstyp", "Denture Type"), z.gebissTyp, 5);
    if (z.gebissTyp === "teilprothese" || z.gebissTyp === "vollprothese") {
      const kiefer: string[] = [];
      if (z.protheseKiefer?.oberkiefer) kiefer.push(this.t("Oberkiefer", "Upper Jaw"));
      if (z.protheseKiefer?.unterkiefer) kiefer.push(this.t("Unterkiefer", "Lower Jaw"));
      if (z.protheseKiefer?.beideKiefer) kiefer.push(this.t("Beide Kiefer", "Both Jaws"));
      this.addField(this.t("Prothese Kiefer", "Denture Jaw"), kiefer.join(", "), 5);
      this.addField(this.t("Prothese seit", "Denture since"), z.protheseSeit, 5);
    }
    // Tooth-level findings
    if (z.zahnbefunde && Object.keys(z.zahnbefunde).length > 0) {
      this.addSubHeader(this.t("Zahnbefunde (FDI-Schema)", "Tooth Findings (FDI System)"));
      for (const [tooth, finding] of Object.entries(z.zahnbefunde)) {
        if (finding.diagnoses?.length > 0) {
          this.addField(`${this.t("Zahn", "Tooth")} ${tooth}`, finding.diagnoses.join(", "), 5);
        }
      }
    }
    this.renderCondition(this.t("Parodontitis", "Periodontitis"), z.parodontitis);
    this.renderCondition(this.t("Zahnfleischbluten", "Bleeding Gums"), z.zahnfleischbluten);
    if (z.kiefergelenk?.ja) {
      const details: string[] = [];
      if (z.kiefergelenk.knacken) details.push(this.t("Knacken", "Clicking"));
      if (z.kiefergelenk.schmerzen) details.push(this.t("Schmerzen", "Pain"));
      if (z.kiefergelenk.eingeschraenkt) details.push(this.t("Eingeschränkt", "Limited"));
      this.addCheckboxField(`${this.t("Kiefergelenk", "TMJ")}: ${details.join(", ")}`, true);
    }
    if (z.bruxismus?.ja) {
      const details: string[] = [];
      if (z.bruxismus.nachts) details.push(this.t("Nachts", "Night"));
      if (z.bruxismus.tagsueber) details.push(this.t("Tagsüber", "Daytime"));
      if (z.bruxismus.schiene) details.push(this.t("Schiene", "Splint"));
      this.addCheckboxField(`${this.t("Bruxismus", "Bruxism")}: ${details.join(", ")}`, true);
    }
    this.addField(this.t("Letzter Zahnarztbesuch", "Last Dentist Visit"), z.letzterZahnarztbesuch, 5);
    this.addField(this.t("Zahnarzt", "Dentist"), z.zahnarztName, 5);
    this.addField(this.t("Bemerkungen", "Notes"), z.bemerkungen, 5);
    this.addSpacing(10);
  }

  // === XVIII. Environment ===
  buildEnvironment(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XVIII. Umweltbelastungen", "XVIII. Environmental Exposures"), "🌍");
    const u = fd.umweltbelastungen;
    if (!u) { this.addNoData(); this.addSpacing(10); return; }
    
    // Chemosensitivities
    if (u.chemosensibilitaet) {
      this.addSubHeader(this.t("Chemische Sensitivitäten", "Chemical Sensitivities"));
      const chemoLabels: Record<string, [string, string]> = {
        dieselAbgase: ["Dieselabgase", "Diesel Fumes"],
        tabakrauch: ["Tabakrauch", "Tobacco Smoke"],
        pestizide: ["Pestizide", "Pesticides"],
        benzin: ["Benzin", "Gasoline"],
        farben: ["Farben/Lacke", "Paints/Varnishes"],
        desinfektionsmittel: ["Desinfektionsmittel", "Disinfectants"],
        reiniger: ["Reiniger", "Cleaners"],
        parfuems: ["Parfüms", "Perfumes"],
        teer: ["Teer", "Tar"],
        nagellack: ["Nagellack", "Nail Polish"],
        haarspray: ["Haarspray", "Hairspray"],
        neueRaumausstattung: ["Neue Raumausstattung", "New Furnishings"],
        kunststoff: ["Kunststoff", "Plastics"],
        neuesAuto: ["Neues Auto", "New Car"],
      };
      let hasChemo = false;
      for (const [key, [de, en]] of Object.entries(chemoLabels)) {
        const val = (u.chemosensibilitaet as any)?.[key];
        if (val?.ja) {
          hasChemo = true;
          this.addCheckboxField(`${this.t(de, en)}${val.staerke ? ` (${val.staerke})` : ""}`, true);
        }
      }
      if (!hasChemo) this.addNoData();
    }

    // Body exposures
    if (u.koerperbelastungen) {
      this.addSubHeader(this.t("Körperbelastungen", "Body Exposures"));
      const kb = u.koerperbelastungen;
      if (kb.strahlung?.ja) {
        const types: string[] = [];
        if (kb.strahlung.geopathie) types.push(this.t("Geopathie", "Geopathy"));
        if (kb.strahlung.elektrosmog) types.push("Elektrosmog");
        if (kb.strahlung.hochspannung) types.push(this.t("Hochspannung", "High Voltage"));
        if (kb.strahlung.funkmasten) types.push(this.t("Funkmasten", "Cell Towers"));
        if (kb.strahlung.wlan) types.push("WLAN");
        this.addCheckboxField(`${this.t("Strahlenbelastung", "Radiation Exposure")}: ${types.join(", ")}`, true);
      }
      this.renderCondition(this.t("Zahnherde", "Dental Foci"), kb.zahnherde);
      this.renderCondition(this.t("Quecksilber/Amalgam", "Mercury/Amalgam"), kb.quecksilber);
      this.renderCondition(this.t("Zahnbeschwerden", "Dental Complaints"), kb.zahnbeschwerden);
      this.renderCondition(this.t("Metalle im Mund", "Metals in Mouth"), kb.metalleImMund);
      this.renderCondition(this.t("Implantate", "Implants"), kb.implantate);
      if (kb.nebenhoehlen?.ja) {
        const types: string[] = [];
        if (kb.nebenhoehlen.stirn) types.push(this.t("Stirn", "Frontal"));
        if (kb.nebenhoehlen.kiefer) types.push(this.t("Kiefer", "Maxillary"));
        if (kb.nebenhoehlen.beide) types.push(this.t("Beide", "Both"));
        this.addCheckboxField(`${this.t("Nebenhöhlen", "Sinuses")}: ${types.join(", ")}`, true);
      }
      this.renderCondition(this.t("Tonsillen", "Tonsils"), kb.tonsillen);
      this.renderCondition(this.t("Narben", "Scars"), kb.narben);
      if (kb.mangelzustaende?.ja) {
        const types: string[] = [];
        if (kb.mangelzustaende.vitamine) types.push(this.t("Vitamine", "Vitamins"));
        if (kb.mangelzustaende.mineralien) types.push(this.t("Mineralien", "Minerals"));
        if (kb.mangelzustaende.spurenelemente) types.push(this.t("Spurenelemente", "Trace Elements"));
        if (kb.mangelzustaende.enzyme) types.push(this.t("Enzyme", "Enzymes"));
        if (kb.mangelzustaende.fluessigkeit) types.push(this.t("Flüssigkeit", "Fluids"));
        this.addCheckboxField(`${this.t("Mangelzustände", "Deficiencies")}: ${types.join(", ")}`, true);
      }
      if (kb.mikroorganismen?.ja) {
        const types: string[] = [];
        if (kb.mikroorganismen.viren) types.push(this.t("Viren", "Viruses"));
        if (kb.mikroorganismen.bakterien) types.push(this.t("Bakterien", "Bacteria"));
        if (kb.mikroorganismen.pilze) types.push(this.t("Pilze", "Fungi"));
        if (kb.mikroorganismen.parasiten) types.push(this.t("Parasiten", "Parasites"));
        this.addCheckboxField(`${this.t("Mikroorganismen", "Microorganisms")}: ${types.join(", ")}`, true);
      }
      if (kb.toxisch?.ja) {
        const types: string[] = [];
        if (kb.toxisch.schwermetalle) types.push(this.t("Schwermetalle", "Heavy Metals"));
        if (kb.toxisch.chemikalien) types.push(this.t("Chemikalien", "Chemicals"));
        if (kb.toxisch.pestizide) types.push(this.t("Pestizide", "Pesticides"));
        if (kb.toxisch.erbtoxine) types.push(this.t("Erbtoxine", "Hereditary Toxins"));
        this.addCheckboxField(`${this.t("Toxische Belastung", "Toxic Exposure")}: ${types.join(", ")}`, true);
      }
    }
    this.addSpacing(10);
  }

  // === XIX. Infections ===
  buildInfections(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XIX. Infektionen", "XIX. Infections"), "🦠");
    const inf = fd.infektionen;
    if (!inf) { this.addNoData(); this.addSpacing(10); return; }
    if (inf.tropenReise?.ja) {
      this.addCheckboxField(this.t("Tropenreise", "Tropical Travel"), true);
      this.addField(this.t("Jahr", "Year"), inf.tropenReise.jahr, 10);
      this.addField(this.t("Länder", "Countries"), inf.tropenReise.laender || inf.tropenReise.laenderList?.join(", "), 10);
    }
    this.renderCondition(this.t("Zeckenbiss", "Tick Bite"), inf.zeckenbiss);
    this.renderCondition(this.t("Borreliose", "Lyme Disease"), inf.borreliose);
    this.renderCondition(this.t("FSME-Impfung", "TBE Vaccination"), inf.fsmeImpfung);
    if (inf.hund?.ja) this.addField(this.t("Hund", "Dog"), inf.hund.rasse, 5);
    if (inf.katze?.ja) this.addField(this.t("Katze", "Cat"), inf.katze.rasse, 5);
    if (inf.pferd?.ja) this.addField(this.t("Pferd", "Horse"), inf.pferd.kontakt, 5);
    if (inf.andereHaustiere?.ja) this.addField(this.t("Andere Haustiere", "Other Pets"), inf.andereHaustiere.welche, 5);
    this.addSpacing(10);
  }

  // === XX. Vaccinations ===
  buildVaccinations(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XX. Impfstatus", "XX. Vaccinations"), "💉");
    const imp = fd.impfungen;
    if (!imp) { this.addNoData(); this.addSpacing(10); return; }
    const vaccines: [string, string, string, any][] = [
      ["mmr", "MMR", "MMR", imp.mmr],
      ["tetanus", "Tetanus", "Tetanus", imp.tetanus],
      ["diphtherie", "Diphtherie", "Diphtheria", imp.diphtherie],
      ["keuchhusten", "Keuchhusten", "Whooping Cough", imp.keuchhusten],
      ["polio", "Polio", "Polio", imp.polio],
      ["hepatitisA", "Hepatitis A", "Hepatitis A", imp.hepatitisA],
      ["hepatitisB", "Hepatitis B", "Hepatitis B", imp.hepatitisB],
      ["windpocken", "Windpocken", "Chickenpox", imp.windpocken],
      ["influenza", "Influenza", "Influenza", imp.influenza],
      ["pneumokokken", "Pneumokokken", "Pneumococcal", imp.pneumokokken],
    ];
    let hasVax = false;
    vaccines.forEach(([, de, en, vax]) => {
      if (vax?.ja) {
        hasVax = true;
        const zeit = vax.jahr || vax.zuletzt || "";
        this.addCheckboxField(`${this.t(de, en)}${zeit ? ` (${zeit})` : ""}`, true);
      }
    });

    // COVID
    if (imp.covid?.geimpft) {
      hasVax = true;
      this.addSubHeader("COVID-19");
      [imp.covid.dosis1, imp.covid.dosis2, imp.covid.dosis3, imp.covid.dosis4].forEach((d, i) => {
        if (d?.ja) {
          this.addField(`${this.t("Dosis", "Dose")} ${i + 1}`, `${d.datum} – ${d.hersteller}`, 5);
        }
      });
      if (imp.covid.weitereAnzahl) this.addField(this.t("Weitere Dosen", "Additional Doses"), imp.covid.weitereAnzahl, 5);
      if (imp.covid.impfreaktionen?.ja) this.addField(this.t("Impfreaktionen", "Vaccine Reactions"), imp.covid.impfreaktionen.art, 5);
      if (imp.covid.infiziert?.ja) {
        this.addField(this.t("COVID-Infektion", "COVID Infection"), `${imp.covid.infiziert.wann} (${imp.covid.infiziert.schwere})`, 5);
      }
      if (imp.covid.longCovid?.ja) this.addField("Long COVID", imp.covid.longCovid.welche, 5);
    }
    if (!hasVax) this.addNoData(this.t("Keine Impfungen angegeben", "No vaccinations reported"));
    this.addSpacing(10);
  }

  // === XXI. Complaints ===
  buildComplaints(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XXI. Beschwerden", "XXI. Complaints"), "📋");
    const b = fd.beschwerden;
    if (!b || (!b.hauptbeschwerde && !b.weitereBeschwerden)) { this.addNoData(); this.addSpacing(10); return; }
    this.addField(this.t("Hauptbeschwerde", "Main Complaint"), b.hauptbeschwerde, 5);
    this.addField(this.t("Weitere Beschwerden", "Additional Complaints"), b.weitereBeschwerden, 5);
    this.addField(this.t("Beginn", "Onset"), b.beginnDerBeschwerden, 5);
    this.addField(this.t("Verlauf", "Course"), b.verlauf, 5);
    if (b.auftreten?.length > 0) this.addField(this.t("Auftreten", "Occurrence"), b.auftreten.join(", "), 5);
    this.addField(this.t("Ausstrahlung", "Radiation"), b.ausstrahlung, 5);
    if (b.artDerBeschwerden?.length > 0) this.addField(this.t("Art der Beschwerden", "Type of Complaints"), b.artDerBeschwerden.join(", "), 5);
    if (b.schmerzqualitaet?.length > 0) this.addField(this.t("Schmerzqualität", "Pain Quality"), b.schmerzqualitaet.join(", "), 5);
    this.addField(this.t("Schmerzintensität (0-10)", "Pain Intensity (0-10)"), b.schmerzintensitaet, 5);
    if (b.verschlimmerung?.length > 0) this.addField(this.t("Verschlimmerung durch", "Worsened by"), b.verschlimmerung.join(", "), 5);
    if (b.verbesserung?.length > 0) this.addField(this.t("Verbesserung durch", "Improved by"), b.verbesserung.join(", "), 5);
    this.addField(this.t("Bisherige Behandlungen", "Previous Treatments"), b.bisherigeBehandlungen, 5);
    this.addField(this.t("Ergebnis", "Result"), b.ergebnisBisherigerBehandlungen, 5);
    this.addSpacing(10);
  }

  // === XXII. Preferences ===
  buildPreferences(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XXII. Behandlungspräferenzen", "XXII. Treatment Preferences"), "✨");
    const bp = fd.behandlungspraeferenzen;
    if (!bp) { this.addNoData(); this.addSpacing(10); return; }
    const therapies: [string, string, string][] = [
      ["homoeopathie", "Homöopathie", "Homeopathy"],
      ["biophysikalisch", "Biophysikalische Therapie", "Biophysical Therapy"],
      ["metatron", "Metatron/NLS", "Metatron/NLS"],
      ["trikombin", "Trikombin", "Trikombin"],
      ["zapper", "Zapper", "Zapper"],
      ["eav", "EAV", "EAV"],
      ["mineralTestung", "Mineral-Testung", "Mineral Testing"],
      ["akupunktur", "Akupunktur", "Acupuncture"],
      ["phytotherapie", "Phytotherapie", "Phytotherapy"],
      ["bachblueten", "Bachblüten", "Bach Flowers"],
      ["sanum", "Sanum-Therapie", "Sanum Therapy"],
      ["hypnotherapie", "Hypnotherapie", "Hypnotherapy"],
    ];
    let hasAny = false;
    therapies.forEach(([key, de, en]) => {
      const val = bp[key as keyof typeof bp];
      if (val && typeof val === 'object' && ('interesse' in val || 'erfahren' in val)) {
        const tags: string[] = [];
        if ((val as any).interesse) tags.push(this.t("Interesse", "Interested"));
        if ((val as any).erfahren) tags.push(this.t("Erfahren", "Experienced"));
        if (tags.length > 0) {
          hasAny = true;
          this.addCheckboxField(`${this.t(de, en)}: ${tags.join(", ")}`, true);
        }
      }
    });
    if (!hasAny) this.addNoData();
    this.addField(this.t("Therapieerwartungen", "Therapy Expectations"), fd.therapieerwartungen, 5);
    this.addField(this.t("Gesundheitsziele", "Health Goals"), fd.gesundheitsziele, 5);
    this.addField(this.t("Weitere Erkrankungen", "Additional Conditions"), fd.weitereErkrankungen, 5);
    this.addSpacing(10);
  }

  // === XXIII. Social ===
  buildSocial(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XXIII. Persönliches", "XXIII. Personal"), "🏠");
    const s = fd.soziales;
    if (!s) { this.addNoData(); this.addSpacing(10); return; }
    this.addField(this.t("Familienstand", "Marital Status"), s.familienstand, 5);
    this.addField(this.t("Kinder (Anzahl)", "Children (Count)"), s.kinderAnzahl, 5);
    this.addField(this.t("Alter der Kinder", "Children's Ages"), s.kinderAlter, 5);
    this.addField(this.t("Wohnumfeld", "Living Environment"), s.wohnumfeld, 5);
    this.addField(this.t("Wohntyp", "Housing Type"), s.wohntyp, 5);
    this.addField(this.t("Beruflicher Stress", "Work Stress"), s.berufStress, 5);
    this.addField(this.t("Finanzielle Belastung", "Financial Burden"), s.finanzBelastung, 5);
    this.addField(this.t("Soziales Netzwerk", "Social Network"), s.sozialesNetzwerk, 5);
    this.addField(this.t("Hobbys", "Hobbies"), s.hobbys, 5);
    this.addSpacing(10);
  }

  // === XXIV. IAA – Individuelle Austestung und Analyse ===
  buildIAA(iaaData: Record<string, number>) {
    if (!iaaData || Object.keys(iaaData).length === 0) {
      return;
    }

    const severityLabels = this.language === "de"
      ? ["", "1 – sehr leicht", "2 – leicht", "3 – mäßig", "4 – stark", "5 – sehr stark", "6 – extrem"]
      : ["", "1 – very mild", "2 – mild", "3 – moderate", "4 – strong", "5 – very strong", "6 – extreme"];

    this.addSectionHeader(this.t(
      "XXIV. IAA – Individuelle Austestung und Analyse",
      "XXIV. IAA – Individual Testing and Analysis"
    ), "🔬");

    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "italic");
    this.doc.setTextColor(BRAND_MUTED.r, BRAND_MUTED.g, BRAND_MUTED.b);
    this.doc.text(this.t(
      "Optimiert für Trikombin-Geräte – Skala 1 (sehr leicht) bis 6 (extrem)",
      "Optimized for Trikombin devices – Scale 1 (very mild) to 6 (extreme)"
    ), this.margin, this.yPos);
    this.yPos += this.lineHeight + 2;
    this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);

    let totalAnswered = 0;

    for (const category of iaaCategories) {
      const answeredInCat = category.questions.filter(q => iaaData[q.id] && iaaData[q.id] > 0);
      if (answeredInCat.length === 0) continue;

      this.addSubHeader(this.t(category.titleDe, category.titleEn));
      
      for (const q of answeredInCat) {
        const val = iaaData[q.id];
        const label = this.t(q.textDe, q.textEn).replace(/\?$/, "");
        const severity = severityLabels[val] || String(val);
        this.addField(label, severity, 5);
        totalAnswered++;
      }
      this.addSpacing(3);
    }

    if (totalAnswered === 0) {
      this.addNoData(this.t("Kein IAA-Fragebogen ausgefüllt", "No IAA questionnaire completed"));
    } else {
      this.addSpacing(3);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "italic");
      this.doc.setTextColor(BRAND_MUTED.r, BRAND_MUTED.g, BRAND_MUTED.b);
      this.doc.text(this.t(
        `${totalAnswered} Symptome bewertet`,
        `${totalAnswered} symptoms rated`
      ), this.margin, this.yPos);
      this.yPos += this.lineHeight;
      this.doc.setTextColor(BRAND_TEXT.r, BRAND_TEXT.g, BRAND_TEXT.b);
    }
    this.addSpacing(10);
  }

  // === XXV. Signature ===
  buildSignature(fd: AnamneseFormData) {
    this.addSectionHeader(this.t("XXV. Unterschrift", "XXV. Signature"), "✍️");
    const u = fd.unterschrift;
    if (!u) return;
    this.addField(this.t("Ort", "Place"), u.ort, 5);
    this.addField(this.t("Datum", "Date"), u.datum, 5);
    this.addField(this.t("Name in Druckbuchstaben", "Name in Block Letters"), u.nameInDruckbuchstaben, 5);
    this.addCheckboxField(this.t("Datenschutzerklärung bestätigt", "Privacy Policy Confirmed"), u.bestaetigung);
    this.addCheckboxField(this.t("Datenschutz-Einwilligung", "Data Protection Consent"), u.datenschutzEinwilligung);
    this.addCheckboxField(this.t("Patientenaufklärung akzeptiert", "Patient Information Accepted"), u.patientenaufklaerungAkzeptiert);
    this.addCheckboxField(this.t("2FA-Bestätigung", "2FA Confirmed"), u.bestaetigung2fa);
    this.addField(this.t("Erziehungsberechtigter", "Legal Guardian"), u.erziehungsberechtigter, 5);
    this.addField(this.t("Zusätzliche Informationen", "Additional Information"), fd.zusaetzlicheInfos, 5);
  }

  // ============ Output ============

  save(formData: AnamneseFormData) {
    const patientName = `${formData.nachname}_${formData.vorname}`.replace(/[^a-zA-Z0-9]/g, "_") || "Patient";
    const date = new Date().toISOString().split("T")[0];
    this.doc.save(`Anamnesebogen_${patientName}_${date}.pdf`);
  }

  toBase64(): string {
    const dataUri = this.doc.output('datauristring');
    return dataUri.split(',')[1];
  }
}

// ============ Public API ============

export const generateEnhancedAnamnesePdf = async ({ formData, language, iaaData }: PdfExportOptions) => {
  const builder = new AnamnesePdfBuilder(language);
  builder.buildDocument(formData, iaaData);
  builder.save(formData);
};

export const generateAnamnesePdfBase64 = async ({ formData, language, iaaData }: PdfExportOptions): Promise<string> => {
  const builder = new AnamnesePdfBuilder(language);
  builder.buildDocument(formData, iaaData);
  return builder.toBase64();
};

/** Generate Anamnese PDF WITHOUT IAA data (for patient copy) */
export const generateAnamnesePdfBase64WithoutIAA = async ({ formData, language }: PdfExportOptions): Promise<string> => {
  const builder = new AnamnesePdfBuilder(language);
  builder.buildDocument(formData, undefined, { excludeIAA: true });
  return builder.toBase64();
};

/** Generate IAA-only PDF (for practice only) */
export const generateIAAPdfBase64 = async ({ formData, language, iaaData }: PdfExportOptions): Promise<string> => {
  if (!iaaData || Object.keys(iaaData).length === 0) return "";
  const builder = new AnamnesePdfBuilder(language);
  builder.buildIAADocument(formData, iaaData);
  return builder.toBase64();
};
