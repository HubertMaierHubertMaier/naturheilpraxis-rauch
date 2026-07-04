# 07 Risk Register

## Legende

- Severity: `kritisch`, `hoch`, `mittel`, `niedrig`
- Eintritt: `hoch`, `mittel`, `niedrig`
- Phase: empfohlene Behebungsphase aus `08-phases-execution-plan.md`

## Risiko-Matrix

| ID | Severity | Eintritt | Bereich | Risiko | Auswirkung | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | kritisch | hoch | Auth | 2FA ist nicht serverseitig erzwungen | Patienten-Sessions koennen ohne harten MFA-Nachweis weiterverwendet werden | 1 |
| R-02 | kritisch | mittel | Anamnese | `submissionId` wird im Confirm-Pfad nicht gegen `user_id` gebunden | Integritaetsfehler bei Gesundheitsdaten und PDF-Zuordnung | 1 |
| R-03 | kritisch | hoch | DSGVO / Repo | `docs/database-backup-2026-03-01.md` enthaelt sensible Daten | Datenschutz- und Sicherheitsvorfall im Quellrepo | 0 |
| R-04 | hoch | hoch | Static Content | patientenspezifische oder semi-geschuetzte Inhalte liegen in `public/` | direkte Abrufbarkeit, Weitergabe und Indexierbarkeit | 1 |
| R-05 | hoch | hoch | Reproduzierbarkeit | `package-lock.json` ist nicht synchron zu `package.json` | Build/Test/Lint/CI aktuell nicht reproduzierbar | 0 |
| R-06 | hoch | mittel | Auth | OTPs werden im Klartext gespeichert | erhoehter Schaden bei DB-Einsicht oder Fehlkonfiguration | 2 |
| R-07 | hoch | hoch | Security | Rate-Limits fuer OTP/Admin-Funktionen sind nur in-memory | schwache Drosselung bei Missbrauch oder Brute Force | 2 |
| R-08 | hoch | mittel | Datenschutztext | Claims zu Session-Ende und AI-Nichtweitergabe weichen vom Code ab | regulatorisches und vertrauensbezogenes Risiko | 1 |
| R-09 | hoch | mittel | Browser Storage | Session und Anamnese-Drafts liegen in `localStorage` | Endgeraeterisiko bei gemeinsam genutzten oder kompromittierten Geraeten | 2 |
| R-10 | hoch | mittel | Zugriffssystem | `patient_access` und `profiles.is_verified_patient` sind parallel | inkonsistente effektive Rechte fuer Bibliothek und Inhalte | 2 |
| R-11 | hoch | mittel | Admin / Backup | `backup-export` konzentriert starke Exportrechte | hohe Exfiltrationsmoeglichkeit in einem Endpunkt | 3 |
| R-12 | mittel | hoch | SEO | Canonical-, Domain- und Sitemap-Drift | schlechte Suchkonsistenz und Crawlverschwendung | 4 |
| R-13 | mittel | hoch | Accessibility | `useContentProtection` blockiert Standardinteraktionen | schlechte Accessibility und rechtlich/inhaltlich problematische Nutzbarkeit | 4 |
| R-14 | mittel | mittel | Content Governance | SPA- und Static-Content-Welt driften auseinander | unklare Inhaltswahrheit und schwer wartbare Navigation | 4 |
| R-15 | mittel | mittel | Dokumentation | `securityAccessMatrix` und Alt-Doku sind teils veraltet | Fehlentscheidungen bei Aenderungen und Reviews | 0 |
| R-16 | mittel | mittel | Codebase | sehr grosse Monolith-Dateien | hohe Regressionswahrscheinlichkeit, schlechte Testbarkeit | 5 |
| R-17 | mittel | niedrig | Multitenancy | System wird implizit als tenant-faehig missverstanden | Fehlplanung bei kuenftiger Produktentwicklung | 6 |
| R-18 | mittel | mittel | Consent | Cookie-Banner hat keine echte technische Wirkung | Compliance- und Vertrauensproblem | 3 |
| R-19 | mittel | mittel | Logging | Audit-/Event-Pfade koennen patientennahe Metadaten enthalten | uebermaessige PII-Streuung in Logs | 3 |
| R-20 | niedrig | mittel | Admin UX | 14-Tab-Adminshell ohne Aufgabenpriorisierung | Bedienungsfehler und Betriebsineffizienz | 5 |

## Kurzbegruendung pro Risiko

