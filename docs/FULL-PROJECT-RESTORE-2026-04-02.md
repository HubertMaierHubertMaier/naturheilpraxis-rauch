# Vollständiger Projekt-Wiederherstellungspunkt
**Datum:** 2026-04-02
**Status:** Stabil – alle Features funktionsfähig

## Aktuelle Features (Stand 2026-04-02)

### Patientenflow
- **Neupatient**: Registrierung → E-Mail-Verifizierung → Anamnesebogen → Absenden
- **Bestandspatient**: Login → Erstanmeldung-Seite mit "Bogen ergänzen"-Button → Vorausgefüllter Anamnesebogen im Edit-Modus
- **Versionierung**: Jede Ergänzung wird als neue Version (V1, V2, V3...) gespeichert
- **Patienten-Dashboard**: Zugang zu Infothek, Anamnesebogen-Versionen, PDF-Export

### Anamnesebogen
- 20+ Sektionen (Intro bis Unterschrift)
- Permanenter Fortschrittsbalken (sticky)
- Edit-Modus mit vorausgefüllten Daten
- Signatur-Reset bei Ergänzungen
- PDF-Export (Enhanced)

### Admin-Dashboard
- Patientenverwaltung, FAQ-Manager, Wissensdatenbank
- ICD-10 Generator, Therapieempfehlungen
- Audit-Log, Praxisinfo-Manager, Preisgestaltung

### Infothek
- Frequenztherapie, Heilpraktiker-Info, Ernährung
- Milch-Artikel, Raucherentwöhnung
- Statische HTML-Handouts

### Authentifizierung
- E-Mail/Passwort mit Verifizierung
- Rollenbasiert (admin/patient)
- RLS-Policies auf allen Tabellen

### Edge Functions
- submit-anamnesis, verify-code, request-verification-code
- send-verification-email, generate-icd10, therapy-recommend
- get-patients, notify-existing-patient, resend-submission
- send-icd10-report, elevenlabs-tts

### Datenbank-Tabellen
- profiles, anamnesis_submissions, iaa_submissions
- user_roles, verification_codes, audit_log
- faqs, practice_info, practice_pricing
- admin_knowledge_base

## Hinweis
Code ist via GitHub synchronisiert – vollständige Wiederherstellung jederzeit möglich.
