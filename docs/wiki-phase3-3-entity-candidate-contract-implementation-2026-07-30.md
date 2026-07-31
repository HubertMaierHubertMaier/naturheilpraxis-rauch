# Wiki Phase 3.3: Typisierter Entitaetskandidatenvertrag

Stand: 2026-07-31

Status: Schritt 2A ist mit Commit `5c9488e` auf
`publish-wiki-blueprint-20260727` committed und gepusht. Er wurde nicht nach
Supabase ausgerollt.

## Ziel

Schritt 2A schliesst die Luecke zwischen dem generischen Import-Staging und der
nachfolgenden kontrollierten Entity-Promotion. `accepted_as_draft` allein ist keine
technische Promotionsfreigabe. Ein neuer Entitaetsentwurf darf erst entstehen,
wenn ein typisierter, unveraenderlicher und quellengebundener Kandidatenvertrag
vollstaendig geprueft werden kann.

Dieser Block schreibt noch keine Entitaet, Revision, Aussage oder Relation in das
Kernwissen. Die eigentliche Promotion erfolgt getrennt in Schritt 2B.

## Migration

Datei:

`supabase/migrations/20260730140000_create_kb_entity_candidate_contract.sql`

Die Migration ist additiv und erzeugt zehn Tabellen:

1. `kb_entity_candidate_contracts`
2. `kb_entity_candidate_names`
3. `kb_entity_candidate_assertions`
4. `kb_entity_candidate_assertion_sources`
5. `kb_entity_candidate_preparation_details`
6. `kb_entity_candidate_homeopathic_details`
7. `kb_entity_candidate_botanical_details`
8. `kb_entity_candidate_nutrient_details`
9. `kb_entity_candidate_product_variant_details`
10. `kb_entity_candidate_components`

Vorhandene akzeptierte Entitaetskandidaten werden nicht still umgedeutet. Die
Migration sperrt parallele Kandidatenupdates und bricht ab, wenn bereits ein
`accepted_as_draft`-Entitaetskandidat ohne vorherige kontrollierte Konvertierung
vorliegt.

## Vertrag und Versiegelung

- Namen besitzen kontrollierte Art, Sprache, Praeferenz, Reihenfolge und eine
  versionierte Normalisierung.
- Genau eine quellengebundene Klassifikationsaussage traegt den vorgeschlagenen
  Entitaetstyp.
- Weitere Aussagen besitzen Evidenzbasis, Evidenzqualitaet, Gueltigkeit und
  primaere Fundstellen.
- Zubereitungs-, homoeopathische, botanische, Naehrstoff-, Produktvarianten- und
  Komponentenangaben spiegeln die kontrollierten Katalogdomaenen.
- Unklare chemische Form und Menge sind explizite Statuswerte und blockieren die
  Annahme; sie werden nicht geraten.
- Kombinationen benoetigen mindestens zwei verschiedene fachlich tragende
  Komponenten. Doppelte Komponenten koennen die Vollstaendigkeit nicht
  vortaeuschen.
- `NaN` und unendliche numerische Werte sind ausgeschlossen.
- Kandidatenreferenzen bleiben im selben Import-Batch; exakte Kernreferenzen
  binden Entitaet und Revision.
- Kindzeilen sind append-only. Nach der Versiegelung sind keine weiteren Zeilen
  erlaubt.
- `kb_seal_entity_candidate_contract(...)` sperrt zuerst Batch und Kandidat,
  danach alle transitiv referenzierten Kernrevisionen in stabiler Reihenfolge.
- Der SHA-256-Vertrag bindet Kandidatenfelder, Namen, Aussagen, Quellen,
  typisierte Details, Komponenten und referenzierte Hashes.
- Wiederholtes Versiegeln ist nur mit identischen Parametern und weiterhin
  gueltigen Abhaengigkeiten idempotent.

## Review und Readiness

Der bestehende Review-RPC bleibt die einzige Statusschnittstelle. Ein Wechsel zu
`accepted_as_draft` wird durch den neuen Vertragstrigger abgelehnt, wenn
deterministische Fehlercodes vorliegen. Der Reviewer verwendet dann
`needs_clarification`, `reject` oder einen Ersatzkandidaten in einem neuen Batch.

`kb_entity_candidate_promotion_readiness(uuid)` ist admin-only, schreibfrei und
liefert:

- Vertragsversion und Vertragshash
- `ready_for_promotion`
- sortierte, duplikatfreie Blockiercodes
- sortierte Warncodes

