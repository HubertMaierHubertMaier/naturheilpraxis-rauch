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

## Paket 1 (07.10.2026): Vernetzung-Probelauf – nur Download, nichts geschrieben
- src/lib/wikiNetworkDryRun.ts + Button „Prüfvorschläge herunterladen" (Ordnung-Startseite); Tests src/test/wiki-network-dryrun.test.ts (4, synthetisch).
- Echter Lauf: 34 Akteurvorschläge (30 Organisation, 3 Person, 1 Apotheke), 234 Rollenbeziehungen (manufactured_by/published_by/authored_by) als candidate; 1 bereits als Entität vorhanden (Radegundis); 0 Merge-Hinweise.
- Review-Befunde (vor Phase 2 zu klären): Typ-Heuristik Person/Organisation unzuverlässig („Andreas Kalcker", „Peter Römer" als Organisation; „Nutzerbereitgestellte Quelle", „Externe Fachquelle" sind keine Akteure; „Klinghardt Talks 001-025" ist Reihe/Herausgeber, nicht Person Dr. Klinghardt; „A. L. Kalcker" vs „Andreas Kalcker" mögliche Dublette ohne automatischen Hinweis; Plattformen wie Amazon/BitChute/PubMed sind Fundorte). → Typ je Akteur muss Peter/Codex festlegen; keine automatische Typisierung übernehmen.

## Paket 2 (07.10.2026): Wikidatenbank-Liste + Vorschlagsstichprobe
- /wikidatenbank: sichtbare Liste 25 je Seite (Erste/Zurück/Weiter/Letzte, oben+unten), Zähler „X Treffer von 2149 Artikeln (aktuelle Revision) · angezeigt a–b"; Mehrwortsuche weiter über den vollständig geladenen Bestand; Suchwechsel → Seite 1; Volltext je Artikel per „Volltext öffnen" (unverändert, ungekürzt). Alte Wiki unverändert.
- UI-Prüfung (Testbrowser): Laden 6,9 s; 25 Karten; Seite 2 = 26–50; Letzte = 2126–2149 (Seite 86/86); „Klinghardt Covid" = 8 Treffer, Seite 1; Volltext öffnen/schließen ok; Suche leeren → wieder 1–25.
- Teilbestand: Ladefehler auf späterer Seite bricht weiterhin mit Fehlermeldung ab (fetchAllPages-Test), keine Teilzahl als vollständig.
- Offen: kb_article_revisions lädt alle Revisionen inkl. content_markdown (nur aktuelle werden genutzt) – Optimierung möglich.
- Vorschlagsstichprobe: docs/wiki/vernetzung-vorschlag-stichprobe.json (8 Kandidaten: Mannayan, Radegundis, Nutramedix, Heel, Pascoe, Vitaplace, Klinghardt-Erythromycin, HNO-ChipCard) mit stabilem candidate_key, Revisions-ID, Fundstelle, Produktart, Beziehungen, Unsicherheit. NICHT angewendet.
- Vitaplace (07.10.2026, Codex extern geprüft): unter Apotheken als „extern geprüfte Betreiberzuordnung" (vitaplace.de, BfArM-Versandhandelsregister mit Blumenau-Apotheke, Impressum Blumenau-Apotheke); Produktlinienrolle bleibt; Artikel weiter über Ordner. Keine DB-Rolle; reversibel in EXTERNAL_PHARMACIES.

## Abschlussnachweis 07.10.2026
SQL MD5 877cc8e3a0404d7aecb051efaf23bfff, Test MD5 b54c5f08092d36d2024f2b3cf65764b6; Offline 61 PASS/0 FAIL/Exit 0; Wiki-Tests 22 PASS; Astra: letzte 3 Befunde behoben. Commit 7668d96a, GitHub-Sync unbestätigt. KEINE Anwendungsfreigabe – offen: Hosted-Fingerprint/Rollen, Backup-Integration, Import-Rollback. Vernetzung offen: 34 Akteure, 8 Kandidaten (2 vollständig/6 unvollständig). HTML 28/36, offen Ä2,11,13,31,32,33,34. Serie beendet.

## Paket 3 (07.10.2026, nach Wiederaufnahme)
- 34 Akteure redaktionell eingeordnet (Codex-Routine): 4 Personen, 2 Hersteller, 8 Anbieter, 1 Apotheke, 6 Plattformen, 10 Herausgeber/Institutionen, 3 keine Akteure. Datei docs/wiki/akteure-zuordnung.json (je Akteur Belegquellrevisionen), Modul src/lib/wikiReviewedNetwork.ts. A. L. Kalcker ≠ Andreas Kalcker zusammengeführt (keine Fundstelle).
- Stichprobe: 6/8 vollständig (Zink-Deklaration, Banderol-Herstellerzeile, Erythromycin Folge 020 16:26–18:54, HNO-ChipCard-Artikel d3cc3e16). Offen: Ochsengalle/Heel, Medacalm/Pascoe (nur Artikeltext).
- UI: /wikidatenbank/ordnung?v=reviewed – geprüft (Dateistand) getrennt von ungeprüften Kandidaten. Nichts in DB angewendet.

## Paket 4 Klinghardt-Navigator (07.10.2026)
- /wikidatenbank/ordnung?v=klinghardt: 62 Praxis-Quellenkarten aus DB (aktuelle Rev.), 6 Kapitel (13/14/7/13/9/6), Achsen Viren/Bakterien/Pilze/Metalle kombinierbar + Überschneidungsmatrix, Detail mit Fundstelle/E-ID, Originalaussage getrennt von Evidenz/Sicherheit, volle Karte unverändert. Sprachpaare 010/011, 012/013, 018/019 zählen einmal.
- Abgleich DB↔Importdatei 62/62, 0 fehlend/0 zusätzlich, Fundstellen identisch (docs/wiki/klinghardt-abgleich.json). Kompendium 586 Karten = nur Bestand, nicht importiert.

## Paket 5 (07.10.2026 ~19:45)
- PubMed/Clinical and Experimental Dental Research → zusammengesetzt_ungeklaert + 2 getrennte Kandidaten (Test).
- Strunz-Bestand nur lesend: docs/wiki/strunz-bestand-2026-10-07.json; 9/9 Produktkarten in DB (Quellrevision + Produkt), 0 fehlend; Gesamtbestand weit größer (88 Ordnerartikel, 113 Quellen mit Strunz-Bezug, 53/20/6 Staging-Kandidaten). kb_import_batches nicht lesbar.

- Vorgabe 07.10.2026: Der lesende Abgleich der 21 Strunz-Anwendungsbereich-Artikel dokumentiert eindeutige Artikel-/Revisions-IDs, Quellenfundstellen und Abfrageumfang (nicht nur Summen); keine Rechteerweiterung.

- SIBO/PGlite-Test (07.10.2026): Im Gesamtlauf 17:43 UTC fehlgeschlagen nach 6656 ms („× SIBO source import > executes without ambiguous variables and remains idempotent 6656ms“, vollständiger Fehlertext nicht erhalten; Vermutung Zeitlimit unbewiesen). Einzellauf 17:59 UTC: PASS in 2563 ms. Ursache offen; bei nächstem Gesamtlauf gezielt mit Fehlerausgabe erneut prüfen. Keine Live-SQL angewendet.

- 07.10.2026 ~18:30 UTC: 21 Strunz-Übersichtsseiten live abgerufen (alle HTTP 200) → docs/wiki/strunz-anwendungsbereiche-produkte-2026-10-07.json: 69 Kandidaten „im Anwendungsbereich gelistet“ (nur exakte URL-Treffer auf die 9 Produktkarten, je Artikel-/Revisions-ID, Position, Produktschlüssel), 149 gelistete Produkte ohne Wiki-Karte, keine Wirk-/Indikationscodes. UI: /wikidatenbank/ordnung?v=reviewed. Ochsengalle/Heel: kein Heel-Produkt mit Fel tauri D6 belegt (offen). Medacalm: Pfefferminzöl, Abtei/GSK laut Gebrauchsinformation, NICHT Pascoe.

## 2026-10-07 Strunz 53 Quellkandidaten + Pagination
- `docs/wiki/strunz-quellkandidaten-53-2026-10-07.json`: 53 echte Kandidaten-IDs (Batch ffe44e71) lesend typisiert; 27 eindeutig auf 9 Karten (je Produktseite + Form/Zielgruppe + Interaktion), 26 offen (12 Einzelstoff-, 1 Regulatorik-, 2 übergreifende Sicherheits-, 11 Auditberichte). Keine Zuordnung über gleichen Nährstoff.
- Pagination: alle 21 Listen vollständig auf Seite 1 (amountData = Produktlinks, ?p=2 ohne neue). 149 ungemappt = 136 eindeutige Produkte + 13 Varianten in 6 Gruppen (nicht zusammengeführt).
- Nächster Schritt: 136 eindeutige Produkte ohne Karte gegen bestehende kb_entities-Namen lesend auf vorhandene Karten/Dubletten prüfen.
