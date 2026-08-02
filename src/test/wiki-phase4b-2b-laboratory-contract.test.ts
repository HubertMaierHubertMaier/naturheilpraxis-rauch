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
  "20260802100000_create_kb_laboratory_contract.sql",
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const laboratoryMigration = migrations.at(-1)!;
const releaseMigration = migrations.at(-4)!;

const laboratoryTables = [
  "kb_lab_parameter_revision_details",
  "kb_lab_reference_ranges",
  "kb_lab_finding_definition_revision_details",
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
  "kb_lab_parameter_revision_details", "kb_lab_reference_ranges",
  "kb_lab_finding_definition_revision_details",
  "kb_dosage_rules", "kb_safety_rules", "kb_safety_rule_conditions",
  "kb_releases", "kb_release_items", "kb_search_documents",
  "faqs", "practice_pricing", "practice_info",
] as const;

const wikiRestoreOrder = [
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_preparation_revision_details", "kb_homeopathic_revision_details",
  "kb_botanical_revision_details", "kb_nutrient_revision_details",
  "kb_product_variant_revision_details", "kb_composition_components",
  "kb_lab_parameter_revision_details", "kb_lab_reference_ranges",
  "kb_lab_finding_definition_revision_details",
  "kb_dosage_rules", "kb_safety_rules", "kb_safety_rule_conditions",
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
  "kb_search_documents", "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

const zeroValidationKeys = [
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
  "invalid_lab_parameter_revisions",
  "invalid_lab_reference_ranges",
  "invalid_lab_finding_definition_revisions",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const parameterId = "30000000-0000-4000-8000-000000000001";
const parameterRevisionId = "31000000-0000-4000-8000-000000000001";
const methodId = "30000000-0000-4000-8000-000000000002";
const methodRevisionId = "31000000-0000-4000-8000-000000000002";
const laboratoryId = "30000000-0000-4000-8000-000000000003";
const laboratoryRevisionId = "31000000-0000-4000-8000-000000000003";
const populationId = "30000000-0000-4000-8000-000000000004";
const populationRevisionId = "31000000-0000-4000-8000-000000000004";
const findingId = "30000000-0000-4000-8000-000000000005";
const findingRevisionId = "31000000-0000-4000-8000-000000000005";
const parameterBasisAssertionId = "40000000-0000-4000-8000-000000000001";
const rangeAssertionId = "40000000-0000-4000-8000-000000000002";
const findingBasisAssertionId = "40000000-0000-4000-8000-000000000003";
const referenceRangeId = "50000000-0000-4000-8000-000000000001";

type InitialState = {
  parameters: number;
  ranges: number;
  findings: number;
  tables: number;
  serialized: number;
  manifest: number;
  invalidParameters: number;
  invalidRanges: number;
  invalidFindings: number;
};

let db: PGlite;
let initialState: InitialState;

async function bootstrapDatabase(target: PGlite): Promise<void> {
  await target.exec(`
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
}

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

async function approveRevision(
  table: "kb_source_revisions" | "kb_entity_revisions" | "kb_assertions",
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
           reviewed_at = '2026-08-02T10:30:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
}

async function releaseRevision(
  table: "kb_source_revisions" | "kb_entity_revisions" | "kb_assertions",
  id: string,
): Promise<void> {
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'released', released_at = '2026-08-02T10:31:00Z'
     WHERE id = $1::uuid
  `, [id]);
}

function sourcedClassificationSql(id: string, key: string, locator: string): string {
  return `
    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text, content_hash
    ) VALUES (
      '${id}', '${key}', 1, 'classification', 'Synthetic classification.', repeat('a', 64)
    );
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES (
      '${id}', '${sourceRevisionId}', 'supports', '${locator}', true
    );
  `;
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase(db);
  for (const migration of migrations) {
    await db.exec(migration);
  }

  initialState = (await db.query<InitialState>(`
    SELECT
      (SELECT count(*)::int FROM public.kb_lab_parameter_revision_details) AS parameters,
      (SELECT count(*)::int FROM public.kb_lab_reference_ranges) AS ranges,
      (SELECT count(*)::int FROM public.kb_lab_finding_definition_revision_details) AS findings,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'tables'
      )) AS tables,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'serialized_tables'
      )) AS serialized,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'manifest'
      )) AS manifest,
      public.kb_invalid_lab_parameter_revision_count()::int AS "invalidParameters",
      public.kb_invalid_lab_reference_range_count()::int AS "invalidRanges",
      public.kb_invalid_lab_finding_definition_revision_count()::int AS "invalidFindings"
  `)).rows[0];

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:synthetic-laboratory-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'database',
      'Synthetic laboratory reference', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${parameterId}', 'lab_parameter', 'lab-parameter:synthetic-reserve-marker'),
      ('${methodId}', 'diagnostic_method', 'diagnostic-method:synthetic-immunoassay'),
      ('${laboratoryId}', 'laboratory', 'laboratory:synthetic-reference-facility'),
      ('${populationId}', 'population_group', 'population:synthetic-adult-cohort'),
      ('${findingId}', 'lab_finding_definition', 'lab-finding:synthetic-reserve-below-range');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary, description_markdown, content_hash
    ) VALUES
      ('${parameterRevisionId}', '${parameterId}', 1, 'Synthetic reserve marker',
       'Synthetic quantity marker.', 'Schema-only laboratory parameter.', repeat('0', 64)),
      ('${methodRevisionId}', '${methodId}', 1, 'Synthetic immunoassay',
       'Synthetic diagnostic method.', '', repeat('2', 64)),
      ('${laboratoryRevisionId}', '${laboratoryId}', 1, 'Synthetic reference facility',
       'Synthetic laboratory.', '', repeat('3', 64)),
      ('${populationRevisionId}', '${populationId}', 1, 'Synthetic adult cohort',
       'Synthetic population.', '', repeat('4', 64)),
      ('${findingRevisionId}', '${findingId}', 1, 'Synthetic reserve marker below range',
       'Synthetic range classification.', '', repeat('0', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN (
         '${parameterId}', '${methodId}', '${laboratoryId}', '${populationId}', '${findingId}'
       );
    INSERT INTO public.kb_entity_identifiers (
      entity_id, scheme_code, value, normalized_value, is_primary
    ) VALUES ('${parameterId}', 'loinc', '99999-9', '99999-9', true);

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text,
      evidence_basis, content_hash
    ) VALUES
      ('${parameterBasisAssertionId}', 'assertion:synthetic-parameter-basis', 1,
       'classification', 'Synthetic parameter classification.', 'practice_rule', repeat('5', 64)),
      ('${rangeAssertionId}', 'assertion:synthetic-reference-range', 1,
       'classification', 'Synthetic sourced numeric interval.', 'practice_rule', repeat('6', 64)),
      ('${findingBasisAssertionId}', 'assertion:synthetic-finding-basis', 1,
       'classification', 'Synthetic below-range classification.', 'practice_rule', repeat('7', 64));
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, original_quote, is_primary
    ) VALUES
      ('${parameterBasisAssertionId}', '${sourceRevisionId}', 'supports', 'table:parameter', 'Parameter', true),
      ('${rangeAssertionId}', '${sourceRevisionId}', 'supports', 'table:range', 'Range', true),
      ('${findingBasisAssertionId}', '${sourceRevisionId}', 'qualifies', 'table:finding', 'Finding', true);

    INSERT INTO public.kb_lab_parameter_revision_details (
      entity_id, entity_revision_id, specimen_kind, value_kind,
      canonical_unit_system, canonical_unit_code, basis_assertion_id
    ) VALUES (
      '${parameterId}', '${parameterRevisionId}', 'serum', 'quantity',
      'ucum', 'ug/L', '${parameterBasisAssertionId}'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_lab_parameter_revision_hash_v1(entity_id, id)
     WHERE id = '${parameterRevisionId}';

    INSERT INTO public.kb_lab_reference_ranges (
      id, assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
      diagnostic_method_entity_id, diagnostic_method_revision_id,
      laboratory_entity_id, laboratory_revision_id,
      population_group_entity_id, population_group_revision_id,
      sex_scope, age_min_years, age_max_years, range_kind, unit_system, unit_code,
      lower_bound, lower_inclusive, upper_bound, upper_inclusive, range_content_hash
    ) VALUES (
      '${referenceRangeId}', '${rangeAssertionId}', '${parameterId}', '${parameterRevisionId}',
      '${methodId}', '${methodRevisionId}', '${laboratoryId}', '${laboratoryRevisionId}',
      '${populationId}', '${populationRevisionId}',
      'any', 18, 80, 'numeric_interval', 'ucum', 'ug/L',
      25, true, 250, true, repeat('0', 64)
    );
    UPDATE public.kb_lab_reference_ranges
       SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
     WHERE id = '${referenceRangeId}';

    INSERT INTO public.kb_lab_finding_definition_revision_details (
      entity_id, entity_revision_id, lab_parameter_entity_id,
      lab_parameter_revision_id, reference_range_id, interpretation_kind,
      basis_assertion_id
    ) VALUES (
      '${findingId}', '${findingRevisionId}', '${parameterId}',
      '${parameterRevisionId}', '${referenceRangeId}', 'below_range',
      '${findingBasisAssertionId}'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
     WHERE id = '${findingRevisionId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki 4B-2b laboratory contract", () => {
  it("adds exactly three empty schema-only tables at the 56-to-59 boundary", async () => {
    expect(Array.from(
      laboratoryMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    )).toEqual(laboratoryTables);
    expect(initialState).toEqual({
      parameters: 0,
      ranges: 0,
      findings: 0,
      tables: 59,
      serialized: 59,
      manifest: 59,
      invalidParameters: 0,
      invalidRanges: 0,
      invalidFindings: 0,
    });
    expect(wikiSnapshotTables).toHaveLength(59);
    expect(new Set(wikiSnapshotTables).size).toBe(59);
    expect(new Set(wikiRestoreOrder)).toEqual(new Set(wikiSnapshotTables));
    expect(laboratoryMigration).toContain("exact 56-table Wiki boundary");
    expect(laboratoryMigration).toContain("'kb_search_documents'");
    expect(laboratoryMigration).toContain("no pre-existing lab parameter or finding revisions");
    expect(laboratoryMigration).toMatch(/^BEGIN;/);
    expect(laboratoryMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(laboratoryMigration).not.toMatch(/INSERT INTO public\.kb_/);
    expect(laboratoryMigration).not.toContain("therapy_input_");
    expect(laboratoryMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(laboratoryMigration).not.toMatch(/\bmay_indicate\b/);
    expect(laboratoryMigration).not.toMatch(/ALTER TABLE public\.kb_releases/);
    expect(laboratoryMigration).not.toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.kb_(?:query|retrieve|convert|promote|create)_/i);
    expect(laboratoryMigration).toContain("FOR SHARE");
    expect(laboratoryMigration).toContain("FOR UPDATE");
    expect(laboratoryMigration).toContain("SET current_revision_id = entity.current_revision_id");
    expect(laboratoryMigration).toContain("SET content_hash = assertion.content_hash");
    expect(laboratoryMigration).toContain("RENAME TO kb_export_wiki_snapshot_4b2a");
    expect(releaseMigration).toContain("CHECK (NOT retrieval_eligible)");
    expect(releaseMigration).toContain("CHECK (NOT is_active)");

    const inactiveChecks = await db.query<{ count: number }>(`
      SELECT count(*)::int AS count
        FROM pg_constraint constraint_row
        JOIN pg_class relation ON relation.oid = constraint_row.conrelid
       WHERE relation.relname = 'kb_releases'
         AND (
           pg_get_constraintdef(constraint_row.oid) LIKE '%NOT retrieval_eligible%'
           OR pg_get_constraintdef(constraint_row.oid) LIKE '%NOT is_active%'
         )
    `);
    expect(inactiveChecks.rows[0].count).toBe(2);

    const columns = await db.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [laboratoryTables]);
    expect(columns.rows.some((column) => column.data_type === "jsonb")).toBe(false);
    expect(columns.rows.some((column) =>
      /(?:patient|user|session|pseudonym|anamnesis)/.test(column.column_name)
    )).toBe(false);
  });

  it("rejects a pre-existing typed revision because this step has no backfill", async () => {
    const preflightDb = new PGlite();
    try {
      await bootstrapDatabase(preflightDb);
      for (const migration of migrations.slice(0, -1)) {
        await preflightDb.exec(migration);
      }
      await preflightDb.exec(`
        INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
        VALUES ('39000000-0000-4000-8000-000000000001', 'lab_parameter', 'lab-parameter:preflight');
        INSERT INTO public.kb_entity_revisions (
          id, entity_id, revision_no, display_name, content_hash
        ) VALUES (
          '39100000-0000-4000-8000-000000000001',
          '39000000-0000-4000-8000-000000000001', 1, 'Preflight marker', repeat('0', 64)
        );
      `);
      await expect(preflightDb.exec(laboratoryMigration))
        .rejects.toThrow(/no pre-existing lab parameter or finding revisions/i);
    } finally {
      await preflightDb.exec("ROLLBACK;").catch(() => undefined);
      await preflightDb.close();
    }
  }, 120_000);

  it("accepts the exact sourced numeric bundle, generic LOINC identifier, and canonical hashes", async () => {
    const result = await db.query<{
      parameterValid: boolean;
      rangeValid: boolean;
      findingValid: boolean;
      invalidParameters: number;
      invalidRanges: number;
      invalidFindings: number;
      parameterHashMatches: boolean;
      rangeHashMatches: boolean;
      findingHashMatches: boolean;
      loinc: string;
    }>(`
      SELECT
        public.kb_lab_parameter_revision_is_valid(
          '${parameterId}', '${parameterRevisionId}'
        ) AS "parameterValid",
        public.kb_lab_reference_range_is_valid('${referenceRangeId}') AS "rangeValid",
        public.kb_lab_finding_definition_revision_is_valid(
          '${findingId}', '${findingRevisionId}'
        ) AS "findingValid",
        public.kb_invalid_lab_parameter_revision_count()::int AS "invalidParameters",
        public.kb_invalid_lab_reference_range_count()::int AS "invalidRanges",
        public.kb_invalid_lab_finding_definition_revision_count()::int AS "invalidFindings",
        parameter_revision.content_hash = public.kb_lab_parameter_revision_hash_v1(
          parameter_revision.entity_id, parameter_revision.id
        ) AS "parameterHashMatches",
        reference_range.range_content_hash = public.kb_lab_reference_range_hash_v1(
          reference_range.id
        ) AS "rangeHashMatches",
        finding_revision.content_hash = public.kb_lab_finding_definition_revision_hash_v1(
          finding_revision.entity_id, finding_revision.id
        ) AS "findingHashMatches",
        identifier.normalized_value AS loinc
      FROM public.kb_entity_revisions parameter_revision
      CROSS JOIN public.kb_lab_reference_ranges reference_range
      CROSS JOIN public.kb_entity_revisions finding_revision
      JOIN public.kb_entity_identifiers identifier ON identifier.entity_id = parameter_revision.entity_id
      WHERE parameter_revision.id = '${parameterRevisionId}'
        AND reference_range.id = '${referenceRangeId}'
        AND finding_revision.id = '${findingRevisionId}'
        AND identifier.scheme_code = 'loinc'
    `);
    expect(result.rows[0]).toEqual({
      parameterValid: true,
      rangeValid: true,
      findingValid: true,
      invalidParameters: 0,
      invalidRanges: 0,
      invalidFindings: 0,
      parameterHashMatches: true,
      rangeHashMatches: true,
      findingHashMatches: true,
      loinc: "99999-9",
    });

    const payloads = await db.query<{ parameter: string; range: string; finding: string }>(`
      SELECT
        public.kb_lab_parameter_revision_payload_v1(
          '${parameterId}', '${parameterRevisionId}'
        )::text AS parameter,
        public.kb_lab_reference_range_payload_v1('${referenceRangeId}')::text AS range,
        public.kb_lab_finding_definition_revision_payload_v1(
          '${findingId}', '${findingRevisionId}'
        )::text AS finding
    `);
    expect(payloads.rows[0].parameter).toContain("table:parameter");
    expect(payloads.rows[0].parameter).toContain("99999-9");
    expect(payloads.rows[0].range).toContain("synthetic-immunoassay");
    expect(payloads.rows[0].range).toContain("table:range");
    expect(payloads.rows[0].finding).toContain("range_content_hash");
    expect(payloads.rows[0].finding).toContain("table:finding");
  });

  it("accepts canonical qualitative sets and keeps contradictory sourced ranges representable", async () => {
    await db.exec("BEGIN;");
    try {
      const codedParameterId = "33000000-0000-4000-8000-000000000001";
      const codedParameterRevisionId = "33100000-0000-4000-8000-000000000001";
      const codedFindingId = "33000000-0000-4000-8000-000000000002";
      const codedFindingRevisionId = "33100000-0000-4000-8000-000000000002";
      const codedBasisId = "43000000-0000-4000-8000-000000000001";
      const codedRangeAssertionId = "43000000-0000-4000-8000-000000000002";
      const codedFindingBasisId = "43000000-0000-4000-8000-000000000003";
      const codedRangeId = "53000000-0000-4000-8000-000000000001";
      await db.exec(`
        INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
          ('${codedParameterId}', 'lab_parameter', 'lab-parameter:synthetic-coded-marker'),
          ('${codedFindingId}', 'lab_finding_definition', 'lab-finding:synthetic-coded-in-set');
        INSERT INTO public.kb_entity_revisions (
          id, entity_id, revision_no, display_name, content_hash
        ) VALUES
          ('${codedParameterRevisionId}', '${codedParameterId}', 1, 'Synthetic coded marker', repeat('0', 64)),
          ('${codedFindingRevisionId}', '${codedFindingId}', 1, 'Synthetic coded marker in set', repeat('0', 64));
        UPDATE public.kb_entities entity SET current_revision_id = revision.id
          FROM public.kb_entity_revisions revision WHERE revision.entity_id = entity.id
           AND entity.id IN ('${codedParameterId}', '${codedFindingId}');
        ${sourcedClassificationSql(codedBasisId, "assertion:synthetic-coded-basis", "table:coded-parameter")}
        ${sourcedClassificationSql(codedRangeAssertionId, "assertion:synthetic-coded-range", "table:coded-range")}
        ${sourcedClassificationSql(codedFindingBasisId, "assertion:synthetic-coded-finding", "table:coded-finding")}
        INSERT INTO public.kb_lab_parameter_revision_details (
          entity_id, entity_revision_id, specimen_kind, value_kind,
          canonical_unit_system, canonical_unit_code, basis_assertion_id
        ) VALUES (
          '${codedParameterId}', '${codedParameterRevisionId}', 'serum', 'coded',
          'unitless', '1', '${codedBasisId}'
        );
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_lab_parameter_revision_hash_v1(entity_id, id)
         WHERE id = '${codedParameterRevisionId}';
        INSERT INTO public.kb_lab_reference_ranges (
          id, assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
          diagnostic_method_entity_id, diagnostic_method_revision_id,
          sex_scope, range_kind, unit_system, unit_code, qualitative_codes,
          range_content_hash
        ) VALUES (
          '${codedRangeId}', '${codedRangeAssertionId}', '${codedParameterId}',
          '${codedParameterRevisionId}', '${methodId}', '${methodRevisionId}',
          'any', 'qualitative_set', 'unitless', '1', ARRAY['negative', 'positive'],
          repeat('0', 64)
        );
        UPDATE public.kb_lab_reference_ranges
           SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
         WHERE id = '${codedRangeId}';
        INSERT INTO public.kb_lab_finding_definition_revision_details (
          entity_id, entity_revision_id, lab_parameter_entity_id,
          lab_parameter_revision_id, reference_range_id, interpretation_kind,
          basis_assertion_id
        ) VALUES (
          '${codedFindingId}', '${codedFindingRevisionId}', '${codedParameterId}',
          '${codedParameterRevisionId}', '${codedRangeId}', 'qualitative_in_set',
          '${codedFindingBasisId}'
        );
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
         WHERE id = '${codedFindingRevisionId}';

        ${sourcedClassificationSql(
          "43000000-0000-4000-8000-000000000004",
          "assertion:synthetic-contradictory-range",
          "table:contradictory-range",
        )}
        INSERT INTO public.kb_lab_reference_ranges (
          id, assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
          diagnostic_method_entity_id, diagnostic_method_revision_id,
          laboratory_entity_id, laboratory_revision_id,
          population_group_entity_id, population_group_revision_id,
          sex_scope, age_min_years, age_max_years, range_kind, unit_system, unit_code,
          lower_bound, lower_inclusive, upper_bound, upper_inclusive, range_content_hash
        ) VALUES (
          '53000000-0000-4000-8000-000000000002',
          '43000000-0000-4000-8000-000000000004',
          '${parameterId}', '${parameterRevisionId}', '${methodId}', '${methodRevisionId}',
          '${laboratoryId}', '${laboratoryRevisionId}', '${populationId}', '${populationRevisionId}',
          'any', 18, 80, 'numeric_interval', 'ucum', 'ug/L',
          35, true, 240, true, repeat('0', 64)
        );
        UPDATE public.kb_lab_reference_ranges
           SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
         WHERE id = '53000000-0000-4000-8000-000000000002';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      const validity = await db.query<{ coded: boolean; finding: boolean; scopedRanges: number }>(`
        SELECT
          public.kb_lab_reference_range_is_valid('${codedRangeId}') AS coded,
          public.kb_lab_finding_definition_revision_is_valid(
            '${codedFindingId}', '${codedFindingRevisionId}'
          ) AS finding,
          (SELECT count(*)::int FROM public.kb_lab_reference_ranges
            WHERE lab_parameter_revision_id = '${parameterRevisionId}') AS "scopedRanges"
      `);
      expect(validity.rows[0]).toEqual({ coded: true, finding: true, scopedRanges: 2 });
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  }, 30_000);

  it("rejects wrong owner, method, optional dependency, and exact-pair types", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_lab_parameter_revision_details (
        entity_id, entity_revision_id, specimen_kind, value_kind,
        canonical_unit_system, canonical_unit_code, basis_assertion_id
      ) VALUES (
        '${methodId}', '${methodRevisionId}', 'serum', 'quantity',
        'ucum', 'ug/L', '${parameterBasisAssertionId}'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_parameter_revision_hash_v1(entity_id, id)
       WHERE id = '${methodRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      ${sourcedClassificationSql(
        "44000000-0000-4000-8000-000000000001",
        "assertion:wrong-method-type",
        "table:wrong-method",
      )}
      INSERT INTO public.kb_lab_reference_ranges (
        assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
        diagnostic_method_entity_id, diagnostic_method_revision_id,
        sex_scope, range_kind, unit_system, unit_code,
        lower_bound, lower_inclusive, range_content_hash
      ) VALUES (
        '44000000-0000-4000-8000-000000000001', '${parameterId}', '${parameterRevisionId}',
        '${laboratoryId}', '${laboratoryRevisionId}', 'any', 'numeric_interval',
        'ucum', 'ug/L', 20, true, repeat('0', 64)
      );
      UPDATE public.kb_lab_reference_ranges
         SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
       WHERE assertion_id = '44000000-0000-4000-8000-000000000001';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      UPDATE public.kb_lab_reference_ranges
         SET laboratory_entity_id = '${methodId}',
             laboratory_revision_id = '${methodRevisionId}'
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_lab_reference_ranges
         SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
       WHERE id = '${findingRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      UPDATE public.kb_lab_finding_definition_revision_details
         SET lab_parameter_revision_id = '${methodRevisionId}'
       WHERE entity_revision_id = '${findingRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /foreign key|laboratory contract/i);
  });

  it("requires parameter details, ranges, methods, primary sources, and locators", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('34000000-0000-4000-8000-000000000001', 'lab_parameter', 'lab-parameter:missing-detail');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '34100000-0000-4000-8000-000000000001',
        '34000000-0000-4000-8000-000000000001', 1, 'Missing detail', repeat('0', 64)
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      ${sourcedClassificationSql(
        "44000000-0000-4000-8000-000000000010",
        "assertion:missing-method",
        "table:missing-method",
      )}
      INSERT INTO public.kb_lab_reference_ranges (
        assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
        diagnostic_method_entity_id, diagnostic_method_revision_id,
        sex_scope, range_kind, unit_system, unit_code,
        lower_bound, lower_inclusive, range_content_hash
      ) VALUES (
        '44000000-0000-4000-8000-000000000010', '${parameterId}', '${parameterRevisionId}',
        '${methodId}', '34900000-0000-4000-8000-000000000001',
        'any', 'numeric_interval', 'ucum', 'ug/L', 20, true, repeat('0', 64)
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /foreign key|laboratory contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('34000000-0000-4000-8000-000000000002', 'lab_parameter', 'lab-parameter:missing-source');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '34100000-0000-4000-8000-000000000002',
        '34000000-0000-4000-8000-000000000002', 1, 'Missing source', repeat('0', 64)
      );
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '44000000-0000-4000-8000-000000000011', 'assertion:missing-source', 1,
        'classification', 'Missing source.', repeat('b', 64)
      );
      INSERT INTO public.kb_lab_parameter_revision_details (
        entity_id, entity_revision_id, specimen_kind, value_kind,
        canonical_unit_system, canonical_unit_code, basis_assertion_id
      ) VALUES (
        '34000000-0000-4000-8000-000000000002',
        '34100000-0000-4000-8000-000000000002', 'serum', 'quantity',
        'ucum', 'ug/L', '44000000-0000-4000-8000-000000000011'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_parameter_revision_hash_v1(entity_id, id)
       WHERE id = '34100000-0000-4000-8000-000000000002';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('34000000-0000-4000-8000-000000000003', 'lab_parameter', 'lab-parameter:blank-locator');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '34100000-0000-4000-8000-000000000003',
        '34000000-0000-4000-8000-000000000003', 1, 'Blank locator', repeat('0', 64)
      );
      ${sourcedClassificationSql(
        "44000000-0000-4000-8000-000000000012",
        "assertion:blank-locator",
        "   ",
      )}
      INSERT INTO public.kb_lab_parameter_revision_details (
        entity_id, entity_revision_id, specimen_kind, value_kind,
        canonical_unit_system, canonical_unit_code, basis_assertion_id
      ) VALUES (
        '34000000-0000-4000-8000-000000000003',
        '34100000-0000-4000-8000-000000000003', 'serum', 'quantity',
        'ucum', 'ug/L', '44000000-0000-4000-8000-000000000012'
      );
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_parameter_revision_hash_v1(entity_id, id)
       WHERE id = '34100000-0000-4000-8000-000000000003';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('34000000-0000-4000-8000-000000000004', 'lab_finding_definition', 'lab-finding:missing-range');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '34100000-0000-4000-8000-000000000004',
        '34000000-0000-4000-8000-000000000004', 1, 'Missing range', repeat('0', 64)
      );
      INSERT INTO public.kb_lab_finding_definition_revision_details (
        entity_id, entity_revision_id, lab_parameter_entity_id,
        lab_parameter_revision_id, reference_range_id, interpretation_kind,
        basis_assertion_id
      ) VALUES (
        '34000000-0000-4000-8000-000000000004',
        '34100000-0000-4000-8000-000000000004', '${parameterId}',
        '${parameterRevisionId}', '54900000-0000-4000-8000-000000000001',
        'below_range', '${findingBasisAssertionId}'
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /foreign key|laboratory contract/i);
  });

  it("enforces specimen, unit, age, sex, numeric, and qualitative shapes", async () => {
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET specimen_kind = 'venous'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET canonical_unit_code = 'ug per L'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET canonical_unit_code = '+'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET canonical_unit_code = 'mg//L'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET value_kind = 'coded'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET sex_scope = 'unknown'
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET age_min_years = 131
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET age_min_years = 90
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET age_min_years = ('0.' || repeat('1', 40))::numeric
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET lower_bound = NULL, lower_inclusive = true
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET lower_bound = '1e101'::numeric
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET lower_bound = 25, lower_inclusive = false,
             upper_bound = 25, upper_inclusive = true
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET lower_bound = ('0.' || repeat('1', 140))::numeric
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET lower_bound = NULL, lower_inclusive = NULL,
             upper_bound = NULL, upper_inclusive = NULL
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET range_kind = 'qualitative_set', unit_system = 'unitless', unit_code = '1',
             lower_bound = NULL, lower_inclusive = NULL,
             upper_bound = NULL, upper_inclusive = NULL,
             qualitative_codes = ARRAY['positive', 'negative']
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges
         SET range_kind = 'qualitative_set', unit_system = 'ucum', unit_code = '1',
             lower_bound = NULL, lower_inclusive = NULL,
             upper_bound = NULL, upper_inclusive = NULL,
             qualitative_codes = ARRAY['negative']
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/check constraint/i);
    const canonicalCodes = await db.query<{ valid: boolean; invalid: boolean }>(`
      SELECT
        public.kb_lab_qualitative_code_array_is_valid_v1(
          ARRAY['negative', 'positive']
        ) AS valid,
        public.kb_lab_qualitative_code_array_is_valid_v1(
          ARRAY['positive', 'negative']
        ) AS invalid
    `);
    expect(canonicalCodes.rows[0]).toEqual({ valid: true, invalid: false });
  });

  it("rejects numeric/qualitative interpretation mismatch and uncoordinated source changes", async () => {
    await expectTransactionFailure(`
      UPDATE public.kb_lab_finding_definition_revision_details
         SET interpretation_kind = 'qualitative_in_set'
       WHERE entity_revision_id = '${findingRevisionId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
       WHERE id = '${findingRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      UPDATE public.kb_lab_reference_ranges
         SET lower_bound = NULL, lower_inclusive = NULL
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_lab_reference_ranges
         SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
       WHERE id = '${findingRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      UPDATE public.kb_lab_finding_definition_revision_details
         SET interpretation_kind = 'above_range'
       WHERE entity_revision_id = '${findingRevisionId}';
      UPDATE public.kb_lab_reference_ranges
         SET upper_bound = NULL, upper_inclusive = NULL
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_lab_reference_ranges
         SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
       WHERE id = '${referenceRangeId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
       WHERE id = '${findingRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await expectTransactionFailure(`
      UPDATE public.kb_assertion_sources
         SET locator = 'table:range:changed'
       WHERE assertion_id = '${rangeAssertionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /laboratory contract/i);

    await db.exec("BEGIN;");
    try {
      await db.exec(`
        UPDATE public.kb_assertion_sources
           SET locator = 'table:range:coordinated'
         WHERE assertion_id = '${rangeAssertionId}';
        UPDATE public.kb_lab_reference_ranges
           SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
         WHERE id = '${referenceRangeId}';
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_lab_finding_definition_revision_hash_v1(entity_id, id)
         WHERE id = '${findingRevisionId}';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      expect((await db.query<{ count: number }>(`
        SELECT public.kb_invalid_lab_reference_range_count()::int
             + public.kb_invalid_lab_finding_definition_revision_count()::int AS count
      `)).rows[0].count).toBe(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET created_at = created_at + interval '1 second'
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/stable.*immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details
         SET basis_assertion_id = '${findingBasisAssertionId}'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/stable.*immutable/i);
  });

  it("version-locks first classification source links and scopes deferred validation", async () => {
    const validatorDefinition = (await db.query<{ definition: string }>(`
      SELECT pg_get_functiondef(
        'public.kb_validate_laboratory_contract()'::regprocedure
      ) AS definition
    `)).rows[0].definition;
    expect(validatorDefinition).not.toContain("kb_invalid_lab_parameter_revision_count");
    expect(validatorDefinition).not.toContain("kb_invalid_lab_reference_range_count");
    expect(validatorDefinition).not.toContain("kb_invalid_lab_finding_definition_revision_count");
    expect(validatorDefinition).toContain("affected_parameters AS MATERIALIZED");
    const rangeDispatch = validatorDefinition.match(
      /WHEN 'kb_lab_reference_ranges' THEN([\s\S]*?)WHEN 'kb_lab_finding_definition_revision_details'/,
    )?.[1];
    const findingDispatch = validatorDefinition.match(
      /WHEN 'kb_lab_finding_definition_revision_details' THEN([\s\S]*?)WHEN 'kb_assertions'/,
    )?.[1];
    const rangeClosure = validatorDefinition.match(
      /affected_ranges AS MATERIALIZED \(([\s\S]*?)\),\s*affected_findings AS MATERIALIZED/,
    )?.[1];
    expect(rangeDispatch).toContain("affected_range_ids :=");
    expect(rangeDispatch).not.toContain("affected_revision_ids :=");
    expect(rangeDispatch).not.toContain("affected_entity_ids :=");
    expect(findingDispatch).toContain("affected_finding_revision_ids :=");
    expect(findingDispatch).not.toContain("affected_range_ids :=");
    expect(rangeClosure).toContain("UNION");
    expect(rangeClosure).not.toContain("_entity_id = ANY");

    await db.exec("BEGIN;");
    try {
      await db.exec(`
        CREATE TEMP TABLE kb_test_laboratory_assertion_locks (assertion_id uuid NOT NULL);
        CREATE FUNCTION public.kb_test_capture_laboratory_assertion_lock()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          INSERT INTO pg_temp.kb_test_laboratory_assertion_locks (assertion_id)
          VALUES (NEW.id);
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER kb_test_capture_laboratory_assertion_lock
          AFTER UPDATE ON public.kb_assertions
          FOR EACH ROW EXECUTE FUNCTION public.kb_test_capture_laboratory_assertion_lock();

        INSERT INTO public.kb_assertions (
          id, canonical_key, version_no, assertion_kind, claim_text, content_hash
        ) VALUES
          ('46000000-0000-4000-8000-000000000001', 'assertion:first-lab-link-a', 1,
           'classification', 'First laboratory link A.', repeat('8', 64)),
          ('46000000-0000-4000-8000-000000000002', 'assertion:first-lab-link-b', 1,
           'classification', 'First laboratory link B.', repeat('9', 64)),
          ('46000000-0000-4000-8000-000000000003', 'assertion:unrelated-narrative', 1,
           'narrative', 'Unrelated narrative.', repeat('a', 64));

        INSERT INTO public.kb_assertion_sources (
          assertion_id, source_revision_id, source_role, locator, is_primary
        ) VALUES (
          '46000000-0000-4000-8000-000000000001', '${sourceRevisionId}',
          'supports', 'table:first-link', true
        );
        UPDATE public.kb_assertion_sources
           SET assertion_id = '46000000-0000-4000-8000-000000000002'
         WHERE assertion_id = '46000000-0000-4000-8000-000000000001';
        DELETE FROM public.kb_assertion_sources
         WHERE assertion_id = '46000000-0000-4000-8000-000000000002';

        INSERT INTO public.kb_assertion_sources (
          assertion_id, source_revision_id, source_role, locator, is_primary
        ) VALUES (
          '46000000-0000-4000-8000-000000000003', '${sourceRevisionId}',
          'mentions', 'page:narrative', false
        );
        DELETE FROM public.kb_assertion_sources
         WHERE assertion_id = '46000000-0000-4000-8000-000000000003';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);

      expect((await db.query<{ assertion_id: string; updates: number }>(`
        SELECT assertion_id::text, count(*)::int AS updates
          FROM pg_temp.kb_test_laboratory_assertion_locks
         GROUP BY assertion_id
         ORDER BY assertion_id
      `)).rows).toEqual([
        { assertion_id: "46000000-0000-4000-8000-000000000001", updates: 2 },
        { assertion_id: "46000000-0000-4000-8000-000000000002", updates: 2 },
      ]);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("rejects stale hashes through every scoped core dependency", async () => {
    const staleWrites = [
      `UPDATE public.kb_entity_revisions
          SET display_name = 'Stale parameter revision'
        WHERE id = '${parameterRevisionId}'`,
      `UPDATE public.kb_assertions
          SET claim_text = 'Stale parameter assertion.'
        WHERE id = '${parameterBasisAssertionId}'`,
      `UPDATE public.kb_source_revisions
          SET title = 'Stale laboratory source'
        WHERE id = '${sourceRevisionId}'`,
      `UPDATE public.kb_entity_revisions
          SET display_name = 'Stale diagnostic method'
        WHERE id = '${methodRevisionId}'`,
      `UPDATE public.kb_entity_identifiers
          SET value = '88888-8', normalized_value = '88888-8'
        WHERE entity_id = '${parameterId}' AND scheme_code = 'loinc'`,
    ];
    for (const staleWrite of staleWrites) {
      await expectTransactionFailure(
        `${staleWrite}; SET CONSTRAINTS ALL IMMEDIATE;`,
        /laboratory contract/i,
      );
    }
  });

  it("limits participating content writes to the owner but preserves admin review", async () => {
    await db.exec("BEGIN;");
    let forgedParameterHash: string;
    try {
      await db.query(`
        UPDATE public.kb_entity_revisions
           SET display_name = 'Externally forged parameter revision'
         WHERE id = $1::uuid
      `, [parameterRevisionId]);
      forgedParameterHash = (await db.query<{ hash: string }>(`
        SELECT public.kb_lab_parameter_revision_hash_v1($1::uuid, $2::uuid) AS hash
      `, [parameterId, parameterRevisionId])).rows[0].hash;
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    const expectOwnerDenied = async (role: string, sql: string): Promise<void> => {
      await enterRole(role, role === "authenticated" ? adminId : undefined);
      try {
        await expect(db.exec(sql)).rejects.toThrow(/database table owner/i);
      } finally {
        await leaveRole();
      }
    };

    await expectOwnerDenied("authenticated", `
      UPDATE public.kb_entity_revisions
         SET display_name = 'Externally forged parameter revision',
             content_hash = '${forgedParameterHash!}'
       WHERE id = '${parameterRevisionId}'
    `);
    await expectOwnerDenied("authenticated", `
      UPDATE public.kb_assertions SET claim_text = 'Admin-mutated laboratory assertion.'
       WHERE id = '${parameterBasisAssertionId}'
    `);
    await expectOwnerDenied("authenticated", `
      UPDATE public.kb_assertion_sources SET locator = 'table:admin-mutated'
       WHERE assertion_id = '${parameterBasisAssertionId}'
    `);
    await expectOwnerDenied("authenticated", `
      UPDATE public.kb_source_revisions SET title = 'Admin-mutated laboratory source'
       WHERE id = '${sourceRevisionId}'
    `);
    await expectOwnerDenied("authenticated", `
      UPDATE public.kb_entity_revisions SET display_name = 'Admin-mutated method'
       WHERE id = '${methodRevisionId}'
    `);
    await db.exec("BEGIN;");
    try {
      await db.exec(`
        INSERT INTO public.kb_sources (id, canonical_key)
        VALUES ('26000000-0000-4000-8000-000000000001', 'source:unrelated-owner-boundary');
        INSERT INTO public.kb_source_revisions (
          id, source_id, revision_no, source_type, title, content_hash
        ) VALUES (
          '27000000-0000-4000-8000-000000000001',
          '26000000-0000-4000-8000-000000000001', 1, 'other',
          'Unrelated source', repeat('b', 64)
        );
        INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
        VALUES (
          '36000000-0000-4000-8000-000000000001', 'symptom',
          'symptom:unrelated-owner-boundary'
        );
        INSERT INTO public.kb_entity_revisions (
          id, entity_id, revision_no, display_name, content_hash
        ) VALUES (
          '37000000-0000-4000-8000-000000000001',
          '36000000-0000-4000-8000-000000000001', 1,
          'Unrelated symptom', repeat('c', 64)
        );
        INSERT INTO public.kb_assertions (
          id, canonical_key, version_no, assertion_kind, claim_text, content_hash
        ) VALUES (
          '47000000-0000-4000-8000-000000000001',
          'assertion:unrelated-owner-boundary', 1, 'classification',
          'Unrelated classification.', repeat('d', 64)
        );
        INSERT INTO public.kb_assertion_sources (
          assertion_id, source_revision_id, source_role, locator, is_primary
        ) VALUES (
          '47000000-0000-4000-8000-000000000001',
          '27000000-0000-4000-8000-000000000001', 'supports', 'page:1', true
        );
      `);
      await enterRole("authenticated", adminId);
      await db.exec(`
        UPDATE public.kb_entity_revisions
           SET display_name = 'Admin-edited unrelated symptom', content_hash = repeat('e', 64)
         WHERE id = '37000000-0000-4000-8000-000000000001';
        UPDATE public.kb_source_revisions
           SET title = 'Admin-edited unrelated source', content_hash = repeat('f', 64)
         WHERE id = '27000000-0000-4000-8000-000000000001';
        UPDATE public.kb_assertions
           SET claim_text = 'Admin-edited unrelated classification.', content_hash = repeat('1', 64)
         WHERE id = '47000000-0000-4000-8000-000000000001';
        UPDATE public.kb_assertion_sources SET locator = 'page:2'
         WHERE assertion_id = '47000000-0000-4000-8000-000000000001';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
      await leaveRole();
    }

    await db.exec("BEGIN;");
    try {
      await enterRole("authenticated", adminId);
      await db.query(`
        UPDATE public.kb_source_revisions SET review_status = 'domain_review'
         WHERE id = $1::uuid
      `, [sourceRevisionId]);
      await db.query(`
        UPDATE public.kb_assertions SET review_status = 'domain_review'
         WHERE id = ANY($1::uuid[])
      `, [[parameterBasisAssertionId, rangeAssertionId, findingBasisAssertionId]]);
      await db.query(`
        UPDATE public.kb_entity_revisions SET review_status = 'domain_review'
         WHERE id = ANY($1::uuid[])
      `, [[
        parameterRevisionId,
        methodRevisionId,
        laboratoryRevisionId,
        populationRevisionId,
        findingRevisionId,
      ]]);
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
      await leaveRole();
    }
  }, 30_000);

  it("requires lifecycle-compatible dependencies and freezes content permanently at approval", async () => {
    await db.query("UPDATE public.kb_assertions SET review_status = 'domain_review' WHERE id = $1", [rangeAssertionId]);
    await db.query("UPDATE public.kb_assertions SET review_status = 'safety_review' WHERE id = $1", [rangeAssertionId]);
    await expect(db.query(`
      UPDATE public.kb_assertions
         SET review_status = 'approved', reviewed_at = now(), reviewed_by = $2::uuid
       WHERE id = $1::uuid
    `, [rangeAssertionId, adminId])).rejects.toThrow(/laboratory contract/i);
    await db.query("UPDATE public.kb_assertions SET review_status = 'draft' WHERE id = $1", [rangeAssertionId]);

    await approveRevision("kb_source_revisions", sourceRevisionId, false);
    await approveRevision("kb_assertions", parameterBasisAssertionId, true);
    await approveRevision("kb_entity_revisions", parameterRevisionId, true);
    await approveRevision("kb_entity_revisions", methodRevisionId, true);
    await approveRevision("kb_entity_revisions", laboratoryRevisionId, true);
    await approveRevision("kb_entity_revisions", populationRevisionId, true);
    await approveRevision("kb_assertions", rangeAssertionId, true);
    await approveRevision("kb_assertions", findingBasisAssertionId, true);
    await approveRevision("kb_entity_revisions", findingRevisionId, true);

    expect((await db.query<{ parameters: number; ranges: number; findings: number }>(`
      SELECT public.kb_invalid_lab_parameter_revision_count()::int AS parameters,
             public.kb_invalid_lab_reference_range_count()::int AS ranges,
             public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
    `)).rows[0]).toEqual({ parameters: 0, ranges: 0, findings: 0 });

    await expect(db.exec(`
      UPDATE public.kb_lab_parameter_revision_details SET specimen_kind = 'plasma'
       WHERE entity_revision_id = '${parameterRevisionId}'
    `)).rejects.toThrow(/laboratory content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_reference_ranges SET upper_bound = 260
       WHERE id = '${referenceRangeId}'
    `)).rejects.toThrow(/laboratory content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_lab_finding_definition_revision_details
         SET interpretation_kind = 'within_range'
       WHERE entity_revision_id = '${findingRevisionId}'
    `)).rejects.toThrow(/laboratory content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_assertions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${rangeAssertionId}'
    `)).rejects.toThrow(/cannot return to draft/i);
    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${parameterRevisionId}'
    `)).rejects.toThrow(/cannot return to draft/i);
    await expect(db.exec(`
      UPDATE public.kb_assertion_sources SET locator = 'table:changed-after-approval'
       WHERE assertion_id = '${rangeAssertionId}'
    `)).rejects.toThrow(/dependencies.*immutable|approved.*immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_entity_identifiers SET normalized_value = '88888-8'
       WHERE entity_id = '${parameterId}' AND scheme_code = 'loinc'
    `)).rejects.toThrow(/identifiers.*immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${sourceRevisionId}'
    `)).rejects.toThrow(/laboratory contract|therapeutic catalog|clinical rule/i);

    await releaseRevision("kb_source_revisions", sourceRevisionId);
    await releaseRevision("kb_assertions", parameterBasisAssertionId);
    await releaseRevision("kb_entity_revisions", methodRevisionId);
    await releaseRevision("kb_entity_revisions", laboratoryRevisionId);
    await releaseRevision("kb_entity_revisions", populationRevisionId);
    await releaseRevision("kb_entity_revisions", parameterRevisionId);
    await releaseRevision("kb_assertions", rangeAssertionId);
    await releaseRevision("kb_assertions", findingBasisAssertionId);
    await releaseRevision("kb_entity_revisions", findingRevisionId);
    await db.query(`
      UPDATE public.kb_entity_revisions SET review_status = 'superseded'
       WHERE id = $1::uuid
    `, [findingRevisionId]);

    expect((await db.query<{ parameters: number; ranges: number; findings: number }>(`
      SELECT public.kb_invalid_lab_parameter_revision_count()::int AS parameters,
             public.kb_invalid_lab_reference_range_count()::int AS ranges,
             public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
    `)).rows[0]).toEqual({ parameters: 0, ranges: 0, findings: 0 });

    await db.exec("BEGIN;");
    try {
      await db.exec(`
        ${sourcedClassificationSql(
          "45000000-0000-4000-8000-000000000001",
          "assertion:released-dependency-range",
          "table:released-dependency-range",
        )}
        INSERT INTO public.kb_lab_reference_ranges (
          id, assertion_id, lab_parameter_entity_id, lab_parameter_revision_id,
          diagnostic_method_entity_id, diagnostic_method_revision_id,
          sex_scope, range_kind, unit_system, unit_code,
          lower_bound, lower_inclusive, upper_bound, upper_inclusive,
          range_content_hash
        ) VALUES (
          '55000000-0000-4000-8000-000000000001',
          '45000000-0000-4000-8000-000000000001',
          '${parameterId}', '${parameterRevisionId}', '${methodId}', '${methodRevisionId}',
          'any', 'numeric_interval', 'ucum', 'ug/L',
          30, true, 220, true, repeat('0', 64)
        );
        UPDATE public.kb_lab_reference_ranges
           SET range_content_hash = public.kb_lab_reference_range_hash_v1(id)
         WHERE id = '55000000-0000-4000-8000-000000000001';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      expect((await db.query<{ valid: boolean }>(`
        SELECT public.kb_lab_reference_range_is_valid(
          '55000000-0000-4000-8000-000000000001'
        ) AS valid
      `)).rows[0].valid).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN;");
    try {
      await db.query(`
        UPDATE public.kb_entity_revisions SET review_status = 'superseded'
         WHERE id = $1::uuid
      `, [methodRevisionId]);
      await db.query(`
        UPDATE public.kb_assertions SET review_status = 'superseded'
         WHERE id = $1::uuid
      `, [rangeAssertionId]);
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      expect((await db.query<{ valid: boolean }>(`
        SELECT public.kb_lab_reference_range_is_valid('${referenceRangeId}') AS valid
      `)).rows[0].valid).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  }, 30_000);

  it("enforces owner-only writes, admin RLS reads, service reads, helper revokes, and truncate denial", async () => {
    await enterRole("authenticated", adminId);
    try {
      expect((await db.query("SELECT * FROM public.kb_lab_parameter_revision_details")).rows)
        .toHaveLength(1);
      await expect(db.exec(`
        UPDATE public.kb_lab_reference_ranges SET upper_bound = upper_bound
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", patientId);
    try {
      expect((await db.query("SELECT * FROM public.kb_lab_reference_ranges")).rows).toEqual([]);
      expect((await db.query("SELECT * FROM public.kb_lab_finding_definition_revision_details")).rows)
        .toEqual([]);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      expect((await db.query("SELECT * FROM public.kb_lab_reference_ranges")).rows).toHaveLength(1);
      await expect(db.exec("DELETE FROM public.kb_lab_reference_ranges"))
        .rejects.toThrow(/permission denied/i);
      expect((await db.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')
      `)).rows[0].count).toBe(59);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        await expect(db.query("SELECT * FROM public.kb_lab_parameter_revision_details"))
          .rejects.toThrow(/permission denied/i);
      } finally {
        await leaveRole();
      }
    }

    const helperFunctions = [
      "public.kb_lab_unit_is_valid_v1(text,text)",
      "public.kb_lab_qualitative_code_array_is_valid_v1(text[])",
      "public.kb_laboratory_entity_revision_payload_v1(uuid,uuid)",
      "public.kb_laboratory_source_revision_payload_v1(uuid)",
      "public.kb_laboratory_assertion_payload_v1(uuid)",
      "public.kb_lab_parameter_revision_payload_v1(uuid,uuid)",
      "public.kb_lab_parameter_revision_hash_v1(uuid,uuid)",
      "public.kb_lab_reference_range_payload_v1(uuid)",
      "public.kb_lab_reference_range_hash_v1(uuid)",
      "public.kb_lab_finding_definition_revision_payload_v1(uuid,uuid)",
      "public.kb_lab_finding_definition_revision_hash_v1(uuid,uuid)",
      "public.kb_lab_parameter_revision_is_valid(uuid,uuid)",
      "public.kb_lab_reference_range_is_valid(uuid)",
      "public.kb_lab_finding_definition_revision_is_valid(uuid,uuid)",
      "public.kb_invalid_lab_parameter_revision_count()",
      "public.kb_invalid_lab_reference_range_count()",
      "public.kb_invalid_lab_finding_definition_revision_count()",
      "public.kb_protect_laboratory_identifier_dependency()",
      "public.kb_protect_laboratory_contract_write()",
      "public.kb_lock_laboratory_assertion_source()",
      "public.kb_lock_laboratory_revision_dependents()",
      "public.kb_protect_laboratory_assertion_status()",
      "public.kb_protect_laboratory_entity_revision_status()",
      "public.kb_validate_laboratory_contract()",
      "public.kb_prevent_laboratory_contract_truncate()",
      "public.kb_export_wiki_snapshot_4b2a()",
    ];
    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
        CROSS JOIN unnest($1::text[]) function_name
    `, [helperFunctions]);
    expect(privileges.rows).toHaveLength(helperFunctions.length * 5);
    expect(privileges.rows.every((row) => row.can_execute === false)).toBe(true);

    const snapshotPrivileges = await db.query<{ role_name: string; can_execute: boolean }>(`
      SELECT role_name,
             has_function_privilege(role_name, 'public.kb_export_wiki_snapshot()', 'EXECUTE') AS can_execute
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

    for (const table of laboratoryTables) {
      await expect(db.exec(`TRUNCATE TABLE public.${table}`))
        .rejects.toThrow(/cannot be truncated|referenced in a foreign key/i);
      expect(laboratoryMigration).toContain(`CREATE TRIGGER ${table}_prevent_truncate`);
    }
    await expect(db.exec("TRUNCATE TABLE public.kb_entity_identifiers"))
      .rejects.toThrow(/cannot be truncated/i);
    await expect(db.exec("TRUNCATE TABLE public.kb_assertion_sources"))
      .rejects.toThrow(/cannot be truncated/i);
    expect(laboratoryMigration).toContain(
      "CREATE TRIGGER kb_entity_identifiers_prevent_laboratory_contract_truncate",
    );
    expect(laboratoryMigration).toContain(
      "CREATE TRIGGER kb_assertion_sources_prevent_laboratory_contract_truncate",
    );
  });

  it("detects trigger-bypassed parameter, range, and finding tampering", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_lab_parameter_revision_details DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_lab_parameter_revision_details SET specimen_kind = 'plasma'
         WHERE entity_revision_id = $1::uuid
      `, [parameterRevisionId]);
      const counts = await db.query<{ parameters: number; ranges: number; findings: number }>(`
        SELECT public.kb_invalid_lab_parameter_revision_count()::int AS parameters,
               public.kb_invalid_lab_reference_range_count()::int AS ranges,
               public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
      `);
      expect(counts.rows[0].parameters).toBeGreaterThan(0);
      expect(counts.rows[0].ranges).toBeGreaterThan(0);
      expect(counts.rows[0].findings).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_lab_reference_ranges DISABLE TRIGGER USER;");
    try {
      await db.query("UPDATE public.kb_lab_reference_ranges SET upper_bound = 251 WHERE id = $1::uuid", [referenceRangeId]);
      const counts = await db.query<{ ranges: number; findings: number }>(`
        SELECT public.kb_invalid_lab_reference_range_count()::int AS ranges,
               public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
      `);
      expect(counts.rows[0].ranges).toBeGreaterThan(0);
      expect(counts.rows[0].findings).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_lab_finding_definition_revision_details DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_lab_finding_definition_revision_details
           SET interpretation_kind = 'within_range'
         WHERE entity_revision_id = $1::uuid
      `, [findingRevisionId]);
      expect((await db.query<{ count: number }>(`
        SELECT public.kb_invalid_lab_finding_definition_revision_count()::int AS count
      `)).rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_identifiers DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_entity_identifiers
           SET value = '88888-8', normalized_value = '88888-8'
         WHERE entity_id = $1::uuid AND scheme_code = 'loinc'
      `, [parameterId]);
      const counts = await db.query<{ parameters: number; ranges: number; findings: number }>(`
        SELECT public.kb_invalid_lab_parameter_revision_count()::int AS parameters,
               public.kb_invalid_lab_reference_range_count()::int AS ranges,
               public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
      `);
      expect(counts.rows[0].parameters).toBeGreaterThan(0);
      expect(counts.rows[0].ranges).toBeGreaterThan(0);
      expect(counts.rows[0].findings).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_source_revisions DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_source_revisions SET title = 'Trigger-bypassed source title'
         WHERE id = $1::uuid
      `, [sourceRevisionId]);
      const counts = await db.query<{ parameters: number; ranges: number; findings: number }>(`
        SELECT public.kb_invalid_lab_parameter_revision_count()::int AS parameters,
               public.kb_invalid_lab_reference_range_count()::int AS ranges,
               public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
      `);
      expect(counts.rows[0].parameters).toBeGreaterThan(0);
      expect(counts.rows[0].ranges).toBeGreaterThan(0);
      expect(counts.rows[0].findings).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_revisions DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_entity_revisions SET display_name = 'Trigger-bypassed method name'
         WHERE id = $1::uuid
      `, [methodRevisionId]);
      const counts = await db.query<{ ranges: number; findings: number }>(`
        SELECT public.kb_invalid_lab_reference_range_count()::int AS ranges,
               public.kb_invalid_lab_finding_definition_revision_count()::int AS findings
      `);
      expect(counts.rows[0].ranges).toBeGreaterThan(0);
      expect(counts.rows[0].findings).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("exports and text-faithfully owner-restores exactly 59 tables without changing snapshot v2", async () => {
    const therapyBefore = (await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `)).rows[0].value;
    const snapshotBefore = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        serialized_tables: Record<string, string>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>("SELECT public.kb_export_wiki_snapshot() AS value");
    const before = snapshotBefore.rows[0].value;
    expect(Object.keys(before.tables)).toHaveLength(59);
    expect(Object.keys(before.serialized_tables)).toHaveLength(59);
    expect(Object.keys(before.manifest)).toHaveLength(59);
    expect(before.validation.invalid_lab_parameter_revisions).toBe(0);
    expect(before.validation.invalid_lab_reference_ranges).toBe(0);
    expect(before.validation.invalid_lab_finding_definition_revisions).toBe(0);
    await expect(validateWikiSnapshotShape({
      tables: before.tables,
      serializedTables: before.serialized_tables,
      manifest: before.manifest,
      validation: before.validation,
    }, wikiSnapshotTables, zeroValidationKeys)).resolves.toBeUndefined();

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
          [before.serialized_tables[table]],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }
      const after = (await db.query<typeof snapshotBefore.rows[0]>(
        "SELECT public.kb_export_wiki_snapshot() AS value",
      )).rows[0].value;
      for (const table of wikiSnapshotTables) {
        expect(after.serialized_tables[table]).toBe(before.serialized_tables[table]);
      }
      expect(after.manifest).toEqual(before.manifest);
      expect(after.validation.invalid_lab_parameter_revisions).toBe(0);
      expect(after.validation.invalid_lab_reference_ranges).toBe(0);
      expect(after.validation.invalid_lab_finding_definition_revisions).toBe(0);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }

    expect((await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `)).rows[0].value).toBe(therapyBefore);
  }, 30_000);

  it("has no productive laboratory reader, writer, retrieval, conversion, or therapy integration", () => {
    const contractMigration = "supabase/migrations/20260802100000_create_kb_laboratory_contract.sql";
    const contractSources = new Set([
      contractMigration,
      "supabase/migrations/20260802110000_create_kb_homeopathic_repertory_contract.sql",
      "src/components/admin/BackupCenter.tsx",
      "src/lib/backupAreas.ts",
      "supabase/functions/backup-export/index.ts",
    ]);
    const violations: string[] = [];
    const contractPattern = /\bkb_(?:lab|laboratory)_[a-z0-9_]+\b/;
    const visit = (directory: string, relativeDirectory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          if (relativePath !== "src/test") visit(absolutePath, relativePath);
        } else if (/\.(?:[cm]?[jt]sx?|sql)$/.test(entry.name)) {
          const source = readFileSync(absolutePath, "utf8");
          if (!contractPattern.test(source)) continue;
          const hasDirectRuntimeAccess =
            /\.from\(\s*["'`](?:kb_lab_parameter_revision_details|kb_lab_reference_ranges|kb_lab_finding_definition_revision_details)["'`]\s*\)/.test(source)
            || /\b(?:SELECT[\s\S]{0,120}\bFROM|INSERT[\s\S]{0,120}\bINTO|UPDATE|DELETE[\s\S]{0,120}\bFROM)\s+(?:public\.)?kb_(?:lab_parameter_revision_details|lab_reference_ranges|lab_finding_definition_revision_details)\b/i.test(source);
          if (!contractSources.has(relativePath)
              || (relativePath !== contractMigration && hasDirectRuntimeAccess)) {
            violations.push(relativePath);
          }
        }
      }
    };
    visit(resolve(process.cwd(), "src"), "src");
    visit(resolve(process.cwd(), "supabase/functions"), "supabase/functions");
    visit(resolve(process.cwd(), "supabase/migrations"), "supabase/migrations");
    expect(violations).toEqual([]);

    const therapyRecommend = readFileSync(
      resolve(process.cwd(), "supabase/functions/therapy-recommend/index.ts"),
      "utf8",
    );
    expect(therapyRecommend).not.toMatch(contractPattern);
    expect(laboratoryMigration).not.toMatch(/\b(unit_conversion|conversion_factor|retrieval_eligible|release_v2)\b/i);
  });
});
