# Wiki Schritt 4B-2a: Releasegebundene Suchprojektion

Stand: 2026-08-02

Status: lokal implementiert. Kein Supabase-Deployment, kein Backfill und keine
produktive Suchanbindung.

## Ziel und Grenze

Die additive Migration

`supabase/migrations/20260802090000_create_kb_search_document_contract.sql`

erweitert den medizinisch inaktiven Wissensvertrag um genau eine leere Tabelle:

`kb_search_documents`

Die Tabelle bildet klassische Alias-, Kennungs- und Volltextsuche fuer bereits
versiegelte Knowledge-Releases ab. Sie ist keine produktive Retrieval-API und
enthaelt keine Embeddings.

Vor der Anlage prueft die Migration die exakte bestehende 55-Tabellen-Grenze.
Danach umfasst der gemeinsame Wiki-Snapshot exakt 56 Tabellen.

Nicht Bestandteil von 4B-2a sind:

- Laborparameter und Referenzbereiche; sie folgen getrennt in 4B-2b
- Release v2 oder Aktivierung von Release v1
- ein Such-, Writer-, Materialisierungs- oder Aktivierungs-RPC
- Verbindung zu `therapy-recommend`, Patienteneingaben oder sichtbarer Ausgabe
- Fuzzy Search, Trigramme, Synonymraten oder Embeddings
- Seeds, Backfill oder echte medizinische Wissensdaten

`kb_releases.contract_version = 1` bleibt unveraendert. Die bestehenden Checks
erzwingen weiterhin `retrieval_eligible = false` und `is_active = false`.

## Releasegebundene Provenienz

Eine Suchzeile besitzt genau eine `release_item_id` und die zugehoerige
`release_id`. Ein zusammengesetzter Fremdschluessel verhindert eine
releasefremde Zuordnung.

Zulaessige Dokumentarten sind ausschliesslich:

- `entity_revision`
- `article_revision`
- `assertion`

`source_revision` wird nicht als eigenstaendiges Suchdokument angelegt. Eine
Quellenrevision kann jedoch den Suchtext einer Assertion mit dem eingefrorenen
Quellentitel ergaenzen.

Die Projektion liest ausschliesslich das in 4A eingefrorene `item_manifest` und
die ebenfalls im selben Release eingefrorenen Quellenitems. Sie liest fuer die
Suchinhalte keine spaeter geaenderten lebenden Alias- oder Kennungszeilen.
Dadurch kann dieselbe Entitaetsrevision in zwei Releases unterschiedliche, dort
jeweils reproduzierbar eingefrorene Aliasstaende besitzen.

Ein Insert ist nur moeglich, wenn:

- der Release `sealed` ist
- `kb_release_is_valid(release_id, false)` wahr ist
- `kb_release_item_is_valid(release_item_id, false)` wahr ist
- die Dokumentart suchbar ist
- alle Groessen-, Array- und Normalisierungsgrenzen eingehalten werden

Historische Releases bleiben reproduzierbar, wenn gebundene Kernrevisionen
spaeter `superseded` oder `withdrawn` werden. Ein aktueller Status `released` ist
nur beim urspruenglichen Seal erforderlich.

## Suchfelder

Jede Zeile enthaelt:

- Dokumentart und kanonischen Schluessel
- Titel und normalisierten Titel
- eingefrorene Aliase und normalisierte Aliase
- exakte Kennungsterme
- kontrollierte Facettenterme
- bei Assertions eingefrorene primaere Quellentitel
- begrenzten Koerpertext
- einen expliziten deutschen `tsvector`
- einen expliziten sprachneutralen `simple`-`tsvector`
- den SHA-256 des kanonischen Projektionspayloads
- den reproduzierbaren Versiegelungszeitpunkt des Releases

Es gibt keine generische Metadaten-, Predicate-, Patienten- oder
Anwendungs-JSON-Spalte.

## Normalisierung und Rankinggrundlage

`kb_search_normalize_v1()` fuehrt ausschliesslich folgende reproduzierbare
Schritte aus:

1. Unicode-NFC
2. Rand- und Mehrfachleerzeichen normalisieren
3. Kleinschreibung

Umlaute werden nicht still in `ae`, `oe` oder `ue` umgeschrieben. Solche
Schreibweisen muessen als echte eingefrorene Namensvarianten vorliegen.

