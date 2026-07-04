# 03 Workflows Current State

## 1. Leselogik

Jeder Workflow ist in folgende Ebenen zerlegt:

1. Ziel
2. Ist-Ablauf
3. Steppings
4. Substeppings
5. Schwachstellen
6. Relevante Dateien

## 2. Workflow A: Oeffentlicher Erstkontakt

### Ziel

Ein Besucher soll von der Startseite in einen klaren Pfad fuer Neupatient, Bestandsnutzer oder Wissensinhalte gelangen.

### Ist-Ablauf

1. Einstieg ueber `src/components/home/WelcomeSelection.tsx`
2. Weiterleitung in `Neupatient`, `Auth` oder `Infothek`
3. Zusaetzliche Quereinstiege ueber Header, Footer und Static-HTML-Seiten

### Steppings

1. Startseite rendern
2. Zielgruppe waehlen
3. Folgepfad aufrufen

### Substeppings

1. `Index` laedt Hero-, Welcome- und Info-Bloecke
2. Nutzer waehlt Neupatient oder Anmelden
3. Query-Parameter `type` wird fuer `Auth` gesetzt

### Schwachstellen

1. Mehrere zusaetzliche Einstiegspfade umgehen die gefuehrte Journey.
2. Die Content-Landschaft ist zwischen SPA und `public/*.html` aufgespalten.

### Relevante Dateien

1. `src/pages/Index.tsx`
2. `src/components/home/WelcomeSelection.tsx`
3. `src/pages/Neupatient.tsx`
4. `src/components/layout/Header.tsx`

## 3. Workflow B: Registrierung

### Ziel

Ein neuer Nutzer soll ein Konto anlegen, E-Mail-verifizieren und anschliessend in den Onboarding-Bereich kommen.

### Ist-Ablauf

1. Formular in `src/pages/Auth.tsx`
2. Registrierung nur mit bestaetigtem Praxis-Hinweis und Turnstile
3. `request-verification-code(type=registration)` wird aufgerufen
4. Die Edge Function legt per Service Role einen unbestaetigten Auth-User an
5. Ein 6-stelliger Code wird per E-Mail versendet
6. `verify-code(type=registration)` bestaetigt die E-Mail serverseitig
7. Der Client fuehrt danach `signInWithPassword()` aus
8. Optional wird die Praxis via `notify-existing-patient` informiert
9. Redirect nach `/erstanmeldung`

### Steppings

1. Eingaben pruefen
2. Registrierungsfreigabe pruefen
3. User vorbereiten
4. Code senden
5. Code bestaetigen
6. Auto-Login
7. Praxis benachrichtigen
8. Zielseite oeffnen

### Substeppings

1. `patient_login_enabled` wird per `get_public_app_setting` gelesen.
2. `request-verification-code` validiert E-Mail, Passwort und Turnstile.
3. Die Function bereinigt bei Bedarf alte unbestaetigte Benutzerreste.
4. `auth.admin.createUser()` wird verwendet.
5. OTP wird in `verification_codes` geschrieben.
6. SMTP-Mail wird erzeugt und versendet.
7. `verify-code` sucht den Code, markiert ihn als genutzt und setzt `email_confirm: true`.
8. Der Client meldet den Nutzer mit Passwort an.

### Schwachstellen

1. OTP liegt als Klartext in der Datenbank.
2. User-Aufloesung laeuft ueber `profiles.email` statt direkt ueber `auth.users`.
3. Nach erfolgreicher Registrierung wird pauschal `/erstanmeldung` geoeffnet, auch wenn spaetere Inhalte manuelle Freischaltung brauchen.

### Relevante Dateien

1. `src/pages/Auth.tsx:166-280,387-449`
2. `supabase/functions/request-verification-code/index.ts:252-316,329-364`
3. `supabase/functions/verify-code/index.ts:111-173`

## 4. Workflow C: Login mit E-Mail-Code

### Ziel

Ein bestehender Patient soll sich mit Passwort und E-Mail-Code anmelden.

### Ist-Ablauf

