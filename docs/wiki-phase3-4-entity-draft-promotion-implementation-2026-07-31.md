# Wiki Phase 3.4: Atomare Entity-Draft-Promotion

Stand: 2026-07-31

Status: Schritt 2B ist implementiert und verifiziert. Der Abschlussstand gehoert
auf den Feature-Zweig `publish-wiki-blueprint-20260727`; ein Supabase-Deployment
ist nicht Teil dieses Blocks.

## Ziel

Schritt 2B ueberfuehrt einen in Schritt 2A versiegelten und als
`accepted_as_draft` angenommenen Entitaetskandidaten kontrolliert in das
Kernwissen. Die Promotion ist atomar, nur fuer Administratoren aufrufbar und bei
einer gueltigen bestehenden Promotion idempotent.

Die additive Migration liegt in:

`supabase/migrations/20260730150000_create_kb_entity_draft_promotion.sql`

Sie verlangt den vollstaendigen Schritt-2A-Vertrag und vor ihrer Ausfuehrung die
exakte Grenze von 48 Wiki-Tabellen. Anschliessend umfasst der gemeinsame
Wiki-Snapshot exakt 50 Tabellen.

## Promotionsschnittstelle

`kb_promote_entity_candidate_to_draft(uuid)` ist ein `SECURITY DEFINER`-RPC mit
expliziter Adminpruefung. Er liefert:

- `promoted_entity_id`
- `promoted_entity_revision_id`
- `was_created`

Der RPC sperrt Batch, Kandidat, Vertrag, Annahmeentscheidung, benoetigte
Quellen-Promotionen und direkte oder kandidatenbasierte
Revisionsabhaengigkeiten in stabiler Reihenfolge. Danach wird die Readiness in
derselben Transaktion erneut berechnet. Kollisionen bei kanonischen Entity- oder
Assertion-Schluesseln, ein gesetztes `target_entity_id`, ungueltige Quellen oder
Abhaengigkeiten und mehrdeutige Annahmeentscheidungen brechen die gesamte
Transaktion ab.

Eine bereits vorhandene Promotion wird nicht erneut geschrieben. Nur wenn ihre
vollstaendige Integritaetspruefung weiterhin besteht, gibt der RPC dieselben
Entity- und Revisions-IDs mit `was_created = false` zurueck. Eine beschaedigte
bestehende Promotion schlaegt geschlossen fehl. Kandidaten fuer bestehende
Entitaeten bleiben ausdruecklich dem spaeteren Revisionsverfahren vorbehalten.

## Atomar erzeugtes Kernwissen

Eine erfolgreiche Promotion erzeugt in einer Transaktion:

- eine stabile `kb_entities`-Zeile mit dem versiegelten Typ und kanonischen
  Schluessel
- genau Revision 1 in `kb_entity_revisions` mit Status `draft`, Herkunft
  `import` und kanonischem therapeutischem Inhalts-Hash
- alle normalisierten bevorzugten Namen und Aliase in `kb_entity_names`
- alle Kandidatenaussagen als Assertion-Version 1 im Status `draft`
- jede Quellenbindung mit der exakten bereits promoteten `kb_source_revisions`-
  Revision und der geprueften Fundstelle
- typisierte Zubereitungs-, homoeopathische, botanische, Naehrstoff- und
  Produktvariantendetails
- typisierte Zusammensetzungskomponenten mit exakten Entity- und Revisions-IDs

Jede Detail- und Komponentenbasis verweist auf die in derselben Promotion
erzeugte Kern-Assertion. Direkte Kernreferenzen bleiben an ihre exakte Revision
gebunden; Kandidatenreferenzen werden nur ueber eine bereits gueltige Promotion
aufgeloest.

Das freie, unstrukturierte `proposed_data` wird nicht in Entity, Revision,
Assertion, Details oder Komponenten kopiert. Nur sein SHA-256-Digest wird als
Nachweis des bewusst verworfenen Eingangs gespeichert.

## Zwei Provenienztabellen

Die Migration fuegt genau zwei Tabellen hinzu:

1. `kb_entity_candidate_draft_promotions`
2. `kb_entity_candidate_draft_promotion_assertions`

Die Elternzeile bindet Kandidat, Batch, Annahmeentscheidung, erzeugte Entity und
Revision, Vertragshash, Akteur und Zeitpunkt. Die zweite Tabelle ordnet jede
Kandidaten-Assertion genau ihrer erzeugten Kern-Assertion und ihrem initialen
Inhalts-Hash zu. Beide Tabellen sind append-only; Updates und Loeschungen werden
abgelehnt.

Reservierte Import-Provenienz in den Metadaten von Entity, Revision und
Assertion darf nur der Promotions-RPC erzeugen. Die technischen
Provenienzschluessel koennen danach weder entfernt noch auf nicht zugeordnete
Kernzeilen gefaelscht werden.

## Eingangs- und Aufloesungsmanifest

Die Promotion speichert zwei eingefrorene Manifeste:

- Das kanonische `input_manifest` bindet Kandidat und versiegelten Vertrag,
  Namen, Aussagen, Quellenbindungen, typisierte Details und Komponenten. Sein
  SHA-256-Hash und ein uebergeordneter `candidate_owned_hash` werden separat
  gespeichert.
- Das `resolution_manifest` bindet die erzeugten Kern-IDs, die exakten
  Quellenrevisionen, alle Assertion-Zuordnungen, den initialen
  Entity-Revisionshash sowie jede aufgeloeste Entity-Abhaengigkeit. Auch dieses
  Manifest besitzt einen separaten SHA-256-Hash.

