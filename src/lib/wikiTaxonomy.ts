/**
 * Read-only ordering of the Wikidatenbank from existing tables only.
 * Link quality is always explicit:
 *  - "import"   = structured link from an import candidate (real FK chain), not reviewed
 *  - "field"    = exact data field (publisher, author, entity type, category folder)
 *  - "text"     = text hit in title/category only ("Treffer im Quelltext"), never a confirmed link
 */
export type GroupKey = "products" | "pathogens" | "symptoms" | "diseases" | "other";
export type NutrientClass = "vitamins" | "minerals" | "trace";
export type LinkKind = "import" | "field" | "text";
export type ActorRole = "Hersteller" | "Herausgeber" | "Autor" | "Ordner" | "Von Peter benannt";

export const GROUP_LABEL: Record<GroupKey, string> = {
  products: "Mittel/Produkte",
  pathogens: "Pathogene",
  symptoms: "Symptome",
  diseases: "Erkrankungen",
  other: "Weitere Begriffe",
};

const TYPE_GROUP: Record<string, GroupKey> = {
  product: "products", product_variant: "products", substance: "products", plant: "products", nutrient: "products",
  pathogen: "pathogens", symptom: "symptoms", disease: "diseases",
};
export const NUTRIENT_LABEL: Record<NutrientClass, string> = { vitamins: "Vitamine", minerals: "Mineralstoffe", trace: "Spurenelemente" };
/** Classification by substance name (standard nutrition nomenclature), only for entities stored as nutrient. Trace elements are a subgroup of minerals. */
const TRACE = ["eisen", "jod", "kupfer", "mangan", "selen", "zink", "chrom", "molybdan", "fluor", "kobalt"];
const MACRO = ["magnesium", "calcium", "kalzium", "kalium", "natrium", "phosphor", "chlorid", "schwefel"];
export function nutrientClass(type: string, name: string): NutrientClass | undefined {
  if (type !== "nutrient") return undefined;
  const n = ` ${norm(name)} `;
  if (/ vitamin | folsaure | folat | biotin | niacin | riboflavin | thiamin | cobalamin /.test(n)) return "vitamins";
  if (TRACE.some((t) => n.includes(` ${t} `))) return "trace";
  if (MACRO.some((t) => n.includes(` ${t} `))) return "minerals";
  return undefined;
}
/** Substance (single compound/plant) vs product (stored product record, may contain several ingredients). */
export const stoffart = (type: string): "Stoff" | "Produkt" | undefined =>
  ["nutrient", "substance", "plant"].includes(type) ? "Stoff" : ["product", "product_variant"].includes(type) ? "Produkt" : undefined;

export const groupOfType = (t: string | null | undefined): GroupKey => (t && TYPE_GROUP[t]) || "other";

export const RELATION_LABEL: Record<string, string> = {
  may_support: "kann unterstützen (laut Quelle)",
  indicated_for: "angegeben für (laut Quelle)",
  targets_pathogen: "richtet sich auf Pathogen (laut Quelle)",
  manifests_as: "zeigt sich als (laut Quelle)",
  contains: "enthält",
  part_of_protocol: "Teil des Protokolls",
  measured_by: "gemessen mit",
  manufactured_by: "hergestellt von",
};

/** Names Peter confirmed. Aliases only for spelling variants actually present in the stock. */
export const PETER_ACTORS: Array<{ key: string; name: string; aliases: string[] }> = [
  { key: "nutramedix", name: "Nutramedix", aliases: ["nutramedix", "nutra medix"] },
  { key: "heel", name: "Heel", aliases: ["heel"] },
  { key: "klinghardt", name: "Dr. Klinghardt", aliases: ["klinghardt"] },
  { key: "pascoe", name: "Pascoe", aliases: ["pascoe"] },
];

