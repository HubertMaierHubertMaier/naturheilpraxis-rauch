# Plan: echte Vernetzung der Wikidatenbank (Entwurf zur Prüfung, Stand 07.10.2026)

Status: NUR PLAN. Keine Migration, keine produktiven Zuordnungswrites. Die Kästchen-Ordnung (/wikidatenbank/ordnung) ist eine Navigationsschicht über Ordnern, Datenfeldern und Texttreffern – **keine fertige vernetzte Datenbank**.
Rollen: Codex plant/prüft, Lovable setzt um. Jede Phase einzeln von Peter freigeben.

## 0. Ist-Schema (gelesen 07.10.2026, Hosted)
| Tabelle | Zeilen | Eignung |
|---|---|---|
| kb_entities (+ _revisions, _names, _identifiers) | 533 Entitäten, 533 Namen, 0 Kennungen | stabile UUID + canonical_key vorhanden → Ziel (1) |
| kb_entity_types | u.a. manufacturer, pharmacy, laboratory, publisher, product, product_variant, substance, plant, nutrient, symptom, disease, pathogen, therapy_method, diagnostic_method, device, program, protocol | **fehlt: person, organization (allg.)**; pharmacy existiert, ungenutzt |
| kb_relation_types | manufactured_by, contains, targets_pathogen, indicated_for, may_support, manifests_as, measured_by, may_indicate, part_of_protocol, alternative_to, contraindicated_for, interacts_with, affects_organ, may_be_associated_with | **fehlt: offers/sells (Anbieter führt Produkt), authored_by, published_by, described_in** |
| kb_relation_type_domains | Typ-Domänen mit review_status | erzwingt erlaubte Subjekt/Objekt-Typen |
| kb_entity_relations | **0** | jede Zeile hängt an `assertion_id` → Ziel (2)+(3) bereits strukturell erzwungen |
| kb_assertions (+ _sources) | 2884 / 2884 | claim, version_no, supersedes, evidence_basis/quality, review_status; Quelle mit source_revision_id, locator, original_quote, is_primary → Ziel (3)(5) |
| kb_article_entities | **0** | Schlüssel article_revision_id + entity_id + role → Ziel (4) (revisionsgebunden) |
| kb_relation_candidates / kb_entity_candidates | 561 / … | Kandidatenebene für Texttreffer/Importvorschläge |
| kb_change_proposals, kb_review_decisions | 0 Einreichungen | Prüfworkflow vorhanden |
RLS: alle kb_*-Tabellen `has_role(auth.uid(),'admin')` (ALL). Bleibt unverändert; neue Tabellen identisch + GRANT nur authenticated/service_role, kein anon.

**Fazit:** Das Kernschema deckt (2)–(5) weitgehend ab. Es fehlt v.a. Befüllung über den Prüfworkflow plus wenige Ergänzungen.

