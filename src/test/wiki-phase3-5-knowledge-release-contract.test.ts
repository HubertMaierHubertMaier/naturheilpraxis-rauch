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
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const releaseMigration = migrations.at(-1)!;
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const backupCenterSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"),
  "utf8",
);

type ProductionSource = { relativePath: string; source: string };

function collectProductionSources(relativeRoot: string): ProductionSource[] {
  const collected: ProductionSource[] = [];
  const visit = (directory: string, relativeDirectory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (relativePath !== "src/test") visit(absolutePath, relativePath);
      } else if (/\.tsx?$/.test(entry.name)) {
        collected.push({ relativePath, source: readFileSync(absolutePath, "utf8") });
      }
    }
  };
  visit(resolve(process.cwd(), relativeRoot), relativeRoot);
  return collected;
}

const productionSources = [
  ...collectProductionSources("src"),
  ...collectProductionSources("supabase/functions"),
];
const releaseBackupSources = new Set([
  "src/components/admin/BackupCenter.tsx",
  "src/lib/backupAreas.ts",
  "src/lib/wikiBackup.ts",
  "supabase/functions/backup-export/index.ts",
  "supabase/functions/_shared/wikiSnapshotValidation.ts",
]);

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const plantId = "30000000-0000-4000-8000-000000000001";
const plantRevisionId = "31000000-0000-4000-8000-000000000001";
const diseaseId = "30000000-0000-4000-8000-000000000002";
const diseaseRevisionId = "31000000-0000-4000-8000-000000000002";
const componentId = "30000000-0000-4000-8000-000000000003";
const componentRevisionId = "31000000-0000-4000-8000-000000000003";
const preparationId = "30000000-0000-4000-8000-000000000004";
const preparationRevisionId = "31000000-0000-4000-8000-000000000004";
const basisAssertionId = "40000000-0000-4000-8000-000000000001";
const relationAssertionId = "40000000-0000-4000-8000-000000000002";
const articleId = "50000000-0000-4000-8000-000000000001";
const articleRevisionId = "51000000-0000-4000-8000-000000000001";
const therapeuticReleaseId = "60000000-0000-4000-8000-000000000001";
const relationReleaseId = "60000000-0000-4000-8000-000000000002";
const articleReleaseId = "60000000-0000-4000-8000-000000000003";

const releaseTables = ["kb_release_items", "kb_releases"] as const;
const therapyInputTables = [
  "therapy_input_revisions",
  "therapy_input_sources",
  "therapy_input_facts",
  "therapy_input_fact_sources",
] as const;

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
  "kb_releases", "kb_release_items", "faqs", "practice_pricing", "practice_info",
] as const;

const wiki4aZeroValidationKeys = [
  "missing_articles",
  "invalid_current_snapshots",
  "orphaned_active_articles",
  "invalid_source_promotions",
  "invalid_therapeutic_catalog_revisions",
  "invalid_entity_candidate_contracts",
  "invalid_entity_candidate_draft_promotions",
  "invalid_knowledge_releases",
] as const;

