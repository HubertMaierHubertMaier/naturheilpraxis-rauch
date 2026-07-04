# 04 Auth RBAC Multitenancy

## 1. Kurzfazit

Das aktuelle System ist:

1. kein Multitenant-System
2. ein Single-Practice-Portal
3. mit `admin`-/`patient`-RBAC
4. plus zusaetzlichen E-Mail-basierten Freigabeflags
5. plus einem clientseitig orchestrierten E-Mail-Code-Login

Die Hauptschwaeche ist, dass der zweite Faktor aus fachlicher Sicht verpflichtend wirkt, aus technischer Sicht aber nicht als serverseitig erzwungener Session- oder Claims-Zustand modelliert ist.

## 2. Beteiligte Bausteine

### Frontend

1. `src/pages/Auth.tsx`
2. `src/contexts/AuthContext.tsx`
3. `src/components/ProtectedRoute.tsx`
4. `src/components/AnamneseRouteGuard.tsx`
5. `src/components/InfothekGateRoute.tsx`
6. `src/hooks/useAdminCheck.ts`
7. `src/hooks/usePatientAccess.ts`
8. `src/lib/devAdminBypass.ts`

### Backend / DB

1. `supabase/functions/request-verification-code/index.ts`
2. `supabase/functions/verify-code/index.ts`
3. `supabase/functions/notify-existing-patient/index.ts`
4. `supabase/config.toml`
5. `verification_codes`
6. `profiles`
7. `user_roles`
8. `patient_access`
9. RPCs `has_role`, `get_public_app_setting`, `get_my_patient_access`, `insert_audit_log`

## 3. Exaktes Rollen- und Zugriffsmodell

### 3.1 Rollen

Im realen Datenmodell existieren primaer:

1. `admin`
2. `patient`

Nachweis:

- `supabase/migrations/20260119121758_71a8635a-43c3-4c3c-9213-8138c3cbad92.sql`

### 3.2 Nicht-Rollen

Folgende Begriffe sind fachliche Zustandslabels, aber keine echten systemischen Rollen:

1. `new_patient`
2. `existing_patient`
3. `verified patient`
4. `library enabled`
5. `anamnese enabled`

Diese Zustaende entstehen ueber:

1. Query-Parameter im UI
2. `profiles.is_verified_patient`
3. `patient_access.*`-Flags
4. `app_settings`-Feature-Flags

## 4. Session-Modell

### 4.1 Technischer Ist-Zustand

Supabase wird im Frontend so instanziiert:

- `src/integrations/supabase/client.ts:11-16`

Eigenschaften:

1. `storage: localStorage`
2. `persistSession: true`
3. `autoRefreshToken: true`

Folgen:

1. Sessions sind browserseitig persistent.
2. Die Anwendung vertraut auf einen normalen Supabase-Sessionzustand.
3. Es gibt keinen getrennten serverseitigen 2FA-Sessiontyp.

### 4.2 AuthContext-Verhalten

`AuthContext`:

1. liest bei Start `supabase.auth.getSession()`
2. reagiert auf `onAuthStateChange`
3. setzt `user`, `session`, `isAdmin`, `roleChecked`
4. schreibt Login-/Logout-Eintraege ueber `insert_audit_log`

Wichtige Referenzen:

1. `src/contexts/AuthContext.tsx:79-100`
2. `src/contexts/AuthContext.tsx:103-139`
3. `src/contexts/AuthContext.tsx:166-181`

Bewertung:

1. fuer normale Sessionverwaltung brauchbar
2. fuer echten MFA-/Step-up-Status nicht ausreichend

## 5. Registrierung im Detail

### 5.1 Client-Pfad

`Auth.tsx`:

1. validiert E-Mail und Passwort
2. erzwingt `acceptedPracticeNotice`
3. erzwingt Turnstile-Token
4. prueft `patient_login_enabled`
5. ruft `request-verification-code(type=registration)`
6. wartet auf Code
7. ruft `verify-code(type=registration)`
8. fuehrt danach `signInWithPassword()` aus

Referenzen:

1. `src/pages/Auth.tsx:166-280`
2. `src/pages/Auth.tsx:387-449`

### 5.2 Server-Pfad

`request-verification-code`:

