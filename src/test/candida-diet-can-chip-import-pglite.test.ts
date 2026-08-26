// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
const coreMigration = readMigration("20260728090000_create_kb_phase1_core.sql");
const stagingMigration = readMigration("20260812100000_create_kb_import_staging.sql");
const materializationMigration = readMigration("20260820120000_materialize_import_candidates_as_internal_drafts.sql");
const candidaMigration = readMigration("20260826103000_import_candida_diet_can_chip_internal.sql");
const inventoryText = readFileSync(resolve(process.cwd(), "docs/source-inventory/2026-08-26-candida-diet-can-chip-internal.json"), "utf8");

const expected = { sources: 2, entities: 3, relations: 2, dosages: 0, safety: 3, links: 10 };
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
    INSERT INTO public.user_roles (user_id, role) VALUES ('${patientId}', 'patient');
  `);
  await db.exec(coreMigration);
  await db.exec(stagingMigration);
  await db.exec(materializationMigration);
  await db.exec(candidaMigration);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Candida diet and CAN chip internal import", () => {
  it("matches the immutable source inventory and retains Peter's statements", async () => {
    const inventoryHash = createHash("sha256").update(inventoryText.replace(/\r\n/g, "\n")).digest("hex");
    expect(candidaMigration).toContain(inventoryHash);
    const source = await db.query<{ original_excerpt: string }>(`
      SELECT original_excerpt FROM public.kb_source_candidates
       WHERE candidate_key = 'source:peter:candida-diet-can-chip-2026-08-26'
    `);
    expect(source.rows[0].original_excerpt).toContain("Verzichten Sie für die Dauer der Diät komplett auf jede Form von Zucker");
    expect(source.rows[0].original_excerpt).toContain("Wenn der Patient einen Zapper hat, CAN (Candida-Chip) empfehlen");
    expect(source.rows[0].original_excerpt).toContain("diamondshieldzapper.com/diamond-shield-zapper-chipcards");
  });

  it("materializes ten protected, unreviewed internal records", async () => {
    const counts = await db.query<Record<string, number>>(`
      WITH target AS (
        SELECT id FROM public.kb_import_batches
         WHERE source_label = 'Candida-Diät und CAN-Chip – interne Praxisquelle 2026-08-26'
      )
      SELECT
        (SELECT count(*)::int FROM public.kb_source_candidates WHERE batch_id = (SELECT id FROM target)) AS sources,
        (SELECT count(*)::int FROM public.kb_entity_candidates WHERE batch_id = (SELECT id FROM target)) AS entities,
        (SELECT count(*)::int FROM public.kb_relation_candidates WHERE batch_id = (SELECT id FROM target)) AS relations,
        (SELECT count(*)::int FROM public.kb_dosage_candidates WHERE batch_id = (SELECT id FROM target)) AS dosages,
        (SELECT count(*)::int FROM public.kb_safety_candidates WHERE batch_id = (SELECT id FROM target)) AS safety,
        (SELECT count(*)::int FROM public.kb_import_core_links WHERE batch_id = (SELECT id FROM target)) AS links,
        (SELECT count(*)::int FROM public.kb_import_core_links WHERE batch_id = (SELECT id FROM target) AND patient_facing_allowed) AS patient_links,
        (SELECT count(*)::int FROM public.kb_import_core_links WHERE batch_id = (SELECT id FROM target) AND (visibility <> 'admin_only' OR materialization_status <> 'internal_draft' OR evidence_status <> 'unreviewed' OR safety_status <> 'unreviewed')) AS unsafe_links
    `);
    expect(counts.rows[0]).toEqual({ ...expected, patient_links: 0, unsafe_links: 0 });
  });

  it("keeps source claims and safety assessments separate", async () => {
    const safety = await db.query<{ candidate_key: string; source_key: string }>(`
      SELECT safety.candidate_key, source.candidate_key AS source_key
        FROM public.kb_safety_candidates safety
        JOIN public.kb_source_candidates source ON source.id = safety.source_candidate_id
       ORDER BY safety.candidate_key
    `);
    expect(safety.rows).toHaveLength(3);
    expect(safety.rows.every((entry) => entry.source_key.startsWith("source:internal-safety:"))).toBe(true);
  });

  it("is idempotent and invisible to patients", async () => {
    await db.exec(candidaMigration);
    const links = await db.query<{ value: number }>(`
      SELECT count(*)::int AS value FROM public.kb_import_core_links
       WHERE batch_id = md5('candida-diet-can-chip-2026-08-26:batch')::uuid
    `);
    expect(links.rows[0].value).toBe(expected.links);

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${patientId}';`);
    try {
      const patientCandidates = await db.query<{ value: number }>(`
        SELECT count(*)::int AS value FROM public.kb_entity_candidates
         WHERE batch_id = md5('candida-diet-can-chip-2026-08-26:batch')::uuid
      `);
      expect(patientCandidates.rows[0].value).toBe(0);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }
  });
});
