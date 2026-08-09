# WikiDatenbank Lovable Handoff

## Ziel

Die neue WikiDatenbank wird parallel zur bestehenden Wiki eingefuehrt. Die alte
Route bleibt unveraendert und darf erst nach Peters ausdruecklicher Abnahme
entfernt werden.

## Gesicherter Stand

- Branch: `db-step7d-20260808-integration-preflight`
- Parallelansicht: Commit `ade6104`
- Dokumentationsabgleich: Commit `f47520e`
- Neue Route: `/wikidatenbank`
- Alte Route: `/wissensdatenbank`
- Lokaler Staging-Einstieg: `http://127.0.0.1:4173/wiki-staging.html`
- Produktionsbuild: bestanden
- Beide lokalen Routen: HTTP 200

## Sicherheitsgrenzen

- Die neue Ansicht ist admin-geschuetzt und read-only.
- Es gibt in der neuen Ansicht keine Speichern-, Loesch- oder Importaktion.
- Alte Wiki, alte Route und alte Daten bleiben unveraendert.
- Keine Produkt- oder Indikationsmappings wurden erzeugt.
- Form-, Populations-, Interaktions- und Sicherheitsgates bleiben offen.

## Lovable-Schritte

1. Im Lovable-Projekt anmelden.
2. Den Branch `db-step7d-20260808-integration-preflight` als Vorschau pruefen.
3. Nur `/wikidatenbank` pruefen; `/wissensdatenbank` als unveraenderten Vergleich behalten.
4. Autorisierten Remote-/Supabase-Zugang und manuelle Freigabe fuer einen read-only-Abgleich bereitstellen.
5. Erst nach Peters Abnahme ueber eine spaetere Entfernung der alten Wiki entscheiden.

## Aktueller Blocker

Der Remote-Supabase-Endpunkt ist erreichbar, antwortet ohne Zugangsdaten aber
mit HTTP 401. Es wurde keine Live-Migration, kein Import und keine
Live-Veroeffentlichung ausgefuehrt.
