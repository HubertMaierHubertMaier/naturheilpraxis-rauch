# Migration A v2 – Offline-Testprotokoll (07.10.2026)

Umgebung: PGlite (Postgres 17, WASM), leer, keine Hosted-Verbindung. Geladen: Stubs (auth.uid, app_role, has_role, Rollen anon/authenticated/service_role, update_updated_at_column) + **original** `20260728090000_create_kb_phase1_core.sql` inkl. aller Trigger + Entwurf `vernetzung-migration-A.sql` (3×). Skript: `docs/wiki/migration-A-offline-test.ts` (`bun` mit `@electric-sql/pglite`).

Ergebnis: **24 PASS / 0 FAIL**.

| # | Prüfung | Ergebnis |
|---|---|---|
| 1–3 | Erst-, Zweit-, Drittlauf inkl. COMMIT (deferred Constraint-Trigger) | PASS; nach 3 Läufen 4 offered_by-Domänen, offered_by inaktiv, 1 Policy |
| 4 | Alter Fehler reproduziert: offered_by aktiv ohne approved Domäne | abgelehnt („requires at least one approved domain") |
| 5 | Strukturprüfung bei abweichender Tabelle | Abbruch mit Spaltenliste |
| 6 | Fehler mitten in Transaktion | vollständiger Rollback, kein Teilinsert |
| 7a–c | Admin: Draft anlegen ok; approved per UPDATE/INSERT | permission denied (Spaltengrants) |
| 8 | Bypass: `set_config('kb.source_actor_review','on')` + Statuswrite | permission denied |
| 9–10 | Review ohne Notiz abgelehnt, mit Notiz ok | PASS |
| 11–12 | Geprüfte Fundstelle ändern / löschen | abgelehnt |
| 13–15 | Rücknahme → withdrawn, danach unveränderlich, Ersatz mit supersedes_id | Historie: withdrawn → draft |
| 16 | Nicht-Admin ruft Review | „Nur Admin" |
| 17 | kb_assertions ohne neue Spalte (kein Pauschal-„affirms") | PASS |
| 18–21 | Gegenaussage mit source_role refutes; Konflikt verknüpft, nicht löschbar, Spiegeldublette abgelehnt | PASS |

## Hosted-Abgleich (read-only, 07.10.2026)
- Vorhanden & aktiv: Typen product, product_variant, pharmacy, manufacturer, publisher …; person/organization fehlen. Relationstyp manufactured_by aktiv, approved u.a. product→manufacturer. offered_by fehlt.
- CHECK-Werte name_kind, article role, source_role, origin_type, batch_status entsprechen den Originaldateien (Migrationsdateien gelesen; Hosted-Constraint-Abfrage wurde in der Ausgabe abgeschnitten – **Constraint-Texte hosted nicht vollständig verglichen, offen**).

## Offen / nicht prüfbar
- Hosted-Rechte und Policy-Namen nicht gegen PGlite verifizierbar (Stub-Rollen).
- Import-Staging-Migration nicht mitgeladen; Rücknahmebatch-Ablauf nur gegen Statusregeln (Z. 353–361) dokumentiert, nicht ausgeführt.
- Backup-Patch nur vorbereitet; synthetischer Export/Restore fehlt.
- Der GUC-Schalter ist nur Zusatzschutz; maßgeblich sind die Spaltengrants (kein UPDATE auf review_status für authenticated).
