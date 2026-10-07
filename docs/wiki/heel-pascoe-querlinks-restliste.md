# Heel/Pascoe + Querlinks Symptome/Erkrankungen – nicht begonnen (Budgetstopp)

Stand 2026-10-07 22:26 UTC. Creditstand frisch 59,22; Hardstop 51,51 → ~7,7 Spielraum.
Paket nicht begonnen, keine Code-/DB-Änderungen. Übergabe an Codex autorisiert.

## Auftrag (vollständig, offen)
1. Lesend: aktuelle kb_entities/kb_entity_revisions, kb_entity_relations (manufactured_by, indicated_for, sonstige Symptom-/Erkrankungsrelationen) samt Assertions/Quellen, passende Mittelartikel. Keine Patiententabellen.
2. Heel und Pascoe getrennt; Firmen-ID nur über konkrete Felder/Quellen. Hersteller ≠ Herausgeber/Autor/Vertreiber; gemeinsame Nennung ≠ Zuordnung. Produktart aus Datensatz, nicht pauschal „homöopathisches Komplexmittel“.
3. Widersprüche erhalten: Medacalm nicht Pascoe ohne Beleg (Befund Abtei/GSK); Ochsengalle/Fel tauri D6 Hersteller offen, nicht Heel. Keine Rezeptur/Inhaltsstoff/Produkt/Synonym-Gleichsetzung.
4. Navigation beidseitig (lesend, bestehende wikiTaxonomy: manufacturerField, manufactured_by, actorsOfEntity, neighbours): Firma→Mittel; Mittel→Anbieter+Symptome/Erkrankungen; Symptom→Mittel+Anbieter; Erkrankung→Mittel+Anbieter. A–Z-Kacheln, Relation/Quelle/Fundstelle/Status erreichbar; Symptom vs Erkrankung getrennt, gleichnamige nicht zusammenlegen; Vorschläge ≠ bestätigte Relationen; keine Doppelanzeigen.
5. Abgleich/Belegliste als Projektartefakt (nicht in Clientbundle). Keine DB-Writes/Migration/Auth/Publikation. Tests: beide Richtungen, Herstelleraliase, Symptom vs Erkrankung, fehlende Relation/Quelle, Dedup.
6. Abschluss: Counts je Firma (Mittel / gespeicherte Relationen / Prüfkandidaten / offene Hersteller).

## Weiterhin offen aus Vorpaketen
- Buhner: Aliasliste 46 Mittelnamen / 143 Erreger, Pflanzenartikel lesen, Artikelquellen abfragen, Anzeige beidseitig.
- Detaillisten (Belegquellen, Strunz-Unterlisten) noch Textzeilen; Browserprüfung 14 Online-Vergleiche; Vieva-Folien im Browser; STATUS.md fortschreiben.
