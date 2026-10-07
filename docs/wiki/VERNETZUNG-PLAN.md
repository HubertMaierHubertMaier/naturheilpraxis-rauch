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
  - Quellen-publisher/authors → organization/person → Rolle author/publisher in **kb_source_actors** (Quellenrevision↔Akteur, revisionsfest, Review nur über `kb_review_source_actor`). Keine Relationstypen authored_by/published_by (Quelle ist keine Entität).
  - Ordner (Buhner, Homotoxikologie, Strunz, Auerswald, Vitaplace, Sanum, Schüsslersalze, Chip Cards, Nutramedix …) → nur **Kandidaten** für Artikel↔Begriff, nicht automatisch.
  - Peter-Kästchen: Heel, Pascoe, Nutramedix, Dr. Klinghardt, Mannayan, Radegundis Apotheke, Schlossapotheke Koblenz, Burgapotheke, Dr. Strunz, Buhner, Martin Auerswald, SchnellEinfachGesund (organization, getrennt von Auerswald), Vitaplace (organization/Produktlinie, Apothekenrolle unbelegt), Bio-Diagnostik.
  - Verfahren: Homotoxikologie, Sanum-Therapie, Schüssler-Salze → therapy_method; Biodiagnostik → diagnostic_method (Name „Biodiagnostik", Alias „Bio-Diagnostik").
  - ChipCards → program (Typ bleibt); Arzneimittel → product mit Feld `product_kind` + `prescription_status` (nur mit Quelle, sonst null = unklar).
- **Dubletten-/Synonymregeln:** normalized_name = lower + NFKD ohne Diakritika + Nicht-Alnum→Leerzeichen; Firmenzusätze (GmbH, & Co. KG, AG) nur für Abgleich entfernen, nie im Anzeigenamen. Treffer gleicher normalized_name + gleicher Typ → Merge-**Vorschlag**, nie Auto-Merge. Aliase nur mit erlaubten name_kind-Werten (preferred, abbreviation, scientific, trade, historical, spelling_variant): Viatplace, Bio-Diagnostik, Schüßler/Schüssler → `spelling_variant`; Mannayan (Kurzform von Mannayan GmbH & Co. KG) → `abbreviation`; „Einfach Schnell Gesund" → `spelling_variant` von SchnellEinfachGesund. UI-Label „auch geschrieben als". Person ≠ Organisation ≠ Plattform auch bei Namensnähe (Auerswald ≠ SchnellEinfachGesund). Kennungen (PZN/ATC/GTIN) nur aus Quelle.

## 2. Typisierte bidirektionale Beziehungen (Ziel 2)
- Entität↔Entität: kb_entity_relations (gerichtet gespeichert, beidseitig abgefragt; is_symmetric für alternative_to/interacts_with). Domänen ergänzen: product→nutrient/substance/plant `contains`, product→organization `manufactured_by`/`offered_by`, product/substance→symptom/disease `indicated_for`/`may_support`, product→pathogen `targets_pathogen`.
- „Quelle beschreibt Produkt bei Symptom" = Assertion (claim + Quelle/Fundstelle) mit Relation product→symptom; Wortlaut „laut Quelle".
- Artikel↔Begriff: kb_article_entities (role ∈ about | mentions | recommends | warns_about | source_for). UI-Mapping: about=Hauptthema, mentions=erwähnt, recommends=„laut Artikel empfohlen", warns_about=„Warnhinweis", source_for=„Quelle für". Art des Begriffs (Produkt/Anbieter/Symptom/…) kommt aus entity_type_code, nicht aus der Rolle.

## 3. Herkunft je Beziehung (Ziel 3)
Jede Relation → assertion → assertion_sources(source_revision_id, locator, original_quote, is_primary). Herkunft `origin_type` ∈ {human, import, parser, ai} (Kernschema). Texttreffer sind KEINE Assertion, sondern bleiben Kandidat. Texttreffer bleiben in kb_relation_candidates (status imported_unreviewed) bis Review; UI zeigt sie weiter als „Treffer im Quelltext".

