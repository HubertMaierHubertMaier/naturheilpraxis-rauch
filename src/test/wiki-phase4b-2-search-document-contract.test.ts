// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateWikiSnapshotShape } from "../../supabase/functions/_shared/wikiSnapshotValidation";

const migrationFiles = [
  "20260728090000_create_kb_phase1_core.sql",
  "20260728130000_create_kb_phase2_legacy_bridge.sql",
  "20260728140000_create_kb_phase3_import_staging.sql",
  "20260728150000_create_kb_source_draft_promotion.sql",
  "20260729140000_create_kb_therapeutic_catalog.sql",
  "20260730140000_create_kb_entity_candidate_contract.sql",
  "20260730150000_create_kb_entity_draft_promotion.sql",
  "20260731120000_create_therapy_input_envelope.sql",
  "20260731130000_create_therapy_input_facts.sql",
  "20260801090000_create_kb_release_contract.sql",
  "20260801100000_create_kb_clinical_rule_contract.sql",
  "20260802090000_create_kb_search_document_contract.sql",
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const searchMigration = migrations.at(-1)!;
const releaseMigration = migrations.at(-3)!;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const plantId = "30000000-0000-4000-8000-000000000001";
const plantRevisionId = "31000000-0000-4000-8000-000000000001";
const diseaseId = "30000000-0000-4000-8000-000000000002";
const diseaseRevisionId = "31000000-0000-4000-8000-000000000002";
const assertionId = "40000000-0000-4000-8000-000000000001";
const articleId = "50000000-0000-4000-8000-000000000001";
const articleRevisionId = "51000000-0000-4000-8000-000000000001";
const releaseId = "60000000-0000-4000-8000-000000000001";

const wikiSnapshotTables = [
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_articles", "kb_article_revisions", "kb_article_entities", "kb_change_proposals",
  "kb_import_batches", "kb_source_candidates", "kb_entity_candidates", "kb_relation_candidates",
  "kb_dosage_candidates", "kb_safety_candidates", "kb_review_decisions", "kb_import_errors",
  "kb_entity_candidate_contracts", "kb_entity_candidate_names", "kb_entity_candidate_assertions",
  "kb_entity_candidate_assertion_sources", "kb_entity_candidate_preparation_details",
  "kb_entity_candidate_homeopathic_details", "kb_entity_candidate_botanical_details",
  "kb_entity_candidate_nutrient_details", "kb_entity_candidate_product_variant_details",
  "kb_entity_candidate_components", "kb_source_candidate_draft_promotions",
  "kb_entity_candidate_draft_promotions", "kb_entity_candidate_draft_promotion_assertions",
  "kb_preparation_revision_details", "kb_homeopathic_revision_details",
  "kb_botanical_revision_details", "kb_nutrient_revision_details",
  "kb_product_variant_revision_details", "kb_composition_components",
  "kb_dosage_rules", "kb_safety_rules", "kb_safety_rule_conditions",
  "kb_releases", "kb_release_items", "kb_search_documents",
  "faqs", "practice_pricing", "practice_info",
] as const;

const historicalZeroValidationKeys = [
  "missing_articles",
  "invalid_current_snapshots",
  "orphaned_active_articles",
  "invalid_source_promotions",
  "invalid_therapeutic_catalog_revisions",
  "invalid_entity_candidate_contracts",
  "invalid_entity_candidate_draft_promotions",
  "invalid_knowledge_releases",
  "invalid_dosage_rules",
  "invalid_safety_rules",
  "invalid_search_documents",
] as const;

let db: PGlite;

async function enterRole(role: string, identity?: string): Promise<void> {
  await db.exec(`SET ROLE ${role};`);
  if (identity) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [identity]);
  }
}

