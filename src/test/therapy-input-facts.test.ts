// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const envelopeMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260731120000_create_therapy_input_envelope.sql",
  ),
  "utf8",
);
const migrationFile = "20260731130000_create_therapy_input_facts.sql";
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", migrationFile),
  "utf8",
);

type ProductionSource = { relativePath: string; source: string };

function collectProductionSources(relativeRoot: string): ProductionSource[] {
  const collected: ProductionSource[] = [];
  const visit = (directory: string, relativeDirectory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (relativePath !== "src/test") visit(absolutePath, relativePath);
      } else if (/\.tsx?$/.test(entry.name)) {
        collected.push({ relativePath, source: readFileSync(absolutePath, "utf8") });
      }
    }
  };
  visit(resolve(process.cwd(), relativeRoot), relativeRoot);
  return collected;
}

const productionSources = [
  ...collectProductionSources("src"),
  ...collectProductionSources("supabase/functions"),
];
const therapyInputBackupSources = new Set([
  "src/components/admin/BackupCenter.tsx",
  "src/lib/backupAreas.ts",
  "src/lib/therapyInputBackup.ts",
  "supabase/functions/backup-export/index.ts",
  "supabase/functions/_shared/therapyInputSnapshotValidation.ts",
]);

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const reviewerId = "10000000-0000-4000-8000-000000000003";
const revisionId = "91000000-0000-4000-8000-000000000001";
const otherRevisionId = "91000000-0000-4000-8000-000000000002";
const maximumRevisionId = "91000000-0000-4000-8000-000000000003";
const kbEntityId = "94000000-0000-4000-8000-000000000001";
const missingKbEntityId = "94000000-0000-4000-8000-000000000099";
const labFactId = "93000000-0000-4000-8000-000000000001";
const complementaryFactId = "93000000-0000-4000-8000-000000000002";
const verifiedFactId = "93000000-0000-4000-8000-000000000003";
const kbFactId = "93000000-0000-4000-8000-000000000004";
const correctionFactId = "93000000-0000-4000-8000-000000000005";
const predecessorFactId = "93000000-0000-4000-8000-000000000006";
const maximumLinksFactId = "93000000-0000-4000-8000-000000000007";
const extractedAt = "2026-07-31T10:00:00.123456Z";
const reviewedAt = "2026-07-31T11:00:00.654321Z";
const deidentificationVersion = "clinical-deidentification-v1";

const factTables = [
  "therapy_input_facts",
  "therapy_input_fact_sources",
] as const;
const snapshotTables = [
  "therapy_input_revisions",
  "therapy_input_sources",
  ...factTables,
] as const;
const protectedRoles = [
  "authenticated",
  "service_role",
  "anon",
  "kb_importer",
  "kb_import_runtime",
] as const;
const helperSignatures = [
  "public.therapy_input_fact_value_shape_is_valid_v1(jsonb)",
  "public.therapy_input_demographic_fact_is_valid_v1(text,jsonb)",
  "public.therapy_input_fact_pii_is_safe_v1(text,text,text,jsonb)",
  "public.therapy_input_fact_locator_is_safe_v1(text)",
  "public.therapy_input_timestamptz_utc_microseconds_v1(timestamptz)",
  "public.therapy_input_fact_source_manifest_v1(uuid)",
  "public.therapy_input_fact_hash_payload_v1(uuid)",
  "public.therapy_input_fact_sha256_v1(uuid)",
  "public.therapy_input_fact_revision_bytes_v1(uuid)",
  "public.therapy_input_fact_is_valid_v1(uuid)",
  "public.therapy_input_invalid_fact_count_v1()",
  "public.therapy_input_export_snapshot_v2()",
  "public.therapy_input_protect_fact_append_only_v1()",
  "public.therapy_input_lock_fact_revision_v1()",
  "public.therapy_input_validate_fact_graph_v1()",
] as const;

type SourceType =
  | "manual_input"
  | "anamnesis"
  | "laboratory"
  | "doctor_report"
  | "imaging"
  | "stool_microbiome"
  | "complementary_measurement"
  | "vieva_plus"
  | "external_research"
  | "order";

type SourceFixture = {
  id: string;
  revisionId: string;
  sourceOrder: number;
  neutralSourceId: string;
  sourceType: SourceType;
  documentDate: string | null;
  sourceLocator: string;
  sourcePayload: { format: string; text: string; language: string };
  contentSha256: string;
};

type RevisionFixture = {
  id: string;
  contentSha256: string;
};

