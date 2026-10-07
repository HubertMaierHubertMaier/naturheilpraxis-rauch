# Wikidatenbank – technischer Stand (07.10.2026, 17:30 Berlin)

Getrennt: **Code-Prüfung** vs. **gelesene Bestandszahlen** (nur technische Wissenstabellen, keine Patiententabellen).

## Code
- `/wikidatenbank` (WikiDatenbank, admin-only, Lesemodus) neben unveränderter alter `/wissensdatenbank`.
- Artikelliste: `kb_articles` → `current_revision_id` → `kb_article_revisions`. Quellen bisher nur aus Revisions-Metadaten.
- NEU: „Quellenbelege je Aussage“ (Button im Artikel, nur lesend). Kette ausschließlich über Verknüpfungen:
  Artikel → `kb_import_core_links` (entity) → Dosis-/Sicherheits-/Beziehungskandidaten mit `subject_candidate_id` → `kb_import_core_links` (assertion) → `kb_assertion_sources` → `kb_source_revisions`. Keine Zuordnung über Titel/URL.
- Backup-Fehler `kb_import_events` existiert im aktuellen Code weiterhin (backupAreas.ts, backup-export, Testkonstante). Patch vorbereitet: `docs/wiki/backup-kb_import_events.patch` – NICHT angewendet (Edge-Function-Änderung würde automatisch bereitgestellt). `kb_import_proposal_review_events` bleibt erhalten.

## Gelesene Zahlen (Live-DB, 07.10.2026)
| Tabelle | Zeilen |
|---|---|
| kb_articles / kb_article_revisions | 2149 / 2149 |
| kb_assertions / kb_assertion_sources | 2884 / 2884 |
| kb_sources / kb_source_revisions | 282 / 282 |
| kb_import_batches | 14 |
| kb_source_candidates | 280 |
| kb_import_core_links | 5232 (1530 Artikel, 2884 Aussagen, 538 Entitäten, 280 Quellen) |
| kb_import_candidate_proposals | 0 |
| kb_article_entities | 0 |
| admin_knowledge_base (alte Wiki) | 618 |

Alle Aussagen, Belege und Quellenrevisionen haben Status `draft`, Rolle `mentions` – das sind interne Entwürfe aus dem Import, **keine** geprüften Artikel und keine Fachfreigabe.

## Offen / nächste Schritte
1. Backup-Patch freigeben → anwenden → Edge Function bereitstellen → Exportlauf prüfen (Peter/Codex).
2. Artikelliste lädt Revisionen ohne Seitenaufteilung; bei 2149 Revisionen kann die Server-Obergrenze (meist 1000 Zeilen) Einträge abschneiden – prüfen, bevor Zahlen in der Ansicht als vollständig gelten.
3. `kb_article_entities` leer → Artikel-Entitäts-Zuordnung nur über Importverknüpfungen.
4. Fachliche Prüfung der Entwürfe (Peter); keine automatische Freigabe.

## Ordnung der Wikidatenbank (Auftrag Peter, 07.10.2026 – verbindlich)
Anforderung: Einstieg über anklickbare Kästchen „Firmen & Personen“, „Mittel/Produkte“, „Pathogene“, „Symptome“, „Erkrankungen“ (+ Weitere, Ordner, Noch nicht zugeordnet); Firmen & Personen mit eigenen Kästchen Nutramedix, Heel, Dr. Klinghardt, Pascoe + alle weiteren tatsächlich vorhandenen Namen mit Suche und echten Anzahlen; Rollen (Hersteller/Herausgeber/Autor/Ordner) getrennt; Rückweg, kombinierbare Filter; Unzugeordnetes sichtbar; Zusammenhänge bidirektional; Symptom/Erkrankung/Pathogen nie vermischen; Texttreffer nur als „Treffer im Quelltext – Zuordnung noch zu prüfen“; Quellenangaben aus Hersteller-/Autorenmaterial nie als gesicherte Wirkung; Mehrfachzuordnung statt Duplikat; vollständige Listen ohne 1000er-Abschneiden; Artikel vs. Revision exakt zählen; Wiki-Artikel, interne Quellen, Importkandidaten getrennt kennzeichnen. Keine Migration/Writes/Freigaben.