1. Nutzer gibt E-Mail und Passwort in `Auth.tsx` ein.
2. Der Client fuehrt sofort `supabase.auth.signInWithPassword()` aus.
3. Admins duerfen ohne zweiten Schritt direkt hinein.
4. Fuer Nicht-Admins wird `patient_login_enabled` geprueft.
5. Der Client fuehrt danach `supabase.auth.signOut()` aus.
6. `request-verification-code(type=login)` wird aufgerufen.
7. Der Nutzer gibt einen 6-stelligen Code ein.
8. `verify-code(type=login)` validiert den Code und erzeugt einen Magic-Link-Hash.
9. Der Client ruft `supabase.auth.verifyOtp({ type: 'magiclink' })` auf.
10. Danach Redirect nach `/dashboard` oder `/erstanmeldung` abhaengig von vorhandenen Submissions.

### Steppings

1. Passwort pruefen
2. Rollenpruefung
3. Globalen Login-Schalter pruefen
4. Code anfordern
5. Code bestaetigen
6. finale Session erzeugen
7. Zielseite bestimmen

### Substeppings

1. `has_role(..., 'admin')` entscheidet den Admin-Bypass.
2. Der erste Passwort-Login stellt bereits eine echte Session her.
3. Diese Session wird nur clientseitig wieder beendet.
4. Die finale Session entsteht spaeter ueber Magic-Link-OTP.

### Schwachstellen

1. Kein serverseitiger Nachweis, dass jede aktive Patientensession 2FA wirklich durchlaufen hat.
2. Redirect-State aus `ProtectedRoute` oder `InfothekGateRoute` wird von `Auth.tsx` nicht ausgewertet.
3. Das beworbene "Passwort + 2FA" ist technisch eher ein clientseitig verketteter Zwei-Schritt-Login als ein hart serverseitig erzwungener zweiter Faktor.

### Relevante Dateien

1. `src/pages/Auth.tsx:67-164,330-385`
2. `src/contexts/AuthContext.tsx:103-124,166-181`
3. `src/components/ProtectedRoute.tsx:12-39`
4. `supabase/functions/request-verification-code/index.ts:244-251`
5. `supabase/functions/verify-code/index.ts:175-240`

## 5. Workflow D: Passwort-Reset

### Ziel

Ein Nutzer soll sein Passwort ueber einen E-Mail-Code zuruecksetzen koennen.

### Ist-Ablauf

1. Nutzer gibt E-Mail ein.
2. `request-verification-code(type=password_reset)` wird oeffentlich aufgerufen.
3. Falls das Profil existiert, wird ein Code versendet.
4. Nutzer gibt Code und neues Passwort ein.
5. `verify-code(type=password_reset)` validiert den Code.
6. Die Function setzt per Admin-API direkt das neue Passwort.

### Schwachstellen

1. Account-Zustaende sind teilweise durch Antwortmuster oder Timing unterscheidbar.
2. OTP- und Reset-Rate-Limits sind nur in-memory.
3. Die User-Aufloesung basiert auch hier auf `profiles.email`.

### Relevante Dateien

1. `src/pages/Auth.tsx:282-328,461-516`
2. `supabase/functions/request-verification-code/index.ts:317-324`
3. `supabase/functions/verify-code/index.ts:242-310`

## 6. Workflow E: Patientenfreischaltung nach Registrierung

### Ziel

Die Praxis soll pro E-Mail festlegen koennen, welche patientenspezifischen Bereiche freigeschaltet sind.

### Ist-Ablauf

1. Registrierte Profile erscheinen ohne Zugriffseintrag als "pending" in der Admin-Ansicht.
2. Admin oeffnet `PatientAccessManager`.
3. Admin setzt Flags wie:
   1. `anamnese_download`
   2. `library_access`
   3. `infothek_all`
   4. `infothek_items`
   5. `note`
4. `usePatientAccess()` liest spaeter ueber `get_my_patient_access` die effektiven Rechte.

### Schwachstellen

