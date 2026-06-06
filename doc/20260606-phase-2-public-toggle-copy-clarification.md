# Phase 2 – Public-Anamnese Admin-Copy präzisiert

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `ff9b7dc480e977f13dd22d3c99f73dffe17b5e69`
- Schrittziel: Admin-/UI-Copy des Public-Anamnese-Schalters an die bestätigte Semantik eines echten öffentlichen Online-Übermittlungspfads angleichen.
- Push/PR/Merge: nicht ausgeführt.
- Patientendaten: keine echten Patientendaten verwendet.

## Ausgangslage

Der vorherige Schritt hat fachlich und testbasiert festgehalten:

`anamnese_public=true` ist nicht nur ein öffentlicher Lesemodus oder ein reiner Testmodus. Der Schalter aktiviert bewusst einen echten öffentlichen Online-Übermittlungspfad für den Anamnesebogen, inklusive Start des E-Mail-Code-Verifizierungspfads.

Die Admin-Komponente `AnamnesePublicToggle` enthielt danach noch veraltete/missverständliche Copy:

- `Online-Anamnesebogen – Test-Modus`
- `nur zum Ausprobieren der Online-Form`
- `Absenden/Speichern funktioniert ohne Login NICHT`

Diese Aussagen waren nach der fachlichen Bestätigung nicht mehr korrekt.

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-123252_pre-phase-2-public-toggle-copy-clarification`

## TDD-Ablauf

### RED

Neue Testdatei:

`src/test/anamnese-public-toggle-copy.test.tsx`

Der Test rendert `AnamnesePublicToggle` mit `useAnamnesePublic().enabled === true` und erwartet:

- Titel: `Online-Anamnesebogen – Öffentliche Online-Übermittlung`
- Beschreibung: `/anamnesebogen` ohne Login, Online-Übermittlung mit E-Mail-Code-Verifizierung
- Warnhinweis: Jeder mit dem Link kann die Form öffnen und den Übermittlungspfad starten
- Sicherheitsgrenze: Nur nach fachlicher Freigabe und DSGVO-/Rechtsprüfung aktiviert lassen
- Keine alten Testmodus-Aussagen mehr

RED-Lauf:

`npx vitest run src/test/anamnese-public-toggle-copy.test.tsx`

Ergebnis:

- Test Files: 1 failed
- Tests: 1 failed
- Ursache: alter Titel `Online-Anamnesebogen – Test-Modus`
- Exit-Code: 1

### GREEN

Geänderte Produktdatei:

`src/components/admin/AnamnesePublicToggle.tsx`

Minimale Änderungen:

- Titel von `Test-Modus` auf `Öffentliche Online-Übermittlung` geändert.
- Beschreibung präzisiert: öffnet `/anamnesebogen` ohne Login und ermöglicht Online-Übermittlung mit E-Mail-Code-Verifizierung.
- Warnhinweis korrigiert: Jeder mit Link kann Form öffnen und Übermittlungspfad starten.
- Sicherheitsgrenze ergänzt: Nur nach fachlicher Freigabe und DSGVO-/Rechtsprüfung aktiviert lassen.
- Toast-Texte beim Aktivieren/Deaktivieren entsprechend angepasst.

GREEN-Lauf:

`npx vitest run src/test/anamnese-public-toggle-copy.test.tsx`

Ergebnis:

- Test Files: 1 passed
- Tests: 1 passed
- Duration: 476ms
- Exit-Code: 0

## Gate-Ergebnisse

### Verwandte Phase-2-Tests

Befehl:

`npx vitest run src/test/anamnese-public-toggle-copy.test.tsx src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/header-anamnese-navigation-smoke.test.tsx src/test/anamnesebogen-public-route-characterization.test.tsx src/test/anamnese-route-guard-smoke.test.tsx`

Ergebnis:

- Test Files: 5 passed
- Tests: 11 passed
- Duration: 3.76s
- Exit-Code: 0

### Gesamttests

Befehl:

`npm test`

Ergebnis:

- Test Files: 10 passed
- Tests: 19 passed
- Duration: 4.15s
- Exit-Code: 0

### Production Build

Befehl:

`npm run build`

Ergebnis:

- 3309 modules transformed
- built in 4.90s
- Exit-Code: 0

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite ist veraltet.
- Bundle-/Chunk-Größenwarnung: großer `dist/assets/index-...js` Chunk > 500 kB.

### TypeScript

Befehl:

`npx tsc --noEmit`

Ergebnis:

- Exit-Code: 0
- kein Fehleroutput

### Lint-Baseline

Befehl:

`npm run lint`

Ergebnis:

- Exit-Code: 1
- bekannte Bestandsschuld unverändert:
  - 332 problems
  - 300 errors
  - 32 warnings
  - 1 error potentially fixable with `--fix`

Bewertung: nicht blockierend, weil unveränderte bekannte Bestandsschuld.

### Isolierter ESLint-Check

Befehl:

`npx eslint src/components/admin/AnamnesePublicToggle.tsx src/test/anamnese-public-toggle-copy.test.tsx`

Ergebnis:

- Exit-Code: 0
- kein Output

## Datenschutz-/Sicherheitsbewertung

- Keine echten Patientendaten verwendet.
- Keine Formular-Submission ausgelöst.
- Keine Supabase-Daten geschrieben.
- Kein Dev-/Preview-Server gestartet.
- Keine Screenshots erstellt.
- Änderung betrifft Copy/Transparenz im Adminbereich, nicht den Datenfluss selbst.

## Ergebnis

Der Admin-Public-Schalter beschreibt den aktivierten Modus jetzt transparent als echten öffentlichen Online-Übermittlungspfad mit E-Mail-Code-Verifizierung. Die vorher missverständliche Testmodus-Copy wurde entfernt und durch eine explizite DSGVO-/Rechtsprüfungsgrenze ersetzt.

## Nächster priorisierter Vorschlag

Als nächster kleiner stabiler Schritt sollte der öffentlich sichtbare Hinweistext direkt auf `/anamnesebogen` geprüft werden: Dort sollte für anonyme Besucher bei `anamnese_public=true` klar und früh erkennbar sein, dass Absenden eine Datenübermittlung an die Praxis startet und eine E-Mail-Code-Verifizierung folgt. Auch dieser Schritt sollte wieder TDD-basiert mit Pre-ShadowCopy, fokussiertem Test, Gates, lokalem Commit und Post-ShadowCopy erfolgen.
