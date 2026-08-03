// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
] as const;

const baseMigrations = baseMigrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const readerMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260803100000_create_kb_homeopathic_reader_contract.sql",
  ),
  "utf8",
);

const adminId = "11000000-0000-4000-8000-000000000001";
const patientId = "11000000-0000-4000-8000-000000000002";
const sourceId = "22000000-0000-4000-8000-000000000001";
const sourceRevisionId = "22100000-0000-4000-8000-000000000001";
const repertoryId = "32000000-0000-4000-8000-000000000001";
const repertoryRevisionId = "32100000-0000-4000-8000-000000000001";
const remedyIds = [
  "32000000-0000-4000-8000-000000000002",
  "32000000-0000-4000-8000-000000000003",
  "32000000-0000-4000-8000-000000000004",
] as const;
const remedyRevisionIds = [
  "32100000-0000-4000-8000-000000000002",
  "32100000-0000-4000-8000-000000000003",
  "32100000-0000-4000-8000-000000000004",
] as const;
const rubricIds = [
  "42000000-0000-4000-8000-000000000001",
  "42000000-0000-4000-8000-000000000002",
  "42000000-0000-4000-8000-000000000003",
  "42000000-0000-4000-8000-000000000004",
] as const;
const rubricRevisionIds = [
  "42100000-0000-4000-8000-000000000001",
  "42100000-0000-4000-8000-000000000002",
  "42100000-0000-4000-8000-000000000003",
  "42100000-0000-4000-8000-000000000004",
] as const;
const gradeIds = [
  "52000000-0000-4000-8000-000000000001",
  "52000000-0000-4000-8000-000000000002",
] as const;
const repertoryRemedyIds = [
  "62000000-0000-4000-8000-000000000001",
  "62000000-0000-4000-8000-000000000002",
  "62000000-0000-4000-8000-000000000003",
] as const;

type Candidate = {
  position: number;
  candidate_status: string;
  source_remedy_code: string;
  rubric_coverage: {
    matched: number;
    requested: number;
    importance_covered: number;
    importance_total: number;
  };
  domain_coverage: { matched: number; requested: number };
  excluded_rubric_conflicts: number;
  source_grade_profile: Array<{
    source_grade_code: string;
    grade_order: number;
    matched_rubric_count: number;
  }>;
  source_native_matches: Array<{ polarity: string; assignment_content_hash: string }>;
};

type ReaderResult = {
  contract_version: number;
  status: string;
  interpretation: string;
  request_hash?: string;
  result_hash: string;
  ordering_dimensions?: string[];
  candidate_count_before_limit?: number;
  returned_candidate_count?: number;
  candidates: Candidate[];
};

let db: PGlite;
let snapshotBeforeReader = "";
let snapshotAfterReader = "";
let therapySnapshotBeforeReader = "";
let therapySnapshotAfterReader = "";

