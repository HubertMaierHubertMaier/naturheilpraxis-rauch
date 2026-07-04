# 01 System Landscape

## 1. Systemtyp

Die Anwendung ist eine monolithische Webplattform auf Basis von React, Vite, TypeScript und Supabase. Sie vereint oeffentliche Website, Patientenportal, Adminbereich und interne Therapie-Werkzeuge in einem einzigen Frontend- und Backend-Repository.

Zentrale Laufzeitdatei:

- `src/App.tsx`

## 2. Kernmodule

1. Oeffentliche Praxis- und Infothekseiten
2. Registrierung, Login, Passwort-Reset, E-Mail-Code-Workflows
3. Patienten-Dashboard
4. Digitale Anamnese mit IAA-Teilen, PDF-Export und E-Mail-Versand
5. Patientenbibliothek fuer PDFs und MP3s
6. Admin-Dashboard fuer CMS, Patientenzugaenge, Sichtbarkeit, Audit und Backup
7. Interne Therapie-/KI-Workflows inklusive Dokumentanalyse und Diagnosevorschlaegen

## 3. Top-Level-Struktur

| Pfad | Funktion | Bewertung |
| --- | --- | --- |
| `src/` | SPA-Quellcode | Kern des Systems |
| `public/` | Oeffentliche statische Assets, HTML-Handouts, PDFs, Gating-Skripte | Kritisch, da teils fuer patientensensitive Inhalte verwendet |
| `supabase/` | Edge Functions, Config, Migrations | Source of truth fuer Backend-Verhalten |
| `doc/` | historische Analyse-, Sicherheits- und Phasen-Dokumente | wertvoll, aber nicht immer aktuell |
| `docs/` | Restore-Snapshots, Restore-Runbooks, Alt-Dokumentation, Mail-Relay-Dateien | teils kritisch wegen sensibler Inhalte |
| `scripts/` | Python-Generatoren fuer PDFs/Hypnose-Artefakte | unvollstaendig dokumentiert |
| `assets/` | Backup- und geschuetzte Dokumentkopien | Redundanz und Governance-Risiko |
| `.lovable/` | Lovable-Metadaten | sekundar |

## 4. Build- und Tooling-Landschaft

Hauptdateien:

1. `package.json`
2. `vite.config.ts`
3. `vitest.config.ts`
4. `tailwind.config.ts`
5. `eslint.config.js`
6. `tsconfig.json`
7. `tsconfig.app.json`
8. `tsconfig.node.json`
9. `components.json`
10. `.env.example`

Wesentliche Eigenschaften:

1. Build ueber Vite
2. UI mit Tailwind CSS, shadcn-ui und Radix
3. Datenzugriff ueber `@supabase/supabase-js`
4. Tests mit Vitest und Testing Library
5. PDF-/Dokument-Funktionen ueber `jspdf`, `docx`, `mammoth`, `pdfjs-dist`, `jszip`

Architekturproblem im Tooling:

1. Das Repository fuehrt gleichzeitig `package-lock.json`, `bun.lock` und `bun.lockb`.
2. Das README beschreibt `npm` als kanonischen Pfad, aber die realen Lockfiles sind nicht mehr synchron.
3. Dadurch ist die lokale Reproduzierbarkeit aktuell gebrochen.

## 5. Frontend-Start und globale Provider

Startpunkt:

- `src/main.tsx`

Globale Huelle in `src/App.tsx`:

1. `QueryClientProvider`
2. `LanguageProvider`
3. `AuthProvider`
4. `TooltipProvider`
5. `Toaster`
6. `Sonner`
7. `SchemaOrg`
8. `BrowserRouter`
9. `CookieBanner`
10. `RoleSimulator`

Bewertung:

1. Sauberer globaler Startpunkt
2. Gute Grundstruktur fuer Feature-Splitting
3. Allerdings sehr viele Verantwortlichkeiten in einer einzigen App-Schale

## 6. Routing-Landschaft

### 6.1 Public/Core-Routen

| Route | Ziel |
| --- | --- |
| `/` | Startseite |
| `/auth` | Login/Registrierung/Reset |
| `/praxis-info` | Praxisinhalte |
| `/impressum` | Pflichtangaben |
| `/neupatient` | Onboarding fuer neue Patienten |
| `/infothek` | Inhaltsindex |
| `/app-uebersicht` | App-Uebersicht, aktuell oeffentlich |
| `*` | NotFound |

