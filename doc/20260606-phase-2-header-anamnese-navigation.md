# Phase 2 — Header-Anamnese-Navigation Characterization

## Zeitpunkt

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `d064d13`

## Ziel

Dieser Schritt stabilisiert den Phase-2-Themenbereich „uneinheitliche Zugriffskontrollen“ weiter, ohne riskanten Produktivcode-Refactor.

Nach dem Refactor-Risikoinventar wurde `Header.tsx` als sinnvoller nächster Characterization-Kandidat priorisiert, weil der Header sichtbar zwischen Anamnese-Online-Link und Blanko-PDF-Download entscheidet.

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnese-Formulardaten, Patientennamen, Diagnosen oder Testpatienten erstellt.
- Keine Screenshots oder Logs mit sensiblen Daten.
- Keine Änderung an Supabase, Datenbank, Edge Functions oder `.env`.
- Kein Push, kein PR, kein Merge.

## Portprüfung

Vor Arbeitsbeginn wurde die Portlage geprüft, weil parallel ein weiteres Projekt läuft.

Freie Kandidaten:

```text
4173, 4174, 5173, 5174, 5180, 5181, 3000
```

Belegte relevante Ports:

```text
3001, 4321, 8080
```

Für diesen Schritt wurde kein Dev-/Preview-Server gestartet und kein Port belegt.

## Pre-Step-ShadowCopy

Vor der Änderung wurde eine lokale ShadowCopy erstellt:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-091611_pre-phase-2-header-anamnese-navigation-tdd
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-091611_pre-phase-2-header-anamnese-navigation-tdd/SHADOWCOPY_MANIFEST.md
```

## Geänderte Dateien

```text
A  src/test/header-anamnese-navigation-smoke.test.tsx
A  doc/20260606-phase-2-header-anamnese-navigation.md
```

Produktivcode wurde nicht geändert.

## Characterization-Tests

Neu erstellt:

```text
src/test/header-anamnese-navigation-smoke.test.tsx
```

Abgesichert wurden drei sichtbare Header-Zustände:

1. Anonymer Besucher, Anamnese-Schalter aktiviert:
   - Header zeigt Blanko-PDF-Download `Anamnesebogen (PDF)`.
   - Kein Online-Link `Anamnesebogen`.
   - Download-Ziel: `/anamnesebogen-blanko.pdf`.

2. Eingeloggter Patient, Anamnese-Schalter aktiviert:
   - Header zeigt Online-Link `Anamnesebogen`.
   - Kein Blanko-PDF-Download.
   - Link-Ziel: `/anamnesebogen`.

3. Admin, Anamnese-Schalter deaktiviert:
   - Header zeigt weiterhin Online-Link `Anamnesebogen`.
   - Link enthält Marker `gesperrt`.
   - Kein Blanko-PDF-Download.

## RED/GREEN-Bewertung

Dies war bewusst ein Characterization-Test-Schritt für bestehendes Verhalten. Der fokussierte Test lief sofort grün, weil der Header das dokumentierte Verhalten bereits zeigt.

Ich habe deshalb keinen künstlichen Produktivcode-Fix erzwungen. Das ist für Akkuranz und Stabilität sicherer:

- keine unnötige Änderung an Zugriffskontrolllogik,
- kein Risiko für Header-/Navigation-Regressions,
- vorhandenes Verhalten ist jetzt als Regressionstest dokumentiert.

## Verifikation

### Fokussierter Test

```text
npx vitest run src/test/header-anamnese-navigation-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
Exit-Code: 0
```

### Isolierter ESLint-Check der neuen Testdatei

```text
npx eslint src/test/header-anamnese-navigation-smoke.test.tsx
```

Ergebnis:

```text
Exit-Code: 0
kein Output
```

### Gesamttests

```text
npm test
```

Ergebnis:

```text
Test Files  6 passed (6)
Tests       12 passed (12)
Exit-Code: 0
```

### Build

```text
npm run build
```

Ergebnis:

```text
✓ 3309 modules transformed.
✓ built in 4.75s
Exit-Code: 0
```

Bekannte nicht-blockierende Warnungen:

```text
Browserslist/caniuse-lite ist veraltet.
Some chunks are larger than 500 kB after minification.
```

### TypeScript

```text
npx tsc --noEmit
```

Ergebnis:

```text
Exit-Code: 0
```

### Lint-Baseline

```text
npm run lint
```

Ergebnis unverändert:

```text
✖ 332 problems (300 errors, 32 warnings)
LINT_EXIT=1
LINT_COUNTS problems=332 errors=300 warnings=32
```

Bewertung:

- Bekannte Lint-Schuld bleibt unverändert.
- Die neue Testdatei erzeugt keine isolierten ESLint-Probleme.

## Stabilitätsbewertung

Dieser Schritt verbessert das Sicherheitsnetz für spätere Header-Arbeiten:

- Der aktuelle Online-/PDF-Wechsel ist dokumentiert.
- Admin-Sonderfall `gesperrt` ist dokumentiert.
- Spätere Vereinheitlichung der Zugriffskontrollen kann gegen diese Tests laufen.

Eine fachliche Auffälligkeit bleibt sichtbar: `AnamneseRouteGuard` erlaubt bei public-enabled grundsätzlich freien Online-Zugang, während der Header anonymen Besuchern bei enabled aktuell den PDF-Download statt Online-Link anbietet. Das wurde nicht verändert, sondern zunächst exakt charakterisiert.

## Nächster priorisierter Vorschlag

Als nächstes sollte diese Auffälligkeit fachlich/technisch abgesichert werden, bevor wir Produktivlogik ändern:

1. App-/Route-Level Test für `/anamnesebogen` bei public-enabled und anonymem Nutzer ergänzen.
2. Prüfen, ob public-enabled tatsächlich Online-Zugang für anonyme Besucher bedeuten soll.
3. Falls ja: Header später kontrolliert anpassen, sodass public-enabled im Header konsistent Online-Link statt PDF anbietet.
4. Falls nein: `AnamneseRouteGuard`/Header-Begrifflichkeit und public/private-Konzept dokumentieren bzw. vereinheitlichen.

Vor einer Änderung an der Header-Logik sollte zuerst die gewünschte fachliche Bedeutung von `anamnese_enabled` bestätigt werden.
