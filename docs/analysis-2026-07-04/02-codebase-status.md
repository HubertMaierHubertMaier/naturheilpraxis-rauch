# 02 Codebase Status

## 1. Git- und Checkout-Status

Zum Analysezeitpunkt:

1. Branch: `main`
2. Commit: `0563dc980898377f48a219310aa1561b50035590`
3. Tracking: `origin/main`
4. Lokales Repo vorhanden und lesbar
5. Nicht-interaktive Remote-Authentifizierung in dieser Session nicht bestaetigt

## 2. Reproduzierbarkeit und lokale Gates

### 2.1 Tatsachlicher Ist-Zustand

Die reale lokale Build-/Test-Kette ist im aktuellen Checkout nicht benutzbar.

Beobachtungen:

1. `npm ci` scheitert, weil `package.json` und `package-lock.json` nicht synchron sind.
2. `npm test` kann `vitest` nicht aufloesen.
3. `npm run build` kann `vite` nicht aufloesen.
4. `npm run lint` kann `eslint` nicht aufloesen.
5. `npx tsc -p tsconfig.app.json --noEmit` und `npx tsc -p tsconfig.node.json --noEmit` laufen nicht sinnvoll, weil keine korrekte lokale TypeScript-Toolchain aufgeloest wird.

### 2.2 Konkrete `npm ci`-Befunde

Das Lockfile ist fachlich veraltet gegenueber `package.json`, unter anderem bei:

1. `@supabase/supabase-js`
2. `jspdf`
3. `mammoth`
4. `pdfjs-dist`

Damit ist Phase 1 aus der historischen Dokumentation aktuell real nicht erfuellt, auch wenn aeltere Doku etwas anderes beschreibt.

## 3. Tooling-Drift

### 3.1 Paketmanager-Drift

Im Repo liegen gleichzeitig:

1. `package-lock.json`
2. `bun.lock`
3. `bun.lockb`

Das macht die Source of Truth fuer Dependency-Aufloesung unklar.

### 3.2 TypeScript-Drift

`tsconfig.json` und `tsconfig.app.json` sind bewusst locker:

1. `strict: false`
2. `strictNullChecks: false`
3. `noImplicitAny: false`
4. `allowJs: true`

Das reduziert kurzfristig Reibung, erhoeht aber die Wahrscheinlichkeit stiller Sicherheits- und Datenintegritaetsfehler.

### 3.3 Lint-Drift

`README.md` beschreibt eine bekannte historische ESLint-Baseline. Im aktuellen Checkout ist aber schon die Toolkette nicht reproduzierbar installiert. Das ist ein schwererer Zustand als bloss rote Lint-Regeln.

## 4. Teststatus

### 4.1 Vorhandene Testabdeckung

Unter `src/test/` existieren aktuell 18 Testdateien, unter anderem:

1. `phase4-security-access-matrix.test.ts`
2. `supabase-edge-function-jwt-policy.test.ts`
3. `repository-secret-policy.test.ts`
4. `sensitive-route-guard-smoke.test.tsx`
5. `anamnese-route-guard-smoke.test.tsx`
6. `app-public-routes-smoke.test.tsx`

### 4.2 Staerken der Testlandschaft

1. Gute Policy- und Guard-Charakterisierung
2. Mehrere Sicherheitsannahmen sind als Quellcode-Tests dokumentiert
3. Route-/Matrix-Drift wird teilweise aktiv geprueft

### 4.3 Grenzen der Testlandschaft

1. Kein echter End-to-End-Beweis des Registrierungs- oder Login-Flows
2. Kein serverseitiger 2FA-Nachweis im Sinne eines Session-Claims-Tests
3. Keine belastbare Integrationstestabdeckung fuer den Anamnese-Confirm-Pfad
4. Keine Abdeckung gegen echte Produktionskonfigurationen oder Deploy-Artefakte in `public/`

## 5. Codegroesse und Komplexitaet

Besonders grosse Hotspot-Dateien:

1. `src/components/admin/TherapyRecommendation.tsx`
2. `src/pages/Anamnesebogen.tsx`
3. `src/pages/Auth.tsx`
4. `src/components/admin/BackupCenter.tsx`
5. `src/lib/pdfExportEnhanced.ts`

Auswirkungen:

1. erschwerte fachliche Reviewbarkeit
2. hoehere Regressionsgefahr bei Aenderungen
3. schwierige testbare Extraktion von Sicherheits- und Workflow-Logik

## 6. Architekturelle Parallelmodelle

