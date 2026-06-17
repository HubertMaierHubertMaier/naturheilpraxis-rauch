import type { ElementType } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Bug,
  Cigarette,
  ClipboardList,
  Droplets,
  Euro,
  FileSignature,
  FileText,
  Flower2,
  HeartPulse,
  HelpCircle,
  Leaf,
  Microscope,
  Milk,
  Moon,
  Pill,
  Radio,
  Route,
  Salad,
  Scale,
  ShieldCheck,
  Sprout,
  Stethoscope,
  Syringe,
  Waves,
  Wind,
  Zap,
} from "lucide-react";

type LocalizedText = { de: string; en: string };

export interface InfothekItem {
  label: LocalizedText;
  href: string;
  icon: ElementType;
  description: LocalizedText;
  external?: boolean;
  showInOverview?: boolean;
}

export interface InfothekGroup {
  title: LocalizedText;
  items: InfothekItem[];
}

export const infothekGroups: InfothekGroup[] = [
  {
    title: { de: "Für Patienten", en: "For Patients" },
    items: [
      {
        label: { de: "Anamnesebogen", en: "Medical History" },
        href: "/anamnesebogen",
        icon: ClipboardList,
        description: { de: "Medizinischer Fragebogen", en: "Medical questionnaire" },
        showInOverview: false,
      },
      {
        label: { de: "Datenschutzerklärung", en: "Privacy Policy" },
        href: "/datenschutz",
        icon: ShieldCheck,
        description: { de: "Informationen zum Datenschutz", en: "Privacy information" },
        showInOverview: false,
      },
      {
        label: { de: "Patientenaufklärung", en: "Patient Information" },
        href: "/patientenaufklaerung",
        icon: FileSignature,
        description: { de: "Kosten, Erstattung & Vereinbarung", en: "Costs, reimbursement & agreement" },
      },
      {
        label: { de: "Ihr Therapieweg", en: "Your Treatment Path" },
        href: "/therapieweg-uebersicht.html",
        icon: Route,
        description: { de: "Ablauf der ganzheitlichen Behandlung Schritt für Schritt", en: "Step-by-step holistic treatment process" },
        external: true,
      },
    ],
  },
  {
    title: {
      de: "Analyse- & Therapiegeräte der Praxis Peter Rauch",
      en: "Analysis & Therapy Devices of Praxis Peter Rauch",
    },
    items: [
      {
        label: { de: "Vieva Pro Vitalanalyse", en: "Vieva Pro Vital Analysis" },
        href: "/vieva-pro-vitalanalyse.html",
        icon: Activity,
        description: { de: "Ganzheitliche Gesundheitsanalyse per HRV & Vitalfeld", en: "Holistic health analysis via HRV & vital field" },
        external: true,
      },
      {
        label: { de: "Diamond Shield Zapper", en: "Diamond Shield Zapper" },
        href: "/zapper-diamond-shield.html",
        icon: Radio,
        description: { de: "Frequenzgerät für Wellness und Erfahrungsheilkunde", en: "Frequency device for wellness" },
        external: true,
      },
    ],
  },
  {
    title: { de: "Wissen", en: "Knowledge" },
    items: [
      {
        label: { de: "Quellenhinweis & Haftung", en: "Sources & Disclaimer" },
        href: "/quellenhinweis",
        icon: Scale,
        description: { de: "Herkunft, Einordnung & Grenzen unserer Informationen", en: "Origin, classification & limits of our information" },
      },
      {
        label: { de: "Was ist ein Heilpraktiker?", en: "What is a Naturopath?" },
        href: "/heilpraktiker",
        icon: Stethoscope,
        description: { de: "Berufsbild und Behandlungsmethoden", en: "Profession and treatment methods" },
      },
      {
        label: { de: "Was ist Frequenztherapie?", en: "What is Frequency Therapy?" },
        href: "/krankheit-ist-messbar.html",
        icon: Zap,
        description: { de: "Physikalische Grundlagen der Frequenztherapie", en: "Physical foundations of frequency therapy" },
        external: true,
      },
      {
        label: { de: "Allergien & Intoleranzen", en: "Allergies & Intolerances" },
        href: "/ass-salicylat-histamin.html",
        icon: AlertTriangle,
        description: { de: "ASS-, Salicylat- & Histamin-Unverträglichkeit", en: "ASS, salicylate & histamine intolerance" },
        external: true,
      },
      {
        label: { de: "Diabetes Typ 1 & Typ 2", en: "Diabetes Type 1 & Type 2" },
        href: "/diabetes-handout.html",
        icon: HeartPulse,
        description: { de: "Patientenhandout: Zielwerte, Messen & Alltagstipps", en: "Patient handout: target values, measuring & daily tips" },
        external: true,
      },
      {
        label: { de: "LOGI-Kost & Mitochondrien", en: "LOGI Diet & Mitochondria" },
        href: "/logi-ernaehrung-mitochondrien.html",
        icon: Salad,
        description: { de: "Niedrig glykämische Ernährung zur Mitochondrien-Entlastung", en: "Low-glycemic diet to support mitochondrial health" },
        external: true,
      },
      {
        label: { de: "Milch-Unverträglichkeit", en: "Milk Intolerance" },
        href: "/milch-unvertraeglichkeit",
        icon: Milk,
        description: { de: "Milchprotein-Allergie & Laktoseintoleranz erklärt", en: "Milk protein allergy & lactose intolerance explained" },
      },
      {
        label: { de: "Milch & Knochengesundheit", en: "Milk & Bone Health" },
        href: "/milch-knochengesundheit",
        icon: HeartPulse,
        description: { de: "Das Calcium-Paradoxon & wissenschaftliche Debatte", en: "The calcium paradox & scientific debate" },
      },
      {
        label: { de: "Rohmilch – Mikrobiologie", en: "Raw Milk – Microbiology" },
        href: "/rohmilch-mikrobiologie",
        icon: Microscope,
        description: { de: "Pathogene Keime & Pasteurisierung", en: "Pathogenic organisms & pasteurization" },
      },
      {
        label: { de: "Parasiten in Deutschland", en: "Parasites in Germany" },
        href: "/parasiten-deutschland.html",
        icon: Bug,
        description: { de: "Vorkommen, Arten & Symptome heimischer Parasiten", en: "Prevalence, types & symptoms of local parasites" },
        external: true,
      },
      {
        label: { de: "Viren & Bakterien", en: "Viruses & Bacteria" },
        href: "/viren-bakterien-deutschland.html",
        icon: Syringe,
        description: { de: "Akute & latente Belastungen, Erregerpersistenz", en: "Acute & latent infections, pathogen persistence" },
        external: true,
      },
      {
        label: { de: "Umwelt, Alltag & Gesundheit", en: "Environment, Daily Life & Health" },
        href: "/umwelt-alltag-gesundheit.html",
        icon: Sprout,
        description: { de: "Belastungen im Wohn- und Lebensumfeld – mit Alternativen & seriösen Quellen", en: "Daily-life burdens & alternatives with reputable sources" },
        external: true,
      },
      {
        label: { de: "Müdigkeit, Erschöpfung & Burnout", en: "Fatigue, Exhaustion & Burnout" },
        href: "/muedigkeit-erschoepfung-burnout.html",
        icon: Brain,
        description: { de: "Begriffe, Zahlen (DE/EU), Ursachen & Versorgung Kasse vs. Privat – mit Quellen", en: "Definitions, prevalence (DE/EU), causes & care (statutory vs. private) – sourced" },
        external: true,
      },
      {
        label: { de: "Mitochondropathie & instabile HWS", en: "Mitochondropathy & unstable cervical spine" },
        href: "/mitochondropathie-hws.html",
        icon: Activity,
        description: { de: "DNA-Vorschädigung, nitrosativer Stress, HWS-Trauma – Modell nach Dr. Kuklinski mit Buchquellen", en: "DNA pre-damage, nitrosative stress, cervical trauma – Dr. Kuklinski's model with book sources" },
        external: true,
      },
    ],
  },
  {
    title: { de: "Nur für Patienten der Naturheilpraxis Peter Rauch", en: "Only for Patients of Naturheilpraxis Peter Rauch" },
    items: [
      {
        label: { de: "Allergiebehandlung", en: "Allergy Treatment" },
        href: "/allergiebehandlung.html",
        icon: Flower2,
        description: { de: "Ganzheitliche Allergie-Betrachtung & Therapie", en: "Holistic allergy approach & therapy" },
        external: true,
      },
      {
        label: { de: "Candida-Diät", en: "Candida Diet" },
        href: "/candida-diaet.html",
        icon: FileText,
        description: { de: "Ernährungsratgeber bei Candida-Pilzbefall", en: "Dietary guide for Candida infection" },
        external: true,
      },
      {
        label: { de: "Kräuter & Gewürze gegen Schmerz", en: "Herbs & Spices for Pain" },
        href: "/kraeuter-schmerz-entzuendung.html",
        icon: Leaf,
        description: { de: "Phytotherapie bei Schmerz & Entzündung", en: "Phytotherapy for pain & inflammation" },
        external: true,
      },
      {
        label: { de: "Hochohmiges Wasser", en: "High-Ohm Water" },
        href: "/patienteninfo-hochohmiges-wasser.html",
        icon: Droplets,
        description: { de: "Mineralarmes Wasser nach der Behandlung", en: "Mineral-poor water after treatment" },
        external: true,
      },
    ],
  },
  {
    title: {
      de: "Hypnose – nur für Patienten der Naturheilpraxis Peter Rauch",
      en: "Hypnosis – only for Patients of Naturheilpraxis Peter Rauch",
    },
    items: [
      {
        label: { de: "Raucherentwöhnung / E-Zigarette", en: "Smoking Cessation / E-Cigarette" },
        href: "/raucherentwoehnung",
        icon: Cigarette,
        description: { de: "Selbsthypnose & Begleitskript zur E-Zigaretten-Entwöhnung", en: "Self-hypnosis & companion script for e-cigarette cessation" },
      },
      {
        label: { de: "Schilddrüsen-Hypnose", en: "Thyroid Hypnosis" },
        href: "/schilddruese-hypnose",
        icon: Wind,
        description: { de: "Verlaufstagebuch & Begleitskript bei Schilddrüsen-Knoten", en: "Progress journal & companion script for thyroid nodules" },
      },
      {
        label: { de: "Bauchwohl-Hypnose", en: "Belly Calm Hypnosis" },
        href: "/reizdarm-hypnose",
        icon: Waves,
        description: { de: "Tiefenentspannung für Bauch, Vegetativum und Beckenboden – innere Ruhe & Gelassenheit", en: "Deep relaxation for belly, vagus nerve and pelvic floor – inner calm & ease" },
      },
      {
        label: { de: "Einschlaf-Hypnose für Kinder (ca. 3 J.)", en: "Bedtime Hypnosis for Children (~3 yrs)" },
        href: "/therapie/einschlafhilfe-kind/Einschlaf-Hypnose_Kind_3J.pdf",
        icon: Moon,
        description: { de: "Sanftes Einschlaf-Skript für Eltern zum Vorlesen – inkl. Eltern-Erklärung (PDF)", en: "Gentle bedtime script for parents to read aloud – incl. parent guide (PDF)" },
        external: true,
      },
      {
        label: { de: "Einschlaf-Hypnose Kinder – Word-Vorlage", en: "Bedtime Hypnosis Kids – Word Template" },
        href: "/therapie/einschlafhilfe-kind/Einschlaf-Hypnose_Kind_3J.docx",
        icon: FileText,
        description: { de: "Bearbeitbare DOCX-Version zum Anpassen an Name & Alter des Kindes", en: "Editable DOCX version to adapt to child's name & age" },
        external: true,
      },
    ],
  },
  {
    title: { de: "Praktisches", en: "Practical Info" },
    items: [
      {
        label: { de: "GebÜH", en: "Fee Schedule" },
        href: "/gebueh",
        icon: Euro,
        description: { de: "Gebührenordnung für Heilpraktiker", en: "Fee schedule for practitioners" },
      },
      {
        label: { de: "Häufige Fragen", en: "FAQ" },
        href: "/faq",
        icon: HelpCircle,
        description: { de: "Antworten auf wichtige Fragen", en: "Answers to important questions" },
      },
    ],
  },
];

export const infothekOverviewGroups: InfothekGroup[] = infothekGroups
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => item.showInOverview !== false),
  }))
  .filter((group) => group.items.length > 0);