# 01 — Problemfelder, Lücken und Risiken

## Phase 1 — Fundament: Reproduzierbarkeit und Build-Kette

### Problem 1.1 — `npm ci` ist nicht lauffähig

**Beobachtung:**  
`npm ci` bricht ab, weil `package.json` und `package-lock.json` nicht synchron sind.

**Konkrete Symptome:**

- fehlende Lockfile-Einträge für u.a. `docx`, `file-saver`, `react-markdown`, `@types/file-saver`, `@types/node` und zahlreiche transitive Dependencies.
- CI/CD oder frische Entwicklerumgebungen würden mit hoher Wahrscheinlichkeit scheitern.

**Risiko:**

- keine reproduzierbaren Builds,
- unterschiedliche lokale Dependency-Stände,
- schwer nachvollziehbare Fehler,
- Deployment-Risiko.

**Empfohlene Behebung:**

1. Lokal kontrolliert `npm install` ausführen.
2. Geändertes `package-lock.json` prüfen.
3. Danach `npm ci` erneut ausführen.
4. `npm ci` als verpflichtendes CI-Gate etablieren.

### Problem 1.2 — Testsystem startet nicht

**Beobachtung:**  
`npm test` scheitert beim Laden von `vitest.config.ts`.

**Ursache:**  
`vitest.config.ts` importiert `@vitejs/plugin-react-swc`, diese Dependency ist aber nicht in `package.json` vorhanden.

**Risiko:**

- keine automatisierte Regressionserkennung,
- besonders kritisch bei Auth, Anamnese, Edge Functions und Patientendaten,
- Änderungen können unbemerkt Login-, PDF-, Supabase- oder KI-Flows beschädigen.

**Empfohlene Behebung:**

Option A:

1. `@vitejs/plugin-react-swc` als Dev-Dependency ergänzen.
2. Lockfile aktualisieren.
3. `npm test` ausführen.

Option B:

1. `vitest.config.ts` auf vorhandenes `@vitejs/plugin-react` umstellen.
2. `npm test` ausführen.

Für Stabilität ist Option B einfacher, wenn kein expliziter SWC-Grund besteht.

### Problem 1.3 — Lint ist stark rot

**Beobachtung:**  
`npm run lint` meldet 332 Probleme: 300 Errors, 32 Warnings.

**Häufige Fehlerklassen:**

- `@typescript-eslint/no-explicit-any`
- `no-empty`
- `react-hooks/exhaustive-deps`
- `no-useless-escape`
- `@typescript-eslint/no-empty-object-type`
- `@typescript-eslint/no-require-imports`
- Fast-Refresh-Warnungen

**Besonders betroffene Bereiche:**

- `src/components/admin/TherapyRecommendation.tsx`
- `src/components/admin/MannayanPriceManager.tsx`
- `src/components/anamnese/*Section.tsx`
- `src/pages/Anamnesebogen.tsx`
- `src/pages/Auth.tsx`
- `supabase/functions/*/index.ts`
- `src/lib/pdfExportEnhanced.ts`

**Risiko:**

- fehlende Typsicherheit in medizinischen Datenstrukturen,
- still geschluckte Fehler durch leere Catch-/Block-Strukturen,
- potentielle React-State-/Effect-Inkonsistenzen,
- sinkende Wartbarkeit.

**Empfohlene Behebung:**

1. Lint-Fehler in sicherheitskritische und technische-Schuld-Kategorien trennen.
2. `no-empty`, Hook-Dependencies und Edge-Function-Fehler zuerst beheben.
3. `any` nicht blind ersetzen, sondern zentrale Domain-Typen einführen.
4. Erst dann Lint als verpflichtendes Gate aktivieren.

## Phase 2 — Architektur und Wartbarkeit

### Problem 2.1 — Zu große Dateien und Komponenten

**Beobachtung:**  
Mehrere Dateien sind sehr groß und vereinen UI, State, Datenmodell, API-Aufrufe, Parsing, Business-Logik und Fehlerbehandlung.

**Beispiele:**

- `src/components/admin/TherapyRecommendation.tsx` — ca. 2.406 Zeilen / 114 KB
- `supabase/functions/therapy-recommend/index.ts` — ca. 1.293 Zeilen / 86 KB
- `src/lib/pdfExportEnhanced.ts` — ca. 74 KB
- `src/pages/Anamnesebogen.tsx` — ca. 1.187 Zeilen / 50 KB
- `supabase/functions/submit-anamnesis/index.ts` — ca. 701 Zeilen / 32 KB

**Risiko:**

- schwer testbar,
- schwer reviewbar,
- hohe Fehlerwahrscheinlichkeit bei Änderungen,
- Security-Audits werden unpräzise,
- neue Entwickler brauchen lange Einarbeitung.

**Empfohlene Zielstruktur:**

Für große Frontend-Komponenten:

1. `types.ts` — Domain-Typen.
2. `schema.ts` — Zod/Validierung.
3. `api.ts` — Supabase-/Function-Aufrufe.
4. `state.ts` oder Hook — State-/Draft-Logik.
5. `components/` — reine UI-Komponenten.
6. `utils/` — reine Transformationsfunktionen.
7. `__tests__/` — Unit-/Integrationstests.

