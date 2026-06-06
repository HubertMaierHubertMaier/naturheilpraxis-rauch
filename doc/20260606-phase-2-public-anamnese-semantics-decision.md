# Phase 2: Public Anamnese semantics decision record

## Stand

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `4b16e4a7a75cd1769b003d60566429eb1d1e63cb`
- GitHub/Lovable: kein Push, kein PR, kein Merge.

## Ziel

Dieser Schritt dokumentiert die aktuell verifizierte Schalter- und Link-Semantik rund um den öffentlichen Anamnesezugang, bevor Produktivcode am Header geändert wird.

Der Schritt ist bewusst dokumentarisch und stabilisierend:

- keine Produktivcode-Änderung,
- keine neue Aktivierung digitaler Patientendaten-Flows,
- keine Formularbefüllung,
- keine Supabase-Submission,
- keine Änderung an Admin-Schaltern oder Auth-Logik.

## Verifizierte Quellen

### Route-Level Guard

Datei: `src/components/AnamneseRouteGuard.tsx`

Der Guard nutzt `useAnamnesePublic()`:

- loading: zeigt barrierearmen Status `Anamnese-Zugriff wird geprüft`,
- `enabled=true`: rendert die Kinder direkt, also `/anamnesebogen` ohne Login,
- `enabled=false`: fällt auf `ProtectedRoute` zurück.

Relevanter Kommentar im Code:

```text
Wenn admin-seitig `anamnese_public` aktiv → freier Zugang (kein Login nötig).
Sonst → normale ProtectedRoute.
```

### Public Hook

Datei: `src/hooks/useAnamnesePublic.ts`

Semantik laut Code-Kommentar:

```text
Globaler Schalter `anamnese_public` in `app_settings`.
Wenn true: `/anamnesebogen` ist OHNE Login zugänglich (nur zum Ausprobieren).
Default: false.
```

### Enabled/PDF Hook

Datei: `src/hooks/useAnamneseEnabled.ts`

Semantik laut Code-Kommentar:

```text
Globaler Schalter `anamnese_enabled` in `app_settings`.
Default: true (Anamnesebogen zugänglich).
```

Die Admin-Komponente `src/components/admin/AnamneseToggle.tsx` präzisiert die UI-Semantik stärker als PDF-/Sichtbarkeitsfreigabe:

- Titel: `PDF Anamnesebogen – Freigabe`,
- Beschreibung: `Steuert Sichtbarkeit & Download des ausfüllbaren PDFs für Patienten.`,
- enabled: Patienten können das PDF über Menü und Dashboard herunterladen,
- disabled: PDF ist für Patienten ausgeblendet; Admins sehen ihn weiterhin.

### Public Test Toggle

Datei: `src/components/admin/AnamnesePublicToggle.tsx`

Die Admin-Komponente beschreibt `anamnese_public` eindeutig als Online-Testmodus:

- Titel: `Online-Anamnesebogen – Test-Modus`,
- Beschreibung: `/anamnesebogen` kurzzeitig ohne Login freischalten,
- Warnung: Jeder mit dem Link kann die Form öffnen; Absenden/Speichern funktioniert ohne Login nicht; nur Felder ausprobieren,
- Empfehlung: Nach dem Test wieder deaktivieren.

### Header

Datei: `src/components/layout/Header.tsx`

Der Header nutzt aktuell `useAnamneseEnabled()`, aber nicht `useAnamnesePublic()`.

Charakterisiertes Verhalten:

- `showAnamnese = anamneseEnabled || isAdmin`,
- bei `user || isAdmin`: Online-Link `/anamnesebogen`,
- bei anonymem Besucher: PDF-Download `/anamnesebogen-blanko.pdf` mit `download`,
- dadurch zeigt der Header anonym bei `anamnese_enabled=true` weiterhin `Anamnesebogen (PDF)` statt den Online-Link.

## Bereits abgesicherte Characterization-Tests

### Header

Datei: `src/test/header-anamnese-navigation-smoke.test.tsx`

Abgesichert:

1. anonym + Anamnese enabled:
   - Header zeigt `Anamnesebogen (PDF)`,
   - `href="/anamnesebogen-blanko.pdf"`,
   - `download`,
   - kein Online-Link `Anamnesebogen`.
2. eingeloggter Patient + Anamnese enabled:
   - Header zeigt Online-Link `/anamnesebogen`,
   - kein PDF-Download.
3. Admin + Anamnese disabled:
   - Header zeigt Online-Link `/anamnesebogen` mit Marker `gesperrt`,
   - kein PDF-Download.

### Route `/anamnesebogen`

Datei: `src/test/anamnesebogen-public-route-characterization.test.tsx`

Abgesichert:

- anonymer Nutzer,
- `useAnamnesePublic()` enabled,
- Route `/anamnesebogen`,
- Online-Anamnesebogen rendert bis zur Auswahl `Wie möchten Sie das Formular ausfüllen?`,
- kein Auth-Redirect,
- kein Guard-Endloading.

### Öffentliche Link-Surfaces außerhalb Header

Datei: `src/test/public-anamnese-link-surfaces-characterization.test.tsx`

Abgesichert:

- Footer-Link `Anamnesebogen` zeigt direkt auf `/anamnesebogen`, kein `download`,
- Home/Feature-Kachel zeigt direkt auf `/anamnesebogen`, kein `download`.

## Aktuell präzise beschriebene Inkonsistenz

Wenn `anamnese_public=true` und der Besucher anonym ist:

- Route-Level erlaubt `/anamnesebogen` anonym online.
- Footer kann anonym direkt auf `/anamnesebogen` verweisen.
- Home/Feature-Kachel kann anonym direkt auf `/anamnesebogen` verweisen.
- Header zeigt anonym weiterhin den PDF-Download `Anamnesebogen (PDF)`, weil er `anamnese_public` nicht berücksichtigt.

Das ist nicht automatisch ein Bug; es ist eine fachliche Produktentscheidung mit Datenschutz-/UX-Relevanz.

## Entscheidungsoptionen

### Option A: Header bleibt bewusst PDF-only für anonyme Besucher

Bedeutung:

- Header bewirbt den Online-Testmodus nicht prominent.
- Öffentliche Online-Route bleibt trotzdem erreichbar, wenn ein anderer Einstiegspunkt oder direkter Link genutzt wird.
- Der aktuelle Header-Characterization-Test bleibt fachlich korrekt.

Vorteile:

- konservativer Datenschutz-/DSGVO-Default,
- weniger prominente anonyme Online-Form-Nutzung,
- geringeres Risiko, dass Besucher den Testmodus als regulären Patientendatenkanal verstehen.

Nachteile:

- UX-Inkonsistenz zwischen Route/Footer/Home und Header,
- Admin-Schalter `Online-Anamnesebogen – Test-Modus` wirkt weniger sichtbar nachvollziehbar,
- Nutzer können je nach Einstiegspunkt unterschiedliche Erwartungen entwickeln.

### Option B: Header zeigt bei public-enabled + anonym ebenfalls den Online-Link

Bedeutung:

- Header berücksichtigt zusätzlich `useAnamnesePublic()`.
- Wenn `anamnese_public=true`, zeigt der Header anonym `Anamnesebogen` mit `/anamnesebogen` statt PDF-Download.
- Wenn `anamnese_public=false`, bleibt anonym PDF-only bzw. bestehendes Verhalten erhalten.

Vorteile:

- konsistente öffentliche Navigation,
- Admin-Testmodus ist sichtbar am primären Einstiegspunkt nachvollziehbar,
- Route-Level- und Header-Semantik passen zusammen.

Nachteile/Risiken:

- Online-Testmodus wird prominenter; Besucher könnten ihn als echten, regulären Patientendatenkanal verstehen,
- vor Änderung sollte die Form selbst weiterhin klar verhindern, dass anonyme Nutzer Patientendaten absenden/speichern,
- UI-Text/Warnhinweise können später fachlich/legal überprüft werden müssen.

### Option C: Header zeigt beide Optionen oder einen explizit beschrifteten Testmodus

Bedeutung:

- Header könnte bei public-enabled anonym z. B. Online-Test und PDF unterscheiden.
- Das wäre UX-fachlich genauer, aber mehr Produkt-/Designänderung.

Bewertung:

- Für Phase 2 nicht optimal als nächster Mini-Schritt.
- Größeres UI-/Copy-Risiko.
- Sollte erst nach klarer fachlicher Entscheidung und ggf. Legal-/Datenschutztext erfolgen.

## Priorisierte Empfehlung für den nächsten technischen Schritt

Aus Stabilitäts- und Akkuranzsicht ist der nächste kleine technische Schritt nur dann sinnvoll, wenn Option B fachlich gewünscht ist:

1. gezielten RED-Test im bestehenden Header-Test ergänzen:
   - anonymer Nutzer,
   - `useAnamneseEnabled()` enabled,
   - neuer Mock für `useAnamnesePublic()` enabled,
   - Erwartung: Header zeigt Online-Link `/anamnesebogen` und keinen PDF-Download.
2. Test rot sehen, weil Header aktuell `useAnamnesePublic()` nicht kennt.
3. minimaler Produktivcode-Fix in `Header.tsx`:
   - `useAnamnesePublic()` importieren,
   - public-enabled anonym als Online-Link behandeln,
   - bestehendes Verhalten für eingeloggte Nutzer/Admins/public-disabled beibehalten.
4. fokussierte Tests:
   - `src/test/header-anamnese-navigation-smoke.test.tsx`,
   - optional Route-/Link-Surface-Tests als Regressionsschutz.
5. volle lokale Gates:
   - `npm test`,
   - `npm run build`,
   - `npx tsc --noEmit`,
   - `npm run lint` als bekannte Baseline,
   - isolierter ESLint-Check für geänderte Dateien.

Wenn Option A gewünscht ist, sollte kein Header-Fix erfolgen. Dann wäre der nächste technische Schritt eher eine UI-/Copy-Absicherung gegen Missverständnisse auf der Anamnesebogen-Seite selbst, ohne neue Patientendaten-Flows zu aktivieren.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine Formularfelder befüllt.
- Keine Anamnese-Submission ausgelöst.
- Keine Supabase-Daten geschrieben.
- Keine digitale Patientendatenübermittlung neu aktiviert.
- Dieses Dokument ist ein lokaler Entscheidungs-/Risikorecord und verändert keine Laufzeitlogik.

## Verifikation dieses Schritts

### Relevante fokussierte Characterization-Tests

Befehl:

```sh
npx vitest run \
  src/test/header-anamnese-navigation-smoke.test.tsx \
  src/test/anamnesebogen-public-route-characterization.test.tsx \
  src/test/public-anamnese-link-surfaces-characterization.test.tsx
```

Ergebnis:

```text
Test Files  3 passed (3)
Tests       6 passed (6)
Duration    1.97s
```

### Vollständige Testsuite

Befehl:

```sh
npm test
```

Ergebnis:

```text
Test Files  8 passed (8)
Tests       15 passed (15)
Duration    2.36s
```

### Build

Befehl:

```sh
npm run build
```

Ergebnis:

```text
3309 modules transformed
built in 4.96s
```

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite ist veraltet.
- Chunk-Größenwarnung: `index-C-ffOheS.js` größer als 500 kB nach Minification.

### TypeScript

Befehl:

```sh
npx tsc --noEmit
```

Ergebnis: Exit-Code 0, kein Output.

### Full Lint Baseline

Befehl:

```sh
npm run lint
```

Ergebnis weiterhin bekannte Bestandsschuld:

```text
332 problems (300 errors, 32 warnings)
```

Bewertung: unverändert zur bekannten Phase-2-Baseline, daher kein Blocker für diesen Dokumentations-/Entscheidungsschritt. Dieser Schritt hat nur Markdown im Projekt geändert und keine neue ESLint-pflichtige Code-Datei eingeführt.

## ShadowCopies

Pre-Step-ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-095115_pre-phase-2-public-anamnese-semantics-decision
```

Post-Step-ShadowCopy wird nach lokaler Verifikation und Commit erstellt.
