import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FAQManager } from "@/components/admin/FAQManager";
import { PracticeInfoManager } from "@/components/admin/PracticeInfoManager";
import PricingManager from "@/components/admin/PricingManager";
import { AuditLogManager } from "@/components/admin/AuditLogManager";
import ICD10Generator from "@/components/admin/ICD10Generator";
import { PatientManager } from "@/components/admin/PatientManager";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, HelpCircle, Info, AlertTriangle, Euro, History, Brain, Users, Cpu, Library, Pill, Download, KeyRound, Eye, Hash } from "lucide-react";
import { PseudonymOverview } from "@/components/admin/PseudonymOverview";
import { InfothekGatingManager } from "@/components/admin/InfothekGatingManager";
import MannayanPriceManager from "@/components/admin/MannayanPriceManager";
import { AIModelInfo } from "@/components/admin/AIModelInfo";
import { PatientLibraryManager } from "@/components/admin/PatientLibraryManager";
import { PatientLoginToggle } from "@/components/admin/PatientLoginToggle";

import { AnamnesePublicToggle } from "@/components/admin/AnamnesePublicToggle";
import { BackupCenter } from "@/components/admin/BackupCenter";
import { PatientAccessManager } from "@/components/admin/PatientAccessManager";
import { isDevAdminBypassActive } from "@/lib/devAdminBypass";

const AdminDashboard = () => {
  const { user, loading: authLoading, isAdmin: contextIsAdmin } = useAuth();
  const devBypass = isDevAdminBypassActive();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'patients' ? 'patients' : 'faqs';
  const hasAdminAccess = devBypass || contextIsAdmin || isAdmin;

  if (authLoading || (!devBypass && adminLoading)) {
    return (
      <Layout>
        <div className="container py-12">
          <div className="mx-auto max-w-5xl space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user && !devBypass) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasAdminAccess) {
    return (
      <Layout>
        <div className="container py-12">
          <Card className="mx-auto max-w-lg border-destructive/50 bg-destructive/10">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold text-destructive mb-2">Zugriff verweigert</h2>
              <p className="text-muted-foreground">
                Sie haben keine Berechtigung, auf diese Seite zuzugreifen. 
                Bitte kontaktieren Sie einen Administrator, falls Sie Zugang benötigen.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-sage-50 py-8 md:py-12">
        <div className="container">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
                Admin-Dashboard
              </h1>
              <p className="text-muted-foreground">
                Verwalten Sie FAQs und Praxis-Informationen
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <PatientLoginToggle />
          <AnamnesePublicToggle />
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-[repeat(13,minmax(0,1fr))] max-w-6xl">
              <TabsTrigger value="patients" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Patienten
              </TabsTrigger>
              <TabsTrigger value="pseudonyms" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Pseudonyme
              </TabsTrigger>
              <TabsTrigger value="access" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Zugänge
              </TabsTrigger>
              <TabsTrigger value="visibility" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Sichtbarkeit
              </TabsTrigger>
              <TabsTrigger value="faqs" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                FAQs
              </TabsTrigger>
              <TabsTrigger value="practice" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Praxis-Info
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Preise
              </TabsTrigger>
              <TabsTrigger value="mannayan" className="flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Mannayan
              </TabsTrigger>
              <TabsTrigger value="library" className="flex items-center gap-2">
                <Library className="h-4 w-4" />
                Bibliothek
              </TabsTrigger>
              <TabsTrigger value="icd10" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                ICD-10
              </TabsTrigger>
              <TabsTrigger value="aimodel" className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                KI-Modell
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Protokoll
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Backup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="access">
              <Card>
                <CardHeader>
                  <CardTitle>Patienten-Zugänge (per E-Mail)</CardTitle>
                  <CardDescription>
                    Schalte gezielt frei, was eine bestimmte Patienten-E-Mail nach dem Login sehen darf: Anamnesebogen-Download,
                    Patienten-Bibliothek und gesperrte Infothek-Beiträge (Hypnosen etc.). Ohne Eintrag = nur öffentlicher Bereich.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PatientAccessManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="visibility">
              <Card>
                <CardHeader>
                  <CardTitle>Infothek-Sichtbarkeit</CardTitle>
                  <CardDescription>
                    Bestimme pro Beitrag, ob er für alle Besucher öffentlich oder nur für freigeschaltete Patienten sichtbar ist.
                    Wirkt sofort auf die öffentliche Infothek-Seite.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InfothekGatingManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patients">
              <Card>
                <CardHeader>
                  <CardTitle>Patientenübersicht</CardTitle>
                  <CardDescription>
                    Alle registrierten Patienten mit personenbezogenen Daten und Anmeldehistorie.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PatientManager devBypass={devBypass} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pseudonyms">
              <PseudonymOverview />
            </TabsContent>


            <TabsContent value="faqs">
              <Card>
                <CardHeader>
                  <CardTitle>Häufig gestellte Fragen</CardTitle>
                  <CardDescription>
                    Erstellen und bearbeiten Sie FAQs für Ihre Patienten. Änderungen werden sofort auf der FAQ-Seite sichtbar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FAQManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="practice">
              <Card>
                <CardHeader>
                  <CardTitle>Praxis-Informationen</CardTitle>
                  <CardDescription>
                    Verwalten Sie allgemeine Informationen über Ihre Praxis, die auf der Praxis-Info Seite angezeigt werden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PracticeInfoManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing">
              <PricingManager />
            </TabsContent>

            <TabsContent value="mannayan">
              <MannayanPriceManager />
            </TabsContent>

            <TabsContent value="icd10">
              <Card>
                <CardHeader>
                  <CardTitle>ICD-10 Codegenerierung</CardTitle>
                  <CardDescription>
                    Automatische ICD-10-Zuordnung aus Anamnesebogen-Daten. Feste Zuordnungen und KI-gestützte Freitext-Analyse.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ICD10Generator />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="aimodel">
              <Card>
                <CardHeader>
                  <CardTitle>KI-Modell &amp; Kosten</CardTitle>
                  <CardDescription>
                    Übersicht der aktuell eingesetzten KI-Modelle, ihrer Stärken/Schwächen und der ungefähren Kosten pro Anfrage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AIModelInfo />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle>Aktivitätsprotokoll (DSGVO)</CardTitle>
                  <CardDescription>
                    Übersicht aller Anmeldungen und Aktionen mit Zeitstempeln gemäß DSGVO-Dokumentationspflicht.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AuditLogManager />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="library">
              <Card>
                <CardHeader>
                  <CardTitle>Patienten-Bibliothek</CardTitle>
                  <CardDescription>
                    PDF-Skripte und MP3-Audios für verifizierte Patientinnen und Patienten. Dateien sind nur nach Login und Verifizierung zugänglich.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PatientLibraryManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup">
              <BackupCenter />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
