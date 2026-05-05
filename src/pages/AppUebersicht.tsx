import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";

type Access = "public" | "user" | "admin";

const colorMap: Record<Access, { dot: string; label: string; bg: string; border: string }> = {
  public: {
    dot: "bg-green-500",
    label: "Öffentlich (ohne Login)",
    bg: "bg-green-50",
    border: "border-green-300",
  },
  user: {
    dot: "bg-blue-500",
    label: "Eingeloggte Patienten",
    bg: "bg-blue-50",
    border: "border-blue-300",
  },
  admin: {
    dot: "bg-red-500",
    label: "Nur Admin",
    bg: "bg-red-50",
    border: "border-red-300",
  },
};

interface ButtonRow {
  name: string;
  path: string;
  access: Access;
  description: string;
  location: string;
}

const buttons: ButtonRow[] = [
  // Public
  { name: "Startseite", path: "/", access: "public", description: "Hauptseite der Praxis mit Übersicht & Einstieg.", location: "Header-Logo" },
  { name: "Infothek", path: "/infothek", access: "public", description: "Öffentliches Wissensportal (HWG/UWG-konform, ohne Dosierungen).", location: "Header (Dropdown)" },
  { name: "Heilpraktiker", path: "/heilpraktiker", access: "public", description: "Berufsprofil und Methoden von Peter Rauch.", location: "Infothek-Dropdown" },
  { name: "Praxis-Info", path: "/praxis-info", access: "public", description: "Öffnungszeiten, Termine, Stornoregeln (48h).", location: "Infothek-Dropdown" },
  { name: "FAQ", path: "/faq", access: "public", description: "Häufige Fragen zur Praxis.", location: "Infothek-Dropdown" },
  { name: "Gebühren", path: "/gebueh", access: "public", description: "Aktuelle Honorarübersicht.", location: "Infothek-Dropdown" },
  { name: "Datenschutz", path: "/datenschutz", access: "public", description: "DSGVO-Datenschutzerklärung.", location: "Footer" },
  { name: "Impressum", path: "/impressum", access: "public", description: "Pflichtangaben § 5 TMG.", location: "Footer" },
  { name: "Patientenaufklärung", path: "/patientenaufklaerung", access: "public", description: "Aufklärung & Preisinformationen vor Erstkontakt.", location: "Footer" },
  { name: "Quellenhinweis", path: "/quellenhinweis", access: "public", description: "Quellen- und Bildnachweise.", location: "Footer" },
  { name: "Anmelden / Login", path: "/auth", access: "public", description: "Login & Registrierung mit verpflichtender 2FA.", location: "Header rechts" },

  // Logged-in patients
  { name: "Erstanmeldung", path: "/erstanmeldung", access: "user", description: "Onboarding-Wizard für neue Patienten (Telefonat-Pflicht).", location: "Nach Registrierung" },
  { name: "Anamnesebogen", path: "/anamnesebogen", access: "user", description: "Digitaler Anamnesebogen (25 Sektionen, OTP-Versand).", location: "Patienten-Dashboard" },
  { name: "Patienten-Dashboard", path: "/dashboard", access: "user", description: "Zentrale für verifizierte Patienten: Anamnesen-Historie, PDFs.", location: "Header (nach Login)" },
  { name: "Patienten-Bibliothek", path: "/patienten-bibliothek", access: "user", description: "Geschützte PDF/MP3-Sammlung (z. B. Hypnose-Skripte) – nur verifizierte Patienten.", location: "Header / Dashboard" },

  // Admin only
  { name: "Admin-Dashboard", path: "/admin", access: "admin", description: "Verwaltung: FAQs, Praxisinfos, Preise, Patienten, Bibliothek-Upload.", location: "Header (Admin)" },
  { name: "Patienten-Verwaltung", path: "/patienten", access: "admin", description: "Tabellarische Verwaltung, manuelle Verifikation, E-Mail-Resend.", location: "Header (Admin)" },
  { name: "Wiki / Wissensdatenbank", path: "/wissensdatenbank", access: "admin", description: "Internes Wiki mit Dosierungen, Pathogen-Nomenklatur, Therapieprotokollen.", location: "Header (Admin)" },
  { name: "Bibliothek (Verwaltung)", path: "/patienten-bibliothek", access: "admin", description: "Upload und Sichtbarkeit der Patienten-PDFs/MP3s steuern (Tab im Admin).", location: "Admin → Tab Bibliothek" },
  { name: "Datensicherheit", path: "/datenschutz-fahrplan.html", access: "admin", description: "Interner DSGVO/Sicherheits-Fahrplan.", location: "Header (Admin)" },
  { name: "Übersicht der APP", path: "/app-uebersicht", access: "admin", description: "Diese Seite – Übersicht aller Buttons mit Zugriffsfarben.", location: "Header (Admin)" },
  { name: "Anamnesebogen-Demo", path: "/anamnesebogen-demo", access: "admin", description: "Test-Route für Submission-Flow.", location: "Direkter Link" },
];

export default function AppUebersicht() {
  const grouped: Record<Access, ButtonRow[]> = {
    public: buttons.filter((b) => b.access === "public"),
    user: buttons.filter((b) => b.access === "user"),
    admin: buttons.filter((b) => b.access === "admin"),
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl py-8">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Übersicht der APP</h1>
        <p className="mt-2 text-muted-foreground">
          Alle Buttons & Seiten mit Zugriffsstufen. Die gleichen Farben markieren auch die
          Buttons in der Oberfläche (kleiner farbiger Punkt).
        </p>

        {/* Legend */}
        <Card className="mt-6 p-4">
          <h2 className="mb-3 font-medium">Legende</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["public", "user", "admin"] as Access[]).map((a) => (
              <div key={a} className={`flex items-center gap-2 rounded-md border p-3 ${colorMap[a].bg} ${colorMap[a].border}`}>
                <span className={`h-3 w-3 rounded-full ${colorMap[a].dot}`} />
                <span className="text-sm font-medium">{colorMap[a].label}</span>
              </div>
            ))}
          </div>
        </Card>

        {(["public", "user", "admin"] as Access[]).map((a) => (
          <section key={a} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
              <span className={`h-3 w-3 rounded-full ${colorMap[a].dot}`} />
              {colorMap[a].label}
            </h2>
            <div className="grid gap-3">
              {grouped[a].map((b) => (
                <Card key={b.name + b.path} className={`border-l-4 p-4 ${colorMap[a].border}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium text-foreground">{b.name}</h3>
                    <code className="text-xs text-muted-foreground">{b.path}</code>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">📍 {b.location}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
