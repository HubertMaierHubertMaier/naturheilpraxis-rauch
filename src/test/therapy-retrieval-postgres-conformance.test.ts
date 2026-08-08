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
const concurrencyProbeSource = readFileSync(
  resolve(
    process.cwd(),
    "scripts/verify-therapy-retrieval-postgres-concurrency.mjs",
  ),
  "utf8",
);
const failureIsolationProbeSource = readFileSync(
  resolve(
    process.cwd(),
    "scripts/verify-therapy-retrieval-postgres-failure-isolation.mjs",
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
    expect(workflowSource).toMatch(/permissions:\r?\n  contents: read/);
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

  it("bounds synthetic concurrent owner persistence without granting use", () => {
    expect(workflowSource).toContain('- "db-step7f-*"');
    expect(workflowSource.match(
      /scripts\/verify-therapy-retrieval-postgres-concurrency\.mjs/g,
    )).toHaveLength(3);
    expect(workflowSource).toContain(
      'run: node scripts/verify-therapy-retrieval-postgres-concurrency.mjs',
    );
    expect(concurrencyProbeSource).toContain("const callerCount = 4");
    expect(workflowSource).toContain(
      "--exclude-table-data=public.therapy_retrieval_audit_runs",
    );
    expect(workflowSource).toContain("--dbname retrieval_concurrency");
    expect(concurrencyProbeSource).toContain(
      'targetUrl.pathname = "/retrieval_concurrency"',
    );
    expect(concurrencyProbeSource).toContain("SET statement_timeout = '30s'");
    expect(concurrencyProbeSource).toContain("SET lock_timeout = '10s'");
    expect(concurrencyProbeSource).toContain("pg_advisory_xact_lock_shared");
    expect(concurrencyProbeSource).toContain("waitForBlockedCallers(inspector)");
    expect(concurrencyProbeSource).toContain("Promise.all(calls)");
    expect(concurrencyProbeSource).toContain("RETRIEVAL_AUDIT_PERSISTED_INACTIVE");
    expect(concurrencyProbeSource).toContain(
      "RETRIEVAL_AUDIT_ALREADY_PERSISTED_INACTIVE",
    );
    expect(concurrencyProbeSource).toContain("count(DISTINCT audit_result_hash)");
    expect(concurrencyProbeSource).toContain("callerCount + 1");
    expect(concurrencyProbeSource).toContain("NOT lock_row.granted");
    expect(concurrencyProbeSource).toContain("append_only_contract_valid, true");
    expect(concurrencyProbeSource).toContain("retention_deletion_allowed, false");
    expect(concurrencyProbeSource).toContain('"activation_allowed",');
    expect(concurrencyProbeSource).toContain(
      "assert.equal(preflight[field], false",
    );
    expect(concurrencyProbeSource).not.toMatch(
      /supabase\.(?:com|co)|service_role_key|ANON_KEY|production|DELETE\s+FROM|DISABLE\s+TRIGGER/i,
    );
  });

  it("proves bounded owner rollback and stale-call isolation without granting use", () => {
    expect(workflowSource).toContain('- "db-step7g-*"');
    expect(workflowSource.match(
      /scripts\/verify-therapy-retrieval-postgres-failure-isolation\.mjs/g,
    )).toHaveLength(3);
    expect(workflowSource).toContain(
      "createdb --template template0 --username postgres retrieval_failure_isolation",
    );
    expect(workflowSource).toContain(
      "--dbname retrieval_failure_isolation /tmp/retrieval-concurrency.dump",
    );
    expect(workflowSource).toContain(
      "Verify bounded synthetic owner failure isolation",
    );
    expect(failureIsolationProbeSource).toContain(
      'targetUrl.pathname = "/retrieval_failure_isolation"',
    );
    expect(failureIsolationProbeSource).toContain("const callerCount = 4");
    expect(failureIsolationProbeSource).toContain("const staleCallerCount = 3");
    expect(failureIsolationProbeSource).toContain('rollbackCaller.query("BEGIN")');
    expect(failureIsolationProbeSource).toContain('rollbackCaller.query("ROLLBACK")');
    expect(failureIsolationProbeSource).toContain("rows[0], { count: 0, invalid: 0 }");
    expect(failureIsolationProbeSource).toContain("pg_advisory_xact_lock_shared");
    expect(failureIsolationProbeSource).toContain("waitForBlockedCallers(inspector)");
    expect(failureIsolationProbeSource).toContain("Promise.allSettled(calls)");
    expect(failureIsolationProbeSource).toContain("rejected.length, staleCallerCount");
    expect(failureIsolationProbeSource).toMatch(/exact ready Step 7A result/);
    expect(failureIsolationProbeSource).toContain("append_only_contract_valid, true");
    expect(failureIsolationProbeSource).toContain("retention_deletion_allowed, false");
    expect(failureIsolationProbeSource).toContain('"shadow_execution_allowed",');
    expect(failureIsolationProbeSource).toContain('"activation_allowed",');
    expect(failureIsolationProbeSource).not.toMatch(
      /supabase\.(?:com|co)|service_role_key|ANON_KEY|production|DELETE\s+FROM|TRUNCATE|DISABLE\s+TRIGGER/i,
    );
  });
});
