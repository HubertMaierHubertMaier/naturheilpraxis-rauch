# Handover: SIBO-Infothek

Datum: 2026-07-08

## Was erstellt wurde

- Neue statische Infothek-Seite angelegt:
  - `public/sibo-duenndarmfehlbesiedlung.html`
- In die Infothek eingebunden über:
  - `src/lib/infothekContent.ts`

## Wichtige Regel für neue Infothek-HTMLs

- Eine neue `public/*.html` reicht nicht aus.
- Zusätzlich muss immer ein Eintrag in `src/lib/infothekContent.ts` angelegt werden.
- Wunsch des Users für zukünftige neue Inhalte:
  - standardmäßig `external: true`
  - standardmäßig `gated: true` (patientengesperrt)

## Inhaltlicher Stand der SIBO-Seite

- SIBO-Grundlagen
- typische Beschwerden und Risikofaktoren
- Atemtest / Leitlinien-Einordnung
- Praxisperspektive Dr. med. Ralf Kirkamm
- H2S / Schwefelwasserstoffbildner
- Quellen-Slide

## Quellen, die verwendet wurden

- `Pimentel et al.`, ACG Clinical Guideline 2020
- `Rezaie et al.`, North American Consensus 2017
- `Rao & Bhagatwala` 2019
- `Singh & Lin` 2015
- `Peck et al.` 2019 zu `Bilophila wadsworthia`
- `Dr. med. Ralf Kirkamm` SIBO-Seite

## Technisches Problem heute

- Der neue SIBO-Eintrag war zunächst in Lovable / Admin / Infothek nicht sichtbar.
- Ursache war kein Codefehler, sondern ein alter Frontend-/Preview-Stand in Lovable.
- Erkenntnis:
  - Wenn ein neuer Infothek-Eintrag im Code vorhanden ist, aber in Lovable nicht auftaucht,
    zuerst Preview / Frontend-Stand prüfen bzw. neu laden.

## Temporärer Marker

- Im Eintrag wurde zum Testen ein auffälliger Marker gesetzt:
  - Titel: `NEU: SIBO / Dünndarmfehlbesiedlung`
  - Beschreibung enthält: `TESTMARKER`
- Diesen Marker bei der nächsten Sitzung wieder entfernen, sobald nicht mehr nötig.

## Wenn weitergearbeitet wird

- Zuerst prüfen, ob der SIBO-Eintrag jetzt in Lovable sichtbar ist.
- Danach Marker entfernen.
- Dann SIBO-Seite inhaltlich weiter verfeinern oder weitere Infothek-Seiten analog anlegen.
