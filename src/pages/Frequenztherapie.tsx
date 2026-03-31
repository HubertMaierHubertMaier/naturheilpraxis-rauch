import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Zap, Radio, Heart, Sparkles, Activity, Phone, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/seo/SEOHead";
import heroImg from "@/assets/frequenztherapie-hero.jpg";
import behandlungImg from "@/assets/frequenztherapie-behandlung.jpg";
import zellenImg from "@/assets/frequenztherapie-zellen.jpg";

const Frequenztherapie = () => {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Activity,
      title: t("Zellregeneration", "Cell Regeneration"),
      description: t(
        "Unterstützt die natürliche Regeneration von Zellen und Gewebe durch gezielte Frequenzimpulse.",
        "Supports the natural regeneration of cells and tissue through targeted frequency impulses."
      ),
    },
    {
      icon: Heart,
      title: t("Schmerzlinderung", "Pain Relief"),
      description: t(
        "Kann bei chronischen und akuten Schmerzzuständen unterstützend wirken.",
        "Can provide supportive relief for chronic and acute pain conditions."
      ),
    },
    {
      icon: Radio,
      title: t("Entgiftung", "Detoxification"),
      description: t(
        "Fördert die Ausscheidung von Stoffwechselprodukten und unterstützt die körpereigene Entgiftung.",
        "Promotes the elimination of metabolic products and supports the body's natural detoxification."
      ),
    },
    {
      icon: Sparkles,
      title: t("Immunstärkung", "Immune Boost"),
      description: t(
        "Kann das Immunsystem anregen und die Abwehrkräfte des Körpers unterstützen.",
        "Can stimulate the immune system and support the body's defense mechanisms."
      ),
    },
  ];

  return (
    <Layout>
      <SEOHead
        title={t("Frequenztherapie", "Frequency Therapy")}
        description={t(
          "Frequenztherapie in Augsburg: Erfahren Sie mehr über den Diamond Shield Zapper und die Anwendung bioenergetischer Frequenzen in der Naturheilpraxis Peter Rauch.",
          "Frequency therapy in Augsburg: Learn about the Diamond Shield Zapper and bioenergentic frequency applications at Naturheilpraxis Peter Rauch."
        )}
      />
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-sage-50 via-sage-100/50 to-background py-12 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-primary/10 p-4">
              <Zap className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl">
              {t("Frequenztherapie", "Frequency Therapy")}
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              {t(
                "Sanfte Impulse für Ihre Gesundheit – Eine moderne Ergänzung der Naturheilkunde",
                "Gentle impulses for your health – A modern complement to naturopathy"
              )}
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl shadow-elevated">
            <img
              src={heroImg}
              alt={t("Diamond Shield Zapper – Frequenztherapiegerät", "Diamond Shield Zapper – Frequency therapy device")}
              width={1200}
              height={672}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Was ist Frequenztherapie */}
      <section className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <Card className="mb-12 shadow-card">
            <CardContent className="p-8 md:p-10">
              <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground md:text-3xl">
                {t("Was ist Frequenztherapie?", "What is Frequency Therapy?")}
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {t(
                    "Die Frequenztherapie ist ein Verfahren der Naturheilkunde, bei dem niederfrequente elektrische Impulse zur Anregung körpereigener Regulationsprozesse eingesetzt werden. Diese Therapieform basiert auf der Erkenntnis, dass jede Zelle im Körper elektrische Eigenschaften besitzt und auf bestimmte Frequenzen reagiert.",
                    "Frequency therapy is a naturopathic method in which low-frequency electrical impulses are used to stimulate the body's own regulatory processes. This form of therapy is based on the understanding that every cell in the body has electrical properties and responds to certain frequencies."
                  )}
                </p>
                <p>
                  {t(
                    "In meiner Praxis verwende ich moderne Frequenztherapie-Geräte, die individuell auf Ihre Beschwerden und Bedürfnisse abgestimmt werden. Die Behandlung ist schmerzfrei und wird von den meisten Patienten als angenehm entspannend empfunden.",
                    "In my practice, I use modern frequency therapy devices that are individually tailored to your complaints and needs. The treatment is painless and most patients find it pleasantly relaxing."
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Grid */}
          <h2 className="mb-8 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
            {t("Mögliche Anwendungsgebiete", "Possible Applications")}
          </h2>
          <div className="mb-12 grid gap-6 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <Card key={index} className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-serif text-lg font-medium text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ablauf einer Behandlung */}
          <Card className="mb-12 border-sage-200 bg-sage-50/50 shadow-card">
            <CardContent className="p-8 md:p-10">
              <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground">
                {t("Ablauf einer Behandlung", "Course of Treatment")}
              </h2>
              <ol className="space-y-4">
                {[
                  {
                    de: "Ausführliches Erstgespräch zur Erfassung Ihrer Beschwerden und Krankengeschichte",
                    en: "Detailed initial consultation to record your complaints and medical history"
                  },
                  {
                    de: "Individuelle Frequenzauswahl basierend auf Ihren spezifischen Bedürfnissen",
                    en: "Individual frequency selection based on your specific needs"
                  },
                  {
                    de: "Entspannte Behandlung in angenehmer Atmosphäre (ca. 30-60 Minuten)",
                    en: "Relaxed treatment in a pleasant atmosphere (approx. 30-60 minutes)"
                  },
                  {
                    de: "Nachbesprechung und Empfehlungen für zu Hause",
                    en: "Follow-up discussion and recommendations for home"
                  },
                ].map((step, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-muted-foreground">
                      {t(step.de, step.en)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Hinweis */}
          <Card className="mb-12 border-accent bg-accent/20 shadow-card">
            <CardContent className="p-6">
              <p className="text-sm text-accent-foreground">
                <strong>{t("Hinweis:", "Note:")}</strong>{" "}
                {t(
                  "Die Frequenztherapie ist eine Methode der Naturheilkunde und ersetzt keine ärztliche Diagnose oder Behandlung. Bei ernsthaften oder unklaren Beschwerden konsultieren Sie bitte immer zuerst einen Arzt.",
                  "Frequency therapy is a naturopathic method and does not replace medical diagnosis or treatment. For serious or unclear complaints, please always consult a doctor first."
                )}
              </p>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-sage-200 bg-sage-50 shadow-card">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
                <Zap className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">
                {t("Interesse geweckt?", "Interested?")}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {t(
                  "Vereinbaren Sie einen Termin für ein unverbindliches Beratungsgespräch.",
                  "Schedule an appointment for a non-binding consultation."
                )}
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild>
                  <a href="tel:08212621462">
                    <Phone className="mr-2 h-4 w-4" />
                    {t("Jetzt anrufen", "Call now")}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/anamnesebogen">
                    {t("Zum Anamnesebogen", "To Medical History")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default Frequenztherapie;
