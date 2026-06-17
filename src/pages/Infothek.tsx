import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import { BookOpen, ExternalLink, Lock } from "lucide-react";
import { infothekOverviewGroups as groups } from "@/lib/infothekContent";
import { useContentProtection } from "@/hooks/useContentProtection";
import { usePatientAccess } from "@/hooks/usePatientAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useInfothekGating } from "@/hooks/useInfothekGating";

export default function Infothek() {
  useContentProtection();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { canSeeInfothekItem, loading } = usePatientAccess();
  const { isGated } = useInfothekGating();

  return (
    <Layout>
      <SEOHead
        title="Infothek – Naturheilpraxis Peter Rauch"
        description="Fachartikel, Patienteninformationen und Wissenswertes rund um Naturheilkunde, Frequenztherapie und ganzheitliche Gesundheit."
      />

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-1.5 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" />
              {t("Infothek", "Info Center")}
            </div>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl">
              {t("Infothek", "Info Center")}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t(
                "Fachartikel, Patienteninformationen und Wissenswertes rund um Naturheilkunde und ganzheitliche Gesundheit.",
                "Articles, patient information and knowledge about naturopathy and holistic health."
              )}
            </p>
          </div>

          <div className="mx-auto max-w-5xl space-y-12">
            {groups.map((group) => {
              // gated items: only show if user has access (or admin).
              // `gated` kommt entweder aus DB-Override (Admin-UI „Infothek-Sichtbarkeit") oder aus infothekContent.ts
              const itemsWithGating = group.items.map((item) => ({ item, gated: isGated(item.href, !!item.gated) }));
              const visibleItems = itemsWithGating.filter(({ item, gated }) => !gated || canSeeInfothekItem(item.href)).map(({ item }) => item);
              const hiddenGatedCount = itemsWithGating.filter(({ item, gated }) => gated && !canSeeInfothekItem(item.href)).length;
              if (visibleItems.length === 0 && hiddenGatedCount === 0) return null;

              return (
                <div key={group.title.de}>
                  <h2 className="mb-6 font-serif text-xl font-semibold text-foreground md:text-2xl">
                    {t(group.title.de, group.title.en)}
                  </h2>
                  {visibleItems.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleItems.map((item) => {
                        const content = (
                          <div className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
                            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                              <item.icon className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="mb-1 text-sm font-semibold text-foreground">
                              {t(item.label.de, item.label.en)}
                              {item.external && <ExternalLink className="ml-1.5 inline h-3 w-3 text-muted-foreground" />}
                            </h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {t(item.description.de, item.description.en)}
                            </p>
                          </div>
                        );

                        if (item.external) {
                          return (
                            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                              {content}
                            </a>
                          );
                        }
                        return (
                          <Link key={item.href} to={item.href}>
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {!loading && hiddenGatedCount > 0 && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-sage-300 bg-sage-50/50 p-4 text-sm text-muted-foreground">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>
                        {hiddenGatedCount === 1
                          ? t("1 Beitrag dieser Kategorie ist nur für freigeschaltete Patientinnen und Patienten sichtbar.", "1 entry in this category is only visible to approved patients.")
                          : t(`${hiddenGatedCount} Beiträge dieser Kategorie sind nur für freigeschaltete Patientinnen und Patienten sichtbar.`, `${hiddenGatedCount} entries in this category are only visible to approved patients.`)}
                        {" "}
                        {user
                          ? t("Bitte sprich Peter Rauch an, wenn du Zugang benötigst.", "Please contact Peter Rauch if you need access.")
                          : t("Bitte zuerst anmelden – die Freigabe erfolgt nach telefonischer Rücksprache.", "Please sign in first – access is granted after a brief phone call.")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}

