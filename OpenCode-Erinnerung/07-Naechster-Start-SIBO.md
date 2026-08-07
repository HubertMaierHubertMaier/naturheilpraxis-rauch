# Naechster Start - SIBO

## Stand beim letzten Stopp

1. Die SIBO-HTML wurde lokal und auf GitHub `main` erweitert.
2. Relevanter Commit: `a444dbb` `Expand SIBO infothek content`.
3. Erweiterungen betreffen unter anderem:
   - Keimsektion `Welche Keime bei SIBO diskutiert werden`
   - `Desulfovibrio piger`
   - `Desulfobulbus`
   - `Desulfobacter`
   - Video-Hinweise zu Dr. med. Ralf Kirkamm

## Aktueller offener Punkt

Lovable zeigt seit dem Live-Update des Users den Stand `a444dbb` korrekt. Offen sind jetzt die neuere lokale Klaus-Test-Slide und der direkte Zugriffsschutz.

## Neuer verifizierter Befund vom 2026-07-11

1. Die lokale Datei `public/sibo-duenndarmfehlbesiedlung.html` und `origin/main` enthalten den erweiterten Stand aus `a444dbb`.
2. Die live ausgelieferte Lovable-URL zeigte dagegen weiterhin den aelteren Stand aus `0381183`.
3. Konkret fehlten live weiterhin unter anderem:
   - die Sektion `Welche Keime bei SIBO diskutiert werden`
   - `Desulfovibrio piger`
   - `Desulfobulbus`
   - `Desulfobacter`
   - die weiterfuehrenden Video-Hinweise
4. Schlussfolgerung: Vor weiterer Inhaltsarbeit zuerst den Lovable-/Publish-Stand gegen `a444dbb` geradeziehen. Sonst wird ein Sync-Problem weiter mit HTML-Arbeit verwechselt.
5. Erneute technische Vollpruefung:
   - lokal / `dist` / `origin/main` sind bytegleich
   - neue Fassung: 15 Slides, `noindex, nofollow`, Browser fehlerfrei
   - live: 12 Slides, `index, follow`, Browser technisch fehlerfrei, aber alter Inhalt
   - live injizierte Lovable-Metadaten nennen Projektstand `393c7a1`
   - alle 14 externen Links der neuen Fassung waren erreichbar
6. Zusaetzlicher Zugriffsfehler:
   - Infothek-Kachel ist als Patienteninhalt gesperrt
   - direkte statische URL ist ohne Login lesbar
   - Supabase-Abfrage fuer den SIBO-Pfad liefert keinen `infothek_gating`-Datensatz (`[]`)
   - statisches Gate faellt deshalb auf `public` zurueck
7. Stand nach dem anschliessenden Live-Update:
   - Lovable-Artefakt nennt Commit `a444dbb`
   - live: 15 Slides, neue Keimsektion und Video-Hinweise vorhanden
   - live: `noindex, nofollow`
   - lokal: zusaetzliche 16. Slide `Klaus-Test Seite`
   - die Klaus-Test-Slide ist noch nicht auf GitHub oder Lovable
   - der Zugriffsfehler besteht weiterhin
8. Lovable hat laut Rueckmeldung des Users danach die Sandbox-Synchronisierung selbst ausgefuehrt. Extern erneut bestaetigt: GitHub `main` und Live-Deployment stehen beide auf `a444dbb`; die lokale 16. Klaus-Test-Slide bleibt noch ausserhalb von GitHub/Lovable.

## Arbeitsregel fuer die naechste Session

1. Erst diese Datei lesen.
2. Dann `public/sibo-duenndarmfehlbesiedlung.html` lokal gegen `origin/main` und gegen die sichtbare Lovable-Version einordnen.
3. Keine neuen SIBO-Inhalte annehmen oder verwerfen, bevor der sichtbare Stand klar ist.
4. In der Admin-Sichtbarkeit fuer SIBO explizit `patient` speichern und danach den direkten URL-Aufruf ohne Session pruefen.
5. Den statischen Gate-Fallback so absichern, dass ein im Code als `gated: true` gefuehrter Inhalt bei fehlender DB-Zeile nicht direkt oeffentlich wird.
6. Weitere HTML-Arbeit wieder so:
   - lokale Aenderung
   - HTML-Block im Chat zeigen
   - User-Gegencheck
   - dann gesammelt nach GitHub/Lovable
