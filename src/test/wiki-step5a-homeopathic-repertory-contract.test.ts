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
  "20260802110000_create_kb_homeopathic_repertory_contract.sql",
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const repertoryMigration = migrations.at(-1)!;
const releaseMigration = migrations.at(-5)!;

const repertoryTables = [
  "kb_homeopathic_repertory_revision_details",
  "kb_homeopathic_rubrics",
  "kb_homeopathic_rubric_revisions",
  "kb_homeopathic_grade_definitions",
  "kb_homeopathic_repertory_remedies",
  "kb_homeopathic_rubric_remedy_assignments",
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
  ...repertoryTables,
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
  ...repertoryTables,
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
  "invalid_homeopathic_repertory_revisions",
  "invalid_homeopathic_rubrics",
  "invalid_homeopathic_grade_definitions",
  "invalid_homeopathic_repertory_remedies",
  "invalid_homeopathic_rubric_remedy_assignments",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const repertoryId = "30000000-0000-4000-8000-000000000001";
const repertoryRevisionId = "31000000-0000-4000-8000-000000000001";
const remedyId = "30000000-0000-4000-8000-000000000002";
const remedyRevisionId = "31000000-0000-4000-8000-000000000002";
const rootRubricId = "40000000-0000-4000-8000-000000000001";
const childRubricId = "40000000-0000-4000-8000-000000000002";
const rootRubricRevisionId = "41000000-0000-4000-8000-000000000001";
const childRubricRevisionId = "41000000-0000-4000-8000-000000000002";
const gradeOneId = "50000000-0000-4000-8000-000000000001";
const gradeTwoId = "50000000-0000-4000-8000-000000000002";
const repertoryRemedyId = "60000000-0000-4000-8000-000000000001";
const assignmentId = "70000000-0000-4000-8000-000000000001";

type InitialState = {
  tables: number;
  serialized: number;
  manifest: number;
  contentRows: number;
  controlledTypes: number;
  invalidRepertories: number;
  invalidRubrics: number;
  invalidGrades: number;
  invalidRemedies: number;
  invalidAssignments: number;
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
  await db.exec("BEGIN;");
  let failure: unknown;
  try {
    await db.exec(sql);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
  } catch (error) {
    failure = error;
  } finally {
    await db.exec("ROLLBACK;").catch(() => undefined);
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(message);
}

async function approveRevision(
  table: "kb_source_revisions" | "kb_entity_revisions",
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
           reviewed_at = '2026-08-02T12:30:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase(db);
  for (const migration of migrations) {
    await db.exec(migration);
  }

  initialState = (await db.query<InitialState>(`
    SELECT
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'tables'
      )) AS tables,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'serialized_tables'
      )) AS serialized,
      (SELECT count(*)::int FROM jsonb_object_keys(
        public.kb_export_wiki_snapshot() -> 'manifest'
      )) AS manifest,
      (SELECT sum(row_count)::int FROM (
        SELECT count(*) AS row_count FROM public.kb_homeopathic_repertory_revision_details
        UNION ALL SELECT count(*) FROM public.kb_homeopathic_rubrics
        UNION ALL SELECT count(*) FROM public.kb_homeopathic_rubric_revisions
        UNION ALL SELECT count(*) FROM public.kb_homeopathic_grade_definitions
        UNION ALL SELECT count(*) FROM public.kb_homeopathic_repertory_remedies
        UNION ALL SELECT count(*) FROM public.kb_homeopathic_rubric_remedy_assignments
      ) counts) AS "contentRows",
      (SELECT count(*)::int FROM public.kb_entity_types
        WHERE code IN ('homeopathic_repertory', 'homeopathic_remedy')) AS "controlledTypes",
      public.kb_invalid_homeopathic_repertory_revision_count()::int AS "invalidRepertories",
      public.kb_invalid_homeopathic_rubric_count()::int AS "invalidRubrics",
      public.kb_invalid_homeopathic_grade_definition_count()::int AS "invalidGrades",
      public.kb_invalid_homeopathic_repertory_remedy_count()::int AS "invalidRemedies",
      public.kb_invalid_homeopathic_assignment_count()::int AS "invalidAssignments"
  `)).rows[0];

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:synthetic-repertory-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, rights_status, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'database',
      'Synthetic catalog source', 'licensed', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${repertoryId}', 'homeopathic_repertory', 'homeopathic-repertory:synthetic-catalog'),
      ('${remedyId}', 'homeopathic_remedy', 'homeopathic-remedy:synthetic-alpha');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${repertoryRevisionId}', '${repertoryId}', 1, 'Synthetic repertory catalog',
       'Synthetic source-native hierarchy.', 'Non-medical schema fixture.', repeat('0', 64)),
      ('${remedyRevisionId}', '${remedyId}', 1, 'Synthetic remedy alpha',
       'Potency-neutral synthetic identity.', '', repeat('2', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${repertoryId}', '${remedyId}');

    INSERT INTO public.kb_homeopathic_repertory_revision_details (
      entity_id, entity_revision_id, source_id, source_revision_id,
      source_repertory_code, source_language_code, source_locator
    ) VALUES (
      '${repertoryId}', '${repertoryRevisionId}', '${sourceId}', '${sourceRevisionId}',
      'SYN-CAT-1', 'de', 'catalog:synthetic:edition-1'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_homeopathic_repertory_revision_hash_v1(entity_id, id)
     WHERE id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_rubrics (
      id, repertory_entity_id, native_rubric_code
    ) VALUES
      ('${rootRubricId}', '${repertoryId}', 'ROOT'),
      ('${childRubricId}', '${repertoryId}', 'ROOT.BRANCH');
    INSERT INTO public.kb_homeopathic_rubric_revisions (
      id, repertory_entity_id, repertory_revision_id, rubric_id,
      parent_rubric_id, rubric_text, rubric_domain, sibling_order,
      source_locator, rubric_content_hash
    ) VALUES
      ('${rootRubricRevisionId}', '${repertoryId}', '${repertoryRevisionId}',
       '${rootRubricId}', NULL, 'Synthetic root', 'general', 1,
       'rubric:root', repeat('0', 64)),
      ('${childRubricRevisionId}', '${repertoryId}', '${repertoryRevisionId}',
       '${childRubricId}', '${rootRubricId}', 'Synthetic branch', 'other_source_native', 1,
       'rubric:root.branch', repeat('0', 64));
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id = '${rootRubricRevisionId}';
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id = '${childRubricRevisionId}';

    INSERT INTO public.kb_homeopathic_grade_definitions (
      id, repertory_entity_id, repertory_revision_id, source_grade_code,
      source_grade_label, grade_order, source_locator, grade_content_hash
    ) VALUES
      ('${gradeOneId}', '${repertoryId}', '${repertoryRevisionId}',
       'G-A', 'Source grade A', 1, 'grade:a', repeat('0', 64)),
      ('${gradeTwoId}', '${repertoryId}', '${repertoryRevisionId}',
       'G-B', 'Source grade B', 2, 'grade:b', repeat('0', 64));
    UPDATE public.kb_homeopathic_grade_definitions
       SET grade_content_hash = public.kb_homeopathic_grade_definition_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_repertory_remedies (
      id, repertory_entity_id, repertory_revision_id,
      remedy_entity_id, remedy_revision_id, source_remedy_code,
      source_remedy_name, source_remedy_aliases, source_locator,
      remedy_content_hash
    ) VALUES (
      '${repertoryRemedyId}', '${repertoryId}', '${repertoryRevisionId}',
      '${remedyId}', '${remedyRevisionId}', 'R-A', 'Synthetic alpha',
      ARRAY['Alpha alias', 'Synthetic A'], 'remedy:r-a', repeat('0', 64)
    );
    UPDATE public.kb_homeopathic_repertory_remedies
       SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
     WHERE id = '${repertoryRemedyId}';

    INSERT INTO public.kb_homeopathic_rubric_remedy_assignments (
      id, repertory_entity_id, repertory_revision_id, rubric_revision_id,
      repertory_remedy_id, grade_definition_id, source_locator,
      assignment_content_hash
    ) VALUES (
      '${assignmentId}', '${repertoryId}', '${repertoryRevisionId}',
      '${childRubricRevisionId}', '${repertoryRemedyId}', '${gradeTwoId}',
      'assignment:root.branch:r-a', repeat('0', 64)
    );
    UPDATE public.kb_homeopathic_rubric_remedy_assignments
       SET assignment_content_hash = public.kb_homeopathic_assignment_hash_v1(id)
     WHERE id = '${assignmentId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki Step 5A homeopathic repertory contract", () => {
  it("adds exactly six empty content tables, two controlled types, and the 59-to-65 boundary", async () => {
    expect(Array.from(
      repertoryMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    )).toEqual(repertoryTables);
    expect(initialState).toEqual({
      tables: 65,
      serialized: 65,
      manifest: 65,
      contentRows: 0,
      controlledTypes: 2,
      invalidRepertories: 0,
      invalidRubrics: 0,
      invalidGrades: 0,
      invalidRemedies: 0,
      invalidAssignments: 0,
    });
    expect(wikiSnapshotTables).toHaveLength(65);
    expect(new Set(wikiSnapshotTables).size).toBe(65);
    expect(new Set(wikiRestoreOrder)).toEqual(new Set(wikiSnapshotTables));
    expect(repertoryMigration).toContain("exact 59-table Wiki boundary");
    expect(repertoryMigration).toContain("RENAME TO kb_export_wiki_snapshot_4b2b");
    expect(repertoryMigration).toContain(
      "CREATE TRIGGER kb_entities_protect_homeopathic_repertory_core_write",
    );
    expect(repertoryMigration).toContain(
      "CREATE CONSTRAINT TRIGGER kb_entities_validate_homeopathic_repertory_contract",
    );
    expect(repertoryMigration.match(/INSERT INTO public\.kb_entity_types/g)).toHaveLength(1);
    expect(repertoryMigration).not.toMatch(/INSERT INTO public\.kb_(?!entity_types)/);
    expect(repertoryMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(repertoryMigration).not.toMatch(/\b(normalized_grade|score|ranking|rank)\b/i);
    expect(repertoryMigration).not.toContain("ALTER TABLE public.kb_releases");
    expect(releaseMigration).toContain("CHECK (NOT retrieval_eligible)");
    expect(releaseMigration).toContain("CHECK (NOT is_active)");

    const controlledTypes = await db.query<{ code: string }>(`
      SELECT code FROM public.kb_entity_types
       WHERE code LIKE 'homeopathic_re%'
       ORDER BY code
    `);
    expect(controlledTypes.rows).toEqual([
      { code: "homeopathic_remedy" },
      { code: "homeopathic_repertory" },
    ]);
  });

  it("accepts one exact source-native bundle with canonical locators and hashes", async () => {
    const result = await db.query<{
      repertory: boolean;
      root: boolean;
      child: boolean;
      gradeOne: boolean;
      gradeTwo: boolean;
      remedy: boolean;
      assignment: boolean;
      invalidTotal: number;
    }>(`
      SELECT
        public.kb_homeopathic_repertory_revision_is_valid(
          '${repertoryId}', '${repertoryRevisionId}'
        ) AS repertory,
        public.kb_homeopathic_rubric_revision_is_valid(
          '${rootRubricRevisionId}'
        ) AS root,
        public.kb_homeopathic_rubric_revision_is_valid(
          '${childRubricRevisionId}'
        ) AS child,
        public.kb_homeopathic_grade_definition_is_valid('${gradeOneId}') AS "gradeOne",
        public.kb_homeopathic_grade_definition_is_valid('${gradeTwoId}') AS "gradeTwo",
        public.kb_homeopathic_repertory_remedy_is_valid('${repertoryRemedyId}') AS remedy,
        public.kb_homeopathic_assignment_is_valid('${assignmentId}') AS assignment,
        (public.kb_invalid_homeopathic_repertory_revision_count()
         + public.kb_invalid_homeopathic_rubric_count()
         + public.kb_invalid_homeopathic_grade_definition_count()
         + public.kb_invalid_homeopathic_repertory_remedy_count()
         + public.kb_invalid_homeopathic_assignment_count())::int AS "invalidTotal"
    `);
    expect(result.rows[0]).toEqual({
      repertory: true,
      root: true,
      child: true,
      gradeOne: true,
      gradeTwo: true,
      remedy: true,
      assignment: true,
      invalidTotal: 0,
    });

    const payloads = await db.query<{ repertory: string; rubric: string; remedy: string; assignment: string }>(`
      SELECT
        public.kb_homeopathic_repertory_revision_payload_v1(
          '${repertoryId}', '${repertoryRevisionId}'
        )::text AS repertory,
        public.kb_homeopathic_rubric_revision_payload_v1(
          '${childRubricRevisionId}'
        )::text AS rubric,
        public.kb_homeopathic_repertory_remedy_payload_v1(
          '${repertoryRemedyId}'
        )::text AS remedy,
        public.kb_homeopathic_assignment_payload_v1('${assignmentId}')::text AS assignment
    `);
    expect(payloads.rows[0].repertory).toContain("catalog:synthetic:edition-1");
    expect(payloads.rows[0].rubric).toContain("rubric:root.branch");
    expect(payloads.rows[0].rubric).toContain("parent_rubric_content_hash");
    expect(payloads.rows[0].remedy).toContain("remedy:r-a");
    expect(payloads.rows[0].remedy).toContain("homeopathic_remedy");
    expect(payloads.rows[0].assignment).toContain("assignment:root.branch:r-a");
  });

  it("rejects unknown or quotation-only rights for the exact repertory source", async () => {
    await expectTransactionFailure(`
      UPDATE public.kb_source_revisions
         SET rights_status = 'quoted'
       WHERE id = '${sourceRevisionId}'
    `, /Homeopathic repertory contract is incomplete/);

    const rights = await db.query<{ rights_status: string }>(`
      SELECT rights_status
        FROM public.kb_source_revisions
       WHERE id = '${sourceRevisionId}'
    `);
    expect(rights.rows[0].rights_status).toBe("licensed");
  });

  it("enforces exact same-repertory pairs, controlled domains, and stable identities", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES (
        '30000000-0000-4000-8000-000000000098',
        'homeopathic_repertory', 'homeopathic-repertory:incomplete'
      );
    `, /homeopathic repertory contract.*incomplete/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_homeopathic_rubric_remedy_assignments (
        repertory_entity_id, repertory_revision_id, rubric_revision_id,
        repertory_remedy_id, grade_definition_id, source_locator,
        assignment_content_hash
      ) VALUES (
        '${repertoryId}', '31900000-0000-4000-8000-000000000001',
        '${childRubricRevisionId}', '${repertoryRemedyId}', '${gradeTwoId}',
        'assignment:cross-revision', repeat('0', 64)
      );
    `, /foreign key|homeopathic repertory (?:contract|content)/i);

    await expect(db.exec(`
      UPDATE public.kb_homeopathic_rubric_revisions SET rubric_domain = 'synthetic'
       WHERE id = '${childRubricRevisionId}'
    `)).rejects.toThrow(/check constraint/i);
    await expect(db.exec(`
      UPDATE public.kb_homeopathic_rubrics SET native_rubric_code = 'ROOT.CHANGED'
       WHERE id = '${childRubricId}'
    `)).rejects.toThrow(/stable.*immutable/i);
    await expect(db.exec(`
      INSERT INTO public.kb_homeopathic_rubrics (repertory_entity_id, native_rubric_code)
      VALUES ('${repertoryId}', ' root ')
    `)).rejects.toThrow(/unique constraint/i);
  });

  it("rejects cyclic hierarchy and noncontiguous sibling and grade orders", async () => {
    await expectTransactionFailure(`
      UPDATE public.kb_homeopathic_rubric_revisions
         SET parent_rubric_id = '${childRubricId}'
       WHERE id = '${rootRubricRevisionId}';
      UPDATE public.kb_homeopathic_rubric_revisions
         SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
       WHERE id IN ('${rootRubricRevisionId}', '${childRubricRevisionId}');
      UPDATE public.kb_homeopathic_rubric_remedy_assignments
         SET assignment_content_hash = public.kb_homeopathic_assignment_hash_v1(id)
       WHERE id = '${assignmentId}';
    `, /cyclic|homeopathic repertory contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_homeopathic_rubrics (
        id, repertory_entity_id, native_rubric_code
      ) VALUES (
        '40000000-0000-4000-8000-000000000003', '${repertoryId}', 'ROOT.SECOND'
      );
      INSERT INTO public.kb_homeopathic_rubric_revisions (
        id, repertory_entity_id, repertory_revision_id, rubric_id,
        rubric_text, rubric_domain, sibling_order, source_locator,
        rubric_content_hash
      ) VALUES (
        '41000000-0000-4000-8000-000000000003', '${repertoryId}',
        '${repertoryRevisionId}', '40000000-0000-4000-8000-000000000003',
        'Synthetic second root', 'general', 3, 'rubric:second-root', repeat('0', 64)
      );
      UPDATE public.kb_homeopathic_rubric_revisions
         SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
       WHERE id = '41000000-0000-4000-8000-000000000003';
    `, /noncontiguous|homeopathic repertory contract/i);

    await expectTransactionFailure(`
      INSERT INTO public.kb_homeopathic_grade_definitions (
        repertory_entity_id, repertory_revision_id, source_grade_code,
        source_grade_label, grade_order, source_locator, grade_content_hash
      ) VALUES (
        '${repertoryId}', '${repertoryRevisionId}', 'G-D',
        'Source grade D', 4, 'grade:d', repeat('0', 64)
      );
      UPDATE public.kb_homeopathic_grade_definitions
         SET grade_content_hash = public.kb_homeopathic_grade_definition_hash_v1(id)
       WHERE source_grade_code = 'G-D';
    `, /noncontiguous|homeopathic repertory contract/i);

    await expect(db.exec(`
      INSERT INTO public.kb_homeopathic_grade_definitions (
        repertory_entity_id, repertory_revision_id, source_grade_code,
        source_grade_label, grade_order, source_locator, grade_content_hash
      ) VALUES (
        '${repertoryId}', '${repertoryRevisionId}', ' g-a ',
        'Duplicate source grade', 3, 'grade:duplicate', repeat('0', 64)
      )
    `)).rejects.toThrow(/unique constraint/i);
  });

  it("keeps remedy mappings potency-neutral and source terms unambiguous", async () => {
    const columns = await db.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [repertoryTables]);
    expect(columns.rows.some((column) => /potenc|dilut/i.test(column.column_name))).toBe(false);

    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (
        id, entity_type_code, canonical_key, metadata
      ) VALUES (
        '30000000-0000-4000-8000-000000000099',
        'homeopathic_remedy', 'homeopathic-remedy:runtime-import-blocked',
        '{"origin_type":"import"}'::jsonb
      );
    `, /schema-only.*(?:database-owner creation|import, parser or ai origins)/i);

    await db.exec("BEGIN;");
    try {
      const inserted = await db.query<{ id: string }>(`
        INSERT INTO public.kb_homeopathic_repertory_remedies (
          repertory_entity_id, repertory_revision_id,
          remedy_entity_id, remedy_revision_id, source_remedy_code,
          source_remedy_name, source_locator, remedy_content_hash
        ) VALUES (
          '${repertoryId}', '${repertoryRevisionId}',
          '${repertoryId}', '${repertoryRevisionId}', 'R-WRONG',
          'Wrong target type', 'remedy:wrong-target', repeat('0', 64)
        )
        RETURNING id::text
      `);
      expect(inserted.rows).toHaveLength(1);
      await db.query(`
        UPDATE public.kb_homeopathic_repertory_remedies
           SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
         WHERE id = $1::uuid
      `, [inserted.rows[0].id]);
      const invalid = await db.query<{ remedy: boolean; repertory: boolean }>(`
        SELECT
          public.kb_homeopathic_repertory_remedy_is_valid($1::uuid) AS remedy,
          public.kb_homeopathic_repertory_revision_is_valid(
            '${repertoryId}', '${repertoryRevisionId}'
          ) AS repertory
      `, [inserted.rows[0].id]);
      expect(invalid.rows[0]).toEqual({ remedy: false, repertory: false });
      await expect(db.exec("SET CONSTRAINTS ALL IMMEDIATE;"))
        .rejects.toThrow(/homeopathic repertory contract/i);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await expectTransactionFailure(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES (
        '30000000-0000-4000-8000-000000000003',
        'homeopathic_remedy', 'homeopathic-remedy:synthetic-beta'
      );
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES (
        '31000000-0000-4000-8000-000000000003',
        '30000000-0000-4000-8000-000000000003', 1,
        'Synthetic remedy beta', repeat('3', 64)
      );
      INSERT INTO public.kb_homeopathic_repertory_remedies (
        repertory_entity_id, repertory_revision_id,
        remedy_entity_id, remedy_revision_id, source_remedy_code,
        source_remedy_name, source_remedy_aliases, source_locator,
        remedy_content_hash
      ) VALUES (
        '${repertoryId}', '${repertoryRevisionId}',
        '30000000-0000-4000-8000-000000000003',
        '31000000-0000-4000-8000-000000000003', 'R-B',
        'Synthetic beta', ARRAY[' r-a '], 'remedy:r-b', repeat('0', 64)
      );
      UPDATE public.kb_homeopathic_repertory_remedies
         SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
       WHERE source_remedy_code = 'R-B';
    `, /homeopathic repertory contract/i);

    expect((await db.query<{ valid: boolean; invalid: boolean }>(`
      SELECT
        public.kb_homeopathic_alias_array_is_valid_v1(
          ARRAY['Alpha alias', 'Synthetic A']
        ) AS valid,
        public.kb_homeopathic_alias_array_is_valid_v1(
          ARRAY['Alias', 'alias ']
        ) AS invalid
    `)).rows[0]).toEqual({ valid: true, invalid: false });
  });

  it("detects trigger-bypassed source, rubric, and assignment tampering", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_homeopathic_rubric_remedy_assignments DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_homeopathic_rubric_remedy_assignments
           SET source_locator = 'assignment:tampered'
         WHERE id = $1::uuid
      `, [assignmentId]);
      const counts = await db.query<{ repertories: number; assignments: number }>(`
        SELECT public.kb_invalid_homeopathic_repertory_revision_count()::int AS repertories,
               public.kb_invalid_homeopathic_assignment_count()::int AS assignments
      `);
      expect(counts.rows[0].repertories).toBeGreaterThan(0);
      expect(counts.rows[0].assignments).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_homeopathic_rubrics DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_homeopathic_rubrics SET native_rubric_code = 'ROOT.TAMPERED'
         WHERE id = $1::uuid
      `, [rootRubricId]);
      expect((await db.query<{ rubrics: number; assignments: number }>(`
        SELECT public.kb_invalid_homeopathic_rubric_count()::int AS rubrics,
               public.kb_invalid_homeopathic_assignment_count()::int AS assignments
      `)).rows[0]).toEqual(expect.objectContaining({
        rubrics: expect.any(Number),
        assignments: expect.any(Number),
      }));
      expect((await db.query<{ count: number }>(`
        SELECT (public.kb_invalid_homeopathic_rubric_count()
              + public.kb_invalid_homeopathic_assignment_count())::int AS count
      `)).rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_source_revisions DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_source_revisions SET title = 'Trigger-bypassed source'
         WHERE id = $1::uuid
      `, [sourceRevisionId]);
      const counts = await db.query<{
        repertories: number;
        rubrics: number;
        grades: number;
        remedies: number;
        assignments: number;
      }>(`
        SELECT public.kb_invalid_homeopathic_repertory_revision_count()::int AS repertories,
               public.kb_invalid_homeopathic_rubric_count()::int AS rubrics,
               public.kb_invalid_homeopathic_grade_definition_count()::int AS grades,
               public.kb_invalid_homeopathic_repertory_remedy_count()::int AS remedies,
               public.kb_invalid_homeopathic_assignment_count()::int AS assignments
      `);
      expect(Object.values(counts.rows[0]).every((count) => count > 0)).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_revisions DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.kb_entity_revisions SET origin_type = 'import'
         WHERE id = $1::uuid
      `, [remedyRevisionId]);
      await db.query(`
        UPDATE public.kb_homeopathic_repertory_remedies
           SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
         WHERE id = $1::uuid
      `, [repertoryRemedyId]);
      await db.query(`
        UPDATE public.kb_homeopathic_rubric_remedy_assignments
           SET assignment_content_hash = public.kb_homeopathic_assignment_hash_v1(id)
         WHERE id = $1::uuid
      `, [assignmentId]);
      expect((await db.query<{ remedies: number; assignments: number }>(`
        SELECT public.kb_invalid_homeopathic_repertory_remedy_count()::int AS remedies,
               public.kb_invalid_homeopathic_assignment_count()::int AS assignments
      `)).rows[0]).toEqual({ remedies: 2, assignments: 1 });
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("enforces owner-only writes, admin/service reads, helper revokes, and truncate denial", async () => {
    await expect(db.exec(`
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, origin_type, content_hash
      ) VALUES (
        '31000000-0000-4000-8000-000000000099', '${remedyId}', 2,
        'Imported synthetic remedy revision', 'import', repeat('9', 64)
      )
    `)).rejects.toThrow(/cannot use import, parser or ai origins/i);

    await enterRole("authenticated", adminId);
    try {
      expect((await db.query("SELECT * FROM public.kb_homeopathic_rubrics")).rows)
        .toHaveLength(2);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_revisions (
          id, entity_id, revision_no, display_name, content_hash
        ) VALUES (
          '31000000-0000-4000-8000-000000000099', '${remedyId}', 2,
          'Admin synthetic remedy revision', repeat('9', 64)
        )
      `)).rejects.toThrow(/database table owner/i);
      await expect(db.exec(`
        UPDATE public.kb_entities SET metadata = '{"editor":"admin"}'::jsonb
         WHERE id = '${remedyId}'
      `)).rejects.toThrow(/database table owner/i);
      await db.exec(`
        UPDATE public.kb_entity_revisions SET review_status = 'domain_review'
         WHERE id = '${remedyRevisionId}';
        UPDATE public.kb_entity_revisions SET review_status = 'draft'
         WHERE id = '${remedyRevisionId}';
      `);
      await expect(db.exec(`
        UPDATE public.kb_homeopathic_grade_definitions
           SET source_grade_label = source_grade_label
      `)).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`
        UPDATE public.kb_source_revisions SET title = 'Admin-mutated source'
         WHERE id = '${sourceRevisionId}'
      `)).rejects.toThrow(/database table owner/i);
      await expect(db.exec(`
        UPDATE public.kb_entity_revisions SET display_name = 'Admin-mutated remedy'
         WHERE id = '${remedyRevisionId}'
      `)).rejects.toThrow(/database table owner/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", patientId);
    try {
      expect((await db.query("SELECT * FROM public.kb_homeopathic_rubrics")).rows).toEqual([]);
      expect((await db.query("SELECT * FROM public.kb_homeopathic_repertory_remedies")).rows)
        .toEqual([]);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      expect((await db.query("SELECT * FROM public.kb_homeopathic_rubric_revisions")).rows)
        .toHaveLength(2);
      await expect(db.exec("DELETE FROM public.kb_homeopathic_rubric_revisions"))
        .rejects.toThrow(/permission denied/i);
      await expect(db.exec(`
        UPDATE public.kb_source_revisions SET title = 'Service-mutated source'
         WHERE id = '${sourceRevisionId}'
      `)).rejects.toThrow(/database table owner|permission denied/i);
      expect((await db.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')
      `)).rows[0].count).toBe(65);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        await expect(db.query("SELECT * FROM public.kb_homeopathic_rubrics"))
          .rejects.toThrow(/permission denied/i);
      } finally {
        await leaveRole();
      }
    }

    const helperFunctions = [
      "public.kb_homeopathic_source_term_key_v1(text)",
      "public.kb_homeopathic_alias_array_is_valid_v1(text[])",
      "public.kb_homeopathic_repertory_revision_payload_v1(uuid,uuid)",
      "public.kb_homeopathic_repertory_revision_hash_v1(uuid,uuid)",
      "public.kb_homeopathic_rubric_revision_payload_v1(uuid)",
      "public.kb_homeopathic_rubric_revision_hash_v1(uuid)",
      "public.kb_homeopathic_grade_definition_payload_v1(uuid)",
      "public.kb_homeopathic_grade_definition_hash_v1(uuid)",
      "public.kb_homeopathic_repertory_remedy_payload_v1(uuid)",
      "public.kb_homeopathic_repertory_remedy_hash_v1(uuid)",
      "public.kb_homeopathic_assignment_payload_v1(uuid)",
      "public.kb_homeopathic_assignment_hash_v1(uuid)",
      "public.kb_homeopathic_repertory_revision_is_valid(uuid,uuid)",
      "public.kb_invalid_homeopathic_repertory_revision_count()",
      "public.kb_invalid_homeopathic_rubric_count()",
      "public.kb_invalid_homeopathic_grade_definition_count()",
      "public.kb_invalid_homeopathic_repertory_remedy_count()",
      "public.kb_invalid_homeopathic_assignment_count()",
      "public.kb_validate_homeopathic_repertory_contract()",
      "public.kb_protect_homeopathic_repertory_core_entity_write()",
      "public.kb_export_wiki_snapshot_4b2b()",
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

    for (const table of repertoryTables) {
      await expect(db.exec(`TRUNCATE TABLE public.${table}`))
        .rejects.toThrow(/cannot be truncated|referenced in a foreign key/i);
      expect(repertoryMigration).toContain(`CREATE TRIGGER ${table}_prevent_truncate`);
    }
  });

  it("freezes the complete bundle permanently when its exact revisions are approved", async () => {
    await approveRevision("kb_source_revisions", sourceRevisionId, false);
    await approveRevision("kb_entity_revisions", remedyRevisionId, true);
    await approveRevision("kb_entity_revisions", repertoryRevisionId, true);

    await expect(db.exec(`
      UPDATE public.kb_homeopathic_rubric_revisions SET rubric_text = 'Changed after approval'
       WHERE id = '${childRubricRevisionId}'
    `)).rejects.toThrow(/content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_homeopathic_grade_definitions SET source_grade_label = 'Changed'
       WHERE id = '${gradeOneId}'
    `)).rejects.toThrow(/content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_homeopathic_repertory_remedies SET source_remedy_name = 'Changed'
       WHERE id = '${repertoryRemedyId}'
    `)).rejects.toThrow(/content is immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'draft', reviewed_at = NULL, reviewed_by = NULL,
             released_at = NULL, review_due_at = NULL
       WHERE id = '${repertoryRevisionId}'
    `)).rejects.toThrow(/cannot return to draft/i);
  });

  it("exports and owner-restores exactly 65 tables without changing four-table snapshot v2", async () => {
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
    expect(Object.keys(before.tables)).toHaveLength(65);
    expect(Object.keys(before.serialized_tables)).toHaveLength(65);
    expect(Object.keys(before.manifest)).toHaveLength(65);
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
      for (const key of zeroValidationKeys) {
        expect(after.validation[key]).toBe(0);
      }
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }

    expect((await db.query<{ value: string }>(`
      SELECT public.therapy_input_export_snapshot_v2() AS value
    `)).rows[0].value).toBe(therapyBefore);
    const therapySnapshot = JSON.parse(therapyBefore) as { tables: Record<string, string> };
    expect(Object.keys(therapySnapshot.tables)).toHaveLength(4);
  }, 30_000);

  it("has no repertory reader, writer, importer, patient link, or therapy integration", () => {
    const contractMigration =
      "supabase/migrations/20260802110000_create_kb_homeopathic_repertory_contract.sql";
    const readerContractMigration =
      "supabase/migrations/20260803100000_create_kb_homeopathic_reader_contract.sql";
    const importPreflightContractMigration =
      "supabase/migrations/20260803110000_create_kb_homeopathic_import_preflight_contract.sql";
    const contractSources = new Set([
      contractMigration,
      readerContractMigration,
      importPreflightContractMigration,
      "src/components/admin/BackupCenter.tsx",
      "src/lib/backupAreas.ts",
      "src/lib/wikiBackup.ts",
      "supabase/functions/backup-export/index.ts",
    ]);
    const violations: string[] = [];
    const tablePattern = new RegExp(`\\b(?:${repertoryTables.join("|")})\\b`);
    const visit = (directory: string, relativeDirectory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          if (relativePath !== "src/test") visit(absolutePath, relativePath);
        } else if (/\.(?:[cm]?[jt]sx?|sql)$/.test(entry.name)) {
          const source = readFileSync(absolutePath, "utf8");
          if (!tablePattern.test(source)) continue;
          const hasDirectRuntimeAccess = repertoryTables.some((table) =>
            new RegExp(`\\.from\\(\\s*["'\\\`]${table}["'\\\`]\\s*\\)`).test(source)
            || new RegExp(
              `\\b(?:SELECT[\\s\\S]{0,120}\\bFROM|INSERT[\\s\\S]{0,120}\\bINTO|UPDATE|DELETE[\\s\\S]{0,120}\\bFROM)\\s+(?:public\\.)?${table}\\b`,
              "i",
            ).test(source)
          );
          if (!contractSources.has(relativePath)
              || (![
                contractMigration,
                readerContractMigration,
                importPreflightContractMigration,
              ].includes(relativePath)
                  && hasDirectRuntimeAccess)) {
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
    expect(therapyRecommend).not.toMatch(tablePattern);
    expect(repertoryMigration).not.toMatch(
      /CREATE (?:OR REPLACE )?FUNCTION public\.kb_(?:query|retrieve|import|promote|score|rank|recommend)_/i,
    );
  });
});
