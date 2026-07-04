# 05 Security DSGVO Gap Analysis

## 1. Kurzfazit

Das Projekt hat bereits mehrere ernsthafte Sicherheitsmassnahmen eingebaut, erreicht aber fuer ein Gesundheitsdatenportal noch keine konsistente Security-by-Design- und Privacy-by-Design-Reife.

Die groessten Luecken liegen nicht in fehlender Technik, sondern in Inkonsistenz zwischen:

1. dokumentiertem Anspruch
2. tatsaechlichem Codeverhalten
3. mehreren parallelen Schutzmodellen
4. operativer Repo-Hygiene

## 2. Bereits vorhandene Schutzmassnahmen

### 2.1 Positive Befunde

1. RLS ist fuer zentrale Tabellen aktiviert.
2. Kritische Admin-Functions haben meist `verify_jwt = true`.
3. Registrierung hat Turnstile-Schutz.
4. Online-Anamnese ist nicht mehr oeffentlich anonym erreichbar.
5. Private Buckets werden fuer Gesundheitsdokumente verwendet.
6. Security-/Policy-Tests existieren im Repo.

Wichtige Referenzen:

1. `supabase/config.toml`
2. `src/test/phase4-security-access-matrix.test.ts`
3. `src/test/supabase-edge-function-jwt-policy.test.ts`

## 3. Kritische Sicherheitsluecken

### 3.1 2FA ist nicht serverseitig erzwungen

Problem:

1. Der Passwort-Login erzeugt bereits eine echte Session.
2. Die 2FA-Anforderung wird danach nur clientseitig weiter orchestriert.
3. RLS, Guards und authenticated Functions differenzieren nicht zwischen Passwort-only und 2FA-erfuellt.

Auswirkung:

1. Das System besitzt keinen harten serverseitigen MFA-Zwang fuer Patienten-Sessions.

Referenzen:

1. `src/pages/Auth.tsx:87-140,343-356`
2. `src/components/ProtectedRoute.tsx:12-39`
3. `src/contexts/AuthContext.tsx:103-124`

### 3.2 Anamnese-Confirm ohne Besitzpruefung der Submission

Problem:

1. Im Confirm-Pfad wird `submissionId` verwendet.
2. Das Update erfolgt per `.eq('id', submissionId)`.
3. Es fehlt eine erzwungene Bindung `submission.user_id === aktueller userId`.

Auswirkung:

1. Integritaetsproblem in einem hochsensiblen Gesundheitsdaten-Workflow.

Referenz:

1. `supabase/functions/submit-anamnesis/index.ts:502-515`

### 3.3 OTP-Speicherung im Klartext

Problem:

1. Verification Codes werden direkt als sechsstellige Codes gespeichert.
2. Keine Hashing- oder tokenisierte Speicherung.

Auswirkung:

1. Erhoehter Schaden bei DB-Einsicht oder Fehlkonfiguration.

Referenzen:

1. `supabase/functions/request-verification-code/index.ts:339-346`
2. `supabase/functions/submit-anamnesis/index.ts:407-414`

### 3.4 In-memory Rate Limits

Problem:

1. `request-verification-code`, `verify-code` und weitere Functions nutzen in-memory Maps.
2. Diese Limits sind instanzlokal und nicht cluster- oder deploymentweit konsistent.

Auswirkung:

1. Schwache Drosselung fuer OTP- und Admin-Angriffsvektoren.

Referenzen:

1. `supabase/functions/request-verification-code/index.ts:58-87`
2. `supabase/functions/verify-code/index.ts:34-63`

### 3.5 Oeffentliche statische Inhalte trotz fachlicher Gating-Idee

Problem:

1. Patientenspezifisch gedachte HTML-Seiten liegen unter `public/`.
2. Das Gating erfolgt nur clientseitig in `public/infothek-gate.js`.

Auswirkung:

