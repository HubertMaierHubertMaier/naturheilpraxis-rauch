import { useNavigate } from "react-router-dom";
import { UserPlus, User, Eye, ArrowRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  {
    id: "new_patient",
    icon: UserPlus,
    title: "Ich bin Neupatient",
    subtitle: "Erstkontakt in 3 Schritten",
    description:
      "Lade Anamnesebogen, Patientenvertrag und Datenschutz-Einwilligung als Komplettpaket herunter — oder fülle online aus. Ein klarer Fahrplan zum ersten Termin.",
    cta: "Zum Neupatienten-Fahrplan",
    href: "/neupatient",
    accent: true,
  },
  {
    id: "existing_patient",
    icon: User,
    title: "Ich bin schon Patient",
    subtitle: "Zugang für bestehende Patienten",
    description:
      "Sie waren bereits in der Praxis? Registrieren oder melden Sie sich an, um Zugriff auf alle Inhalte und Ihre Dokumente zu erhalten.",
    cta: "Anmelden / Registrieren",
    href: "/auth?type=existing_patient",
    accent: false,
  },
  {
    id: "visitor",
    icon: Eye,
    title: "Ich möchte mich informieren",
    subtitle: "Für Besucher & Interessierte",
    description:
      "Erfahren Sie mehr über die Naturheilpraxis, Behandlungsmethoden und lesen Sie ausgewählte Fachartikel — ohne Registrierung.",
    cta: "Praxis entdecken",
    href: "/infothek",
    accent: false,
  },
];

export function WelcomeSelection() {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-4xl">
            Herzlich Willkommen
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Wie können wir Ihnen weiterhelfen?
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => navigate(option.href)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                option.accent
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : "bg-card shadow-card hover:shadow-elevated"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
                  option.accent ? "bg-sage-600" : "bg-sage-100"
                )}
              >
                <option.icon
                  className={cn(
                    "h-8 w-8",
                    option.accent ? "text-primary-foreground" : "text-primary"
                  )}
                />
              </div>

              {/* Title */}
              <h3
                className={cn(
                  "mb-1 font-serif text-xl font-semibold",
                  option.accent ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {option.title}
              </h3>

              {/* Subtitle */}
              <p
                className={cn(
                  "mb-4 text-sm font-medium",
                  option.accent ? "text-sage-200" : "text-primary"
                )}
              >
                {option.subtitle}
              </p>

              {/* Description */}
              <p
                className={cn(
                  "mb-6 flex-1 text-sm leading-relaxed",
                  option.accent ? "text-sage-100" : "text-muted-foreground"
                )}
              >
                {option.description}
              </p>

              {/* CTA */}
              <div
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-semibold transition-transform duration-300 group-hover:translate-x-1",
                  option.accent ? "text-sage-200" : "text-primary"
                )}
              >
                {option.cta}
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>

        {/* Phone hint */}
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-sage-100 px-6 py-3 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 text-primary" />
            <span>
              Fragen? Rufen Sie uns gerne an:{" "}
              <a
                href="tel:08212621462"
                className="font-semibold text-primary hover:underline"
              >
                0821-2621462
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
