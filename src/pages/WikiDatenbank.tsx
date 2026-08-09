import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Bug, Database, ExternalLink, Link2, Search, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PathogenIndex } from "@/components/admin/PathogenIndex";

interface WikiEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  updated_at: string;
  entry_kind: string;
  review_status: string;
  evidence_level: string;
  dosage_status: string;
  rights_status: string;
  source_citations: unknown;
  therapeutic_topics: string[];
  contraindications: string[];
  interaction_tags: string[];
  safety_notes: string;
  patient_facing_allowed: boolean;
}

interface SourceCitation {
  label: string;
  url: string;
}

interface KnowledgeProductLink {
  id: string;
  knowledge_entry_id: string;
  relation_type: string;
  clinical_topics: string[];
  confidence: number;
  safety_notes: string;
  review_status: string;
  admin_knowledge_base: { title: string } | null;
  mannayan_products: { name: string } | null;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("de").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function formatDate(value: string) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "unbekannt";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

function sourceCitations(value: unknown): SourceCitation[] {
  const citations = new Map<string, SourceCitation>();
  const visited = new Set<object>();
  const text = (candidate: unknown) => typeof candidate === "string" ? candidate.trim() : "";

  const visit = (candidate: unknown, depth = 0): void => {
    if (!candidate || depth > 5) return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof candidate !== "object" || visited.has(candidate)) return;
    visited.add(candidate);

    const record = candidate as Record<string, unknown>;
    const url = [record.url, record.source_url, record.manufacturerSource]
      .map(text)
      .find(Boolean);
    if (url) {
      const label = [record.label, record.title, record.publisher].map(text).find(Boolean) || url;
      citations.set(url, { url, label });
    }

    [
      record.source_citations,
      record.proposed_data,
      record.source_document,
      record.source_inventory,
      record.product,
    ].forEach((nested) => visit(nested, depth + 1));
  };

  visit(value);
  return [...citations.values()];
}

const relationLabels: Record<string, string> = {
  exact_product: "Exaktes Produkt",
  ingredient_match: "Inhaltsstoff-Bezug",
  topic_match: "Gesundheitsthema",
  alternative: "Alternative",
  do_not_combine: "Nicht kombinieren",
};

