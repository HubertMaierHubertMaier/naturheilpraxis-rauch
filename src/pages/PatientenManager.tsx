import { Layout } from "@/components/layout/Layout";
import { PatientManager } from "@/components/admin/PatientManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { isDevAdminBypassActive } from "@/lib/devAdminBypass";

const PatientenManagerPage = () => {
  const { user, loading, isAdmin, roleChecked } = useAuth();

  const devBypass = isDevAdminBypassActive();

  const hasAccess = devBypass || isAdmin;

  if (loading || (user && !roleChecked && !devBypass)) {
    return (
      <Layout>
        <div className="container py-12">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div className="container py-12">
          <Card className="mx-auto max-w-lg border-destructive/50 bg-destructive/10">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold text-destructive mb-2">Zugriff verweigert</h2>
              <p className="text-muted-foreground">
                Sie haben keine Berechtigung, auf diese Seite zuzugreifen.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-sage-50 py-8 md:py-12">
        <div className="container">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
                Patientenübersicht
              </h1>
              <p className="text-muted-foreground">
                Alle registrierten Patienten mit personenbezogenen Daten
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="mx-auto max-w-6xl">
          <Card>
            <CardHeader>
              <CardTitle>Patientenübersicht</CardTitle>
              <CardDescription>
                Name, Adresse, Geburtsdatum, E-Mail, Erstanmeldung und Login-Häufigkeit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatientManager devBypass={devBypass} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default PatientenManagerPage;
