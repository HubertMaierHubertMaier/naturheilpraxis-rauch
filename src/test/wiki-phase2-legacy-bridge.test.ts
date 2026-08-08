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

const firstLegacyId = "70000000-0000-4000-8000-000000000001";
const secondLegacyId = "70000000-0000-4000-8000-000000000002";
const adminId = "10000000-0000-4000-8000-000000000001";
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const snapshotValidationSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/wikiSnapshotValidation.ts"),
  "utf8",
);
const wikiSnapshotTables = [
  "admin_knowledge_base",
  "mannayan_products",
  "knowledge_product_links",
  "kb_entity_types",
  "kb_identifier_schemes",
  "kb_relation_types",
  "kb_relation_type_domains",
  "kb_entities",
  "kb_entity_revisions",
  "kb_entity_names",
  "kb_entity_identifiers",
  "kb_sources",
  "kb_source_revisions",
  "kb_assertions",
  "kb_entity_relations",
  "kb_assertion_sources",
  "kb_articles",
  "kb_article_revisions",
  "kb_article_entities",
  "kb_change_proposals",
  "faqs",
  "practice_pricing",
  "practice_info",
] as const;
const wikiRestoreOrder = [
  "kb_entity_types",
  "kb_identifier_schemes",
  "kb_relation_types",
  "kb_relation_type_domains",
  "kb_entities",
  "kb_entity_revisions",
  "kb_entity_names",
  "kb_entity_identifiers",
  "kb_sources",
  "kb_source_revisions",
  "kb_assertions",
  "kb_entity_relations",
  "kb_assertion_sources",
  "kb_articles",
  "kb_article_revisions",
  "kb_article_entities",
  "kb_change_proposals",
  "admin_knowledge_base",
  "mannayan_products",
  "knowledge_product_links",
  "faqs",
  "practice_pricing",
  "practice_info",
] as const;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
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

    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

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

    CREATE FUNCTION public.update_updated_at_column()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$;

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

    CREATE TRIGGER update_admin_knowledge_base_updated_at
      BEFORE UPDATE ON public.admin_knowledge_base
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_knowledge_base TO authenticated;
    INSERT INTO public.user_roles (user_id, role) VALUES ('${adminId}', 'admin');
  `);

  await db.query(
    `INSERT INTO public.admin_knowledge_base (
       id, title, category, tags, content, created_at, updated_at,
       entry_kind, review_status, therapeutic_topics, safety_notes
     ) VALUES
       ($1, 'Doppelter Titel', 'Alt > Eins', ARRAY['Tag B', 'Tag A'], $3, '2025-01-01T08:00:00Z', '2025-02-01T08:00:00Z', 'reference', 'reviewed', ARRAY['Thema 1'], 'Historischer Hinweis'),
       ($2, 'Doppelter Titel', 'Alt > Zwei', ARRAY['Tag A'], 'Zweiter Inhalt', '2025-01-02T08:00:00Z', '2025-02-02T08:00:00Z', 'remedy', 'unreviewed', ARRAY[]::text[], '')`,
    [firstLegacyId, secondLegacyId, "Zeile 1\r\nZeile 2 mit Umlaut: ae"],
  );

  await db.exec(phase1Migration);
  await db.exec(phase2Migration);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 2 legacy bridge", () => {
  it("maps duplicate titles by immutable legacy UUID and preserves exact fields", async () => {
    const result = await db.query<{
      legacy_id: string;
      canonical_key: string;
      article_kind: string;
      revision_no: number;
      title: string;
      category_path: string;
      tags: string[];
      content_markdown: string;
      origin_type: string;
      content_hash: string;
      safety_notes: string;
    }>(`
      SELECT
        article.legacy_knowledge_entry_id::text AS legacy_id,
        article.canonical_key,
        article.article_kind,
        revision.revision_no,
        revision.title,
        revision.category_path,
        revision.tags,
        revision.content_markdown,
        revision.origin_type,
        revision.content_hash,
        revision.metadata #>> '{legacy_metadata,safety_notes}' AS safety_notes
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision
        ON revision.id = article.current_revision_id
      ORDER BY article.legacy_knowledge_entry_id
    `);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.canonical_key)).toEqual([
      `legacy:${firstLegacyId}`,
      `legacy:${secondLegacyId}`,
    ]);
    expect(result.rows[0]).toEqual(expect.objectContaining({
      legacy_id: firstLegacyId,
      article_kind: "reference",
      revision_no: 1,
      title: "Doppelter Titel",
      category_path: "Alt > Eins",
      tags: ["Tag B", "Tag A"],
      content_markdown: "Zeile 1\r\nZeile 2 mit Umlaut: ae",
      origin_type: "legacy_snapshot",
      safety_notes: "Historischer Hinweis",
    }));
    expect(result.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is idempotent and ignores an updated_at-only no-op update", async () => {
    await db.exec(`
      SELECT public.kb_sync_legacy_article_row(legacy_row)
        FROM public.admin_knowledge_base legacy_row;
      UPDATE public.admin_knowledge_base
         SET title = title
       WHERE id = '${firstLegacyId}';
    `);

    const counts = await db.query<{ articles: number; revisions: number }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_articles WHERE legacy_knowledge_entry_id IS NOT NULL) AS articles,
        (SELECT count(*)::int FROM public.kb_article_revisions WHERE origin_type = 'legacy_snapshot') AS revisions
    `);
    expect(counts.rows[0]).toEqual({ articles: 2, revisions: 2 });
    const validation = await db.query<{ invalid_current_snapshots: number }>(`
      SELECT (public.kb_export_wiki_snapshot() -> 'validation' ->> 'invalid_current_snapshots')::int AS invalid_current_snapshots
    `);
    expect(validation.rows[0].invalid_current_snapshots).toBe(0);
  });

  it("captures a later legacy edit as a new immutable revision", async () => {
    await db.exec(`
      UPDATE public.admin_knowledge_base
         SET title = 'Geaenderter Titel',
             category = 'Neu > Unterpunkt',
             tags = ARRAY['Neu', 'Reihenfolge'],
             content = E'Neue Zeile 1\\nNeue Zeile 2',
             safety_notes = 'Neu zu pruefen'
       WHERE id = '${firstLegacyId}';
    `);

    const revisions = await db.query<{
      revision_no: number;
      title: string;
      category_path: string;
      content_markdown: string;
      is_current: boolean;
      content_hash: string;
    }>(`
      SELECT
        revision.revision_no,
        revision.title,
        revision.category_path,
        revision.content_markdown,
        article.current_revision_id = revision.id AS is_current,
        revision.content_hash
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision ON revision.article_id = article.id
      WHERE article.legacy_knowledge_entry_id = '${firstLegacyId}'
      ORDER BY revision.revision_no
    `);

    expect(revisions.rows).toEqual([
      expect.objectContaining({ revision_no: 1, title: "Doppelter Titel", category_path: "Alt > Eins", is_current: false }),
      expect.objectContaining({ revision_no: 2, title: "Geaenderter Titel", category_path: "Neu > Unterpunkt", content_markdown: "Neue Zeile 1\nNeue Zeile 2", is_current: true }),
    ]);
    expect(revisions.rows[0].content_hash).not.toBe(revisions.rows[1].content_hash);

    await expect(db.exec(`
      UPDATE public.kb_article_revisions
         SET title = 'Unerlaubt'
       WHERE article_id = (
         SELECT id FROM public.kb_articles WHERE legacy_knowledge_entry_id = '${firstLegacyId}'
       );
    `)).rejects.toThrow(/Legacy article snapshots are immutable/);
  });

  it("blocks direct authenticated ownership or mutation of bridge articles", async () => {
    await db.exec(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('71000000-0000-4000-8000-000000000001', 'pathogen', 'pathogen:bridge-guard-test');
    `);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${adminId}';`);
    try {
      await expect(db.exec(`
        INSERT INTO public.kb_articles (canonical_key, legacy_knowledge_entry_id)
        VALUES ('legacy:70000000-0000-4000-8000-000000000099', '70000000-0000-4000-8000-000000000099');
      `)).rejects.toThrow(/may only be changed through admin_knowledge_base/);

      await expect(db.exec(`
        INSERT INTO public.kb_articles (canonical_key)
        VALUES ('legacy:70000000-0000-4000-8000-000000000098');
      `)).rejects.toThrow(/may only be changed through admin_knowledge_base/);

      await expect(db.exec(`
        UPDATE public.kb_articles
           SET lifecycle_status = 'withdrawn'
         WHERE legacy_knowledge_entry_id = '${firstLegacyId}';
      `)).rejects.toThrow(/may only be changed through admin_knowledge_base/);

      await expect(db.exec(`
        INSERT INTO public.kb_article_revisions (
          article_id, revision_no, title, origin_type, content_hash
        ) VALUES (
          (SELECT id FROM public.kb_articles WHERE legacy_knowledge_entry_id = '${firstLegacyId}'),
          2147483647,
          'Gefälschter Snapshot',
          'legacy_snapshot',
          repeat('f', 64)
        );
      `)).rejects.toThrow(/may only be created by the bridge/);

      await expect(db.exec(`
        INSERT INTO public.kb_article_entities (article_revision_id, entity_id, role)
        VALUES (
          (
            SELECT current_revision_id FROM public.kb_articles
             WHERE legacy_knowledge_entry_id = '${firstLegacyId}'
          ),
          '71000000-0000-4000-8000-000000000001',
          'about'
        );
      `)).rejects.toThrow(/may only be changed by the bridge/);

      await db.exec(`
        UPDATE public.admin_knowledge_base
           SET safety_notes = 'Legitime Admin-Aenderung ueber Legacy'
         WHERE id = '${firstLegacyId}';
      `);
    } finally {
      await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
    }

    const latest = await db.query<{ revision_no: number; safety_notes: string }>(`
      SELECT
        revision.revision_no,
        revision.metadata #>> '{legacy_metadata,safety_notes}' AS safety_notes
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision ON revision.id = article.current_revision_id
      WHERE article.legacy_knowledge_entry_id = '${firstLegacyId}'
    `);
    expect(latest.rows[0]).toEqual({
      revision_no: 3,
      safety_notes: "Legitime Admin-Aenderung ueber Legacy",
    });
  });

  it("keeps deletion and identical reinsertion in immutable history", async () => {
    await db.exec(`
      CREATE TEMP TABLE second_legacy_copy AS
        SELECT * FROM public.admin_knowledge_base WHERE id = '${secondLegacyId}';
      DELETE FROM public.admin_knowledge_base
       WHERE id = '${secondLegacyId}';
    `);

    const retained = await db.query<{ lifecycle_status: string; revision_count: number; deleted_at: string | null }>(`
      SELECT
        article.lifecycle_status,
        count(revision.id)::int AS revision_count,
        article.metadata ->> 'legacy_deleted_at' AS deleted_at
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision ON revision.article_id = article.id
      WHERE article.legacy_knowledge_entry_id = '${secondLegacyId}'
      GROUP BY article.id
    `);

    expect(retained.rows[0].lifecycle_status).toBe("withdrawn");
    expect(retained.rows[0].revision_count).toBe(1);
    expect(retained.rows[0].deleted_at).toBeTruthy();

    await db.exec(`INSERT INTO public.admin_knowledge_base SELECT * FROM second_legacy_copy;`);
    const reinstated = await db.query<{ lifecycle_status: string; revision_count: number; reinstated_after: string | null }>(`
      SELECT
        article.lifecycle_status,
        count(revision.id)::int AS revision_count,
        max(revision.metadata ->> 'reinstated_after_legacy_delete_at') AS reinstated_after
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision ON revision.article_id = article.id
      WHERE article.legacy_knowledge_entry_id = '${secondLegacyId}'
      GROUP BY article.id
    `);
    expect(reinstated.rows[0].lifecycle_status).toBe("active");
    expect(reinstated.rows[0].revision_count).toBe(2);
    expect(reinstated.rows[0].reinstated_after).toBeTruthy();
  });

  it("exports a validated single-snapshot bridge and keeps the migration additive", async () => {
    const exported = await db.query<{ snapshot: { tables: Record<string, unknown[]>; manifest: Record<string, { rows: number; sha256: string }>; validation: Record<string, number> } }>(`
      SELECT public.kb_export_wiki_snapshot() AS snapshot
    `);
    expect(exported.rows[0].snapshot.validation).toEqual(expect.objectContaining({
      legacy_rows: 2,
      mapped_articles: 2,
      missing_articles: 0,
      invalid_current_snapshots: 0,
      orphaned_active_articles: 0,
    }));
    expect(Object.keys(exported.rows[0].snapshot.tables)).toHaveLength(23);
    expect(Object.keys(exported.rows[0].snapshot.manifest)).toHaveLength(23);
    expect(exported.rows[0].snapshot.manifest.kb_article_revisions).toEqual(expect.objectContaining({
      rows: 5,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(phase2Migration).not.toMatch(/\b(DROP|RENAME|TRUNCATE)\b/i);
    expect(phase2Migration).not.toMatch(/REFERENCES public\.admin_knowledge_base/i);
    expect(phase2Migration).toContain("legacy_knowledge_entry_id uuid UNIQUE");
    expect(phase2Migration).toContain("AFTER INSERT OR UPDATE OR DELETE ON public.admin_knowledge_base");
    expect(phase2Migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(phase2Migration).toContain("FUNCTION public.kb_export_wiki_snapshot()");
    expect(phase2Migration).toContain("kb_article_revisions_bridge_rows_protect");
    expect(phase2Migration).toContain("kb_article_entities_bridge_rows_protect");
    expect(backupExportSource).toContain('client.rpc("kb_export_wiki_snapshot")');
    expect(backupExportSource).toContain("kb_wiki_snapshot_manifest.json");
    expect(snapshotValidationSource).toContain("Wiki-Snapshot inkonsistent");

    const snapshot = exported.rows[0].snapshot;
    await db.exec("BEGIN; SET CONSTRAINTS ALL DEFERRED;");
    try {
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER USER;`);
      }
      await db.exec(`TRUNCATE TABLE ${wikiSnapshotTables.map((table) => `public.${table}`).join(", ")};`);
      for (const table of wikiRestoreOrder) {
        await db.query(
          `INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
          [JSON.stringify(snapshot.tables[table])],
        );
      }
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE;");
      for (const table of wikiSnapshotTables) {
        await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER USER;`);
      }

      const restored = await db.query<{ snapshot: { manifest: Record<string, { rows: number; sha256: string }>; validation: Record<string, number> } }>(`
        SELECT public.kb_export_wiki_snapshot() AS snapshot
      `);
      expect(restored.rows[0].snapshot.validation).toEqual(expect.objectContaining({
        missing_articles: 0,
        invalid_current_snapshots: 0,
        orphaned_active_articles: 0,
      }));
      expect(restored.rows[0].snapshot.manifest).toEqual(snapshot.manifest);
      await db.exec("COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  });
});
