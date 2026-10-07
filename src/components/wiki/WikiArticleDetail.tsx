import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WikiSourceContent } from "@/components/wiki/WikiSourceContent";
import { ArticleEvidencePanel } from "@/components/wiki/ArticleEvidencePanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Rev = { id: string; revision_no: number; title: string; category_path: string | null; content_markdown: string; review_status: string };
type State = "loading" | "notfound" | { error: string } | { articleId: string; canonicalKey: string; rev: Rev | null };

/** Lesende Artikel-Detailansicht: nur die aktuelle Revision (kb_articles.current_revision_id), nie historische Treffer als aktuellen Text. */
export function WikiArticleDetail({ articleId, onBack }: { articleId: string; onBack: () => void }) {
  const [s, setS] = useState<State>("loading");
  useEffect(() => {
    let live = true;
    setS("loading");
    (async () => {
      const a = await db.from("kb_articles").select("id,canonical_key,current_revision_id").eq("id", articleId).maybeSingle();
      if (!live) return;
      if (a.error) return setS({ error: a.error.message });
      if (!a.data) return setS("notfound");
      if (!a.data.current_revision_id) return setS({ articleId, canonicalKey: a.data.canonical_key, rev: null });
      const r = await db.from("kb_article_revisions").select("id,article_id,revision_no,title,category_path,content_markdown,review_status").eq("id", a.data.current_revision_id).maybeSingle();
      if (!live) return;
      if (r.error) return setS({ error: r.error.message });
      if (!r.data || r.data.article_id !== articleId) return setS({ error: "Aktuelle Revision nicht lesbar oder gehört nicht zu diesem Artikel." });
      setS({ articleId, canonicalKey: a.data.canonical_key, rev: r.data });
    })();
    return () => { live = false; };
  }, [articleId]);
  return (
    <Card><CardContent className="space-y-3 p-4 text-sm">
      <Button variant="outline" size="sm" onClick={onBack}>← Zurück zur Liste</Button>
      {s === "loading" && <Skeleton className="h-64 w-full" />}
      {s === "notfound" && <p role="alert">Artikel nicht gefunden (ID {articleId}).</p>}
      {typeof s === "object" && "error" in s && <p role="alert" className="text-destructive">Fehler beim Laden: {s.error}</p>}
      {typeof s === "object" && "rev" in s && (s.rev ? <>
        <h2 className="text-xl font-semibold">{s.rev.title}</h2>
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">Aktuelle Revision {s.rev.revision_no}</Badge><Badge variant="outline">Prüfstatus: {s.rev.review_status}</Badge>{s.rev.category_path && <Badge variant="outline">{s.rev.category_path}</Badge>}</div>
        <p className="text-xs text-muted-foreground">Artikel-ID {s.articleId} · Revision {s.rev.id} · {s.canonicalKey}</p>
        <WikiSourceContent content={s.rev.content_markdown} />
        <ArticleEvidencePanel articleId={s.articleId} />
      </> : <p>Für diesen Artikel ist keine aktuelle Revision gesetzt – kein Text angezeigt.</p>)}
    </CardContent></Card>
  );
}
