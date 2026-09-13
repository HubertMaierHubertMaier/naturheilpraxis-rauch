// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { OWNER_TRANSPORT_TABLE } from "../../supabase/functions/_shared/backupOwnerTransport";

const source = readFileSync(resolve(process.cwd(), "supabase/functions/backup-export/index.ts"), "utf8");
const discovery = source.slice(source.indexOf("const REQUIRED_KB_TABLES"), source.indexOf("async function discoverBuckets"));
const js = ts.transpileModule(discovery, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

describe("production backup discovery fallback", () => {
  it("retains owner transport with a successful partial schema and does not invent future tables", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ paths: { "/therapy_sessions": {} } }) }));
    const discover = new Function("Deno", "fetch", "OWNER_TRANSPORT_TABLE", "console", `${js}; return discoverTables;`)(
      { env: { get: () => "synthetic" } }, fetch, OWNER_TRANSPORT_TABLE, { warn: vi.fn() },
    );
    expect(await discover()).toEqual({ source: "openapi", tables: [OWNER_TRANSPORT_TABLE, "therapy_sessions"].sort() });
  });

  it("legacy database ZIP export rejects an auth failure instead of emitting a successful partial archive", async () => {
    const start = source.indexOf("// Auth-Benutzerkonten (kritisch");
    const end = source.indexOf('zip.file("BACKUP-MANIFEST.md"', start);
    expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
    const body = ts.transpileModule(`async function exportAuth() { ${source.slice(start, end)} return null; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const zip = { file: vi.fn() };
    const exportAuth = new Function("fetchAllAuthUsers", "adminClient", "zip", "corsHeaders", `${body}; return exportAuth;`)(
      async () => { throw new Error("synthetic account export error"); }, {}, zip, {},
    );
    const response = await exportAuth();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("auth_export_failed");
    expect(zip.file).not.toHaveBeenCalled();
  });

  it.each(["missing configuration", "HTTP error", "empty schema", "network error"])("includes the owner-only table on %s", async (scenario) => {
    const fetch = vi.fn(async () => {
      if (scenario === "network error") throw new Error("synthetic network failure");
      return { ok: scenario !== "HTTP error", json: async () => ({ paths: {} }) };
    });
    const discover = new Function("Deno", "fetch", "OWNER_TRANSPORT_TABLE", "console", `${js}; return discoverTables;`)(
      { env: { get: () => scenario === "missing configuration" ? undefined : "synthetic" } }, fetch, OWNER_TRANSPORT_TABLE, { warn: vi.fn() },
    );
    const result = await discover();
    expect(result.source).toBe("fallback");
    expect(result.tables.filter((table: string) => table === OWNER_TRANSPORT_TABLE)).toHaveLength(1);
    expect(result.tables).toContain("therapy_anamnesis_versions");
  });
});
