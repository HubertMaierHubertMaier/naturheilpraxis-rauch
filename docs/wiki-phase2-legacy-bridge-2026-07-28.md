# Wiki Phase 2: Verlustfreie Legacy-Bruecke

Datum: 28.07.2026

## Status

Die Phase-2-Bruecke ist lokal implementiert und noch nicht auf Supabase ausgerollt.

Migration: `supabase/migrations/20260728130000_create_kb_phase2_legacy_bridge.sql`

## Verhalten

- Jeder Datensatz aus `public.admin_knowledge_base` erhaelt genau einen stabilen Artikel in `public.kb_articles`.
- Die technische Identitaet ist ausschliesslich die unveraenderliche Legacy-UUID. Doppelte und spaeter geaenderte Titel werden nicht zusammengefuehrt.
- Titel, Kategorie, Tag-Reihenfolge und Markdown-Inhalt werden unveraendert in `kb_article_revisions` uebernommen.
- Alle weiteren Legacy-Felder werden im Feld `metadata.legacy_metadata` der Revision erhalten.
- Der erste und jeder spaetere fachlich geaenderte Stand wird als `legacy_snapshot` gespeichert.
- Legacy-Snapshots koennen nach ihrer Erfassung weder geaendert noch geloescht werden.
- Ein Legacy-Update erzeugt nur dann eine neue Revision, wenn sich der fachliche Datensatz geaendert hat. Eine alleinige Aenderung des automatisch gepflegten Feldes `updated_at` erzeugt keine leere Revision.
- Eine Legacy-Loeschung loescht keine Historie. Der zugehoerige strukturierte Artikel wird auf `withdrawn` gesetzt.
- Die bestehende Wiki-Oberflaeche schreibt weiterhin ausschliesslich in `admin_knowledge_base`; der Trigger spiegelt Aenderungen danach automatisch.
- Wird eine geloeschte Legacy-UUID erneut angelegt, entsteht auch bei identischem Inhalt eine neue Revision. Deren unveraenderliche Metadaten bewahren den vorherigen Loeschzeitpunkt.

## Hash-Vertrag

`kb_legacy_article_hash` bildet SHA-256 ueber die kanonische JSONB-Darstellung der vollstaendigen Legacy-Zeile ohne `updated_at`. Dadurch bleiben unter anderem UUID, Titel, Kategorie, Tag-Reihenfolge, Inhalt, Review-, Evidenz-, Dosierungs-, Quellen- und Sicherheitsfelder Bestandteil des Hashs. `updated_at` wird ausgeschlossen, weil dieses Feld auch bei einem inhaltlichen No-op automatisch aktualisiert wird.

## Sicherheit und Kompatibilitaet

- Kein `DROP`, `RENAME`, `TRUNCATE` oder Spaltentypwechsel an der Legacy-Wiki.
- Keine Fremdschluessel-Abhaengigkeit von `kb_articles` zur Legacy-Tabelle.
- Keine Patientendaten in der Wissensstruktur.
- Die Synchronisationsfunktionen sind nicht direkt fuer `PUBLIC`, `anon` oder `authenticated` ausfuehrbar.
- Administratoren koennen Brueckenartikel nicht direkt anlegen, umhaengen, aendern oder loeschen; Aenderungen muessen ueber die Legacy-Wiki erfolgen.
- Bestehende Backup-Definitionen benoetigen keine neue Tabelle; die neue Zuordnungsspalte wird mit `kb_articles` automatisch exportiert.

## Backup und Restore

`kb_export_wiki_snapshot()` liefert alle 23 Tabellen des Wiki-Teilbackups aus einem gemeinsamen Datenbank-Snapshot. Das Ergebnis enthaelt fuer jede Tabelle die verbindliche Zeilenzahl und einen SHA-256-Hash ueber alle kanonisch sortierten Zeilen. Zusaetzlich werden fehlende Zuordnungen, rekonstruierte Feld- und Hashabweichungen sowie aktive Artikel ohne Legacy-Zeile geprueft. Der Backup-Export bricht bei einer solchen Abweichung ab.

Der Restore wird ausschliesslich als Datenbankeigner in einer Transaktion ausgefuehrt. Nach `SET CONSTRAINTS ALL DEFERRED` wird auf allen 23 Wiki-Tabellen `DISABLE TRIGGER USER` gesetzt. Damit werden Review-, Snapshot- und Capture-Trigger fuer den exakten Reimport pausiert; intern erzeugte Fremdschluesseltrigger bleiben aktiv. Anschliessend werden vorhandene Wiki-Daten einschliesslich der Migration-Seeds in umgekehrter Abhaengigkeitsreihenfolge geleert. Es darf kein `CASCADE` auf fachfremde Tabellen verwendet werden.

Der Import erfolgt in dieser Reihenfolge:

1. `kb_entity_types`, `kb_identifier_schemes`, `kb_relation_types`, `kb_relation_type_domains`
2. `kb_entities`, `kb_entity_revisions`, `kb_entity_names`, `kb_entity_identifiers`
3. `kb_sources`, `kb_source_revisions`
4. `kb_assertions`, `kb_entity_relations`, `kb_assertion_sources`
5. `kb_articles`, `kb_article_revisions`, `kb_article_entities`, `kb_change_proposals`
6. `admin_knowledge_base`, `mannayan_products`, `knowledge_product_links`
7. `faqs`, `practice_pricing`, `practice_info`

Nach dem Import wird zuerst `SET CONSTRAINTS ALL IMMEDIATE` ausgefuehrt. Erst wenn damit alle Fremdschluessel erfolgreich geprueft und keine aufgeschobenen Triggerereignisse mehr offen sind, werden auf allen Tabellen die Benutzer-Trigger wieder aktiviert. `kb_export_wiki_snapshot()` muss fuer alle drei Fehlerzaehler 0 melden und sein Tabellenmanifest muss exakt mit `kb_wiki_snapshot_manifest.json` aus dem Backup uebereinstimmen. Dadurch werden veraenderte Freigabedaten, Seed-Konflikte und der Verlust nicht-aktueller historischer Revisionen erkannt. Bei einer Abweichung wird die gesamte Transaktion zurueckgerollt.

## Ausrollbedingung

Phase 2 darf erst nach erfolgreicher Phase-1-Migration, erneut bestaetigtem Live-Backup und kontrolliertem Restore-Test ausgerollt werden. Nach dem Backfill muessen Legacy- und Brueckenbestand dieselbe Anzahl eindeutiger UUIDs besitzen und alle Kernfelder sowie Hashes muessen verglichen werden.
