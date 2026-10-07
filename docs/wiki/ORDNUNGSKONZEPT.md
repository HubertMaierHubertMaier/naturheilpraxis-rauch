# Ordnungskonzept Wikidatenbank (Stand 07.10.2026, Peter Rauch)

Nur lesend, nur Admins. Keine Datenwrites, Migrationen, Freigaben oder Veröffentlichungen. Alte Wiki-Inhalte (admin_knowledge_base) bleiben unverändert.

## Grundsätze
- Ein zentraler Eintrag je Mittel/Begriff/Artikel; Mehrfachzuordnung statt Duplikat; alle Kästchen führen auf dieselben Einträge.
- Verknüpfungsqualität immer sichtbar: „Importverknüpfung, ungeprüft" (echte Beziehung), „Datenfeld" (Ordner, Herausgeber, Autor, Herstellerfeld, Begriffstyp), „Treffer im Quelltext – Zuordnung noch zu prüfen" (Titel/Volltext).
- Bidirektional nur über echte Beziehungen: Mittel ↔ Symptom/Erkrankung/Pathogen (getrennt), Mittel ↔ Anbieter, Stoff ↔ Produkt.
- Quellen-/Hersteller-/Autorenangaben ≠ bestätigte Wirksamkeit; Kategorien sind Wissensnavigation, keine Verordnung.
- Fehlendes sichtbar („keine Zuordnung", „nicht eingeordnet", „Noch nicht zugeordnet"), nichts erfunden, nichts ausgeblendet. Vollständiges seitenweises Laden, Serverzählung vs. geladen getrennt.

## Rollen/Kategorien (bleiben getrennt)
| Rolle | Kästchen | Regel |
|---|---|---|
| Firma/Person (Hersteller, Herausgeber, Autor, Ordner, Apotheke) | Firmen & Personen, Apotheken, Dr. Strunz, Buhner, Martin Auerswald | nur Datenfelder; Mehrfachrolle nur aus Daten |
| Plattform/Herausgeber | SchnellEinfachGesund | Schreibweise laut Quelle; Alias „Einfach Schnell Gesund"; nicht mit Auerswald gleichgesetzt (Quellen: Auerswald = creator auf der Plattform) |
| Therapieansatz | Homotoxikologie, Sanum-Therapie, Schüssler-Salze | Ordner = Datenfeld, Titel = Texttreffer |
| Diagnostik | Biodiagnostik | Bestand: „Bio-Diagnostik" (1 Quelle, Herausgeber); Begriff nicht ersetzt |
| Produktlinie | Mannayan-Produkte, Vitaplace | Mannayan über Herstellerfeld „Mannayan GmbH & Co. KG" (57); Vitaplace über Ordner (26) – keine Apothekenrolle belegt |
| Programm | ChipCards | nur Programm-Datensätze mit ChipCard/Chip im Namen (7), 151 Ordnerartikel; keine Arzneimittel-/Wirkungseinstufung |
| Stoffklasse | Vitamine, Mineralstoffe (inkl.), Spurenelemente | nur Typ Nährstoff, nach Stoffname; Rest sichtbar „nicht eingeordnet" |
| Arzneimittel | Ärztliche Mittel / Arzneimittel | nur ausdrückliche Datensatzangabe; Rx nur aus Feld, sonst „unklar"; Bestand 0 |
| Apotheke | Apotheken | Name enthält „…apotheke"; Radegundis (Datensatz), Schlossapotheke Koblenz + Burgapotheke (nur Text) |
| Begriffsgruppen | Mittel/Produkte, Pathogene, Symptome, Erkrankungen, Weitere | nach Begriffstyp |

## Bestand je Themenkästchen (07.10.2026)
Buhner: Ordner 27 · Homotoxikologie: Ordner 18 · Dr. Strunz: Ordner (inkl. Importordner) 88, 9 Quellen Herausgeber/Autor, 1 Begriff · Biodiagnostik: 1 Quelle · Sanum: Ordner 1, Volltext 15 · Schüssler-Salze: Ordner 1 · Martin Auerswald: Ordner 12 · SchnellEinfachGesund: Importordner 1472, 1 Quelle · Vitaplace: Ordner 26.
„Viatplace Apotheke": im Bestand nicht vorhanden; nur „Vitaplace" ohne belegte Apothekenrolle.

## Lücken (nur über Prüfvorschläge/Migration lösbar, nicht umgesetzt)
kb_article_entities leer → Artikel nicht strukturiert mit Symptom/Erkrankung verknüpft; Heel/Pascoe/Nutramedix/Klinghardt-Mittel und ChipCard-Artikel ohne eigene Einträge; keine Arzneimittel-/Rx-/Komplexmittel-Felder; Akteurtabelle (kb_actors/kb_actor_links) fehlt.
