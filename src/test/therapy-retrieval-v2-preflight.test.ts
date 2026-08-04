// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prerequisiteMigrationFiles = [
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
  "20260803100000_create_kb_homeopathic_reader_contract.sql",
  "20260803110000_create_kb_homeopathic_import_preflight_contract.sql",
  "20260803120000_create_kb_homeopathic_small_bundle_writer.sql",
  "20260803130000_create_kb_homeopathic_chunk_import_contract.sql",
] as const;
const prerequisiteMigrations = prerequisiteMigrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const migrationFile = "20260804090000_create_therapy_retrieval_v2_preflight.sql";
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", migrationFile),
  "utf8",
);
const entityResolutionMigrationFile =
  "20260804100000_create_therapy_entity_resolution_preflight.sql";
const entityResolutionMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", entityResolutionMigrationFile),
  "utf8",
);

const adminId = "11000000-0000-4000-8000-000000000001";
const patientId = "11000000-0000-4000-8000-000000000002";
const reviewerId = "11000000-0000-4000-8000-000000000003";
const inputRevisionId = "91000000-0000-4000-8000-000000000001";
const inputSourceId = "92000000-0000-4000-8000-000000000001";
const predecessorFactId = "93000000-0000-4000-8000-000000000001";
const successorFactId = "93000000-0000-4000-8000-000000000002";
const reviewOnlyFactId = "93000000-0000-4000-8000-000000000003";
const unreviewedFactId = "93000000-0000-4000-8000-000000000004";
const rejectedFactId = "93000000-0000-4000-8000-000000000005";
const knowledgeSourceId = "21000000-0000-4000-8000-000000000001";
const knowledgeSourceRevisionId = "22000000-0000-4000-8000-000000000001";
const diseaseEntityId = "31000000-0000-4000-8000-000000000001";
const diseaseEntityRevisionId = "32000000-0000-4000-8000-000000000001";
const plantEntityId = "31000000-0000-4000-8000-000000000002";
const plantEntityRevisionId = "32000000-0000-4000-8000-000000000002";
const outsideEntityId = "31000000-0000-4000-8000-000000000003";
const outsideEntityRevisionId = "32000000-0000-4000-8000-000000000003";
const relationAssertionId = "41000000-0000-4000-8000-000000000001";
const knowledgeReleaseId = "61000000-0000-4000-8000-000000000001";
const unknownInputRevisionId = "91000000-0000-4000-8000-000000000099";
const unknownReleaseId = "61000000-0000-4000-8000-000000000099";
const extractedAt = "2026-08-04T08:10:00.000000Z";
const reviewedAt = "2026-08-04T08:20:00.000000Z";

const sourcePayload = {
  format: "text",
  text: "Synthetic clinical source",
  language: "en",
};
const inputEnvelope = {
  format: "therapy_input_envelope_v1",
  clinical_text: "Synthetic deidentified input",
  context: {},
};
const neutralSourceId = "manual_input:artifact:abcdef123456";
const sourceLocator = "section:input";

type FactFixture = {
  id: string;
  order: number;
  type: string;
  key: string;
  label: string;
  value: Record<string, unknown>;
  reviewStatus: "unreviewed" | "review_only" | "verified" | "rejected";
  kbEntityId: string | null;
  supersedesFactId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type InputManifest = {
  contract_version: number;
  contract_scope: string;
  data_classification: string;
  complete_fact_set_hash: string;
  fact_selection_policy: {
    policy_version: number;
    accepted_review_statuses: string[];
    terminal_facts_only: boolean;
  };
  fact_counts: {
    total: number;
    terminal: number;
    superseded: number;
    selected: number;
    verified: number;
    review_only: number;
    excluded_unreviewed: number;
    excluded_rejected: number;
  };
  selected_facts: Array<{
    fact_id: string;
    fact_order: number;
    review_status: string;
    content_sha256: string;
  }>;
};

type PreflightResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  therapy_input_revision_id?: string;
  therapy_input_manifest_hash?: string;
  knowledge_release_id?: string;
  release_manifest_hash?: string;
  therapy_input_hash_matches?: boolean;
  release_manifest_hash_matches?: boolean;
  selected_fact_count?: number;
  review_only_fact_count?: number;
  requires_fact_review?: boolean;
  actual_therapy_input_hash?: string;
  actual_release_manifest_hash?: string;
  binding_hash?: string;
  result_hash: string;
  input_manifest?: InputManifest;
};

type EntityQueryManifest = {
  contract_version: number;
  contract_scope: string;
  selected_fact_count: number;
  input_manifest_hash: string;
  facts: Array<{
    fact_id: string;
    fact_order: number;
    kb_entity_id: string | null;
    query_terms: string[];
    identifier_terms: string[];
    query_hash: string;
  }>;
};

type DirectEntityCandidate = {
  position: number;
  candidate_status: string;
  entity_id: string;
  entity_revision_id: string;
  best_match_channel: string;
  matched_channels: string[];
};

