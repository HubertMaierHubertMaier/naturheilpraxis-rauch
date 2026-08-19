// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
const coreMigration = readMigration("20260728090000_create_kb_phase1_core.sql");
const stagingMigration = readMigration("20260812100000_create_kb_import_staging.sql");
const seedMigration = readMigration("20260812101000_import_existing_knowledge_candidates.sql");
const proposalGateMigration = readMigration("20260819160000_add_import_candidate_proposal_gate.sql");
const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "docs/existing-knowledge-import-batches-2026-08-12.json"), "utf8"));

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin', 'patient');
    CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE (user_id, role));
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    $$;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
    BEGIN NEW.updated_at := now(); RETURN NEW; END;
    $$;
    CREATE TABLE public.admin_knowledge_base (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      category text NOT NULL DEFAULT '',
      tags text[] NOT NULL DEFAULT '{}',
      content text NOT NULL DEFAULT ''
    );
    INSERT INTO public.user_roles (user_id, role) VALUES ('${adminId}', 'admin'), ('${patientId}', 'patient');
  `);
  await db.exec(coreMigration);
  await db.exec(stagingMigration);
  await db.exec(seedMigration);
  await db.exec(proposalGateMigration);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Existing knowledge staging import", () => {
  it("imports every retained source as an unpublished review candidate", async () => {
    const counts = await db.query<{
      batches: number;
      sources: number;
      entities: number;
      dosages: number;
      safety: number;
      candidates: number;
      released: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_import_batches) AS batches,
        (SELECT count(*)::int FROM public.kb_source_candidates) AS sources,
        (SELECT count(*)::int FROM public.kb_entity_candidates) AS entities,
        (SELECT count(*)::int FROM public.kb_dosage_candidates) AS dosages,
        (SELECT count(*)::int FROM public.kb_safety_candidates) AS safety,
        (
          (SELECT count(*) FROM public.kb_source_candidates)
          + (SELECT count(*) FROM public.kb_entity_candidates)
          + (SELECT count(*) FROM public.kb_dosage_candidates)
          + (SELECT count(*) FROM public.kb_safety_candidates)
        )::int AS candidates,
        (
          SELECT count(*)::int FROM (
            SELECT candidate_status FROM public.kb_source_candidates
            UNION ALL SELECT candidate_status FROM public.kb_entity_candidates
            UNION ALL SELECT candidate_status FROM public.kb_dosage_candidates
            UNION ALL SELECT candidate_status FROM public.kb_safety_candidates
          ) candidates WHERE candidate_status <> 'imported_unreviewed'
        ) AS released
    `);
    expect(counts.rows[0]).toEqual({ ...bundle.totals, released: 0 });

    const statuses = await db.query<{ batch_status: string; candidate_count: number }>(`
      SELECT batch_status, candidate_count FROM public.kb_import_batches ORDER BY source_label
    `);
    expect(statuses.rows).toHaveLength(4);
    expect(statuses.rows.every((row) => row.batch_status === "ready_for_review" && row.candidate_count > 0)).toBe(true);
  });

  it("is idempotent and rejects a changed immutable manifest", async () => {
    await db.exec(seedMigration);
    const count = await db.query<{ value: number }>("SELECT count(*)::int AS value FROM public.kb_source_candidates");
    expect(count.rows[0].value).toBe(bundle.totals.sources);

    const tampered = seedMigration.replace(bundle.batches[0].batch.source_hash, "f".repeat(64));
    await expect(db.exec(tampered)).rejects.toThrow(/immutable manifest/);
    await db.exec("ROLLBACK;").catch(() => undefined);
  });

  it("allows admin read access but denies patient and anonymous reads", async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    const admin = await db.query<{ value: number }>("SELECT count(*)::int AS value FROM public.kb_entity_candidates");
    expect(admin.rows[0].value).toBe(bundle.totals.entities);

    await db.exec(`SET request.jwt.claim.sub = '${patientId}';`);
    const patient = await db.query<{ value: number }>("SELECT count(*)::int AS value FROM public.kb_entity_candidates");
    expect(patient.rows[0].value).toBe(0);

    await db.exec("RESET ROLE; RESET request.jwt.claim.sub; SET ROLE anon;");
    await expect(db.query("SELECT count(*) FROM public.kb_entity_candidates")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE;");
  });

  it("keeps service writes intact while limiting the importer to core reads", async () => {
    const proposalId = "80000000-0000-4000-8000-000000000099";

    await db.exec(`
      SET ROLE service_role;
      INSERT INTO public.kb_change_proposals (
        id, proposal_kind, operation, proposal, origin_type, submitted_by
      ) VALUES (
        '${proposalId}', 'entity', 'create', '{}'::jsonb, 'human', NULL
      );
      RESET ROLE;
    `);

    await db.exec("SET ROLE kb_importer;");
    try {
      const coreRows = await db.query<{ value: number }>(
        "SELECT count(*)::int AS value FROM public.kb_entities",
      );
      expect(coreRows.rows[0].value).toBeGreaterThanOrEqual(0);
      await expect(db.exec(`
        INSERT INTO public.kb_entities (entity_type_code, canonical_key)
        VALUES ('product', 'product:importer-denied')
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("gates accepted candidates through an audited proposal without writing core knowledge", async () => {
    const batchId = "91000000-0000-4000-8000-000000000001";
    const sourceCandidateId = "91000000-0000-4000-8000-000000000002";

    await db.exec(`
      SET ROLE kb_importer;
      INSERT INTO public.kb_import_batches (
        id, source_kind, source_label, source_hash, created_by
      ) VALUES (
        '${batchId}', 'manual', 'Proposal gate regression', '${"a".repeat(64)}', NULL
      );
      UPDATE public.kb_import_batches
         SET batch_status = 'processing'
       WHERE id = '${batchId}';
      INSERT INTO public.kb_source_candidates (
        id, batch_id, candidate_key, title, source_locator, original_excerpt, proposed_data
      ) VALUES (
        '${sourceCandidateId}',
        '${batchId}',
        'proposal-gate-source',
        'Preserved source statement',
        'Regression source, page 1',
        'Complete original statement',
        '{"evidence_assessment":"separate","safety_assessment":"separate"}'::jsonb
      );
      UPDATE public.kb_import_batches
         SET batch_status = 'ready_for_review', candidate_count = 1, completed_at = now()
       WHERE id = '${batchId}';
      RESET ROLE;
    `);

    const coreSourcesBefore = await db.query<{ value: number }>("SELECT count(*)::int AS value FROM public.kb_sources");

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      await db.query(`
        SELECT public.kb_record_import_review_decision(
          'source', '${sourceCandidateId}', 'accept_as_draft', 'Source retained; evidence and safety remain separate.'
        )
      `);
      await db.query(`SELECT public.kb_complete_import_batch_review('${batchId}')`);

      const submitted = await db.query<{ proposal_id: string }>(`
        SELECT public.kb_submit_import_candidate_proposal('source', '${sourceCandidateId}')::text AS proposal_id
      `);
      const proposalId = submitted.rows[0].proposal_id;
      const repeated = await db.query<{ proposal_id: string }>(`
        SELECT public.kb_submit_import_candidate_proposal('source', '${sourceCandidateId}')::text AS proposal_id
      `);
      expect(repeated.rows[0].proposal_id).toBe(proposalId);

      const proposal = await db.query<{
        status: string;
        title: string;
        excerpt: string;
        visibility: string;
        automatically_applied: boolean;
        patient_use_approved: boolean;
        link_count: number;
      }>(`
        SELECT
          proposal.status,
          proposal.proposal -> 'candidate' ->> 'title' AS title,
          proposal.proposal -> 'candidate' ->> 'original_excerpt' AS excerpt,
          proposal.proposal -> 'review_boundary' ->> 'visibility' AS visibility,
          (proposal.proposal -> 'review_boundary' ->> 'automatically_applied_to_core')::boolean AS automatically_applied,
          (proposal.proposal -> 'review_boundary' ->> 'patient_use_approved')::boolean AS patient_use_approved,
          (SELECT count(*)::int FROM public.kb_import_candidate_proposals WHERE proposal_id = proposal.id) AS link_count
        FROM public.kb_change_proposals AS proposal
        WHERE proposal.id = '${proposalId}'
      `);
      expect(proposal.rows[0]).toEqual({
        status: "submitted",
        title: "Preserved source statement",
        excerpt: "Complete original statement",
        visibility: "admin_only",
        automatically_applied: false,
        patient_use_approved: false,
        link_count: 1,
      });

      await db.query(`SELECT public.kb_review_import_candidate_proposal('${proposalId}', 'start_review', '')`);
      await expect(db.query(`SELECT public.kb_review_import_candidate_proposal('${proposalId}', 'accept', '')`)).rejects.toThrow(/requires review notes/);
      await db.query(`
        SELECT public.kb_review_import_candidate_proposal(
          '${proposalId}', 'accept', 'Accepted for later mapping only; no core or patient release.'
        )
      `);

      const reviewed = await db.query<{ status: string; events: number; review_notes: string }>(`
        SELECT
          proposal.status,
          proposal.review_notes,
          (SELECT count(*)::int FROM public.kb_import_proposal_review_events WHERE proposal_id = proposal.id) AS events
        FROM public.kb_change_proposals AS proposal
        WHERE proposal.id = '${proposalId}'
      `);
      expect(reviewed.rows[0]).toEqual({
        status: "accepted",
        review_notes: "Accepted for later mapping only; no core or patient release.",
        events: 2,
      });

      const coreSourcesAfter = await db.query<{ value: number }>("SELECT count(*)::int AS value FROM public.kb_sources");
      expect(coreSourcesAfter.rows[0].value).toBe(coreSourcesBefore.rows[0].value);

      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [patientId]);
      await expect(db.query(`SELECT public.kb_submit_import_candidate_proposal('source', '${sourceCandidateId}')`)).rejects.toThrow(/Only administrators/);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }
  });
});
