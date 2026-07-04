# 01 Phase Fixes

## Zusammenfassung

In dieser Phase wurden drei zusammenhängende Teilblöcke umgesetzt und verifiziert:

1. Reproduzierbarkeit des lokalen Projektstands
2. serverseitige 2FA-Sitzungsbindung
3. strikte Anamnesebogen-Freigabelogik

## Block A - Reproduzierbarkeit

### Ziel

Den aktuellen Lovable-Stand in einen lokal belastbar prüfbaren Zustand bringen.

### Umgesetzt

1. `package-lock.json` an `package.json` angepasst
2. `npm ci` wieder funktionsfähig gemacht
3. lokale Toolkette erneut geprüft

### Verifiziert

1. `npm ci` grün
2. `npm run build` grün
3. `npx tsc -p tsconfig.app.json --noEmit` grün
4. `npx tsc -p tsconfig.node.json --noEmit` grün
5. `npm test` grün nach den Folgeanpassungen in Block B/C

## Block B - 2FA-Sitzungsbindung

### Ursprungsproblem

Vor der Härtung reichte eine normale Supabase-Session technisch aus, obwohl der Produktfluss fachlich `Passwort + E-Mail-Code` verlangte.

### Umgesetzt

Neue Migration:

1. `supabase/migrations/20260704163000_2fa_session_binding_hardening.sql`

Neue Backend-Elemente:

1. `two_factor_pending_bindings`
2. `two_factor_verified_sessions`
3. `is_current_session_two_factor_verified(interval)`
4. `complete_two_factor_binding(text)`
5. `clear_current_two_factor_session()`

Geänderte Frontend-/Runtime-Dateien:

1. `src/contexts/AuthContext.tsx`
2. `src/components/ProtectedRoute.tsx`
3. `src/components/AnamneseRouteGuard.tsx`
4. `src/App.tsx`
5. `src/pages/Auth.tsx`
6. `src/pages/PatientDashboard.tsx`

Geänderte Backend-Dateien:

1. `supabase/functions/verify-code/index.ts`
2. `supabase/functions/submit-anamnesis/index.ts`
3. `supabase/functions/download-anamnesis-pdf/index.ts`

### Sicherheitswirkung

1. Login mit Passwort allein ist nicht mehr ausreichend für patientensensitive Pfade.
2. Die verifizierte 2FA wird an die konkrete Supabase-Session gebunden.
3. Die Session muss serverseitig als 2FA-verifiziert vorliegen, damit sensible Datenpfade funktionieren.

## Block C - Strikte Anamnesebogen-Freigabe

### Ursprungsproblem

Die Admin-Freigabe `Anamnesebogen` wurde semantisch uneinheitlich verwendet:

1. Blanko-/Erstanmeldungs-PDF war korrekt geschützt.
2. Dashboard-Kachel `Anamnesebogen ergänzen` blieb trotzdem sichtbar.
3. Bereits vorhandene eigene Anamnese konnte im Dashboard weiter als PDF exportiert werden.
4. `/anamnesebogen` war individuell nicht an dieselbe Freigabe gebunden.

### Umgesetzt

Geänderte Dateien:

1. `src/pages/PatientDashboard.tsx`
2. `src/components/AnamneseRouteGuard.tsx`
3. `src/test/anamnese-route-guard-smoke.test.tsx`
4. `src/test/patient-dashboard-anamnese-access.test.tsx`
5. `.lovable/memory/preferences/separate-project-boundary-lovable-vs-rauch-heilpraktiker.md`

### Strikte Logik jetzt

Wenn `anamnese_download` für den Nutzer **nicht** gesetzt ist:

1. keine Dashboard-Kachel `Anamnesebogen ergänzen`
2. kein Dashboard-Button `PDF herunterladen` für vorhandene Anamnesen
3. kein individueller Zugriff auf `/anamnesebogen`
4. stattdessen klare Hinweisseite `Anamnesebogen noch nicht freigeschaltet`

### Was absichtlich unverändert bleibt

1. Der allgemeine Datenschutz-Kill-Switch für Online-Anamnese bleibt bestehen.
2. Die Patientenbibliothek bleibt getrennt über `library_access` modelliert.
3. Der Blanko-/Erstanmeldungs-PDF-Download bleibt serverseitig an `anamnese_download` gebunden.

## Test- und Policy-Synchronisierung

In derselben Phase wurden die lokalen Qualitätsgates an den aktuellen Lovable-Stand angepasst.

Geänderte/ergänzte Tests und Testinfrastruktur:

1. `src/test/setup.ts`
2. `src/test/anamnese-public-toggle-copy.test.tsx`
3. `src/test/header-anamnese-navigation-smoke.test.tsx`
4. `src/test/public-anamnese-link-surfaces-characterization.test.tsx`
5. `src/test/app-public-routes-smoke.test.tsx`
6. `src/test/anamnesebogen-public-route-characterization.test.tsx`
7. `src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`
8. `src/test/sensitive-route-guard-smoke.test.tsx`
9. `src/test/phase4-security-access-matrix.test.ts`
10. `src/lib/securityAccessMatrix.ts`

## GitHub- und Lovable-Sync-Relevanz

Push-Sequenz dieser Phase:

1. `aac0d14` Backend-/2FA-Block
2. `950f420` Live-Backend-Rollout bestätigt
3. `e8c9982` strikte Anamnesebogen-Freigabe

Wichtig:

1. Der reine GitHub-Push war für den Frontend-Sync ausreichend.
2. Für den vollständigen 2FA-Block musste die Lovable-/Supabase-Seite zusätzlich nachziehen.