Umgesetzt: `/wikidatenbank/ordnung` (admin, nur lesend). Live geprüft: 2149 Artikel = 2149 geladen, 533 Begriffe, 282 Quellen, 561 Beziehungskandidaten. Bestehende Wikidatenbank lädt jetzt seitenweise (vorher bei 1000 abgeschnitten).

Funktioniert mit echter Verknüpfung (Import, ungeprüft): Mittel ↔ Pathogen/Symptom/Erkrankung über Beziehungskandidaten (bidirektional) inkl. Quelle + Fundstelle; Firmen/Personen über Datenfelder (Herausgeber, Autor, Herstellerbegriff, Ordnername).
Nur Texttreffer: Heel (1 Titeltreffer; im Volltext 28 Artikel – Volltextsuche nicht in der Ordnung), Dr. Klinghardt-Artikel außerhalb der Talks-Quellen, Begriff→Artikel (Name im Titel).
Fehlt (Taxonomie): Artikel↔Begriff-Zuordnung (`kb_article_entities` leer), Firmenzuordnung für Mittel (nur 1 Herstellerbegriff im Bestand; Nutramedix nur als Ordner), Unterscheidung „Firma“ vs. „interne Herkunftsangabe“ bei Herausgebern (z. B. „Interne Quellen- und Sicherheitsrecherche“). Vorschlag (nicht angewendet): Tabelle `kb_actors` (Name, Art Firma/Person) + `kb_actor_links` (actor, Ziel Artikel/Begriff/Quelle, Rolle, Herkunft, Prüfstatus), Befüllung nur über Prüfvorschläge; `kb_article_entities` aus geprüften Vorschlägen füllen.
Zugriff: Alle kb_*-Tabellen haben serverseitig nur Policy `has_role(auth.uid(),'admin')` (geprüft in pg_policy); anonym/Patient erhalten serverseitig keine Zeilen, unabhängig von der Oberfläche. Ein Live-Test mit Patientensitzung wurde nicht durchgeführt.

### Präzisierung (Peter, 07.10.2026, 17:27) – verbindlich
- Heel und Pascoe = Anbieter homöopathischer Komplexmittel; gleiches Prinzip für Nutramedix und alle weiteren Anbieter/Personen. Ein Mittel = EIN zentraler Eintrag mit Mehrfachverknüpfungen (Anbieter → Mittel, Symptom → Mittel, Erkrankung → Mittel), in beide Richtungen, jeweils mit Quelle. Komplexmittel-Einstufung nur, wenn der Produktdatensatz sie trägt – nie pauschal je Anbieter. Quellenbezogene Beziehung ≠ fachliche Freigabe.
- Zusätzliche Einstiege: Vitamine, Mineralstoffe, Spurenelemente (Untergruppe der Mineralstoffe, eigener Einstieg). Stoff vs. Produkt unterscheiden; Kombinationspräparate mehrfach zuordnen; keine Angaben/Wirkungen/Dosierungen erfinden; fehlende Strukturierung sichtbar.

Umgesetzt: Kästchen Vitamine / Mineralstoffe (inkl. Spurenelemente) / Spurenelemente (Einordnung nach Stoffname, nur Nährstoff-Datensätze; nicht einordbare Nährstoffe sichtbar gelistet). Mittel-Detail: Stoff/Produkt, Anbieter (Import oder Namenstreffer), Produkte mit diesem Stoff, Symptome/Erkrankungen/Pathogene mit Quelle; Anbieter je verknüpftem Mittel. Anbieter-Detail: Produkte mit Anbieternamen im Produktnamen (Texttreffer), Volltextsuche in Artikeln (Wortgrenze, serverseitig).
Grenzen: Heel-/Pascoe-Mittel existieren im Bestand nur als Artikeltexte (Heel 28 Volltext-, 1 Titeltreffer; Pascoe 5 Volltext), nicht als Produktdatensätze → keine strukturierte Anbieter→Mittel→Symptom-Kette möglich, bis Produkte als Begriffe angelegt sind. Produkt→Inhaltsstoff ist überwiegend nicht strukturiert (nur „enthält“ Produkt→Pflanze, 16); Stoff→Produkt sonst nur über Produktnamen (Texttreffer). Anbieter mit mehrteiligem Firmennamen (z. B. „Mannayan GmbH & Co. KG“, „FOREVER YOUNG“) werden nicht automatisch mit Produktnamen verbunden. Benötigt (Vorschlag, nicht angewendet): Produktbegriffe für Heel/Pascoe/Nutramedix aus den Artikeln über Prüfvorschläge anlegen; Beziehungen „manufactured_by“ und „contains“ (Produkt→Stoff) als Prüfvorschläge; Produktmerkmal „Komplexmittel“ als Datenfeld.

