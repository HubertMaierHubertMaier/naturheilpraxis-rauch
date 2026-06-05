# 05 — DSGVO-orientierte Vorbereitung für Anamnesebogen, E-Mail-Versand und interaktive Übertragung

## Wichtiger Hinweis

Diese Datei ist eine technische und organisatorische Orientierung, keine Rechtsberatung. Für produktive Verarbeitung von Gesundheitsdaten, automatischen E-Mail-Versand oder interaktive Online-Übertragung sollte eine datenschutzrechtliche Prüfung durch eine fachkundige Stelle erfolgen.

## Ausgangslage

Der aktuelle interaktive Anamnesebogen ist aus Datenschutzgründen nur manuell downloadbar. Das ist aus Risikosicht sinnvoll, weil Gesundheits- und Anamnesedaten zu den besonders schützenswerten personenbezogenen Daten gehören.

Später sind zwei mögliche Zielbilder angedacht:

1. Automatischer Versand des Anamnesebogens an die registrierte E-Mail-Adresse nach korrekter Verifikation.
2. Interaktives Ausfüllen und Übertragen des Anamnesebogens auf dem Endgerät des Klienten nach entsprechender Verifikation, ggf. innerhalb der App/Lovable-Oberfläche.

Bis zur rechtlichen Klärung sollte die technische Architektur diese Optionen vorbereiten, aber nicht unkontrolliert aktivieren.

## Datenschutz-Grundprinzipien für diesen Bereich

Für Patientendaten sollten mindestens folgende Prinzipien eingehalten werden:

1. Datenminimierung: nur Daten erheben, die wirklich benötigt werden.
2. Zweckbindung: klare Trennung zwischen Kontakt, Registrierung, Anamnese, Behandlung, Abrechnung und Kommunikation.
3. Integrität und Vertraulichkeit: Transportverschlüsselung, Zugriffsschutz, Rollenprüfung, Protokollierung ohne sensible Inhalte.
4. Speicherbegrenzung: definierte Lösch- und Aufbewahrungsfristen.
5. Transparenz: verständliche Datenschutzhinweise vor Erhebung und Übertragung.
6. Einwilligung bzw. passende Rechtsgrundlage: besonders bei Gesundheitsdaten ausdrücklich und dokumentiert klären.
7. Nachweisbarkeit: Einwilligungen, Versionsstände von Datenschutztexten und technische Verarbeitungsschritte müssen nachvollziehbar sein.

## Empfohlene sichere Zielarchitektur

### Phase A — Aktuell beibehalten: manueller Download

Der aktuelle manuelle Download bleibt die risikoärmste Variante.

Empfohlene Verbesserungen ohne produktive Online-Übertragung:

1. Download nur über HTTPS.
2. Datei ohne vorausgefüllte Patientendaten bereitstellen.
3. Klare Hinweise:
   - nicht unverschlüsselt per normaler E-Mail zurücksenden,
   - Rückgabeweg mit Praxis abstimmen,
   - sensible Gesundheitsdaten nicht in Freitext-Mails senden.
4. Versionierung des Formulars, z.B. Formularversion und Datum.
5. Keine Tracking- oder Analyse-Skripte auf der Downloadseite, sofern nicht zwingend erforderlich.

### Phase B — Vorbereiteter, aber deaktivierter E-Mail-Versand

Der spätere automatische Versand kann technisch vorbereitet werden, sollte aber hinter einem Feature Flag deaktiviert bleiben, bis die rechtliche Freigabe erfolgt ist.

Empfohlene technische Regeln:

1. Feature Flag, z.B. `VITE_ENABLE_ANAMNESIS_EMAIL_DELIVERY=false` oder serverseitig `ENABLE_ANAMNESIS_EMAIL_DELIVERY=false`.
2. Versand nur nach verifizierter E-Mail-Adresse.
3. Keine Gesundheitsdaten direkt im E-Mail-Text.
4. Besser: Versand eines neutralen Links oder neutralen PDF-Formulars ohne vorausgefüllte Diagnosedaten.
5. Falls Downloadlink: kurzlebiger, signierter Link mit Ablaufzeit.
6. Kein Link mit direkt lesbaren personenbezogenen Daten in der URL.
7. Rate-Limit gegen Missbrauch.
8. Audit-Log nur mit technischen Metadaten, nicht mit Anamnesefreitexten.
9. SMTP-/E-Mail-Anbieter nur mit Auftragsverarbeitungsvertrag und geeigneten TOMs.

Wichtige Entscheidung:

Ein normaler unverschlüsselter E-Mail-Anhang mit Gesundheitsdaten sollte vermieden werden. Wenn später personenbezogene oder medizinische Inhalte per E-Mail versendet werden sollen, braucht es ein rechtlich und technisch abgestimmtes Schutzkonzept, z.B. Verschlüsselung, Portalzustellung oder gesicherter Dokumentenabruf.

### Phase C — Interaktives Ausfüllen nach Verifikation

Für das interaktive Ausfüllen sollten keine sensiblen Daten dauerhaft im Browser gespeichert werden, außer es ist bewusst entschieden, dokumentiert und technisch geschützt.

Empfohlener Ablauf:

1. Klient registriert sich oder erhält einen sicheren Zugang.
2. E-Mail-Adresse wird verifiziert.
3. Optional zusätzlicher Faktor oder Einmalcode vor sensiblen Formularen.
4. Vor Start des Formulars werden Datenschutzinformation und Einwilligung angezeigt.
5. Klient bestätigt die Einwilligung aktiv.
6. Formular speichert Entwürfe nur, wenn dies ausdrücklich vorgesehen und transparent erklärt ist.
7. Übertragung erfolgt ausschließlich über HTTPS an eine authentifizierte serverseitige Schnittstelle.
8. Serverseitig werden Authentifizierung, Rollenbezug, Rate-Limit und Eingabevalidierung geprüft.
9. Daten werden verschlüsselt gespeichert, soweit Plattform/Backend dies ermöglicht.
10. Admin-/Praxiszugriff erfolgt rollenbasiert und protokolliert.
11. Lösch-/Export-/Auskunftsprozesse werden vorbereitet.

## Technisches Vorbereitungsmodell ohne DSGVO-Risikoerhöhung

Bis zur rechtlichen Freigabe sollte nur Folgendes umgesetzt werden:

1. Feature Flags für alle künftigen Versand-/Übertragungsfeatures.
2. Neutrale UI-Platzhalter und erklärende Texte, ohne echte Datenübertragung.
3. Tests für deaktivierte Features:
   - Versand ist standardmäßig aus.
   - Upload/Submit ist standardmäßig blockiert oder nur in Testumgebung möglich.
   - Ohne Verifikation kein Zugriff auf interaktives Formular.
4. Datenklassifikation im Code und in der Dokumentation:
   - öffentlich,
   - personenbezogen,
   - patientensensibel/Gesundheitsdaten,
   - intern/admin.
5. Schnittstellen so entwerfen, dass spätere Aktivierung nicht zu Client-Secrets oder ungeschützten Public Endpoints führt.
6. Keine produktiven Echtdaten in Test-, Demo- oder Logsysteme.

## Konkrete Schutzmaßnahmen für spätere Implementierung

### Authentifizierung und Verifikation

- E-Mail-Verifikation vor Zugriff auf personenbezogene Formularbereiche.
- Optional Einmalcode oder zweiter Faktor für medizinische Inhalte.
- Sitzungsablauf bei Inaktivität.
- Schutz gegen Brute Force und Code-Spam.

### Transport und Speicherung

- HTTPS zwingend.
- Keine sensiblen Daten in URLs.
- Keine sensiblen Daten in Browser-LocalStorage, wenn vermeidbar.
- Keine Gesundheitsdaten in Analytics, Error Tracking oder Konsolenlogs.
- Serverseitige Validierung jedes Submit-Vorgangs.

### E-Mail

- Keine Anamnesedaten im normalen E-Mail-Text.
- Keine ungeschützten medizinischen Anhänge ohne Freigabe.
- Bevorzugt: neutraler Hinweis plus gesicherter Portal-/Downloadlink.
- Link zeitlich begrenzen und nur nach Authentifizierung öffnen.
- E-Mail-Anbieter datenschutzrechtlich prüfen.

### Protokollierung

- Loggen: Zeitpunkt, technische Request-ID, Nutzer-ID, Status.
- Nicht loggen: Symptome, Diagnosen, Freitextantworten, Anhänge, medizinische Inhalte.
- Zugriff auf Logs einschränken.

### Einwilligung und Nachweis

Vor interaktiver Erhebung sollten versioniert gespeichert werden:

1. Zeitpunkt der Einwilligung.
2. Nutzer-ID oder verifizierte Kontakt-ID.
3. Version der Datenschutzhinweise.
4. Version des Anamnesebogens.
5. Zweck der Verarbeitung.
6. optional IP/User-Agent nur falls rechtlich/organisatorisch gewünscht und dokumentiert.

## Empfohlene Produktentscheidung bis zur rechtlichen Klärung

Bis die rechtliche Situation vollständig geklärt ist, sollte gelten:

1. Manueller Download bleibt aktiv.
2. Automatischer E-Mail-Versand bleibt vorbereitet, aber deaktiviert.
3. Interaktives Ausfüllen bleibt vorbereitet, aber nicht produktiv für Echtdaten aktiviert.
4. Alle neuen UI-Elemente müssen klar kommunizieren, dass digitale Übermittlung erst nach Freigabe verfügbar ist.
5. Technische Implementierung darf nur mit Testdaten erfolgen.
6. Aktivierung produktiver Patientendatenverarbeitung erfolgt erst nach expliziter Freigabe.

## Erforderliches persönliches Eingreifen

Vor produktiver Aktivierung werden Entscheidungen bzw. Freigaben benötigt zu:

1. Rechtsgrundlage und Einwilligungstext für Gesundheitsdaten.
2. Datenschutzerklärung und Informationspflichten.
3. Auftragsverarbeitungsverträge für Hosting, Supabase, E-Mail, Logging, KI-Dienste und ggf. Lovable-nahe Infrastruktur.
4. Zulässigkeit des E-Mail-Versands und gewünschtes Sicherheitsniveau.
5. Lösch- und Aufbewahrungskonzept.
6. Rollen- und Zugriffskonzept für Praxis/Admins.
7. Vorgehen bei Datenpannen und Betroffenenanfragen.
8. Freigabe, ob interaktive Übertragung produktiv aktiviert werden darf.

## Empfehlung

Kurzfristig sollte die App technisch so vorbereitet werden, dass Datenschutz später sauber umsetzbar ist: Feature Flags, Verifikations-Gates, klare Datenklassifikation, keine Secrets im Client, keine sensiblen Logs, sichere serverseitige Schnittstellen. Produktiv aktivieren würde ich E-Mail-Versand oder interaktive Anamneseübertragung erst nach dokumentierter rechtlicher Freigabe.