### 6.2 Geschuetzte oder semigeschuetzte Routen

| Route | Schutz |
| --- | --- |
| `/anamnesebogen` | `ProtectedRoute` + `AnamneseRouteGuard` |
| `/erstanmeldung` | `ProtectedRoute` |
| `/patienten-bibliothek` | `ProtectedRoute` |
| `/dashboard` | komponentenseitige Auth-Pruefung |

### 6.3 Admin-/intern geschuetzte Routen

| Route | Schutz |
| --- | --- |
| `/admin` | komponentenseitige Admin-Pruefung |
| `/patienten` | komponentenseitige Admin-Pruefung |
| `/wissensdatenbank` | komponentenseitige Admin-Pruefung |

### 6.4 Infothek-Gating

Viele oeffentliche Content-Routen sind in `src/App.tsx` ueber `InfothekGateRoute` umhuellt:

1. `/datenschutz`
2. `/heilpraktiker`
3. `/gebueh`
4. `/ernaehrung`
5. `/milch-unvertraeglichkeit`
6. `/milch-knochengesundheit`
7. `/rohmilch-mikrobiologie`
8. `/faq`
9. `/patientenaufklaerung`
10. `/quellenhinweis`
11. `/raucherentwoehnung`
12. `/schilddruese-hypnose`
13. `/reizdarm-hypnose`
14. `/parkinson-hypnose`
15. `/reizdarm`
16. `/knieschwellung`

Wichtig:

1. Die Route-Matrix in `src/lib/securityAccessMatrix.ts` ist fuer viele dieser Routen veraltet.
2. Das ist ein Zeichen dafuer, dass die Sicherheitsdokumentation dem App-Code hinterherlaeuft.

## 7. Static-Web-Landschaft ausserhalb von React

Der Ordner `public/` enthaelt viele vollstaendige HTML-Seiten und PDFs, zum Beispiel:

1. `therapieweg-uebersicht.html`
2. `allergiebehandlung.html`
3. `candida-diaet.html`
4. `diabetes-handout.html`
5. `parasiten-deutschland.html`
6. `viren-bakterien-deutschland.html`
7. `patienteninfo-hochohmiges-wasser.html`
8. `anamnesebogen-blanko.pdf`
9. `patientenvertrag-blanko.pdf`
10. `datenschutz-einwilligung-blanko.pdf`

Bewertung:

1. Diese Dateien sind technisch Deploy-Artefakte und damit oeffentlich erreichbar.
2. Ein clientseitiges Gating-Skript in `public/infothek-gate.js` aendert daran nichts Grundsaetzliches.
3. Dadurch umgeht ein Teil des Inhalts die React-, RLS- und Route-Logik des eigentlichen Systems.

## 8. Shared Frontend-Bausteine

### Layout und Navigation

1. `src/components/layout/Layout.tsx`
2. `src/components/layout/Header.tsx`
3. `src/components/layout/Footer.tsx`
4. `src/components/layout/InfothekDropdown.tsx`
5. `src/components/LanguageSwitcher.tsx`
6. `src/components/CookieBanner.tsx`

### Guards

1. `src/components/ProtectedRoute.tsx`
2. `src/components/AnamneseRouteGuard.tsx`
3. `src/components/InfothekGateRoute.tsx`

### Contexts

1. `src/contexts/AuthContext.tsx`
2. `src/contexts/LanguageContext.tsx`

### Hooks mit Systemrelevanz

1. `src/hooks/usePatientAccess.ts`
2. `src/hooks/useAdminCheck.ts`
3. `src/hooks/useInfothekGating.ts`
4. `src/hooks/useAnamneseOnlineEnabled.ts`
5. `src/hooks/useAnamnesePublic.ts`
6. `src/hooks/usePatientLoginEnabled.ts`
7. `src/hooks/useContentProtection.ts`

## 9. Anamnese-Subsystem

Primare Dateien:

1. `src/pages/Anamnesebogen.tsx`
2. `src/pages/AnamneseDemo.tsx`
3. `src/lib/anamneseFormData.ts`
4. `src/lib/pdfExport.ts`
5. `src/lib/pdfExportEnhanced.ts`
6. `src/lib/anamnesePdfDownload.ts`
7. `src/components/anamnese/`
8. `supabase/functions/submit-anamnesis/index.ts`

Charakteristik:

1. Sehr umfangreiches Formularsystem
2. 25 Teilbereiche
3. Wizard-/Accordion-Logik
4. Draft-Speicherung im Browser
5. E-Mail-Code-Bestaetigung
6. Mehrfacher PDF-Export
7. Mehrfacher E-Mail-Versand
8. ICD-10-Ableitung

## 10. Auth- und Zugriffs-Subsystem

Primare Dateien:

1. `src/pages/Auth.tsx`
2. `src/contexts/AuthContext.tsx`
3. `src/hooks/useAdminCheck.ts`
4. `src/hooks/usePatientAccess.ts`
5. `supabase/functions/request-verification-code/index.ts`
6. `supabase/functions/verify-code/index.ts`
7. `supabase/functions/notify-existing-patient/index.ts`
8. `supabase/config.toml`
9. `src/lib/devAdminBypass.ts`

Besonderheiten:

1. Custom-Registrierung statt nativer `signUp()`-Nutzung
2. E-Mail-Code-Flows fuer Registrierung, Login und Passwort-Reset
3. Admin-Bypass im Login
4. E-Mail-basierte Freigabe-Flags fuer Patienteninhalte

## 11. Admin- und Therapie-Subsystem

Primare Dateien:

1. `src/pages/AdminDashboard.tsx`
2. `src/components/admin/PatientAccessManager.tsx`
3. `src/components/admin/PatientManager.tsx`
4. `src/components/admin/BackupCenter.tsx`
5. `src/components/admin/TherapyRecommendation.tsx`
6. `src/components/admin/therapy/*`
7. `src/pages/Wissensdatenbank.tsx`

Wesentliche Faehigkeiten:

1. FAQ-/Praxis-/Preis-CMS
2. Zugangssteuerung per E-Mail
3. Sichtbarkeitssteuerung der Infothek
4. Patientenverwaltung
5. Bibliotheksverwaltung
6. Audit- und E-Mail-Log-Einsicht
7. Backup-Export
8. interne KI-Therapieunterstuetzung

## 12. Storage- und Bucket-Landschaft

Verwendete Buckets:

1. `anamnesis-pdfs`
2. `patient-library`
3. `therapy-documents`

Bewertung:

1. Sinnvolle fachliche Trennung
2. Aber teilweise divergierende Zugriffslogik zwischen UI, Tabellen und Storage-Policies

## 13. Datenmodell auf hoher Ebene

Wichtige Tabellen:

1. `profiles`
2. `user_roles`
3. `app_settings`
4. `verification_codes`
5. `anamnesis_submissions`
6. `iaa_submissions`
7. `patient_access`
8. `patient_resources`
9. `audit_log`
10. `faqs`
11. `practice_info`
12. `practice_pricing`
13. `infothek_gating`
14. `admin_knowledge_base`
15. `therapy_sessions`
16. `patient_snapshot`
17. `mannayan_orders`
18. `mannayan_products`

## 14. Dokumentationslandschaft

Es existieren drei Dokumentationsebenen:

1. `README.md` fuer lokalen Arbeitsmodus und Regeln
2. `doc/` fuer historische Stabilisierung und Phasenplaene
3. `docs/` fuer Restore-Punkte, Snapshots, Alt-Projektdokumentation und operative Artefakte

Bewertung:

1. Sehr viel Kontext vorhanden
2. Aber kein klarer dokumentarischer Source-of-Truth
3. Einzelne Dateien in `docs/` enthalten operative oder sensible Daten und sollten nicht als normale Produktdokumentation behandelt werden

## 15. Architektur-Fazit

Die fachliche Reichweite des Systems ist gross und fuer eine Einzelpraxis sehr ambitioniert. Die Hauptschwaeche ist nicht fehlende Funktionalitaet, sondern die Vermischung verschiedener Sicherheits-, Inhalts- und Betriebsmodelle in einem einzigen, teilweise historisch gewachsenen Monolithen:

1. SPA plus oeffentliche Static-Seiten
2. Rollenmodell plus E-Mail-Freigaben plus Admin-Bypass
3. RLS plus clientseitige Guards plus `public/`-Gates
4. medizinischer Produktkern plus interne KI-Experimente plus Backup/Restore im selben Repo

Diese Mischung ist beherrschbar, aber nur mit klarer Haertung, Reduktion von Parallelmodellen und einer neuen Source-of-Truth-Dokumentation.
