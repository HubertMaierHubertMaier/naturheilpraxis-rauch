# Phase 1 Abschlussprüfung — Reproduzierbarkeit und lokale Stabilisierung

## Zeitpunkt

- Datum: 2026-06-05
- Start der Abschlussprüfung: 2026-06-05 21:30 CEST
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-1-vitest-baseline`
- Ausgangs-HEAD vor Lockfile-Sync: `5e80afa`
- GitHub-Remote: `https://github.com/reddy67/naturheilpraxis-rauch.git`

## Ziel

Phase 1 soll lokal abgeschlossen werden, ohne GitHub/Lovable zu pushen. Schwerpunkt:

1. Reproduzierbarkeit über `npm ci` herstellen.
2. Test-, Build- und TypeScript-Gates lokal prüfen.
3. Lint als bekannte Bestandsschuld-Baseline dokumentieren.
4. README Setup-Abschnitt projektgenau aktualisieren.
5. Vor einem späteren Push eine gesonderte komplette Phase-1-Gesamtsicherung erstellen.

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnese-Echtdaten in Tests, Logs, Commits oder Screenshots eingebaut.
- Kein Devserver gestartet.
- Kein Push, kein PR, kein Merge.

## Pre-Abschlussprüfung-ShadowCopy

Vor der Änderung wurde eine lokale ShadowCopy erstellt:

- Pfad: `/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-213029_pre-phase-1-final-verification`
- Manifest: `/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-213029_pre-phase-1-final-verification/SHADOWCOPY_MANIFEST.md`
- Excludes: `node_modules`, `dist`, `.git`
- HEAD: `5e80afa`
- Dateien im Backup: `392`

## Verifizierter Ist-Stand vor der Änderung

```text
Branch: stabilization/phase-1-vitest-baseline
Git-Status: sauber
HEAD: 5e80afa test: add impressum route smoke coverage
Remote: https://github.com/reddy67/naturheilpraxis-rauch.git
package-lock.json vorhanden: ja
```

Portprüfung per `ss -ltnp`:

- Kein Devserver gestartet.
- Mehrere Ports waren bereits belegt, u. a. `80`, `443`, `8000`, `8080`, `4321`, `8443`, `3001`, `9090`.
- Für Phase 1 war keine Browser-Devserverprüfung erforderlich.

## Gefundener Blocker für Phase 1

Der erste Abschluss-Gate-Lauf zeigte, dass `npm ci` noch nicht reproduzierbar war.

Befehl:

```sh
npm ci
```

Ergebnis:

```text
Exit-Code: 1
npm ci can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
```

Auszug fehlender Lockfile-Einträge:

```text
Missing: @types/file-saver@2.0.7 from lock file
Missing: docx@9.7.1 from lock file
Missing: file-saver@2.0.5 from lock file
Missing: react-markdown@10.1.0 from lock file
...
```

Bewertung:

- Phase 1 war damit noch nicht abgeschlossen.
- Das Problem passte direkt zum Phase-1-Ziel: `package.json` und `package-lock.json` synchronisieren.

## Minimaler Fix

Befehl:

```sh
npm install
```

Ergebnis:

```text
added 53 packages, removed 31 packages, changed 278 packages, and audited 652 packages in 3s
21 vulnerabilities (1 low, 9 moderate, 9 high, 2 critical)
```

Geänderte Datei:

```text
package-lock.json | 1430 +++++++++++++++++++++++++++++++++++++++++++++++++++--
1 file changed, 1397 insertions(+), 33 deletions(-)
```

Danach war das Lockfile mit `package.json` synchron.

## Reproduzierbarkeit nach Fix

Befehl:

```sh
npm ci
```

Ergebnis:

```text
Exit-Code: 0
added 651 packages, and audited 652 packages in 3s
21 vulnerabilities (1 low, 9 moderate, 9 high, 2 critical)
```

Damit ist der Phase-1-Kernpunkt `npm ci` lokal grün.