Der Pruefer verlangt unter anderem einen reviewed Batch, einen akzeptierten
Kandidaten, genau eine passende Annahmeentscheidung, einen freien kanonischen
Schluessel sowie gueltige Promotionen aller verwendeten Quellen. Noch nicht
promotete Kandidatenabhaengigkeiten bleiben ein expliziter Blocker fuer Schritt
2B.

Terminale Entscheidung, Status, Reviewer und Zeitstempel werden gemeinsam
validiert. Trigger-deaktivierte Manipulationen an Vertrag, Kandidat, Quelle oder
Audit werden durch `kb_invalid_entity_candidate_contract_count()` erkannt.

## Rollen

- `anon`: kein Zugriff
- Patient beziehungsweise authentifizierter Nicht-Admin: keine sichtbaren Zeilen
- Administrator: Lesen und Readiness-RPC, keine direkten Tabellenwrites
- `service_role`: ausschliesslich Lesen und Wiki-Snapshot
- `kb_importer`: Kindzeilen einfuegen, Vertraege kontrolliert versiegeln, kein
  Kernzugriff
- `kb_import_runtime`: wegen `NOINHERIT` nur nach kontrolliertem Rollenwechsel

## Backup und Restore

Das gemeinsame Wiki-Inventar wurde von 38 auf 48 Tabellen erweitert.

- Frontend-, Edge-, Fallback-, OpenAPI- und Datenbank-ZIP-Inventar enthalten
  dieselben Tabellen.
- Der SQL-Snapshot entdeckt `kb_*`-Tabellen zur Laufzeit. Die exakten Edge-,
  Fallback- und Restore-Inventare muessen bei Schemaaenderungen trotzdem
  aktualisiert und validiert werden.
- Fehlende oder unerwartete Tabellen beziehungsweise Manifesteintraege fuehren
  zum Abbruch.
- `invalid_entity_candidate_contracts` muss vor einem Backup 0 sein.
- Der Restore-Test enthaelt Zeilen in allen zehn neuen Tabellen und prueft die
  exakte FK-Reihenfolge sowie ein identisches SHA-256-Manifest.

Die wiederverwendbare Laufzeitpruefung liegt in:

`supabase/functions/_shared/wikiSnapshotValidation.ts`

## Verifikation

Erfolgreich ausgefuehrt:

- Wiki-Pflichtsuite: 67/67 Tests
- gesamtes Projekt: 317/317 Tests in 35 Dateien
- `npx tsc -p tsconfig.app.json --noEmit`
- `npx tsc -p tsconfig.node.json --noEmit`
- `npm run build`
- zwei unabhaengige Reviews: `APPROVE`, keine verbleibenden P1/P2-Befunde

Der Build meldet nur bereits bekannte Hinweise zu veralteten Browserslist-Daten,
`eval` in Bluebird und grossen Chunks.

## Bewusste Grenzen

- keine Entity-Promotion und keine Kernwrites
- keine echten Mittel, Produkte, Dosierungen oder medizinischen Aussagen
- keine Patienten- oder Rohbefunddaten
- keine automatische Quellenart-, Schluessel-, Potenz-, Form- oder
  Variantenauswahl
- homoeopathische Komplexpotenzen bleiben blockiert, bis das Kernmodell ihre
  komponentenspezifische Potenz verlustfrei abbilden kann
- keine Aenderung am sichtbaren Therapieempfehlungspfad
- kein Remote-Deployment oder Live-Rollbacktest ohne Supabase-Zugang

## Nachfolgeblock Schritt 2B

Schritt 2B baut ausschliesslich auf diesem Vertrag auf. Die Migration
`20260730150000_create_kb_entity_draft_promotion.sql` berechnet die Readiness
unter Locks erneut und erzeugt atomar Kernentitaet, Revision 1 als `draft`,
Namen, quellengebundene Aussagen mit exakten Quellenrevisionen, typgerechte
Details und Komponenten, kanonische Hashes und unveraenderliche
Promotionsprovenienz. Bestehende Entitaeten bleiben ein getrenntes
Revisionsverfahren.

Die lokale Schritt-2B-Implementierung erweitert Snapshot und Restore von 48 auf
50 Wiki-Tabellen und ist in
`docs/wiki-phase3-4-entity-draft-promotion-implementation-2026-07-31.md`
dokumentiert. Sie ist implementiert und verifiziert, gehoert auf den
Feature-Zweig `publish-wiki-blueprint-20260727` und wurde nicht nach Supabase
ausgerollt.
