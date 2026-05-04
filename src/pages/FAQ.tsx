import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const FAQ = () => {
  useContentProtection();
  const { language, t } = useLanguage();
  const tr = translations.faq;

  const { data: faqs, isLoading, error } = useQuery({
    queryKey: ['faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Inject FAQPage schema for Google rich results
  useEffect(() => {
    if (!faqs || faqs.length === 0) return;
    const schemaId = "schema-faq-page";
    const existing = document.getElementById(schemaId);
    if (existing) existing.remove();
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: language === "de" ? faq.question_de : faq.question_en,
        acceptedAnswer: {
          "@type": "Answer",
          text: language === "de" ? faq.answer_de : faq.answer_en,
        },
      })),
    };
    const script = document.createElement("script");
    script.id = schemaId;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { document.getElementById(schemaId)?.remove(); };
  }, [faqs, language]);

  return (
    <Layout>
      <SEOHead
        title={t("Häufige Fragen (FAQ)", "Frequently Asked Questions (FAQ)")}
        description={t(
          "Antworten auf häufig gestellte Fragen zu Naturheilkunde, Behandlungen und Terminen in der Naturheilpraxis Peter Rauch in Augsburg.",
          "Answers to frequently asked questions about naturopathy, treatments and appointments at Naturheilpraxis Peter Rauch in Augsburg."
        )}
      />
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              {t(tr.title.de, tr.title.en)}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(tr.subtitle.de, tr.subtitle.en)}
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <Card className="mb-8 shadow-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-6 text-center text-destructive">
                  {t(translations.common.error.de, translations.common.error.en)}
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {faqs?.map((faq, index) => (
                    <AccordionItem
                      key={faq.id}
                      value={`item-${index}`}
                      className="border-b border-border last:border-0"
                    >
                      <AccordionTrigger className="px-6 py-4 text-left font-serif text-lg font-medium hover:no-underline [&[data-state=open]]:text-primary">
                        {language === 'de' ? faq.question_de : faq.question_en}
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4 text-muted-foreground leading-relaxed">
                        {language === 'de' ? faq.answer_de : faq.answer_en}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Kontakt CTA */}
          <Card className="border-sage-200 bg-sage-50 shadow-card">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
                <HelpCircle className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">
                {t(tr.notFound.de, tr.notFound.en)}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {t(tr.contact.de, tr.contact.en)}
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild>
                  <a href="tel:08212621462">
                    <Phone className="mr-2 h-4 w-4" />
                    {t(tr.call.de, tr.call.en)}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/anamnesebogen">
                    {t(tr.toAnamnesis.de, tr.toAnamnesis.en)}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default FAQ;
