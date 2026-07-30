# Wiki Phase 3.1: Quellenkandidat zu Kernentwurf

Datum: 29.07.2026

## Status

Die erste kontrollierte Staging-zu-Kern-Bruecke ist lokal implementiert und noch nicht auf Supabase ausgerollt. Sie verarbeitet ausschliesslich synthetische Testdaten; es wurden keine medizinischen Quellen oder Aussagen angelegt.

Migration: `supabase/migrations/20260728150000_create_kb_source_draft_promotion.sql`

## Zweck

Ein vollstaendig gepruefter Quellenkandidat kann genau einmal in eine neue stabile Kernquelle mit Revision 1 ueberfuehrt werden. Das Ergebnis bleibt immer `draft`. Die Funktion kann weder `approved` noch `released` erzeugen.

## Voraussetzungen

- Aufrufer ist ein angemeldeter Administrator.
- Der Import-Batch ist vollstaendig `reviewed`.
- Der Kandidat ist `accepted_as_draft`.
- Eine unveraenderliche `accept_as_draft`-Reviewentscheidung ist vorhanden.
- Der Kandidat verweist nicht auf eine bereits vorhandene Kernquelle.
- Kanonischer Schluessel und Kern-Quellentyp werden explizit vom Administrator gewaehlt.
- Titel oder URL werden niemals zur technischen Identitaet und der Quellentyp wird nicht aus Freitext geraten.

## Erzeugte Daten

Die RPC `kb_promote_source_candidate_to_draft` erzeugt atomar:

1. eine Zeile in `kb_sources`,
2. Revision 1 in `kb_source_revisions` mit Status `draft`,
3. den aktuellen Revisionszeiger der Quelle,
4. eine unveraenderliche Provenienzzeile in `kb_source_candidate_draft_promotions`.

Nur eindeutige Felder werden uebernommen: Titel, Verlag, Publikationsdatum, URL und Rechtestatus. Autoren, DOI, PMID, ISBN, Auflage und Kern-Quellentyp werden nicht aus freien Kandidatenfeldern abgeleitet.

Der SHA-256-Inhaltshash wird serverseitig ueber die kanonische JSONB-Darstellung des tatsaechlich gespeicherten semantischen Entwurfs gebildet. Die Kernrevision verweist in ihren Metadaten auf Batch, Kandidat, Reviewentscheidung und Konvertierungsversion; der vollstaendige Originalkandidat bleibt unveraendert im Staging.

## Idempotenz und Konflikte

- Derselbe Kandidat mit demselben Schluessel und Quellentyp liefert beim erneuten Aufruf nur dann dieselben IDs zurueck, wenn Kandidat, Batch, Reviewentscheidung, initialer Hash und gespeicherte Provenienz weiterhin konsistent sind.
- Abweichende Parameter nach einer Promotion werden abgelehnt.
- Ein vorhandener kanonischer Schluessel wird nicht zusammengefuehrt.
- Kandidaten mit `target_source_id` benoetigen spaeter einen getrennten Revisionsworkflow.
- Jeder Fehler rollt Quelle, Revision und Provenienz gemeinsam zurueck.

## Rechte

- Administratoren sehen die Provenienz und duerfen ausschliesslich die kontrollierte RPC aufrufen.
- Patienten und anonyme Benutzer sehen keine Zeilen.
- `kb_importer` und `kb_import_runtime` haben keinen Tabellen- oder Funktionszugriff.
- `service_role` besitzt nur Leserechte fuer Backups und kann die Promotion-RPC nicht ausfuehren.
- Die Promotionszeile ist append-only; normale Rollen besitzen kein `INSERT`, `UPDATE`, `DELETE` oder `TRUNCATE`.
- An der erzeugten Kernquelle und Initialrevision sind technische Herkunftsfelder wie Kandidat, Batch, Reviewentscheidung, Konvertierungsversion, Ersteller und Revision 1 unveraenderlich. Redaktionelle Felder eines Drafts bleiben bis zur fachlichen Review bearbeitbar.

## Backup und Restore

Mit `kb_source_candidate_draft_promotions` umfasst der gemeinsame Wiki-Snapshot 32 Tabellen. Die Tabelle wird nach Kernquellen, Kernquellenrevisionen, Quellenkandidaten und Reviewentscheidungen wiederhergestellt. `kb_export_wiki_snapshot()` zaehlt fehlende oder semantisch inkonsistente Verknuepfungen als `invalid_source_promotions`; der Edge-Export bricht bei einem Wert ungleich null oder einem fehlenden Zaehler ab. Der Restore bleibt eine eigentuemergebundene Transaktion mit aktiven Fremdschluesseln, anschliessender Integritaetsvalidierung und exaktem Manifestvergleich.

## Noch nicht enthalten

- keine Aktualisierung oder Zusammenfuehrung vorhandener Kernquellen
- keine Promotion von Entitaeten oder Relationen
- keine Dosierungs- oder Sicherheitsregeln im Kern
- keine fachliche Freigabe oder Publikation
- keine Nutzung durch Suche oder Therapieempfehlung