const request = [
  { rubric_revision_id: rubricRevisionIds[1], importance: 5, polarity: "include" },
  { rubric_revision_id: rubricRevisionIds[2], importance: 3, polarity: "include" },
  { rubric_revision_id: rubricRevisionIds[3], importance: 4, polarity: "exclude" },
];

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
           reviewed_at = '2026-08-03T09:30:00Z',
           reviewed_by = $2::uuid
     WHERE id = $1::uuid
  `, [id, adminId]);
}

async function readResult(
  selectedRequest: unknown,
  limit = 50,
  selectedRepertoryId: string | null = repertoryId,
  selectedRevisionId: string | null = repertoryRevisionId,
): Promise<ReaderResult> {
  const result = await db.query<{ value: ReaderResult }>(`
    SELECT public.kb_homeopathic_repertorize_single_v1(
      $1::uuid, $2::uuid, $3::jsonb, $4::integer
    ) AS value
  `, [selectedRepertoryId, selectedRevisionId, JSON.stringify(selectedRequest), limit]);
  return result.rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase(db);
  for (const migration of baseMigrations) {
    await db.exec(migration);
  }
  snapshotBeforeReader = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotBeforeReader = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  await db.exec(readerMigration);
  snapshotAfterReader = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterReader = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:synthetic-reader-contract');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, rights_status, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'database',
      'Synthetic reader source', 'licensed', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${repertoryId}', 'homeopathic_repertory', 'homeopathic-repertory:synthetic-reader'),
      ('${remedyIds[0]}', 'homeopathic_remedy', 'homeopathic-remedy:reader-alpha'),
      ('${remedyIds[1]}', 'homeopathic_remedy', 'homeopathic-remedy:reader-beta'),
      ('${remedyIds[2]}', 'homeopathic_remedy', 'homeopathic-remedy:reader-gamma');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${repertoryRevisionId}', '${repertoryId}', 1, 'Synthetic reader repertory',
       'Synthetic source-native reader fixture.', 'Non-medical fixture.', repeat('0', 64)),
      ('${remedyRevisionIds[0]}', '${remedyIds[0]}', 1, 'Synthetic alpha', '', '', repeat('2', 64)),
      ('${remedyRevisionIds[1]}', '${remedyIds[1]}', 1, 'Synthetic beta', '', '', repeat('3', 64)),
      ('${remedyRevisionIds[2]}', '${remedyIds[2]}', 1, 'Synthetic gamma', '', '', repeat('4', 64));
    UPDATE public.kb_entities entity SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${repertoryId}', '${remedyIds[0]}', '${remedyIds[1]}', '${remedyIds[2]}');

    INSERT INTO public.kb_homeopathic_repertory_revision_details (
      entity_id, entity_revision_id, source_id, source_revision_id,
      source_repertory_code, source_language_code, source_locator
    ) VALUES (
      '${repertoryId}', '${repertoryRevisionId}', '${sourceId}', '${sourceRevisionId}',
      'SYN-READER-1', 'de', 'catalog:synthetic-reader:edition-1'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_homeopathic_repertory_revision_hash_v1(entity_id, id)
     WHERE id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_rubrics (
      id, repertory_entity_id, native_rubric_code
    ) VALUES
      ('${rubricIds[0]}', '${repertoryId}', 'ROOT'),
      ('${rubricIds[1]}', '${repertoryId}', 'ROOT.MIND'),
      ('${rubricIds[2]}', '${repertoryId}', 'ROOT.MODALITY'),
      ('${rubricIds[3]}', '${repertoryId}', 'ROOT.EXCLUDE');
    INSERT INTO public.kb_homeopathic_rubric_revisions (
      id, repertory_entity_id, repertory_revision_id, rubric_id,
      parent_rubric_id, rubric_text, rubric_domain, sibling_order,
      source_locator, rubric_content_hash
    ) VALUES
      ('${rubricRevisionIds[0]}', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricIds[0]}', NULL, 'Synthetic root', 'general', 1,
       'rubric:root', repeat('0', 64)),
      ('${rubricRevisionIds[1]}', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricIds[1]}', '${rubricIds[0]}', 'Synthetic mind rubric', 'mind', 1,
       'rubric:root.mind', repeat('0', 64)),
      ('${rubricRevisionIds[2]}', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricIds[2]}', '${rubricIds[0]}', 'Synthetic modality rubric', 'modality', 2,
       'rubric:root.modality', repeat('0', 64)),
      ('${rubricRevisionIds[3]}', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricIds[3]}', '${rubricIds[0]}', 'Synthetic exclusion rubric', 'general', 3,
       'rubric:root.exclude', repeat('0', 64));
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id = '${rubricRevisionIds[0]}';
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id IN ('${rubricRevisionIds[1]}', '${rubricRevisionIds[2]}', '${rubricRevisionIds[3]}');

    INSERT INTO public.kb_homeopathic_grade_definitions (
      id, repertory_entity_id, repertory_revision_id, source_grade_code,
      source_grade_label, grade_order, source_locator, grade_content_hash
    ) VALUES
      ('${gradeIds[0]}', '${repertoryId}', '${repertoryRevisionId}',
       'G-A', 'Source grade A', 1, 'grade:a', repeat('0', 64)),
      ('${gradeIds[1]}', '${repertoryId}', '${repertoryRevisionId}',
       'G-B', 'Source grade B', 2, 'grade:b', repeat('0', 64));
    UPDATE public.kb_homeopathic_grade_definitions
       SET grade_content_hash = public.kb_homeopathic_grade_definition_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_repertory_remedies (
      id, repertory_entity_id, repertory_revision_id, remedy_entity_id,
      remedy_revision_id, source_remedy_code, source_remedy_name,
      source_locator, remedy_content_hash
    ) VALUES
      ('${repertoryRemedyIds[0]}', '${repertoryId}', '${repertoryRevisionId}',
       '${remedyIds[0]}', '${remedyRevisionIds[0]}', 'R-A', 'Synthetic alpha',
       'remedy:r-a', repeat('0', 64)),
      ('${repertoryRemedyIds[1]}', '${repertoryId}', '${repertoryRevisionId}',
       '${remedyIds[1]}', '${remedyRevisionIds[1]}', 'r-B', 'Synthetic beta',
       'remedy:r-b', repeat('0', 64)),
      ('${repertoryRemedyIds[2]}', '${repertoryId}', '${repertoryRevisionId}',
       '${remedyIds[2]}', '${remedyRevisionIds[2]}', 'R-C', 'Synthetic gamma',
       'remedy:r-c', repeat('0', 64));
    UPDATE public.kb_homeopathic_repertory_remedies
       SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_rubric_remedy_assignments (
      id, repertory_entity_id, repertory_revision_id, rubric_revision_id,
      repertory_remedy_id, grade_definition_id, source_locator,
      assignment_content_hash
    ) VALUES
      ('72000000-0000-4000-8000-000000000001', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricRevisionIds[1]}', '${repertoryRemedyIds[0]}', '${gradeIds[1]}',
       'assignment:mind:r-a', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000002', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricRevisionIds[2]}', '${repertoryRemedyIds[0]}', '${gradeIds[0]}',
       'assignment:modality:r-a', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000003', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricRevisionIds[1]}', '${repertoryRemedyIds[1]}', '${gradeIds[0]}',
       'assignment:mind:r-b', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000004', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricRevisionIds[2]}', '${repertoryRemedyIds[2]}', '${gradeIds[1]}',
       'assignment:modality:r-c', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000005', '${repertoryId}', '${repertoryRevisionId}',
       '${rubricRevisionIds[3]}', '${repertoryRemedyIds[2]}', '${gradeIds[1]}',
       'assignment:exclude:r-c', repeat('0', 64));
    UPDATE public.kb_homeopathic_rubric_remedy_assignments
       SET assignment_content_hash = public.kb_homeopathic_assignment_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);

  await approveRevision("kb_source_revisions", sourceRevisionId, false);
  for (const revisionId of remedyRevisionIds) {
    await approveRevision("kb_entity_revisions", revisionId, true);
  }
  await approveRevision("kb_entity_revisions", repertoryRevisionId, true);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki Step 5B-1 homeopathic reader contract", () => {
  it("is function-only, keeps the 65-table snapshot byte-identical, and leaves release v1 inactive", () => {
    expect(readerMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(4);
    expect(readerMigration).not.toMatch(/CREATE TABLE|ALTER TABLE|INSERT INTO|GRANT EXECUTE/);
    expect(readerMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|user_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(readerMigration).toContain("HOMEOPATHIC_LANE_UNAVAILABLE");
    expect(readerMigration).toContain("SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY");
    expect(snapshotAfterReader).toBe(snapshotBeforeReader);
    expect(therapySnapshotAfterReader).toBe(therapySnapshotBeforeReader);
    expect(baseMigrations.at(-5)).toContain("CHECK (NOT retrieval_eligible)");
    expect(baseMigrations.at(-5)).toContain("CHECK (NOT is_active)");
  });

  it("fails closed for unavailable repertories and malformed requests", async () => {
    const unavailable = await readResult(
      request,
      50,
      "32000000-0000-4000-8000-000000000099",
      "32100000-0000-4000-8000-000000000099",
    );
    expect(unavailable.status).toBe("HOMEOPATHIC_LANE_UNAVAILABLE");
    expect(unavailable.candidates).toEqual([]);
    expect(unavailable.request_hash).toBeUndefined();

    const missingIdentifiers = await readResult(request, 50, null, null);
    expect(missingIdentifiers.status).toBe("HOMEOPATHIC_LANE_UNAVAILABLE");
    expect(missingIdentifiers.candidates).toEqual([]);

    const malformed = await readResult([
      { rubric_revision_id: rubricRevisionIds[1], importance: 6, polarity: "include" },
    ]);
    expect(malformed.status).toBe("HOMEOPATHIC_REQUEST_INVALID");
    expect(malformed.candidates).toEqual([]);

    const nonArray = await readResult({ rubrics: request });
    expect(nonArray.status).toBe("HOMEOPATHIC_REQUEST_INVALID");

    const duplicated = await readResult([
      request[0],
      { ...request[0], polarity: "exclude" },
    ]);
    expect(duplicated.status).toBe("HOMEOPATHIC_REQUEST_INVALID");

    const oversized = await readResult([
      { rubric_revision_id: "x".repeat(131072), importance: 1, polarity: "include" },
    ]);
    expect(oversized.status).toBe("HOMEOPATHIC_REQUEST_INVALID");
  });

  it("orders exact source-native matches by separate deterministic dimensions", async () => {
    const result = await readResult(request);
    expect(result.status).toBe("HOMEOPATHIC_REPERTORY_MATCHES_READY");
    expect(result.interpretation).toBe("SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY");
    expect(result.candidate_count_before_limit).toBe(3);
    expect(result.returned_candidate_count).toBe(3);
    expect(result.candidates.map((candidate) => candidate.source_remedy_code)).toEqual([
      "R-A", "r-B", "R-C",
    ]);
    expect(result.ordering_dimensions).toContain("normalized_source_remedy_code_asc");
    expect(result.candidates.map((candidate) => candidate.candidate_status)).toEqual([
      "REPERTORY_MATCH_ONLY", "REPERTORY_MATCH_ONLY", "REPERTORY_MATCH_ONLY",
    ]);

    const [alpha, beta, gamma] = result.candidates;
    expect(alpha.rubric_coverage).toEqual({
      matched: 2,
      requested: 2,
      importance_covered: 8,
      importance_total: 8,
    });
    expect(alpha.domain_coverage).toEqual({ matched: 2, requested: 2 });
    expect(alpha.excluded_rubric_conflicts).toBe(0);
    expect(alpha.source_grade_profile).toEqual([
      expect.objectContaining({ source_grade_code: "G-A", grade_order: 1, matched_rubric_count: 1 }),
      expect.objectContaining({ source_grade_code: "G-B", grade_order: 2, matched_rubric_count: 1 }),
    ]);
    expect(beta.rubric_coverage.importance_covered).toBe(5);
    expect(gamma.excluded_rubric_conflicts).toBe(1);
    expect(gamma.source_native_matches.some((match) => match.polarity === "exclude")).toBe(true);
    expect(result.request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.result_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalizes request order and preserves total counts when limiting output", async () => {
    const forward = await readResult(request);
    const reversed = await readResult([...request].reverse());
    expect(reversed).toEqual(forward);

    const limited = await readResult(request, 2);
    expect(limited.candidate_count_before_limit).toBe(3);
    expect(limited.returned_candidate_count).toBe(2);
    expect(limited.candidates.map((candidate) => candidate.position)).toEqual([1, 2]);

    const invalidLimit = await readResult(request, 0);
    expect(invalidLimit.status).toBe("HOMEOPATHIC_REQUEST_INVALID");
  });

  it("does not expose the reader to application or import roles", async () => {
    const functions = [
      "public.kb_homeopathic_repertory_lane_status_v1(uuid,uuid)",
      "public.kb_homeopathic_repertorization_request_is_valid_v1(uuid,uuid,jsonb)",
      "public.kb_homeopathic_repertorization_request_manifest_v1(uuid,uuid,jsonb)",
      "public.kb_homeopathic_repertorize_single_v1(uuid,uuid,jsonb,integer)",
    ];
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
