import { Link } from "react-router-dom";
import { Leaf, Phone, Mail, MapPin, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg font-semibold text-foreground">
                  Naturheilpraxis
                </span>
                <span className="text-xs text-muted-foreground">Peter Rauch</span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">
              Ganzheitliche Naturheilkunde für Ihre Gesundheit und Ihr Wohlbefinden.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-medium text-foreground">Navigation</h3>
            <nav className="flex flex-col gap-2">
              <Link to="/neupatient" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Neupatient
              </Link>
              <Link to="/heilpraktiker" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Was ist ein Heilpraktiker?
              </Link>
              <Link to="/gebueh" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                GebÜH
              </Link>
              <Link to="/ernaehrung" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Ernährungsratschläge
              </Link>
              <Link to="/faq" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                FAQ
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-medium text-foreground">Kontakt</h3>
            <div className="flex flex-col gap-3">
              <a href="tel:08212621462" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <Phone className="h-4 w-4" />
                <span>0821-2621462</span>
              </a>
              <a href="mailto:praxis_rauch@icloud.com" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <Mail className="h-4 w-4" />
                <span>praxis_rauch@icloud.com</span>
              </a>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Friedrich-Deffner-Straße 19a, 86163 Augsburg</span>
              </div>
            </div>
          </div>

          {/* Website */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-medium text-foreground">Website</h3>
            <a
              href="https://www.rauch-heilpraktiker.de"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
              www.rauch-heilpraktiker.de
            </a>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Naturheilpraxis Peter Rauch. Alle Rechte vorbehalten.
          </p>
          <div className="flex gap-4">
            <Link to="/impressum" className="text-xs text-muted-foreground hover:text-primary">
              Impressum
            </Link>
            <Link to="/datenschutz" className="text-xs text-muted-foreground hover:text-primary">
              Datenschutz
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
