import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Euro, Info, FileText, AlertTriangle, Clock, Ban, ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const Patientenaufklaerung = () => {
  useContentProtection();
  const { t, language } = useLanguage();

  const { data: pricing, isLoading } = useQuery({
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

  return (
    <Layout>
      <SEOHead
        title={t(
          "Patientenaufklärung – Leistungserstattung | Naturheilpraxis Rauch",
          "Patient Information – Fee Reimbursement | Naturopathic Practice Rauch"
        )}
        description={t(
          "Informationen zur Kostenerstattung durch Krankenkassen, Preise und Behandlungsvereinbarung.",
          "Information about insurance reimbursement, pricing, and treatment agreement."
        )}
      />

      {/* Hero */}
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              {t("Patientenaufklärung", "Patient Information")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(
                "Leistungserstattung, Preise & Behandlungsvereinbarung",
                "Fee Reimbursement, Pricing & Treatment Agreement"
              )}
            </p>
            <a
              href="/patientenvertrag-blanko.pdf"
              download
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-sage-100"
            >
              <FileText className="h-4 w-4" />
              {t("Patientenvertrag als ausfüllbares PDF herunterladen", "Download patient contract as fillable PDF")}
            </a>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* GKV Hinweis */}
          <Card className="border-accent/30 bg-accent/5 shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <AlertTriangle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    {t("Wichtiger Hinweis", "Important Notice")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(
                      "Die gesetzlichen Krankenkassen in Deutschland übernehmen die Kosten der Heilpraktiker-Behandlung leider nicht. Wir können auch nicht garantieren, dass eine Erstattung durch die privaten Krankenversicherungen (PKV), private Zusatzversicherungen oder die Beihilfe erfolgt.",
                      "Statutory health insurance in Germany unfortunately does not cover the costs of naturopathic treatment. We also cannot guarantee reimbursement by private health insurance, supplementary insurance, or government aid."
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kostenerstattung */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Euro className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    {t("Kostenerstattung", "Cost Reimbursement")}
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      {t(
                        "Die Gebührenordnung – GebÜH (Gebührenordnung der Heilpraktiker) ist geltend für Patienten, die privatversichert, beihilfeversichert oder zusatzversichert sind. Für selbstzahlende, nicht privatversicherte Patienten sind die GebÜH-Positionen nicht von Bedeutung.",
                        "The fee schedule – GebÜH (fee schedule for naturopaths) applies to patients who are privately insured, have government aid insurance, or supplementary insurance. For self-paying patients without private insurance, the GebÜH positions are not relevant."
                      )}
                    </p>
                    <p>
                      {t(
                        "Versicherte privater Krankenkassen (Beihilfe, Zusatzversicherungen und private Vollversicherungen) erhalten Leistungen des Heilpraktikers erstattet, wenn dies in ihrem Versicherungsvertrag vereinbart wurde. Die Erstattungsfähigkeit nach GebÜH ist je nach Krankenkasse und gewähltem Tarif (ca. 50 Krankenkassen à 10 Tarife = ca. 500 verschiedene Abrechnungsmodalitäten) unterschiedlich.",
                        "Privately insured patients (government aid, supplementary and full private insurance) receive reimbursement for naturopathic services if this is agreed in their insurance contract. Reimbursement eligibility varies depending on the insurance company and chosen tariff (approx. 50 insurers × 10 tariffs = approx. 500 different billing modalities)."
                      )}
                    </p>
                    <p>
                      {t(
                        "Die Übernahme der Behandlungskosten und damit in Zusammenhang stehende Arzneimittelverordnungen wird von den Versicherungen sehr unterschiedlich gehandhabt. Eine Kostenerstattung ist nicht gesichert und unterliegt mitunter der Einzelprüfung. Häufig werden nur Teilbeträge erstattet, die nicht kostendeckend sind.",
                        "The assumption of treatment costs and related prescriptions is handled very differently by insurers. Cost reimbursement is not guaranteed and may be subject to individual review. Often only partial amounts are reimbursed that do not cover full costs."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GebÜH Erklärung */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    {t("GebÜH – Gebührenordnung der Heilpraktiker", "GebÜH – Fee Schedule for Naturopaths")}
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      {t(
                        "Das GebÜH ist ein Verzeichnis der durchschnittlich üblichen Vergütungen, welches als Berechnungshilfe bei der Rechnungserstellung dient. Sofern die Höhe des Honorars vor der Behandlung nicht ausdrücklich vereinbart wurde, kann der Patient davon ausgehen, dass sie sich im Rahmen der im GebÜH enthaltenen Beträge bewegt.",
                        "The GebÜH is a directory of average customary fees that serves as a calculation aid for invoicing. Unless the fee amount was expressly agreed before treatment, the patient can assume it falls within the amounts contained in the GebÜH."
                      )}
                    </p>
                    <p>
                      {t(
                        'Die Praxis rechnet nach GebÜH-Höchstsatz ab. Sollten die möglichen Positionen der GebÜH, die bezüglich der Behandlung abgerechnet werden können, den Stundensatz überschreiten, wird dies auf der Rechnung folgend ausgewiesen: \u201EDifferenzbetrag zwischen Gebührenverzeichnis und dem Patientenvertrag\u201C.',
                        "The practice charges at the maximum GebÜH rate. Should the billable GebÜH positions exceed the hourly rate, this is shown on the invoice as: 'Difference between fee schedule and patient contract'."
                      )}
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      to="/gebueh"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t(
                        "Zur vollständigen GebÜH-Übersicht",
                        "View full GebÜH overview"
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preisliste */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-serif">
                  {t("Aktuelle Preise", "Current Pricing")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Leistung", "Service")}</TableHead>
                        <TableHead className="text-right">{t("Preis", "Price")}</TableHead>
                        <TableHead>{t("Hinweis", "Note")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricing?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {language === "de" ? item.label_de : item.label_en}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {language === "de" ? item.price_text_de : item.price_text_en}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {language === "de" ? item.note_de : item.note_en}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zahlungspflicht */}
          <Card className="border-destructive/20 bg-destructive/5 shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">
                    {t("Zahlungspflicht", "Payment Obligation")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(
                      "Unabhängig von einer abweichenden Beurteilung der medizinischen Notwendigkeit, einer medizinisch-wissenschaftlichen Anerkennung der durchgeführten Therapien und Diagnostik, oder einer abweichenden Erstattung Ihrer Versicherung, ist der Rechnungsbetrag in voller Höhe zu zahlen.",
                      "Regardless of any differing assessment of medical necessity, medical-scientific recognition of the therapies and diagnostics performed, or differing reimbursement from your insurance, the invoice amount must be paid in full."
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terminregelung */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    {t("Terminvereinbarung & Absageregelung", "Appointments & Cancellation Policy")}
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      {t(
                        "Vereinbarte Termine sind ausschließlich für den jeweiligen Patienten reserviert. Da es seitens des Therapeuten einer gründlichen Vorbereitung bedarf und es sich um eine reine Bestellpraxis handelt, müssen Termine mindestens 48 Stunden vor dem vereinbarten Termin abgesagt werden.",
                        "Scheduled appointments are exclusively reserved for the respective patient. As the therapist requires thorough preparation and this is an appointment-only practice, appointments must be cancelled at least 48 hours in advance."
                      )}
                    </p>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>
                        {t(
                          "Für nicht rechtzeitig abgesagte Termine wird eine Ausfallentschädigung in voller Höhe des Stundensatzes berechnet.",
                          "Appointments not cancelled in time will be charged a cancellation fee at the full hourly rate."
                        )}
                      </li>
                      <li>
                        {t(
                          "Bei Verspätungen über 15 Minuten ist eine Verlängerung der Sitzungszeit oder Erstattung nicht genutzter Zeit nicht möglich.",
                          "For delays exceeding 15 minutes, an extension of session time or refund of unused time is not possible."
                        )}
                      </li>
                      <li>
                        {t(
                          "Bei Verspätungen über 30 Minuten kann der Therapeut den Termin ablehnen. Auch hier wird eine Ausfallentschädigung fällig.",
                          "For delays exceeding 30 minutes, the therapist may decline the appointment. A cancellation fee also applies in this case."
                        )}
                      </li>
                      <li>
                        {t(
                          "Der Therapeut behält sich das Recht vor, eine Sitzung abzubrechen, sofern die Mitwirkung des Patienten nicht gegeben ist. In diesem Fall ist das gesamte Honorar fällig.",
                          "The therapist reserves the right to terminate a session if the patient does not cooperate. In this case, the full fee is due."
                        )}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verhinderung des Therapeuten */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Ban className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">
                    {t("Verhinderung des Therapeuten", "Therapist Unavailability")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(
                      "Sollte der Therapeut verhindert sein, die Leistungen zum vereinbarten Termin zu erbringen, kann er für evtl. entstandene Kosten nicht haftbar gemacht werden, es sei denn, die Verhinderung beruht auf Vorsatz oder grober Fahrlässigkeit. Im Falle einer Verhinderung kann ein Ersatztermin vereinbart werden. Der Therapeut kann naturgemäß keine Garantien für Behandlungserfolge gewähren.",
                      "Should the therapist be unable to provide services at the agreed appointment, they cannot be held liable for any costs incurred, unless the unavailability is due to intent or gross negligence. A replacement appointment can be arranged. The therapist cannot naturally guarantee treatment outcomes."
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datenschutz-Verweis */}
          <Card className="border-primary/20 bg-sage-50 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="mb-2 font-serif text-lg font-medium text-foreground">
                    {t("Datenschutz", "Data Protection")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(
                      "Informationen zum Schutz Ihrer persönlichen Daten gemäß DSGVO finden Sie in unserer Datenschutzverordnung.",
                      "Information about the protection of your personal data according to GDPR can be found in our Privacy Policy."
                    )}
                  </p>
                  <Link
                    to="/datenschutz"
                    className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("Zur Datenschutzverordnung", "View Privacy Policy")}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stand */}
          <p className="text-center text-sm text-muted-foreground">
            {t("Stand: Februar 2026", "Last updated: February 2026")}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Patientenaufklaerung;
