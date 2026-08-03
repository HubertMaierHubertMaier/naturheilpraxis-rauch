// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildHomeopathicImportBundleContract,
  hashPostgresCanonicalJsonb,
  type HomeopathicImportBundleInput,
  type HomeopathicImportBundleManifest,
} from "@/lib/homeopathicImportBundle";
import {
  hashHomeopathicAssignmentPayload,
  hashHomeopathicGradeDefinitionPayload,
  hashHomeopathicRepertoryRemedyPayload,
  hashHomeopathicRepertoryRevisionPayload,
  hashHomeopathicRubricRevisionPayload,
} from "@/lib/homeopathicImportRowHashes";

const baseMigrationFiles = [
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
] as const;

const baseMigrations = baseMigrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const preflightMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260803110000_create_kb_homeopathic_import_preflight_contract.sql",
  ),
  "utf8",
);
const writerMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260803120000_create_kb_homeopathic_small_bundle_writer.sql",
  ),
  "utf8",
);
const chunkImportMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260803130000_create_kb_homeopathic_chunk_import_contract.sql",
  ),
  "utf8",
);

const adminId = "11000000-0000-4000-8000-000000000001";
const patientId = "11000000-0000-4000-8000-000000000002";
const sourceId = "22000000-0000-4000-8000-000000000001";
const sourceRevisionId = "22100000-0000-4000-8000-000000000001";
const repertoryId = "32000000-0000-4000-8000-000000000001";
const repertoryRevisionId = "32100000-0000-4000-8000-000000000001";
const remedyId = "32000000-0000-4000-8000-000000000002";
const remedyRevisionId = "32100000-0000-4000-8000-000000000002";
const unassignedRemedyId = "32000000-0000-4000-8000-000000000003";
const unassignedRemedyRevisionId = "32100000-0000-4000-8000-000000000003";
const rootRubricId = "42000000-0000-4000-8000-000000000001";
const childRubricId = "42000000-0000-4000-8000-000000000002";
const rootRubricRevisionId = "42100000-0000-4000-8000-000000000001";
const childRubricRevisionId = "42100000-0000-4000-8000-000000000002";
const gradeId = "52000000-0000-4000-8000-000000000001";
const repertoryRemedyId = "62000000-0000-4000-8000-000000000001";
const unassignedRepertoryRemedyId = "62000000-0000-4000-8000-000000000002";
const assignmentId = "72000000-0000-4000-8000-000000000001";
const chunkBatchId = "82000000-0000-4000-8000-000000000001";
const failedChunkBatchId = "82000000-0000-4000-8000-000000000002";
const overflowChunkBatchId = "82000000-0000-4000-8000-000000000003";
const overflowRepertoryId = "32000000-0000-4000-8000-000000000099";
const overflowRepertoryRevisionId = "32100000-0000-4000-8000-000000000099";

const expectedCounts = {
  rubrics: 2,
  grade_definitions: 1,
  remedies: 2,
  assignments: 1,
};

type BundleManifest = HomeopathicImportBundleManifest;

type PreflightResult = {
  status: string;
  interpretation?: string;
  actual_bundle_hash?: string;
  expected_bundle_hash?: string;
  actual_counts?: typeof expectedCounts;
  expected_counts?: typeof expectedCounts;
  hash_matches?: boolean;
  counts_match?: boolean;
  bundle_manifest?: BundleManifest;
  result_hash: string;
};

type ChunkImportStatus = {
  status: string;
  batch_id: string;
  expected_chunk_count?: number;
  staged_chunk_count?: number;
  staged_counts?: typeof expectedCounts;
  staged_payload_bytes?: number;
  missing_chunk_indexes?: number[];
  written_result_hash?: string | null;
  result_hash: string;
};

type ChunkImportWriteResult = {
  status: string;
  batch_id: string;
  expected_chunk_count: number;
  preflight: PreflightResult;
  result_hash: string;
};

type DatabasePayloadRow = {
  id: string;
  payload: unknown;
  database_hash: string;
  stored_hash: string;
};

type RowHashParity = {
  kind: string;
  id: string;
  parserHash: string;
  databaseHash: string;
  storedHash: string;
};

type ContentRowCounts = {
  details: number;
  rubrics: number;
  rubricRevisions: number;
  grades: number;
  remedies: number;
  assignments: number;
};

let db: PGlite;
let snapshotBeforePreflight = "";
let snapshotAfterPreflight = "";
let snapshotAfterWriterContract = "";
let snapshotAfterChunkImportContract = "";
let therapySnapshotBeforePreflight = "";
let therapySnapshotAfterPreflight = "";
let therapySnapshotAfterWriterContract = "";
let therapySnapshotAfterChunkImportContract = "";
let draftManifest: BundleManifest;
let approvedManifest: BundleManifest;
let draftBundleHash = "";
let approvedBundleHash = "";
let draftPreflight: PreflightResult;
let parserBundle: Awaited<ReturnType<typeof buildHomeopathicImportBundleContract>>;
let rowHashParity: RowHashParity[] = [];
let writerBundle: Awaited<ReturnType<typeof buildWriterBundleFixture>>;
let writerFailureMessage = "";
let divergentWriterFailureMessage = "";
let writerCountsAfterFailure: ContentRowCounts;
let repertoryHashAfterFailure = "";
let firstWriterResult: PreflightResult;
let replayWriterResult: PreflightResult;
let writerCountsAfterReplay: ContentRowCounts;
let writerChunks: Array<{ payload: Record<string, unknown[]>; hash: string }>;
let initialChunkStatus: ChunkImportStatus;
let resumedChunkStatus: ChunkImportStatus;
let replayedChunkStatus: ChunkImportStatus;
let readyChunkStatus: ChunkImportStatus;
let writtenChunkStatus: ChunkImportStatus;
let failedChunkFinalizeMessage = "";
let failedChunkFinalizeStatus: ChunkImportStatus;
let cancelledChunkStatus: ChunkImportStatus;
let replayedCancelledChunkStatus: ChunkImportStatus;
let writerCountsAfterFailedChunkFinalize: ContentRowCounts;
let incompleteChunkFinalizeMessage = "";
let writerCountsAfterIncompleteChunkFinalize: ContentRowCounts;
let divergentChunkFailureMessage = "";
let overflowChunkFailureMessage = "";
let overflowChunkStatus: ChunkImportStatus;
let chunkWriteResult: ChunkImportWriteResult;
let replayedChunkWriteResult: ChunkImportWriteResult;

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

async function approveRevision(
  table: "kb_source_revisions" | "kb_entity_revisions",
  id: string,
  safetyReview: boolean,
): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (safetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved',
           reviewed_at = '2026-08-03T16:30:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
}

async function readManifest(): Promise<BundleManifest> {
  const result = await db.query<{ value: BundleManifest }>(`
    SELECT public.kb_homeopathic_repertory_bundle_manifest_v1(
      $1::uuid, $2::uuid
    ) AS value
  `, [repertoryId, repertoryRevisionId]);
  return result.rows[0].value;
}

async function readBundleHash(): Promise<string> {
  const result = await db.query<{ value: string }>(`
    SELECT public.kb_homeopathic_repertory_bundle_hash_v1(
      $1::uuid, $2::uuid
    ) AS value
  `, [repertoryId, repertoryRevisionId]);
  return result.rows[0].value;
}

