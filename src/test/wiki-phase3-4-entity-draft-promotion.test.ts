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
  "20260730140000_create_kb_entity_candidate_contract.sql",
  "20260730150000_create_kb_entity_draft_promotion.sql",
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const promotionMigration = migrations.at(-1)!;
const exactBoundaryMessage = "Entity draft promotion requires the exact 48-table Wiki boundary";
const expectedBoundaryTables = Array.from(
  (promotionMigration.match(
    /expected_wiki_tables text\[\] := ARRAY\[([\s\S]*?)\]::text\[\];/,
  )?.[1] ?? "").matchAll(/'([a-z0-9_]+)'/g),
  (match) => match[1],
);
const patientMarker = "byte-identical";
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const backupCenterSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"),
  "utf8",
);

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";

const genericBatchId = "81000000-0000-4000-8000-000000000301";
const genericSourceCandidateId = "82000000-0000-4000-8000-000000000301";
const genericCandidateId = "83000000-0000-4000-8000-000000000301";
const genericClassificationId = "84000000-0000-4000-8000-000000000301";
const genericNarrativeId = "84000000-0000-4000-8000-000000000302";

const dependencyBatchId = "81000000-0000-4000-8000-000000000302";
const dependencySourceCandidateId = "82000000-0000-4000-8000-000000000302";
const componentCandidateId = "83000000-0000-4000-8000-000000000302";
const preparationCandidateId = "83000000-0000-4000-8000-000000000303";
const componentAssertionId = "84000000-0000-4000-8000-000000000303";
const preparationAssertionId = "84000000-0000-4000-8000-000000000304";

const collisionBatchId = "81000000-0000-4000-8000-000000000303";
const collisionSourceCandidateId = "82000000-0000-4000-8000-000000000303";
const keyCollisionCandidateId = "83000000-0000-4000-8000-000000000401";
const assertionCollisionCandidateId = "83000000-0000-4000-8000-000000000402";
const targetCollisionCandidateId = "83000000-0000-4000-8000-000000000403";

const typedBatchId = "81000000-0000-4000-8000-000000000304";
const typedSourceCandidateId = "82000000-0000-4000-8000-000000000304";
const homeopathicCandidateId = "83000000-0000-4000-8000-000000000501";
const botanicalCandidateId = "83000000-0000-4000-8000-000000000502";
const nutrientCandidateId = "83000000-0000-4000-8000-000000000503";
const variantCandidateId = "83000000-0000-4000-8000-000000000504";
const homeopathicAssertionId = "84000000-0000-4000-8000-000000000501";
const botanicalAssertionId = "84000000-0000-4000-8000-000000000502";
const nutrientAssertionId = "84000000-0000-4000-8000-000000000503";
const variantAssertionId = "84000000-0000-4000-8000-000000000504";
const directProductId = "20000000-0000-4000-8000-000000000501";
const directProductRevisionId = "30000000-0000-4000-8000-000000000501";
const directNutrientId = "20000000-0000-4000-8000-000000000502";
const directNutrientRevisionId = "30000000-0000-4000-8000-000000000502";

const promotionTables = [
  "kb_entity_candidate_draft_promotion_assertions",
  "kb_entity_candidate_draft_promotions",
] as const;

const contractTables = [
  "kb_entity_candidate_assertion_sources",
  "kb_entity_candidate_assertions",
  "kb_entity_candidate_botanical_details",
  "kb_entity_candidate_components",
  "kb_entity_candidate_contracts",
  "kb_entity_candidate_homeopathic_details",
  "kb_entity_candidate_names",
  "kb_entity_candidate_nutrient_details",
  "kb_entity_candidate_preparation_details",
  "kb_entity_candidate_product_variant_details",
] as const;

const therapeuticTables = [
  "kb_preparation_revision_details",
  "kb_homeopathic_revision_details",
  "kb_botanical_revision_details",
  "kb_nutrient_revision_details",
  "kb_product_variant_revision_details",
  "kb_composition_components",
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
  ...contractTables,
  "kb_source_candidate_draft_promotions",
  ...promotionTables,
  "faqs", "practice_pricing", "practice_info",
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
  "kb_entity_candidate_draft_promotion_assertions",
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

type PromotionResult = {
  promoted_entity_id: string;
  promoted_entity_revision_id: string;
  was_created: boolean;
};

let db: PGlite;
let genericPromotion: PromotionResult;
let componentPromotion: PromotionResult;
let preparationPromotion: PromotionResult;
let homeopathicPromotion: PromotionResult;
let botanicalPromotion: PromotionResult;
let nutrientPromotion: PromotionResult;
let variantPromotion: PromotionResult;
let patientSnapshotBefore: string;

async function enterRole(role: string, userId?: string): Promise<void> {
  await db.exec(`SET ROLE ${role};`);
  if (userId) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  }
}

