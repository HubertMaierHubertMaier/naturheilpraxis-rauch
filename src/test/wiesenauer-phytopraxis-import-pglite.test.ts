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
const wiesenauerMigration = readMigration("20260820160000_import_wiesenauer_phytopraxis_internal.sql");
const inventoryText = readFileSync(
  resolve(process.cwd(), "docs/source-inventory/2026-08-20-wiesenauer-phytopraxis-internal.json"),
  "utf8",
);
const inventory = JSON.parse(inventoryText) as {
  sections: Array<{ categoryPaths: string[]; rows: Array<{ praeparate?: unknown[] }> }>;
};

const categoryCount = new Set(inventory.sections.map((section) => JSON.stringify(section.categoryPaths))).size;
const sourceCardCount = inventory.sections.reduce(
  (total, section) => total + section.rows.reduce(
    (rowTotal, row) => rowTotal + (Array.isArray(row.praeparate) ? row.praeparate.length : 1),
    0,
  ),
  0,
);
const expected = {
  sources: 2,
  entities: categoryCount + sourceCardCount,
  relations: sourceCardCount,
  dosages: sourceCardCount,
  safety: categoryCount,
  links: 2 + categoryCount + sourceCardCount * 3 + categoryCount,
};

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
  await db.exec(materializationMigration);
  try {
    await db.exec(wiesenauerMigration);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiesenauer PhytoPraxis internal import", () => {
  it("is generated from the current immutable inventory", () => {
    const inventoryHash = createHash("sha256").update(inventoryText.replace(/\r\n/g, "\n")).digest("hex");
    expect(wiesenauerMigration).toContain(inventoryHash);
    expect(wiesenauerMigration).toContain("'admin_only'");
    expect(wiesenauerMigration).toContain("'unreviewed'");
    expect(wiesenauerMigration).toContain("patient_facing_allowed', false");
  });

  it("retains every source card and materializes only protected internal drafts", async () => {
    const counts = await db.query<{
      sources: number;
      entities: number;
      relations: number;
      dosages: number;
      safety: number;
      links: number;
      patient_links: number;
      unsafe_links: number;
      non_unreviewed: number;
    }>(`
      WITH target AS (
        SELECT id FROM public.kb_import_batches
         WHERE source_label = 'Wiesenauer PhytoPraxis: interne Quellenkarten 2026-08-20'
      )
      SELECT
        (SELECT count(*)::int FROM public.kb_source_candidates WHERE batch_id = (SELECT id FROM target)) AS sources,
        (SELECT count(*)::int FROM public.kb_entity_candidates WHERE batch_id = (SELECT id FROM target)) AS entities,
        (SELECT count(*)::int FROM public.kb_relation_candidates WHERE batch_id = (SELECT id FROM target)) AS relations,
        (SELECT count(*)::int FROM public.kb_dosage_candidates WHERE batch_id = (SELECT id FROM target)) AS dosages,
        (SELECT count(*)::int FROM public.kb_safety_candidates WHERE batch_id = (SELECT id FROM target)) AS safety,
        (SELECT count(*)::int FROM public.kb_import_core_links WHERE batch_id = (SELECT id FROM target)) AS links,
        (SELECT count(*)::int FROM public.kb_import_core_links WHERE batch_id = (SELECT id FROM target) AND patient_facing_allowed) AS patient_links,
        (
          SELECT count(*)::int FROM public.kb_import_core_links
           WHERE batch_id = (SELECT id FROM target)
             AND (visibility <> 'admin_only' OR materialization_status <> 'internal_draft' OR evidence_status <> 'unreviewed' OR safety_status <> 'unreviewed')
        ) AS unsafe_links,
        (
          SELECT count(*)::int FROM (
            SELECT candidate_status FROM public.kb_source_candidates WHERE batch_id = (SELECT id FROM target)
            UNION ALL SELECT candidate_status FROM public.kb_entity_candidates WHERE batch_id = (SELECT id FROM target)
            UNION ALL SELECT candidate_status FROM public.kb_relation_candidates WHERE batch_id = (SELECT id FROM target)
            UNION ALL SELECT candidate_status FROM public.kb_dosage_candidates WHERE batch_id = (SELECT id FROM target)
            UNION ALL SELECT candidate_status FROM public.kb_safety_candidates WHERE batch_id = (SELECT id FROM target)
          ) candidates WHERE candidate_status <> 'imported_unreviewed'
        ) AS non_unreviewed
    `);

    expect(counts.rows[0]).toEqual({
      ...expected,
      patient_links: 0,
      unsafe_links: 0,
      non_unreviewed: 0,
    });
  });

  it("preserves critical source wording while keeping safety separate", async () => {
    const source = await db.query<{ original_excerpt: string }>(`
      SELECT original_excerpt FROM public.kb_source_candidates
       WHERE candidate_key = 'source:wiesenauer:phytopraxis-excerpts-2026-08-20'
    `);
    expect(source.rows[0].original_excerpt).toContain("Rauwolfia");
    expect(source.rows[0].original_excerpt).toContain("Digitalisglykosiden");
    expect(source.rows[0].original_excerpt).toContain("Keine Indikation für die Phytotherapie sind akute Angina-pectoris-Anfälle");
    expect(source.rows[0].original_excerpt).toContain("Kinder vom 2.–5. Lj.");

    const cards = await db.query<{ value: number }>(`
      SELECT count(*)::int AS value FROM public.kb_entity_candidates
       WHERE candidate_key LIKE 'entity:wiesenauer-source-card:%'
         AND (
           display_name ILIKE 'Homviotensin%'
           OR display_name ILIKE 'Thyreogutt mono Tropfen%'
           OR display_name ILIKE 'Kamillin Extern%'
         )
    `);
    expect(cards.rows[0].value).toBe(3);

    const safety = await db.query<{ action_text: string }>(`
      SELECT action_text FROM public.kb_safety_candidates
       WHERE candidate_key = 'safety:wiesenauer-category:khk'
    `);
    expect(safety.rows[0].action_text).toContain("keine Indikation");
    expect(safety.rows[0].action_text).toContain("Akute Brustschmerzen");
  });

  it("is idempotent and remains invisible to patients", async () => {
    await db.exec(wiesenauerMigration);
    const links = await db.query<{ value: number }>(`
      SELECT count(*)::int AS value FROM public.kb_import_core_links
       WHERE batch_id = (
         SELECT id FROM public.kb_import_batches
          WHERE source_label = 'Wiesenauer PhytoPraxis: interne Quellenkarten 2026-08-20'
       )
    `);
    expect(links.rows[0].value).toBe(expected.links);

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${patientId}';`);
    try {
      const patientCandidates = await db.query<{ value: number }>(`
        SELECT count(*)::int AS value FROM public.kb_entity_candidates
         WHERE candidate_key LIKE 'entity:wiesenauer%'
      `);
      const patientLinks = await db.query<{ value: number }>(`
        SELECT count(*)::int AS value FROM public.kb_import_core_links
         WHERE batch_id = (
           SELECT id FROM public.kb_import_batches
            WHERE source_label = 'Wiesenauer PhytoPraxis: interne Quellenkarten 2026-08-20'
         )
      `);
      expect(patientCandidates.rows[0].value).toBe(0);
      expect(patientLinks.rows[0].value).toBe(0);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }
  });
});
