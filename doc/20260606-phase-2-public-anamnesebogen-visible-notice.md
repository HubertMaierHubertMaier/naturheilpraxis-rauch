# Phase 2 – Öffentlicher Hinweis auf /anamnesebogen sichtbar gemacht

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `2a3595c820f15246cbf79dc1b389b81a03e77cc1`
- Schrittziel: Anonyme Besucher bei aktivem öffentlichen Anamnesezugang sollen direkt auf `/anamnesebogen` früh und klar erkennen, dass ein Absenden eine Online-Übermittlung sensibler Gesundheits-/Anamnesedaten an die Praxis startet und danach eine E-Mail-Code-Verifizierung folgt.

## Warum dieser Schritt

In den vorherigen Phase-2-Schritten wurde lokal testbasiert bestätigt und dokumentiert:

- `anamnese_public=true` ist fachlich als echter öffentlicher Online-Übermittlungspfad zu verstehen.
- Der Submit-Start läuft über `supabase.functions.invoke("submit-anamnesis", { body: { action: "submit", ... } })`.
- Die finale Einreichung bleibt zweistufig über E-Mail-Code-Verifizierung.
- Die Admin-Copy des Public-Schalters wurde bereits präzisiert.

Der nächste stabile Schritt war daher, auch die öffentlich sichtbare Route `/anamnesebogen` selbst klarer zu machen. Ein anonymer Besucher soll nicht erst beim Absenden erkennen, dass eine Datenübermittlung gestartet wird.

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-125130_pre-phase-2-public-anamnesebogen-visible-notice`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-125130_pre-phase-2-public-anamnesebogen-visible-notice/SHADOWCOPY_MANIFEST.txt`

## Geänderte Dateien

- `src/pages/Anamnesebogen.tsx`
- `src/test/anamnesebogen-public-route-characterization.test.tsx`
- `doc/20260606-phase-2-public-anamnesebogen-visible-notice.md`

## Test-first / RED

Der vorhandene Route-Level-Characterization-Test wurde erweitert:

Datei:

`src/test/anamnesebogen-public-route-characterization.test.tsx`

Neue Erwartung:

- Route `/anamnesebogen`
- anonymer Besucher
- `useAnamnesePublic()` enabled
- `useAnamneseEnabled()` enabled
- sichtbarer Hinweis mit `role="status"` und `aria-label="Hinweis zur öffentlichen Online-Übermittlung"`
- Text klärt:
  - Beim Absenden werden Angaben an die Naturheilpraxis übermittelt.
  - Gesundheits-/Anamnesedaten sind sensibel.
  - Danach folgt ein E-Mail-Code zur Verifizierung.

RED-Ergebnis:

```text
npx vitest run src/test/anamnesebogen-public-route-characterization.test.tsx

Test Files  1 failed (1)
Tests       1 failed (1)
Grund: Unable to find an accessible element with the role "status" and name `/Hinweis zur öffentlichen Online-Übermittlung/i`
```

Bewertung:

Der Test war korrekt rot, weil der frühe öffentliche Hinweis auf der Seite bisher fehlte.

## Umsetzung / GREEN

In `src/pages/Anamnesebogen.tsx` wurde direkt unter der Hauptbeschreibung ein früher Hinweis für anonyme, nicht im Edit-Modus befindliche Besucher ergänzt:

- `role="status"`
- deutsch: `Hinweis zur öffentlichen Online-Übermittlung`
- englisch: `Notice about public online submission`
- Hinweistext:
  - Online-Anamnesebogen ist öffentlich erreichbar.
  - Beim Absenden werden Angaben an die Naturheilpraxis übermittelt.
  - Gesundheits-/Anamnesedaten sind besonders sensibel.
  - Vor Abschluss der Einreichung folgt eine E-Mail-Code-Verifizierung.

Keine Änderung erfolgte an:

- Supabase-Konfiguration
- Edge-Function-Aufrufen
- Submit-/Verify-Logik
- Route-Guard-Logik
- Auth-Logik
- Admin-Schalter-Logik
- Live-/Remote-/Lovable-Zustand

## Zusätzlich bereinigte Bestandsschuld in berührter Datei

Beim isolierten ESLint-Check der geänderten Datei fiel vorhandene `any`-Bestandsschuld in `src/pages/Anamnesebogen.tsx` auf. Da diese Datei jetzt berührt wurde, wurde sie sicher lokal typisiert:

- `location.state as any` ersetzt durch `RouteState`.
- `updateFormData(..., value: any)` ersetzt durch `unknown`.
- `catch (error: any)` ersetzt durch `unknown` plus `getErrorMessage()`.
- `iaaData as any` entfernt.

Diese Bereinigung ändert kein Laufzeitverhalten, verbessert aber den isolierten Lint-Status der berührten Datei.

## Verifikation

### Fokussierter Test nach Umsetzung

```text
npx vitest run src/test/anamnesebogen-public-route-characterization.test.tsx

Test Files  1 passed (1)
Tests       1 passed (1)
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
Tests       13 passed (13)
Exit-Code   0
```

### Gesamttests

```text
npm test

Test Files  10 passed (10)
Tests       19 passed (19)
Exit-Code   0
```

### Build

```text
npm run build

3309 modules transformed
built in 4.83s
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

- Der globale Lint bleibt wegen bekannter Bestandsschuld nicht grün.
- Die Zahl hat sich gegenüber der vorher dokumentierten Baseline `332 problems / 300 errors / 32 warnings` verbessert, weil fünf `any`-Stellen in der berührten Datei sicher bereinigt wurden.
- Es wurde keine neue Lint-Schuld eingeführt.

### Isolierter ESLint-Check

```text
npx eslint src/pages/Anamnesebogen.tsx src/test/anamnesebogen-public-route-characterization.test.tsx
Exit-Code 0
kein Output
```

## Datenschutz / Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echte Formularübermittlung ausgeführt.
- Keine Supabase- oder Edge-Function-Aufrufe gegen echte Dienste.
- Keine Screenshots oder Logs mit Patientendaten.
- Kein Push, kein PR, kein Merge.
- Der Hinweis aktiviert keinen neuen Datenfluss; er macht den bestehenden, vorher bestätigten öffentlichen Übermittlungspfad transparent.

## Ergebnis

Die öffentliche Route `/anamnesebogen` zeigt anonymen Besuchern jetzt früh einen klaren Hinweis zur Online-Übermittlung und E-Mail-Code-Verifizierung. Der Schritt ist lokal testbasiert abgesichert und stabil verifiziert.

## Empfohlener nächster Schritt

Als nächster kleiner stabiler Schritt sollte geprüft werden, ob der sichtbare Datenschutzhinweis bzw. die Datenschutz-/Einwilligungs-Verlinkung im Signaturbereich für den anonymen Public-Submit-Pfad ausreichend klar ist.

Ziel:

- Keine juristische Bewertung ersetzen.
- Keine unsicheren Flows aktivieren.
- Nur lokal charakterisieren, ob vor Submit eine klare Einwilligungs-/Datenschutzoberfläche sichtbar und testbar ist.
- Falls nötig, minimale Copy-/Link-Präzisierung mit Test absichern.