Kennungswerte verwenden dagegen unveraendert den scheme-spezifischen
`normalized_value`; insbesondere wird seine Gross-/Kleinschreibung nicht durch
die allgemeine Suchnormalisierung veraendert. Der unqualifizierte Wert wird als
JSON-kodierter Term wie `identifier_value:"12345678"` gespeichert. Daneben
enthaelt das Array einen injektiven qualifizierten Term in der Form
`identifier:[scheme, namespace, normalized_value]`. Die getrennten Praefixe und
JSON-Kodierung verhindern Mehrdeutigkeiten zwischen rohen Werten und
qualifizierten Tupeln sowie durch Doppelpunkte in Namespace oder Wert. Bei lokal
eindeutigen Schemes muss ein spaeterer Leser den qualifizierten Term mit
Namespace verwenden; ein unqualifizierter Wert darf mehrere Treffer liefern.

Die Vektorgewichte sind:

- A: Titel und Aliase
- B: Facetten; beim `simple`-Vektor zusaetzlich kanonischer Schluessel und
  Kennungen
- C: primaere Quellentitel
- D: Koerpertext

Ein spaeterer Leser muss fuer Benutzereingaben `plainto_tsquery` oder
`websearch_to_tsquery` mit expliziter Konfiguration verwenden. Rohtext darf nicht
direkt an `to_tsquery` gehen.

Die geplante deterministische Suchreihenfolge bleibt:

1. exakte Kennung
2. exakter normalisierter Alias oder Titel
3. kanonischer Schluessel beziehungsweise Codepraefix
4. deutscher Volltext
5. sprachneutraler Volltext fuer Produktnamen und Codes
6. stabiler kanonischer Tie-Break

Diese Migration implementiert noch keinen Leser und damit noch kein
produktionswirksames Ranking.

## Grenzen

Pro Array sind hoechstens 256 eindeutige, sortierte Werte mit je 1.024 UTF-8-
Bytes erlaubt. Titel sind auf 8.192 Bytes, Koerpertext auf 512 KiB und der
gesamte kanonische v1-Projektionspayload einschliesslich JSON-Kodierung auf
768 KiB begrenzt.

Uebergrosse Inhalte werden nicht still abgeschnitten. Fuer sie ist spaeter ein
versionierter Chunk-Vertrag erforderlich.

## Unveraenderlichkeit und Integritaet

Normale Inserts koennen nur durch den tatsaechlichen Datenbanktabellenbesitzer
erfolgen. Der `BEFORE INSERT`-Trigger leitet alle Suchfelder und Vektoren aus dem
eingefrorenen Item-Manifest, den Versiegelungszeitpunkt aus der unveraenderlichen
versiegelten Release-Zeile sowie den Hash aus dem daraus gebildeten kanonischen
Payload ab. Ein `AFTER INSERT`-Statement-Trigger validiert jeden im Batch
vorkommenden Release genau einmal vollstaendig. Dadurch bleibt ein mehrzeiliger
Owner-Insert linear in der Zahl seiner Dokumente und Releases.

Update und Delete werden auch fuer den Owner abgelehnt. Truncate ist explizit
gesperrt. Eine korrigierte Projektion benoetigt einen neuen Release beziehungsweise
eine spaetere Projektionsvertragsversion.

`kb_search_document_is_valid()` berechnet Payload, beide Vektoren, Hash und
Versiegelungszeitpunkt neu. `kb_invalid_search_document_count()` validiert jeden
betroffenen Release einmal und erkennt auch eine triggerumgehende Restore- oder
Owner-Manipulation.

Der Invalid-Zaehler verlangt keine vollstaendige Projektion jedes Release-Items.
4B-2a ist schema-only und Release v1 bleibt nicht retrievalfaehig. Eine spaetere
Release-v2-Aktivierung muss die vollstaendige Projektionsabdeckung separat
fail-closed erzwingen.

## Indizes

Der Vertrag legt an:

- B-Tree fuer normalisierten Titel innerhalb des Releases
- Praefixindex fuer kanonische Schluessel
- GIN fuer normalisierte Aliase
- GIN fuer Kennungsterme
- GIN fuer Facetten
- GIN fuer deutschen Volltext
- GIN fuer sprachneutralen Volltext

