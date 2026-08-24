import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = readSource(
  "supabase/migrations/20260824140000_restrict_infothek_gating_and_importer.sql",
);

describe("database warning hardening", () => {
  it("removes public full-table Infothek gating reads", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Anyone can read gating"');
    expect(migration).toContain("REVOKE SELECT ON public.infothek_gating FROM anon, authenticated");
    expect(migration).toContain("get_infothek_gating_for_routes(_hrefs text[])");
    expect(migration).not.toMatch(/GRANT SELECT[^;]+infothek_gating[^;]+anon/);
  });

  it("removes cross-batch importer reads and writes", () => {
    expect(migration).toContain("staging_table || '_importer_read'");
    expect(migration).toContain(
      "DROP POLICY IF EXISTS kb_import_batches_importer_update ON public.kb_import_batches",
    );
    expect(migration).toMatch(/REVOKE ALL ON TABLE[\s\S]+FROM kb_importer/);
    expect(migration).toContain("REVOKE kb_importer FROM kb_import_runtime");
  });

  it("routes client gating checks through the bounded function", () => {
    const hook = readSource("src/hooks/useInfothekGating.ts");
    const edgeFunction = readSource("supabase/functions/get-infothek-html/index.ts");

    expect(hook).toContain('.rpc("get_infothek_gating_for_routes"');
    expect(hook).not.toContain('.from("infothek_gating")');
    expect(edgeFunction).toContain('"get_infothek_gating_for_routes"');
    expect(edgeFunction).not.toContain('.from("infothek_gating")');
  });
});