## 4. Revisionen (Ziel 4)
kb_article_entities hängt an article_revision_id. Anzeige: Zuordnung an aktueller Revision = gültig; nur an älterer Revision = „veraltet – an Rev. N belegt, zu prüfen". Neue Revision übernimmt Zuordnungen nur per Review. Quellenbeleg zeigt immer die belegende source_revision, auch wenn neuere existiert.

## 5. Widerspruch/Verneinung (Ziel 5)
Keine allgemeinen Etiketten wie „hilft / hilft nicht“. Zwei getrennte Ebenen:
- **Aussage:** konkreter Wortlaut (`claim_text`) + Beziehungstyp (z. B. `contains`, `manufactured_by`, `offered_by`, `indicated_for`). Optional `metadata.claim_polarity` ∈ {affirmed, negated} = ob dieser Wortlaut die Beziehung bejaht oder verneint („Produkt X enthält kein Zink“, „wird nicht von Y hergestellt“). Fehlt der Schlüssel: „nicht klassifiziert“. Altbestand unverändert.
- **Haltung der Quelle zu genau dieser Aussage:** `source_role` → UI „Quelle unterstützt diese Aussage“ (supports), „Quelle widerspricht dieser Aussage“ (refutes), „Quelle schränkt diese Aussage ein“ (qualifies), „Quelle erwähnt“ (mentions).
- `supports` ist **kein klinischer Nachweis**, nur Quellenhaltung. Wirk-/Anwendungsbegriffe erscheinen nur, wo der Beziehungstyp selbst eine Anwendungsangabe ist (indicated_for, may_support: „laut Quelle angegeben bei …“). Bei nicht medizinischen Beziehungen (Hersteller, Anbieter, Inhaltsstoff, Autor) nie ein Wirklabel.
- Beispiele: Quelle belegt „X enthält kein Zink“ = contains + negated + supports. Quelle bestreitet „X enthält Zink“ = contains + affirmed + refutes.
- Widerspruch zwischen zwei Aussagen: append-only `kb_assertion_conflicts`; beide bleiben sichtbar. Quellenprüfstatus ≠ Fachfreigabe.

## 6. Suche/Zähler (Ziel 6)
Weiter fetchAllPages + exact count; Zähler je Kästchen getrennt nach geprüft / ungeprüft / Kandidat. Bereiche „ohne Zuordnung" und „Kandidat ohne Review" bleiben. Serverseitige Volltextsuche (bestehend) für Kandidatenerzeugung.

## Kästchen-Abdeckung im Zielmodell
Firmen & Personen, Apotheken, Mannayan, Vitaplace, Heel, Pascoe, Nutramedix, Klinghardt, Strunz, Buhner, Auerswald, SchnellEinfachGesund → person/organization + Rollenrelationen. Mittel/Produkte, Arzneimittel, ChipCards, Vitamine/Mineralstoffe/Spurenelemente → product/program/nutrient + contains. Homotoxikologie, Sanum, Schüssler-Salze, Biodiagnostik → therapy_/diagnostic_method. Symptome/Erkrankungen/Pathogene → bestehende Typen, strikt getrennt.

## Phasen (je Phase Freigabe)
1. Migration A (nur additiv, Patch `docs/wiki/vernetzung-migration-A.sql`): Typen person/organization und Relationstyp offered_by **inaktiv**, vollständiger Domänenplan als draft, kb_source_actors, kb_assertion_conflicts; product_kind/prescription_status als metadata-Schlüssel. Aktivierung erst in eigener Migration: Domäne approved + is_active=true in einer Transaktion (Constraint-Trigger prüft beim COMMIT). Offline-Testprotokoll: `docs/wiki/migration-A-testprotokoll.md`.
2. Kandidatenerzeugung (nur kb_*_candidates, Batch mit eigener batch_id): Akteure aus Feldern, Aliase, Ordner/Text → Artikel↔Begriff-Kandidaten.
3. Review in UI (kb_review_import_candidate_proposal) → Materialisierung in kb_entity_relations/kb_article_entities nur nach Peters Entscheidung.
4. UI liest primär echte Relationen, Kandidaten getrennt.

