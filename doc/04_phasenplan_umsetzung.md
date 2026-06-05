# 04 — Phasenplan zur Umsetzung

## Ziel

Dieser Plan priorisiert Stabilisierung, Datensicherheit, Workflow-Verbesserung und Innovation so, dass zuerst Risiken reduziert und danach Funktionen verbessert werden.

## Verbindliche Zusatzvorgaben ab Phase 0

1. Vor sicherheits- oder patientendatenrelevanten Änderungen wird eine lokale Sicherheitskopie erstellt.
2. Nach jeder finalisierten und getesteten funktionalen Phase wird eine akkurate lokale Kopie unter `/home/klaus999/project-backups/naturheilpraxis-rauch/` erstellt.
3. Jede Phase wird lokal verifiziert, bevor sie committed wird.
4. Phase 1 wird erst als abgeschlossen betrachtet, wenn sie lokal vollständig funktional getestet ist.
5. Nach vollständig getesteter Phase 1 wird zusätzlich zu den normalen ShadowCopies eine komplette Phase-1-Gesamtsicherung in einem gesonderten zusätzlichen Ordner erstellt.
6. GitHub-/Lovable-Push und Merge erfolgen erst nach sauberem lokalem Stand, vollständiger Phase-1-Gesamtsicherung und ausdrücklicher separater persönlicher Freigabe.
7. Features zum automatischen Versand oder zur interaktiven Übertragung von Anamnesedaten bleiben bis zur rechtlichen Klärung vorbereitet, aber deaktiviert.
8. Patientensensible Echtdaten dürfen nicht in Tests, Logs, Commits, Screenshots oder ungesicherten E-Mails landen.

Weitere Details:

- `doc/00_sicherungsstrategie_und_freigabegates.md`
- `doc/05_dsgvo_patientendaten_anamnese.md`

## Phase 0 — Sicherer Ausgangspunkt

### Ziel

Vor Änderungen muss klar sein, welcher Stand analysiert und verändert wird.

### Schritte

1. Aktuellen Branch/Commit notieren.
2. Lokalen Arbeitsbaum prüfen.
3. Backup-/Restore-Punkt erstellen.
4. Backup-Manifest mit Branch, Commit, Git-Status und Teststand erzeugen.
5. Persönliche Eingriffspunkte dokumentieren.
6. Keine Feature-Änderungen vor Stabilisierung.

### Akzeptanzkriterien

- Git-Status ist verstanden.
- Restore-Punkt existiert.
- Zuständigkeit für Production/Staging/Local ist klar.
- Backup-Pfad ist dokumentiert.
- Persönliches Eingreifen ist für Datenschutz-, GitHub-, Secret- und Deployment-Schritte klar markiert.

## Phase 1 — Reproduzierbarkeit reparieren

### Ziel

Jeder Entwickler und jede CI/CD-Umgebung kann das Projekt identisch installieren und bauen.

### Schritte

1. `package.json` und `package-lock.json` synchronisieren.
2. `npm ci` lokal erfolgreich ausführen.
3. Node-/npm-Version dokumentieren.
4. README Setup-Abschnitt projektgenau aktualisieren.

### Substeps

1. `npm install` ausführen.
2. Lockfile-Diff prüfen.
3. `rm -rf node_modules`.
4. `npm ci` ausführen.
5. `npm run build` ausführen.
6. Ergebnis dokumentieren.

### Akzeptanzkriterien

- `npm ci` grün.
- `npm run build` grün.
- Lockfile ist committed.

## Phase 2 — Testsystem reparieren

### Ziel

Automatisierte Tests können wieder laufen.

### Schritte

1. Vitest-Plugin-Problem beheben.
2. Basistest ausführen.
3. Testskript in CI-Gate aufnehmen.
4. Kritische Smoke-Tests ergänzen.

### Substeps

1. Entscheiden: `@vitejs/plugin-react-swc` ergänzen oder Config auf `@vitejs/plugin-react` umstellen.
2. `npm test` ausführen.
3. Test für Startseitenrendering.
4. Test für ProtectedRoute ohne User.
5. Test für AnamneseRouteGuard public/private Zustand.
6. Test für Auth-Step-Wechsel.

### Akzeptanzkriterien

- `npm test` startet.
- Mindestens Kern-Smoke-Tests grün.
- Testfehler blockieren zukünftige Deployments.

