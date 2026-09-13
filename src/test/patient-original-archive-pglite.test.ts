// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
const digest = "a".repeat(64);
const prepare = async (pid = "P-2099-0701", hash = digest, size = 42, date: string | null = "2099-01-01") =>
  (await db.query<{ receipt: any }>("select prepare_therapy_document_archive($1,$2,$3,'anamnese','pdf',$4::date) as receipt", [pid, hash, size, date])).rows[0].receipt;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create schema storage;
    create role anon; create role authenticated;
    grant usage on schema storage, auth to anon, authenticated;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
    create function public.has_role(uuid, text) returns boolean language sql as $$ select coalesce(current_setting('test.admin', true), 'on') = 'on' $$;
    create table storage.buckets(id text primary key, public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
    create policy legacy_broad_access on storage.objects for all to public using (true) with check (true);
    insert into storage.buckets(id) values ('therapy-documents'), ('other-bucket');`);
  await db.exec(readFileSync(resolve(process.cwd(), "supabase/migrations/20260913090000_private_patient_original_archive.sql"), "utf8"));
}, 20000);
afterAll(async () => { await db?.close(); });

describe("private patient original archive policy", () => {
  it("prepares a canonical, filename-free destination only for an admin", async () => {
    await db.exec("set role authenticated; set test.admin = 'on'");
    const receipt = await prepare("p-2099-0701");
    expect(receipt.path).toBe(`P-2099-0701/2099-01-01/anamnese-${digest}.pdf`);
    expect(receipt.bucket).toBe("therapy-documents"); expect(receipt.exists).toBe(false);
    await db.exec("reset role");
  });
  it("blocks non-admin reading and writing despite a broad legacy permissive policy", async () => {
    await db.exec("insert into storage.objects(bucket_id,name) values ('therapy-documents','synthetic-existing.pdf'),('other-bucket','unchanged.txt'); set role authenticated; set test.admin = 'off'");
    expect((await db.query("select id from storage.objects where bucket_id='therapy-documents'")).rows).toHaveLength(0);
    expect((await db.query("select id from storage.objects where bucket_id='other-bucket'")).rows).toHaveLength(1);
    await expect(db.query("insert into storage.objects(bucket_id,name) values ('therapy-documents','denied.pdf')")).rejects.toThrow(/row-level security/);
    await expect(prepare()).rejects.toThrow(/Forbidden/);
    await db.exec("set test.admin = 'on'");
    expect((await db.query("select id from storage.objects where bucket_id='therapy-documents'")).rows).toHaveLength(1);
    await db.exec("reset role");
  });
  it("rejects incomplete identifiers, path separators, bad hashes and invalid sizes", async () => {
    for (const pid of ["P-2099-07011", "ABC/DEF", "ABC\\DEF", "ABC\nDEF"]) await expect(prepare(pid)).rejects.toThrow(/identifier/);
    await expect(prepare(undefined, "invalid")).rejects.toThrow(/digest or size/);
    await expect(prepare(undefined, undefined, 0)).rejects.toThrow(/digest or size/);
    await expect(prepare(undefined, undefined, 52428801)).rejects.toThrow(/digest or size/);
    expect((await prepare(undefined, undefined, undefined, null)).path).toContain("/undatiert/");
  });
  it("refuses an archive that is public instead of silently uploading", async () => {
    await db.exec("update storage.buckets set public=true where id='therapy-documents'");
    try { await expect(prepare()).rejects.toThrow(/not confirmed private/); }
    finally { await db.exec("update storage.buckets set public=false where id='therapy-documents'"); }
  });
  it("does not grant anonymous preparation or access to originals", async () => {
    await db.exec("set role anon; set test.admin = 'off'");
    await expect(prepare()).rejects.toThrow(/permission denied/);
    expect((await db.query("select id from storage.objects where bucket_id='therapy-documents'")).rows).toHaveLength(0);
    await db.exec("reset role; set test.admin = 'on'");
  });
  it("does not let an authenticated admin overwrite or move an existing original", async () => {
    await db.exec("set role authenticated; set test.admin = 'on'");
    expect((await db.query("update storage.objects set name='overwritten.pdf' where bucket_id='therapy-documents' returning id")).rows).toHaveLength(0);
    expect((await db.query("select name from storage.objects where bucket_id='therapy-documents'")).rows).toEqual([{ name: "synthetic-existing.pdf" }]);
    await expect(db.query("update storage.objects set bucket_id='therapy-documents' where bucket_id='other-bucket'")).rejects.toThrow(/row-level security/);
    await db.exec("reset role");
  });
});
