import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Euro, Info, FileText, HelpCircle, ExternalLink } from "lucide-react";
import { useContentProtection } from "@/hooks/useContentProtection";

const beispielLeistungen = [
  { ziffer: "1", beschreibung: "Beratung", betrag: "8,74" },
  { ziffer: "4", beschreibung: "Eingehende Beratung (mind. 15 Min.)", betrag: "17,49" },
  { ziffer: "5", beschreibung: "Untersuchung", betrag: "12,24" },
  { ziffer: "6", beschreibung: "Eingehende Untersuchung", betrag: "21,43" },
  { ziffer: "11", beschreibung: "Akupunktur", betrag: "17,49" },
  { ziffer: "21.1", beschreibung: "Infusion intravenös", betrag: "8,74" },
  { ziffer: "25", beschreibung: "Neuraltherapie", betrag: "14,57" },
];

const Gebueh = () => {
  useContentProtection();
  return (
    <Layout>
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              GebÜH – Gebührenordnung für Heilpraktiker
            </h1>
            <p className="text-lg text-muted-foreground">
              Transparente Informationen zu den Behandlungskosten
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Was ist die GebÜH */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Euro className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    Was ist die GebÜH?
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Die <strong>Gebührenordnung für Heilpraktiker (GebÜH)</strong> ist ein Verzeichnis,
                    das die üblichen Vergütungen für heilpraktische Leistungen enthält. Sie dient als
                    Orientierung für Patienten und Kostenträger und sorgt für Transparenz bei der Abrechnung.
                  </p>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    Anders als bei Ärzten, die nach der GOÄ (Gebührenordnung für Ärzte) abrechnen,
                    ist die GebÜH keine gesetzlich verbindliche Vorschrift, wird aber von den meisten
                    Heilpraktikern als Grundlage für ihre Rechnungen verwendet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beispiele */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-serif">Beispiele aus der GebÜH (Stand: 2002)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Die folgenden Beträge sind <strong>unverbindliche Beispiele</strong> aus dem 
                Gebührenverzeichnis für Heilpraktiker. Die tatsächlichen Kosten können je nach 
                Aufwand, Zeitdauer und individueller Behandlung variieren.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Ziffer</TableHead>
                      <TableHead>Leistungsbeschreibung</TableHead>
                      <TableHead className="text-right">Betrag (€)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {beispielLeistungen.map((leistung) => (
                      <TableRow key={leistung.ziffer}>
                        <TableCell className="font-medium">{leistung.ziffer}</TableCell>
                        <TableCell>{leistung.beschreibung}</TableCell>
                        <TableCell className="text-right">{leistung.betrag}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <a 
                  href="https://www.heilpraktiker.org/gebuehrenverzeichnis-fuer-heilpraktiker" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Offizielles Gebührenverzeichnis beim Berufsverband (BDH)
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Kostenübernahme */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <Info className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">
                  Private Krankenversicherung
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Private Krankenversicherungen und Beihilfestellen übernehmen in der Regel
                  die Kosten für Heilpraktikerbehandlungen, oft bis zu den Höchstsätzen der GebÜH.
                  Prüfen Sie Ihren Versicherungsvertrag oder fragen Sie bei Ihrer Versicherung nach.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/20">
                  <HelpCircle className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">
                  Gesetzliche Krankenversicherung
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Die gesetzlichen Krankenkassen übernehmen grundsätzlich keine Kosten für
                  Heilpraktikerbehandlungen. Eine Heilpraktiker-Zusatzversicherung kann hier
                  eine sinnvolle Ergänzung sein.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Hinweis */}
          <Card className="border-sage-200 bg-sage-50 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="mb-2 font-serif text-lg font-medium text-foreground">
                    Wichtiger Hinweis
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Bitte klären Sie vor Behandlungsbeginn mit Ihrer Krankenversicherung, ob und 
                    in welchem Umfang Heilpraktikerleistungen erstattet werden.
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

export default Gebueh;
