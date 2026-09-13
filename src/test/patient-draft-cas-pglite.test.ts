// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
let legacyWorkedDuringExpansion = false;
const pid = "P-2099-0201";
const input = (text: string) => ({ _pseudonym_id: pid, pseudonymId: pid, anamnese: text, laborKomplett: text });
const sql = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replace(/\r\n/g, "\n");
const save = async (data: unknown, revision: string | null, patient = pid) =>
  (await db.query<{ receipt: { id: string; revision: string; eingabe_daten: Record<string, unknown> } }>(
    "select public.upsert_therapy_autosave_draft_checked($1, $2::jsonb, $3::uuid) as receipt",
    [patient, JSON.stringify(data), revision])).rows[0].receipt;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
    create function public.has_role(uuid, text) returns boolean language sql as $$ select coalesce(current_setting('test.admin', true), 'on') = 'on' $$;
    create table public.therapy_sessions (id uuid primary key default gen_random_uuid(), pseudonym_id text,
      created_by uuid, eingabe_daten jsonb, empfehlung text, notiz text, kind text,
      created_at timestamptz default now(), updated_at timestamptz default now());`);
  await db.exec(sql("20260612170738_3ccbf7f3-9e57-4c45-b022-8422d15a2729.sql"));
  await db.exec(sql("20260913070000_preserve_anamnesis_draft_versions.sql"));
  await db.exec(sql("20260913080000_patient_draft_compare_and_swap.sql"));
  await db.exec("begin");
  try {
    const trial = "P-2099-0299";
    const result = await db.query<{ id: string }>("select upsert_therapy_autosave_draft($1,$2::jsonb) as id",
      [trial, JSON.stringify({ _pseudonym_id: trial, pseudonymId: trial, anamnese: "synthetic expansion compatibility" })]);
    legacyWorkedDuringExpansion = typeof result.rows[0]?.id === "string";
  } finally { await db.exec("rollback"); }
  await db.exec("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, statements text[])");
  await db.query("insert into supabase_migrations.schema_migrations values ($1, ARRAY[$2]::text[])",
    ["20260913080000", sql("20260913080000_patient_draft_compare_and_swap.sql")]);
  await db.exec(sql("20260913100000_patient_conflicts_without_transaction_retry.sql"));
  await db.exec(readFileSync(resolve(process.cwd(), "supabase/manual-migrations/20260913110000_require_patient_draft_revisions.sql"), "utf8"));
}, 20000);
afterAll(async () => { await db?.close(); });

describe("database-enforced patient draft revisions (serial regression, not a multi-connection race test)", () => {
  it("keeps the legacy-client cutover outside automatic deployment migrations", () => {
    expect(existsSync(resolve(process.cwd(), "supabase/migrations/20260913110000_require_patient_draft_revisions.sql"))).toBe(false);
  });
  it("keeps the old client working during expansion before the separate cutover", () => {
    expect(legacyWorkedDuringExpansion).toBe(true);
  });
  it("rejects stale updates and a later first-save attempt without overwriting", async () => {
    const first = await save(input("synthetic original"), null);
    const second = await save(input("synthetic newer"), first.revision);
    expect(second.id).toBe(first.id); expect(second.revision).not.toBe(first.revision);
    await expect(save(input("stale window"), first.revision)).rejects.toThrow(/PATIENT_DRAFT_CONFLICT/);
    await expect(save(input("second new window"), null)).rejects.toThrow(/PATIENT_DRAFT_CONFLICT/);
    await expect(save(input("business conflict without retry"), null)).rejects.toMatchObject({ code: "PT409" });
    const rows = (await db.query<{ eingabe_daten: unknown }>("select eingabe_daten from therapy_sessions")).rows;
    expect(rows).toHaveLength(1); expect(rows[0].eingabe_daten).toEqual(input("synthetic newer"));
    expect((await db.query("select id from therapy_anamnesis_versions")).rows).toHaveLength(2);
  });
  it("rejects legacy unversioned saves", async () => {
    await expect(db.query("select upsert_therapy_autosave_draft($1,$2::jsonb)", [pid, JSON.stringify(input("old browser"))]))
      .rejects.toThrow(/REVISION_REQUIRED/);
  });
  it("keeps the anamnesis preservation trigger and returns the actual stored contents", async () => {
    const row = (await db.query<{ draft_revision: string }>("select draft_revision from therapy_sessions")).rows[0];
    const receipt = await save(input(""), row.draft_revision);
    expect(receipt.eingabe_daten.anamnese).toBe("synthetic newer");
    expect(receipt.eingabe_daten.laborKomplett).toBe("");
  });
  it("enforces both owners, complete standard IDs and admin access", async () => {
    await expect(save({ ...input("bad owner"), pseudonymId: "P-2099-0202" }, null)).rejects.toThrow(/mismatch/);
    await expect(save({ _pseudonym_id: pid }, null)).rejects.toThrow(/both input owners/);
    await expect(save(input("invalid"), null, "P-2099-02011")).rejects.toThrow(/incomplete/);
    await db.exec("set test.admin = 'off'");
    try { await expect(save(input("not admin"), null)).rejects.toThrow(/Forbidden/); }
    finally { await db.exec("set test.admin = 'on'"); }
  });
  it("normalizes standard spelling without creating a second patient", async () => {
    const row = (await db.query<{ draft_revision: string }>("select draft_revision from therapy_sessions")).rows[0];
    const receipt = await save({ ...input("canonical"), _pseudonym_id: pid.toLowerCase(), pseudonymId: pid.toLowerCase() }, row.draft_revision, pid.toLowerCase());
    expect(receipt.eingabe_daten._pseudonym_id).toBe(pid);
    expect((await db.query("select id from therapy_sessions")).rows).toHaveLength(1);
  });
  it("preserves server-held inventory evidence and fields omitted by an older client", async () => {
    const row = (await db.query<{ draft_revision: string }>("select draft_revision from therapy_sessions")).rows[0];
    const inventory = [{ archivePath: "synthetic-historical-reference" }];
    const first = await save({ ...input("metadata baseline"), document_inventory: inventory, futureField: "synthetic retained value" }, row.draft_revision);
    const next = await save(input("new explicit text"), first.revision);
    expect(next.eingabe_daten.document_inventory).toEqual(inventory);
    expect(next.eingabe_daten.futureField).toBe("synthetic retained value");
    expect(next.eingabe_daten.anamnese).toBe("new explicit text");
  });
});