## 1. Zentrale Einträge (Ziel 1)
- Neue Entitätstypen: `person`, `organization`. Rollen NICHT als Typ, sondern als Beziehung: `manufactured_by`, `offered_by` (Apotheke/Händler führt Produkt), `authored_by`, `published_by`. Damit Mehrfachrolle (Radegundis: Hersteller + Herausgeber + Apotheke) ohne Duplikat.
- Mapping Ist → Ziel:
  - Herstellerfeld `metadata.proposed_data.manufacturer` (57× „Mannayan GmbH & Co. KG") → 1 organization + 57 `manufactured_by`.
  - Quellen-publisher/authors → organization/person + `published_by`/`authored_by` an der **Quellen**-Entität (Quelle bleibt kb_sources; Verknüpfung über neue Tabelle kb_source_actors, s. Patch).
  - Ordner (Buhner, Homotoxikologie, Strunz, Auerswald, Vitaplace, Sanum, Schüsslersalze, Chip Cards, Nutramedix …) → nur **Kandidaten** für Artikel↔Begriff, nicht automatisch.
  - Peter-Kästchen: Heel, Pascoe, Nutramedix, Dr. Klinghardt, Mannayan, Radegundis Apotheke, Schlossapotheke Koblenz, Burgapotheke, Dr. Strunz, Buhner, Martin Auerswald, SchnellEinfachGesund (organization, getrennt von Auerswald), Vitaplace (organization/Produktlinie, Apothekenrolle unbelegt), Bio-Diagnostik.
  - Verfahren: Homotoxikologie, Sanum-Therapie, Schüssler-Salze → therapy_method; Biodiagnostik → diagnostic_method (Name „Biodiagnostik", Alias „Bio-Diagnostik").
  - ChipCards → program (Typ bleibt); Arzneimittel → product mit Feld `product_kind` + `prescription_status` (nur mit Quelle, sonst null = unklar).
- **Dubletten-/Synonymregeln:** normalized_name = lower + NFKD ohne Diakritika + Nicht-Alnum→Leerzeichen; Firmenzusätze (GmbH, & Co. KG, AG) nur für Abgleich entfernen, nie im Anzeigenamen. Treffer gleicher normalized_name + gleicher Typ → Merge-**Vorschlag**, nie Auto-Merge. Aliase als kb_entity_names(name_kind='alias'): Mannayan, Einfach Schnell Gesund, Viatplace, Bio-Diagnostik, Schüßler/Schüssler. Person ≠ Organisation ≠ Plattform auch bei Namensnähe (Auerswald ≠ SchnellEinfachGesund). Kennungen (PZN/ATC/GTIN) nur aus Quelle.

## 2. Typisierte bidirektionale Beziehungen (Ziel 2)
- Entität↔Entität: kb_entity_relations (gerichtet gespeichert, beidseitig abgefragt; is_symmetric für alternative_to/interacts_with). Domänen ergänzen: product→nutrient/substance/plant `contains`, product→organization `manufactured_by`/`offered_by`, product/substance→symptom/disease `indicated_for`/`may_support`, product→pathogen `targets_pathogen`.
- „Quelle beschreibt Produkt bei Symptom" = Assertion (claim + Quelle/Fundstelle) mit Relation product→symptom; Wortlaut „laut Quelle".
- Artikel↔Begriff: kb_article_entities (role: hauptthema | erwähnt | produkt | anbieter | symptom | erkrankung | pathogen).

## 3. Herkunft je Beziehung (Ziel 3)
Jede Relation → assertion → assertion_sources(source_revision_id, locator, original_quote, is_primary). Herkunft `origin_type` ∈ {import, manual, text_candidate}. Texttreffer bleiben in kb_relation_candidates (status imported_unreviewed) bis Review; UI zeigt sie weiter als „Treffer im Quelltext".

## 4. Revisionen (Ziel 4)
kb_article_entities hängt an article_revision_id. Anzeige: Zuordnung an aktueller Revision = gültig; nur an älterer Revision = „veraltet – an Rev. N belegt, zu prüfen". Neue Revision übernimmt Zuordnungen nur per Review. Quellenbeleg zeigt immer die belegende source_revision, auch wenn neuere existiert.

## 5. Widerspruch/Verneinung (Ziel 5)
Assertion-Feld `polarity` ∈ {affirms, negates, uncertain} + `contradicts_assertion_id` (Patch). Beide Aussagen bleiben sichtbar. review_status der Quelle ≠ Fachfreigabe; „angegeben für (laut Quelle)" nie als Wirkung formulieren.

## 6. Suche/Zähler (Ziel 6)
Weiter fetchAllPages + exact count; Zähler je Kästchen getrennt nach geprüft / ungeprüft / Kandidat. Bereiche „ohne Zuordnung" und „Kandidat ohne Review" bleiben. Serverseitige Volltextsuche (bestehend) für Kandidatenerzeugung.

## Kästchen-Abdeckung im Zielmodell
Firmen & Personen, Apotheken, Mannayan, Vitaplace, Heel, Pascoe, Nutramedix, Klinghardt, Strunz, Buhner, Auerswald, SchnellEinfachGesund → person/organization + Rollenrelationen. Mittel/Produkte, Arzneimittel, ChipCards, Vitamine/Mineralstoffe/Spurenelemente → product/program/nutrient + contains. Homotoxikologie, Sanum, Schüssler-Salze, Biodiagnostik → therapy_/diagnostic_method. Symptome/Erkrankungen/Pathogene → bestehende Typen, strikt getrennt.

## Phasen (je Phase Freigabe)
1. Migration A (nur additiv, Patch `docs/wiki/vernetzung-migration-A.sql`): Typen, Relationstypen, Domänen, kb_source_actors, assertion polarity/contradicts, product_kind/prescription_status als metadata-Schlüssel (kein neues Pflichtfeld).
2. Kandidatenerzeugung (nur kb_*_candidates, Batch mit eigener batch_id): Akteure aus Feldern, Aliase, Ordner/Text → Artikel↔Begriff-Kandidaten.
3. Review in UI (kb_review_import_candidate_proposal) → Materialisierung in kb_entity_relations/kb_article_entities nur nach Peters Entscheidung.
4. UI liest primär echte Relationen, Kandidaten getrennt.

## Rücksetzkonzept
- Jeder Schritt in eigenem kb_import_batches-Eintrag; Rücknahme = Batch auf „verworfen", Kandidaten bleiben als Audit (Trigger kb_protect_import_audit_row verhindern Löschung).
- Materialisierte Relationen tragen batch_id in metadata → gezielte Rücknahme per neuer Assertion-Version (supersedes) statt DELETE.
- Migration A rein additiv; Rückweg: neue Typen auf is_active=false.
- Vor Phase 2/3: Backup-Export (Patch kb_import_events vorher anwenden!).

## Synthetische Tests (vor jeder Phase, ohne Echtdaten)
Fixtures mit erfundenen Namen (z.B. „Testfirma Alpha GmbH", „Teststoff X"):
- Dublette „Alpha GmbH" vs „Alpha" → Merge-Vorschlag, kein Auto-Merge; Person „Alpha" ≠ Organisation.
- Mehrfachrolle Hersteller+Apotheke ohne zweite Entität.
- Relation ohne Assertion/Quelle → abgelehnt; Texttreffer bleibt Kandidat.
- Zuordnung an alter Revision → „veraltet".
- negates + affirms zur selben Relation → beide sichtbar.
- Domäne verletzt (symptom contains product) → Trigger lehnt ab.
- Zähler exakt bei 2500 Fixture-Zeilen (Pagination).
- RLS: anon/Patient sehen 0 Zeilen.

## Wiedereinstieg HTML (gesichert, keine weitere Inhaltsarbeit)
Vergleichsansicht „Krankheit ist messbar": Peters Stand 28/36 übernommen inkl. Ä35 (ersetzt Ä8) und Ä36 (ersetzt Ä5); Entscheidungen nur browserlokal (Fortschrittsbericht als Sicherung). Offen: Ä2, Ä3, Ä4, Ä11, Ä13, Ä31, Ä32, Ä33 + Extra-Prüfpunkte.