Für Edge Functions:

1. `auth.ts` — JWT/User/Admin-Prüfung.
2. `validation.ts` — Request-Schema.
3. `rate-limit.ts` — robustes Rate-Limiting.
4. `service.ts` — Business-Logik.
5. `ai.ts` — externe KI-Aufrufe.
6. `response.ts` — einheitliche Fehler-/CORS-Antworten.

### Problem 2.2 — Uneinheitliche Zugriffskontrolle

**Beobachtung:**  
Der Zugriffsschutz ist auf mehreren Ebenen verteilt:

- Router-Level `ProtectedRoute`,
- Page-Level Guards (`AdminDashboard`, `PatientenManagerPage`),
- `AnamneseRouteGuard`, der abhängig von Admin-Setting öffentlich werden kann,
- Supabase RLS,
- Edge-Function-interne JWT/Admin-Prüfung,
- Dev-Admin-Bypass.

**Risiko:**

- schwer verständliche Security-Gesamtlage,
- Route kann UI-seitig geschützt wirken, während Function/RLS anders reagiert,
- neue Routen können versehentlich ohne Guard entstehen,
- Security-Reviews müssen Codepfade einzeln rekonstruieren.

**Empfohlene Behebung:**

1. Auth-Matrix erstellen: Route → Zugriff → Daten → Supabase Tables → Edge Functions → Schutzmechanismus.
2. Alle geschützten Seiten routerseitig einheitlich markieren.
3. Admin-Routen in `AdminRoute` bündeln.
4. Patient-Routen in `PatientRoute` bündeln.
5. Public-by-design-Routen explizit dokumentieren.
6. Edge Functions nach denselben Rollen klassifizieren.

## Phase 3 — Datensicherheit und Datenschutz

### Problem 3.1 — `.env` ist versioniert

**Beobachtung:**  
`git ls-files .env` zeigt, dass `.env` im Repository getrackt ist.

**Gefundene Key-Namen:**

- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

**Bewertung:**  
Das sind keine Service-Role-Secrets, aber `.env` sollte nicht versioniert sein. Publishable Keys dürfen im Frontend auftauchen, gehören aber sauber in Deployment-Konfiguration und `.env.example`, nicht in echte `.env` im Repo.

**Risiko:**

- schlechte Secret-Hygiene,
- Risiko später versehentlich echter Secrets,
- unklare Trennung zwischen Local/Staging/Production.

**Empfohlene Behebung:**

1. `.env` aus Git entfernen: `git rm --cached .env`.
2. `.gitignore` ergänzen: `.env`, `.env.*`, aber `!.env.example`.
3. `.env.example` mit leeren Platzhaltern erstellen.
4. Git-Historie auf echte Secrets prüfen.
5. Supabase Service Role und externe API Keys niemals clientseitig ablegen.

### Problem 3.2 — Viele Edge Functions mit `verify_jwt = false`

**Beobachtung:**  
In `supabase/config.toml` sind mehrere Functions mit `verify_jwt = false` konfiguriert:

- `request-verification-code`
- `verify-code`
- `submit-anamnesis`
- `send-verification-email`
- `generate-icd10`
- `send-icd10-report`
- `resend-submission`
- `get-patients`
- `therapy-recommend`
- `get-therapy-sessions`

**Bewertung:**  
Das kann fachlich sinnvoll sein, wenn Functions selbst Auth prüfen oder öffentlich sein müssen. Es ist aber hochsensibel, weil Supabase JWT nicht automatisch vor Ausführung erzwingt.

**Risiko:**

- jede vergessene interne Auth-Prüfung wird kritisch,
- Service-Role-Nutzung verstärkt Impact,
- öffentliche Endpunkte können missbraucht werden,
- Rate-Limits sind teilweise nur in-memory und dadurch in Edge/serverless unzuverlässig.

**Empfohlene Behebung:**

1. Jede Function kategorisieren:
   - public-by-design,
   - authenticated patient,
   - admin-only,
   - internal/service-only.
2. Für jede Function Tests gegen vier Identitäten:
   - ohne Auth,
   - anon key,
   - normaler Patient,
   - Admin.
3. `verify_jwt=true` überall dort aktivieren, wo kein öffentlicher Zugriff nötig ist.
4. Service-Role-Zugriffe nur nach bestandener Auth-/Role-Prüfung.
5. Security-Logging ohne sensible Payloads.

### Problem 3.3 — CORS `*` bei sensiblen Functions

**Beobachtung:**  
Viele Functions setzen `Access-Control-Allow-Origin: *`.

**Risiko:**

- fremde Websites können Browser-Requests an Functions auslösen,
- Auth bleibt zwar entscheidend, aber Angriffsfläche steigt,
- bei öffentlichen Verification-/Submission-Flows erhöht es Abuse-Potential.

**Empfohlene Behebung:**

