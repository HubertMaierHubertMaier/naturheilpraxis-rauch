# BNI Claudius - Aktueller Arbeitsstand

Stand: 2026-07-14

## Unbedingte Projektabgrenzung

Es gibt zwei getrennte Arbeitsbereiche, die nicht verwechselt werden duerfen:

1. die umfangreiche `Lovable`-Anwendung mit React, Supabase, Patienten-/Adminfunktionen und Deployment
2. die einfache, eigenstaendige BNI-Praesentations-HTML

Wenn der User von `BNI-Claudius`, `BNI HTML` oder der Weiterarbeit am HTML spricht, ist ausschliesslich diese Datei gemeint:

`C:\Users\Administrator\Documents\Lovable\OpenCode\naturheilpraxis-rauch\BNI-Claudius\gesundheitsrunde-beispiel-fuer-die-gruppe.html`

Obwohl die Datei physisch im selben Repository liegt, ist diese Arbeit nicht automatisch eine Lovable-, React-, GitHub- oder Deployment-Aufgabe. Ohne ausdruecklichen Zusatz des Users gilt deshalb:

1. nur diese HTML-Datei lesen und bearbeiten
2. keine breite Suche auf dem Rechner oder im Repository
3. `src/pages/BNIGesundheitsrunde.tsx` nicht oeffnen oder bearbeiten
4. `public/bni-claudius/` und `scripts/sync-bni-static.mjs` nicht bearbeiten
5. keinen GitHub-/Lovable-Sync und keine Veroeffentlichung ausloesen
6. andere BNI-Dateien nicht angleichen

## Hauptdatei

- Alleinige fuehrende Arbeitsdatei fuer normale BNI-HTML-Auftraege: `BNI-Claudius\gesundheitsrunde-beispiel-fuer-die-gruppe.html`

## Dateirollen im BNI-Ordner

- `gesundheitsrunde-beispiel-fuer-die-gruppe.html` = aktuelle Hauptdatei fuer die visuelle Gruppenpraesentation
- `gesundheitsrunde-konzept.md` = textliche Inhalts- und Denkgrundlage
- `gesundheitsrunde-konzept-slides.html` = aeltere / kompaktere Slide-Fassung, aktuell nicht fuehrend
- zusaetzliche Orientierung: `BNI-Claudius\00-dateirollen-und-hauptdatei.md`

## Aktuelle Gruppenlogik

Die Gruppenstruktur wurde bewusst verfeinert und nicht mehr nur grob als Gesundheitsrunde dargestellt.

Aktuelle fachliche Felder:

1. `Heilberufe`
2. `Versorgung / Alltag`
3. `Apotheke`
4. `Praevention / Training`
5. `Wellness / Coaching`
6. `Koordination / Plattform`

## Aktuelle Ebenenlogik

Zusatzlich zur Berufs-/Clusterlogik wurde eine zweite Ebene eingefuehrt:

1. `Struktur / Funktion`
2. `Versorgung / Alltag`
3. `Apotheke / Chemie / Stoffwechsel`
4. `Mental / emotionale Prozesse`
5. `Unterbewusstsein / Hypnose`
6. `Pathophysiologie`
7. `Regulation`
8. `TCM / Meridiane`
9. `Energetik / Heilarbeit mit den Haenden`
10. `Neuro-Sensorik`

## Wichtige Feindifferenzierung in Struktur / Funktion

Diese Trennung wurde fuer das BNI-Verstaendnis als wichtig festgelegt:

- `Peter Rauch` arbeitet strukturell **nur** ueber `biophysikalische Informationstherapie`
- `Michael Jaufmann` arbeitet strukturell klassisch ueber `Osteopathie`
- `Christian Lippert` = funktional-trainierend
- `Werner Thron` = funktional-trainierend, Muskelaufbau / Praevention, kein Heilpraktiker
- `Andreas Veh` = sensorisch-funktionell ueber Augenfunktion / Sehen
- `Martina Bolvary` = ausdauer- / kreislaufbezogen ueber Schwimmtraining, Herz-Lunge-Kreislauf und Routinen

## Wichtige Chapter-Abgrenzung

