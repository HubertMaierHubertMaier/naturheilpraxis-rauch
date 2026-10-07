/**
 * Read-only source evidence per article: follows only real FK/link chains
 * article → import core link (entity candidate) → dosage/safety/relation candidates with
 * subject_candidate_id = that entity candidate → core link (assertion) → kb_assertion_sources → kb_source_revisions.
 * No matching by title/URL, so evidence is never cross-assigned.
 */
export interface CoreLinkRow { candidate_kind: string; candidate_id: string; core_record_kind: string; core_article_id: string | null; core_assertion_id: string | null }
export interface AssertionRow { id: string; version_no: number; assertion_kind: string; claim_text: string; review_status: string }
export interface AssertionSourceRow { assertion_id: string; source_revision_id: string; source_role: string; locator: string | null; original_quote: string | null; is_primary: boolean }
export interface SourceRevisionRow { id: string; revision_no: number; title: string | null; source_type: string | null; publisher: string | null; review_status: string; rights_status: string | null }

export interface AssertionEvidence {
  assertion: AssertionRow;
  sources: Array<AssertionSourceRow & { revision?: SourceRevisionRow }>;
}

export type EvidenceResult =
  | { state: "unavailable"; message: string }
  | { state: "error"; message: string }
  | { state: "none"; reason: "no-core-link" | "no-assertions" }
  | { state: "ok"; items: AssertionEvidence[] };

export const MISSING_TABLE = /does not exist|schema cache|could not find/i;

export function assembleEvidence(
  assertionIds: string[],
  assertions: AssertionRow[],
  links: AssertionSourceRow[],
  revisions: SourceRevisionRow[],
): AssertionEvidence[] {
  const want = new Set(assertionIds);
  const rev = new Map(revisions.map((r) => [r.id, r]));
  return assertions
    .filter((a) => want.has(a.id))
    .map((assertion) => ({
      assertion,
      sources: links.filter((l) => l.assertion_id === assertion.id).map((l) => ({ ...l, revision: rev.get(l.source_revision_id) })),
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };
type Res<T> = { data: T[] | null; error: { message: string } | null };

const chunk = <T,>(xs: T[], n = 150) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
async function inQuery<T>(db: Db, table: string, cols: string, col: string, ids: string[]): Promise<Res<T>> {
  const out: T[] = [];
  for (const part of chunk(ids)) {
    const r: Res<T> = await db.from(table).select(cols).in(col, part);
    if (r.error) return r;
    out.push(...(r.data ?? []));
  }
  return { data: out, error: null };
}

export async function loadArticleEvidence(db: Db, articleId: string): Promise<EvidenceResult> {
  const fail = (e: { message: string }): EvidenceResult =>
    MISSING_TABLE.test(e.message) ? { state: "unavailable", message: e.message } : { state: "error", message: e.message };
  const art: Res<CoreLinkRow> = await db.from("kb_import_core_links").select("candidate_kind, candidate_id, core_record_kind, core_article_id, core_assertion_id").eq("core_article_id", articleId).eq("candidate_kind", "entity");
  if (art.error) return fail(art.error);
  const entityCandidates = (art.data ?? []).map((r) => r.candidate_id);
  if (!entityCandidates.length) return { state: "none", reason: "no-core-link" };
  const cand: string[] = [];
  for (const t of ["kb_dosage_candidates", "kb_safety_candidates", "kb_relation_candidates"]) {
    const r = await inQuery<{ id: string }>(db, t, "id", "subject_candidate_id", entityCandidates);
    if (r.error) return fail(r.error);
    cand.push(...(r.data ?? []).map((x) => x.id));
  }
  if (!cand.length) return { state: "none", reason: "no-assertions" };
  const cl = await inQuery<CoreLinkRow>(db, "kb_import_core_links", "candidate_kind, candidate_id, core_record_kind, core_article_id, core_assertion_id", "candidate_id", cand);
  if (cl.error) return fail(cl.error);
  const assertionIds = [...new Set((cl.data ?? []).filter((r) => r.core_record_kind === "assertion" && r.core_assertion_id).map((r) => r.core_assertion_id!))];
  if (!assertionIds.length) return { state: "none", reason: "no-assertions" };
  const a = await inQuery<AssertionRow>(db, "kb_assertions", "id, version_no, assertion_kind, claim_text, review_status", "id", assertionIds);
  if (a.error) return fail(a.error);
  const s = await inQuery<AssertionSourceRow>(db, "kb_assertion_sources", "assertion_id, source_revision_id, source_role, locator, original_quote, is_primary", "assertion_id", assertionIds);
  if (s.error) return fail(s.error);
  const revIds = [...new Set((s.data ?? []).map((x) => x.source_revision_id))];
  const r = revIds.length ? await inQuery<SourceRevisionRow>(db, "kb_source_revisions", "id, revision_no, title, source_type, publisher, review_status, rights_status", "id", revIds) : { data: [], error: null };
  if (r.error) return fail(r.error);
  return { state: "ok", items: assembleEvidence(assertionIds, a.data ?? [], s.data ?? [], r.data ?? []) };
}
