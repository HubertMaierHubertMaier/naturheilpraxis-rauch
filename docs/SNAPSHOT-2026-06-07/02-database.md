# 02 — Datenbank: Tabellen, Funktionen, Storage, Migrationen

**Snapshot:** 2026-06-07 · Supabase-Projekt-Ref `jmebqjadlpltnqawoipb` (EU)

## 1. Tabellen (15 in `public`)

| Tabelle | Zweck | RLS | Hinweise |
|---|---|---|---|
| `profiles` | Patientenstammdaten (verknüpft mit `auth.users`) | ON | `user_id UNIQUE`, Trigger `handle_new_user` füllt bei Signup |
| `user_roles` | Rollenverwaltung (`admin` / `patient`) | ON | Separat von `profiles` — kein Privilege-Escalation |
| `anamnesis_submissions` | Vollständige Anamnese-JSON (Sections I–XXIII, XXV) | ON | `form_data jsonb`, `signature_data`, versionierte Einträge |
| `iaa_submissions` | IAA-Bogen (Section XXIV — Trikombin) | ON | `appointment_number int`, `therapist_data` |
| `verification_codes` | 2FA-OTP (6-stellig, 10 Min TTL) | ON | `type IN ('login','signup','submission')`, `used boolean` |
| `faqs` | FAQ-CMS (DE/EN) | ON | Admin-CRUD via `FAQManager` |
| `practice_info` | Praxis-Info-CMS (DE/EN) | ON | `slug`, `icon`, `sort_order` |
| `practice_pricing` | Preise (DE/EN) | ON | `service_key`, von `PricingManager` verwaltet |
| `admin_knowledge_base` | Wissensdatenbank für Admin/Therapeut (mit Dosierungen) | ON | Hierarchisch via `parent_id`, `tags[]`, `evidence_grade` |
| `patient_resources` | Patienten-Bibliothek (PDF/MP3-Verweise auf Storage) | ON | Nur verifizierte Patienten lesen |
| `app_settings` | Feature-Flags (`anamnese_enabled`, `anamnese_public`, `patient_login_enabled`) | ON | Singleton-Row, von Toggle-Komponenten gesetzt |
| `audit_log` | DSGVO-konformes Audit-Logging | ON | Schreibzugriff nur via `insert_audit_log`-Funktion |
| `therapy_sessions` | Pseudonymisierte Therapie-Sessions (KI-Empfehlungen, Verlauf) | ON | `pseudonym_id` statt User-FK, Auto-Save |
| `mannayan_products` | Produktkatalog (Vitaplace etc.) | ON | Admin-CRUD via `MannayanPriceManager` |
| `mannayan_orders` | Bestellungen | ON | `next_mannayan_order_number()` Sequenz |

### Enums
```sql
CREATE TYPE public.app_role     AS ENUM ('admin', 'patient');
CREATE TYPE public.language_code AS ENUM ('de', 'en');
```

---

## 2. Datenbank-Funktionen (6 RPCs in `public`)

| Funktion | Signatur | Zweck | Security |
|---|---|---|---|
| `has_role` | `(_user_id uuid, _role app_role) → boolean` | Rollen-Check (verhindert RLS-Rekursion) | `SECURITY DEFINER`, `search_path = public` |
| `is_verified_patient` | `(_user_id uuid) → boolean` | Patient-Verifikation für Bibliotheks-Zugriff | `SECURITY DEFINER` |
| `handle_new_user` | Trigger nach `auth.users` INSERT | Legt `profiles`-Row + Default-Rolle `patient` an | `SECURITY DEFINER` |
| `insert_audit_log` | `(action text, target_type text, target_id uuid, meta jsonb)` | Einzige erlaubte Schreibroute für `audit_log` | `SECURITY DEFINER` |
| `next_mannayan_order_number` | `() → int` | Atomare Bestell-Sequenz | regulär |
| `update_updated_at_column` | Trigger | Setzt `updated_at = now()` bei UPDATE | regulär |

---

## 3. Storage-Buckets (2)

