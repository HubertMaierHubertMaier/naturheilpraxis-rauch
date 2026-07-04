---
name: Lovable GitHub Working Model
description: Verbindliche Arbeitsweise für dieses Projekt mit GitHub main, Lovable-Frontend-Sync, Backend-Nachzug, ShadowCopies und Live-Verifikation
type: preference
---

# Verbindliches Arbeitsmodell fuer dieses Projekt

## Projektgrenze

1. Dieses Repository steuert die Lovable-App `naturheilpraxis-rauch.lovable.app`.
2. `rauch-heilpraktiker.de` ist ein separates, unabhaengiges Projekt und darf niemals implizit als Teil dieses Workflows behandelt werden.

## GitHub-Regel

1. `main` ist der relevante Sync-Branch.
2. Vor jedem Push zuerst `fetch` und Stand gegen `origin/main` pruefen.
3. Wenn der Remote weiter ist, erst sauber integrieren, dann pushen.
4. Kein blindes Pushen auf alten lokalen Stand.

## Lovable-Regel

1. GitHub `main` kann den Frontend-Stand der Lovable-App aktualisieren.
2. Bei Backend-Aenderungen an Migrationen, Functions, RLS oder RPCs muss immer geprueft werden, ob der Backend-Stand ebenfalls live ist.
3. Frontend-Sync und Backend-Sync koennen zeitlich auseinanderlaufen.

## Sicherheitsregel

1. Vor sicherheits- oder patientendatenrelevanten Aenderungen immer ShadowCopy.
2. Nach jedem Block erst lokal verifizieren, dann pushen, dann live pruefen.
3. Kein Wechsel in die naechste Phase, solange ein Live-Blocker offen ist.

## Verifikationsregel

Ein Block ist erst abgeschlossen, wenn moeglichst alle relevanten Ebenen positiv geprueft sind:

1. `npm ci`
2. `npm test`
3. `tsc`
4. `build`
5. Live-Smoke auf der Lovable-App

## Dokumentationsregel

1. Fuer abgeschlossene Bloecke unter `session_historie/` dokumentieren.
2. Dort Scope, Fixes, Wortlaute, lokale Verifikation und Live-Verifikation festhalten.

## Verhalten bei Unklarheit

1. Nicht raten.
2. Nicht Systeme vermischen.
3. Erst den aktuellen Stand spiegeln und verifizieren.
4. Erst dann den naechsten kleinen Schritt setzen.
