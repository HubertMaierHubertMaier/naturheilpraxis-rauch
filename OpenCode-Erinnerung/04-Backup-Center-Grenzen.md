# Backup-Center Grenzen und Praxisregeln

## Zweck

Diese Datei haelt fest, was der Admin-Backup-Bereich in diesem Projekt wirklich leistet und was nicht.

## Was als gesichert gelten darf

Der Backup-Bereich sichert sehr viel:

1. Datenbankinhalte als ZIP
2. Voll-Backup mit Storage-Dateien
3. GitHub-Code-ZIP als zusaetzliches Code-Backup
4. thematische Teilbereich-Backups

## Was nicht mit echter Vollstaendigkeit gesichert ist

Diese Punkte muessen gedanklich getrennt bleiben:

1. echte Secret-Werte sind nicht im Backup enthalten
2. Passwoerter sind nicht exportierbar
3. 2FA muss bei Restore neu eingerichtet werden
4. Lovable History ist ein eigener Wiederherstellungspfad und nicht Teil des Backup-ZIPs
5. Lovable-Warteschlange ist nicht Teil des Backup-ZIPs
6. browserlokale Entwuerfe in `localStorage` und `sessionStorage` sind nicht Teil des Backup-ZIPs

## GitHub-Code-ZIP wichtiger Hinweis

Das Code-Backup im Admin-Bereich nutzt ein separat gespeichertes Repo-/Branch-Feld.
Es ist nicht automatisch garantiert, dass dies immer identisch mit der echten Lovable-GitHub-Verbindung ist.

Vor einer wichtigen Sicherung immer pruefen:

1. Repo = `HubertMaierHubertMaier/naturheilpraxis-rauch`
2. Branch = `main`

## Praxisregel vor riskanten Schritten

Vor Sync, Publish, groesseren Restore- oder Migrationsschritten bevorzugen:

1. `1-Klick-Komplettsicherung`
2. zusaetzlich GitHub `Code -> Download ZIP`

## Teilbereich-Backup-Warnung

Teilbereich-ZIPs sind nuetzlich fuer kleine Wiederherstellungen, aber nicht automatisch gleichbedeutend mit einem Voll-Backup.
Wenn ein kompletter Themenblock gesichert werden soll, nicht blind nur auf ein kleines Teilbereich-ZIP verlassen.

Ab der vorbereiteten Wiki-Phase-1-Version gilt zusaetzlich:

1. Das Wiki-Teilbackup verlangt alle 17 `public.kb_*`-Tabellen sowie die bestehenden Wiki- und Produktdaten.
2. Auch eine erfolgreiche OpenAPI-Erkennung wird immer mit diesen Pflicht-Tabellen vereinigt.
3. Kann eine verlangte Tabelle nicht gelesen werden, antworten Teilbackup und Datenbankbackup mit HTTP 500 statt ein unvollstaendiges Backup als erfolgreich auszugeben.
4. Deshalb immer zuerst die SQL-Migration pruefen und erst danach die neue Backup-Edge-Function ausrollen.
5. Der Tabellenexport verwendet keinen gemeinsamen Datenbank-Snapshot. Fuer eine wichtige Abnahmesicherung fachliche Schreibvorgaenge pausieren und den Restore isoliert pruefen.

## Restore-Merkregel

Fuer einen echten Worst Case werden typischerweise mehrere Quellen zusammen gebraucht:

1. GitHub fuer Code, statische Dateien, Migrationen und Functions
2. Daten-/Voll-Backup fuer DB, Auth-User und Storage
3. Provider-Dashboards fuer Secrets
