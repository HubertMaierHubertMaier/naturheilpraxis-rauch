import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardList,
  Shield,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Info,
  Phone,
  PenTool,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface StepConfig {
  id: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  icon: React.ElementType;
}

const steps: StepConfig[] = [
  {
    id: "overview",
    titleDe: "Übersicht",
    titleEn: "Overview",
    descDe: "3 Dokumente für Ihre Erstanmeldung",
    descEn: "3 documents for your first registration",
    icon: Info,
  },
  {
    id: "anamnesebogen",
    titleDe: "Anamnesebogen",
    titleEn: "Medical History",
    descDe: "Umfassende medizinische Vorgeschichte inkl. IAA",
    descEn: "Comprehensive medical history incl. IAA",
    icon: ClipboardList,
  },
  {
    id: "patientenaufklaerung",
    titleDe: "Patientenaufklärung",
    titleEn: "Patient Information",
    descDe: "Kosten, Erstattung & Vereinbarung",
    descEn: "Costs, reimbursement & agreement",
    icon: FileText,
  },
  {
    id: "datenschutz",
    titleDe: "Datenschutz",
    titleEn: "Data Protection",
    descDe: "DSGVO-Einwilligung",
    descEn: "GDPR Consent",
    icon: Shield,
  },
];

export default function Erstanmeldung() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Persist onboarding state in localStorage
  const onboardingKey = user ? `erstanmeldung:state:${user.id}` : null;

  const loadSavedState = () => {
    if (!onboardingKey) return {};
    try {
      const raw = localStorage.getItem(onboardingKey);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const savedState = loadSavedState();
  const [currentStep, setCurrentStep] = useState<number>(savedState.currentStep ?? 0);
  const [datenschutzAccepted, setDatenschutzAccepted] = useState<boolean>(savedState.datenschutzAccepted ?? false);
  const [aufklaerungAccepted, setAufklaerungAccepted] = useState<boolean>(savedState.aufklaerungAccepted ?? false);
  const [terminConfirmed, setTerminConfirmed] = useState<boolean>(savedState.terminConfirmed ?? false);

  // Check existing anamnesis submission
  const { data: anamnesisStatus } = useQuery({
    queryKey: ["anamnesis-status", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("anamnesis_submissions")
        .select("status")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!user,
  });

  // Pricing data for Patientenaufklärung embed
  const { data: pricing } = useQuery({
    queryKey: ["practice-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_pricing")
        .select("*")
        .eq("is_published", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const anamnesisComplete = anamnesisStatus?.status === "verified";

  // Auto-confirm termin if anamnesis is already complete (user already went through the flow)
  useEffect(() => {
    if (anamnesisComplete && !terminConfirmed) {
      setTerminConfirmed(true);
    }
  }, [anamnesisComplete]);

  // Persist onboarding state changes to localStorage
  useEffect(() => {
    if (!onboardingKey) return;
    try {
      localStorage.setItem(onboardingKey, JSON.stringify({
        currentStep,
        datenschutzAccepted,
        aufklaerungAccepted,
        terminConfirmed,
      }));
    } catch { /* ignore */ }
  }, [onboardingKey, currentStep, datenschutzAccepted, aufklaerungAccepted, terminConfirmed]);

  const stepCompletion = [
    true, // overview always accessible
    anamnesisComplete,
    aufklaerungAccepted,
    datenschutzAccepted,
  ];

  const completedCount = [anamnesisComplete, aufklaerungAccepted, datenschutzAccepted].filter(Boolean).length;
  const progressPercent = (completedCount / 3) * 100;

  const step = steps[currentStep];

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-sage-50 py-8 md:py-12">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-3 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              {t("Erstanmeldung", "First Registration")}
            </h1>
            <p className="text-muted-foreground">
              {t(
                "Bitte füllen Sie die folgenden 3 Dokumente für Ihre Erstanmeldung aus.",
                "Please complete the following 3 documents for your first registration."
              )}
            </p>
            {terminConfirmed && (
              <div className="mt-6 mx-auto max-w-md">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>{t("Fortschritt", "Progress")}</span>
                  <span>{completedCount}/3</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Termin-Pflicht Gate */}
      {!terminConfirmed && (
        <div className="container py-8">
          <div className="mx-auto max-w-2xl">
            <Card className="border-primary/30 shadow-card">
              <CardContent className="p-4 sm:p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-foreground">
                      {t("Termin telefonisch vereinbaren", "Schedule Appointment by Phone")}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("Voraussetzung für die Erstanmeldung", "Prerequisite for first registration")}
                    </p>
                  </div>
                </div>

                <div className="bg-sage-50 rounded-lg p-5 space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    {t(
                      "Bevor Sie die Erstanmeldung online ausfüllen können, bitten wir Sie, telefonisch einen Termin mit uns zu vereinbaren. Im persönlichen Gespräch klären wir Ihr Anliegen und besprechen den weiteren Ablauf.",
                      "Before you can complete the first registration online, we ask you to schedule an appointment with us by phone. In a personal conversation, we will clarify your concerns and discuss the next steps."
                    )}
                  </p>
                  <div className="flex items-center gap-3 text-lg font-semibold text-foreground">
                    <Phone className="h-5 w-5 text-primary" />
                    <span>0821-2621462</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3 bg-background border border-border rounded-lg p-4">
                  <Checkbox
                    id="termin-confirm"
                    checked={terminConfirmed}
                    onCheckedChange={(c) => setTerminConfirmed(!!c)}
                    className="mt-1"
                  />
                  <Label htmlFor="termin-confirm" className="cursor-pointer leading-relaxed">
                    {t(
                      "Ich habe bereits telefonisch einen Termin in der Naturheilpraxis Peter Rauch vereinbart und möchte nun die Erstanmeldung ausfüllen.",
                      "I have already scheduled an appointment by phone at the Naturopathic Practice Peter Rauch and would like to complete the first registration now."
                    )}
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step indicators */}
      {terminConfirmed && (
      <div className="border-b border-border bg-background sticky top-16 md:top-20 z-40">
        <div className="container">
          <div className="flex overflow-x-auto gap-1 py-2">
            {steps.map((s, i) => {
              if (i === 0) return null; // skip overview in tab bar
              const Icon = s.icon;
              const isActive = currentStep === i;
              const isDone = stepCompletion[i];
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-sage-100 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {language === "de" ? s.titleDe : s.titleEn}
                  </span>
                  <span className="md:hidden">
                    {language === "de" ? s.titleDe.split(/[\s-]/)[0] : s.titleEn.split(/[\s-]/)[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {terminConfirmed && (
      <div className="container py-8">
        <div className="mx-auto max-w-4xl">

          {/* Step 0: Overview */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <Card className="border-primary/20 bg-sage-50">
                <CardContent className="p-4 sm:p-8">
                  <div className="flex gap-4">
                    <Info className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
                        {t("Willkommen zur Erstanmeldung", "Welcome to First Registration")}
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        {t(
                          "Für Ihre Erstanmeldung in der Naturheilpraxis Peter Rauch sind 3 Dokumente erforderlich. Der Anamnesebogen enthält bereits den IAA-Fragebogen (Individuelle Austestung und Analyse). Bitte nehmen Sie sich ausreichend Zeit für das sorgfältige Ausfüllen.",
                          "For your first registration at the Naturopathic Practice Peter Rauch, 3 documents are required. The medical history form already includes the IAA questionnaire (Individual Testing and Analysis). Please take sufficient time to fill them out carefully."
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {steps.slice(1).map((s, i) => {
                  const Icon = s.icon;
                  const isDone = stepCompletion[i + 1];
                  return (
                    <Card
                      key={s.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isDone && "border-primary/30 bg-sage-50"
                      )}
                      onClick={() => setCurrentStep(i + 1)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                              isDone ? "bg-primary text-primary-foreground" : "bg-sage-100"
                            )}
                          >
                            {isDone ? (
                              <Check className="h-6 w-6" />
                            ) : (
                              <Icon className={cn("h-6 w-6", "text-primary")} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-muted-foreground">
                                {i + 1}.
                              </span>
                              <h3 className="font-serif text-lg font-semibold text-foreground">
                                {language === "de" ? s.titleDe : s.titleEn}
                              </h3>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {language === "de" ? s.descDe : s.descEn}
                            </p>
                            {isDone && (
                              <Badge className="mt-2" variant="secondary">
                                {t("Erledigt", "Complete")} ✓
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto mt-3" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Anamnesebogen (includes IAA as section XXIV) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardContent className="p-4 sm:p-8 text-center space-y-6">
                  <ClipboardList className="h-16 w-16 text-primary mx-auto" />
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    {t("Anamnesebogen", "Medical History Form")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
                    {t(
                      "Der Anamnesebogen ist ein umfassendes medizinisches Formular mit 25 Sektionen, inklusive dem IAA-Fragebogen (Individuelle Austestung und Analyse für das Trikombin-Gerät). Bitte nehmen Sie sich ca. 30-45 Minuten Zeit.",
                      "The medical history form is a comprehensive medical form with 25 sections, including the IAA questionnaire (Individual Testing and Analysis for the Trikombin device). Please allow approx. 30-45 minutes."
                    )}
                  </p>
                  {anamnesisComplete ? (
                    <div className="space-y-4">
                      <div className="bg-sage-50 border border-primary/20 rounded-lg p-4 inline-flex items-center gap-3">
                        <Check className="h-6 w-6 text-primary" />
                        <span className="font-medium text-primary">
                          {t("Anamnesebogen bereits eingereicht ✓", "Medical history already submitted ✓")}
                        </span>
                      </div>
                      <div>
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => navigate("/anamnesebogen", { state: { from: "erstanmeldung" } })}
                          className="gap-2"
                        >
                          <PenTool className="h-4 w-4" />
                          {t("Bogen ergänzen / aktualisieren", "Supplement / update form")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => navigate("/anamnesebogen", { state: { from: "erstanmeldung" } })}
                      className="gap-2"
                    >
                      {t("Anamnesebogen ausfüllen", "Fill out medical history")}
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Patientenaufklärung */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardContent className="p-4 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <h2 className="font-serif text-2xl font-semibold text-foreground">
                      {t("Patientenaufklärung", "Patient Information")}
                    </h2>
                  </div>

                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-muted/30">
                    <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
                      <h4>{t("Kostenerstattung", "Cost Reimbursement")}</h4>
                      <p>
                        {t(
                          "Die GebÜH ist geltend für Patienten die privatversichert, beihilfeversichert oder zusatzversichert sind. Für selbstzahlende Patienten sind die GebÜH-Positionen nicht von Bedeutung. Die Praxis rechnet nach GebÜH-Höchstsatz ab.",
                          "The GebÜH applies to privately insured, government aid insured, or supplementary insured patients. For self-paying patients, GebÜH positions are not relevant. The practice charges at the maximum GebÜH rate."
                        )}
                      </p>
                      <h4>{t("Aktuelle Preise", "Current Pricing")}</h4>
                      {pricing && (
                        <table className="w-full text-sm">
                          <tbody>
                            {pricing.map((p) => (
                              <tr key={p.id} className="border-b border-border/50">
                                <td className="py-1 pr-4 font-medium">
                                  {language === "de" ? p.label_de : p.label_en}
                                </td>
                                <td className="py-1 text-right whitespace-nowrap">
                                  {language === "de" ? p.price_text_de : p.price_text_en}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <h4>{t("Terminregelung", "Appointment Policy")}</h4>
                      <p>
                        {t(
                          "Termine müssen mindestens 48 Stunden vorher abgesagt werden. Bei Verspätungen über 30 Minuten kann der Termin abgelehnt werden. Der Rechnungsbetrag ist unabhängig von der Erstattung Ihrer Versicherung in voller Höhe zu zahlen.",
                          "Appointments must be cancelled at least 48 hours in advance. Delays over 30 minutes may result in appointment refusal. The invoice amount must be paid in full regardless of insurance reimbursement."
                        )}
                      </p>
                      <p className="text-sm">
                        <Link to="/patientenaufklaerung" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                          {t("Vollständige Patientenaufklärung lesen", "Read full patient information")}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 bg-sage-50 p-4 rounded-lg">
                    <Checkbox
                      id="pa-accept"
                      checked={aufklaerungAccepted}
                      onCheckedChange={(c) => setAufklaerungAccepted(!!c)}
                      className="mt-1"
                    />
                    <Label htmlFor="pa-accept" className="cursor-pointer leading-relaxed">
                      {t(
                        "Ich habe die Patientenaufklärung (Leistungserstattung, Preise, Terminregelung) gelesen und bin damit einverstanden. *",
                        "I have read and agree to the patient information (fee reimbursement, pricing, appointment policy). *"
                      )}
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Datenschutz */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardContent className="p-4 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    <h2 className="font-serif text-2xl font-semibold text-foreground">
                      {t("Datenschutzverordnung", "Privacy Policy")}
                    </h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(
                      "Bitte lesen Sie die vollständige Datenschutzverordnung und bestätigen Sie Ihre Kenntnisnahme.",
                      "Please read the complete privacy policy and confirm your acknowledgment."
                    )}
                  </p>
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-muted/30">
                    <div className="prose prose-sm max-w-none text-muted-foreground">
                      <h3>{t("Ihre Daten in unserer Praxis", "Your Data in Our Practice")}</h3>
                      <p>
                        {t(
                          "Name, Adresse, E-Mail, Gesundheitsdaten (Anamnese, Diagnosen, Therapien), Messwerte von Geräten (Metatron, Vieva Pro, EAV, Trikombin) werden verarbeitet.",
                          "Name, address, email, health data (medical history, diagnoses, therapies), measurements from devices (Metatron, Vieva Pro, EAV, Trikombin) are processed."
                        )}
                      </p>
                      <p>
                        {t(
                          "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Behandlungsvertrag), Art. 9 Abs. 2 lit. h DSGVO (Gesundheitsversorgung). Aufbewahrungsfrist: 10 Jahre. Sie haben jederzeit das Recht auf Auskunft, Berichtigung und Löschung.",
                          "Legal basis: Art. 6(1)(b) GDPR (treatment contract), Art. 9(2)(h) GDPR (healthcare). Retention period: 10 years. You have the right to access, correct, and delete your data at any time."
                        )}
                      </p>
                      <p className="text-sm">
                        <Link to="/datenschutz" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                          {t("Vollständige Datenschutzverordnung lesen", "Read full privacy policy")}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 bg-sage-50 p-4 rounded-lg">
                    <Checkbox
                      id="ds-accept"
                      checked={datenschutzAccepted}
                      onCheckedChange={(c) => setDatenschutzAccepted(!!c)}
                      className="mt-1"
                    />
                    <Label htmlFor="ds-accept" className="cursor-pointer leading-relaxed">
                      {t(
                        "Ich habe die Datenschutzverordnung gelesen und stimme der Verarbeitung meiner Daten gemäß DSGVO zu. *",
                        "I have read the privacy policy and agree to the processing of my data according to GDPR. *"
                      )}
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("Zurück", "Back")}
            </Button>
            {currentStep < steps.length - 1 && (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="gap-2"
              >
                {t("Weiter", "Next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      )}
    </Layout>
  );
}
