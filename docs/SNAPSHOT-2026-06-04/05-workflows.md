# 05 — End-to-End-Workflows (Step-by-Step)

**Snapshot:** 2026-06-04

Diese Workflows beschreiben **exakt das Verhalten der Plattform** im aktuellen Stand. Jeder Schritt ist im Code nachvollziehbar.

---

## WF-1: Registrierung Neupatient

1. User öffnet `/auth` (oder klickt "Neupatient" auf `/`)
2. Tab "Registrieren" wählen → Eingabe: E-Mail, Passwort, Vor-/Nachname, Telefon
3. Passwort-Check: HIBP (Have I Been Pwned) Pre-Check
4. `supabase.auth.signUp()` mit `email_confirm = false` (kein Auto-Confirm)
5. Trigger `handle_new_user` legt automatisch `profiles` + `user_roles (patient)` an
6. **2FA-Schritt (Pflicht):**
   - Frontend ruft `request-verification-code` mit `type: 'signup'`
   - Edge Function generiert 6-stelligen Code, speichert in `verification_codes`, sendet Mail via PHP-Relay
   - User gibt Code ein (Input-OTP-Component) → `verify-code`
   - Bei Erfolg: Session aktiv, Redirect zu `/erstanmeldung`
7. **Erstanmeldung-Wizard (`/erstanmeldung`):**
   - Step 1: Vollständige Stammdaten (Adresse, Geburtsdatum)
   - Step 2: Patientenaufklärung lesen + Checkbox "Gelesen & verstanden"
   - Step 3: Datenschutzerklärung + Vertrag — digitale Signatur (§ 126a BGB)
   - **Phone-Gate-Checkbox:** "Ich habe mit der Praxis telefoniert" (Pflicht-Bestätigung)
8. Speicherung: `profiles` aktualisiert, Vertrag-PDF an `anamnese@art-of-therapy.de`

---

## WF-2: Login (bestehender Patient)

1. `/auth` → Tab "Anmelden" → E-Mail + Passwort
2. `supabase.auth.signInWithPassword()`
3. **2FA-Check:**
   - `useAdminCheck` prüft Admin-Rolle → Admins: Bypass (Memory: `admin-2fa-bypass`)
   - Patienten: OTP-Code wird automatisch versandt, Eingabe verpflichtend
4. Redirect: Patient → `/dashboard`, Admin → `/admin`

---

## WF-3: Anamnesebogen ausfüllen + einreichen

1. User klickt "Anamnese starten" → Route `/anamnesebogen` (mit `AnamneseRouteGuard`)
2. Guard prüft:
   - `app_settings.anamnese_enabled = true` (sonst: Hinweis)
   - Wenn `anamnese_public = false` → Auth-Pflicht
3. **Auswahl Layout:** Wizard (Emoji-Navigation) ODER Accordion (Icon-Navigation) — User-Wahl persistent
4. 25 Sektionen ausfüllen (Validierung pro Section)
   - Type-First-Pattern (Begin → Status → End)
   - Nuklear-Med-Warnung in CancerSection
   - Minor-Guardian-Logic in PatientDataSection (Alter < 18 → Pflichtfelder Eltern)
5. **Versionierung:** Vorausgefüllte Updates erzeugen neuen chronologischen Eintrag (alte bleiben erhalten)
6. **Filtered Summary View:** Zeigt nur ausgefüllte Sektionen mit Auto-ICD-10-Codes (aus `icd10Mapping.ts`)
7. **Signatur (Section XXV):**
   - Konsent-Checkbox (DSGVO Art. 13)
   - Canvas-Signatur (Base64 PNG)
   - Hinweis auf Split-Transmission
8. **OTP-Verifikation für Submission:**
   - `VerificationDialog` öffnet sich
   - `request-verification-code` mit `type: 'submission'`
   - User gibt 6-Digit-Code ein
9. **Submit:**
   - PDF-Generierung via `pdfExportEnhanced.ts` (mit Signatur)
   - `submit-anamnesis` Edge Function:
     - INSERT `anamnesis_submissions` (status='submitted')
     - PDF-Upload nach `anamnesis-pdfs/<user_id>/<id>.pdf`
     - Split-Mail-Versand:
       - Anamnese-Sections (I-XXIII, XXV) → `anamnese@art-of-therapy.de`
       - IAA-Section (XXIV) → `iaa@art-of-therapy.de`
     - Patient erhält Bestätigungsmail
10. Redirect: `/dashboard` mit Erfolgs-Toast

---

## WF-4: IAA-Folgetermin (Trikombin-Analyse)

1. Admin/Patient öffnet IAA-Bereich
2. `iaa_submissions` mit `appointment_number`-Inkrement (1, 2, 3, …)
3. Fragebogen aus `iaaQuestions.ts` (409 LOC)
4. Submit → INSERT `iaa_submissions` + Mail an `iaa@art-of-therapy.de`

---

