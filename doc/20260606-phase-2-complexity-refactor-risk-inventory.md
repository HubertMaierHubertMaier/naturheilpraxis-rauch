# Phase 2 — Komplexitäts- und Refactor-Risikoinventar

## Zeitpunkt

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `aa4c665`

## Ziel

Dieser Schritt dokumentiert die Phase-2-Themen „zu große Dateien“ und „Refactor-Risiko“, bevor produktiver Code weiter umgebaut wird.

Ziel ist bewusst noch kein Refactor, sondern eine belastbare Priorisierung:

1. Welche Dateien sind objektiv groß?
2. Welche Dateien berühren Patientendaten, Anamnese, Therapie, Auth oder Zugriffskontrollen?
3. Wo ist Refactoring besonders riskant?
4. Welcher nächste kleine Schritt ist sicher und sinnvoll?

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnese-Testdaten erstellt.
- Keine Screenshots, Logs oder Fixtures mit sensiblen Daten.
- Keine Änderung an Supabase, Datenbank, Edge-Function-Konfiguration oder `.env`.
- Kein Push, kein PR, kein Merge.

## Portprüfung

Vor Arbeitsbeginn wurde die Portlage geprüft, weil parallel ein weiteres Projekt läuft.

Belegte relevante Ports u. a.:

```text
80, 443, 3001, 4321, 8000, 8080, 8443, 9090
```

Freie Kandidaten für spätere lokale Vite-/Preview-Tests:

```text
4173, 4174, 5173, 5174, 5180, 5181, 3000
```

Für diesen Dokumentationsschritt wurde kein Dev-/Preview-Server gestartet und kein Port belegt.

## Pre-Step-ShadowCopy

Vor der Dokumentationsänderung wurde eine lokale ShadowCopy erstellt:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-091015_pre-phase-2-complexity-refactor-risk-inventory
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-091015_pre-phase-2-complexity-refactor-risk-inventory/SHADOWCOPY_MANIFEST.md
```

## Verifizierter Ausgangsstand

Git:

```text
branch=stabilization/phase-2-testid-and-security-baseline
head=aa4c665
status=clean
```

Aktuelle Test-Baseline vor dem Inventar:

```text
npm test
Test Files  5 passed (5)
Tests       9 passed (9)
```

## Messmethodik

Verwendet wurden zwei Datenquellen:

1. `pygount` für Sprach-/Codeumfang.
2. Ein lokaler Python-Scanner für Dateigrößen, Zeilenzahlen und einfache Risikoheuristiken.

Untersuchte Bereiche:

```text
src/
supabase/functions/
```

Ausgeschlossen bleiben weiterhin Dependency-/Build-Artefakte wie:

```text
.git, node_modules, dist, build, .cache, coverage
```

Die Risikoheuristiken sind keine endgültigen Security-Aussagen. Sie markieren Kandidaten für vorsichtige manuelle Prüfung.

## Umfang nach pygount

```text
Language      Files   Code   Comment
TSX             174  28132       772
TypeScript       42   6835       440
CSS+Lasso         2    229        17
__generated__     1      0         0
__binary__       10      0         0
Sum             229  35196      1229
```

Zusätzliche Scanner-Zusammenfassung für `.ts/.tsx/.js/.jsx` in `src/` und `supabase/functions/`:

```text
files=217
total_lines=46595
total_loc_nonblank=43059
files_over_300_lines=52
files_over_500_lines=17
files_over_800_lines=6
files_over_1000_lines=4
```

## Größte Dateien nach Zeilen

```text
2405  src/components/admin/TherapyRecommendation.tsx
1417  src/lib/pdfExportEnhanced.ts
1292  supabase/functions/therapy-recommend/index.ts
1186  src/pages/Anamnesebogen.tsx
 989  src/pages/Auth.tsx
 812  src/components/anamnese/MedicalHistorySection.tsx
 799  src/components/anamnese/PatientDataSection.tsx
 775  src/components/admin/MannayanPriceManager.tsx
 742  src/components/admin/KnowledgeBaseManager.tsx
 700  supabase/functions/submit-anamnesis/index.ts
 694  src/integrations/supabase/types.ts
 637  src/components/ui/sidebar.tsx
 619  src/lib/anamneseFormData.ts
 604  src/pages/AnamneseDemo.tsx
 599  src/pages/MilchUnvertraeglichkeit.tsx
 569  src/pages/Erstanmeldung.tsx
 553  src/components/anamnese/SurgeriesSection.tsx
 499  src/components/layout/Header.tsx
 481  src/components/anamnese/LifestyleSection.tsx
 477  src/components/anamnese/WomenHealthSection.tsx
