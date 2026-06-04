# 02 — Datenbank, RLS, Funktionen, Storage

**Snapshot:** 2026-06-04 — Live aus Supabase exportiert.

## 1. Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'patient');
CREATE TYPE public.language_code AS ENUM ('de', 'en');
```

## 2. Tabellen (15 in `public`)

### 2.1 `profiles` — Patientenstammdaten
| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | (FK auth.users) |
| email | text | NO | |
| first_name | text | YES | |
| last_name | text | YES | |
| phone | text | YES | |
| date_of_birth | date | YES | |
| street | text | YES | |
| postal_code | text | YES | |
| city | text | YES | |
| is_verified_patient | boolean | NO | false |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### 2.2 `anamnesis_submissions` — Anamnese-Daten
| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | (FK auth.users) |
| form_data | jsonb | (25-section JSON) |
| signature_data | text | NULL (Base64 PNG) |
| status | text | 'draft' |
| submitted_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### 2.3 `iaa_submissions` — IAA/Trikombin-Daten
| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | |
| form_data | jsonb | '{}' |
| therapist_data | jsonb | '{}' |
| appointment_number | integer | 1 |
| status | text | 'draft' |
| submitted_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### 2.4 `verification_codes` — 2FA-OTPs
| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | |
| code | text | (6-digit) |
| type | text | 'login' (auch 'signup', 'submission') |
| expires_at | timestamptz | (NOT NULL) |
| used | boolean | false |
| created_at | timestamptz | now() |

### 2.5 `user_roles` — Rollen (NIEMALS in profiles!)
| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | |
| role | app_role | 'patient' |
| created_at | timestamptz | now() |

### 2.6 `faqs` — DE/EN FAQ-Einträge
Spalten: `question_de`, `question_en`, `answer_de`, `answer_en`, `sort_order`, `is_published`

### 2.7 `practice_info` — Praxis-Infoblöcke
Spalten: `slug`, `title_de/en`, `content_de/en`, `icon`, `sort_order`, `is_published`

### 2.8 `practice_pricing` — Preisliste
Spalten: `service_key`, `label_de/en`, `price_text_de/en`, `note_de/en`, `sort_order`, `is_published`

### 2.9 `app_settings` — Feature-Toggles (Key/Value/JSONB)
Bekannte Keys:
- `anamnese_enabled` (bool) — globaler Toggle Anamnesebogen
- `anamnese_public` (bool) — ohne Auth zugänglich?
- `patient_login_enabled` (bool) — Login-Bereich aktiv?

### 2.10 `admin_knowledge_base` — Admin-Wiki
Spalten: `title`, `category` (Default 'Allgemein'), `tags text[]`, `content`. Hierarchisch über Kategorien.

### 2.11 `patient_resources` — Patienten-Bibliothek (PDF/MP3)
Spalten: `title`, `description`, `category`, `file_path` (in Storage), `file_type`, `file_size`, `tags`, `sort_order`, `is_published`, `created_by`.

### 2.12 `therapy_sessions` — Pseudonymisierte Therapie-Empfehlungen
| Spalte | Typ | Default |
|--------|-----|---------|
| pseudonym_id | text | (NOT NULL, DSGVO-konform) |
| eingabe_daten | jsonb | '{}' (Pathogene, Befunde, Patientenkontext) |
| empfehlung | text | '' (AI-generierter Therapieplan) |
| notiz | text | '' |
| created_by | uuid | (admin) |

### 2.13 `mannayan_products` — Heilmittel-Katalog
Spalten: `name`, `price_eur`, `unit`, `sku`, `category`, `is_active`.

### 2.14 `mannayan_orders` — Mittel-Bestellungen
Spalten: `order_number`, `patient_label`, `items jsonb`, `total_eur`, `notes`, `created_by`.

### 2.15 `audit_log` — DSGVO-Audit
Spalten: `user_id`, `action`, `details jsonb`, `ip_address`, `user_agent`, `created_at`.

---

## 3. RLS-Policies (43 aktiv)

Alle Tabellen haben **RLS aktiviert**. Übersicht (cmd = Operation):

### Patienten-eigene Daten
- `anamnesis_submissions`: Users CRUD eigene Daten; Admin SELECT alle
- `iaa_submissions`: Users CRUD eigene; Admin ALL
- `profiles`: Users SELECT/UPDATE/INSERT eigene; Admin SELECT/UPDATE alle
- `verification_codes`: Users SELECT eigene
- `user_roles`: Users SELECT eigene; Admin INSERT/UPDATE/DELETE
- `audit_log`: Users SELECT eigene; Admin SELECT alle

### Öffentliche Daten (anon + authenticated read)
- `faqs`: Anyone SELECT (where `is_published=true`); Admin CRUD
- `practice_info`: Anyone SELECT (where published); Admin CRUD
- `practice_pricing`: Anyone SELECT (where published); Admin ALL
- `app_settings`: Anyone SELECT; Admin CRUD

### Admin-only
- `admin_knowledge_base`: Only admins ALL
- `therapy_sessions`: Only admins ALL
- `mannayan_products`: Admins ALL
- `mannayan_orders`: Admins ALL

### Verified-Patient-only
- `patient_resources`: Verified patients SELECT (via `is_verified_patient()`); Admin ALL

---

## 4. Datenbank-Funktionen (6 in `public`)

| Name | Typ | Security |
|------|-----|----------|
| `has_role(_user_id uuid, _role app_role)` | function | DEFINER |
| `is_verified_patient(_user_id uuid)` | function | DEFINER |
| `handle_new_user()` | trigger function | DEFINER (auf auth.users INSERT → profiles) |
| `insert_audit_log(...)` | function | DEFINER |
| `next_mannayan_order_number()` | function | DEFINER |
| `update_updated_at_column()` | trigger function | INVOKER |

### `has_role` — kanonische Rollen-Prüfung
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;
```

### `handle_new_user` — Auto-Profil bei Signup
Trigger auf `auth.users INSERT` → erstellt automatisch `profiles`-Zeile + Default-Rolle `patient` in `user_roles`.

---

## 5. Storage-Buckets

| Bucket | Public | Zweck |
|--------|--------|-------|
| `anamnesis-pdfs` | NEIN | Gespeicherte Anamnese-PDFs (Path: `<user_id>/<submission_id>.pdf`) |
| `patient-library` | NEIN | PDFs/MP3s für verifizierte Patienten (Path: `<category>/<filename>`) |

Storage-Zugriff erfolgt über Edge Functions mit Service-Role oder signierte URLs (15 Min Default).

---

## 6. Indizes & Trigger (relevant)

- Trigger `update_*_updated_at` auf allen Tabellen mit `updated_at` (via `update_updated_at_column()`)
- Trigger `on_auth_user_created` auf `auth.users` → `handle_new_user()`
- Unique-Constraint `(user_id, role)` auf `user_roles`
- Unique-Constraint auf `practice_info.slug`, `practice_pricing.service_key`
