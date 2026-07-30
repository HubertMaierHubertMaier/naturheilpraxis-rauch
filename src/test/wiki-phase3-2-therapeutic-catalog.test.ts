// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationFiles = [
  "20260728090000_create_kb_phase1_core.sql",
  "20260728130000_create_kb_phase2_legacy_bridge.sql",
  "20260728140000_create_kb_phase3_import_staging.sql",
  "20260728150000_create_kb_source_draft_promotion.sql",
  "20260729140000_create_kb_therapeutic_catalog.sql",
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const therapeuticMigration = migrations.at(-1)!;
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const backupCenterSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"),
  "utf8",
);

const therapeuticTables = [
  "kb_botanical_revision_details",
  "kb_composition_components",
  "kb_homeopathic_revision_details",
  "kb_nutrient_revision_details",
  "kb_preparation_revision_details",
  "kb_product_variant_revision_details",
] as const;
const wikiSnapshotTables = [
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  ...therapeuticTables,
  "kb_articles", "kb_article_revisions", "kb_article_entities", "kb_change_proposals",
  "kb_import_batches", "kb_source_candidates", "kb_entity_candidates", "kb_relation_candidates",
  "kb_dosage_candidates", "kb_safety_candidates", "kb_review_decisions", "kb_import_errors",
  "kb_source_candidate_draft_promotions", "faqs", "practice_pricing", "practice_info",
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
  "kb_source_candidate_draft_promotions",
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const preparationId = "20000000-0000-4000-8000-000000000101";
const preparationRevisionId = "30000000-0000-4000-8000-000000000101";
const basisAssertionId = "40000000-0000-4000-8000-000000000101";

let db: PGlite;

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
      category text NOT NULL DEFAULT 'Allgemein',
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
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 3.2 therapeutic catalog", () => {
  it("creates exactly six additive catalog tables and controlled vocabulary", async () => {
    const tables = await db.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (${therapeuticTables.map((table) => `'${table}'`).join(", ")})
       ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual(therapeuticTables);

    const vocabulary = await db.query<{
      preparation_types: number;
      new_relation_types: number;
      unapproved_domains: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_entity_types WHERE code = 'preparation') AS preparation_types,
        (SELECT count(*)::int FROM public.kb_relation_types WHERE code IN (
          'prepared_from', 'realizes_preparation', 'variant_of', 'complementary_to',
          'follows_well', 'antidotes', 'inimical_with'
        )) AS new_relation_types,
        (SELECT count(*)::int FROM public.kb_relation_type_domains
          WHERE (subject_entity_type_code = 'preparation' OR object_entity_type_code = 'preparation')
            AND review_status <> 'approved') AS unapproved_domains
    `);
    expect(vocabulary.rows[0]).toEqual({
      preparation_types: 1,
      new_relation_types: 7,
      unapproved_domains: 0,
    });
    expect(therapeuticMigration).toMatch(/^BEGIN;/);
    expect(therapeuticMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(therapeuticMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|anamnesis_id|therapy_session_id)\b/i,
    );
  });

  it("stores an exact, assertion-bound homeopathic preparation revision", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('${preparationId}', 'preparation', 'preparation:synthetic-d6');

      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, summary, content_hash
      ) VALUES (
        '${preparationRevisionId}', '${preparationId}', 1,
        'Synthetische D6 Zubereitung', 'Nur Testdaten', repeat('0', 64)
      );

      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text,
        evidence_basis, content_hash
      ) VALUES (
        '${basisAssertionId}', 'assertion:synthetic-d6-basis', 1,
        'classification', 'Synthetische Testklassifikation',
        'traditional_use', repeat('1', 64)
      );

      INSERT INTO public.kb_preparation_revision_details (
        entity_id, entity_revision_id, preparation_kind, dosage_form,
        administration_routes, standardization_status, basis_assertion_id
      ) VALUES (
        '${preparationId}', '${preparationRevisionId}', 'homeopathic_single',
        'globules', ARRAY['oral'], 'not_applicable', '${basisAssertionId}'
      );

      INSERT INTO public.kb_homeopathic_revision_details (
        entity_id, entity_revision_id, remedy_kind, potency_scale,
        potency_value, potentization_method, basis_assertion_id
      ) VALUES (
        '${preparationId}', '${preparationRevisionId}', 'single', 'D', 6,
        'hahnemannian', '${basisAssertionId}'
      );

      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '${preparationRevisionId}';
      UPDATE public.kb_entities
         SET current_revision_id = '${preparationRevisionId}'
       WHERE id = '${preparationId}';
      SET CONSTRAINTS ALL IMMEDIATE;
      COMMIT;
    `);

    const stored = await db.query<{
      is_valid: boolean;
      content_hash: string;
      calculated_hash: string;
      preparation_kind: string;
      potency: string;
    }>(`
      SELECT
        public.kb_therapeutic_revision_is_valid(revision.entity_id, revision.id) AS is_valid,
        revision.content_hash,
        public.kb_therapeutic_revision_hash(revision.entity_id, revision.id) AS calculated_hash,
        preparation.preparation_kind,
        homeopathic.potency_scale || trim_scale(homeopathic.potency_value) AS potency
      FROM public.kb_entity_revisions revision
      JOIN public.kb_preparation_revision_details preparation
        ON preparation.entity_revision_id = revision.id
      JOIN public.kb_homeopathic_revision_details homeopathic
        ON homeopathic.entity_revision_id = revision.id
      WHERE revision.id = '${preparationRevisionId}'
    `);
    expect(stored.rows[0]).toEqual(expect.objectContaining({
      is_valid: true,
      preparation_kind: "homeopathic_single",
      potency: "D6",
    }));
    expect(stored.rows[0].content_hash).toBe(stored.rows[0].calculated_hash);
    expect(stored.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects missing subtype details and semantic hash drift at transaction end", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('20000000-0000-4000-8000-000000000102', 'preparation', 'preparation:missing-subtype');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '30000000-0000-4000-8000-000000000102',
        '20000000-0000-4000-8000-000000000102', 1,
        'Fehlender Untertyp', repeat('2', 64)
      );
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000102',
        'assertion:missing-subtype', 1, 'classification', 'Nur Test', repeat('3', 64)
      );
      INSERT INTO public.kb_preparation_revision_details (
        entity_id, entity_revision_id, preparation_kind, dosage_form,
        administration_routes, basis_assertion_id
      ) VALUES (
        '20000000-0000-4000-8000-000000000102',
        '30000000-0000-4000-8000-000000000102',
        'homeopathic_single', 'globules', ARRAY['oral'],
        '40000000-0000-4000-8000-000000000102'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '30000000-0000-4000-8000-000000000102';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Therapeutic catalog revision is incomplete/);

    await expectTransactionFailure(`
      UPDATE public.kb_entity_revisions
         SET summary = 'Manipulierter Inhalt ohne neuen Hash'
       WHERE id = '${preparationRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /invalid content hash/);
  });

  it("rejects contradictory subtypes and non-canonical set-like arrays", async () => {
    await expectTransactionFailure(`
      UPDATE public.kb_homeopathic_revision_details
         SET remedy_kind = 'complex', potency_scale = NULL, potency_value = NULL
       WHERE entity_revision_id = '${preparationRevisionId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '${preparationRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Therapeutic catalog revision is incomplete/);

    await expectTransactionFailure(`
      UPDATE public.kb_preparation_revision_details
         SET administration_routes = ARRAY['sublingual', 'oral']
       WHERE entity_revision_id = '${preparationRevisionId}';
    `, /administration_routes_check|kb_preparation_routes_canonical/);

    await expectTransactionFailure(`
      UPDATE public.kb_preparation_revision_details
         SET administration_routes = ARRAY[NULL]::text[]
       WHERE entity_revision_id = '${preparationRevisionId}';
    `, /administration_routes_check|kb_preparation_routes_canonical/);
  });

  it("rejects preparation details for the wrong entity type", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('20000000-0000-4000-8000-000000000103', 'plant', 'plant:wrong-detail-owner');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '30000000-0000-4000-8000-000000000103',
        '20000000-0000-4000-8000-000000000103', 1,
        'Falscher Detailtyp', repeat('4', 64)
      );
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000103',
        'assertion:wrong-detail-owner', 1, 'classification', 'Nur Test', repeat('5', 64)
      );
      INSERT INTO public.kb_preparation_revision_details (
        entity_id, entity_revision_id, preparation_kind, dosage_form,
        administration_routes, basis_assertion_id
      ) VALUES (
        '20000000-0000-4000-8000-000000000103',
        '30000000-0000-4000-8000-000000000103',
        'other', 'other', ARRAY['other'],
        '40000000-0000-4000-8000-000000000103'
      );
    `, /Preparation details require a preparation entity/);
  });

  it("lets an authenticated administrator create and hash a valid draft", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${adminId}', false);
    `);
    try {
      await db.exec(`
        BEGIN;
        INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
        VALUES (
          '20000000-0000-4000-8000-000000000104',
          'preparation',
          'preparation:admin-synthetic-other'
        );
        INSERT INTO public.kb_entity_revisions (
          id, entity_id, revision_no, display_name, content_hash
        ) VALUES (
          '30000000-0000-4000-8000-000000000104',
          '20000000-0000-4000-8000-000000000104',
          1, 'Admin Testzubereitung', repeat('6', 64)
        );
        INSERT INTO public.kb_assertions (
          id, canonical_key, version_no, assertion_kind, claim_text, content_hash
        ) VALUES (
          '40000000-0000-4000-8000-000000000104',
          'assertion:admin-synthetic-other',
          1, 'classification', 'Synthetische Admin-Testaussage', repeat('7', 64)
        );
        INSERT INTO public.kb_preparation_revision_details (
          entity_id, entity_revision_id, preparation_kind, dosage_form,
          administration_routes, basis_assertion_id
        ) VALUES (
          '20000000-0000-4000-8000-000000000104',
          '30000000-0000-4000-8000-000000000104',
          'other', 'other', ARRAY['other'],
          '40000000-0000-4000-8000-000000000104'
        );
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
         WHERE id = '30000000-0000-4000-8000-000000000104';
        SET CONSTRAINTS ALL IMMEDIATE;
        COMMIT;
      `);
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
    }

    const created = await db.query<{ count: number }>(`
      SELECT count(*)::int FROM public.kb_preparation_revision_details
       WHERE entity_revision_id = '30000000-0000-4000-8000-000000000104'
    `);
    expect(created.rows[0].count).toBe(1);
  });

  it("binds component types and referenced revision hashes into owner validity", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES (
        '20000000-0000-4000-8000-000000000105',
        'substance',
        'substance:synthetic-component'
      );
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '30000000-0000-4000-8000-000000000105',
        '20000000-0000-4000-8000-000000000105',
        1, 'Synthetische Komponente', repeat('8', 64)
      );
      INSERT INTO public.kb_composition_components (
        id, owner_entity_id, owner_revision_id, component_entity_id,
        component_revision_id, component_role, amount_min, amount_max,
        amount_unit, component_order, basis_assertion_id
      ) VALUES (
        '50000000-0000-4000-8000-000000000105',
        '20000000-0000-4000-8000-000000000104',
        '30000000-0000-4000-8000-000000000104',
        '20000000-0000-4000-8000-000000000105',
        '30000000-0000-4000-8000-000000000105',
        'active', 1, 1, 'mg', 1,
        '40000000-0000-4000-8000-000000000104'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '30000000-0000-4000-8000-000000000104';
      SET CONSTRAINTS ALL IMMEDIATE;
      COMMIT;
    `);

    await expectTransactionFailure(`
      UPDATE public.kb_entity_revisions
         SET summary = 'Geaenderte Referenz', content_hash = repeat('9', 64)
       WHERE id = '30000000-0000-4000-8000-000000000105';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Referenced revision change would invalidate/);

    await db.exec("BEGIN; ALTER TABLE public.kb_entities DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_entities
           SET entity_type_code = 'disease'
         WHERE id = '20000000-0000-4000-8000-000000000105'
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_therapeutic_catalog_revision_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("detects wrong-owner detail rows even when restore triggers are disabled", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_preparation_revision_details DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        INSERT INTO public.kb_preparation_revision_details (
          entity_id, entity_revision_id, preparation_kind, dosage_form,
          administration_routes, basis_assertion_id
        ) VALUES (
          '20000000-0000-4000-8000-000000000105',
          '30000000-0000-4000-8000-000000000105',
          'other', 'other', ARRAY['other'],
          '40000000-0000-4000-8000-000000000104'
        )
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_therapeutic_catalog_revision_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("validates both owners when a dependency is moved between draft revisions", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES (
        '20000000-0000-4000-8000-000000000106',
        'preparation',
        'preparation:synthetic-move-target'
      );
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '30000000-0000-4000-8000-000000000106',
        '20000000-0000-4000-8000-000000000106',
        1, 'Synthetisches Verschiebeziel', repeat('b', 64)
      );
      INSERT INTO public.kb_preparation_revision_details (
        entity_id, entity_revision_id, preparation_kind, dosage_form,
        administration_routes, basis_assertion_id
      ) VALUES (
        '20000000-0000-4000-8000-000000000106',
        '30000000-0000-4000-8000-000000000106',
        'other', 'other', ARRAY['other'],
        '40000000-0000-4000-8000-000000000104'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '30000000-0000-4000-8000-000000000106';
      SET CONSTRAINTS ALL IMMEDIATE;
      COMMIT;
    `);

    await expectTransactionFailure(`
      UPDATE public.kb_composition_components
         SET owner_entity_id = '20000000-0000-4000-8000-000000000106',
             owner_revision_id = '30000000-0000-4000-8000-000000000106'
       WHERE id = '50000000-0000-4000-8000-000000000105';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '30000000-0000-4000-8000-000000000106';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Previous therapeutic catalog revision became invalid/);
  });

  it("requires exact source locators and protects approved source dependencies", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_sources (id, canonical_key)
      VALUES ('60000000-0000-4000-8000-000000000101', 'source:synthetic-catalog-basis');
      INSERT INTO public.kb_source_revisions (
        id, source_id, revision_no, source_type, title, content_hash
      ) VALUES (
        '61000000-0000-4000-8000-000000000101',
        '60000000-0000-4000-8000-000000000101',
        1, 'traditional_reference', 'Synthetische Katalogquelle', repeat('a', 64)
      );
      UPDATE public.kb_sources
         SET current_revision_id = '61000000-0000-4000-8000-000000000101'
       WHERE id = '60000000-0000-4000-8000-000000000101';
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '${basisAssertionId}',
        '61000000-0000-4000-8000-000000000101',
        'supports', '', true
      );
      COMMIT;

      UPDATE public.kb_source_revisions SET review_status = 'domain_review'
       WHERE id = '61000000-0000-4000-8000-000000000101';
      UPDATE public.kb_source_revisions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = '${adminId}'
       WHERE id = '61000000-0000-4000-8000-000000000101';
      UPDATE public.kb_assertions SET review_status = 'domain_review'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_assertions SET review_status = 'safety_review'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_assertions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = '${adminId}'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_entity_revisions SET review_status = 'domain_review'
       WHERE id = '${preparationRevisionId}';
      UPDATE public.kb_entity_revisions SET review_status = 'safety_review'
       WHERE id = '${preparationRevisionId}';
    `);

    await expectTransactionFailure(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = '${adminId}'
       WHERE id = '${preparationRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /incomplete, unreviewed, unsourced/);

    await db.exec(`
      UPDATE public.kb_assertions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_assertion_sources
         SET locator = 'S. 1'
       WHERE assertion_id = '${basisAssertionId}';
      UPDATE public.kb_assertions SET review_status = 'domain_review'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_assertions SET review_status = 'safety_review'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_assertions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = '${adminId}'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_entity_revisions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = '${adminId}'
       WHERE id = '${preparationRevisionId}';
    `);

    await expectTransactionFailure(`
      UPDATE public.kb_source_revisions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL
       WHERE id = '61000000-0000-4000-8000-000000000101';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Source revision change would invalidate/);
  });

  it("keeps exact historical assertions and sources replayable after supersession", async () => {
    await db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'released', released_at = now()
       WHERE id = '61000000-0000-4000-8000-000000000101';
      UPDATE public.kb_assertions
         SET review_status = 'released', released_at = now()
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_entity_revisions
         SET review_status = 'released', released_at = now()
       WHERE id = '${preparationRevisionId}';
      UPDATE public.kb_entity_revisions SET review_status = 'superseded'
       WHERE id = '${preparationRevisionId}';
      UPDATE public.kb_assertions SET review_status = 'superseded'
       WHERE id = '${basisAssertionId}';
      UPDATE public.kb_source_revisions SET review_status = 'superseded'
       WHERE id = '61000000-0000-4000-8000-000000000101';
    `);

    const historical = await db.query<{ is_valid: boolean }>(`
      SELECT public.kb_therapeutic_revision_is_valid(entity_id, id) AS is_valid
        FROM public.kb_entity_revisions
       WHERE id = '${preparationRevisionId}'
    `);
    expect(historical.rows[0].is_valid).toBe(true);
  });

  it("rejects unreviewed historical provenance after a trigger-disabled restore", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_assertions DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_assertions
           SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
               released_at = NULL, review_due_at = NULL
         WHERE id = '${basisAssertionId}'
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_therapeutic_catalog_revision_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    expect(therapeuticMigration).toContain(
      "CREATE CONSTRAINT TRIGGER kb_assertions_validate_therapeutic_dependents",
    );
  });

  it("keeps patient and importer roles out while service_role remains read-only", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${patientId}', false);
    `);
    try {
      const patientRows = await db.query<{ count: number }>(`
        SELECT count(*)::int FROM public.kb_preparation_revision_details
      `);
      expect(patientRows.rows[0].count).toBe(0);
      await db.exec(`
        DELETE FROM public.kb_preparation_revision_details
         WHERE entity_revision_id = '${preparationRevisionId}'
      `);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    const rowsAfterPatientDelete = await db.query<{ count: number }>(`
      SELECT count(*)::int FROM public.kb_preparation_revision_details
       WHERE entity_revision_id = '${preparationRevisionId}'
    `);
    expect(rowsAfterPatientDelete.rows[0].count).toBe(1);

    await db.exec("SET ROLE service_role;");
    try {
      const serviceRows = await db.query<{ count: number }>(`
        SELECT count(*)::int FROM public.kb_preparation_revision_details
         WHERE entity_revision_id = '${preparationRevisionId}'
      `);
      expect(serviceRows.rows[0].count).toBe(1);
      await expect(db.exec(`
        DELETE FROM public.kb_preparation_revision_details
         WHERE entity_revision_id = '${preparationRevisionId}'
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await db.exec("SET ROLE kb_importer;");
    try {
      await expect(db.query(`SELECT * FROM public.kb_preparation_revision_details`))
        .rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("exports and restores all 38 wiki tables with exact manifests", async () => {
    const snapshot = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>(`SELECT public.kb_export_wiki_snapshot() AS value`);

    expect(Object.keys(snapshot.rows[0].value.tables)).toHaveLength(38);
    expect(Object.keys(snapshot.rows[0].value.manifest)).toHaveLength(38);
    expect(snapshot.rows[0].value.validation.invalid_therapeutic_catalog_revisions).toBe(0);
    for (const table of therapeuticTables) {
      expect(snapshot.rows[0].value.tables).toHaveProperty(table);
      expect(backupAreasSource).toContain(`"${table}"`);
      expect(backupExportSource).toContain(`"${table}"`);
    }

    expect(backupExportSource).toContain("...REQUIRED_KB_THERAPEUTIC_TABLES");
    expect(backupExportSource).toContain('"invalid_therapeutic_catalog_revisions"');
    expect(backupCenterSource).toContain("Alle ${wikiTableCount} Wiki-Tabellen");
    expect(backupCenterSource).toContain("invalid_therapeutic_catalog_revisions");

    const originalSnapshot = snapshot.rows[0].value;
    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }
      await db.exec(`TRUNCATE TABLE ${wikiSnapshotTables.map((table) => `public.${table}`).join(", ")};`);
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [JSON.stringify(originalSnapshot.tables[table])],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }

      const restored = await db.query<{
        value: { manifest: Record<string, unknown>; validation: Record<string, number> };
      }>(`SELECT public.kb_export_wiki_snapshot() AS value`);
      expect(restored.rows[0].value.validation).toEqual(expect.objectContaining({
        missing_articles: 0,
        invalid_current_snapshots: 0,
        orphaned_active_articles: 0,
        invalid_source_promotions: 0,
        invalid_therapeutic_catalog_revisions: 0,
      }));
      expect(restored.rows[0].value.manifest).toEqual(originalSnapshot.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  }, 15_000);
});
