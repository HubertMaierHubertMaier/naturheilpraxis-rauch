import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Download, FileText, Loader2, Music, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/seo/SEOHead";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  file_path: string;
  file_type: string;
  file_size: number;
  tags: string[];
}

const BUCKET = "patient-library";

const PatientenBibliothek = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_verified_patient")
        .eq("user_id", user.id)
        .maybeSingle();
      const isVerified = !!profile?.is_verified_patient;
      setVerified(isVerified);

      if (isVerified) {
        const { data, error } = await supabase
          .from("patient_resources")
          .select("*")
          .eq("is_published", true)
          .order("category")
          .order("sort_order")
          .order("title");
        if (error) toast.error("Fehler beim Laden");
        else setResources(data || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [resources, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of filtered) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "de"));
  }, [filtered]);

  const download = async (r: Resource) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.file_path, 300);
    if (error || !data) {
      toast.error("Download nicht möglich");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (b: number) => {
    if (!b) return "";
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Layout>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <SEOHead
        title="Patienten-Bibliothek · Naturheilpraxis Peter Rauch"
        description="Geschützter Bereich mit Skripten, Selbsthypnose-Audios und Materialien für verifizierte Patientinnen und Patienten."
      />
      <div className="bg-sage-50 py-8 md:py-12">
        <div className="container">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
                Patienten-Bibliothek
              </h1>
              <p className="text-muted-foreground">
                Skripte, Selbsthypnose-Audios und Begleitmaterialien — nur für Sie.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 max-w-5xl">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : !verified ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-8 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-3" />
              <h2 className="font-semibold mb-2">Nur für verifizierte Patientinnen und Patienten</h2>
              <p className="text-muted-foreground mb-4">
                Diese Materialien sind ausschließlich nach persönlicher Erstvorstellung in der Praxis verfügbar.
                Bitte vereinbaren Sie ein Vorgespräch — danach wird Ihr Zugang freigeschaltet.
              </p>
              <Button onClick={() => navigate("/dashboard")}>Zum Patienten-Dashboard</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen nach Titel, Kategorie, Tag…"
                className="pl-9"
              />
            </div>

            {grouped.length === 0 ? (
              <p className="text-muted-foreground">Aktuell sind keine Materialien hinterlegt.</p>
            ) : (
              <div className="space-y-8">
                {grouped.map(([category, items]) => (
                  <section key={category}>
                    <h2 className="font-serif text-xl font-semibold mb-3">{category}</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                      {items.map((r) => (
                        <Card key={r.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-start gap-2 text-base">
                              {r.file_type === "mp3" ? (
                                <Music className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              ) : (
                                <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              )}
                              <span className="flex-1">{r.title}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {r.description && (
                              <p className="text-sm text-muted-foreground">{r.description}</p>
                            )}
                            {r.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {r.tags.map((t) => (
                                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{formatSize(r.file_size)}</span>
                              <Button size="sm" onClick={() => download(r)} className="gap-2">
                                <Download className="h-4 w-4" />
                                Öffnen
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-8 italic">
              Hinweis: Diese Materialien sind ausschließlich für Ihre persönliche Verwendung bestimmt.
              Eine Weitergabe an Dritte ist nicht gestattet.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
};

export default PatientenBibliothek;