1. validiert Payload per Zod
2. prueft Turnstile fuer Registrierung
3. sucht `profiles.email`
4. bereinigt ghost/unconfirmed Users bei Bedarf
5. erstellt User via `auth.admin.createUser()`
6. schreibt OTP nach `verification_codes`
7. versendet Mail

`verify-code`:

1. sucht das Profil erneut ueber `profiles.email`
2. sucht den passenden OTP-Datensatz
3. markiert ihn als `used`
4. setzt `email_confirm: true`

Referenzen:

1. `supabase/functions/request-verification-code/index.ts:187-228`
2. `supabase/functions/request-verification-code/index.ts:252-316`
3. `supabase/functions/request-verification-code/index.ts:329-364`
4. `supabase/functions/verify-code/index.ts:111-173`

### 5.3 Bewertung

Positiv:

1. Registrierung hat Bot-Schutz.
2. Es gibt einen expliziten E-Mail-Verifikationsschritt.

Negativ:

1. User-Aufloesung basiert auf `profiles.email`.
2. OTP wird unverschluesselt gespeichert.
3. Ghost-User-Cleanup ist ein Hinweis auf historisch fragilen Benutzerlebenszyklus.

## 6. Login mit E-Mail-Code im Detail

### 6.1 Implementiertes Verhalten

`src/pages/Auth.tsx:67-164`:

1. Passwort-Login wird zuerst real gegen Supabase ausgefuehrt.
2. Bei Fehler wird hart abgebrochen.
3. Danach `has_role(..., 'admin')`.
4. Wenn Admin: direkte Anmeldung ohne 2FA.
5. Wenn kein Admin: `patient_login_enabled` pruefen.
6. Danach `supabase.auth.signOut()`.
7. Danach `request-verification-code(type=login)`.

`src/pages/Auth.tsx:330-385`:

1. Nutzer gibt OTP ein.
2. `verify-code(type=login)` wird aufgerufen.
3. Response liefert `token_hash` fuer Magic Link.
4. Client ruft `supabase.auth.verifyOtp({ type: 'magiclink' })`.
5. Danach Redirect nach `/dashboard` oder `/erstanmeldung`.

### 6.2 Sicherheitsbewertung

Kritischer Punkt:

1. Der Passwortschritt erzeugt bereits eine gueltige Session.
2. Dass diese direkt wieder abgemeldet wird, ist nur eine Client-Konvention.
3. Weder RLS noch Route Guards noch authenticated Edge Functions pruefen spaeter, ob die Session aus einem 2FA-verifizierten Zustand stammt.

Konsequenz:

1. Das aktuelle System ist nicht gleichbedeutend mit serverseitig verpflichtender MFA.
2. Es ist ein clientseitig choreographierter Mehrschritt-Login.

## 7. Passwort-Reset im Detail

### Ablauf

1. `request-verification-code(type=password_reset)` ist public.
2. Die Function sucht das Profil ueber E-Mail.
3. Falls kein Profil existiert, wird trotzdem erfolgreich-aussehende Rueckmeldung erzeugt.
4. `verify-code(type=password_reset)` validiert den Code.
5. Passwort wird per `auth.admin.updateUserById()` direkt gesetzt.

### Bewertung

Positiv:

1. Kein nativer unkontrollierter Reset-Link-Fluss.

Negativ:

1. Wieder OTP im Klartext.
2. Wieder Profil-Aufloesung ueber E-Mail statt enger auth-user-Zuordnung.
3. In-memory Rate Limit statt robuster verteilbarer Drosselung.

## 8. Guard-System

### 8.1 ProtectedRoute

`src/components/ProtectedRoute.tsx:12-39`

Prueft nur:

1. Dev-Bypass
2. Loading-Zustand
3. `user` vorhanden oder nicht

Nicht geprueft wird:

1. Sessionqualitaet
2. 2FA-Status
3. E-Mail-Verifikation als gesonderter Claim

### 8.2 AnamneseRouteGuard

`src/components/AnamneseRouteGuard.tsx:11-16,61-77`

Prueft:

1. Login
2. globalen Kill-Switch `anamnese_online_enabled`
3. Admin-Bypass

Nicht geprueft wird:

1. patientenspezifische Online-Anamnese-Freischaltung

