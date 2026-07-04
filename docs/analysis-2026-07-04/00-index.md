# Tiefenanalyse 2026-07-04

## Scope

- Repository: `naturheilpraxis-rauch`
- Analysepfad: `C:\Users\Administrator\Documents\Lovable\OpenCode\naturheilpraxis-rauch`
- Branch: `main`
- Analysierter Commit: `0563dc980898377f48a219310aa1561b50035590`
- Analysemodus: codebasiert, lokaler Checkout, Read/Write-Session ohne verifizierten Remote-Zugriff

## Methodik

Diese Analyse basiert auf:

1. dem aktuellen lokalen Codezustand unter `src/`, `supabase/`, `public/`, `doc/` und `docs/`
2. den aktuell vorhandenen Tests unter `src/test/`
3. den Supabase-Migrations- und Edge-Function-Dateien
4. den aktuell verfuegbaren Google Search Central Leitlinien bis 2026
5. einer lokalen Tool-Verifikation des Build-/Test-Zustands

Nicht Bestandteil dieser Analyse:

1. produktive Datenbankabfragen gegen Supabase
2. browsergestuetzte E2E-Tests gegen eine laufende Deployment-URL
3. verifizierte Remote-Diffs gegen GitHub/Lovable in dieser Session

## Ergebnisstruktur

1. `00-index.md`
2. `01-system-landscape.md`
3. `02-codebase-status.md`
4. `03-workflows-current-state.md`
5. `04-auth-rbac-multitenancy.md`
6. `05-security-dsgvo-gap-analysis.md`
7. `06-ui-ux-a11y-seo-google-2026.md`
8. `07-risk-register.md`
9. `08-phases-execution-plan.md`
10. `09-innovation-backlog.md`

## Executive Summary

Das Projekt ist fachlich weit entwickelt, aber technisch und regulatorisch ungleichmaessig abgesichert.

Der aktuelle Produktkern kombiniert in einem einzigen Repository:

1. oeffentliche Praxiswebsite
2. Authentifizierung und Registrierung
3. Patienten-Dashboard
4. digitale Anamnese mit Gesundheitsdaten
5. Patientenbibliothek
6. Admin-CMS
7. interne Therapie-/KI-Werkzeuge
8. Backup- und Restore-Funktionen

Die wichtigsten Befunde sind:

1. Das aktuelle Login- und 2FA-Modell ist nicht serverseitig als echter Zweitfaktor durchgesetzt.
2. Das Projekt ist kein Multitenant-System, sondern eine Single-Practice-Anwendung mit Rollen und E-Mail-Freigaben.
3. Mehrere Datenschutz- und Security-Claims in der Datenschutzerklaerung weichen vom realen Codeverhalten ab.
4. Patientensensitive Inhalte liegen teils in `localStorage`, teils in oeffentlich deployten `public/`-Assets.
5. Das Repository enthaelt selbst bereits sensible Restore-/Backup-Artefakte.
6. Die Build-/Test-Reproduzierbarkeit ist im aktuellen Checkout gebrochen, weil `package.json` und `package-lock.json` nicht synchron sind.
7. SEO, Accessibility und Google-Readiness sind inhaltlich brauchbar, aber technisch inkonsistent.
8. Die vorhandene Dokumentation in `doc/` und `docs/` ist wertvoll, aber teilweise veraltet oder widerspruechlich.

## Kritische Sofortthemen

1. Auth-/2FA-Haertung
2. DSGVO-Claim-vs-Code-Abgleich
3. Entfernung oder Absicherung sensibler Dateien in `docs/`
4. Abschaltung oder sichere Neusortierung oeffentlicher `public/`-Dateien mit nur clientseitigem Gating
5. Wiederherstellung der Reproduzierbarkeit (`package-lock.json` / Tooling / lokale Gates)

## Aktueller lokaler Gate-Status

Die lokal ausgefuehrten Pruefungen zeigen nicht nur Schulden, sondern einen aktuell gebrochenen Reproduzierbarkeitszustand:

1. `npm ci` ist rot, weil `package.json` und `package-lock.json` nicht synchron sind.
2. `npm test` ist im aktuellen Checkout nicht lauffaehig, weil `vitest` nicht installiert ist.
3. `npm run build` ist im aktuellen Checkout nicht lauffaehig, weil `vite` nicht installiert ist.
4. `npx tsc -p tsconfig.app.json --noEmit` ist im aktuellen Checkout nicht lauffaehig, weil keine passende lokale TypeScript-Installation aufgeloest wird.
5. `npm run lint` ist im aktuellen Checkout nicht lauffaehig, weil `eslint` nicht installiert ist.

Damit ist der reale Ist-Zustand schlechter als mehrere vorhandene historische Dokumente suggerieren.

## Umgang mit vorhandener Alt-Dokumentation

Die Ordner `doc/` und `docs/` bleiben wichtige historische Quellen, sind aber nicht gleichwertig zur aktuellen Code-Wahrheit.

Diese Analyse verwendet folgende Prioritaet:

1. Aktueller Code
2. Aktuelle Migrations- und Function-Dateien
3. Aktuelle Tests
4. Historische Projektdokumente nur als Kontext

Besonders vorsichtig zu behandeln sind:

1. `docs/PROJECT-DOCUMENTATION.md`
2. `docs/FULL-PROJECT-RESTORE-*.md`
3. `docs/SNAPSHOT-*`
4. `docs/database-backup-2026-03-01.md`

## Leseempfehlung

1. Fuer Management-/Produkt-Ueberblick: `00`, `07`, `08`
2. Fuer Architektur und Ist-Zustand: `01`, `02`, `03`
3. Fuer Auth, Zugriff und Mandantenfaehigkeit: `04`
4. Fuer Security, Datenschutz und Compliance: `05`
5. Fuer UX, Accessibility, SEO und Google 2026: `06`
6. Fuer stabile Weiterentwicklung nach der Sanierung: `09`

## Quellenkern

Wesentliche Source-of-Truth-Dateien fuer diese Analyse:

1. `src/App.tsx`
2. `src/pages/Auth.tsx`
3. `src/pages/Anamnesebogen.tsx`
4. `src/pages/PatientDashboard.tsx`
5. `src/pages/PatientenBibliothek.tsx`
6. `src/contexts/AuthContext.tsx`
7. `src/hooks/usePatientAccess.ts`
8. `src/lib/securityAccessMatrix.ts`
9. `supabase/config.toml`
10. `supabase/functions/request-verification-code/index.ts`
11. `supabase/functions/verify-code/index.ts`
12. `supabase/functions/submit-anamnesis/index.ts`
13. `supabase/functions/backup-export/index.ts`
14. `src/pages/Datenschutz.tsx`
15. `src/components/seo/SEOHead.tsx`
16. `src/components/seo/SchemaOrg.tsx`
