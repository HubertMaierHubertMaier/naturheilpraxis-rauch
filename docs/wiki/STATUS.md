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
