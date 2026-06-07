# 05 — End-to-End-Workflows (Schritt-für-Schritt)

**Snapshot:** 2026-06-07

## A. Registrierung (Neupatient)

1. User öffnet `/auth` → Tab "Registrieren".
2. Eingabe: E-Mail, Passwort (HIBP-Check aktiv), Vorname, Nachname.
3. Submit → `supabase.auth.signUp()`.
4. Trigger `handle_new_user` (DB): legt `profiles`-Row + `user_roles`(role=`patient`) an.
5. Standard-Confirm-Mail via `send-verification-email` (Public-Edge-Function).
6. User klickt Bestätigungs-Link → `auth.users.email_confirmed_at` gesetzt.
7. Bei erstem Login wird `request-verification-code` getriggert → 6-stelliger OTP per Mail-Relay.
8. User gibt OTP ein → `verify-code` → Session aktiv.

**2FA-Pflicht:** Login OHNE OTP wird abgelehnt (Memory: `two-factor-authentication`). **Admin-Bypass:** `has_role('admin')` darf OTP überspringen (Memory: `admin-2fa-bypass`).

---

## B. Anamnese-Bogen (Public oder Auth, je nach `anamnese_public`)

### B.1 Zugang
- `anamnese_enabled = true` UND
- entweder `anamnese_public = true` (Visitor) ODER User ist eingeloggt
- `AnamneseRouteGuard` redirected sonst zu `/`.

### B.2 Ausfüllen
1. `Anamnesebogen.tsx` rendert 25 Sektionen (Accordion oder Wizard — User-Wahl, Memory: `anamnesebogen-layout-selection`).
2. Auto-Save in `localStorage` pro Sektion.
3. Validierung: Pflichtfelder per Section, Type-First-Pattern (Memory: `anamnesis-medical-data-structure`).
4. Minderjährige → Guardian-Section aktiv (Memory: `anamnesis-form-minor-guardian-logic`).
5. Section XXIV (IAA / Trikombin) optional → Memory: `iaa-questionnaire-system`.
6. Patient_-Aufklärung-Checkbox Pflicht (Pricing-Disclosure, Memory: `patient-disclosure-legal-terms`).
7. Digitale Signatur im `SignatureSection` (`canvas` → Base64-PNG), §126a-BGB-konform (Memory: `digital-signature-legal-standard`).

### B.3 Submission
1. Klick "Absenden" → `VerificationDialog` öffnet sich.
2. User-Mail-Eingabe → `request-verification-code(type='submission')` → OTP per Mail.
3. User gibt OTP ein → `verify-code` validiert.
4. Bei Erfolg: `submit-anamnesis` mit vollem `form_data` + `signature_data` + verifiziertem Code.
5. Edge-Function:
   - Schreibt `anamnesis_submissions`-Row (Versioning, Memory: `anamnesis-versioning-system`)
   - Generiert PDFs (Anamnese + ggf. IAA) inline
   - Speichert in `anamnesis-pdfs`-Bucket (synchron, Memory: `anamnesis-pdf-management`)
   - **Split-Transmission** (Memory: `email-destination-routing-logic`):
     - Sections I–XXIII + XXV → `anamnese@art-of-therapy.de`
     - Section XXIV (IAA) → `iaa@art-of-therapy.de`
   - Bestätigungs-Mail an Patient mit Zusammenfassung (anonymisiert)
6. Frontend zeigt Erfolgs-Screen mit Download-Link zum PDF (signed URL).

---

## C. ICD-10-Generierung (Admin)

1. Admin öffnet eine Submission im Dashboard.
2. Klick "ICD-10 generieren" → `ICD10Generator`-Komponente.
3. Frontend ruft `generate-icd10` mit `form_data` auf.
4. Edge-Function:
   - Hybrid-Mapping: Erst feste Tabelle (`icd10Mapping.ts`), dann Gemini-2.5-Pro für unbekannte Beschwerden.
   - Output: `[{code, description, confidence}, ...]`
5. Admin reviewt + bearbeitet.
6. Klick "Report senden" → `send-icd10-report` → PDF an `iaa@art-of-therapy.de` (Memory: `icd10-berichte`).

---

## D. Therapie-Empfehlung (Admin)

1. Admin öffnet `TherapyRecommendation`-Tab.
2. Wahl: Bestehende Pseudonym-Session laden ODER neu anlegen.
3. Eingabe: Beschwerden, Pathogene (lateinische Nomenklatur, Memory: `admin-wiki-pathogen-nomenclature`), Laborwerte (optional via `LabImageUpload` → `extract-lab-image`).
4. Optional: Bevorzugte Mittel pinnen (Vitaplace-Linie, Memory: `admin-therapy-preferred-remedies`).
5. Optional: Wiki-Ordner als **Boost** auswählen (nicht Filter — Memory: `therapy-knowledge-search-boost`).
6. Klick "Empfehlung generieren" → `therapy-recommend`:
   - Wiki-Suche über ganze `admin_knowledge_base`
   - Gemini-2.5-Pro mit Wiki-Kontext + Sicherheits-Checks
   - Bestehende Mittel kritisch bewerten (Memory: `admin-therapy-recommendation-logic`)
   - Cost-effective priorisieren (Memory: `admin-therapy-recommendation-cost-logic`)
   - Sprache HWG/UWG-konform ("kann unterstützen")
