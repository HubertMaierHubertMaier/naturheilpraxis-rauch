import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope, BookOpen, Heart, Shield, Scale, Leaf, GraduationCap, FileCheck, Users } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";

const Heilpraktiker = () => {
  useContentProtection();
  return (
    <Layout>
      <SEOHead
        title="Was ist ein Heilpraktiker?"
        description="Heilpraktiker in Deutschland: Staatlich geprüfte Fachkräfte für Naturheilkunde, Irisdiagnose, Darmsanierung und ganzheitliche Therapien. Erfahren Sie mehr über Ausbildung, Berufsbild und Behandlungsmethoden."
      />
      <div className="bg-sage-50 py-12 md:py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              Was ist ein Heilpraktiker?
            </h1>
            <p className="text-lg text-muted-foreground">
              Staatlich geprüfte Fachkräfte für Naturheilkunde und Alternativmedizin in Deutschland mit eigener, klar geregelter Berufsbefugnis
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          {/* Was jeder Patient wissen sollte */}
          <Card className="mb-8 shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    Was jeder Patient wissen sollte
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Heilpraktiker behandeln Beschwerden mit Methoden wie Homöopathie, Akupunktur oder 
                    Phytotherapie, basierend auf jahrhundertealter Erfahrungsheilkunde. Sie dürfen keine 
                    verschreibungspflichtigen Medikamente einsetzen und verweisen bei akuten Gefahren 
                    oder Grenzen immer an Ärzte.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Jeder Heilpraktiker hat eine strenge Prüfung beim Gesundheitsamt bestanden 
                    (Mindestalter 25, Kenntnisse in Anatomie, Pathologie, Hygiene, Diagnostik und Notfallmaßnahmen).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Qualifikation und Rechtssicherheit */}
          <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground text-center">
            Qualifikation und Rechtssicherheit
          </h2>
          
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">Ausbildung</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Intensive Vorbereitung über 2–4 Jahre an Heilpraktikerschulen mit Vorlesungen, 
                  Praktika und Fokus auf medizinische Grundlagen plus Naturheilverfahren; 
                  abschließend die Amtszulassung.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">Zulassung</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Offizielle Erlaubnis „zur Ausübung der Heilkunde ohne Bestallung" vom Gesundheitsamt – 
                  wie bei Peter Rauch in Augsburg, inklusive Nachweis über Intensiv-Ausbildung.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/20">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">Pflichten</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gleiche Sorgfaltspflicht wie Hausärzte, lückenlose Dokumentation, 
                  Berufshaftpflichtversicherung.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Vertrauen in den Beruf */}
          <Card className="mb-8 shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    Vertrauen in den Beruf
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Millionen Patienten wählen Heilpraktiker jährlich für effektive, sanfte Ansätze. 
                    Der Beruf steht seit über 70 Jahren auf solidem rechtlichen Fundament 
                    (HeilprG 1939, reformiert 2016), bestätigt durch aktuelle Gutachten ohne grundlegende Änderungen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ganzheitlicher Ansatz */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">Ganzheitlicher Ansatz</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Im Mittelpunkt steht der Mensch als Ganzes – nicht nur einzelne Symptome.
                  Körper, Geist und Seele werden als Einheit betrachtet, um die Ursachen
                  von Beschwerden zu finden und zu behandeln.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-medium text-foreground">Komplementär zur Schulmedizin</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Naturheilkunde ersetzt keine ärztliche Behandlung, sondern ergänzt sie.
                  Bei schweren Erkrankungen arbeiten Heilpraktiker oft Hand in Hand
                  mit Ärzten zusammen.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Behandlungsmethoden */}
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100">
                  <Leaf className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="mb-4 font-serif text-2xl font-semibold text-foreground">
                    Behandlungsmethoden
                  </h2>
                  <p className="mb-4 text-muted-foreground leading-relaxed">
                    Heilpraktiker arbeiten mit einer Vielzahl natürlicher Therapieverfahren:
                  </p>
                  <ul className="grid gap-2 text-muted-foreground md:grid-cols-2">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Phytotherapie (Pflanzenheilkunde)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Homöopathie
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Akupunktur
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Schröpfen
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Ausleitungsverfahren
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Ernährungsberatung
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Manuelle Therapien
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Entspannungsverfahren
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Heilpraktiker;
