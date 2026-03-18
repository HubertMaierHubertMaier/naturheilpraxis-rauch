# Full Project Restore – 2026-03-18T07:15:00Z

## Zeitstempel & Anlass
- **Erstellt:** 18.03.2026, 07:15 UTC (08:15 MEZ)
- **Anlass:** Wiederherstellungspunkt vor Reset der Test-Accounts (redshift-three@gmx.com, aktiv@webdesign-pur.de) auf Erstanmeldungsstatus
- **Projekt-Version:** Produktiv – SMTP Mail-Relay V3.6, Diabetes-Handout mit erweiterten GI-Tabellen (6-Spalten: GI, kcal, KH, BE, GL)

---

## 1. Architektur-Übersicht

| Komponente | Technologie | Version |
|---|---|---|
| Frontend | React + Vite + TypeScript | React 18.3.1, Vite 5.4.19 |
| Styling | Tailwind CSS + shadcn/ui | Tailwind 3.4.17 |
| Backend | Lovable Cloud (PostgreSQL, Auth, Edge Functions) | Supabase JS 2.90.1 |
| E-Mail | PHP Mail-Relay V3.6 (SMTP Auth, CRLF) | Port 587, STARTTLS |
| PDF | jsPDF 4.0.0 (Browser-seitig) | — |

### Projekt-IDs
- Supabase Project: `jmebqjadlpltnqawoipb`
- Relay-URL: `https://rauch-heilpraktiker.de/mail-relay.php`
- Published URL: `https://naturheilpraxis-rauch.lovable.app`

---

## 2. Datenbank-Schema (9 Tabellen)

| Tabelle | Spalten | Beschreibung |
|---|---|---|
| `profiles` | 12 | Benutzerdaten (user_id, email, name, adresse, geburtsdatum) |
| `user_roles` | 4 | Rollen (admin, patient) via `app_role` Enum |
| `anamnesis_submissions` | 7 | Eingereichte Anamnesebögen (form_data JSON, signature_data, status) |
| `iaa_submissions` | 8 | IAA-Fragebögen (form_data, therapist_data, appointment_number) |
| `verification_codes` | 7 | 2FA OTP-Codes (6-stellig, 10 Min TTL) |
| `audit_log` | 7 | DSGVO-Audit (login, logout, anamnesis_submitted) |
| `faqs` | 9 | FAQ-Einträge (DE/EN, sortierbar, publishable) |
| `practice_info` | 11 | Praxisinformationen (DE/EN, slug, icon, sortierbar) |
| `practice_pricing` | 12 | Preisliste (DE/EN, service_key, sortierbar) |

### Enums
- `app_role`: admin, patient
- `language_code`: de, en

### Datenbank-Funktionen
1. `has_role(_user_id uuid, _role app_role)` → boolean (SECURITY DEFINER)
2. `handle_new_user()` → trigger (erstellt profile + patient-Rolle bei Registrierung)
3. `update_updated_at_column()` → trigger (auto-updated_at)

### Storage Buckets
- `anamnesis-pdfs` (privat) – gespeicherte PDF-Versionen nach Einreichung

### Datenbestand zum Zeitpunkt des Snapshots
- 66 Profile (Ergebnis der Zählung über alle Tabellen)
- 3 Anamnesis-Submissions (alle von redshift-three@gmx.com)
- 0 IAA-Submissions
- 9 Verification-Codes (7x redshift-three, 2x aktiv@webdesign-pur.de)

---

## 3. RLS-Policies (Vollständig)

### anamnesis_submissions
- SELECT: Eigene (`auth.uid() = user_id`) + Admins (`has_role(auth.uid(), 'admin')`)
- INSERT: Eigene (`auth.uid() = user_id`)
- UPDATE: Eigene
- DELETE: Eigene

### audit_log
- SELECT: Admins only
- INSERT: Eigene (`auth.uid() = user_id`)

### faqs
- SELECT: Published (anon) + Admins (alle)
- INSERT/UPDATE/DELETE: Admins (authenticated)

### iaa_submissions
- ALL: Admins
- SELECT/INSERT/UPDATE: Eigene

### practice_info
- SELECT: Published (anon) + Admins (alle)
- INSERT/UPDATE/DELETE: Admins (authenticated)

### practice_pricing
- SELECT: Published (anon) + Admins (alle)
- ALL: Admins

### profiles
- SELECT: Eigene + Admins
- INSERT/UPDATE: Eigene

### user_roles
- SELECT: Eigene

### verification_codes
- INSERT/SELECT: Eigene (service-role Bypass für Edge Functions)

---

## 4. Edge Functions (8 Funktionen)

