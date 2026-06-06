# Phase 2 – Public-Signatur/Datenschutz-Consent charakterisiert

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `b5e4864bfc2ca523e37d29e2e4fab54cb26794e6`
- Schrittziel: Den Datenschutz-/Einwilligungsbereich im echten Signaturabschnitt für anonyme Besucher im öffentlichen Anamnesebogen-Pfad lokal absichern.

## Warum dieser Schritt

Vorherige Phase-2-Schritte haben den öffentlichen Online-Anamnesepfad bereits abgesichert:

- `/anamnesebogen` ist bei aktivem Public-Schalter anonym erreichbar.
- Der Submit-Start läuft bewusst über den `submit-anamnesis`-Verification-Pfad.
- Der Admin-Schalter und die öffentliche Route erklären inzwischen, dass es sich um einen echten öffentlichen Online-Übermittlungspfad handelt.

Der nächste stabile Schritt war deshalb die Signatur-/Einwilligungsoberfläche vor dem Absenden: Gerade dort muss sichtbar sein, dass Datenschutz-/Einwilligungsbestätigungen, Patientenaufklärung, Datenübermittlung und E-Mail-Code-Verifizierung zum Ablauf gehören.

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-130030_pre-phase-2-public-signature-consent-characterization`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-130030_pre-phase-2-public-signature-consent-characterization/SHADOWCOPY_MANIFEST.txt`

## Geänderte Dateien

- `src/test/anamnesebogen-public-route-characterization.test.tsx`
- `doc/20260606-phase-2-public-signature-consent-characterization.md`

Produktivcode wurde in diesem Schritt nicht geändert.

## Charakterisierung

Der bestehende Route-Level-Test wurde um einen zweiten Test erweitert:

`surfaces consent, privacy, and verification notices before anonymous public submission`

Testaufbau:

- anonymer Besucher (`user: null`)
- `useAnamnesePublic()` enabled
- `useAnamneseEnabled()` enabled
- Route `/anamnesebogen`
- echte Layoutauswahl `Alle Bereiche sichtbar`
- echter Accordion-Abschnitt `XXV. Unterschrift`
- kein echter Submit
- keine echten Patientendaten
- keine Supabase-/Edge-Function-Aufrufe

Abgesicherte sichtbare Inhalte:

- Überschrift `Unterschrift & Bestätigung`
- `Datenschutz nach DSGVO`
- Hinweis, dass Daten verschlüsselt übertragen werden
- Datenschutz-Link nach `/datenschutz` mit `target="_blank"`
- Patientenaufklärung-Link nach `/patientenaufklaerung` mit `target="_blank"`
- Pflichtbestätigung `Ich bestätige die Richtigkeit meiner Angaben`
- Einwilligung zur Speicherung von Gesundheitsdaten für die Behandlung
- Datenübermittlungshinweis an die Naturheilpraxis Peter Rauch
- E-Mail-Code-Verifizierung nach dem Absenden

## Testumgebungsbefund

Der erste Lauf des neuen Tests traf eine bekannte jsdom/Radix-Testumgebungsgrenze:

```text
ReferenceError: ResizeObserver is not defined
```

Klassifikation:

- keine Produktcode-Lücke
- keine fachliche Lücke
- Testumgebungs-/jsdom-API-Lücke beim Öffnen des echten Accordion-Inhalts

Behebung:

- testlokaler `ResizeObserver`-Stub in `src/test/anamnesebogen-public-route-characterization.test.tsx`
- keine Produktcode-Änderung

Eine zusätzliche zu enge DOM-Container-Assertion wurde entfernt, weil die globale sichtbare Text-Assertion bereits das relevante Verhalten stabil absichert.

## Ergebnis

Der Signatur-/Datenschutz-/Einwilligungsbereich war fachlich bereits vorhanden und ausreichend sichtbar. Dieser Schritt hat ihn lokal testbasiert charakterisiert, ohne Produktcode unnötig zu verändern.

## Verifikation

### Fokussierter Test

```text
npx vitest run src/test/anamnesebogen-public-route-characterization.test.tsx

Test Files  1 passed (1)
Tests       2 passed (2)
Exit-Code   0
```

### Verwandte Phase-2-Tests

```text
npx vitest run \
  src/test/anamnesebogen-public-route-characterization.test.tsx \
  src/test/anamnesebogen-public-submission-safety-characterization.test.tsx \
  src/test/public-anamnese-link-surfaces-characterization.test.tsx \
  src/test/header-anamnese-navigation-smoke.test.tsx \
  src/test/anamnese-route-guard-smoke.test.tsx \
  src/test/anamnese-public-toggle-copy.test.tsx

Test Files  6 passed (6)
Tests       14 passed (14)
Exit-Code   0
```

### Gesamttests

```text
npm test

Test Files  10 passed (10)
Tests       20 passed (20)
Exit-Code   0
```

### Build

```text
npm run build

3309 modules transformed
built in 4.76s
Exit-Code 0
```

Bekannte nicht-blockierende Build-Warnungen bleiben:

- Browserslist/caniuse-lite veraltet.
- Einige Chunks größer als 500 kB nach Minification.

### TypeScript

```text
npx tsc --noEmit
Exit-Code 0
```

### Lint-Baseline

```text
npm run lint

327 problems
295 errors
32 warnings
Exit-Code 1
```

Bewertung:

- unveränderte bekannte Bestandsschuld
- nicht blockierend
- keine neue Lint-Schuld durch diesen Schritt

### Isolierter ESLint-Check

```text
npx eslint src/test/anamnesebogen-public-route-characterization.test.tsx
Exit-Code 0
kein Output
```

## Datenschutz / Sicherheit

- Keine echten Patientendaten verwendet.
- Kein echter Submit ausgelöst.
- Keine echte E-Mail-Verifizierung ausgelöst.
- Keine Supabase-/Edge-Function-Aufrufe gegen echte Dienste.
- Keine Screenshots oder Logs mit sensiblen Daten.
- Kein Push, kein PR, kein Merge.

## Empfohlener nächster Schritt

Als nächster kleiner stabiler Schritt sollte geprüft werden, ob die Phase-2-Artefakte jetzt vollständig genug sind, um einen lokalen Lovable/GitHub-Handoff vorzubereiten, ohne Push/PR/Merge auszuführen.

Dazu gehören:

- Commitliste der Phase-2-Branch seit `main`/Merge-Base
- geänderte Dateien und Diff-Stat
- lokale Gate-Ergebnisse
- Patientendaten-Sicherheitsaussage
- Compare-Link-Vorbereitung
- PR-Titel/-Body als Markdown-Handoff unter den lokalen Backups

PR-Erstellung weiterhin nur nach separater ausdrücklicher Freigabe `PR erstellen`.
