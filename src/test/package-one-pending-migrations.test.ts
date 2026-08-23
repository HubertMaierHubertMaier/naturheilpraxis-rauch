import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("pending package-one migrations", () => {
  it("limits the Vieva migration to the two existing function signatures", () => {
    const sql = migration("20260728120000_add_vieva_plus_patient_input.sql");

    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(2);
    expect(sql).toContain("public.extract_patient_snapshot_fields(_input jsonb)");
    expect(sql).toContain("public.compact_therapy_session_input(_input jsonb, _max_chars integer DEFAULT 1200)");
    expect(sql.match(/'vievaPlus'/g)).toHaveLength(4);
    expect(sql.match(/'vievaPlusDatum'/g)).toHaveLength(4);
    expect(sql.match(/'metatronDatum'/g)).toHaveLength(4);
    expect(sql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|ALTER|DROP|GRANT|REVOKE)\b/im);
  });

  it("keeps the SIBO migration additive, internal, transaction-bound, and unambiguous", () => {
    const sql = migration("20260810170000_import_sibo_gasprofile_sources.sql");
    const executableSql = sql
      .replace(/\$article\$[\s\S]*?\$article\$/g, "$article$...$article$")
      .replace(/--.*$/gm, "");

    expect(sql.trimStart()).toMatch(/^BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain("'source:sibo-pdf-2026-08-10'");
    expect(sql).toContain("'source:dr-kirkamm-sibo-public-material'");
    expect(sql).toContain("'reference:sibo-gasprofile-drei-formen-pdf-kirkamm'");
    expect(sql.match(/'admin_only', true/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/'patient_facing_allowed', false/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("'review_status', 'unreviewed'");
    expect(sql).toMatch(/content_markdown,\s+review_status/);
    expect(sql).toContain("v_article_id uuid;");
    expect(sql).toContain("RETURNING id INTO v_article_id;");
    expect(sql).toContain("existing_revision.article_id = v_article_id");
    expect(sql).not.toMatch(/^\s*article_id uuid;/m);
    expect(executableSql).not.toMatch(/\b(?:DELETE|ALTER|DROP|GRANT|REVOKE)\b/i);
    expect(executableSql).not.toContain("admin_knowledge_base");
    expect(executableSql).not.toContain("therapy_sessions");
  });
});
