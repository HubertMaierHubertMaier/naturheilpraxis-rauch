import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllPages, wikiErrorText } from "@/lib/wikiFetchAll";
import { buildDryRun } from "@/lib/wikiNetworkDryRun";
import {
  actorsOfEntity, buildWikiModel, GROUP_LABEL, matchesAll, neighbours, NUTRIENT_LABEL, paginate, PETER_ACTORS, pharmacyNamesInText, productsWithSubstance, rxLabel, norm, MANNAYAN_ALIAS, TOPICS, topicHits, EXTERNAL_PHARMACIES, RELATION_LABEL,
  type Actor, type GroupKey, type NutrientClass, type WikiModel,
} from "@/lib/wikiTaxonomy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const PAGE = 50;
const COUNT_TABLES = ["kb_articles", "kb_article_revisions", "kb_entities", "kb_sources", "kb_source_revisions", "kb_relation_candidates", "kb_entity_candidates"] as const;
type Counts = Partial<Record<(typeof COUNT_TABLES)[number], number>>;

const st = (s: string) => (s === "draft" ? "Entwurf, nicht geprüft" : s === "imported_unreviewed" ? "Import, ungeprüft" : s === "accepted_as_draft" ? "als Entwurf angenommen" : s);
const all = (table: string, cols: string, order: string[]) =>
  fetchAllPages((f, t) => order.reduce((q, c) => q.order(c, { ascending: true }), db.from(table).select(cols)).range(f, t));

async function loadModel(): Promise<{ model: WikiModel; counts: Counts; pharmacyText: Map<string, Set<string>>; pharmacyTextError: boolean }> {
  const [e, er, cl, rel, a, ar, s, sr] = await Promise.all([
    all("kb_entities", "id, entity_type_code, current_revision_id", ["id"]),
    all("kb_entity_revisions", "id, entity_id, display_name, review_status, original_kind:metadata->candidate_snapshot->proposed_data->>original_kind, prescription_status:metadata->candidate_snapshot->proposed_data->>prescription_status, manufacturer:metadata->candidate_snapshot->proposed_data->>manufacturer", ["id"]),
    all("kb_import_core_links", "candidate_kind, candidate_id, core_record_kind, core_entity_id, core_source_revision_id", ["candidate_kind", "candidate_id"]),
    all("kb_relation_candidates", "id, subject_candidate_id, object_candidate_id, proposed_relation_type_code, candidate_status, source_candidate_id, source_locator", ["id"]),
    all("kb_articles", "id, current_revision_id, article_kind", ["id"]),
    all("kb_article_revisions", "id, article_id, revision_no, title, category_path, review_status", ["id"]),
    all("kb_sources", "id, current_revision_id", ["id"]),
    all("kb_source_revisions", "id, source_id, revision_no, title, publisher, authors, review_status", ["id"]),
  ]);
  const firstErr = [e, er, cl, rel, a, ar, s, sr].find((x) => x.error)?.error;
  if (firstErr) throw new Error(firstErr.message);
  const countRes = await Promise.all(COUNT_TABLES.map((t) => db.from(t).select("id", { count: "exact", head: true })));
  const counts: Counts = {};
  COUNT_TABLES.forEach((t, i) => { if (!countRes[i].error) counts[t] = countRes[i].count ?? undefined; });
  const model = buildWikiModel({
    entities: e.data as never, entityRevisions: er.data as never, coreLinks: cl.data as never, relations: rel.data as never,
    articles: a.data as never, articleRevisions: ar.data as never, sources: s.data as never, sourceRevisions: sr.data as never,
  });
  // Named pharmacies in article text (server-side word match, then name extraction) – text hits only.
  const ph = await fetchAllPages((f, t) => db.from("kb_article_revisions").select("id, article_id, content_markdown").filter("content_markdown", "imatch", "apotheke").order("id", { ascending: true }).range(f, t));
  const pharmacyText = new Map<string, Set<string>>();
  if (!ph.error) for (const r of ph.data as { id: string; article_id: string; content_markdown: string }[]) {
    if (model.articles.get(r.article_id)?.revisionId !== r.id) continue;
    for (const n of pharmacyNamesInText(r.content_markdown ?? "")) { if (!pharmacyText.has(n)) pharmacyText.set(n, new Set()); pharmacyText.get(n)!.add(r.article_id); }
  }
  return { model, counts, pharmacyText, pharmacyTextError: !!ph.error };
}

type View = "start" | "topic" | "actors" | "pharmacies" | "mannayan" | "chipcards" | "drugs" | GroupKey | NutrientClass | "folders" | "unassigned";
const NUTRIENT_VIEWS: NutrientClass[] = ["vitamins", "minerals", "trace"];
const isNutrientView = (v: View): v is NutrientClass => (NUTRIENT_VIEWS as string[]).includes(v);
const VIEW_LABEL: Record<View, string> = { start: "Übersicht", topic: "Themen & Personen", actors: "Firmen & Personen", pharmacies: "Apotheken", mannayan: "Mannayan-Produkte", chipcards: "ChipCards", drugs: "Ärztliche Mittel / Arzneimittel", ...GROUP_LABEL, ...NUTRIENT_LABEL, folders: "Ordner (Kategoriepfad)", unassigned: "Noch nicht zugeordnet" };