- Fuer strukturelle Themen ist im `BNI Claudius` nach aktueller Absprache `Michael Jaufmann` der vorrangig empfohlene Ansprechpartner
- Peter positioniert strukturelle Arbeit im Chapter nicht als primaere Vordergrundrolle
- Der manuelle / osteopathische Bereich bleibt im Chapter klar bei Michael

## Christina Herrmann

Oeffentlich sauber bestaetigt:

- `Hypnose`
- `systemische Beratung / Coaching`
- `Astropsychologie`

Fuer die HTML wurde Christina aktuell so gelesen:

- primaer `Unterbewusstsein / Hypnose`
- sekundaer `Mental / emotionale Prozesse`
- sekundaer `Astropsychologie / Beratung`

## Chong Liu

Bei Chong wurde zusaetzlich wichtig festgehalten:

- `Pflanzenheilkunde`

Apotheke wurde deshalb in der Hauptdatei getrennt von allgemeiner Versorgung dargestellt.

## Dilek / SuperPatch

Aktuelle vorsichtige Einordnung auf Basis der oeffentlich abrufbaren SuperPatch-Seiten:

- nicht-invasiver, medikamenten- und chemiefreier `Neurotech`- / Wearable-Ansatz
- primaer `Neuro-Sensorik`
- sekundaer `Regulation`

## Bilder

BNI-Profilbilder wurden lokal gesichert unter:

- `BNI-Claudius\bni-claudius-profilbilder`

Verfuegbare Bilder wurden bereits in die Haupt-HTML eingebunden.

## Lovable-Uebergabe der Haupt-HTML

- Die Datei `BNI-Claudius\gesundheitsrunde-beispiel-fuer-die-gruppe.html` ist die inhaltliche Hauptquelle, wird aber aus diesem Ordner nicht automatisch von Vite/Lovable deployed.
- Fuer die Lovable-Auslieferung liegt daher eine deploybare Spiegelung unter `public\bni-claudius\gesundheitsrunde-beispiel-fuer-die-gruppe.html`.
- Die zugehoerigen Bilder muessen parallel unter `public\bni-claudius\bni-claudius-profilbilder\` liegen, sonst fehlen die Profilfotos im Build.
- `scripts\sync-bni-static.mjs` spiegelt die Hauptdatei und den Bildordner automatisch vor `npm run dev`, `npm run build` und `npm run build:dev`.
- Der Produktionsbuild wurde lokal verifiziert: HTML und alle 13 referenzierten Profilbilder landen unter `dist\bni-claudius\`.
- Die Browserpruefung der gebauten Ausgabe war erfolgreich: HTTP 200, Reveal initialisiert, 44 Slides, 29 Bildverwendungen ohne defekte Datei und keine Browserfehler.
- Der lokale Stand ist erst in Lovable verfuegbar, nachdem die betreffenden Dateien auf GitHub `main` angekommen sind und Lovable diesen Stand synchronisiert hat.
- Verifizierter Stand vom 2026-07-11: `origin/main` enthaelt die BNI-Hauptdatei, die statische Spiegelung und `src/pages/BNIGesundheitsrunde.tsx` noch nicht.
- Erneute Pruefung nach einem Lovable-Live-Update: Die statische BNI-URL ist weiterhin nicht vorhanden (direkter Abruf 404, im Browser SPA-404-Seite). Auch `/bni-gesundheitsrunde` zeigt live die SPA-404-Seite.
- Ursache bleibt die fehlende GitHub-Uebergabe; das Live-Update kann lokale, noch nicht auf `origin/main` vorhandene Dateien nicht veroeffentlichen.

## Wichtige Arbeitsregel fuer die naechste Session

- Weiterarbeit ausschliesslich in `gesundheitsrunde-beispiel-fuer-die-gruppe.html`, solange der User keine weitere Datei oder Veroeffentlichung ausdruecklich nennt
- andere BNI-Dateien nur angleichen, wenn dies ausdruecklich gewuenscht wird
- die BNI-HTML-Arbeit niemals automatisch mit der Lovable-Anwendungsarbeit vermischen
