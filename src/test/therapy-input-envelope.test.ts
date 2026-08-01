// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateTherapyInputSubsetPayload } from "@/lib/therapyInputBackup";

const migrationFile = "20260731120000_create_therapy_input_envelope.sql";
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", migrationFile),
  "utf8",
);
const backupAreasSource = readFileSync(
  resolve(process.cwd(), "src/lib/backupAreas.ts"),
  "utf8",
);
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
const revisionId = "91000000-0000-4000-8000-000000000001";
const sourceId = "92000000-0000-4000-8000-000000000001";
const largeNumberRevisionId = "91000000-0000-4000-8000-000000000002";
const largeNumberSourceId = "92000000-0000-4000-8000-000000000002";
const pseudonymId = "P-2026-0001";
const deidentificationVersion = "clinical-deidentification-v1";
const sourcePayload = {
  format: "text",
  text: "Ferritin 18 ug/l",
  language: "de",
};
const inputEnvelope = {
  format: "therapy_input_envelope_v1",
  clinical_text: "Muedigkeit seit drei Monaten",
  context: { age_years: 52, sex: "female" },
};

const therapyInputTables = [
  "therapy_input_revisions",
  "therapy_input_sources",
] as const;
const protectedRoles = [
  "authenticated",
  "service_role",
  "anon",
  "kb_importer",
  "kb_import_runtime",
] as const;
const functionSignatures = [
  "public.therapy_input_pii_text_is_safe_v1(text)",
  "public.therapy_input_pii_jsonb_is_safe_v1(jsonb)",
  "public.therapy_input_envelope_shape_is_valid_v1(jsonb)",
  "public.therapy_input_source_payload_shape_is_valid_v1(jsonb)",
  "public.therapy_input_canonical_jsonb_v1(jsonb)",
  "public.therapy_input_jsonb_sha256_v1(jsonb)",
  "public.therapy_input_source_manifest_v1(uuid)",
  "public.therapy_input_envelope_sha256_v1(uuid)",
  "public.therapy_input_revision_is_valid_v1(uuid)",
  "public.therapy_input_invalid_revision_count_v1()",
  "public.therapy_input_export_snapshot_v1()",
  "public.therapy_input_protect_append_only()",
  "public.therapy_input_validate_revision_v1()",
] as const;

type HashRow = { hash: string };
type TherapyInputSnapshot = {
  snapshot_version: number;
  tables: Record<(typeof therapyInputTables)[number], string>;
  manifest: Record<(typeof therapyInputTables)[number], { rows: number; sha256: string }>;
  validation: { invalid_revision_count: number };
};

let db: PGlite;
let sourceHash = "";
let envelopeHash = "";
let patientSessionBefore = "";
let patientSnapshotBefore = "";
let emptyRevisionCount = -1;
let emptySourceCount = -1;