## Rücksetzkonzept (an reale Statusregeln angepasst)
- Importbatches: erlaubt sind nur created/processing/ready_for_review/reviewed/failed/cancelled; reviewed/failed/cancelled sind terminal, ready_for_review→cancelled ist verboten. Einen „verworfen"-Status gibt es nicht. Ein abgeschlossener Batch wird **nie** umgestellt.
- Rücknahme = eigener, auditierbarer **Rücknahmebatch** (created→processing→ready_for_review→reviewed) mit Begründung in dessen metadata; er referenziert die zurückzunehmenden Objekte.
- Materialisierte Entitätsrelationen: kb_entity_relations hat kein metadata-Feld. Herkunft liegt an der tragenden Assertion (`kb_assertions.metadata.import_batch_id`) und an `kb_import_core_links`. Rücknahme = neue Assertion-Version bzw. Statusübergang über den bestehenden Review-Workflow (released→withdrawn/superseded, durch kb_protect_reviewed_record erlaubt), kein DELETE.
- kb_source_actors: Genehmigung (Notiz, Prüfer, Zeit) ist nach `kb_review_source_actor(id, notiz)` unveränderlich. Rücknahme = eigenes append-only Ereignis über `kb_withdraw_source_actor(id, grund)` in `kb_source_actor_withdrawals` (Grund, Person, Zeit; je Zuordnung höchstens eins). Wirksamer Status = approved ohne Rücknahmeereignis. Ersatz als neue Zeile mit supersedes_id. Löschen nur im Entwurf.
- Migration A rein additiv; Rückweg: neue Typen bleiben inaktiv.
- Backup: siehe Abschnitt „Backup-Inventar".

## Backup-Inventar
Neue Tabellen `kb_source_actors`, `kb_source_actor_withdrawals`, `kb_assertion_conflicts`:
- Isolierter Export `kb_export_source_network()` und kontrollierter Restore `kb_restore_source_network(jsonb)`, beide nur service_role. Restore prüft vor jedem Insert alle drei Pflichtarrays (fehlend/null/kein Array = Abbruch), Manifestanzahl und ID-Prüfsumme je Tabelle sowie Rücknahme→Zuordnung; nur in leere Tabellen; Abbruch atomar ohne Restzeilen; ordnet supersedes-Ketten Eltern vor Kindern, übernimmt Prüfnachweise und Rücknahmeereignisse unverändert (Restore-Modus gilt nur innerhalb der Funktion; für authenticated wirkungslos).
- Eintrag ins feste Inventar als vorbereiteter Patch `docs/wiki/backup-kb_source_actors.patch` (nicht angewendet; Edge-Code ginge automatisch live). Reihenfolge: Migration A → Patch kb_import_events + dieser Patch prüfen → synthetischer Export/Restore im Backup-Lauf → erst dann Befüllung.

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
Vergleichsansicht „Krankheit ist messbar": Peters Stand 28/36 übernommen inkl. Ä35 (ersetzt Ä8) und Ä36 (ersetzt Ä5); Entscheidungen nur browserlokal (Fortschrittsbericht als Sicherung). Ä3 und Ä4 sind übernommen. Roh offen: Ä2, Ä8, Ä11, Ä13, Ä31, Ä32, Ä33, Ä34; Ä8 ist durch übernommene Ä35 ersetzt, Ä5 durch Ä36 → **wirksam offen: Ä2, Ä11, Ä13, Ä31, Ä32, Ä33, Ä34** (Ä33 optionale Alternative). Alle Entscheidungen bleiben erhalten.
