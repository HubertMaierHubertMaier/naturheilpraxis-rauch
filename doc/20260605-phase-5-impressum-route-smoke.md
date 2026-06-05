# Phase 5 – Impressum-Route-Smoke-Test und Phase-1-Push-Gate fixiert

Datum/Zeit: 2026-06-05 21:11 CEST
Branch: `stabilization/phase-1-vitest-baseline`
Ausgangs-HEAD: `0c116fc test: add privacy route smoke coverage`

## Ziel

Nächster kleiner sicherer Stabilisierungsschritt:

- Die vom Benutzer präzisierte Phase-1-Vorgehensweise exakt im Projektplan fixieren.
- Einen weiteren öffentlichen Route-Smoke-Test für `/impressum` ergänzen.
- Strict TDD: Test zuerst, RED verifizieren, minimaler GREEN-Fix.
- Keine echten Patientendaten oder Anamnese-Daten erzeugen.
- Kein Devserver, kein Push.

## Verbindlich fixierte Vorgehensweise

In `doc/04_phasenplan_umsetzung.md` wurde festgehalten:

1. Phase 1 gilt erst als abgeschlossen, wenn sie lokal vollständig funktional getestet ist.
2. Nach vollständig getesteter Phase 1 wird zusätzlich zu den normalen ShadowCopies eine komplette Phase-1-Gesamtsicherung in einem gesonderten zusätzlichen Ordner erstellt.
3. GitHub-/Lovable-Push und Merge erfolgen erst nach sauberem lokalem Stand, vollständiger Phase-1-Gesamtsicherung und ausdrücklicher separater persönlicher Freigabe.

Diese Regel wurde zusätzlich als dauerhafte Arbeitspräferenz gespeichert.

## Port-/Runtime-Schutz

Es wurde kein Devserver gestartet.

Vor Arbeitsbeginn wurde die Portbelegung mit `ss -ltnp` geprüft. Belegt waren unter anderem:

- `80`
- `443`
- `8000`
- `8080`
- `4321`
- `8443`
- `3001`
- `9090`

Da `8080` belegt war und kein Browser-Devserver für diesen Schritt nötig war, wurde kein `npm run dev` ausgeführt.

## Pre-Step-ShadowCopy

Erstellt vor substantiellen Änderungen:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-210954_pre-phase-5-impressum-route-smoke`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-210954_pre-phase-5-impressum-route-smoke/SHADOWCOPY_MANIFEST.md`

## TDD-Ablauf

### RED

Ergänzt in:

- `src/test/app-public-routes-smoke.test.tsx`

Fokussierter RED-Befehl:

```bash
npx vitest run src/test/app-public-routes-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 failed (1)
Tests  1 failed | 1 passed (2)
Unable to find an accessible element with the role "main" and name `/Impressum/i`
```

Bewertung: sinnvoller RED-Zustand. Die Impressum-Seite rendert den erwarteten `h1`, aber der zentrale `main`-Landmark war noch nicht eindeutig per Accessible Name auffindbar.

### GREEN

Minimaler Produktions-Fix:

- `src/pages/Impressum.tsx`
  - `Layout` von `<Layout>` auf `<Layout mainAriaLabel="Impressum">` geändert.

Fokussierter GREEN-Befehl:

```bash
npx vitest run src/test/app-public-routes-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

## Lokale Gates

### `npm test`

```text
Test Files  3 passed (3)
Tests  4 passed (4)
Exit-Code: 0
```

### `npm run build`

```text
✓ 3326 modules transformed.
✓ built in 4.98s
Exit-Code: 0
```

Bekannte nicht-blockierende Warnung bleibt bestehen:

```text
Some chunks are larger than 500 kB after minification.
```

### `npx tsc --noEmit`

```text
Exit-Code: 0
```

### `npm run lint`

```text
Exit-Code: 1
✖ 332 problems (300 errors, 32 warnings)
```

Bewertung: bekannte Lint-Baseline unverändert. Der Schritt verschlechtert die Lint-Zahl nicht und wird nicht als Blocker behandelt.

## Geänderte Dateien

- `doc/04_phasenplan_umsetzung.md`
- `src/pages/Impressum.tsx`
- `src/test/app-public-routes-smoke.test.tsx`
- `doc/20260605-phase-5-impressum-route-smoke.md`

## Datenschutz-/Patientendaten-Hinweis

Es wurden keine echten Patientendaten oder Anamnese-Daten erzeugt, geloggt oder in Tests eingebaut. Der neue Smoke-Test prüft ausschließlich öffentliche Impressum-Inhalte und allgemeine Accessibility-Struktur.

## Commit

Noch offen zum Zeitpunkt dieses Dokuments. Nach erfolgreicher lokaler Prüfung soll ein lokaler Commit erstellt werden. Kein Push ohne separate Freigabe.

## Nächster sinnvoller Schritt nach dieser Phase

Nach Commit und Post-Step-ShadowCopy: Phase-1-Abschlusskriterien gezielt gegen den tatsächlichen aktuellen Stand prüfen, insbesondere ob `npm ci` reproduzierbar grün läuft und ob die bisherige Phase-1-Dokumentation den aktuellen Test-/Build-/TypeScript-Stand vollständig abdeckt. Erst nach vollständigem funktionalem Phase-1-Abschluss wird die zusätzliche komplette Phase-1-Gesamtsicherung erstellt; erst danach kann ein Push überhaupt zur Freigabe vorgeschlagen werden.