async function enterRole(role: string, userId?: string): Promise<void> {
  await db.exec(`SET ROLE ${role};`);
  if (userId) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
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

async function hashJson(value: unknown): Promise<string> {
  const result = await db.query<HashRow>(
    "SELECT public.therapy_input_jsonb_sha256_v1($1::jsonb) AS hash",
    [JSON.stringify(value)],
  );
  return result.rows[0].hash;
}

async function exportSnapshot(): Promise<TherapyInputSnapshot> {
  const result = await db.query<{ snapshot: string }>(
    "SELECT public.therapy_input_export_snapshot_v1() AS snapshot",
  );
  return JSON.parse(result.rows[0].snapshot) as TherapyInputSnapshot;
}

async function insertValidEnvelope(): Promise<void> {
  sourceHash = await hashJson({
    hash_schema_version: 1,
    source_order: 1,
    neutral_source_id: "laboratory:artifact:abcdef123456",
    source_type: "laboratory",
    document_date: "2026-07-20",
    source_locator: "page:2",
    source_payload: sourcePayload,
  });
  envelopeHash = await hashJson({
    envelope_schema_version: 1,
    hash_schema_version: 1,
    deidentification_version: deidentificationVersion,
    data_classification: "pseudonymized_health_data",
    pseudonym_id: pseudonymId,
    input_envelope: inputEnvelope,
    source_count: 1,
    sources: [{
      source_order: 1,
      neutral_source_id: "laboratory:artifact:abcdef123456",
      source_type: "laboratory",
      document_date: "2026-07-20",
      source_locator: "page:2",
      content_sha256: sourceHash,
    }],
  });

  await db.exec("BEGIN;");
  try {
    // The deferred FK and integrity trigger intentionally allow child-first capture.
    await db.query(
      `INSERT INTO public.therapy_input_sources (
         id, therapy_input_revision_id, source_order, neutral_source_id,
         source_type, document_date, source_locator, source_payload, content_sha256
       ) VALUES ($1, $2, 1, 'laboratory:artifact:abcdef123456', 'laboratory',
         '2026-07-20', 'page:2', $3::jsonb, $4)`,
      [sourceId, revisionId, JSON.stringify(sourcePayload), sourceHash],
    );
    await db.query(
      `INSERT INTO public.therapy_input_revisions (
         id, pseudonym_id, deidentification_version, input_envelope,
         source_count, content_sha256, captured_by
       ) VALUES ($1, $2, $3, $4::jsonb, 1, $5, $6)`,
      [
        revisionId,
        pseudonymId,
        deidentificationVersion,
        JSON.stringify(inputEnvelope),
        envelopeHash,
        adminId,
      ],
    );
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function insertLargeNumericEnvelope(): Promise<void> {
  const largeSourcePayload = '{"format":"text","language":"und","text":"Exact integer 9007199254740993"}';
  const largeInputEnvelope = '{"clinical_text":"Exact integer 9007199254740993","context":{},"format":"therapy_input_envelope_v1"}';
  const sourceHashResult = await db.query<HashRow>(`
    SELECT public.therapy_input_jsonb_sha256_v1(jsonb_build_object(
      'hash_schema_version', 1,
      'source_order', 1,
      'neutral_source_id', 'manual_input:artifact:1234567890ab',
      'source_type', 'manual_input',
      'document_date', NULL,
      'source_locator', '',
      'source_payload', $1::jsonb
    )) AS hash
  `, [largeSourcePayload]);
  const largeSourceHash = sourceHashResult.rows[0].hash;
  const manifest = [{
    source_order: 1,
    neutral_source_id: "manual_input:artifact:1234567890ab",
    source_type: "manual_input",
    document_date: null,
    source_locator: "",
    content_sha256: largeSourceHash,
  }];
  const envelopeHashResult = await db.query<HashRow>(`
    SELECT public.therapy_input_jsonb_sha256_v1(jsonb_build_object(
      'envelope_schema_version', 1,
      'hash_schema_version', 1,
      'deidentification_version', $1::text,
      'data_classification', 'pseudonymized_health_data',
      'pseudonym_id', 'P-2026-0002',
      'input_envelope', $2::jsonb,
      'source_count', 1,
      'sources', $3::jsonb
    )) AS hash
  `, [deidentificationVersion, largeInputEnvelope, JSON.stringify(manifest)]);

  await db.exec("BEGIN;");
  try {
    await db.query(
      `INSERT INTO public.therapy_input_revisions (
         id, pseudonym_id, deidentification_version, input_envelope,
         source_count, content_sha256, captured_by
       ) VALUES ($1, 'P-2026-0002', $2, $3::jsonb, 1, $4, $5)`,
      [
        largeNumberRevisionId,
        deidentificationVersion,
        largeInputEnvelope,
        envelopeHashResult.rows[0].hash,
        adminId,
      ],
    );
    await db.query(
      `INSERT INTO public.therapy_input_sources (
         id, therapy_input_revision_id, source_order, neutral_source_id,
         source_type, source_payload, content_sha256
       ) VALUES (
         $1, $2, 1, 'manual_input:artifact:1234567890ab',
         'manual_input', $3::jsonb, $4
       )`,
      [largeNumberSourceId, largeNumberRevisionId, largeSourcePayload, largeSourceHash],
    );
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE kb_importer NOLOGIN NOINHERIT NOBYPASSRLS;
    CREATE ROLE kb_import_runtime NOLOGIN NOINHERIT NOBYPASSRLS;
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

    CREATE TABLE public.therapy_sessions (
      id uuid PRIMARY KEY,
      pseudonym_id text NOT NULL,
      eingabe_daten jsonb NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE public.patient_snapshot (
      pseudonym_id text PRIMARY KEY,
      data jsonb NOT NULL,
      source_session_id uuid,
      updated_at timestamptz NOT NULL
    );

    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
    INSERT INTO public.therapy_sessions (
      id, pseudonym_id, eingabe_daten, created_at
    ) VALUES (
      '93000000-0000-4000-8000-000000000001',
      'P-2026-0099',
      '{"marker":"byte-identical-session","nested":[1,2,3]}'::jsonb,
      '2026-07-30T12:00:00Z'
    );
    INSERT INTO public.patient_snapshot (
      pseudonym_id, data, source_session_id, updated_at
    ) VALUES (
      'P-2026-0099',
      '{"marker":"byte-identical-snapshot","flag":true}'::jsonb,
      '93000000-0000-4000-8000-000000000001',
      '2026-07-30T12:30:00Z'
    );
  `);
  await db.exec("SET TIME ZONE 'UTC';");

  const patientBefore = await db.query<{
    session_text: string;
    snapshot_text: string;
  }>(`
    SELECT
      (SELECT row_to_json(session_row)::text FROM (
        SELECT * FROM public.therapy_sessions
         WHERE id = '93000000-0000-4000-8000-000000000001'
      ) session_row) AS session_text,
      (SELECT row_to_json(snapshot_row)::text FROM (
        SELECT * FROM public.patient_snapshot WHERE pseudonym_id = 'P-2026-0099'
      ) snapshot_row) AS snapshot_text
  `);
  patientSessionBefore = patientBefore.rows[0].session_text;
  patientSnapshotBefore = patientBefore.rows[0].snapshot_text;

  await db.exec(migration);

  const emptyCounts = await db.query<{ revisions: number; sources: number }>(`
    SELECT
      (SELECT count(*)::int FROM public.therapy_input_revisions) AS revisions,
      (SELECT count(*)::int FROM public.therapy_input_sources) AS sources
  `);
  emptyRevisionCount = emptyCounts.rows[0].revisions;
  emptySourceCount = emptyCounts.rows[0].sources;

  await insertValidEnvelope();
  await insertLargeNumericEnvelope();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("therapy input envelope Step 3A", () => {
  it("creates only the two Step 3A tables with the exact column boundary", async () => {
    const createdTables = Array.from(
      migration.matchAll(/CREATE TABLE public\.(therapy_input_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual([...therapyInputTables]);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toContain("therapy_input_facts");
    expect(migration).not.toContain("therapy_input_fact_sources");
    expect(migration).toContain("CREATE FUNCTION public.therapy_input_pii_text_is_safe_v1");
    expect(migration).toContain("CREATE FUNCTION public.therapy_input_pii_jsonb_is_safe_v1");
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.therapy_input_pii_text_is_safe_v1",
    );
    expect(migration).toContain("deidentification_version = 'clinical-deidentification-v1'");

    const columns = await db.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
    }>(`
      SELECT table_name, column_name, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY(ARRAY['therapy_input_revisions', 'therapy_input_sources'])
       ORDER BY table_name, ordinal_position
    `);
    expect(columns.rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`)).toEqual([
      "therapy_input_revisions.id",
      "therapy_input_revisions.pseudonym_id",
      "therapy_input_revisions.envelope_schema_version",
      "therapy_input_revisions.hash_schema_version",
      "therapy_input_revisions.deidentification_version",
      "therapy_input_revisions.data_classification",
      "therapy_input_revisions.input_envelope",
      "therapy_input_revisions.source_count",
      "therapy_input_revisions.content_sha256",
      "therapy_input_revisions.captured_at",
      "therapy_input_revisions.captured_by",
      "therapy_input_sources.id",
      "therapy_input_sources.therapy_input_revision_id",
      "therapy_input_sources.source_order",
      "therapy_input_sources.neutral_source_id",
      "therapy_input_sources.source_type",
      "therapy_input_sources.document_date",
      "therapy_input_sources.source_locator",
      "therapy_input_sources.source_payload",
      "therapy_input_sources.content_sha256",
    ]);
    expect(columns.rows.filter((column) => column.is_nullable === "YES").map((column) => (
      `${column.table_name}.${column.column_name}`
    ))).toEqual(["therapy_input_sources.document_date"]);
    expect(columns.rows.some((column) => column.column_name === "updated_at")).toBe(false);
  });

  it("uses one deferred restricted FK and stores no direct patient lineage", async () => {
    const foreignKeys = await db.query<{
      source_table: string;
      target_table: string;
      delete_action: string;
      is_deferrable: boolean;
      is_deferred: boolean;
    }>(`
      SELECT source.relname AS source_table,
             target.relname AS target_table,
             fk.confdeltype::text AS delete_action,
             fk.condeferrable AS is_deferrable,
             fk.condeferred AS is_deferred
        FROM pg_constraint fk
        JOIN pg_class source ON source.oid = fk.conrelid
        JOIN pg_class target ON target.oid = fk.confrelid
       WHERE fk.contype = 'f'
         AND source.relname = ANY(ARRAY['therapy_input_revisions', 'therapy_input_sources'])
    `);
    expect(foreignKeys.rows).toEqual([{
      source_table: "therapy_input_sources",
      target_table: "therapy_input_revisions",
      delete_action: "r",
      is_deferrable: true,
      is_deferred: true,
    }]);
    expect(migration).not.toMatch(
      /\b(patient_id|patient_user_id|auth_user_id|therapy_session_id|source_session_id|parent_session_id|anamnesis_id|iaa_submission_id)\b/i,
    );
    expect(migration).not.toMatch(/REFERENCES\s+(?:public\.)?(?:therapy_sessions|patient_snapshot|auth\.users|kb_)/i);
  });

  it("canonicalizes JSON recursively and hashes it deterministically", async () => {
    const first = await hashJson({ z: [1, { b: 2, a: 3 }], a: "value" });
    const second = await hashJson({ a: "value", z: [1, { a: 3, b: 2 }] });
    const differentArrayOrder = await hashJson({ a: "value", z: [{ a: 3, b: 2 }, 1] });
    expect(first).toBe(second);
    expect(first).not.toBe(differentArrayOrder);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    const numeric = await db.query<{ one: string; decimal: string }>(`
      SELECT
        public.therapy_input_jsonb_sha256_v1('{"n":1}'::jsonb) AS one,
        public.therapy_input_jsonb_sha256_v1('{"n":1.00}'::jsonb) AS decimal
    `);
    expect(numeric.rows[0].one).toBe(numeric.rows[0].decimal);

    const golden = await db.query<HashRow>(`
      SELECT public.therapy_input_jsonb_sha256_v1(
        '{"a":"Ueberblick","array":[true,2,"x"],"nested":{"n":1.00,"z":null}}'::jsonb
      ) AS hash
    `);
    expect(golden.rows[0].hash).toBe(
      "d45cdb44df951bbedadef2681f7ff772cc85a55f943190aeac070e589f00ff9c",
    );
  });

  it("accepts one atomic child-first envelope and validates its complete hash chain", async () => {
    const valid = await db.query<{
      stored_hash: string;
      calculated_hash: string;
      source_hash: string;
      is_valid: boolean;
      invalid_count: number;
    }>(`
      SELECT revision.content_sha256 AS stored_hash,
             public.therapy_input_envelope_sha256_v1(revision.id) AS calculated_hash,
             source.content_sha256 AS source_hash,
             public.therapy_input_revision_is_valid_v1(revision.id) AS is_valid,
             public.therapy_input_invalid_revision_count_v1()::int AS invalid_count
        FROM public.therapy_input_revisions revision
        JOIN public.therapy_input_sources source
          ON source.therapy_input_revision_id = revision.id
       WHERE revision.id = '${revisionId}'
    `);
    expect(valid.rows[0]).toEqual({
      stored_hash: envelopeHash,
      calculated_hash: envelopeHash,
      source_hash: sourceHash,
      is_valid: true,
      invalid_count: 0,
    });
  });

  it("rejects raw identifier and name fields while allowing semantic clinical labels", async () => {
    const safety = await db.query<{
      full_name: boolean;
      signature_name: boolean;
      guardian_name: boolean;
      dentist_name: boolean;
      insurance_number: boolean;
      private_phone: boolean;
      signer_birthdate: boolean;
      guardian_landline: boolean;
      medication_name: boolean;
      medication_compound_name: boolean;
      medication_label: boolean;
      product_label: boolean;
    }>(`
      SELECT
        public.therapy_input_pii_jsonb_is_safe_v1('{"fullName":"Erika Beispiel"}'::jsonb)
          AS full_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"unterschrift":{"nameInDruckbuchstaben":"Erika Beispiel"}}'::jsonb
        ) AS signature_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"sorgeberechtigterVorname":"Erika"}'::jsonb
        ) AS guardian_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"zahngesundheit":{"zahnarztName":"Dr Beispiel"}}'::jsonb
        ) AS dentist_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"versicherungsnummer":"A123456789"}'::jsonb
        ) AS insurance_number,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"telefonPrivat":"0821 123456"}'::jsonb
        ) AS private_phone,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"geburtsdatumUnterzeichner":"01.02.1980"}'::jsonb
        ) AS signer_birthdate,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"sorgeberechtigterFestnetz":"0821 123456"}'::jsonb
        ) AS guardian_landline,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"medicationsTherapies":[{"name":"Metformin"}]}'::jsonb
        ) AS medication_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"medicationName":"Metformin"}'::jsonb
        ) AS medication_compound_name,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"medications":[{"medication_label":"Metformin"}]}'::jsonb
        ) AS medication_label,
        public.therapy_input_pii_jsonb_is_safe_v1(
          '{"orders":[{"product_label":"Magnesium"}]}'::jsonb
        ) AS product_label
    `);
    expect(safety.rows[0]).toEqual({
      full_name: false,
      signature_name: false,
      guardian_name: false,
      dentist_name: false,
      insurance_number: false,
      private_phone: false,
      signer_birthdate: false,
      guardian_landline: false,
      medication_name: false,
      medication_compound_name: false,
      medication_label: true,
      product_label: true,
    });
  });

  it("enforces positive canonical envelope, source payload, and locator shapes", async () => {
    const shapes = await db.query<{
      canonical_envelope: boolean;
      patient_label: boolean;
      order_number: boolean;
      contact_object: boolean;
      insurance_object: boolean;
      document_path: boolean;
      canonical_source: boolean;
      filename_source: boolean;
      hidden_pii_json: boolean;
      invalid_canonical_json: boolean;
      hidden_pii_json_as_text: boolean;
      redaction_marker: boolean;
      labeled_redaction_marker: boolean;
      name_redaction_marker: boolean;
      clinical_reference_range: boolean;
      patient_redaction_marker: boolean;
      patientin_redaction_marker: boolean;
      insured_redaction_marker: boolean;
    }>(`
      SELECT
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"format":"therapy_input_envelope_v1","clinical_text":"Muedigkeit","context":{"age_years":52}}'::jsonb
        ) AS canonical_envelope,
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"patient_label":"Erika Beispiel"}'::jsonb
        ) AS patient_label,
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"order_number":"B-2026-0010-1"}'::jsonb
        ) AS order_number,
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"contact":{"type":"phone","value":"08211234567"}}'::jsonb
        ) AS contact_object,
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"insurance":{"id":"A123456789"}}'::jsonb
        ) AS insurance_object,
        public.therapy_input_envelope_shape_is_valid_v1(
          '{"document_path":"patient/Erika_Beispiel.pdf"}'::jsonb
        ) AS document_path,
        public.therapy_input_source_payload_shape_is_valid_v1(
          '{"format":"text","text":"Ferritin 18 ug/l","language":"de"}'::jsonb
        ) AS canonical_source,
        public.therapy_input_source_payload_shape_is_valid_v1(
          '{"format":"text","text":"Befund_Erika_Beispiel.pdf","language":"de"}'::jsonb
        ) AS filename_source,
        public.therapy_input_source_payload_shape_is_valid_v1(
          '{"format":"canonical_json_text","text":"{\\"patient_label\\":\\"Erika Beispiel\\"}","language":"de"}'::jsonb
        ) AS hidden_pii_json,
        public.therapy_input_source_payload_shape_is_valid_v1(
          '{"format":"canonical_json_text","text":"not json at all","language":"und"}'::jsonb
        ) AS invalid_canonical_json,
        public.therapy_input_source_payload_shape_is_valid_v1(
          '{"format":"text","text":"{\\"patient_label\\":\\"Erika Beispiel\\",\\"contact\\":{\\"type\\":\\"phone\\",\\"value\\":\\"08211234567\\"}}","language":"de"}'::jsonb
        ) AS hidden_pii_json_as_text,
        public.therapy_input_pii_text_is_safe_v1('[personenbezogene Angabe entfernt]')
          AS redaction_marker,
        public.therapy_input_pii_text_is_safe_v1('Name: [personenbezogene Angabe entfernt]')
          AS labeled_redaction_marker,
        public.therapy_input_pii_text_is_safe_v1('[Name entfernt]')
          AS name_redaction_marker,
        public.therapy_input_pii_text_is_safe_v1('TSH 2.1 mIU/l [0.4-4.0]')
          AS clinical_reference_range,
        public.therapy_input_pii_text_is_safe_v1(
          'Patient: [personenbezogene Angabe entfernt]'
        ) AS patient_redaction_marker,
        public.therapy_input_pii_text_is_safe_v1('Patientin: [Name entfernt]')
          AS patientin_redaction_marker,
        public.therapy_input_pii_text_is_safe_v1(
          'Versicherter: [personenbezogene Angabe entfernt]'
        ) AS insured_redaction_marker
    `);
    expect(shapes.rows[0]).toEqual({
      canonical_envelope: true,
      patient_label: false,
      order_number: false,
      contact_object: false,
      insurance_object: false,
      document_path: false,
      canonical_source: true,
      filename_source: false,
      hidden_pii_json: false,
      invalid_canonical_json: false,
      hidden_pii_json_as_text: false,
      redaction_marker: true,
      labeled_redaction_marker: true,
      name_redaction_marker: true,
      clinical_reference_range: true,
      patient_redaction_marker: true,
      patientin_redaction_marker: true,
      insured_redaction_marker: true,
    });
  });

  it("rejects unsafe identifiers and invalid envelope domains", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_revisions (
        pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        'Max Mustermann', '${deidentificationVersion}', '{}'::jsonb,
        1, repeat('0', 64), '${adminId}'
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_revisions (
        pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        'P-2026-0002', '${deidentificationVersion}', '[]'::jsonb,
        1, repeat('0', 64), '${adminId}'
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'Befund_Mustermann.pdf',
        'laboratory', '{}'::jsonb, repeat('0', 64)
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'complementary_measurement:artifact:abcdef123456',
        'diagnosis', '{}'::jsonb, repeat('0', 64)
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_revisions (
        pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        'P-2026-0090', '${deidentificationVersion}',
        '{"email":"patient@example.com"}'::jsonb,
        1, repeat('0', 64), '${adminId}'
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'manual_input:artifact:abcdef123456',
        'manual_input', '{"patientId":"direct-id"}'::jsonb, repeat('0', 64)
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_revisions (
        pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        'P-2026-0091', '${deidentificationVersion}',
        '{"clinical_text":"Patient: Erika Beispiel Prostata Karzinom"}'::jsonb,
        1, repeat('0', 64), '${adminId}'
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_locator, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'manual_input:artifact:abcdef123456',
        'manual_input', 'Patient: Erika Beispiel Prostata Karzinom',
        '{}'::jsonb, repeat('0', 64)
      );
    `, /check constraint/i);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_locator, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'manual_input:artifact:abcdef123456',
        'manual_input', 'patient/Erika_Beispiel.pdf',
        '{"format":"text","text":"Neutral","language":"de"}'::jsonb,
        repeat('0', 64)
      );
    `, /check constraint/i);
  });

  it("rejects incomplete envelopes and source or parent hash drift", async () => {
    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        '91000000-0000-4000-8000-000000000004', 'P-2026-0004',
        '${deidentificationVersion}',
        '{"format":"therapy_input_envelope_v1","clinical_text":"","context":{}}'::jsonb,
        1, repeat('0', 64), '${adminId}'
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Therapy input revision integrity check failed/);

    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_payload, content_sha256
      ) VALUES (
        '92000000-0000-4000-8000-000000000003',
        '91000000-0000-4000-8000-000000000003', 1,
        'manual_input:artifact:abcdef123456', 'manual_input',
        '{"format":"text","text":"","language":"und"}'::jsonb,
        repeat('0', 64)
      );
      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, deidentification_version, input_envelope,
        source_count, content_sha256, captured_by
      ) VALUES (
        '91000000-0000-4000-8000-000000000003', 'P-2026-0003',
        '${deidentificationVersion}',
        '{"format":"therapy_input_envelope_v1","clinical_text":"","context":{}}'::jsonb,
        1, repeat('f', 64), '${adminId}'
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Therapy input revision integrity check failed/);
  });

  it("makes both envelope tables append-only", async () => {
    await expect(db.exec(`
      UPDATE public.therapy_input_revisions
         SET input_envelope = '{"changed":true}'::jsonb
       WHERE id = '${revisionId}'
    `)).rejects.toThrow(/Therapy input envelope is append-only/);
    await expect(db.exec(`
      UPDATE public.therapy_input_revisions
         SET captured_at = now()
       WHERE id = '${revisionId}'
    `)).rejects.toThrow(/Therapy input envelope is append-only/);
    await expect(db.exec(`
      DELETE FROM public.therapy_input_revisions WHERE id = '${revisionId}'
    `)).rejects.toThrow(/Therapy input envelope is append-only/);
    await expect(db.exec(`
      UPDATE public.therapy_input_sources
         SET source_payload = '{"changed":true}'::jsonb
       WHERE id = '${sourceId}'
    `)).rejects.toThrow(/Therapy input envelope is append-only/);
    await expect(db.exec(`
      DELETE FROM public.therapy_input_sources WHERE id = '${sourceId}'
    `)).rejects.toThrow(/Therapy input envelope is append-only/);
  });

  it("does not permit extending an already sealed revision", async () => {
    const extraSourceHash = await hashJson({
      hash_schema_version: 1,
      source_order: 2,
      neutral_source_id: "manual_input:artifact:fedcba654321",
      source_type: "manual_input",
      document_date: null,
      source_locator: "",
      source_payload: { format: "text", text: "Weitere Notiz", language: "de" },
    });
    await expectTransactionFailure(`
      INSERT INTO public.therapy_input_sources (
        therapy_input_revision_id, source_order, neutral_source_id,
        source_type, source_payload, content_sha256
      ) VALUES (
        '${revisionId}', 2, 'manual_input:artifact:fedcba654321', 'manual_input',
        '{"format":"text","text":"Weitere Notiz","language":"de"}'::jsonb,
        '${extraSourceHash}'
      );
      SET CONSTRAINTS ALL IMMEDIATE;
    `, /Therapy input revision integrity check failed/);
  });

  it("detects trigger-disabled corruption for backup and restore validation", async () => {
    await db.exec("BEGIN;");
    try {
      await db.exec("ALTER TABLE public.therapy_input_sources DISABLE TRIGGER USER;");
      await db.exec(`
        UPDATE public.therapy_input_sources
           SET source_payload = '{"format":"text","text":"Tampered","language":"de"}'::jsonb
         WHERE id = '${sourceId}'
      `);
      const invalid = await db.query<{ is_valid: boolean; invalid_count: number }>(`
        SELECT public.therapy_input_revision_is_valid_v1('${revisionId}') AS is_valid,
               public.therapy_input_invalid_revision_count_v1()::int AS invalid_count
      `);
      expect(invalid.rows[0]).toEqual({ is_valid: false, invalid_count: 1 });
    } finally {
      await db.exec("ROLLBACK;");
    }

    const restored = await db.query<{ is_valid: boolean; invalid_count: number }>(`
      SELECT public.therapy_input_revision_is_valid_v1('${revisionId}') AS is_valid,
             public.therapy_input_invalid_revision_count_v1()::int AS invalid_count
    `);
    expect(restored.rows[0]).toEqual({ is_valid: true, invalid_count: 0 });
  });

  it("exports one atomic lossless snapshot and restores it in one owner transaction", async () => {
    const original = await exportSnapshot();
    expect(original.snapshot_version).toBe(1);
    expect(original.validation).toEqual({ invalid_revision_count: 0 });
    expect(Object.keys(original.tables).sort()).toEqual([...therapyInputTables].sort());
    expect(Object.keys(original.manifest).sort()).toEqual([...therapyInputTables].sort());
    expect(original.manifest.therapy_input_revisions.rows).toBe(2);
    expect(original.manifest.therapy_input_sources.rows).toBe(2);
    expect(original.tables.therapy_input_revisions).toContain("9007199254740993");
    expect(original.tables.therapy_input_sources).toContain("9007199254740993");

    await db.exec("SET TIME ZONE 'Europe/Berlin';");
    try {
      const alternateTimezone = await exportSnapshot();
      expect(alternateTimezone.tables).toEqual(original.tables);
      expect(alternateTimezone.manifest).toEqual(original.manifest);
    } finally {
      await db.exec("SET TIME ZONE 'UTC';");
    }

    for (const table of therapyInputTables) {
      const calculated = await db.query<HashRow>(
        "SELECT encode(sha256(convert_to($1::text, 'UTF8')), 'hex') AS hash",
        [original.tables[table]],
      );
      expect(calculated.rows[0].hash).toBe(original.manifest[table].sha256);
    }

    const transportedPayload = JSON.parse(JSON.stringify({
      tables: Object.fromEntries(therapyInputTables.map((table) => [table, {
        serializedRows: original.tables[table],
        rowCount: original.manifest[table].rows,
      }])),
      therapyInputSnapshotVersion: original.snapshot_version,
      therapyInputSnapshotManifest: original.manifest,
      therapyInputValidation: original.validation,
    }));
    expect(transportedPayload.tables.therapy_input_revisions.serializedRows)
      .toContain("9007199254740993");
    await expect(validateTherapyInputSubsetPayload(transportedPayload))
      .rejects.toThrow(/Snapshot-Version/);

    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      await db.exec("ALTER TABLE public.therapy_input_revisions DISABLE TRIGGER USER;");
      await db.exec("ALTER TABLE public.therapy_input_sources DISABLE TRIGGER USER;");
      await db.exec("DELETE FROM public.therapy_input_sources; DELETE FROM public.therapy_input_revisions;");
      await db.query(
        `INSERT INTO public.therapy_input_revisions
         SELECT * FROM jsonb_populate_recordset(
           NULL::public.therapy_input_revisions,
           $1::jsonb
         )`,
        [original.tables.therapy_input_revisions],
      );
      await db.query(
        `INSERT INTO public.therapy_input_sources
         SELECT * FROM jsonb_populate_recordset(
           NULL::public.therapy_input_sources,
           $1::jsonb
         )`,
        [original.tables.therapy_input_sources],
      );
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      await db.exec("ALTER TABLE public.therapy_input_revisions ENABLE TRIGGER USER;");
      await db.exec("ALTER TABLE public.therapy_input_sources ENABLE TRIGGER USER;");

      const restoredSnapshot = await exportSnapshot();
      expect(restoredSnapshot.validation).toEqual({ invalid_revision_count: 0 });
      expect(restoredSnapshot.manifest).toEqual(original.manifest);
      expect(restoredSnapshot.tables).toEqual(original.tables);
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("enforces the exact table and function privilege matrix", async () => {
    const tablePrivileges = await db.query<{
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
        FROM unnest(ARRAY['therapy_input_revisions', 'therapy_input_sources']::text[])
          listed_table(table_name)
        CROSS JOIN unnest(ARRAY[
          'authenticated', 'service_role', 'anon', 'kb_importer', 'kb_import_runtime'
        ]::text[]) listed_role(role_name)
        CROSS JOIN unnest(ARRAY[
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'
        ]::text[]) listed_privilege(privilege_name)
       ORDER BY listed_table.table_name, listed_role.role_name, listed_privilege.privilege_name
    `);
    expect(tablePrivileges.rows).toHaveLength(50);
    expect(tablePrivileges.rows
      .filter((privilege) => privilege.allowed)
      .map((privilege) => (
        `${privilege.table_name}:${privilege.role_name}:${privilege.privilege_name}`
      ))
      .sort()).toEqual([
      "therapy_input_revisions:authenticated:SELECT",
      "therapy_input_revisions:service_role:SELECT",
      "therapy_input_sources:authenticated:SELECT",
      "therapy_input_sources:service_role:SELECT",
    ].sort());

    for (const role of protectedRoles) {
      for (const signature of functionSignatures) {
        const privilege = await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed",
          [role, signature],
        );
        const shouldAllow = role === "service_role"
          && signature === "public.therapy_input_export_snapshot_v1()";
        expect(privilege.rows[0].allowed, `${role} execute privilege for ${signature}`)
          .toBe(shouldAllow);
      }
    }
  });

  it("applies admin-only RLS and read-only service access", async () => {
    await enterRole("authenticated", patientId);
    try {
      const hidden = await db.query<{ revisions: number; sources: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.therapy_input_revisions) AS revisions,
          (SELECT count(*)::int FROM public.therapy_input_sources) AS sources
      `);
      expect(hidden.rows[0]).toEqual({ revisions: 0, sources: 0 });
      await expect(db.exec(`
        INSERT INTO public.therapy_input_revisions (
          pseudonym_id, deidentification_version, input_envelope,
          source_count, content_sha256, captured_by
        ) VALUES (
          'P-2026-0010', '${deidentificationVersion}', '{}'::jsonb,
          1, repeat('0', 64), '${patientId}'
        )
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      const visible = await db.query<{ revisions: number; sources: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.therapy_input_revisions) AS revisions,
          (SELECT count(*)::int FROM public.therapy_input_sources) AS sources
      `);
      expect(visible.rows[0]).toEqual({ revisions: 2, sources: 2 });
      await expect(db.exec(`
        UPDATE public.therapy_input_revisions SET captured_at = now()
         WHERE id = '${revisionId}'
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      const visible = await db.query<{ revisions: number; sources: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.therapy_input_revisions) AS revisions,
          (SELECT count(*)::int FROM public.therapy_input_sources) AS sources
      `);
      expect(visible.rows[0]).toEqual({ revisions: 2, sources: 2 });
      const serviceSnapshot = await db.query<{ snapshot: string }>(
        "SELECT public.therapy_input_export_snapshot_v1() AS snapshot",
      );
      expect(JSON.parse(serviceSnapshot.rows[0].snapshot)).toEqual(expect.objectContaining({
        snapshot_version: 1,
        validation: { invalid_revision_count: 0 },
      }));
      await expect(db.exec("TRUNCATE public.therapy_input_sources"))
        .rejects.toThrow(/permission denied/);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        await expect(db.query("SELECT * FROM public.therapy_input_revisions"))
          .rejects.toThrow(/permission denied/);
        await expect(db.query("SELECT * FROM public.therapy_input_sources"))
          .rejects.toThrow(/permission denied/);
      } finally {
        await leaveRole();
      }
    }
  });

  it("leaves mutable patient data byte-identical and performs no backfill", async () => {
    expect({ revisions: emptyRevisionCount, sources: emptySourceCount }).toEqual({
      revisions: 0,
      sources: 0,
    });
    const patientAfter = await db.query<{
      session_text: string;
      snapshot_text: string;
      session_count: number;
      snapshot_count: number;
    }>(`
      SELECT
        (SELECT row_to_json(session_row)::text FROM (
          SELECT * FROM public.therapy_sessions
           WHERE id = '93000000-0000-4000-8000-000000000001'
        ) session_row) AS session_text,
        (SELECT row_to_json(snapshot_row)::text FROM (
          SELECT * FROM public.patient_snapshot WHERE pseudonym_id = 'P-2026-0099'
        ) snapshot_row) AS snapshot_text,
        (SELECT count(*)::int FROM public.therapy_sessions) AS session_count,
        (SELECT count(*)::int FROM public.patient_snapshot) AS snapshot_count
    `);
    expect(patientAfter.rows[0]).toEqual({
      session_text: patientSessionBefore,
      snapshot_text: patientSnapshotBefore,
      session_count: 1,
      snapshot_count: 1,
    });
    expect(migration).not.toMatch(
      /\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.(?:therapy_sessions|patient_snapshot)\b/i,
    );
  });

  it("adds both tables to patient backups but never to the Wiki snapshot", () => {
    const frontendArea = backupAreasSource.match(
      /id: "iaa-icd10"[\s\S]*?buckets:/,
    )?.[0] ?? "";
    const fallbackTables = backupExportSource.match(
      /const FALLBACK_TABLES =[\s\S]*?\]\)\]\.sort\(\);/,
    )?.[0] ?? "";
    const edgeArea = backupExportSource.match(
      /"iaa-icd10":[\s\S]*?\},/,
    )?.[0] ?? "";
    const wikiSnapshot = backupExportSource.match(
      /const WIKI_SNAPSHOT_TABLES =[\s\S]*?\] as const;/,
    )?.[0] ?? "";

    for (const table of therapyInputTables) {
      expect(frontendArea).toContain(`"${table}"`);
      expect(fallbackTables).toContain(`"${table}"`);
      expect(edgeArea).toContain(`"${table}"`);
      expect(wikiSnapshot).not.toContain(`"${table}"`);
    }
    expect(migration).not.toContain("kb_export_wiki_snapshot");
    expect(backupExportSource).toContain('client.rpc("therapy_input_export_snapshot_v2")');
    expect(backupExportSource).toContain("serializedRows: therapyInputSnapshot.tables");
    expect(backupExportSource).toContain("therapy_input_snapshot_manifest.json");
    expect(backupExportSource).toContain("validateTherapyInputSnapshotV2(snapshot");
    expect(backupCenterSource).toContain('typeof t.serializedRows === "string"');
    expect(backupCenterSource).toContain("kein tabellenweiser Autocommit-Restore");
    expect(backupCenterSource).toContain("Die JSON-Zahlen nicht durch JavaScript parsen");
  });

  it("contains no facts, write RPC or mutation of existing patient tables", () => {
    expect(migration).not.toMatch(/therapy_input_fact/);
    expect(migration).not.toMatch(/FUNCTION public\.therapy_input_(?:capture|write|extract)/);
    expect(migration).not.toMatch(
      /\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.(?!therapy_input_)/i,
    );
  });
});
