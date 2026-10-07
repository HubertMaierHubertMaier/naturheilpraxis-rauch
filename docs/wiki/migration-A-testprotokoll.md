# Migration A v4 – Offline-Testprotokoll (07.10.2026, nach Nachprüfung 277e2a4c)

Umgebung: PGlite (Postgres 17, WASM), leer, ohne Verbindung zum Live-System. Geladen: Stubs (auth.uid, app_role, has_role, Rollen anon/authenticated/service_role mit BYPASSRLS wie Supabase) + **originale** `20260728090000_create_kb_phase1_core.sql` + Entwurf `vernetzung-migration-A.sql`.
Aufruf: `bun docs/wiki/migration-A-offline-test.ts` – **Exit 1 bei jedem FAIL** (vorher gegengeprüft: Lauf mit 16 FAIL endete mit Exit 1). `--learn` setzt den Soll-Fingerabdruck neu.

Ergebnis: **61 PASS / 0 FAIL, Exit 0.** Gegenprobe mit absichtlich falschem Fingerabdruck: Exit 1. Fingerabdruck `b770c165e2a16e5a295c37e470e7b477`.

## Korrekturen v4
1. **Restore (P1):** Vor jedem Insert werden alle drei Pflichtarrays geprüft (fehlend, null oder kein Array = Abbruch), außerdem Manifestanzahl und ID-Prüfsumme je Tabelle und ob jede Rücknahme auf eine Zuordnung im Dump verweist. Der Export liefert das Manifest mit. Tests 27–35 lehnen alle Varianten ab, auch nur `{format}` und den Dump ohne Rücknahmen. Tests 36/37b: keine Restzeilen, auch bei Abbruch mitten im Insert.
2. **Review-RPC (P2):** ROW_COUNT wird sofort nach dem UPDATE gesichert. Unbekannte und bereits geprüfte IDs sind Fehler (10b/10c), die Notiz bleibt unverändert (10d).
3. **Aussage vs. Quellenhaltung (P2):** konkreter Wortlaut + Beziehungstyp, Polarität affirmed/negated, Quellenhaltung als „Quelle unterstützt/widerspricht dieser Aussage“. supports ≠ klinischer Nachweis; kein Wirklabel bei nicht medizinischen Beziehungen. Tests 17a/17b nutzen „enthält (kein) Zink“.

Aus v3 erhalten: unveränderlicher Prüfnachweis + append-only Rücknahme, Fingerabdruck-Strukturprüfung mit Drift-Tests, isolierter Export/Restore, harter Exitcode.

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
- PASS 10b Review unbekannte ID = Fehler
- PASS 10c Review bereits geprüfte ID = Fehler
- PASS 10d Notiz nach Fehlversuch unverändert
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
- PASS 17a Fall 1: Quelle unterstützt verneinte Aussage „enthält kein Zink“ = negated + supports
- PASS 17b Fall 2: Quelle widerspricht bejahter Aussage „enthält Zink“ = affirmed + refutes
- PASS 18 Widerspruch verknüpfen, beide Aussagen bleiben
- PASS 19 Konflikt löschen (auch service_role)
- PASS 20 Spiegeldublette
- PASS 21 Export als authenticated verboten
- PASS 22 Restore als authenticated verboten
- PASS 23 Restore-Zähler (supersedes umgekehrt geliefert)
- PASS 24 Export nach Restore identisch (inkl. Prüfer/Zeit/Rücknahme)
- PASS 25 Restore in nicht leere Tabellen
- PASS 26 Nach Restore wieder geschützt
- PASS 27 ohne withdrawals-Array (zurückgezogene würden wieder wirksam)
- PASS 28 nur {format}
- PASS 29 withdrawals = null
- PASS 30 conflicts kein Array
- PASS 31 Manifest fehlt
- PASS 32 Zeile entfernt, Manifest alt
- PASS 33 ID verändert, Anzahl gleich
- PASS 34 Rücknahme ohne zugehörige Zuordnung
- PASS 35 Format falsch
- PASS 36 nach allen Fehlversuchen keine Restzeilen (atomar)
- PASS 37 Abbruch während Insert (FK)
- PASS 37b keine Restzeilen nach Insert-Abbruch
- PASS 38 Export trägt Manifest mit Anzahlen

in nicht leere Tabellen
- PASS 26 Nach Restore wieder geschützt

## Offene Grenzen zum Live-System (nicht prüfbar ohne Anwendung)
- Der **Fingerabdruck stammt aus PGlite/PG 17.** Die Ausgabe von pg_get_*def und die Rollen bzw. Grantors im Live-System können abweichen. Dann bricht die Migration live ab, es bleibt nichts zurück. Vor einer Anwendung den Soll-Wert in einer isolierten Kopie bestimmen (z. B. Draft-Stack) und von Codex gegenprüfen lassen.
- Rechte, Policy-Namen und das Supabase-Rollenverhalten (BYPASSRLS, Grantor `postgres` vs. `supabase_admin`) sind nur nachgebildet.
- Die Regeln im Live-System wurden nur stichprobenhaft gelesen (Typen/Domänen); die vollständigen Regeltexte sind nicht verglichen.
- Den Backup-Patch habe ich nicht gegen die echte Edge-Function ausgeführt; die Variablennamen in den Hunks sind vor einer Anwendung abzugleichen. Kein Deploy.
- Den Ablauf mit Rücknahmebatches (Import-Staging) habe ich nur dokumentiert, nicht ausgeführt.
