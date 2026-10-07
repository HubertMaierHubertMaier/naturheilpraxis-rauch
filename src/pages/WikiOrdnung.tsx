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
import { SiboGasProfiles } from "@/components/wiki/SiboGasProfiles";
import { GAS_CANDIDATES } from "@/lib/siboGasProfiles";
import { fetchAllPages, wikiErrorText } from "@/lib/wikiFetchAll";
import { buildDryRun } from "@/lib/wikiNetworkDryRun";
import { AXES, CHAPTERS, COMPENDIUM, episodeGroup, filterCards, independentEpisodes, KLINGHARDT_PUBLISHER, LANGUAGE_PAIRS, overlapMatrix, toCard, currentCardsOnly, type AxisKey, type KCard } from "@/lib/klinghardtNavigator";
import { CATEGORY_LABEL, SOURCE_RELATIONS, splitDryRunActors, type ActorCategory } from "@/lib/wikiReviewedNetwork";
import { groupByProduct, STRUNZ_AREA } from "@/lib/strunzAreaCandidates";
import { STRUNZ_SOURCES, TYP_LABEL } from "@/lib/strunzSourceCandidates";
import {
  actorsOfEntity, buildWikiModel, GROUP_LABEL, matchesAll, neighbours, NUTRIENT_LABEL, paginate, PETER_ACTORS, pharmacyNamesInText, productsWithSubstance, rejectedContains, revealWindow, splitRevisionHits, rxLabel, norm, MANNAYAN_ALIAS, TOPICS, topicHits, EXTERNAL_PHARMACIES, RELATION_LABEL,
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

type View = "start" | "topic" | "actors" | "pharmacies" | "mannayan" | "chipcards" | "drugs" | "reviewed" | "klinghardt" | "gasprofile" | GroupKey | NutrientClass | "folders" | "unassigned";
const NUTRIENT_VIEWS: NutrientClass[] = ["vitamins", "minerals", "trace"];
const isNutrientView = (v: View): v is NutrientClass => (NUTRIENT_VIEWS as string[]).includes(v);
const VIEW_LABEL: Record<View, string> = { start: "Übersicht", topic: "Themen & Personen", actors: "Firmen & Personen", pharmacies: "Apotheken", mannayan: "Mannayan-Produkte", chipcards: "ChipCards", drugs: "Ärztliche Mittel / Arzneimittel", reviewed: "Geprüfte Zuordnungen", klinghardt: "Klinghardt-Navigator", gasprofile: "3 Gasprofile (SIBO)", ...GROUP_LABEL, ...NUTRIENT_LABEL, folders: "Ordner (Kategoriepfad)", unassigned: "Noch nicht zugeordnet" };

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

const TILE = "flex h-full w-full flex-col gap-1 rounded-lg border-2 border-primary/30 bg-card p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** Einheitliche Wiki-Kachel: Name oben, Zusatzangaben darunter; ganze Kachel öffnet den Eintrag (ohne verschachtelte Buttons). */
function WikiTile({ title, meta, onOpen }: { title: string; meta?: React.ReactNode; onOpen?: () => void }) {
  const inner = <><span className="font-semibold leading-snug text-foreground">{title}</span>{meta && <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">{meta}</span>}</>;
  return onOpen ? <button type="button" onClick={onOpen} className={TILE}>{inner}</button> : <div className={TILE.replace(/ hover:\S+/g, "")}>{inner}</div>;
}

/** List with visible count and "Weitere Treffer zeigen" – all entries reachable. */
function RevealList<T>({ items, render, label = "Treffer" }: { items: T[]; render: (x: T) => JSX.Element | null; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [items.length]);
  const w = revealWindow(items, shown);
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{w.visible.map(render)}</ul>
      {w.total > 0 && w.total > 200 && <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{w.shown} von {w.total} {label} angezeigt
        {w.remaining > 0 && <><Button size="sm" variant="outline" onClick={() => setShown(w.next)}>Weitere {w.next - w.shown} zeigen</Button><Button size="sm" variant="ghost" onClick={() => setShown(w.total)}>Alle {w.total} zeigen</Button></>}</p>}
    </>
  );
}

export default function WikiOrdnung() {
  const { user, loading: authLoading, isAdmin, roleChecked } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadModel>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fullText, setFullText] = useState<Record<string, ReturnType<typeof splitRevisionHits> | "loading" | "error">>({});
  const [kCards, setKCards] = useState<KCard[] | "loading" | "error" | null>(null);
  const searchFullText = async (a: Actor) => {
    const al = PETER_ACTORS.find((p) => p.key === a.key)?.aliases ?? [a.name.toLowerCase()];
    setFullText((x) => ({ ...x, [a.key]: "loading" }));
    const pattern = `(^|[^[:alpha:]])(${al.map((x) => x.replace(/[^a-z0-9 ]/gi, "").replace(/ /g, "[ -]?")).join("|")})([^[:alpha:]]|$)`;
    const r = await fetchAllPages((f, t) => db.from("kb_article_revisions").select("id, article_id").filter("content_markdown", "imatch", pattern).order("id", { ascending: true }).range(f, t));
    setFullText((x) => ({ ...x, [a.key]: r.error ? "error" : splitRevisionHits(r.data as { id: string; article_id: string }[], m!.articles) }));
  };
  const view = (params.get("v") as View) || "start";
  const m = data?.model;
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
  useEffect(() => {
    if (!isAdmin || view !== "klinghardt" || kCards !== null) return;
    setKCards("loading");
    fetchAllPages((f, t) => db.from("kb_source_revisions").select("id, revision_no, title, key:metadata->candidate_snapshot->>candidate_key, locator:metadata->candidate_snapshot->>source_locator, tags:metadata->candidate_snapshot->proposed_data->tags, topics:metadata->candidate_snapshot->proposed_data->therapeutic_topics, content:metadata->candidate_snapshot->proposed_data->>content").eq("publisher", KLINGHARDT_PUBLISHER).order("id", { ascending: true }).range(f, t))
      .then((r) => { if (r.error) return setKCards("error"); setKCards((r.data as never[]).map(toCard)); });
  }, [isAdmin, view, kCards]);
  const kCurrent = useMemo(() => currentCardsOnly(kCards, m ? new Set([...m.sources.values()].map((s) => s.id)) : null), [kCards, m]);

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
    return <li key={aid}><WikiTile title={a.title} meta={<><Badge variant="secondary" className="text-[10px]">Artikel · Rev. {a.revisionNo} · {st(a.reviewStatus)}</Badge><LinkBadge kind={kind} /></>} /></li>;
  };
  const srcText = (sid: string) => {
    const s = m!.allSourceRevisions.get(sid);
    if (!s) return "Quellenrevision nicht lesbar";
    const cur = m!.sources.get(s.id) ? "aktuelle Revision" : "ältere Revision – so gespeichert, nicht durch aktuelle ersetzt";
    return `${s.title || "Quelle ohne Titel"} (interne Quelle, Rev. ${s.revision_no}, ${cur}, ${st(s.review_status)})`;
  };
  const srcLine = (sid: string, extra?: string) => <li key={sid + (extra ?? "")}>{srcText(sid)}{extra ? ` · Fundstelle: ${extra}` : ""}</li>;
  const HitLists = ({ ft, label }: { ft: ReturnType<typeof splitRevisionHits>; label: string }) => (
    <>
      <p className="text-xs text-muted-foreground">{ft.current.length} Artikel {label} <LinkBadge kind="text" /></p>
      <RevealList items={ft.current} render={(x) => artLine(x, "text")} label="aktuelle Treffer" />
      {ft.historical.length > 0 && <>
        <p className="mt-2 text-xs font-semibold">Nur in älteren Revisionen gefunden ({ft.historical.length}) – nicht im aktuellen Text</p>
        <RevealList items={ft.historical} label="historische Treffer" render={(x) => <li key={x} className="flex flex-wrap items-center gap-2"><span>{m!.articles.get(x)!.title}</span><Badge variant="outline" className="text-[10px]">historischer Treffer · {ft.historicalRevisionIds.get(x)!.size} ältere Rev.</Badge><Badge variant="secondary" className="text-[10px]">aktuell Rev. {m!.articles.get(x)!.revisionNo}</Badge></li>} />
      </>}
    </>
  );

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
      ["klinghardt", "Klinghardt-Navigator (Quellenkarten)", [...m.sources.values()].filter((s) => s.publisher === KLINGHARDT_PUBLISHER).length],
      ["gasprofile", "3 Gasprofile (SIBO: H₂, CH₄, H₂S)", GAS_CANDIDATES.length],
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
          <Button size="sm" onClick={() => set({ v: "reviewed" })}>Geprüfte Zuordnungen &amp; Quellenbeziehungen ansehen</Button>
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
  } else if (view === "gasprofile") {
    body = <SiboGasProfiles />;
  } else if (view === "klinghardt") {
    const kc = kCurrent;
    const axes = (params.get("ax") ?? "").split(",").filter(Boolean) as AxisKey[];
    const chapter = params.get("kap");
    if (kc === null || kc === "loading") body = <p>Lädt Quellenkarten …</p>;
    else if (kc === "error") body = <p className="text-destructive">Quellenkarten nicht lesbar.</p>;
    else {
      const list = filterCards(kc, { chapter, axes, q });
      const pg = paginate(list, page, PAGE);
      const mx = overlapMatrix(kc);
      const open = id ? kc.find((c) => c.revisionId === id) : undefined;
      body = (
        <div className="space-y-4 text-sm">
          <Card><CardContent className="space-y-1 p-4">
            <p className="font-semibold">Klinghardt-Navigator – Talks 001–025</p>
            <p>Im Wiki vorhanden: <b>{kc.length} Praxis-Quellenkarten</b> (aktuelle Revisionen). Kompendium-Bestand laut PDF: {COMPENDIUM.sourceCards} Quellenkarten, {COMPENDIUM.themeRows} Themenzeilen, {COMPENDIUM.pages} Seiten – <b>nicht</b> vollständig importiert.</p>
            <p className="text-xs text-muted-foreground">PDF SHA-256 {COMPENDIUM.pdfSha256} · Quellregister DOCX SHA-256 {COMPENDIUM.docxSha256}. Sprecheraussagen sind Originalaussagen; Quellenprüfung/Sicherheit stehen getrennt. Achsen = Texttreffer, keine Diagnose- oder Wirkzuordnung.</p>
            <p className="text-xs">Unabhängige Folgen in Auswahl: {independentEpisodes(list)} (Sprachpaare {LANGUAGE_PAIRS.map((p) => p.join("/")).join(", ")} zählen je einmal).</p>
          </CardContent></Card>
          <div className="grid gap-2 sm:grid-cols-3">{CHAPTERS.map((ch) => <button key={ch} onClick={() => set({ kap: chapter === ch ? null : ch, id: null })} className={`rounded-lg border-2 bg-card p-3 text-left ${chapter === ch ? "border-primary" : "border-primary/30"}`}><p className="font-semibold">{ch}</p><p className="text-xs text-muted-foreground">{filterCards(kc, { chapter: ch }).length} Karten</p></button>)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" placeholder="Karten durchsuchen (Mehrwort)" value={q} onChange={(e) => set({ q: e.target.value || null, id: null })} aria-label="Klinghardt-Karten durchsuchen" />
            {AXES.map((a) => <Button key={a.key} size="sm" variant={axes.includes(a.key) ? "default" : "outline"} onClick={() => { const n = axes.includes(a.key) ? axes.filter((x) => x !== a.key) : [...axes, a.key]; set({ ax: n.join(",") || null, id: null }); }}>{a.label} ({mx[a.key][a.key]})</Button>)}
          </div>
          <details><summary className="cursor-pointer font-semibold">Überschneidungsmatrix der Achsen (Karten mit beiden Begriffen)</summary>
            <table className="mt-1 text-xs"><thead><tr><th />{AXES.map((a) => <th key={a.key} className="px-2">{a.label}</th>)}</tr></thead><tbody>{AXES.map((a) => <tr key={a.key}><th className="pr-2 text-left">{a.label}</th>{AXES.map((b) => <td key={b.key} className="px-2 text-center">{mx[a.key][b.key]}</td>)}</tr>)}</tbody></table>
            <p className="text-xs text-muted-foreground">Gemeinsame Nennung im selben Mehrthemen-Eintrag ist keine Relation.</p></details>
          {open ? (
            <Card><CardContent className="space-y-2 p-4">
              <Button size="sm" variant="outline" onClick={() => set({ id: null })}>Zurück zur Liste</Button>
              <h2 className="text-lg font-semibold">{open.title}</h2>
              <div className="flex flex-wrap gap-1">{open.chapters.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}<Badge variant="outline">Rev. {open.revisionNo}</Badge>{open.speaker && <Badge variant="outline">Sprecher: {open.speaker}</Badge>}</div>
              <p><b>Fundstelle:</b> {open.locator || "–"} · Folgen {open.episodes.map(episodeGroup).join(", ")} · {open.eIds.join(", ")}</p>
              <div className="rounded border border-border p-2"><p className="font-semibold">Originalaussage (Sprecher)</p><p className="whitespace-pre-wrap">{open.claim}</p>{open.remedies && <><p className="mt-1 font-semibold">Genannte Mittel/Verfahren</p><p className="whitespace-pre-wrap">{open.remedies}</p></>}{open.dose && <><p className="mt-1 font-semibold">Angaben laut Video (ungeprüft)</p><p className="whitespace-pre-wrap">{open.dose}</p></>}</div>
              <div className="rounded border border-border p-2"><p className="font-semibold">Quellenprüfung / Evidenzeinordnung (getrennt)</p><p className="whitespace-pre-wrap">{open.evidence || "–"}</p>{open.safety && <><p className="mt-1 font-semibold">Sicherheit</p><p className="whitespace-pre-wrap">{open.safety}</p></>}</div>
              <details><summary className="cursor-pointer font-semibold">Komplette Quellenkarte (unverändert)</summary><pre className="whitespace-pre-wrap text-xs">{open.content}</pre></details>
            </CardContent></Card>
          ) : (
            <>
              <p className="text-muted-foreground">{list.length} von {kc.length} Karten</p>
              <ul className="space-y-1">{pg.items.map((c) => <li key={c.revisionId}><button className="text-left underline" onClick={() => set({ id: c.revisionId })}>{c.title}</button> <span className="text-xs text-muted-foreground">· {c.chapters.join(", ")} · {c.locator}</span></li>)}</ul>
              <Pager {...pg} set={(p) => set({ s: String(p) })} />
            </>
          )}
        </div>
      );
    }
  } else if (view === "reviewed") {
    const dry = buildDryRun(m);
    const split = splitDryRunActors(dry);
    const srcIdsOf = (name: string) => [...m.sources.values()].filter((s) => norm(s.publisher ?? "") === norm(name) || (s.authors ?? []).some((a) => norm(a) === norm(name))).map((s) => s.id);
    const cats = Object.keys(CATEGORY_LABEL) as ActorCategory[];
    body = (
      <div className="space-y-4 text-sm">
        <Card><CardContent className="space-y-1 p-4">
          <p className="font-semibold">Redaktionell geprüft (Codex-Routine 07.10.2026) – Dateistand</p>
          <p className="text-muted-foreground">Diese Zuordnungen sind fachlich durchgesehen, in der Datenbank aber weiterhin Entwürfe. Keine Wirk- oder Nachweisaussage. Ungeprüfte Kandidaten stehen getrennt darunter.</p>
        </CardContent></Card>
        {cats.map((c) => { const list = split.reviewed.filter((x) => x.review.category === c); return list.length === 0 ? null : (
          <div key={c}><p className="mb-1 font-semibold">{CATEGORY_LABEL[c]} ({list.length})</p>
            <ul className="space-y-2">{list.map(({ display_name, review: rv }) => { const sids = srcIdsOf(display_name); return (
              <li key={display_name} className="rounded border border-border bg-card p-2">
                <div className="flex flex-wrap items-center gap-1"><span className="font-semibold">{display_name}</span><Badge variant="outline">geprüft · {rv.certainty}</Badge></div>
                <p className="text-muted-foreground">{rv.reason}</p>
                {rv.linkedTo && <p className="text-xs">{rv.linkedTo.kind === "alias_belegt" ? "Alias (belegt)" : rv.linkedTo.kind === "website_von" ? "Website von" : "Nicht zusammengeführt (Merge-Hinweis)"}: {rv.linkedTo.name}{rv.linkedTo.fundstelle ? ` · Fundstelle: ${rv.linkedTo.fundstelle}` : ""}</p>}
                {sids.length > 0 && <details><summary className="cursor-pointer text-xs">Belegquellen ({sids.length})</summary><ul className="list-disc pl-5">{sids.map((s) => srcLine(s))}</ul></details>}
              </li>); })}</ul>
          </div>); })}
        <Card><CardContent className="p-4">
          <p className="font-semibold">Ungeprüfte Akteurskandidaten ({split.unreviewed.length})</p>
          {split.unreviewed.length === 0 ? <p className="text-muted-foreground">Alle {dry.actors.length} Probelauf-Akteure sind redaktionell eingeordnet.</p> : <ul className="list-disc pl-5">{split.unreviewed.map((n) => <li key={n}>{n} <LinkBadge kind="text" /></li>)}</ul>}
        </CardContent></Card>
        <div><p className="mb-1 font-semibold">Quellenbeziehungen der Stichprobe – vollständig belegt ({SOURCE_RELATIONS.filter((s) => s.complete).length})</p>
          {[true, false].map((done) => <ul key={String(done)} className="mb-3 space-y-2">{!done && <p className="font-semibold">Unvollständig – Beleg fehlt ({SOURCE_RELATIONS.filter((s) => !s.complete).length})</p>}{SOURCE_RELATIONS.filter((s) => s.complete === done).map((s) => (
            <li key={s.key} className="rounded border border-border bg-card p-2">
              <div className="flex flex-wrap items-center gap-1"><span className="font-semibold">{s.label}</span><Badge variant="outline">{done ? "Belege vollständig" : "unvollständig"} · {s.certainty}</Badge><Badge variant="outline">nicht in DB angewendet</Badge></div>
              <p className="text-xs">Fundstelle: {s.fundstelle}</p>
              {s.sourceRevisionId && <ul className="list-disc pl-5 text-xs">{srcLine(s.sourceRevisionId)}</ul>}
              <ul className="list-disc pl-5">{s.relations.map((x) => <li key={x.ui}>{x.ui} · Code: {x.code ?? "kein Code"}{x.note ? ` · ${x.note}` : ""}</li>)}</ul>
              {s.missing && <p className="text-xs text-destructive">Fehlt: {s.missing}</p>}
            </li>))}</ul>)}
        </div>
        <Card><CardContent className="p-4">
          <p className="font-semibold">Strunz-Anwendungsbereiche → Produktkarten: ungeprüfte Quellenkandidaten ({STRUNZ_AREA.kandidaten.length})</p>
          <p className="text-xs text-muted-foreground">Abgerufen {STRUNZ_AREA.abgerufen}. {STRUNZ_AREA.bedeutung} Weitere {STRUNZ_AREA.produkte_ohne_karte} gelistete Produkte haben keine Wiki-Karte. <Badge variant="outline">nicht in DB angewendet</Badge></p>
          <ul className="mt-2 space-y-1">{groupByProduct(STRUNZ_AREA.kandidaten).map(([k, xs]) => (
            <li key={k}><span className="font-semibold">{xs[0].product_name}</span> <span className="text-xs">({k}) – gelistet in {xs.length}: {xs.map((x) => <a key={x.article_id} href={x.page_url} target="_blank" rel="noreferrer" className="underline mr-1">{x.area} (Pos. {x.position})</a>)}</span></li>
          ))}</ul>
          <p className="mt-2 text-xs text-muted-foreground">Folgeseiten geprüft: {(STRUNZ_AREA as any).pagination_pruefung?.alle_vollstaendig ? "alle 21 Listen vollständig auf Seite 1 (Shop-Gesamtzahl = Produktlinks, ?p=2 ohne neue Produkte)" : "nicht verifiziert"}. Ohne Karte: {(STRUNZ_AREA as any).ungemappt_aufteilung?.eindeutig} eindeutige Produkte, {(STRUNZ_AREA as any).ungemappt_aufteilung?.varianten} Varianten in {(STRUNZ_AREA as any).ungemappt_aufteilung?.variantengruppen} Gruppen (nicht zusammengeführt). Vollständigkeit gilt nur für diese 21 Seiten, nicht für das Gesamtsortiment.</p>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">149 Produkte ohne Karte – Abgleich mit Wiki-Bestand ({Object.entries((STRUNZ_AREA as any).ungemappt_abgleich?.ergebnis ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ")})</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produkte_ohne_karte_liste ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.name}</a> <Badge variant="outline">{x.einordnung === "variante_offen" ? `Variante: ${x.variantengruppe}` : "eindeutig"}</Badge> <Badge variant={x.abgleich.status === "kein_treffer" ? "outline" : "secondary"}>{x.abgleich.status === "moeglicher_treffer_name" ? "nur Name gleich (Stoffkarte, kein Produkt)" : x.abgleich.status === "treffer_url" ? "URL-Treffer" : "kein Treffer"}</Badge> <span className="text-muted-foreground">{x.fundstellen.map((f: any) => `${f.bereich} #${f.position}`).join(", ")}</span></li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 1: {(STRUNZ_AREA as any).produktquellen_teil1?.ergebnisse?.length ?? 0} von 136 eindeutigen Produktseiten gelesen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil1?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.join(", ") ?? <span className="text-destructive">nicht angegeben</span>} · Marke laut Seite: {x.marke_laut_seite ?? "–"} · Hersteller: {x.hersteller ?? <span className="text-destructive">offen</span>} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 2 (25–48): {(STRUNZ_AREA as any).produktquellen_teil2?.ergebnisse?.length ?? 0} Produktseiten gelesen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil2?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.length ? x.ean.join(", ") : <span className="text-destructive">nicht angegeben</span>} · Marke laut Seite: {x.marke_laut_seite ?? "–"} · Hersteller: <span className="text-destructive">offen</span>{x.rohstoff_textfund ? ` · ${x.rohstoff_textfund}` : ""} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 3 (49–72): {(STRUNZ_AREA as any).produktquellen_teil3?.ergebnisse?.length ?? 0} Produktseiten gelesen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil3?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.length ? x.ean.join(", ") : <span className="text-destructive">nicht angegeben</span>} · Marke laut Seite: {x.marke_laut_seite ?? "–"} · Hersteller: <span className="text-destructive">offen</span>{x.rohstoff_textfund ? ` · ${x.rohstoff_textfund}` : ""} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 4 (73–96): {(STRUNZ_AREA as any).produktquellen_teil4?.ergebnisse?.length ?? 0} Produktseiten gelesen, mit wörtlichen Fundstellen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil4?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.length ? `${x.ean.join(", ")} („${x.ean_fundstelle.wortlaut}“)` : <span className="text-destructive">nicht angegeben</span>} · Marke: {x.marke_laut_seite ? `${x.marke_laut_seite} (${x.marke_fundstelle.feld}: „${x.marke_fundstelle.wortlaut}“)` : "–"} · Hersteller: <span className="text-destructive">offen</span>{x.hinweis ? ` · ${x.hinweis}` : ""} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 5 (97–120): {(STRUNZ_AREA as any).produktquellen_teil5?.ergebnisse?.length ?? 0} Produktseiten gelesen, mit wörtlichen Fundstellen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil5?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.length ? `${x.ean.join(", ")} („${x.ean_fundstelle.wortlaut}“)` : <span className="text-destructive">nicht angegeben</span>} · Marke: {x.marke_laut_seite ? `${x.marke_laut_seite} (${x.marke_fundstelle.feld}: „${x.marke_fundstelle.wortlaut}“)` : "–"} · Hersteller: <span className="text-destructive">offen</span>{x.hinweis ? ` · ${x.hinweis}` : ""}{x.ean_hinweis ? ` · ${x.ean_hinweis}` : ""} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Mögliche Varianten: {(STRUNZ_AREA as any).produktquellen_varianten?.ergebnisse?.length ?? 0} Seiten gelesen (Gruppen = Hypothesen, keine bestätigte Identität)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_varianten?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1}</a> · Gruppe (Hypothese): {x.variantengruppe_hypothese} · EAN {x.ean.join(", ")} · Marke: {x.marke_laut_seite} (H1) · Auswahl: {x.auswahloptionen.length ? x.auswahloptionen.join(" / ") : "keine"} · {x.gruppenbeleg} · Hersteller: <span className="text-destructive">offen</span> · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Produktquellen Teil 6 (121–136): {(STRUNZ_AREA as any).produktquellen_teil6?.ergebnisse?.length ?? 0} Produktseiten gelesen, mit wörtlichen Fundstellen (ungeprüfte Quellenkandidaten)</summary>
            <ul className="mt-1 space-y-1">{((STRUNZ_AREA as any).produktquellen_teil6?.ergebnisse ?? []).map((x: any) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.produktname_h1 ?? x.url}</a> · EAN {x.ean?.length ? `${x.ean.join(", ")} („${x.ean_fundstelle.wortlaut}“)` : <span className="text-destructive">nicht angegeben</span>} · Marke: {x.marke_laut_seite ? `${x.marke_laut_seite} (${x.marke_fundstelle.feld}: „${x.marke_fundstelle.wortlaut}“)` : "offen"} · Hersteller: <span className="text-destructive">offen</span>{x.hinweis ? ` · ${x.hinweis}` : ""}{x.ean_hinweis ? ` · ${x.ean_hinweis}` : ""} · abgerufen {x.abgerufen}</li>
            ))}</ul>
          </details>
          <p className="mt-2 text-xs text-muted-foreground">Beleg der 69 Treffer (lesende Abfrage {(STRUNZ_AREA as any).beleg_69?.geprueft}): {(STRUNZ_AREA as any).beleg_69?.ergebnis?.artikel_existent}/19 Artikel, {(STRUNZ_AREA as any).beleg_69?.ergebnis?.revision_ist_aktuell}/19 aktuelle Revisionen, {(STRUNZ_AREA as any).beleg_69?.ergebnis?.entity_existent}/9 Einträge, {(STRUNZ_AREA as any).beleg_69?.ergebnis?.url_identisch_mit_kandidat}/69 Produktquellen-URLs identisch.</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="font-semibold">Strunz-Staging-Quellkandidaten (Batch {STRUNZ_SOURCES.batch_id.slice(0, 8)}): {STRUNZ_SOURCES.anzahl}</p>
          <p className="text-xs text-muted-foreground">Lesend geprüft {STRUNZ_SOURCES.geprueft}. {STRUNZ_SOURCES.regel}. <Badge variant="outline">ungeprüft · nicht in DB angewendet</Badge></p>
          <ul className="mt-2 space-y-1 text-xs">{STRUNZ_SOURCES.kandidaten.map((c) => (
            <li key={c.candidate_id}><Badge variant={c.product_key ? "secondary" : "outline"}>{TYP_LABEL[c.typ] ?? c.typ}</Badge> <span className="font-mono">{c.candidate_key.replace(/^source:/, "")}</span> → {c.product_key ?? <span className="text-destructive">offen</span>} · Rev. {c.core_source_revision_id?.slice(0, 8) ?? "–"} · {c.source_url ? <a href={c.source_url} target="_blank" rel="noreferrer" className="underline">Quelle</a> : (c.fundstelle ?? "keine Fundstelle")}</li>
          ))}</ul>
        </CardContent></Card>
      </div>
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
        {a.folderArticleIds.size > 0 && <div><p className="font-semibold">Artikel im Ordner ({a.folderArticleIds.size})</p><RevealList items={[...a.folderArticleIds]} render={(x) => artLine(x, "field")} label="Artikel" /></div>}
        {a.textArticleIds.size > 0 && <div><p className="font-semibold">Treffer im Quelltext ({a.textArticleIds.size})</p><RevealList items={[...a.textArticleIds]} render={(x) => artLine(x, "text")} label="Artikel" /></div>}
        <div><p className="font-semibold">Volltext der Artikel</p>{(() => { const ft = fullText[a.key]; return ft === undefined ? <Button size="sm" variant="outline" onClick={() => searchFullText(a)}>Volltext durchsuchen</Button> : ft === "loading" ? <p>Sucht …</p> : ft === "error" ? <p className="text-destructive">Volltextsuche nicht möglich.</p> : <HitLists ft={ft} label="nennen den Namen in der aktuellen Revision" />; })()}</div>
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
        <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((x) => { const e = x.k === "e" ? ent(x.id) : undefined; return <li key={x.id}>{x.k === "e" ? <WikiTile title={e?.name ?? x.id} meta="Begriff" onOpen={e ? () => set({ v: e.drug ? "drugs" : e.chipCard ? "chipcards" : e.nutrient ?? e.group, id: x.id, q: null }) : undefined} /> : <WikiTile title={x.t} meta="Artikel" />}</li>; })}</ul>
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
        <div><p className="font-semibold">Artikel im Ordner ({filt(h.folderArticleIds).length}) <LinkBadge kind="field" /></p><RevealList items={filt(h.folderArticleIds)} render={(x) => artLine(x, "field")} label="Artikel" /></div>
        {h.titleArticleIds.length > 0 && <div><p className="font-semibold">Name nur im Titel ({filt(h.titleArticleIds).length})</p><RevealList items={filt(h.titleArticleIds)} render={(x) => artLine(x, "text")} label="Artikel" /></div>}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <WikiTile key={e.id} title={e.name} onOpen={() => set({ id: e.id })} meta={<>Typ {e.type} · {neighbours(m, e.id).length} Verknüpfungen{neighbours(m, e.id).length === 0 ? " (keine Themen/Symptome zugeordnet)" : ""}</>} />)}</div>
        {list.length === 0 && <p className="text-sm">Keine Datensätze in dieser Rubrik.</p>}
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
        {textProducts.length > 0 && <div className="mt-3 text-sm"><p className="font-semibold">Produkte mit „Mannayan" nur im Namen, ohne Herstellerfeld ({textProducts.length}) <LinkBadge kind="text" /></p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{textProducts.map((e) => <WikiTile key={e.id} title={e.name} meta={<>Typ {e.type}</>} onOpen={() => set({ id: e.id })} />)}</div></div>}
        {!isM && <div className="mt-4 space-y-3 text-sm">
          <div><p className="font-semibold">Artikel im Ordner/Titel „Chip Cards" ({chipArticles.length}) <LinkBadge kind="field" /></p><RevealList items={chipArticles} render={(a) => artLine(a.id, "field")} label="Artikel" /></div>
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
      const r = await fetchAllPages((f, t) => db.from("kb_article_revisions").select("id, article_id").filter("content_markdown", "imatch", "(arzneimittel|medikament|verschreibungspflichtig|rezeptpflichtig)").order("id", { ascending: true }).range(f, t));
      setFullText((x) => ({ ...x, __drugs: r.error ? "error" : (() => { const sp = splitRevisionHits(r.data as { id: string; article_id: string }[], m.articles); const ok = (aid: string) => !kl || kl.folderArticleIds.has(aid) || kl.textArticleIds.has(aid); return { ...sp, current: sp.current.filter(ok), historical: sp.historical.filter(ok) }; })() }));
    };
    const pg = paginate(list, page, PAGE);
    body = (
      <>
        <Card className="mb-3"><CardContent className="space-y-1 p-4 text-sm">
          <p>Wissensnavigation – keine Verordnung und keine Anwendungsfreigabe. Als Arzneimittel gilt ein Eintrag nur, wenn sein Datensatz das ausdrücklich angibt (Begriffstyp oder hinterlegte Art); eine bloße Erwähnung, etwa in den Klinghardt-Unterlagen, reicht nicht. Verschreibungsstatus nur, wenn im Datensatz hinterlegt, sonst „unklar".</p>
        </CardContent></Card>
        <Input className="mb-3 max-w-xs" placeholder="Arzneimittel suchen" value={q} onChange={(e) => set({ q: e.target.value || null })} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <WikiTile key={e.id} title={e.name} onOpen={() => set({ id: e.id })} meta={<>{rxLabel(e.rx)} · {neighbours(m, e.id).length} Verknüpfungen</>} />)}</div>
        {list.length === 0 && <p className="text-sm font-semibold">Im Bestand ist derzeit kein Eintrag als Arzneimittel strukturiert erfasst (kein Begriffstyp „Arzneimittel", keine PZN/ATC-Kennung, keine hinterlegte Produktart).</p>}
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
        {kl && <div className="mt-4 text-sm"><p className="font-semibold">Dr. Klinghardt: {kl.sourceRevisionIds.size} interne Quellen, {kl.folderArticleIds.size} Ordner-Artikel <LinkBadge kind="field" /></p>
          <p className="text-muted-foreground">Dort genannte Mittel sind noch nicht als eigene Einträge erfasst. <button className="underline" onClick={() => set({ v: "actors", id: "klinghardt" })}>Zu Dr. Klinghardt</button></p></div>}
        <div className="mt-3 text-sm"><p className="font-semibold">Klinghardt-Artikel, die „Arzneimittel/Medikament/verschreibungspflichtig" im Text nennen</p>{ft === undefined ? <Button size="sm" variant="outline" onClick={searchDrugText}>Volltext durchsuchen</Button> : ft === "loading" ? <p>Sucht …</p> : ft === "error" ? <p className="text-destructive">Volltextsuche nicht möglich.</p> : <HitLists ft={ft} label="in der aktuellen Revision – keine Einstufung als Arzneimittel" />}</div>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <WikiTile key={e.id} title={e.name} onOpen={() => set({ id: e.id })} meta={<>{view === "minerals" && e.nutrient === "trace" ? " · Spurenelement" : ""} · {neighbours(m, e.id).length} Verknüpfungen · {productsWithSubstance(m, e.id).length} Produkte</>} />)}</div>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pg.items.map((e) => <WikiTile key={e.id} title={e.name} onOpen={() => set({ id: e.id })} meta={<>{neighbours(m, e.id).length} Verknüpfungen</>} />)}</div>
        <div className="mt-3"><Pager {...pg} set={(p) => set({ s: String(p) })} /></div>
      </>
    );
  } else {
    const e = m.entities.get(id);
    const nb = e ? neighbours(m, e.id) : [];
    const byGroup = (["products", "pathogens", "symptoms", "diseases", "other"] as GroupKey[]).map((g) => [g, nb.filter((x) => x.other!.group === g)] as const).filter(([, xs]) => xs.length);
    const makers = e ? actorsOfEntity(m, e.id) : [];
    const prods = e && e.stoffart === "Stoff" ? productsWithSubstance(m, e.id) : [];
    const rejProds = e && e.stoffart === "Stoff" ? rejectedContains(m, e.id) : [];
    const texts = e ? [...(m.articleTextEntities.get(e.id) ?? [])] : [];
    body = !e ? <p>Nicht gefunden.</p> : (
      <Card><CardContent className="space-y-3 p-4 text-sm">
        <h2 className="text-xl font-semibold">{e.name}</h2>
        <div className="flex flex-wrap gap-1"><Badge variant="outline">{GROUP_LABEL[e.group]}</Badge><Badge variant="outline">Typ: {e.type}</Badge><Badge variant="outline">{st(e.reviewStatus)}</Badge>{e.stoffart && <Badge variant="outline">{e.stoffart}</Badge>}{e.chipCard && <Badge variant="outline">ChipCard (Programm laut Datensatz)</Badge>}{e.manufacturerField && <Badge variant="outline">Herstellerfeld: {e.manufacturerField}</Badge>}{e.drug && <Badge variant="outline">Arzneimittel (laut Datensatz) · {rxLabel(e.rx)}</Badge>}{e.nutrient && <Badge variant="outline">{NUTRIENT_LABEL[e.nutrient]}{e.nutrient === "trace" ? " (Untergruppe Mineralstoffe)" : ""}</Badge>}</div>
        <p className="text-xs text-muted-foreground">Ein zentraler Eintrag: dieselben Verknüpfungen erscheinen bei Anbieter, Symptom und Erkrankung.</p>
        <p className="text-muted-foreground">Beschreibungen aus Hersteller-/Autorenmaterial sind Quellenangaben – keine bestätigte Wirksamkeit oder Therapieempfehlung.</p>
        <div><p className="font-semibold">Anbieter/Personen</p>{makers.length ? <ul>{makers.map(({ actor: a, kinds }) => <li key={a.key} className="flex flex-wrap items-center gap-2"><button className="underline" onClick={() => set({ v: "actors", id: a.key })}>{a.name}</button>{kinds.map((k) => <LinkBadge key={k} kind={k} />)}</li>)}</ul> : <p className="text-muted-foreground">Kein Anbieter im Datensatz hinterlegt.</p>}</div>
        {e.stoffart === "Stoff" && <div><p className="font-semibold">Produkte mit diesem Stoff ({prods.length})</p>{prods.length ? <ul>{prods.map(({ product, kind, status }) => <li key={product.id} className="flex flex-wrap items-center gap-2">{entButton(product.id)}<LinkBadge kind={kind} />{status && <Badge variant="secondary" className="text-[10px]">{st(status)}</Badge>}</li>)}</ul> : <p className="text-muted-foreground">Inhaltsstoffe der Produkte sind für diesen Stoff nicht strukturiert hinterlegt.</p>}</div>}
        {rejProds.length > 0 && <div className="rounded border border-dashed border-border p-2"><p className="text-xs font-semibold">Im Prüfkontext abgelehnt/Dublette ({rejProds.length}) – keine gültige Zuordnung</p><ul className="text-xs">{rejProds.map(({ product, status, relationId }) => <li key={relationId} className="flex flex-wrap items-center gap-2"><span>{product.name}</span><Badge variant="outline" className="text-[10px]">enthält – {st(status)}</Badge></li>)}</ul></div>}
        {byGroup.map(([g, xs]) => (
          <div key={g}><p className="font-semibold">{GROUP_LABEL[g]} ({xs.length})</p>
            <ul className="space-y-1">{xs.map(({ relation: r, other, direction }) => (
              <li key={r.id + direction} className="flex flex-wrap items-center gap-2">
                {direction === "out" ? <>{RELATION_LABEL[r.type] ?? r.type} → {entButton(other!.id)}</> : <>{entButton(other!.id)} → {RELATION_LABEL[r.type] ?? r.type}</>}
                <LinkBadge kind="import" /><Badge variant="secondary" className="text-[10px]">{st(r.status)}</Badge>
                {actorsOfEntity(m, other!.id).map(({ actor: a }) => <button key={a.key} className="text-xs underline" onClick={() => set({ v: "actors", id: a.key })}>Anbieter: {a.name}</button>)}
                <span className="text-xs text-muted-foreground">{r.sourceRevisionId ? `Quelle: ${srcText(r.sourceRevisionId)}${r.locator ? ` · ${r.locator}` : ""}` : "Keine Quelle verknüpft"}</span>
              </li>
            ))}</ul>
          </div>
        ))}
        {nb.length === 0 && <p>Keine Importverknüpfungen zu anderen Begriffen.</p>}
        {texts.length > 0 && <div><p className="font-semibold">Artikel mit Namen im Titel ({texts.length})</p><RevealList items={texts} render={(x) => artLine(x, "text")} label="Artikel" /></div>}
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
