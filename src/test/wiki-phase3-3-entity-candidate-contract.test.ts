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
] as const;

const migrations = migrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const contractMigration = migrations.at(-1)!;
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const backupCenterSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"),
  "utf8",
);

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
  "kb_source_candidate_draft_promotions", "faqs", "practice_pricing", "practice_info",
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
  "kb_source_candidate_draft_promotions",
  "admin_knowledge_base", "mannayan_products", "knowledge_product_links",
  "faqs", "practice_pricing", "practice_info",
] as const;

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const batchId = "81000000-0000-4000-8000-000000000101";
const sourceCandidateId = "82000000-0000-4000-8000-000000000101";
const entityCandidateId = "83000000-0000-4000-8000-000000000101";
const clarificationCandidateId = "83000000-0000-4000-8000-000000000102";
const assertionCandidateId = "84000000-0000-4000-8000-000000000101";

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
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 3.3 typed entity candidate contract", () => {
  it("creates ten additive staging tables without core writes or patient fields", async () => {
    const tables = await db.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (${contractTables.map((table) => `'${table}'`).join(", ")})
       ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual(contractTables);
    expect(contractMigration.match(/CREATE TABLE public\./g)).toHaveLength(10);
    expect(contractMigration).toMatch(/^BEGIN;/);
    expect(contractMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(contractMigration).not.toMatch(/INSERT INTO public\.kb_(?:entities|entity_revisions|entity_names|assertions)\b/);
    expect(contractMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|anamnesis_id|therapy_session_id)\b/i,
    );
    expect(contractMigration).not.toMatch(
      /\b(?:Epstein|Candida|Ferritin|Heel|Diamond|NutraMedix)\b/i,
    );
  });

  it("lets the importer build and idempotently seal one typed generic contract", async () => {
    await db.exec("SET ROLE kb_importer;");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, parser_name, parser_version, created_by
        ) VALUES (
          '${batchId}', 'parser', 'Synthetischer Vertrags-Test', repeat('a', 64),
          'contract-test-parser', '1.0.0', NULL
        );
        UPDATE public.kb_import_batches SET batch_status = 'processing' WHERE id = '${batchId}';

        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, proposed_source_type, title, source_locator, original_excerpt
        ) VALUES (
          '${sourceCandidateId}', '${batchId}', 'source:contract-test', 'reference_work',
          'Synthetische Vertragsquelle', 'S. 10', 'Ausschliesslich synthetischer Testtext'
        );

        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, aliases, description_markdown, source_candidate_id,
          source_locator, original_excerpt, confidence
        ) VALUES (
          '${entityCandidateId}', '${batchId}', 'entity:contract-test', 'plant',
          'plant:contract-test', 'Synthetische Testpflanze', ARRAY['Pruefalias'],
          'Nur eine synthetische Vertragsbeschreibung.', '${sourceCandidateId}',
          'S. 10', 'Synthetische Klassifikation', 100
        ), (
          '${clarificationCandidateId}', '${batchId}', 'entity:clarification-test', 'plant',
          'plant:clarification-test', 'Unvollstaendiger Testkandidat', ARRAY[]::text[],
          '', '${sourceCandidateId}', 'S. 11', 'Bewusst unvollstaendig', 25
        );

        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind,
          language_code, is_preferred, name_order
        ) VALUES (
          '${batchId}', '${entityCandidateId}', 'Synthetische Testpflanze',
          public.kb_normalize_entity_candidate_name_v1('Synthetische Testpflanze'),
          'preferred', 'de', true, 1
        ), (
          '${batchId}', '${entityCandidateId}', 'Pruefalias',
          public.kb_normalize_entity_candidate_name_v1('Pruefalias'),
          'spelling_variant', 'de', false, 2
        );

        INSERT INTO public.kb_entity_candidate_assertions (
          id, batch_id, entity_candidate_id, claim_key, assertion_kind, claim_text,
          evidence_basis, evidence_quality, assertion_order
        ) VALUES (
          '${assertionCandidateId}', '${batchId}', '${entityCandidateId}',
          'assertion:contract-test-classification', 'classification',
          'Synthetische Testklassifikation ohne medizinischen Inhalt.',
          'traditional_use', 'unrated', 1
        );

        INSERT INTO public.kb_entity_candidate_assertion_sources (
          batch_id, entity_candidate_id, assertion_candidate_id, source_candidate_id,
          source_role, locator, original_quote, is_primary, source_order
        ) VALUES (
          '${batchId}', '${entityCandidateId}', '${assertionCandidateId}',
          '${sourceCandidateId}', 'supports', 'S. 10', 'Synthetischer Beleg', true, 1
        );
      `);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind, name_order
        ) VALUES (
          '${batchId}', '${entityCandidateId}', ' Falsch normalisiert ', 'falsch',
          'spelling_variant', 3
        );
      `)).rejects.toThrow(/violates check constraint/);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_contracts (
          entity_candidate_id, batch_id, contract_hash
        ) VALUES ('${entityCandidateId}', '${batchId}', repeat('0', 64));
      `)).rejects.toThrow(/permission denied/);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_components (
          batch_id, entity_candidate_id, component_candidate_id, component_role,
          chemical_form_status, amount_status, amount_min, amount_max, amount_unit,
          component_order, basis_assertion_candidate_id
        ) VALUES (
          '${batchId}', '${entityCandidateId}', '${clarificationCandidateId}', 'active',
          'not_applicable', 'specified', 'NaN'::numeric, 'NaN'::numeric, 'test-unit',
          1, '${assertionCandidateId}'
        );
      `)).rejects.toThrow(/violates check constraint/);

      const firstSeal = await db.query<{ sealed_contract_hash: string; was_created: boolean }>(`
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${entityCandidateId}', 'Synthetische Kurzfassung', '{"schema":"typed-v1"}'::jsonb
        )
      `);
      expect(firstSeal.rows[0].was_created).toBe(true);
      expect(firstSeal.rows[0].sealed_contract_hash).toMatch(/^[0-9a-f]{64}$/);

      const repeatedSeal = await db.query<{ sealed_contract_hash: string; was_created: boolean }>(`
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${entityCandidateId}', 'Synthetische Kurzfassung', '{"schema":"typed-v1"}'::jsonb
        )
      `);
      expect(repeatedSeal.rows[0]).toEqual({
        sealed_contract_hash: firstSeal.rows[0].sealed_contract_hash,
        was_created: false,
      });
      await expect(db.exec(`
        SELECT * FROM public.kb_seal_entity_candidate_contract(
          '${entityCandidateId}', 'Abweichende Kurzfassung', '{"schema":"typed-v1"}'::jsonb
        );
      `)).rejects.toThrow(/integrity check/);

      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind, name_order
        ) VALUES (
          '${batchId}', '${entityCandidateId}', 'Zu spaet', 'zu spaet',
          'spelling_variant', 3
        );
      `)).rejects.toThrow(/open import batch|cannot receive additional rows/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await expect(db.exec(`
      UPDATE public.kb_entity_candidate_names
         SET name = 'Manipuliert'
       WHERE entity_candidate_id = '${entityCandidateId}' AND name_order = 2;
    `)).rejects.toThrow(/append-only/);
    await expect(db.exec(`
      DELETE FROM public.kb_entity_candidate_contracts
       WHERE entity_candidate_id = '${entityCandidateId}';
    `)).rejects.toThrow(/append-only/);

    const stored = await db.query<{
      contract_hash: string;
      calculated_hash: string;
      name_count: number;
      assertion_count: number;
      source_count: number;
    }>(`
      SELECT
        contract.contract_hash,
        public.kb_entity_candidate_contract_hash(
          contract.entity_candidate_id,
          contract.summary,
          contract.contract_metadata
        ) AS calculated_hash,
        (SELECT count(*)::int FROM public.kb_entity_candidate_names name
          WHERE name.entity_candidate_id = contract.entity_candidate_id) AS name_count,
        (SELECT count(*)::int FROM public.kb_entity_candidate_assertions assertion
          WHERE assertion.entity_candidate_id = contract.entity_candidate_id) AS assertion_count,
        (SELECT count(*)::int FROM public.kb_entity_candidate_assertion_sources source
          WHERE source.entity_candidate_id = contract.entity_candidate_id) AS source_count
      FROM public.kb_entity_candidate_contracts contract
      WHERE contract.entity_candidate_id = '${entityCandidateId}'
    `);
    expect(stored.rows[0]).toEqual(expect.objectContaining({
      name_count: 2,
      assertion_count: 1,
      source_count: 1,
    }));
    expect(stored.rows[0].contract_hash).toBe(stored.rows[0].calculated_hash);
  });

  it("blocks incomplete acceptance and preserves needs_clarification as an audited nonterminal state", async () => {
    await db.exec(`SET ROLE kb_importer; UPDATE public.kb_import_batches SET batch_status = 'ready_for_review' WHERE id = '${batchId}'; RESET ROLE;`);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'source', '${sourceCandidateId}', 'accept_as_draft', 'Synthetische Quelle geprueft'
        );
      `);

      await expect(db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${clarificationCandidateId}', 'accept_as_draft', 'Unvollstaendig'
        );
      `)).rejects.toThrow(
        /requires needs_clarification.*CLASSIFICATION_ASSERTION_MISSING.*CONTRACT_MISSING/,
      );
      const rolledBackDecision = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_review_decisions
         WHERE candidate_kind = 'entity' AND candidate_id = '${clarificationCandidateId}'
      `);
      expect(rolledBackDecision.rows[0].count).toBe(0);

      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${clarificationCandidateId}', 'needs_clarification',
          'Typisierte Namen und Aussage fehlen; Ersatzkandidat erforderlich'
        );
      `);
      await expect(db.exec(`SELECT public.kb_complete_import_batch_review('${batchId}');`))
        .rejects.toThrow(/terminal review decision/);

      await db.exec(`
        SELECT public.kb_record_import_review_decision(
          'entity', '${entityCandidateId}', 'accept_as_draft', 'Typisierter Vertrag geprueft'
        );
        SELECT public.kb_record_import_review_decision(
          'entity', '${clarificationCandidateId}', 'reject', 'Durch Ersatzkandidat zu ersetzen'
        );
        SELECT public.kb_complete_import_batch_review('${batchId}');
      `);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    const clarificationAudit = await db.query<{
      decision: string;
      status_before: string;
      status_after: string;
    }>(`
      SELECT decision, status_before, status_after
        FROM public.kb_review_decisions
       WHERE candidate_kind = 'entity' AND candidate_id = '${clarificationCandidateId}'
       ORDER BY decided_at, id
    `);
    expect(clarificationAudit.rows).toEqual([
      {
        decision: "needs_clarification",
        status_before: "imported_unreviewed",
        status_after: "needs_clarification",
      },
      {
        decision: "reject",
        status_before: "needs_clarification",
        status_after: "rejected",
      },
    ]);
    const completed = await db.query<{
      batch_status: string;
      candidate_count: number;
      error_count: number;
    }>(`
      SELECT batch_status, candidate_count, error_count
        FROM public.kb_import_batches WHERE id = '${batchId}'
    `);
    expect(completed.rows[0]).toEqual({
      batch_status: "reviewed",
      candidate_count: 3,
      error_count: 0,
    });
  });

  it("reports deterministic promotion blockers until every source is promoted", async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      const beforePromotion = await db.query<{
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
        warning_reason_codes: string[];
      }>(`
        SELECT ready_for_promotion, blocking_reason_codes, warning_reason_codes
          FROM public.kb_entity_candidate_promotion_readiness('${entityCandidateId}')
      `);
      expect(beforePromotion.rows[0]).toEqual({
        ready_for_promotion: false,
        blocking_reason_codes: [
          "ASSERTION_SOURCE_PROMOTION_MISSING",
          "SOURCE_PROMOTION_MISSING",
        ],
        warning_reason_codes: [],
      });

      await db.exec(`
        SELECT * FROM public.kb_promote_source_candidate_to_draft(
          '${sourceCandidateId}', 'source:contract-test-promoted', 'book'
        );
      `);
      const afterPromotion = await db.query<{
        contract_hash: string;
        ready_for_promotion: boolean;
        blocking_reason_codes: string[];
        warning_reason_codes: string[];
      }>(`
        SELECT contract_hash, ready_for_promotion, blocking_reason_codes, warning_reason_codes
          FROM public.kb_entity_candidate_promotion_readiness('${entityCandidateId}')
      `);
      expect(afterPromotion.rows[0]).toEqual({
        contract_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        ready_for_promotion: true,
        blocking_reason_codes: [],
        warning_reason_codes: [],
      });
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }
  });

  it("keeps patients out and limits service and importer roles to their intended access", async () => {
    const privileges = await db.query<{
      admin_can_read: boolean;
      admin_can_write: boolean;
      service_can_read: boolean;
      service_can_write: boolean;
      importer_can_insert_child: boolean;
      importer_can_insert_seal: boolean;
      authenticated_can_check_readiness: boolean;
      service_can_check_readiness: boolean;
      importer_can_seal: boolean;
      authenticated_can_seal: boolean;
      service_can_snapshot: boolean;
      authenticated_can_snapshot: boolean;
    }>(`
      SELECT
        has_table_privilege('authenticated', 'public.kb_entity_candidate_contracts', 'SELECT') AS admin_can_read,
        has_table_privilege('authenticated', 'public.kb_entity_candidate_contracts', 'INSERT') AS admin_can_write,
        has_table_privilege('service_role', 'public.kb_entity_candidate_contracts', 'SELECT') AS service_can_read,
        has_table_privilege('service_role', 'public.kb_entity_candidate_contracts', 'UPDATE') AS service_can_write,
        has_table_privilege('kb_importer', 'public.kb_entity_candidate_names', 'INSERT') AS importer_can_insert_child,
        has_table_privilege('kb_importer', 'public.kb_entity_candidate_contracts', 'INSERT') AS importer_can_insert_seal,
        has_function_privilege('authenticated', 'public.kb_entity_candidate_promotion_readiness(uuid)', 'EXECUTE') AS authenticated_can_check_readiness,
        has_function_privilege('service_role', 'public.kb_entity_candidate_promotion_readiness(uuid)', 'EXECUTE') AS service_can_check_readiness,
        has_function_privilege('kb_importer', 'public.kb_seal_entity_candidate_contract(uuid,text,jsonb)', 'EXECUTE') AS importer_can_seal,
        has_function_privilege('authenticated', 'public.kb_seal_entity_candidate_contract(uuid,text,jsonb)', 'EXECUTE') AS authenticated_can_seal,
        has_function_privilege('service_role', 'public.kb_export_wiki_snapshot()', 'EXECUTE') AS service_can_snapshot,
        has_function_privilege('authenticated', 'public.kb_export_wiki_snapshot()', 'EXECUTE') AS authenticated_can_snapshot
    `);
    expect(privileges.rows[0]).toEqual({
      admin_can_read: true,
      admin_can_write: false,
      service_can_read: true,
      service_can_write: false,
      importer_can_insert_child: true,
      importer_can_insert_seal: false,
      authenticated_can_check_readiness: true,
      service_can_check_readiness: false,
      importer_can_seal: true,
      authenticated_can_seal: false,
      service_can_snapshot: true,
      authenticated_can_snapshot: false,
    });

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      const visible = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_contracts
      `);
      expect(visible.rows[0].count).toBe(1);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_contracts (
          entity_candidate_id, batch_id, contract_hash
        ) VALUES ('${clarificationCandidateId}', '${batchId}', repeat('0', 64));
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${patientId}';`);
    try {
      const hidden = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_contracts
      `);
      expect(hidden.rows[0].count).toBe(0);
      await expect(db.exec(`
        SELECT * FROM public.kb_entity_candidate_promotion_readiness('${entityCandidateId}');
      `)).rejects.toThrow(/Only administrators/);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind, name_order
        ) VALUES ('${batchId}', '${entityCandidateId}', 'Patient', 'patient', 'spelling_variant', 9);
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    await db.exec("SET ROLE service_role;");
    try {
      const readable = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_contracts
      `);
      expect(readable.rows[0].count).toBe(1);
      await expect(db.exec(`
        SELECT * FROM public.kb_entity_candidate_promotion_readiness('${entityCandidateId}');
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec("TRUNCATE public.kb_entity_candidate_contracts;"))
        .rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await db.exec("SET ROLE kb_importer;");
    try {
      const readable = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM public.kb_entity_candidate_contracts
      `);
      expect(readable.rows[0].count).toBe(1);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_names (
          batch_id, entity_candidate_id, name, normalized_name, name_kind, name_order
        ) VALUES ('${batchId}', '${entityCandidateId}', 'Spaet', 'spaet', 'spelling_variant', 9);
      `)).rejects.toThrow(/open import batch|cannot receive additional rows/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("detects trigger-disabled contract tampering in the shared snapshot", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_entity_candidate_names DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_entity_candidate_names
           SET name = 'Manipulierter Alias', normalized_name = 'manipulierter alias'
         WHERE entity_candidate_id = '${entityCandidateId}' AND name_order = 2;
      `);
      const invalid = await db.query<{
        direct_count: number;
        snapshot_count: number;
      }>(`
        SELECT
          public.kb_invalid_entity_candidate_contract_count()::int AS direct_count,
          (public.kb_export_wiki_snapshot() -> 'validation' ->> 'invalid_entity_candidate_contracts')::int
            AS snapshot_count
      `);
      expect(invalid.rows[0]).toEqual({ direct_count: 1, snapshot_count: 1 });
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_candidate_contracts DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        DELETE FROM public.kb_entity_candidate_contracts
         WHERE entity_candidate_id = '${entityCandidateId}';
      `);
      const missing = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_entity_candidate_contract_count()::int AS count
      `);
      expect(missing.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_candidates DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_entity_candidates
           SET candidate_status = 'rejected'
         WHERE id = '${entityCandidateId}';
      `);
      const auditMismatch = await db.query<{ count: number }>(`
        SELECT public.kb_invalid_entity_candidate_contract_count()::int AS count
      `);
      expect(auditMismatch.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_source_candidates DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_source_candidates
           SET candidate_status = 'rejected'
         WHERE id = '${sourceCandidateId}';
      `);
      const semantic = await db.query<{
        errors: string[];
        stored_hash: string;
        calculated_hash: string;
        count: number;
      }>(`
        SELECT
          public.kb_entity_candidate_contract_error_codes('${entityCandidateId}') AS errors,
          contract.contract_hash AS stored_hash,
          public.kb_entity_candidate_contract_hash(
            contract.entity_candidate_id,
            contract.summary,
            contract.contract_metadata
          ) AS calculated_hash,
          public.kb_invalid_entity_candidate_contract_count()::int AS count
        FROM public.kb_entity_candidate_contracts contract
        WHERE contract.entity_candidate_id = '${entityCandidateId}'
      `);
      expect(semantic.rows[0].errors).toContain("SOURCE_CANDIDATE_NOT_ACCEPTED");
      expect(semantic.rows[0].stored_hash).toBe(semantic.rows[0].calculated_hash);
      expect(semantic.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_candidates DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_entity_candidates
           SET ambiguity_notes = 'Nachtraeglich ungeklaert'
         WHERE id = '${entityCandidateId}';
      `);
      const semantic = await db.query<{
        errors: string[];
        count: number;
      }>(`
        SELECT
          public.kb_entity_candidate_contract_error_codes('${entityCandidateId}') AS errors,
          public.kb_invalid_entity_candidate_contract_count()::int AS count
      `);
      expect(semantic.rows[0].errors).toContain("AMBIGUITY_UNRESOLVED");
      expect(semantic.rows[0].count).toBe(1);
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_entity_candidates DISABLE TRIGGER USER;");
    try {
      await expect(db.exec(`
        UPDATE public.kb_entity_candidates
           SET proposed_canonical_key = 'plant:contract-test',
               candidate_status = 'accepted_as_draft'
         WHERE id = '${clarificationCandidateId}';
      `)).rejects.toThrow(/accepted_canonical_key_idx/);
    } finally {
      await db.exec("ROLLBACK;");
    }
  });

  it("exports and restores all 48 wiki tables with exact manifests", async () => {
    await db.exec("SET ROLE kb_importer;");
    try {
      await db.exec(`
        INSERT INTO public.kb_import_batches (
          id, source_kind, source_label, source_hash, created_by
        ) VALUES (
          '81000000-0000-4000-8000-000000000201', 'manual',
          'Synthetische Detail-Restore-Fixture', repeat('d', 64), NULL
        );
        UPDATE public.kb_import_batches
           SET batch_status = 'processing'
         WHERE id = '81000000-0000-4000-8000-000000000201';
        INSERT INTO public.kb_source_candidates (
          id, batch_id, candidate_key, title, source_locator, original_excerpt
        ) VALUES (
          '82000000-0000-4000-8000-000000000201',
          '81000000-0000-4000-8000-000000000201',
          'source:detail-restore-fixture', 'Synthetische Detailquelle',
          'S. 20', 'Nur Restore-Testdaten'
        );
        INSERT INTO public.kb_entity_candidates (
          id, batch_id, candidate_key, proposed_entity_type_code, proposed_canonical_key,
          display_name, source_candidate_id, source_locator, original_excerpt
        ) VALUES
          ('83000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000201',
           'entity:detail-homeopathic', 'preparation', 'preparation:detail-homeopathic',
           'Synthetische Einzelzubereitung', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000202', '81000000-0000-4000-8000-000000000201',
           'entity:detail-botanical', 'preparation', 'preparation:detail-botanical',
           'Synthetische Pflanzenzubereitung', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000201',
           'entity:detail-nutrient', 'preparation', 'preparation:detail-nutrient',
           'Synthetische Naehrstoffkombination', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000204', '81000000-0000-4000-8000-000000000201',
           'entity:detail-component', 'plant', 'plant:detail-component',
           'Synthetische Komponente', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000205', '81000000-0000-4000-8000-000000000201',
           'entity:detail-product', 'product', 'product:detail-product',
           'Synthetisches Produkt', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000206', '81000000-0000-4000-8000-000000000201',
           'entity:detail-variant', 'product_variant', 'product-variant:detail-variant',
           'Synthetische Produktvariante', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test'),
          ('83000000-0000-4000-8000-000000000207', '81000000-0000-4000-8000-000000000201',
           'entity:detail-component-two', 'nutrient', 'nutrient:detail-component-two',
           'Synthetische zweite Komponente', '82000000-0000-4000-8000-000000000201', 'S. 20', 'Test');
        INSERT INTO public.kb_entity_candidate_assertions (
          id, batch_id, entity_candidate_id, claim_key, assertion_kind,
          claim_text, assertion_order
        ) VALUES
          ('84000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000201',
           '83000000-0000-4000-8000-000000000201', 'assertion:detail-homeopathic',
           'classification', 'Synthetische Detailklassifikation 1', 1),
          ('84000000-0000-4000-8000-000000000202', '81000000-0000-4000-8000-000000000201',
           '83000000-0000-4000-8000-000000000202', 'assertion:detail-botanical',
           'classification', 'Synthetische Detailklassifikation 2', 1),
          ('84000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000201',
           '83000000-0000-4000-8000-000000000203', 'assertion:detail-nutrient',
           'classification', 'Synthetische Detailklassifikation 3', 1),
          ('84000000-0000-4000-8000-000000000206', '81000000-0000-4000-8000-000000000201',
           '83000000-0000-4000-8000-000000000206', 'assertion:detail-variant',
           'classification', 'Synthetische Detailklassifikation 4', 1);
        INSERT INTO public.kb_entity_candidate_preparation_details (
          entity_candidate_id, batch_id, preparation_kind, dosage_form,
          administration_routes, basis_assertion_candidate_id
        ) VALUES
          ('83000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000201',
           'homeopathic_single', 'globules', ARRAY['oral'], '84000000-0000-4000-8000-000000000201'),
          ('83000000-0000-4000-8000-000000000202', '81000000-0000-4000-8000-000000000201',
           'mother_tincture', 'drops', ARRAY['oral'], '84000000-0000-4000-8000-000000000202'),
          ('83000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000201',
           'nutrient_combination', 'capsules', ARRAY['oral'], '84000000-0000-4000-8000-000000000203');
        INSERT INTO public.kb_entity_candidate_homeopathic_details (
          entity_candidate_id, batch_id, remedy_kind, potency_scale, potency_value,
          potentization_method, basis_assertion_candidate_id
        ) VALUES (
          '83000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000201',
          'single', 'D', 6, 'hahnemannian', '84000000-0000-4000-8000-000000000201'
        );
        INSERT INTO public.kb_entity_candidate_botanical_details (
          entity_candidate_id, batch_id, plant_parts, source_material_state,
          extraction_type, basis_assertion_candidate_id
        ) VALUES (
          '83000000-0000-4000-8000-000000000202', '81000000-0000-4000-8000-000000000201',
          ARRAY['leaf'], 'fresh', 'maceration', '84000000-0000-4000-8000-000000000202'
        );
        INSERT INTO public.kb_entity_candidate_nutrient_details (
          entity_candidate_id, batch_id, formulation_kind, delivery_system,
          basis_assertion_candidate_id
        ) VALUES (
          '83000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000201',
          'combination', 'standard', '84000000-0000-4000-8000-000000000203'
        );
        INSERT INTO public.kb_entity_candidate_components (
          id, batch_id, entity_candidate_id, component_candidate_id, component_role,
          chemical_form_status, amount_status, amount_min, amount_max, amount_unit,
          component_order, basis_assertion_candidate_id
        ) VALUES (
          '85000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000201',
          '83000000-0000-4000-8000-000000000203', '83000000-0000-4000-8000-000000000204',
          'nutrient', 'not_applicable', 'specified', 1, 1, 'test-unit', 1,
          '84000000-0000-4000-8000-000000000203'
        ), (
          '85000000-0000-4000-8000-000000000204', '81000000-0000-4000-8000-000000000201',
          '83000000-0000-4000-8000-000000000203', '83000000-0000-4000-8000-000000000207',
          'active', 'not_applicable', 'specified', 2, 2, 'test-unit', 2,
          '84000000-0000-4000-8000-000000000203'
        );
        INSERT INTO public.kb_entity_candidate_product_variant_details (
          entity_candidate_id, batch_id, product_candidate_id, preparation_candidate_id,
          package_quantity, package_unit, basis_assertion_candidate_id
        ) VALUES (
          '83000000-0000-4000-8000-000000000206', '81000000-0000-4000-8000-000000000201',
          '83000000-0000-4000-8000-000000000205', '83000000-0000-4000-8000-000000000201',
          1, 'piece', '84000000-0000-4000-8000-000000000206'
        );
      `);
      await expect(db.exec(`
        INSERT INTO public.kb_entity_candidate_components (
          batch_id, entity_candidate_id, component_candidate_id, component_role,
          chemical_form_status, amount_status, amount_min, amount_max, amount_unit,
          component_order, basis_assertion_candidate_id
        ) VALUES (
          '81000000-0000-4000-8000-000000000201', '83000000-0000-4000-8000-000000000203',
          '83000000-0000-4000-8000-000000000204', 'nutrient', 'not_applicable',
          'specified', 3, 3, 'test-unit', 3, '84000000-0000-4000-8000-000000000203'
        );
      `)).rejects.toThrow(/unique constraint/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    const typedDetailErrors = await db.query<{
      nutrient_errors: string[];
      product_variant_errors: string[];
    }>(`
      SELECT
        public.kb_entity_candidate_contract_error_codes(
          '83000000-0000-4000-8000-000000000203'
        ) AS nutrient_errors,
        public.kb_entity_candidate_contract_error_codes(
          '83000000-0000-4000-8000-000000000206'
        ) AS product_variant_errors
    `);
    expect(typedDetailErrors.rows[0].nutrient_errors).not.toContain("COMBINATION_COMPONENTS_INCOMPLETE");
    expect(typedDetailErrors.rows[0].nutrient_errors).not.toContain("COMPONENT_AMOUNT_UNRESOLVED");
    expect(typedDetailErrors.rows[0].nutrient_errors).not.toContain("COMPONENT_CHEMICAL_FORM_UNRESOLVED");
    expect(typedDetailErrors.rows[0].product_variant_errors).toContain(
      "CANDIDATE_DEPENDENCY_CONTRACT_INVALID",
    );

    expect(new Set(wikiSnapshotTables).size).toBe(wikiSnapshotTables.length);
    expect(new Set(wikiRestoreOrder).size).toBe(wikiRestoreOrder.length);
    expect(new Set(wikiRestoreOrder)).toEqual(new Set(wikiSnapshotTables));

    const snapshot = await db.query<{
      value: {
        tables: Record<string, unknown[]>;
        manifest: Record<string, { rows: number; sha256: string }>;
        validation: Record<string, number>;
      };
    }>(`SELECT public.kb_export_wiki_snapshot() AS value`);
    const expectedTables = [...wikiSnapshotTables].sort();
    expect(Object.keys(snapshot.rows[0].value.tables).sort()).toEqual(expectedTables);
    expect(Object.keys(snapshot.rows[0].value.manifest).sort()).toEqual(expectedTables);
    expect(expectedTables).toHaveLength(48);
    expect(snapshot.rows[0].value.validation.invalid_entity_candidate_contracts).toBe(0);
    for (const table of contractTables) {
      expect(snapshot.rows[0].value.tables).toHaveProperty(table);
      expect(snapshot.rows[0].value.manifest[table].sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(snapshot.rows[0].value.manifest[table].rows).toBeGreaterThan(0);
      expect(backupAreasSource).toContain(`"${table}"`);
      expect(backupExportSource).toContain(`"${table}"`);
    }
    expect(snapshot.rows[0].value.manifest.kb_entity_candidate_contracts.rows).toBe(1);
    expect(snapshot.rows[0].value.manifest.kb_entity_candidate_names.rows).toBe(2);
    expect(snapshot.rows[0].value.manifest.kb_entity_candidate_assertions.rows).toBe(5);
    expect(snapshot.rows[0].value.manifest.kb_entity_candidate_assertion_sources.rows).toBe(1);
    expect(backupExportSource).toContain("...REQUIRED_KB_ENTITY_CANDIDATE_CONTRACT_TABLES");
    expect(backupExportSource).toContain('"invalid_entity_candidate_contracts"');
    expect(backupExportSource).toContain("validateWikiSnapshotShape");
    expect(backupCenterSource).toContain("Alle ${wikiTableCount} Wiki-Tabellen");
    expect(backupCenterSource).toContain("invalid_entity_candidate_contracts");

    const originalSnapshot = snapshot.rows[0].value;
    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }
      await db.exec(`TRUNCATE TABLE ${wikiSnapshotTables.map((table) => `public.${table}`).join(", ")};`);
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [JSON.stringify(originalSnapshot.tables[table])],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }

      const restored = await db.query<{
        value: { manifest: Record<string, unknown>; validation: Record<string, number> };
      }>(`SELECT public.kb_export_wiki_snapshot() AS value`);
      expect(restored.rows[0].value.validation).toEqual(expect.objectContaining({
        missing_articles: 0,
        invalid_current_snapshots: 0,
        orphaned_active_articles: 0,
        invalid_source_promotions: 0,
        invalid_therapeutic_catalog_revisions: 0,
        invalid_entity_candidate_contracts: 0,
      }));
      expect(restored.rows[0].value.manifest).toEqual(originalSnapshot.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  }, 20_000);
});
