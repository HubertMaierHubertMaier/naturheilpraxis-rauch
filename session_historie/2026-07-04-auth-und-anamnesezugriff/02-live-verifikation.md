# 02 Live Verifikation

## Referenzsystem

Alle Live-Prüfungen dieser Phase beziehen sich auf:

1. `https://naturheilpraxis-rauch.lovable.app`

Nicht verwendet als Referenzsystem:

1. `https://rauch-heilpraktiker.de`

## Prüfschritt 1 - Anonyme Zugriffe

### Erwartung

Ohne Session dürfen geschützte Routen nicht zugänglich sein.

### Verifiziert

Anonyme Zugriffe wurden auf `/auth` zurückgeführt für:

1. `/anamnesebogen`
2. `/dashboard`
3. `/patienten-bibliothek`
4. `/erstanmeldung`

## Prüfschritt 2 - Passwort-only reicht nicht

### Erwartung

Ein reiner Passwortschritt ohne abgeschlossene 2FA darf nicht ausreichen.

### Verifiziert

1. Login mit E-Mail + Passwort erreicht den 2FA-Schritt.
2. Ohne gebundene 2FA bleibt `/dashboard` effektiv blockiert.

## Prüfschritt 3 - Backend-Sync des 2FA-Blocks

### Zwischenstatus vor dem Nachzug

Vor dem vollständigen Lovable-/Supabase-Nachzug war live messbar:

1. Frontend neu
2. RPC `is_current_session_two_factor_verified` noch `404`
3. daraus folgende Frontendmeldung `Sitzungsbindung für 2FA fehlt`

### Endstatus nach Backend-Nachzug

Danach live verifiziert:

1. RPC `is_current_session_two_factor_verified` verfügbar
2. Rückgabe im ungebundenen Zustand: `false`
3. `verify-code` liefert:
   1. `success: true`
   2. `token`
   3. `bindingToken`
4. `verifyOtp(...)` erfolgreich
5. `complete_two_factor_binding(...)` erfolgreich
6. `is_current_session_two_factor_verified` danach: `true`

## Prüfschritt 4 - Authentifizierter Zugriff mit gebundener 2FA

### Dashboard

Verifiziert:

1. `/dashboard` ist erreichbar
2. Nutzer wird nicht zu `/auth` zurückgeführt
3. Dashboard lädt den Patientenbereich korrekt

### Patientenbibliothek

Verifiziert:

1. Route ist erreichbar
2. keine Rückleitung auf `/auth`
3. fachlich korrekte Meldung bei fehlender Bibliotheksfreigabe

### Online-Anamnese vor Gating-Fix

Vor dem letzten Freigabe-Fix live noch sichtbar:

1. allgemeine Sperrseite `Online-Anamnese vorübergehend deaktiviert`
2. Dashboard-Kachel und eigener PDF-Export noch sichtbar

Das war der Grund für den letzten Zusatzblock.

## Prüfschritt 5 - Strikte Anamnesebogen-Freigabe

### Erwartung

Ohne `anamnese_download` dürfen bei bestehender verifizierter Session nicht mehr sichtbar sein:

1. Dashboard-Kachel `Anamnesebogen ergänzen`
2. Dashboard-PDF-Button für vorhandene Anamnesen
3. individueller Zugriff auf `/anamnesebogen`

### Lokal verifiziert

1. `src/test/patient-dashboard-anamnese-access.test.tsx` grün
2. `src/test/anamnese-route-guard-smoke.test.tsx` mit neuem Access-Lock grün
3. Voller `npm test`-Lauf grün

### Live verifiziert

Endgültiger Live-Befund nach Frontend-Update:

1. Dashboard zeigt **keine** Kachel `Anamnesebogen ergänzen`
2. Dashboard zeigt **keinen** Button `PDF herunterladen` für die vorhandene Anamnese
3. `/anamnesebogen` zeigt die individuelle Sperrseite:
   `Anamnesebogen noch nicht freigeschaltet`

Damit ist der gemeldete Freigabefehler für die Lovable-App live behoben.

## Qualitätsgates dieser Phase

Zum Abschluss dieser Sessionphase verifiziert:

1. `npm ci` grün
2. `npm test` grün
3. `npx tsc -p tsconfig.app.json --noEmit` grün
4. `npx tsc -p tsconfig.node.json --noEmit` grün
5. `npm run build` grün
