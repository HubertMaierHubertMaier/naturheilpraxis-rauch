# SIBO Infothek und Kirkamm Erinnerung

## Zweck

Diese Datei sammelt den bisher geklaerten Stand rund um die SIBO-Infothek-Seite, ihre Einbindung und die nutzbaren Kirkamm-Quellen.

## SIBO-Einbindung

Der SIBO-Block wurde bereits in mehreren Ebenen bearbeitet.

Betroffene Stellen:

1. `public/sibo-duenndarmfehlbesiedlung.html`
2. `src/lib/infothekContent.ts`
3. `src/lib/backupAreas.ts`

## Sichtbarkeit

Wichtiger Befund aus der spaeteren Live-/UI-Pruefung:

1. Der SIBO-Eintrag war in der Infothek-Dropdown-Liste sichtbar.
2. Der Eintrag steht im Bereich zwischen `Muedigkeit, Erschoepfung & Burnout` und `Mitochondropathie & instabile HWS`.
3. Der Eintrag ist `gated: true` und damit nicht einfach mit "oeffentlich sichtbar fuer alle" gleichzusetzen.
4. Solange die Seite gated bleibt, ist sie nicht der richtige Kandidat fuer aktive Google-Sichtbarkeit.
5. Fuer die Zwischenphase sollte sie daher nicht indexiert werden; bei einer spaeteren Oeffnung ist ein eigener SEO-/Rechts-/Datenschutz-Pass noetig.

## Erneute Vollpruefung vom 2026-07-11

1. Lokal, Produktionsbuild und GitHub `origin/main` enthalten bytegleich die erweiterte Fassung aus `a444dbb`.
2. Diese Fassung hat 15 Slides, `noindex, nofollow`, die neue Keimsektion und die vier Kirkamm-Video-Hinweise.
3. Die oeffentliche Lovable-URL liefert weiterhin die 12-Slide-Fassung aus dem Projektstand `393c7a1`; inhaltlich entspricht sie bis auf Lovable-Injektionen praktisch `0381183`.
4. Der Live-Stand hat noch `index, follow` und enthaelt die neue Keimsektion sowie die Video-Hinweise nicht.
5. Alle 14 externen Ressourcen- und Quellenlinks der neuen Fassung antworteten bei der Pruefung erfolgreich.
6. Die Infothek-Kachel wird fuer nicht angemeldete Besucher korrekt als gesperrter Patienten-Beitrag angezeigt.
7. Die direkte statische SIBO-URL ist trotzdem ohne Anmeldung lesbar: Fuer `/sibo-duenndarmfehlbesiedlung.html` existiert aktuell kein Datensatz in `infothek_gating`, und `public/infothek-gate.js` faellt bei fehlender DB-Regel auf `public` zurueck.
8. Damit bestehen derzeit zwei getrennte Aufgaben: Lovable auf `a444dbb` oder neuer synchronisieren und die beabsichtigte Patienten-Sichtbarkeit in `infothek_gating` explizit als `patient` speichern bzw. den statischen Fallback absichern.
9. Nach dem Live-Update des Users liefert Lovable jetzt erfolgreich `a444dbb`: 15 Slides, neue Keimsektion, Video-Hinweise und `noindex, nofollow` sind live.
10. Lokal wurde danach die eindeutige 16. Slide `Klaus-Test Seite` ergaenzt und `dateModified` auf `2026-07-11` gesetzt. Diese neue lokale Aenderung ist noch nicht auf GitHub oder Lovable.
11. Der Zugriffsfehler bleibt trotz erfolgreichem Inhalts-Update bestehen: Die DB-Abfrage fuer den SIBO-Pfad liefert weiterhin `[]`, und die direkte URL bleibt ohne Anmeldung lesbar.
12. Der User meldete anschliessend, dass Lovable die ausstehende Sandbox-Synchronisierung selbst ausgefuehrt hat. Von aussen verifizierbar sind `origin/main` und das Live-Artefakt beide auf `a444dbb`; der interne Sandbox-HEAD ist nur im Lovable-UI direkt pruefbar.

## Was anfangs Zeit gekostet hat

1. Lovable hing zeitweise auf einem alten GitHub-Stand
2. die normale Infothek-Einbindung und die Admin-/Backup-Mitnahme waren zwei verschiedene Ebenen
3. die Datei musste spaeter auch in `src/lib/backupAreas.ts` mitgefuehrt werden

## Dr. Kirkamm: was lesend bereits sauber verfuegbar ist

Zugaengliche und bereits gelesene Quellen:

1. `https://www.dr-kirkamm.de/untersuchung/reizdarm-sibo`
2. `https://www.dr-kirkamm.de/untersuchung/obstipation-und-methanbildende-darmbakterien`
3. `https://www.dr-kirkamm.de/videos/reizdarm-und-duenndarmfehlbesiedlung`
4. `https://www.dr-kirkamm.de/videos/was-ist-eine-duenndarm-fehlbesiedlung`
5. `https://www.dr-kirkamm.de/videos/therapie-der-duenndarm-fehlbesiedlung`

## Bisher aus Kirkamm gesicherte Kernpunkte

1. typisches Beschwerdeprofil mit Beschwerdefreiheit am Morgen, Zunahme im Tagesverlauf und Verstaerkung nach kohlenhydratreichen Mahlzeiten
2. Trigger wie Antibiotika, Magen-Darm-Infekte und Saeureblocker
3. Reizdarm-Atemtest mit Wasserstoff und Methan als wichtiger erster Diagnostikschritt
4. praktische therapeutische Einordnung nach Gasprofil und Besiedlungsort
5. 4-Saeulen-Therapie:
   - zugrundeliegende Ursachen behandeln
   - Ernaehrungstherapie
   - Reduktion der Ueberwucherung durch synthetische und pflanzliche Antibiotika plus Prokinetika
   - nutritive Maengel ausgleichen
6. im Methan-Kontext Hinweis auf methanogene Mikroorganismen, Wasserstoffbildner und H2S-assoziierte Keime wie `Bilophila wadsworthia` und `Desulfobacter`

## Wichtige Einordnung zu Videos

Die Kirkamm-Video-Unterseiten auf seiner Website liefern kurze beschreibende Textzusammenfassungen.
Das ist nutzbar.
Ein vollstaendiges YouTube-Transkript wurde in dieser Session nicht belastbar ausgelesen.

## Praxisregel fuer kuenftige SIBO-Arbeit

1. fuer oeffentliche Inhalte immer belastbare Literatur plus Kirkamm-Praxisperspektive zusammendenken
2. Kirkamm nicht als einzige Quelle verwenden
3. bei Therapieaussagen vorsichtig formulieren und keine starre Eigenbehandlung nahelegen