| Bucket | Zweck | Zugriff |
|---|---|---|
| `anamnesis-pdfs` | Generierte Anamnese-PDFs (sync gespeichert nach Submission) | RLS: User liest nur eigene; Admin via Service-Role |
| `patient-library` | Patienten-Bibliothek (PDFs, MP3s, Skripte) | RLS: nur verifizierte Patienten (`is_verified_patient`) |

---

## 4. RLS-Policies (Logik-Übersicht)

Vollständige Policies leben im Supabase-Projekt; hier die Logik:

- **`profiles`**: User liest/updated **nur eigene** Row (`auth.uid() = user_id`); Admin (`has_role('admin')`) liest alle.
- **`user_roles`**: Read nur durch `has_role('admin')`; Insert/Update nur Service-Role (kein Client-Zugriff).
- **`anamnesis_submissions` / `iaa_submissions`**: User CRUD eigene; Admin liest alle.
- **`verification_codes`**: Schreibrechte nur Edge Functions (Service-Role); Read durch Owner mit `used = false`.
- **`faqs` / `practice_info` / `practice_pricing`**: Public SELECT `is_published = true`; Admin ALL.
- **`admin_knowledge_base`**: Nur `has_role('admin')` lesen/schreiben (Memory: `wiki-access-security`).
- **`patient_resources`**: SELECT für `is_verified_patient(auth.uid())`; Admin ALL.
- **`app_settings`**: Public SELECT (Feature-Flags brauchen anon-Read); UPDATE nur Admin.
- **`audit_log`**: Public INSERT **nur via `insert_audit_log`-Funktion** (SECURITY DEFINER); SELECT nur Admin.
- **`therapy_sessions`**: Nur Admin (über Service-Role in Edge Functions).
- **`mannayan_products` / `mannayan_orders`**: Public SELECT Produkte; Orders nur Admin + Owner.

Jede Tabelle hat in der gleichen Migration explizite `GRANT`-Statements (`anon`, `authenticated`, `service_role` je nach Policy).

---

## 5. Migrationen (32 Stück, chronologisch)

```
20260117200640  Initial schema (profiles, user_roles, anamnesis_submissions)
20260119121758  has_role function
20260119121835  handle_new_user trigger
20260124123818  verification_codes
20260129093821  faqs, practice_info
20260220180401  iaa_submissions
20260221162846  practice_pricing
20260221164443  RLS policies hardening
20260228153858  admin_knowledge_base
20260228155611  Wiki tags + evidence_grade
20260305101944  app_settings (feature flags)
20260306212503  audit_log + insert_audit_log
20260307182854  therapy_sessions (pseudonym-based)
20260324170333  patient_resources + is_verified_patient
20260324175939  patient-library storage bucket
20260324183009  anamnesis-pdfs bucket
20260325160343  mannayan_products
20260325163031  mannayan_orders + sequence
20260402114012  IAA appointment_number
20260402114308  Wiki parent_id hierarchy
20260402115235  Anamnesis versioning support
20260402120125  Audit log refinements
20260402143339  Patient resources expansion
20260427125607  Feature flag: anamnese_public
20260428124309  Therapy sessions auto-save
20260428165625  Wiki search optimization
20260505124141  Mannayan ordering refinements
20260505134326  Patient verification workflow
20260507114513  Audit log meta expansion
20260507153809  Therapy session notes field
20260508154049  Anamnesis form_data schema extension
20260606191747  Phase-3 RLS + GRANT hardening (latest)
```

> Die echten SQL-Statements liegen in `supabase/migrations/`. Diese Liste ist die Master-Übersicht.

---

## 6. Backup-Empfehlung

Vor größeren Umbauten:
```sql
-- CSV-Export pro Tabelle via Lovable Cloud UI:
-- Cloud → Database → Tables → <Tabelle> → Export CSV
-- Mindestens: profiles, anamnesis_submissions, iaa_submissions, therapy_sessions,
--            admin_knowledge_base, audit_log, app_settings
```
Storage-Buckets via `supabase storage` API einzeln herunterladen.
