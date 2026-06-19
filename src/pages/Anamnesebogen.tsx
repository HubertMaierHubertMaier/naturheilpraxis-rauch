import { useEffect, useMemo, useRef, useState } from "react";
import { useContentProtection } from "@/hooks/useContentProtection";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { 
  Send, 
  User, 
  Heart, 
  Pill, 
  AlertCircle,
  Leaf,
  Users,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  LayoutList,
  Stethoscope,
  Building2,
  AlertTriangle,
  ShieldAlert,
  Globe,
  Bug,
  Syringe,
  ClipboardList,
  Wand2,
  Home,
  PenTool,
  FileDown,
  Printer,
  ListFilter,
  Brain,
  Wind,
  Apple,
  FlaskConical,
  Droplets,
  Activity,
  Bone,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formSections as formSectionsData, initialFormData, AnamneseFormData } from "@/lib/anamneseFormData";
import { generateEnhancedAnamnesePdf, generateAnamnesePdfBase64, generateAnamnesePdfBase64WithoutIAA, generateIAAPdfBase64 } from "@/lib/pdfExportEnhanced";
import PrintView from "@/components/anamnese/PrintView";
import FilteredSummaryView from "@/components/anamnese/FilteredSummaryView";
import SEOHead from "@/components/seo/SEOHead";

// Import section components
import IntroSection from "@/components/anamnese/IntroSection";
import PatientDataSection from "@/components/anamnese/PatientDataSection";
import FamilyHistorySection from "@/components/anamnese/FamilyHistorySection";
import NeurologySection from "@/components/anamnese/NeurologySection";
import HeartSection from "@/components/anamnese/HeartSection";
import LungSection from "@/components/anamnese/LungSection";
import DigestiveSection from "@/components/anamnese/DigestiveSection";
import LiverSection from "@/components/anamnese/LiverSection";
import KidneySection from "@/components/anamnese/KidneySection";
import HormoneSection from "@/components/anamnese/HormoneSection";
import MusculoskeletalSection from "@/components/anamnese/MusculoskeletalSection";
import WomenHealthSection from "@/components/anamnese/WomenHealthSection";
import MensHealthSection from "@/components/anamnese/MensHealthSection";
import SurgeriesSection from "@/components/anamnese/SurgeriesSection";
import CancerSection from "@/components/anamnese/CancerSection";
import AllergiesSection from "@/components/anamnese/AllergiesSection";
import MedicationsSection from "@/components/anamnese/MedicationsSection";
import LifestyleSection from "@/components/anamnese/LifestyleSection";
import DentalSection from "@/components/anamnese/DentalSection";
import EnvironmentSection from "@/components/anamnese/EnvironmentSection";
import InfectionsSection from "@/components/anamnese/InfectionsSection";
import VaccinationsSection from "@/components/anamnese/VaccinationsSection";
import ComplaintsSection from "@/components/anamnese/ComplaintsSection";
import PreferencesSection from "@/components/anamnese/PreferencesSection";
import SocialSection from "@/components/anamnese/SocialSection";
import SignatureSection from "@/components/anamnese/SignatureSection";
import VerificationDialog from "@/components/anamnese/VerificationDialog";
import IAAForm from "@/components/iaa/IAAForm";
import { supabase } from "@/integrations/supabase/client";
import { useAnamnesePublic } from "@/hooks/useAnamnesePublic";
import { useAnamneseOnlineEnabled } from "@/hooks/useAnamneseOnlineEnabled";

type LayoutType = "wizard" | "accordion" | null;

type RouteState = {
  from?: string;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
};

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  User,
  Users,
  Stethoscope,
  Heart,
  Building2,
  AlertTriangle,
  ShieldAlert,
  Pill,
  Leaf,
  Globe,
  Bug,
  Syringe,
  ClipboardList,
  Wand2,
  Home,
  PenTool,
  Brain,
  Wind,
  Apple,
  FlaskConical,
  Droplets,
  Activity,
  Bone,
};

// Form sections with components
const formSections = formSectionsData.map(section => ({
  ...section,
  Icon: iconMap[section.icon] || AlertCircle,
}));

// Filter sections based on patient gender
const getFilteredSections = (gender: string) => {
  return formSections.filter(section => {
    if (section.id === "womenHealth" && gender === "maennlich") return false;
    if (section.id === "mensHealth" && gender === "weiblich") return false;
    return true;
  });
};

type LayoutSelectorProps = {
  language: string;
  onSelectLayout: (layout: Exclude<LayoutType, null>) => void;
  showOnlineOptions: boolean;
  onNavigateToLogin?: () => void;
};