7. Speichert in `therapy_sessions` (Pseudonym, Auto-Save, Notizfeld).
8. Klick "Drucken" → `printRecipe.ts` → Rezept-Druckansicht (Memory: `admin-therapy-recommendation-print`).
9. Patient-PDF erklärt NLS-Herkunft, falls Pathogene enthalten (Memory: `nls-befund-disclosure`).

---

## E. Hypnose-Module (z.B. Raucherentwöhnung)

1. Public-Route `/raucherentwoehnung`, `/schilddruese-hypnose`, `/reizdarm-hypnose`.
2. Seite zeigt Theorie + `HypnoseAudioPlayer`-Komponente.
3. Audio-Files **statisch** in `public/therapie/<thema>/*.mp3` (build-time generiert mit `scripts/build-*-hypnose.py` über Edge-TTS).
4. **TTS-Standard:** `de-DE-FlorianMultilingualNeural`, Rate `-50%`, Pitch `±0 Hz` — verbindlich (Memory: `tts-engine`).
5. Begleit-PDFs als Download:
   - `Selbsthypnose-Skript-Wortlaut.pdf` (Pflicht, Memory: `self-hypnosis-system`)
   - Themen-Begleitskript (z.B. `Begleitskript-E-Zigarette.pdf`)
6. Keine Server-Calls, keine Tracking — reine Static-Files.

---

## F. Patienten-Verifikation (Admin → bestehender Patient)

1. Admin im `PatientManager`-Tab.
2. Tabellarische Liste aus `get-patients`.
3. Klick "Verifizieren" bei einem Patienten:
   - Admin wählt "Bestehender Patient" oder "Neu (Standard-Flow)".
4. Bei Bestand: `notify-existing-patient` schickt Sonder-Mail mit Verifikations-Link.
5. Bei Klick gegenüber: User-Mail wird verifiziert, `is_verified_patient(user)` wird `true`.
6. User hat nun Zugriff auf `/patienten-bibliothek`.

---

## G. Patienten-Bibliothek (verifizierte User)

1. `/patienten-bibliothek` → `ProtectedRoute` + Check via `is_verified_patient`.
2. Lädt `patient_resources` (RLS gefiltert).
3. PDFs/MP3s via signed URLs aus `patient-library`-Bucket.
4. Memory: `patient-library` — separate von Wiki/Infothek.

---

## H. Wiki-Pflege (Admin)

1. `/wissensdatenbank` (Admin-only via UI; technisch durch RLS geschützt).
2. `KnowledgeBaseManager` zeigt Hierarchie (Folders + Articles via `parent_id`).
3. CRUD-Operationen direkt auf `admin_knowledge_base`.
4. **Pathogen-Parser** (Memory: `admin-wiki-pathogen-parser-logic`): Extrahiert Latein-Namen aus Markdown-Headern in `PathogenIndex`.
5. **Tag-Enrichment**: Batch-Lauf via `enrich-wiki-tags` (Gemini-Flash).
6. **Such-Logik** (Memory: `admin-wiki-search-logic`): German-optimiert, strict substring.
7. Evidence-Grade 1–3 Sterne (Memory: `knowledge-base-evidence-grading`).

---

## I. Mail-Versand-Pipeline (alle Mails)

```
Edge Function
   ↓ POST JSON
https://rauch-heilpraktiker.de/mail-relay.php  (PHP v3.6)
   ↓ X-Relay-Token auth
   ↓ pickRecipientAccount(from_account)
SMTP Port 587 STARTTLS (per-Recipient Auth)
   ↓ CRLF Line Endings
Empfänger-Mailserver
```

Bei SMTP-Fail → Fallback `mail()` (Memory: `email-relay-loesung`).

Mail-Konten:
- `anamnese@art-of-therapy.de` — Anamnese-Bögen
- `iaa@art-of-therapy.de` — IAA + ICD-10
- `noreply@art-of-therapy.de` — Bestätigungen / OTPs

---

## J. Audit-Logging

- Alle sicherheitskritischen Aktionen schreiben in `audit_log` via `insert_audit_log(action, target_type, target_id, meta)`.
- SECURITY DEFINER → nur kontrollierter Schreibpfad.
- Read nur Admin im `AuditLogManager`-Tab.
- 10-Jahres-Aufbewahrung (DSGVO konform — Memory: `dsgvo-specifics`).
