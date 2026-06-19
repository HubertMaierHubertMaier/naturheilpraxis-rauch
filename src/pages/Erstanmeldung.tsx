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
    descDe: "Erstanmeldung – 3 Schritte online oder 1 kombiniertes PDF",
    descEn: "First registration – 3 online steps or 1 combined PDF",
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
      <section className="bg-sage-50 py-8 md:py-12">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-3 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              {t("Erstanmeldung", "First Registration")}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "Die Erstanmeldung erfolgt aktuell ausschließlich über das ausfüllbare Acrobat-PDF. Das PDF enthält Anamnesebogen, Patientenvertrag und Datenschutz-Einwilligung in einem Dokument.",
                "First registration is currently handled exclusively via the fillable Acrobat PDF. The PDF contains the medical history form, patient contract and data protection consent in one document."
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="container py-8 md:py-12">
        <Card className="mx-auto max-w-3xl border-primary/20 shadow-card">
          <CardContent className="p-5 text-center sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-sage-100">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-foreground">
              {t("Acrobat-PDF herunterladen", "Download Acrobat PDF")}
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-muted-foreground leading-relaxed">
              {t(
                "Bitte laden Sie das PDF herunter, füllen Sie es am PC aus und senden Sie es anschließend per E-Mail zurück oder bringen Sie es ausgedruckt zum Termin mit.",
                "Please download the PDF, fill it out on your computer and then return it by email or bring a printed copy to your appointment."
              )}
            </p>
            <a href="/anamnesebogen-blanko.pdf" download>
              <Button size="lg" className="gap-2">
                <FileText className="h-4 w-4" />
                {t("Erstanmeldungs-PDF herunterladen", "Download registration PDF")}
              </Button>
            </a>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