### 8.3 InfothekGateRoute

`src/components/InfothekGateRoute.tsx:41-79`

Prueft:

1. globale Sichtbarkeitsregel pro Route
2. Login fuer `new_patient`
3. `canSeeInfothekItem()` fuer `patient`

Nicht sauber geloest:

1. Redirect-Restore
2. Konsistenz zur Infothek-Uebersicht

## 9. Zusatzzugriffsmodell `patient_access`

### 9.1 Zweck

`patient_access` erweitert das schmale RBAC-Modell um feingranulare Freigaben pro E-Mail.

Flags:

1. `anamnese_download`
2. `infothek_all`
3. `infothek_items`
4. `library_access`
5. `note`

### 9.2 Konsum im Frontend

`src/hooks/usePatientAccess.ts`

1. ruft `get_my_patient_access`
2. mappt die Rueckgabe in `PatientAccess`
3. stellt `canSeeInfothekItem`, `canDownloadAnamnese`, `canUseLibrary` bereit

### 9.3 Bewertung

Positiv:

1. praktikabel fuer Single-Practice-Freischaltung
2. fachlich schnell verstaendlich

Negativ:

1. kein echtes Rollenmodell
2. an E-Mail statt an streng fachlich versionierten Freigabe-Objekten orientiert
3. interne Notiz wird bis in den Client geliefert

## 10. Admin-Bypass

### Funktion

`src/lib/devAdminBypass.ts`

1. nur fuer lokale Dev-Hosts
2. persistiert in `localStorage` und `sessionStorage`
3. kann URL-Parameter `?dev=true` anhaengen

Bewertung:

1. fuer lokale Entwicklung sinnvoll
2. aber sicherheitskritisch genug, um hart dokumentiert und getestet zu bleiben

## 11. Multitenancy-Bewertung

### 11.1 Ist-Zustand

Im Code und in den Migrationspfaden wurde kein echtes Mandantenmodell gefunden.

Nicht vorhanden sind insbesondere:

1. `tenant_id`
2. `organization_id`
3. `practice_id`
4. tenantgebundene RLS-Policies
5. tenantgebundene Session-Claims
6. tenantgebundene Storage-Namespace-Regeln als fachliches Modell

### 11.2 Was stattdessen existiert

1. Ein einzelnes Praxismodell
2. globale `app_settings`
3. globale Rollen `admin` / `patient`
4. patientenspezifische Freigabe ueber E-Mail

### 11.3 Schlussfolgerung

Das System ist derzeit nicht multitenant und sollte auch nicht so bezeichnet werden.

Wenn spaeter Multi-Practice oder mehrere Behandler-/Standortmandanten geplant sind, braucht es:

1. ein neues Tenant-Datenmodell
2. tenantgebundene Policies
3. tenantgebundene Konfigurationen und Buckets
4. tenantgebundene Admin-Rollen
5. harte Trennung von Content-, Patienten- und Therapie-Daten

## 12. Hauptluecken

1. Kein serverseitig erzwungener 2FA-Sessionstatus
2. Login/Reset/Registration auf fragiler E-Mail-Profil-Aufloesung
3. Zusaetzliche Legacy-Function `send-verification-email` vergroessert die Angriffsoberflaeche
4. Redirect-Restore fehlt
5. `patient_access` und `profiles.is_verified_patient` laufen parallel
6. Kein Mandantenmodell

## 13. Zielbild fuer die Sanierung

### Kurzfristig

1. Login und kritische Routen/Funktionen muessen serverseitig zwischen normaler Session und 2FA-erfuellter Session unterscheiden.
2. `submissionId`-Bindung im Anamnese-Confirm-Pfad muss an `user_id` gebunden werden.
3. `patient_access.note` darf nicht an Patienten ausgegeben werden.

### Mittelfristig

1. Auth-Flows auf ein konsistentes Modell vereinheitlichen
2. E-Mail-basierte Freigaben gegen sauberere fachliche Freigabeobjekte absichern
3. Bibliotheksmodell auf eine einzige verbindliche Freigabelogik reduzieren

### Langfristig

1. Tenant-Readiness nur dann einfuehren, wenn es eine echte Produktanforderung gibt
2. Bis dahin die Architektur bewusst als Single-Practice-System dokumentieren
