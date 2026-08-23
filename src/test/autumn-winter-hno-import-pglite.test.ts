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
const autumnWinterMigration = readMigration("20260820150000_import_autumn_winter_hno_candidates.sql");
const inventoryText = readFileSync(
  resolve(process.cwd(), "docs/source-inventory/2026-08-20-herbst-winter-hno-tcm-internal.json"),
  "utf8",
);
const inventory = JSON.parse(inventoryText) as {
  sources: Array<{ id: string; statements: Array<{ text: string }> }>;
  visibility: string;
  reviewStatus: string;
  patientFacingAllowed: boolean;
};

const expected = {
  sources: 9,
  entities: 55,
  relations: 53,
  dosages: 17,
  safety: 20,
  links: 154,
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
  await db.exec(autumnWinterMigration);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("autumn/winter HNO internal import", () => {
  it("matches the immutable source inventory and retains the Strunz source", () => {
    const inventoryHash = createHash("sha256").update(inventoryText.replace(/\r\n/g, "\n")).digest("hex");
    expect(autumnWinterMigration).toContain(inventoryHash);
    expect(inventory).toMatchObject({
      visibility: "admin_only",
      reviewStatus: "unreviewed",
      patientFacingAllowed: false,
    });

    const strunz = inventory.sources.find((source) => source.id === "strunz-neue-wege-pages-161-162");
    expect(strunz?.statements.map((statement) => statement.text)).toEqual(expect.arrayContaining([
      "1 bis 3 g.",
      "30 bis 60 mg taeglich.",
      "400 IE.",
      "Weniger als 50 g pro Tag.",
      "1 bis 2 g pro kg Koerpergewicht.",
      "2 bis 6 g pro Tag.",
    ]));
  });

  it("materializes every candidate as a protected internal draft", async () => {
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
         WHERE source_label = 'Herbst und Winter: HNO-, Virus-, TCM- und Praxisquellen 2026-08-20'
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

  it("keeps Strunz source doses and safety assessments separate", async () => {
    const source = await db.query<{ original_excerpt: string }>(`
      SELECT original_excerpt FROM public.kb_source_candidates
       WHERE candidate_key = 'source:strunz:neue-wege-pages-161-162'
    `);
    expect(source.rows[0].original_excerpt).toContain("Vitamin C 1 bis 3 g");
    expect(source.rows[0].original_excerpt).toContain("Zink 30 bis 60 mg täglich");
    expect(source.rows[0].original_excerpt).toContain("Omega-3-Fettsäuren 2 bis 6 g pro Tag");

    const safety = await db.query<{ value: number }>(`
      SELECT count(*)::int AS value FROM public.kb_safety_candidates
       WHERE candidate_key LIKE 'safety:strunz-%'
         AND source_candidate_id = md5('herbst-winter-hno-2026:source:strunz-safety')::uuid
    `);
    expect(safety.rows[0].value).toBe(7);
  });

  it("is idempotent and remains invisible to patients", async () => {
    await db.exec(autumnWinterMigration);
    const links = await db.query<{ value: number }>(`
      SELECT count(*)::int AS value FROM public.kb_import_core_links
       WHERE batch_id = (
         SELECT id FROM public.kb_import_batches
          WHERE source_label = 'Herbst und Winter: HNO-, Virus-, TCM- und Praxisquellen 2026-08-20'
       )
    `);
    expect(links.rows[0].value).toBe(expected.links);

    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${patientId}';`);
    try {
      const patientCandidates = await db.query<{ value: number }>(`
        SELECT count(*)::int AS value FROM public.kb_entity_candidates
         WHERE candidate_key LIKE 'entity:strunz-%'
      `);
      const patientLinks = await db.query<{ value: number }>(`
        SELECT count(*)::int AS value FROM public.kb_import_core_links
         WHERE batch_id = (
           SELECT id FROM public.kb_import_batches
            WHERE source_label = 'Herbst und Winter: HNO-, Virus-, TCM- und Praxisquellen 2026-08-20'
         )
      `);
      expect(patientCandidates.rows[0].value).toBe(0);
      expect(patientLinks.rows[0].value).toBe(0);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }
  });
});