type FactFixture = {
  id: string;
  revisionId: string;
  factOrder: number;
  factType: string;
  factKey: string;
  factLabel: string;
  factValueJson: string;
  isNegated: boolean;
  clinicalStatus: string;
  certainty: string;
  extractionConfidence: string;
  extractionMethod: string;
  reviewStatus: string;
  evidenceScope: string;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  effectiveDatePrecision: string;
  kbEntityId: string | null;
  sourceCount: number;
  supersedesFactId: string | null;
  extractedAt: string;
  extractedBy: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type FactLink = {
  linkOrder: number;
  sourceOrder: number;
  factLocator: string;
  sourceRole: string;
  revisionId?: string;
};

type HashRow = { hash: string };
type SnapshotManifest = Record<
  (typeof snapshotTables)[number],
  { rows: number; sha256: string }
>;
type SnapshotV2 = {
  snapshot_version: number;
  tables: Record<(typeof snapshotTables)[number], string>;
  manifest: SnapshotManifest;
  validation: { invalid_revision_count: number; invalid_fact_count: number };
};

let db: PGlite;
let sourceSerial = 0;
let attemptedFactSerial = 1000;
let patientSessionBefore = "";
let patientSnapshotBefore = "";
let v1DefinitionBefore = "";
let v1SnapshotBefore = "";
let emptyFactCount = -1;
let emptyLinkCount = -1;

const sources = new Map<string, SourceFixture>();
const revisions = new Map<string, RevisionFixture>();

function sourceKey(sourceRevisionId: string, sourceOrder: number): string {
  return `${sourceRevisionId}:${sourceOrder}`;
}

function nextUuid(prefix: string, serial: number): string {
  return `${prefix}-0000-4000-8000-${serial.toString().padStart(12, "0")}`;
}

async function hashJson(value: unknown): Promise<string> {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const result = await db.query<HashRow>(
    "SELECT public.therapy_input_jsonb_sha256_v1($1::jsonb) AS hash",
    [serialized],
  );
  return result.rows[0].hash;
}

async function expectTransactionFailure(
  action: () => Promise<void>,
  message: RegExp,
): Promise<void> {
  try {
    await action();
    throw new Error("Expected transaction to fail");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(message);
  }
}

async function insertRevision(
  id: string,
  pseudonymId: string,
  sourceTypes: SourceType[],
): Promise<void> {
  const revisionSources: SourceFixture[] = [];
  for (let index = 0; index < sourceTypes.length; index += 1) {
    sourceSerial += 1;
    const sourceOrder = index + 1;
    const sourceType = sourceTypes[index];
    const artifact = sourceSerial.toString(16).padStart(12, "0");
    const sourcePayload = {
      format: "text",
      text: `Clinical source ${sourceOrder}`,
      language: "en",
    };
    const source: SourceFixture = {
      id: nextUuid("92000000", sourceSerial),
      revisionId: id,
      sourceOrder,
      neutralSourceId: `${sourceType}:artifact:${artifact}`,
      sourceType,
      documentDate: "2026-07-20",
      sourceLocator: `page:${sourceOrder}`,
      sourcePayload,
      contentSha256: "",
    };
    source.contentSha256 = await hashJson({
      hash_schema_version: 1,
      source_order: source.sourceOrder,
      neutral_source_id: source.neutralSourceId,
      source_type: source.sourceType,
      document_date: source.documentDate,
      source_locator: source.sourceLocator,
      source_payload: source.sourcePayload,
    });
    revisionSources.push(source);
  }

  const inputEnvelope = {
    format: "therapy_input_envelope_v1",
    clinical_text: `Deidentified clinical input ${pseudonymId}`,
    context: {},
  };
  const contentSha256 = await hashJson({
    envelope_schema_version: 1,
    hash_schema_version: 1,
    deidentification_version: deidentificationVersion,
    data_classification: "pseudonymized_health_data",
    pseudonym_id: pseudonymId,
    input_envelope: inputEnvelope,
    source_count: revisionSources.length,
    sources: revisionSources.map((source) => ({
      source_order: source.sourceOrder,
      neutral_source_id: source.neutralSourceId,
      source_type: source.sourceType,
      document_date: source.documentDate,
      source_locator: source.sourceLocator,
      content_sha256: source.contentSha256,
    })),
  });

  await db.exec("BEGIN;");
  try {
    await db.query(
      `INSERT INTO public.therapy_input_revisions (
         id, pseudonym_id, input_envelope, source_count, content_sha256,
         captured_at, captured_by
       ) VALUES ($1, $2, $3::jsonb, $4, $5, '2026-07-31T09:00:00Z', $6)`,
      [
        id,
        pseudonymId,
        JSON.stringify(inputEnvelope),
        revisionSources.length,
        contentSha256,
        adminId,
      ],
    );
    for (const source of revisionSources) {
      await db.query(
        `INSERT INTO public.therapy_input_sources (
           id, therapy_input_revision_id, source_order, neutral_source_id,
           source_type, document_date, source_locator, source_payload,
           content_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          source.id,
          source.revisionId,
          source.sourceOrder,
          source.neutralSourceId,
          source.sourceType,
          source.documentDate,
          source.sourceLocator,
          JSON.stringify(source.sourcePayload),
          source.contentSha256,
        ],
      );
    }
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }

  revisions.set(id, { id, contentSha256 });
  for (const source of revisionSources) {
    sources.set(sourceKey(id, source.sourceOrder), source);
  }
}

function makeFact(overrides: Partial<FactFixture> = {}): FactFixture {
  attemptedFactSerial += 1;
  return {
    id: nextUuid("95000000", attemptedFactSerial),
    revisionId,
    factOrder: 100 + attemptedFactSerial - 1000,
    factType: "symptom",
    factKey: `symptom.contract_${attemptedFactSerial}`,
    factLabel: "Contract symptom",
    factValueJson: '{"type":"text","value":"Fatigue"}',
    isNegated: false,
    clinicalStatus: "current",
    certainty: "confirmed",
    extractionConfidence: "high",
    extractionMethod: "manual",
    reviewStatus: "unreviewed",
    evidenceScope: "patient_report",
    effectiveStartDate: null,
    effectiveEndDate: null,
    effectiveDatePrecision: "unknown",
    kbEntityId: null,
    sourceCount: 1,
    supersedesFactId: null,
    extractedAt,
    extractedBy: adminId,
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

async function factHash(fact: FactFixture, links: FactLink[]): Promise<string> {
  const revision = revisions.get(fact.revisionId);
  if (!revision) throw new Error(`Unknown revision fixture ${fact.revisionId}`);

  const sourceManifest = links
    .map((link) => {
      const linkRevisionId = link.revisionId ?? fact.revisionId;
      const source = sources.get(sourceKey(linkRevisionId, link.sourceOrder));
      if (!source) throw new Error(`Unknown source fixture ${linkRevisionId}:${link.sourceOrder}`);
      return {
        link_order: link.linkOrder,
        source_order: source.sourceOrder,
        neutral_source_id: source.neutralSourceId,
        source_type: source.sourceType,
        document_date: source.documentDate,
        source_locator: source.sourceLocator,
        fact_locator: link.factLocator,
        content_sha256: source.contentSha256,
        source_role: link.sourceRole,
      };
    })
    .sort((left, right) => left.link_order - right.link_order);

  const payload = {
    therapy_input_revision_id: fact.revisionId,
    therapy_input_revision_sha256: revision.contentSha256,
    envelope_schema_version: 1,
    revision_hash_schema_version: 1,
    deidentification_version: deidentificationVersion,
    fact_schema_version: 1,
    hash_schema_version: 1,
    fact_id: fact.id,
    fact_order: fact.factOrder,
    fact_type: fact.factType,
    fact_key: fact.factKey,
    fact_label: fact.factLabel,
    fact_value: null,
    is_negated: fact.isNegated,
    clinical_status: fact.clinicalStatus,
    certainty: fact.certainty,
    extraction_confidence: fact.extractionConfidence,
    extraction_method: fact.extractionMethod,
    review_status: fact.reviewStatus,
    evidence_scope: fact.evidenceScope,
    effective_start_date: fact.effectiveStartDate,
    effective_end_date: fact.effectiveEndDate,
    effective_date_precision: fact.effectiveDatePrecision,
    kb_entity_id: fact.kbEntityId,
    source_count: fact.sourceCount,
    supersedes_fact_id: fact.supersedesFactId,
    extracted_at: fact.extractedAt,
    extracted_by: fact.extractedBy,
    reviewed_at: fact.reviewedAt,
    reviewed_by: fact.reviewedBy,
    sources: sourceManifest,
  };
  const result = await db.query<HashRow>(`
    SELECT public.therapy_input_jsonb_sha256_v1(
      ($1::jsonb - 'fact_value')
      || jsonb_build_object('fact_value', $2::jsonb)
    ) AS hash
  `, [JSON.stringify(payload), fact.factValueJson]);
  return result.rows[0].hash;
}

async function insertFactGraph(fact: FactFixture, links: FactLink[]): Promise<void> {
  const contentSha256 = await factHash(fact, links);
  await db.exec("BEGIN;");
  try {
    await db.query(
      `INSERT INTO public.therapy_input_facts (
         id, therapy_input_revision_id, fact_order, fact_schema_version,
         hash_schema_version, fact_type, fact_key, fact_label, fact_value,
         is_negated, clinical_status, certainty, extraction_confidence,
         extraction_method, review_status, evidence_scope,
         effective_start_date, effective_end_date, effective_date_precision,
         kb_entity_id, source_count, supersedes_fact_id, extracted_at,
         extracted_by, reviewed_at, reviewed_by, content_sha256
       ) VALUES (
         $1, $2, $3, 1, 1, $4, $5, $6, $7::jsonb, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
         $22, $23, $24, $25
       )`,
      [
        fact.id,
        fact.revisionId,
        fact.factOrder,
        fact.factType,
        fact.factKey,
        fact.factLabel,
        fact.factValueJson,
        fact.isNegated,
        fact.clinicalStatus,
        fact.certainty,
        fact.extractionConfidence,
        fact.extractionMethod,
        fact.reviewStatus,
        fact.evidenceScope,
        fact.effectiveStartDate,
        fact.effectiveEndDate,
        fact.effectiveDatePrecision,
        fact.kbEntityId,
        fact.sourceCount,
        fact.supersedesFactId,
        fact.extractedAt,
        fact.extractedBy,
        fact.reviewedAt,
        fact.reviewedBy,
        contentSha256,
      ],
    );
    for (const link of links) {
      await db.query(
        `INSERT INTO public.therapy_input_fact_sources (
           therapy_input_revision_id, therapy_input_fact_id, link_order,
           source_order, fact_locator, source_role
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          link.revisionId ?? fact.revisionId,
          fact.id,
          link.linkOrder,
          link.sourceOrder,
          link.factLocator,
          link.sourceRole,
        ],
      );
    }
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function exportSnapshotV2(): Promise<SnapshotV2> {
  const result = await db.query<{ snapshot: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS snapshot",
  );
  return JSON.parse(result.rows[0].snapshot) as SnapshotV2;
}

async function enterRole(role: string, userId?: string): Promise<void> {
  await db.exec(`SET ROLE ${role};`);
  if (userId) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  }
}

async function leaveRole(): Promise<void> {
  await db.exec("RESET ROLE; RESET request.jwt.claim.sub;").catch(() => undefined);
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

    CREATE TABLE public.kb_entities (id uuid PRIMARY KEY);
    CREATE TABLE public.therapy_sessions (
      id uuid PRIMARY KEY,
      pseudonym_id text NOT NULL,
      eingabe_daten jsonb NOT NULL
    );
    CREATE TABLE public.patient_snapshot (
      pseudonym_id text PRIMARY KEY,
      data jsonb NOT NULL
    );

    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
    INSERT INTO public.kb_entities (id) VALUES ('${kbEntityId}');
    INSERT INTO public.therapy_sessions VALUES (
      '96000000-0000-4000-8000-000000000001',
      'P-2026-0099',
      '{"marker":"unchanged-session","large":9007199254740993}'::jsonb
    );
    INSERT INTO public.patient_snapshot VALUES (
      'P-2026-0099',
      '{"marker":"unchanged-snapshot"}'::jsonb
    );
    SET TIME ZONE 'UTC';
  `);

  const patientBefore = await db.query<{ session: string; snapshot: string }>(`
    SELECT
      (SELECT row_to_json(stored)::text FROM (
        SELECT * FROM public.therapy_sessions
      ) stored) AS session,
      (SELECT row_to_json(stored)::text FROM (
        SELECT * FROM public.patient_snapshot
      ) stored) AS snapshot
  `);
  patientSessionBefore = patientBefore.rows[0].session;
  patientSnapshotBefore = patientBefore.rows[0].snapshot;

  await db.exec(envelopeMigration);
  await insertRevision(revisionId, "P-2026-0001", [
    "laboratory",
    "doctor_report",
    "complementary_measurement",
    "vieva_plus",
    "manual_input",
    "external_research",
  ]);
  await insertRevision(otherRevisionId, "P-2026-0002", ["laboratory"]);
  await insertRevision(
    maximumRevisionId,
    "P-2026-0003",
    Array.from({ length: 64 }, () => "manual_input" as const),
  );

  const v1Before = await db.query<{ definition: string; snapshot: string }>(`
    SELECT pg_get_functiondef(
             'public.therapy_input_export_snapshot_v1()'::regprocedure
           ) AS definition,
           public.therapy_input_export_snapshot_v1() AS snapshot
  `);
  v1DefinitionBefore = v1Before.rows[0].definition;
  v1SnapshotBefore = v1Before.rows[0].snapshot;

  await db.exec(migration);
  const emptyCounts = await db.query<{ facts: number; links: number }>(`
    SELECT
      (SELECT count(*)::int FROM public.therapy_input_facts) AS facts,
      (SELECT count(*)::int FROM public.therapy_input_fact_sources) AS links
  `);
  emptyFactCount = emptyCounts.rows[0].facts;
  emptyLinkCount = emptyCounts.rows[0].links;

  await insertFactGraph(makeFact({
    id: labFactId,
    factOrder: 1,
    factType: "laboratory_observation",
    factKey: "laboratory.ferritin",
    factLabel: "Ferritin",
    factValueJson: '{"type":"quantity","value":9007199254740993,"comparator":"eq","unit_system":"ucum","unit_code":"ug/L","reference_low":10,"reference_high":30}',
    evidenceScope: "conventional_measurement",
    effectiveStartDate: "2026-07-20",
    effectiveDatePrecision: "day",
    sourceCount: 2,
  }), [
    { linkOrder: 1, sourceOrder: 1, factLocator: "table:ferritin", sourceRole: "primary" },
    { linkOrder: 2, sourceOrder: 2, factLocator: "paragraph:assessment", sourceRole: "supporting" },
  ]);

  await insertFactGraph(makeFact({
    id: complementaryFactId,
    factOrder: 2,
    factType: "examination_finding",
    factKey: "examination.complementary_observation",
    factLabel: "Complementary observation",
    factValueJson: '{"type":"text","value":"Energetic deviation"}',
    certainty: "possible",
    extractionConfidence: "low",
    extractionMethod: "ai_assisted",
    reviewStatus: "review_only",
    evidenceScope: "complementary_measurement",
    sourceCount: 2,
  }), [
    { linkOrder: 1, sourceOrder: 3, factLocator: "section:overview", sourceRole: "primary" },
    { linkOrder: 2, sourceOrder: 1, factLocator: "table:ferritin", sourceRole: "context" },
  ]);

  await insertFactGraph(makeFact({
    id: verifiedFactId,
    factOrder: 3,
    factType: "medication",
    factKey: "medication.metformin",
    factLabel: "Metformin",
    factValueJson: '{"type":"coded","system":"atc","code":"A10BA02","display":"Metformin"}',
    reviewStatus: "verified",
    reviewedAt,
    reviewedBy: reviewerId,
  }), [
    { linkOrder: 1, sourceOrder: 5, factLocator: "field:medication", sourceRole: "primary" },
  ]);

  await insertFactGraph(makeFact({
    id: kbFactId,
    factOrder: 4,
    factType: "condition",
    factKey: "condition.type_2_diabetes",
    factLabel: "Type 2 diabetes",
    factValueJson: '{"type":"coded","system":"icd_10_gm","code":"E11.9","display":"Type 2 diabetes"}',
    evidenceScope: "clinical_document",
    kbEntityId,
  }), [
    { linkOrder: 1, sourceOrder: 2, factLocator: "paragraph:diagnosis", sourceRole: "primary" },
  ]);

  await insertFactGraph(makeFact({
    id: correctionFactId,
    factOrder: 5,
    factType: "laboratory_observation",
    factKey: "laboratory.ferritin",
    factLabel: "Ferritin",
    factValueJson: '{"type":"quantity","value":18,"comparator":"eq","unit_system":"ucum","unit_code":"ug/L","reference_low":10,"reference_high":30}',
    evidenceScope: "conventional_measurement",
    effectiveStartDate: "2026-07-20",
    effectiveDatePrecision: "day",
    supersedesFactId: labFactId,
  }), [
    { linkOrder: 1, sourceOrder: 1, factLocator: "table:ferritin", sourceRole: "primary" },
  ]);

  await insertFactGraph(makeFact({
    id: predecessorFactId,
    revisionId: otherRevisionId,
    factOrder: 10,
    factKey: "symptom.other_revision",
  }), [
    { linkOrder: 1, sourceOrder: 1, factLocator: "line:10", sourceRole: "primary" },
  ]);

  await insertFactGraph(makeFact({
    id: maximumLinksFactId,
    revisionId: maximumRevisionId,
    factOrder: 1,
    factType: "symptom",
    factKey: "symptom.maximum_manifest",
    factLabel: "Maximum source manifest",
    factValueJson: '{"type":"boolean","value":true}',
    sourceCount: 64,
  }), Array.from({ length: 64 }, (_, index) => ({
    linkOrder: index + 1,
    sourceOrder: index + 1,
    factLocator: `line:${index + 1}`,
    sourceRole: index === 0 ? "primary" : "supporting",
  })));
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("therapy input atomic facts Step 3B", () => {
  it("is additive and creates exactly the two requested tables and exact columns", async () => {
    const createdTables = Array.from(
      migration.matchAll(/CREATE TABLE public\.(therapy_input_[a-z_]+)/g),
      (match) => match[1],
    );
    expect(createdTables).toEqual([...factTables]);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toMatch(/ALTER TABLE public\.therapy_input_(?:revisions|sources)/);

    const columns = await db.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT table_name, column_name, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY(ARRAY['therapy_input_facts', 'therapy_input_fact_sources'])
       ORDER BY table_name, ordinal_position
    `);
    expect(columns.rows.map((column) => `${column.table_name}.${column.column_name}`)).toEqual([
      "therapy_input_fact_sources.therapy_input_revision_id",
      "therapy_input_fact_sources.therapy_input_fact_id",
      "therapy_input_fact_sources.link_order",
      "therapy_input_fact_sources.source_order",
      "therapy_input_fact_sources.fact_locator",
      "therapy_input_fact_sources.source_role",
      "therapy_input_facts.id",
      "therapy_input_facts.therapy_input_revision_id",
      "therapy_input_facts.fact_order",
      "therapy_input_facts.fact_schema_version",
      "therapy_input_facts.hash_schema_version",
      "therapy_input_facts.fact_type",
      "therapy_input_facts.fact_key",
      "therapy_input_facts.fact_label",
      "therapy_input_facts.fact_value",
      "therapy_input_facts.is_negated",
      "therapy_input_facts.clinical_status",
      "therapy_input_facts.certainty",
      "therapy_input_facts.extraction_confidence",
      "therapy_input_facts.extraction_method",
      "therapy_input_facts.review_status",
      "therapy_input_facts.evidence_scope",
      "therapy_input_facts.effective_start_date",
      "therapy_input_facts.effective_end_date",
      "therapy_input_facts.effective_date_precision",
      "therapy_input_facts.kb_entity_id",
      "therapy_input_facts.source_count",
      "therapy_input_facts.supersedes_fact_id",
      "therapy_input_facts.extracted_at",
      "therapy_input_facts.extracted_by",
      "therapy_input_facts.reviewed_at",
      "therapy_input_facts.reviewed_by",
      "therapy_input_facts.content_sha256",
    ]);
    expect(columns.rows
      .filter((column) => column.is_nullable === "YES")
      .map((column) => `${column.table_name}.${column.column_name}`)).toEqual([
      "therapy_input_facts.effective_start_date",
      "therapy_input_facts.effective_end_date",
      "therapy_input_facts.kb_entity_id",
      "therapy_input_facts.supersedes_fact_id",
      "therapy_input_facts.reviewed_at",
      "therapy_input_facts.reviewed_by",
    ]);
    const negation = columns.rows.find((column) => column.column_name === "is_negated");
    expect(negation).toMatchObject({ is_nullable: "NO", column_default: null });
    expect(columns.rows.some((column) => column.column_name === "updated_at")).toBe(false);
  });

  it("declares all controlled vocabularies and hard storage limits", async () => {
    const checks = await db.query<{ definition: string }>(`
      SELECT pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
       WHERE table_row.relname IN ('therapy_input_facts', 'therapy_input_fact_sources')
         AND constraint_row.contype = 'c'
    `);
    const definitions = checks.rows.map((row) => row.definition).join("\n");
    for (const code of [
      "demographic", "symptom", "condition", "medication", "allergy",
      "prior_treatment", "procedure", "laboratory_observation",
      "microbiome_observation", "examination_finding", "family_social_history",
      "lifestyle_exposure", "immunization", "therapy_goal", "safety_flag",
      "open_question", "current", "historical", "resolved", "planned",
      "unknown", "not_applicable", "confirmed", "probable", "possible",
      "uncertain", "high", "medium", "low", "not_assessed", "manual",
      "deterministic", "ai_assisted", "unreviewed", "review_only", "verified",
      "rejected", "patient_report", "practitioner_observation",
      "clinical_document", "conventional_measurement", "complementary_measurement",
      "administrative_record",
    ]) {
      expect(definitions).toContain(code);
    }
    expect(definitions).toContain("2048");
    expect(definitions).toContain("16384");
    expect(definitions).toContain("64");

    const sizeDefinition = await db.query<{ definition: string }>(`
      SELECT pg_get_functiondef(
        'public.therapy_input_fact_is_valid_v1(uuid)'::regprocedure
      ) AS definition
    `);
    expect(sizeDefinition.rows[0].definition).toContain("8388608");

    const lockDefinition = await db.query<{ definition: string }>(`
      SELECT pg_get_functiondef(
        'public.therapy_input_lock_fact_revision_v1()'::regprocedure
      ) AS definition
    `);
    expect(lockDefinition.rows[0].definition).toContain("FOR UPDATE");
    const lockTriggers = await db.query<{ table_name: string }>(`
      SELECT table_row.relname AS table_name
        FROM pg_trigger trigger_row
        JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
       WHERE trigger_row.tgname IN (
         'therapy_input_facts_lock_revision',
         'therapy_input_fact_sources_lock_revision'
       )
       ORDER BY table_row.relname
    `);
    expect(lockTriggers.rows.map((row) => row.table_name)).toEqual([
      "therapy_input_fact_sources",
      "therapy_input_facts",
    ]);
  });

  it("uses composite same-revision FKs and the exact deferred KB deletion behavior", async () => {
    const foreignKeys = await db.query<{
      name: string;
      source_table: string;
      target_table: string;
      definition: string;
      delete_action: string;
      is_deferrable: boolean;
      is_deferred: boolean;
    }>(`
      SELECT constraint_row.conname AS name,
             source.relname AS source_table,
             target.relname AS target_table,
             pg_get_constraintdef(constraint_row.oid) AS definition,
             constraint_row.confdeltype::text AS delete_action,
             constraint_row.condeferrable AS is_deferrable,
             constraint_row.condeferred AS is_deferred
        FROM pg_constraint constraint_row
        JOIN pg_class source ON source.oid = constraint_row.conrelid
        JOIN pg_class target ON target.oid = constraint_row.confrelid
       WHERE constraint_row.contype = 'f'
         AND source.relname = ANY(ARRAY['therapy_input_facts', 'therapy_input_fact_sources'])
       ORDER BY constraint_row.conname
    `);
    expect(foreignKeys.rows).toHaveLength(5);
    expect(foreignKeys.rows.every((key) => key.is_deferrable && key.is_deferred)).toBe(true);
    expect(foreignKeys.rows.find((key) => key.name === "therapy_input_facts_kb_entity_fk"))
      .toMatchObject({ target_table: "kb_entities", delete_action: "a" });
    expect(foreignKeys.rows.find((key) => key.name === "therapy_input_fact_sources_fact_fk")?.definition)
      .toContain("(therapy_input_revision_id, therapy_input_fact_id)");
    expect(foreignKeys.rows.find((key) => key.name === "therapy_input_fact_sources_source_fk")?.definition)
      .toContain("(therapy_input_revision_id, source_order)");
    expect(foreignKeys.rows.some((key) => /reviewed_by|extracted_by/.test(key.definition)))
      .toBe(false);
  });

  it("strictly validates every fact_value v1 shape without leaking cast errors", async () => {
    const validValues = [
      '{"type":"none"}',
      '{"type":"text","value":"Fatigue"}',
      '{"type":"boolean","value":false}',
      '{"type":"quantity","value":18.00,"comparator":"eq","unit_system":"ucum","unit_code":"ug/L","reference_low":10,"reference_high":30}',
      '{"type":"quantity","value":9007199254740993,"comparator":"ge","unit_system":"unitless","unit_code":"1"}',
      '{"type":"coded","system":"loinc","code":"2276-4","display":"Ferritin"}',
    ];
    for (const value of validValues) {
      const result = await db.query<{ valid: boolean }>(
        "SELECT public.therapy_input_fact_value_shape_is_valid_v1($1::jsonb) AS valid",
        [value],
      );
      expect(result.rows[0].valid, value).toBe(true);
    }

    const invalidValues = [
      "[]",
      '{"type":"none","value":null}',
      '{"type":"text","value":"Fatigue","unknown":true}',
      '{"type":"text","value":null}',
      '{"type":"quantity","value":"12x","comparator":"eq","unit_system":"ucum","unit_code":"mg/L"}',
      '{"type":"quantity","value":1e200,"comparator":"eq","unit_system":"ucum","unit_code":"mg/L"}',
      '{"type":"quantity","value":12,"comparator":"approximately","unit_system":"ucum","unit_code":"mg/L"}',
      '{"type":"quantity","value":12,"comparator":"eq","unit_system":"unitless","unit_code":"mg"}',
      '{"type":"quantity","value":12,"comparator":"eq","unit_system":"ucum","unit_code":"mg/L","reference_low":30,"reference_high":10}',
      '{"type":"coded","system":"snomed","code":"123"}',
      '{"type":"coded","system":"loinc","code":2276}',
      '{"type":"text","value":"Patient: Erika Beispiel"}',
      JSON.stringify({ type: "text", value: "x".repeat(4097) }),
    ];
    for (const value of invalidValues) {
      const result = await db.query<{ valid: boolean }>(
        "SELECT public.therapy_input_fact_value_shape_is_valid_v1($1::jsonb) AS valid",
        [value],
      );
      expect(result.rows[0].valid, value.slice(0, 100)).toBe(false);
    }
  });

  it("rejects unsafe labels, noncanonical keys, unsafe values, and implicit negation", async () => {
    await expect(insertFactGraph(makeFact({
      factLabel: "Patient: Erika Beispiel",
    }), [
      { linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary" },
    ])).rejects.toThrow(/check constraint/i);

    await expect(insertFactGraph(makeFact({ factKey: "Symptom.Fatigue" }), [
      { linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary" },
    ])).rejects.toThrow(/check constraint/i);

    await expect(insertFactGraph(makeFact({
      factValueJson: '{"type":"text","value":"email patient@example.com"}',
    }), [
      { linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary" },
    ])).rejects.toThrow(/check constraint/i);

    await expect(db.exec(`
      INSERT INTO public.therapy_input_facts (
        therapy_input_revision_id, fact_order, fact_type, fact_key, fact_label,
        fact_value, clinical_status, certainty, extraction_confidence,
        extraction_method, evidence_scope, source_count, extracted_by,
        content_sha256
      ) VALUES (
        '${revisionId}', 1900, 'symptom', 'symptom.explicit_negation',
        'Explicit negation', '{"type":"none"}'::jsonb, 'unknown', 'uncertain',
        'not_assessed', 'manual', 'patient_report', 1, '${adminId}', repeat('0', 64)
      )
    `)).rejects.toThrow(/is_negated|null value/i);
  });

  it("rejects identifying fact semantics even when labels and values are split", async () => {
    const safeDemographic = await db.query<{ valid: boolean }>(`
      SELECT public.therapy_input_fact_pii_is_safe_v1(
        'demographic',
        'demographic.age_years',
        'Age',
        '{"type":"quantity","value":52,"comparator":"eq","unit_system":"ucum","unit_code":"a"}'::jsonb
      ) AS valid
    `);
    expect(safeDemographic.rows[0].valid).toBe(true);

    const safeClinicalTerms = await db.query<{
      pathogen: boolean;
      mobility: boolean;
      pathogen_locator: boolean;
      mobility_locator: boolean;
    }>(`
      SELECT
        public.therapy_input_fact_pii_is_safe_v1(
          'microbiome_observation',
          'microbiome.pathogen_detected',
          'Pathogen detected',
          '{"type":"boolean","value":true}'::jsonb
        ) AS pathogen,
        public.therapy_input_fact_pii_is_safe_v1(
          'examination_finding',
          'examination.mobility_restriction',
          'Mobility restriction',
          '{"type":"boolean","value":true}'::jsonb
        ) AS mobility,
        public.therapy_input_fact_locator_is_safe_v1('section:pathogens')
          AS pathogen_locator,
        public.therapy_input_fact_locator_is_safe_v1('field:mobility_restriction')
          AS mobility_locator
    `);
    expect(safeClinicalTerms.rows[0]).toEqual({
      pathogen: true,
      mobility: true,
      pathogen_locator: true,
      mobility_locator: true,
    });

    for (const overrides of [
      {
        factType: "demographic",
        factKey: "demographic.patient",
        factLabel: "Patient",
        factValueJson: '{"type":"text","value":"Erika Beispiel"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.birthdate",
        factLabel: "Geburtsdatum",
        factValueJson: '{"type":"text","value":"01.02.1980"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.insurance_number",
        factLabel: "Versichertennummer",
        factValueJson: '{"type":"coded","system":"local_v1","code":"A123456789"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.birthday",
        factLabel: "Record date",
        factValueJson: '{"type":"text","value":"1980-02-01"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.geburtstag",
        factLabel: "Stichtag",
        factValueJson: '{"type":"text","value":"01.02.1980"}',
      },
      {
        factType: "open_question",
        factKey: "open_question.therapy_session_id",
        factLabel: "Referenz",
        factValueJson: '{"type":"text","value":"10000000-0000-4000-8000-000000000001"}',
      },
      {
        factType: "open_question",
        factKey: "open_question.birth_day",
        factLabel: "Record date",
        factValueJson: '{"type":"text","value":"1980-02-01"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.age_years",
        factLabel: "Age",
        factValueJson: '{"type":"text","value":"1980-02-01"}',
      },
      {
        factType: "demographic",
        factKey: "demographic.age_years",
        factLabel: "Age",
        factValueJson: '{"type":"quantity","value":131,"comparator":"eq","unit_system":"ucum","unit_code":"a"}',
      },
    ]) {
      await expect(insertFactGraph(makeFact(overrides), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "field:demographic",
        sourceRole: "primary",
      }])).rejects.toThrow(/pii_check|check constraint/i);
    }
  });

  it("stores a valid multi-source laboratory graph with deterministic content hashing", async () => {
    const result = await db.query<{
      valid: boolean;
      stored_hash: string;
      calculated_hash: string;
      source_count: number;
      manifest: unknown[];
      invalid_count: number;
    }>(`
      SELECT public.therapy_input_fact_is_valid_v1(fact.id) AS valid,
             fact.content_sha256 AS stored_hash,
             public.therapy_input_fact_sha256_v1(fact.id) AS calculated_hash,
             fact.source_count,
             public.therapy_input_fact_source_manifest_v1(fact.id) AS manifest,
             public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
        FROM public.therapy_input_facts fact
       WHERE fact.id = '${labFactId}'
    `);
    expect(result.rows[0].valid).toBe(true);
    expect(result.rows[0].stored_hash).toBe(result.rows[0].calculated_hash);
    expect(result.rows[0].stored_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.rows[0].source_count).toBe(2);
    expect(result.rows[0].manifest).toEqual([
      expect.objectContaining({
        link_order: 1,
        source_order: 1,
        source_type: "laboratory",
        source_locator: "page:1",
        fact_locator: "table:ferritin",
        source_role: "primary",
      }),
      expect.objectContaining({
        link_order: 2,
        source_order: 2,
        source_type: "doctor_report",
        fact_locator: "paragraph:assessment",
        source_role: "supporting",
      }),
    ]);
    expect(result.rows[0].invalid_count).toBe(0);
  });

  it("requires a canonical locator and at least one primary source", async () => {
    await expect(insertFactGraph(makeFact(), [{
      linkOrder: 1,
      sourceOrder: 1,
      factLocator: "",
      sourceRole: "primary",
    }])).rejects.toThrow(/check constraint/i);

    await expectTransactionFailure(
      () => insertFactGraph(makeFact(), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:1",
        sourceRole: "context",
      }]),
      /fact integrity/i,
    );

    for (const factLocator of [
      "field:birthday_1980-02-01",
      "field:therapy_session_id",
      "field:patientenid_abc123",
      "line:10000000-0000-4000-8000-000000000001",
    ]) {
      await expect(insertFactGraph(makeFact(), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator,
        sourceRole: "primary",
      }])).rejects.toThrow(/check constraint/i);
    }
  });

  it("rejects cross-revision fact/source and supersession relationships", async () => {
    await expectTransactionFailure(
      () => insertFactGraph(makeFact(), [{
        revisionId: otherRevisionId,
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:1",
        sourceRole: "primary",
      }]),
      /integrity|foreign key/i,
    );

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({
        revisionId: otherRevisionId,
        factOrder: 11,
        factKey: "symptom.cross_revision_correction",
        supersedesFactId: kbFactId,
      }), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:11",
        sourceRole: "primary",
      }]),
      /integrity|foreign key/i,
    );
  });

  it("invalidates every external-research role, alone or mixed with patient evidence", async () => {
    for (const sourceRole of ["primary", "supporting", "contradicting", "context"]) {
      await expectTransactionFailure(
        () => insertFactGraph(makeFact({ evidenceScope: "clinical_document" }), [{
          linkOrder: 1,
          sourceOrder: 6,
          factLocator: "paragraph:claim",
          sourceRole,
        }]),
        /fact integrity/i,
      );
    }

    for (const sourceRole of ["primary", "supporting", "contradicting", "context"]) {
      await expectTransactionFailure(
        () => insertFactGraph(makeFact({
          evidenceScope: "conventional_measurement",
          sourceCount: 2,
        }), [
          {
            linkOrder: 1,
            sourceOrder: 1,
            factLocator: "table:ferritin",
            sourceRole: "primary",
          },
          {
            linkOrder: 2,
            sourceOrder: 6,
            factLocator: "paragraph:claim",
            sourceRole,
          },
        ]),
        /fact integrity/i,
      );
    }
  });

  it("enforces complementary restrictions in both directions while retaining mixed provenance", async () => {
    const mixed = await db.query<{
      valid: boolean;
      scope: string;
      source_types: string[];
    }>(`
      SELECT public.therapy_input_fact_is_valid_v1(fact.id) AS valid,
             fact.evidence_scope AS scope,
             array_agg(source.source_type ORDER BY fact_source.link_order) AS source_types
        FROM public.therapy_input_facts fact
        JOIN public.therapy_input_fact_sources fact_source
          ON fact_source.therapy_input_fact_id = fact.id
        JOIN public.therapy_input_sources source
          ON source.therapy_input_revision_id = fact_source.therapy_input_revision_id
         AND source.source_order = fact_source.source_order
       WHERE fact.id = '${complementaryFactId}'
       GROUP BY fact.id
    `);
    expect(mixed.rows[0]).toEqual({
      valid: true,
      scope: "complementary_measurement",
      source_types: ["complementary_measurement", "laboratory"],
    });

    const invalidGraphs: Array<[Partial<FactFixture>, number]> = [
      [{ evidenceScope: "patient_report" }, 3],
      [{ evidenceScope: "complementary_measurement" }, 1],
      [{
        evidenceScope: "complementary_measurement",
        factType: "open_question",
        certainty: "uncertain",
        reviewStatus: "unreviewed",
      }, 3],
      [{
        evidenceScope: "complementary_measurement",
        factType: "symptom",
        certainty: "possible",
      }, 3],
      [{
        evidenceScope: "complementary_measurement",
        factType: "open_question",
        certainty: "confirmed",
      }, 3],
      [{
        evidenceScope: "complementary_measurement",
        factType: "examination_finding",
        certainty: "possible",
        reviewStatus: "verified",
        reviewedAt,
        reviewedBy: reviewerId,
      }, 3],
      [{
        evidenceScope: "complementary_measurement",
        factType: "examination_finding",
        certainty: "uncertain",
        kbEntityId,
      }, 3],
    ];
    for (const [overrides, sourceOrder] of invalidGraphs) {
      await expectTransactionFailure(
        () => insertFactGraph(makeFact(overrides), [{
          linkOrder: 1,
          sourceOrder,
          factLocator: "section:result",
          sourceRole: "primary",
        }]),
        /fact integrity/i,
      );
    }

  });

  it("allows the vieva_plus constrained shape and prevents AI-assisted verification", async () => {
    const vievaFact = makeFact({
      evidenceScope: "complementary_measurement",
      factType: "open_question",
      certainty: "not_applicable",
      reviewStatus: "review_only",
    });
    await insertFactGraph(vievaFact, [{
      linkOrder: 1,
      sourceOrder: 4,
      factLocator: "section:result",
      sourceRole: "primary",
    }]);
    const valid = await db.query<{ valid: boolean }>(
      "SELECT public.therapy_input_fact_is_valid_v1($1) AS valid",
      [vievaFact.id],
    );
    expect(valid.rows[0].valid).toBe(true);

    await expect(insertFactGraph(makeFact({
      extractionMethod: "ai_assisted",
      reviewStatus: "verified",
      reviewedAt,
      reviewedBy: reviewerId,
    }), [{
      linkOrder: 1,
      sourceOrder: 1,
      factLocator: "line:1",
      sourceRole: "primary",
    }])).rejects.toThrow(/verified_check|check constraint/i);

    const verified = await db.query<{
      valid: boolean;
      method: string;
      reviewed_at: string;
      reviewed_by: string;
    }>(`
      SELECT public.therapy_input_fact_is_valid_v1(id) AS valid,
             extraction_method AS method,
             reviewed_at::text,
             reviewed_by::text
        FROM public.therapy_input_facts
       WHERE id = '${verifiedFactId}'
    `);
    expect(verified.rows[0]).toMatchObject({
      valid: true,
      method: "manual",
      reviewed_by: reviewerId,
    });
    expect(verified.rows[0].reviewed_at).toBeTruthy();
  });

  it("pairs reviewer metadata, orders review time, and enforces consistent date precision", async () => {
    await expect(insertFactGraph(makeFact({ reviewedAt, reviewedBy: null }), [{
      linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary",
    }])).rejects.toThrow(/reviewer_pair|check constraint/i);

    await expect(insertFactGraph(makeFact({
      reviewedAt: "2026-07-31T09:00:00Z",
      reviewedBy: reviewerId,
    }), [{
      linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary",
    }])).rejects.toThrow(/review_time|check constraint/i);

    for (const overrides of [
      { effectiveDatePrecision: "unknown", effectiveStartDate: "2026-07-01" },
      { effectiveDatePrecision: "month", effectiveStartDate: "2026-07-02" },
      { effectiveDatePrecision: "year", effectiveStartDate: "2026-02-01" },
      {
        effectiveDatePrecision: "range",
        effectiveStartDate: "2026-07-20",
        effectiveEndDate: "2026-07-19",
      },
    ]) {
      await expect(insertFactGraph(makeFact(overrides), [{
        linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary",
      }])).rejects.toThrow(/effective_date|check constraint/i);
    }
  });

  it("constrains supersession to one later correction in the same revision", async () => {
    const lineage = await db.query<{
      predecessor_order: number;
      successor_order: number;
      successors: number;
      comment: string;
    }>(`
      SELECT predecessor.fact_order AS predecessor_order,
             successor.fact_order AS successor_order,
             (SELECT count(*)::int FROM public.therapy_input_facts other
               WHERE other.supersedes_fact_id = predecessor.id) AS successors,
             col_description(
               'public.therapy_input_facts'::regclass,
               (SELECT ordinal_position
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'therapy_input_facts'
                   AND column_name = 'supersedes_fact_id')
             ) AS comment
        FROM public.therapy_input_facts predecessor
        JOIN public.therapy_input_facts successor
          ON successor.supersedes_fact_id = predecessor.id
       WHERE predecessor.id = '${labFactId}'
    `);
    expect(lineage.rows[0]).toMatchObject({
      predecessor_order: 1,
      successor_order: 5,
      successors: 1,
    });
    expect(lineage.rows[0].comment).toMatch(/correction lineage only/i);

    await expect(insertFactGraph(makeFact({
      supersedesFactId: labFactId,
    }), [{
      linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary",
    }])).rejects.toThrow(/one_successor|unique constraint/i);

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({
        revisionId: otherRevisionId,
        factOrder: 9,
        factKey: "symptom.earlier_correction",
        supersedesFactId: predecessorFactId,
      }), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:9",
        sourceRole: "primary",
      }]),
      /fact integrity/i,
    );

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({
        factOrder: 20,
        supersedesFactId: verifiedFactId,
      }), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:20",
        sourceRole: "primary",
      }]),
      /fact integrity/i,
    );

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({
        revisionId: otherRevisionId,
        factOrder: 11,
        factKey: "symptom.other_revision",
        extractedAt: "2026-07-31T09:59:59Z",
        supersedesFactId: predecessorFactId,
      }), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:11",
        sourceRole: "primary",
      }]),
      /fact integrity/i,
    );

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({
        factOrder: 21,
        factType: "medication",
        factKey: "medication.metformin",
        factLabel: "Metformin",
        factValueJson: '{"type":"coded","system":"atc","code":"A10BA02","display":"Metformin"}',
        reviewStatus: "review_only",
        supersedesFactId: verifiedFactId,
      }), [{
        linkOrder: 1,
        sourceOrder: 5,
        factLocator: "field:medication",
        sourceRole: "primary",
      }]),
      /fact integrity/i,
    );
  });

  it("enforces 64 contiguous source links and the declared fact maximum", async () => {
    const maximum = await db.query<{
      source_count: number;
      link_count: number;
      minimum_order: number;
      maximum_order: number;
      valid: boolean;
    }>(`
      SELECT fact.source_count,
             count(fact_source.*)::int AS link_count,
             min(fact_source.link_order)::int AS minimum_order,
             max(fact_source.link_order)::int AS maximum_order,
             public.therapy_input_fact_is_valid_v1(fact.id) AS valid
        FROM public.therapy_input_facts fact
        JOIN public.therapy_input_fact_sources fact_source
          ON fact_source.therapy_input_fact_id = fact.id
       WHERE fact.id = '${maximumLinksFactId}'
       GROUP BY fact.id
    `);
    expect(maximum.rows[0]).toEqual({
      source_count: 64,
      link_count: 64,
      minimum_order: 1,
      maximum_order: 64,
      valid: true,
    });

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({ sourceCount: 2 }), [
        { linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary" },
        { linkOrder: 3, sourceOrder: 2, factLocator: "line:2", sourceRole: "supporting" },
      ]),
      /fact integrity/i,
    );

    await expect(db.exec(`
      INSERT INTO public.therapy_input_fact_sources (
        therapy_input_revision_id, therapy_input_fact_id, link_order,
        source_order, fact_locator, source_role
      ) VALUES (
        '${revisionId}', '${labFactId}', 65, 1, 'line:65', 'supporting'
      )
    `)).rejects.toThrow(/check constraint/i);

    await expect(insertFactGraph(makeFact({ factOrder: 2049 }), [{
      linkOrder: 1, sourceOrder: 1, factLocator: "line:1", sourceRole: "primary",
    }])).rejects.toThrow(/check constraint/i);
  });

  it("accepts null or existing KB links, rejects missing entities, and detects deferred missing KB tampering", async () => {
    const baseline = await db.query<{ null_valid: boolean; linked_valid: boolean }>(`
      SELECT
        public.therapy_input_fact_is_valid_v1('${labFactId}') AS null_valid,
        public.therapy_input_fact_is_valid_v1('${kbFactId}') AS linked_valid
    `);
    expect(baseline.rows[0]).toEqual({ null_valid: true, linked_valid: true });

    await expectTransactionFailure(
      () => insertFactGraph(makeFact({ kbEntityId: missingKbEntityId }), [{
        linkOrder: 1,
        sourceOrder: 1,
        factLocator: "line:1",
        sourceRole: "primary",
      }]),
      /fact integrity|foreign key/i,
    );

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.therapy_input_facts
           SET kb_entity_id = '${missingKbEntityId}'
         WHERE id = '${kbFactId}'
      `);
      const tampered = await db.query<{ valid: boolean; invalid_count: number }>(`
        SELECT public.therapy_input_fact_is_valid_v1('${kbFactId}') AS valid,
               public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
      `);
      expect(tampered.rows[0]).toEqual({ valid: false, invalid_count: 1 });
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("makes fact rows and links append-only, including statement-level truncate", async () => {
    await expect(db.exec(`
      UPDATE public.therapy_input_facts SET fact_label = 'Changed'
       WHERE id = '${labFactId}'
    `)).rejects.toThrow(/append-only/i);
    await expect(db.exec(`
      DELETE FROM public.therapy_input_facts WHERE id = '${labFactId}'
    `)).rejects.toThrow(/append-only/i);
    await expect(db.exec(`
      UPDATE public.therapy_input_fact_sources SET fact_locator = 'line:changed'
       WHERE therapy_input_fact_id = '${labFactId}' AND link_order = 1
    `)).rejects.toThrow(/append-only/i);
    await expect(db.exec(`
      DELETE FROM public.therapy_input_fact_sources
       WHERE therapy_input_fact_id = '${labFactId}' AND link_order = 1
    `)).rejects.toThrow(/append-only/i);
    await expect(db.exec("TRUNCATE public.therapy_input_fact_sources"))
      .rejects.toThrow(/append-only/i);
    await expect(db.exec("TRUNCATE public.therapy_input_facts CASCADE"))
      .rejects.toThrow(/append-only/i);

    const truncateTriggers = await db.query<{ table_name: string }>(`
      SELECT table_row.relname AS table_name
        FROM pg_trigger trigger_row
        JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
       WHERE trigger_row.tgname IN (
         'therapy_input_facts_no_truncate',
         'therapy_input_fact_sources_no_truncate'
       )
         AND (trigger_row.tgtype & 32) = 32
       ORDER BY table_row.relname
    `);
    expect(truncateTriggers.rows.map((row) => row.table_name)).toEqual([
      "therapy_input_fact_sources",
      "therapy_input_facts",
    ]);
  });

  it("detects trigger-disabled row, link, and orphan-link corruption", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = repeat('f', 64)
         WHERE id = '${labFactId}'
      `);
      const tampered = await db.query<{ valid: boolean; invalid_count: number }>(`
        SELECT public.therapy_input_fact_is_valid_v1('${labFactId}') AS valid,
               public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
      `);
      expect(tampered.rows[0]).toEqual({ valid: false, invalid_count: 1 });
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_fact_sources DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.therapy_input_fact_sources
           SET fact_locator = 'line:tampered'
         WHERE therapy_input_fact_id = '${labFactId}' AND link_order = 1
      `);
      const tampered = await db.query<{ invalid_count: number }>(`
        SELECT public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
      `);
      expect(tampered.rows[0].invalid_count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_fact_sources DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        INSERT INTO public.therapy_input_fact_sources (
          therapy_input_revision_id, therapy_input_fact_id, link_order,
          source_order, fact_locator, source_role
        ) VALUES (
          '${revisionId}', '99999999-0000-4000-8000-000000000001',
          1, 1, 'line:orphan', 'primary'
        )
      `);
      const orphaned = await db.query<{ invalid_count: number }>(`
        SELECT public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
      `);
      expect(orphaned.rows[0].invalid_count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    const restored = await db.query<{ invalid_count: number }>(`
      SELECT public.therapy_input_invalid_fact_count_v1()::int AS invalid_count
    `);
    expect(restored.rows[0].invalid_count).toBe(0);
  });

  it("applies the exact table and function privilege matrix", async () => {
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
        FROM unnest(ARRAY['therapy_input_facts', 'therapy_input_fact_sources']::text[])
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
      "therapy_input_facts:authenticated:SELECT",
      "therapy_input_facts:service_role:SELECT",
      "therapy_input_fact_sources:authenticated:SELECT",
      "therapy_input_fact_sources:service_role:SELECT",
    ].sort());

    for (const role of protectedRoles) {
      for (const signature of helperSignatures) {
        const privilege = await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed",
          [role, signature],
        );
        expect(privilege.rows[0].allowed, `${role} execute ${signature}`).toBe(
          role === "service_role"
            && signature === "public.therapy_input_export_snapshot_v2()",
        );
      }
    }
  });

  it("uses admin-only RLS with service-role read-only snapshot access", async () => {
    await enterRole("authenticated", patientId);
    try {
      const hidden = await db.query<{ facts: number; links: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.therapy_input_facts) AS facts,
          (SELECT count(*)::int FROM public.therapy_input_fact_sources) AS links
      `);
      expect(hidden.rows[0]).toEqual({ facts: 0, links: 0 });
      await expect(db.query("SELECT public.therapy_input_export_snapshot_v2()"))
        .rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("authenticated", adminId);
    try {
      const visible = await db.query<{ facts: number; links: number }>(`
        SELECT
          (SELECT count(*)::int FROM public.therapy_input_facts) AS facts,
          (SELECT count(*)::int FROM public.therapy_input_fact_sources) AS links
      `);
      expect(visible.rows[0].facts).toBeGreaterThanOrEqual(7);
      expect(visible.rows[0].links).toBeGreaterThanOrEqual(71);
      await expect(db.exec(`
        DELETE FROM public.therapy_input_facts WHERE id = '${labFactId}'
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    await enterRole("service_role");
    try {
      const snapshot = await db.query<{ value: string }>(
        "SELECT public.therapy_input_export_snapshot_v2() AS value",
      );
      expect(JSON.parse(snapshot.rows[0].value)).toMatchObject({
        snapshot_version: 2,
        validation: { invalid_revision_count: 0, invalid_fact_count: 0 },
      });
      await expect(db.exec("TRUNCATE public.therapy_input_fact_sources"))
        .rejects.toThrow(/permission denied/i);
    } finally {
      await leaveRole();
    }

    for (const role of ["anon", "kb_importer", "kb_import_runtime"]) {
      await enterRole(role);
      try {
        for (const table of factTables) {
          await expect(db.query(`SELECT * FROM public.${table}`))
            .rejects.toThrow(/permission denied/i);
        }
      } finally {
        await leaveRole();
      }
    }
  });

  it("keeps snapshot v1 byte-for-byte and definition-for-definition unchanged", async () => {
    const after = await db.query<{ definition: string; snapshot: string }>(`
      SELECT pg_get_functiondef(
               'public.therapy_input_export_snapshot_v1()'::regprocedure
             ) AS definition,
             public.therapy_input_export_snapshot_v1() AS snapshot
    `);
    expect(after.rows[0].definition).toBe(v1DefinitionBefore);
    expect(after.rows[0].snapshot).toBe(v1SnapshotBefore);
    expect(migration).not.toMatch(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.therapy_input_export_snapshot_v1/i,
    );
    expect(migration).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.therapy_input_(?:canonical_jsonb|jsonb_sha256)_v1/i,
    );
    expect(migration).toContain("public.therapy_input_export_snapshot_v1()::jsonb");
  });

  it("exports all four tables losslessly and restores them in one owner transaction", async () => {
    const original = await exportSnapshotV2();
    expect(original.snapshot_version).toBe(2);
    expect(original.validation).toEqual({
      invalid_revision_count: 0,
      invalid_fact_count: 0,
    });
    expect(Object.keys(original.tables).sort()).toEqual([...snapshotTables].sort());
    expect(Object.keys(original.manifest).sort()).toEqual([...snapshotTables].sort());
    expect(original.tables.therapy_input_facts).toContain("9007199254740993");
    expect(JSON.parse(original.tables.therapy_input_facts)).toHaveLength(
      original.manifest.therapy_input_facts.rows,
    );
    expect(JSON.parse(original.tables.therapy_input_fact_sources)).toHaveLength(
      original.manifest.therapy_input_fact_sources.rows,
    );

    for (const table of snapshotTables) {
      const calculated = await db.query<HashRow>(
        "SELECT encode(sha256(convert_to($1::text, 'UTF8')), 'hex') AS hash",
        [original.tables[table]],
      );
      expect(calculated.rows[0].hash).toBe(original.manifest[table].sha256);
    }

    await db.exec("SET TIME ZONE 'Europe/Berlin';");
    try {
      const alternateTimezone = await exportSnapshotV2();
      expect(alternateTimezone.tables).toEqual(original.tables);
      expect(alternateTimezone.manifest).toEqual(original.manifest);
    } finally {
      await db.exec("SET TIME ZONE 'UTC';");
    }

    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of snapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }

      await db.exec("DELETE FROM public.therapy_input_fact_sources;");
      await db.exec("DELETE FROM public.therapy_input_facts;");
      await db.exec("DELETE FROM public.therapy_input_sources;");
      await db.exec("DELETE FROM public.therapy_input_revisions;");

      for (const table of snapshotTables) {
        await db.query(
          `INSERT INTO public.${table}
           SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [original.tables[table]],
        );
      }

      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      const validation = await db.query<{ revisions: number; facts: number }>(`
        SELECT public.therapy_input_invalid_revision_count_v1()::int AS revisions,
               public.therapy_input_invalid_fact_count_v1()::int AS facts
      `);
      expect(validation.rows[0]).toEqual({ revisions: 0, facts: 0 });

      for (const table of snapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }
      const restored = await exportSnapshotV2();
      expect(restored.tables).toEqual(original.tables);
      expect(restored.manifest).toEqual(original.manifest);
      expect(restored.validation).toEqual(original.validation);
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("performs no backfill, writer creation, or patient-table mutation", async () => {
    expect({ facts: emptyFactCount, links: emptyLinkCount }).toEqual({ facts: 0, links: 0 });
    const patientAfter = await db.query<{ session: string; snapshot: string }>(`
      SELECT
        (SELECT row_to_json(stored)::text FROM (
          SELECT * FROM public.therapy_sessions
        ) stored) AS session,
        (SELECT row_to_json(stored)::text FROM (
          SELECT * FROM public.patient_snapshot
        ) stored) AS snapshot
    `);
    expect(patientAfter.rows[0]).toEqual({
      session: patientSessionBefore,
      snapshot: patientSnapshotBefore,
    });
    expect(migration).not.toMatch(
      /\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.(?:therapy_sessions|patient_snapshot)\b/i,
    );
    expect(migration).not.toMatch(
      /FUNCTION\s+public\.therapy_input_(?:capture|write|backfill|extract)/i,
    );
    expect(migration).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./i);
    for (const { relativePath, source } of productionSources) {
      if (therapyInputBackupSources.has(relativePath)) continue;
      expect(source, relativePath).not.toMatch(
        /therapy_input_(?:revisions|sources|facts|fact_sources|export_snapshot_v[12])/,
      );
    }
  });
});
