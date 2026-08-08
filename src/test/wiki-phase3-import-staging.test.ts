// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const phase1Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728090000_create_kb_phase1_core.sql"),
  "utf8",
);
const phase2Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728130000_create_kb_phase2_legacy_bridge.sql"),
  "utf8",
);
const phase3Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728140000_create_kb_phase3_import_staging.sql"),
  "utf8",
);
const sourcePromotionMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728150000_create_kb_source_draft_promotion.sql"),
  "utf8",
);
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(resolve(process.cwd(), "supabase/functions/backup-export/index.ts"), "utf8");
const snapshotValidationSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/wikiSnapshotValidation.ts"),
  "utf8",
);
const klinghardtImportBatch = JSON.parse(readFileSync(
  resolve(process.cwd(), "docs/klinghardt-talks-001-025-import-batch.json"),
  "utf8",
));

const stagingTables = [
  "kb_import_batches",
  "kb_source_candidates",
  "kb_entity_candidates",
  "kb_relation_candidates",
  "kb_dosage_candidates",
  "kb_safety_candidates",
  "kb_review_decisions",
  "kb_import_errors",
];
const wikiSnapshotTables = [
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_articles", "kb_article_revisions", "kb_article_entities", "kb_change_proposals",
  ...stagingTables,
  "kb_source_candidate_draft_promotions",
  "faqs", "practice_pricing", "practice_info",
] as const;
const wikiRestoreOrder = [
  "kb_entity_types", "kb_identifier_schemes", "kb_relation_types", "kb_relation_type_domains",
  "kb_entities", "kb_entity_revisions", "kb_entity_names", "kb_entity_identifiers",
  "kb_sources", "kb_source_revisions", "kb_assertions", "kb_entity_relations", "kb_assertion_sources",
  "kb_articles", "kb_article_revisions", "kb_article_entities", "kb_change_proposals",
  "kb_import_batches", "kb_source_candidates", "kb_entity_candidates", "kb_relation_candidates",
  "kb_dosage_candidates", "kb_safety_candidates", "kb_review_decisions", "kb_import_errors",
  "kb_source_candidate_draft_promotions",
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const batchOneId = "81000000-0000-4000-8000-000000000001";
const batchTwoId = "81000000-0000-4000-8000-000000000002";
const klinghardtBatchId = "81000000-0000-4000-8000-000000000003";
const sourceCandidateId = "82000000-0000-4000-8000-000000000001";
const targetSourceCandidateId = "82000000-0000-4000-8000-000000000002";
const collisionSourceCandidateId = "82000000-0000-4000-8000-000000000003";
const preexistingSourceId = "84000000-0000-4000-8000-000000000001";
const entityCandidateId = "83000000-0000-4000-8000-000000000001";
const secondEntityCandidateId = "83000000-0000-4000-8000-000000000002";

let db: PGlite;

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
      category text NOT NULL DEFAULT 'Allgemein',
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
    CREATE TABLE public.patient_snapshot (pseudonym_id text PRIMARY KEY, snapshot jsonb NOT NULL DEFAULT '{}'::jsonb);
    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
  `);
  await db.exec(phase1Migration);
  await db.exec(phase2Migration);
  await db.exec(phase3Migration);
  await db.exec(sourcePromotionMigration);
  await db.exec(`
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${preexistingSourceId}', 'source:existing-target');
  `);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 3 import staging", () => {
  it("stages all reviewed Klinghardt source cards only as unpublished candidates", async () => {
    await db.exec("SET ROLE kb_importer;");
    try {
      await db.query(
        `INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, parser_name, parser_version,
          model_name, prompt_hash, batch_status, candidate_count, error_count,
          data_classification, metadata, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NULL
        )`,
        [
          klinghardtBatchId,
          klinghardtImportBatch.batch.source_kind,
          klinghardtImportBatch.batch.source_label,
          klinghardtImportBatch.batch.source_hash,
          klinghardtImportBatch.batch.parser_name,
          klinghardtImportBatch.batch.parser_version,
          klinghardtImportBatch.batch.model_name,
          klinghardtImportBatch.batch.prompt_hash,
          klinghardtImportBatch.batch.batch_status,
          klinghardtImportBatch.batch.candidate_count,
          klinghardtImportBatch.batch.error_count,
          klinghardtImportBatch.batch.data_classification,
          JSON.stringify(klinghardtImportBatch.batch.metadata),
        ],
      );
      for (const candidate of klinghardtImportBatch.source_candidates) {
        await db.query(
          `INSERT INTO public.kb_source_candidates (
            batch_id, candidate_key, candidate_status, proposed_source_type, title,
            publisher, publication_date, source_url, external_identifier, rights_status,
            source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
          )`,
          [
            klinghardtBatchId,
            candidate.candidate_key,
            candidate.candidate_status,
            candidate.proposed_source_type,
            candidate.title,
            candidate.publisher,
            candidate.publication_date,
            candidate.source_url,
            candidate.external_identifier,
            candidate.rights_status,
            candidate.source_locator,
            candidate.original_excerpt,
            candidate.confidence,
            candidate.ambiguity_notes,
            JSON.stringify(candidate.proposed_data),
          ],
        );
      }
      const staged = await db.query<{
        candidate_count: number;
        unreviewed_count: number;
        releaseable_count: number;
      }>(`
        SELECT
          count(*)::integer AS candidate_count,
          count(*) FILTER (WHERE candidate_status = 'imported_unreviewed')::integer AS unreviewed_count,
          count(*) FILTER (WHERE candidate_status IN ('approved', 'released'))::integer AS releaseable_count
        FROM public.kb_source_candidates
        WHERE batch_id = '${klinghardtBatchId}'
      `);
      expect(staged.rows[0]).toEqual({
        candidate_count: 62,
        unreviewed_count: 62,
        releaseable_count: 0,
      });
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("creates exactly eight isolated staging tables with no approval statuses", async () => {
    const tables = await db.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (${stagingTables.map((table) => `'${table}'`).join(", ")})
       ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual([...stagingTables].sort());
    expect(phase3Migration).not.toMatch(/candidate_status[^;]*(approved|released)/i);
    expect(phase3Migration).toContain("data_classification = 'general_knowledge'");
    expect(phase3Migration).toContain("Import candidates must be inserted as imported_unreviewed");
    expect(sourcePromotionMigration).toMatch(/^BEGIN;/);
    expect(sourcePromotionMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(sourcePromotionMigration.match(/CREATE TABLE public\./g)).toHaveLength(1);
    expect(sourcePromotionMigration).not.toMatch(/\b(?:Epstein|Candida|Ferritin|Heel|Diamond|NutraMedix)\b/i);
    const importerRole = await db.query<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolbypassrls: boolean;
      runtime_canlogin: boolean;
      runtime_bypassrls: boolean;
      runtime_member: boolean;
    }>(`
      SELECT
        importer.rolcanlogin,
        importer.rolsuper,
        importer.rolcreatedb,
        importer.rolcreaterole,
        importer.rolinherit,
        importer.rolbypassrls,
        runtime.rolcanlogin AS runtime_canlogin,
        runtime.rolbypassrls AS runtime_bypassrls,
        pg_has_role('kb_import_runtime', 'kb_importer', 'MEMBER') AS runtime_member
      FROM pg_roles importer
      CROSS JOIN pg_roles runtime
      WHERE importer.rolname = 'kb_importer' AND runtime.rolname = 'kb_import_runtime'
    `);
    expect(importerRole.rows[0]).toEqual({
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolinherit: false,
      rolbypassrls: false,
      runtime_canlogin: false,
      runtime_bypassrls: false,
      runtime_member: true,
    });
  });

  it("lets server-side importers create only unreviewed, source-bound candidates", async () => {
    await db.exec("SET ROLE kb_importer;");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, parser_name, parser_version, created_by
        ) VALUES (
          '${batchOneId}', 'parser', 'Synthetischer Parser-Test', repeat('a', 64), 'test-parser', '1.0.0', NULL
        ), (
          '${batchTwoId}', 'manual', 'Getrennter Test-Batch', repeat('b', 64), '', '', NULL
        );

        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, title, proposed_source_type, publisher, publication_date,
          source_url, source_locator, original_excerpt, target_source_id
        ) VALUES
          ('${sourceCandidateId}', '${batchOneId}', 'source:synthetic-1', 'Synthetische Originalquelle', 'reference_work', 'Testverlag', '2026-01-15', 'https://example.invalid/source', 'S. 1', 'Rein erfundener Testtext', NULL),
          ('${targetSourceCandidateId}', '${batchOneId}', 'source:synthetic-target', 'Synthetische Bestandsquelle', 'website', '', NULL, '', 'S. 2', 'Nur Bestandsrevision', '${preexistingSourceId}'),
          ('${collisionSourceCandidateId}', '${batchOneId}', 'source:synthetic-collision', 'Synthetische Kollisionsquelle', 'website', '', NULL, '', 'S. 3', 'Nur Kollisionstest', NULL);

        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, source_candidate_id, source_locator, original_excerpt
        ) VALUES
          ('${entityCandidateId}', '${batchOneId}', 'entity:synthetic-a', 'pathogen', 'pathogen:synthetic-a', 'Synthetisches Objekt A', '${sourceCandidateId}', 'S. 1', 'Test A'),
          ('${secondEntityCandidateId}', '${batchOneId}', 'entity:synthetic-b', 'symptom', 'symptom:synthetic-b', 'Synthetisches Objekt B', '${sourceCandidateId}', 'S. 1', 'Test B');

        INSERT INTO public.kb_relation_candidates (
          batch_id, candidate_key, subject_candidate_id, object_candidate_id,
          proposed_relation_type_code, source_candidate_id, source_locator, original_excerpt
        ) VALUES (
          '${batchOneId}', 'relation:synthetic-a-b', '${entityCandidateId}', '${secondEntityCandidateId}',
          'may_be_associated_with', '${sourceCandidateId}', 'S. 1', 'Unklare synthetische Beziehung'
        );

        INSERT INTO public.kb_safety_candidates (
          batch_id, candidate_key, subject_candidate_id, rule_type, severity, action_text,
          source_candidate_id, source_locator, original_excerpt
        ) VALUES (
          '${batchOneId}', 'safety:synthetic-a', '${entityCandidateId}', 'precaution', 'require_review',
          'Nur als Test pruefen', '${sourceCandidateId}', 'S. 1', 'Synthetischer Sicherheitshinweis'
        );

        INSERT INTO public.kb_dosage_candidates (
          batch_id, candidate_key, subject_candidate_id, minimum_dose, maximum_dose,
          dose_unit, application_text, source_candidate_id, source_locator, original_excerpt
        ) VALUES (
          '${batchOneId}', 'dosage:synthetic-a', '${entityCandidateId}', 1, 2,
          'Testeinheit', 'Keine echte Dosierung', '${sourceCandidateId}', 'S. 1', 'Synthetischer Dosierungstext'
        );

        INSERT INTO public.kb_import_errors (
          batch_id, candidate_kind, candidate_key, error_code, severity, error_message, source_locator
        ) VALUES (
          '${batchOneId}', 'entity', 'entity:synthetic-warning', 'SYNTHETIC_WARNING', 'warning', 'Synthetischer Testfehler', 'S. 2'
        );
      `);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidates (
          batch_id, candidate_key, candidate_status, display_name
        ) VALUES (
          '${batchOneId}', 'entity:forbidden', 'accepted_as_draft', 'Nicht erlaubt'
        );
      `)).rejects.toThrow(/must be inserted as imported_unreviewed/);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidates (
          batch_id, candidate_key, display_name, source_candidate_id
        ) VALUES (
          '${batchTwoId}', 'entity:cross-batch', 'Falscher Batch', '${sourceCandidateId}'
        );
      `)).rejects.toThrow(/source_same_batch_fk/);

      await expect(db.exec(`
        INSERT INTO public.kb_dosage_candidates (
          batch_id, candidate_key, subject_candidate_id, application_text
        ) VALUES (
          '${batchOneId}', 'dosage:no-source', '${entityCandidateId}', 'Keine echte Dosierung'
        );
      `)).rejects.toThrow(/source_candidate_id/);

      for (const statement of [
        `INSERT INTO public.kb_relation_candidates (batch_id, candidate_key, subject_candidate_id, object_candidate_id, source_candidate_id) VALUES ('${batchTwoId}', 'relation:cross-batch', '${entityCandidateId}', '${secondEntityCandidateId}', '${sourceCandidateId}')`,
        `INSERT INTO public.kb_dosage_candidates (batch_id, candidate_key, subject_candidate_id, source_candidate_id) VALUES ('${batchTwoId}', 'dosage:cross-batch', '${entityCandidateId}', '${sourceCandidateId}')`,
        `INSERT INTO public.kb_safety_candidates (batch_id, candidate_key, subject_candidate_id, rule_type, action_text, source_candidate_id) VALUES ('${batchTwoId}', 'safety:cross-batch', '${entityCandidateId}', 'precaution', 'Test', '${sourceCandidateId}')`,
      ]) {
        await expect(db.exec(statement)).rejects.toThrow(/same_batch_fk/);
      }

      await expect(db.exec(`
        UPDATE public.kb_source_candidates
           SET candidate_status = 'accepted_as_draft'
         WHERE id = '${sourceCandidateId}';
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        INSERT INTO public.kb_review_decisions (
          candidate_kind, candidate_id, decision, status_before, status_after, decided_by
        ) VALUES (
          'entity', '${entityCandidateId}', 'reject', 'imported_unreviewed', 'rejected', '${adminId}'
        );
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        INSERT INTO public.kb_entities (entity_type_code, canonical_key)
        VALUES ('pathogen', 'pathogen:service-role-bypass');
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec("TRUNCATE TABLE public.kb_entities;")).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        DELETE FROM public.kb_entity_candidates WHERE id = '${secondEntityCandidateId}';
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        DELETE FROM public.kb_import_batches WHERE id = '${batchTwoId}';
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec("TRUNCATE TABLE public.kb_import_batches;")).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        INSERT INTO public.kb_entities (entity_type_code, canonical_key)
        VALUES ('pathogen', 'pathogen:importer-bypass');
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        SELECT * FROM public.patient_snapshot;
      `)).rejects.toThrow(/permission denied/);

      await db.exec(`
        UPDATE public.kb_import_batches SET batch_status = 'processing' WHERE id = '${batchOneId}';
        UPDATE public.kb_import_batches SET batch_status = 'ready_for_review' WHERE id = '${batchOneId}';
      `);
      await expect(db.exec(`
        UPDATE public.kb_import_batches SET source_hash = repeat('c', 64) WHERE id = '${batchOneId}';
      `)).rejects.toThrow(/provenance is immutable/);
      await expect(db.exec(`
        UPDATE public.kb_import_batches SET batch_status = 'reviewed' WHERE id = '${batchOneId}';
      `)).rejects.toThrow(/controlled completion function/);
      await expect(db.exec(`
        INSERT INTO public.kb_source_candidates (batch_id, candidate_key, title)
        VALUES ('${batchOneId}', 'source:late', 'Zu spaet');
      `)).rejects.toThrow(/require an open import batch/);
      await expect(db.exec(`
        INSERT INTO public.kb_import_errors (batch_id, error_code, error_message)
        VALUES ('${batchOneId}', 'LATE', 'Zu spaet');
      `)).rejects.toThrow(/require an open import batch/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await db.exec("SET ROLE service_role;");
    try {
      await expect(db.exec("TRUNCATE TABLE public.kb_review_decisions;")).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        INSERT INTO public.kb_review_decisions (
          candidate_kind, candidate_id, decision, status_before, status_after, decided_by
        ) VALUES ('entity', '${entityCandidateId}', 'reject', 'imported_unreviewed', 'rejected', '${adminId}');
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("allows admin review only through the controlled append-only decision RPC", async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      const visible = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.kb_entity_candidates");
      expect(visible.rows[0].count).toBe(2);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidates (batch_id, candidate_key, display_name)
        VALUES ('${batchOneId}', 'entity:direct-admin', 'Direkt nicht erlaubt');
      `)).rejects.toThrow(/permission denied/);

      await expect(db.exec(`SELECT public.kb_complete_import_batch_review('${batchOneId}');`))
        .rejects.toThrow(/terminal review decision/);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:too-early', 'book'
        );
      `)).rejects.toThrow(/batch must be reviewed/);

      await expect(db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${entityCandidateId}', 'accept_as_draft', 'Quelle noch offen'
        );
      `)).rejects.toThrow(/source must be accepted first/);

      await db.exec(`
        SELECT public.kb_record_import_review_decision('source', '${sourceCandidateId}', 'accept_as_draft', 'Quelle synthetisch geprueft');
        SELECT public.kb_record_import_review_decision('source', '${targetSourceCandidateId}', 'accept_as_draft', 'Bestandsquelle synthetisch geprueft');
        SELECT public.kb_record_import_review_decision('source', '${collisionSourceCandidateId}', 'accept_as_draft', 'Kollisionsquelle synthetisch geprueft');
      `);
      const decision = await db.query<{ decision_id: string }>(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${entityCandidateId}', 'accept_as_draft', 'Synthetisch geprueft'
        )::text AS decision_id
      `);
      expect(decision.rows[0].decision_id).toMatch(/^[0-9a-f-]{36}$/);
      await expect(db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${entityCandidateId}', 'reject', 'Zweite Entscheidung'
        );
      `)).rejects.toThrow(/already has a terminal decision/);
      await db.exec(`
        SELECT public.kb_record_import_review_decision('entity', '${secondEntityCandidateId}', 'reject', 'Synthetischer Ablehnungsfall');
        SELECT public.kb_record_import_review_decision(
          'relation', (SELECT id FROM public.kb_relation_candidates WHERE candidate_key = 'relation:synthetic-a-b'), 'reject', 'Keine echte Relation'
        );
        SELECT public.kb_record_import_review_decision(
          'safety', (SELECT id FROM public.kb_safety_candidates WHERE candidate_key = 'safety:synthetic-a'), 'reject', 'Keine echte Sicherheitsregel'
        );
        SELECT public.kb_record_import_review_decision(
          'dosage', (SELECT id FROM public.kb_dosage_candidates WHERE candidate_key = 'dosage:synthetic-a'), 'reject', 'Keine echte Dosierung'
        );
        SELECT public.kb_complete_import_batch_review('${batchOneId}');
      `);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    const reviewed = await db.query<{ candidate_status: string; reviewed_by: string }>(`
      SELECT candidate_status, reviewed_by::text
        FROM public.kb_entity_candidates
       WHERE id = '${entityCandidateId}'
    `);
    expect(reviewed.rows[0]).toEqual({ candidate_status: "accepted_as_draft", reviewed_by: adminId });
    const completed = await db.query<{ batch_status: string; candidate_count: number; error_count: number }>(`
      SELECT batch_status, candidate_count, error_count FROM public.kb_import_batches WHERE id = '${batchOneId}'
    `);
    expect(completed.rows[0]).toEqual({ batch_status: "reviewed", candidate_count: 8, error_count: 1 });

    await expect(db.exec(`
      UPDATE public.kb_entity_candidates SET display_name = 'Nachtraeglich veraendert' WHERE id = '${entityCandidateId}';
    `)).rejects.toThrow(/identity and payload are immutable/);
    await expect(db.exec("DELETE FROM public.kb_review_decisions;")).rejects.toThrow(/append-only/);
  });

  it("promotes one accepted source candidate into an auditable core draft", async () => {
    let promotedSourceId = "";
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'Ungültiger Schlüssel', 'book'
        );
      `)).rejects.toThrow(/Invalid source canonical key/);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'guessed_type'
        );
      `)).rejects.toThrow(/Invalid core source type/);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${targetSourceCandidateId}', 'source:target-not-allowed', 'website'
        );
      `)).rejects.toThrow(/separate revision workflow/);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${collisionSourceCandidateId}', 'source:existing-target', 'website'
        );
      `)).rejects.toThrow(/canonical key already exists/);

      const first = await db.query<{
        promoted_source_id: string;
        promoted_source_revision_id: string;
        was_created: boolean;
      }>(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'book'
        )
      `);
      expect(first.rows[0].was_created).toBe(true);
      promotedSourceId = first.rows[0].promoted_source_id;

      const persisted = await db.query<{
        source_id: string;
        revision_id: string;
        canonical_key: string;
        revision_no: number;
        source_type: string;
        title: string;
        publisher: string;
        published_on: string;
        url: string;
        review_status: string;
        reviewed_at: string | null;
        released_at: string | null;
        content_hash: string;
        expected_hash: string;
        origin_type: string;
        candidate_status: string;
        decision_count: number;
      }>(`
        SELECT
          source.id::text AS source_id,
          revision.id::text AS revision_id,
          source.canonical_key,
          revision.revision_no,
          revision.source_type,
          revision.title,
          revision.publisher,
          revision.published_on::text,
          revision.url,
          revision.review_status,
          revision.reviewed_at::text,
          revision.released_at::text,
          revision.content_hash,
          encode(sha256(convert_to(jsonb_build_object(
            'source_type', revision.source_type,
            'title', revision.title,
            'publisher', revision.publisher,
            'published_on', revision.published_on,
            'url', revision.url,
            'rights_status', revision.rights_status
          )::text, 'UTF8')), 'hex') AS expected_hash,
          revision.metadata ->> 'origin_type' AS origin_type,
          candidate.candidate_status,
          (SELECT count(*)::int FROM public.kb_review_decisions decision
            WHERE decision.candidate_kind = 'source' AND decision.candidate_id = candidate.id) AS decision_count
        FROM public.kb_source_candidate_draft_promotions promotion
        JOIN public.kb_sources source ON source.id = promotion.source_id
        JOIN public.kb_source_revisions revision ON revision.id = promotion.source_revision_id
        JOIN public.kb_source_candidates candidate ON candidate.id = promotion.source_candidate_id
        WHERE promotion.source_candidate_id = '${sourceCandidateId}'
      `);
      expect(persisted.rows[0]).toEqual(expect.objectContaining({
        source_id: first.rows[0].promoted_source_id,
        revision_id: first.rows[0].promoted_source_revision_id,
        canonical_key: "source:synthetic-promoted",
        revision_no: 1,
        source_type: "book",
        title: "Synthetische Originalquelle",
        publisher: "Testverlag",
        published_on: "2026-01-15",
        url: "https://example.invalid/source",
        review_status: "draft",
        reviewed_at: null,
        released_at: null,
        origin_type: "import",
        candidate_status: "accepted_as_draft",
        decision_count: 1,
      }));
      expect(persisted.rows[0].content_hash).toBe(persisted.rows[0].expected_hash);

      const repeated = await db.query<{
        promoted_source_id: string;
        promoted_source_revision_id: string;
        was_created: boolean;
      }>(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'book'
        )
      `);
      expect(repeated.rows[0]).toEqual({
        promoted_source_id: first.rows[0].promoted_source_id,
        promoted_source_revision_id: first.rows[0].promoted_source_revision_id,
        was_created: false,
      });
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:different', 'book'
        );
      `)).rejects.toThrow(/different parameters/);

      await db.exec(`
        UPDATE public.kb_source_revisions
           SET title = 'Redaktionell bearbeiteter Entwurf',
               content_hash = encode(sha256(convert_to(jsonb_build_object(
                 'source_type', source_type,
                 'title', 'Redaktionell bearbeiteter Entwurf',
                 'publisher', publisher,
                 'published_on', published_on,
                 'url', url,
                 'rights_status', rights_status
               )::text, 'UTF8')), 'hex')
         WHERE id = '${first.rows[0].promoted_source_revision_id}';
      `);
      const repeatedAfterEdit = await db.query<{ was_created: boolean }>(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'book'
        )
      `);
      expect(repeatedAfterEdit.rows[0].was_created).toBe(false);

      await expect(db.exec(`
        UPDATE public.kb_sources
           SET metadata = jsonb_set(metadata, '{source_candidate_id}', '"00000000-0000-4000-8000-000000000000"')
         WHERE id = '${first.rows[0].promoted_source_id}';
      `)).rejects.toThrow(/provenance fields are immutable/);
      await expect(db.exec(`
        UPDATE public.kb_source_revisions
           SET metadata = metadata - 'review_decision_id'
         WHERE id = '${first.rows[0].promoted_source_revision_id}';
      `)).rejects.toThrow(/provenance fields are immutable/);
      await expect(db.exec(`
        UPDATE public.kb_sources
           SET metadata = jsonb_set(metadata, '{conversion_version}', '"1"'::jsonb)
         WHERE id = '${first.rows[0].promoted_source_id}';
      `)).rejects.toThrow(/provenance fields are immutable/);

      await expect(db.exec(`
        INSERT INTO public.kb_source_candidate_draft_promotions (
          source_candidate_id, batch_id, review_decision_id, source_id, source_revision_id,
          selected_canonical_key, selected_source_type, initial_content_hash, promoted_by
        ) SELECT
          '${collisionSourceCandidateId}', '${batchOneId}', review_decision_id, source_id, source_revision_id,
          'source:direct', 'book', repeat('f', 64), '${adminId}'
        FROM public.kb_source_candidate_draft_promotions LIMIT 1;
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_source_candidates DISABLE TRIGGER USER;");
    try {
      await db.exec(`UPDATE public.kb_source_candidates SET title = 'Manipulierter Kandidat' WHERE id = '${sourceCandidateId}';`);
      await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}'; SAVEPOINT before_retry;`);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'book'
        );
      `)).rejects.toThrow(/integrity check/);
      await db.exec("ROLLBACK TO SAVEPOINT before_retry; RESET ROLE; RESET request.jwt.claim.sub;");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_source_candidate_draft_promotions DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_source_candidate_draft_promotions
           SET initial_content_hash = repeat('0', 64)
         WHERE source_candidate_id = '${sourceCandidateId}';
      `);
      await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}'; SAVEPOINT before_retry;`);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:synthetic-promoted', 'book'
        );
      `)).rejects.toThrow(/integrity check/);
      await db.exec("ROLLBACK TO SAVEPOINT before_retry; RESET ROLE; RESET request.jwt.claim.sub;");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_sources DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_sources
           SET metadata = jsonb_set(metadata, '{conversion_version}', '"1"'::jsonb)
         WHERE id = '${promotedSourceId}';
      `);
      const invalidSnapshot = await db.query<{ invalid_source_promotions: number }>(`
        SELECT (public.kb_export_wiki_snapshot() -> 'validation' ->> 'invalid_source_promotions')::int
          AS invalid_source_promotions
      `);
      expect(invalidSnapshot.rows[0].invalid_source_promotions).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    const counts = await db.query<{ sources: number; revisions: number; promotions: number }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_sources) AS sources,
        (SELECT count(*)::int FROM public.kb_source_revisions) AS revisions,
        (SELECT count(*)::int FROM public.kb_source_candidate_draft_promotions) AS promotions
    `);
    expect(counts.rows[0]).toEqual({ sources: 2, revisions: 1, promotions: 1 });

    await db.exec("SET ROLE service_role;");
    try {
      const readable = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.kb_source_candidate_draft_promotions");
      expect(readable.rows[0].count).toBe(1);
      await expect(db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${collisionSourceCandidateId}', 'source:service-forbidden', 'website'
        );
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec("TRUNCATE public.kb_source_candidate_draft_promotions;")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await db.exec("SET ROLE kb_importer;");
    try {
      await expect(db.exec("SELECT * FROM public.kb_source_candidate_draft_promotions;")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("hides staging from patients and includes all tables in both backup paths", async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${patientId}';`);
    try {
      const hidden = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.kb_import_batches");
      expect(hidden.rows[0].count).toBe(0);
      const hiddenPromotions = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.kb_source_candidate_draft_promotions");
      expect(hiddenPromotions.rows[0].count).toBe(0);
      await expect(db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${secondEntityCandidateId}', 'reject', 'Nicht erlaubt'
        );
      `)).rejects.toThrow(/Only administrators/);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    for (const table of stagingTables) {
      expect(backupAreasSource).toContain(`"${table}"`);
      expect(backupExportSource).toContain(`"${table}"`);
    }
    expect(backupExportSource).toContain("...REQUIRED_KB_PHASE3_TABLES");
    expect(backupAreasSource).toContain('"kb_source_candidate_draft_promotions"');
    expect(backupExportSource).toContain('"kb_source_candidate_draft_promotions"');
    expect(backupExportSource).toContain("...REQUIRED_KB_PROMOTION_TABLES");
    expect(backupExportSource).toContain("...REQUIRED_KB_THERAPEUTIC_TABLES");
    expect(backupExportSource).toContain('"invalid_source_promotions"');
    expect(snapshotValidationSource).toContain('typeof value !== "number"');
    expect(snapshotValidationSource).toContain("Number.isFinite(value)");
    expect(sourcePromotionMigration).toContain("Existing source promotion failed its integrity check");
    expect(sourcePromotionMigration).toContain("Promoted source provenance fields are immutable");

    const snapshot = await db.query<{ value: { tables: Record<string, unknown[]>; manifest: Record<string, unknown> } }>(`
      SELECT public.kb_export_wiki_snapshot() AS value
    `);
    expect(Object.keys(snapshot.rows[0].value.tables)).toHaveLength(32);
    expect(Object.keys(snapshot.rows[0].value.manifest)).toHaveLength(32);
    for (const table of stagingTables) expect(snapshot.rows[0].value.tables).toHaveProperty(table);

    const originalSnapshot = snapshot.rows[0].value;
    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      await db.exec(`TRUNCATE TABLE ${wikiSnapshotTables.map((table) => `public.${table}`).join(", ")};`);
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [JSON.stringify(originalSnapshot.tables[table])],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      const restored = await db.query<{ value: { manifest: Record<string, unknown>; validation: Record<string, number> } }>(`
        SELECT public.kb_export_wiki_snapshot() AS value
      `);
      expect(restored.rows[0].value.validation).toEqual(expect.objectContaining({
        missing_articles: 0,
        invalid_current_snapshots: 0,
        orphaned_active_articles: 0,
        invalid_source_promotions: 0,
      }));
      expect(restored.rows[0].value.manifest).toEqual(originalSnapshot.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  });
});