1. Inhalte koennen direkt per URL aufgerufen, gecrawlt, geteilt oder archiviert werden.

Referenzen:

1. `public/infothek-gate.js`
2. `src/lib/infothekContent.ts`
3. `src/components/InfothekGateRoute.tsx`

## 4. DSGVO-/Datenschutzluecken gegen den eigenen Text

### 4.1 Session-Aussage ist fachlich zu stark

Die Datenschutzerklaerung behauptet automatische Sitzungsbeendigung und einen sehr strikten Plattformschutz.

Code-Iststand:

1. Session-Persistenz in `localStorage`
2. kein klarer Idle-Timeout oder harter serverseitiger Session-Lifecycle im Clientcode sichtbar

Referenzen:

1. `src/pages/Datenschutz.tsx:61-62`
2. `src/integrations/supabase/client.ts:11-16`

### 4.2 AI-Nichtweitergabe ist im Wortlaut zu absolut

Die Datenschutzerklaerung sagt sinngemaess, dass Gesundheitsdaten nicht an AI-Dienste weitergegeben werden.

Code-Iststand:

1. AI-gestuetzte Diagnose-/Therapie-/Dokumentpfade existieren.
2. Anamnese- und Therapiekontexte werden teils fuer AI-Aufrufe verarbeitet.

Auswirkung:

1. Die Aussage im Datenschutztext ist in dieser Absolutheit riskant.

Referenzen:

1. `src/pages/Datenschutz.tsx:125-126`
2. `supabase/functions/submit-anamnesis/index.ts:555-563`
3. `supabase/functions/therapy-recommend/`
4. `supabase/functions/analyze-documents/`
5. `supabase/functions/extract-lab-image/`

### 4.3 Cookie-Banner ist nicht echte Consent-Steuerung

Problem:

1. Banner schreibt nur `cookie-consent` in `localStorage`.
2. Drittanbieter- und externe Resourcen werden dadurch nicht real gesteuert.
3. Static-Seiten umgehen den React-Banner ganz.

Referenzen:

1. `src/components/CookieBanner.tsx:11-29,56-63`
2. `public/*.html` mit externen CDN-/Script-Einbindungen

## 5. Browser-Speicherung sensibler Daten

### 5.1 Auth-Session

1. Supabase-Session liegt persistent im Browser.
2. Das ist nicht automatisch falsch, muss aber sauber dokumentiert und organisatorisch mitbedacht werden.

### 5.2 Anamnese-Drafts

1. `Anamnesebogen` speichert Formular- und IAA-Daten in `localStorage`.
2. Es existieren auch E-Mail-bezogene Cache-/Restore-Pfade.

### 5.3 Therapie-/Admin-Artefakte

Historische Analyse und Codefunde zeigen browserseitige Speicherung fuer Therapy-Workspaces.

Bewertung:

1. fuer hochsensible Daten nur eingeschraenkt akzeptabel
2. braucht explizite Loeschlogik, Dokumentation und Endgeraete-Annahmen

## 6. Logging und PII

### 6.1 Audit Log

Positiv:

1. Es existiert eine Audit-Struktur.

Negativ:

1. `submit-anamnesis` schreibt direkt in `audit_log`.
2. `details` enthalten u.a. `patient_name`, `submission_id`, weitere Metadaten.

Referenzen:

1. `supabase/functions/submit-anamnesis/index.ts:732-743`
2. `src/components/admin/AuditLogManager.tsx`

### 6.2 Event- und Debug-Logging

Die Codebasis enthaelt bewusst reduzierte Logmuster in mehreren Functions, aber es gibt immer noch sensible Kontextpfade und fruehere Restore-Dokumente mit PII-Naehe.

## 7. Repo- und Dokumentensicherheit

### 7.1 Sensible Altdatei

`docs/database-backup-2026-03-01.md` enthaelt:

1. E-Mail-Adressen
2. User-IDs
3. Rollen
4. Audit-Log-Auszuege
5. Verification-Code-Metadaten

