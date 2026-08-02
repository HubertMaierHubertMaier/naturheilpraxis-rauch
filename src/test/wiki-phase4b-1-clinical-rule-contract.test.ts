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
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const ruleMigration = migrations.at(-1)!;
const releaseMigration = migrations.at(-2)!;
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);

const clinicalRuleTables = [
  "kb_dosage_rules",
  "kb_safety_rules",
  "kb_safety_rule_conditions",
] as const;
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
  "kb_dosage_rules", "kb_safety_rules", "kb_safety_rule_conditions",
  "kb_releases", "kb_release_items", "faqs", "practice_pricing", "practice_info",
] as const;
const wiki4b1ZeroValidationKeys = [
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
] as const;
const wikiRestoreOrder = [
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_preparation_revision_details", "kb_homeopathic_revision_details",
  "kb_botanical_revision_details", "kb_nutrient_revision_details",
  "kb_product_variant_revision_details", "kb_composition_components",
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
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const preparationId = "30000000-0000-4000-8000-000000000001";
const preparationRevisionId = "31000000-0000-4000-8000-000000000001";
const diseaseId = "30000000-0000-4000-8000-000000000002";
const diseaseRevisionId = "31000000-0000-4000-8000-000000000002";
const populationId = "30000000-0000-4000-8000-000000000003";
const populationRevisionId = "31000000-0000-4000-8000-000000000003";
const basisAssertionId = "40000000-0000-4000-8000-000000000001";
const dosageAssertionId = "40000000-0000-4000-8000-000000000002";
const safetyAssertionId = "40000000-0000-4000-8000-000000000003";
const dosageRuleId = "50000000-0000-4000-8000-000000000001";
const safetyRuleId = "50000000-0000-4000-8000-000000000002";

type InitialState = {
  dosageRules: number;
  safetyRules: number;
  conditions: number;
  snapshotTables: number;
  serializedTables: number;
  manifestTables: number;
  invalidDosage: number;
  invalidSafety: number;
};

function requiredBlock(source: string, pattern: RegExp, description: string): string {
  const match = source.match(pattern);
  expect(match, `Missing ${description}`).not.toBeNull();
  return match![1];
}

function dosageRuleInsertSql(
  ruleId: string,
  assertionId: string,
  subjectEntityId = preparationId,
  subjectRevisionId = preparationRevisionId,
  route = "oral",
): string {
  return `
    INSERT INTO public.kb_dosage_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      indication_entity_id, indication_entity_revision_id,
      population_entity_id, population_entity_revision_id,
      administration_route, dose_min, dose_max, dose_unit_system, dose_unit_code,
      frequency_min, frequency_max, frequency_period,
      duration_min, duration_max, duration_unit, timing, rule_content_hash
    ) VALUES (
      '${ruleId}', '${assertionId}', '${subjectEntityId}', '${subjectRevisionId}',
      '${diseaseId}', '${diseaseRevisionId}', '${populationId}', '${populationRevisionId}',
      '${route}', 10, 20, 'local_v1', 'drop', 2, 3, 'day',
      7, 14, 'day', 'before_meal', repeat('0', 64)
    );
    UPDATE public.kb_dosage_rules
       SET rule_content_hash = public.kb_dosage_rule_hash_v1(id)
     WHERE id = '${ruleId}';
  `;
}

let db: PGlite;
let initialState: InitialState;

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

async function approveRevision(table: string, id: string, safetyReview: boolean): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (safetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved',
           reviewed_at = '2026-08-01T11:00:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
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

  const initial = await db.query<InitialState>(`
    SELECT
      (SELECT count(*)::int FROM public.kb_dosage_rules) AS "dosageRules",
      (SELECT count(*)::int FROM public.kb_safety_rules) AS "safetyRules",
      (SELECT count(*)::int FROM public.kb_safety_rule_conditions) AS conditions,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'tables'
      )) AS "snapshotTables",
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'serialized_tables'
      )) AS "serializedTables",
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'manifest'
      )) AS "manifestTables",
      (public.kb_export_wiki_snapshot() #>> '{validation,invalid_dosage_rules}')::int
        AS "invalidDosage",
      (public.kb_export_wiki_snapshot() #>> '{validation,invalid_safety_rules}')::int
        AS "invalidSafety"
  `);
  initialState = initial.rows[0];

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:clinical-rule-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'practice_rule',
      'Synthetic clinical rule source', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${preparationId}', 'preparation', 'preparation:clinical-rule-contract'),
      ('${diseaseId}', 'disease', 'disease:clinical-rule-contract'),
      ('${populationId}', 'population_group', 'population:clinical-rule-contract');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, content_hash
    ) VALUES
      ('${preparationRevisionId}', '${preparationId}', 1,
       'Synthetic preparation', repeat('0', 64)),
      ('${diseaseRevisionId}', '${diseaseId}', 1,
       'Synthetic indication', repeat('2', 64)),
      ('${populationRevisionId}', '${populationId}', 1,
       'Synthetic population', repeat('3', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id;

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text, content_hash
    ) VALUES
      ('${basisAssertionId}', 'assertion:clinical-rule-basis', 1, 'classification',
       'Synthetic preparation basis.', repeat('4', 64)),
      ('${dosageAssertionId}', 'assertion:clinical-dosage', 1, 'dosage',
       'Synthetic dosage contract.', repeat('5', 64)),
      ('${safetyAssertionId}', 'assertion:clinical-safety', 1, 'safety',
       'Synthetic safety contract.', repeat('6', 64));
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, original_quote, is_primary
    ) VALUES
      ('${basisAssertionId}', '${sourceRevisionId}', 'supports', 'S. 1', 'Basis', true),
      ('${dosageAssertionId}', '${sourceRevisionId}', 'supports', 'S. 2', 'Dosage', true),
      ('${safetyAssertionId}', '${sourceRevisionId}', 'qualifies', 'S. 3', 'Safety', true);

    INSERT INTO public.kb_preparation_revision_details (
      entity_id, entity_revision_id, preparation_kind, dosage_form,
      administration_routes, basis_assertion_id
    ) VALUES (
      '${preparationId}', '${preparationRevisionId}', 'other', 'drops',
      ARRAY['oral'], '${basisAssertionId}'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
     WHERE id = '${preparationRevisionId}';

    ${dosageRuleInsertSql(dosageRuleId, dosageAssertionId)}

    INSERT INTO public.kb_safety_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      rule_type, severity, effect, notice_text, rule_content_hash
    ) VALUES (
      '${safetyRuleId}', '${safetyAssertionId}',
      '${preparationId}', '${preparationRevisionId}',
      'precaution', 'require_review', 'review_only',
      'Synthetic review notice.', repeat('0', 64)
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind,
      fact_type, fact_key, coded_system, coded_values
    ) VALUES (
      '${safetyRuleId}', 1, 'coded_value_in',
      'demographic', 'demographic.pregnancy_status', 'local_v1', ARRAY['pregnant']
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind,
      fact_type, fact_key, quantity_comparator, quantity_value,
      quantity_unit_system, quantity_unit_code
    ) VALUES (
      '${safetyRuleId}', 2, 'quantity_compare',
      'demographic', 'demographic.age_years', 'ge', 18, 'ucum', 'a'
    );
    UPDATE public.kb_safety_rules
       SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
     WHERE id = '${safetyRuleId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki 4B-1 clinical rule contract", () => {
  it("adds exactly three empty schema-only tables at the 52-to-55 boundary", async () => {
    const createdTables = Array.from(
      ruleMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual(clinicalRuleTables);
    expect(initialState).toEqual({
      dosageRules: 0,
      safetyRules: 0,
      conditions: 0,
      snapshotTables: 55,
      serializedTables: 55,
      manifestTables: 55,
      invalidDosage: 0,
      invalidSafety: 0,
    });
    expect(ruleMigration).toContain("exact 52-table Wiki boundary");
    expect(ruleMigration).toMatch(/^BEGIN;/);
    expect(ruleMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(ruleMigration).not.toMatch(/INSERT INTO public\.kb_/);
    expect(ruleMigration).not.toContain("therapy_input_");
    expect(ruleMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(ruleMigration).not.toMatch(/ALTER TABLE public\.kb_releases/);
    expect(ruleMigration).not.toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.kb_(?:create|write|promote)_/);
    expect(ruleMigration).toContain("FOR SHARE");
    expect(ruleMigration).toContain("FOR UPDATE");
    expect(Array.from(ruleMigration.matchAll(
      /UPDATE public\.kb_assertions assertion\s+SET content_hash = assertion\.content_hash/g,
    ))).toHaveLength(4);
    expect(ruleMigration).toContain("assertion.assertion_kind IN ('dosage', 'safety')");
    expect(Array.from(ruleMigration.matchAll(
      /UPDATE public\.kb_entities entity\s+SET current_revision_id = entity\.current_revision_id/g,
    ))).toHaveLength(3);
    expect(Array.from(ruleMigration.matchAll(
      /UPDATE public\.kb_sources source\s+SET current_revision_id = source\.current_revision_id/g,
    ))).toHaveLength(3);
    expect(ruleMigration).not.toContain("app.kb_clinical_rule_contract_validation");
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

    const coordination = await db.query<{ reverse_indexes: number }>(`
      SELECT count(*)::int AS reverse_indexes
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'kb_dosage_rules_subject_revision_idx',
           'kb_dosage_rules_indication_revision_idx',
           'kb_dosage_rules_population_revision_idx',
           'kb_safety_rules_subject_revision_idx',
           'kb_safety_rules_related_revision_idx',
           'kb_safety_rule_conditions_revision_idx'
         )
    `);
    expect(coordination.rows[0]).toEqual({ reverse_indexes: 6 });
  });

  it("keeps tables typed and free of predicate, metadata, actor, and patient JSON", async () => {
    const columns = await db.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(`
      SELECT table_name, column_name, data_type
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position
    `, [clinicalRuleTables]);
    expect(columns.rows.some((column) => column.data_type === "jsonb")).toBe(false);
    expect(columns.rows.some((column) =>
      /(?:patient|user|session|pseudonym|anamnesis|predicate|metadata)/.test(column.column_name)
    )).toBe(false);
    expect(ruleMigration).toContain("assertion_kind <> 'dosage'");
    expect(ruleMigration).toContain("assertion_kind <> 'safety'");
    expect(ruleMigration).toContain("subject_type NOT IN ('preparation', 'product_variant')");
    expect(ruleMigration).toContain("indication_type NOT IN ('symptom', 'disease', 'lab_finding_definition')");
    expect(ruleMigration).toContain("population_type <> 'population_group'");
  });

  it("keeps the historical 55-table 4B-1 boundary isolated", () => {
    expect(wikiSnapshotTables).toHaveLength(55);
    expect(new Set(wikiSnapshotTables).size).toBe(55);
    expect(clinicalRuleTables).toEqual([
      "kb_dosage_rules",
      "kb_safety_rules",
      "kb_safety_rule_conditions",
    ]);
    expect(ruleMigration).toContain("exact 52-table Wiki boundary");
    expect(ruleMigration).toContain("RENAME TO kb_export_wiki_snapshot_4a");
    expect(ruleMigration).toContain("'invalid_dosage_rules'");
    expect(ruleMigration).toContain("'invalid_safety_rules'");
  });

  it("has no productive clinical-rule reader or writer", () => {
    const allowedSources = new Set([
      "src/components/admin/BackupCenter.tsx",
      "src/lib/backupAreas.ts",
      "supabase/functions/backup-export/index.ts",
    ]);
    const violations: string[] = [];
    const visit = (directory: string, relativeDirectory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          if (relativePath !== "src/test") visit(absolutePath, relativePath);
        } else if (/\.tsx?$/.test(entry.name) && !allowedSources.has(relativePath)) {
          const source = readFileSync(absolutePath, "utf8");
          if (/\bkb_(?:dosage_rules|safety_rules|safety_rule_conditions)\b/.test(source)) {
            violations.push(relativePath);
          }
        }
      }
    };
    visit(resolve(process.cwd(), "src"), "src");
    visit(resolve(process.cwd(), "supabase/functions"), "supabase/functions");
    expect(violations).toEqual([]);
  });

  it("accepts exact revisions, primary locators, structured dosage, and canonical hashes", async () => {
    const valid = await db.query<{
      dosage_valid: boolean;
      safety_valid: boolean;
      invalid_dosage: number;
      invalid_safety: number;
      dosage_hash: string;
      computed_dosage_hash: string;
      safety_hash: string;
      computed_safety_hash: string;
      condition_count: number;
    }>(`
      SELECT
        public.kb_dosage_rule_is_valid('${dosageRuleId}') AS dosage_valid,
        public.kb_safety_rule_is_valid('${safetyRuleId}') AS safety_valid,
        public.kb_invalid_dosage_rule_count()::int AS invalid_dosage,
        public.kb_invalid_safety_rule_count()::int AS invalid_safety,
        dosage.rule_content_hash AS dosage_hash,
        public.kb_dosage_rule_hash_v1(dosage.id) AS computed_dosage_hash,
        safety.rule_content_hash AS safety_hash,
        public.kb_safety_rule_hash_v1(safety.id) AS computed_safety_hash,
        jsonb_array_length(public.kb_safety_rule_payload_v1(safety.id) -> 'conditions')
          AS condition_count
      FROM public.kb_dosage_rules dosage
      CROSS JOIN public.kb_safety_rules safety
      WHERE dosage.id = '${dosageRuleId}' AND safety.id = '${safetyRuleId}'
    `);
    expect(valid.rows[0]).toEqual({
      dosage_valid: true,
      safety_valid: true,
      invalid_dosage: 0,
      invalid_safety: 0,
      dosage_hash: valid.rows[0].computed_dosage_hash,
      computed_dosage_hash: valid.rows[0].computed_dosage_hash,
      safety_hash: valid.rows[0].computed_safety_hash,
      computed_safety_hash: valid.rows[0].computed_safety_hash,
      condition_count: 2,
    });
    const payload = await db.query<{ value: string }>(`
      SELECT public.kb_dosage_rule_payload_v1('${dosageRuleId}')::text AS value
    `);
    expect(payload.rows[0].value).toContain("preparation:clinical-rule-contract");
    expect(payload.rows[0].value).toContain("source:clinical-rule-contract");
    expect(payload.rows[0].value).toContain("before_meal");
  });

  it("rejects wrong assertion kinds, revision pairs, subject types, and routes", async () => {
    await expect(db.exec(dosageRuleInsertSql(
      "50000000-0000-4000-8000-000000000010",
      basisAssertionId,
    ))).rejects.toThrow(/require a dosage assertion/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000010', 'assertion:wrong-revision-pair',
        1, 'dosage', 'Wrong exact pair.', repeat('a', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000010', '${sourceRevisionId}',
        'supports', 'S. 10', true
      );
      ${dosageRuleInsertSql(
        "50000000-0000-4000-8000-000000000011",
        "40000000-0000-4000-8000-000000000010",
        preparationId,
        diseaseRevisionId,
      )}
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /foreign key|clinical rule contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000011', 'assertion:wrong-subject-type',
        1, 'dosage', 'Wrong subject type.', repeat('b', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000011', '${sourceRevisionId}',
        'supports', 'S. 11', true
      );
      ${dosageRuleInsertSql(
        "50000000-0000-4000-8000-000000000012",
        "40000000-0000-4000-8000-000000000011",
        diseaseId,
        diseaseRevisionId,
      )}
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000012', 'assertion:wrong-route',
        1, 'dosage', 'Wrong route.', repeat('c', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000012', '${sourceRevisionId}',
        'supports', 'S. 12', true
      );
      ${dosageRuleInsertSql(
        "50000000-0000-4000-8000-000000000013",
        "40000000-0000-4000-8000-000000000012",
        preparationId,
        preparationRevisionId,
        "topical",
      )}
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);
  });

  it("requires a nonempty primary source and a complete rule at transaction end", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000020', 'assertion:missing-rule',
        1, 'dosage', 'Missing concrete rule.', repeat('d', 64)
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000021', 'assertion:blank-locator',
        1, 'dosage', 'Blank source locator.', repeat('e', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000021', '${sourceRevisionId}',
        'supports', '   ', true
      );
      ${dosageRuleInsertSql(
        "50000000-0000-4000-8000-000000000021",
        "40000000-0000-4000-8000-000000000021",
      )}
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);

    await expect(db.exec(`
      UPDATE public.kb_dosage_rules SET dose_min = 0 WHERE id = '${dosageRuleId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_dosage_rules SET dose_min = 'NaN'::numeric
       WHERE id = '${dosageRuleId}'
    `)).rejects.toThrow(/check constraint/i);

    await expectTransactionFailure(`
      SET CONSTRAINTS ALL IMMEDIATE;
      UPDATE public.kb_dosage_rules
         SET dose_max = 99
       WHERE id = '${dosageRuleId}';
    `, /clinical rule contract/i);
  });

  it("enforces deterministic safety effects and strict condition shapes", async () => {
    await db.exec("BEGIN;");
    try {
      await db.exec(`
        INSERT INTO public.kb_assertions (
          id, canonical_key, version_no, assertion_kind, claim_text, content_hash
        ) VALUES (
          '40000000-0000-4000-8000-000000000029', 'assertion:valid-always',
          1, 'safety', 'Valid unconditional safety rule.', repeat('9', 64)
        );
        INSERT INTO public.kb_assertion_sources (
          assertion_id, source_revision_id, source_role, locator, is_primary
        ) VALUES (
          '40000000-0000-4000-8000-000000000029', '${sourceRevisionId}',
          'supports', 'S. 29', true
        );
        INSERT INTO public.kb_safety_rules (
          id, assertion_id, subject_entity_id, subject_entity_revision_id,
          rule_type, severity, effect, notice_text, rule_content_hash
        ) VALUES (
          '50000000-0000-4000-8000-000000000029',
          '40000000-0000-4000-8000-000000000029',
          '${preparationId}', '${preparationRevisionId}',
          'monitoring', 'information', 'allow_with_notice',
          'Valid unconditional notice.', repeat('0', 64)
        );
        INSERT INTO public.kb_safety_rule_conditions (
          safety_rule_id, condition_order, condition_kind
        ) VALUES ('50000000-0000-4000-8000-000000000029', 1, 'always');
        UPDATE public.kb_safety_rules
           SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
         WHERE id = '50000000-0000-4000-8000-000000000029';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      const validAlways = await db.query<{ valid: boolean }>(`
        SELECT public.kb_safety_rule_is_valid(
          '50000000-0000-4000-8000-000000000029'
        ) AS valid
      `);
      expect(validAlways.rows[0].valid).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await expect(db.exec(`
      UPDATE public.kb_safety_rules
         SET effect = 'allow_with_notice'
       WHERE id = '${safetyRuleId}'
    `)).rejects.toThrow(/check constraint/i);

    await expect(db.exec(`
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind, fact_type, fact_key
      ) VALUES (
        '${safetyRuleId}', 3, 'always', 'symptom', 'symptom.synthetic'
      )
    `)).rejects.toThrow(/check constraint/i);

    await expect(db.exec(`
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind,
        fact_type, fact_key, quantity_comparator, quantity_value,
        quantity_unit_system, quantity_unit_code
      ) VALUES (
        '${safetyRuleId}', 3, 'quantity_compare',
        'demographic', 'demographic.age_years', 'ge', 'NaN'::numeric, 'ucum', 'a'
      )
    `)).rejects.toThrow(/check constraint/i);

    await expect(db.exec(`
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind,
        fact_type, fact_key, coded_system, coded_values
      ) VALUES (
        '${safetyRuleId}', 3, 'coded_value_in',
        'condition', 'condition.synthetic', 'local_v1', ARRAY['z', 'a']
      )
    `)).rejects.toThrow(/check constraint/i);

    await expect(db.exec(`
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind,
        fact_type, fact_key, quantity_comparator, quantity_value
      ) VALUES (
        '${safetyRuleId}', 3, 'quantity_compare',
        'demographic', 'demographic.age_years', 'ge', 18
      )
    `)).rejects.toThrow(/check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000030', 'assertion:always-exclusive',
        1, 'safety', 'Always must be exclusive.', repeat('f', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000030', '${sourceRevisionId}',
        'supports', 'S. 30', true
      );
      INSERT INTO public.kb_safety_rules (
        id, assertion_id, subject_entity_id, subject_entity_revision_id,
        rule_type, severity, effect, notice_text, rule_content_hash
      ) VALUES (
        '50000000-0000-4000-8000-000000000030',
        '40000000-0000-4000-8000-000000000030',
        '${preparationId}', '${preparationRevisionId}',
        'precaution', 'information', 'allow_with_notice',
        'Always test.', repeat('0', 64)
      );
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind
      ) VALUES ('50000000-0000-4000-8000-000000000030', 1, 'always');
      INSERT INTO public.kb_safety_rule_conditions (
        safety_rule_id, condition_order, condition_kind, fact_type, fact_key
      ) VALUES (
        '50000000-0000-4000-8000-000000000030', 2,
        'fact_present', 'allergy', 'allergy.synthetic'
      );
      UPDATE public.kb_safety_rules
         SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
       WHERE id = '50000000-0000-4000-8000-000000000030';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000031', 'assertion:no-condition',
        1, 'safety', 'Missing condition.', repeat('0', 64)
      );
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, locator, is_primary
      ) VALUES (
        '40000000-0000-4000-8000-000000000031', '${sourceRevisionId}',
        'supports', 'S. 31', true
      );
      INSERT INTO public.kb_safety_rules (
        id, assertion_id, subject_entity_id, subject_entity_revision_id,
        rule_type, severity, effect, notice_text, rule_content_hash
      ) VALUES (
        '50000000-0000-4000-8000-000000000031',
        '40000000-0000-4000-8000-000000000031',
        '${preparationId}', '${preparationRevisionId}',
        'monitoring', 'caution', 'review_only',
        'Condition required.', repeat('0', 64)
      );
      UPDATE public.kb_safety_rules
         SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
       WHERE id = '50000000-0000-4000-8000-000000000031';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /clinical rule contract/i);
  });

  it("detects hash and semantic manipulation after trigger bypass", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_dosage_rules DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_dosage_rules SET dose_max = 99 WHERE id = '${dosageRuleId}'
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_dosage_rule_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_safety_rules DISABLE TRIGGER USER;
      ALTER TABLE public.kb_safety_rule_conditions DISABLE TRIGGER USER;
    `);
    try {
      await db.exec(`
        UPDATE public.kb_safety_rule_conditions
           SET condition_order = 3
         WHERE safety_rule_id = '${safetyRuleId}' AND condition_order = 2;
        UPDATE public.kb_safety_rules
           SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
         WHERE id = '${safetyRuleId}';
      `);
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_safety_rule_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("requires approved dependencies and freezes rules permanently at approval", async () => {
    await approveRevision("kb_source_revisions", sourceRevisionId, false);
    await approveRevision("kb_assertions", basisAssertionId, true);
    await approveRevision("kb_entity_revisions", diseaseRevisionId, true);
    await approveRevision("kb_entity_revisions", populationRevisionId, true);
    await approveRevision("kb_entity_revisions", preparationRevisionId, true);
    await approveRevision("kb_assertions", dosageAssertionId, true);
    await approveRevision("kb_assertions", safetyAssertionId, true);

    const valid = await db.query<{ dosage: number; safety: number }>(`
      SELECT public.kb_invalid_dosage_rule_count()::int AS dosage,
             public.kb_invalid_safety_rule_count()::int AS safety
    `);
    expect(valid.rows[0]).toEqual({ dosage: 0, safety: 0 });

    await expect(db.exec(`
      UPDATE public.kb_dosage_rules SET timing = 'morning' WHERE id = '${dosageRuleId}'
    `)).rejects.toThrow(/clinical rules are immutable/i);
    await expect(db.exec(`
      DELETE FROM public.kb_safety_rule_conditions WHERE safety_rule_id = '${safetyRuleId}'
    `)).rejects.toThrow(/clinical rules are immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_assertion_sources SET locator = 'S. 99'
       WHERE assertion_id = '${dosageAssertionId}'
    `)).rejects.toThrow(/approved.*clinical rules are immutable|dependencies.*immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_assertions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${dosageAssertionId}'
    `)).rejects.toThrow(/cannot return to draft/i);
    await expect(db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${sourceRevisionId}'
    `)).rejects.toThrow(/clinical rule contract|therapeutic catalog/i);
  });

  it("enforces owner-only DML, the 4A read matrix, helper revokes, and truncate blocks", async () => {
    await enterRole("authenticated", adminId);
    try {
      const rows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_dosage_rules
      `);
      expect(rows.rows[0].count).toBe(1);
      await db.exec(`
        UPDATE public.kb_assertions
           SET review_status = review_status
         WHERE id = '${dosageAssertionId}'
      `);
      await expect(db.exec(`
        UPDATE public.kb_dosage_rules SET timing = 'morning'
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", patientId);
    try {
      const rows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_safety_rules
      `);
      expect(rows.rows[0].count).toBe(0);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      const rows = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_safety_rule_conditions
      `);
      expect(rows.rows[0].count).toBe(2);
      await expect(db.exec("DELETE FROM public.kb_safety_rules"))
        .rejects.toThrow(/permission denied/i);
      const snapshot = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')
      `);
      expect(snapshot.rows[0].count).toBe(55);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        await expect(db.query("SELECT * FROM public.kb_dosage_rules"))
          .rejects.toThrow(/permission denied/i);
      } finally {
        await leaveRole();
      }
    }

    const helperPrivileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
        CROSS JOIN unnest(ARRAY[
          'public.kb_dosage_rule_payload_v1(uuid)',
          'public.kb_dosage_rule_hash_v1(uuid)',
          'public.kb_safety_rule_payload_v1(uuid)',
          'public.kb_safety_rule_hash_v1(uuid)',
          'public.kb_dosage_rule_is_valid(uuid)',
          'public.kb_safety_rule_is_valid(uuid)',
          'public.kb_invalid_dosage_rule_count()',
          'public.kb_invalid_safety_rule_count()',
          'public.kb_protect_clinical_rule_write()',
          'public.kb_validate_clinical_rule_contract()',
          'public.kb_export_wiki_snapshot_4a()'
        ]::text[]) function_name
    `);
    expect(helperPrivileges.rows).toHaveLength(55);
    expect(helperPrivileges.rows.every((row) => row.can_execute === false)).toBe(true);

    for (const table of clinicalRuleTables) {
      await expect(db.exec(`TRUNCATE TABLE public.${table}`))
        .rejects.toThrow(/cannot be truncated|referenced in a foreign key/i);
      expect(ruleMigration).toContain(`CREATE TRIGGER ${table}_prevent_truncate`);
    }
  });

  it("exports and owner-restores exactly 55 tables with an unchanged four-table snapshot v2", async () => {
    const therapyBoundary = requiredBlock(
      backupExportSource,
      /const THERAPY_INPUT_SNAPSHOT_TABLES = \[([\s\S]*?)\] as const;/,
      "therapy snapshot boundary",
    );
    expect(Array.from(therapyBoundary.matchAll(/"([a-z0-9_]+)"/g), (match) => match[1]))
      .toEqual(therapyInputTables);

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
        '{"format":"therapy_input_envelope_v1","clinical_text":"Synthetic input","context":{}}',
        1, repeat('0', 64), '2026-08-01T12:00:00Z', '${adminId}'
      );
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_locator, source_payload, content_sha256
      ) VALUES (
        '${therapySourceId}', '${therapyRevisionId}', 1,
        'manual_input:artifact:abcdef654321', 'manual_input', 'section:restore',
        '{"format":"text","text":"Synthetic restore source","language":"de"}',
        repeat('0', 64)
      );
      INSERT INTO public.therapy_input_facts (
        id, therapy_input_revision_id, fact_order, fact_type, fact_key,
        fact_label, fact_value, is_negated, clinical_status, certainty,
        extraction_confidence, extraction_method, evidence_scope,
        kb_entity_id, source_count, extracted_at, extracted_by, content_sha256
      ) VALUES (
        '${therapyFactId}', '${therapyRevisionId}', 1, 'condition',
        'condition.restore_contract', 'Synthetic condition',
        '{"type":"text","value":"Synthetic condition"}', false, 'current',
        'confirmed', 'high', 'manual', 'patient_report', '${preparationId}', 1,
        '2026-08-01T12:05:00Z', '${adminId}', repeat('0', 64)
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
    const snapshot = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        serialized_tables: Record<string, string>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>("SELECT public.kb_export_wiki_snapshot() AS value");
    const original = snapshot.rows[0].value;
    expect(Object.keys(original.tables)).toHaveLength(55);
    expect(Object.keys(original.serialized_tables)).toHaveLength(55);
    expect(Object.keys(original.manifest)).toHaveLength(55);
    expect(original.validation.invalid_dosage_rules).toBe(0);
    expect(original.validation.invalid_safety_rules).toBe(0);
    await expect(validateWikiSnapshotShape({
      tables: original.tables,
      serializedTables: original.serialized_tables,
      manifest: original.manifest,
      validation: original.validation,
    }, wikiSnapshotTables, wiki4b1ZeroValidationKeys)).resolves.toBeUndefined();

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
      }>("SELECT public.kb_export_wiki_snapshot() AS value");
      expect(restored.rows[0].value.validation.invalid_dosage_rules).toBe(0);
      expect(restored.rows[0].value.validation.invalid_safety_rules).toBe(0);
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
       WHERE id = '${therapyFactId}' AND kb_entity_id = '${preparationId}'
    `);
    expect(externalReference.rows[0].count).toBe(1);
  }, 30_000);
});
