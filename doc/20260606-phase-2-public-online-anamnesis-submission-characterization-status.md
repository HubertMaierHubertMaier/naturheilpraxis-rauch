# Phase 2 Status – Public Online Anamnesis Submission Characterization

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Schrittziel: Fachlich bestätigten echten öffentlichen Online-Übermittlungspfad für `/anamnesebogen` testbasiert charakterisieren und dokumentieren.
- Push/PR/Merge: nicht ausgeführt.
- Produktivcode geändert: nein.
- Patientendaten: keine echten Patientendaten verwendet.

## Ausgangslage

Der Public-Schalter `anamnese_public=true` war bereits so charakterisiert, dass anonyme Besucher `/anamnesebogen` erreichen können. Zusätzlich wurde fachlich bestätigt, dass dieser Modus als echter öffentlicher Online-Übermittlungspfad verstanden werden darf.

Dieser Schritt dokumentiert und testet deshalb nicht nur die Zugänglichkeit der Route, sondern auch den bewusst bestehenden Start des Online-Submit-/Verification-Pfads bei synthetisch gültigen Formdaten.

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-122123_pre-phase-2-public-anamnesis-online-submission-decision-characterization`

## Änderungen

### Test erweitert

Datei:

`src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`

Neu abgesichert:

- anonymer Besucher,
- `useAnamnesePublic` enabled,
- Route `/anamnesebogen`,
- alle Bereiche sichtbar,
- synthetische Pflichtdaten,
- synthetische Signatur-/Einwilligungsflags,
- Klick auf `Anamnesebogen absenden`,
- erwarteter Aufruf von `supabase.functions.invoke("submit-anamnesis", ...)`,
- `body.action === "submit"`,
- synthetische E-Mail `synthetic-anamnese@example.invalid`,
- Erfolgstoast `Bestätigungscode gesendet!`,
- kein echter Supabase-/E-Mail-/Write-Pfad, da Supabase vollständig gemockt ist.

Zusätzlich wurden testlokale jsdom-Stubs ergänzt für:

- `ResizeObserver`,
- `document.elementFromPoint`.

Grund: Nach erfolgreichem Submit rendert der VerificationDialog `input-otp`; diese Bibliothek benötigt in jsdom Browser-APIs, die nicht nativ vorhanden sind. Die Stubs sind ausschließlich testlokal und ändern keinen Produktivcode.

### Decision Record ergänzt

Datei:

`doc/20260606-phase-2-public-online-anamnesis-submission-decision.md`

Inhalt:

- `anamnese_public=true` gilt fachlich als bewusst aktivierbarer echter öffentlicher Online-Übermittlungspfad.
- Der vollständige Submit bleibt zweistufig über E-Mail-Code/Verification.
- Keine Live-Freischaltung, kein Push, kein PR, kein Merge.
- Separate DSGVO-/Rechtsprüfung vor produktiver Aktivierung bleibt erforderlich.

## Test- und Gate-Ergebnisse

### Fokussierter Test

Befehl:

`npx vitest run src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`

Ergebnis:

- Test Files: 1 passed
- Tests: 2 passed
- Duration: 3.76s
- Exit-Code: 0

### Verwandte Phase-2-Tests

Befehl:

`npx vitest run src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/anamnesebogen-public-route-characterization.test.tsx src/test/anamnese-route-guard-smoke.test.tsx src/test/header-anamnese-navigation-smoke.test.tsx src/test/public-anamnese-link-surfaces-characterization.test.tsx`

Ergebnis:

- Test Files: 5 passed
- Tests: 12 passed
- Duration: 3.76s
- Exit-Code: 0

### Gesamttests

Befehl:

`npm test`

Ergebnis:

- Test Files: 9 passed
- Tests: 18 passed
- Duration: 4.01s
- Exit-Code: 0

### Production Build

Befehl:

`npm run build`

Ergebnis:

- 3309 modules transformed
- built in 4.84s
- Exit-Code: 0

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite ist veraltet.
- Chunk-Größenwarnung: `dist/assets/index-...js` größer als 500 kB nach Minification.

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

Bewertung:

Diese Baseline bleibt nicht-blockierend, weil sie bereits als Bestandsschuld bekannt ist und durch diesen Schritt nicht adressiert werden sollte.

### Isolierter ESLint-Check für geänderte Testdatei

Befehl:

`npx eslint src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`

Ergebnis:

- Exit-Code: 0
- kein Output

## Datenschutz-/Patientendatenbewertung

- Es wurden keine echten Patientendaten verwendet.
- Die neue Test-E-Mail nutzt die reservierte `.invalid`-TLD: `synthetic-anamnese@example.invalid`.
- Supabase ist im Test vollständig gemockt.
- Es wurde keine echte E-Mail ausgelöst.
- Es wurde kein echter Datenbank-Write ausgelöst.
- Es wurden keine Screenshots erstellt.

## Ergebnis

Der fachlich bestätigte öffentliche Online-Submit-Start ist jetzt als Characterization-Test abgesichert. Der Schritt macht keine Produktivcode-Änderung, sondern dokumentiert die bestehende und gewünschte Semantik stabiler.

## Nächster priorisierter Vorschlag

Als nächster kleiner sicherer Schritt sollte die Admin-/UI-Copy zum Public-Schalter geprüft und ggf. minimal präzisiert werden, damit klar ist, dass `anamnese_public=true` nicht nur einen öffentlichen Lesemodus, sondern einen echten öffentlichen Online-Übermittlungspfad aktiviert. Dieser Schritt sollte wieder mit Pre-ShadowCopy, fokussiertem Test und lokalem Commit erfolgen.
