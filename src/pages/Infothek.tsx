import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import {
  Stethoscope, Euro, Zap, HelpCircle, BookOpen, Radio, FileText,
  ClipboardList, ShieldCheck, FileSignature, Activity, AlertTriangle,
  Leaf, Flower2, Droplets, HeartPulse, Milk, Scale, Microscope,
  Bug, Syringe, Cigarette, Route, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoItem {
  label: { de: string; en: string };
  href: string;
  icon: React.ElementType;
  description: { de: string; en: string };
  external?: boolean;
}

interface InfoGroup {
  title: { de: string; en: string };
  items: InfoItem[];
}

const groups: InfoGroup[] = [
  {
    title: { de: "Für Patienten", en: "For Patients" },
    items: [
      { label: { de: "Patientenaufklärung", en: "Patient Information" }, href: "/patientenaufklaerung", icon: FileSignature, description: { de: "Kosten, Erstattung & Vereinbarung", en: "Costs, reimbursement & agreement" } },
      { label: { de: "Ihr Therapieweg", en: "Your Treatment Path" }, href: "/therapieweg-uebersicht.html", icon: Route, description: { de: "Ablauf der ganzheitlichen Behandlung Schritt für Schritt", en: "Step-by-step holistic treatment process" }, external: true },
    ],
  },
  {
    title: { de: "Wissen & Therapie", en: "Knowledge & Therapy" },
    items: [
      { label: { de: "Quellenhinweis & Haftung", en: "Sources & Disclaimer" }, href: "/quellenhinweis", icon: Scale, description: { de: "Herkunft, Einordnung & Grenzen unserer Informationen", en: "Origin, classification & limits of our information" } },
      { label: { de: "Was ist ein Heilpraktiker?", en: "What is a Naturopath?" }, href: "/heilpraktiker", icon: Stethoscope, description: { de: "Berufsbild und Behandlungsmethoden", en: "Profession and treatment methods" } },
      { label: { de: "Was ist Frequenztherapie?", en: "What is Frequency Therapy?" }, href: "/krankheit-ist-messbar.html", icon: Zap, description: { de: "Physikalische Grundlagen der Frequenztherapie", en: "Physical foundations of frequency therapy" }, external: true },
      { label: { de: "Diamond Shield Zapper", en: "Diamond Shield Zapper" }, href: "/zapper-diamond-shield.html", icon: Radio, description: { de: "Frequenzgerät für Wellness und Erfahrungsheilkunde", en: "Frequency device for wellness" }, external: true },
      { label: { de: "Vieva Pro Vitalanalyse", en: "Vieva Pro Vital Analysis" }, href: "/vieva-pro-vitalanalyse.html", icon: Activity, description: { de: "Ganzheitliche Gesundheitsanalyse per HRV & Vitalfeld", en: "Holistic health analysis via HRV & vital field" }, external: true },
      { label: { de: "Allergien & Intoleranzen", en: "Allergies & Intolerances" }, href: "/ass-salicylat-histamin.html", icon: AlertTriangle, description: { de: "ASS-, Salicylat- & Histamin-Unverträglichkeit", en: "ASS, salicylate & histamine intolerance" }, external: true },
      { label: { de: "Diabetes Typ 1 & Typ 2", en: "Diabetes Type 1 & Type 2" }, href: "/diabetes-handout.html", icon: HeartPulse, description: { de: "Patientenhandout: Zielwerte, Messen & Alltagstipps", en: "Patient handout: target values, measuring & daily tips" }, external: true },
      { label: { de: "Milch-Unverträglichkeit", en: "Milk Intolerance" }, href: "/milch-unvertraeglichkeit", icon: Milk, description: { de: "Milchprotein-Allergie & Laktoseintoleranz erklärt", en: "Milk protein allergy & lactose intolerance explained" } },
      { label: { de: "Milch & Knochengesundheit", en: "Milk & Bone Health" }, href: "/milch-knochengesundheit", icon: HeartPulse, description: { de: "Das Calcium-Paradoxon & wissenschaftliche Debatte", en: "The calcium paradox & scientific debate" } },
      { label: { de: "Rohmilch – Mikrobiologie", en: "Raw Milk – Microbiology" }, href: "/rohmilch-mikrobiologie", icon: Microscope, description: { de: "Pathogene Keime & Pasteurisierung", en: "Pathogenic organisms & pasteurization" } },
      { label: { de: "Parasiten in Deutschland", en: "Parasites in Germany" }, href: "/parasiten-deutschland.html", icon: Bug, description: { de: "Vorkommen, Arten & Symptome heimischer Parasiten", en: "Prevalence, types & symptoms of local parasites" }, external: true },
      { label: { de: "Viren & Bakterien", en: "Viruses & Bacteria" }, href: "/viren-bakterien-deutschland.html", icon: Syringe, description: { de: "Akute & latente Belastungen, Erregerpersistenz", en: "Acute & latent infections, pathogen persistence" }, external: true },
    ],
  },
  {
    title: { de: "Therapie & Begleitung", en: "Therapy & Support" },
    items: [
      { label: { de: "Allergiebehandlung", en: "Allergy Treatment" }, href: "/allergiebehandlung.html", icon: Flower2, description: { de: "Ganzheitliche Allergie-Betrachtung – Teile nur für Patienten", en: "Holistic allergy approach – parts for patients only" }, external: true },
      { label: { de: "Kräuter & Gewürze gegen Schmerz", en: "Herbs & Spices for Pain" }, href: "/kraeuter-schmerz-entzuendung.html", icon: Leaf, description: { de: "Phytotherapie bei Schmerz & Entzündung", en: "Phytotherapy for pain & inflammation" }, external: true },
      { label: { de: "Raucherentwöhnung", en: "Smoking Cessation" }, href: "/raucherentwoehnung", icon: Cigarette, description: { de: "Selbsthypnose & Begleitskript zur E-Zigaretten-Entwöhnung", en: "Self-hypnosis & companion script for e-cigarette cessation" } },
    ],
  },
  {
    title: { de: "Praktisches", en: "Practical Info" },
    items: [
      { label: { de: "GebÜH", en: "Fee Schedule" }, href: "/gebueh", icon: Euro, description: { de: "Gebührenordnung für Heilpraktiker", en: "Fee schedule for practitioners" } },
      { label: { de: "Häufige Fragen", en: "FAQ" }, href: "/faq", icon: HelpCircle, description: { de: "Antworten auf wichtige Fragen", en: "Answers to important questions" } },
    ],
  },
];

export default function Infothek() {
  const { t } = useLanguage();

  return (
    <Layout>
      <SEOHead
        title="Infothek – Naturheilpraxis Peter Rauch"
        description="Fachartikel, Patienteninformationen und Wissenswertes rund um Naturheilkunde, Frequenztherapie und ganzheitliche Gesundheit."
      />

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-1.5 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" />
              {t("Infothek", "Info Center")}
            </div>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl">
              {t("Infothek", "Info Center")}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t(
                "Fachartikel, Patienteninformationen und Wissenswertes rund um Naturheilkunde und ganzheitliche Gesundheit.",
                "Articles, patient information and knowledge about naturopathy and holistic health."
              )}
            </p>
          </div>

          <div className="mx-auto max-w-5xl space-y-12">
            {groups.map((group) => (
              <div key={group.title.de}>
                <h2 className="mb-6 font-serif text-xl font-semibold text-foreground md:text-2xl">
                  {t(group.title.de, group.title.en)}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const content = (
                      <div className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-foreground">
                          {t(item.label.de, item.label.en)}
                          {item.external && <ExternalLink className="ml-1.5 inline h-3 w-3 text-muted-foreground" />}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t(item.description.de, item.description.en)}
                        </p>
                      </div>
                    );

                    if (item.external) {
                      return (
                        <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                          {content}
                        </a>
                      );
                    }
                    return (
                      <Link key={item.href} to={item.href}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
