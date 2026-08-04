// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const retrievalTestSource = readFileSync(
  resolve(process.cwd(), "src/test/therapy-retrieval-v2-preflight.test.ts"),
  "utf8",
);
const workflowSource = readFileSync(
  resolve(
    process.cwd(),
    ".github/workflows/therapy-retrieval-postgres-conformance.yml",
  ),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { devDependencies?: Record<string, string> };

describe("therapy retrieval PostgreSQL conformance harness", () => {
  it("keeps PGlite as the local default and selects PostgreSQL only by explicit URL", () => {
    expect(retrievalTestSource).toContain(
      "process.env.THERAPY_RETRIEVAL_TEST_DATABASE_URL",
    );
    expect(retrievalTestSource).toContain('await import("pg")');
    expect(retrievalTestSource).toContain("const client = new PGlite()");
    expect(retrievalTestSource).not.toMatch(
      /postgresql:\/\/[^\s"']+@[^\s"']+/,
    );
    expect(packageJson.devDependencies?.pg).toBeTruthy();
    expect(packageJson.devDependencies?.["@types/pg"]).toBeTruthy();
  });

  it("runs all six bounded contract groups against isolated PostgreSQL 17", () => {
    const testNames = [...retrievalTestSource.matchAll(/^\s+it\("([^"]+)"/gm)]
      .map((match) => match[1]);
    const patterns = [...workflowSource.matchAll(/^\s+pattern: "([^"]+)"$/gm)]
      .map((match) => new RegExp(match[1]));

    expect(workflowSource).toContain("image: postgres:17");
    expect(workflowSource).toContain("node-version: 20");
    expect(workflowSource).toContain("THERAPY_RETRIEVAL_TEST_DATABASE_URL:");
    expect(workflowSource.match(/name: group-[1-6]-/g)).toHaveLength(6);
    expect(testNames).toHaveLength(56);
    expect(patterns).toHaveLength(6);
    expect(testNames.map((name) => patterns.filter((pattern) => pattern.test(name)).length))
      .toEqual(Array.from({ length: 56 }, () => 1));
    expect(workflowSource).toContain("max-parallel: 3");
    expect(workflowSource).toContain("timeout-minutes: 15");
    expect(workflowSource).toContain(
      "npx vitest run src/test/therapy-retrieval-v2-preflight.test.ts",
    );
    expect(workflowSource).toContain('-t "${{ matrix.pattern }}"');
  });

  it("uses only locked test dependencies and contains no deployment path", () => {
    expect(workflowSource).toContain("permissions:\n  contents: read");
    expect(workflowSource).toContain("run: npm ci");
    expect(workflowSource).not.toMatch(
      /supabase\s+(?:db\s+push|functions\s+deploy)|npm\s+run\s+deploy|production/i,
    );
    expect(workflowSource).not.toContain("secrets.");
  });

  it("rehearses a bounded synthetic dump and restore without retaining an artifact", () => {
    expect(workflowSource).toContain('- "db-step7e-*"');
    expect(workflowSource).toContain(
      "if: matrix.name == 'group-5-audit-persistence'",
    );
    expect(workflowSource).toContain("pg_dump --format custom");
    expect(workflowSource).toContain(
      "pg_restore --exit-on-error --single-transaction",
    );
    expect(workflowSource).toContain(
      "createdb --template template0 --username postgres retrieval_restore",
    );
    expect(workflowSource).toContain("test \"$dump_bytes\" -le 67108864");
    expect(workflowSource).toContain("public.kb_export_wiki_snapshot()::text");
    expect(workflowSource).toContain("public.therapy_input_export_snapshot_v2()");
    expect(workflowSource).toContain("public.therapy_input_export_snapshot_v3()");
    expect(workflowSource).toContain(
      "public.therapy_retrieval_v2_audit_retention_restore_preflight_v1",
    );
    expect(workflowSource).toContain(
      'test "$target_contract" = "$source_contract"',
    );
    expect(workflowSource).not.toMatch(/upload-artifact|DROP DATABASE/i);
  });
});
