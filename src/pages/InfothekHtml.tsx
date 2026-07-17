import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; html: string }
  | { status: "error"; code: number };

export default function InfothekHtml({ routePath, title }: { routePath: string; title: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setState({ status: "loading" });
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        Accept: "text/html",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (data.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-infothek-html?path=${encodeURIComponent(routePath)}`,
          { headers, signal: controller.signal },
        );
        if (!response.ok) {
          setState({ status: "error", code: response.status });
          return;
        }
        setState({ status: "ready", html: await response.text() });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setState({ status: "error", code: 0 });
        }
      }
    };

    load();
    return () => controller.abort();
  }, [routePath]);

  return (
    <Layout>
      <SEOHead title={title} noIndex />
      {state.status === "loading" ? (
        <div className="flex min-h-[60vh] items-center justify-center" role="status">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Beitrag wird geladen</span>
        </div>
      ) : state.status === "ready" ? (
        <iframe
          className="block min-h-[calc(100vh-5rem)] w-full border-0 bg-background"
          srcDoc={state.html}
          title={title}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="container flex min-h-[60vh] max-w-xl items-center justify-center py-12 text-center">
          <div>
            <AlertTriangle className="mx-auto mb-4 h-9 w-9 text-amber-600" aria-hidden="true" />
            <h1 className="mb-3 font-serif text-2xl font-semibold">Beitrag nicht verfügbar</h1>
            <p className="mb-6 text-muted-foreground">
              {state.code === 401
                ? "Bitte melden Sie sich an, um diesen Beitrag zu öffnen."
                : state.code === 403
                  ? "Dieser Beitrag ist für Ihr Konto noch nicht freigeschaltet."
                  : "Der Beitrag konnte momentan nicht sicher geladen werden. Bitte versuchen Sie es später erneut."}
            </p>
            <div className="flex justify-center gap-3">
              {state.code === 401 && (
                <Button asChild>
                  <Link to={`/auth?redirect=${encodeURIComponent(routePath)}`}>Zur Anmeldung</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/infothek">Zurück zur Infothek</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
