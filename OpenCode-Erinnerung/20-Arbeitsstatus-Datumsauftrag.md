# Arbeitsstatus: Datumsangaben bei der Dateiauswahl

Diese Datei bleibt als tägliche gemeinsame Arbeitsliste erhalten. Sie wird bei jeder Fortsetzung zuerst geöffnet und erst nach einem echten Nachweis aktualisiert.

## Aktueller Auftrag

- [x] Lokale, isolierte Umsetzung für die sichtbaren Datumsangaben vorbereitet und geprüft
- [ ] Ladedatum mit Uhrzeit in der echten Lovable-Vorschau sichtbar
- [ ] Speicherzeitpunkt des lokalen Auswahlentwurfs sichtbar
- [ ] Anamnesedatum bei Anamnese sichtbar und manuell eingabefähig
- [ ] Befunddatum bei Befunden sichtbar und manuell eingabefähig
- [ ] Dokumentdatum bei sonstigen Unterlagen sichtbar und manuell eingabefähig
- [x] Ladedatum ersetzt niemals das tatsächliche Datum der Unterlage
- [x] Keine Datei auslesen, übertragen oder veröffentlichen

## Verbindliche Arbeitsregel

Nach jedem Schritt wird diese Liste gegen den tatsächlichen Stand geprüft und aktualisiert. Solange ein Punkt offen ist, ist der Auftrag nicht fertig. Dann wird hier der konkrete nächste Schritt oder der Grund für eine notwendige Freigabe festgehalten.

## Stand vom 25.09.2026

Die Datums- und Ladeverlaufsänderung wurde in den GitHub-Hauptzweig übertragen. Lovable hat diesen Stand übernommen; die eingebettete Vorschau zeigte dieselbe Versionskennung. Der lokale Build und nach der Korrektur eines Speicherfehler-Randfalls 22 gezielte Tests waren erfolgreich. Fünf Fehler des breiten Testlaufs betreffen nach statischem Abgleich bereits den unveränderten Basisstand.

Die Praxis-Anmeldung ist in dieser Vorschau derzeit nicht aktiv. Beim Aufruf von `/therapie-kandidaten` bleibt deshalb nur die Ladeansicht sichtbar; die Datumsfelder konnten dort **noch nicht** bestätigt werden. Die oben stehenden fünf Sichtbarkeits-Haken bleiben offen. Es wurde nichts veröffentlicht und keine Patientendatei zur Prüfung geöffnet.

## Nächster Schritt

Nach Anmeldung durch Peter in der eingebetteten Vorschau die tatsächliche Patientenaufnahme öffnen und dort Ladedatum, Entwurf-Speicherzeit und die drei manuellen Dokumentdatumsfelder sichtbar prüfen. Bis dahin nicht als fertig melden. Keine Veröffentlichung.

## Wiederherstellungspunkt des aktuellen Auftrags

**Technischer Wiederherstellungspunkt:** `restore/datumseingabe-2026-09-24`

Der ältere Wiederherstellungspunkt bleibt erhalten. Der nachweislich neuere Code-Stand liegt im Hauptzweig und in der Lovable-Projektvorschau; der genaue Stand ist über den jüngsten Git-Commit feststellbar. Der Auftrag ist weiterhin offen, bis die Datumsfelder nach Praxis-Anmeldung in der echten Patientenaufnahme sichtbar geprüft sind. Keine Patientendateien für die Statusprüfung öffnen und nichts veröffentlichen.