### R-01 2FA nicht serverseitig erzwungen

Referenzen:

1. `src/pages/Auth.tsx:87-140,343-356`
2. `src/components/ProtectedRoute.tsx:12-39`
3. `src/contexts/AuthContext.tsx:103-124`

### R-02 Anamnese-Confirm ohne Eigentuemerbindung

Referenz:

1. `supabase/functions/submit-anamnesis/index.ts:502-515`

### R-03 Sensible Markdown-Sicherung im Repo

Referenz:

1. `docs/database-backup-2026-03-01.md`

### R-04 Oeffentliche `public/`-Inhalte mit nur clientseitigem Gating

Referenzen:

1. `public/infothek-gate.js`
2. `src/lib/infothekContent.ts`
3. `src/components/InfothekGateRoute.tsx`

### R-05 Gebrochene Reproduzierbarkeit

Beobachtung:

1. `npm ci` ist rot
2. `npm test`, `npm run build`, `npm run lint` und `npx tsc ...` sind im aktuellen Checkout nicht sinnvoll lauffaehig

### R-06 OTP im Klartext

Referenzen:

1. `supabase/functions/request-verification-code/index.ts:339-346`
2. `supabase/functions/submit-anamnesis/index.ts:407-414`

### R-07 In-memory Rate Limit

Referenzen:

1. `supabase/functions/request-verification-code/index.ts:58-87`
2. `supabase/functions/verify-code/index.ts:34-63`

### R-08 Datenschutztext nicht codekonform

Referenzen:

1. `src/pages/Datenschutz.tsx:61-62,125-126`
2. `src/integrations/supabase/client.ts:11-16`

### R-09 Browserseitige sensible Speicherung

Referenzen:

1. `src/integrations/supabase/client.ts:11-16`
2. `src/pages/Anamnesebogen.tsx`

### R-10 Zugriffsmodell driftet

Referenzen:

1. `src/hooks/usePatientAccess.ts`
2. `src/pages/PatientenBibliothek.tsx`
3. relevante RLS-/Migrationspfade zu `patient_resources` und `profiles`

### R-11 Backup-Endpunkt mit hoher Machtkonzentration

Referenzen:

1. `supabase/functions/backup-export/index.ts`
2. `src/components/admin/BackupCenter.tsx`

### R-12 SEO-Drift

Referenzen:

1. `src/components/seo/SEOHead.tsx`
2. `public/sitemap.xml`
3. `public/*.html`

### R-13 Accessibility-Blockaden

Referenz:

1. `src/hooks/useContentProtection.ts`

### R-14 Content Governance Drift

Referenzen:

1. `src/lib/infothekContent.ts`
2. `public/*.html`
3. `src/App.tsx`

### R-15 Veraltete Dokumentation / Matrix

Referenzen:

1. `src/lib/securityAccessMatrix.ts`
2. `docs/PROJECT-DOCUMENTATION.md`
3. `docs/SNAPSHOT-*`

### R-16 Monolith-Dateien

Referenzen:

1. `src/components/admin/TherapyRecommendation.tsx`
2. `src/pages/Anamnesebogen.tsx`
3. `src/pages/Auth.tsx`
4. `src/components/admin/BackupCenter.tsx`

### R-17 Fehlinterpretation als Multitenant-System

Es existiert derzeit kein Tenant-Modell.

### R-18 Consent ohne technische Wirkung

Referenzen:

1. `src/components/CookieBanner.tsx`
2. `public/*.html`

### R-19 Logging mit PII-Naehe

Referenzen:

1. `supabase/functions/submit-anamnesis/index.ts:732-743`
2. `src/components/admin/AuditLogManager.tsx`

### R-20 Admin UX ohne Betriebs-Cockpit

Referenz:

1. `src/pages/AdminDashboard.tsx:99-157`

## Priorisierte Reihenfolge

1. R-03, R-05, R-15 als Phase-0-Sicherungs- und Wahrheitsproblem
2. R-01, R-02, R-04, R-08 als Phase-1-Kernhaertung
3. R-06, R-07, R-09, R-10 als Phase-2-Sicherheitskonsolidierung
4. R-11, R-18, R-19 als Phase-3-Betriebs- und Datenschutzhaertung
5. R-12, R-13, R-14 als Phase-4-Frontend- und Search-Reife
6. R-16, R-20 als Phase-5-Wartbarkeits- und Betriebsqualitaet
7. R-17 nur bei echter Produktanforderung aktiv verfolgen