export default function WikiDatenbank() {
  const { user, loading: authLoading, isAdmin, roleChecked } = useAuth();
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [productLinks, setProductLinks] = useState<KnowledgeProductLink[]>([]);
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
        const [entryResult, linkResult] = await Promise.all([
          supabase
            .from("admin_knowledge_base")
            .select("*")
            .order("updated_at", { ascending: false }),
          supabase
            .from("knowledge_product_links")
            .select("id, knowledge_entry_id, relation_type, clinical_topics, confidence, safety_notes, review_status, admin_knowledge_base(title), mannayan_products(name)")
            .order("updated_at", { ascending: false }),
        ]);
        if (entryResult.error) throw entryResult.error;
        if (linkResult.error) throw linkResult.error;
        if (active) {
          setEntries((entryResult.data as WikiEntry[]) || []);
          setProductLinks((linkResult.data as unknown as KnowledgeProductLink[]) || []);
        }
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

  const sourceCount = entries.reduce((count, entry) => count + sourceCitations(entry.source_citations).length, 0);
  const metrics = [
    { value: loading ? "..." : String(entries.length), label: "Wiki-Eintraege" },
    { value: loading ? "..." : String(productLinks.length), label: "Mittelverknuepfungen" },
    { value: loading ? "..." : String(sourceCount), label: "Quellenbelege" },
    { value: "Read-only", label: "Betriebsmodus" },
  ];

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

        <Tabs defaultValue="entries" className="mt-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="entries" className="gap-2"><BookOpen className="h-4 w-4" /> Alle Wiki-Eintraege</TabsTrigger>
            <TabsTrigger value="pathogens" className="gap-2"><Bug className="h-4 w-4" /> Pathogene</TabsTrigger>
            <TabsTrigger value="links" className="gap-2"><Link2 className="h-4 w-4" /> Mittelverknuepfungen</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Vollstaendigen Wiki-Bestand durchsuchen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Mittel, Symptom, Erkrankung, Pathogen, Kategorie, Tag oder Inhalt durchsuchen ..."
                    className="pl-9"
                    aria-label="WikiDatenbank durchsuchen"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{loading ? "Eintraege werden gelesen ..." : `${filteredEntries.length} von ${entries.length} Eintraegen`}</span>
                  <span>Keine Schreib-, Loesch- oder Freigabeaktionen in dieser Ansicht</span>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border-amber-300 bg-amber-50/60">
                <CardContent className="p-5 text-sm text-amber-900">
                  Die neue Ansicht ist technisch bereit, aber die autorisierte Datenbankverbindung ist noch nicht aktiv: {error}
                </CardContent>
              </Card>
            )}

            <section className="space-y-4" aria-live="polite">
              {!loading && !error && filteredEntries.length === 0 && (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Noch keine Eintraege fuer diese Suche vorhanden.</CardContent></Card>
              )}
              {filteredEntries.map((entry) => {
                const sources = sourceCitations(entry.source_citations);
                return (
                  <Card key={entry.id}>
                    <CardContent className="p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{entry.category || "Allgemein"}</p>
                          <h2 className="mt-1 text-xl font-semibold text-foreground">{entry.title}</h2>
                        </div>
                        <Badge variant="secondary">Aktualisiert {formatDate(entry.updated_at)}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline">Art: {entry.entry_kind || "unbekannt"}</Badge>
                        <Badge variant="outline">Pruefung: {entry.review_status || "unbekannt"}</Badge>
                        <Badge variant="outline">Evidenz: {entry.evidence_level || "unbewertet"}</Badge>
                        <Badge variant="outline">Dosis: {entry.dosage_status || "unbekannt"}</Badge>
                        <Badge variant="outline">Rechte: {entry.rights_status || "unbekannt"}</Badge>
                        {entry.patient_facing_allowed === false && <Badge variant="outline">Nicht patientengerichtet</Badge>}
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry.content}</p>
                      {(entry.tags || []).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
                      {(entry.therapeutic_topics || []).length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Themen</p><div className="mt-2 flex flex-wrap gap-2">{entry.therapeutic_topics.map((topic) => <Badge key={topic} variant="outline">{topic}</Badge>)}</div></div>}
                      {sources.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quellen</p><div className="mt-2 flex flex-wrap gap-3 text-sm">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{source.label}<ExternalLink className="h-3.5 w-3.5" /></a>)}</div></div>}
                      {(entry.contraindications || []).length > 0 && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900"><strong>Gegenanzeigen:</strong> {entry.contraindications.join(", ")}</div>}
                      {(entry.interaction_tags || []).length > 0 && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900"><strong>Interaktionen:</strong> {entry.interaction_tags.join(", ")}</div>}
                      {entry.safety_notes && <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground"><strong>Sicherheitsnotiz:</strong> {entry.safety_notes}</div>}
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          </TabsContent>

          <TabsContent value="pathogens" className="mt-6">
            <PathogenIndex entries={entries} loading={loading} />
          </TabsContent>

          <TabsContent value="links" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-primary" /> Bestehende Wiki-Mittelverknuepfungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!loading && productLinks.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Keine Mittelverknuepfungen vorhanden.</p>}
                {productLinks.map((link) => (
                  <div key={link.id} className="rounded-lg border p-4">
                    <p className="font-medium text-foreground">{link.admin_knowledge_base?.title || "Wiki-Eintrag fehlt"} <span className="text-muted-foreground">→</span> {link.mannayan_products?.name || "Mittel fehlt"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{relationLabels[link.relation_type] || link.relation_type}</Badge>
                      <Badge variant="outline">Pruefung: {link.review_status}</Badge>
                      <Badge variant="outline">Vertrauen: {link.confidence}%</Badge>
                    </div>
                    {link.clinical_topics.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Themen: {link.clinical_topics.join(", ")}</p>}
                    {link.safety_notes && <p className="mt-3 text-sm text-amber-800">Sicherheitsnotiz: {link.safety_notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Keine Live-Schreibvorgänge</span>
          <Link to="/wissensdatenbank" className="inline-flex items-center gap-1 hover:text-primary">Alte Wiki <ExternalLink className="h-3.5 w-3.5" /></Link>
        </footer>
      </main>
    </Layout>
  );
}
