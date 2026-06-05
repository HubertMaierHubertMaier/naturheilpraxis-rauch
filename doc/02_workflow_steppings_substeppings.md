# 02 — Workflow-Steppings und Substeppings

## Zielbild

Die Anwendung sollte Patienten, Praxis-Team und Admins nicht nur Funktionen anbieten, sondern sicher durch Prozesse führen. Jeder Workflow braucht:

1. klare Startbedingung,
2. sichtbares Ziel,
3. wenige, verständliche Hauptschritte,
4. pro Hauptschritt konkrete Substeps,
5. automatische Speicher-/Validierungslogik,
6. verständliche Fehler und Wiederaufnahme,
7. finalen Status und nächste Handlung.

## Phase 1 — Öffentlicher Besucher-Workflow

### Aktueller Zustand

Die Startseite bietet drei gute Einstiege:

1. „Ich bin Neupatient“
2. „Ich bin schon Patient“
3. „Ich möchte mich informieren“

Zusätzlich gibt es Navigation zu Infothek, Anamnesebogen-PDF, Admin und Login.

### Lücken

- Der Übergang von „informieren“ zu „Termin/Neupatient“ könnte stärker geführt werden.
- Medizinische Artikel, Infothek und Praxisinformationen sind nicht sichtbar in eine Patient Journey eingebettet.
- Besucher bekommen wenig Rückmeldung, welcher Weg für ihre Situation der richtige ist.

### Verbesserter Workflow

#### Schritt 1 — Besuchertyp bestimmen

Substeps:

1. Auswahl: Neupatient / Bestandspatient / Interessent / Therapeutische Information.
2. Optional: „Ich weiß nicht genau“ → kurzer Entscheidungsassistent.
3. Ergebnis: empfohlener Pfad mit nächster Aktion.

#### Schritt 2 — Informationsbedarf klären

Substeps:

1. Themenauswahl: Beschwerden, Diagnostik, Ablauf, Kosten, Unterlagen, Datenschutz.
2. Anzeige relevanter Inhalte aus Infothek/Praxisinfo.
3. CTA: „Unterlagen vorbereiten“, „Praxis kontaktieren“, „Zum Neupatienten-Fahrplan“.

#### Schritt 3 — Übergang in aktiven Prozess

Substeps:

1. PDF-Paket herunterladen oder online fortfahren.
2. Hinweis auf Datenschutz und Vertraulichkeit.
3. Erwartungsmanagement: Dauer, benötigte Unterlagen, was nach Absenden passiert.

## Phase 2 — Neupatienten-Workflow

### Aktueller Zustand

`Neupatient.tsx` beschreibt „In 3 Schritten zu Deinem ersten Termin“ und verweist auf PDF-Paket, Dokumente und Online-Anamnesebogen.

### Lücken

- Offline-PDF und Online-Workflow sind nebeneinander, aber nicht als klare Alternativen mit Vor-/Nachteilen geführt.
- Es fehlt ein sichtbarer Status: „Du hast erledigt: X von Y“.
- Kein zentraler „Fortsetzen“-Mechanismus für Patienten, die später weitermachen.

### Zielworkflow

#### Hauptschritt 1 — Vorbereitung wählen

Substeps:

1. Auswahl: „Online ausfüllen“ oder „PDF herunterladen“.
2. Erklärung der Unterschiede:
   - Online: geführter Prozess, Zwischenspeicherung, digitale Verifikation.
   - PDF: offline ausfüllen, ausdrucken/mailen/mitbringen.
3. Datenschutz-Kurzhinweis.
4. Button: „Online starten“ / „PDF-Paket laden“.

#### Hauptschritt 2 — Stammdaten erfassen

Substeps:

1. Name, E-Mail, Telefon.
2. Geburtsdatum und Adresse.
3. Sorgeberechtigte falls relevant.
4. Validierung direkt am Feld.
5. Speichern als Entwurf.

#### Hauptschritt 3 — Medizinische Anamnese ausfüllen

Substeps:

1. Beschwerden und Ziele.
2. Vorerkrankungen.
3. Medikamente und Allergien.
4. Verdauung, Hormone, Herz/Kreislauf, Lunge, Niere, Leber, Neurologie, Zähne usw.
5. Lebensstil, Umwelt, Familienhistorie.
6. Pflichtfelder vor finalem Absenden prüfen.

#### Hauptschritt 4 — Dokumente bestätigen

Substeps:

1. Patientenaufklärung gelesen.
2. Datenschutz akzeptiert.
3. Patientenvertrag akzeptiert.
4. Optional: PDF-Vorschau.
5. Offene Punkte anzeigen.

#### Hauptschritt 5 — Digitale Bestätigung

Substeps:

1. E-Mail-Code anfordern.
2. Code eingeben.
3. Signatur/Bestätigung rechtssicher protokollieren.
4. Status auf „eingereicht“ setzen.
5. Bestätigung für Patient und Praxis erzeugen.