async function readPreflight(
  expectedHash: string | null,
  counts: unknown,
  selectedRepertoryId: string | null = repertoryId,
  selectedRevisionId: string | null = repertoryRevisionId,
): Promise<PreflightResult> {
  const result = await db.query<{ value: PreflightResult }>(`
    SELECT public.kb_homeopathic_repertory_import_preflight_v1(
      $1::uuid, $2::uuid, $3::text, $4::jsonb
    ) AS value
  `, [selectedRepertoryId, selectedRevisionId, expectedHash, JSON.stringify(counts)]);
  return result.rows[0].value;
}

async function readContentRowCounts(): Promise<ContentRowCounts> {
  return (await db.query<ContentRowCounts>(`
    SELECT
      (SELECT count(*)::int
         FROM public.kb_homeopathic_repertory_revision_details) AS details,
      (SELECT count(*)::int FROM public.kb_homeopathic_rubrics) AS rubrics,
      (SELECT count(*)::int
         FROM public.kb_homeopathic_rubric_revisions) AS "rubricRevisions",
      (SELECT count(*)::int
         FROM public.kb_homeopathic_grade_definitions) AS grades,
      (SELECT count(*)::int
         FROM public.kb_homeopathic_repertory_remedies) AS remedies,
      (SELECT count(*)::int
         FROM public.kb_homeopathic_rubric_remedy_assignments) AS assignments
  `)).rows[0];
}

async function callSmallBundleWriter(bundle: unknown): Promise<PreflightResult> {
  const result = await db.query<{ value: PreflightResult }>(`
    SELECT public.kb_homeopathic_write_small_bundle_v1($1::jsonb) AS value
  `, [JSON.stringify(bundle)]);
  return result.rows[0].value;
}

async function readChunkImportStatus(batchId: string): Promise<ChunkImportStatus> {
  const result = await db.query<{ value: ChunkImportStatus }>(`
    SELECT public.kb_homeopathic_chunk_import_status_v1($1::uuid) AS value
  `, [batchId]);
  return result.rows[0].value;
}

async function beginChunkImport(batch: unknown): Promise<ChunkImportStatus> {
  const result = await db.query<{ value: ChunkImportStatus }>(`
    SELECT public.kb_homeopathic_begin_chunk_import_v1($1::jsonb) AS value
  `, [JSON.stringify(batch)]);
  return result.rows[0].value;
}

async function stageImportChunk(chunk: unknown): Promise<ChunkImportStatus> {
  const result = await db.query<{ value: ChunkImportStatus }>(`
    SELECT public.kb_homeopathic_stage_import_chunk_v1($1::jsonb) AS value
  `, [JSON.stringify(chunk)]);
  return result.rows[0].value;
}

async function finalizeChunkImport(batchId: string): Promise<ChunkImportWriteResult> {
  const result = await db.query<{ value: ChunkImportWriteResult }>(`
    SELECT public.kb_homeopathic_finalize_chunk_import_v1($1::uuid) AS value
  `, [batchId]);
  return result.rows[0].value;
}

async function cancelChunkImport(batchId: string): Promise<ChunkImportStatus> {
  const result = await db.query<{ value: ChunkImportStatus }>(`
    SELECT public.kb_homeopathic_cancel_chunk_import_v1($1::uuid) AS value
  `, [batchId]);
  return result.rows[0].value;
}

function chunkBatchEnvelope(batchId: string, expectedBundleHash: string) {
  return {
    contract_version: 1,
    contract_scope: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_ONLY",
    data_classification: "general_knowledge",
    batch_id: batchId,
    expected_bundle_hash: expectedBundleHash,
    expected_counts: expectedCounts,
    expected_chunk_hashes: writerChunks.map((chunk) => chunk.hash),
    repertory: writerBundle.repertory,
  };
}

function chunkEnvelope(batchId: string, chunkIndex: number) {
  const chunk = writerChunks[chunkIndex];
  return {
    contract_version: 1,
    contract_scope: "HOMEOPATHIC_CHUNK_IMPORT_STAGE_ONLY",
    data_classification: "general_knowledge",
    batch_id: batchId,
    chunk_index: chunkIndex,
    chunk_hash: chunk.hash,
    chunk_payload: chunk.payload,
  };
}