const wikiRestoreOrder = [
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_preparation_revision_details", "kb_homeopathic_revision_details",
  "kb_botanical_revision_details", "kb_nutrient_revision_details",
  "kb_product_variant_revision_details", "kb_composition_components",
  "kb_articles", "kb_article_revisions", "kb_article_entities", "kb_change_proposals",
  "kb_import_batches", "kb_source_candidates", "kb_entity_candidates", "kb_relation_candidates",
  "kb_dosage_candidates", "kb_safety_candidates", "kb_review_decisions", "kb_import_errors",
  "kb_entity_candidate_names", "kb_entity_candidate_assertions",
  "kb_entity_candidate_assertion_sources", "kb_entity_candidate_preparation_details",
  "kb_entity_candidate_homeopathic_details", "kb_entity_candidate_botanical_details",
  "kb_entity_candidate_nutrient_details", "kb_entity_candidate_product_variant_details",
  "kb_entity_candidate_components", "kb_entity_candidate_contracts",
  "kb_source_candidate_draft_promotions", "kb_entity_candidate_draft_promotions",
  "kb_entity_candidate_draft_promotion_assertions", "kb_releases", "kb_release_items",
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
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

async function expectTransactionFailure(sql: string, message: RegExp): Promise<void> {
  try {
    await db.exec(`BEGIN; ${sql} COMMIT;`);
    throw new Error("Expected transaction to fail");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(message);
  }
}

async function createBuildRelease(releaseId: string, releaseKey: string): Promise<void> {
  await db.query(`
    WITH input AS (
      SELECT $1::uuid AS id, $2::text AS release_key
    ), manifest AS (
      SELECT input.*,
             public.kb_release_manifest_v1(input.id, input.release_key) AS value
        FROM input
    )
    INSERT INTO public.kb_releases (
      id, release_key, release_manifest, release_manifest_hash
    )
    SELECT id, release_key, value, public.kb_release_manifest_hash_v1(value)
      FROM manifest
  `, [releaseId, releaseKey]);
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
  releaseId: string,
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
    releaseId,
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

async function sealRelease(releaseId: string): Promise<void> {
  await db.query(`
    UPDATE public.kb_releases release
       SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
           release_manifest_hash = public.kb_release_manifest_hash_v1(
             public.kb_release_manifest_v1(release.id, release.release_key)
           ),
           release_status = 'sealed',
           sealed_at = '2026-08-01T09:00:00Z'
     WHERE release.id = $1::uuid
  `, [releaseId]);
}

async function expectReleaseInvalidAfterBypass(
  releaseId: string,
  mutationSql: string,
): Promise<void> {
  await db.exec(`
    BEGIN;
    ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;
    ALTER TABLE public.kb_releases DISABLE TRIGGER USER;
  `);
  try {
    await db.exec(mutationSql);
    await db.query(`
      UPDATE public.kb_release_items item
         SET item_manifest = public.kb_release_item_manifest_v1(
               item.entity_id, item.entity_revision_id,
               item.article_id, item.article_revision_id,
               item.assertion_id, item.source_id, item.source_revision_id
             ),
             item_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_item_manifest_v1(
                 item.entity_id, item.entity_revision_id,
                 item.article_id, item.article_revision_id,
                 item.assertion_id, item.source_id, item.source_revision_id
               )
             )
       WHERE item.release_id = $1::uuid
    `, [releaseId]);
    await db.query(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             )
       WHERE release.id = $1::uuid
    `, [releaseId]);
    const result = await db.query<{ valid: boolean }>(`
      SELECT public.kb_release_is_valid($1::uuid, false) AS valid
    `, [releaseId]);
    expect(result.rows[0].valid).toBe(false);
  } finally {
    await db.exec("ROLLBACK;").catch(() => undefined);
  }
}

async function releaseRevision(table: string, id: string, usesSafetyReview: boolean): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (usesSafetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved',
           reviewed_at = '2026-07-31T10:00:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'released', released_at = '2026-07-31T11:00:00Z'
     WHERE id = $1::uuid
  `, [id]);
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
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:release-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'practice_rule',
      'Synthetic release source', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${plantId}', 'plant', 'plant:release-contract'),
      ('${diseaseId}', 'disease', 'disease:release-contract'),
      ('${componentId}', 'substance', 'substance:release-contract');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, content_hash
    ) VALUES
      ('${plantRevisionId}', '${plantId}', 1, 'Synthetic release plant', repeat('2', 64)),
      ('${diseaseRevisionId}', '${diseaseId}', 1, 'Synthetic release disease', repeat('3', 64)),
      ('${componentRevisionId}', '${componentId}', 1, 'Synthetic release component', repeat('4', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${plantId}', '${diseaseId}', '${componentId}');

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text, content_hash
    ) VALUES
      ('${basisAssertionId}', 'assertion:release-basis', 1, 'classification',
       'Synthetic preparation basis.', repeat('5', 64)),
      ('${relationAssertionId}', 'assertion:release-relation', 1, 'entity_relation',
       'Synthetic plant relation.', repeat('6', 64));
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES
      ('${basisAssertionId}', '${sourceRevisionId}', 'supports', 'S. 1', true),
      ('${relationAssertionId}', '${sourceRevisionId}', 'qualifies', 'S. 2', true);
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id
    ) VALUES (
      '${relationAssertionId}', '${plantId}', 'may_support', '${diseaseId}'
    );
    COMMIT;
  `);

  await releaseRevision("kb_source_revisions", sourceRevisionId, false);
  await releaseRevision("kb_assertions", basisAssertionId, true);
  await releaseRevision("kb_assertions", relationAssertionId, true);
  await releaseRevision("kb_entity_revisions", plantRevisionId, true);
  await releaseRevision("kb_entity_revisions", diseaseRevisionId, true);
  await releaseRevision("kb_entity_revisions", componentRevisionId, true);

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
    VALUES ('${preparationId}', 'preparation', 'preparation:release-contract');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary, content_hash
    ) VALUES (
      '${preparationRevisionId}', '${preparationId}', 1,
      'Synthetic release preparation', 'Schema-only fixture', repeat('0', 64)
    );
    INSERT INTO public.kb_entity_names (
      entity_id, name, normalized_name, name_kind, language_code, is_preferred
    ) VALUES
      ('${preparationId}', 'Synthetic release preparation',
       'synthetic release preparation', 'preferred', 'de', true),
      ('${preparationId}', 'Synthetic alias', 'synthetic alias',
       'spelling_variant', 'de', false);
    INSERT INTO public.kb_entity_identifiers (
      entity_id, scheme_code, value, normalized_value, is_primary
    ) VALUES ('${preparationId}', 'pzn', '12345678', '12345678', true);
    INSERT INTO public.kb_preparation_revision_details (
      entity_id, entity_revision_id, preparation_kind, dosage_form,
      administration_routes, basis_assertion_id
    ) VALUES (
      '${preparationId}', '${preparationRevisionId}', 'other', 'other',
      ARRAY['other'], '${basisAssertionId}'
    );
    INSERT INTO public.kb_composition_components (
      owner_entity_id, owner_revision_id, component_entity_id,
      component_revision_id, component_role, component_order, basis_assertion_id
    ) VALUES (
      '${preparationId}', '${preparationRevisionId}', '${componentId}',
      '${componentRevisionId}', 'active', 1, '${basisAssertionId}'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
     WHERE id = '${preparationRevisionId}';
    UPDATE public.kb_entities SET current_revision_id = '${preparationRevisionId}'
     WHERE id = '${preparationId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
  await releaseRevision("kb_entity_revisions", preparationRevisionId, true);

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_articles (id, canonical_key, article_kind)
    VALUES ('${articleId}', 'article:release-contract', 'reference');
    INSERT INTO public.kb_article_revisions (
      id, article_id, revision_no, title, content_markdown, content_hash
    ) VALUES (
      '${articleRevisionId}', '${articleId}', 1,
      'Synthetic release article', 'Synthetic article body.', repeat('7', 64)
    );
    INSERT INTO public.kb_article_entities (article_revision_id, entity_id, role)
    VALUES ('${articleRevisionId}', '${plantId}', 'about');
    UPDATE public.kb_articles SET current_revision_id = '${articleRevisionId}'
     WHERE id = '${articleId}';
    COMMIT;
  `);
  await releaseRevision("kb_article_revisions", articleRevisionId, true);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 3.5 knowledge release contract", () => {
  it("adds exactly two empty schema-only release tables at the 50-to-52 boundary", async () => {
    const createdTables = Array.from(
      releaseMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual(["kb_releases", "kb_release_items"]);
    expect(releaseMigration).toContain("Knowledge releases require the exact 50-table Wiki boundary");
    expect(releaseMigration).toMatch(/^BEGIN;/);
    expect(releaseMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(releaseMigration).not.toMatch(/INSERT INTO public\.kb_(?:releases|release_items)/);
    expect(releaseMigration).not.toContain("therapy_input_");
    expect(releaseMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|anamnesis_id|therapy_session_id|session_id)\b/i,
    );
    expect(releaseMigration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.kb_(?:seal|create|write)_release/);

    const rows = await db.query<{ releases: number; items: number }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_releases) AS releases,
        (SELECT count(*)::int FROM public.kb_release_items) AS items
    `);
    expect(rows.rows[0]).toEqual({ releases: 0, items: 0 });

    const snapshotCount = await db.query<{ tables: number; serialized: number; manifest: number }>(`
      SELECT
        (SELECT count(*)::int
           FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')) AS tables,
        (SELECT count(*)::int
           FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'serialized_tables')) AS serialized,
        (SELECT count(*)::int
           FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'manifest')) AS manifest
    `);
    expect(snapshotCount.rows[0]).toEqual({ tables: 52, serialized: 52, manifest: 52 });

    expect(releaseMigration).toContain("SET release_manifest = release.release_manifest");
    expect(releaseMigration).toContain("NULLIF(btrim(primary_source.locator), '') IS NULL");
    expect(releaseMigration).toContain(
      "relation.subject_entity_id > relation.object_entity_id",
    );
    expect(releaseMigration).not.toContain(
      "relation.subject_entity_id::text > relation.object_entity_id::text",
    );
    expect(backupExportSource).toContain('if (areaId === "wiki")');

    for (const { relativePath, source } of productionSources) {
      if (releaseBackupSources.has(relativePath)) continue;
      expect(source, relativePath).not.toMatch(/\bkb_release(?:s|_items)\b/);
    }
  });

  it("uses typed exact-one references and permanently disables v1 activation", async () => {
    const releaseId = "60000000-0000-4000-8000-000000000010";
    await createBuildRelease(releaseId, "release:typed-reference-test");

    await expect(db.query(`
      INSERT INTO public.kb_release_items (
        release_id, item_order, item_kind, item_manifest, item_manifest_hash
      ) VALUES ($1, 1, 'assertion', '{}'::jsonb,
        public.kb_release_manifest_hash_v1('{}'::jsonb))
    `, [releaseId])).rejects.toThrow(/exactly|check constraint|canonical v1 manifest/i);

    await expect(db.query(`
      INSERT INTO public.kb_release_items (
        release_id, item_order, item_kind, entity_id, entity_revision_id,
        assertion_id, item_manifest, item_manifest_hash
      ) VALUES ($1, 1, 'entity_revision', $2, $3, $4, '{}'::jsonb,
        public.kb_release_manifest_hash_v1('{}'::jsonb))
    `, [releaseId, plantId, plantRevisionId, basisAssertionId]))
      .rejects.toThrow(/exactly|check constraint|canonical v1 manifest/i);

    await expect(db.query(`
      UPDATE public.kb_releases SET retrieval_eligible = true WHERE id = $1
    `, [releaseId])).rejects.toThrow(/check constraint/i);
    await expect(db.query(`
      UPDATE public.kb_releases SET is_active = true WHERE id = $1
    `, [releaseId])).rejects.toThrow(/check constraint/i);
  });

  it("binds at most one exact revision of each entity per release", async () => {
    const secondRevisionId = "31000000-0000-4000-8000-000000000011";
    const releaseId = "60000000-0000-4000-8000-000000000011";
    await db.query(`
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES ($1, $2, 2, 'Synthetic second released revision', repeat('8', 64))
    `, [secondRevisionId, plantId]);
    await releaseRevision("kb_entity_revisions", secondRevisionId, true);
    await createBuildRelease(releaseId, "release:single-entity-revision-test");
    await addReleaseItem(releaseId, 1, {
      kind: "entity_revision",
      entityId: plantId,
      entityRevisionId: plantRevisionId,
    });

    await expect(addReleaseItem(releaseId, 2, {
      kind: "entity_revision",
      entityId: plantId,
      entityRevisionId: secondRevisionId,
    })).rejects.toThrow(/kb_release_items_entity_idx|unique constraint/i);
  });

  it("rejects sealing an exact knowledge object that is not released", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES (
        '30000000-0000-4000-8000-000000000099',
        'plant',
        'plant:unreleased-release-test'
      );
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '31000000-0000-4000-8000-000000000099',
        '30000000-0000-4000-8000-000000000099',
        1, 'Synthetic unreleased entity', repeat('9', 64)
      );
      WITH input AS (
        SELECT '60000000-0000-4000-8000-000000000099'::uuid AS id,
               'release:unreleased-object-test'::text AS release_key
      ), manifest AS (
        SELECT input.*,
               public.kb_release_manifest_v1(input.id, input.release_key) AS value
          FROM input
      )
      INSERT INTO public.kb_releases (
        id, release_key, release_manifest, release_manifest_hash
      )
      SELECT id, release_key, value, public.kb_release_manifest_hash_v1(value)
        FROM manifest;
      WITH manifest AS (
        SELECT public.kb_release_item_manifest_v1(
          '30000000-0000-4000-8000-000000000099',
          '31000000-0000-4000-8000-000000000099',
          NULL, NULL, NULL, NULL, NULL
        ) AS value
      )
      INSERT INTO public.kb_release_items (
        release_id, item_order, item_kind, entity_id, entity_revision_id,
        item_manifest, item_manifest_hash
      )
      SELECT '60000000-0000-4000-8000-000000000099', 1, 'entity_revision',
             '30000000-0000-4000-8000-000000000099',
             '31000000-0000-4000-8000-000000000099',
             value, public.kb_release_manifest_hash_v1(value)
        FROM manifest;
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed', sealed_at = '2026-08-01T09:00:00Z'
       WHERE id = '60000000-0000-4000-8000-000000000099';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /seal is incomplete, unreviewed or inconsistent/);
  });

  it("seals only a transitively complete released therapeutic graph", async () => {
    await createBuildRelease(therapeuticReleaseId, "release:therapeutic-closure-v1");
    await addReleaseItem(therapeuticReleaseId, 1, {
      kind: "entity_revision",
      entityId: preparationId,
      entityRevisionId: preparationRevisionId,
    });

    await expectTransactionFailure(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed', sealed_at = '2026-08-01T09:00:00Z'
       WHERE id = '${therapeuticReleaseId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /seal is incomplete/);

    await addReleaseItem(therapeuticReleaseId, 2, {
      kind: "entity_revision",
      entityId: componentId,
      entityRevisionId: componentRevisionId,
    });
    await addReleaseItem(therapeuticReleaseId, 3, {
      kind: "assertion",
      assertionId: basisAssertionId,
    });
    await addReleaseItem(therapeuticReleaseId, 4, {
      kind: "source_revision",
      sourceId,
      sourceRevisionId,
    });
    await sealRelease(therapeuticReleaseId);

    const sealed = await db.query<{
      release_status: string;
      retrieval_eligible: boolean;
      is_active: boolean;
      valid: boolean;
      item_count: number;
      names: number;
      identifiers: number;
    }>(`
      SELECT release.release_status, release.retrieval_eligible, release.is_active,
             public.kb_release_is_valid(release.id, true) AS valid,
             jsonb_array_length(release.release_manifest -> 'items') AS item_count,
             jsonb_array_length(item.item_manifest #> '{entity,names}') AS names,
             jsonb_array_length(item.item_manifest #> '{entity,identifiers}') AS identifiers
        FROM public.kb_releases release
        JOIN public.kb_release_items item
          ON item.release_id = release.id
         AND item.entity_revision_id = '${preparationRevisionId}'
       WHERE release.id = '${therapeuticReleaseId}'
    `);
    expect(sealed.rows[0]).toEqual({
      release_status: "sealed",
      retrieval_eligible: false,
      is_active: false,
      valid: true,
      item_count: 4,
      names: 2,
      identifiers: 1,
    });
  });

  it("requires exact primary sources and concrete relation endpoint revisions", async () => {
    await createBuildRelease(relationReleaseId, "release:relation-closure-v1");
    await addReleaseItem(relationReleaseId, 1, {
      kind: "assertion",
      assertionId: relationAssertionId,
    });
    await addReleaseItem(relationReleaseId, 2, {
      kind: "source_revision",
      sourceId,
      sourceRevisionId,
    });

    await expectTransactionFailure(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed', sealed_at = '2026-08-01T09:00:00Z'
       WHERE id = '${relationReleaseId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /seal is incomplete/);

    await addReleaseItem(relationReleaseId, 3, {
      kind: "entity_revision", entityId: plantId, entityRevisionId: plantRevisionId,
    });
    await addReleaseItem(relationReleaseId, 4, {
      kind: "entity_revision", entityId: diseaseId, entityRevisionId: diseaseRevisionId,
    });
    await sealRelease(relationReleaseId);

    const relationManifest = await db.query<{ relation_type: string; source_revision: string }>(`
      SELECT item.item_manifest #>> '{assertion,relation,relation_type_code}' AS relation_type,
             item.item_manifest #>> '{assertion,sources,0,source_revision_id}' AS source_revision
        FROM public.kb_release_items item
       WHERE item.release_id = '${relationReleaseId}'
         AND item.assertion_id = '${relationAssertionId}'
    `);
    expect(relationManifest.rows[0]).toEqual({
      relation_type: "may_support",
      source_revision: sourceRevisionId,
    });
  });

  it("fails closed for blank primary locators after canonical manifest tampering", async () => {
    await expectReleaseInvalidAfterBypass(relationReleaseId, `
      ALTER TABLE public.kb_assertion_sources DISABLE TRIGGER USER;
      UPDATE public.kb_assertion_sources
         SET locator = '   '
       WHERE assertion_id = '${relationAssertionId}'
         AND source_revision_id = '${sourceRevisionId}';
    `);
  });

  it("fails closed for inactive types, unapproved domains, and unordered symmetric edges", async () => {
    await expectReleaseInvalidAfterBypass(relationReleaseId, `
      UPDATE public.kb_relation_types SET is_active = false WHERE code = 'may_support';
    `);
    await expectReleaseInvalidAfterBypass(relationReleaseId, `
      ALTER TABLE public.kb_relation_type_domains DISABLE TRIGGER USER;
      UPDATE public.kb_relation_type_domains
         SET review_status = 'draft'
       WHERE relation_type_code = 'may_support'
         AND subject_entity_type_code = 'plant'
         AND object_entity_type_code = 'disease';
    `);
    await expectReleaseInvalidAfterBypass(relationReleaseId, `
      ALTER TABLE public.kb_entity_relations DISABLE TRIGGER USER;
      ALTER TABLE public.kb_relation_type_domains DISABLE TRIGGER USER;
      ALTER TABLE public.kb_relation_types DISABLE TRIGGER USER;
      INSERT INTO public.kb_relation_type_domains (
        relation_type_code, subject_entity_type_code, object_entity_type_code, review_status
      ) VALUES ('may_support', 'disease', 'plant', 'approved')
      ON CONFLICT (relation_type_code, subject_entity_type_code, object_entity_type_code)
      DO UPDATE SET review_status = EXCLUDED.review_status;
      UPDATE public.kb_relation_types SET is_symmetric = true WHERE code = 'may_support';
      UPDATE public.kb_entity_relations
         SET subject_entity_id = '${diseaseId}', object_entity_id = '${plantId}'
       WHERE assertion_id = '${relationAssertionId}';
    `);
  });

  it("rejects a trigger-bypassed graph edge on a non-relation assertion", async () => {
    const assertionId = "40000000-0000-4000-8000-000000000011";
    const releaseId = "60000000-0000-4000-8000-000000000012";
    await db.query(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        $1, 'assertion:release-narrative-edge-test', 1, 'narrative',
        'Synthetic narrative without graph semantics.', repeat('9', 64)
      )
    `, [assertionId]);
    await db.query(`
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES ($1, $2, 'supports', 'S. 3', true)
    `, [assertionId, sourceRevisionId]);
    await releaseRevision("kb_assertions", assertionId, true);

    await db.exec("BEGIN;");
    try {
      await db.exec("ALTER TABLE public.kb_entity_relations DISABLE TRIGGER USER;");
      await db.query(`
        INSERT INTO public.kb_entity_relations (
          assertion_id, subject_entity_id, relation_type_code, object_entity_id
        ) VALUES ($1, $2, 'may_support', $3)
      `, [assertionId, plantId, diseaseId]);
      await db.exec("ALTER TABLE public.kb_entity_relations ENABLE TRIGGER USER;");

      await createBuildRelease(releaseId, "release:narrative-edge-test");
      await addReleaseItem(releaseId, 1, { kind: "assertion", assertionId });
      await addReleaseItem(releaseId, 2, {
        kind: "source_revision", sourceId, sourceRevisionId,
      });
      await addReleaseItem(releaseId, 3, {
        kind: "entity_revision", entityId: plantId, entityRevisionId: plantRevisionId,
      });
      await addReleaseItem(releaseId, 4, {
        kind: "entity_revision", entityId: diseaseId, entityRevisionId: diseaseRevisionId,
      });
      await sealRelease(releaseId);
      await expect(db.exec("SET CONSTRAINTS ALL IMMEDIATE;"))
        .rejects.toThrow(/seal is incomplete, unreviewed or inconsistent/i);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("requires exact entity revisions for article links", async () => {
    await createBuildRelease(articleReleaseId, "release:article-closure-v1");
    await addReleaseItem(articleReleaseId, 1, {
      kind: "article_revision", articleId, articleRevisionId,
    });
    await expectTransactionFailure(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed', sealed_at = '2026-08-01T09:00:00Z'
       WHERE id = '${articleReleaseId}';
    `, /seal is incomplete/);

    await addReleaseItem(articleReleaseId, 2, {
      kind: "entity_revision", entityId: plantId, entityRevisionId: plantRevisionId,
    });
    await sealRelease(articleReleaseId);
    const valid = await db.query<{ valid: boolean }>(`
      SELECT public.kb_release_is_valid('${articleReleaseId}', true) AS valid
    `);
    expect(valid.rows[0].valid).toBe(true);
  });

  it("keeps sealed names and identifiers stable while live aliases can evolve", async () => {
    const before = await db.query<{ manifest: string; hash: string }>(`
      SELECT item_manifest::text AS manifest, item_manifest_hash AS hash
        FROM public.kb_release_items
       WHERE release_id = '${therapeuticReleaseId}'
         AND entity_revision_id = '${preparationRevisionId}'
    `);

    await db.exec(`
      UPDATE public.kb_entity_names
         SET name = 'Synthetic alias revised', normalized_name = 'synthetic alias revised'
       WHERE entity_id = '${preparationId}' AND NOT is_preferred;
      UPDATE public.kb_entity_identifiers
         SET value = '87654321', normalized_value = '87654321'
       WHERE entity_id = '${preparationId}' AND scheme_code = 'pzn';
    `);

    const after = await db.query<{
      manifest: string;
      hash: string;
      valid: boolean;
      invalid_count: number;
    }>(`
      SELECT item.item_manifest::text AS manifest,
             item.item_manifest_hash AS hash,
             public.kb_release_is_valid(item.release_id, false) AS valid,
             public.kb_invalid_knowledge_release_count()::int AS invalid_count
        FROM public.kb_release_items item
       WHERE item.release_id = '${therapeuticReleaseId}'
         AND item.entity_revision_id = '${preparationRevisionId}'
    `);
    expect(after.rows[0]).toEqual({
      manifest: before.rows[0].manifest,
      hash: before.rows[0].hash,
      valid: true,
      invalid_count: 0,
    });
    expect(after.rows[0].manifest).toContain("Synthetic alias");
    expect(after.rows[0].manifest).toContain("12345678");
    expect(after.rows[0].manifest).not.toContain("Synthetic alias revised");
    expect(after.rows[0].manifest).not.toContain("87654321");
  });

  it("makes sealed rows append-only and detects trigger-disabled manifest tampering", async () => {
    await expect(db.query(`
      UPDATE public.kb_releases SET sealed_at = sealed_at + interval '1 second'
       WHERE id = $1
    `, [therapeuticReleaseId])).rejects.toThrow(/append-only/i);
    await expect(db.query(`
      UPDATE public.kb_release_items SET item_order = 99
       WHERE release_id = $1 AND item_order = 1
    `, [therapeuticReleaseId])).rejects.toThrow(/append-only/i);
    await expect(db.query(`DELETE FROM public.kb_releases WHERE id = $1`, [therapeuticReleaseId]))
      .rejects.toThrow(/cannot be deleted/i);
    await expect(db.exec("TRUNCATE TABLE public.kb_release_items"))
      .rejects.toThrow(/cannot be truncated/i);

    await db.exec("BEGIN; ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_release_items
           SET item_manifest = item_manifest || '{"tampered":true}'::jsonb,
               item_manifest_hash = public.kb_release_manifest_hash_v1(
                 item_manifest || '{"tampered":true}'::jsonb
               )
         WHERE release_id = '${therapeuticReleaseId}' AND item_order = 1
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_knowledge_release_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_revisions DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_entity_revisions
           SET metadata = '{"tampered":"revision-metadata"}'::jsonb
         WHERE id = '${preparationRevisionId}'
      `);
      const invalidMetadata = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_knowledge_release_count()::int AS count
      `);
      expect(invalidMetadata.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("exports identical Wiki JSON and hashes in every session timezone", async () => {
    await db.exec("SET TIME ZONE 'Europe/Berlin';");
    const berlin = await db.query<{ value: string }>(`
      SELECT public.kb_export_wiki_snapshot()::text AS value
    `);
    await db.exec("SET TIME ZONE 'UTC';");
    const utc = await db.query<{ value: string }>(`
      SELECT public.kb_export_wiki_snapshot()::text AS value
    `);
    expect(berlin.rows[0].value).toBe(utc.rows[0].value);
  });

  it("allows admin and service snapshots to read but grants no table writer", async () => {
    await enterRole("authenticated", adminId);
    try {
      const adminRows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_releases
      `);
      expect(adminRows.rows[0].count).toBeGreaterThan(0);
      await expect(db.exec(`
        INSERT INTO public.kb_releases (
          release_key, release_manifest, release_manifest_hash
        ) VALUES (
          'release:admin-write-denied', '{}'::jsonb,
          repeat('0', 64)
        )
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", patientId);
    try {
      const patientRows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_releases
      `);
      expect(patientRows.rows[0].count).toBe(0);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      const serviceRows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_release_items
      `);
      expect(serviceRows.rows[0].count).toBeGreaterThan(0);
      const snapshot = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')
      `);
      expect(snapshot.rows[0].count).toBe(52);
      await expect(db.exec(`DELETE FROM public.kb_release_items`))
        .rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("kb_importer");
    try {
      await expect(db.query(`SELECT * FROM public.kb_releases`))
        .rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    for (const deniedRole of ["anon", "kb_import_runtime"]) {
      await enterRole(deniedRole);
      try {
        await expect(db.query(`SELECT * FROM public.kb_release_items`))
          .rejects.toThrow(/permission denied/i);
      } finally {
        await leaveRole();
      }
    }

    const helperPrivileges = await db.query<{
      role_name: string;
      function_name: string;
      can_execute: boolean;
    }>(`
      SELECT role_name, function_name,
             has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
               'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
             ]::text[]) role_name
       CROSS JOIN unnest(ARRAY[
               'public.kb_release_canonical_jsonb_v1(jsonb)',
               'public.kb_release_manifest_hash_v1(jsonb)',
               'public.kb_release_jsonb_has_exact_keys_v1(jsonb,text[])',
               'public.kb_release_item_manifest_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid)',
               'public.kb_release_manifest_v1(uuid,text)',
               'public.kb_protect_knowledge_release_write()',
               'public.kb_prevent_knowledge_release_truncate()',
               'public.kb_release_item_is_valid(uuid,boolean)',
               'public.kb_release_is_valid(uuid,boolean)',
               'public.kb_validate_knowledge_release_seal()',
               'public.kb_invalid_knowledge_release_count()'
             ]::text[]) function_name
       ORDER BY role_name, function_name
    `);
    expect(helperPrivileges.rows).toHaveLength(55);
    expect(helperPrivileges.rows.every((row) => row.can_execute === false)).toBe(true);

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

  it("exports and owner-restores exactly 52 Wiki tables without changing therapy snapshot v2", async () => {
    const therapyBoundary = backupExportSource.match(
      /const THERAPY_INPUT_SNAPSHOT_TABLES = \[([\s\S]*?)\] as const;/,
    )?.[1] ?? "";
    expect(Array.from(therapyBoundary.matchAll(/"([a-z0-9_]+)"/g), (match) => match[1]))
      .toEqual(therapyInputTables);
    expect(backupExportSource).toContain("...REQUIRED_KB_RELEASE_TABLES");
    for (const table of releaseTables) {
      expect(backupAreasSource).toContain(`"${table}"`);
      expect(backupExportSource).toContain(`"${table}"`);
    }
    expect(backupExportSource).toContain('"invalid_knowledge_releases"');
    expect(backupCenterSource).toContain("invalid_knowledge_releases");
    expect(backupCenterSource).toContain("await validateWikiSubsetPayload(payload, area.tables)");
    expect(backupCenterSource).toContain("`NO ACTION DEFERRABLE`");
    expect(backupExportSource).toContain(
      "Vor dem Leeren `current_revision_id` in `kb_articles`, `kb_entities` und `kb_sources`",
    );
    expect(backupExportSource).not.toContain(
      "if (area.tables.some((table) => WIKI_SNAPSHOT_TABLE_SET.has(table)))",
    );

    const therapyRevisionId = "70000000-0000-4000-8000-000000000001";
    const therapySourceId = "71000000-0000-4000-8000-000000000001";
    const therapyFactId = "72000000-0000-4000-8000-000000000001";
    await db.exec(`
      BEGIN;
      SET CONSTRAINTS ALL DEFERRED;
      ALTER TABLE public.therapy_input_revisions DISABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_sources DISABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_fact_sources DISABLE TRIGGER USER;

      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, input_envelope, source_count, content_sha256,
        captured_at, captured_by
      ) VALUES (
        '${therapyRevisionId}', 'P-2026-4001',
        '{"format":"therapy_input_envelope_v1","clinical_text":"Synthetic fatigue","context":{}}',
        1, repeat('0', 64), '2026-08-01T08:00:00Z', '${adminId}'
      );
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_locator, source_payload, content_sha256
      ) VALUES (
        '${therapySourceId}', '${therapyRevisionId}', 1,
        'manual_input:artifact:abcdef123456', 'manual_input', 'section:restore',
        '{"format":"text","text":"Synthetic restore source","language":"de"}',
        repeat('0', 64)
      );
      INSERT INTO public.therapy_input_facts (
        id, therapy_input_revision_id, fact_order, fact_type, fact_key,
        fact_label, fact_value, is_negated, clinical_status, certainty,
        extraction_confidence, extraction_method, evidence_scope,
        kb_entity_id, source_count, extracted_at, extracted_by, content_sha256
      ) VALUES (
        '${therapyFactId}', '${therapyRevisionId}', 1, 'symptom',
        'symptom.restore_contract', 'Synthetic fatigue',
        '{"type":"text","value":"Synthetic fatigue"}', false, 'current',
        'confirmed', 'high', 'manual', 'patient_report', '${plantId}', 1,
        '2026-08-01T08:05:00Z', '${adminId}', repeat('0', 64)
      );
      INSERT INTO public.therapy_input_fact_sources (
        therapy_input_revision_id, therapy_input_fact_id, link_order,
        source_order, fact_locator, source_role
      ) VALUES (
        '${therapyRevisionId}', '${therapyFactId}', 1, 1, 'section:restore', 'primary'
      );

      UPDATE public.therapy_input_sources source
         SET content_sha256 = public.therapy_input_jsonb_sha256_v1(jsonb_build_object(
               'hash_schema_version', revision.hash_schema_version,
               'source_order', source.source_order,
               'neutral_source_id', source.neutral_source_id,
               'source_type', source.source_type,
               'document_date', source.document_date,
               'source_locator', source.source_locator,
               'source_payload', source.source_payload
             ))
        FROM public.therapy_input_revisions revision
       WHERE source.therapy_input_revision_id = revision.id
         AND source.id = '${therapySourceId}';
      UPDATE public.therapy_input_revisions
         SET content_sha256 = public.therapy_input_envelope_sha256_v1(id)
       WHERE id = '${therapyRevisionId}';
      UPDATE public.therapy_input_facts
         SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
       WHERE id = '${therapyFactId}';

      SET CONSTRAINTS ALL IMMEDIATE;
      ALTER TABLE public.therapy_input_revisions ENABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_sources ENABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_facts ENABLE TRIGGER USER;
      ALTER TABLE public.therapy_input_fact_sources ENABLE TRIGGER USER;
      COMMIT;
    `);
    const therapyBefore = await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `);
    const therapyBeforePayload = JSON.parse(therapyBefore.rows[0].value) as {
      tables: Record<string, string>;
      validation: { invalid_revision_count: number; invalid_fact_count: number };
    };
    expect(therapyBeforePayload.validation).toEqual({
      invalid_revision_count: 0,
      invalid_fact_count: 0,
    });
    expect(therapyBeforePayload.tables.therapy_input_facts).toContain(plantId);

    const snapshot = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        serialized_tables: Record<string, string>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>(`SELECT public.kb_export_wiki_snapshot() AS value`);
    const original = snapshot.rows[0].value;
    expect(Object.keys(original.tables)).toHaveLength(52);
    expect(Object.keys(original.serialized_tables)).toHaveLength(52);
    expect(Object.keys(original.manifest)).toHaveLength(52);
    expect(original.validation.invalid_knowledge_releases).toBe(0);
    await expect(validateWikiSnapshotShape({
      tables: original.tables,
      serializedTables: original.serialized_tables,
      manifest: original.manifest,
      validation: original.validation,
    }, wikiSnapshotTables, wiki4aZeroValidationKeys)).resolves.toBeUndefined();

    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }
      await db.exec("UPDATE public.kb_articles SET current_revision_id = NULL;");
      await db.exec("UPDATE public.kb_entities SET current_revision_id = NULL;");
      await db.exec("UPDATE public.kb_sources SET current_revision_id = NULL;");
      for (const table of [...wikiRestoreOrder].reverse()) {
        await db.exec(`DELETE FROM public.${table};`);
      }
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [original.serialized_tables[table]],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }

      const restored = await db.query<{
        value: { manifest: Record<string, unknown>; validation: Record<string, number> };
      }>(`SELECT public.kb_export_wiki_snapshot() AS value`);
      expect(restored.rows[0].value.validation.invalid_knowledge_releases).toBe(0);
      expect(restored.rows[0].value.manifest).toEqual(original.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }

    const therapyAfter = await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `);
    expect(therapyAfter.rows[0].value).toBe(therapyBefore.rows[0].value);
    const externalReference = await db.query<{ count: number }>(`
      SELECT count(*)::int AS count
        FROM public.therapy_input_facts
       WHERE id = '${therapyFactId}' AND kb_entity_id = '${plantId}'
    `);
    expect(externalReference.rows[0].count).toBe(1);
  }, 20_000);
});