type GraphEntityCandidate = {
  position: number;
  candidate_status: string;
  source_entity_id: string;
  relation_type_code: string;
  graph_direction: string;
  entity_id: string;
  entity_revision_id: string;
};

type EntityResolutionFact = {
  fact_id: string;
  direct_candidate_count_before_limit: number;
  returned_direct_candidate_count: number;
  direct_candidates: DirectEntityCandidate[];
  graph_candidate_count_before_limit: number;
  returned_graph_candidate_count: number;
  graph_candidates: GraphEntityCandidate[];
};

type EntityResolutionResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  binding_hash?: string;
  query_manifest_hash?: string;
  selected_fact_count?: number;
  direct_candidate_count_before_limit?: number;
  returned_direct_candidate_count?: number;
  graph_candidate_count_before_limit?: number;
  returned_graph_candidate_count?: number;
  facts?: EntityResolutionFact[];
  result_hash: string;
};

let db: PGlite;
let sourceHash = "";
let inputRevisionHash = "";
let expectedInputHash = "";
let expectedReleaseManifestHash = "";
let inputManifest: InputManifest;
let successfulPreflight: PreflightResult;
let wikiSnapshotBefore = "";
let wikiSnapshotAfter = "";
let therapySnapshotBefore = "";
let therapySnapshotAfter = "";
let wikiSnapshotAfterEntityResolution = "";
let therapySnapshotAfterEntityResolution = "";
let entityQueryManifest: EntityQueryManifest;
let successfulEntityResolution: EntityResolutionResult;

async function bootstrapDatabase(): Promise<void> {
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
}

async function hashJson(value: unknown): Promise<string> {
  const result = await db.query<{ hash: string }>(
    "SELECT public.therapy_input_jsonb_sha256_v1($1::jsonb) AS hash",
    [JSON.stringify(value)],
  );
  return result.rows[0].hash;
}

