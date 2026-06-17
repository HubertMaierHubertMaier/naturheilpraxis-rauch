import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import { BookOpen, ExternalLink, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { infothekOverviewGroups as groups } from "@/lib/infothekContent";
import { useContentProtection } from "@/hooks/useContentProtection";
import { usePatientAccess } from "@/hooks/usePatientAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useInfothekGating } from "@/hooks/useInfothekGating";
import { toast } from "sonner";

export default function Infothek() {
  useContentProtection();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { canSeeInfothekItem, loading } = usePatientAccess();
  const { getVisibility } = useInfothekGating();

  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      toast.info(
        t(
          "Dieser Beitrag ist nur für freigeschaltete Patientinnen und Patienten sichtbar. Bitte melde dich an – die Freigabe erfolgt nach telefonischer Rücksprache mit Peter Rauch.",
          "This entry is only available for approved patients. Please sign in – access is granted after a brief phone call."
        ),
        { duration: 6000 }
      );
    } else {
      toast.info(
        t(
          "Dieser Beitrag ist noch nicht für dich freigeschaltet. Bitte sprich Peter Rauch direkt an – die Freigabe erfolgt nach telefonischer Rücksprache.",
          "This entry has not been unlocked for you yet. Please contact Peter Rauch – access is granted after a brief phone call."
        ),
        { duration: 6000 }
      );
    }
  };

  // Pre-compute visibility & access for all groups
  type EnrichedItem = {
    item: (typeof groups)[number]["items"][number];
    locked: boolean;
  };
  const enrichedGroups = groups
    .map((group) => {
      const items: EnrichedItem[] = group.items.map((item) => {
        const vis = getVisibility(item.href, !!item.gated);
        let locked = false;
        if (vis === "public") locked = false;
        else if (vis === "new_patient") locked = !user; // angemeldet reicht
        else locked = !canSeeInfothekItem(item.href); // patient → braucht Freischaltung
        return { item, locked };
      });
      return { group, items };
    })
    .filter((g) => g.items.length > 0);

  const totalLocked = enrichedGroups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.locked).length,
    0
  );

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

          {/* Hinweis-Box zu den 2 Zugangs-Stufen */}
          {!loading && totalLocked > 0 && (
            <div className="mx-auto mb-10 max-w-3xl rounded-xl border border-sage-200 bg-sage-50/60 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm text-foreground/80">
                  <p className="mb-2 font-semibold text-foreground">
                    {t(
                      "Zwei Arten von Beiträgen in dieser Infothek",
                      "Two types of entries in this info center"
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        <b>{t("Frei verfügbar", "Freely available")}</b> –{" "}
                        {t(
                          "ohne Anmeldung lesbar.",
                          "readable without sign-in."
                        )}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        <b>
                          {t(
                            "Nur für freigeschaltete Patientinnen und Patienten",
                            "Only for approved patients"
                          )}
                        </b>{" "}
                        –{" "}
                        {t(
                          "Therapeutische Inhalte (z. B. Hypnose-Audios, Diät-Pläne, individuelle Therapie-Hinweise). Die Freigabe erfolgt persönlich durch Peter Rauch nach telefonischer Rücksprache und der Anlage deines E-Mail-Zugangs.",
                          "Therapeutic content (e.g. hypnosis audios, diet plans, individual therapy notes). Access is granted personally by Peter Rauch after a phone call and setup of your email access."
                        )}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-5xl space-y-12">
            {enrichedGroups.map(({ group, items }) => (
              <div key={group.title.de}>
                <h2 className="mb-6 font-serif text-xl font-semibold text-foreground md:text-2xl">
                  {t(group.title.de, group.title.en)}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(({ item, locked }) => {
                    if (locked) {
                      // Gesperrt: ausgegraut + Schloss-Icon, kein echter Link
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={handleLockedClick}
                          className="group relative flex h-full flex-col rounded-xl border border-dashed border-sage-300 bg-muted/40 p-5 text-left opacity-70 grayscale transition-all duration-200 hover:opacity-90 hover:grayscale-0 cursor-not-allowed"
                          aria-label={t(
                            `Gesperrt: ${item.label.de} – Freischaltung erforderlich`,
                            `Locked: ${item.label.en} – approval required`
                          )}
                        >
                          <div className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 ring-1 ring-sage-300">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <item.icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <h3 className="mb-1 text-sm font-semibold text-foreground/80">
                            {t(item.label.de, item.label.en)}
                          </h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {t(item.description.de, item.description.en)}
                          </p>
                          <div className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-sage-100/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary/80">
                            <Lock className="h-2.5 w-2.5" />
                            {t("Freischaltung nötig", "Access required")}
                          </div>
                        </button>
                      );
                    }

                    // Freigeschaltet / frei zugänglich: normales Tile
                    const content = (
                      <div className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-foreground">
                          {t(item.label.de, item.label.en)}
                          {item.external && (
                            <ExternalLink className="ml-1.5 inline h-3 w-3 text-muted-foreground" />
                          )}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t(item.description.de, item.description.en)}
                        </p>
                      </div>
                    );

                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
