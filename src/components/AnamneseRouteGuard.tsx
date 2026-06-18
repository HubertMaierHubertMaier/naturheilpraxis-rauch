import React from "react";
import { Link } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAnamneseOnlineEnabled } from "@/hooks/useAnamneseOnlineEnabled";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileDown, Loader2 } from "lucide-react";

/**
 * Wrapper für `/anamnesebogen` (Online-Formular):
 * 1. Login zwingend (ProtectedRoute).
 * 2. Datenschutz-Kill-Switch `anamnese_online_enabled` muss true sein.
 *    Default = false → Patienten sehen Sperrseite mit PDF-Download-Hinweis.
 * 3. Admins kommen immer durch (Test & Wartung).
 */
const OnlineLockedNotice: React.FC = () => (
  <div className="container mx-auto max-w-2xl px-4 py-16">
    <Card className="border-red-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <ShieldCheck className="h-6 w-6" />
          Online-Anamnese vorübergehend deaktiviert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p>
          Aus Datenschutzgründen nehmen wir aktuell <strong>keine Anamnesedaten online</strong>
          entgegen. Das Online-Formular ist gesperrt, bis die DSGVO-konforme Verarbeitung
          besonders sensibler Gesundheitsdaten (Art. 9 DSGVO) endgültig geklärt ist.
        </p>
        <p>
          Bitte lade stattdessen den <strong>ausfüllbaren PDF-Anamnesebogen</strong> herunter,
          fülle ihn am eigenen Rechner aus und bringe ihn ausgedruckt zum Termin mit oder
          sende ihn auf einem sicheren Weg (Post, persönlich) an die Praxis.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link to="/neupatient">
              <FileDown className="mr-2 h-4 w-4" />
              Zum PDF-Download
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Zur Startseite</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

export const AnamneseRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute>
      <AnamneseGate>{children}</AnamneseGate>
    </ProtectedRoute>
  );
};

const AnamneseGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { enabled, loading } = useAnamneseOnlineEnabled();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();

  if (loading || adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enabled && !isAdmin) {
    return <OnlineLockedNotice />;
  }

  return <>{children}</>;
};

export default AnamneseRouteGuard;
