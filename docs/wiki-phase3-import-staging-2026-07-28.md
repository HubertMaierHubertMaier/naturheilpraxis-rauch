# Wiki Phase 3: Sicheres Import-Staging

Datum: 28.07.2026

## Status

Das technische Import-Staging ist lokal implementiert und noch nicht auf Supabase ausgerollt. Es wurden keine medizinischen Pilotdaten, Dosierungen, Sicherheitsregeln oder Produktbehauptungen angelegt.

Migration: `supabase/migrations/20260728140000_create_kb_phase3_import_staging.sql`

## Tabellen

- `kb_import_batches`
- `kb_source_candidates`
- `kb_entity_candidates`
- `kb_relation_candidates`
- `kb_dosage_candidates`
- `kb_safety_candidates`
- `kb_review_decisions`
- `kb_import_errors`

Alle Tabellen sind ausschliesslich fuer `general_knowledge` zugelassen. Personenbezogene Daten und Patientenbefunde duerfen nicht importiert werden.

## Sicherheitsvertrag

- Parser, Importer und KI duerfen Kandidaten nur als `imported_unreviewed` anlegen.
- Kandidaten kennen keine Statuswerte `approved` oder `released`.
- Relationen, Dosierungen und Sicherheitsregeln benoetigen einen konkreten Quellenkandidaten aus demselben Import-Batch.
- Kandidatenverweise duerfen keine Batch-Grenzen ueberschreiten.
- Dosierungen pruefen nichtnegative Mindest- und Hoechstwerte sowie deren Reihenfolge, werden aber niemals automatisch fachlich bestaetigt.
- Sicherheitskandidaten starten konservativ mit `require_review`.
- Der nicht anmeldbaren Datenbankrolle `kb_importer` fehlen alle Rechte auf Kernwissen und Patiententabellen. Sie darf nur Batches verarbeiten, ungepruefte Kandidaten einfuegen und Importfehler protokollieren.
- Die ebenfalls zunaechst nicht anmeldbare Rolle `kb_import_runtime` ist ausschliesslich Mitglied von `kb_importer`. Nach technischer Abnahme provisioniert der Datenbankbetreiber ausserhalb von Migrationen und Git ein starkes zufaelliges Login-Kennwort fuer `kb_import_runtime`. Der Importdienst verbindet sich verschluesselt mit genau diesem Login und aktiviert `SET ROLE kb_importer`.
- Weder Projekt-JWT-Signierschluessel noch `service_role`-Schluessel gelangen in den Importdienst oder Parserprozess.
- `service_role` besitzt auf Staging und den 17 neuen Kern-Wiki-Tabellen nur Leserechte fuer Backup und bestehende Edge-Lesepfade. Direkte Kernentwuerfe, Statuswechsel und `TRUNCATE` sind auch fuer diese Rolle gesperrt.
- Import-Batches, Kandidaten, Entscheidungen und Fehler koennen nach ihrer Erfassung weder geloescht noch mit `TRUNCATE` geleert werden.
- Batch-Quelle, Hash, Parser-/Modellidentitaet und Metadaten sowie Kandidatenidentitaet und Kandidateninhalt sind ab Einfuegung unveraenderlich.
- Terminal entschiedene Kandidaten und alle Auditzeilen sind unveraenderlich.
- Weder `kb_importer` noch `service_role` kann eine Review-Entscheidung direkt einfuegen oder einen Kandidatenstatus setzen.
- Kandidaten und Fehler koennen nur in Batches mit Status `created` oder `processing` eingefuegt werden. Beim Wechsel zu `ready_for_review` ist die Kandidatenmenge dadurch geschlossen.
- Eine Entscheidung erfolgt ausschliesslich ueber `kb_record_import_review_decision` nach Admin-Pruefung.
- Die Review-RPC sperrt zuerst den zugehoerigen Batch und akzeptiert ausschliesslich `ready_for_review`. Ein als Entwurf angenommener Kandidat benoetigt zuvor angenommene Quellen- und Kandidatenabhaengigkeiten.
- Ein Batch wird nur ueber `kb_complete_import_batch_review` abgeschlossen. Die Funktion berechnet Kandidaten- und Fehlerzahl neu und verweigert `reviewed`, solange ein Kandidat keine terminale Entscheidung besitzt.
- `accept_as_draft` bedeutet nur fachlich zur spaeteren Entwurfskonvertierung angenommen. Es erzeugt keine freigegebene Kernrevision.
- Anonyme Benutzer und Patienten erhalten keinen Zugriff. Administratoren koennen das Staging lesen, aber nicht direkt schreiben.

## Backup

Die acht Tabellen sind Bestandteil von Wiki-Teilbackup, Datenbank-/Vollbackup und `kb_export_wiki_snapshot()`. Am Ende von Phase 3 umfasst der gemeinsame Wiki-Snapshot 31 Tabellen; mit der nachfolgenden Quellen-Promotion aus Phase 3.1 sind es 32. Beide Backup-Arten enthalten die eigentuemergebundene Restore-Anleitung und das Hashmanifest.

## Noch nicht enthalten

- kein Markdown- oder Pathogenparser, der echte Daten schreibt
- keine Konvertierung angenommener Kandidaten in Kernentwuerfe
- keine fachredaktionelle UI
- keine sieben Pilotbuendel
- keine automatische Quellenbewertung

Diese Schritte erfordern kontrollierte Originalquellen und gesonderte fachliche Abnahme. Vorher bleibt jeder Kandidat ausserhalb produktiver Suche und Therapieempfehlung.
