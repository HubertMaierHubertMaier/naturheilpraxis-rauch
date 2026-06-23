import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { AnamnesePdfButton } from "@/components/anamnese/AnamnesePdfButton";
import { FileText } from "lucide-react";

export default function Erstanmeldung() {
  const { t } = useLanguage();

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
            <AnamnesePdfButton size="lg" className="gap-2">
              {t("Erstanmeldungs-PDF herunterladen", "Download registration PDF")}
            </AnamnesePdfButton>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
