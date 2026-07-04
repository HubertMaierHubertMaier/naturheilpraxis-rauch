# Grundsaetzliche Vorgehensweise mit Lovable, GitHub und Live-Pruefung

## Zweck

Diese Datei beschreibt die verbindliche Arbeitsweise fuer dieses Projekt, damit Aenderungen sicher, nachvollziehbar und ohne Verwechslung mit anderen Projekten umgesetzt werden.

## Projektgrenze

Dieses Repository und alle hier beschriebenen Schritten beziehen sich auf:

1. das Repository `naturheilpraxis-rauch`
2. die Lovable-App `https://naturheilpraxis-rauch.lovable.app`

Nicht Teil dieses Projekts ist:

1. `https://rauch-heilpraktiker.de`

Diese Domain ist aktuell ein separates, unabhaengiges System und darf nicht mit der Lovable-App gleichgesetzt werden.

## Grundprinzip

Wir arbeiten immer in kleinen, klar abgegrenzten Bloecken.

Jeder Block folgt dieser Reihenfolge:

1. Verstehen und Spiegeln des aktuellen Stands
2. ShadowCopy vor kritischen Eingriffen
3. kleinste notwendige Codeaenderung
4. lokale Verifikation
5. kontrollierter GitHub-Push nach `main`
6. Lovable-/Live-Verifikation
7. erst danach der naechste Block oder die naechste Phase

## Rolle von GitHub

GitHub ist in diesem Projekt der zentrale Code-Sync-Pfad.

Wichtige Regeln:

1. Der relevante Branch fuer Lovable ist `main`.
2. Vor jedem Push muss zuerst geprueft werden, ob `origin/main` weiter ist.
3. Wenn der Remote weiter ist, wird zuerst `fetch` und dann sauber auf den aktuellen Stand gezogen oder rebased.
4. Es wird nicht blind gegen einen aelteren lokalen Stand gepusht.

## Rolle von Lovable

Lovable uebernimmt den Frontend-Stand aus dem GitHub-Branch `main` in die Lovable-App.

Wichtig:

1. Ein GitHub-Push kann den Frontend-Sync anstoßen.
2. Bei Backend-nahen Aenderungen kann es trotzdem zusaetzliche Schritte in Lovable oder in der verbundenen Cloud-/Supabase-Instanz brauchen.
3. Frontend-Sync und Backend-Sync koennen zeitlich auseinanderlaufen.

## Backend-Hinweis

Bei Aenderungen an einem dieser Bereiche muss besonders vorsichtig gearbeitet werden:

1. `supabase/migrations/`
2. `supabase/functions/`
3. Auth-/Session-Logik
4. RLS-/RPC-Logik

Dann gilt:

1. Nach dem Push muss geprueft werden, ob die Lovable-App nur das neue Frontend zeigt oder ob auch die neue Backend-Logik bereits aktiv ist.
2. Wenn Frontend und Backend nicht denselben Stand haben, darf nicht zur naechsten Phase uebergegangen werden.

## Verbindliche Verifikation vor dem Weitergehen

### Lokal

Vor einer Freigabe des Blocks werden, soweit sinnvoll, diese Gates geprueft:

1. `npm ci`
2. `npm test`
3. `npx tsc -p tsconfig.app.json --noEmit`
4. `npx tsc -p tsconfig.node.json --noEmit`
5. `npm run build`

### Live

Nach dem Push wird die Lovable-App gezielt geprueft.

Beispiele:

1. anonyme Zugriffe auf geschuetzte Routen
2. Login-/2FA-Flow
3. Zugriff auf patientensensitive Seiten
4. PDF-/Downloadpfade
5. konkrete Regressionen aus dem letzten Fixblock

## ShadowCopy-Regel

Vor substanziellen Aenderungen wird eine ShadowCopy ausserhalb des Repositorys erstellt.

Das gilt besonders fuer:

1. Auth-/2FA-Aenderungen
2. patientensensitive Datenpfade
3. `supabase/functions/`
4. `supabase/migrations/`
5. Freigabe-/Zugriffslogik

## Session-Historie-Regel

Wenn ein Block fachlich und technisch abgeschlossen ist, wird er unter `session_historie/` dokumentiert.

Die Session-Historie soll enthalten:

1. Scope des Blocks
2. umgesetzte Fixes
3. lokale Verifikation
4. Live-Verifikation
5. relevante Wortlaute / Semantik
6. offene Restpunkte

## Was wir vermeiden

1. Keine Vermischung mit anderen Projekten oder Domains
2. Kein Weitergehen in die naechste Phase bei offenem Live-Fehler
3. Keine grossen Sammelaenderungen ohne Zwischenverifikation
4. Kein blindes Pushen auf veralteten lokalen Stand
5. Keine Annahme, dass ein Frontend-Update automatisch jede Backend-Aenderung live macht

## Praktische Kurzform

Die sichere Reihenfolge lautet immer:

1. Stand spiegeln
2. ShadowCopy
3. klein fixen
4. lokal pruefen
5. nach `main` bringen
6. Lovable live pruefen
7. dokumentieren
8. erst dann weiter
