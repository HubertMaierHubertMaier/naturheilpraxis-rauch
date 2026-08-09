// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728090000_create_kb_phase1_core.sql"),
  "utf8",
);
const legacyImportMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260809214500_import_legacy_wiki_into_kb.sql"),
  "utf8",
);

const kbTables = [
  "kb_article_entities",
  "kb_article_revisions",
  "kb_articles",
  "kb_assertion_sources",
  "kb_assertions",
  "kb_change_proposals",
  "kb_entities",
  "kb_entity_identifiers",
  "kb_entity_names",
  "kb_entity_relations",
  "kb_entity_revisions",
  "kb_entity_types",
  "kb_identifier_schemes",
  "kb_relation_type_domains",
  "kb_relation_types",
  "kb_source_revisions",
  "kb_sources",
];

const adminId = "10000000-0000-4000-8000-000000000001";
const patientId = "10000000-0000-4000-8000-000000000002";
const entityOneId = "20000000-0000-4000-8000-000000000001";
const entityTwoId = "20000000-0000-4000-8000-000000000002";
const symptomId = "20000000-0000-4000-8000-000000000003";
const revisionOneId = "30000000-0000-4000-8000-000000000001";
const revisionTwoId = "30000000-0000-4000-8000-000000000002";

let db: PGlite;

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
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

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
        SELECT 1
          FROM public.user_roles
         WHERE user_id = _user_id
           AND role = _role
      )
    $$;

    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

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
      category text NOT NULL DEFAULT '',
      tags text[] NOT NULL DEFAULT '{}',
      content text NOT NULL DEFAULT '',
      source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
      safety_notes text NOT NULL DEFAULT '',
      patient_facing_allowed boolean NOT NULL DEFAULT false
    );

    INSERT INTO public.admin_knowledge_base (
      id, title, category, tags, content, source_citations, safety_notes
    ) VALUES (
      '00000000-0000-4000-8000-000000000001',
      'Legacy unchanged',
      'Naturheilkunde',
      ARRAY['Altbestand', 'Quelle'],
      'Vollstaendiger Altinhalt',
      '[{"label":"Alte Quelle","url":"https://example.test/legacy"}]'::jsonb,
      'Ungepruefte historische Sicherheitsnotiz'
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
  `);
  await db.exec(migration);
  await db.exec(legacyImportMigration);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Wiki Phase 1 PGlite migration", () => {
  it("creates all tables and conservative seeds without changing legacy data", async () => {
    const tables = await db.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name LIKE 'kb_%'
       ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual(kbTables);

    const seedCounts = await db.query<{
      entity_types: number;
      identifier_schemes: number;
      relation_types: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM public.kb_entity_types) AS entity_types,
        (SELECT count(*)::int FROM public.kb_identifier_schemes) AS identifier_schemes,
        (SELECT count(*)::int FROM public.kb_relation_types) AS relation_types
    `);
    expect(seedCounts.rows[0]).toEqual({
      entity_types: 23,
      identifier_schemes: 8,
      relation_types: 14,
    });

    const inactiveRelation = await db.query<{ is_active: boolean }>(`
      SELECT is_active
        FROM public.kb_relation_types
       WHERE code = 'may_be_associated_with'
    `);
    expect(inactiveRelation.rows[0].is_active).toBe(false);

    const legacy = await db.query<{ id: string; title: string }>(`
      SELECT id::text, title FROM public.admin_knowledge_base
    `);
    expect(legacy.rows).toEqual([{
      id: "00000000-0000-4000-8000-000000000001",
      title: "Legacy unchanged",
    }]);
  });

  it("imports each legacy wiki row as a complete internal draft article", async () => {
    const imported = await db.query<{
      canonical_key: string;
      current_revision_id: string;
      title: string;
      origin_type: string;
      review_status: string;
      import_origin: string;
      legacy_title: string;
      category_path: string;
      tags: string[];
      content_markdown: string;
      source_citations: string;
      safety_notes: string;
    }>(`
      SELECT
        article.canonical_key,
        article.current_revision_id::text,
        revision.title,
        revision.origin_type,
        revision.review_status,
        revision.metadata ->> 'import_origin' AS import_origin,
        revision.metadata -> 'legacy_record' ->> 'title' AS legacy_title,
        revision.category_path,
        revision.tags,
        revision.content_markdown,
        (revision.metadata -> 'legacy_record' -> 'source_citations')::text AS source_citations,
        revision.metadata -> 'legacy_record' ->> 'safety_notes' AS safety_notes
      FROM public.kb_articles AS article
      JOIN public.kb_article_revisions AS revision
        ON revision.id = article.current_revision_id
      WHERE article.id = '00000000-0000-4000-8000-000000000001'
    `);

    expect(imported.rows).toEqual([{
      canonical_key: "legacy-admin-knowledge:00000000-0000-4000-8000-000000000001",
      current_revision_id: "00000000-0000-4000-8000-000000000001",
      title: "Legacy unchanged",
      origin_type: "legacy_snapshot",
      review_status: "draft",
      import_origin: "admin_knowledge_base",
      legacy_title: "Legacy unchanged",
      category_path: "Naturheilkunde",
      tags: ["Altbestand", "Quelle"],
      content_markdown: "Vollstaendiger Altinhalt",
      source_citations: '[{"url": "https://example.test/legacy", "label": "Alte Quelle"}]',
      safety_notes: "Ungepruefte historische Sicherheitsnotiz",
    }]);
  });

  it("enforces composite current-revision ownership", async () => {
    await db.exec(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES
        ('${entityOneId}', 'product', 'product:pglite-one'),
        ('${entityTwoId}', 'manufacturer', 'manufacturer:pglite-two');

      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, content_hash
      ) VALUES
        ('${revisionOneId}', '${entityOneId}', 1, 'PGlite one', repeat('a', 64)),
        ('${revisionTwoId}', '${entityTwoId}', 1, 'PGlite two', repeat('b', 64));

      UPDATE public.kb_entities
         SET current_revision_id = '${revisionOneId}'
       WHERE id = '${entityOneId}';
    `);

    await expectTransactionFailure(
      `
        UPDATE public.kb_entities
           SET current_revision_id = '${revisionTwoId}'
         WHERE id = '${entityOneId}';
        SET CONSTRAINTS kb_entities_current_revision_fk IMMEDIATE;
      `,
      /kb_entities_current_revision_fk/,
    );
  });

  it("enforces the complete safety-review workflow and separate approved reset", async () => {
    const workflowEntityId = "20000000-0000-4000-8000-000000000010";
    const workflowRevisionId = "30000000-0000-4000-8000-000000000010";

    await db.exec(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('${workflowEntityId}', 'product', 'product:workflow');
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_revisions (
        entity_id, revision_no, display_name, review_status, content_hash
      ) VALUES (
        '${workflowEntityId}', 4, 'Direct domain review', 'domain_review', repeat('4', 64)
      );
    `)).rejects.toThrow(/must be inserted as draft/);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_revisions (
        entity_id, revision_no, display_name, review_status, content_hash
      ) VALUES (
        '${workflowEntityId}', 5, 'Direct safety review', 'safety_review', repeat('5', 64)
      );
    `)).rejects.toThrow(/must be inserted as draft/);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_revisions (
        entity_id, revision_no, display_name, review_status,
        content_hash, reviewed_at, reviewed_by
      ) VALUES (
        '${workflowEntityId}', 2, 'Direct approved', 'approved',
        repeat('4', 64), now(), '${adminId}'
      );
    `)).rejects.toThrow(/must be inserted as draft/);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_revisions (
        entity_id, revision_no, display_name, review_status,
        content_hash, reviewed_at, reviewed_by, released_at
      ) VALUES (
        '${workflowEntityId}', 3, 'Direct released', 'released',
        repeat('5', 64), now(), '${adminId}', now()
      );
    `)).rejects.toThrow(/must be inserted as draft/);

    await db.exec(`
      INSERT INTO public.kb_entity_revisions (
        id, entity_id, revision_no, display_name, summary, content_hash
      ) VALUES (
        '${workflowRevisionId}', '${workflowEntityId}', 1,
        'Workflow revision', 'Initial content', repeat('6', 64)
      );
    `);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'released',
             reviewed_at = now(),
             reviewed_by = '${adminId}',
             released_at = now()
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/separate approved to released transition/);

    await db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'domain_review'
       WHERE id = '${workflowRevisionId}';
    `);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'released',
             reviewed_at = now(),
             reviewed_by = '${adminId}',
             released_at = now()
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/separate approved to released transition/);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/safety_review -> approved/);

    await db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'safety_review'
       WHERE id = '${workflowRevisionId}';
    `);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}',
             summary = 'Changed during approval'
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/may only set review metadata/);

    await db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}',
             review_due_at = now() + interval '1 year'
       WHERE id = '${workflowRevisionId}';
    `);

    await expect(db.exec(`
      DELETE FROM public.kb_entity_revisions
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/Approved, released or historical knowledge revisions cannot be deleted/);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET summary = 'Changed after approval'
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/Approved knowledge revisions are immutable/);

    await expect(db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'draft'
       WHERE id = '${workflowRevisionId}';
    `)).rejects.toThrow(/must only clear review metadata/);

    await db.exec(`
      UPDATE public.kb_entity_revisions
         SET review_status = 'draft',
             reviewed_at = NULL,
             reviewed_by = NULL,
             released_at = NULL,
             review_due_at = NULL
       WHERE id = '${workflowRevisionId}';

      UPDATE public.kb_entity_revisions
         SET summary = 'Edited after separate reset'
       WHERE id = '${workflowRevisionId}';

      UPDATE public.kb_entity_revisions
         SET review_status = 'domain_review'
       WHERE id = '${workflowRevisionId}';

      UPDATE public.kb_entity_revisions
         SET review_status = 'safety_review'
       WHERE id = '${workflowRevisionId}';

      UPDATE public.kb_entity_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${workflowRevisionId}';

      UPDATE public.kb_entity_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '${workflowRevisionId}';
    `);

    const releasedRevision = await db.query<{ review_status: string; summary: string }>(`
      SELECT review_status, summary
        FROM public.kb_entity_revisions
       WHERE id = '${workflowRevisionId}'
    `);
    expect(releasedRevision.rows[0]).toEqual({
      review_status: "released",
      summary: "Edited after separate reset",
    });
  });

  it("accepts valid domains and rejects invalid domains and assertion kinds", async () => {
    await db.exec(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('${symptomId}', 'symptom', 'symptom:pglite');

      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000001',
        'claim:pglite-valid',
        1,
        'entity_relation',
        'Product is manufactured by manufacturer',
        repeat('c', 64)
      );

      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '40000000-0000-4000-8000-000000000001',
        '${entityOneId}',
        'manufactured_by',
        '${entityTwoId}'
      );
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000002',
        'claim:pglite-invalid-domain',
        1,
        'entity_relation',
        'Invalid domain',
        repeat('d', 64)
      );
      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '40000000-0000-4000-8000-000000000002',
        '${symptomId}',
        'manufactured_by',
        '${entityTwoId}'
      );
    `)).rejects.toThrow(/does not allow domain/);

    await db.exec(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000003',
        'claim:pglite-invalid-kind',
        1,
        'narrative',
        'Not a graph assertion',
        repeat('e', 64)
      );
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '40000000-0000-4000-8000-000000000003',
        '${entityOneId}',
        'manufactured_by',
        '${entityTwoId}'
      );
    `)).rejects.toThrow(/entity_relation assertion/);

    await expect(db.exec(`
      UPDATE public.kb_assertions
         SET assertion_kind = 'entity_relation'
       WHERE id = '40000000-0000-4000-8000-000000000003';
    `)).rejects.toThrow(/assertion_kind is immutable/);
  });

  it("protects assertion sources and graph edges after approval", async () => {
    const sourceId = "50000000-0000-4000-8000-000000000020";
    const sourceRevisionId = "60000000-0000-4000-8000-000000000020";
    const assertionId = "40000000-0000-4000-8000-000000000001";

    await db.exec(`
      INSERT INTO public.kb_sources (id, canonical_key)
      VALUES ('${sourceId}', 'source:approved-assertion-dependency');

      INSERT INTO public.kb_source_revisions (
        id, source_id, revision_no, source_type, title, content_hash
      ) VALUES (
        '${sourceRevisionId}', '${sourceId}', 1,
        'guideline', 'Approved assertion source', repeat('9', 64)
      );

      UPDATE public.kb_source_revisions
         SET review_status = 'domain_review'
       WHERE id = '${sourceRevisionId}';

      UPDATE public.kb_source_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${sourceRevisionId}';

      UPDATE public.kb_source_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '${sourceRevisionId}';

      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, is_primary
      ) VALUES ('${assertionId}', '${sourceRevisionId}', 'supports', true);

      UPDATE public.kb_assertions
         SET review_status = 'domain_review'
       WHERE id = '${assertionId}';

      UPDATE public.kb_assertions
         SET review_status = 'safety_review'
       WHERE id = '${assertionId}';

      UPDATE public.kb_assertions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${assertionId}';
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role
      ) VALUES ('${assertionId}', '${sourceRevisionId}', 'qualifies');
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);

    await expect(db.exec(`
      UPDATE public.kb_assertion_sources
         SET locator = 'changed'
       WHERE assertion_id = '${assertionId}'
         AND source_revision_id = '${sourceRevisionId}'
         AND source_role = 'supports';
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);

    await expect(db.exec(`
      DELETE FROM public.kb_assertion_sources
       WHERE assertion_id = '${assertionId}'
         AND source_revision_id = '${sourceRevisionId}'
         AND source_role = 'supports';
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES ('${assertionId}', '${entityOneId}', 'manufactured_by', '${entityTwoId}');
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);

    await expect(db.exec(`
      UPDATE public.kb_entity_relations
         SET rank = 90
       WHERE assertion_id = '${assertionId}';
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);

    await expect(db.exec(`
      DELETE FROM public.kb_entity_relations
       WHERE assertion_id = '${assertionId}';
    `)).rejects.toThrow(/approved, released or historical assertions are immutable/);
  });

  it("protects entity dependencies of released article revisions", async () => {
    const articleId = "70000000-0000-4000-8000-000000000001";
    const articleRevisionId = "71000000-0000-4000-8000-000000000001";
    const articleEntityId = "72000000-0000-4000-8000-000000000001";

    await db.exec(`
      INSERT INTO public.kb_entities (id, entity_type_code, canonical_key)
      VALUES ('${articleEntityId}', 'symptom', 'symptom:article-dependency');

      INSERT INTO public.kb_articles (id, canonical_key)
      VALUES ('${articleId}', 'article:pglite-dependency');

      INSERT INTO public.kb_article_revisions (
        id, article_id, revision_no, title, content_hash
      ) VALUES (
        '${articleRevisionId}', '${articleId}', 1,
        'Article dependency', repeat('7', 64)
      );

      INSERT INTO public.kb_article_entities (
        article_revision_id, entity_id, role
      ) VALUES ('${articleRevisionId}', '${articleEntityId}', 'about');

      UPDATE public.kb_article_revisions
         SET review_status = 'domain_review'
       WHERE id = '${articleRevisionId}';

      UPDATE public.kb_article_revisions
         SET review_status = 'safety_review'
       WHERE id = '${articleRevisionId}';

      UPDATE public.kb_article_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${articleRevisionId}';
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_article_entities (
        article_revision_id, entity_id, role
      ) VALUES ('${articleRevisionId}', '${articleEntityId}', 'mentions');
    `)).rejects.toThrow(/article revisions are immutable/);

    await expect(db.exec(`
      UPDATE public.kb_article_entities
         SET rank = 80
       WHERE article_revision_id = '${articleRevisionId}'
         AND entity_id = '${articleEntityId}'
         AND role = 'about';
    `)).rejects.toThrow(/article revisions are immutable/);

    await expect(db.exec(`
      DELETE FROM public.kb_article_entities
       WHERE article_revision_id = '${articleRevisionId}'
         AND entity_id = '${articleEntityId}'
         AND role = 'about';
    `)).rejects.toThrow(/article revisions are immutable/);

    await db.exec(`
      UPDATE public.kb_article_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '${articleRevisionId}';
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_article_entities (
        article_revision_id, entity_id, role
      ) VALUES ('${articleRevisionId}', '${articleEntityId}', 'mentions');
    `)).rejects.toThrow(/article revisions are immutable/);

    await expect(db.exec(`
      UPDATE public.kb_article_entities
         SET rank = 90
       WHERE article_revision_id = '${articleRevisionId}'
         AND entity_id = '${articleEntityId}'
         AND role = 'about';
    `)).rejects.toThrow(/article revisions are immutable/);

    await expect(db.exec(`
      DELETE FROM public.kb_article_entities
       WHERE article_revision_id = '${articleRevisionId}'
         AND entity_id = '${articleEntityId}'
         AND role = 'about';
    `)).rejects.toThrow(/article revisions are immutable/);
  });

  it("keeps identifier and relation semantics immutable", async () => {
    await expect(db.exec(`
      UPDATE public.kb_identifier_schemes
         SET is_globally_unique = false
       WHERE code = 'pzn';
    `)).rejects.toThrow(/is_globally_unique is immutable/);

    await expect(db.exec(`
      UPDATE public.kb_identifier_schemes
         SET value_pattern = '^[0-9]+$'
       WHERE code = 'pzn';
    `)).rejects.toThrow(/value_pattern is immutable/);

    await expect(db.exec(`
      UPDATE public.kb_relation_types
         SET is_symmetric = true
       WHERE code = 'contains';
    `)).rejects.toThrow(/is_symmetric is immutable/);
  });

  it("requires active relation types and approved immutable domains", async () => {
    const domainAssertionId = "40000000-0000-4000-8000-000000000030";
    const inactiveAssertionId = "40000000-0000-4000-8000-000000000031";

    await expect(db.exec(`
      INSERT INTO public.kb_relation_type_domains (
        relation_type_code, subject_entity_type_code,
        object_entity_type_code, review_status
      ) VALUES ('manufactured_by', 'disease', 'manufacturer', 'approved');
    `)).rejects.toThrow(/must be inserted as draft/);

    await db.exec(`
      INSERT INTO public.kb_relation_type_domains (
        relation_type_code, subject_entity_type_code, object_entity_type_code
      ) VALUES ('manufactured_by', 'symptom', 'manufacturer');

      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES
        (
          '${domainAssertionId}', 'claim:pglite-domain-approval', 1,
          'entity_relation', 'Domain approval behavior', repeat('a', 64)
        ),
        (
          '${inactiveAssertionId}', 'claim:pglite-inactive-relation', 1,
          'entity_relation', 'Inactive relation behavior', repeat('b', 64)
        );
    `);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '${domainAssertionId}', '${symptomId}', 'manufactured_by', '${entityTwoId}'
      );
    `)).rejects.toThrow(/does not allow domain/);

    await expect(db.exec(`
      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '${inactiveAssertionId}', '${entityOneId}',
        'may_be_associated_with', '${entityTwoId}'
      );
    `)).rejects.toThrow(/is inactive/);

    await db.exec(`
      UPDATE public.kb_relation_type_domains
         SET review_status = 'approved'
       WHERE relation_type_code = 'manufactured_by'
         AND subject_entity_type_code = 'symptom'
         AND object_entity_type_code = 'manufacturer';

      INSERT INTO public.kb_entity_relations (
        assertion_id, subject_entity_id, relation_type_code, object_entity_id
      ) VALUES (
        '${domainAssertionId}', '${symptomId}', 'manufactured_by', '${entityTwoId}'
      );
    `);

    await expect(db.exec(`
      UPDATE public.kb_relation_type_domains
         SET review_status = 'draft'
       WHERE relation_type_code = 'manufactured_by'
         AND subject_entity_type_code = 'device'
         AND object_entity_type_code = 'manufacturer';
    `)).rejects.toThrow(/Approved relation domains are immutable/);

    await expect(db.exec(`
      DELETE FROM public.kb_relation_type_domains
       WHERE relation_type_code = 'manufactured_by'
         AND subject_entity_type_code = 'device'
         AND object_entity_type_code = 'manufacturer';
    `)).rejects.toThrow(/cannot be deleted/);

    await expectTransactionFailure(
      `
        INSERT INTO public.kb_relation_types (code, label)
        VALUES ('pglite_missing_domain', 'Missing domain');
        SET CONSTRAINTS kb_relation_types_validate_approved_domains IMMEDIATE;
      `,
      /requires at least one approved domain/,
    );

    await db.exec(`
      BEGIN;
      INSERT INTO public.kb_relation_types (code, label)
      VALUES ('pglite_atomic_domain', 'Atomic domain');
      INSERT INTO public.kb_relation_type_domains (
        relation_type_code, subject_entity_type_code, object_entity_type_code
      ) VALUES ('pglite_atomic_domain', 'product', 'manufacturer');
      UPDATE public.kb_relation_type_domains
         SET review_status = 'approved'
       WHERE relation_type_code = 'pglite_atomic_domain'
         AND subject_entity_type_code = 'product'
         AND object_entity_type_code = 'manufacturer';
      SET CONSTRAINTS ALL IMMEDIATE;
      COMMIT;
    `);
  });

  it("uses domain review without safety review for source revisions", async () => {
    const sourceId = "50000000-0000-4000-8000-000000000010";
    const sourceRevisionId = "60000000-0000-4000-8000-000000000010";

    await db.exec(`
      INSERT INTO public.kb_sources (id, canonical_key)
      VALUES ('${sourceId}', 'source:pglite-workflow');

      INSERT INTO public.kb_source_revisions (
        id, source_id, revision_no, source_type, title, content_hash
      ) VALUES (
        '${sourceRevisionId}', '${sourceId}', 1,
        'guideline', 'Source workflow', repeat('8', 64)
      );

      UPDATE public.kb_source_revisions
         SET review_status = 'domain_review'
       WHERE id = '${sourceRevisionId}';
    `);

    await expect(db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'safety_review'
       WHERE id = '${sourceRevisionId}';
    `)).rejects.toThrow(/Source revisions do not use safety review/);

    await db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '${sourceRevisionId}';

      UPDATE public.kb_source_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '${sourceRevisionId}';
    `);

    const sourceStatus = await db.query<{ review_status: string }>(`
      SELECT review_status
        FROM public.kb_source_revisions
       WHERE id = '${sourceRevisionId}'
    `);
    expect(sourceStatus.rows[0].review_status).toBe("released");
  });

  it("rejects release without a released primary source", async () => {
    await db.exec(`
      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000004',
        'claim:pglite-no-source',
        1,
        'narrative',
        'Unsupported claim',
        repeat('f', 64)
      );

      UPDATE public.kb_assertions
         SET review_status = 'domain_review'
       WHERE id = '40000000-0000-4000-8000-000000000004';

      UPDATE public.kb_assertions
         SET review_status = 'safety_review'
       WHERE id = '40000000-0000-4000-8000-000000000004';

      UPDATE public.kb_assertions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '40000000-0000-4000-8000-000000000004';
    `);

    await expect(db.exec(`
      UPDATE public.kb_assertions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '40000000-0000-4000-8000-000000000004';
    `)).rejects.toThrow(/primary released supporting source revision/);
  });

  it("requires an atomic replacement before retiring a released primary source", async () => {
    await db.exec(`
      INSERT INTO public.kb_sources (id, canonical_key)
      VALUES
        ('50000000-0000-4000-8000-000000000001', 'source:pglite-old'),
        ('50000000-0000-4000-8000-000000000002', 'source:pglite-new');

      INSERT INTO public.kb_source_revisions (
        id, source_id, revision_no, source_type, title, content_hash
      ) VALUES
        (
          '60000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          1,
          'guideline',
          'Old source',
          repeat('1', 64)
        ),
        (
          '60000000-0000-4000-8000-000000000002',
          '50000000-0000-4000-8000-000000000002',
          1,
          'guideline',
          'Replacement source',
          repeat('2', 64)
        );

      UPDATE public.kb_source_revisions
         SET review_status = 'domain_review'
       WHERE id IN (
         '60000000-0000-4000-8000-000000000001',
         '60000000-0000-4000-8000-000000000002'
       );

      UPDATE public.kb_source_revisions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id IN (
         '60000000-0000-4000-8000-000000000001',
         '60000000-0000-4000-8000-000000000002'
       );

      UPDATE public.kb_source_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '60000000-0000-4000-8000-000000000001';

      INSERT INTO public.kb_assertions (
        id, canonical_key, version_no, assertion_kind, claim_text, content_hash
      ) VALUES (
        '40000000-0000-4000-8000-000000000005',
        'claim:pglite-source-switch',
        1,
        'narrative',
        'Claim with replaceable source',
        repeat('3', 64)
      );

      INSERT INTO public.kb_assertion_sources (
        assertion_id, source_revision_id, source_role, is_primary
      ) VALUES
        (
          '40000000-0000-4000-8000-000000000005',
          '60000000-0000-4000-8000-000000000001',
          'supports',
          true
        ),
        (
          '40000000-0000-4000-8000-000000000005',
          '60000000-0000-4000-8000-000000000002',
          'supports',
          true
        );

      UPDATE public.kb_assertions
         SET review_status = 'domain_review'
       WHERE id = '40000000-0000-4000-8000-000000000005';

      UPDATE public.kb_assertions
         SET review_status = 'safety_review'
       WHERE id = '40000000-0000-4000-8000-000000000005';

      UPDATE public.kb_assertions
         SET review_status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${adminId}'
       WHERE id = '40000000-0000-4000-8000-000000000005';

      UPDATE public.kb_assertions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '40000000-0000-4000-8000-000000000005';
    `);

    await expect(db.exec(`
      UPDATE public.kb_source_revisions
         SET review_status = 'withdrawn'
       WHERE id = '60000000-0000-4000-8000-000000000001';
    `)).rejects.toThrow(/last released primary source/);

    await db.exec(`
      BEGIN;
      UPDATE public.kb_source_revisions
         SET review_status = 'released',
             released_at = now()
       WHERE id = '60000000-0000-4000-8000-000000000002';
      UPDATE public.kb_source_revisions
         SET review_status = 'superseded'
       WHERE id = '60000000-0000-4000-8000-000000000001';
      COMMIT;
    `);

    const statuses = await db.query<{ id: string; review_status: string }>(`
      SELECT id::text, review_status
        FROM public.kb_source_revisions
       WHERE id IN (
         '60000000-0000-4000-8000-000000000001',
         '60000000-0000-4000-8000-000000000002'
       )
       ORDER BY id
    `);
    expect(statuses.rows).toEqual([
      {
        id: "60000000-0000-4000-8000-000000000001",
        review_status: "superseded",
      },
      {
        id: "60000000-0000-4000-8000-000000000002",
        review_status: "released",
      },
    ]);
  });

  it("denies anonymous table access", async () => {
    await db.exec("SET ROLE anon;");
    try {
      await expect(db.exec("SELECT * FROM public.kb_entities;")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("denies patients and allows admins through RLS while proposals remain server-written", async () => {
    const proposalId = "80000000-0000-4000-8000-000000000001";

    await db.exec(`
      SET ROLE service_role;
      INSERT INTO public.kb_change_proposals (
        id, proposal_kind, operation, proposal, origin_type, submitted_by
      ) VALUES (
        '${proposalId}', 'entity', 'create', '{}'::jsonb, 'human', NULL
      );
      RESET ROLE;
    `);

    await db.exec("SET ROLE authenticated;");
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [patientId]);
      const patientRows = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.kb_entities",
      );
      expect(patientRows.rows[0].count).toBe(0);
      await expect(db.exec(`
        INSERT INTO public.kb_entities (entity_type_code, canonical_key)
        VALUES ('product', 'product:patient-denied')
      `)).rejects.toThrow(/row-level security/);

      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [adminId]);
      const adminRows = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.kb_entities",
      );
      expect(adminRows.rows[0].count).toBeGreaterThan(0);
      await db.exec(`
        INSERT INTO public.kb_entities (entity_type_code, canonical_key)
        VALUES ('product', 'product:admin-allowed')
      `);
      await expect(db.exec(`
        INSERT INTO public.kb_change_proposals (
          proposal_kind, operation, proposal, origin_type
        ) VALUES ('entity', 'create', '{}'::jsonb, 'human')
      `)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`
        UPDATE public.kb_change_proposals
           SET status = 'in_review'
         WHERE id = '${proposalId}';
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });
});
