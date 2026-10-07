# Migration A v3 – Offline-Testprotokoll (07.10.2026, nach Astra d45b236c)

Umgebung: PGlite (Postgres 17, WASM), leer, ohne Verbindung zum Live-System. Geladen: Stubs (auth.uid, app_role, has_role, Rollen anon/authenticated/service_role mit BYPASSRLS wie Supabase) + **originale** `20260728090000_create_kb_phase1_core.sql` + Entwurf `vernetzung-migration-A.sql`.
Aufruf: `bun docs/wiki/migration-A-offline-test.ts` – **Exit 1 bei jedem FAIL** (vorher gegengeprüft: Lauf mit 16 FAIL endete mit Exit 1). `--learn` setzt den Soll-Fingerabdruck neu.

Ergebnis: **45 PASS / 0 FAIL, Exit 0.** Fingerabdruck `b770c165e2a16e5a295c37e470e7b477`.

## Korrekturen v3
1. **Prüfnachweis unveränderlich:** review_status nur draft|approved; approved ist komplett gesperrt. Rücknahme ist ein eigenes, append-only Ereignis (`kb_source_actor_withdrawals`: Grund, Person, Zeit, höchstens eins pro Zuordnung). Test 13c: Notiz, Prüfer und Zeit sind nach der Rücknahme identisch; 13d: das Ereignis ist rekonstruierbar.
2. **Polarität ≠ Quellenhaltung:** `metadata.claim_polarity` an der Aussage, source_role an der Quelle. Test 17a: negative Aussage + supports; 17b: positive Aussage + refutes.
3. **Strukturprüfung:** Am Ende der Transaktion wird ein Fingerabdruck über Spalten (Typ/NULL/Default), Constraints (pg_get_constraintdef inkl. FK/CHECK), Indizes, Policies (cmd/roles/qual/with_check), Trigger, Tabellen- und Spaltenrechte (normalisiert), RLS sowie Typ-/Relationstyp-Status gebildet. Bei Abweichung bricht die ganze Migration ab. Drift-Tests 5a–5f mit gleichen Namen und falschem Typ, Default, CHECK, FK, Policy bzw. Index: jeweils Abbruch und Rollback. Danach läuft die Migration wieder sauber (5h). Zusätzliche Rechte werden von der Migration selbst zurückgesetzt (5g).
4. **Backup:** isolierter Export/Restore über Funktionen nur für service_role. Restore nur in leere Tabellen, supersedes-Ketten auch bei umgekehrter Lieferung korrekt (23), Export nach Restore identisch inkl. Prüfer/Zeit/Rücknahme (24). Kein Bypass für authenticated (8, 21, 22), Schutz nach Restore aktiv (26). Inventar-Patch vervollständigt (`backup-kb_source_actors.patch`).
5. **Testskript:** harte Assertions (Domänen = 4, je Tabelle genau 1 Policy, Historie, Genehmigungsnotiz), Exit 1 bei Fehler.

## Einzelergebnisse
- PASS 1 Erstlauf inkl. COMMIT-Constraint-Trigger und Strukturprüfung
- PASS 2 Zweitlauf (idempotent)
- PASS 3 Drittlauf (idempotent)
- PASS 3a offered_by-Domänen = 4
- PASS 3b offered_by inaktiv
- PASS 3c genau 1 Policy je neue Tabelle
- PASS 3d kb_assertions unverändert (keine polarity-Spalte)
- PASS 4 offered_by aktiv ohne approved Domäne
- PASS 5a Spaltentyp
- PASS 5b Default
- PASS 5c CHECK gelockert
- PASS 5d FK entfernt
- PASS 5e Policy gleichnamig offen
- PASS 5f Index verändert
- PASS 5g Grant-Erweiterung wird durch REVOKE/GRANT der Migration zurückgesetzt
- PASS 5g2 authenticated darf review_status danach nicht ändern
- PASS 5h nach Drift-Rollbacks wieder sauber (Lauf 4)
- PASS 6 Admin legt Draft an
- PASS 7 approved per UPDATE (authenticated)
- PASS 8 Restore-GUC als authenticated
- PASS 9 Review ohne Notiz
- PASS 10 Review mit Notiz
- PASS 11 Geprüfte Fundstelle ändern
- PASS 12 Geprüfte Zuordnung löschen
- PASS 13a Rücknahme ohne Grund
- PASS 13b Rücknahme als Ereignis
- PASS 13c Genehmigungsnachweis nach Rücknahme unverändert
- PASS 13d Rücknahmeereignis rekonstruierbar
- PASS 14a zweite Rücknahme
- PASS 14b Rücknahmeereignis löschen (service_role)
- PASS 15 Ersatz mit supersedes_id
- PASS 15b Ersatz prüfen
- PASS 15c Historie
- PASS 16 Nicht-Admin Review
- PASS 17a Fall 1: Quelle belegt negative Aussage = negative Polarität + supports
- PASS 17b Fall 2: Quelle widerspricht positiver Aussage = positive Polarität + refutes
- PASS 18 Widerspruch verknüpfen, beide Aussagen bleiben
- PASS 19 Konflikt löschen (auch service_role)
- PASS 20 Spiegeldublette
- PASS 21 Export als authenticated verboten
- PASS 22 Restore als authenticated verboten
- PASS 23 Restore-Zähler (supersedes umgekehrt geliefert)
- PASS 24 Export nach Restore identisch (inkl. Prüfer/Zeit/Rücknahme)
- PASS 25 Restore in nicht leere Tabellen
- PASS 26 Nach Restore wieder geschützt

## Offene Grenzen zum Live-System (nicht prüfbar ohne Anwendung)
- Der **Fingerabdruck stammt aus PGlite/PG 17.** Die Ausgabe von pg_get_*def und die Rollen bzw. Grantors im Live-System können abweichen. Dann bricht die Migration live ab, es bleibt nichts zurück. Vor einer Anwendung den Soll-Wert in einer isolierten Kopie bestimmen (z. B. Draft-Stack) und von Codex gegenprüfen lassen.
- Rechte, Policy-Namen und das Supabase-Rollenverhalten (BYPASSRLS, Grantor `postgres` vs. `supabase_admin`) sind nur nachgebildet.
- Die Regeln im Live-System wurden nur stichprobenhaft gelesen (Typen/Domänen); die vollständigen Regeltexte sind nicht verglichen.
- Den Backup-Patch habe ich nicht gegen die echte Edge-Function ausgeführt; die Variablennamen in den Hunks sind vor einer Anwendung abzugleichen. Kein Deploy.
- Den Ablauf mit Rücknahmebatches (Import-Staging) habe ich nur dokumentiert, nicht ausgeführt.
