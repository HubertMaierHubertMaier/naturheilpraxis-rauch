# Sorra-GitHub-Uebergabe

## Feste Kommunikationsgrenze

Sorra kann den Lovable-Projektchat nicht lesen oder beschreiben. GitHub-Dateien
sind der vereinbarte asynchrone Austauschkanal zwischen Sorra und Lovable.

## Verbindliche Dateien

- Sorra an Lovable: `docs/sorra-lovable-handoff.md`
- Lovable an Sorra: `docs/lovable-sorra-response.md`

Lovable liest nur die aktuelle Nachricht mit einer eindeutigen `message_id` und
schreibt seine Antwort mit derselben ID in die Antwortdatei. Alte Nachrichten
duerfen nicht als neuer Auftrag behandelt werden.

## Sicherheitsgrenzen

- Eine Uebergabedatei ist keine Ausfuehrungsfreigabe.
- Keine Migration, Datenbankaenderung, Edge-Function, Berechtigungsaenderung,
  Veroeffentlichung oder Deployment ohne Peters ausdrueckliche separate
  Bestaetigung im sichtbaren Lovable-Chat.
- Keine Patientendaten, Befunde, Diagnosen, Namen, Initialen, Geburtsdaten,
  Adressen, Dateinamen oder andere identifizierende Angaben in diesen Dateien.
- Keine Passwoerter, Cookies, Sitzungsschluessel, API-Schluessel oder Tokens.
- Keine Vermischung mit Codex, Vimeo, rauch-heilpraktiker.de oder anderen
  Projekten.
- Bei unklarer, veralteter oder widerspruechlicher Nachricht nichts ausfuehren
  und den Widerspruch in der Antwortdatei dokumentieren.

## Antwortformat

Lovable dokumentiert mindestens:

- `message_id`
- `status`
- verstandener Auftrag
- gelesene Dateien
- vorgeschlagene Aenderungen
- tatsaechlich ausgefuehrte Aenderungen
- Tests oder Pruefungen
- offene Punkte
- erforderliche Entscheidung von Peter