```

## Risiko-Priorisierung

Bewertet wurden Größe plus Nähe zu diesen Themen:

- Auth / User / Session / Admin / Rollen,
- Patient / Patienten / Anamnese / Submission,
- Therapie / Diagnose / medizinische Verarbeitung,
- Edge Functions / serverseitige Verarbeitung.

### P0 — Nicht sofort refactoren ohne weiteres Sicherheitsnetz

Diese Dateien sind groß und fachlich sensibel. Sie sollten zuerst charakterisiert und mit Tests/Checks abgesichert werden.

#### `src/components/admin/TherapyRecommendation.tsx`

```text
lines=2405
auth_hits=99
patient_hits=174
```

Risiko:

- sehr groß,
- admin-/therapie-/patientennah,
- viele Hooks und UI-Zustände,
- hohe Chance für unbeabsichtigte Regressions bei direkter Extraktion.

Empfehlung:

- nicht als erster Refactor-Kandidat,
- zunächst nur Characterization/Smoke-Test oder reine Dokumentation der Subbereiche,
- später in sehr kleine extrahierbare reine Hilfsfunktionen oder UI-Subkomponenten zerlegen.

#### `src/pages/Anamnesebogen.tsx`

```text
lines=1186
auth_hits=42
patient_hits=120
```

Risiko:

- direkt an sensiblen Anamnese-Flows,
- umfangreiche Formularzustände,
- mögliche DSGVO-/Patientendaten-Auswirkungen,
- bereits durch Phase 2 Route-Guard-Tests besser, aber noch nicht ausreichend abgesichert.

Empfehlung:

- erst nach weiteren formularnahen Smoke-/Characterization-Tests refactoren,
- keine echten Patientendaten in Tests,
- kleine Extraktionen nur, wenn Verhalten vorher testseitig beschrieben ist.

#### `supabase/functions/submit-anamnesis/index.ts`

```text
lines=700
auth_hits=45
patient_hits=80
```

Risiko:

- serverseitige Annahme/Verarbeitung von Anamnese-Daten,
- besonders DSGVO-sensibel,
- Refactor kann reale Datenflüsse oder Versand-/Persistenzlogik betreffen.

Empfehlung:

- vor Änderungen separaten Edge-Function-Audit und Teststrategie festlegen,
- keine produktiven Daten oder echte Patientendaten verwenden,
- aktuell nicht als erster Refactor-Schritt.

#### `supabase/functions/therapy-recommend/index.ts`

```text
lines=1292
auth_hits=55
patient_hits=97
```

Risiko:

- serverseitige Therapie-/Empfehlungslogik,
- medizinisch/fachlich sensibel,
- groß und vermutlich komplexe Prompt-/Algorithmus-/API-Verarbeitung.

Empfehlung:

- erst später, nach serverseitiger Test-/Mockstrategie.

### P1 — Hohe Priorität, aber erst mit begrenztem Ziel

#### `src/pages/Auth.tsx`

```text
lines=989
auth_hits=58
patient_hits=46
```

Risiko:

- auth-zentral,
- groß,
- mögliche Login-/Registrierungs-/Redirect-Regressions.

Empfehlung:

- als nächster Zugriffskontroll-Kandidat sinnvoll,
- aber zuerst nur zusätzliche Characterization-Tests für Redirect-/Auth-Zustände,
- noch kein großer Refactor.

#### `src/components/layout/Header.tsx`

```text
lines=499
auth_hits=56
patient_hits=33
```

Risiko:

- zeigt Anamnese-Navigation abhängig von Login/Admin/public Setting,
- direkt relevant für „uneinheitliche Zugriffskontrollen“,
- mittelgroß und vermutlich einfacher testbar als `Anamnesebogen.tsx` oder Edge Functions.

Empfehlung:

- sehr guter nächster Characterization-Test-Kandidat,
- besonders prüfen: Anamnesebogen-Link vs PDF-Download abhängig von Auth/public/admin.

#### `src/lib/pdfExportEnhanced.ts`

```text
lines=1417
auth_hits=0
patient_hits=130
```

Risiko:

- groß und patientendatennah,
- PDF-Ausgabe kann sensible Daten enthalten,
- vermutlich viele Formatierungs-/Layoutdetails.

Empfehlung:

- später mit Snapshot-/Unit-Tests für reine Formatierungsfunktionen,
- nicht ohne vorherige Teststrategie refactoren.

### P2 — Gute spätere Refactor-Kandidaten

Diese Dateien sind groß, aber wahrscheinlich leichter in kleine Komponenten/Helper aufzuteilen, wenn Form-/Render-Verhalten vorher charakterisiert ist:

```text
src/components/anamnese/MedicalHistorySection.tsx
src/components/anamnese/PatientDataSection.tsx
src/components/anamnese/SurgeriesSection.tsx
src/components/anamnese/LifestyleSection.tsx
src/components/anamnese/WomenHealthSection.tsx
src/lib/anamneseFormData.ts
```

Empfehlung:

- zuerst Typ-/FormData-Kontrakte prüfen,
- dann wiederkehrende Eingabe-/Update-Patterns extrahieren,
- nicht mehrere Sektionen gleichzeitig ändern.

## Auffällige Strukturthemen

### 1. Zugriffskontrollen sind über mehrere Stellen verteilt

Relevante Dateien:

```text
src/components/ProtectedRoute.tsx
src/components/AnamneseRouteGuard.tsx
src/components/layout/Header.tsx
src/pages/Auth.tsx
src/App.tsx
src/contexts/AuthContext.tsx
```

Phase 2 hat bereits begonnen, dieses Risiko zu reduzieren:

- `ProtectedRoute` Loading-Test,
- `ProtectedRoute` Redirect-Test,
- `AnamneseRouteGuard` public/private/loading-Test.

Nächste sinnvolle Absicherung:

- Header-Navigation für Anamnese-Zugang charakterisieren.

### 2. Größte Dateien sind gleichzeitig fachlich sensibel

Die größten Dateien sind nicht nur groß, sondern häufig auch medizin-/patienten-/auth-nah. Deshalb wäre ein „einfach mal extrahieren“-Refactor riskant.

### 3. Lint-Schuld konzentriert sich in denselben Bereichen

Die bekannte Lint-Baseline liegt weiter bei:

```text
332 problems (300 errors, 32 warnings)
```

Viele Lint-Probleme liegen in Admin-, Anamnese-, Edge-Function- und PDF-Bereichen. Diese sollten später strukturiert bearbeitet werden, aber nicht vermischt mit Zugriffskontroll- und Refactor-Schritten.

## Konkrete nächste Priorität

Ich empfehle als nächsten kleinen Schritt keinen Refactor, sondern einen weiteren Zugriffskontroll-Characterization-Test:

```text
Header-Anamnese-Navigation abhängig von Auth/Public/Admin-Zustand testen
```

Warum?

- `Header.tsx` ist mit 499 Zeilen groß genug, um später refactorwürdig zu sein.
- Er ist direkt mit uneinheitlichen Zugriffskontrollen verbunden.
- Er entscheidet sichtbar zwischen Online-Anamnesebogen und PDF-Download.
- Er ist weniger riskant als `Anamnesebogen.tsx`, `submit-anamnesis` oder `TherapyRecommendation.tsx`.
- Ein Test hier verbessert das Sicherheitsnetz, bevor wir UI- oder Zugriffskontrolllogik vereinheitlichen.

Mögliche Testfälle:

1. Nicht eingeloggter Nutzer bei nicht-public Anamnese:
   - zeigt PDF-Download statt Online-Anamnesebogen-Link.
2. Eingeloggter Nutzer:
   - zeigt Link zum Online-Anamnesebogen.
3. Admin bei gesperrter/public-disabled Anamnese:
   - zeigt Online-Link plus Hinweis `gesperrt`.

## Status dieses Schritts

Dieser Schritt ist absichtlich dokumentations-/analyseorientiert. Produktivcode wurde nicht geändert.