`pg_trgm` und `unaccent` werden nicht vorausgesetzt.

## Rollen und RLS

- Datenbankeigner: ausschliesslich kanonischer direkter Insert und Owner-Restore
- Administrator: RLS-gesteuertes Lesen
- authentifizierter Nicht-Admin beziehungsweise Patient: null sichtbare Zeilen
- `service_role`: Lesen und aktueller Snapshot-RPC
- `anon`, `kb_importer`, `kb_import_runtime`: kein Zugriff

Alle Payload-, Vektor-, Hash-, Schutz- und Validatorfunktionen sind fuer
Anwendungs- und Importrollen widerrufen. Es gibt keinen Such-RPC.

## Backup und Restore

Browserinventar, Edge-Inventar, Fallback, OpenAPI-Ergaenzung und Datenbank-RPC
umfassen nun exakt dieselben 56 Wiki-Tabellen.

Der Snapshot enthaelt zusaetzlich den Pflichtzaehler:

`invalid_search_documents`

Er muss exakt numerisch 0 sein.

Beim Owner-Restore wird `kb_search_documents` vor `kb_release_items` geloescht
und nach `kb_release_items` zuletzt importiert. Die beiden `tsvector`-Spalten
sind normale validierte Spalten und keine generierten Spalten. Dadurch bleibt
der generische, texttreue Import ueber `jsonb_populate_recordset` moeglich.

Der Therapie-Eingabe-Snapshot v2 bleibt unveraendert exakt vier Tabellen gross.
Sein serialisierter Rueckgabestring wird durch die neue Wiki-Tabelle nicht
veraendert.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-phase4b-2-search-document-contract.test.ts`

deckt ab:

- exakte 55-zu-56-Grenze und leere Suchtabelle
- weiterhin harte Inaktivitaet von Release v1
- Projektion von Entity-, Artikel- und Assertion-Items
- Ausschluss von Source-Items und Build-Releases
- eingefrorene Alias- und Kennungsprovenienz
- spaetere lebende Aliasdrift ohne Aenderung historischer Projektionen
- deutsche und sprachneutrale Volltextvektoren
- exakte Alias- und kollisionsfreie qualifizierte Kennungssuche
- case-sensitive sowie Doppelpunkt-enthaltende Kennungswerte
- kanonische Payloads und Hashes
- batchweise Release-Validierung ohne dokumentweise Vollrelease-Pruefung
- triggerumgehende Vektor- und Versiegelungszeitpunkt-Manipulationserkennung
- Owner-only Insert, Append-only, RLS, Rollen und Truncate-Sperre
- 56-Tabellen-Snapshot und `invalid_search_documents`
- texttreuen `tsvector`-Restore
- byteidentischen Vier-Tabellen-Therapie-Snapshot v2
- statischen Ausschluss produktiver Leser und Writer in TypeScript,
  JavaScript und SQL durch eine geschlossene Migrationsfunktionsliste und das
  Verbot direkten Tabellenzugriffs ausserhalb des Vertrags

Die historischen 4A- und 4B-1-Tests behalten ihre damaligen 52- beziehungsweise
55-Tabellen-Grenzen. Der aktuelle Produktionsinventarvertrag wird separat mit 56
Tabellen geprueft.

## Bewusste Restrisiken und Pre-Deployment-Gates

- PGlite ersetzt keinen realen PostgreSQL-Test der GIN-Ausfuehrungsplaene.
- PostgREST-OpenAPI, Service-Role-Lesen und ein echter Browser-ZIP-Export muessen
  vor Deployment gegen die Zielumgebung geprueft werden.
- Suchlatenz und Snapshotgroesse muessen vor groesserer Materialisierung mit
  realistischen Releases profiliert werden.
- Die exakten 256/1.024-Byte-, 512-KiB- und 768-KiB-Grenzen sind im SQL-Vertrag
  fail-closed, aber noch nicht mit jeder Grenzwertkombination in PostgreSQL
  belastungsgetestet.
- Ein spaeterer produktiver Leser benoetigt einen eigenen auditierbaren Vertrag,
  explizite Release-ID und unabhaengige Sicherheitsregelverarbeitung.
- Sicherheitsregeln duerfen niemals durch Volltextrelevanz ausgefiltert werden.