1. Interne Notizen werden bis in den Client gereicht.
2. Das Freigabesystem lebt parallel zu `profiles.is_verified_patient`.
3. Neue Registrierung fuehrt unmittelbar nach `/erstanmeldung`, obwohl die eigentliche Freischaltung ein separater manueller Schritt ist.

### Relevante Dateien

1. `src/components/admin/PatientAccessManager.tsx:116-150,213-315,328-360`
2. `src/hooks/usePatientAccess.ts:48-63,74-115`

## 7. Workflow F: Anamnese online

### Ziel

Ein eingeloggter Nutzer soll den Anamnesebogen digital ausfuellen, bestaetigen und an die Praxis uebermitteln.

### Ist-Ablauf

1. Route `/anamnesebogen` ist loginpflichtig.
2. `AnamneseRouteGuard` prueft zusaetzlich `anamnese_online_enabled`.
3. Das Formular speichert Drafts in `localStorage`.
4. Beim ersten Submit wird die Submission als `pending_verification` gespeichert oder aktualisiert.
5. Es wird ein `anamnesis`-Code erzeugt und per E-Mail versendet.
6. Beim Confirm wird der Code geprueft.
7. Der Submission-Status wird auf `verified` gesetzt.
8. PDFs werden erzeugt, E-Mails verschickt und PDFs in Storage abgelegt.
9. Ein Audit-Log wird geschrieben.

### Steppings

1. Auth und Kill-Switch pruefen
2. Formular ausfuellen
3. Draft speichern
4. Submission erzeugen oder fortschreiben
5. Code versenden
6. Code bestaetigen
7. PDFs/ICD-10/E-Mails erzeugen
8. Audit schreiben

### Substeppings

1. Drafts werden browserseitig gespeichert.
2. `submit` erzeugt oder aktualisiert `anamnesis_submissions`.
3. `confirm` sucht den OTP in `verification_codes`.
4. Danach werden mehrere Mails parallel versendet.
5. PDFs werden in `anamnesis-pdfs` gespeichert.

### Schwachstellen

1. `confirm` aktualisiert `submissionId`, ohne die Besitzzuordnung dieser ID zum aktuellen Nutzer zu pruefen.
2. Online-Anamnese ist global per Setting schaltbar, aber nicht zusaetzlich pro Patient gegen `patient_access.anamnese_download` gebunden.
3. Drafts und Teildaten liegen lokal im Browser.

### Relevante Dateien

1. `src/components/AnamneseRouteGuard.tsx:11-16,61-77`
2. `src/pages/Anamnesebogen.tsx`
3. `supabase/functions/submit-anamnesis/index.ts:299-345,350-457,460-753`

## 8. Workflow G: Patienten-Dashboard

### Ziel

Ein eingeloggter Patient soll seine bisherigen Boegen, Downloads und Einstiege an einem Ort sehen.

### Ist-Ablauf

1. `PatientDashboard` redirectet bei fehlendem User nach `/auth`.
2. Es werden `anamnesis_submissions` des angemeldeten Nutzers geladen.
3. Quick-Links fuehren zu Infothek, Anamnese, Datenschutz und Bibliothek.
4. PDFs werden clientseitig erneut generiert.

### Schwachstellen

1. Kein Redirect-Restore des urspruenglich gewuenschten Ziels.
2. Datenzugriff ist simpel, aber von korrekter RLS abhaengig.
3. Das Dashboard selbst prueft keine 2FA-Semantik, sondern nur vorhandene Session.

### Relevante Dateien

1. `src/pages/PatientDashboard.tsx:37-46,49-83,115-372`

## 9. Workflow H: Patientenbibliothek

### Ziel

Freigeschaltete Patienten sollen auf persoenliche Materialien zugreifen koennen.

### Ist-Ablauf

1. Route ist ueber `ProtectedRoute` nur fuer eingeloggte Nutzer offen.
2. `usePatientAccess()` liefert `canUseLibrary`.
3. Die Seite laedt `patient_resources` mit `is_published = true`.
4. Downloads erfolgen ueber `createSignedUrl()` aus `patient-library`.

### Schwachstellen

