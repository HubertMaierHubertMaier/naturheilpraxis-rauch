import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Download, Eye, Calendar, Clock, User, Shield, Loader2,
  BookOpen, PenTool, Plus, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { generateEnhancedAnamnesePdf } from "@/lib/pdfExportEnhanced";
import { AnamneseFormData } from "@/lib/anamneseFormData";
import SEOHead from "@/components/seo/SEOHead";

interface AnamnesisSubmission {
  id: string;
  status: string;
  submitted_at: string;
  updated_at: string;
  form_data: AnamneseFormData;
}

const PatientDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<AnamnesisSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<AnamnesisSubmission | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("anamnesis_submissions")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      
      const typedData: AnamnesisSubmission[] = (data || []).map(item => ({
        ...item,
        form_data: item.form_data as unknown as AnamneseFormData
      }));
      
      setSubmissions(typedData);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      toast.error(t("Fehler beim Laden der Daten", "Error loading data"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (submission: AnamnesisSubmission) => {
    try {
      await generateEnhancedAnamnesePdf({
        formData: submission.form_data,
        language
      });
      toast.success(t("PDF wurde heruntergeladen", "PDF downloaded successfully"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("Fehler beim PDF-Export", "Error exporting PDF"));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      draft: { label: t("Entwurf", "Draft"), variant: "secondary" },
      submitted: { label: t("Eingereicht", "Submitted"), variant: "default" },
      verified: { label: t("Verifiziert", "Verified"), variant: "default" },
      reviewed: { label: t("Überprüft", "Reviewed"), variant: "outline" },
    };
    const config = statusConfig[status] || statusConfig.submitted;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      language === "de" ? "de-DE" : "en-US",
      { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  const verifiedSubmissions = submissions.filter(s => s.status === "verified");

  return (
    <Layout>
      <SEOHead 
        title={t("Mein Patientenbereich", "My Patient Area")} 
        description={t("Ihr persönlicher Bereich mit Infothek, Anamnesebogen und Dokumenten", "Your personal area with info center, medical history and documents")}
        noIndex={true}
      />
      
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {t("Willkommen zurück", "Welcome back")}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Infothek */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate("/infothek")}>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{t("Infothek", "Info Center")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t(
                    "Alle Fachartikel, Therapieskripte und Patienteninformationen",
                    "All articles, therapy scripts and patient information"
                  )}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  {t("Zur Infothek", "Go to Info Center")}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Anamnesebogen ergänzen */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate("/anamnesebogen")}>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-950/50 transition-colors flex-shrink-0">
                <PenTool className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">
                  {verifiedSubmissions.length > 0
                    ? t("Anamnesebogen ergänzen", "Update Medical History")
                    : t("Anamnesebogen ausfüllen", "Fill out Medical History")}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {verifiedSubmissions.length > 0
                    ? t(
                        "Ergänzen Sie neue Symptome oder aktualisieren Sie Ihre Angaben",
                        "Add new symptoms or update your information"
                      )
                    : t(
                        "Füllen Sie Ihren Anamnesebogen vor dem ersten Termin aus",
                        "Fill out your medical history before your first appointment"
                      )}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  {verifiedSubmissions.length > 0
                    ? t("Bogen ergänzen", "Update form")
                    : t("Bogen ausfüllen", "Fill out form")}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Dokumente */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate("/datenschutz")}>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted group-hover:bg-muted/80 transition-colors flex-shrink-0">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{t("Datenschutz & Dokumente", "Privacy & Documents")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t(
                    "Datenschutzerklärung, Gebührenordnung und wichtige Formulare",
                    "Privacy policy, fee schedule and important forms"
                  )}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  {t("Ansehen", "View")}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="mb-8" />

        {/* Submissions History */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t("Meine Anamnesebögen", "My Medical History Forms")}
            {verifiedSubmissions.length > 0 && (
              <Badge variant="secondary" className="ml-2">{verifiedSubmissions.length} {t("Version(en)", "version(s)")}</Badge>
            )}
          </h2>

          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {t("Noch keine Anamnesebögen", "No medical history forms yet")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t(
                    "Füllen Sie Ihren ersten Anamnesebogen aus, um ihn hier zu sehen.",
                    "Fill out your first medical history form to see it here."
                  )}
                </p>
                <Button onClick={() => navigate("/anamnesebogen")}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Anamnesebogen ausfüllen", "Fill out form")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {submissions.map((submission, index) => (
                <Card key={submission.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          {t("Anamnesebogen", "Medical History Form")}
                          {verifiedSubmissions.length > 1 && submission.status === "verified" && (
                            <Badge variant="outline" className="ml-1">
                              V{verifiedSubmissions.length - verifiedSubmissions.indexOf(submission)}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(submission.submitted_at)}
                          </span>
                          {submission.updated_at !== submission.submitted_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {t("Aktualisiert", "Updated")}: {formatDate(submission.updated_at)}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {getStatusBadge(submission.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <span>
                        {t("Patient", "Patient")}: {submission.form_data.vorname} {submission.form_data.nachname}
                      </span>
                      {submission.form_data.geburtsdatum && (
                        <>
                          <span>•</span>
                          <span>{t("Geb.", "DOB")}: {submission.form_data.geburtsdatum}</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSubmission(
                          selectedSubmission?.id === submission.id ? null : submission
                        )}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {selectedSubmission?.id === submission.id 
                          ? t("Schließen", "Close") 
                          : t("Details anzeigen", "View details")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPdf(submission)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t("PDF herunterladen", "Download PDF")}
                      </Button>
                    </div>
                    
                    {/* Expanded Details */}
                    {selectedSubmission?.id === submission.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <h4 className="font-semibold">{t("Zusammenfassung", "Summary")}</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t("E-Mail", "Email")}:</span>
                            <p>{submission.form_data.email || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Telefon", "Phone")}:</span>
                            <p>{submission.form_data.telefonPrivat || submission.form_data.mobil || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Adresse", "Address")}:</span>
                            <p>{submission.form_data.strasse}, {submission.form_data.plz} {submission.form_data.wohnort}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Versicherung", "Insurance")}:</span>
                            <p>{submission.form_data.versicherungstyp || "-"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PatientDashboard;