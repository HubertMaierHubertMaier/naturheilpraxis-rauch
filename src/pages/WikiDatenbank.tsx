import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Database, ExternalLink, Search, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface WikiEntry {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  content: string;
  updated_at: string;
  review_status?: string;
  evidence_level?: string;
  rights_status?: string;
  patient_facing_allowed?: boolean;
}

const metrics = [
  { value: "229", label: "Vertragstests bestanden" },
  { value: "12/12", label: "Quellen erreichbar" },
  { value: "0", label: "Produktmappings" },
  { value: "Read-only", label: "Betriebsmodus" },
];

function normalize(value: string) {
  return value.toLocaleLowerCase("de").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function formatDate(value: string) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "unbekannt";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

export default function WikiDatenbank() {
  const { user, loading: authLoading, isAdmin, roleChecked } = useAuth();
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const loadEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await supabase
          .from("admin_knowledge_base")
          .select("*")
          .order("updated_at", { ascending: false });
        if (result.error) throw result.error;
        if (active) setEntries((result.data as WikiEntry[]) || []);
      } catch (loadError) {
        if (active) {
          setEntries([]);
          setError(loadError instanceof Error ? loadError.message : "Die WikiDatenbank ist noch nicht verbunden.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadEntries();
    return () => { active = false; };
  }, [isAdmin]);

  if (authLoading || (user && !roleChecked)) {
    return (
      <Layout>
        <div className="container py-12">
          <Skeleton className="mb-6 h-12 w-72" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user && !isAdmin) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const query = normalize(search.trim());
  const filteredEntries = entries.filter((entry) => {
    if (!query) return true;
    const haystack = normalize([
      entry.title,
      entry.category,
      entry.content,
      ...(entry.tags || []),
    ].join(" "));
    return haystack.includes(query);
  });

  return (
    <Layout>
      <main className="container max-w-6xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/wissensdatenbank" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Alte Wiki unverändert öffnen
          </Link>
          <Badge variant="outline" className="gap-2 border-emerald-300 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Neue WikiDatenbank / Read-only
          </Badge>
        </div>

        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-sage-50 via-background to-background p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Parallel zur bisherigen Wiki</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold text-foreground md:text-4xl">WikiDatenbank</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Die neue Datenbankansicht wird getrennt von der alten Wiki betrieben. Sie ist zunächst bewusst schreibgeschützt: Einträge, Prüfstatus und Quellenkontext können geprüft werden, ohne bestehende Wiki-Inhalte zu verändern.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Technischer Status">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-5">
                <div className="text-2xl font-bold text-primary">{metric.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{metric.label}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Wissenseinträge durchsuchen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Titel, Kategorie, Tag oder Inhalt durchsuchen ..."
                className="pl-9"
                aria-label="WikiDatenbank durchsuchen"
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{loading ? "Einträge werden gelesen ..." : `${filteredEntries.length} von ${entries.length} Einträgen`}</span>
              <span>Keine Schreib- oder Löschaktionen in dieser Ansicht</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mt-6 border-amber-300 bg-amber-50/60">
            <CardContent className="p-5 text-sm text-amber-900">
              Die neue Ansicht ist technisch bereit, aber die autorisierte Datenbankverbindung ist noch nicht aktiv: {error}
            </CardContent>
          </Card>
        )}

        <section className="mt-6 space-y-4" aria-live="polite">
          {!loading && !error && filteredEntries.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Noch keine Einträge für diese Suche vorhanden.</CardContent></Card>
          )}
          {filteredEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{entry.category || "Allgemein"}</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{entry.title}</h2>
                  </div>
                  <Badge variant="secondary">Aktualisiert {formatDate(entry.updated_at)}</Badge>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry.content}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(entry.tags || []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                  {entry.review_status && <Badge variant="outline">Prüfung: {entry.review_status}</Badge>}
                  {entry.rights_status && <Badge variant="outline">Rechte: {entry.rights_status}</Badge>}
                  {entry.patient_facing_allowed === false && <Badge variant="outline">Nicht patientengerichtet</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Keine Live-Schreibvorgänge</span>
          <Link to="/wissensdatenbank" className="inline-flex items-center gap-1 hover:text-primary">Alte Wiki <ExternalLink className="h-3.5 w-3.5" /></Link>
        </footer>
      </main>
    </Layout>
  );
}