function Pager({ page, pages, total, set }: { page: number; pages: number; total: number; set: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set(page - 1)}>Zurück</Button>
      <span>Seite {page} von {pages} · {total} Treffer</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set(page + 1)}>Weiter</Button>
    </div>
  );
}

const LinkBadge = ({ kind }: { kind: "import" | "field" | "text" }) => (
  <Badge variant="outline" className="text-[10px]">{kind === "import" ? "Importverknüpfung, ungeprüft" : kind === "field" ? "Datenfeld" : "Treffer im Quelltext – Zuordnung noch zu prüfen"}</Badge>
);

export default function WikiOrdnung() {
  const { user, loading: authLoading, isAdmin, roleChecked } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadModel>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fullText, setFullText] = useState<Record<string, string[] | "loading" | "error">>({});
  const searchFullText = async (a: Actor) => {
    const al = PETER_ACTORS.find((p) => p.key === a.key)?.aliases ?? [a.name.toLowerCase()];
    setFullText((x) => ({ ...x, [a.key]: "loading" }));
    const pattern = `(^|[^[:alpha:]])(${al.map((x) => x.replace(/[^a-z0-9 ]/gi, "").replace(/ /g, "[ -]?")).join("|")})([^[:alpha:]]|$)`;
    const r = await fetchAllPages((f, t) => db.from("kb_article_revisions").select("article_id").filter("content_markdown", "imatch", pattern).order("id", { ascending: true }).range(f, t));
    setFullText((x) => ({ ...x, [a.key]: r.error ? "error" : [...new Set((r.data as { article_id: string }[]).map((y) => y.article_id))].filter((id) => m?.articles.get(id)?.revisionId) }));
  };
  const view = (params.get("v") as View) || "start";
  const id = params.get("id");
  const q = params.get("q") ?? "";
  const role = params.get("rolle") ?? "";
  const page = Number(params.get("s") ?? "1");
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("s" in patch)) n.delete("s");
    setParams(n);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadModel().then(setData).catch((e) => setErr(wikiErrorText(e instanceof Error ? e.message : String(e))));
  }, [isAdmin]);

  const m = data?.model;
  const actorsSorted = useMemo(() => {
    if (!m) return [];
    const peter = PETER_ACTORS.map((p) => m.actors.get(p.key)!);
    const rest = [...m.actors.values()].filter((a) => !a.roles.has("Von Peter benannt")).sort((a, b) => a.name.localeCompare(b.name, "de"));
    return [...peter, ...rest];
  }, [m]);

  if (authLoading || (user && !roleChecked)) return <Layout><div className="container py-12"><Skeleton className="h-96 w-full" /></div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const crumbs = (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Rückweg">
      <Link to="/wikidatenbank" className="underline">Wikidatenbank</Link><span>›</span>
      <button className="underline" onClick={() => setParams(new URLSearchParams())}>Ordnung</button>
      {view !== "start" && <><span>›</span><button className="underline" onClick={() => setParams(new URLSearchParams(view === "topic" ? { v: view, t: params.get("t") ?? "" } : { v: view }))}>{view === "topic" ? TOPICS.find((x) => x.key === params.get("t"))?.label ?? VIEW_LABEL[view] : VIEW_LABEL[view]}</button></>}
      {id && <><span>›</span><span className="font-semibold">Detail</span></>}
    </nav>
  );
  const actorCount = (a: Actor) => a.folderArticleIds.size + a.sourceRevisionIds.size + a.entityIds.size + a.textArticleIds.size + a.textEntityIds.size;
  const ent = (eid: string) => m?.entities.get(eid);
  const entButton = (eid: string) => { const e = ent(eid); return e ? <button key={eid} className="underline" onClick={() => set({ v: e.drug ? "drugs" : e.chipCard ? "chipcards" : e.nutrient ?? e.group, id: eid, q: null })}>{e.name}</button> : null; };
  const artLine = (aid: string, kind: "field" | "text") => {
    const a = m!.articles.get(aid)!;
    return <li key={aid} className="flex flex-wrap items-center gap-2"><span>{a.title}</span><Badge variant="secondary" className="text-[10px]">Artikel · Rev. {a.revisionNo} · {st(a.reviewStatus)}</Badge><LinkBadge kind={kind} /></li>;
  };
  const srcLine = (sid: string, extra?: string) => {
    const s = m!.sources.get(sid);
    return <li key={sid + (extra ?? "")}>{s ? `${s.title || "Quelle ohne Titel"} (interne Quelle, Rev. ${s.revision_no}, ${st(s.review_status)})` : "Quellenrevision nicht lesbar"}{extra ? ` · Fundstelle: ${extra}` : ""}</li>;
  };

  let body: JSX.Element | null = null;
  if (err) body = <Card><CardContent role="alert" className="p-6 text-destructive">{err}</CardContent></Card>;
  else if (!m) body = <Skeleton className="h-64 w-full" />;
  else if (view === "start") {
    const tiles: Array<[View, string, number]> = [
      ["actors", VIEW_LABEL.actors, m.actors.size],
      ...(["products", "pathogens", "symptoms", "diseases"] as GroupKey[]).map((g) => [g, GROUP_LABEL[g], [...m.entities.values()].filter((e) => e.group === g).length] as [View, string, number]),
      ["mannayan", "Mannayan-Produkte", [...m.entities.values()].filter((e) => e.manufacturerField && norm(e.manufacturerField).split(" ").includes(MANNAYAN_ALIAS)).length],
      ["chipcards", "ChipCards", [...m.entities.values()].filter((e) => e.chipCard).length],
      ["pharmacies", "Apotheken", EXTERNAL_PHARMACIES.length + [...m.actors.values()].filter((a) => a.roles.has("Apotheke")).length + [...data!.pharmacyText.keys()].filter((n) => ![...m.actors.values()].some((a) => a.roles.has("Apotheke") && norm(a.name) === norm(n))).length],
      ["drugs", "Ärztliche Mittel / Arzneimittel", [...m.entities.values()].filter((e) => e.drug).length],
      ["vitamins", "Vitamine", [...m.entities.values()].filter((e) => e.nutrient === "vitamins").length],
      ["minerals", "Mineralstoffe (inkl. Spurenelemente)", [...m.entities.values()].filter((e) => e.nutrient === "minerals" || e.nutrient === "trace").length],
      ["trace", "Spurenelemente", [...m.entities.values()].filter((e) => e.nutrient === "trace").length],
      ["other", GROUP_LABEL.other, [...m.entities.values()].filter((e) => e.group === "other").length],
      ["folders", VIEW_LABEL.folders, m.folders.size],
      ["unassigned", VIEW_LABEL.unassigned, m.unassignedArticleIds.length + m.unassignedEntityIds.length],
    ];
    const c = data!.counts;
    const topicTiles = TOPICS.map((t) => { const h = topicHits(m, t); return { t, n: h.folderArticleIds.length + h.titleArticleIds.length + h.sourceIds.length + h.entityIds.length }; });
    body = (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([v, label, n]) => (
            <button key={v} onClick={() => set({ v })} className="rounded-lg border-2 border-primary/30 bg-card p-4 text-left hover:border-primary">
              <p className="text-lg font-semibold">{label}</p><p className="text-sm text-muted-foreground">{n} Einträge</p>
            </button>
          ))}
        </div>
        <p className="mt-5 mb-2 font-semibold">Themen, Personen, Plattformen</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topicTiles.map(({ t, n }) => (
            <button key={t.key} onClick={() => set({ v: "topic", t: t.key })} className="rounded-lg border-2 border-primary/30 bg-card p-4 text-left hover:border-primary">
              <p className="text-lg font-semibold">{t.label}</p><p className="text-sm text-muted-foreground">{t.role} · {n} Einträge</p>
            </button>
          ))}
        </div>
        <Card className="mt-4"><CardContent className="space-y-2 p-4 text-sm">
          <p className="font-semibold">Vernetzung – Probelauf (nichts wird gespeichert)</p>
          <p className="text-muted-foreground">Die Kästchen sind eine Navigationsschicht, keine fertige Vernetzung. Der Probelauf berechnet Prüfvorschläge für Firmen, Personen und Apotheken samt Rollen aus vorhandenen Datenfeldern und lädt sie als Datei herunter.</p>
          <Button size="sm" variant="outline" onClick={() => { const d = buildDryRun(m); const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `wiki-vernetzung-probelauf-${d.generated_at.slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(u); }}>Prüfvorschläge herunterladen</Button>
        </CardContent></Card>
        <Card className="mt-4"><CardContent className="p-4 text-sm">
          <p className="font-semibold">Exakte Zählung (Server) vs. geladen</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Wiki-Artikel: {c.kb_articles ?? "?"} gezählt · {m.articles.size} mit aktueller Revision geladen{m.missingRevisions.articles ? ` · ${m.missingRevisions.articles} ohne lesbare aktuelle Revision` : ""} · Revisionen gesamt: {c.kb_article_revisions ?? "?"}</li>
            <li>Begriffe (Entitäten): {c.kb_entities ?? "?"} gezählt · {m.entities.size} geladen</li>
            <li>Interne Quellen: {c.kb_sources ?? "?"} gezählt · {m.sources.size} aktuelle Revisionen geladen</li>
            <li>Importkandidaten (Beziehungen): {c.kb_relation_candidates ?? "?"} gezählt · {m.relations.length} geladen – Kandidaten sind keine bestätigten Artikel</li>
          </ul>
          {c.kb_articles !== undefined && c.kb_articles !== m.articles.size + m.missingRevisions.articles && <p role="alert" className="mt-1 font-semibold text-destructive">Geladener Bestand weicht von der Zählung ab – Anzeige ist unvollständig.</p>}
        </CardContent></Card>
      </>
    );
  } else if (view === "actors" && !id) {
    const roles = ["Von Peter benannt", "Apotheke", "Hersteller", "Herausgeber", "Autor", "Ordner"];
    const list = actorsSorted.filter((a) => (!q || matchesAll(a.name, q)) && (!role || a.roles.has(role as never)));
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Name suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} aria-label="Firmen und Personen durchsuchen" />
          {roles.map((r) => <Button key={r} size="sm" variant={role === r ? "default" : "outline"} onClick={() => set({ rolle: role === r ? null : r })}>{r}</Button>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pg.items.map((a) => (
            <button key={a.key} onClick={() => set({ id: a.key })} className={`rounded-lg border bg-card p-3 text-left hover:border-primary ${a.roles.has("Von Peter benannt") ? "border-2 border-primary/50" : "border-border"}`}>
              <p className="font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{[...a.roles].join(", ")} · {actorCount(a)} Zuordnungen{actorCount(a) === 0 ? " (keine im Bestand gefunden)" : ""}</p>
            </button>
          ))}
        </div>
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
      </>
    );
  } else if (view === "actors" && id) {
    const a = m.actors.get(id);
    body = !a ? <p>Nicht gefunden.</p> : (
      <Card><CardContent className="space-y-3 p-4 text-sm">
        <h2 className="text-xl font-semibold">{a.name}</h2>
        <div className="flex flex-wrap gap-1">{[...a.roles].map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
        <p className="text-muted-foreground">Rollen stammen nur aus Datenfeldern (Herstellerbegriff, Herausgeber, Autor, Ordnername) oder aus Peters Benennung – keine abgeleitete Wirksamkeit.</p>
        {a.entityIds.size > 0 && <div><p className="font-semibold">Mittel/Begriffe (Import, ungeprüft)</p><div className="flex flex-wrap gap-3">{[...a.entityIds].map(entButton)}</div></div>}
        {a.roles.has("Von Peter benannt") && <p className="text-xs text-muted-foreground">Ob ein Produkt ein Komplexmittel ist, steht nur fest, wenn der Produktdatensatz es angibt – keine pauschale Einstufung je Anbieter.</p>}
        {a.textEntityIds.size > 0 && <div><p className="font-semibold">Produkte mit diesem Namen im Produktnamen ({a.textEntityIds.size}) <LinkBadge kind="text" /></p><div className="flex flex-wrap gap-3">{[...a.textEntityIds].map(entButton)}</div></div>}
        {a.sourceRevisionIds.size > 0 && <div><p className="font-semibold">Interne Quellen ({a.sourceRevisionIds.size}) <LinkBadge kind="field" /></p><ul className="list-disc pl-5">{[...a.sourceRevisionIds].map((s) => srcLine(s))}</ul></div>}
        {a.folderArticleIds.size > 0 && <div><p className="font-semibold">Artikel im Ordner ({a.folderArticleIds.size})</p><ul className="space-y-1">{[...a.folderArticleIds].slice(0, 200).map((x) => artLine(x, "field"))}</ul>{a.folderArticleIds.size > 200 && <p className="text-muted-foreground">Erste 200 von {a.folderArticleIds.size} angezeigt.</p>}</div>}
        {a.textArticleIds.size > 0 && <div><p className="font-semibold">Treffer im Quelltext ({a.textArticleIds.size})</p><ul className="space-y-1">{[...a.textArticleIds].slice(0, 200).map((x) => artLine(x, "text"))}</ul>{a.textArticleIds.size > 200 && <p className="text-muted-foreground">Erste 200 von {a.textArticleIds.size} angezeigt.</p>}</div>}
        <div><p className="font-semibold">Volltext der Artikel</p>{(() => { const ft = fullText[a.key]; return ft === undefined ? <Button size="sm" variant="outline" onClick={() => searchFullText(a)}>Volltext durchsuchen</Button> : ft === "loading" ? <p>Sucht …</p> : ft === "error" ? <p className="text-destructive">Volltextsuche nicht möglich.</p> : <><p className="text-xs text-muted-foreground">{ft.length} Artikel nennen den Namen im Text <LinkBadge kind="text" /></p><ul className="space-y-1">{ft.slice(0, 200).map((x) => artLine(x, "text"))}</ul></>; })()}</div>
        {actorCount(a) === 0 && <p className="font-semibold">Im aktuellen Bestand keine Zuordnung und kein Titel-/Ordnertreffer gefunden.</p>}
      </CardContent></Card>
    );
  } else if (view === "folders") {
    const list = [...m.folders.entries()].filter(([f]) => !q || matchesAll(f, q)).sort((x, y) => y[1].size - x[1].size);
    const open = id ? m.folders.get(id) : undefined;
    const pg = paginate<unknown>(open ? [...open] : list, page, PAGE);
    body = open ? (
      <Card><CardContent className="p-4 text-sm"><h2 className="mb-2 text-xl font-semibold">Ordner: {id}</h2><ul className="space-y-1">{(pg.items as unknown as string[]).map((x) => artLine(x, "field"))}</ul><div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div></CardContent></Card>
    ) : (
      <>
        <Input className="mb-3 max-w-xs" placeholder="Ordner suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(pg.items as unknown as [string, Set<string>][]).map(([f, s]) => <button key={f} onClick={() => set({ id: f })} className="rounded border border-border bg-card p-2 text-left text-sm hover:border-primary"><span className="font-semibold">{f}</span> · {s.size} Artikel</button>)}</div>
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
      </>
    );
  } else if (view === "unassigned") {
    const items = [...m.unassignedEntityIds.map((x) => ({ k: "e", id: x, t: m.entities.get(x)!.name })), ...m.unassignedArticleIds.map((x) => ({ k: "a", id: x, t: m.articles.get(x)!.title }))].filter((x) => !q || matchesAll(x.t, q));
    const pg = paginate(items, page, PAGE);
    body = (
      <>
        <p className="mb-2 text-sm text-muted-foreground">Ohne Firma/Person, ohne Importverknüpfung und ohne Titeltreffer zu einem Begriff. Nichts davon ist ausgeblendet – die Inhalte stehen weiter vollständig in der Wikidatenbank.</p>
        <Input className="mb-3 max-w-xs" placeholder="Suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <ul className="space-y-1 text-sm">{pg.items.map((x) => x.k === "e" ? <li key={x.id}>Begriff: {entButton(x.id)}</li> : <li key={x.id}>Artikel: {x.t}</li>)}</ul>
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
      </>
    );
  } else if (view === "topic") {
    const t = TOPICS.find((x) => x.key === params.get("t"));
    const h = t ? topicHits(m, t) : undefined;
    const filt = (ids: string[]) => ids.filter((x) => !q || matchesAll(m.articles.get(x)?.title ?? "", q));
    body = !t || !h ? <p>Nicht gefunden.</p> : (
      <Card><CardContent className="space-y-3 p-4 text-sm">
        <h2 className="text-xl font-semibold">{t.label}</h2>
        <Badge variant="outline">Rolle/Kategorie: {t.role}</Badge>
        {t.note && <p className="text-muted-foreground">{t.note}</p>}
        <p className="text-xs text-muted-foreground">Quellen- und Autorenmaterial ist keine bestätigte Wirksamkeit. Alte Wiki-Inhalte bleiben unverändert.</p>
        <Input className="max-w-xs" placeholder="Artikel suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} />
        {h.entityIds.length > 0 && <div><p className="font-semibold">Begriffe/Produkte ({h.entityIds.length}) <LinkBadge kind="text" /></p><div className="flex flex-wrap gap-3">{h.entityIds.map(entButton)}</div><p className="text-xs text-muted-foreground">Symptome/Erkrankungen/Pathogene stehen jeweils im Begriffseintrag (Importverknüpfung).</p></div>}
        {h.sourceIds.length > 0 && <div><p className="font-semibold">Interne Quellen (Herausgeber/Autor) ({h.sourceIds.length}) <LinkBadge kind="field" /></p><ul className="list-disc pl-5">{h.sourceIds.map((x) => srcLine(x))}</ul></div>}
        <div><p className="font-semibold">Artikel im Ordner ({filt(h.folderArticleIds).length}) <LinkBadge kind="field" /></p><ul className="space-y-1">{filt(h.folderArticleIds).slice(0, 200).map((x) => artLine(x, "field"))}</ul>{filt(h.folderArticleIds).length > 200 && <p className="text-muted-foreground">Erste 200 von {filt(h.folderArticleIds).length} – Suche eingrenzen.</p>}</div>
        {h.titleArticleIds.length > 0 && <div><p className="font-semibold">Name nur im Titel ({filt(h.titleArticleIds).length})</p><ul className="space-y-1">{filt(h.titleArticleIds).slice(0, 200).map((x) => artLine(x, "text"))}</ul></div>}
        {h.folderArticleIds.length + h.titleArticleIds.length + h.sourceIds.length + h.entityIds.length === 0 && <p className="font-semibold">Im Bestand nichts gefunden.</p>}
      </CardContent></Card>
    );
  } else if ((view === "mannayan" || view === "chipcards") && !id) {
    const isM = view === "mannayan";
    const pool = [...m.entities.values()].filter((e) => isM ? !!e.manufacturerField && norm(e.manufacturerField).split(" ").includes(MANNAYAN_ALIAS) : !!e.chipCard);
    const list = pool.filter((e) => !q || matchesAll(e.name, q)).sort((a, b) => a.name.localeCompare(b.name, "de"));
    const maker = isM ? [...m.actors.values()].find((a) => norm(a.name).split(" ").includes(MANNAYAN_ALIAS) && a.roles.has("Hersteller")) : undefined;
    const textProducts = isM ? [...m.entities.values()].filter((e) => !pool.includes(e) && e.stoffart === "Produkt" && norm(e.name).split(" ").includes(MANNAYAN_ALIAS)) : [];
    const otherPrograms = !isM ? [...m.entities.values()].filter((e) => e.type === "program" && !e.chipCard) : [];
    const chipArticles = !isM ? [...m.articles.values()].filter((a) => /chip ?-?cards?/i.test(`${a.title} ${a.category}`)) : [];
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <p className="mb-3 text-sm text-muted-foreground">{isM
          ? <>Zuordnung über das Herstellerfeld im Produktdatensatz („{maker?.name ?? "Mannayan GmbH & Co. KG"}"); Suchbegriff „Mannayan" funktioniert. Herstellerangaben sind Quellenangaben, keine bestätigte Wirksamkeit. {maker && <button className="underline" onClick={() => set({ v: "actors", id: maker.key })}>Zum Hersteller</button>}</>
          : <>Als ChipCard gilt nur ein vorhandener Programm-Datensatz mit „ChipCard"/„Chip" im eigenen Namen. Produktart bleibt „Programm" laut Datensatz – keine Einstufung als Arzneimittel und keine gesicherte Wirksamkeit.</>}</p>
        <Input className="mb-3 max-w-xs" placeholder={isM ? "Mannayan-Produkt suchen" : "ChipCard suchen"} value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <button key={e.id} onClick={() => set({ id: e.id })} className="rounded border border-border bg-card p-2 text-left text-sm hover:border-primary"><span className="font-semibold">{e.name}</span> · Typ {e.type} · {neighbours(m, e.id).length} Verknüpfungen{neighbours(m, e.id).length === 0 ? " (keine Themen/Symptome zugeordnet)" : ""}</button>)}</div>
        {list.length === 0 && <p className="text-sm">Keine Datensätze in dieser Rubrik.</p>}
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
        {textProducts.length > 0 && <div className="mt-3 text-sm"><p className="font-semibold">Produkte mit „Mannayan" nur im Namen, ohne Herstellerfeld ({textProducts.length}) <LinkBadge kind="text" /></p><div className="flex flex-wrap gap-3">{textProducts.map((e) => entButton(e.id))}</div></div>}
        {!isM && <div className="mt-4 space-y-3 text-sm">
          <div><p className="font-semibold">Artikel im Ordner/Titel „Chip Cards" ({chipArticles.length}) <LinkBadge kind="field" /></p><ul className="space-y-1">{chipArticles.slice(0, 200).map((a) => artLine(a.id, "field"))}</ul>{chipArticles.length > 200 && <p className="text-muted-foreground">Erste 200 von {chipArticles.length}.</p>}</div>
          <div><p className="font-semibold">Weitere Programm-Datensätze ohne „ChipCard" im Namen ({otherPrograms.length}) – nicht eingeordnet, zu prüfen</p><div className="flex flex-wrap gap-3">{otherPrograms.map((e) => entButton(e.id))}</div></div>
        </div>}
      </>
    );
  } else if (view === "pharmacies") {
    const structured = [...m.actors.values()].filter((a) => a.roles.has("Apotheke"));
    const textOnly = [...data!.pharmacyText.entries()].filter(([n]) => !structured.some((a) => norm(a.name) === norm(n))).sort((x, y) => x[0].localeCompare(y[0], "de"));
    body = (
      <>
        <p className="mb-3 text-sm text-muted-foreground">Apotheke ist eine eigene Rolle, getrennt von Hersteller und Autor. Mehrere Rollen erscheinen nur, wenn die Daten sie belegen. Apotheken nur als Text-Erwähnung sind als „Treffer im Quelltext" gekennzeichnet.</p>
        <p className="font-semibold">Im Datensatz erfasst ({structured.length})</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{structured.map((a) => <button key={a.key} onClick={() => set({ v: "actors", id: a.key })} className="rounded border-2 border-primary/50 bg-card p-3 text-left text-sm hover:border-primary"><span className="font-semibold">{a.name}</span><br /><span className="text-xs text-muted-foreground">{[...a.roles].join(", ")} · {actorCount(a)} Zuordnungen</span>{data!.pharmacyText.get(a.name) && <span className="text-xs text-muted-foreground"> · {data!.pharmacyText.get(a.name)!.size} Artikel nennen sie im Text</span>}</button>)}</div>
        <p className="font-semibold">Extern geprüfte Betreiberzuordnung ({EXTERNAL_PHARMACIES.length})</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">{EXTERNAL_PHARMACIES.map((x) => { const t = TOPICS.find((y) => y.key === x.topicKey)!; const h = topicHits(m, t); return (
          <div key={x.name} className="rounded border-2 border-primary/50 bg-card p-3 text-sm">
            <button className="font-semibold underline" onClick={() => set({ v: "topic", t: x.topicKey })}>{x.name}</button>
            <p className="text-xs text-muted-foreground">Rollen: Apotheke (extern geprüft {x.checkedOn}) · Produktlinie · Suchbegriffe: {x.aliases.join(", ")} · {h.folderArticleIds.length + h.titleArticleIds.length} Artikel aus dem Bestand</p>
            <p className="mt-1 text-xs">{x.note}</p>
            <p className="mt-1 text-xs">Primärquellen: {x.sources.map((q, i) => <span key={q.url}>{i ? " · " : ""}<a className="underline" href={q.url} target="_blank" rel="noreferrer">{q.label}</a></span>)}</p>
          </div>); })}</div>
        <p className="font-semibold">Nur im Artikeltext genannt ({textOnly.length}) <LinkBadge kind="text" /></p>
        {data!.pharmacyTextError ? <p className="text-destructive text-sm">Volltextsuche nicht möglich.</p> : <ul className="space-y-2 text-sm">{textOnly.map(([n, ids]) => <li key={n}><span className="font-semibold">{n}</span> – kein eigener Datensatz, keine Produktverknüpfung<ul className="mt-1 space-y-1 pl-4">{[...ids].map((x) => artLine(x, "text"))}</ul></li>)}</ul>}
      </>
    );
  } else if (view === "drugs" && !id) {
    const list = [...m.entities.values()].filter((e) => e.drug && (!q || matchesAll(e.name, q))).sort((a, b) => a.name.localeCompare(b.name, "de"));
    const kl = m.actors.get("klinghardt");
    const ft = fullText["__drugs"];
    const searchDrugText = async () => {
      setFullText((x) => ({ ...x, __drugs: "loading" }));
      const r = await fetchAllPages((f, t) => db.from("kb_article_revisions").select("article_id").filter("content_markdown", "imatch", "(arzneimittel|medikament|verschreibungspflichtig|rezeptpflichtig)").order("id", { ascending: true }).range(f, t));
      setFullText((x) => ({ ...x, __drugs: r.error ? "error" : [...new Set((r.data as { article_id: string }[]).map((y) => y.article_id))].filter((aid) => m.articles.get(aid)?.revisionId && (!kl || kl.folderArticleIds.has(aid) || kl.textArticleIds.has(aid))) }));
    };
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <Card className="mb-3"><CardContent className="space-y-1 p-4 text-sm">
          <p>Wissensnavigation – keine Verordnung und keine Anwendungsfreigabe. Als Arzneimittel gilt ein Eintrag nur, wenn sein Datensatz das ausdrücklich angibt (Begriffstyp oder hinterlegte Art); eine bloße Erwähnung, etwa in den Klinghardt-Unterlagen, reicht nicht. Verschreibungsstatus nur, wenn im Datensatz hinterlegt, sonst „unklar".</p>
        </CardContent></Card>
        <Input className="mb-3 max-w-xs" placeholder="Arzneimittel suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <button key={e.id} onClick={() => set({ id: e.id })} className="rounded border border-border bg-card p-2 text-left text-sm hover:border-primary"><span className="font-semibold">{e.name}</span> · {rxLabel(e.rx)} · {neighbours(m, e.id).length} Verknüpfungen</button>)}</div>
        {list.length === 0 && <p className="text-sm font-semibold">Im Bestand ist derzeit kein Eintrag als Arzneimittel strukturiert erfasst (kein Begriffstyp „Arzneimittel", keine PZN/ATC-Kennung, keine hinterlegte Produktart).</p>}
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
        {kl && <div className="mt-4 text-sm"><p className="font-semibold">Dr. Klinghardt: {kl.sourceRevisionIds.size} interne Quellen, {kl.folderArticleIds.size} Ordner-Artikel <LinkBadge kind="field" /></p>
          <p className="text-muted-foreground">Dort genannte Mittel sind noch nicht als eigene Einträge erfasst. <button className="underline" onClick={() => set({ v: "actors", id: "klinghardt" })}>Zu Dr. Klinghardt</button></p></div>}
        <div className="mt-3 text-sm"><p className="font-semibold">Klinghardt-Artikel, die „Arzneimittel/Medikament/verschreibungspflichtig" im Text nennen</p>{ft === undefined ? <Button size="sm" variant="outline" onClick={searchDrugText}>Volltext durchsuchen</Button> : ft === "loading" ? <p>Sucht …</p> : ft === "error" ? <p className="text-destructive">Volltextsuche nicht möglich.</p> : <><p className="text-xs text-muted-foreground">{ft.length} Artikel <LinkBadge kind="text" /> – keine Einstufung als Arzneimittel</p><ul className="space-y-1">{ft.slice(0, 200).map((x) => artLine(x, "text"))}</ul></>}</div>
      </>
    );
  } else if (isNutrientView(view) && !id) {
    const list = [...m.entities.values()].filter((e) => (view === "minerals" ? e.nutrient === "minerals" || e.nutrient === "trace" : e.nutrient === view) && (!q || matchesAll(e.name, q))).sort((a, b) => a.name.localeCompare(b.name, "de"));
    const unclassified = [...m.entities.values()].filter((e) => e.type === "nutrient" && !e.nutrient);
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <p className="mb-2 text-sm text-muted-foreground">Einordnung nach Stoffname, nur für Datensätze vom Typ Nährstoff (Stoff). Produkte mit diesen Stoffen stehen im Detail. {view === "minerals" && "Spurenelemente sind als Untergruppe enthalten und markiert."} {view === "trace" && "Untergruppe der Mineralstoffe."}</p>
        <Input className="mb-3 max-w-xs" placeholder={`${NUTRIENT_LABEL[view]} suchen`} value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <button key={e.id} onClick={() => set({ id: e.id })} className="rounded border border-border bg-card p-2 text-left text-sm hover:border-primary"><span className="font-semibold">{e.name}</span>{view === "minerals" && e.nutrient === "trace" ? " · Spurenelement" : ""} · {neighbours(m, e.id).length} Verknüpfungen · {productsWithSubstance(m, e.id).length} Produkte</button>)}</div>
        {list.length === 0 && <p className="text-sm">Im Bestand keine Datensätze in dieser Rubrik.</p>}
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
        <p className="mt-3 text-xs text-muted-foreground">Nicht eingeordnete Nährstoffe ({unclassified.length}): {unclassified.map((e) => e.name).join(", ")} – stehen unter Mittel/Produkte.</p>
      </>
    );
  } else if (!id) {
    const g = view as GroupKey;
    const list = [...m.entities.values()].filter((e) => e.group === g && (!q || matchesAll(e.name, q))).sort((a, b) => a.name.localeCompare(b.name, "de"));
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <Input className="mb-3 max-w-xs" placeholder={`${GROUP_LABEL[g]} suchen`} value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <button key={e.id} onClick={() => set({ id: e.id })} className="rounded border border-border bg-card p-2 text-left text-sm hover:border-primary"><span className="font-semibold">{e.name}</span> · {neighbours(m, e.id).length} Verknüpfungen</button>)}</div>
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
      </>
    );
  } else {
    const e = m.entities.get(id);
    const nb = e ? neighbours(m, e.id) : [];
    const byGroup = (["products", "pathogens", "symptoms", "diseases", "other"] as GroupKey[]).map((g) => [g, nb.filter((x) => x.other!.group === g)] as const).filter(([, xs]) => xs.length);
    const makers = e ? actorsOfEntity(m, e.id) : [];
    const prods = e && e.stoffart === "Stoff" ? productsWithSubstance(m, e.id) : [];
    const texts = e ? [...(m.articleTextEntities.get(e.id) ?? [])] : [];
    body = !e ? <p>Nicht gefunden.</p> : (
      <Card><CardContent className="space-y-3 p-4 text-sm">
        <h2 className="text-xl font-semibold">{e.name}</h2>
        <div className="flex flex-wrap gap-1"><Badge variant="outline">{GROUP_LABEL[e.group]}</Badge><Badge variant="outline">Typ: {e.type}</Badge><Badge variant="outline">{st(e.reviewStatus)}</Badge>{e.stoffart && <Badge variant="outline">{e.stoffart}</Badge>}{e.chipCard && <Badge variant="outline">ChipCard (Programm laut Datensatz)</Badge>}{e.manufacturerField && <Badge variant="outline">Herstellerfeld: {e.manufacturerField}</Badge>}{e.drug && <Badge variant="outline">Arzneimittel (laut Datensatz) · {rxLabel(e.rx)}</Badge>}{e.nutrient && <Badge variant="outline">{NUTRIENT_LABEL[e.nutrient]}{e.nutrient === "trace" ? " (Untergruppe Mineralstoffe)" : ""}</Badge>}</div>
        <p className="text-xs text-muted-foreground">Ein zentraler Eintrag: dieselben Verknüpfungen erscheinen bei Anbieter, Symptom und Erkrankung.</p>
        <p className="text-muted-foreground">Beschreibungen aus Hersteller-/Autorenmaterial sind Quellenangaben – keine bestätigte Wirksamkeit oder Therapieempfehlung.</p>
        <div><p className="font-semibold">Anbieter/Personen</p>{makers.length ? <ul>{makers.map(({ actor: a, kind }) => <li key={a.key} className="flex flex-wrap items-center gap-2"><button className="underline" onClick={() => set({ v: "actors", id: a.key })}>{a.name}</button><LinkBadge kind={kind} /></li>)}</ul> : <p className="text-muted-foreground">Kein Anbieter im Datensatz hinterlegt.</p>}</div>
        {e.stoffart === "Stoff" && <div><p className="font-semibold">Produkte mit diesem Stoff ({prods.length})</p>{prods.length ? <ul>{prods.map(({ product, kind }) => <li key={product.id} className="flex flex-wrap items-center gap-2">{entButton(product.id)}<LinkBadge kind={kind} /></li>)}</ul> : <p className="text-muted-foreground">Inhaltsstoffe der Produkte sind für diesen Stoff nicht strukturiert hinterlegt.</p>}</div>}
        {byGroup.map(([g, xs]) => (
          <div key={g}><p className="font-semibold">{GROUP_LABEL[g]} ({xs.length})</p>
            <ul className="space-y-1">{xs.map(({ relation: r, other, direction }) => (
              <li key={r.id + direction} className="flex flex-wrap items-center gap-2">
                {direction === "out" ? <>{RELATION_LABEL[r.type] ?? r.type} → {entButton(other!.id)}</> : <>{entButton(other!.id)} → {RELATION_LABEL[r.type] ?? r.type}</>}
                <LinkBadge kind="import" /><Badge variant="secondary" className="text-[10px]">{st(r.status)}</Badge>
                {actorsOfEntity(m, other!.id).map(({ actor: a }) => <button key={a.key} className="text-xs underline" onClick={() => set({ v: "actors", id: a.key })}>Anbieter: {a.name}</button>)}
                <span className="text-xs text-muted-foreground">{r.sourceRevisionId ? (() => { const s = m.sources.get(r.sourceRevisionId!); return `Quelle: ${s?.title ?? "nicht lesbar"}${s ? ` (Rev. ${s.revision_no})` : ""}${r.locator ? ` · ${r.locator}` : ""}`; })() : "Keine Quelle verknüpft"}</span>
              </li>
            ))}</ul>
          </div>
        ))}
        {nb.length === 0 && <p>Keine Importverknüpfungen zu anderen Begriffen.</p>}
        {texts.length > 0 && <div><p className="font-semibold">Artikel mit Namen im Titel ({texts.length})</p><ul className="space-y-1">{texts.slice(0, 200).map((x) => artLine(x, "text"))}</ul></div>}
      </CardContent></Card>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {crumbs}
        <h1 className="mb-1 text-2xl font-semibold">Wikidatenbank – Ordnung {view !== "start" && `· ${VIEW_LABEL[view]}`}</h1>
        <p className="mb-4 text-sm text-muted-foreground">Nur lesend, nur für Admins. Alle Zuordnungen stammen aus vorhandenen Daten und sind gekennzeichnet; nichts ist fachlich freigegeben.</p>
        {body}
      </div>
    </Layout>
  );
}
