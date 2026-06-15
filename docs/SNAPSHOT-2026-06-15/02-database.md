# 02 — Datenbank-Schema

## Quelle der Wahrheit

**Die 61 Migrations-Dateien unter `supabase/migrations/` SIND das Schema.**
Sie laufen bei Restore automatisch in chronologischer Reihenfolge ab. Diese Doku ist nur eine Übersicht.

Stand: 15.06.2026 — letzte Migration `20260615112830_8e45e6c0-16e8-4f7e-bca9-5029bd08ee04.sql`.

## 16 Tabellen im `public`-Schema

| Tabelle | Zweck | RLS-Policies |
|---|---|---|
| `admin_knowledge_base` | Admin-Wiki (Pathogene, Protokolle, Dosierungen) | Admin-only |
| `anamnesis_submissions` | Eingereichte Anamnesebögen | User-own + Admin-all |
| `app_settings` | Feature-Flags (z. B. `anamnese_public_enabled`) | Public read limited, Admin write |
| `audit_log` | DSGVO-Audit | User-own + Admin-all |
| `faqs` | Mehrsprachige FAQs | Public read published, Admin write |
| `iaa_submissions` | IAA-Fragebögen (Trikombin) | User-own + Admin-all |
| `mannayan_orders` | Bestellungen | Admin-only |
| `mannayan_products` | Produktkatalog mit Preisen | Admin-only |
| `patient_resources` | Patient Library (PDFs/MP3s) | Verified read, Admin write |
| `patient_snapshot` | PII-armer Schnellzugriff pro Pseudonym | Admin-only (über RPC) |
| `practice_info` | Mehrsprachige Praxis-Infos | Public read published, Admin write |
| `practice_pricing` | Dynamische Preisliste | Public read published, Admin write |
| `profiles` | User-Profile inkl. `is_verified_patient` | User-own + Admin-all |
| `therapy_sessions` | Therapie-Empfehlungen + Auto-Drafts + Befund-Auswertungen | Admin-only (über RPC) |
| `user_roles` | Rollen (`admin`, `patient`) — **getrennt von profiles!** | User-read-own, Admin-all |
| `verification_codes` | 6-stellige 2FA-OTPs | Service-Role-only |

## Spalten-DDL (kompakt)

```sql
admin_knowledge_base   (id uuid PK, title text, category text, tags text[], content text, ts*)
anamnesis_submissions  (id uuid PK, user_id uuid, form_data jsonb, signature_data text, status text, ts*)
app_settings           (key text PK, value jsonb, updated_by uuid, ts*)
audit_log              (id uuid PK, user_id uuid, action text, details jsonb, ip_address text, user_agent text, ts*)
faqs                   (id uuid PK, question_de/en text, answer_de/en text, sort_order int, is_published bool, ts*)
iaa_submissions        (id uuid PK, user_id uuid, form_data jsonb, therapist_data jsonb, appointment_number int, status text, ts*)
mannayan_orders        (id uuid PK, order_number text, patient_label text, items jsonb, total_eur numeric, notes text, created_by uuid, ts*)
mannayan_products      (id uuid PK, name text, price_eur numeric, unit text, sku text, category text, is_active bool, ts*)
patient_resources      (id uuid PK, title text, description text, category text, file_path text, file_type text, file_size bigint, tags text[], sort_order int, is_published bool, created_by uuid, ts*)
patient_snapshot       (pseudonym_id text PK, data jsonb, source_session_id uuid, source_created_at tstz, ts*)
practice_info          (id uuid PK, slug text, title_de/en text, content_de/en text, icon text, sort_order int, is_published bool, ts*)
practice_pricing       (id uuid PK, service_key text, label_de/en text, price_text_de/en text, note_de/en text, sort_order int, is_published bool, ts*)
profiles               (id uuid PK, user_id uuid, email text, first_name text, last_name text, phone text, date_of_birth date,
                        street text, postal_code text, city text, is_verified_patient bool, ts*)
therapy_sessions       (id uuid PK, pseudonym_id text, eingabe_daten jsonb, empfehlung text, notiz text, created_by uuid,
                        kind text, befund_html text, befund_meta jsonb,
                        version_number int, version_label text, parent_session_id uuid, ts*)
user_roles             (id uuid PK, user_id uuid, role app_role, created_at tstz)  -- ENUM app_role: 'admin','patient'
verification_codes     (id uuid PK, user_id uuid, code text, type text, expires_at tstz, used bool, created_at tstz)
```
`ts*` = `created_at timestamptz DEFAULT now()` + `updated_at timestamptz DEFAULT now()`

## DB-Functions (alle mit `SECURITY DEFINER` + `SET search_path = public`)

| Function | Zweck |
|---|---|
| `has_role(uuid, app_role)` | Rollen-Check (verhindert RLS-Rekursion) |
| `is_verified_patient(uuid)` | Verified-Check |
| `handle_new_user()` (Trigger) | Erstellt profile + user_role bei Signup |
| `update_updated_at_column()` (Trigger) | Auto-`updated_at` |
| `insert_audit_log(...)` | DSGVO-Audit-Eintrag |
| `next_mannayan_order_number()` | Sequenz `B-YYYY-####` |
| `extract_patient_snapshot_fields(jsonb)` | PII-armer Snapshot-Extrakt |
| `compact_therapy_session_input(jsonb, int)` | Komprimierter Session-Input |
| `get_therapy_patient_safe_snapshot(text, int)` | RPC für Frontend |
| `get_therapy_sessions_safe_list(text, int)` | Slim-Liste (RPC) |
| `get_therapy_session_safe_detail(uuid, bool)` | Detail mit optional Befund-HTML |
| `upsert_therapy_autosave_draft(text, jsonb, text, text)` | Auto-Save |
| `update_patient_snapshot_from_session()` (Trigger) | Snapshot sync |
| `assign_therapy_session_version()` (Trigger) | Versions-Nummer |
| `prevent_therapy_session_patient_mismatch()` (Trigger) | Patient-Safety-Block |

## Storage-Buckets (alle privat)

| Bucket | Inhalt |
|---|---|
| `anamnesis-pdfs` | Generierte Anamnese-PDFs (RLS via signed URLs) |
| `patient-library` | Geschützte PDF/MP3-Sammlung für Verified Patients |
| `therapy-documents` | Apotheker-Rezepte, Labor-Scans, Befunde |

## RLS-Policies

Vollständige Definitionen in den Migrations-Dateien. Hier nur das Muster:

- **`user_roles`** wird ausschließlich über `has_role()` (SECURITY DEFINER) geprüft → keine Privilege-Escalation möglich.
- **Admin-Tabellen** (`admin_knowledge_base`, `mannayan_*`, `patient_snapshot`, `therapy_sessions`, `verification_codes`): `using (has_role(auth.uid(), 'admin'))`.
- **User-Tabellen** (`anamnesis_submissions`, `iaa_submissions`, `profiles`, `audit_log`): `using (auth.uid() = user_id)` + Admin-Override.
- **Public-Read-Tabellen** (`faqs`, `practice_info`, `practice_pricing`, `app_settings`): `using (is_published = true)` für `anon`+`authenticated`.

## GRANTs (Muster)

Jede public-Tabelle hat in der Erstellungs-Migration:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
-- + GRANT SELECT TO anon NUR bei öffentlichen Tabellen
```