#### Hauptschritt 6 — Nächste Praxisaktion

Substeps:

1. Patient sieht: „Ihre Unterlagen sind eingegangen.“
2. Praxis sieht Aufgabe: „Neue Anamnese prüfen.“
3. Optionaler Termin-/Kontakt-Hinweis.
4. Export-/PDF-Download im Dashboard.

## Phase 3 — Anamnesebogen-Wizard

### Aktueller Zustand

`Anamnesebogen.tsx` enthält Wizard-Logik mit `wizardStep`, Section-Navigation, Draft-/Submit-Funktion und `submit-anamnesis` Edge Function.

### Lücken

- Viele Sektionen; ohne starke Mikroführung kann der Bogen überfordernd wirken.
- `any`-Typen in vielen Sektionen erhöhen Datenqualitätsrisiko.
- Draft-/Fortsetzen-Status sollte für Nutzer stärker sichtbar sein.
- Validierung sollte nicht erst am Ende spürbar werden.

### Ziel-Stepping

#### Schritt A — Orientierung

Substeps:

1. Dauer anzeigen: z.B. „ca. 25–45 Minuten“.
2. Fortschritt in Prozent und Sektionen.
3. Hinweis: „Sie können jederzeit speichern und später fortfahren.“
4. Legende: Pflichtfeld, optional, unsicher/weiß nicht.

#### Schritt B — Pro Sektion einheitlicher Ablauf

Jede medizinische Sektion sollte gleich funktionieren:

1. Kurzfrage: „Betrifft Sie dieser Bereich?“ Ja / Nein / Unsicher.
2. Nur bei Ja/Unsicher Detailfelder öffnen.
3. Pflicht-Minimum prüfen.
4. Option „nicht bekannt“ statt erzwungener Freitext.
5. Mini-Zusammenfassung am Ende der Sektion.
6. Button: „Speichern und weiter“.

#### Schritt C — Qualitätssicherung vor Submit

Substeps:

1. Vollständigkeitscheck.
2. Konfliktcheck, z.B. Medikament angegeben, aber Allergie/Unverträglichkeit leer.
3. Warnung bei sehr kurzen Freitexten in kritischen Bereichen.
4. Datenschutz-/Einwilligungscheck.
5. PDF-Vorschau.
6. Finaler Submit.

#### Schritt D — Nach Submit

Substeps:

1. Status: „wartet auf E-Mail-Bestätigung“.
2. Code-Eingabe.
3. Status: „eingereicht“.
4. Download/Bestätigung.
5. Hinweis, wie Änderungen nachträglich möglich sind.

## Phase 4 — Login-, Registrierung- und 2FA-Workflow

### Aktueller Zustand

`Auth.tsx` nutzt:

- `AuthStep = credentials | verification | reset_password`
- `AuthMode = login | registration | password_reset`
- Edge Functions: `request-verification-code`, `verify-code`, `notify-existing-patient`
- Admins skippen 2FA.
- Patientenlogin kann per App-Setting deaktiviert sein.

### Lücken

- Der Flow ist fachlich komplex und in einer sehr großen Datei gebündelt.
- 2FA-, Login-Lock-, Registration- und Passwort-Reset-Zustände sollten visuell klarer getrennt werden.
- Fehler sollten handlungsorientiert sein: „Was kann ich jetzt tun?“.

### Ziel-Stepping Login

#### Schritt 1 — Identität eingeben

Substeps:

1. E-Mail.
2. Passwort.
3. Button: Anmelden.
4. Falls Login deaktiviert: Telefonnummer/Praxis-Hinweis statt technischer Blockade.

#### Schritt 2 — Rolle und Status prüfen

Substeps:

1. Supabase Auth prüft Credentials.
2. Admin-Rolle prüfen.
3. Patient-Login-Setting prüfen.
4. Bei Admin: direkt weiter, aber Audit Log schreiben.
5. Bei Patient: 2FA-Code senden.

#### Schritt 3 — 2FA-Code bestätigen

Substeps:

1. Code-Feld mit 6 Stellen.
2. Countdown/„Code erneut senden“.
3. Max-Versuche anzeigen.
4. Bei Erfolg: Dashboard.
5. Bei Fehler: klare Ursache und nächste Aktion.

#### Schritt 4 — Session und Audit

Substeps:

1. Session speichern.
2. Login auditieren.
3. Rolle laden.
4. Startseite je Rolle: Admin-Cockpit oder Patienten-Dashboard.

### Ziel-Stepping Registrierung

1. E-Mail + Passwort.
2. Prüfung, ob Patient bereits existiert.
3. Code senden.
4. Code bestätigen.
5. Profil vervollständigen.
6. Einwilligungen bestätigen.
7. Dashboard öffnen.

