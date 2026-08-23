# Sorra an Lovable

message_id: `SLH-2026-08-23-002`
status: `vieva_live_waiting_for_visible_peter_confirmation`
project: `naturheilpraxis-rauch`
supabase_project_ref: `jmebqjadlpltnqawoipb`

## Ziel

Genau die bereits lokal gepruefte Migration
`supabase/migrations/20260728120000_add_vieva_plus_patient_input.sql` nach einer
vollstaendigen Live-Vorhersicherung anwenden und nur mit kuenstlichem JSON
nachpruefen.

Diese Datei ist keine Ausfuehrungsfreigabe. Vor jeder Schreiboperation muss
Peter im sichtbaren Lovable-Chat ausdruecklich bestaetigen:

`Ich bestaetige einmalig SLH-2026-08-23-002: Vieva-Vorhersicherung, genau Migration 20260728120000 und synthetischer Nachtest. SIBO und alle anderen Aenderungen bleiben gesperrt.`

Ohne exakt diese inhaltliche Bestaetigung nur den Auftrag erklaeren und nichts
live schreiben.

## Verbindliche Grenzen

- Aktives Cloudprojekt muss exakt `jmebqjadlpltnqawoipb` sein.
- Keine Patienten-, Therapie- oder fachlichen Tabellenzeilen lesen.
- Keine andere Migration ausfuehren; insbesondere SIBO bleibt gesperrt.
- Kein `migration repair`, Main-Merge, Deployment oder Veroeffentlichung.
- Bei jeder Abweichung vor einer Schreiboperation stoppen und berichten.

## 1. Exakte Vorhersicherung

Fuer genau diese zwei Funktionen vollstaendig sichern und im Bericht ausgeben:

1. `public.extract_patient_snapshot_fields(jsonb)`
2. `public.compact_therapy_session_input(jsonb, integer)`

Je Funktion sichern:

- `pg_get_functiondef`
- Identitaetsargumente und Signatur
- Eigentuemer und ACL/EXECUTE-Rechte
- Volatilitaet und SECURITY DEFINER/INVOKER
- `proconfig`/`search_path`
- SHA-256 der vollstaendigen Definition

Vor dem Schreiben bestaetigen:

- Beide Signaturen existieren genau einmal.
- In beiden Definitionen fehlen `vievaPlus`, `vievaPlusDatum` und
  `metatronDatum`.
- Die Migration enthaelt genau zwei `CREATE OR REPLACE FUNCTION`-Anweisungen
  und keine `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `GRANT` oder
  `REVOKE`-Anweisung.

Wenn eine Aussage nicht stimmt oder die vollstaendige Sicherung nicht moeglich
ist: stoppen und nichts schreiben.

## 2. Genau eine Migration

Nach Peters sichtbarer Bestaetigung ausschliesslich
`20260728120000_add_vieva_plus_patient_input.sql` in einer eigenen Transaktion
anwenden. Keine zweite Datei und kein Historien-Reparaturbefehl.

## 3. Nur synthetisch nachpruefen

Beide Funktionen ohne Tabellenzugriff mit exakt diesem kuenstlichen JSON
aufrufen:

```json
{
  "_pseudonym_id": "P-2099-9999",
  "vievaPlus": "SYNTH-VIEVA-PLUS",
  "vievaPlusDatum": "2099-12-30",
  "metatronHeel": "SYNTH-METATRON",
  "metatronDatum": "2099-12-29"
}
```

Fuer beide Rueckgaben pruefen:

- `vievaPlus` ist exakt `SYNTH-VIEVA-PLUS`.
- `vievaPlusDatum` ist exakt `2099-12-30`.
- `metatronDatum` ist exakt `2099-12-29`.
- Signaturen, Eigentuemer, Rechte, Volatilitaet, Security-Modus und search_path
  sind unveraendert.
- Die Migrationshistorie hat genau einen neuen Vieva-Eintrag und keinen
  weiteren neuen Eintrag.

## Abschlussbericht

Antwort im Lovable-Chat und, falls GitHub-Push moeglich, mit derselben
`message_id` in `docs/lovable-sorra-response.md`:

- `project_ref`
- `precheck_passed`
- beide vorherigen Funktionsdefinitionen, SHA-256 und Metadaten
- `migration_applied` und Transaktionsergebnis
- beide synthetischen Rueckgaben
- `metadata_unchanged`
- neue Migrationshistorienzeilen
- `patient_rows_read` muss 0 sein
- `other_migrations_applied` muss 0 sein
- `sibo_changed` muss false sein
- `deployment_or_publish` muss false sein
- Warnungen oder Abweichungen

Bei einem Fehler waehrend der Transaktion zuerst zurueckrollen. Keine
eigenstaendige Reparatur und keine alte lokale Definition als Ersatz verwenden.