export interface EntityIn { id: string; entity_type_code: string; current_revision_id: string | null }
export interface EntityRevIn { id: string; entity_id: string; display_name: string; review_status: string }
export interface CoreLinkIn { candidate_kind: string; candidate_id: string; core_record_kind: string; core_entity_id: string | null; core_source_revision_id: string | null }
export interface RelationIn { id: string; subject_candidate_id: string | null; object_candidate_id: string | null; proposed_relation_type_code: string | null; candidate_status: string; source_candidate_id: string | null; source_locator: string | null }
export interface ArticleIn { id: string; current_revision_id: string | null; article_kind: string }
export interface ArticleRevIn { id: string; article_id: string; revision_no: number; title: string; category_path: string | null; review_status: string }
export interface SourceIn { id: string; current_revision_id: string | null }
export interface SourceRevIn { id: string; source_id: string; revision_no: number; title: string | null; publisher: string | null; authors: string[] | null; review_status: string }

export interface Entity { id: string; name: string; type: string; group: GroupKey; revisionId: string; reviewStatus: string; nutrient?: NutrientClass; stoffart?: "Stoff" | "Produkt" }
export interface Relation { id: string; subjectId?: string; objectId?: string; type: string; status: string; sourceRevisionId?: string; locator?: string | null }
export interface Article { id: string; revisionId: string; revisionNo: number; title: string; category: string; kind: string; reviewStatus: string; folders: string[] }
export interface Actor {
  key: string; name: string; roles: Set<ActorRole>;
  folderArticleIds: Set<string>; sourceRevisionIds: Set<string>; entityIds: Set<string>; textArticleIds: Set<string>;
  /** Product/term whose stored name contains the actor name – text hit, to be checked. */
  textEntityIds: Set<string>;
  /** Full-text hits in article content (loaded separately, server-side word match). */
  fullTextArticleIds: Set<string>;
}
export interface WikiModel {
  entities: Map<string, Entity>; relations: Relation[]; articles: Map<string, Article>;
  sources: Map<string, SourceRevIn>; actors: Map<string, Actor>; folders: Map<string, Set<string>>;
  missingRevisions: { articles: number; entities: number; sources: number };
  unassignedArticleIds: string[]; unassignedEntityIds: string[];
  articleTextEntities: Map<string, Set<string>>;
}

export const norm = (s: string) => s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const wordHit = (hay: string, alias: string) => ` ${hay} `.includes(` ${alias} `);

/** Category folders: path segments after the practice/root prefixes (exact field, no guessing). */
export function foldersOf(category: string | null): string[] {
  if (!category) return [];
  const parts = category.split(">").map((p) => p.trim()).filter(Boolean);
  return parts.filter((p) => !/^(naturheilpraxis peter rauch|interne quellen|importpruefung)$/i.test(p));
}