| Funktion | verify_jwt | Beschreibung |
|---|---|---|
| `submit-anamnesis` | false | Zod-validiert, 2FA, Rate-Limiting, ICD-10 (fest+Gemini), 3 PDFs, 3 E-Mails |
| `resend-submission` | false | Admin-Auth, holt Storage-PDFs, regeneriert ICD-10, sendet 3 E-Mails erneut |
| `get-patients` | false | Service-Role, aggregiert Profiles+Logins+Submissions |
| `generate-icd10` | false | KI-basierte ICD-10 Generierung via Gemini |
| `send-icd10-report` | false | ICD-10 Report per E-Mail |
| `request-verification-code` | false | OTP-Code Generierung und Versand |
| `send-verification-email` | false | Verifizierungs-E-Mail Versand |
| `verify-code` | false | OTP-Code Validierung |

### Shared Module
- `_shared/smtp.ts` (v3.6): PHP-Relay E-Mail-Versand mit CRLF, RFC 2047 Subject-Encoding, Attachment-Fallback, Admin-Benachrichtigung bei PDF-Fehler, 5s Delay für lokale Zustellung

### Konfigurierte Secrets
RELAY_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_DB_URL, SUPABASE_PUBLISHABLE_KEY, LOVABLE_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD

---

## 5. E-Mail-Routing

| E-Mail-Typ | Empfänger | Inhalt |
|---|---|---|
| Anamnese-Kopie | anamnese@art-of-therapy.de | Komplett-PDF mit IAA |
| IAA-Bericht | iaa@art-of-therapy.de | IAA-PDF + ICD-10 Codes |
| Patientenkopie | Patient (eigene E-Mail) | PDF ohne IAA-Auswertung |
| 2FA-Code | Patient | 6-stelliger OTP |
| PDF-Fehler-Warnung | info@rauch-heilpraktiker.de | Admin-Benachrichtigung |

---

## 6. Frontend-Routen (18 Seiten)

| Route | Komponente | Schutz |
|---|---|---|
| `/` | Index | öffentlich |
| `/auth` | Auth | öffentlich |
| `/anamnesebogen` | Anamnesebogen | ProtectedRoute |
| `/erstanmeldung` | Erstanmeldung | ProtectedRoute |
| `/anamnesebogen-demo` | AnamneseDemo | öffentlich |
| `/datenschutz` | Datenschutz | öffentlich |
| `/heilpraktiker` | Heilpraktiker | öffentlich |
| `/gebueh` | Gebueh | öffentlich |
| `/ernaehrung` | Ernaehrung | öffentlich |
| `/frequenztherapie` | Frequenztherapie | öffentlich |
| `/faq` | FAQ | öffentlich |
| `/praxis-info` | PraxisInfo | öffentlich |
| `/impressum` | Impressum | öffentlich |
| `/patientenaufklaerung` | Patientenaufklaerung | öffentlich |
| `/admin` | AdminDashboard | Admin-Check |
| `/patienten` | PatientenManager | Admin-Check |
| `/dashboard` | PatientDashboard | — |
| `*` | NotFound | — |

### Admin-Dashboard Tabs
FAQs, Praxis-Infos, Preise, Audit-Log, ICD-10 Generator, Patienten

---

## 7. Authentifizierung

- E-Mail/Passwort Login mit E-Mail-Bestätigung
- Dev-Bypass: `?dev=true` in Nicht-Produktion (sessionStorage-persistiert)
- Admin-Check: `has_role` RPC (SECURITY DEFINER)
- 2FA für Anamnesebogen-Einreichung (6-stelliger OTP, 10 Min)
- Audit-Trail: Login/Logout in `audit_log` Tabelle

### Admin-Accounts
- redshift-three@gmx.com
- aktiv@webdesign-pur.de
- info@rauch-heilpraktiker.de

### Test-Patient-Account
- praxis_rauch@icloud.com

---

## 8. Erstanmeldungs-Wizard

3-Schritte-Sequenz: Anamnesebogen → Patientenaufklärung → Datenschutz
- Telefon-Gate (Checkbox: Termin vorab vereinbart)
- Auto-Skip bei vorhandener Einreichung
- Auto-Redirect nach 2FA-Einreichung zurück zum Wizard

---

## 9. Statische Infoseiten (public/)

- `allergiebehandlung.html`
- `ass-salicylat-histamin.html`
- `candida-diaet.html`
- `diabetes-handout.html` (erweitert: 6-Spalten GI-Tabellen mit KH/100g, BE, GL + Legenden)
- `kraeuter-schmerz-entzuendung.html`
- `krankheit-ist-messbar.html`
- `patienteninfo-hochohmiges-wasser.html`
- `vieva-pro-vitalanalyse.html`
- `zapper-diamond-shield.html`

---

## 10. Letzte Änderungen vor diesem Snapshot

1. **Diabetes-Handout GI-Tabellen erweitert** – 6 Spalten (GI, kcal/100g, KH/100g, BE, GL) + Legende für GL-Ampel und BE-Erklärung
2. **PDF-Speicherungsbug behoben** – await statt fire-and-forget
3. **Temporal-Validierung** – Enddatum ≥ Startdatum in TemporalStatusSelect
4. **Unterschriftsdatum** – readOnly auf heute fixiert
5. **Onboarding-Wizard V2** – Telefon-Gate, Auto-Skip, Auto-Redirect
