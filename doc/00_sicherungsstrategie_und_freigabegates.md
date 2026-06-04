# 00 — Sicherungsstrategie und Freigabe-Gates

## Ziel

Diese Datei legt fest, wie der aktuelle Stand und jede später stabilisierte Phase lokal abgesichert, getestet, dokumentiert und erst danach zu GitHub übertragen wird.

## Grundsatz

Für dieses Projekt gilt ab sofort:

1. Keine funktionale Änderung ohne vorherige lokale Sicherheitskopie bei sicherheits- oder patientendatenrelevanten Arbeiten.
2. Jede Phase wird lokal abgeschlossen, getestet und dokumentiert.
3. Nach jeder finalisierten funktionalen Phase wird eine akkurate lokale Kopie in einem gesonderten Backup-Ordner erstellt.
4. Erst nach erfolgreicher lokaler Prüfung wird committed.
5. Erst nach Commit und abschließender Diff-Prüfung wird zu GitHub gepusht.
6. Änderungen an Datenschutz, Patientendaten, E-Mail-Versand, Anamneseübertragung, Rollen, RLS oder Edge Functions benötigen explizite fachliche Freigabe durch den Projektverantwortlichen.

## Aktueller Sicherheitsstand

Es wurde eine erste vollständige lokale Sicherheitskopie des aktuellen Arbeitsstandes erstellt.

Backup-Pfad:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260604-204835_phase-0-current-local-state`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260604-204835_phase-0-current-local-state/BACKUP_MANIFEST.txt`

Verifizierte Eckdaten:

- Quelle: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch zum Sicherungszeitpunkt: `main`
- Git-Status zum Sicherungszeitpunkt: `?? doc/`
- Dateianzahl in der Kopie: 407
- Größe der Kopie: 121M
- Manifest-SHA256: `998d0ead5c8ed4214bfde13889e910e0dab89a59013f8ef40b7463d2a653f697`

Hinweis: Große reproduzierbare Build-/Dependency-Verzeichnisse wie `node_modules`, `dist`, `build` und `.cache` wurden bei der Sicherheitskopie bewusst ausgeschlossen, damit die Kopie stabil, nachvollziehbar und nicht unnötig aufgebläht ist. Der Quellstand, Konfigurationen und Dokumentation wurden gesichert.

## Backup-Schema für künftige Phasen

Jede abgeschlossene Phase erhält eine eigene Kopie nach folgendem Muster:

`/home/klaus999/project-backups/naturheilpraxis-rauch/YYYYMMDD-HHMMSS_phase-N-kurzbeschreibung`

Beispiele:

- `20260604-204835_phase-0-current-local-state`
- `20260605-101500_phase-1-build-stabilized`
- `20260605-134000_phase-2-tests-stabilized`
- `20260606-091500_phase-4-auth-security-matrix`

Jede Kopie enthält zusätzlich ein `BACKUP_MANIFEST.txt` mit:

1. Backup-Pfad.
2. Erstellzeitpunkt.
3. Quellpfad.
4. Branch.
5. Commit-SHA.
6. Git-Status.
7. kurze Beschreibung der Phase.
8. ausgeführte Test-/Build-Kommandos.
9. bekannte Restpunkte oder Einschränkungen.

## Freigabe-Gate je Phase

Eine Phase gilt erst als finalisiert, wenn alle folgenden Punkte erfüllt sind:

1. Arbeitsumfang der Phase ist abgeschlossen.
2. `git diff` wurde geprüft.
3. Es wurden keine Secrets oder patientensensiblen Echtdaten in den Diff aufgenommen.
4. Relevante lokale Tests wurden ausgeführt.
5. Relevanter Build/Typecheck wurde ausgeführt.
6. Ergebnisse wurden in der Dokumentation oder im Commit-Text festgehalten.
7. Lokale Sicherheitskopie wurde erstellt.
8. Git-Commit wurde lokal erstellt.
9. Push zu GitHub erfolgt erst nach bewusster Freigabe bzw. wenn der vorher vereinbarte Push-Prozess gilt.

## Wann persönliches Eingreifen erforderlich ist

Persönliches Eingreifen des Projektverantwortlichen ist erforderlich bei:

1. GitHub-Authentifizierung oder fehlenden Schreibrechten.
2. Entscheidung, ob ein Branch/PR nach GitHub gepusht werden darf.
3. Merge nach `main` oder Deployment in produktionsnahe Umgebungen.
4. Rotation echter API-Keys, Supabase-Schlüssel, SMTP-Zugänge oder anderer Secrets.
5. Entscheidung über rechtliche Zulässigkeit von E-Mail-Versand, interaktiver Anamneseübertragung oder Speicherung besonderer Kategorien personenbezogener Daten.
6. Auswahl/Bestätigung eines Auftragsverarbeiters, E-Mail-Dienstes, Hosting-Anbieters oder externen KI-/Analyse-Dienstes.
7. Freigabe von Datenschutztexten, Einwilligungstexten, TOMs, Löschkonzept und Verzeichnis von Verarbeitungstätigkeiten.
8. Entscheidung, ob ein Feature nur vorbereitet, deaktiviert hinter Feature Flag, oder produktiv aktiviert werden darf.

## Arbeitsregel für Patientendaten

Bis zur rechtlichen Freigabe werden keine produktiven Flows implementiert, die echte Anamnesedaten automatisch per E-Mail versenden oder interaktiv übertragen. Es dürfen jedoch technische Vorbereitungen erfolgen, sofern sie deaktiviert, testbar, dokumentiert und ohne Echtdaten nutzbar sind.