1. Produktionsdomains allowlisten.
2. Staging-/Preview-Domains getrennt konfigurieren.
3. CORS zentral in `_shared/cors.ts` kapseln.
4. OPTIONS-Handling standardisieren.

### Problem 3.4 — Dev-Admin-Bypass auf Preview-/Lovable-Hosts

**Beobachtung:**  
`devAdminBypass.ts` erlaubt Bypass auf `preview`, `lovableproject.com`, `localhost` oder `import.meta.env.DEV`, solange es nicht eine bekannte Produktionsdomain ist.

**Risiko:**

- Preview kann gegen echte Supabase-Daten laufen,
- Admin-UI kann ohne echte Rolle sichtbar werden,
- wenn eine Function/RLS-Lücke existiert, wird sie leichter ausnutzbar.

**Empfohlene Behebung:**

1. Dev-Bypass nur bei `import.meta.env.DEV === true`.
2. Zusätzlich `VITE_ENABLE_DEV_ADMIN_BYPASS=true` nur lokal erlauben.
3. Preview/Staging immer mit getrenntem Supabase-Projekt.
4. UI sichtbar kennzeichnen: `LOCAL DEV BYPASS ACTIVE`.

## Phase 4 — Workflow-/UX-Lücken

### Problem 4.1 — Zu viele fachliche Flows sind nicht als klare, wiedererkennbare Stepper harmonisiert

**Beobachtung:**  
Es gibt bereits Step-Ansätze:

- `Neupatient.tsx`: 3-Schritte-Fahrplan.
- `Erstanmeldung.tsx`: `steps` + `currentStep` + Fortschritt.
- `Anamnesebogen.tsx`: Wizard-Logik mit `wizardStep`.
- `Auth.tsx`: `credentials`, `verification`, `reset_password`.
- `TherapyRecommendation.tsx`: Draft-/Input-/KI-/Session-Logik, aber sehr komplex.

**Lücke:**  
Diese Stepper sind nicht als einheitliches UX-System gestaltet. Jeder Flow hat eigene Begriffe, Zustände, Fehlerführung und Speicherlogik.

**Risiko:**

- Patienten verlieren Orientierung,
- Admins müssen sich komplexe Abläufe merken,
- Support-Aufwand steigt,
- medizinische Daten können unvollständig oder inkonsistent eingegeben werden.

**Empfohlene Behebung:**

1. Einheitliches Stepper-Komponenten-System.
2. Jede Phase mit:
   - Ziel,
   - benötigten Daten,
   - Dauer,
   - Pflicht-/Optional-Feldern,
   - Datenschutz-Hinweis,
   - Speicherstatus,
   - nächstem Schritt.
3. Einheitlicher Fortschrittsindikator über alle Patient Journey Flows.
4. Abbruch-/Fortsetzen-/Entwurf-Logik klar sichtbar.

### Problem 4.2 — Admin-Workflows sind funktional, aber nicht ausreichend prozessgeführt

**Beobachtung:**  
Adminbereich enthält viele Tabs: Patienten, FAQ, Praxis, Preise, Mannayan, Bibliothek, ICD-10, KI-Modell, Audit.

**Lücke:**  
Es fehlt ein rollen-/aufgabenorientiertes Dashboard: „Was muss ich heute tun?“ statt nur „Welche Module gibt es?“.

**Empfohlene Behebung:**

Admin-Startseite als Aufgaben-Cockpit:

1. Neue Anamnesen prüfen.
2. Offene Verifikationen.
3. Patienten ohne vollständige Dokumente.
4. Therapieempfehlungen im Entwurf.
5. KI-Auswertungen mit Review-Bedarf.
6. Audit-/Security-Hinweise.
7. Inhalte mit veraltetem Prüfdatum.

## Phase 5 — Medizinische Qualität und KI-Governance

### Problem 5.1 — KI-Funktionen brauchen klare Human-in-the-loop-Leitplanken

**Beobachtung:**  
Das Projekt nutzt KI für ICD-10, Therapieempfehlungen, Laborbild-Extraktion und Wissensdatenbank-/Tag-Anreicherung.

**Risiko:**

- Halluzinationen,
- falsche medizinische Einordnung,
- Datenschutzrisiken bei Freitexten,
- unklare Verantwortlichkeit.

**Empfohlene Behebung:**

1. Jede KI-Ausgabe als Entwurf markieren.
2. Admin/Fachperson muss final bestätigen.
3. Quellen-/Begründungsfelder erzwingen.
4. PII-Redaction vor KI-Aufruf testen.
5. Prompt-/Modell-/Zeitpunkt-/Input-Hash auditieren, ohne sensible Volltexte unnötig zu speichern.
6. Export nur nach Review-Freigabe.

## Gesamtbewertung

Das Projekt ist nicht „kaputt“; es ist fachlich breit und bereits baubar. Die zentralen Lücken liegen in Reproduzierbarkeit, Testbarkeit, Sicherheitsnachweis, Workflow-Konsistenz und Wartbarkeit. Genau diese Punkte sollten vor weiterem Feature-Ausbau priorisiert werden.