## Phase 3 — Secret- und Environment-Hygiene

### Ziel

Keine echten Umgebungsdateien im Git-Repository; klare Trennung Local/Staging/Production.

### Schritte

1. `.env` aus Git entfernen.
2. `.env.example` erstellen.
3. `.gitignore` aktualisieren.
4. Git-Historie auf Secrets prüfen.
5. Supabase-/API-Key-Rotation prüfen.

### Akzeptanzkriterien

- `.env` nicht mehr getrackt.
- `.env.example` vorhanden.
- Keine Service-Role-Secrets im Frontend/Repo.
- Dokumentation erklärt benötigte Variablen.

## Phase 4 — Auth- und Security-Matrix

### Ziel

Für jede Route, Tabelle und Edge Function ist klar, wer zugreifen darf und wie das geprüft wird.

### Schritte

1. Route-Matrix erstellen.
2. Edge-Function-Matrix erstellen.
3. Tabellen-/RLS-Matrix erstellen.
4. Tests gegen Rollen schreiben.
5. `verify_jwt=false` pro Function neu bewerten.

### Substeps Route-Matrix

Für jede Route erfassen:

1. URL.
2. Komponente.
3. Public/Patient/Admin.
4. Guard-Typ.
5. Geladene Supabase-Tabellen.
6. Genutzte Edge Functions.
7. Risiko.

### Substeps Function-Matrix

Für jede Function erfassen:

1. Name.
2. `verify_jwt` Status.
3. Public/Patient/Admin/Internal.
4. Auth-Prüfung im Code.
5. Role-Prüfung im Code.
6. Service-Role-Nutzung.
7. Rate-Limit.
8. PII-Verarbeitung.
9. CORS.
10. Tests.

### Akzeptanzkriterien

- Keine admin-only Function ohne Admin-Test.
- Keine patient-sensitive Function ohne JWT/User-Test.
- Public Functions sind bewusst begründet.
- CORS-/Rate-Limit-Strategie dokumentiert.

## Phase 5 — Kritische Edge Functions härten

### Ziel

Patienten- und Gesundheitsdaten sind serverseitig konsistent geschützt.

### Priorisierte Functions

1. `submit-anamnesis`
2. `get-patients`
3. `therapy-recommend`
4. `get-therapy-sessions`
5. `generate-icd10`
6. `resend-submission`
7. `request-verification-code`
8. `verify-code`

### Schritte je Function

1. Request-Schema prüfen/ergänzen.
2. Auth/Rolle prüfen.
3. Rate-Limit robust machen.
4. Service-Role-Zugriff minimieren.
5. Logs auf PII prüfen.
6. CORS zentralisieren.
7. Tests schreiben.

### Akzeptanzkriterien

- Unauthentifizierte Requests liefern 401/403, wo erforderlich.
- Normale Patienten können keine Admin-Daten lesen.
- Admin kann nur vorgesehene Daten lesen.
- PII wird nicht unnötig geloggt oder an KI gesendet.

## Phase 6 — Workflow-UX vereinheitlichen

### Ziel

Patienten und Admins werden sichtbar, konsistent und verständlich durch Prozesse geführt.

### Datenschutzvorgabe für Anamnese-Workflows

Der aktuelle manuelle Download des Anamnesebogens bleibt aktiv. Automatischer E-Mail-Versand und interaktives Ausfüllen/Übertragen werden nur vorbereitet und standardmäßig deaktiviert, bis die rechtliche Freigabe vorliegt. Die Vorbereitung erfolgt über Feature Flags, Verifikations-Gates, neutrale UI-Zustände, Tests mit Testdaten und serverseitig abgesicherte Schnittstellen ohne Client-Secrets.

### Schritte

1. Einheitliche Stepper-Komponente erstellen.
2. Status-Komponente erstellen: Entwurf / offen / verifiziert / eingereicht / geprüft.
3. Fehler- und Hilfetexte standardisieren.
4. Draft-/Autosave-Anzeige standardisieren.
5. Anamnese-Wizard vereinheitlichen.
6. Auth-/2FA-Flow vereinfachen.
7. Admin-Cockpit einführen.

### Akzeptanzkriterien

- Jeder Hauptworkflow hat sichtbaren Fortschritt.
- Jeder Schritt erklärt Ziel, Datenbedarf und nächste Aktion.
- Fehler enthalten klare Handlungsempfehlung.
- Fortsetzen nach Abbruch ist verständlich.