## Lokale Gates nach Lockfile-Sync

### `npm test`

```text
Exit-Code: 0
Test Files  3 passed (3)
Tests       4 passed (4)
```

Testdateien:

- `src/test/example.test.ts`
- `src/test/app-startpage-smoke.test.tsx`
- `src/test/app-public-routes-smoke.test.tsx`

### `npm run build`

```text
Exit-Code: 0
vite v5.4.19 building for production...
✓ 3309 modules transformed.
✓ built in 4.77s
```

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite ist veraltet.
- Bundle-/Chunk-Größenwarnung bleibt bestehen:
  `Some chunks are larger than 500 kB after minification.`

### `npx tsc --noEmit`

```text
Exit-Code: 0
```

### `npm run lint`

```text
Exit-Code: 1
✖ 332 problems (300 errors, 32 warnings)
```

Bewertung:

- Lint ist weiterhin bekannte Bestandsschuld.
- Die dokumentierte Baseline hat sich nicht verschlechtert.
- Lint bleibt Phase-7-Thema und blockiert Phase 1 nicht.

## Zusätzliche Sicherheitsbeobachtung: npm audit

Befehl:

```sh
npm audit --audit-level=low --omit=optional
```

Ergebnis:

```text
Exit-Code: 1
20 vulnerabilities (1 low, 8 moderate, 9 high, 2 critical)
```

Wichtige Beispiele:

- `react-router` / `@remix-run/router`: high, XSS/Open Redirect Advisory.
- `jspdf`: critical, mehrere PDF-Injection-/DoS-Advisories.
- `vitest`: critical, Fix nur via `npm audit fix --force` mit Breaking Change auf Vitest 4.
- `vite`/`esbuild`: moderate, Devserver-bezogen.

Bewertung:

- Nicht Teil des ursprünglichen Phase-1-Reproduzierbarkeitsziels, aber sicherheitsrelevant.
- Kein automatischer `npm audit fix --force`, weil das Breaking Changes auslösen kann.
- Empfohlener nächster separater Schritt nach Phase-1-Sicherung: Dependency-/Security-Miniphase mit gezielten Updates und Tests.

## README-Aktualisierung

Die alte Lovable-Standard-README wurde projektgenau ersetzt/aktualisiert:

- Lokales Setup mit `npm ci`.
- Verifizierte Node-/npm-Versionen:
  - Node.js `v20.20.0`
  - npm `10.8.2`
- Test-/Build-/TypeScript-/Lint-Kommandos dokumentiert.
- Lint-Baseline als bekannte Bestandsschuld markiert.
- Devserver-Port-Regel dokumentiert.
- GitHub-/Lovable-Push-Gate dokumentiert.
- Patientendaten-/DSGVO-Schutzregeln dokumentiert.

## Phase-1-Bewertung

Phase 1 ist lokal technisch abschlussfähig, sobald diese Dokumentation und der Lockfile-Sync committed sind und danach die gesonderte komplette Phase-1-Gesamtsicherung erstellt wurde.

Grüne Gates:

- `npm ci`
- `npm test`
- `npm run build`
- `npx tsc --noEmit`

Bekannte nicht-blockierende Baselines:

- `npm run lint`: `332 problems (300 errors, 32 warnings)`
- `npm audit`: `20` bis `21` gemeldete Vulnerabilities je Audit-Aufruf/Option; muss separat strukturiert bearbeitet werden.
- Build Chunk-Größenwarnung.
- Browserslist-Daten veraltet.

## Noch auszuführen nach Commit

1. Lokalen Commit erstellen.
2. Post-Commit Git-Status prüfen.
3. Gesonderte komplette Phase-1-Gesamtsicherung in zusätzlichem Ordner erstellen.
4. Post-Abschluss-ShadowCopy mit Manifest erstellen.
5. Erst danach darf ein Push als nächster Schritt vorgeschlagen werden — nicht automatisch ausführen.
