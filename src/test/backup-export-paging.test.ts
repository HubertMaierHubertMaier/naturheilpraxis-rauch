import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "supabase/functions/backup-export/index.ts"), "utf8");
const storageListing = source.slice(source.indexOf("async function listAllFiles"), source.indexOf("function buildManifest"));

describe("backup-export bounded paging", () => {
  it("provides admin-protected table and auth page modes", () => {
    const adminCheck = source.indexOf("if (!isAdmin)");
    const tablePage = source.indexOf('mode === "table-page"');
    const authPage = source.indexOf('mode === "auth-page"');
    expect(adminCheck).toBeGreaterThan(-1);
    expect(tablePage).toBeGreaterThan(adminCheck);
    expect(authPage).toBeGreaterThan(adminCheck);
  });

  it("bounds table names and page sizes", () => {
    expect(source).toContain("/^[A-Za-z0-9_]+$/.test(table)");
    expect(source).toContain("TABLE_BLOCKLIST.has(table)");
    expect(source).toContain("limit > 1000");
    expect(source).toContain("perPage > 1000");
  });

  it("uses the discovered live schema without injecting undeployed tables", () => {
    expect(source).toContain('return { tables: [...new Set(filtered)].sort(), source: "openapi" };');
  });

  it("fails the storage listing if any signed URL is missing", () => {
    expect(source).toContain("entries.length !== files.length");
    expect(source).toContain('error: "storage_list_failed"');
  });

  it("reports missing storage objects with salted path digests instead of raw paths", () => {
    expect(source).toContain("async function hashStoragePath");
    expect(source).toContain('crypto.subtle.digest("SHA-256"');
    expect(source).toContain("pathDigest: await hashStoragePath");
    expect(source).toContain("const diagnostic = { salt: auditSalt, missing }");
    expect(source).toContain("storageErrors.push({ bucket, message, diagnostic })");
    expect(source).not.toContain("missing.push({ path:");
  });

  it("uses flat cursor-paginated listV2 paths without case-changing reconstruction", () => {
    expect(storageListing).toContain(".listV2({");
    expect(storageListing).toContain("with_delimiter: false");
    expect(storageListing).toContain("...(cursor ? { cursor } : {})");
    expect(storageListing).toContain("if (!data.hasNext) break");
    expect(storageListing).toContain("const nextCursor = data.nextCursor");
    expect(storageListing).toContain("out.push({ path: item.name, size })");
    expect(storageListing).not.toContain(".list(prefix");
    expect(source).not.toContain("storageListPath");
  });

  it("fails closed on invalid pages, metadata, or duplicate exact paths", () => {
    expect(storageListing).toContain("!Number.isSafeInteger(size) || size < 0");
    expect(storageListing).toContain("seenPaths.has(item.name)");
    expect(storageListing).toContain("seenCursors.has(nextCursor)");
    expect(storageListing).toContain("Storage-Paginierung fuer Bucket");
  });
});
