# 03 Wortlaut und Sicherheitsvertrag

## Zweck

Diese Datei sichert die in dieser Phase eingeführten oder bestätigten Wortlaute fachlich ab, damit Produktlogik, UI-Semantik und Sicherheitsmodell nicht erneut auseinanderlaufen.

## 1. 2FA-Semantik

### Verbindlicher Bedeutungsrahmen

`Passwort und 2FA` bedeutet in diesem Projekt ab jetzt nicht nur einen UI-Zweischritt, sondern:

1. Passwortprüfung
2. OTP-Verifikation
3. Bindung an die konkrete Supabase-Session
4. serverseitige Nachprüfbarkeit über `is_current_session_two_factor_verified`

### Zu vermeidende falsche Formulierungen

1. "Der Nutzer ist nach Passwortlogin schon praktisch drin"
2. "2FA ist nur eine zusätzliche Bestätigung"
3. "Die UI zeigt 2FA, also ist die Session sicher"

## 2. Wortlaut geschützter Anamnesepfade

### A. Datenschutz-Kill-Switch (global)

Aktueller Wortlaut:

`Online-Anamnese vorübergehend deaktiviert`

Bedeutung:

1. Der globale Online-Formularbetrieb ist für Patienten aus Datenschutzgründen ausgesetzt.
2. Dies ist **nicht** dieselbe Aussage wie eine individuelle Nutzerfreigabe.

### B. Individuelle Freigabesperre

Aktueller Wortlaut:

`Anamnesebogen noch nicht freigeschaltet`

Begleittext:

`Der Zugriff auf den Anamnesebogen ist für dieses Konto aktuell noch nicht freigeschaltet. Bitte wende dich an die Praxis, wenn du den Bogen erneut ausfüllen oder ergänzen sollst.`

Bedeutung:

1. Nutzer ist eingeloggt
2. Nutzer hat gültige 2FA-gebundene Session
3. Aber `anamnese_download` ist für dieses Konto nicht freigegeben

## 3. Verbindliche Semantik von `anamnese_download`

`anamnese_download` bedeutet nach dem jetzigen Stand verbindlich:

1. Zugriff auf den freigeschalteten PDF-/Blanko-Pfad
2. Sichtbarkeit des Anamnesebogen-Einstiegs im Header
3. Sichtbarkeit der Dashboard-Kachel `Anamnesebogen ergänzen`
4. Sichtbarkeit des Dashboard-PDF-Downloads für vorhandene Anamnesen
5. individueller Zugang zum Online-Anamnesepfad, sofern der globale Datenschutz-Kill-Switch das grundsätzlich erlaubt

Es bedeutet **nicht** nur:

1. Blanko-PDF
2. oder nur Header-Sichtbarkeit

## 4. Sessionvertrag für sensible Routen

Für folgende Routen gilt ab jetzt als Vertragsregel:

1. `/erstanmeldung`
2. `/dashboard`
3. `/patienten-bibliothek`
4. `/anamnesebogen`

Zugriff nur bei:

1. gültiger Auth-Session
2. gültig gebundener 2FA-Sitzung
3. plus ggf. zusätzlicher fachlicher Freigabe

## 5. Sessionvertrag für Datenpfade

Für folgende Daten-/Funktionspfade gilt derselbe Schutzanspruch:

1. `anamnesis_submissions`
2. `iaa_submissions`
3. `patient_resources`
4. `patient-library`
5. `patient_access`
6. `download-anamnesis-pdf`
7. `submit-anamnesis`

## 6. Wortlaut für spätere Kommunikation

### Empfohlen intern

1. "Route ist login- und 2FA-gebunden"
2. "Route ist zusätzlich individuell freigabegesteuert"
3. "Globale Datenschutzsperre aktiv"
4. "Individuelle Freigabe fehlt"

### Nicht mehr verwenden

1. "öffentlich deaktiviert" wenn es eigentlich eine individuelle Sperre ist
2. "verifiziert" wenn nur Login, aber keine gebundene 2FA-Sitzung vorliegt
3. "Download freigeschaltet" wenn nur ein Teilpfad gemeint ist

## 7. Projektgrenzen-Wortlaut

Verbindlich:

1. `naturheilpraxis-rauch.lovable.app` ist dieses Projekt
2. `rauch-heilpraktiker.de` ist ein separates unabhängiges Projekt

Daraus folgt:

1. Live-Verifikation in dieser Phase bezieht sich nur auf die Lovable-App
2. Aussagen über die andere Domain sind nur dann zulässig, wenn sie ausdrücklich als separates Projekt benannt werden

## 8. Abschlussformel dieser Phase

Die Session- und Anamnesesicherheit dieser Phase ist fachlich nur dann korrekt beschrieben, wenn gleichzeitig klar ist:

1. Login allein reicht nicht
2. 2FA muss an die konkrete Session gebunden sein
3. Fachliche Freigaben stehen zusätzlich neben der Sessionprüfung
4. Globale Datenschutzsperren und individuelle Freigaben sind unterschiedliche Ebenen
