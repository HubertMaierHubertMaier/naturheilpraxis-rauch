// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readOwnerTransportPage } from "../../supabase/functions/_shared/backupOwnerTransport";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public._kb_owner_import_3f7a22a0_chunks (import_key text, seq integer, data text);
    alter table public._kb_owner_import_3f7a22a0_chunks enable row level security;
    insert into public._kb_owner_import_3f7a22a0_chunks values ('synthetic',2,'second'),('synthetic',1,'first');
    revoke all on public._kb_owner_import_3f7a22a0_chunks from public, anon, authenticated, service_role;
  `);
  await db.exec(readFileSync(resolve(process.cwd(), 'supabase/migrations/20260913065900_backup_owner_transport_page.sql'), 'utf8'));
}, 20000);
afterAll(async () => { await db?.close(); });

describe('purpose-limited owner transport backup', () => {
  it('allows server backup pages without granting direct table reading', async () => {
    expect((await db.query<{ allowed: boolean }>("select has_table_privilege('service_role','public._kb_owner_import_3f7a22a0_chunks','SELECT') as allowed")).rows[0].allowed).toBe(false);
    await db.exec('set role service_role');
    const count = (await db.query<{ value: { total: number; rows: unknown[] } }>('select public.backup_owner_transport_page(0,0) as value')).rows[0].value;
    expect(count).toEqual({ total: 2, rows: [] });
    const page = (await db.query<{ value: { total: number; rows: { seq: number; data: string }[] } }>('select public.backup_owner_transport_page(1,1) as value')).rows[0].value;
    expect(page.total).toBe(2); expect(page.rows).toHaveLength(1); expect(page.rows[0].seq).toBe(2);
    await expect(db.query('select * from public._kb_owner_import_3f7a22a0_chunks')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('denies anonymous and ordinary authenticated RPC access', async () => {
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query('select public.backup_owner_transport_page(0,1)')).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
  });
  it('rejects invalid pagination without modifying data', async () => {
    await expect(db.query('select public.backup_owner_transport_page(-1,1)')).rejects.toThrow(/pagination/);
    await expect(db.query('select public.backup_owner_transport_page(0,1001)')).rejects.toThrow(/pagination/);
    expect((await db.query('select * from public._kb_owner_import_3f7a22a0_chunks')).rows).toHaveLength(2);
  });
  it('does not turn RPC errors or malformed responses into a successful empty table', async () => {
    const denied = await readOwnerTransportPage({ rpc: async () => ({ data: null, error: { message: 'denied' } }) }, 0, 1);
    expect(denied.error?.message).toBe('denied');
    const invalid = await readOwnerTransportPage({ rpc: async () => ({ data: { total: 2, rows: [null] }, error: null }) }, 0, 1);
    expect(invalid.error).not.toBeNull();
  });
});