## Rubrik „Ärztliche Mittel / Arzneimittel" (Peter, 07.10.2026)
- Eigenes Einstiegskästchen. Einstufung nur bei ausdrücklicher Datensatzangabe (Begriffstyp drug/medication/medicinal_product oder hinterlegte Art „Arzneimittel/Medikament"); keine Einstufung aus Erwähnung (auch nicht in Klinghardt-Unterlagen) oder Namen.
- Verschreibungsstatus nur aus hinterlegtem Feld, sonst „unklar". Kategorie = Wissensnavigation, keine Verordnung/Anwendungsfreigabe.
- Bestand 07.10.2026: 0 strukturierte Arzneimittel (kein solcher Begriffstyp, 0 PZN/ATC-Kennungen). Klinghardt: 62 interne Quellen, Mittel darin nur als Quelltext (z.B. Quellentitel nennen Erythromycin, Fluoxetin).
- Sichtbar statt versteckt: Hinweis auf Lücke, Link zu Dr. Klinghardt, Volltextsuche in Klinghardt-Artikeln als „Treffer im Quelltext".
- Nötig für echte Vernetzung (nicht umgesetzt, Migration/Schreibzugriff): Arzneimittel-Einträge aus Klinghardt-Quellen über Prüfvorschläge, Feld Produktart + Verschreibungsstatus mit Quelle, Verknüpfungen zu Symptom/Erkrankung/Anbieter/Quelle.

## Rubrik „Apotheken" (Peter, 07.10.2026)
- Eigene Rolle „Apotheke", getrennt von Hersteller/Autor; Mehrfachrolle nur aus Daten (Radegundis Apotheke: Herstellerbegriff + Herausgeber + Apotheke).
- Apotheke = Name eines Akteurs enthält ein Wort „…apotheke"; generisches „Apotheke(n)" zählt nicht.
- Im Artikeltext genannte Apotheken (Schlossapotheke Koblenz, Burgapotheke – Klinghardt-Covid-Artikel) nur als „Treffer im Quelltext", ohne Datensatz/Produktverknüpfung.
- Bestand 07.10.2026: 1 strukturiert erfasst, 2 nur im Text. Keine Platzhalter.

## Rubriken „Mannayan-Produkte" und „ChipCards" (Peter, 07.10.2026)
- Schreibweise bestätigt aus Herstellerfeld und Quellen-Herausgeber: „Mannayan GmbH & Co. KG"; Suchbegriff „Mannayan" als Alias. Produkte über das gespeicherte Herstellerfeld mit dem Hersteller verknüpft (Datenfeld, beidseitig). 57 Produkte; Themen/Symptome dazu im Bestand nicht verknüpft (sichtbar als „keine zugeordnet").
- ChipCards: nur Programm-Datensätze mit „ChipCard/Chipcard/Chip" im eigenen Namen (7), Typ bleibt „Programm"; keine Arzneimittel-/Wirksamkeitseinstufung. 151 Artikel im Ordner/Titel „Chip Cards" als Datenfeld; die meisten ChipCards existieren nur als Artikel, nicht als Datensatz. Weitere Programme ohne ChipCard im Namen (DTX-Card, Derma-Clean …) sichtbar „nicht eingeordnet".

## WICHTIG (Peter, 07.10.2026): Kästchen ≠ fertige Vernetzung
Die Ordnung ist eine Navigationsschicht (Ordner, Datenfelder, Texttreffer). kb_entity_relations = 0, kb_article_entities = 0. Weiterer Aufbau: siehe docs/wiki/VERNETZUNG-PLAN.md (Plan) und docs/wiki/vernetzung-migration-A.sql (Entwurf, NICHT angewendet). Codex plant/prüft, Lovable setzt um; jede Phase einzeln freigeben.
