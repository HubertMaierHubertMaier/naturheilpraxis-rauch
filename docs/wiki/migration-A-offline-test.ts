// Offline-Test Migration A v3 – PGlite, synthetische Daten, keine Hosted-Verbindung.
// Aufruf: bun docs/wiki/migration-A-offline-test.ts   (bricht bei jedem Fehler mit Exit 1 ab)
// Optional: --learn schreibt den Soll-Fingerabdruck in die SQL-Datei.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "fs";

const ROOT = process.env.REPO ?? "/dev-server";
const CORE = readFileSync(`${ROOT}/supabase/migrations/20260728090000_create_kb_phase1_core.sql`, "utf8");
const SQL_PATH = `${ROOT}/docs/wiki/vernetzung-migration-A.sql`;
let A = readFileSync(SQL_PATH, "utf8");

const log: string[] = [];
let failed = 0;
const pass = (n: string, extra = "") => log.push(`PASS ${n}${extra ? " -> " + extra : ""}`);
const fail = (n: string, why: string) => { failed++; log.push(`FAIL ${n}: ${why}`); };
const eq = (n: string, got: unknown, want: unknown) =>
  JSON.stringify(got) === JSON.stringify(want) ? pass(n, JSON.stringify(got)) : fail(n, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";

async function freshDb() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create type public.app_role as enum('admin','patient');
    create table public.user_roles(user_id uuid, role app_role);
    create function public.has_role(_u uuid,_r app_role) returns boolean language sql stable security definer as $$ select exists(select 1 from public.user_roles where user_id=_u and role=_r) $$;
    create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    grant usage on schema auth, public to authenticated, service_role; grant execute on function auth.uid() to authenticated, service_role;
    insert into public.user_roles values('${ADMIN}','admin');`);
  await db.exec(CORE);
  await db.exec(`insert into kb_entity_types(code,label) values('product','P'),('product_variant','PV'),('pharmacy','A'),('manufacturer','M'),('symptom','S') on conflict do nothing;
    insert into kb_relation_types(code,label) values('manufactured_by','hergestellt von') on conflict do nothing;
    insert into kb_relation_type_domains values('manufactured_by','product','manufacturer','draft') on conflict do nothing;
    update kb_relation_type_domains set review_status='approved' where review_status='draft';`);
  return db;
}
const q1 = async (db: PGlite, sql: string) => ((await db.query(sql)).rows[0] ?? {}) as Record<string, unknown>;
const expectError = async (db: PGlite, n: string, sql: string, re: RegExp) => {
  try { await db.exec(sql); fail(n, "kein Fehler"); }
  catch (e) { const m = (e as Error).message; re.test(m) ? pass(n, m) : fail(n, `falscher Fehler: ${m}`); }
  await db.exec("rollback").catch(() => {});
};
const ok = async (db: PGlite, n: string, sql: string) => {
  try { await db.exec(sql); pass(n); } catch (e) { fail(n, (e as Error).message); await db.exec("rollback").catch(() => {}); }
};
const asAdmin = (sql: string) => `set test.uid='${ADMIN}'; set role authenticated; ${sql}; reset role;`;

// 0. Fingerabdruck lernen (nur mit --learn)
if (process.argv.includes("--learn")) {
  const db = await freshDb();
  try { await db.exec(A); } catch (e) {
    const m = /Fingerabdruck (\w+) statt/.exec((e as Error).message);
    if (!m) throw e;
    A = A.replace(/expected constant text := '[^']*'/, `expected constant text := '${m[1]}'`);
    writeFileSync(SQL_PATH, A);
    console.log("Fingerabdruck gesetzt:", m[1]);
  }
}

const db = await freshDb();
await ok(db, "1 Erstlauf inkl. COMMIT-Constraint-Trigger und Strukturprüfung", A);
await ok(db, "2 Zweitlauf (idempotent)", A);
await ok(db, "3 Drittlauf (idempotent)", A);
eq("3a offered_by-Domänen = 4", Number((await q1(db, `select count(*) c from kb_relation_type_domains where relation_type_code='offered_by'`)).c), 4);
eq("3b offered_by inaktiv", (await q1(db, `select is_active a from kb_relation_types where code='offered_by'`)).a, false);
eq("3c genau 1 Policy je neue Tabelle", (await db.query(`select tablename, count(*)::int c from pg_policies where tablename in ('kb_source_actors','kb_source_actor_withdrawals','kb_assertion_conflicts') group by 1 order by 1`)).rows, [
  { tablename: "kb_assertion_conflicts", c: 1 }, { tablename: "kb_source_actor_withdrawals", c: 1 }, { tablename: "kb_source_actors", c: 1 }]);
eq("3d kb_assertions unverändert (keine polarity-Spalte)", Number((await q1(db, `select count(*) c from information_schema.columns where table_name='kb_assertions' and column_name ilike '%polarity%'`)).c), 0);
await expectError(db, "4 offered_by aktiv ohne approved Domäne", `begin; update kb_relation_types set is_active=true where code='offered_by'; commit;`, /approved domain/);

// Drift mit gleichen Namen -> Rollback, nichts bleibt
const drift: Array<[string, string]> = [
  ["5a Spaltentyp", `alter table kb_source_actors alter column locator type varchar(500)`],
  ["5b Default", `alter table kb_source_actors alter column origin_type set default 'human'`],
  ["5c CHECK gelockert", `alter table kb_source_actors drop constraint kb_source_actors_role_check; alter table kb_source_actors add constraint kb_source_actors_role_check check (role is not null)`],
  ["5d FK entfernt", `alter table kb_source_actors drop constraint kb_source_actors_entity_id_fkey`],
  ["5e Policy gleichnamig offen", `drop policy kb_source_actors_admin_all on kb_source_actors; create policy kb_source_actors_admin_all on kb_source_actors for all to authenticated using (true) with check (true)`],
  ["5f Index verändert", `drop index kb_source_actors_lookup_idx; create index kb_source_actors_lookup_idx on kb_source_actors(entity_id)`],
  ["5g Grant erweitert", `grant update on kb_source_actors to authenticated`],
];
for (const [n, ddl] of drift) {
  const body = A.replace(/^BEGIN;/m, "").replace(/^COMMIT;[\s\S]*$/m, "");
  await expectError(db, `${n} -> Abbruch`, `begin; ${ddl}; ${body} commit;`, /Strukturabweichung/);
}
await ok(db, "5h nach Drift-Rollbacks wieder sauber (Lauf 4)", A);

// Daten
await db.exec(`insert into kb_entities(id,canonical_key,entity_type_code) values('10000000-0000-0000-0000-000000000001','pharmacy:test','pharmacy');
  insert into kb_sources(id,canonical_key) values('20000000-0000-0000-0000-000000000001','src:test');
  insert into kb_source_revisions(id,source_id,revision_no,source_type,title,content_hash) values('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'website','T',repeat('a',64));`);
const SA = "30000000-0000-0000-0000-000000000001";
await ok(db, "6 Admin legt Draft an", asAdmin(`insert into kb_source_actors(source_revision_id,entity_id,role,locator) values('21000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','pharmacy','Impressum Z.3')`));
await db.exec(`update kb_source_actors set id='${SA}'`); // superuser, nur Testfixierung der ID
await expectError(db, "7 approved per UPDATE (authenticated)", asAdmin(`update kb_source_actors set review_status='approved'`), /permission/);
await expectError(db, "8 Restore-GUC als authenticated", asAdmin(`select set_config('kb.source_network_restore','on',false); insert into kb_source_actors(source_revision_id,entity_id,role,locator,review_status) values('21000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','author','x','approved')`), /permission/);
await expectError(db, "9 Review ohne Notiz", asAdmin(`select kb_review_source_actor('${SA}','')`), /Pflicht/);
await ok(db, "10 Review mit Notiz", asAdmin(`select kb_review_source_actor('${SA}','BfArM-Register geprüft')`));
const appr = await q1(db, `select review_notes, reviewed_by::text, reviewed_at from kb_source_actors where id='${SA}'`);
await expectError(db, "11 Geprüfte Fundstelle ändern", asAdmin(`update kb_source_actors set locator='neu'`), /unveraenderlich/);
await expectError(db, "12 Geprüfte Zuordnung löschen", asAdmin(`delete from kb_source_actors`), /nicht loeschbar/);
await expectError(db, "13a Rücknahme ohne Grund", asAdmin(`select kb_withdraw_source_actor('${SA}','')`), /check|reason/i);
await ok(db, "13b Rücknahme als Ereignis", asAdmin(`select kb_withdraw_source_actor('${SA}','Betreiberwechsel lt. Register')`));
eq("13c Genehmigungsnachweis nach Rücknahme unverändert", await q1(db, `select review_notes, reviewed_by::text, reviewed_at from kb_source_actors where id='${SA}'`), appr);
eq("13d Rücknahmeereignis rekonstruierbar", await q1(db, `select reason, withdrawn_by::text by from kb_source_actor_withdrawals where source_actor_id='${SA}'`), { reason: "Betreiberwechsel lt. Register", by: ADMIN });
await expectError(db, "14a zweite Rücknahme", asAdmin(`select kb_withdraw_source_actor('${SA}','nochmal')`), /duplicate|unique/i);
await expectError(db, "14b Rücknahmeereignis löschen (service_role)", `set role service_role; delete from kb_source_actor_withdrawals; reset role;`, /append-only/);
await ok(db, "15 Ersatz mit supersedes_id", asAdmin(`insert into kb_source_actors(source_revision_id,entity_id,role,locator,supersedes_id) values('21000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','pharmacy','Impressum Z.4','${SA}')`));
await ok(db, "15b Ersatz prüfen", asAdmin(`select kb_review_source_actor((select id from kb_source_actors where supersedes_id='${SA}'),'Neu geprüft')`));
eq("15c Historie", (await db.query(`select a.locator, a.review_status, w.reason is not null withdrawn from kb_source_actors a left join kb_source_actor_withdrawals w on w.source_actor_id=a.id order by a.created_at, a.locator`)).rows,
  [{ locator: "Impressum Z.3", review_status: "approved", withdrawn: true }, { locator: "Impressum Z.4", review_status: "approved", withdrawn: false }]);
await expectError(db, "16 Nicht-Admin Review", `set test.uid='${OTHER}'; set role authenticated; select kb_withdraw_source_actor('${SA}','x'); reset role;`, /Nur Admin/);

// Polarität vs. Quellenhaltung
await db.exec(`insert into kb_sources(id,canonical_key) values('20000000-0000-0000-0000-000000000002','src:b');
  insert into kb_source_revisions(id,source_id,revision_no,source_type,title,content_hash) values('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'website','B',repeat('d',64));
  insert into kb_assertions(id,canonical_key,version_no,assertion_kind,claim_text,content_hash,metadata) values
   ('40000000-0000-0000-0000-000000000001','a:pos',1,'entity_relation','X hilft bei Y',repeat('b',64),'{"claim_polarity":"positive"}'),
   ('40000000-0000-0000-0000-000000000002','a:neg',1,'entity_relation','X hilft nicht bei Y',repeat('c',64),'{"claim_polarity":"negative"}');
  insert into kb_assertion_sources(assertion_id,source_revision_id,source_role,locator) values
   ('40000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000001','supports','S.5'),
   ('40000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002','refutes','S.9');`);
eq("17a Fall 1: Quelle belegt negative Aussage = negative Polarität + supports", await q1(db, `select a.metadata->>'claim_polarity' p, s.source_role r from kb_assertions a join kb_assertion_sources s on s.assertion_id=a.id where a.canonical_key='a:neg'`), { p: "negative", r: "supports" });
eq("17b Fall 2: Quelle widerspricht positiver Aussage = positive Polarität + refutes", await q1(db, `select a.metadata->>'claim_polarity' p, s.source_role r from kb_assertions a join kb_assertion_sources s on s.assertion_id=a.id where a.canonical_key='a:pos'`), { p: "positive", r: "refutes" });
await ok(db, "18 Widerspruch verknüpfen, beide Aussagen bleiben", asAdmin(`insert into kb_assertion_conflicts(assertion_a_id,assertion_b_id,conflict_kind) values('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','contradicts')`));
await expectError(db, "19 Konflikt löschen (auch service_role)", `set role service_role; delete from kb_assertion_conflicts; reset role;`, /append-only/);
await expectError(db, "20 Spiegeldublette", asAdmin(`insert into kb_assertion_conflicts(assertion_a_id,assertion_b_id,conflict_kind) values('40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','contradicts')`), /duplicate/);

// Backup: isolierter Export + kontrollierter Restore in frische DB
await expectError(db, "21 Export als authenticated verboten", asAdmin(`select kb_export_source_network()`), /permission/);
const dump = (await q1(db, `set role service_role; select kb_export_source_network() d`)).d as Record<string, unknown[]>;
await db.exec("reset role");
const db2 = await freshDb();
await db2.exec(A);
await db2.exec(`insert into kb_entities(id,canonical_key,entity_type_code) values('10000000-0000-0000-0000-000000000001','pharmacy:test','pharmacy');
  insert into kb_sources(id,canonical_key) values('20000000-0000-0000-0000-000000000001','src:test'),('20000000-0000-0000-0000-000000000002','src:b');
  insert into kb_source_revisions(id,source_id,revision_no,source_type,title,content_hash) values('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'website','T',repeat('a',64)),('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'website','B',repeat('d',64));
  insert into kb_assertions(id,canonical_key,version_no,assertion_kind,claim_text,content_hash) values('40000000-0000-0000-0000-000000000001','a:pos',1,'entity_relation','p',repeat('b',64)),('40000000-0000-0000-0000-000000000002','a:neg',1,'entity_relation','n',repeat('c',64));`);
// Reihenfolge absichtlich umdrehen: Kind vor Eltern im Dump
const reversed = { ...dump, kb_source_actors: [...(dump.kb_source_actors as unknown[])].reverse() };
await expectError(db2, "22 Restore als authenticated verboten", asAdmin(`select kb_restore_source_network('${JSON.stringify(reversed).replace(/'/g, "''")}'::jsonb)`), /permission/);
const res = await q1(db2, `set role service_role; select kb_restore_source_network('${JSON.stringify(reversed).replace(/'/g, "''")}'::jsonb) r`);
await db2.exec("reset role");
eq("23 Restore-Zähler (supersedes umgekehrt geliefert)", res.r, { kb_source_actors: 2, kb_source_actor_withdrawals: 1, kb_assertion_conflicts: 1 });
const dump2 = (await q1(db2, `set role service_role; select kb_export_source_network() d`)).d;
await db2.exec("reset role");
eq("24 Export nach Restore identisch (inkl. Prüfer/Zeit/Rücknahme)", dump2, dump);
await expectError(db2, "25 Restore in nicht leere Tabellen", `set role service_role; select kb_restore_source_network('${JSON.stringify(dump).replace(/'/g, "''")}'::jsonb); reset role;`, /leere/);
await expectError(db2, "26 Nach Restore wieder geschützt", asAdmin(`update kb_source_actors set locator='x'`), /unveraenderlich/);

console.log(log.join("\n"));
console.log(`\n${log.length - failed} PASS / ${failed} FAIL`);
process.exit(failed ? 1 : 0);
