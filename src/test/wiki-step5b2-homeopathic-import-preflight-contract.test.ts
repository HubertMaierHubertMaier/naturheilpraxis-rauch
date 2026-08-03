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
let therapySnapshotBeforePreflight = "";
let therapySnapshotAfterPreflight = "";
let therapySnapshotAfterWriterContract = "";
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
  writerBundle = await buildWriterBundleFixture();

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

    firstWriterResult = await callSmallBundleWriter(writerBundle);
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

describe.sequential("Wiki Step 5B-2 and 5B-5 homeopathic import contracts", () => {
  it("installs function-only contracts and leaves both protected snapshots byte-identical", async () => {
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
    expect(snapshotAfterPreflight).toBe(snapshotBeforePreflight);
    expect(therapySnapshotAfterPreflight).toBe(therapySnapshotBeforePreflight);
    expect(snapshotAfterWriterContract).toBe(snapshotAfterPreflight);
    expect(therapySnapshotAfterWriterContract).toBe(therapySnapshotAfterPreflight);
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
    ];

    await db.exec(`
      GRANT EXECUTE ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb)
      TO service_role;
      SET ROLE service_role;
    `);
    try {
      await expect(callSmallBundleWriter(writerBundle))
        .rejects.toThrow(/writes require the database table owner/i);
    } finally {
      await db.exec("RESET ROLE;").catch(() => undefined);
      await db.exec(`
        REVOKE ALL ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb)
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
  });
});