async function insertInputRevision(): Promise<void> {
  sourceHash = await hashJson({
    hash_schema_version: 1,
    source_order: 1,
    neutral_source_id: neutralSourceId,
    source_type: "manual_input",
    document_date: "2026-08-04",
    source_locator: sourceLocator,
    source_payload: sourcePayload,
  });
  inputRevisionHash = await hashJson({
    envelope_schema_version: 1,
    hash_schema_version: 1,
    deidentification_version: "clinical-deidentification-v1",
    data_classification: "pseudonymized_health_data",
    pseudonym_id: "P-2026-6001",
    input_envelope: inputEnvelope,
    source_count: 1,
    sources: [{
      source_order: 1,
      neutral_source_id: neutralSourceId,
      source_type: "manual_input",
      document_date: "2026-08-04",
      source_locator: sourceLocator,
      content_sha256: sourceHash,
    }],
  });

  await db.exec("BEGIN;");
  try {
    await db.query(`
      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, input_envelope, source_count, content_sha256,
        captured_at, captured_by
      ) VALUES (
        $1, 'P-2026-6001', $2::jsonb, 1, $3,
        '2026-08-04T08:00:00Z', $4
      )
    `, [inputRevisionId, JSON.stringify(inputEnvelope), inputRevisionHash, adminId]);
    await db.query(`
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, document_date, source_locator, source_payload, content_sha256
      ) VALUES ($1, $2, 1, $3, 'manual_input', '2026-08-04', $4, $5::jsonb, $6)
    `, [
      inputSourceId,
      inputRevisionId,
      neutralSourceId,
      sourceLocator,
      JSON.stringify(sourcePayload),
      sourceHash,
    ]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function insertFact(fact: FactFixture): Promise<void> {
  const factLocator = `field:fact_${fact.order}`;
  const contentHash = await hashJson({
    therapy_input_revision_id: inputRevisionId,
    therapy_input_revision_sha256: inputRevisionHash,
    envelope_schema_version: 1,
    revision_hash_schema_version: 1,
    deidentification_version: "clinical-deidentification-v1",
    fact_schema_version: 1,
    hash_schema_version: 1,
    fact_id: fact.id,
    fact_order: fact.order,
    fact_type: fact.type,
    fact_key: fact.key,
    fact_label: fact.label,
    fact_value: fact.value,
    is_negated: false,
    clinical_status: "current",
    certainty: "confirmed",
    extraction_confidence: "high",
    extraction_method: "manual",
    review_status: fact.reviewStatus,
    evidence_scope: "patient_report",
    effective_start_date: null,
    effective_end_date: null,
    effective_date_precision: "unknown",
    kb_entity_id: fact.kbEntityId,
    source_count: 1,
    supersedes_fact_id: fact.supersedesFactId,
    extracted_at: extractedAt,
    extracted_by: adminId,
    reviewed_at: fact.reviewedAt,
    reviewed_by: fact.reviewedBy,
    sources: [{
      link_order: 1,
      source_order: 1,
      neutral_source_id: neutralSourceId,
      source_type: "manual_input",
      document_date: "2026-08-04",
      source_locator: sourceLocator,
      fact_locator: factLocator,
      content_sha256: sourceHash,
      source_role: "primary",
    }],
  });

  await db.exec("BEGIN;");
  try {
    await db.query(`
      INSERT INTO public.therapy_input_facts (
        id, therapy_input_revision_id, fact_order, fact_type, fact_key,
        fact_label, fact_value, is_negated, clinical_status, certainty,
        extraction_confidence, extraction_method, review_status, evidence_scope,
        effective_date_precision, kb_entity_id, source_count, supersedes_fact_id,
        extracted_at, extracted_by, reviewed_at, reviewed_by, content_sha256
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, false, 'current', 'confirmed',
        'high', 'manual', $8, 'patient_report', 'unknown', $9, 1, $10,
        $11, $12, $13, $14, $15
      )
    `, [
      fact.id,
      inputRevisionId,
      fact.order,
      fact.type,
      fact.key,
      fact.label,
      JSON.stringify(fact.value),
      fact.reviewStatus,
      fact.kbEntityId,
      fact.supersedesFactId,
      extractedAt,
      adminId,
      fact.reviewedAt,
      fact.reviewedBy,
      contentHash,
    ]);
    await db.query(`
      INSERT INTO public.therapy_input_fact_sources (
        therapy_input_revision_id, therapy_input_fact_id, link_order,
        source_order, fact_locator, source_role
      ) VALUES ($1, $2, 1, 1, $3, 'primary')
    `, [inputRevisionId, fact.id, factLocator]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function insertInputFacts(): Promise<void> {
  await insertFact({
    id: predecessorFactId,
    order: 1,
    type: "condition",
    key: "condition.synthetic_contract",
    label: "Synthetic contract condition",
    value: { type: "boolean", value: true },
    reviewStatus: "verified",
    kbEntityId: diseaseEntityId,
    supersedesFactId: null,
    reviewedAt,
    reviewedBy: reviewerId,
  });
  await insertFact({
    id: successorFactId,
    order: 2,
    type: "condition",
    key: "condition.synthetic_contract",
    label: "Synthetic contract condition",
    value: {
      type: "coded",
      system: "icd_10_gm",
      code: "R53",
      display: "Synthetic coded disease",
    },
    reviewStatus: "verified",
    kbEntityId: null,
    supersedesFactId: predecessorFactId,
    reviewedAt,
    reviewedBy: reviewerId,
  });
  await insertFact({
    id: reviewOnlyFactId,
    order: 3,
    type: "open_question",
    key: "open_question.synthetic_review",
    label: "Synthetic review question",
    value: { type: "none" },
    reviewStatus: "review_only",
    kbEntityId: plantEntityId,
    supersedesFactId: null,
    reviewedAt: null,
    reviewedBy: null,
  });
  await insertFact({
    id: unreviewedFactId,
    order: 4,
    type: "symptom",
    key: "symptom.synthetic_unreviewed",
    label: "Synthetic unreviewed symptom",
    value: { type: "text", value: "Synthetic unreviewed value" },
    reviewStatus: "unreviewed",
    kbEntityId: null,
    supersedesFactId: null,
    reviewedAt: null,
    reviewedBy: null,
  });
  await insertFact({
    id: rejectedFactId,
    order: 5,
    type: "symptom",
    key: "symptom.synthetic_rejected",
    label: "Synthetic rejected symptom",
    value: { type: "text", value: "Synthetic rejected value" },
    reviewStatus: "rejected",
    kbEntityId: null,
    supersedesFactId: null,
    reviewedAt,
    reviewedBy: reviewerId,
  });
}

async function releaseKnowledgeRevision(
  table: "kb_source_revisions" | "kb_entity_revisions" | "kb_assertions",
  id: string,
  safetyReview: boolean,
): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (safetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved', reviewed_at = '2026-08-04T08:30:00Z',
           reviewed_by = $2
     WHERE id = $1
  `, [id, reviewerId]);
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'released', released_at = '2026-08-04T08:40:00Z'
     WHERE id = $1
  `, [id]);
}

type ReleaseItemReference = {
  kind: "entity_revision" | "assertion" | "source_revision";
  entityId?: string;
  entityRevisionId?: string;
  assertionId?: string;
  sourceId?: string;
  sourceRevisionId?: string;
};

async function addReleaseItem(
  itemOrder: number,
  reference: ReleaseItemReference,
): Promise<void> {
  await db.query(`
    WITH manifest AS (
      SELECT public.kb_release_item_manifest_v1(
        $4::uuid, $5::uuid, NULL, NULL, $6::uuid, $7::uuid, $8::uuid
      ) AS value
    )
    INSERT INTO public.kb_release_items (
      release_id, item_order, item_kind, entity_id, entity_revision_id,
      assertion_id, source_id, source_revision_id, item_manifest, item_manifest_hash
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8,
           value, public.kb_release_manifest_hash_v1(value)
      FROM manifest
  `, [
    knowledgeReleaseId,
    itemOrder,
    reference.kind,
    reference.entityId ?? null,
    reference.entityRevisionId ?? null,
    reference.assertionId ?? null,
    reference.sourceId ?? null,
    reference.sourceRevisionId ?? null,
  ]);
}

async function insertSealedKnowledgeRelease(): Promise<void> {
  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${knowledgeSourceId}', 'source:retrieval-v2-preflight');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${knowledgeSourceRevisionId}', '${knowledgeSourceId}', 1,
      'practice_rule', 'Synthetic preflight source', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${knowledgeSourceRevisionId}'
     WHERE id = '${knowledgeSourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${diseaseEntityId}', 'disease', 'disease:retrieval-v2-synthetic'),
      ('${plantEntityId}', 'plant', 'plant:retrieval-v2-synthetic'),
      ('${outsideEntityId}', 'symptom', 'symptom:outside-release-synthetic');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${diseaseEntityRevisionId}', '${diseaseEntityId}', 1,
       'Synthetic coded disease', 'Synthetic contract condition summary',
       'Full text marker for the synthetic contract condition.', repeat('2', 64)),
      ('${plantEntityRevisionId}', '${plantEntityId}', 1,
       'Synthetic support plant', 'Synthetic review question summary',
       'Full text marker for the synthetic review question.', repeat('3', 64)),
      ('${outsideEntityRevisionId}', '${outsideEntityId}', 1,
       'Synthetic outside-release symptom', 'Not part of the bound release.',
       'Explicit-link fail-closed fixture.', repeat('5', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${diseaseEntityId}', '${plantEntityId}', '${outsideEntityId}');
    INSERT INTO public.kb_entity_names (
      entity_id, name, normalized_name, name_kind, language_code, is_preferred
    ) VALUES
      ('${diseaseEntityId}', 'Synthetic coded disease',
       'synthetic coded disease', 'preferred', 'en', true),
      ('${diseaseEntityId}', 'Synthetic contract condition',
       'synthetic contract condition', 'spelling_variant', 'en', false),
      ('${plantEntityId}', 'Synthetic support plant',
       'synthetic support plant', 'preferred', 'en', true),
      ('${plantEntityId}', 'Synthetic review question',
       'synthetic review question', 'spelling_variant', 'en', false),
      ('${outsideEntityId}', 'Synthetic outside-release symptom',
       'synthetic outside-release symptom', 'preferred', 'en', true);
    INSERT INTO public.kb_entity_identifiers (
      entity_id, scheme_code, value, normalized_value, is_primary
    ) VALUES ('${diseaseEntityId}', 'icd_10_gm', 'R53', 'R53', true);

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text, content_hash
    ) VALUES (
      '${relationAssertionId}', 'assertion:retrieval-v2-synthetic-relation', 1,
      'entity_relation', 'Synthetic plant relation for contract testing.',
      repeat('4', 64)
    );
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES (
      '${relationAssertionId}', '${knowledgeSourceRevisionId}',
      'supports', 'section:synthetic', true
    );
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id,
      assignment_strength, rank, context_text
    ) VALUES (
      '${relationAssertionId}', '${plantEntityId}', 'may_support',
      '${diseaseEntityId}', 'possible', 40, 'Synthetic graph edge only.'
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
  await releaseKnowledgeRevision("kb_source_revisions", knowledgeSourceRevisionId, false);
  await releaseKnowledgeRevision("kb_entity_revisions", diseaseEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_entity_revisions", plantEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_entity_revisions", outsideEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_assertions", relationAssertionId, true);

  await db.exec("BEGIN;");
  try {
    await db.query(`
      WITH release_input AS (
        SELECT $1::uuid AS id, 'release:retrieval-v2-preflight'::text AS release_key
      ), manifest AS (
        SELECT release_input.*,
               public.kb_release_manifest_v1(id, release_key) AS value
          FROM release_input
      )
      INSERT INTO public.kb_releases (
        id, release_key, release_manifest, release_manifest_hash
      )
      SELECT id, release_key, value, public.kb_release_manifest_hash_v1(value)
        FROM manifest
    `, [knowledgeReleaseId]);
    await addReleaseItem(1, {
      kind: "source_revision",
      sourceId: knowledgeSourceId,
      sourceRevisionId: knowledgeSourceRevisionId,
    });
    await addReleaseItem(2, {
      kind: "entity_revision",
      entityId: diseaseEntityId,
      entityRevisionId: diseaseEntityRevisionId,
    });
    await addReleaseItem(3, {
      kind: "entity_revision",
      entityId: plantEntityId,
      entityRevisionId: plantEntityRevisionId,
    });
    await addReleaseItem(4, {
      kind: "assertion",
      assertionId: relationAssertionId,
    });
    await db.query(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed',
             sealed_at = '2026-08-04T08:50:00Z'
       WHERE release.id = $1
    `, [knowledgeReleaseId]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
  await db.query(`
    INSERT INTO public.kb_search_documents (release_id, release_item_id)
    SELECT item.release_id, item.id
      FROM public.kb_release_items item
     WHERE item.release_id = $1
       AND item.item_kind = 'entity_revision'
     ORDER BY item.item_order
  `, [knowledgeReleaseId]);
  expectedReleaseManifestHash = (await db.query<{ hash: string }>(`
    SELECT release_manifest_hash AS hash FROM public.kb_releases WHERE id = $1
  `, [knowledgeReleaseId])).rows[0].hash;
}

async function readPreflight(
  expectedInput: string | null = expectedInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  revisionId: string | null = inputRevisionId,
  releaseId: string | null = knowledgeReleaseId,
): Promise<PreflightResult> {
  return (await db.query<{ value: PreflightResult }>(`
    SELECT public.therapy_retrieval_v2_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text
    ) AS value
  `, [revisionId, expectedInput, releaseId, expectedRelease])).rows[0].value;
}

async function readEntityResolution(
  expectedInput: string | null = expectedInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  directLimit: number | null = 8,
  graphLimit: number | null = 16,
): Promise<EntityResolutionResult> {
  return (await db.query<{ value: EntityResolutionResult }>(`
    SELECT public.therapy_retrieval_v2_entity_resolution_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::integer, $6::integer
    ) AS value
  `, [
    inputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    directLimit,
    graphLimit,
  ])).rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase();
  for (const prerequisiteMigration of prerequisiteMigrations) {
    await db.exec(prerequisiteMigration);
  }
  await insertSealedKnowledgeRelease();
  await insertInputRevision();
  await insertInputFacts();

  wikiSnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;

  await db.exec(migration);

  wikiSnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  inputManifest = (await db.query<{ value: InputManifest }>(`
    SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  expectedInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  successfulPreflight = await readPreflight();

  await db.exec(entityResolutionMigration);
  wikiSnapshotAfterEntityResolution = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterEntityResolution = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  entityQueryManifest = (await db.query<{ value: EntityQueryManifest }>(`
    SELECT public.therapy_retrieval_v2_entity_query_manifest_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  successfulEntityResolution = await readEntityResolution();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("therapy retrieval v2 Step 6A and 6B preflights", () => {
  it("adds only four closed read functions and changes no snapshot", async () => {
    expect(migration.match(/CREATE FUNCTION public\./g)).toHaveLength(4);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toMatch(/CREATE TABLE|ALTER TABLE|INSERT INTO|GRANT EXECUTE/);
    expect(migration).not.toMatch(/\b(pseudonym_id|fact_value|source_payload|clinical_text)\b/i);
    expect(migration).toContain("PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE");
    expect(wikiSnapshotAfter).toBe(wikiSnapshotBefore);
    expect(therapySnapshotAfter).toBe(therapySnapshotBefore);

    const boundary = await db.query<{ tables: number; active: number }>(`
      SELECT
        (SELECT count(*)::integer
           FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')) AS tables,
        (SELECT count(*)::integer FROM public.kb_releases
          WHERE retrieval_eligible OR is_active) AS active
    `);
    expect(boundary.rows[0]).toEqual({ tables: 67, active: 0 });
  });

  it("binds only terminal verified and review-only facts without raw values", async () => {
    expect(inputManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_INPUT_PREFLIGHT_ONLY",
      data_classification: "pseudonymized_health_data",
      fact_selection_policy: {
        policy_version: 1,
        accepted_review_statuses: ["verified", "review_only"],
        terminal_facts_only: true,
      },
      fact_counts: {
        total: 5,
        terminal: 4,
        superseded: 1,
        selected: 2,
        verified: 1,
        review_only: 1,
        excluded_unreviewed: 1,
        excluded_rejected: 1,
      },
    }));
    expect(inputManifest.selected_facts.map((fact) => fact.fact_id)).toEqual([
      successorFactId,
      reviewOnlyFactId,
    ]);
    expect(inputManifest.selected_facts.map((fact) => fact.review_status)).toEqual([
      "verified",
      "review_only",
    ]);
    expect(inputManifest.selected_facts.every((fact) =>
      /^[0-9a-f]{64}$/.test(fact.content_sha256))).toBe(true);
    expect(inputManifest.complete_fact_set_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(inputManifest)).not.toContain("Synthetic unreviewed value");
    expect(JSON.stringify(inputManifest)).not.toContain("Synthetic rejected value");
    expect(JSON.stringify(inputManifest)).not.toContain("P-2026-6001");
    expect(expectedInputHash).toMatch(/^[0-9a-f]{64}$/);

    const replay = (await db.query<{ manifest: InputManifest; hash: string }>(`
      SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS manifest,
             public.therapy_retrieval_v2_input_hash_v1($1) AS hash
    `, [inputRevisionId])).rows[0];
    expect(replay.manifest).toEqual(inputManifest);
    expect(replay.hash).toBe(expectedInputHash);
  });

  it("returns one deterministic inactive binding and preserves explicit review", async () => {
    expect(successfulPreflight).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE",
      interpretation: "PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      therapy_input_hash_matches: true,
      release_manifest_hash_matches: true,
      selected_fact_count: 2,
      review_only_fact_count: 1,
      requires_fact_review: true,
      actual_therapy_input_hash: expectedInputHash,
      actual_release_manifest_hash: expectedReleaseManifestHash,
      binding_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulPreflight.input_manifest).toEqual(inputManifest);
    expect(await readPreflight()).toEqual(successfulPreflight);

    const { result_hash: resultHash, ...payload } = successfulPreflight;
    const calculated = (await db.query<{ hash: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS hash
    `, [JSON.stringify(payload)])).rows[0].hash;
    expect(calculated).toBe(resultHash);
  });

  it("distinguishes malformed expectations, binding drift, and unavailable inputs", async () => {
    const malformed = await readPreflight(expectedInputHash.toUpperCase());
    expect(malformed.status).toBe("RETRIEVAL_V2_EXPECTATION_INVALID");
    expect(malformed.medical_use_allowed).toBe(false);
    expect(malformed.retrieval_execution_allowed).toBe(false);

    const inputMismatch = await readPreflight("0".repeat(64));
    expect(inputMismatch).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_BINDING_MISMATCH",
      therapy_input_hash_matches: false,
      release_manifest_hash_matches: true,
    }));
    const releaseMismatch = await readPreflight(expectedInputHash, "f".repeat(64));
    expect(releaseMismatch).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_BINDING_MISMATCH",
      therapy_input_hash_matches: true,
      release_manifest_hash_matches: false,
    }));

    const missingInput = await readPreflight(
      expectedInputHash,
      expectedReleaseManifestHash,
      unknownInputRevisionId,
    );
    expect(missingInput.status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    const missingRelease = await readPreflight(
      expectedInputHash,
      expectedReleaseManifestHash,
      inputRevisionId,
      unknownReleaseId,
    );
    expect(missingRelease.status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
  });

  it("fails closed after trigger-bypassed input or release corruption", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.therapy_input_facts SET content_sha256 = repeat('f', 64)
         WHERE id = '${successorFactId}'
      `);
      const manifest = (await db.query<{ value: InputManifest | null }>(`
        SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
      `, [inputRevisionId])).rows[0].value;
      expect(manifest).toBeNull();
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(
      "BEGIN; ALTER TABLE public.therapy_input_fact_sources DISABLE TRIGGER USER;",
    );
    try {
      await db.exec(`
        INSERT INTO public.therapy_input_fact_sources (
          therapy_input_revision_id, therapy_input_fact_id, link_order,
          source_order, fact_locator, source_role
        ) VALUES (
          '${inputRevisionId}', '93000000-0000-4000-8000-000000000099',
          1, 1, 'line:orphan', 'primary'
        )
      `);
      const manifest = (await db.query<{ value: InputManifest | null }>(`
        SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
      `, [inputRevisionId])).rows[0].value;
      expect(manifest).toBeNull();
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_releases DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_releases
           SET release_manifest = release_manifest || '{"tampered":true}'::jsonb,
               release_manifest_hash = public.kb_release_manifest_hash_v1(
                 release_manifest || '{"tampered":true}'::jsonb
               )
         WHERE id = '${knowledgeReleaseId}'
      `);
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_releases DISABLE TRIGGER USER;
      ALTER TABLE public.kb_releases
        DROP CONSTRAINT kb_releases_retrieval_eligible_check;
      ALTER TABLE public.kb_releases
        DROP CONSTRAINT kb_releases_is_active_check;
      UPDATE public.kb_releases
         SET retrieval_eligible = true, is_active = true
       WHERE id = '${knowledgeReleaseId}';
    `);
    try {
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readPreflight()).toEqual(successfulPreflight);
  });

  it("adds only three closed entity-resolution functions and changes no snapshot", async () => {
    expect(entityResolutionMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(entityResolutionMigration).toMatch(/^BEGIN;/);
    expect(entityResolutionMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(entityResolutionMigration)
      .not.toMatch(
        /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
      );
    expect(entityResolutionMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(entityResolutionMigration).not.toMatch(/\bGRANT\b/i);
    expect(entityResolutionMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    expect(entityResolutionMigration)
      .toContain("ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE");
    expect(entityResolutionMigration).toContain("LIMIT 4097");
    expect(entityResolutionMigration).toContain("LIMIT 1025");
    expect(entityResolutionMigration).toContain("LIMIT 2049");
    const projectionFunction = entityResolutionMigration.slice(
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_projection_is_complete_v1",
      ),
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1",
      ),
    );
    expect(projectionFunction.indexOf(
      "IF release_item_count NOT BETWEEN 1 AND 4096",
    )).toBeLessThan(projectionFunction.indexOf("INTO entity_item_count"));
    expect(projectionFunction.indexOf(
      "IF entity_item_count NOT BETWEEN 1 AND 1024",
    )).toBeLessThan(projectionFunction.indexOf("INTO relation_item_count"));
    const resolutionFunction = entityResolutionMigration.slice(
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1",
      ),
    );
    expect(resolutionFunction.indexOf("LIMIT 4097")).toBeLessThan(
      resolutionFunction.indexOf("binding_result :="),
    );
    expect(wikiSnapshotAfterEntityResolution).toBe(wikiSnapshotAfter);
    expect(therapySnapshotAfterEntityResolution).toBe(therapySnapshotAfter);

    const projection = await db.query<{ complete: boolean; active: number }>(`
      SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
               AS complete,
             (SELECT count(*)::integer FROM public.kb_releases
               WHERE retrieval_eligible OR is_active) AS active
    `, [knowledgeReleaseId]);
    expect(projection.rows[0]).toEqual({ complete: true, active: 0 });
  });

  it("derives a bounded deterministic query manifest only from selected facts", async () => {
    expect(entityQueryManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_ENTITY_QUERY_PREFLIGHT_ONLY",
      selected_fact_count: 2,
      input_manifest_hash: expectedInputHash,
    }));
    expect(entityQueryManifest.facts.map((fact) => fact.fact_id)).toEqual([
      successorFactId,
      reviewOnlyFactId,
    ]);
    expect(entityQueryManifest.facts[0]).toEqual(expect.objectContaining({
      fact_id: successorFactId,
      kb_entity_id: null,
      query_terms: ["r53", "synthetic coded disease", "synthetic contract condition"],
      identifier_terms: [
        'identifier:["icd_10_gm", null, "R53"]',
        'identifier_value:"R53"',
      ],
      query_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(entityQueryManifest.facts[1]).toEqual(expect.objectContaining({
      fact_id: reviewOnlyFactId,
      kb_entity_id: plantEntityId,
      query_terms: ["synthetic review question"],
      identifier_terms: [],
      query_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(JSON.stringify(entityQueryManifest)).not.toContain("P-2026-6001");

    const replay = (await db.query<{ value: EntityQueryManifest }>(`
      SELECT public.therapy_retrieval_v2_entity_query_manifest_v1($1) AS value
    `, [inputRevisionId])).rows[0].value;
    expect(replay).toEqual(entityQueryManifest);
  });

  it("resolves exact channels and one-hop graph provenance without a recommendation", async () => {
    expect(successfulEntityResolution).toEqual(expect.objectContaining({
      status: "ENTITY_RESOLUTION_PREFLIGHT_COMPLETE_INACTIVE",
      interpretation: "ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      therapy_input_revision_id: inputRevisionId,
      therapy_input_manifest_hash: expectedInputHash,
      knowledge_release_id: knowledgeReleaseId,
      release_manifest_hash: expectedReleaseManifestHash,
      binding_hash: successfulPreflight.binding_hash,
      query_manifest_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      selected_fact_count: 2,
      direct_candidate_count_before_limit: 2,
      returned_direct_candidate_count: 2,
      graph_candidate_count_before_limit: 2,
      returned_graph_candidate_count: 2,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulEntityResolution.facts).toHaveLength(2);

    const diseaseFact = successfulEntityResolution.facts?.[0];
    expect(diseaseFact).toEqual(expect.objectContaining({
      fact_id: successorFactId,
      direct_candidate_count_before_limit: 1,
      returned_direct_candidate_count: 1,
      graph_candidate_count_before_limit: 1,
      returned_graph_candidate_count: 1,
    }));
    expect(diseaseFact?.direct_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "ENTITY_REFERENCE_MATCH_ONLY",
      entity_id: diseaseEntityId,
      entity_revision_id: diseaseEntityRevisionId,
      best_match_channel: "exact_qualified_identifier",
      matched_channels: expect.arrayContaining([
        "exact_qualified_identifier",
        "exact_unqualified_identifier",
        "exact_normalized_title",
        "exact_normalized_alias",
        "german_full_text",
        "simple_full_text",
      ]),
    }));
    expect(diseaseFact?.graph_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION",
      source_entity_id: diseaseEntityId,
      relation_type_code: "may_support",
      graph_direction: "inbound",
      entity_id: plantEntityId,
      entity_revision_id: plantEntityRevisionId,
    }));

    const plantFact = successfulEntityResolution.facts?.[1];
    expect(plantFact?.direct_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "ENTITY_REFERENCE_MATCH_ONLY",
      entity_id: plantEntityId,
      entity_revision_id: plantEntityRevisionId,
      best_match_channel: "exact_kb_entity_link",
      matched_channels: expect.arrayContaining([
        "exact_kb_entity_link",
        "exact_normalized_alias",
        "german_full_text",
        "simple_full_text",
      ]),
    }));
    expect(plantFact?.graph_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION",
      source_entity_id: plantEntityId,
      relation_type_code: "may_support",
      graph_direction: "outbound",
      entity_id: diseaseEntityId,
      entity_revision_id: diseaseEntityRevisionId,
    }));
    expect(JSON.stringify(successfulEntityResolution)).not.toMatch(
      /"candidate_status":"(?:ALLOW|REVIEW_ONLY|EXCLUDE|ESCALATE_ONLY)"/,
    );
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);

    const { result_hash: resultHash, ...payload } = successfulEntityResolution;
    const calculated = (await db.query<{ hash: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS hash
    `, [JSON.stringify(payload)])).rows[0].hash;
    expect(calculated).toBe(resultHash);
  });

  it("fails closed for invalid limits, binding drift, and incomplete projections", async () => {
    expect((await readEntityResolution(
      expectedInputHash,
      expectedReleaseManifestHash,
      0,
      16,
    )).status).toBe("ENTITY_RESOLUTION_LIMIT_INVALID");
    expect((await readEntityResolution(
      "0".repeat(64),
      expectedReleaseManifestHash,
    )).status).toBe("ENTITY_RESOLUTION_BINDING_UNAVAILABLE");

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts
           SET fact_value = jsonb_build_object(
             'type', 'text', 'value', repeat('x', 1025)
           )
         WHERE id = $1
      `, [reviewOnlyFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [reviewOnlyFactId]);
      const changedInputHash = (await db.query<{ hash: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS hash
      `, [inputRevisionId])).rows[0].hash;
      expect((await readPreflight(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE");
      expect((await readEntityResolution(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("ENTITY_RESOLUTION_QUERY_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET kb_entity_id = $2 WHERE id = $1
      `, [successorFactId, outsideEntityId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [successorFactId]);
      const changedInputHash = (await db.query<{ hash: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS hash
      `, [inputRevisionId])).rows[0].hash;
      expect((await readPreflight(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE");
      expect((await readEntityResolution(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("ENTITY_RESOLUTION_EXPLICIT_LINK_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
    try {
      await db.query(`
        DELETE FROM public.kb_search_documents document
         USING public.kb_release_items item
         WHERE document.release_item_id = item.id
           AND item.release_id = $1
           AND item.entity_id = $2
      `, [knowledgeReleaseId, plantEntityId]);
      const projection = (await db.query<{ complete: boolean }>(`
        SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
                 AS complete
      `, [knowledgeReleaseId])).rows[0].complete;
      expect(projection).toBe(false);
      expect((await readEntityResolution()).status)
        .toBe("ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);
  });

  it("rejects an oversized release before the binding validator", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;
      DROP INDEX public.kb_release_items_source_revision_idx;
      INSERT INTO public.kb_release_items (
        release_id, item_order, item_kind, source_id, source_revision_id,
        item_manifest, item_manifest_hash
      )
      SELECT item.release_id, generated.item_order, item.item_kind,
             item.source_id, item.source_revision_id,
             item.item_manifest, item.item_manifest_hash
        FROM public.kb_release_items item
        CROSS JOIN generate_series(5, 4097) generated(item_order)
       WHERE item.release_id = '${knowledgeReleaseId}'
         AND item.item_kind = 'source_revision';
    `);
    try {
      const projection = (await db.query<{ complete: boolean }>(`
        SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
                 AS complete
      `, [knowledgeReleaseId])).rows[0].complete;
      expect(projection).toBe(false);
      expect((await readEntityResolution()).status)
        .toBe("ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);
  });

  it("exposes no preflight function to application or import roles", async () => {
    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
       CROSS JOIN unnest(ARRAY[
          'public.therapy_retrieval_v2_input_manifest_v1(uuid)',
          'public.therapy_retrieval_v2_input_hash_v1(uuid)',
          'public.therapy_retrieval_v2_expectations_are_valid_v1(text,text)',
          'public.therapy_retrieval_v2_preflight_v1(uuid,text,uuid,text)',
          'public.therapy_retrieval_v2_entity_query_manifest_v1(uuid)',
          'public.therapy_retrieval_v2_entity_projection_is_complete_v1(uuid)',
          'public.therapy_retrieval_v2_entity_resolution_preflight_v1(uuid,text,uuid,text,integer,integer)'
        ]::text[]) function_name
    `);
    expect(privileges.rows).toHaveLength(35);
    expect(privileges.rows.every((row) => row.can_execute === false)).toBe(true);
  });
});
