import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useInfothekGating } from "@/hooks/useInfothekGating";
import { usePatientAccess } from "@/hooks/usePatientAccess";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

/**
 * Route-Wrapper für Infothek-Artikel: erzwingt die in der Admin-Oberfläche
 * gesetzte Sichtbarkeit (`public` / `new_patient` / `patient`) auch dann,
 * wenn der Artikel direkt per URL aufgerufen wird. Ohne diesen Wrapper
 * blieben gegated Seiten weiterhin öffentlich erreichbar.
 */
export default function InfothekGateRoute({
  children,
  defaultGated = false,
  contentPath,
}: {
  children: ReactNode;
  defaultGated?: boolean;
  contentPath?: string;
}) {
  const location = useLocation();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { getVisibility, loading: gatingLoading } = useInfothekGating();
  const { canSeeInfothekItem, loading: accessLoading } = usePatientAccess();
  const gatingPath = contentPath ?? location.pathname;
  const vis = getVisibility(gatingPath, defaultGated);
  useNoIndex(gatingLoading || vis !== "public");

  if (authLoading || gatingLoading || accessLoading) {
    return (
      <Layout>
        <div className="container py-24 text-center text-muted-foreground">
          Lade …
        </div>
      </Layout>
    );
  }

  // Admins dürfen immer alles sehen (Vorschau-/Pflege-Zwecke)
  if (isAdmin) return <>{children}</>;

  if (vis === "public") return <>{children}</>;

  if (vis === "new_patient") {
    if (user) return <>{children}</>;
    return (
      <Layout>
        <div className="container max-w-xl py-24 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-100">
            <LogIn className="h-5 w-5 text-primary" />
          </div>
          <h1 className="mb-3 font-serif text-2xl font-semibold">
            Anmeldung erforderlich
          </h1>
          <p className="mb-6 text-muted-foreground">
            Dieser Beitrag ist für angemeldete Nutzerinnen und Nutzer
            reserviert. Bitte melde dich an oder registriere dich kurz – die
            Inhalte stehen dir danach sofort zur Verfügung.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link to={`/auth?redirect=${encodeURIComponent(location.pathname)}`}>
                Zur Anmeldung
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/infothek">Zurück zur Infothek</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // vis === "patient" → nur freigeschaltete Patienten
  if (user && canSeeInfothekItem(gatingPath)) {
    return <>{children}</>;
  }

  return (
    <Layout>
      <div className="container max-w-xl py-24 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-100">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <h1 className="mb-3 font-serif text-2xl font-semibold">
          Nur für freigeschaltete Patienten
        </h1>
        <p className="mb-6 text-muted-foreground">
          Dieser Beitrag wird nach telefonischer Rücksprache individuell
          freigeschaltet. Bitte sprich Peter Rauch an, wenn du Zugang
          benötigst.
        </p>
        <div className="flex justify-center gap-3">
          {!user && (
            <Button asChild>
              <Link to={`/auth?redirect=${encodeURIComponent(location.pathname)}`}>
                Anmelden
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/infothek">Zurück zur Infothek</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