async function leaveRole(): Promise<void> {
  await db.exec("RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
}

async function promoteEntity(candidateId: string): Promise<PromotionResult> {
  const result = await db.query<PromotionResult>(
    "SELECT * FROM public.kb_promote_entity_candidate_to_draft($1::uuid)",
    [candidateId],
  );
  return result.rows[0];
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

async function expectExactBoundaryFailure(tableNames: readonly string[]): Promise<void> {
  const boundaryDb = new PGlite();
  try {
    await boundaryDb.exec(`
      ${tableNames.map((table) => `CREATE TABLE public.${table} (id integer);`).join("\n")}
      CREATE FUNCTION public.kb_entity_candidate_promotion_readiness(uuid)
      RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION public.kb_entity_candidate_contract_hash(uuid, text, jsonb)
      RETURNS text LANGUAGE sql AS $$ SELECT repeat('0', 64) $$;
      CREATE FUNCTION public.kb_therapeutic_revision_hash(uuid, uuid)
      RETURNS text LANGUAGE sql AS $$ SELECT repeat('0', 64) $$;
      CREATE FUNCTION public.kb_source_candidate_promotion_is_valid(uuid)
      RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    `);

    let migrationError: unknown;
    try {
      await boundaryDb.exec(promotionMigration);
    } catch (error) {
      migrationError = error;
    }
    expect(migrationError).toBeInstanceOf(Error);
    expect((migrationError as Error).message).toBe(exactBoundaryMessage);
  } finally {
    await boundaryDb.close();
  }
}

async function addGenericCandidate(
  candidateId: string,
  batchId: string,
  sourceCandidateId: string,
  canonicalKey: string,
  claimKey: string,
  displayName: string,
): Promise<void> {
  const assertionId = candidateId.replace(/^83/, "84");
  await db.query(
    `INSERT INTO public.kb_entity_candidates (
       id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
       display_name, source_candidate_id, source_locator, original_excerpt, confidence
     ) VALUES ($1, $2, $3, 'plant', $4, $5, $6, 'L. 1', 'Synthetic collision fixture', 100)`,
    [candidateId, batchId, `candidate:${canonicalKey}`, canonicalKey, displayName, sourceCandidateId],
  );
  await db.query(
    `INSERT INTO public.kb_entity_candidate_names (
       batch_id, entity_candidate_id, name, normalized_name, name_kind,
       language_code, is_preferred, name_order
     ) VALUES ($1, $2, $3, public.kb_normalize_entity_candidate_name_v1($3),
       'preferred', 'de', true, 1)`,
    [batchId, candidateId, displayName],
  );
  await db.query(
    `INSERT INTO public.kb_entity_candidate_assertions (
       id, batch_id, entity_candidate_id, claim_key, assertion_kind,
       claim_text, assertion_order
     ) VALUES ($1, $2, $3, $4, 'classification', 'Synthetic collision classification', 1)`,
    [assertionId, batchId, candidateId, claimKey],
  );
  await db.query(
    `INSERT INTO public.kb_entity_candidate_assertion_sources (
       batch_id, entity_candidate_id, assertion_candidate_id, source_candidate_id,
       source_role, locator, is_primary, source_order
     ) VALUES ($1, $2, $3, $4, 'supports', 'L. 1', true, 1)`,
    [batchId, candidateId, assertionId, sourceCandidateId],
  );
  await db.query(
    "SELECT * FROM public.kb_seal_entity_candidate_contract($1::uuid, 'Synthetic collision summary')",
    [candidateId],
  );
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
    INSERT INTO public.patient_snapshot (pseudonym_id, snapshot) VALUES (
      'immutable-patient-sentinel',
      '{"marker":"byte-identical","nested":[1,"synthetic"],"flag":true}'::jsonb
    );
  `);

  for (const migration of migrations.slice(0, -1)) {
    await db.exec(migration);
  }
  const patientSentinel = await db.query<{ snapshot_text: string }>(`
    SELECT snapshot::text AS snapshot_text
      FROM public.patient_snapshot
     WHERE pseudonym_id = 'immutable-patient-sentinel'
  `);
  patientSnapshotBefore = patientSentinel.rows[0].snapshot_text;
  await db.exec(promotionMigration);
}, 90_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 3.4 entity candidate draft promotion", () => {
  it("adds exactly two provenance tables at the exact 50-table boundary", async () => {
    const createdTables = Array.from(
      promotionMigration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual([
      "kb_entity_candidate_draft_promotions",
      "kb_entity_candidate_draft_promotion_assertions",
    ]);
    expect(promotionMigration).toMatch(/^BEGIN;/);
    expect(promotionMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(promotionMigration).toContain("requires the exact 48-table Wiki boundary");
    expect(promotionMigration).toMatch(
      /FUNCTION public\.kb_promote_entity_candidate_to_draft\(\s*_entity_candidate_id uuid\s*\)/,
    );
    expect(promotionMigration).toContain("SECURITY DEFINER");
    expect(promotionMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|anamnesis_id|therapy_session_id)\b/i,
    );
    expect(promotionMigration).not.toMatch(
      /\b(?:Epstein|Candida|Ferritin|Heel|Diamond|NutraMedix)\b/i,
    );
    expect(promotionMigration).not.toMatch(
      /INSERT INTO public\.kb_(?:entity_relations|dosage|safety)/,
    );
    expect(promotionMigration).toContain(
      "LOCK TABLE public.kb_assertions IN SHARE ROW EXCLUSIVE MODE",
    );
    expect(promotionMigration).toContain(
      "CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_promoted_candidate_hash",
    );
    expect(promotionMigration).toContain(
      "CREATE CONSTRAINT TRIGGER kb_assertions_validate_promoted_candidate_hash",
    );
    const assertionHashDefinitions = promotionMigration.slice(
      promotionMigration.indexOf(
        "CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_assertion_hash",
      ),
      promotionMigration.indexOf(
        "CREATE OR REPLACE FUNCTION public.kb_validate_promoted_entity_candidate_current_hash",
      ),
    );
    expect(assertionHashDefinitions).not.toContain("'review_status'");
    expect(assertionHashDefinitions.match(/'supersedes_assertion_id'/g)).toHaveLength(2);

    const historicalTables = wikiSnapshotTables
      .filter((table) => !promotionTables.some((promotionTable) => promotionTable === table))
      .sort();
    expect(expectedBoundaryTables).toEqual(historicalTables);
    expect(expectedBoundaryTables).toHaveLength(48);
    expect(new Set(expectedBoundaryTables).size).toBe(48);
    expect(promotionMigration).toContain(
      "actual_wiki_tables IS DISTINCT FROM expected_wiki_tables",
    );
    expect(promotionMigration).toMatch(
      /FROM pg_catalog\.pg_tables tables[\s\S]*?tables\.tablename = ANY/,
    );
    expect([...expectedBoundaryTables.slice(1), "kb_replacement_table"].sort())
      .not.toEqual(expectedBoundaryTables);

    for (const table of promotionTables) {
      expect(backupAreasSource).toContain(`"${table}"`);
      expect(backupExportSource).toContain(`"${table}"`);
    }
    expect(backupExportSource).toContain("invalid_entity_candidate_draft_promotions");
    expect(backupCenterSource).toContain("invalid_entity_candidate_draft_promotions");
    expect(backupExportSource).toContain(
      "kb_entity_candidate_draft_promotion_assertions` (Assertion-Zuordnungen)",
    );
    expect(backupCenterSource).toContain(
      "`kb_entity_candidate_draft_promotion_assertions` zuletzt",
    );

    const tables = await db.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (${promotionTables.map((table) => `'${table}'`).join(", ")})
       ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual(promotionTables);

    const snapshot = await db.query<{ count: number }>(`
      SELECT count(*)::int AS count
        FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')
    `);
    expect(snapshot.rows[0].count).toBe(50);
  });

  it.each([
    ["missing", expectedBoundaryTables.filter((table) => table !== "practice_info")],
    ["extra", [...expectedBoundaryTables, "kb_boundary_extra"]],
    [
      "one-for-one replacement",
      expectedBoundaryTables.map((table) => (
        table === "practice_info" ? "kb_boundary_replacement" : table
      )),
    ],
  ])("rejects a %s Wiki table set at the exact boundary preflight", async (_kind, tables) => {
    await expectExactBoundaryFailure(tables);
  }, 20_000);

  it("promotes a generic candidate with exact names, assertions, sources, hashes and idempotency", async () => {
    await enterRole("kb_importer");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, parser_name, parser_version, created_by
        ) VALUES (
          '${genericBatchId}', 'parser', 'Synthetic generic promotion', repeat('a', 64),
          'entity-promotion-test', '1.0.0', NULL
        );
        UPDATE public.kb_import_batches SET batch_status = 'processing'
         WHERE id = '${genericBatchId}';

        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, proposed_source_type, title,
          source_locator, original_excerpt
        ) VALUES (
          '${genericSourceCandidateId}', '${genericBatchId}', 'source:generic-promotion',
          'reference_work', 'Synthetic generic source', 'L. 3', 'Synthetic source excerpt'
        );

        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, aliases, description_markdown, source_candidate_id,
          source_locator, original_excerpt, confidence, proposed_data
        ) VALUES (
          '${genericCandidateId}', '${genericBatchId}', 'entity:generic-promotion', 'plant',
          'plant:synthetic-generic', 'Synthetic Generic Entity', ARRAY['Synthetic Alias'],
          'Synthetic draft description.', '${genericSourceCandidateId}', 'L. 3',
          'Synthetic entity excerpt', 100, '{"ignored":"must-not-enter-core"}'::jsonb
        );

        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind,
          language_code, is_preferred, name_order
        ) VALUES
          ('${genericBatchId}', '${genericCandidateId}', 'Synthetic Generic Entity',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Generic Entity'),
           'preferred', 'de', true, 1),
          ('${genericBatchId}', '${genericCandidateId}', 'Synthetic Alias',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Alias'),
           'spelling_variant', 'de', false, 2);

        INSERT INTO public.kb_entity_candidate_assertions (
          id, batch_id, entity_candidate_id, claim_key, assertion_kind, claim_text,
          evidence_basis, evidence_quality, valid_from, valid_until,
          assertion_metadata, assertion_order
        ) VALUES
          ('${genericClassificationId}', '${genericBatchId}', '${genericCandidateId}',
           'assertion:synthetic-generic-classification', 'classification',
           'Synthetic generic classification.', 'practice_rule', 'low',
           '2026-01-11', '2027-01-12', '{"editorial":"candidate"}'::jsonb, 1),
          ('${genericNarrativeId}', '${genericBatchId}', '${genericCandidateId}',
           'assertion:synthetic-generic-narrative', 'narrative',
           'Synthetic generic narrative.', 'unrated', 'unrated',
           '2026-02-13', '2028-02-14', '{}'::jsonb, 2);

        INSERT INTO public.kb_entity_candidate_assertion_sources (
          batch_id, entity_candidate_id, assertion_candidate_id, source_candidate_id,
          source_role, locator, original_quote, is_primary, source_order
        ) VALUES
          ('${genericBatchId}', '${genericCandidateId}', '${genericClassificationId}',
           '${genericSourceCandidateId}', 'supports', 'L. 3', 'Synthetic exact quote A', true, 1),
          ('${genericBatchId}', '${genericCandidateId}', '${genericNarrativeId}',
           '${genericSourceCandidateId}', 'qualifies', 'L. 4', 'Synthetic exact quote B', true, 1);

        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${genericCandidateId}', 'Synthetic generic summary', '{"schema":"promotion-v1"}'::jsonb
        );
        UPDATE public.kb_import_batches SET batch_status = 'ready_for_review'
         WHERE id = '${genericBatchId}';
      `);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'source', '${genericSourceCandidateId}', 'accept_as_draft', 'Synthetic source accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${genericCandidateId}', 'accept_as_draft', 'Synthetic entity accepted'
        );
        SELECT public.kb_complete_import_batch_review('${genericBatchId}');
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${genericSourceCandidateId}', 'source:synthetic-generic', 'book'
        );
      `);
      genericPromotion = await promoteEntity(genericCandidateId);
      expect(genericPromotion.was_created).toBe(true);

      const replay = await promoteEntity(genericCandidateId);
      expect(replay).toEqual({ ...genericPromotion, was_created: false });
    } finally {
      await leaveRole();
    }

    const stored = await db.query<{
      canonical_key: string;
      entity_type_code: string;
      current_revision_id: string;
      revision_no: number;
      display_name: string;
      summary: string;
      description_markdown: string;
      review_status: string;
      origin_type: string;
      content_hash: string;
      calculated_hash: string;
      names: number;
      assertions: number;
      mappings: number;
      source_bindings: number;
      exact_source_revisions: number;
      proposed_data_copied: boolean;
      valid: boolean;
    }>(`
      SELECT
        entity.canonical_key,
        entity.entity_type_code,
        entity.current_revision_id::text,
        revision.revision_no,
        revision.display_name,
        revision.summary,
        revision.description_markdown,
        revision.review_status,
        revision.origin_type,
        revision.content_hash,
        public.kb_therapeutic_revision_hash(entity.id, revision.id) AS calculated_hash,
        (SELECT count(*)::int FROM public.kb_entity_names name
          WHERE name.entity_id = entity.id) AS names,
        (SELECT count(*)::int FROM public.kb_entity_candidate_draft_promotion_assertions mapping
          WHERE mapping.entity_candidate_id = '${genericCandidateId}') AS assertions,
        (SELECT count(*)::int FROM public.kb_entity_candidate_draft_promotion_assertions mapping
          JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
          WHERE mapping.entity_candidate_id = '${genericCandidateId}'
            AND mapping.initial_content_hash = public.kb_entity_candidate_draft_assertion_hash(
              mapping.entity_candidate_assertion_id,
              mapping.entity_candidate_id,
              mapping.batch_id,
              (SELECT review_decision_id FROM public.kb_entity_candidate_draft_promotions
                WHERE entity_candidate_id = mapping.entity_candidate_id),
              entity.id,
              revision.id
            )) AS mappings,
        (SELECT count(*)::int FROM public.kb_assertion_sources assertion_source
          JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
            ON mapping.assertion_id = assertion_source.assertion_id
          WHERE mapping.entity_candidate_id = '${genericCandidateId}') AS source_bindings,
        (SELECT count(*)::int FROM public.kb_assertion_sources assertion_source
          JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
            ON mapping.assertion_id = assertion_source.assertion_id
          JOIN public.kb_source_candidate_draft_promotions source_promotion
            ON source_promotion.source_revision_id = assertion_source.source_revision_id
          WHERE mapping.entity_candidate_id = '${genericCandidateId}'
            AND source_promotion.source_candidate_id = '${genericSourceCandidateId}')
          AS exact_source_revisions,
        entity.metadata ? 'proposed_data'
          OR revision.metadata ? 'proposed_data'
          OR (SELECT bool_or(assertion.metadata ? 'proposed_data')
                FROM public.kb_entity_candidate_draft_promotion_assertions mapping
                JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
               WHERE mapping.entity_candidate_id = '${genericCandidateId}') AS proposed_data_copied,
        public.kb_entity_candidate_draft_promotion_is_valid('${genericCandidateId}') AS valid
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.id = entity.current_revision_id
      WHERE entity.id = '${genericPromotion.promoted_entity_id}'
    `);
    expect(stored.rows[0]).toEqual({
      canonical_key: "plant:synthetic-generic",
      entity_type_code: "plant",
      current_revision_id: genericPromotion.promoted_entity_revision_id,
      revision_no: 1,
      display_name: "Synthetic Generic Entity",
      summary: "Synthetic generic summary",
      description_markdown: "Synthetic draft description.",
      review_status: "draft",
      origin_type: "import",
      content_hash: stored.rows[0].calculated_hash,
      calculated_hash: stored.rows[0].calculated_hash,
      names: 2,
      assertions: 2,
      mappings: 2,
      source_bindings: 2,
      exact_source_revisions: 2,
      proposed_data_copied: false,
      valid: true,
    });
    expect(stored.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);

    const names = await db.query<{
      name: string;
      normalized_name: string;
      name_kind: string;
      language_code: string;
      is_preferred: boolean;
      created_by: string;
    }>(`
      SELECT name, normalized_name, name_kind, language_code, is_preferred,
             created_by::text
        FROM public.kb_entity_names
       WHERE entity_id = '${genericPromotion.promoted_entity_id}'
       ORDER BY is_preferred DESC, name
    `);
    expect(names.rows).toEqual([
      {
        name: "Synthetic Generic Entity",
        normalized_name: "synthetic generic entity",
        name_kind: "preferred",
        language_code: "de",
        is_preferred: true,
        created_by: adminId,
      },
      {
        name: "Synthetic Alias",
        normalized_name: "synthetic alias",
        name_kind: "spelling_variant",
        language_code: "de",
        is_preferred: false,
        created_by: adminId,
      },
    ]);

    const assertions = await db.query<{
      entity_candidate_assertion_id: string;
      canonical_key: string;
      version_no: number;
      assertion_kind: string;
      claim_text: string;
      evidence_basis: string;
      evidence_quality: string;
      valid_from: string;
      valid_until: string;
      review_status: string;
      origin_type: string;
      editorial_metadata: string | null;
      metadata_candidate_id: string;
      metadata_assertion_id: string;
      metadata_entity_id: string;
      metadata_revision_id: string;
      current_hash_valid: boolean;
      source_role: string;
      locator: string;
      original_quote: string;
      is_primary: boolean;
      exact_source_revision_id: string;
    }>(`
      SELECT
        mapping.entity_candidate_assertion_id::text,
        assertion.canonical_key,
        assertion.version_no,
        assertion.assertion_kind,
        assertion.claim_text,
        assertion.evidence_basis,
        assertion.evidence_quality,
        assertion.valid_from::text,
        assertion.valid_until::text,
        assertion.review_status,
        assertion.origin_type,
        assertion.metadata ->> 'editorial' AS editorial_metadata,
        assertion.metadata ->> 'entity_candidate_id' AS metadata_candidate_id,
        assertion.metadata ->> 'entity_candidate_assertion_id' AS metadata_assertion_id,
        assertion.metadata ->> 'promoted_entity_id' AS metadata_entity_id,
        assertion.metadata ->> 'promoted_entity_revision_id' AS metadata_revision_id,
        assertion.content_hash = public.kb_entity_candidate_current_assertion_hash(assertion.id)
          AS current_hash_valid,
        assertion_source.source_role,
        assertion_source.locator,
        assertion_source.original_quote,
        assertion_source.is_primary,
        assertion_source.source_revision_id::text AS exact_source_revision_id
      FROM public.kb_entity_candidate_draft_promotion_assertions mapping
      JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
      JOIN public.kb_assertion_sources assertion_source
        ON assertion_source.assertion_id = assertion.id
     WHERE mapping.entity_candidate_id = '${genericCandidateId}'
     ORDER BY mapping.entity_candidate_assertion_id
    `);
    const promotedSourceRevision = await db.query<{ id: string }>(`
      SELECT source_revision_id::text AS id
        FROM public.kb_source_candidate_draft_promotions
       WHERE source_candidate_id = '${genericSourceCandidateId}'
    `);
    expect(assertions.rows).toEqual([
      {
        entity_candidate_assertion_id: genericClassificationId,
        canonical_key: "assertion:synthetic-generic-classification",
        version_no: 1,
        assertion_kind: "classification",
        claim_text: "Synthetic generic classification.",
        evidence_basis: "practice_rule",
        evidence_quality: "low",
        valid_from: "2026-01-11",
        valid_until: "2027-01-12",
        review_status: "draft",
        origin_type: "import",
        editorial_metadata: "candidate",
        metadata_candidate_id: genericCandidateId,
        metadata_assertion_id: genericClassificationId,
        metadata_entity_id: genericPromotion.promoted_entity_id,
        metadata_revision_id: genericPromotion.promoted_entity_revision_id,
        current_hash_valid: true,
        source_role: "supports",
        locator: "L. 3",
        original_quote: "Synthetic exact quote A",
        is_primary: true,
        exact_source_revision_id: promotedSourceRevision.rows[0].id,
      },
      {
        entity_candidate_assertion_id: genericNarrativeId,
        canonical_key: "assertion:synthetic-generic-narrative",
        version_no: 1,
        assertion_kind: "narrative",
        claim_text: "Synthetic generic narrative.",
        evidence_basis: "unrated",
        evidence_quality: "unrated",
        valid_from: "2026-02-13",
        valid_until: "2028-02-14",
        review_status: "draft",
        origin_type: "import",
        editorial_metadata: null,
        metadata_candidate_id: genericCandidateId,
        metadata_assertion_id: genericNarrativeId,
        metadata_entity_id: genericPromotion.promoted_entity_id,
        metadata_revision_id: genericPromotion.promoted_entity_revision_id,
        current_hash_valid: true,
        source_role: "qualifies",
        locator: "L. 4",
        original_quote: "Synthetic exact quote B",
        is_primary: true,
        exact_source_revision_id: promotedSourceRevision.rows[0].id,
      },
    ]);

    const discardedPayload = await db.query<{
      stored_digest: string;
      expected_digest: string;
      raw_sentinel_found: boolean;
    }>(`
      SELECT
        promotion.discarded_proposed_data_hash AS stored_digest,
        encode(sha256(convert_to(candidate.proposed_data::text, 'UTF8')), 'hex')
          AS expected_digest,
        EXISTS (
          SELECT 1
            FROM (
              SELECT to_jsonb(entity)::text AS payload
                FROM public.kb_entities entity WHERE entity.id = promotion.entity_id
              UNION ALL
              SELECT to_jsonb(revision)::text
                FROM public.kb_entity_revisions revision
               WHERE revision.id = promotion.entity_revision_id
              UNION ALL
              SELECT to_jsonb(name)::text
                FROM public.kb_entity_names name WHERE name.entity_id = promotion.entity_id
              UNION ALL
              SELECT to_jsonb(assertion)::text
                FROM public.kb_assertions assertion
                JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
                  ON mapping.assertion_id = assertion.id
               WHERE mapping.entity_candidate_id = promotion.entity_candidate_id
              UNION ALL
              SELECT to_jsonb(assertion_source)::text
                FROM public.kb_assertion_sources assertion_source
                JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
                  ON mapping.assertion_id = assertion_source.assertion_id
               WHERE mapping.entity_candidate_id = promotion.entity_candidate_id
              UNION ALL
              SELECT to_jsonb(promotion)::text
              UNION ALL
              SELECT to_jsonb(mapping)::text
                FROM public.kb_entity_candidate_draft_promotion_assertions mapping
               WHERE mapping.entity_candidate_id = promotion.entity_candidate_id
            ) promoted_payloads
           WHERE promoted_payloads.payload LIKE '%must-not-enter-core%'
        ) AS raw_sentinel_found
      FROM public.kb_entity_candidate_draft_promotions promotion
      JOIN public.kb_entity_candidates candidate
        ON candidate.id = promotion.entity_candidate_id
     WHERE promotion.entity_candidate_id = '${genericCandidateId}'
    `);
    expect(discardedPayload.rows[0]).toEqual({
      stored_digest: discardedPayload.rows[0].expected_digest,
      expected_digest: discardedPayload.rows[0].expected_digest,
      raw_sentinel_found: false,
    });
    expect(discardedPayload.rows[0].stored_digest).toMatch(/^[0-9a-f]{64}$/);

    await enterRole("authenticated", adminId);
    try {
      const readiness = await db.query<{
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
        warning_reason_codes: string[];
      }>("SELECT ready_for_promotion, blocking_reason_codes, warning_reason_codes FROM public.kb_entity_candidate_promotion_readiness($1)", [genericCandidateId]);
      expect(readiness.rows[0]).toEqual({
        ready_for_promotion: true,
        blocking_reason_codes: [],
        warning_reason_codes: ["UNSTRUCTURED_PROPOSED_DATA_PRESENT"],
      });
    } finally {
      await leaveRole();
    }
  }, 20_000);

  it("preserves promoted assertion integrity through the full review lifecycle", async () => {
    const before = await db.query<{
      assertion_id: string;
      assertion_hash: string;
      assertion_initial_hash: string;
      assertion_metadata: string;
      source_revision_id: string;
      source_hash: string;
      source_initial_hash: string;
      source_metadata: string;
    }>(`
      SELECT assertion.id::text AS assertion_id,
             assertion.content_hash AS assertion_hash,
             mapping.initial_content_hash AS assertion_initial_hash,
             assertion.metadata::text AS assertion_metadata,
             source_revision.id::text AS source_revision_id,
             source_revision.content_hash AS source_hash,
             source_promotion.initial_content_hash AS source_initial_hash,
             source_revision.metadata::text AS source_metadata
        FROM public.kb_entity_candidate_draft_promotion_assertions mapping
        JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
        JOIN public.kb_assertion_sources assertion_source
          ON assertion_source.assertion_id = assertion.id
        JOIN public.kb_source_candidate_draft_promotions source_promotion
          ON source_promotion.source_revision_id = assertion_source.source_revision_id
        JOIN public.kb_source_revisions source_revision
          ON source_revision.id = source_promotion.source_revision_id
       WHERE mapping.entity_candidate_assertion_id = '${genericNarrativeId}'
    `);

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        BEGIN;
        UPDATE public.kb_source_revisions
           SET review_status = 'domain_review'
         WHERE id = '${before.rows[0].source_revision_id}';
        UPDATE public.kb_source_revisions
           SET review_status = 'approved',
               reviewed_at = '2026-03-01T10:00:00Z',
               reviewed_by = '${adminId}',
               review_due_at = '2027-03-01T10:00:00Z'
         WHERE id = '${before.rows[0].source_revision_id}';
        UPDATE public.kb_source_revisions
           SET review_status = 'released',
               released_at = '2026-03-02T10:00:00Z'
         WHERE id = '${before.rows[0].source_revision_id}';

        UPDATE public.kb_assertions
           SET review_status = 'domain_review'
         WHERE id = '${before.rows[0].assertion_id}';
        UPDATE public.kb_assertions
           SET review_status = 'safety_review'
         WHERE id = '${before.rows[0].assertion_id}';
        UPDATE public.kb_assertions
           SET review_status = 'approved',
               reviewed_at = '2026-03-03T10:00:00Z',
               reviewed_by = '${adminId}',
               review_due_at = '2027-03-03T10:00:00Z'
         WHERE id = '${before.rows[0].assertion_id}';
        UPDATE public.kb_assertions
           SET review_status = 'released',
               released_at = '2026-03-04T10:00:00Z'
         WHERE id = '${before.rows[0].assertion_id}';
        SET CONSTRAINTS ALL IMMEDIATE;
        COMMIT;
      `);
      const replay = await promoteEntity(genericCandidateId);
      expect(replay).toEqual({ ...genericPromotion, was_created: false });
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
      await leaveRole();
    }

    const after = await db.query<{
      assertion_status: string;
      assertion_hash: string;
      current_assertion_hash: string;
      assertion_initial_hash: string;
      assertion_metadata: string;
      assertion_reviewed_by: string;
      assertion_reviewed: boolean;
      assertion_released: boolean;
      source_status: string;
      source_hash: string;
      source_initial_hash: string;
      source_metadata: string;
      source_reviewed_by: string;
      source_reviewed: boolean;
      source_released: boolean;
      source_promotion_valid: boolean;
      entity_promotion_valid: boolean;
      snapshot_source_count: number;
      snapshot_entity_count: number;
    }>(`
      SELECT assertion.review_status AS assertion_status,
             assertion.content_hash AS assertion_hash,
             public.kb_entity_candidate_current_assertion_hash(assertion.id)
               AS current_assertion_hash,
             mapping.initial_content_hash AS assertion_initial_hash,
             assertion.metadata::text AS assertion_metadata,
             assertion.reviewed_by::text AS assertion_reviewed_by,
             assertion.reviewed_at IS NOT NULL AS assertion_reviewed,
             assertion.released_at IS NOT NULL AS assertion_released,
             source_revision.review_status AS source_status,
             source_revision.content_hash AS source_hash,
             source_promotion.initial_content_hash AS source_initial_hash,
             source_revision.metadata::text AS source_metadata,
             source_revision.reviewed_by::text AS source_reviewed_by,
             source_revision.reviewed_at IS NOT NULL AS source_reviewed,
             source_revision.released_at IS NOT NULL AS source_released,
             public.kb_source_candidate_promotion_is_valid('${genericSourceCandidateId}')
               AS source_promotion_valid,
             public.kb_entity_candidate_draft_promotion_is_valid('${genericCandidateId}')
               AS entity_promotion_valid,
             (public.kb_export_wiki_snapshot() -> 'validation'
               ->> 'invalid_source_promotions')::int AS snapshot_source_count,
             (public.kb_export_wiki_snapshot() -> 'validation'
               ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_entity_count
        FROM public.kb_entity_candidate_draft_promotion_assertions mapping
        JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
        JOIN public.kb_assertion_sources assertion_source
          ON assertion_source.assertion_id = assertion.id
        JOIN public.kb_source_candidate_draft_promotions source_promotion
          ON source_promotion.source_revision_id = assertion_source.source_revision_id
        JOIN public.kb_source_revisions source_revision
          ON source_revision.id = source_promotion.source_revision_id
       WHERE mapping.entity_candidate_assertion_id = '${genericNarrativeId}'
    `);
    expect(after.rows[0]).toEqual({
      assertion_status: "released",
      assertion_hash: before.rows[0].assertion_hash,
      current_assertion_hash: before.rows[0].assertion_hash,
      assertion_initial_hash: before.rows[0].assertion_initial_hash,
      assertion_metadata: before.rows[0].assertion_metadata,
      assertion_reviewed_by: adminId,
      assertion_reviewed: true,
      assertion_released: true,
      source_status: "released",
      source_hash: before.rows[0].source_hash,
      source_initial_hash: before.rows[0].source_initial_hash,
      source_metadata: before.rows[0].source_metadata,
      source_reviewed_by: adminId,
      source_reviewed: true,
      source_released: true,
      source_promotion_valid: true,
      entity_promotion_valid: true,
      snapshot_source_count: 0,
      snapshot_entity_count: 0,
    });
  }, 20_000);

  it("requires direct candidate dependencies first and resolves exact preparation component revisions", async () => {
    await enterRole("kb_importer");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, created_by
        ) VALUES (
          '${dependencyBatchId}', 'manual', 'Synthetic dependency promotion', repeat('b', 64), NULL
        );
        UPDATE public.kb_import_batches SET batch_status = 'processing'
         WHERE id = '${dependencyBatchId}';
        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, title, source_locator, original_excerpt
        ) VALUES (
          '${dependencySourceCandidateId}', '${dependencyBatchId}', 'source:dependency-promotion',
          'Synthetic dependency source', 'L. 5', 'Synthetic dependency excerpt'
        );
        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, source_candidate_id, source_locator, original_excerpt, confidence
        ) VALUES
          ('${componentCandidateId}', '${dependencyBatchId}', 'entity:synthetic-component',
           'substance', 'substance:synthetic-component', 'Synthetic Component',
           '${dependencySourceCandidateId}', 'L. 5', 'Synthetic component excerpt', 100),
          ('${preparationCandidateId}', '${dependencyBatchId}', 'entity:synthetic-preparation',
           'preparation', 'preparation:synthetic-component-owner', 'Synthetic Preparation',
           '${dependencySourceCandidateId}', 'L. 6', 'Synthetic preparation excerpt', 100);
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind,
          language_code, is_preferred, name_order
        ) VALUES
          ('${dependencyBatchId}', '${componentCandidateId}', 'Synthetic Component',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Component'),
           'preferred', 'de', true, 1),
          ('${dependencyBatchId}', '${preparationCandidateId}', 'Synthetic Preparation',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Preparation'),
           'preferred', 'de', true, 1);
        INSERT INTO public.kb_entity_candidate_assertions (
          id, batch_id, entity_candidate_id, claim_key, assertion_kind, claim_text,
          assertion_order
        ) VALUES
          ('${componentAssertionId}', '${dependencyBatchId}', '${componentCandidateId}',
           'assertion:synthetic-component-classification', 'classification',
           'Synthetic component classification.', 1),
          ('${preparationAssertionId}', '${dependencyBatchId}', '${preparationCandidateId}',
           'assertion:synthetic-preparation-classification', 'classification',
           'Synthetic preparation classification.', 1);
        INSERT INTO public.kb_entity_candidate_assertion_sources (
          batch_id, entity_candidate_id, assertion_candidate_id, source_candidate_id,
          source_role, locator, is_primary, source_order
        ) VALUES
          ('${dependencyBatchId}', '${componentCandidateId}', '${componentAssertionId}',
           '${dependencySourceCandidateId}', 'supports', 'L. 5', true, 1),
          ('${dependencyBatchId}', '${preparationCandidateId}', '${preparationAssertionId}',
           '${dependencySourceCandidateId}', 'supports', 'L. 6', true, 1);
        INSERT INTO public.kb_entity_candidate_preparation_details (
          entity_candidate_id, batch_id, preparation_kind, dosage_form,
          administration_routes, standardization_status, basis_assertion_candidate_id
        ) VALUES (
          '${preparationCandidateId}', '${dependencyBatchId}', 'other', 'other',
          ARRAY['other'], 'not_applicable', '${preparationAssertionId}'
        );
        INSERT INTO public.kb_entity_candidate_components (
          id, batch_id, entity_candidate_id, component_candidate_id, component_role,
          chemical_form_status, amount_status, component_order, basis_assertion_candidate_id
        ) VALUES (
          '85000000-0000-4000-8000-000000000301', '${dependencyBatchId}',
          '${preparationCandidateId}', '${componentCandidateId}', 'active',
          'not_applicable', 'not_applicable', 1, '${preparationAssertionId}'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${componentCandidateId}', 'Synthetic component summary'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${preparationCandidateId}', 'Synthetic preparation summary'
        );
        UPDATE public.kb_import_batches SET batch_status = 'ready_for_review'
         WHERE id = '${dependencyBatchId}';
      `);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'source', '${dependencySourceCandidateId}', 'accept_as_draft', 'Synthetic source accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${componentCandidateId}', 'accept_as_draft', 'Synthetic component accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${preparationCandidateId}', 'accept_as_draft', 'Synthetic preparation accepted'
        );
        SELECT public.kb_complete_import_batch_review('${dependencyBatchId}');
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${dependencySourceCandidateId}', 'source:synthetic-dependency', 'other'
        );
      `);

      const pending = await db.query<{
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
      }>("SELECT ready_for_promotion, blocking_reason_codes FROM public.kb_entity_candidate_promotion_readiness($1)", [preparationCandidateId]);
      expect(pending.rows[0].ready_for_promotion).toBe(false);
      expect(pending.rows[0].blocking_reason_codes).toContain(
        "CANDIDATE_DEPENDENCY_PROMOTION_MISSING",
      );

      await expect(promoteEntity(preparationCandidateId)).rejects.toThrow(
        /CANDIDATE_DEPENDENCY_PROMOTION_MISSING/,
      );
      componentPromotion = await promoteEntity(componentCandidateId);

      const ready = await db.query<{
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
      }>("SELECT ready_for_promotion, blocking_reason_codes FROM public.kb_entity_candidate_promotion_readiness($1)", [preparationCandidateId]);
      expect(ready.rows[0]).toEqual({
        ready_for_promotion: true,
        blocking_reason_codes: [],
      });
      preparationPromotion = await promoteEntity(preparationCandidateId);
    } finally {
      await leaveRole();
    }

    const exact = await db.query<{
      preparation_kind: string;
      standardization_status: string;
      component_entity_id: string;
      component_revision_id: string;
      chemical_form: string | null;
      amount_min: string | null;
      amount_unit: string | null;
      content_hash: string;
      calculated_hash: string;
      valid: boolean;
    }>(`
      SELECT
        detail.preparation_kind,
        detail.standardization_status,
        component.component_entity_id::text,
        component.component_revision_id::text,
        component.chemical_form,
        component.amount_min::text,
        component.amount_unit,
        revision.content_hash,
        public.kb_therapeutic_revision_hash(revision.entity_id, revision.id) AS calculated_hash,
        public.kb_entity_candidate_draft_promotion_is_valid('${preparationCandidateId}') AS valid
      FROM public.kb_entity_revisions revision
      JOIN public.kb_preparation_revision_details detail
        ON detail.entity_revision_id = revision.id
      JOIN public.kb_composition_components component
        ON component.owner_revision_id = revision.id
      WHERE revision.id = '${preparationPromotion.promoted_entity_revision_id}'
    `);
    expect(exact.rows[0]).toEqual({
      preparation_kind: "other",
      standardization_status: "not_applicable",
      component_entity_id: componentPromotion.promoted_entity_id,
      component_revision_id: componentPromotion.promoted_entity_revision_id,
      chemical_form: null,
      amount_min: null,
      amount_unit: null,
      content_hash: exact.rows[0].calculated_hash,
      calculated_hash: exact.rows[0].calculated_hash,
      valid: true,
    });
  }, 20_000);

  it("maps every typed detail and specified direct-revision component without column loss", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
        ('${directProductId}', 'product', 'product:synthetic-direct-reference'),
        ('${directNutrientId}', 'nutrient', 'nutrient:synthetic-direct-component');
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, summary, content_hash
      ) VALUES
        ('${directProductRevisionId}', '${directProductId}', 1,
         'Synthetic Direct Product', 'Synthetic direct product revision', repeat('0', 64)),
        ('${directNutrientRevisionId}', '${directNutrientId}', 1,
         'Synthetic Direct Nutrient', 'Synthetic direct nutrient revision', repeat('0', 64));
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id IN ('${directProductRevisionId}', '${directNutrientRevisionId}');
      UPDATE public.kb_entities SET current_revision_id = CASE id
        WHEN '${directProductId}' THEN '${directProductRevisionId}'::uuid
        ELSE '${directNutrientRevisionId}'::uuid
      END
      WHERE id IN ('${directProductId}', '${directNutrientId}');
      COMMIT;
    `);

    await enterRole("kb_importer");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, created_by
        ) VALUES (
          '${typedBatchId}', 'manual', 'Synthetic typed promotion', repeat('d', 64), NULL
        );
        UPDATE public.kb_import_batches SET batch_status = 'processing'
         WHERE id = '${typedBatchId}';
        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, title, source_locator, original_excerpt
        ) VALUES (
          '${typedSourceCandidateId}', '${typedBatchId}', 'source:typed-promotion',
          'Synthetic typed source', 'T. 1', 'Synthetic typed excerpt'
        );
        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, source_candidate_id, source_locator, original_excerpt, confidence
        ) VALUES
          ('${homeopathicCandidateId}', '${typedBatchId}', 'entity:typed-homeopathic',
           'preparation', 'preparation:synthetic-homeopathic', 'Synthetic Homeopathic Detail',
           '${typedSourceCandidateId}', 'T. 11', 'Synthetic homeopathic excerpt', 100),
          ('${botanicalCandidateId}', '${typedBatchId}', 'entity:typed-botanical',
           'preparation', 'preparation:synthetic-botanical', 'Synthetic Botanical Detail',
           '${typedSourceCandidateId}', 'T. 12', 'Synthetic botanical excerpt', 100),
          ('${nutrientCandidateId}', '${typedBatchId}', 'entity:typed-nutrient',
           'preparation', 'preparation:synthetic-nutrient', 'Synthetic Nutrient Detail',
           '${typedSourceCandidateId}', 'T. 13', 'Synthetic nutrient excerpt', 100),
          ('${variantCandidateId}', '${typedBatchId}', 'entity:typed-variant',
           'product_variant', 'product-variant:synthetic-typed', 'Synthetic Variant Detail',
           '${typedSourceCandidateId}', 'T. 14', 'Synthetic variant excerpt', 100);
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind,
          language_code, is_preferred, name_order
        ) VALUES
          ('${typedBatchId}', '${homeopathicCandidateId}', 'Synthetic Homeopathic Detail',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Homeopathic Detail'),
           'preferred', 'de', true, 1),
          ('${typedBatchId}', '${botanicalCandidateId}', 'Synthetic Botanical Detail',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Botanical Detail'),
           'preferred', 'de', true, 1),
          ('${typedBatchId}', '${nutrientCandidateId}', 'Synthetic Nutrient Detail',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Nutrient Detail'),
           'preferred', 'de', true, 1),
          ('${typedBatchId}', '${variantCandidateId}', 'Synthetic Variant Detail',
           public.kb_normalize_entity_candidate_name_v1('Synthetic Variant Detail'),
           'preferred', 'de', true, 1);
        INSERT INTO public.kb_entity_candidate_assertions (
          id, batch_id, entity_candidate_id, claim_key, assertion_kind, claim_text,
          evidence_basis, evidence_quality, assertion_order
        ) VALUES
          ('${homeopathicAssertionId}', '${typedBatchId}', '${homeopathicCandidateId}',
           'assertion:typed-homeopathic', 'classification', 'Synthetic homeopathic classification.',
           'traditional_use', 'very_low', 1),
          ('${botanicalAssertionId}', '${typedBatchId}', '${botanicalCandidateId}',
           'assertion:typed-botanical', 'classification', 'Synthetic botanical classification.',
           'practice_rule', 'low', 1),
          ('${nutrientAssertionId}', '${typedBatchId}', '${nutrientCandidateId}',
           'assertion:typed-nutrient', 'classification', 'Synthetic nutrient classification.',
           'manufacturer_statement', 'moderate', 1),
          ('${variantAssertionId}', '${typedBatchId}', '${variantCandidateId}',
           'assertion:typed-variant', 'classification', 'Synthetic variant classification.',
           'unrated', 'high', 1);
        INSERT INTO public.kb_entity_candidate_assertion_sources (
          batch_id, entity_candidate_id, assertion_candidate_id, source_candidate_id,
          source_role, locator, original_quote, is_primary, source_order
        ) VALUES
          ('${typedBatchId}', '${homeopathicCandidateId}', '${homeopathicAssertionId}',
           '${typedSourceCandidateId}', 'supports', 'T. 21', 'Synthetic typed quote one', true, 1),
          ('${typedBatchId}', '${botanicalCandidateId}', '${botanicalAssertionId}',
           '${typedSourceCandidateId}', 'qualifies', 'T. 22', 'Synthetic typed quote two', true, 1),
          ('${typedBatchId}', '${nutrientCandidateId}', '${nutrientAssertionId}',
           '${typedSourceCandidateId}', 'supports', 'T. 23', 'Synthetic typed quote three', true, 1),
          ('${typedBatchId}', '${variantCandidateId}', '${variantAssertionId}',
           '${typedSourceCandidateId}', 'qualifies', 'T. 24', 'Synthetic typed quote four', true, 1);
        INSERT INTO public.kb_entity_candidate_preparation_details (
          entity_candidate_id, batch_id, preparation_kind, dosage_form,
          administration_routes, standardization_status, basis_assertion_candidate_id,
          technical_metadata
        ) VALUES
          ('${homeopathicCandidateId}', '${typedBatchId}', 'homeopathic_single', 'globules',
           ARRAY['oral', 'sublingual'], 'manufacturer_specific', '${homeopathicAssertionId}',
           '{"technical":"homeopathic-nondefault"}'::jsonb),
          ('${botanicalCandidateId}', '${typedBatchId}', 'mother_tincture', 'drops',
           ARRAY['oral', 'topical'], 'partially_standardized', '${botanicalAssertionId}',
           '{"technical":"botanical-nondefault"}'::jsonb),
          ('${nutrientCandidateId}', '${typedBatchId}', 'nutrient_single', 'capsules',
           ARRAY['oral'], 'standardized', '${nutrientAssertionId}',
           '{"technical":"nutrient-nondefault"}'::jsonb);
        INSERT INTO public.kb_entity_candidate_homeopathic_details (
          entity_candidate_id, batch_id, remedy_kind, potency_scale, potency_value,
          potentization_method, basis_assertion_candidate_id
        ) VALUES (
          '${homeopathicCandidateId}', '${typedBatchId}', 'single', 'C', 7,
          'manufacturer_specific', '${homeopathicAssertionId}'
        );
        INSERT INTO public.kb_entity_candidate_botanical_details (
          entity_candidate_id, batch_id, plant_parts, source_material_state,
          extraction_type, drug_extract_ratio_from, drug_extract_ratio_to,
          extraction_solvents, alcohol_percent_from, alcohol_percent_to,
          basis_assertion_candidate_id
        ) VALUES (
          '${botanicalCandidateId}', '${typedBatchId}', ARRAY['flower', 'leaf'], 'fresh',
          'percolation', 1.5, 2.75, ARRAY['ethanol', 'water'], 12.5, 45.75,
          '${botanicalAssertionId}'
        );
        INSERT INTO public.kb_entity_candidate_nutrient_details (
          entity_candidate_id, batch_id, formulation_kind, delivery_system,
          basis_assertion_candidate_id
        ) VALUES (
          '${nutrientCandidateId}', '${typedBatchId}', 'single', 'liposomal',
          '${nutrientAssertionId}'
        );
        INSERT INTO public.kb_entity_candidate_components (
          id, batch_id, entity_candidate_id, component_entity_id, component_revision_id,
          component_role, chemical_form_status, chemical_form, amount_status,
          amount_min, amount_max, amount_unit, reference_quantity, reference_unit,
          elemental_amount, elemental_unit, component_order, valid_from, valid_until,
          basis_assertion_candidate_id
        ) VALUES (
          '85000000-0000-4000-8000-000000000501', '${typedBatchId}',
          '${nutrientCandidateId}', '${directNutrientId}', '${directNutrientRevisionId}',
          'nutrient', 'specified', 'Synthetic form alpha', 'specified',
          1.25, 2.5, 'synthetic-unit', 3.75, 'synthetic-reference-unit',
          0.5, 'synthetic-element-unit', 7, '2026-02-03', '2027-04-05',
          '${nutrientAssertionId}'
        );
        INSERT INTO public.kb_entity_candidate_product_variant_details (
          entity_candidate_id, batch_id, product_entity_id, product_revision_id,
          preparation_candidate_id, package_quantity, package_unit, market_status,
          valid_from, valid_until, basis_assertion_candidate_id
        ) VALUES (
          '${variantCandidateId}', '${typedBatchId}', '${directProductId}',
          '${directProductRevisionId}', '${homeopathicCandidateId}', 12.5, 'capsule', 'planned',
          '2026-06-07', '2028-08-09', '${variantAssertionId}'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${homeopathicCandidateId}', 'Synthetic homeopathic typed summary'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${botanicalCandidateId}', 'Synthetic botanical typed summary'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${nutrientCandidateId}', 'Synthetic nutrient typed summary'
        );
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${variantCandidateId}', 'Synthetic variant typed summary'
        );
        UPDATE public.kb_import_batches SET batch_status = 'ready_for_review'
         WHERE id = '${typedBatchId}';
      `);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'source', '${typedSourceCandidateId}', 'accept_as_draft', 'Synthetic typed source accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${homeopathicCandidateId}', 'accept_as_draft', 'Synthetic typed entity accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${botanicalCandidateId}', 'accept_as_draft', 'Synthetic typed entity accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${nutrientCandidateId}', 'accept_as_draft', 'Synthetic typed entity accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${variantCandidateId}', 'accept_as_draft', 'Synthetic typed entity accepted'
        );
        SELECT public.kb_complete_import_batch_review('${typedBatchId}');
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${typedSourceCandidateId}', 'source:synthetic-typed', 'other'
        );
      `);
      homeopathicPromotion = await promoteEntity(homeopathicCandidateId);
      botanicalPromotion = await promoteEntity(botanicalCandidateId);
      nutrientPromotion = await promoteEntity(nutrientCandidateId);
      variantPromotion = await promoteEntity(variantCandidateId);
    } finally {
      await leaveRole();
    }

    const homeopathic = await db.query<{
      preparation_kind: string;
      dosage_form: string;
      administration_routes: string[];
      standardization_status: string;
      technical: string;
      remedy_kind: string;
      potency_scale: string;
      potency_value: string;
      potentization_method: string;
      basis_candidate_id: string;
      hash_valid: boolean;
    }>(`
      SELECT preparation.preparation_kind, preparation.dosage_form,
             preparation.administration_routes, preparation.standardization_status,
             preparation.technical_metadata ->> 'technical' AS technical,
             homeopathic.remedy_kind, homeopathic.potency_scale,
             trim_scale(homeopathic.potency_value)::text AS potency_value,
             homeopathic.potentization_method,
             mapping.entity_candidate_assertion_id::text AS basis_candidate_id,
             revision.content_hash = public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
               AS hash_valid
        FROM public.kb_entity_revisions revision
        JOIN public.kb_preparation_revision_details preparation
          ON preparation.entity_revision_id = revision.id
        JOIN public.kb_homeopathic_revision_details homeopathic
          ON homeopathic.entity_revision_id = revision.id
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.assertion_id = preparation.basis_assertion_id
       WHERE revision.id = '${homeopathicPromotion.promoted_entity_revision_id}'
    `);
    expect(homeopathic.rows[0]).toEqual({
      preparation_kind: "homeopathic_single",
      dosage_form: "globules",
      administration_routes: ["oral", "sublingual"],
      standardization_status: "manufacturer_specific",
      technical: "homeopathic-nondefault",
      remedy_kind: "single",
      potency_scale: "C",
      potency_value: "7",
      potentization_method: "manufacturer_specific",
      basis_candidate_id: homeopathicAssertionId,
      hash_valid: true,
    });

    const botanical = await db.query<{
      preparation_kind: string;
      dosage_form: string;
      administration_routes: string[];
      standardization_status: string;
      technical: string;
      plant_parts: string[];
      source_material_state: string;
      extraction_type: string;
      ratio_from: string;
      ratio_to: string;
      extraction_solvents: string[];
      alcohol_from: string;
      alcohol_to: string;
      basis_candidate_id: string;
    }>(`
      SELECT preparation.preparation_kind, preparation.dosage_form,
             preparation.administration_routes, preparation.standardization_status,
             preparation.technical_metadata ->> 'technical' AS technical,
             botanical.plant_parts, botanical.source_material_state, botanical.extraction_type,
             trim_scale(botanical.drug_extract_ratio_from)::text AS ratio_from,
             trim_scale(botanical.drug_extract_ratio_to)::text AS ratio_to,
             botanical.extraction_solvents,
             trim_scale(botanical.alcohol_percent_from)::text AS alcohol_from,
             trim_scale(botanical.alcohol_percent_to)::text AS alcohol_to,
             mapping.entity_candidate_assertion_id::text AS basis_candidate_id
        FROM public.kb_preparation_revision_details preparation
        JOIN public.kb_botanical_revision_details botanical
          ON botanical.entity_revision_id = preparation.entity_revision_id
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.assertion_id = botanical.basis_assertion_id
       WHERE preparation.entity_revision_id = '${botanicalPromotion.promoted_entity_revision_id}'
    `);
    expect(botanical.rows[0]).toEqual({
      preparation_kind: "mother_tincture",
      dosage_form: "drops",
      administration_routes: ["oral", "topical"],
      standardization_status: "partially_standardized",
      technical: "botanical-nondefault",
      plant_parts: ["flower", "leaf"],
      source_material_state: "fresh",
      extraction_type: "percolation",
      ratio_from: "1.5",
      ratio_to: "2.75",
      extraction_solvents: ["ethanol", "water"],
      alcohol_from: "12.5",
      alcohol_to: "45.75",
      basis_candidate_id: botanicalAssertionId,
    });

    const nutrient = await db.query<{
      formulation_kind: string;
      delivery_system: string;
      technical: string;
      component_entity_id: string;
      component_revision_id: string;
      component_role: string;
      chemical_form: string;
      amount_min: string;
      amount_max: string;
      amount_unit: string;
      reference_quantity: string;
      reference_unit: string;
      elemental_amount: string;
      elemental_unit: string;
      component_order: number;
      valid_from: string;
      valid_until: string;
      basis_candidate_id: string;
    }>(`
      SELECT nutrient.formulation_kind, nutrient.delivery_system,
             preparation.technical_metadata ->> 'technical' AS technical,
             component.component_entity_id::text, component.component_revision_id::text,
             component.component_role, component.chemical_form,
             trim_scale(component.amount_min)::text AS amount_min,
             trim_scale(component.amount_max)::text AS amount_max,
             component.amount_unit,
             trim_scale(component.reference_quantity)::text AS reference_quantity,
             component.reference_unit,
             trim_scale(component.elemental_amount)::text AS elemental_amount,
             component.elemental_unit, component.component_order,
             component.valid_from::text, component.valid_until::text,
             mapping.entity_candidate_assertion_id::text AS basis_candidate_id
        FROM public.kb_nutrient_revision_details nutrient
        JOIN public.kb_preparation_revision_details preparation
          ON preparation.entity_revision_id = nutrient.entity_revision_id
        JOIN public.kb_composition_components component
          ON component.owner_revision_id = nutrient.entity_revision_id
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.assertion_id = component.basis_assertion_id
       WHERE nutrient.entity_revision_id = '${nutrientPromotion.promoted_entity_revision_id}'
    `);
    expect(nutrient.rows[0]).toEqual({
      formulation_kind: "single",
      delivery_system: "liposomal",
      technical: "nutrient-nondefault",
      component_entity_id: directNutrientId,
      component_revision_id: directNutrientRevisionId,
      component_role: "nutrient",
      chemical_form: "Synthetic form alpha",
      amount_min: "1.25",
      amount_max: "2.5",
      amount_unit: "synthetic-unit",
      reference_quantity: "3.75",
      reference_unit: "synthetic-reference-unit",
      elemental_amount: "0.5",
      elemental_unit: "synthetic-element-unit",
      component_order: 7,
      valid_from: "2026-02-03",
      valid_until: "2027-04-05",
      basis_candidate_id: nutrientAssertionId,
    });

    const variant = await db.query<{
      product_entity_id: string;
      product_revision_id: string;
      preparation_entity_id: string;
      preparation_revision_id: string;
      package_quantity: string;
      package_unit: string;
      market_status: string;
      valid_from: string;
      valid_until: string;
      basis_candidate_id: string;
      valid: boolean;
    }>(`
      SELECT detail.product_entity_id::text, detail.product_revision_id::text,
             detail.preparation_entity_id::text, detail.preparation_revision_id::text,
             trim_scale(detail.package_quantity)::text AS package_quantity,
             detail.package_unit, detail.market_status,
             detail.valid_from::text, detail.valid_until::text,
             mapping.entity_candidate_assertion_id::text AS basis_candidate_id,
             public.kb_entity_candidate_draft_promotion_is_valid('${variantCandidateId}') AS valid
        FROM public.kb_product_variant_revision_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.assertion_id = detail.basis_assertion_id
       WHERE detail.entity_revision_id = '${variantPromotion.promoted_entity_revision_id}'
    `);
    expect(variant.rows[0]).toEqual({
      product_entity_id: directProductId,
      product_revision_id: directProductRevisionId,
      preparation_entity_id: homeopathicPromotion.promoted_entity_id,
      preparation_revision_id: homeopathicPromotion.promoted_entity_revision_id,
      package_quantity: "12.5",
      package_unit: "capsule",
      market_status: "planned",
      valid_from: "2026-06-07",
      valid_until: "2028-08-09",
      basis_candidate_id: variantAssertionId,
      valid: true,
    });
  }, 30_000);

  it("freezes exact direct and candidate dependency revision hashes", async () => {
    const dependencies = await db.query<{
      owner_candidate_id: string;
      reference_role: string;
      reference_kind: string;
      entity_revision_id: string;
      frozen_hash: string;
      revision_hash: string;
    }>(`
      SELECT promotion.entity_candidate_id::text AS owner_candidate_id,
             dependency.value ->> 'reference_role' AS reference_role,
             dependency.value ->> 'reference_kind' AS reference_kind,
             dependency.value ->> 'entity_revision_id' AS entity_revision_id,
             dependency.value ->> 'frozen_revision_content_hash' AS frozen_hash,
             revision.content_hash AS revision_hash
        FROM public.kb_entity_candidate_draft_promotions promotion
        CROSS JOIN LATERAL jsonb_array_elements(
          promotion.resolution_manifest -> 'entity_dependencies'
        ) dependency(value)
        JOIN public.kb_entity_revisions revision
          ON revision.id = (dependency.value ->> 'entity_revision_id')::uuid
       WHERE promotion.entity_candidate_id IN (
         '${preparationCandidateId}',
         '${variantCandidateId}'
       )
       ORDER BY promotion.entity_candidate_id, dependency.value ->> 'reference_role'
    `);
    expect(dependencies.rows).toHaveLength(3);
    expect(dependencies.rows.map((row) => ({
      owner_candidate_id: row.owner_candidate_id,
      reference_role: row.reference_role,
      reference_kind: row.reference_kind,
      entity_revision_id: row.entity_revision_id,
    }))).toEqual([
      {
        owner_candidate_id: preparationCandidateId,
        reference_role: "component",
        reference_kind: "candidate",
        entity_revision_id: componentPromotion.promoted_entity_revision_id,
      },
      {
        owner_candidate_id: variantCandidateId,
        reference_role: "preparation",
        reference_kind: "candidate",
        entity_revision_id: homeopathicPromotion.promoted_entity_revision_id,
      },
      {
        owner_candidate_id: variantCandidateId,
        reference_role: "product",
        reference_kind: "revision",
        entity_revision_id: directProductRevisionId,
      },
    ]);
    for (const dependency of dependencies.rows) {
      expect(dependency.frozen_hash).toBe(dependency.revision_hash);
    }

    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_entity_revisions
         SET summary = 'Synthetic stale dependency hash'
       WHERE id = '${directProductRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Referenced promotion dependency revision is frozen/);

    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_entity_revisions
         SET summary = 'Synthetic dependency revision edit'
       WHERE id = '${directProductRevisionId}';
      UPDATE public.kb_entity_revisions
         SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
       WHERE id = '${directProductRevisionId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Referenced promotion dependency revision is frozen/);

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_revisions DISABLE TRIGGER USER;
      UPDATE public.kb_entity_revisions
         SET summary = 'Synthetic trigger-disabled stale dependency hash'
       WHERE id = '${directProductRevisionId}';
    `);
    try {
      const stale = await db.query<{
        promotion_valid: boolean;
        invalid_count: number;
        snapshot_count: number;
      }>(`
        SELECT
          public.kb_entity_candidate_draft_promotion_is_valid('${variantCandidateId}')
            AS promotion_valid,
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS invalid_count,
          (public.kb_export_wiki_snapshot() -> 'validation'
            ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
      `);
      expect(stale.rows[0].promotion_valid).toBe(false);
      expect(stale.rows[0].invalid_count).toBeGreaterThan(0);
      expect(stale.rows[0].snapshot_count).toBeGreaterThan(0);
    } finally {
      await db.exec("ROLLBACK;");
    }

    for (const tamper of [
      { candidateId: preparationCandidateId, dependencyIndex: 0 },
      { candidateId: variantCandidateId, dependencyIndex: 0 },
    ]) {
      await db.exec(`
        BEGIN;
        ALTER TABLE public.kb_entity_candidate_draft_promotions DISABLE TRIGGER USER;
        UPDATE public.kb_entity_candidate_draft_promotions
           SET resolution_manifest = jsonb_set(
             resolution_manifest,
             '{entity_dependencies,${tamper.dependencyIndex},frozen_revision_content_hash}',
             to_jsonb(repeat('f', 64))
           )
         WHERE entity_candidate_id = '${tamper.candidateId}';
        UPDATE public.kb_entity_candidate_draft_promotions
           SET resolution_manifest_hash = encode(
             sha256(convert_to(resolution_manifest::text, 'UTF8')),
             'hex'
           )
         WHERE entity_candidate_id = '${tamper.candidateId}';
      `);
      try {
        const invalid = await db.query<{
          promotion_valid: boolean;
          manifest_hash_valid: boolean;
          frozen_hash_is_valid_hex: boolean;
          invalid_count: number;
          snapshot_count: number;
        }>(`
          SELECT
            public.kb_entity_candidate_draft_promotion_is_valid('${tamper.candidateId}')
              AS promotion_valid,
            promotion.resolution_manifest_hash = encode(
              sha256(convert_to(promotion.resolution_manifest::text, 'UTF8')),
              'hex'
            ) AS manifest_hash_valid,
            promotion.resolution_manifest #>>
              '{entity_dependencies,${tamper.dependencyIndex},frozen_revision_content_hash}'
              ~ '^[0-9a-f]{64}$' AS frozen_hash_is_valid_hex,
            public.kb_invalid_entity_candidate_draft_promotion_count()::int
              AS invalid_count,
            (public.kb_export_wiki_snapshot() -> 'validation'
              ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
          FROM public.kb_entity_candidate_draft_promotions promotion
          WHERE promotion.entity_candidate_id = '${tamper.candidateId}'
        `);
        expect(invalid.rows[0].promotion_valid).toBe(false);
        expect(invalid.rows[0].manifest_hash_valid).toBe(true);
        expect(invalid.rows[0].frozen_hash_is_valid_hex).toBe(true);
        expect(invalid.rows[0].invalid_count).toBeGreaterThan(0);
        expect(invalid.rows[0].snapshot_count).toBeGreaterThan(0);
      } finally {
        await db.exec("ROLLBACK;");
      }
    }
  }, 20_000);

  it("validates deferred dependency hashes against the final revision row", async () => {
    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        BEGIN;
        UPDATE public.kb_entity_revisions
           SET content_hash = repeat('0', 64)
         WHERE id = '${directProductRevisionId}';
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
         WHERE id = '${directProductRevisionId}';
        SET CONSTRAINTS ALL IMMEDIATE;
        COMMIT;
      `);
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    } finally {
      await leaveRole();
    }

    const finalRevision = await db.query<{
      content_hash: string;
      calculated_hash: string;
      frozen_hash: string;
    }>(`
      SELECT revision.content_hash,
             public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
               AS calculated_hash,
             dependency.value ->> 'frozen_revision_content_hash' AS frozen_hash
        FROM public.kb_entity_revisions revision
        JOIN public.kb_entity_candidate_draft_promotions promotion
          ON promotion.entity_candidate_id = '${variantCandidateId}'
        CROSS JOIN LATERAL jsonb_array_elements(
          promotion.resolution_manifest -> 'entity_dependencies'
        ) dependency(value)
       WHERE revision.id = '${directProductRevisionId}'
         AND dependency.value ->> 'entity_revision_id' = revision.id::text
    `);
    expect(finalRevision.rows[0].content_hash).toBe(finalRevision.rows[0].calculated_hash);
    expect(finalRevision.rows[0].content_hash).toBe(finalRevision.rows[0].frozen_hash);
  }, 20_000);

  it("rolls back key, target and assertion collisions without leaking excerpts", async () => {
    await enterRole("kb_importer");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, created_by
        ) VALUES (
          '${collisionBatchId}', 'manual', 'Synthetic collision promotion', repeat('c', 64), NULL
        );
        UPDATE public.kb_import_batches SET batch_status = 'processing'
         WHERE id = '${collisionBatchId}';
        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, title, source_locator, original_excerpt
        ) VALUES (
          '${collisionSourceCandidateId}', '${collisionBatchId}', 'source:collision-promotion',
          'Synthetic collision source', 'L. 7', 'Synthetic collision source excerpt'
        );
      `);
      await addGenericCandidate(
        keyCollisionCandidateId,
        collisionBatchId,
        collisionSourceCandidateId,
        "plant:late-key-collision",
        "assertion:late-key-collision-classification",
        "Synthetic Key Collision Candidate",
      );
      await addGenericCandidate(
        assertionCollisionCandidateId,
        collisionBatchId,
        collisionSourceCandidateId,
        "plant:late-assertion-collision",
        "assertion:late-assertion-collision-classification",
        "Synthetic Assertion Collision Candidate",
      );
      await addGenericCandidate(
        targetCollisionCandidateId,
        collisionBatchId,
        collisionSourceCandidateId,
        "plant:late-target-collision",
        "assertion:late-target-collision-classification",
        "Synthetic Target Collision Candidate",
      );
      await db.exec(`
        UPDATE public.kb_import_batches SET batch_status = 'ready_for_review'
         WHERE id = '${collisionBatchId}';
      `);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'source', '${collisionSourceCandidateId}', 'accept_as_draft', 'Synthetic source accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${keyCollisionCandidateId}', 'accept_as_draft', 'Synthetic candidate accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${assertionCollisionCandidateId}', 'accept_as_draft', 'Synthetic candidate accepted'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${targetCollisionCandidateId}', 'accept_as_draft', 'Synthetic candidate accepted'
        );
        SELECT public.kb_complete_import_batch_review('${collisionBatchId}');
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${collisionSourceCandidateId}', 'source:synthetic-collision', 'other'
        );
      `);
    } finally {
      await leaveRole();
    }

    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_entities (
        id, entity_type_code, canonical_key
      ) VALUES (
        '20000000-0000-4000-8000-000000000399', 'plant', 'plant:late-key-collision'
      );
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      SAVEPOINT before_key_collision;
    `);
    let keyError: Error | undefined;
    try {
      await promoteEntity(keyCollisionCandidateId);
    } catch (error) {
      keyError = error as Error;
      await db.exec("ROLLBACK TO SAVEPOINT before_key_collision;");
    } finally {
      await db.exec("RESET ROLE; ROLLBACK; RESET request.jwt.claim.sub;");
    }
    expect(keyError?.message).toMatch(/CANONICAL_KEY_TAKEN/);
    expect(keyError?.message).not.toContain("Synthetic collision fixture");

    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000399',
        'assertion:late-assertion-collision-classification', 1,
        'classification', 'Synthetic preexisting assertion', repeat('9', 64)
      );
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      SAVEPOINT before_assertion_collision;
    `);
    let assertionError: Error | undefined;
    try {
      await promoteEntity(assertionCollisionCandidateId);
    } catch (error) {
      assertionError = error as Error;
      await db.exec("ROLLBACK TO SAVEPOINT before_assertion_collision;");
    } finally {
      await db.exec("RESET ROLE; ROLLBACK; RESET request.jwt.claim.sub;");
    }
    expect(assertionError?.message).toMatch(/ASSERTION_KEY_TAKEN/);
    expect(assertionError?.message).not.toContain("Synthetic collision fixture");

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidates DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidates
         SET target_entity_id = '${genericPromotion.promoted_entity_id}'
       WHERE id = '${targetCollisionCandidateId}';
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      SAVEPOINT before_target_collision;
    `);
    let targetError: Error | undefined;
    try {
      await promoteEntity(targetCollisionCandidateId);
    } catch (error) {
      targetError = error as Error;
      await db.exec("ROLLBACK TO SAVEPOINT before_target_collision;");
    } finally {
      await db.exec("RESET ROLE; ROLLBACK; RESET request.jwt.claim.sub;");
    }
    expect(targetError?.message).toMatch(/EXISTING_ENTITY_REQUIRES_REVISION_WORKFLOW/);
    expect(targetError?.message).not.toContain("Synthetic collision fixture");

    const rollbackCounts = await db.query<{
      promotions: number;
      revisions: number;
      collision_entities: number;
      collision_assertions: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_entity_candidate_draft_promotions
          WHERE entity_candidate_id IN (
            '${keyCollisionCandidateId}',
            '${assertionCollisionCandidateId}',
            '${targetCollisionCandidateId}'
          )) AS promotions,
        (SELECT count(*)::int FROM public.kb_entity_revisions revision
          JOIN public.kb_entities entity ON entity.id = revision.entity_id
          WHERE entity.canonical_key IN (
            'plant:late-key-collision',
            'plant:late-assertion-collision',
            'plant:late-target-collision'
          )) AS revisions,
        (SELECT count(*)::int FROM public.kb_entities
          WHERE canonical_key = 'plant:late-key-collision') AS collision_entities,
        (SELECT count(*)::int FROM public.kb_assertions
          WHERE canonical_key = 'assertion:late-assertion-collision-classification')
          AS collision_assertions
    `);
    expect(rollbackCounts.rows[0]).toEqual({
      promotions: 0,
      revisions: 0,
      collision_entities: 0,
      collision_assertions: 0,
    });
  }, 20_000);

  it("allows editorial draft changes while preserving technical provenance and replay", async () => {
    const frozenBefore = await db.query<{
      revision_hash: string;
      assertion_hashes: string[];
    }>(`
      SELECT promotion.initial_content_hash AS revision_hash,
             ARRAY(
               SELECT mapping.initial_content_hash
                 FROM public.kb_entity_candidate_draft_promotion_assertions mapping
                WHERE mapping.entity_candidate_id = promotion.entity_candidate_id
                ORDER BY mapping.entity_candidate_assertion_id
             ) AS assertion_hashes
        FROM public.kb_entity_candidate_draft_promotions promotion
       WHERE promotion.entity_candidate_id = '${genericCandidateId}'
    `);

    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_entity_revisions
         SET summary = 'Stale synthetic revision hash'
       WHERE id = '${genericPromotion.promoted_entity_revision_id}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /canonical current content hash/);
    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_assertions assertion
         SET claim_text = 'Stale synthetic assertion hash.'
        FROM public.kb_entity_candidate_draft_promotion_assertions mapping
       WHERE mapping.assertion_id = assertion.id
         AND mapping.entity_candidate_assertion_id = '${genericClassificationId}';
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /canonical current content hash/);

    await enterRole("authenticated", adminId);
    try {
      await db.exec(`
        BEGIN;
        UPDATE public.kb_entities
           SET metadata = metadata || '{"editorial_note":"allowed"}'::jsonb
         WHERE id = '${genericPromotion.promoted_entity_id}';
        UPDATE public.kb_entity_revisions
           SET summary = 'Editorially revised synthetic summary',
               description_markdown = 'Editorially revised synthetic description.',
               metadata = metadata || '{"editorial_note":"allowed"}'::jsonb
         WHERE id = '${genericPromotion.promoted_entity_revision_id}';
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
         WHERE id = '${genericPromotion.promoted_entity_revision_id}';
        UPDATE public.kb_assertions assertion
           SET claim_text = 'Editorially revised synthetic classification.',
               metadata = metadata || '{"editorial_note":"allowed"}'::jsonb
          FROM public.kb_entity_candidate_draft_promotion_assertions mapping
         WHERE mapping.assertion_id = assertion.id
           AND mapping.entity_candidate_assertion_id = '${genericClassificationId}';
        UPDATE public.kb_assertions assertion
           SET content_hash = public.kb_entity_candidate_current_assertion_hash(assertion.id)
          FROM public.kb_entity_candidate_draft_promotion_assertions mapping
         WHERE mapping.assertion_id = assertion.id
           AND mapping.entity_candidate_assertion_id = '${genericClassificationId}';
        SET CONSTRAINTS ALL IMMEDIATE;
        COMMIT;
      `);

      const replay = await promoteEntity(genericCandidateId);
      expect(replay).toEqual({ ...genericPromotion, was_created: false });

      await expect(db.exec(`
        UPDATE public.kb_entity_revisions
           SET metadata = metadata - 'review_decision_id'
         WHERE id = '${genericPromotion.promoted_entity_revision_id}';
      `)).rejects.toThrow(/technical provenance is immutable/);
      await expect(db.exec(`
        UPDATE public.kb_assertions assertion
           SET metadata = metadata - 'entity_candidate_assertion_id'
          FROM public.kb_entity_candidate_draft_promotion_assertions mapping
         WHERE mapping.assertion_id = assertion.id
           AND mapping.entity_candidate_assertion_id = '${genericClassificationId}';
      `)).rejects.toThrow(/technical provenance is immutable/);
      await expect(db.exec(`
        INSERT INTO public.kb_entities (
          entity_type_code, canonical_key, metadata
        ) VALUES (
          'plant', 'plant:forged-candidate-origin',
          '{"origin_type":"import","entity_candidate_id":"00000000-0000-4000-8000-000000000001"}'::jsonb
        );
      `)).rejects.toThrow(/requires the promotion function/);
    } finally {
      await leaveRole();
    }

    const integrity = await db.query<{
      promotion_count: number;
      contract_count: number;
      summary: string;
      description_markdown: string;
      revision_hash_valid: boolean;
      assertion_hash_valid: boolean;
      revision_initial_hash: string;
      assertion_initial_hashes: string[];
    }>(`
      SELECT
        public.kb_invalid_entity_candidate_draft_promotion_count()::int AS promotion_count,
        public.kb_invalid_entity_candidate_contract_count()::int AS contract_count,
        revision.summary,
        revision.description_markdown,
        revision.content_hash = public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
          AS revision_hash_valid,
        (SELECT bool_and(
                  assertion.content_hash =
                    public.kb_entity_candidate_current_assertion_hash(assertion.id)
                )
           FROM public.kb_entity_candidate_draft_promotion_assertions mapping
           JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
          WHERE mapping.entity_candidate_id = '${genericCandidateId}') AS assertion_hash_valid,
        promotion.initial_content_hash AS revision_initial_hash,
        ARRAY(
          SELECT mapping.initial_content_hash
            FROM public.kb_entity_candidate_draft_promotion_assertions mapping
           WHERE mapping.entity_candidate_id = '${genericCandidateId}'
           ORDER BY mapping.entity_candidate_assertion_id
        ) AS assertion_initial_hashes
      FROM public.kb_entity_revisions revision
      JOIN public.kb_entity_candidate_draft_promotions promotion
        ON promotion.entity_revision_id = revision.id
      WHERE revision.id = '${genericPromotion.promoted_entity_revision_id}'
    `);
    expect(integrity.rows[0]).toEqual({
      promotion_count: 0,
      contract_count: 0,
      summary: "Editorially revised synthetic summary",
      description_markdown: "Editorially revised synthetic description.",
      revision_hash_valid: true,
      assertion_hash_valid: true,
      revision_initial_hash: frozenBefore.rows[0].revision_hash,
      assertion_initial_hashes: frozenBefore.rows[0].assertion_hashes,
    });
  });

  it("recomputes promoted contract hashes after trigger-disabled payload tampering", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidate_contracts DISABLE TRIGGER USER;
      ALTER TABLE public.kb_entity_candidate_draft_promotions DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidate_contracts
         SET summary = 'Trigger-disabled forged contract summary'
       WHERE entity_candidate_id = '${genericCandidateId}';
      UPDATE public.kb_entity_candidate_draft_promotions
         SET input_manifest = public.kb_entity_candidate_canonical_jsonb_v1(
               public.kb_entity_candidate_draft_promotion_input_manifest(entity_candidate_id)
             ),
             candidate_owned_hash =
               public.kb_entity_candidate_draft_promotion_candidate_owned_hash(entity_candidate_id)
       WHERE entity_candidate_id = '${genericCandidateId}';
      UPDATE public.kb_entity_candidate_draft_promotions
         SET input_manifest_hash = encode(
           sha256(convert_to(
             public.kb_entity_candidate_canonical_jsonb_v1(input_manifest)::text,
             'UTF8'
           )),
           'hex'
         )
       WHERE entity_candidate_id = '${genericCandidateId}';
    `);
    try {
      const forged = await db.query<{
        contract_hash_valid: boolean;
        input_manifest_valid: boolean;
        candidate_owned_hash_valid: boolean;
        promotion_valid: boolean;
        promotion_count: number;
        contract_count: number;
        snapshot_count: number;
      }>(`
        SELECT
          contract.contract_hash = public.kb_entity_candidate_contract_hash(
            contract.entity_candidate_id,
            contract.summary,
            contract.contract_metadata
          ) AS contract_hash_valid,
          promotion.input_manifest =
            public.kb_entity_candidate_draft_promotion_input_manifest(
              promotion.entity_candidate_id
            ) AS input_manifest_valid,
          promotion.candidate_owned_hash =
            public.kb_entity_candidate_draft_promotion_candidate_owned_hash(
              promotion.entity_candidate_id
            ) AS candidate_owned_hash_valid,
          public.kb_entity_candidate_draft_promotion_is_valid('${genericCandidateId}')
            AS promotion_valid,
          public.kb_invalid_entity_candidate_draft_promotion_count()::int
            AS promotion_count,
          public.kb_invalid_entity_candidate_contract_count()::int AS contract_count,
          (public.kb_export_wiki_snapshot() -> 'validation'
            ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
        FROM public.kb_entity_candidate_draft_promotions promotion
        JOIN public.kb_entity_candidate_contracts contract
          ON contract.entity_candidate_id = promotion.entity_candidate_id
        WHERE promotion.entity_candidate_id = '${genericCandidateId}'
      `);
      expect(forged.rows[0]).toEqual({
        contract_hash_valid: false,
        input_manifest_valid: true,
        candidate_owned_hash_valid: true,
        promotion_valid: false,
        promotion_count: 1,
        contract_count: 1,
        snapshot_count: 1,
      });
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("reconstructs the initial entity revision hash independently", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidate_draft_promotions DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidate_draft_promotions
         SET initial_content_hash = repeat('d', 64),
             resolution_manifest = jsonb_set(
               resolution_manifest,
               '{entity_revision_content_hash}',
               to_jsonb(repeat('d', 64))
             )
       WHERE entity_candidate_id = '${genericCandidateId}';
      UPDATE public.kb_entity_candidate_draft_promotions
         SET resolution_manifest_hash = encode(
           sha256(convert_to(resolution_manifest::text, 'UTF8')),
           'hex'
         )
       WHERE entity_candidate_id = '${genericCandidateId}';
    `);
    try {
      const forged = await db.query<{
        self_binding_valid: boolean;
        manifest_hash_valid: boolean;
        reconstructed_hash_valid: boolean;
        promotion_valid: boolean;
        invalid_count: number;
        snapshot_count: number;
      }>(`
        SELECT
          promotion.initial_content_hash =
            promotion.resolution_manifest ->> 'entity_revision_content_hash'
              AS self_binding_valid,
          promotion.resolution_manifest_hash = encode(
            sha256(convert_to(promotion.resolution_manifest::text, 'UTF8')),
            'hex'
          ) AS manifest_hash_valid,
          promotion.initial_content_hash =
            public.kb_entity_candidate_draft_initial_revision_hash(
              promotion.entity_candidate_id,
              promotion.review_decision_id
            ) AS reconstructed_hash_valid,
          public.kb_entity_candidate_draft_promotion_is_valid('${genericCandidateId}')
            AS promotion_valid,
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS invalid_count,
          (public.kb_export_wiki_snapshot() -> 'validation'
            ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
        FROM public.kb_entity_candidate_draft_promotions promotion
        WHERE promotion.entity_candidate_id = '${genericCandidateId}'
      `);
      expect(forged.rows[0]).toEqual({
        self_binding_valid: true,
        manifest_hash_valid: true,
        reconstructed_hash_valid: false,
        promotion_valid: false,
        invalid_count: 1,
        snapshot_count: 1,
      });
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("rejects unknown top-level and nested resolution manifest fields", async () => {
    const tamperCases = [
      { candidateId: genericCandidateId, path: "{unexpected_field}" },
      { candidateId: genericCandidateId, path: "{sources,0,unexpected_field}" },
      { candidateId: genericCandidateId, path: "{assertions,0,unexpected_field}" },
      { candidateId: variantCandidateId, path: "{entity_dependencies,0,unexpected_field}" },
    ] as const;

    for (const tamper of tamperCases) {
      await db.exec(`
        BEGIN;
        ALTER TABLE public.kb_entity_candidate_draft_promotions DISABLE TRIGGER USER;
        UPDATE public.kb_entity_candidate_draft_promotions
           SET resolution_manifest = jsonb_set(
             resolution_manifest,
             '${tamper.path}'::text[],
             to_jsonb('synthetic unexpected value'::text)
           )
         WHERE entity_candidate_id = '${tamper.candidateId}';
        UPDATE public.kb_entity_candidate_draft_promotions
           SET resolution_manifest_hash = encode(
             sha256(convert_to(resolution_manifest::text, 'UTF8')),
             'hex'
           )
         WHERE entity_candidate_id = '${tamper.candidateId}';
      `);
      try {
        const invalid = await db.query<{
          manifest_hash_valid: boolean;
          promotion_valid: boolean;
          invalid_count: number;
          snapshot_count: number;
        }>(`
          SELECT
            promotion.resolution_manifest_hash = encode(
              sha256(convert_to(promotion.resolution_manifest::text, 'UTF8')),
              'hex'
            ) AS manifest_hash_valid,
            public.kb_entity_candidate_draft_promotion_is_valid('${tamper.candidateId}')
              AS promotion_valid,
            public.kb_invalid_entity_candidate_draft_promotion_count()::int
              AS invalid_count,
            (public.kb_export_wiki_snapshot() -> 'validation'
              ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
          FROM public.kb_entity_candidate_draft_promotions promotion
          WHERE promotion.entity_candidate_id = '${tamper.candidateId}'
        `);
        expect(invalid.rows[0].manifest_hash_valid).toBe(true);
        expect(invalid.rows[0].promotion_valid).toBe(false);
        expect(invalid.rows[0].invalid_count).toBeGreaterThan(0);
        expect(invalid.rows[0].snapshot_count).toBeGreaterThan(0);
      } finally {
        await db.exec("ROLLBACK;");
      }
    }
  });

  it("detects trigger-disabled staging and orphan-provenance tampering", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidate_names DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidate_names
         SET name = 'Tampered Synthetic Alias', normalized_name = 'tampered synthetic alias'
       WHERE entity_candidate_id = '${genericCandidateId}' AND name_order = 2;
    `);
    try {
      const invalid = await db.query<{
        direct_count: number;
        contract_count: number;
        snapshot_count: number;
      }>(`
        SELECT
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS direct_count,
          public.kb_invalid_entity_candidate_contract_count()::int AS contract_count,
          (public.kb_export_wiki_snapshot() -> 'validation'
            ->> 'invalid_entity_candidate_draft_promotions')::int AS snapshot_count
      `);
      expect(invalid.rows[0]).toEqual({
        direct_count: 1,
        contract_count: 1,
        snapshot_count: 1,
      });

      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '${adminId}';
        SAVEPOINT before_tampered_replay;
      `);
      await expect(promoteEntity(genericCandidateId)).rejects.toThrow(/integrity check/);
      await db.exec("ROLLBACK TO SAVEPOINT before_tampered_replay; RESET ROLE;");
    } finally {
      await db.exec("ROLLBACK; RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
    }

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidates DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidates
         SET proposed_data = '{"ignored":"trigger-disabled-payload-tamper"}'::jsonb
       WHERE id = '${genericCandidateId}';
    `);
    try {
      const proposedDataTamper = await db.query<{
        promotion_count: number;
        contract_count: number;
        stored_digest_matches: boolean;
      }>(`
        SELECT
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS promotion_count,
          public.kb_invalid_entity_candidate_contract_count()::int AS contract_count,
          promotion.discarded_proposed_data_hash = encode(
            sha256(convert_to(candidate.proposed_data::text, 'UTF8')),
            'hex'
          ) AS stored_digest_matches
        FROM public.kb_entity_candidate_draft_promotions promotion
        JOIN public.kb_entity_candidates candidate
          ON candidate.id = promotion.entity_candidate_id
        WHERE promotion.entity_candidate_id = '${genericCandidateId}'
      `);
      expect(proposedDataTamper.rows[0]).toEqual({
        promotion_count: 1,
        contract_count: 1,
        stored_digest_matches: false,
      });
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entities DISABLE TRIGGER USER;
      INSERT INTO public.kb_entities (
        id, entity_type_code, canonical_key, metadata
      ) VALUES (
        '20000000-0000-4000-8000-000000000398', 'plant', 'plant:orphan-import-provenance',
        '{"origin_type":"import","entity_candidate_id":"00000000-0000-4000-8000-000000000098"}'::jsonb
      );
    `);
    try {
      const orphan = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_entity_candidate_draft_promotion_count()::int AS count
      `);
      expect(orphan.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("blocks reserved provenance updates on every unmapped core row kind", async () => {
    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_entities
         SET metadata = metadata || jsonb_build_object(
           'entity_candidate_id', '00000000-0000-4000-8000-000000000071'
         )
       WHERE id = '${directProductId}';
    `, /cannot be added to unmapped rows/);
    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_entity_revisions
         SET metadata = metadata || jsonb_build_object(
           'entity_candidate_id', '00000000-0000-4000-8000-000000000072'
         )
       WHERE id = '${directProductRevisionId}';
    `, /cannot be added to unmapped rows/);
    await expectTransactionFailure(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000397',
        'assertion:unmapped-provenance-forgery', 1, 'classification',
        'Synthetic unmapped assertion.', repeat('7', 64)
      );
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      UPDATE public.kb_assertions
         SET metadata = metadata || jsonb_build_object(
           'entity_candidate_assertion_id', '00000000-0000-4000-8000-000000000073'
         )
       WHERE id = '40000000-0000-4000-8000-000000000397';
    `, /cannot be added to unmapped rows/);
    await expectTransactionFailure(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash, metadata
      ) VALUES (
        '40000000-0000-4000-8000-000000000396',
        'assertion:unmapped-entity-provenance-forgery', 1, 'classification',
        'Synthetic unmapped assertion entity provenance.', repeat('6', 64),
        '{"entity_candidate_id":"00000000-0000-4000-8000-000000000074"}'::jsonb
      );
    `, /requires the promotion function/);

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_assertions DISABLE TRIGGER USER;
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash, metadata
      ) VALUES (
        '40000000-0000-4000-8000-000000000395',
        'assertion:orphan-entity-provenance', 1, 'classification',
        'Synthetic trigger-disabled orphan assertion.', repeat('5', 64),
        '{"entity_candidate_id":"00000000-0000-4000-8000-000000000075"}'::jsonb
      );
    `);
    try {
      const orphan = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_entity_candidate_draft_promotion_count()::int AS count
      `);
      expect(orphan.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("fails closed when candidate and direct dependency entities are withdrawn", async () => {
    await db.exec(`
      BEGIN;
      UPDATE public.kb_entities SET lifecycle_status = 'withdrawn'
       WHERE id = '${componentPromotion.promoted_entity_id}';
    `);
    try {
      const candidateDependency = await db.query<{
        component_valid: boolean;
        owner_valid: boolean;
        invalid_count: number;
        contract_count: number;
      }>(`
        SELECT
          public.kb_entity_candidate_draft_promotion_is_valid('${componentCandidateId}')
            AS component_valid,
          public.kb_entity_candidate_draft_promotion_is_valid('${preparationCandidateId}')
            AS owner_valid,
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS invalid_count,
          public.kb_invalid_entity_candidate_contract_count()::int AS contract_count
      `);
      expect(candidateDependency.rows[0]).toEqual({
        component_valid: true,
        owner_valid: false,
        invalid_count: 1,
        contract_count: 0,
      });
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(`
      BEGIN;
      UPDATE public.kb_entities SET lifecycle_status = 'withdrawn'
       WHERE id = '${directProductId}';
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${adminId}';
    `);
    try {
      const directDependency = await db.query<{
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
      }>(`
        SELECT ready_for_promotion, blocking_reason_codes
          FROM public.kb_entity_candidate_promotion_readiness('${variantCandidateId}')
      `);
      expect(directDependency.rows[0]).toEqual({
        ready_for_promotion: false,
        blocking_reason_codes: ["EXISTING_PROMOTION_INVALID"],
      });
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
      const invalid = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_entity_candidate_draft_promotion_count()::int AS count
      `);
      expect(invalid.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK; RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
    }
  });

  it("returns false for a trigger-disabled candidate cycle without recursive overflow", async () => {
    const selfReferenceConstraint = await db.query<{ conname: string }>(`
      SELECT constraint_row.conname
        FROM pg_constraint constraint_row
       WHERE constraint_row.conrelid = 'public.kb_entity_candidate_components'::regclass
         AND constraint_row.contype = 'c'
         AND pg_get_constraintdef(constraint_row.oid)
             LIKE '%component_candidate_id <> entity_candidate_id%'
    `);
    expect(selfReferenceConstraint.rows).toHaveLength(1);
    const constraintName = selfReferenceConstraint.rows[0].conname.replace(/"/g, '""');

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_entity_candidate_components
        DROP CONSTRAINT "${constraintName}";
      ALTER TABLE public.kb_entity_candidate_components DISABLE TRIGGER USER;
      ALTER TABLE public.kb_entity_candidate_draft_promotions DISABLE TRIGGER USER;
      UPDATE public.kb_entity_candidate_components
         SET component_candidate_id = '${preparationCandidateId}'
       WHERE entity_candidate_id = '${preparationCandidateId}'
         AND component_order = 1;
      UPDATE public.kb_entity_candidate_draft_promotions
         SET input_manifest = public.kb_entity_candidate_canonical_jsonb_v1(
               public.kb_entity_candidate_draft_promotion_input_manifest(entity_candidate_id)
             ),
             candidate_owned_hash =
               public.kb_entity_candidate_draft_promotion_candidate_owned_hash(entity_candidate_id)
       WHERE entity_candidate_id = '${preparationCandidateId}';
      UPDATE public.kb_entity_candidate_draft_promotions
         SET input_manifest_hash = encode(
           sha256(convert_to(
             public.kb_entity_candidate_canonical_jsonb_v1(input_manifest)::text,
             'UTF8'
           )),
           'hex'
         )
       WHERE entity_candidate_id = '${preparationCandidateId}';
      UPDATE public.kb_entity_candidate_draft_promotions preparation_promotion
         SET resolution_manifest = jsonb_set(
           preparation_promotion.resolution_manifest,
           '{entity_dependencies}',
           jsonb_build_array(jsonb_build_object(
             'reference_role', 'component',
             'reference_order', 1,
             'reference_kind', 'candidate',
             'entity_candidate_id', '${preparationCandidateId}'::uuid,
             'entity_id', preparation_promotion.entity_id,
             'entity_revision_id', preparation_promotion.entity_revision_id,
             'frozen_revision_content_hash', preparation_revision.content_hash
           ))
         )
        FROM public.kb_entity_revisions preparation_revision
       WHERE preparation_promotion.entity_candidate_id = '${preparationCandidateId}'
         AND preparation_revision.id = preparation_promotion.entity_revision_id;
      UPDATE public.kb_entity_candidate_draft_promotions
         SET resolution_manifest_hash = encode(
           sha256(convert_to(resolution_manifest::text, 'UTF8')),
           'hex'
         )
       WHERE entity_candidate_id = '${preparationCandidateId}';
    `);
    try {
      const cyclic = await db.query<{
        component_valid: boolean;
        preparation_valid: boolean;
        invalid_count: number;
      }>(`
        SELECT
          public.kb_entity_candidate_draft_promotion_is_valid('${componentCandidateId}')
            AS component_valid,
          public.kb_entity_candidate_draft_promotion_is_valid('${preparationCandidateId}')
            AS preparation_valid,
          public.kb_invalid_entity_candidate_draft_promotion_count()::int AS invalid_count
      `);
      expect(cyclic.rows[0]).toEqual({
        component_valid: true,
        preparation_valid: false,
        invalid_count: 1,
      });
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("leaves the patient snapshot sentinel byte-identical", async () => {
    const patientSentinel = await db.query<{
      snapshot_text: string;
      row_count: number;
    }>(`
      SELECT snapshot::text AS snapshot_text,
             (SELECT count(*)::int FROM public.patient_snapshot) AS row_count
        FROM public.patient_snapshot
       WHERE pseudonym_id = 'immutable-patient-sentinel'
    `);
    expect(patientSentinel.rows[0]).toEqual({
      snapshot_text: patientSnapshotBefore,
      row_count: 1,
    });

    const exported = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        manifest: Record<string, { rows: number; sha256: string }>;
      };
    }>("SELECT public.kb_export_wiki_snapshot() AS value");
    for (const table of wikiSnapshotTables) {
      expect(JSON.stringify(exported.rows[0].value.tables[table])).not.toContain(patientMarker);
      expect(JSON.stringify(exported.rows[0].value.manifest[table])).not.toContain(patientMarker);
    }
  });

  it("enforces admin-only invocation, admin RLS, and read-only service access", async () => {
    const tablePrivilegeMatrix = await db.query<{
      table_name: string;
      role_name: string;
      privilege_name: string;
      allowed: boolean;
    }>(`
      SELECT listed_table.table_name,
             listed_role.role_name,
             listed_privilege.privilege_name,
             has_table_privilege(
               listed_role.role_name,
               'public.' || listed_table.table_name,
               listed_privilege.privilege_name
             ) AS allowed
        FROM unnest(ARRAY[
          'kb_entity_candidate_draft_promotions',
          'kb_entity_candidate_draft_promotion_assertions'
        ]::text[]) listed_table(table_name)
        CROSS JOIN unnest(ARRAY[
          'authenticated', 'service_role', 'anon',
          'kb_importer', 'kb_import_runtime'
        ]::text[]) listed_role(role_name)
        CROSS JOIN unnest(ARRAY[
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'
        ]::text[]) listed_privilege(privilege_name)
       ORDER BY listed_table.table_name, listed_role.role_name,
                listed_privilege.privilege_name
    `);
    expect(tablePrivilegeMatrix.rows).toHaveLength(50);
    expect(tablePrivilegeMatrix.rows
      .filter((privilege) => privilege.allowed)
      .map((privilege) => (
        `${privilege.table_name}:${privilege.role_name}:${privilege.privilege_name}`
      ))
      .sort()).toEqual([
      "kb_entity_candidate_draft_promotion_assertions:authenticated:SELECT",
      "kb_entity_candidate_draft_promotion_assertions:service_role:SELECT",
      "kb_entity_candidate_draft_promotions:authenticated:SELECT",
      "kb_entity_candidate_draft_promotions:service_role:SELECT",
    ].sort());

    const privileges = await db.query<{
      authenticated_select: boolean;
      authenticated_insert: boolean;
      service_select: boolean;
      service_update: boolean;
      importer_select: boolean;
      runtime_select: boolean;
      authenticated_assertion_select: boolean;
      authenticated_assertion_insert: boolean;
      service_assertion_select: boolean;
      service_assertion_update: boolean;
      importer_assertion_select: boolean;
      runtime_assertion_select: boolean;
      authenticated_promote: boolean;
      authenticated_readiness: boolean;
      authenticated_validity: boolean;
      authenticated_counter: boolean;
      service_promote: boolean;
      importer_promote: boolean;
      runtime_promote: boolean;
      anon_promote: boolean;
    }>(`
      SELECT
        has_table_privilege('authenticated', 'public.kb_entity_candidate_draft_promotions', 'SELECT')
          AS authenticated_select,
        has_table_privilege('authenticated', 'public.kb_entity_candidate_draft_promotions', 'INSERT')
          AS authenticated_insert,
        has_table_privilege('service_role', 'public.kb_entity_candidate_draft_promotions', 'SELECT')
          AS service_select,
        has_table_privilege('service_role', 'public.kb_entity_candidate_draft_promotions', 'UPDATE')
          AS service_update,
        has_table_privilege('kb_importer', 'public.kb_entity_candidate_draft_promotions', 'SELECT')
          AS importer_select,
        has_table_privilege('kb_import_runtime', 'public.kb_entity_candidate_draft_promotions', 'SELECT')
          AS runtime_select,
        has_table_privilege(
          'authenticated',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'SELECT'
        ) AS authenticated_assertion_select,
        has_table_privilege(
          'authenticated',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'INSERT'
        ) AS authenticated_assertion_insert,
        has_table_privilege(
          'service_role',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'SELECT'
        ) AS service_assertion_select,
        has_table_privilege(
          'service_role',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'UPDATE'
        ) AS service_assertion_update,
        has_table_privilege(
          'kb_importer',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'SELECT'
        ) AS importer_assertion_select,
        has_table_privilege(
          'kb_import_runtime',
          'public.kb_entity_candidate_draft_promotion_assertions',
          'SELECT'
        ) AS runtime_assertion_select,
        has_function_privilege('authenticated', 'public.kb_promote_entity_candidate_to_draft(uuid)', 'EXECUTE')
          AS authenticated_promote,
        has_function_privilege('authenticated', 'public.kb_entity_candidate_promotion_readiness(uuid)', 'EXECUTE')
          AS authenticated_readiness,
        has_function_privilege('authenticated', 'public.kb_entity_candidate_draft_promotion_is_valid(uuid)', 'EXECUTE')
          AS authenticated_validity,
        has_function_privilege('authenticated', 'public.kb_invalid_entity_candidate_draft_promotion_count()', 'EXECUTE')
          AS authenticated_counter,
        has_function_privilege('service_role', 'public.kb_promote_entity_candidate_to_draft(uuid)', 'EXECUTE')
          AS service_promote,
        has_function_privilege('kb_importer', 'public.kb_promote_entity_candidate_to_draft(uuid)', 'EXECUTE')
          AS importer_promote,
        has_function_privilege('kb_import_runtime', 'public.kb_promote_entity_candidate_to_draft(uuid)', 'EXECUTE')
          AS runtime_promote,
        has_function_privilege('anon', 'public.kb_promote_entity_candidate_to_draft(uuid)', 'EXECUTE')
          AS anon_promote
    `);
    expect(privileges.rows[0]).toEqual({
      authenticated_select: true,
      authenticated_insert: false,
      service_select: true,
      service_update: false,
      importer_select: false,
      runtime_select: false,
      authenticated_assertion_select: true,
      authenticated_assertion_insert: false,
      service_assertion_select: true,
      service_assertion_update: false,
      importer_assertion_select: false,
      runtime_assertion_select: false,
      authenticated_promote: true,
      authenticated_readiness: true,
      authenticated_validity: false,
      authenticated_counter: false,
      service_promote: false,
      importer_promote: false,
      runtime_promote: false,
      anon_promote: false,
    });

    await enterRole("authenticated", patientId);
    try {
      const hidden = await db.query<{ parents: number; assertions: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.kb_entity_candidate_draft_promotions) AS parents,
          (SELECT count(*)::int FROM public.kb_entity_candidate_draft_promotion_assertions)
            AS assertions
      `);
      expect(hidden.rows[0]).toEqual({ parents: 0, assertions: 0 });
      await expect(promoteEntity(genericCandidateId)).rejects.toThrow(/Only administrators/);
      await expect(db.query(
        "SELECT * FROM public.kb_entity_candidate_promotion_readiness($1::uuid)",
        [genericCandidateId],
      )).rejects.toThrow(/Only administrators/);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_draft_promotions (
          entity_candidate_id, batch_id, review_decision_id, entity_id, entity_revision_id,
          contract_hash, input_manifest, input_manifest_hash, candidate_owned_hash,
          resolution_manifest, resolution_manifest_hash, initial_content_hash, promoted_by
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
          repeat('0', 64), '{}'::jsonb, repeat('0', 64), repeat('0', 64),
          '{}'::jsonb, repeat('0', 64), repeat('0', 64), '${patientId}'
        );
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      const visible = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_draft_promotions
      `);
      expect(visible.rows[0].count).toBe(7);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      const readable = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_draft_promotions
      `);
      expect(readable.rows[0].count).toBe(7);
      const readableMappings = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM public.kb_entity_candidate_draft_promotion_assertions
      `);
      expect(readableMappings.rows[0].count).toBeGreaterThan(0);
      await expect(promoteEntity(genericCandidateId)).rejects.toThrow(/permission denied/);
      await expect(db.exec("TRUNCATE public.kb_entity_candidate_draft_promotions"))
        .rejects.toThrow(/permission denied/);
      await expect(db.exec(
        "TRUNCATE public.kb_entity_candidate_draft_promotion_assertions",
      )).rejects.toThrow(/permission denied/);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        await expect(db.query("SELECT * FROM public.kb_entity_candidate_draft_promotions"))
          .rejects.toThrow(/permission denied/);
        await expect(db.query(
          "SELECT * FROM public.kb_entity_candidate_draft_promotion_assertions",
        )).rejects.toThrow(/permission denied/);
        await expect(promoteEntity(genericCandidateId)).rejects.toThrow(/permission denied/);
      } finally {
        await leaveRole();
      }
    }
  });

  it("writes no relations, dosages or safety records", async () => {
    const excluded = await db.query<{
      relations: number;
      relation_assertions: number;
      dosage_candidates: number;
      safety_candidates: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_entity_relations) AS relations,
        (SELECT count(*)::int FROM public.kb_assertions
          WHERE assertion_kind IN ('entity_relation', 'dosage', 'safety')) AS relation_assertions,
        (SELECT count(*)::int FROM public.kb_dosage_candidates) AS dosage_candidates,
        (SELECT count(*)::int FROM public.kb_safety_candidates) AS safety_candidates
    `);
    expect(excluded.rows[0]).toEqual({
      relations: 0,
      relation_assertions: 0,
      dosage_candidates: 0,
      safety_candidates: 0,
    });
  });

  it("exports and transactionally restores exactly 50 tables with equal manifests", async () => {
    expect(new Set(wikiSnapshotTables).size).toBe(wikiSnapshotTables.length);
    expect(new Set(wikiRestoreOrder).size).toBe(wikiRestoreOrder.length);
    expect(new Set(wikiRestoreOrder)).toEqual(new Set(wikiSnapshotTables));

    const snapshot = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>("SELECT public.kb_export_wiki_snapshot() AS value");
    const original = snapshot.rows[0].value;
    const expectedTables = [...wikiSnapshotTables].sort();
    expect(Object.keys(original.tables).sort()).toEqual(expectedTables);
    expect(Object.keys(original.manifest).sort()).toEqual(expectedTables);
    expect(expectedTables).toHaveLength(50);
    expect(original.validation).toEqual(expect.objectContaining({
      missing_articles: 0,
      invalid_current_snapshots: 0,
      orphaned_active_articles: 0,
      invalid_source_promotions: 0,
      invalid_therapeutic_catalog_revisions: 0,
      invalid_entity_candidate_contracts: 0,
      invalid_entity_candidate_draft_promotions: 0,
    }));
    for (const table of promotionTables) {
      expect(original.manifest[table].rows).toBeGreaterThan(0);
      expect(original.manifest[table].sha256).toMatch(/^[0-9a-f]{64}$/);
    }

    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }
      await db.exec(
        `TRUNCATE TABLE ${wikiSnapshotTables.map((table) => `public.${table}`).join(", ")};`,
      );
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table}
           SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [JSON.stringify(original.tables[table])],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }

      const restored = await db.query<{
        value: {
          manifest: Record<string, { rows: number; sha256: string }>;
          validation: Record<string, number>;
        };
      }>("SELECT public.kb_export_wiki_snapshot() AS value");
      expect(restored.rows[0].value.validation).toEqual(expect.objectContaining({
        missing_articles: 0,
        invalid_current_snapshots: 0,
        orphaned_active_articles: 0,
        invalid_source_promotions: 0,
        invalid_therapeutic_catalog_revisions: 0,
        invalid_entity_candidate_contracts: 0,
        invalid_entity_candidate_draft_promotions: 0,
      }));
      expect(restored.rows[0].value.manifest).toEqual(original.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  }, 20_000);
});
