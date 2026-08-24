// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824140000_restrict_infothek_gating_and_importer.sql",
  ),
  "utf8",
);

const adminId = "10000000-0000-4000-8000-000000000001";
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

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE kb_importer NOLOGIN NOINHERIT NOBYPASSRLS;
    CREATE ROLE kb_import_runtime NOLOGIN NOINHERIT NOBYPASSRLS;
    GRANT kb_importer TO kb_import_runtime;

    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin', 'patient');
    CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
      )
    $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
    INSERT INTO public.user_roles (user_id, role) VALUES ('${adminId}', 'admin');

    CREATE TABLE public.infothek_gating (
      href text PRIMARY KEY,
      gated boolean NOT NULL,
      visibility text NOT NULL
    );
    INSERT INTO public.infothek_gating VALUES
      ('/public-page', false, 'public'),
      ('/patient-page', true, 'patient');
    ALTER TABLE public.infothek_gating ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can read gating" ON public.infothek_gating FOR SELECT USING (true);
    GRANT SELECT ON public.infothek_gating TO anon, authenticated, service_role;
    GRANT SELECT (href, gated, visibility) ON public.infothek_gating TO anon, authenticated;
  `);

  for (const table of stagingTables) {
    await db.exec(`
      CREATE TABLE public.${table} (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY ${table}_importer_read ON public.${table}
        FOR SELECT TO kb_importer USING (true);
      GRANT SELECT ON public.${table} TO kb_importer;
    `);
  }

  await db.exec(`
    CREATE POLICY kb_import_batches_importer_insert ON public.kb_import_batches
      FOR INSERT TO kb_importer WITH CHECK (true);
    CREATE POLICY kb_import_batches_importer_update ON public.kb_import_batches
      FOR UPDATE TO kb_importer USING (true) WITH CHECK (true);
    GRANT INSERT, UPDATE ON public.kb_import_batches TO kb_importer;
  `);

  await db.exec(migration);
}, 20_000);

afterAll(async () => {
  await db?.close();
});

describe("database warning hardening in PostgreSQL", () => {
  it("blocks public full-table reads while returning only requested routes", async () => {
    await db.exec("SET ROLE anon;");
    try {
      await expect(db.query("SELECT * FROM public.infothek_gating")).rejects.toThrow(/permission denied/);
      const result = await db.query<{ href: string; visibility: string }>(`
        SELECT href, visibility
        FROM public.get_infothek_gating_for_routes(ARRAY['/patient-page'])
      `);
      expect(result.rows).toEqual([{ href: "/patient-page", visibility: "patient" }]);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("keeps direct table reads available to admins", async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      const result = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.infothek_gating",
      );
      expect(result.rows[0].count).toBe(2);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("blocks importer reads and batch changes", async () => {
    await db.exec("SET ROLE kb_importer;");
    try {
      await expect(db.query("SELECT * FROM public.kb_source_candidates")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.exec("UPDATE public.kb_import_batches SET id = id"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });
});
