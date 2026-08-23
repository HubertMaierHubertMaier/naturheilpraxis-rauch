// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810170000_import_sibo_gasprofile_sources.sql"),
  "utf8",
);

type Counts = {
  sources: number;
  source_revisions: number;
  articles: number;
  article_revisions: number;
};

describe("SIBO source import", () => {
  it("executes without ambiguous variables and remains idempotent", async () => {
    const db = new PGlite();

    try {
      await db.exec(`
        CREATE TABLE public.kb_sources (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          canonical_key text NOT NULL UNIQUE,
          current_revision_id uuid,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE TABLE public.kb_source_revisions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id uuid NOT NULL REFERENCES public.kb_sources(id),
          revision_no integer NOT NULL,
          source_type text NOT NULL,
          title text NOT NULL,
          authors text[] NOT NULL DEFAULT '{}',
          publisher text,
          published_on date,
          url text,
          retrieved_on date,
          rights_status text NOT NULL,
          review_status text NOT NULL,
          content_hash text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          UNIQUE (source_id, revision_no)
        );

        CREATE TABLE public.kb_articles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          canonical_key text NOT NULL UNIQUE,
          article_kind text NOT NULL,
          current_revision_id uuid,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE TABLE public.kb_article_revisions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          article_id uuid NOT NULL REFERENCES public.kb_articles(id),
          revision_no integer NOT NULL,
          title text NOT NULL,
          category_path text NOT NULL,
          tags text[] NOT NULL DEFAULT '{}',
          content_markdown text NOT NULL,
          review_status text NOT NULL,
          origin_type text NOT NULL,
          content_hash text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          UNIQUE (article_id, revision_no)
        );
      `);

      const readCounts = async () => {
        const result = await db.query<Counts>(`
          SELECT
            (SELECT count(*)::int FROM public.kb_sources) AS sources,
            (SELECT count(*)::int FROM public.kb_source_revisions) AS source_revisions,
            (SELECT count(*)::int FROM public.kb_articles) AS articles,
            (SELECT count(*)::int FROM public.kb_article_revisions) AS article_revisions
        `);
        return result.rows[0];
      };

      await db.exec(migration);
      expect(await readCounts()).toEqual({
        sources: 2,
        source_revisions: 2,
        articles: 1,
        article_revisions: 1,
      });

      await db.exec(migration);
      expect(await readCounts()).toEqual({
        sources: 2,
        source_revisions: 2,
        articles: 1,
        article_revisions: 1,
      });
    } finally {
      await db.close();
    }
  });
});