export function buildWikiModel(i: {
  entities: EntityIn[]; entityRevisions: EntityRevIn[]; coreLinks: CoreLinkIn[]; relations: RelationIn[];
  articles: ArticleIn[]; articleRevisions: ArticleRevIn[]; sources: SourceIn[]; sourceRevisions: SourceRevIn[];
}): WikiModel {
  const missing = { articles: 0, entities: 0, sources: 0 };
  const eRev = new Map(i.entityRevisions.map((r) => [r.id, r]));
  const entities = new Map<string, Entity>();
  for (const e of i.entities) {
    const r = e.current_revision_id ? eRev.get(e.current_revision_id) : undefined;
    if (!r || r.entity_id !== e.id) { missing.entities++; continue; }
    entities.set(e.id, { id: e.id, name: r.display_name, type: e.entity_type_code, group: groupOfType(e.entity_type_code), revisionId: r.id, reviewStatus: r.review_status, nutrient: nutrientClass(e.entity_type_code, r.display_name), stoffart: stoffart(e.entity_type_code) });
  }
  const sRev = new Map(i.sourceRevisions.map((r) => [r.id, r]));
  const sources = new Map<string, SourceRevIn>();
  for (const s of i.sources) {
    const r = s.current_revision_id ? sRev.get(s.current_revision_id) : undefined;
    if (!r || r.source_id !== s.id) { missing.sources++; continue; }
    sources.set(r.id, r);
  }
  const candEntity = new Map<string, string>(), candSource = new Map<string, string>();
  for (const l of i.coreLinks) {
    if (l.core_record_kind === "entity" && l.core_entity_id) candEntity.set(l.candidate_id, l.core_entity_id);
    if (l.core_record_kind === "source" && l.core_source_revision_id) candSource.set(l.candidate_id, l.core_source_revision_id);
  }
  const relations: Relation[] = i.relations.map((r) => ({
    id: r.id,
    subjectId: r.subject_candidate_id ? candEntity.get(r.subject_candidate_id) : undefined,
    objectId: r.object_candidate_id ? candEntity.get(r.object_candidate_id) : undefined,
    type: r.proposed_relation_type_code ?? "unbestimmt",
    status: r.candidate_status,
    sourceRevisionId: r.source_candidate_id ? candSource.get(r.source_candidate_id) : undefined,
    locator: r.source_locator,
  }));

  const aRev = new Map(i.articleRevisions.map((r) => [r.id, r]));
  const articles = new Map<string, Article>();
  const folders = new Map<string, Set<string>>();
  for (const a of i.articles) {
    const r = a.current_revision_id ? aRev.get(a.current_revision_id) : undefined;
    if (!r || r.article_id !== a.id) { missing.articles++; continue; }
    const f = foldersOf(r.category_path);
    articles.set(a.id, { id: a.id, revisionId: r.id, revisionNo: r.revision_no, title: r.title, category: r.category_path ?? "", kind: a.article_kind, reviewStatus: r.review_status, folders: f });
    f.forEach((x) => { if (!folders.has(x)) folders.set(x, new Set()); folders.get(x)!.add(a.id); });
  }

  // Actors: Peter-named + exact data fields (manufacturer entities, publisher, authors).
  const actors = new Map<string, Actor>();
  const actor = (key: string, name: string) => {
    if (!actors.has(key)) actors.set(key, { key, name, roles: new Set(), folderArticleIds: new Set(), sourceRevisionIds: new Set(), entityIds: new Set(), textArticleIds: new Set(), textEntityIds: new Set(), fullTextArticleIds: new Set() });
    return actors.get(key)!;
  };
  const aliasesOf = new Map<string, string[]>();
  for (const p of PETER_ACTORS) { actor(p.key, p.name).roles.add("Von Peter benannt"); aliasesOf.set(p.key, p.aliases); }
  const keyFor = (name: string) => {
    const n = norm(name);
    const peter = PETER_ACTORS.find((p) => p.aliases.some((al) => wordHit(n, al)));
    return peter ? peter.key : n;
  };
  for (const e of entities.values()) if (e.type === "manufacturer") { const a = actor(keyFor(e.name), e.name); a.roles.add("Hersteller"); a.entityIds.add(e.id); }
  for (const s of sources.values()) {
    if (s.publisher?.trim()) { const a = actor(keyFor(s.publisher), s.publisher.trim()); a.roles.add("Herausgeber"); a.sourceRevisionIds.add(s.id); }
    for (const au of s.authors ?? []) if (au?.trim()) { const a = actor(keyFor(au), au.trim()); a.roles.add("Autor"); a.sourceRevisionIds.add(s.id); }
  }
  // Products manufactured_by an actor's manufacturer entity (import link).
  for (const r of relations) if (r.type === "manufactured_by" && r.objectId) for (const a of actors.values()) if (a.entityIds.has(r.objectId) && r.subjectId) a.entityIds.add(r.subjectId);
  // Folder assignment only when folder name equals an actor alias/name (exact, normalized).
  for (const [folder, ids] of folders) {
    const n = norm(folder);
    for (const a of actors.values()) {
      const al = aliasesOf.get(a.key) ?? [norm(a.name)];
      if (al.includes(n)) { a.roles.add("Ordner"); ids.forEach((id) => a.folderArticleIds.add(id)); }
    }
  }
  // Text hits (title/category) – only for Peter-named actors, clearly labelled.
  const normTitles = new Map([...articles.values()].map((a) => [a.id, norm(`${a.title} ${a.category}`)]));
  for (const p of PETER_ACTORS) {
    const a = actors.get(p.key)!;
    for (const [id, t] of normTitles) if (!a.folderArticleIds.has(id) && p.aliases.some((al) => wordHit(t, al))) a.textArticleIds.add(id);
  }
  // Products whose stored name contains an actor name (e.g. "Mannayan ZINK+") – text hit only.
  for (const a of actors.values()) {
    const al = aliasesOf.get(a.key) ?? [norm(a.name)].filter((x) => x.length >= 4 && x.split(" ").length <= 2);
    for (const e of entities.values()) if (e.stoffart === "Produkt" && !a.entityIds.has(e.id) && al.some((x) => wordHit(norm(e.name), x))) a.textEntityIds.add(e.id);
  }
  // Entity text hits in article titles (names ≥ 4 chars, word match).
  const articleTextEntities = new Map<string, Set<string>>();
  const titleOnly = new Map([...articles.values()].map((a) => [a.id, norm(a.title)]));
  for (const e of entities.values()) {
    const n = norm(e.name);
    if (n.length < 4) continue;
    for (const [id, t] of titleOnly) if (wordHit(t, n)) { if (!articleTextEntities.has(e.id)) articleTextEntities.set(e.id, new Set()); articleTextEntities.get(e.id)!.add(id); }
  }
  const assignedArticles = new Set<string>();
  actors.forEach((a) => { a.folderArticleIds.forEach((x) => assignedArticles.add(x)); a.textArticleIds.forEach((x) => assignedArticles.add(x)); });
  articleTextEntities.forEach((s) => s.forEach((x) => assignedArticles.add(x)));
  const related = new Set<string>();
  relations.forEach((r) => { if (r.subjectId) related.add(r.subjectId); if (r.objectId) related.add(r.objectId); });
  actors.forEach((a) => { a.entityIds.forEach((x) => related.add(x)); a.textEntityIds.forEach((x) => related.add(x)); });
  return {
    entities, relations, articles, sources, actors, folders, missingRevisions: missing, articleTextEntities,
    unassignedArticleIds: [...articles.keys()].filter((id) => !assignedArticles.has(id)),
    unassignedEntityIds: [...entities.keys()].filter((id) => !related.has(id) && !articleTextEntities.has(id)),
  };
}

