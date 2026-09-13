// @vitest-environment node

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { anamnesisVersionHash } from "@/lib/anamnesisRecovery";

let db: PGlite;
const pid = "P-2099-0101";
const original = { _pseudonym_id: pid, pseudonymId: pid, anamnese: 'Synthetische Quelle Ü – 😀 "Zitat"\n'.repeat(180), anamneseDatum: "2026-09-13" };
let id: string;
const held = { _pseudonym_id: "P-2099-0901", pseudonymId: "P-2099-0902", anamnese: "synthetic ambiguous historical source" };
const sql = (file: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8");
const save = (data: unknown) => db.query<{ id: string }>("select public.upsert_therapy_autosave_draft($1, $2::jsonb) as id", [pid, JSON.stringify(data)]);

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
    create function public.has_role(uuid, text) returns boolean language sql as $$ select coalesce(current_setting('test.admin', true), 'on') = 'on' $$;
    create table public.therapy_sessions (
      id uuid primary key default gen_random_uuid(), pseudonym_id text, created_by uuid,
      eingabe_daten jsonb, empfehlung text, notiz text, kind text,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
  `);
  await db.exec(sql("20260612170738_3ccbf7f3-9e57-4c45-b022-8422d15a2729.sql"));
  id = (await save(original)).rows[0].id;
  await db.query("select upsert_therapy_autosave_draft($1,$2::jsonb)", [held._pseudonym_id, JSON.stringify(held)]);
  await db.exec("grant select on therapy_sessions to authenticated, service_role");
  await db.exec(sql("20260913070000_preserve_anamnesis_draft_versions.sql"));
}, 20000);
afterAll(async () => { await db?.close(); vi.unstubAllGlobals(); });

describe("durable original anamnesis versions", () => {
  it("keeps contradictory historical owners unchanged and exposes an admin review hold", async () => {
    const source = (await db.query<{ eingabe_daten: unknown }>("select eingabe_daten from therapy_sessions where pseudonym_id=$1", [held._pseudonym_id])).rows[0];
    expect(source.eingabe_daten).toEqual(held);
    expect((await db.query("select source_session_id from therapy_anamnesis_review_holds")).rows).toHaveLength(1);
    expect((await db.query("select id from therapy_anamnesis_versions where pseudonym_id=$1", [held._pseudonym_id])).rows).toHaveLength(0);
  });
  it("preserves existing complete text and agrees with the browser SHA-256 receipt", async () => {
    const rows = (await db.query<{ anamnese: string; content_sha256: string }>("select anamnese, content_sha256 from therapy_anamnesis_versions where pseudonym_id = $1", [pid])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].anamnese).toBe(original.anamnese);
    expect(rows[0].anamnese.length).toBeGreaterThan(2500);
    expect(rows[0].content_sha256).toBe(await anamnesisVersionHash(original));
  });
  it("empty, null and missing incoming text cannot erase the existing draft or its date", async () => {
    for (const value of ["", null, undefined]) {
      await save({ ...original, anamnese: value, anamneseDatum: "2020-01-01", laborKomplett: "Neue synthetische Laborquelle" });
      const row = (await db.query<{ eingabe_daten: Record<string, unknown> }>("select eingabe_daten from therapy_sessions where id=$1", [id])).rows[0];
      expect(row.eingabe_daten.anamnese).toBe(original.anamnese);
      expect(row.eingabe_daten.anamneseDatum).toBe(original.anamneseDatum);
      expect(row.eingabe_daten.laborKomplett).toBe("Neue synthetische Laborquelle");
    }
    expect((await db.query("select id from therapy_anamnesis_versions")).rows).toHaveLength(1);
  });
  it("a changed text creates a second version while retries do not duplicate it", async () => {
    const updated = { ...original, anamnese: original.anamnese + "Ergänzung", anamneseDatum: "2026-09-14" };
    await save(updated); await save(updated);
    const rows = (await db.query<{ anamnese: string }>("select anamnese from therapy_anamnesis_versions")).rows;
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.anamnese === original.anamnese)).toBe(true);
    expect(rows.some((row) => row.anamnese === updated.anamnese)).toBe(true);
  });
  it("rejects conflicting patient identity and non-text input", async () => {
    await expect(save({ ...original, pseudonymId: "P-2099-0102" })).rejects.toThrow(/pseudonym/);
    await expect(save({ ...original, anamnese: { text: "wrong type" } })).rejects.toThrow(/must be text/);
    await expect(db.query("update therapy_sessions set pseudonym_id = 'P-2099-0102', eingabe_daten = jsonb_build_object('_pseudonym_id','P-2099-0102') where id=$1", [id])).rejects.toThrow(/cannot move/);
    expect((await db.query("select id from therapy_anamnesis_versions")).rows).toHaveLength(2);
  });
  it("allows admin reading but no anonymous reading or ordinary client overwrite", async () => {
    await db.exec("set role authenticated; set test.admin = 'off'");
    expect((await db.query("select id from therapy_anamnesis_versions")).rows).toHaveLength(0);
    expect((await db.query("select source_session_id from therapy_anamnesis_review_holds")).rows).toHaveLength(0);
    await db.exec("set test.admin = 'on'");
    expect((await db.query("select id from therapy_anamnesis_versions")).rows).toHaveLength(2);
    expect((await db.query("select source_session_id from therapy_anamnesis_review_holds")).rows).toHaveLength(1);
    await expect(db.query("delete from therapy_anamnesis_versions")).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role anon");
    await expect(db.query("select id from therapy_anamnesis_versions")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });
});
