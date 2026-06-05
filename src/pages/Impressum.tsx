import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { User, MapPin, Phone, Mail, Globe, FileText, Shield, Scale } from "lucide-react";

const Impressum = () => {
  const { t } = useLanguage();

  return (
    <Layout mainAriaLabel="Impressum">
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              {t("Impressum", "Legal Notice")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("Angaben gemäß § 5 TMG", "Information according to § 5 TMG (German Telemedia Act)")}
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Anbieter */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    {t("Angaben zum Diensteanbieter", "Service Provider Information")}
                  </h2>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="font-medium text-foreground">Peter Rauch</p>
                    <p>{t("Heilpraktiker", "Naturopath (Heilpraktiker)")}</p>
                    <p>Naturheilpraxis Peter Rauch</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kontaktdaten */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground">
                {t("Kontaktdaten", "Contact Information")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{t("Adresse", "Address")}</p>
                    <p className="text-sm text-muted-foreground">
                      Friedrich-Deffner-Straße 19a<br />
                      86163 Augsburg<br />
                      {t("Deutschland", "Germany")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{t("Telefon", "Phone")}</p>
                    <a href="tel:08212621462" className="text-sm text-muted-foreground hover:text-primary">
                      0821-2621462
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{t("E-Mail", "Email")}</p>
                    <a href="mailto:info@rauch-heilpraktiker.de" className="text-sm text-muted-foreground hover:text-primary">
                      info@rauch-heilpraktiker.de
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Website</p>
                    <a 
                      href="https://www.rauch-heilpraktiker.de" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      www.rauch-heilpraktiker.de
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Berufsbezeichnung */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    {t("Berufsbezeichnung und berufsrechtliche Regelungen", "Professional Title and Regulations")}
                  </h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      <strong className="text-foreground">{t("Berufsbezeichnung:", "Professional Title:")}</strong> {t("Heilpraktiker", "Naturopath (Heilpraktiker)")}
                    </p>
                    <p>
                      <strong className="text-foreground">{t("Zuständige Aufsichtsbehörde:", "Supervisory Authority:")}</strong><br />
                      {t("Gesundheitsamt der Stadt Augsburg", "Health Department of the City of Augsburg")}<br />
                      Hoher Weg 8<br />
                      86152 Augsburg<br />
                      {t("Deutschland", "Germany")}
                    </p>
                    <p>
                      <strong className="text-foreground">{t("Berufsrechtliche Regelungen:", "Professional Regulations:")}</strong><br />
                      {t(
                        "Gesetz über die berufsmäßige Ausübung der Heilkunde ohne Bestallung (Heilpraktikergesetz) vom 17.02.1939",
                        "German Naturopathy Act (Heilpraktikergesetz) of 17.02.1939 - Law on the Professional Practice of Medicine Without a License"
                      )}
                    </p>
                    <p>
                      <strong className="text-foreground">{t("Erlaubnis erteilt durch:", "License issued by:")}</strong><br />
                      {t("Gesundheitsamt Augsburg", "Health Department Augsburg")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Berufsverband */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    {t("Berufsverband", "Professional Association")}
                  </h2>
                  <p className="text-muted-foreground">
                    {t(
                      "Mitglied im Bund Deutscher Heilpraktiker e.V. (BDH)",
                      "Member of the German Association of Naturopaths (Bund Deutscher Heilpraktiker e.V. - BDH)"
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verantwortlich für Inhalte */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    {t(
                      "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV",
                      "Responsible for Content according to § 55 Para. 2 RStV"
                    )}
                  </h2>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="font-medium text-foreground">Peter Rauch</p>
                    <p>Friedrich-Deffner-Straße 19a</p>
                    <p>86163 Augsburg</p>
                    <p>{t("Deutschland", "Germany")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Haftungshinweise */}
          <Card className="border-sage-200 bg-sage-50 shadow-card">
            <CardContent className="p-8">
              <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                {t("Haftungshinweis", "Disclaimer")}
              </h2>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <div>
                  <h3 className="mb-2 font-medium text-foreground">
                    {t("Haftung für Inhalte", "Liability for Content")}
                  </h3>
                  <p>
                    {t(
                      "Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Als Diensteanbieter bin ich gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.",
                      "The contents of this website were created with the utmost care. However, no guarantee can be given for the accuracy, completeness and timeliness of the content. As a service provider, I am responsible for my own content on these pages in accordance with § 7 para. 1 TMG under general law."
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-foreground">
                    {t("Haftung für Links", "Liability for Links")}
                  </h3>
                  <p>
                    {t(
                      "Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werde ich derartige Links umgehend entfernen.",
                      "This website contains links to external third-party websites over whose content I have no influence. The respective provider or operator is always responsible for the content of the linked pages. If I become aware of any legal violations, I will remove such links immediately."
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-foreground">
                    {t("Urheberrecht", "Copyright")}
                  </h3>
                  <p>
                    {t(
                      "Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet. Die Vervielfältigung, Bearbeitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors.",
                      "The content and works created by the site operator on these pages are subject to German copyright law. Third-party contributions are marked as such. Reproduction, editing and any kind of exploitation outside the limits of copyright law require the written consent of the respective author."
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Impressum;
