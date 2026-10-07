import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import draftHtml from "../../website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html?raw";

const ROUTE = "/krankheit-ist-messbar.html";

/** Static, script-free rendering: removes scripts/handlers and shows all Reveal slides stacked. */
export function toStaticPreview(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, meta[http-equiv]").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll("img[src^='bilder/']").forEach((img) => img.setAttribute("src", `/${img.getAttribute("src")}`));
  const base = doc.createElement("base");
  base.href = `${window.location.origin}/`;
  doc.head.prepend(base);
  const style = doc.createElement("style");
  style.textContent = `
    html, body { overflow: auto !important; height: auto !important; }
    .reveal, .reveal .slides { position: static !important; height: auto !important; width: auto !important; transform: none !important; overflow: visible !important; }
    .reveal .slides > section, .reveal .slides > section > section {
      display: block !important; position: relative !important; top: auto !important; left: auto !important;
      opacity: 1 !important; visibility: visible !important; transform: none !important; height: auto !important;
      width: auto !important; min-height: 0 !important; margin: 0 0 24px !important; padding: 24px !important;
      border-bottom: 2px dashed #b7c3ae;
    }
    .reveal .controls, .reveal .progress, .protected-overlay { display: none !important; }
    img { max-width: 100%; height: auto; }`;
  doc.head.appendChild(style);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function Pane({ label, html, error }: { label: string; html?: string; error?: string }) {
  return (
    <section className="flex min-h-0 flex-col rounded-md border border-border bg-card">
      <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">{label}</h2>
      {error ? (
        <p className="p-4 text-sm text-destructive">{error}</p>
      ) : html ? (
        <iframe title={label} srcDoc={html} sandbox="" referrerPolicy="no-referrer" className="h-[75vh] w-full flex-1 border-0 bg-background" />
      ) : (
        <Skeleton className="m-3 h-[70vh]" />
      )}
    </section>
  );
}

export default function InfothekHtmlVergleich() {
  const { user, loading, isAdmin, roleChecked } = useAuth();
  const [original, setOriginal] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    (async () => {
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = { Accept: "text/html", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-infothek-html?path=${encodeURIComponent(ROUTE)}`,
          { headers, signal: controller.signal },
        );
        if (!res.ok) return setError(`Original nicht verfügbar (Status ${res.status}).`);
        setOriginal(toStaticPreview(await res.text()));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Original konnte nicht geladen werden.");
      }
    })();
    return () => controller.abort();
  }, [isAdmin]);

  if (loading || (user && !roleChecked)) return <div className="container py-12"><Skeleton className="h-96 w-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <SEOHead title="HTML-Vergleich (Entwurf)" noIndex />
      <div className="container py-6">
        <h1 className="font-serif text-2xl font-semibold">HTML-Vergleich: Frequenztherapie („Krankheit ist messbar“)</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Redaktioneller Entwurf zur gemeinsamen Prüfung – nicht veröffentlicht, keine Inhalts- oder Rechtsfreigabe. Statische Ansicht ohne Artikel-Skripte.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Pane label="Original (aktuell ausgeliefert)" html={original} error={error} />
          <Pane label="Vorgeschlagener Entwurf" html={toStaticPreview(draftHtml)} />
        </div>
      </div>
    </Layout>
  );
}