## Phase 7 — Lint und Typisierung gezielt verbessern

### Ziel

Typ- und Lint-Qualität steigt dort zuerst, wo Datenrisiko hoch ist.

### Reihenfolge

1. Edge Functions.
2. Auth/Login/2FA.
3. Anamnese-Datenmodell.
4. Patienten-/Admin-Komponenten.
5. PDF-/Export-Funktionen.
6. UI-Komponenten.

### Schritte

1. Domain-Typen definieren.
2. `any` in kritischen Pfaden ersetzen.
3. Leere Catch-Blöcke durch Logging/Fehlerbehandlung ersetzen.
4. Hook-Dependencies prüfen.
5. Lint-Regeln nach und nach erzwingen.

### Akzeptanzkriterien

- `npm run lint` grün oder bewusst mit dokumentierten temporären Ausnahmen.
- Keine leeren Catch-Blöcke in Auth/Security/Patientendatenpfaden.
- Kritische medizinische Datenstrukturen sind typisiert.

## Phase 8 — Modularisierung großer Dateien

### Ziel

Komplexität reduzieren und Tests ermöglichen.

### Reihenfolge

1. `TherapyRecommendation.tsx`
2. `therapy-recommend/index.ts`
3. `Anamnesebogen.tsx`
4. `submit-anamnesis/index.ts`
5. `pdfExportEnhanced.ts`
6. `Auth.tsx`

### Vorgehen

1. Keine Logikänderung im ersten Schritt.
2. Reine Extraktion in Module.
3. Tests vor/nach Extraktion.
4. Kleine Commits.
5. Verhalten vergleichen.

### Akzeptanzkriterien

- Datei ist kleiner und fokussierter.
- Tests bleiben grün.
- Keine fachlichen Änderungen ohne eigenen Test.

## Phase 9 — Innovative Produktverbesserungen

### Ziel

Nach Stabilisierung werden UX und Praxisnutzen deutlich verbessert.

### Reihenfolge

1. Admin-Aufgaben-Cockpit.
2. Anamnese-Qualitätsscore.
3. Patient Journey Assistant.
4. Persönliche Patientenbibliothek.
5. Human-in-the-loop KI-Review.
6. Datenschutz-Ampel.
7. Smart Document Pipeline.
8. Wissensdatenbank-Review-Zyklus.

### Akzeptanzkriterien

- Jede Innovation reduziert Aufwand oder Risiko messbar.
- Keine Innovation umgeht Security-/Test-Gates.
- Jede KI-Funktion bleibt fachlich reviewpflichtig.

## Phase 10 — Betriebsreife und Monitoring

### Ziel

Das Projekt kann zuverlässig betrieben, geprüft und weiterentwickelt werden.

### Schritte

1. CI/CD-Gates einrichten.
2. Staging/Production trennen.
3. Supabase-Migrationsprozess dokumentieren.
4. Edge-Function-Monitoring einführen.
5. Audit-/Security-Dashboard aufbauen.
6. Backup-/Restore-Prozess testen.
7. Incident-Runbook schreiben.

### Akzeptanzkriterien

- Deployments sind reproduzierbar.
- Fehler werden früh erkannt.
- Backup/Restore ist getestet.
- Security-relevante Events sind sichtbar.

## Empfohlene Sofortreihenfolge

1. Lockfile reparieren.
2. Tests reparieren.
3. `.env` aus Git entfernen.
4. Auth-/Function-Matrix erstellen.
5. Kritische Edge Functions testen/härten.
6. Dev-Admin-Bypass einschränken.
7. Workflow-Stepper harmonisieren.
8. Admin-Cockpit konzipieren.
9. Lint/Typisierung in kritischen Pfaden verbessern.
10. Große Dateien modularisieren.

## Abschlusskriterium für „stabiler Projektstand“

Ein stabiler Stand ist erreicht, wenn folgende Kommandos grün sind:

```bash
npm ci
npm test
npm run lint
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
```

Zusätzlich müssen dokumentiert und getestet sein:

- Auth-/Route-Matrix,
- Edge-Function-Security-Matrix,
- RLS-Policy-Grundprüfung,
- Secret-/Environment-Konzept,
- Staging/Production-Trennung.
