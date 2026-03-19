import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Stethoscope, Euro, Zap, HelpCircle, BookOpen, Radio, FileText, ClipboardList, ShieldCheck, FileSignature, Activity, AlertTriangle, Leaf, Flower2, Droplets, HeartPulse, Milk, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface InfothekItem {
  label: { de: string; en: string };
  href: string;
  icon: React.ElementType;
  description: { de: string; en: string };
  external?: boolean;
}

interface InfothekGroup {
  title: { de: string; en: string };
  items: InfothekItem[];
}

const infothekGroups: InfothekGroup[] = [
  {
    title: { de: "Für Patienten", en: "For Patients" },
    items: [
      {
        label: { de: "Anamnesebogen", en: "Medical History" },
        href: "/anamnesebogen",
        icon: ClipboardList,
        description: { de: "Medizinischer Fragebogen", en: "Medical questionnaire" },
      },
      {
        label: { de: "Datenschutzerklärung", en: "Privacy Policy" },
        href: "/datenschutz",
        icon: ShieldCheck,
        description: { de: "Informationen zum Datenschutz", en: "Privacy information" },
      },
      {
        label: { de: "Patientenaufklärung", en: "Patient Information" },
        href: "/patientenaufklaerung",
        icon: FileSignature,
        description: { de: "Kosten, Erstattung & Vereinbarung", en: "Costs, reimbursement & agreement" },
      },
    ],
  },
  {
    title: { de: "Wissen & Therapie", en: "Knowledge & Therapy" },
    items: [
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
        label: { de: "Diamond Shield Zapper", en: "Diamond Shield Zapper" },
        href: "/zapper-diamond-shield.html",
        icon: Radio,
        description: { de: "Frequenzgerät für Wellness und Erfahrungsheilkunde", en: "Frequency device for wellness" },
        external: true,
      },
      {
        label: { de: "Vieva Pro Vitalanalyse", en: "Vieva Pro Vital Analysis" },
        href: "/vieva-pro-vitalanalyse.html",
        icon: Activity,
        description: { de: "Ganzheitliche Gesundheitsanalyse per HRV & Vitalfeld", en: "Holistic health analysis via HRV & vital field" },
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
        label: { de: "Milch-Unverträglichkeit", en: "Milk Intolerance" },
        href: "/milch-unvertraeglichkeit",
        icon: Milk,
        description: { de: "Milchprotein-Allergie & Laktoseintoleranz erklärt", en: "Milk protein allergy & lactose intolerance explained" },
      },
      {
        label: { de: "Quellenhinweis & Haftung", en: "Sources & Disclaimer" },
        href: "/quellenhinweis",
        icon: Scale,
        description: { de: "Herkunft, Einordnung & Grenzen unserer Informationen", en: "Origin, classification & limits of our information" },
      },
    ],
  },
  {
    title: { de: "Nur für Patienten der Naturheilpraxis Peter Rauch", en: "Only for Patients of Naturheilpraxis Peter Rauch" },
    items: [
      {
        label: { de: "Quellenhinweis & Haftung", en: "Sources & Disclaimer" },
        href: "/quellenhinweis",
        icon: Scale,
        description: { de: "Herkunft, Einordnung & Grenzen unserer Informationen", en: "Origin, classification & limits of our information" },
      },
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

const allItems = infothekGroups.flatMap((g) => g.items);

interface InfothekDropdownProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function InfothekDropdown({ isMobile = false, onItemClick }: InfothekDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { t } = useLanguage();

  const isInfothekActive = allItems.some((item) => location.pathname === item.href);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const renderItem = (item: InfothekItem, compact = false) => {
    const isActive = location.pathname === item.href;

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setIsOpen(false);
            onItemClick?.();
          }}
          className={cn(
            "flex items-start gap-3 rounded-lg transition-colors hover:bg-sage-50",
            compact ? "px-3 py-2.5" : "p-3"
          )}
        >
          {compact ? (
            <>
              <item.icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t(item.label.de, item.label.en)}</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-100">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{t(item.label.de, item.label.en)}</div>
                <div className="text-xs text-muted-foreground">{t(item.description.de, item.description.en)}</div>
              </div>
            </>
          )}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => {
          setIsOpen(false);
          onItemClick?.();
        }}
        className={cn(
          "flex items-start gap-3 rounded-lg transition-colors",
          compact ? "px-3 py-2.5" : "p-3",
          isActive ? "bg-sage-100 text-primary" : "hover:bg-sage-50"
        )}
      >
        {compact ? (
          <>
            <item.icon className={cn("h-4 w-4 shrink-0 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm", isActive ? "text-primary font-medium" : "text-muted-foreground")}>{t(item.label.de, item.label.en)}</span>
          </>
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-100">
              <item.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{t(item.label.de, item.label.en)}</div>
              <div className="text-xs text-muted-foreground">{t(item.description.de, item.description.en)}</div>
            </div>
          </>
        )}
      </Link>
    );
  };

  if (isMobile) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors",
            isInfothekActive
              ? "bg-sage-100 text-primary"
              : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t("Infothek", "Info Center")}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="ml-4 space-y-3 border-l-2 border-sage-200 pl-4">
            {infothekGroups.map((group) => (
              <div key={group.title.de}>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t(group.title.de, group.title.en)}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => renderItem(item, true))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sage-100 hover:text-primary",
          isInfothekActive ? "bg-sage-100 text-primary" : "text-muted-foreground"
        )}
      >
        <BookOpen className="mr-1 h-4 w-4" />
        {t("Infothek", "Info Center")}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto animate-in fade-in-0 slide-in-from-top-2 rounded-xl border border-border bg-background p-2 shadow-elevated scrollbar-thin scrollbar-thumb-sage-300 scrollbar-track-transparent">
          {infothekGroups.map((group, idx) => (
            <div key={group.title.de}>
              {idx > 0 && <div className="my-1.5 border-t border-border/50" />}
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(group.title.de, group.title.en)}
              </div>
              {group.items.map((item) => renderItem(item))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