Das ist aus Security- und DSGVO-Sicht ein akuter Red-Flag.

### 7.2 Operative Artefakte im Repo

1. Mail-Relay-Dateien unter `docs/`
2. Restore-Punkte mit hoher operativer Dichte
3. Shadowcopies und Python-Cache-Artefakte

Diese Daten gehoeren organisatorisch nicht in dieselbe logische Schicht wie normale Produktdokumentation.

## 8. Zugriffskonsistenz

### 8.1 `patient_access` vs `profiles.is_verified_patient`

Problem:

1. Die UI steuert Bibliothekszugriff ueber `library_access`.
2. Backend-/Storage-Zugriffe orientieren sich teils an `is_verified_patient`.

Auswirkung:

1. Inkonsistente effektive Rechte.

### 8.2 `new_patient`-Sichtbarkeit

Problem:

1. In einem Teil des Systems bedeutet `new_patient`: jeder eingeloggte Nutzer.
2. In anderem Teil wird zusaetzlich `patient_access` benoetigt.

Auswirkung:

1. Unklare Freigabesemantik.

## 9. Backup- und Export-Risiken

`backup-export` ist funktional stark, aber sicherheitskritisch.

Kann erfassen:

1. Tabellenexporte
2. Storage-Dateien
3. Auth-User-Metadaten
4. Secret-Checklisten
5. GitHub-Code-ZIPs

Risiko:

1. hohe Konzentration von Exfiltrationsmoeglichkeit
2. starke Admin-Pflichtfunktion ohne sichtbare Ende-zu-Ende-Governance im Repo

Referenz:

1. `supabase/functions/backup-export/index.ts`

## 10. DSGVO-Bewertung nach Themenfeld

### 10.1 Rechtmaessigkeit und Transparenz

Teilweise erfuellt, aber riskant wegen Text-vs-Code-Abweichungen.

### 10.2 Datenminimierung

Nur teilweise erfuellt:

1. medizinische Kernlogik braucht viele Daten
2. aber lokale Browser-Drafts, breit angelegte Restore-Dokumente und AI-Pfade sprechen gegen strenge Minimierung

### 10.3 Integritaet und Vertraulichkeit

Teilweise erfuellt:

1. TLS/Supabase/RLS helfen
2. aber OTP-Modell, `public/`-Gates und Browser-Storage schwachstellen das System

### 10.4 Privacy by Default

Nicht ausreichend erreicht, weil:

1. `public/`-Assets mit patientenbezogener Zweckbestimmung ausgeliefert werden
2. Consent-Steuerung nicht echt ist
3. parallele Freigabemodelle leicht driftfaehig sind

### 10.5 Speicherbegrenzung und Loeschung

Formal angesprochen, technisch aber nicht durchgaengig ueber alle Browser- und Repo-Artefakte modelliert.

## 11. Sofortmassnahmen

1. `docs/database-backup-2026-03-01.md` als Sicherheitsvorfall behandeln
2. 2FA-Architektur hart serverseitig neu modellieren
3. `submissionId`-Besitzpruefung im Anamnese-Confirm-Pfad erzwingen
4. `patient_access.note` nicht mehr an Patienten ausgeben
5. Consent-Banner entweder echt machen oder textlich entdramatisieren
6. Patientenspezifische Static-Assets aus `public/` herausloesen

## 12. Zielbild

Ein belastbares Zielbild fuer diese Plattform ist:

1. ein serverseitig erzwungenes Sessionmodell fuer kritische Gesundheitsdatenpfade
2. eine einzige konsistente Access-Matrix fuer Patientenzugriffe
3. keine sensiblen Restore-/Backup-Inhalte im normalen Repo-Dokumentationsraum
4. ehrliche und codekonforme Datenschutzhinweise
5. echte Privacy-by-Default fuer Static-Inhalte, Browser-Speicherung und Consent
