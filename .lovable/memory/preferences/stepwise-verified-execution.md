---
name: Stepwise Verified Execution
description: Nach jedem Schritt Ergebnisse erst exakt prüfen, dann erst zum nächsten Schritt oder zur nächsten Phase übergehen
type: preference
---

# Schrittweise, verifizierte Ausführung

Für dieses Projekt gilt ab sofort:

1. Änderungen werden in **kleinen, fachlich klaren Blöcken** durchgeführt.
2. Nach **jedem Block** werden die realen Ergebnisse geprüft, bevor der nächste Block startet.
3. Keine impliziten Sprünge in die nächste Phase, solange der aktuelle Schritt nicht verifiziert ist.
4. Wenn neue Remote-/Lovable-Änderungen auftauchen, wird zuerst der aktuelle `main` gespiegelt und neu bewertet.
5. Vor substanziellen Codeänderungen in sicherheits-, patienten- oder buildrelevanten Pfaden wird ein ShadowCopy angelegt.

## Reihenfolgeprinzip

1. Erst Spiegeln und Verstehen
2. Dann kleinste notwendige Korrektur
3. Dann Verifikation
4. Dann erst der nächste Schritt

## Anwendungsregel

Besonders wichtig für:

1. Auth- und 2FA-Flows
2. Anamnese- und Gesundheitsdatenpfade
3. `supabase/functions/**`
4. `public/`-Inhalte mit Patientenbezug
5. Build-/Lockfile-/Testsystem