async function leaveRole(): Promise<void> {
  await db.exec("RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
}

async function releaseRevision(
  table: "kb_source_revisions" | "kb_entity_revisions" | "kb_assertions" | "kb_article_revisions",
  id: string,
  usesSafetyReview: boolean,
): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (usesSafetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved',
           reviewed_at = '2026-08-02T05:00:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'released', released_at = '2026-08-02T05:01:00Z'
     WHERE id = $1::uuid
  `, [id]);
}

async function createBuildRelease(id: string, key: string): Promise<void> {
  await db.query(`
    WITH manifest AS (
      SELECT $1::uuid AS id, $2::text AS release_key,
             public.kb_release_manifest_v1($1::uuid, $2::text) AS value
    )
    INSERT INTO public.kb_releases (
      id, release_key, release_manifest, release_manifest_hash
    )
    SELECT id, release_key, value, public.kb_release_manifest_hash_v1(value)
      FROM manifest
  `, [id, key]);
}

type ItemReference = {
  kind: "entity_revision" | "article_revision" | "assertion" | "source_revision";
  entityId?: string;
  entityRevisionId?: string;
  articleId?: string;
  articleRevisionId?: string;
  assertionId?: string;
  sourceId?: string;
  sourceRevisionId?: string;
};

async function addReleaseItem(
  targetReleaseId: string,
  itemOrder: number,
  reference: ItemReference,
): Promise<void> {
  await db.query(`
    WITH manifest AS (
      SELECT public.kb_release_item_manifest_v1(
        $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::uuid, $10::uuid
      ) AS value
    )
    INSERT INTO public.kb_release_items (
      release_id, item_order, item_kind,
      entity_id, entity_revision_id, article_id, article_revision_id,
      assertion_id, source_id, source_revision_id,
      item_manifest, item_manifest_hash
    )
    SELECT $1::uuid, $2::integer, $3::text,
           $4::uuid, $5::uuid, $6::uuid, $7::uuid,
           $8::uuid, $9::uuid, $10::uuid,
           value, public.kb_release_manifest_hash_v1(value)
      FROM manifest
  `, [
    targetReleaseId,
    itemOrder,
    reference.kind,
    reference.entityId ?? null,
    reference.entityRevisionId ?? null,
    reference.articleId ?? null,
    reference.articleRevisionId ?? null,
    reference.assertionId ?? null,
    reference.sourceId ?? null,
    reference.sourceRevisionId ?? null,
  ]);
}

async function sealRelease(targetReleaseId: string): Promise<void> {
  await db.query(`
    UPDATE public.kb_releases release
       SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
           release_manifest_hash = public.kb_release_manifest_hash_v1(
             public.kb_release_manifest_v1(release.id, release.release_key)
           ),
           release_status = 'sealed', sealed_at = '2026-08-02T05:02:00Z'
     WHERE release.id = $1::uuid
  `, [targetReleaseId]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE authenticator NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin', 'patient');

    CREATE TABLE public.user_roles (
      user_id uuid NOT NULL,
      role public.app_role NOT NULL,
      UNIQUE (user_id, role)
    );

    CREATE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
         WHERE user_id = _user_id AND role = _role
      )
    $$;

    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

    CREATE FUNCTION public.update_updated_at_column()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

    CREATE TABLE public.admin_knowledge_base (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      category text NOT NULL DEFAULT 'General',
      tags text[] NOT NULL DEFAULT '{}',
      content text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      entry_kind text NOT NULL DEFAULT 'reference',
      review_status text NOT NULL DEFAULT 'unreviewed',
      evidence_level text NOT NULL DEFAULT 'unrated',
      dosage_status text NOT NULL DEFAULT 'unverified',
      rights_status text NOT NULL DEFAULT 'unknown',
      source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
      therapeutic_topics text[] NOT NULL DEFAULT '{}',
      contraindications text[] NOT NULL DEFAULT '{}',
      interaction_tags text[] NOT NULL DEFAULT '{}',
      safety_notes text NOT NULL DEFAULT '',
      patient_facing_allowed boolean NOT NULL DEFAULT false,
      commercial_claims_reviewed boolean NOT NULL DEFAULT false,
      last_reviewed_at timestamptz,
      reviewed_by uuid
    );
    CREATE TABLE public.mannayan_products (id uuid PRIMARY KEY);
    CREATE TABLE public.knowledge_product_links (id uuid PRIMARY KEY);
    CREATE TABLE public.faqs (id uuid PRIMARY KEY);
    CREATE TABLE public.practice_pricing (id uuid PRIMARY KEY);
    CREATE TABLE public.practice_info (id uuid PRIMARY KEY);
    CREATE TABLE public.patient_snapshot (
      pseudonym_id text PRIMARY KEY,
      snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
  `);

  for (const migration of migrations) {
    await db.exec(migration);
  }

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_identifier_schemes (
      code, label, is_globally_unique
    ) VALUES (
      'local_code', 'Scoped test code', false
    );
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:search-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'practice_rule',
      'Synthetic search source', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${plantId}', 'plant', 'plant:kuenstliche-heilpflanze'),
      ('${diseaseId}', 'disease', 'disease:synthetic-condition');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary, description_markdown,
      content_hash
    ) VALUES
      ('${plantRevisionId}', '${plantId}', 1, 'Künstliche Heilpflanze',
       'Eine geprüfte Pflanzenbeschreibung.', 'Traditioneller Anwendungstext.', repeat('2', 64)),
      ('${diseaseRevisionId}', '${diseaseId}', 1, 'Synthetic condition',
       'A controlled condition.', '', repeat('3', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${plantId}', '${diseaseId}');
    INSERT INTO public.kb_entity_names (
      entity_id, name, normalized_name, name_kind, language_code, is_preferred
    ) VALUES
      ('${plantId}', 'Künstliche Heilpflanze', 'künstliche heilpflanze', 'preferred', 'de', true),
      ('${plantId}', 'Heilkraut', 'heilkraut', 'spelling_variant', 'de', false);
    INSERT INTO public.kb_entity_identifiers (
      entity_id, scheme_code, namespace, value, normalized_value, is_primary
    ) VALUES
      ('${plantId}', 'pzn', NULL, '12345678', '12345678', true),
      ('${plantId}', 'local_code', 'a:b', 'c', 'c', false),
      ('${plantId}', 'local_code', 'a', 'b:c', 'b:c', false),
      ('${plantId}', 'local_code', 'case-upper', 'ABC', 'ABC', false),
      ('${plantId}', 'local_code', 'case-lower', 'abc', 'abc', false),
      ('${diseaseId}', 'local_code', 'collision',
       'identifier:["pzn", null, "12345678"]',
       'identifier:["pzn", null, "12345678"]', false);

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text,
      evidence_basis, evidence_quality, content_hash
    ) VALUES (
      '${assertionId}', 'assertion:search-relation', 1, 'entity_relation',
      'Die Heilpflanze wird im synthetischen Beispiel erwähnt.',
      'practice_rule', 'unrated', repeat('4', 64)
    );
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES ('${assertionId}', '${sourceRevisionId}', 'supports', 'S. 1', true);
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id,
      context_text
    ) VALUES (
      '${assertionId}', '${plantId}', 'may_support', '${diseaseId}',
      'Nur als strukturierter Suchkontext.'
    );

    INSERT INTO public.kb_articles (id, canonical_key, article_kind)
    VALUES ('${articleId}', 'article:search-contract', 'reference');
    INSERT INTO public.kb_article_revisions (
      id, article_id, revision_no, title, category_path, tags,
      content_markdown, content_hash
    ) VALUES (
      '${articleRevisionId}', '${articleId}', 1, 'Pflanzenartikel',
      'Naturheilkunde/Pflanzen', ARRAY['Kraut', 'Praxis', chr(9)],
      'Der Artikel enthält einen kontrollierten Volltext.', repeat('5', 64)
    );
    INSERT INTO public.kb_article_entities (article_revision_id, entity_id, role)
    VALUES ('${articleRevisionId}', '${plantId}', 'about');
    UPDATE public.kb_articles SET current_revision_id = '${articleRevisionId}'
     WHERE id = '${articleId}';
    COMMIT;
  `);

  await releaseRevision("kb_source_revisions", sourceRevisionId, false);
  await releaseRevision("kb_entity_revisions", plantRevisionId, true);
  await releaseRevision("kb_entity_revisions", diseaseRevisionId, true);
  await releaseRevision("kb_assertions", assertionId, true);
  await releaseRevision("kb_article_revisions", articleRevisionId, true);

  await createBuildRelease(releaseId, "release:search-contract-v1");
  await addReleaseItem(releaseId, 1, {
    kind: "entity_revision", entityId: plantId, entityRevisionId: plantRevisionId,
  });
  await addReleaseItem(releaseId, 2, {
    kind: "entity_revision", entityId: diseaseId, entityRevisionId: diseaseRevisionId,
  });
  await addReleaseItem(releaseId, 3, { kind: "assertion", assertionId });
  await addReleaseItem(releaseId, 4, {
    kind: "source_revision", sourceId, sourceRevisionId,
  });
  await addReleaseItem(releaseId, 5, {
    kind: "article_revision", articleId, articleRevisionId,
  });
  await sealRelease(releaseId);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki 4B-2a search document contract", () => {
  it("adds exactly one empty schema-only table at the 55-to-56 boundary", async () => {
    const createdTables = Array.from(
      searchMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual(["kb_search_documents"]);
    expect(searchMigration).toContain("exact 55-table Wiki boundary");
    expect(searchMigration).toMatch(/^BEGIN;/);
    expect(searchMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(searchMigration).not.toMatch(/INSERT INTO public\.kb_search_documents/);
    expect(searchMigration).not.toContain("therapy_input_");
    expect(searchMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(searchMigration).not.toMatch(/\bembedding\b/i);
    expect(searchMigration).not.toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.kb_(?:query|retrieve)_/i);
    expect(searchMigration).toContain("octet_length(payload::text) > 786432");
    expect(searchMigration).toContain("REFERENCING NEW TABLE AS inserted_search_documents");
    expect(searchMigration).toContain("WITH release_validity AS MATERIALIZED");
    expect(searchMigration).toContain("WITH ORDINALITY");
    expect(Array.from(
      searchMigration.matchAll(
        /CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\s*\(/g,
      ),
      (match) => match[1],
    )).toEqual([
      "kb_search_normalize_v1",
      "kb_search_text_array_is_valid_v1",
      "kb_search_document_item_payload_v1",
      "kb_search_document_payload_v1",
      "kb_search_vector_german_v1",
      "kb_search_vector_simple_v1",
      "kb_protect_search_document_write",
      "kb_guard_search_document_release_insert",
      "kb_search_document_matches_item_v1",
      "kb_search_document_is_valid",
      "kb_invalid_search_document_count",
      "kb_prevent_search_document_truncate",
      "kb_export_wiki_snapshot",
    ]);
    expect(releaseMigration).toContain("CHECK (NOT retrieval_eligible)");
    expect(releaseMigration).toContain("CHECK (NOT is_active)");

    const normalization = await db.query<{ value: string }>(
      "SELECT public.kb_search_normalize_v1($1) AS value",
      ["\t Foo \n Bar \t"],
    );
    expect(normalization.rows[0].value).toBe("foo bar");
    const blankArray = await db.query<{ value: boolean }>(`
      SELECT public.kb_search_text_array_is_valid_v1(ARRAY[chr(9)]) AS value
    `);
    expect(blankArray.rows[0].value).toBe(false);

    const state = await db.query<{
      documents: number;
      tables: number;
      serialized: number;
      manifest: number;
      invalid: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_search_documents) AS documents,
        (SELECT count(*)::int FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')) AS tables,
        (SELECT count(*)::int FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'serialized_tables')) AS serialized,
        (SELECT count(*)::int FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'manifest')) AS manifest,
        public.kb_invalid_search_document_count()::int AS invalid
    `);
    expect(state.rows[0]).toEqual({
      documents: 0,
      tables: 56,
      serialized: 56,
      manifest: 56,
      invalid: 0,
    });
  });

  it("materializes only searchable items from a valid sealed release", async () => {
    await db.query(`
      INSERT INTO public.kb_search_documents (release_id, release_item_id)
      SELECT item.release_id, item.id
        FROM public.kb_release_items item
       WHERE item.release_id = $1::uuid
         AND item.item_kind IN ('entity_revision', 'article_revision', 'assertion')
       ORDER BY item.item_order
    `, [releaseId]);

    const rows = await db.query<{
      document_kind: string;
      canonical_key: string;
      title: string;
      normalized_title: string;
      aliases: string[];
      normalized_aliases: string[];
      identifier_terms: string[];
      facet_terms: string[];
      source_titles: string[];
      payload_hash_matches: boolean;
      sealed_at_matches: boolean;
      valid: boolean;
    }>(`
      SELECT document.document_kind, document.canonical_key, document.title,
             document.normalized_title, document.aliases,
             document.normalized_aliases, document.identifier_terms,
             document.facet_terms, document.source_titles,
             document.projection_hash = public.kb_release_manifest_hash_v1(
               public.kb_search_document_payload_v1(document.release_item_id)
             ) AS payload_hash_matches,
             document.release_sealed_at = release.sealed_at AS sealed_at_matches,
             public.kb_search_document_is_valid(document.release_item_id) AS valid
        FROM public.kb_search_documents document
        JOIN public.kb_releases release ON release.id = document.release_id
       ORDER BY document.canonical_key
    `);
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((row) => row.valid)).toBe(true);
    expect(rows.rows.every((row) => row.payload_hash_matches)).toBe(true);
    expect(rows.rows.every((row) => row.sealed_at_matches)).toBe(true);

    const plant = rows.rows.find((row) => row.canonical_key === "plant:kuenstliche-heilpflanze")!;
    expect(plant).toMatchObject({
      document_kind: "entity_revision",
      title: "Künstliche Heilpflanze",
      normalized_title: "künstliche heilpflanze",
      aliases: ["Heilkraut"],
      normalized_aliases: ["heilkraut"],
      identifier_terms: [
        'identifier:["local_code", "a", "b:c"]',
        'identifier:["local_code", "a:b", "c"]',
        'identifier:["local_code", "case-lower", "abc"]',
        'identifier:["local_code", "case-upper", "ABC"]',
        'identifier:["pzn", null, "12345678"]',
        'identifier_value:"12345678"',
        'identifier_value:"ABC"',
        'identifier_value:"abc"',
        'identifier_value:"b:c"',
        'identifier_value:"c"',
      ],
      facet_terms: ["entity_type:plant"],
      source_titles: [],
    });

    const assertion = rows.rows.find((row) => row.document_kind === "assertion")!;
    expect(assertion.source_titles).toEqual(["Synthetic search source"]);
    expect(assertion.facet_terms).toContain("relation_type:may_support");

    const article = rows.rows.find((row) => row.document_kind === "article_revision")!;
    expect(article.facet_terms).toContain("tag:kraut");
    expect(article.facet_terms).not.toContain("tag:");

    const disease = rows.rows.find((row) => row.canonical_key === "disease:synthetic-condition")!;
    expect(disease.identifier_terms).toEqual([
      'identifier:["local_code", "collision", "identifier:[\\"pzn\\", null, \\"12345678\\"]"]',
      'identifier_value:"identifier:[\\"pzn\\", null, \\"12345678\\"]"',
    ]);

    const search = await db.query<{
      german_hits: number;
      simple_hits: number;
      alias_hits: number;
      identifier_hits: number;
    }>(`
      SELECT
        count(*) FILTER (
          WHERE search_vector_german @@ plainto_tsquery('pg_catalog.german', 'Heilpflanzen')
        )::int AS german_hits,
        count(*) FILTER (
          WHERE search_vector_simple @@ plainto_tsquery('pg_catalog.simple', '12345678')
        )::int AS simple_hits,
        count(*) FILTER (WHERE normalized_aliases @> ARRAY['heilkraut'])::int AS alias_hits,
        count(*) FILTER (
          WHERE identifier_terms @> ARRAY['identifier:["pzn", null, "12345678"]']
        )::int AS identifier_hits
        FROM public.kb_search_documents
    `);
    expect(search.rows[0]).toEqual({
      german_hits: 2,
      simple_hits: 2,
      alias_hits: 1,
      identifier_hits: 1,
    });
    expect(await db.query("SELECT public.kb_invalid_search_document_count()::int AS count"))
      .toMatchObject({ rows: [{ count: 0 }] });
  });

  it("keeps frozen aliases stable when live names later change", async () => {
    const before = await db.query<{ projection_hash: string; aliases: string[] }>(`
      SELECT projection_hash, aliases
        FROM public.kb_search_documents
       WHERE canonical_key = 'plant:kuenstliche-heilpflanze'
    `);
    await db.query(`
      INSERT INTO public.kb_entity_names (
        entity_id, name, normalized_name, name_kind, language_code
      ) VALUES ($1, 'Later live alias', 'later live alias', 'historical', 'en')
    `, [plantId]);
    const after = await db.query<{ projection_hash: string; aliases: string[]; valid: boolean }>(`
      SELECT document.projection_hash, document.aliases,
             public.kb_search_document_is_valid(document.release_item_id) AS valid
        FROM public.kb_search_documents document
       WHERE document.canonical_key = 'plant:kuenstliche-heilpflanze'
    `);
    expect(after.rows[0]).toEqual({ ...before.rows[0], valid: true });
  });

  it("rejects build releases, source items, and cross-release ownership", async () => {
    const buildReleaseId = "60000000-0000-4000-8000-000000000002";
    await createBuildRelease(buildReleaseId, "release:search-build-rejection");
    await addReleaseItem(buildReleaseId, 1, {
      kind: "entity_revision", entityId: plantId, entityRevisionId: plantRevisionId,
    });
    const buildItem = await db.query<{ id: string }>(`
      SELECT id FROM public.kb_release_items WHERE release_id = $1::uuid
    `, [buildReleaseId]);
    await expect(db.query(`
      INSERT INTO public.kb_search_documents (release_id, release_item_id)
      VALUES ($1::uuid, $2::uuid)
    `, [buildReleaseId, buildItem.rows[0].id]))
      .rejects.toThrow(/valid sealed release/i);

    const sourceItem = await db.query<{ id: string }>(`
      SELECT id FROM public.kb_release_items
       WHERE release_id = $1::uuid AND item_kind = 'source_revision'
    `, [releaseId]);
    await expect(db.query(`
      INSERT INTO public.kb_search_documents (release_id, release_item_id)
      VALUES ($1::uuid, $2::uuid)
    `, [releaseId, sourceItem.rows[0].id]))
      .rejects.toThrow(/valid sealed release/i);

    const plantItem = await db.query<{ id: string }>(`
      SELECT id FROM public.kb_release_items
       WHERE release_id = $1::uuid AND entity_id = $2::uuid
    `, [releaseId, plantId]);
    await db.exec("BEGIN;");
    try {
      await db.exec("ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
      await db.query("DELETE FROM public.kb_search_documents WHERE release_item_id = $1::uuid", [plantItem.rows[0].id]);
      await db.exec("ALTER TABLE public.kb_search_documents ENABLE TRIGGER USER;");
      await expect(db.query(`
        INSERT INTO public.kb_search_documents (release_id, release_item_id)
        VALUES ($1::uuid, $2::uuid)
      `, [buildReleaseId, plantItem.rows[0].id]))
        .rejects.toThrow(/does not own/i);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("validates each inserted batch against the complete sealed release", async () => {
    const articleItem = await db.query<{ id: string }>(`
      SELECT id FROM public.kb_release_items
       WHERE release_id = $1::uuid AND article_revision_id = $2::uuid
    `, [releaseId, articleRevisionId]);

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;
      ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;
      UPDATE public.kb_release_items
         SET item_manifest = item_manifest || '{"tampered":true}'::jsonb,
             item_manifest_hash = public.kb_release_manifest_hash_v1(
               item_manifest || '{"tampered":true}'::jsonb
             )
       WHERE release_id = '${releaseId}' AND item_kind = 'source_revision';
      DELETE FROM public.kb_search_documents
       WHERE release_item_id = '${articleItem.rows[0].id}';
      ALTER TABLE public.kb_release_items ENABLE TRIGGER USER;
      ALTER TABLE public.kb_search_documents ENABLE TRIGGER USER;
    `);
    try {
      await expect(db.query(`
        INSERT INTO public.kb_search_documents (release_id, release_item_id)
        VALUES ($1::uuid, $2::uuid)
      `, [releaseId, articleItem.rows[0].id]))
        .rejects.toThrow(/eligible items from valid sealed releases/i);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("detects trigger-bypassed vector and release-provenance tampering", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_search_documents
           SET search_vector_simple = to_tsvector('pg_catalog.simple', 'tampered')
         WHERE canonical_key = 'plant:kuenstliche-heilpflanze'
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_search_document_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_search_documents
           SET release_sealed_at = release_sealed_at + interval '1 second'
         WHERE canonical_key = 'plant:kuenstliche-heilpflanze'
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_search_document_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("enforces append-only owner writes and the read-only role matrix", async () => {
    await expect(db.query(`
      UPDATE public.kb_search_documents SET body_text = body_text || 'x'
    `)).rejects.toThrow(/append-only/i);
    await expect(db.query(`DELETE FROM public.kb_search_documents`))
      .rejects.toThrow(/append-only/i);
    await expect(db.exec("TRUNCATE TABLE public.kb_search_documents"))
      .rejects.toThrow(/cannot be truncated/i);

    await enterRole("authenticated", adminId);
    try {
      expect((await db.query("SELECT * FROM public.kb_search_documents")).rows).toHaveLength(4);
      await expect(db.query(`
        INSERT INTO public.kb_search_documents (release_id, release_item_id)
        VALUES ($1::uuid, gen_random_uuid())
      `, [releaseId])).rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", patientId);
    try {
      expect((await db.query("SELECT * FROM public.kb_search_documents")).rows).toEqual([]);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      expect((await db.query("SELECT * FROM public.kb_search_documents")).rows).toHaveLength(4);
    } finally {
      await leaveRole();
    }

    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
        CROSS JOIN unnest(ARRAY[
          'public.kb_search_normalize_v1(text)',
          'public.kb_search_text_array_is_valid_v1(text[])',
          'public.kb_search_document_item_payload_v1(uuid)',
          'public.kb_search_document_payload_v1(uuid)',
          'public.kb_search_vector_german_v1(jsonb)',
          'public.kb_search_vector_simple_v1(jsonb)',
          'public.kb_protect_search_document_write()',
          'public.kb_guard_search_document_release_insert()',
          'public.kb_search_document_matches_item_v1(uuid)',
          'public.kb_search_document_is_valid(uuid)',
          'public.kb_invalid_search_document_count()',
          'public.kb_prevent_search_document_truncate()',
          'public.kb_export_wiki_snapshot_4b1()'
        ]::text[]) function_name
    `);
    expect(privileges.rows).toHaveLength(65);
    expect(privileges.rows.every((row) => row.can_execute === false)).toBe(true);

    const snapshotPrivileges = await db.query<{ role_name: string; can_execute: boolean }>(`
      SELECT role_name,
             has_function_privilege(
               role_name, 'public.kb_export_wiki_snapshot()', 'EXECUTE'
             ) AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
       ORDER BY role_name
    `);
    expect(snapshotPrivileges.rows).toEqual([
      { role_name: "anon", can_execute: false },
      { role_name: "authenticated", can_execute: false },
      { role_name: "kb_import_runtime", can_execute: false },
      { role_name: "kb_importer", can_execute: false },
      { role_name: "service_role", can_execute: true },
    ]);
  });

  it("exports and restores stored vectors without changing snapshot v2", async () => {
    const therapyBefore = await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `);
    const snapshotBefore = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        serialized_tables: Record<string, string>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>("SELECT public.kb_export_wiki_snapshot() AS value");
    const before = snapshotBefore.rows[0].value;
    expect(Object.keys(before.tables)).toHaveLength(56);
    expect(before.validation.invalid_search_documents).toBe(0);
    await expect(validateWikiSnapshotShape({
      tables: before.tables,
      serializedTables: before.serialized_tables,
      manifest: before.manifest,
      validation: before.validation,
    }, wikiSnapshotTables, historicalZeroValidationKeys)).resolves.toBeUndefined();

    await db.exec("BEGIN; ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
    try {
      await db.exec("DELETE FROM public.kb_search_documents;");
      await db.query(`
        INSERT INTO public.kb_search_documents
        SELECT *
          FROM jsonb_populate_recordset(
            NULL::public.kb_search_documents,
            $1::jsonb
          )
      `, [before.serialized_tables.kb_search_documents]);
      await db.exec("ALTER TABLE public.kb_search_documents ENABLE TRIGGER USER;");

      const after = (await db.query<typeof snapshotBefore.rows[0]>(
        "SELECT public.kb_export_wiki_snapshot() AS value",
      )).rows[0].value;
      expect(after.serialized_tables.kb_search_documents)
        .toBe(before.serialized_tables.kb_search_documents);
      expect(after.manifest.kb_search_documents).toEqual(before.manifest.kb_search_documents);
      expect(after.validation.invalid_search_documents).toBe(0);
      expect((await db.query<{ value: string }>(
        "SELECT public.therapy_input_export_snapshot_v2() AS value",
      )).rows[0].value).toBe(therapyBefore.rows[0].value);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  });

  it("has no productive search reader, writer, or therapy integration", () => {
    const contractSources = new Set([
      "src/components/admin/BackupCenter.tsx",
      "src/lib/backupAreas.ts",
      "src/lib/wikiBackup.ts",
      "supabase/functions/backup-export/index.ts",
      "supabase/migrations/20260802090000_create_kb_search_document_contract.sql",
      "supabase/migrations/20260802100000_create_kb_laboratory_contract.sql",
      "supabase/migrations/20260802110000_create_kb_homeopathic_repertory_contract.sql",
      "supabase/migrations/20260804100000_create_therapy_entity_resolution_preflight.sql",
    ]);
    const searchContractMigration =
      "supabase/migrations/20260802090000_create_kb_search_document_contract.sql";
    const readOnlyContractMigrations = new Set([
      "supabase/migrations/20260804100000_create_therapy_entity_resolution_preflight.sql",
    ]);
    const violations: string[] = [];
    const visit = (directory: string, relativeDirectory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          if (relativePath !== "src/test") visit(absolutePath, relativePath);
        } else if (/\.(?:[cm]?[jt]sx?|sql)$/.test(entry.name)) {
          const source = readFileSync(absolutePath, "utf8");
          if (!/\bkb_search_documents\b/.test(source)) continue;

          const hasDirectReadAccess =
            /\.from\(\s*["'`]kb_search_documents["'`]\s*\)/.test(source)
            || /\bSELECT[\s\S]{0,120}\bFROM\s+(?:public\.)?kb_search_documents\b/i.test(source);
          const hasDirectWriteAccess =
            /\b(?:INSERT\s+INTO|UPDATE(?:\s+ONLY)?|DELETE\s+FROM(?:\s+ONLY)?|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?(?:\s+ONLY)?|COPY)\s+(?:public\.)?kb_search_documents\b/i.test(source);
          const hasDirectTableGrant =
            /\bGRANT\b[\s\S]{0,200}\bON\s+(?:TABLE\s+)?(?:public\.)?kb_search_documents\b/i.test(source);
          const hasDirectRuntimeAccess = hasDirectReadAccess
            || hasDirectWriteAccess
            || hasDirectTableGrant;
          const isReadOnlyContractMigration = readOnlyContractMigrations.has(relativePath);
          const hasUnapprovedDirectAccess = relativePath !== searchContractMigration
            && !isReadOnlyContractMigration
            && hasDirectRuntimeAccess;
          const violatesReadOnlyContract = isReadOnlyContractMigration
            && (hasDirectWriteAccess || hasDirectTableGrant);
          if (!contractSources.has(relativePath)
              || hasUnapprovedDirectAccess
              || violatesReadOnlyContract) {
            violations.push(relativePath);
          }
        }
      }
    };
    visit(resolve(process.cwd(), "src"), "src");
    visit(resolve(process.cwd(), "supabase/functions"), "supabase/functions");
    visit(resolve(process.cwd(), "supabase/migrations"), "supabase/migrations");
    expect(violations).toEqual([]);
  });
});
