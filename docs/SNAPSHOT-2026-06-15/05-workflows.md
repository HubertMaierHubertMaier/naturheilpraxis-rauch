# 05 — Workflows

## A) Anamnese-Submission (Neupatient)

```
1. User → /erstanmeldung → Konto anlegen (E-Mail + PW + HIBP-Check)
2. → /anamnesebogen (auth required oder Public-Toggle aktiv)
3. 25 Sektionen ausfüllen (Auto-Save als 'draft' in anamnesis_submissions)
4. Digitale Signatur (Canvas) + Consent-Checkbox
5. „Absenden" → request-verification-code (6-stellig per Mail)
6. OTP eingeben → verify-code → submit-anamnesis Edge Function:
   - PDF generieren (pdfExportEnhanced)
   - Bucket-Save: anamnesis-pdfs/<userId>/<timestamp>.pdf
   - Mail-Routing: Anamnese-Daten → anamnese@art-of-therapy.de
   - Status auf 'submitted', Mail an User mit Kopie
7. User-Profile bekommt Profil-Daten (street, postal_code, city, dob)
```

## B) Patient-Verifikation (manuell durch Admin)

```
1. Admin → /admin → PatientManager
2. Tabellarische Liste aller registrierten User
3. Klick auf „Verifizieren" → profiles.is_verified_patient = true
4. Optional: notify-existing-patient für Welcome-Mail
5. User hat ab sofort Zugriff auf:
   - /patient-dashboard
   - /patienten-bibliothek
   - Hypnose-Module
```

## C) IAA-Workflow (Therapie-Verlauf)

```
1. Verified Patient → /patient-dashboard → „Folgetermin-Fragebogen"
2. IAAForm (inkl. Section XXIV Trikombin-Skala) ausfüllen
3. Submit → iaa_submissions (mit appointment_number)
4. Therapeut ergänzt therapist_data
5. generate-icd10 → Auto-PDF → send-icd10-report → iaa@art-of-therapy.de
```

## D) Therapie-Empfehlung (Admin) — **neu erweitert**

```
1. Admin → /admin → Therapy Recommendation
2. Pseudonym wählen (kein Klarname!) → patient_snapshot via RPC laden
3. Eingaben ausfüllen (Symptome, Labor, ...)
   ┌─ optional: Apotheker-Rezept-PDF hochladen
   │  → MultiDocUpload → analyze-documents (OCR + PII-Scrub)
   │  → extrahierter Text wird in apothekerRezept-Textarea angehängt
   ├─ optional: Zusatz-Therapie (z. B. Stuhlanalyse)
   └─ Auto-Save alle ~5s via upsert_therapy_autosave_draft RPC
4. „KI-Empfehlung generieren" → therapy-recommend
   - Wiki-Boost via gewählte Ordner (garantiert), Suche auf ganzer DB
   - Pin-Mechanismus: bestimmte Vitaplace/Mannayan-Mittel zwingend
   - Kostenoptimierung: bevorzugte Remedies zuerst
5. „Meine Therapie prüfen" (grüner Block) → check-hp-therapy
   - bewertet HP-Therapie + Apotheker-Rezept (Pflicht ≥5 Zeichen) + Zusatz-Therapie
   - Lücken, Wechselwirkungen, Sinnhaftigkeit, Kosten
6. Befund speichern:
   - Als PDF (jsPDF)
   - HTML in neuem Tab
   - HTML-Download
   - Persistent in therapy_sessions (kind='befund_auswertung', befund_html)
7. Versionierung: assign_therapy_session_version-Trigger setzt version_number
```

## E) 2FA-Login

```
1. /auth → E-Mail + PW
2. supabase.auth.signInWithPassword → Session erzeugt
3. Frontend prüft: hat_admin_role? → wenn ja: Bypass (kein 2FA)
4. Sonst: request-verification-code → PHP-Relay → SMTP → User
5. OTP-Input → verify-code (validiert verification_codes.code, expires_at, used)
6. Bei OK: Session als „2FA-verified" markiert (z. B. localStorage Flag + Audit-Log)
7. Redirect auf /patient-dashboard oder /
```

## F) Hypnose-Audio-Generierung

```
1. Skripte unter scripts/build-*-hypnose.py
2. Edge-TTS mit Stimme de-DE-FlorianMultilingualNeural, Rate -50%, Pitch ±0
3. Output: public/therapie/<modul>/*.pdf (Begleitskripte) + MP3s (in patient-library Bucket)
4. Player: src/components/hypnose/HypnoseAudioPlayer.tsx
```

## G) E-Mail-Versand (PHP-Relay v3.6)

```
Edge Function → HTTPS POST mit RELAY_SECRET → PHP-Relay (eigener Linux-Server)
  → SMTP Port 587 STARTTLS → CRLF-Endings → Fallback: mail()
PHP-Datei: docs/mail-relay-v3-smtp.php (im Repo gesichert)
```
