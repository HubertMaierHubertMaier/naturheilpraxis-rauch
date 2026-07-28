# Wiki Phase 1: Additives Kernschema

Datum: 28.07.2026

## Status

Die Phase-1-Migration ist lokal implementiert, in einer echten PostgreSQL-kompatiblen PGlite-Datenbank ausgefuehrt und unabhaengig geprueft. Sie wurde noch nicht auf das Supabase-Projekt ausgerollt. Die bestehende Tabelle `public.admin_knowledge_base` und ihre Daten werden weder referenziert noch geaendert.

Migration: `supabase/migrations/20260728090000_create_kb_phase1_core.sql`

## Technische Entscheidung

Das Kernschema verwendet 17 additive Tabellen mit dem Praefix `public.kb_*`. Ein eigenes PostgreSQL-Schema wurde fuer Phase 1 bewusst nicht verwendet, damit Supabase PostgREST, die bestehenden Rollen und der Backup-Export ohne zusaetzliche Dashboard-Freigaben funktionieren.

Die Tabellen gruppieren:

- kontrollierte Entitaets-, Kennungs- und Relationstypen
- stabile Entitaeten, Namen, Kennungen und unveraenderliche Revisionen
- stabile Quellen und Quellenrevisionen
- versionierte Aussagen, Quellenbelege und typisierte Graphkanten
- lesbare Artikelrevisionen und ihre Entitaetszuordnungen
- serverseitig geschriebene Aenderungsvorschlaege

## Erzwungene Invarianten

- Neue Revisionen beginnen ausschliesslich als `draft`.
- Entitaets-, Aussagen- und Artikelrevisionen durchlaufen `draft -> domain_review -> safety_review -> approved -> released`.
- Quellenrevisionen durchlaufen `draft -> domain_review -> approved -> released`.
- Genehmigte Inhalte und ihre fachlichen Abhaengigkeiten sind unveraenderlich. Eine Bearbeitung erfordert zuerst einen getrennten Reset auf `draft` unter Loeschung der Reviewmetadaten.
- Freigegebene und historische Revisionen koennen nicht inhaltlich geaendert oder geloescht werden.
- Jede freigegebene Aussage benoetigt mindestens eine freigegebene primaere Quelle mit der Rolle `supports` oder `qualifies`.
- Der Rueckzug der letzten solchen Quelle wird am Transaktionsende blockiert. Quellenstatusaenderungen sperren alle verbundenen Aussagen statementweit in stabiler Reihenfolge.
- Graphkanten duerfen nur an Aussagen vom Typ `entity_relation` haengen.
- Graphkanten benoetigen einen aktiven Relationstyp und eine passende genehmigte Typdomaene.
- Aktive Relationstypen muessen beim Commit mindestens eine genehmigte Domaene besitzen. Der noch nicht fachlich definierte Typ `may_be_associated_with` ist inaktiv.
- Stabile Schluessel sowie die Bedeutung verwendeter Kennungs- und Relationstypen koennen nicht nachtraeglich veraendert werden.
- Anonyme Benutzer und Patienten erhalten keinen Zugriff. Direkter Zugriff ist auf Administratoren begrenzt.
- `authenticated` kann den freien JSON-Vorschlagsbereich nicht direkt einfuegen oder aendern; serverseitige Verarbeitung ueber `service_role` bleibt moeglich.

## Backup

Das Wiki-Teilbackup und die serverseitige Fallback-Liste enthalten alle 17 neuen Tabellen sowie `mannayan_products` vor `knowledge_product_links`. Eine erfolgreiche OpenAPI-Tabellenerkennung wird immer mit den 17 Pflicht-Tabellen vereinigt.

Wenn eine verlangte Tabelle nicht exportiert werden kann, antworten Teilbackup und Datenbankbackup mit HTTP 500 und einer strukturierten Fehlerliste. Ein unvollstaendiges Tabellenbackup wird nicht mehr formal als erfolgreich ausgegeben.

## Pruefnachweise

- 28/28 fokussierte Phase-1-Tests bestanden
- 239/239 Tests der Gesamtsuite bestanden
- Migration in PGlite erfolgreich ausgefuehrt
- genau 17 additive Tabellen und konservative Seeds bestaetigt
- Legacy-Tabelle und Legacy-Testzeile unveraendert
- Reviewworkflow, Composite-FKs, Relationstypdomaenen und Quellenpflicht verhaltensbasiert geprueft
- Patient-, Admin-, `anon`- und `service_role`-Zugriffe verhaltensbasiert geprueft
- TypeScript-Pruefungen fuer App und Node bestanden
- Produktionsbuild bestanden
- `git diff --check` bestanden
- unabhaengige Abschlusspruefung: `APPROVE`, keine offenen P0-/P1-Befunde

## Sichere Ausrollreihenfolge

1. Aktuelles lokales Code- und Datenbackup sowie Hashes erneut bestaetigen.
2. Ausschliesslich die additive SQL-Migration auf einer Supabase-Vorschau oder kontrolliert im Zielprojekt ausfuehren.
3. Tabellenzahl, Seeds, Trigger, RLS, Grants und den unveraenderten Bestand von `admin_knowledge_base` pruefen.
4. Supabase-TypeScript-Typen aus dem tatsaechlich migrierten Projekt neu generieren und separat pruefen.
5. Erst danach die aktualisierte Backup-Edge-Function und die Wiki-Backup-Liste ausrollen.
6. Wiki-Teilbackup und globales Datenbankbackup erzeugen; beide in isolierter Umgebung auf Vollstaendigkeit und Restore-Reihenfolge pruefen.
7. Erst nach dieser Abnahme mit der verlustfreien Wiki-Bruecke aus Phase 2 beginnen.

Wird die Edge Function vor der Migration ausgerollt, muss der Export wegen der dann fehlenden Pflicht-Tabellen absichtlich mit HTTP 500 abbrechen. Deshalb ist die Reihenfolge verbindlich.

## Restrisiken und Stopppunkt

- Es gab noch keinen echten Supabase-`db reset` oder Remote-Migrationslauf.
- Die Sperrlogik wurde nicht mit zwei echten PostgreSQL-Verbindungen unter Konkurrenz getestet. Moegliche Deadlocks sind wiederholbare Transaktionsfehler; die Quelleninvariante bleibt dabei erhalten.
- Die Edge-Fehlerantworten wurden sourcebasiert, nicht in einer laufenden Deno-Edge-Runtime getestet.
- Der Tabellenexport besitzt keinen gemeinsamen Datenbank-Snapshot ueber alle Tabellen. Waehrend der Abnahmesicherung sollen deshalb keine fachlichen Schreibvorgaenge stattfinden.
- Generierte Supabase-TypeScript-Typen werden erst nach erfolgreicher Migration aktualisiert.
- Es gibt noch keine UI und keine Phase-2-Datenmigration.

Bis zur gesonderten Ausrollfreigabe bleibt der Stand lokal und auf GitHub rein technisch vorbereitet. Die Live-Wiki bleibt unveraendert.