Manifestversion 1 erlaubt auf der obersten Ebene sowie in Quellen-,
Abhaengigkeits- und Assertion-Eintraegen jeweils nur die festgelegte
Schluesselmenge. Fehlende oder zusaetzliche Felder machen die Promotion
ungueltig. Der initiale Entity-Revisionshash wird unabhaengig aus dem
versiegelten Kandidatenvertrag und den aufgeloesten Assertion- und
Revisionsbindungen rekonstruiert. Auch bei deaktivierten User-Triggern genuegt
es deshalb nicht, gespeicherten Hash und Manifest gemeinsam umzuschreiben.

Fuer Produkt-, Zubereitungs- und Komponentenreferenzen unterscheidet das
Aufloesungsmanifest direkte Revisionsreferenzen von Kandidatenreferenzen. Beide
Varianten speichern `entity_id`, `entity_revision_id` und den
`frozen_revision_content_hash`. Eine spaetere Aenderung der referenzierten
Revision oder ihres kanonischen Hashes macht die Promotion ungueltig und wird
durch einen verzoegerten Constraint-Trigger blockiert. Die verzoegerte Pruefung
liest die finale Revisionszeile der Transaktion; ein nur zwischenzeitlich
gesetzter Hash verursacht deshalb keinen falschen Fehler, ein finaler Unterschied
zum eingefrorenen Hash dagegen schon.

Initiale Hashes bleiben als Promotionsnachweis erhalten. Erlaubte redaktionelle
Aenderungen an einem `draft` muessen gleichzeitig den aktuellen kanonischen
Revisions- beziehungsweise Assertion-Hash aktualisieren. Technische
Promotionsprovenienz bleibt unveraenderlich.

## Rollen und Zugriff

- `anon`: kein Tabellen- oder RPC-Zugriff
- Patient beziehungsweise authentifizierter Nicht-Admin: keine sichtbaren
  Provenienzzeilen; Readiness und Promotion werden abgelehnt
- Administrator: RLS-gesteuertes Lesen sowie Readiness- und Promotions-RPC;
  keine direkten Tabellenwrites
- `service_role`: ausschliesslich Lesen fuer kontrollierten Backup-/Snapshotpfad,
  keine Promotion, Mutation oder `TRUNCATE`
- `kb_importer` und `kb_import_runtime`: kein Zugriff auf die
  Promotionsprovenienz und kein Promotions-RPC

## Snapshot und Restore

Frontend-Inventar, Edge-Inventar, Fallback-/OpenAPI-Ergaenzung und der
Datenbank-Snapshot enthalten dieselben 50 Wiki-Tabellen. Der Datenbank-RPC
liefert Snapshot und Integritaetszaehler gemeinsam. Der kontrollierte
`backup-export`-Edge-Pfad bricht ab, wenn Form, Tabellenmenge oder einer der
Pflichtzaehler ungueltig ist. `invalid_entity_candidate_draft_promotions` muss
wie die bisherigen Wiki-Validierungen 0 sein.

Beim transaktionalen Restore werden zunaechst Kernzeilen,
Kandidatenvertraege und Quellen-Promotionen geladen. Danach folgt
`kb_entity_candidate_draft_promotions`; die Assertion-Zuordnungen in
`kb_entity_candidate_draft_promotion_assertions` kommen zuletzt. Erst nach
`SET CONSTRAINTS ALL IMMEDIATE`, erneut aktivierten User-Triggern und einer
vollstaendig erfolgreichen Snapshotvalidierung darf committed werden. Alle 50
Zeilenzahlen und SHA-256-Manifeste muessen dem Ausgangssnapshot exakt
entsprechen, sonst wird die Restore-Transaktion zurueckgerollt.

## Verifikation

Abschlussgates am 2026-07-31:

- fokussierte Wiki-Suite: 38/38 Tests in 2 Dateien, davon
  Entity-Draft-Promotion 23/23 und Wiki-Phase-1-Kernschema/Backup-Inventar 15/15
- vollstaendige Projektsuite: 340/340 Tests in 36 Dateien
- `npx tsc -p tsconfig.app.json --noEmit`: bestanden
- `npx tsc -p tsconfig.node.json --noEmit`: bestanden
- `npm run build`: bestanden; nur bekannte Hinweise zu Browserslist-Daten,
  Bluebird-`eval` und grossen Chunks

Die Tests decken insbesondere ab:

- atomare Erstellung, idempotentes Replay und vollstaendigen Rollback bei
  spaeten Schluessel- oder Zielkollisionen
- exakte Namen, Assertions, Quellenrevisionen, typisierte Details und
  Komponenten ohne Spaltenverlust
- direkte und kandidatenbasierte Abhaengigkeiten samt eingefrorenen
  Revisions-Hashes
- aktuellen und initialen Hashvertrag ueber den gesamten Review-Lebenszyklus
- erneute Vertragshashberechnung, unabhaengige Initialhashrekonstruktion und
  exakte v1-Manifestschluessel bei deaktivierten User-Triggern
- Manipulation bei deaktivierten User-Triggern, verwaiste oder gefaelschte
  Provenienz und zyklische Kandidatenabhaengigkeiten
- Admin-, Patienten-, `service_role`-, Importer- und Runtime-Rechte
- byte-identischen Erhalt eines synthetischen Patientensentinels
- Export und transaktionalen Restore aller 50 Tabellen mit identischen
  Zeilenzahl- und SHA-256-Manifesten

## Bewusste Grenzen

- keine Promotion auf bestehende Entitaeten
- keine Entity-Relationen
- keine Dosierungen oder Dosierungsregeln
- keine Sicherheitsregeln oder Sicherheitsempfehlungen
- keine echten Mittel-, Produkt- oder Patientendaten
- keine Aenderung am sichtbaren Therapieempfehlungspfad
- kein Supabase-Deployment und kein Live-Rollbacktest in diesem Block