## WF-5: Therapieempfehlung (Admin-Tool)

1. Admin öffnet `/admin` → Tab "Therapie"
2. **Pseudonym wählen** (oder neu anlegen — DSGVO-konform, kein Klarname)
3. **PatientContextBar:** Alter, Hauptbeschwerden, Geschlecht
4. **Pathogene eingeben** (Latein-Nomenklatur, Autocomplete aus PathogenIndex)
5. **LabImage:** Optional Laborbild hochladen → `extract-lab-image` (Gemini Vision)
6. **Boost-Kategorien:** Wiki-Folder als Boost markieren (garantierte Priorität, KEIN Filter — Suche immer auf gesamter DB)
7. **PreferredRemedies:** Einzelne Mittel pinnen (z.B. Vitaplace-Produkte)
8. **Bestehende Patientenmittel:** Eingabe — werden kritisch bewertet
9. **Generieren:** `therapy-recommend` Edge Function
   - Hybrid-Search auf `admin_knowledge_base`
   - Gemini 2.5 Pro generiert Plan (HWG-konform, "kann unterstützen")
   - Kostengünstige Mittel priorisiert
10. **Output:** Markdown-Empfehlung im Editor (editierbar) + Notizfeld
11. **Auto-Save:** Bei jedem Tastendruck (debounced) → `therapy_sessions`
12. **PDF-Druck:** Rezept-Style (`printRecipe.ts`) für physische Kopie
13. **NLS-Disclosure:** Patienten-PDF klärt automatisch über Metapathia-Herkunft auf, sobald Pathogene > 0

---

## WF-6: Selbsthypnose (z.B. Raucherentwöhnung)

1. User öffnet `/raucherentwoehnung` (öffentlich)
2. **3-Säulen-Übersicht:**
   - Säule 1: Aufklärung (E-Zigaretten-Risiken)
   - Säule 2: Bioresonanz (Praxis-Anwendung)
   - Säule 3: Selbsthypnose (zum Download)
3. **Downloads:**
   - `Selbsthypnose-Wortlaut-Audio.pdf` (vollständiger TTS-Wortlaut, lesbar)
   - `Begleitskript-E-Zigarette.pdf` (Praxis-Anleitung)
   - MP3 (gehostet in `public/therapie/raucherentwoehnung/`, gerendert via Python-Script `scripts/build-raucher-hypnose.py` mit Edge-TTS Florian -50%)
4. `HypnoseAudioPlayer` für Web-Streaming
5. Gleicher Workflow gilt für `/schilddruese-hypnose` und `/reizdarm-hypnose`

---

## WF-7: Admin verifiziert Bestandspatient

1. Admin öffnet `/admin` → Tab "Patienten"
2. `PatientManager` listet alle `profiles` mit Submissions-Statistik
3. **Manuelle Verifikation:** Toggle `is_verified_patient = true`
4. **Mail-Resend:** Button → `notify-existing-patient` sendet Begrüßungsmail
5. Verifizierte Patienten erhalten Zugriff auf `/patienten-bibliothek` (RLS: `is_verified_patient()`)

---

## WF-8: Mail-Versand (PHP-Relay v3.6)

Jede Edge Function, die Mail sendet, ruft `_shared/smtp.ts`:

```
Edge Function (Deno)
  ↓ POST https://rauch-heilpraktiker.de/mail-relay.php
  ↓ Header: X-Relay-Token = RELAY_SECRET
  ↓ Body: { to, subject, html, attachments[] }
PHP-Relay v3.6
  ↓ Validiert Token
  ↓ Per-Recipient SMTP-Auth (Port 587, STARTTLS, CRLF-Endings)
  ↓ Fallback: PHP mail()
SMTP-Server (rauch-heilpraktiker.de)
  ↓
Empfänger (anamnese@ / iaa@ / Patient)
```

Quellcode-Referenz: `docs/mail-relay-v3-smtp.php`, `docs/send-email-relay.php`

---

## WF-9: Audit-Logging (DSGVO)

- Trigger sensible Aktionen: Login, Anamnese-Submit, Admin-Änderungen
- `insert_audit_log(action, details, ip, ua)` (SECURITY DEFINER)
- INSERT in `audit_log` mit pseudonymisierten Details (NIE Gesundheitsdaten im Klartext)
- Admin-View via `AuditLogManager.tsx`
- Retention: 10 Jahre

---

## WF-10: Feature-Toggles (Admin)

Drei App-Settings als Kill-Switches:
| Toggle | Component | Effekt |
|--------|-----------|--------|
| `anamnese_enabled` | `AnamneseToggle.tsx` | Anamnesebogen global an/aus |
| `anamnese_public` | `AnamnesePublicToggle.tsx` | Ohne Login ausfüllbar |
| `patient_login_enabled` | `PatientLoginToggle.tsx` | Auth-Bereich aktiv? Sonst `LoginDisabledBanner` |