### Ziel-Stepping Passwort-Reset

1. E-Mail eingeben.
2. Code senden.
3. Code bestätigen.
4. Neues Passwort setzen.
5. Login anbieten.

## Phase 5 — Patienten-Dashboard

### Aktueller Zustand

`PatientDashboard.tsx` zeigt persönlichen Bereich, Anamnesebogenstatus, PDF-Download und Links.

### Verbesserter Workflow

#### Schritt 1 — Status-Cockpit

Substeps:

1. „Ihre nächsten Schritte“ anzeigen.
2. Anamnesebogen: nicht begonnen / Entwurf / wartet auf Bestätigung / eingereicht / geprüft.
3. Dokumente: vorhanden / fehlen / aktualisieren.
4. Nachrichten/Hinweise der Praxis.

#### Schritt 2 — Dokumente

Substeps:

1. Letzte Einreichung anzeigen.
2. PDF herunterladen.
3. Änderungsanfrage starten.
4. Datenschutz-/Einwilligungsstatus anzeigen.

#### Schritt 3 — Infothek personalisiert

Substeps:

1. Von Praxis freigegebene Inhalte.
2. Nicht-diagnostische Hinweise.
3. Favoriten/zuletzt angesehen.
4. Download/Audio/Artikel.

## Phase 6 — Admin-Cockpit

### Aktueller Zustand

Adminbereich ist tab-basiert und funktionsorientiert.

### Ziel: Aufgabenorientiertes Cockpit

#### Admin-Hauptschritt 1 — Tagesübersicht

Substeps:

1. Neue Anamnesen.
2. Unbestätigte Einreichungen.
3. Patienten mit fehlenden Dokumenten.
4. Offene Therapieentwürfe.
5. KI-Auswertungen mit Review-Bedarf.
6. System-/Security-Warnungen.

#### Admin-Hauptschritt 2 — Patient prüfen

Substeps:

1. Patient auswählen.
2. Stammdaten prüfen.
3. Anamnese öffnen.
4. Auffälligkeiten/fehlende Felder anzeigen.
5. PDF/Export prüfen.
6. Status setzen: geprüft / Rückfrage / abgeschlossen.

#### Admin-Hauptschritt 3 — Therapieempfehlung erstellen

Substeps:

1. Patient/Pseudonym wählen.
2. Kontextdaten laden.
3. Pathogene/Labor/Freitext eingeben.
4. Draft speichern.
5. KI-Vorschlag generieren.
6. Fachlich prüfen.
7. Quellen/Begründung ergänzen.
8. Finalisieren und auditieren.

#### Admin-Hauptschritt 4 — Inhalte pflegen

Substeps:

1. FAQ/Praxisinfo/Preise/Infothek auswählen.
2. Entwurf bearbeiten.
3. Vorschau anzeigen.
4. Datenschutz-/medizinische Disclaimer prüfen.
5. Veröffentlichung bestätigen.
6. Änderungsprotokoll schreiben.

## Phase 7 — Edge-Function-/Backend-Workflow

### Ziel-Stepping für jede Function

Jede Edge Function sollte intern denselben Ablauf haben:

1. OPTIONS/CORS beantworten.
2. Request-ID erzeugen.
3. Methode prüfen.
4. Body parsen.
5. Zod-Schema validieren.
6. Auth prüfen.
7. Rolle prüfen.
8. Rate Limit prüfen.
9. Business-Logik ausführen.
10. Service-Role nur nach bestandener Prüfung verwenden.
11. Audit-Log schreiben, falls relevant.
12. Sensible Daten aus Logs entfernen.
13. Einheitliche Response zurückgeben.

### Vorteil

- leichter auditierbar,
- weniger Sicherheitsfehler,
- einheitliche Fehler für Frontend,
- Tests können generisch aufgebaut werden.

## Phase 8 — Betriebsworkflow

### Ziel-Stepping Deployment

1. `npm ci`
2. `npm test`
3. `npm run lint`
4. `npx tsc -p tsconfig.app.json --noEmit`
5. `npm run build`
6. Supabase Migration Dry Run/Staging
7. Edge Function Tests
8. Browser Smoke Tests
9. Security Checklist
10. Production Deploy
11. Post-Deploy Monitoring

### Ziel-Stepping Incident/Fehler

1. Fehler klassifizieren: UX / Daten / Auth / Supabase / KI / Deployment.
2. Logs ohne PII prüfen.
3. Reproduktion in Staging.
4. Minimaler Fix mit Regressionstest.
5. Review.
6. Deploy.
7. Audit-Eintrag/Changelog.

## Gesamtziel für Workflows

Die Anwendung sollte sich für Patienten wie ein geführter Gesundheitsaufnahmeprozess und für Admins wie ein Aufgaben-Cockpit anfühlen — nicht wie eine Sammlung vieler technischer Tabs und Formulare.