Die Codebasis verwendet in mehreren Bereichen gleichzeitig verschiedene Schutz- und Inhaltsmodelle:

1. React-Routen mit Guard-Komponenten
2. komponentenseitige Redirect-Pruefungen
3. RLS-Policies in Supabase
4. Edge-Function-Rollenpruefungen
5. clientseitige Freigabeflags ueber `patient_access`
6. oeffentliche `public/`-Dateien mit JavaScript-Gating

Das fuehrt zu hoher Drift-Wahrscheinlichkeit.

## 7. Dokumentationsdrift

### 7.1 Veraltete oder widerspruechliche Quellen

1. `docs/PROJECT-DOCUMENTATION.md` beschreibt nur 4 Edge Functions plus 1 Shared Module, waehrend die reale Function-Landschaft deutlich groesser ist.
2. `docs/PROJECT-DOCUMENTATION.md` nennt 18 Seiten, waehrend die aktuelle Route- und Static-Landschaft deutlich groesser ist.
3. `src/lib/securityAccessMatrix.ts` ist selbst Teil der Dokumentation, aber fuer mehrere Routen nicht mehr konsistent mit `src/App.tsx`.
4. `src/pages/AppUebersicht.tsx` beschreibt sich als Admin-Uebersicht, ist real aber oeffentlich geroutet.

### 7.2 Historische Restore-Dokumente

Die Dateien unter `docs/FULL-PROJECT-RESTORE-*` und `docs/SNAPSHOT-*` sind fuer die Historie wertvoll, duerfen aber nicht ungeprueft als aktuelle Wahrheiten verwendet werden.

## 8. Repo-Hygiene

### 8.1 Auffaellige Artefakte

1. `docs/database-backup-2026-03-01.md` mit sensiblen Daten
2. `docs/shadowcopy/Erstanmeldung.tsx.bak`
3. `scripts/__pycache__/`
4. mehrere PDF-Kopien in `public/` und `assets/`
5. Root-Fontdateien ausserhalb eines klaren Asset-Schemas

### 8.2 Mehrfachkopien kritischer Dateien

Beim Anamnesebogen-PDF existieren mehrere Varianten und Referenzen:

1. `public/anamnesebogen-blanko.pdf`
2. `assets/backups/anamnesebogen-blanko.pdf`
3. `assets/protected-pdfs/...`
4. Storage-basierte Downloadpfade
5. Referenzen in `src/lib/backupAreas.ts`

Solche Mehrfachkopien erhoehen Drift, Restore-Unsicherheit und versehentliche oeffentliche Exponierung.

## 9. Sicherheitsrelevante Build-/Code-Details

### 9.1 Supabase-Fallbacks im Frontend-Build

Historische Hinweise und Tests deuten darauf hin, dass Vite-/Supabase-Define-Fallbacks vorgesehen sind. Das ist stabilitaetsorientiert, muss aber sehr sauber von echtem Secret-Handling getrennt bleiben.

### 9.2 Secret-Hygiene im Repo

Positiv:

1. `src/test/repository-secret-policy.test.ts` versucht offensichtliche Secret-Leaks zu blockieren.
2. `.env.example` ist vorhanden.

Negativ:

1. Es gibt operative Mail-Relay-Dateien im Repo.
2. Es gibt sensible Restore-/Backup-Dokumente.
3. Die reine Secret-Pattern-Pruefung schuetzt nicht vor inhaltlich sensiblen Daten in Markdown-Dateien.

## 10. Operative Bewertung

### Gruen

1. fachlich starker Umfang
2. vorhandene Security-/Policy-Tests
3. klare Supabase-Grundarchitektur
4. gute Trennung einzelner Fachbereiche im UI

### Gelb

1. verteilte Zugriffssysteme
2. grosse Monolith-Dateien
3. Dokumentationsdrift
4. Static-HTML-Sonderwelt ausserhalb der SPA

### Rot

1. gebrochene Reproduzierbarkeit
2. unsynchrones Lockfile
3. sensible Alt-Dokumente im Repo
4. nicht serverseitig erzwungene 2FA-Semantik

## 11. Codebase-Fazit

Der aktuelle Stand ist kein normaler "kleiner Fix-vor-Feature"-Zustand. Es handelt sich um eine funktional reiche, aber technisch inkonsistente Gesundheitsplattform, bei der Build-Reproduzierbarkeit, Sicherheitsmodell und Dokumentationskonsistenz vor jedem weiteren signifikanten Funktionsausbau stabilisiert werden sollten.
