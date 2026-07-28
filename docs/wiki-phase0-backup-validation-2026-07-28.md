# Wiki Phase 0: Backup- und Restore-Pruefung

Datum: 28.07.2026

## Umfang

Geprueft wurden das lokal erzeugte Codebackup und das lokale Vollbackup. Rohdaten, Auth-Daten, Patientendaten und ZIP-Dateien bleiben ausserhalb des Git-Repositories.

## Backup-Integritaet

| Backup | SHA-256 | Ergebnis |
|---|---|---|
| `Naturheilpraxis-CODE-Backup-2026-07-28_08-18.zip` | `165dae9ec05b17ee9627129687c4258c2c301880075eef0c6b9772105e1a445d` | lesbar, 702 Eintraege, keine Fehlerdatei |
| `Naturheilpraxis-DATEN-voll-Backup-2026-07-28_08-18.zip` | `26f0a4fa33b5333c37c4a5f944145c58d4b42b0a50fc6251f00cf3a7122e8502` | lesbar, 176 Eintraege, keine Fehlerdatei |

Das Codebackup stammt aus GitHub-Commit `12bfd05` und enthaelt den Wiki-Bauplan, die Speicherregel, 94 Migrationseintraege und `supabase/functions/backup-export/index.ts`.

## Wiki-Inventur

- Backup-Statistik: 436 Wiki-Zeilen
- Export: 436 Wiki-Zeilen
- eindeutige und gueltige UUIDs: 436
- fehlende Pflichtfelder: 0
- doppelte UUIDs: 0
- Kategorien: 32
- eindeutige Tags: 1087
- normalisierte Titel-Dublettengruppen: 12
- exakt doppelte Titel: 2 Gruppen
- automatische Zusammenfuehrungen: 0

Die Dubletten bleiben bis zur fachlichen Pruefung getrennte Datensaetze.

## Verwandte allgemeine Daten

- `mannayan_products`: 542 Zeilen
- `knowledge_product_links`: 2 Zeilen
- verwaiste Wiki-Verknuepfungen: 0
- verwaiste Produkt-Verknuepfungen: 0

`knowledge_product_links` ist im Live-Backup, in der aktuellen GitHub-Migration `20260715155222_728b55a8-4b41-4449-9e5b-976c711ed4ed.sql` und im aktuellen Supabase-Typstand vorhanden. Der erste Vergleich gegen den stark zurueckliegenden lokalen Hauptarbeitsstand war unvollstaendig; das aktuelle Codebackup hat den korrekten Stand bestaetigt.

## Isolierter Restore-Test

Der Restore wurde in einer temporaeren PostgreSQL-kompatiblen PGlite-Datenbank ausserhalb des Repositories ausgefuehrt.

| Datengruppe | Erwartet | Wiederhergestellt | Exakter Feldvergleich |
|---|---:|---:|---:|
| Wiki | 436 | 436 | 436 |
| Mannayan-Produkte | 542 | 542 | 542 |
| Produktverknuepfungen | 2 | 2 | 2 |

Fremdschluesseltest: keine verwaisten Wiki- oder Produktverknuepfungen.

Ergebnis: **BESTANDEN**.

## Naechster Schritt

Die additive Phase-1-Migration wird lokal vorbereitet und gegen eine isolierte Datenbank getestet. `admin_knowledge_base` bleibt unveraendert; eine Live-Ausrollung erfolgt erst nach gesonderter Pruefung und Freigabe.