const LayoutSelector = ({ language, onSelectLayout, showOnlineOptions, onNavigateToLogin }: LayoutSelectorProps) => (
  <div className="container py-12">
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">
          {language === "de" ? "Wie möchten Sie das Formular ausfüllen?" : "How would you like to fill out the form?"}
        </h2>
        <p className="text-muted-foreground">
          {language === "de"
            ? "Wählen Sie die Darstellung, die Ihnen am besten gefällt. Sie können jederzeit wechseln."
            : "Choose the display that suits you best. You can switch at any time."}
        </p>
      </div>

      {/* PDF Offline-Variante */}
      <Card className="mb-6 border-2 border-dashed border-primary/40 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="font-serif text-xl">
                {language === "de" ? "Lieber offline ausfüllen? (PDF zum Ausdrucken oder am PC)" : "Prefer offline? (PDF to print or fill on PC)"}
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? "Acrobat-Reader-Version – am Computer ausfüllbar, ausdruckbar oder per E-Mail zurücksenden."
                  : "Acrobat Reader version – fillable on computer, printable, or send back via email."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex">
            <Button asChild variant="default" className="flex-1">
              <a href="/anamnesebogen-blanko.pdf" download>
                <FileDown className="w-4 h-4 mr-2" />
                {language === "de" ? "Anamnesebogen als PDF herunterladen" : "Download anamnesis form as PDF"}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Wizard Option */}
        {showOnlineOptions ? (
          <>
            <Card
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
              onClick={() => onSelectLayout("wizard")}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-serif text-xl group-hover:text-primary transition-colors">
                      {language === "de" ? "Schritt für Schritt" : "Step by Step"}
                    </CardTitle>
                    <CardDescription>
                      {language === "de" ? "mit Emojis 👤 ❤️ 🧠" : "with Emojis 👤 ❤️ 🧠"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 justify-center">
                  {["👋", "👤", "👨‍👩‍👧", "🩺", "💊"].map((emoji, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                      {emoji}
                    </div>
                  ))}
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">✅ {language === "de" ? "Vorteile:" : "Benefits:"}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• {language === "de" ? "Geführte Eingabe – immer wissen, wo Sie sind" : "Guided input – always know where you are"}</li>
                    <li>• {language === "de" ? "Fortschrittsanzeige zeigt bereits ausgefüllte Bereiche" : "Progress indicator shows completed sections"}</li>
                    <li>• {language === "de" ? "Ideal für Smartphones und Tablets" : "Ideal for smartphones and tablets"}</li>
                    <li>• {language === "de" ? "Übersichtlich bei vielen Fragen" : "Clear overview with many questions"}</li>
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  <strong>{language === "de" ? "Empfohlen für:" : "Recommended for:"}</strong>{" "}
                  {language === "de"
                    ? "Wer Schritt für Schritt durch das Formular geführt werden möchte"
                    : "Those who want to be guided through the form step by step"}
                </p>

                <Button className="w-full" variant="outline" type="button">
                  {language === "de" ? "Diese Variante wählen" : "Choose this option"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Accordion Option */}
            <Card
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
              onClick={() => onSelectLayout("accordion")}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                    <LayoutList className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="font-serif text-xl group-hover:text-primary transition-colors">
                      {language === "de" ? "Alle Bereiche sichtbar" : "All sections visible"}
                    </CardTitle>
                    <CardDescription>{language === "de" ? "mit Icons und Farben" : "with icons and colors"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 justify-center">
                  {[User, Heart, Stethoscope, Pill, Leaf].map((IconComp, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <IconComp className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">✅ {language === "de" ? "Vorteile:" : "Benefits:"}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• {language === "de" ? "Komplette Übersicht aller Bereiche" : "Complete overview of all sections"}</li>
                    <li>• {language === "de" ? "Beliebig zwischen Abschnitten wechseln" : "Switch freely between sections"}</li>
                    <li>• {language === "de" ? "Professionelles, klares Design" : "Professional, clear design"}</li>
                    <li>• {language === "de" ? "Schneller Zugriff auf jeden Bereich" : "Quick access to every section"}</li>
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  <strong>{language === "de" ? "Empfohlen für:" : "Recommended for:"}</strong>{" "}
                  {language === "de" ? "Wer gerne alles im Blick hat und frei navigieren möchte" : "Those who like to have an overview and navigate freely"}
                </p>

                <Button className="w-full" variant="outline" type="button">
                  {language === "de" ? "Diese Variante wählen" : "Choose this option"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Online-Formular gesperrt – Hinweis für nicht eingeloggte Besucher */
          <Card className="md:col-span-2 border-dashed border-muted-foreground/30 bg-muted/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="font-serif text-xl text-muted-foreground">
                    {language === "de" ? "Online-Ausfüllen ist gesperrt" : "Online form is locked"}
                  </CardTitle>
                  <CardDescription>
                    {language === "de"
                      ? "Das Online-Formular ist aktuell nicht verfügbar. Bitte nutzen Sie das PDF oder melden Sie sich an."
                      : "The online form is currently unavailable. Please use the PDF or log in."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full sm:w-auto" onClick={onNavigateToLogin} type="button">
                <LogIn className="w-4 h-4 mr-2" />
                {language === "de" ? "Zum Login" : "Go to Login"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  </div>
);

type WizardLayoutProps = {
  language: string;
  formSections: typeof formSections;
  wizardStep: number;
  setWizardStep: (n: number) => void;
  handleBack: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  renderSectionContent: (sectionId: string) => React.ReactNode;
  onShowFilteredSummary: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
};

const WizardLayout = ({
  language,
  formSections,
  wizardStep,
  setWizardStep,
  handleBack,
  handleSubmit,
  renderSectionContent,
  onShowFilteredSummary,
  onPrint,
  onExportPdf,
}: WizardLayoutProps) => {
  const currentSection = formSections[wizardStep];
  const Icon = currentSection?.Icon || AlertCircle;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollIndicator, setScrollIndicator] = useState({ width: 0, left: 0, visible: false });

  const updateScrollIndicator = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth + 2;

    if (!hasOverflow) {
      setScrollIndicator({ width: 100, left: 0, visible: false });
      return;
    }

    const width = Math.max((clientWidth / scrollWidth) * 100, 18);
    const maxScroll = scrollWidth - clientWidth;
    const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - width) : 0;

    setScrollIndicator({ width, left, visible: true });
  };

  useEffect(() => {
    const el = stepRefs.current[wizardStep];
    const container = scrollContainerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollLeft = container.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [wizardStep]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollIndicator();

    const handleScroll = () => updateScrollIndicator();
    const handleResize = () => updateScrollIndicator();

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [formSections.length, wizardStep]);

  const handleIndicatorClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const maxScroll = container.scrollWidth - container.clientWidth;

    container.scrollTo({
      left: maxScroll * ratio,
      behavior: "smooth",
    });
  };

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" onClick={handleBack} className="mb-6" type="button">
          <ChevronLeft className="w-4 h-4 mr-2" />
          {language === "de" ? "Layout ändern" : "Change layout"}
        </Button>

        <div className="relative mb-8">
          <div ref={scrollContainerRef} className="wizard-scrollbar flex items-center overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {formSections.map((section, index) => (
              <div key={section.id} className="flex items-center flex-shrink-0" ref={(el) => { stepRefs.current[index] = el; }}>
                <div
                  className={`flex flex-col items-center cursor-pointer transition-all ${
                    wizardStep === index ? "scale-110" : wizardStep > index ? "opacity-70" : "opacity-40"
                  }`}
                  onClick={() => { setWizardStep(index); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-1 transition-all ${
                      wizardStep === index
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : wizardStep > index
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    }`}
                  >
                    {wizardStep > index ? <Check className="w-5 h-5 sm:w-6 sm:h-6" /> : section.emoji}
                  </div>
                  <span className="text-[10px] sm:text-xs text-center max-w-[60px] truncate">
                    {language === "de"
                      ? section.titleDe.replace(/^[IVX]+\.\s*/, "")
                      : section.titleEn.replace(/^[IVX]+\.\s*/, "")}
                  </span>
                </div>
                {index < formSections.length - 1 && (
                  <div className={`h-0.5 w-4 sm:w-6 mx-1 flex-shrink-0 ${wizardStep > index ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          {scrollIndicator.visible && (
            <button
              type="button"
              aria-label={language === "de" ? "Schrittleiste horizontal verschieben" : "Scroll step navigation"}
              onClick={handleIndicatorClick}
              className="relative mt-2 block h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <span
                className="absolute top-0 h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${scrollIndicator.width}%`, left: `${scrollIndicator.left}%` }}
              />
            </button>
          )}
          <div className="text-xs text-muted-foreground text-center mt-1 md:hidden">
            ← {language === "de" ? "Wischen oder Balken antippen" : "Swipe or tap the bar"} →
          </div>
        </div>

        <Card className={`${currentSection.color} border-2`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-background/80 flex items-center justify-center">
                <Icon className={`w-6 h-6 ${currentSection.iconColor}`} />
              </div>
              <div>
                <CardTitle className="font-serif text-xl">
                  {language === "de" ? currentSection.titleDe : currentSection.titleEn}
                </CardTitle>
                <CardDescription>
                  {language === "de" ? `Schritt ${wizardStep + 1} von ${formSections.length}` : `Step ${wizardStep + 1} of ${formSections.length}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="bg-background rounded-b-lg">
            <form onSubmit={handleSubmit}>
              {renderSectionContent(currentSection.id)}

              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setWizardStep(Math.max(0, wizardStep - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={wizardStep === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  {language === "de" ? "Zurück" : "Back"}
                </Button>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={onShowFilteredSummary} className="gap-2">
                    <ListFilter className="w-4 h-4" />
                    {language === "de" ? "Zusammenfassung" : "Summary"}
                  </Button>
                  <Button type="button" variant="outline" onClick={onPrint} className="gap-2">
                    <Printer className="w-4 h-4" />
                    {language === "de" ? "Drucken" : "Print"}
                  </Button>
                  <Button type="button" variant="outline" onClick={onExportPdf} className="gap-2">
                    <FileDown className="w-4 h-4" />
                    PDF
                  </Button>
                  {wizardStep === formSections.length - 1 ? (
                    <Button type="submit" className="gap-2">
                      <Send className="w-4 h-4" />
                      {language === "de" ? "Absenden" : "Submit"}
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => { setWizardStep(Math.min(formSections.length - 1, wizardStep + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      {language === "de" ? "Weiter" : "Next"}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

type AccordionLayoutProps = {
  language: string;
  formSections: typeof formSections;
  openAccordionItems: string[];
  setOpenAccordionItems: (v: string[]) => void;
  handleBack: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  renderSectionContent: (sectionId: string) => React.ReactNode;
  onShowFilteredSummary: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
};

const AccordionLayout = ({
  language,
  formSections,
  openAccordionItems,
  setOpenAccordionItems,
  handleBack,
  handleSubmit,
  renderSectionContent,
  onShowFilteredSummary,
  onPrint,
  onExportPdf,
}: AccordionLayoutProps) => (
  <div className="container py-8">
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" onClick={handleBack} className="mb-6" type="button">
        <ChevronLeft className="w-4 h-4 mr-2" />
        {language === "de" ? "Layout ändern" : "Change layout"}
      </Button>

      <form onSubmit={handleSubmit}>
        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="space-y-4">
          {formSections.map((section) => {
            const Icon = section.Icon;
            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className={`${section.color} border-2 rounded-lg overflow-hidden`}
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${section.iconColor}`} />
                    </div>
                    <div className="text-left">
                      <span className="font-serif text-lg block">{language === "de" ? section.titleDe : section.titleEn}</span>
                      <span className="text-xl">{section.emoji}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 bg-background">
                  <div className="pt-4">{renderSectionContent(section.id)}</div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button type="button" variant="outline" size="lg" onClick={onShowFilteredSummary} className="gap-2">
            <ListFilter className="w-5 h-5" />
            {language === "de" ? "Zusammenfassung" : "Summary"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onPrint} className="gap-2">
            <Printer className="w-5 h-5" />
            {language === "de" ? "Drucken" : "Print"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onExportPdf} className="gap-2">
            <FileDown className="w-5 h-5" />
            {language === "de" ? "Als PDF speichern" : "Save as PDF"}
          </Button>
          <Button type="submit" size="lg" className="gap-2">
            <Send className="w-5 h-5" />
            {language === "de" ? "Anamnesebogen absenden" : "Submit Medical History Form"}
          </Button>
        </div>
      </form>
    </div>
  </div>
);

const Anamnesebogen = () => {
  useContentProtection();
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { enabled: anamnesePublic } = useAnamnesePublic();
  const { enabled: anamneseOnlineEnabled } = useAnamneseOnlineEnabled();
  const showOnlineOptions = isAdmin || (anamneseOnlineEnabled && !!user);
  const location = useLocation();
  const navigate = useNavigate();
  const cameFromErstanmeldung = (location.state as RouteState | null)?.from === "erstanmeldung";
  const [autoEditActivated, setAutoEditActivated] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [formData, setFormData] = useState<AnamneseFormData>(initialFormData);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showFilteredSummary, setShowFilteredSummary] = useState(false);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(["intro"]);
  const printRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [iaaData, setIaaData] = useState<Record<string, number>>({});
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingSubmissionCount, setExistingSubmissionCount] = useState(0);
  const [checkingSubmission, setCheckingSubmission] = useState(true);

  // Check if user already has a verified submission and load latest data
  useEffect(() => {
    const checkExisting = async () => {
      if (!user?.id) {
        setCheckingSubmission(false);
        return;
      }
      try {
        const { data, count } = await supabase
          .from("anamnesis_submissions")
          .select("id, form_data", { count: "exact" })
          .eq("user_id", user.id)
          .eq("status", "verified")
          .order("submitted_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          setHasExistingSubmission(true);
          setExistingSubmissionCount(count || 1);
          // Pre-fill form with latest submission data for editing
          const latestFormData = data[0].form_data as unknown as AnamneseFormData;
          if (latestFormData) {
            setFormData(prev => ({ ...prev, ...latestFormData }));
          }
        }
      } catch {
        // ignore
      }
      setCheckingSubmission(false);
    };
    checkExisting();
  }, [user?.id]);

  // Auto-activate edit mode when coming from Erstanmeldung with existing submission
  useEffect(() => {
    if (cameFromErstanmeldung && hasExistingSubmission && !autoEditActivated && !checkingSubmission) {
      setIsEditMode(true);
      setAutoEditActivated(true);
      // Reset signature confirmations for new version
      setFormData(prev => ({
        ...prev,
        unterschrift: {
          ...prev.unterschrift,
          bestaetigung: false,
          datenschutzEinwilligung: false,
          patientenaufklaerungAkzeptiert: false,
          datum: new Date().toISOString().split('T')[0],
        }
      }));
    }
  }, [cameFromErstanmeldung, hasExistingSubmission, autoEditActivated, checkingSubmission]);

  const draftStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `anamnesebogen:draft:${user.id}`;
  }, [user?.id]);

  // Restore draft after (re-)login – first try user-specific draft, then email-based cache
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          formData?: AnamneseFormData;
          selectedLayout?: LayoutType;
          wizardStep?: number;
          openAccordionItems?: string[];
          iaaData?: Record<string, number>;
        };
        if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
        if (parsed.selectedLayout !== undefined) setSelectedLayout(parsed.selectedLayout);
        if (typeof parsed.wizardStep === "number") setWizardStep(parsed.wizardStep);
        if (Array.isArray(parsed.openAccordionItems) && parsed.openAccordionItems.length)
          setOpenAccordionItems(parsed.openAccordionItems);
        if (parsed.iaaData && Object.keys(parsed.iaaData).length > 0) setIaaData(parsed.iaaData);
        return;
      }
      // Fallback: try to restore from email-based cache (e.g. after account reset)
      const email = user?.email;
      if (email) {
        const emailCacheKey = `anamnesebogen:email-cache:${email.toLowerCase()}`;
        const emailRaw = localStorage.getItem(emailCacheKey);
        if (emailRaw) {
          const parsed = JSON.parse(emailRaw) as {
            formData?: AnamneseFormData;
            iaaData?: Record<string, number>;
          };
          if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
          if (parsed.iaaData && Object.keys(parsed.iaaData).length > 0) setIaaData(parsed.iaaData);
        }
      }
    } catch {
      // ignore corrupted draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  // Autosave draft while typing (prevents losing data on logout)
  const autosaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!draftStorageKey) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            formData,
            selectedLayout,
            wizardStep,
            openAccordionItems,
            iaaData,
          })
        );
      } catch {
        // ignore storage errors
      }
    }, 300);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [draftStorageKey, formData, selectedLayout, wizardStep, openAccordionItems, iaaData]);

  const updateFormData = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSignatureComplete = () => {
    return !!(
      formData.unterschrift?.bestaetigung &&
      formData.unterschrift?.datenschutzEinwilligung &&
      formData.unterschrift?.patientenaufklaerungAkzeptiert &&
      formData.unterschrift?.nameInDruckbuchstaben
    );
    // Note: datum is always today (readonly, auto-set) — no need to validate
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.nachname || !formData.vorname || !formData.email || !formData.strasse || !formData.plz || !formData.wohnort) {
      toast.error(language === "de" ? "Bitte füllen Sie alle Pflichtfelder aus (Name, Adresse, E-Mail)" : "Please fill in all required fields (name, address, email)");
      return;
    }

    if (!formData.telefonPrivat && !formData.mobil) {
      toast.error(language === "de" ? "Bitte geben Sie mindestens eine Telefonnummer an" : "Please provide at least one phone number");
      return;
    }
    
    // Check signature completeness with friendly message
    if (!isSignatureComplete()) {
      toast.error(
        language === "de" 
          ? "Unterschrift erforderlich" 
          : "Signature required",
        {
          description: language === "de"
            ? "Bitte füllen Sie das Datum, Ihren Namen in Druckbuchstaben aus, bestätigen Sie die Richtigkeit Ihrer Angaben und stimmen Sie der Datenschutzverordnung zu."
            : "Please fill in the date, your name in block letters, confirm the accuracy of your information, and agree to the privacy policy.",
          duration: 8000,
        }
      );
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('submit-anamnesis', {
        body: {
          action: "submit",
          email: formData.email,
          formData,
          tempUserId: tempUserId || undefined,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Submission failed");
      
      setSubmissionId(data.submissionId || null);
      if (data.tempUserId) setTempUserId(data.tempUserId);
      setShowVerification(true);
      
      toast.success(
        language === "de" ? "Bestätigungscode gesendet!" : "Verification code sent!",
        {
          description: language === "de"
            ? `Ein 6-stelliger Code wurde an ${formData.email} gesendet.`
            : `A 6-digit code has been sent to ${formData.email}.`,
        }
      );
    } catch (error: unknown) {
      console.error("Submit error:", error);
      toast.error(
        language === "de" ? "Fehler beim Absenden" : "Submission error",
        {
          description: getErrorMessage(error) || (language === "de"
            ? "Bitte versuchen Sie es später erneut."
            : "Please try again later."),
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    setIsSubmitting(true);
    try {
      // Generate PDF WITHOUT IAA for patient copy, full PDF for practice
      let pdfBase64: string | undefined;
      let pdfBase64WithoutIAA: string | undefined;
      let iaaPdfBase64: string | undefined;
      try {
        pdfBase64 = await generateAnamnesePdfBase64({ formData, language, iaaData });
        pdfBase64WithoutIAA = await generateAnamnesePdfBase64WithoutIAA({ formData, language });
        if (Object.keys(iaaData).length > 0) {
          iaaPdfBase64 = await generateIAAPdfBase64({ formData, language, iaaData });
        }
        
        // PDF size monitoring: warn if total payload exceeds ~4MB (Edge Function limit ~6MB with overhead)
        const totalBase64Bytes = (pdfBase64?.length || 0) + (pdfBase64WithoutIAA?.length || 0) + (iaaPdfBase64?.length || 0);
        const totalMB = totalBase64Bytes / (1024 * 1024);
        if (totalMB > 4) {
          console.warn(`[PDF-Size] Total PDF payload: ${totalMB.toFixed(1)} MB – may exceed Edge Function limit`);
          // Drop the largest PDF to stay within limits, keep patient copy
          pdfBase64 = undefined;
          iaaPdfBase64 = undefined;
          toast.warning(
            language === "de"
              ? "Die PDF-Anhänge sind sehr groß. Die Praxis-PDFs werden serverseitig verkleinert."
              : "PDF attachments are very large. Practice PDFs will be reduced server-side.",
            { duration: 6000 }
          );
        }
      } catch (e) {
        console.warn("PDF generation failed, sending without attachment:", e);
      }

      const { data, error } = await supabase.functions.invoke('submit-anamnesis', {
        body: {
          action: "confirm",
          email: formData.email,
          code,
          submissionId,
          tempUserId,
          formData,
          pdfBase64,
          pdfBase64WithoutIAA,
          iaaPdfBase64,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Verification failed");
      
      setShowVerification(false);
      
      // Clear draft after successful submission, but save email-based cache for future use
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      if (formData.email) {
        try {
          const emailCacheKey = `anamnesebogen:email-cache:${formData.email.toLowerCase()}`;
          localStorage.setItem(emailCacheKey, JSON.stringify({ formData, iaaData }));
        } catch { /* ignore */ }
      }

      // Save IAA data if filled
      if (user && Object.keys(iaaData).length > 0) {
        try {
          await supabase.from("iaa_submissions").insert([{
            user_id: user.id,
            form_data: iaaData,
            status: "submitted",
          }]);
        } catch (e) {
          console.warn("IAA save failed:", e);
        }
      }
      
      toast.success(
        language === "de" ? "Anamnesebogen erfolgreich übermittelt!" : "Medical history form submitted successfully!",
        {
          description: language === "de"
            ? "Vielen Dank! Sie erhalten eine Bestätigung per E-Mail. Ihre Angaben werden vor dem Termin geprüft."
            : "Thank you! You will receive a confirmation by email. Your information will be reviewed before the appointment.",
          duration: 10000,
        }
      );

      // Redirect back to Erstanmeldung if came from there
      if (cameFromErstanmeldung) {
        setTimeout(() => navigate("/erstanmeldung"), 2000);
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("Ungültiger") || errorMsg.includes("abgelaufen")) {
        toast.error(language === "de" ? "Ungültiger oder abgelaufener Code" : "Invalid or expired code");
      } else {
        toast.error(language === "de" ? "Verifizierung fehlgeschlagen" : "Verification failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('submit-anamnesis', {
        body: {
          action: "submit",
          email: formData.email,
          formData,
          tempUserId: tempUserId || undefined,
        },
      });
      
      if (error) throw error;
      if (data?.tempUserId) setTempUserId(data.tempUserId);
      if (data?.submissionId) setSubmissionId(data.submissionId);
      
      toast.success(language === "de" ? "Neuer Code wurde gesendet!" : "New code has been sent!");
    } catch {
      toast.error(language === "de" ? "Fehler beim erneuten Senden" : "Error resending code");
    }
  };

  const handleExportPdf = () => {
    try {
      generateEnhancedAnamnesePdf({ formData, language: language as "de" | "en", iaaData });
      toast.success(
        language === "de" ? "PDF erstellt!" : "PDF created!",
        {
          description: language === "de"
            ? "Der Anamnesebogen wurde als PDF heruntergeladen."
            : "The medical history form has been downloaded as a PDF.",
        }
      );
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error(
        language === "de" ? "PDF-Export fehlgeschlagen" : "PDF export failed"
      );
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setShowPrintView(false), 500);
    }, 100);
  };

  const handleBack = () => {
    setSelectedLayout(null);
    setWizardStep(0);
  };

  // Render section content based on section ID
  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "intro":
        return <IntroSection />;
      case "patientData":
        return <PatientDataSection formData={formData} updateFormData={updateFormData} userEmail={user?.email} />;
      case "familyHistory":
        return <FamilyHistorySection formData={formData} updateFormData={updateFormData} />;
      case "neurology":
        return <NeurologySection formData={formData} updateFormData={updateFormData} />;
      case "heart":
        return <HeartSection formData={formData} updateFormData={updateFormData} />;
      case "lung":
        return <LungSection formData={formData} updateFormData={updateFormData} />;
      case "digestive":
        return <DigestiveSection formData={formData} updateFormData={updateFormData} />;
      case "liver":
        return <LiverSection formData={formData} updateFormData={updateFormData} />;
      case "kidney":
        return <KidneySection formData={formData} updateFormData={updateFormData} />;
      case "hormone":
        return <HormoneSection formData={formData} updateFormData={updateFormData} />;
      case "musculoskeletal":
        return <MusculoskeletalSection formData={formData} updateFormData={updateFormData} />;
      case "womenHealth":
        return <WomenHealthSection formData={formData} updateFormData={updateFormData} />;
      case "mensHealth":
        return <MensHealthSection formData={formData} updateFormData={updateFormData} />;
      case "surgeries":
        return <SurgeriesSection formData={formData} updateFormData={updateFormData} />;
      case "cancer":
        return <CancerSection formData={formData} updateFormData={updateFormData} />;
      case "allergies":
        return <AllergiesSection formData={formData} updateFormData={updateFormData} />;
      case "medications":
        return <MedicationsSection formData={formData} updateFormData={updateFormData} />;
      case "lifestyle":
        return <LifestyleSection formData={formData} updateFormData={updateFormData} />;
      case "dental":
        return <DentalSection formData={formData} updateFormData={updateFormData} />;
      case "environment":
        return <EnvironmentSection formData={formData} updateFormData={updateFormData} />;
      case "infections":
        return <InfectionsSection formData={formData} updateFormData={updateFormData} />;
      case "vaccinations":
        return <VaccinationsSection formData={formData} updateFormData={updateFormData} />;
      case "complaints":
        return <ComplaintsSection formData={formData} updateFormData={updateFormData} />;
      case "preferences":
        return <PreferencesSection formData={formData} updateFormData={updateFormData} />;
      case "social":
        return <SocialSection formData={formData} updateFormData={updateFormData} />;
      case "iaa":
        return <IAAForm data={iaaData} onChange={setIaaData} />;
      case "signature":
        return <SignatureSection formData={formData} updateFormData={updateFormData} />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="bg-gradient-to-b from-muted/30 to-background min-h-screen">
        {/* Header */}
        <div className="container py-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-4">
              {language === "de" ? "Anamnesebogen" : "Medical History Form"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isEditMode
                ? (language === "de"
                  ? "Ergänzen oder aktualisieren Sie Ihre Angaben. Die neue Version wird mit dem heutigen Datum gespeichert."
                  : "Supplement or update your information. The new version will be saved with today's date.")
                : (language === "de"
                  ? "Bitte füllen Sie diesen Fragebogen vor Ihrem ersten Termin aus. Ihre Angaben helfen mir, Sie optimal zu behandeln."
                  : "Please complete this questionnaire before your first appointment. Your information helps me to treat you optimally.")}
            </p>
            {!user && !isEditMode && (
              <div
                role="status"
                aria-label={language === "de" ? "Hinweis zur öffentlichen Online-Übermittlung" : "Notice about public online submission"}
                className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="space-y-2">
                    <p className="font-medium">
                      {language === "de"
                        ? "Öffentlicher Online-Anamnesebogen"
                        : "Public online medical history form"}
                    </p>
                    <p>
                      {language === "de"
                        ? "Beim Absenden werden Ihre Angaben an die Naturheilpraxis übermittelt. Gesundheits- und Anamnesedaten sind besonders sensibel."
                        : "When you submit the form, your information is transmitted to the naturopathic practice. Health and medical-history data are especially sensitive."}
                    </p>
                    <p>
                      {language === "de"
                        ? "Danach erhalten Sie einen E-Mail-Code zur Verifizierung, bevor die Einreichung abgeschlossen wird."
                        : "Afterwards, you will receive an email code for verification before the submission is completed."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Block if already submitted – offer edit option */}
        {hasExistingSubmission && !isEditMode && !cameFromErstanmeldung ? (
          <div className="container py-12">
            <Card className="mx-auto max-w-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  {language === "de" ? "Anamnesebogen bereits eingereicht" : "Medical history already submitted"}
                </h2>
                <p className="text-muted-foreground mb-2">
                  {language === "de" 
                    ? `Sie haben bereits ${existingSubmissionCount} Anamnesebogen${existingSubmissionCount > 1 ? "bögen" : ""} eingereicht.`
                    : `You have already submitted ${existingSubmissionCount} medical history form${existingSubmissionCount > 1 ? "s" : ""}.`}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {language === "de"
                    ? "Sie können Ihren Bogen jederzeit ergänzen oder aktualisieren. Die neue Version wird mit dem heutigen Datum gespeichert – Ihre vorherigen Einreichungen bleiben erhalten."
                    : "You can supplement or update your form at any time. The new version will be saved with today's date – your previous submissions are preserved."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate("/")}>
                    {language === "de" ? "Zur Startseite" : "Go to Homepage"}
                  </Button>
                  <Button onClick={() => {
                    setIsEditMode(true);
                    // Reset signature confirmations for new version
                    setFormData(prev => ({
                      ...prev,
                      unterschrift: {
                        ...prev.unterschrift,
                        bestaetigung: false,
                        datenschutzEinwilligung: false,
                        patientenaufklaerungAkzeptiert: false,
                        datum: new Date().toISOString().split('T')[0],
                      }
                    }));
                  }}>
                    <PenTool className="w-4 h-4 mr-2" />
                    {language === "de" ? "Bogen ergänzen / aktualisieren" : "Supplement / Update Form"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : checkingSubmission ? (
          <div className="container py-12 text-center">
            <p className="text-muted-foreground">{language === "de" ? "Wird geladen..." : "Loading..."}</p>
          </div>
        ) : selectedLayout === null ? (
          <LayoutSelector
            language={language}
            onSelectLayout={(layout) => setSelectedLayout(layout)}
            showOnlineOptions={showOnlineOptions}
            onNavigateToLogin={() => navigate("/auth")}
          />
        ) : null}

        {/* Edit mode banner */}
        {isEditMode && selectedLayout && (
          <div className="container">
            <div className="mx-auto max-w-3xl mb-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex gap-3 items-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {language === "de"
                      ? "Sie bearbeiten eine neue Version Ihres Anamnesebogens. Alle vorherigen Versionen bleiben gespeichert. Nach dem Absenden wird eine neue Version mit dem heutigen Datum erstellt."
                      : "You are editing a new version of your medical history form. All previous versions are preserved. Upon submission, a new version with today's date will be created."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Persistenter PDF-Download (immer sichtbar, sobald ein Layout aktiv ist) */}
        {selectedLayout && (
          <div className="container">
            <div className="mx-auto max-w-3xl mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <FileDown className="w-4 h-4 text-primary" />
                  <span>
                    {language === "de"
                      ? "Lieber offline ausfüllen? Acrobat-Reader-Version (PDF) verfügbar:"
                      : "Prefer to fill out offline? Acrobat Reader version (PDF) available:"}
                  </span>
                </div>
                <div className="flex">
                  <Button asChild size="sm" variant="default">
                    <a href="/anamnesebogen-blanko.pdf" download>
                      <FileDown className="w-4 h-4 mr-2" />
                      {language === "de" ? "PDF herunterladen" : "Download PDF"}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content based on selected layout */}

        {(!hasExistingSubmission || isEditMode) && selectedLayout === "wizard" && (
          <WizardLayout
            language={language}
            formSections={getFilteredSections(formData.geschlecht)}
            wizardStep={wizardStep}
            setWizardStep={setWizardStep}
            handleBack={handleBack}
            handleSubmit={handleSubmit}
            renderSectionContent={renderSectionContent}
            onShowFilteredSummary={() => setShowFilteredSummary(true)}
            onPrint={handlePrint}
            onExportPdf={handleExportPdf}
          />
        )}
        {(!hasExistingSubmission || isEditMode) && selectedLayout === "accordion" && (
          <AccordionLayout
            language={language}
            formSections={getFilteredSections(formData.geschlecht)}
            openAccordionItems={openAccordionItems}
            setOpenAccordionItems={setOpenAccordionItems}
            handleBack={handleBack}
            handleSubmit={handleSubmit}
            renderSectionContent={renderSectionContent}
            onShowFilteredSummary={() => setShowFilteredSummary(true)}
            onPrint={handlePrint}
            onExportPdf={handleExportPdf}
          />
        )}

        {/* Hidden Print View */}
        {showPrintView && (
          <div className="fixed inset-0 z-50 bg-white">
            <PrintView
              ref={printRef}
              formData={formData}
              language={language as "de" | "en"}
            />
          </div>
        )}
        {/* Filtered Summary Modal */}
        {showFilteredSummary && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-auto">
            <div className="container py-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold">
                    {language === "de" ? "Gefilterte Zusammenfassung" : "Filtered Summary"}
                  </h2>
                  <Button variant="outline" onClick={() => setShowFilteredSummary(false)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    {language === "de" ? "Zurück zum Formular" : "Back to Form"}
                  </Button>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <FilteredSummaryView formData={formData} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Verification Dialog */}
        <VerificationDialog
          open={showVerification}
          onOpenChange={setShowVerification}
          email={formData.email || ""}
          onVerify={handleVerifyCode}
          onResend={handleResendCode}
          isVerifying={isSubmitting}
        />
      </div>
    </Layout>
  );
};

export default Anamnesebogen;