/** Bidirectional neighbours of an entity via import relations (never via text hits). */
export interface Neighbour { relation: Relation; other: Entity | undefined; direction: "out" | "in" }
export function neighbours(m: WikiModel, entityId: string): Neighbour[] {
  return m.relations.flatMap((r): Neighbour[] => {
    if (r.subjectId === entityId && r.objectId) return [{ relation: r, other: m.entities.get(r.objectId), direction: "out" as const }];
    if (r.objectId === entityId && r.subjectId) return [{ relation: r, other: m.entities.get(r.subjectId), direction: "in" as const }];
    return [];
  }).filter((x) => x.other);
}

/** Multi-word AND search; diacritics/case-insensitive. */
export const matchesAll = (hay: string, q: string) => {
  const terms = norm(q).split(" ").filter(Boolean);
  const h = ` ${norm(hay)} `;
  return terms.every((t) => h.includes(t));
};

export const paginate = <T,>(xs: T[], page: number, size: number) => {
  const pages = Math.max(1, Math.ceil(xs.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: xs.slice((p - 1) * size, p * size), page: p, pages, total: xs.length };
};

/** Actors linked to an entity (import link or name text hit). */
export function actorsOfEntity(m: WikiModel, entityId: string) {
  return [...m.actors.values()].flatMap((a) => a.entityIds.has(entityId) ? [{ actor: a, kind: "import" as "import" | "text" }] : a.textEntityIds.has(entityId) ? [{ actor: a, kind: "text" as const }] : []);
}

/** Products that contain a substance: stored "contains" relation, else product name naming the substance (text hit). */
export function productsWithSubstance(m: WikiModel, substanceId: string) {
  const s = m.entities.get(substanceId);
  if (!s) return [];
  const viaRel = new Set(m.relations.filter((r) => r.type === "contains" && r.objectId === substanceId && r.subjectId).map((r) => r.subjectId!));
  const n = norm(s.name);
  return [...m.entities.values()].filter((e) => e.stoffart === "Produkt").flatMap((e) =>
    viaRel.has(e.id) ? [{ product: e, kind: "import" as "import" | "text" }] : n.length >= 3 && wordHit(norm(e.name), n) ? [{ product: e, kind: "text" as const }] : []);
}
