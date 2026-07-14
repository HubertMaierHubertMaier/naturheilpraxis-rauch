import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Link2, RefreshCw, Trash2 } from "lucide-react";

type KnowledgeOption = { id: string; title: string; category: string };
type ProductOption = { id: string; name: string; sku: string | null; unit: string | null; is_active: boolean };
type ProductLink = {
  id: string;
  knowledge_entry_id: string;
  product_id: string;
  relation_type: string;
  clinical_topics: string[];
  confidence: number;
  safety_notes: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_knowledge_base: { title: string } | null;
  mannayan_products: { name: string; sku: string | null; unit: string | null } | null;
};

const relationLabels: Record<string, string> = {
  exact_product: "Exaktes Produkt",
  ingredient_match: "Inhaltsstoff-Bezug",
  topic_match: "Gesundheitsthema",
  alternative: "Alternative",
  do_not_combine: "Nicht kombinieren",
};

export function KnowledgeProductLinkManager() {
  const [entries, setEntries] = useState<KnowledgeOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [knowledgeEntryId, setKnowledgeEntryId] = useState("");
  const [productId, setProductId] = useState("");
  const [relationType, setRelationType] = useState("topic_match");
  const [clinicalTopics, setClinicalTopics] = useState("");
  const [confidence, setConfidence] = useState("50");
  const [safetyNotes, setSafetyNotes] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [entryResult, productResult, linkResult] = await Promise.all([
      supabase.from("admin_knowledge_base").select("id, title, category").order("title"),
      supabase.from("mannayan_products").select("id, name, sku, unit, is_active").eq("is_active", true).order("name"),
      supabase
        .from("knowledge_product_links")
        .select("id, knowledge_entry_id, product_id, relation_type, clinical_topics, confidence, safety_notes, review_status, reviewed_at, reviewed_by, admin_knowledge_base(title), mannayan_products(name, sku, unit)")
        .order("updated_at", { ascending: false }),
    ]);
    const error = entryResult.error || productResult.error || linkResult.error;
    if (error) toast({ title: "Zuordnungen nicht geladen", description: error.message, variant: "destructive" });
    setEntries((entryResult.data || []) as KnowledgeOption[]);
    setProducts((productResult.data || []) as ProductOption[]);
    setLinks((linkResult.data || []) as unknown as ProductLink[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!knowledgeEntryId || !productId) {
      toast({ title: "Wiki-Eintrag und Produkt auswählen", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("knowledge_product_links").insert({
      knowledge_entry_id: knowledgeEntryId,
      product_id: productId,
      relation_type: relationType,
      clinical_topics: clinicalTopics.split(",").map((item) => item.trim()).filter(Boolean),
      confidence: Math.max(0, Math.min(100, Number(confidence) || 0)),
      safety_notes: safetyNotes.trim(),
      review_status: "needs_review",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Zuordnung nicht gespeichert", description: error.message, variant: "destructive" });
      return;
    }
    setKnowledgeEntryId("");
    setProductId("");
    setClinicalTopics("");
    setSafetyNotes("");
    toast({ title: "Zuordnung gespeichert", description: "Sie bleibt bis zur fachlichen Freigabe als 'Prüfung offen' markiert." });
    await load();
  };

  const markReviewed = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Nicht angemeldet", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("knowledge_product_links").update({ review_status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", id);
    if (error) toast({ title: "Freigabe fehlgeschlagen", description: error.message, variant: "destructive" });
    else await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Diese Produkt-Wiki-Zuordnung wirklich löschen?")) return;
    const { error } = await supabase.from("knowledge_product_links").delete().eq("id", id);
    if (error) toast({ title: "Löschen fehlgeschlagen", description: error.message, variant: "destructive" });
    else await load();
  };

  const normalizedSearch = search.trim().toLowerCase();
  const visibleLinks = normalizedSearch
    ? links.filter((link) => `${link.admin_knowledge_base?.title || ""} ${link.mannayan_products?.name || ""} ${link.clinical_topics.join(" ")}`.toLowerCase().includes(normalizedSearch))
    : links;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Link2 className="h-6 w-6 text-primary" /> Wiki-Mannayan-Zuordnungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Produktbezüge sind interne Arbeitsverknüpfungen und kein Wirksamkeitsnachweis.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      <Card className="border-primary/25">
        <CardHeader><CardTitle className="text-base">Neue fachliche Zuordnung</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Wiki-Eintrag</label>
              <Select value={knowledgeEntryId} onValueChange={setKnowledgeEntryId}>
                <SelectTrigger><SelectValue placeholder="Wiki-Eintrag auswählen" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {entries.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.title} · {entry.category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Mannayan-Produkt</label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Aktives Produkt auswählen" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Beziehung</label>
              <Select value={relationType} onValueChange={setRelationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(relationLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Vertrauen 0-100</label>
              <Input type="number" min="0" max="100" value={confidence} onChange={(event) => setConfidence(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Gesundheitsthemen (kommagetrennt)</label>
            <Input value={clinicalTopics} onChange={(event) => setClinicalTopics(event.target.value)} placeholder="z.B. Darmbarriere, Schlaf, Mikronährstoffe" />
          </div>
          <div>
            <label className="text-sm font-medium">Sicherheits-/Abgrenzungsnotiz</label>
            <Textarea value={safetyNotes} onChange={(event) => setSafetyNotes(event.target.value)} rows={3} placeholder="Warum besteht der Bezug, was muss vor Einsatz geprüft werden?" />
          </div>
          <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Speichern..." : "Zuordnung anlegen"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Vorhandene Zuordnungen ({visibleLinks.length})</CardTitle>
          <Input className="sm:w-80" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Wiki, Produkt oder Thema suchen" />
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && visibleLinks.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Noch keine passenden Zuordnungen.</div>}
          {visibleLinks.map((link) => (
            <div key={link.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="font-medium">{link.admin_knowledge_base?.title || "Wiki-Eintrag fehlt"} <span className="text-muted-foreground">→</span> {link.mannayan_products?.name || "Produkt fehlt"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{relationLabels[link.relation_type] || link.relation_type}</Badge>
                    <Badge variant="outline">Vertrauen {link.confidence}%</Badge>
                    <Badge variant={link.review_status === "reviewed" ? "default" : link.review_status === "restricted" ? "destructive" : "secondary"}>
                      {link.review_status === "reviewed" ? "fachlich geprüft" : link.review_status === "restricted" ? "gesperrt" : "Prüfung offen"}
                    </Badge>
                  </div>
                  {link.clinical_topics.length > 0 && <div className="text-xs text-muted-foreground">Themen: {link.clinical_topics.join(", ")}</div>}
                  {link.safety_notes && <div className="text-sm text-amber-800 dark:text-amber-300">{link.safety_notes}</div>}
                  {link.reviewed_at && <div className="text-[11px] text-muted-foreground">Geprüft am {new Date(link.reviewed_at).toLocaleString("de-DE")}</div>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {link.review_status !== "reviewed" && <Button size="sm" variant="outline" className="gap-1" onClick={() => markReviewed(link.id)}><CheckCircle2 className="h-4 w-4" /> Prüfen</Button>}
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(link.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