1. UI-Freigabe basiert auf `patient_access.library_access`, Backend-/Storage-Zugriff aber auf anderem Modell.
2. Damit koennen UI und backendseitige effektive Rechte auseinanderlaufen.

### Relevante Dateien

1. `src/pages/PatientenBibliothek.tsx:37-58,81-90,133-215`
2. `src/hooks/usePatientAccess.ts:94-109`

## 10. Workflow I: Admin-CMS und Zugangssteuerung

### Ziel

Admins sollen oeffentliche Inhalte, Patientenzugaenge und Betriebsdaten zentral verwalten.

### Ist-Ablauf

1. Zugang ueber `/admin`
2. Komponentenpruefung ueber `useAdminCheck()` und `useAuth()`
3. 14 Tabs in `AdminDashboard`
4. Spezialisierte Manager-Komponenten je Fachbereich

### Schwachstellen

1. Der Adminbereich ist funktional reich, aber im Frontend stark konzentriert.
2. Mehrere kritische Operationen werden von grossen Monolith-Komponenten aus angestossen.
3. Ein Dev-Admin-Bypass existiert fuer lokale Entwicklung.

### Relevante Dateien

1. `src/pages/AdminDashboard.tsx:30-72,94-240`
2. `src/hooks/useAdminCheck.ts`
3. `src/lib/devAdminBypass.ts`

## 11. Workflow J: Therapie-/KI-Workspace

### Ziel

Die Praxis soll intern Dokumente analysieren, Pseudonyme fuehren und Therapieempfehlungen generieren koennen.

### Ist-Ablauf

1. Zugang ueber `/wissensdatenbank`
2. Admin-only Komponenten und Functions
3. Dokument-Uploads, Lab-Bild-Analyse, Diagnosevorschlaege, Wiki-Tag-Enrichment, Therapy Sessions

### Schwachstellen

1. Sehr grosse Komponenten
2. Verarbeitung potenziell hochsensibler Daten in AI-gestuetzten Flows
3. lokaler Browser-Storage fuer Zwischenstaende und HTML-Ausgaben

### Relevante Dateien

1. `src/pages/Wissensdatenbank.tsx`
2. `src/components/admin/TherapyRecommendation.tsx`
3. `src/components/admin/therapy/*`
4. `supabase/functions/therapy-recommend/`
5. `supabase/functions/analyze-documents/`
6. `supabase/functions/extract-lab-image/`

## 12. Workflow K: Backup und Restore

### Ziel

Admins sollen den Datenbestand und Code-Artefakte exportieren koennen.

### Ist-Ablauf

1. UI im `BackupCenter`
2. Serverseitige Edge Function `backup-export`
3. Modi fuer Stats, DB, Full und GitHub-Code-ZIP
4. Export von Tabellen, Buckets, Auth-User-Metadaten und Secret-Checklisten

### Schwachstellen

1. Sehr hoher Exfiltrationswert in einer einzelnen Admin-Funktion
2. ZIP-Erzeugung und Dateiverteilung ohne sichtbare Verschluesselungsstrategie
3. keine klar erkennbare eigene Audit-Spur im Exportpfad

### Relevante Dateien

1. `src/components/admin/BackupCenter.tsx`
2. `supabase/functions/backup-export/index.ts:1-255`
3. `src/lib/backupAreas.ts`

## 13. Workflow-Fazit

Die Workflows sind fachlich durchdacht, aber technisch nicht aus einem einzigen konsistenten Sicherheits- und Zustandsmodell gebaut. Die Hauptprobleme liegen nicht in fehlenden Features, sondern in:

1. mehreren nebeneinander laufenden Schutzmodellen
2. widerspruechlichen Freigabepfaden
3. clientseitig ausgelagerten Sicherheitsannahmen
4. nicht sauber dokumentierten Uebergaengen zwischen Registrierung, Freischaltung und Nutzung

Der groesste strukturelle Bedarf ist deshalb nicht "mehr Workflow", sondern Workflow-Haertung und Workflow-Vereinheitlichung.