async function buildWriterBundleFixture() {
  const emptyMetadataHash = await hashPostgresCanonicalJsonb({});
  const sourcePayload = {
    source_id: sourceId,
    source_revision_id: sourceRevisionId,
    canonical_key: "source:synthetic-import-preflight",
    revision_no: 1,
    source_type: "database",
    title: "Synthetic import preflight source \u00e4",
    authors: [],
    publisher: null,
    edition: null,
    published_on: null,
    url: null,
    doi: null,
    pmid: null,
    isbn: null,
    retrieved_on: null,
    file_sha256: null,
    rights_status: "licensed",
    archive_location: null,
    content_hash: "1".repeat(64),
    metadata_hash: emptyMetadataHash,
  };
  const repertory = await hashHomeopathicRepertoryRevisionPayload({
    repertory_schema_version: 1,
    entity: {
      entity_id: repertoryId,
      entity_revision_id: repertoryRevisionId,
      entity_type_code: "homeopathic_repertory",
      canonical_key: "homeopathic-repertory:synthetic-preflight",
    },
    revision: {
      revision_no: 1,
      display_name: "Synthetic preflight repertory",
      summary: "Synthetic import fixture.",
      description_markdown: "Non-medical fixture.",
      origin_type: "human",
      metadata_hash: emptyMetadataHash,
    },
    source: sourcePayload,
    source_binding: {
      source_id: sourceId,
      source_revision_id: sourceRevisionId,
      source_repertory_code: "SYN-PREFLIGHT-1",
      source_language_code: "de",
      source_locator: "catalog:\"synthetic-preflight\"\nsection:a",
    },
  });
  const repertoryLink = {
    payload: repertory.payload,
    content_hash: repertory.contentHash,
  };
  const rootRubric = await hashHomeopathicRubricRevisionPayload({
    rubric_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    rubric_id: rootRubricId,
    native_rubric_code: "ROOT",
    parent_rubric_id: null,
    parent_native_rubric_code: null,
    parent_rubric_content_hash: null,
    rubric_text: "Synthetic root",
    rubric_domain: "general",
    sibling_order: 1,
    source_locator: "rubric:root",
  });
  const childRubric = await hashHomeopathicRubricRevisionPayload({
    rubric_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    rubric_id: childRubricId,
    native_rubric_code: "ROOT.CHILD",
    parent_rubric_id: rootRubricId,
    parent_native_rubric_code: "ROOT",
    parent_rubric_content_hash: rootRubric.contentHash,
    rubric_text: "Synthetic child",
    rubric_domain: "mind",
    sibling_order: 1,
    source_locator: "rubric:root.child",
  });
  const grade = await hashHomeopathicGradeDefinitionPayload({
    grade_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    grade_definition_id: gradeId,
    source_grade_code: "G-A",
    source_grade_label: "Synthetic grade A",
    grade_order: 1,
    source_locator: "grade:a",
  });
  const remedy = await hashHomeopathicRepertoryRemedyPayload({
    remedy_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    repertory_remedy_id: repertoryRemedyId,
    source_remedy_code: "R-A",
    source_remedy_name: "Synthetic remedy A",
    source_remedy_aliases: ["Alias A", "Synthetic A"],
    source_locator: "remedy:r-a",
    remedy_entity_revision: {
      entity_id: remedyId,
      entity_revision_id: remedyRevisionId,
      entity_type_code: "homeopathic_remedy",
      canonical_key: "homeopathic-remedy:synthetic-preflight",
      revision_no: 1,
      display_name: "Synthetic preflight remedy",
      summary: "",
      description_markdown: "",
      origin_type: "human",
      content_hash: "2".repeat(64),
      metadata_hash: emptyMetadataHash,
    },
  });
  const unassignedRemedy = await hashHomeopathicRepertoryRemedyPayload({
    remedy_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    repertory_remedy_id: unassignedRepertoryRemedyId,
    source_remedy_code: "R-B",
    source_remedy_name: "Synthetic unassigned remedy B",
    source_remedy_aliases: [],
    source_locator: "remedy:r-b",
    remedy_entity_revision: {
      entity_id: unassignedRemedyId,
      entity_revision_id: unassignedRemedyRevisionId,
      entity_type_code: "homeopathic_remedy",
      canonical_key: "homeopathic-remedy:synthetic-preflight-unassigned",
      revision_no: 1,
      display_name: "Synthetic unassigned preflight remedy",
      summary: "",
      description_markdown: "",
      origin_type: "human",
      content_hash: "3".repeat(64),
      metadata_hash: emptyMetadataHash,
    },
  });
  const assignment = await hashHomeopathicAssignmentPayload({
    assignment_schema_version: 1,
    repertory_entity_id: repertoryId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    assignment_id: assignmentId,
    rubric: {
      payload: childRubric.payload,
      content_hash: childRubric.contentHash,
    },
    remedy: {
      payload: remedy.payload,
      content_hash: remedy.contentHash,
    },
    grade: {
      payload: grade.payload,
      content_hash: grade.contentHash,
    },
    source_locator: "assignment:root.child:r-a",
  });
  const compactBundle = await buildHomeopathicImportBundleContract({
    contract_version: 1,
    contract_scope: "HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY",
    data_classification: "general_knowledge",
    repertory: {
      repertory_entity_id: repertoryId,
      repertory_revision_id: repertoryRevisionId,
      repertory_content_hash: repertory.contentHash,
      source_id: sourceId,
      source_revision_id: sourceRevisionId,
      source_content_hash: sourcePayload.content_hash,
      source_rights_status: sourcePayload.rights_status,
      source_repertory_code: "SYN-PREFLIGHT-1",
      source_language_code: "de",
      source_locator: "catalog:\"synthetic-preflight\"\nsection:a",
    },
    rubrics: [
      {
        rubric_id: rootRubricId,
        rubric_revision_id: rootRubricRevisionId,
        rubric_content_hash: rootRubric.contentHash,
      },
      {
        rubric_id: childRubricId,
        rubric_revision_id: childRubricRevisionId,
        rubric_content_hash: childRubric.contentHash,
      },
    ],
    grade_definitions: [{
      grade_definition_id: gradeId,
      grade_content_hash: grade.contentHash,
    }],
    remedies: [
      {
        repertory_remedy_id: repertoryRemedyId,
        remedy_entity_id: remedyId,
        remedy_revision_id: remedyRevisionId,
        remedy_content_hash: remedy.contentHash,
      },
      {
        repertory_remedy_id: unassignedRepertoryRemedyId,
        remedy_entity_id: unassignedRemedyId,
        remedy_revision_id: unassignedRemedyRevisionId,
        remedy_content_hash: unassignedRemedy.contentHash,
      },
    ],
    assignments: [{
      assignment_id: assignmentId,
      rubric_revision_id: childRubricRevisionId,
      repertory_remedy_id: repertoryRemedyId,
      grade_definition_id: gradeId,
      assignment_content_hash: assignment.contentHash,
    }],
  });

  return {
    contract_version: 1,
    contract_scope: "HOMEOPATHIC_SMALL_BUNDLE_WRITE_ONLY",
    data_classification: "general_knowledge",
    expected_bundle_hash: compactBundle.bundleHash,
    repertory: {
      entity_id: repertoryId,
      revision_id: repertoryRevisionId,
      content_hash: repertory.contentHash,
      source_id: sourceId,
      source_revision_id: sourceRevisionId,
      source_content_hash: sourcePayload.content_hash,
      source_rights_status: sourcePayload.rights_status,
      source_repertory_code: "SYN-PREFLIGHT-1",
      source_language_code: "de",
      source_locator: "catalog:\"synthetic-preflight\"\nsection:a",
    },
    rubrics: [
      {
        rubric_id: rootRubricId,
        rubric_revision_id: rootRubricRevisionId,
        native_rubric_code: "ROOT",
        parent_rubric_id: null,
        rubric_text: "Synthetic root",
        rubric_domain: "general",
        sibling_order: 1,
        source_locator: "rubric:root",
        content_hash: rootRubric.contentHash,
      },
      {
        rubric_id: childRubricId,
        rubric_revision_id: childRubricRevisionId,
        native_rubric_code: "ROOT.CHILD",
        parent_rubric_id: rootRubricId,
        rubric_text: "Synthetic child",
        rubric_domain: "mind",
        sibling_order: 1,
        source_locator: "rubric:root.child",
        content_hash: childRubric.contentHash,
      },
    ],
    grade_definitions: [{
      grade_definition_id: gradeId,
      source_grade_code: "G-A",
      source_grade_label: "Synthetic grade A",
      grade_order: 1,
      source_locator: "grade:a",
      content_hash: grade.contentHash,
    }],
    remedies: [
      {
        repertory_remedy_id: repertoryRemedyId,
        remedy_entity_id: remedyId,
        remedy_revision_id: remedyRevisionId,
        source_remedy_code: "R-A",
        source_remedy_name: "Synthetic remedy A",
        source_remedy_aliases: ["Alias A", "Synthetic A"],
        source_locator: "remedy:r-a",
        content_hash: remedy.contentHash,
      },
      {
        repertory_remedy_id: unassignedRepertoryRemedyId,
        remedy_entity_id: unassignedRemedyId,
        remedy_revision_id: unassignedRemedyRevisionId,
        source_remedy_code: "R-B",
        source_remedy_name: "Synthetic unassigned remedy B",
        source_remedy_aliases: [],
        source_locator: "remedy:r-b",
        content_hash: unassignedRemedy.contentHash,
      },
    ],
    assignments: [{
      assignment_id: assignmentId,
      rubric_revision_id: childRubricRevisionId,
      repertory_remedy_id: repertoryRemedyId,
      grade_definition_id: gradeId,
      source_locator: "assignment:root.child:r-a",
      content_hash: assignment.contentHash,
    }],
  };
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase(db);
  for (const migration of baseMigrations) {
    await db.exec(migration);
  }
  snapshotBeforePreflight = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotBeforePreflight = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  await db.exec(preflightMigration);
  snapshotAfterPreflight = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterPreflight = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  await db.exec(writerMigration);
  snapshotAfterWriterContract = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterWriterContract = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  await db.exec(chunkImportMigration);
  snapshotAfterChunkImportContract = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterChunkImportContract = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  writerBundle = await buildWriterBundleFixture();
  const chunkPayloads: Array<Record<string, unknown[]>> = [
    {
      rubrics: [writerBundle.rubrics[0]],
      grade_definitions: [writerBundle.grade_definitions[0]],
      remedies: [writerBundle.remedies[0]],
      assignments: [],
    },
    {
      rubrics: [writerBundle.rubrics[1]],
      grade_definitions: [],
      remedies: [writerBundle.remedies[1]],
      assignments: [writerBundle.assignments[0]],
    },
  ];
  writerChunks = await Promise.all(chunkPayloads.map(async (payload) => ({
    payload,
    hash: await hashPostgresCanonicalJsonb(payload),
  })));

  await db.exec("BEGIN;");
  try {
    await db.exec(`
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:synthetic-import-preflight');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, rights_status, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'database',
      'Synthetic import preflight source ' || chr(228), 'licensed', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${repertoryId}', 'homeopathic_repertory', 'homeopathic-repertory:synthetic-preflight'),
      ('${remedyId}', 'homeopathic_remedy', 'homeopathic-remedy:synthetic-preflight'),
      ('${unassignedRemedyId}', 'homeopathic_remedy',
       'homeopathic-remedy:synthetic-preflight-unassigned');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${repertoryRevisionId}', '${repertoryId}', 1,
       'Synthetic preflight repertory', 'Synthetic import fixture.',
       'Non-medical fixture.', repeat('0', 64)),
      ('${remedyRevisionId}', '${remedyId}', 1,
       'Synthetic preflight remedy', '', '', repeat('2', 64)),
      ('${unassignedRemedyRevisionId}', '${unassignedRemedyId}', 1,
       'Synthetic unassigned preflight remedy', '', '', repeat('3', 64));
    UPDATE public.kb_entities entity SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
         AND entity.id IN ('${repertoryId}', '${remedyId}', '${unassignedRemedyId}');
    `);

    await db.exec("SAVEPOINT failed_writer;");
    const invalidBundle = structuredClone(writerBundle);
    invalidBundle.assignments[0].content_hash = invalidBundle.assignments[0].content_hash
      === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
    let writerFailure: unknown;
    try {
      await callSmallBundleWriter(invalidBundle);
    } catch (error) {
      writerFailure = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT failed_writer;");
    }
    if (!(writerFailure instanceof Error)) {
      throw new Error("Corrupted homeopathic writer bundle unexpectedly succeeded");
    }
    writerFailureMessage = writerFailure.message;
    writerCountsAfterFailure = await readContentRowCounts();
    repertoryHashAfterFailure = (await db.query<{ content_hash: string }>(`
      SELECT content_hash FROM public.kb_entity_revisions
       WHERE id = '${repertoryRevisionId}'
    `)).rows[0].content_hash;
    await db.exec("RELEASE SAVEPOINT failed_writer;");

    await beginChunkImport(chunkBatchEnvelope(failedChunkBatchId, "0".repeat(64)));
    await stageImportChunk(chunkEnvelope(failedChunkBatchId, 0));
    await stageImportChunk(chunkEnvelope(failedChunkBatchId, 1));
    await db.exec("SAVEPOINT failed_chunk_finalize_call;");
    let failedChunkFinalize: unknown;
    try {
      await finalizeChunkImport(failedChunkBatchId);
    } catch (error) {
      failedChunkFinalize = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT failed_chunk_finalize_call;");
      await db.exec("RELEASE SAVEPOINT failed_chunk_finalize_call;");
    }
    if (!(failedChunkFinalize instanceof Error)) {
      throw new Error("Hash-mismatched staged homeopathic batch unexpectedly finalized");
    }
    failedChunkFinalizeMessage = failedChunkFinalize.message;
    failedChunkFinalizeStatus = await readChunkImportStatus(failedChunkBatchId);
    writerCountsAfterFailedChunkFinalize = await readContentRowCounts();
    cancelledChunkStatus = await cancelChunkImport(failedChunkBatchId);
    replayedCancelledChunkStatus = await cancelChunkImport(failedChunkBatchId);

    initialChunkStatus = await beginChunkImport(
      chunkBatchEnvelope(chunkBatchId, writerBundle.expected_bundle_hash),
    );
    resumedChunkStatus = await stageImportChunk(chunkEnvelope(chunkBatchId, 1));
    replayedChunkStatus = await stageImportChunk(chunkEnvelope(chunkBatchId, 1));

    await db.exec("SAVEPOINT divergent_chunk_replay;");
    const divergentChunk = structuredClone(chunkEnvelope(chunkBatchId, 1));
    divergentChunk.chunk_payload.rubrics = [writerBundle.rubrics[0]];
    let divergentChunkFailure: unknown;
    try {
      await stageImportChunk(divergentChunk);
    } catch (error) {
      divergentChunkFailure = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT divergent_chunk_replay;");
      await db.exec("RELEASE SAVEPOINT divergent_chunk_replay;");
    }
    if (!(divergentChunkFailure instanceof Error)) {
      throw new Error("Divergent homeopathic chunk replay unexpectedly succeeded");
    }
    divergentChunkFailureMessage = divergentChunkFailure.message;

    await db.exec("SAVEPOINT incomplete_chunk_finalize;");
    let incompleteChunkFinalize: unknown;
    try {
      await finalizeChunkImport(chunkBatchId);
    } catch (error) {
      incompleteChunkFinalize = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT incomplete_chunk_finalize;");
      await db.exec("RELEASE SAVEPOINT incomplete_chunk_finalize;");
    }
    if (!(incompleteChunkFinalize instanceof Error)) {
      throw new Error("Incomplete homeopathic chunk batch unexpectedly finalized");
    }
    incompleteChunkFinalizeMessage = incompleteChunkFinalize.message;
    writerCountsAfterIncompleteChunkFinalize = await readContentRowCounts();

    readyChunkStatus = await stageImportChunk(chunkEnvelope(chunkBatchId, 0));
    chunkWriteResult = await finalizeChunkImport(chunkBatchId);
    replayedChunkWriteResult = await finalizeChunkImport(chunkBatchId);
    writtenChunkStatus = await readChunkImportStatus(chunkBatchId);

    const overflowPayloads: Array<Record<string, unknown[]>> = [
      writerChunks[0].payload,
      {
        ...writerChunks[1].payload,
        remedies: [writerBundle.remedies[1], writerBundle.remedies[0]],
      },
    ];
    const overflowHashes = await Promise.all(
      overflowPayloads.map((payload) => hashPostgresCanonicalJsonb(payload)),
    );
    const overflowRepertory = {
      ...writerBundle.repertory,
      entity_id: overflowRepertoryId,
      revision_id: overflowRepertoryRevisionId,
    };
    await beginChunkImport({
      contract_version: 1,
      contract_scope: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_ONLY",
      data_classification: "general_knowledge",
      batch_id: overflowChunkBatchId,
      expected_bundle_hash: writerBundle.expected_bundle_hash,
      expected_counts: expectedCounts,
      expected_chunk_hashes: overflowHashes,
      repertory: overflowRepertory,
    });
    await stageImportChunk({
      contract_version: 1,
      contract_scope: "HOMEOPATHIC_CHUNK_IMPORT_STAGE_ONLY",
      data_classification: "general_knowledge",
      batch_id: overflowChunkBatchId,
      chunk_index: 0,
      chunk_hash: overflowHashes[0],
      chunk_payload: overflowPayloads[0],
    });
    await db.exec("SAVEPOINT overflow_chunk_stage;");
    let overflowChunkFailure: unknown;
    try {
      await stageImportChunk({
        contract_version: 1,
        contract_scope: "HOMEOPATHIC_CHUNK_IMPORT_STAGE_ONLY",
        data_classification: "general_knowledge",
        batch_id: overflowChunkBatchId,
        chunk_index: 1,
        chunk_hash: overflowHashes[1],
        chunk_payload: overflowPayloads[1],
      });
    } catch (error) {
      overflowChunkFailure = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT overflow_chunk_stage;");
      await db.exec("RELEASE SAVEPOINT overflow_chunk_stage;");
    }
    if (!(overflowChunkFailure instanceof Error)) {
      throw new Error("Count-overflowing homeopathic chunk unexpectedly staged");
    }
    overflowChunkFailureMessage = overflowChunkFailure.message;
    overflowChunkStatus = await readChunkImportStatus(overflowChunkBatchId);
    await cancelChunkImport(overflowChunkBatchId);

    firstWriterResult = chunkWriteResult.preflight;
    replayWriterResult = await callSmallBundleWriter(writerBundle);
    await db.exec("SAVEPOINT divergent_replay;");
    const divergentReplay = structuredClone(writerBundle);
    divergentReplay.rubrics[0].rubric_text = "Divergent synthetic root";
    let divergentFailure: unknown;
    try {
      await callSmallBundleWriter(divergentReplay);
    } catch (error) {
      divergentFailure = error;
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT divergent_replay;");
    }
    if (!(divergentFailure instanceof Error)) {
      throw new Error("Divergent homeopathic writer replay unexpectedly succeeded");
    }
    divergentWriterFailureMessage = divergentFailure.message;
    await db.exec("RELEASE SAVEPOINT divergent_replay;");
    writerCountsAfterReplay = await readContentRowCounts();
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }

  draftManifest = await readManifest();
  draftBundleHash = await readBundleHash();
  draftPreflight = await readPreflight(draftBundleHash, expectedCounts);
  const rubricRows = await db.query<HomeopathicImportBundleInput["rubrics"][number]>(`
    SELECT rubric_id::text,
           id::text AS rubric_revision_id,
           rubric_content_hash
      FROM public.kb_homeopathic_rubric_revisions
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
  `);
  const gradeRows = await db.query<HomeopathicImportBundleInput["grade_definitions"][number]>(`
    SELECT id::text AS grade_definition_id, grade_content_hash
      FROM public.kb_homeopathic_grade_definitions
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
  `);
  const remedyRows = await db.query<HomeopathicImportBundleInput["remedies"][number]>(`
    SELECT id::text AS repertory_remedy_id,
           remedy_entity_id::text,
           remedy_revision_id::text,
           remedy_content_hash
      FROM public.kb_homeopathic_repertory_remedies
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
  `);
  const assignmentRows = await db.query<HomeopathicImportBundleInput["assignments"][number]>(`
    SELECT id::text AS assignment_id,
           rubric_revision_id::text,
           repertory_remedy_id::text,
           grade_definition_id::text,
           assignment_content_hash
      FROM public.kb_homeopathic_rubric_remedy_assignments
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
  `);
  parserBundle = await buildHomeopathicImportBundleContract({
    contract_version: 1,
    contract_scope: "HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY",
    data_classification: "general_knowledge",
    repertory: draftManifest.repertory,
    rubrics: rubricRows.rows,
    grade_definitions: gradeRows.rows,
    remedies: remedyRows.rows,
    assignments: assignmentRows.rows,
  });
  const repertoryPayload = await db.query<DatabasePayloadRow>(`
    SELECT '${repertoryRevisionId}'::text AS id,
           public.kb_homeopathic_repertory_revision_payload_v1(
             '${repertoryId}', '${repertoryRevisionId}'
           ) AS payload,
           public.kb_homeopathic_repertory_revision_hash_v1(
             '${repertoryId}', '${repertoryRevisionId}'
           ) AS database_hash,
           content_hash AS stored_hash
      FROM public.kb_entity_revisions
     WHERE id = '${repertoryRevisionId}'
  `);
  const rubricPayloads = await db.query<DatabasePayloadRow>(`
    SELECT id::text,
           public.kb_homeopathic_rubric_revision_payload_v1(id) AS payload,
           public.kb_homeopathic_rubric_revision_hash_v1(id) AS database_hash,
           rubric_content_hash AS stored_hash
      FROM public.kb_homeopathic_rubric_revisions
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
     ORDER BY id
  `);
  const gradePayloads = await db.query<DatabasePayloadRow>(`
    SELECT id::text,
           public.kb_homeopathic_grade_definition_payload_v1(id) AS payload,
           public.kb_homeopathic_grade_definition_hash_v1(id) AS database_hash,
           grade_content_hash AS stored_hash
      FROM public.kb_homeopathic_grade_definitions
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
     ORDER BY id
  `);
  const remedyPayloads = await db.query<DatabasePayloadRow>(`
    SELECT id::text,
           public.kb_homeopathic_repertory_remedy_payload_v1(id) AS payload,
           public.kb_homeopathic_repertory_remedy_hash_v1(id) AS database_hash,
           remedy_content_hash AS stored_hash
      FROM public.kb_homeopathic_repertory_remedies
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
     ORDER BY id
  `);
  const assignmentPayloads = await db.query<DatabasePayloadRow>(`
    SELECT id::text,
           public.kb_homeopathic_assignment_payload_v1(id) AS payload,
           public.kb_homeopathic_assignment_hash_v1(id) AS database_hash,
           assignment_content_hash AS stored_hash
      FROM public.kb_homeopathic_rubric_remedy_assignments
     WHERE repertory_entity_id = '${repertoryId}'
       AND repertory_revision_id = '${repertoryRevisionId}'
     ORDER BY id
  `);
  const repertoryParserHash = await hashHomeopathicRepertoryRevisionPayload(
    repertoryPayload.rows[0].payload,
  );
  rowHashParity = [{
    kind: "repertory",
    id: repertoryPayload.rows[0].id,
    parserHash: repertoryParserHash.contentHash,
    databaseHash: repertoryPayload.rows[0].database_hash,
    storedHash: repertoryPayload.rows[0].stored_hash,
  }];
  for (const row of rubricPayloads.rows) {
    const parser = await hashHomeopathicRubricRevisionPayload(row.payload);
    rowHashParity.push({
      kind: "rubric",
      id: row.id,
      parserHash: parser.contentHash,
      databaseHash: row.database_hash,
      storedHash: row.stored_hash,
    });
  }
  for (const row of gradePayloads.rows) {
    const parser = await hashHomeopathicGradeDefinitionPayload(row.payload);
    rowHashParity.push({
      kind: "grade",
      id: row.id,
      parserHash: parser.contentHash,
      databaseHash: row.database_hash,
      storedHash: row.stored_hash,
    });
  }
  for (const row of remedyPayloads.rows) {
    const parser = await hashHomeopathicRepertoryRemedyPayload(row.payload);
    rowHashParity.push({
      kind: "remedy",
      id: row.id,
      parserHash: parser.contentHash,
      databaseHash: row.database_hash,
      storedHash: row.stored_hash,
    });
  }
  for (const row of assignmentPayloads.rows) {
    const parser = await hashHomeopathicAssignmentPayload(row.payload);
    rowHashParity.push({
      kind: "assignment",
      id: row.id,
      parserHash: parser.contentHash,
      databaseHash: row.database_hash,
      storedHash: row.stored_hash,
    });
  }

  await approveRevision("kb_source_revisions", sourceRevisionId, false);
  await approveRevision("kb_entity_revisions", remedyRevisionId, true);
  await approveRevision("kb_entity_revisions", unassignedRemedyRevisionId, true);
  await approveRevision("kb_entity_revisions", repertoryRevisionId, true);
  approvedManifest = await readManifest();
  approvedBundleHash = await readBundleHash();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki Step 5B-2, 5B-5 and 5B-6 homeopathic import contracts", () => {
  it("installs closed contracts and extends only the Wiki snapshot by two staging tables", async () => {
    expect(preflightMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(4);
    expect(preflightMigration).not.toMatch(/CREATE TABLE|ALTER TABLE|INSERT INTO|GRANT EXECUTE/);
    expect(preflightMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(preflightMigration).toContain("HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY");
    expect(preflightMigration).toContain("IMPORT_PREFLIGHT_ONLY_NOT_RELEASE_OR_MEDICAL_USE");
    expect(writerMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(1);
    expect(writerMigration).not.toMatch(/CREATE TABLE|ALTER TABLE|GRANT EXECUTE/);
    expect(writerMigration).toContain("SECURITY INVOKER");
    expect(writerMigration).toContain("HOMEOPATHIC_SMALL_BUNDLE_WRITE_ONLY");
    expect(writerMigration).toContain("octet_length(_bundle::text) > 4194304");
    expect(writerMigration).toContain("current_user <> table_owner");
    expect(writerMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(chunkImportMigration.match(/CREATE TABLE public\./g)).toHaveLength(2);
    expect(chunkImportMigration).toContain("HOMEOPATHIC_CHUNK_IMPORT_BATCH_ONLY");
    expect(chunkImportMigration).toContain("HOMEOPATHIC_CHUNK_IMPORT_STAGE_ONLY");
    expect(chunkImportMigration).toContain("current_user <> table_owner");
    expect(chunkImportMigration).toContain("staged_payload_bytes");
    expect(chunkImportMigration).toContain("> 4000000");
    expect(chunkImportMigration).not.toMatch(/GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL)/);
    expect(chunkImportMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(snapshotAfterPreflight).toBe(snapshotBeforePreflight);
    expect(therapySnapshotAfterPreflight).toBe(therapySnapshotBeforePreflight);
    expect(snapshotAfterWriterContract).toBe(snapshotAfterPreflight);
    expect(therapySnapshotAfterWriterContract).toBe(therapySnapshotAfterPreflight);
    const chunkSnapshot = JSON.parse(snapshotAfterChunkImportContract) as {
      tables: Record<string, unknown[]>;
      validation: Record<string, number>;
    };
    expect(Object.keys(chunkSnapshot.tables)).toHaveLength(67);
    expect(chunkSnapshot.tables.kb_homeopathic_chunk_import_batches).toEqual([]);
    expect(chunkSnapshot.tables.kb_homeopathic_chunk_import_chunks).toEqual([]);
    expect(chunkSnapshot.validation.invalid_homeopathic_chunk_imports).toBe(0);
    expect(therapySnapshotAfterChunkImportContract).toBe(therapySnapshotAfterWriterContract);
    const activeReleases = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count FROM public.kb_releases
       WHERE retrieval_eligible OR is_active
    `);
    expect(activeReleases.rows[0].count).toBe(0);
  });

  it("rolls back a bad row hash and replays one exact parser-hashed bundle", () => {
    expect(writerFailureMessage).toMatch(/small-bundle content is semantically invalid/i);
    expect(writerCountsAfterFailure).toEqual({
      details: 0,
      rubrics: 0,
      rubricRevisions: 0,
      grades: 0,
      remedies: 0,
      assignments: 0,
    });
    expect(repertoryHashAfterFailure).toBe("0".repeat(64));
    expect(firstWriterResult.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_READY");
    expect(firstWriterResult.actual_bundle_hash).toBe(writerBundle.expected_bundle_hash);
    expect(firstWriterResult.actual_counts).toEqual(expectedCounts);
    expect(replayWriterResult).toEqual(firstWriterResult);
    expect(writerCountsAfterReplay).toEqual({
      details: 1,
      rubrics: 2,
      rubricRevisions: 2,
      grades: 1,
      remedies: 2,
      assignments: 1,
    });
  });

  it("persists out-of-order chunks and exposes one exact resume cursor", () => {
    expect(initialChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_OPEN",
      batch_id: chunkBatchId,
      expected_chunk_count: 2,
      staged_chunk_count: 0,
      staged_counts: {
        rubrics: 0,
        grade_definitions: 0,
        remedies: 0,
        assignments: 0,
      },
      missing_chunk_indexes: [0, 1],
    }));
    expect(resumedChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_OPEN",
      staged_chunk_count: 1,
      staged_counts: {
        rubrics: 1,
        grade_definitions: 0,
        remedies: 1,
        assignments: 1,
      },
      missing_chunk_indexes: [0],
    }));
    expect(replayedChunkStatus).toEqual(resumedChunkStatus);
    expect(divergentChunkFailureMessage).toMatch(/chunk envelope is invalid/i);
  });

  it("keeps staged chunks but rolls back every final-table write on a bundle mismatch", () => {
    expect(failedChunkFinalizeMessage)
      .toMatch(/small-bundle preflight failed.*HOMEOPATHIC_IMPORT_BUNDLE_MISMATCH/i);
    expect(failedChunkFinalizeStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_READY",
      batch_id: failedChunkBatchId,
      staged_chunk_count: 2,
      missing_chunk_indexes: [],
    }));
    expect(cancelledChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_CANCELLED",
      batch_id: failedChunkBatchId,
      staged_chunk_count: 2,
      missing_chunk_indexes: [],
    }));
    expect(replayedCancelledChunkStatus).toEqual(cancelledChunkStatus);
    expect(writerCountsAfterFailedChunkFinalize).toEqual({
      details: 0,
      rubrics: 0,
      rubricRevisions: 0,
      grades: 0,
      remedies: 0,
      assignments: 0,
    });
    expect(incompleteChunkFinalizeMessage).toMatch(/incomplete or count-mismatched/i);
    expect(writerCountsAfterIncompleteChunkFinalize).toEqual(
      writerCountsAfterFailedChunkFinalize,
    );
  });

  it("rejects cumulative component or payload limits before accepting a chunk", () => {
    expect(overflowChunkFailureMessage)
      .toMatch(/exceeds the batch counts or 4000000-byte staging limit/i);
    expect(overflowChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_OPEN",
      batch_id: overflowChunkBatchId,
      staged_chunk_count: 1,
      missing_chunk_indexes: [1],
    }));
    expect(overflowChunkStatus.staged_payload_bytes).toBeGreaterThan(0);
  });

  it("finalizes one complete batch atomically and replays the exact result", async () => {
    expect(readyChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_READY",
      staged_chunk_count: 2,
      staged_counts: expectedCounts,
      missing_chunk_indexes: [],
    }));
    expect(chunkWriteResult).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_WRITTEN",
      batch_id: chunkBatchId,
      expected_chunk_count: 2,
      preflight: expect.objectContaining({
        status: "HOMEOPATHIC_IMPORT_BUNDLE_READY",
        actual_bundle_hash: writerBundle.expected_bundle_hash,
        actual_counts: expectedCounts,
      }),
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(replayedChunkWriteResult).toEqual(chunkWriteResult);
    expect(writtenChunkStatus).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_CHUNK_IMPORT_BATCH_WRITTEN",
      staged_chunk_count: 2,
      missing_chunk_indexes: [],
      written_result_hash: chunkWriteResult.result_hash,
    }));
    await expect(cancelChunkImport(chunkBatchId))
      .rejects.toThrow(/written homeopathic chunk import batches cannot be cancelled/i);
    const invalidImports = await db.query<{ count: number }>(`
      SELECT public.kb_invalid_homeopathic_chunk_import_count()::integer AS count
    `);
    expect(invalidImports.rows[0].count).toBe(0);
    const populatedSnapshot = (await db.query<{
      value: { tables: Record<string, unknown[]>; validation: Record<string, number> };
    }>("SELECT public.kb_export_wiki_snapshot() AS value")).rows[0].value;
    expect(populatedSnapshot.tables.kb_homeopathic_chunk_import_batches).toHaveLength(3);
    expect(populatedSnapshot.tables.kb_homeopathic_chunk_import_chunks).toHaveLength(5);
    expect(populatedSnapshot.validation.invalid_homeopathic_chunk_imports).toBe(0);
  });

  it("keeps batch and chunk audit rows immutable behind RLS", async () => {
    await expect(db.exec(`
      UPDATE public.kb_homeopathic_chunk_import_chunks
         SET chunk_hash = chunk_hash
       WHERE batch_id = '${chunkBatchId}'
    `)).rejects.toThrow(/homeopathic import chunks are immutable/i);
    await expect(db.exec(`
      DELETE FROM public.kb_homeopathic_chunk_import_chunks
       WHERE batch_id = '${chunkBatchId}'
    `)).rejects.toThrow(/chunk import audit rows are immutable/i);
    await expect(db.exec(`
      UPDATE public.kb_homeopathic_chunk_import_batches
         SET expected_bundle_hash = repeat('0', 64)
       WHERE id = '${chunkBatchId}'
    `)).rejects.toThrow(/batch identity is immutable/i);
    await expect(db.exec(`
      DELETE FROM public.kb_homeopathic_chunk_import_batches
       WHERE id = '${failedChunkBatchId}'
    `)).rejects.toThrow(/chunk import audit rows are immutable/i);
    await expect(db.exec(
      "TRUNCATE public.kb_homeopathic_chunk_import_chunks",
    )).rejects.toThrow(/chunk import audit rows are immutable/i);

    const rls = await db.query<{ relname: string; enabled: boolean }>(`
      SELECT relname, relrowsecurity AS enabled
        FROM pg_class
       WHERE oid IN (
         'public.kb_homeopathic_chunk_import_batches'::regclass,
         'public.kb_homeopathic_chunk_import_chunks'::regclass
       )
       ORDER BY relname
    `);
    expect(rls.rows).toEqual([
      { relname: "kb_homeopathic_chunk_import_batches", enabled: true },
      { relname: "kb_homeopathic_chunk_import_chunks", enabled: true },
    ]);
  });

  it("rejects noncanonical envelope types before touching stored content", async () => {
    const stringVersion = {
      ...writerBundle,
      contract_version: "1",
    };
    await expect(callSmallBundleWriter(stringVersion))
      .rejects.toThrow(/small-bundle writer envelope is invalid/i);

    const malformedAliases = structuredClone(writerBundle) as unknown as {
      remedies: Array<{ source_remedy_aliases: unknown[] }>;
    };
    malformedAliases.remedies[0].source_remedy_aliases.push(7);
    await expect(callSmallBundleWriter(malformedAliases))
      .rejects.toThrow(/small-bundle writer component shape is invalid/i);

    const impossibleChunkManifest = {
      ...chunkBatchEnvelope(chunkBatchId, writerBundle.expected_bundle_hash),
      expected_chunk_hashes: Array.from(
        { length: 7 },
        (_, index) => (index + 1).toString(16).padStart(64, "0"),
      ),
    };
    await expect(beginChunkImport(impossibleChunkManifest))
      .rejects.toThrow(/chunk import batch envelope is invalid/i);
    expect(await readContentRowCounts()).toEqual(writerCountsAfterReplay);
  });

  it("rejects a divergent replay without changing the stored bundle", async () => {
    expect(divergentWriterFailureMessage)
      .toMatch(/rubric replay differs from stored content/i);
    expect(writerCountsAfterReplay).toEqual({
      details: 1,
      rubrics: 2,
      rubricRevisions: 2,
      grades: 1,
      remedies: 2,
      assignments: 1,
    });

    const wrongRepertoryHash = structuredClone(writerBundle);
    wrongRepertoryHash.repertory.content_hash = wrongRepertoryHash.repertory.content_hash
      === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
    await expect(callSmallBundleWriter(wrongRepertoryHash))
      .rejects.toThrow(/repertory content hash is mismatched or frozen/i);
    expect(await readContentRowCounts()).toEqual(writerCountsAfterReplay);
  });

  it("builds a compact deterministic bundle manifest that is review-status neutral", () => {
    expect(draftManifest).toEqual(approvedManifest);
    expect(draftBundleHash).toBe(approvedBundleHash);
    expect(parserBundle.manifest).toEqual(draftManifest);
    expect(parserBundle.bundleHash).toBe(draftBundleHash);
    expect(writerBundle.expected_bundle_hash).toBe(draftBundleHash);
    expect(approvedBundleHash).toMatch(/^[0-9a-f]{64}$/);
    expect(approvedManifest.contract_version).toBe(1);
    expect(approvedManifest.contract_scope).toBe("HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY");
    expect(approvedManifest.component_counts).toEqual(expectedCounts);
    expect(approvedManifest.component_counts.remedies).toBe(2);
    expect(approvedManifest.component_counts.assignments).toBe(1);
    expect(approvedManifest.repertory).toEqual(expect.objectContaining({
      repertory_entity_id: repertoryId,
      repertory_revision_id: repertoryRevisionId,
      repertory_content_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      source_content_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(Object.values(approvedManifest.component_hashes)).toHaveLength(4);
    expect(Object.values(approvedManifest.component_hashes).every(
      (hash) => /^[0-9a-f]{64}$/.test(hash),
    )).toBe(true);
    expect(new Set(Object.values(approvedManifest.component_hashes)).size).toBe(4);
  });

  it("accepts exact draft and approved expectations without turning them into a release", async () => {
    expect(draftPreflight.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_READY");
    expect(draftPreflight.interpretation).toBe("IMPORT_PREFLIGHT_ONLY_NOT_RELEASE_OR_MEDICAL_USE");
    expect(draftPreflight.hash_matches).toBe(true);
    expect(draftPreflight.counts_match).toBe(true);

    const approved = await readPreflight(approvedBundleHash, expectedCounts);
    expect(approved.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_READY");
    expect(approved.actual_bundle_hash).toBe(approvedBundleHash);
    expect(approved.actual_counts).toEqual(expectedCounts);
    expect(approved.bundle_manifest).toEqual(approvedManifest);
    expect(approved.result_hash).toMatch(/^[0-9a-f]{64}$/);

    const frozenReplay = await callSmallBundleWriter(writerBundle);
    expect(frozenReplay).toEqual(firstWriterResult);
    expect(await readContentRowCounts()).toEqual(writerCountsAfterReplay);
  });

  it("matches all normalized row hashes across parser and database contracts", () => {
    expect(rowHashParity).toHaveLength(7);
    expect(rowHashParity.map((row) => row.kind)).toEqual([
      "repertory",
      "rubric",
      "rubric",
      "grade",
      "remedy",
      "remedy",
      "assignment",
    ]);
    expect(rowHashParity.every((row) =>
      row.parserHash === row.databaseHash && row.databaseHash === row.storedHash)).toBe(true);
  });

  it("distinguishes invalid expectations, mismatches, and unavailable bundles", async () => {
    const invalidHash = await readPreflight(approvedBundleHash.toUpperCase(), expectedCounts);
    expect(invalidHash.status).toBe("HOMEOPATHIC_IMPORT_EXPECTATION_INVALID");

    const invalidCounts = await readPreflight(approvedBundleHash, {
      ...expectedCounts,
      assignments: 0,
    });
    expect(invalidCounts.status).toBe("HOMEOPATHIC_IMPORT_EXPECTATION_INVALID");

    const extraCount = await readPreflight(approvedBundleHash, {
      ...expectedCounts,
      extra: 1,
    });
    expect(extraCount.status).toBe("HOMEOPATHIC_IMPORT_EXPECTATION_INVALID");

    const wrongHash = await readPreflight("0".repeat(64), expectedCounts);
    expect(wrongHash.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_MISMATCH");
    expect(wrongHash.hash_matches).toBe(false);
    expect(wrongHash.counts_match).toBe(true);

    const wrongCounts = await readPreflight(approvedBundleHash, {
      ...expectedCounts,
      assignments: 2,
    });
    expect(wrongCounts.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_MISMATCH");
    expect(wrongCounts.hash_matches).toBe(true);
    expect(wrongCounts.counts_match).toBe(false);

    const unavailable = await readPreflight(
      approvedBundleHash,
      expectedCounts,
      "32000000-0000-4000-8000-000000000099",
      "32100000-0000-4000-8000-000000000099",
    );
    expect(unavailable.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_UNAVAILABLE");
  });

  it("fails closed when stored content is tampered after trigger bypass", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_homeopathic_rubric_remedy_assignments DISABLE TRIGGER USER;
      UPDATE public.kb_homeopathic_rubric_remedy_assignments
         SET assignment_content_hash = repeat('f', 64)
       WHERE id = '${assignmentId}';
    `);
    try {
      const manifest = await readManifest();
      const preflight = await readPreflight(approvedBundleHash, expectedCounts);
      expect(manifest).toBeNull();
      expect(preflight.status).toBe("HOMEOPATHIC_IMPORT_BUNDLE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readBundleHash()).toBe(approvedBundleHash);
  });

  it("does not expose preflight or writer functions to application or import roles", async () => {
    const functions = [
      "public.kb_homeopathic_repertory_bundle_manifest_v1(uuid,uuid)",
      "public.kb_homeopathic_repertory_bundle_hash_v1(uuid,uuid)",
      "public.kb_homeopathic_import_expectations_are_valid_v1(text,jsonb)",
      "public.kb_homeopathic_repertory_import_preflight_v1(uuid,uuid,text,jsonb)",
      "public.kb_homeopathic_write_small_bundle_v1(jsonb)",
      "public.kb_homeopathic_sha256_array_is_valid_v1(text[])",
      "public.kb_homeopathic_small_expected_counts_are_valid_v1(text,jsonb)",
      "public.kb_homeopathic_writer_repertory_binding_is_valid_v1(jsonb)",
      "public.kb_homeopathic_chunk_expectations_are_valid_v1(text,jsonb,text[])",
      "public.kb_homeopathic_chunk_payload_is_valid_v1(jsonb)",
      "public.kb_homeopathic_chunk_batch_envelope_is_valid_v1(jsonb)",
      "public.kb_homeopathic_chunk_envelope_is_valid_v1(jsonb)",
      "public.kb_protect_homeopathic_chunk_import_write()",
      "public.kb_homeopathic_chunk_import_status_v1(uuid)",
      "public.kb_homeopathic_begin_chunk_import_v1(jsonb)",
      "public.kb_homeopathic_stage_import_chunk_v1(jsonb)",
      "public.kb_homeopathic_cancel_chunk_import_v1(uuid)",
      "public.kb_homeopathic_chunk_import_bundle_v1(uuid)",
      "public.kb_homeopathic_chunk_import_write_result_v1(uuid)",
      "public.kb_homeopathic_finalize_chunk_import_v1(uuid)",
      "public.kb_homeopathic_chunk_import_batch_is_valid_v1(uuid)",
      "public.kb_invalid_homeopathic_chunk_import_count()",
    ];

    await db.exec(`
      GRANT EXECUTE ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb)
      TO service_role;
      GRANT EXECUTE ON FUNCTION public.kb_homeopathic_finalize_chunk_import_v1(uuid)
      TO service_role;
      SET ROLE service_role;
    `);
    try {
      await expect(callSmallBundleWriter(writerBundle))
        .rejects.toThrow(/writes require the database table owner/i);
      await expect(finalizeChunkImport(chunkBatchId))
        .rejects.toThrow(/writes require the database table owner/i);
    } finally {
      await db.exec("RESET ROLE;").catch(() => undefined);
      await db.exec(`
        REVOKE ALL ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb)
        FROM service_role;
        REVOKE ALL ON FUNCTION public.kb_homeopathic_finalize_chunk_import_v1(uuid)
        FROM service_role;
      `);
    }

    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
        CROSS JOIN unnest($1::text[]) function_name
    `, [functions]);
    expect(privileges.rows).toHaveLength(functions.length * 5);
    expect(privileges.rows.every((row) => row.can_execute === false)).toBe(true);

    const tablePrivileges = await db.query<{ allowed: boolean }>(`
      SELECT has_table_privilege(role_name, table_name, privilege) AS allowed
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
        CROSS JOIN unnest(ARRAY[
          'public.kb_homeopathic_chunk_import_batches',
          'public.kb_homeopathic_chunk_import_chunks'
        ]::text[]) table_name
        CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]) privilege
    `);
    expect(tablePrivileges.rows).toHaveLength(5 * 2 * 4);
    expect(tablePrivileges.rows.every((row) => row.allowed === false)).toBe(true);

    const snapshotPrivileges = await db.query<{ role_name: string; allowed: boolean }>(`
      SELECT role_name,
             has_function_privilege(
               role_name, 'public.kb_export_wiki_snapshot()', 'EXECUTE'
             ) AS allowed
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
       ORDER BY role_name
    `);
    expect(snapshotPrivileges.rows.filter((row) => row.allowed).map((row) => row.role_name))
      .toEqual(["service_role"]);
  });
});
