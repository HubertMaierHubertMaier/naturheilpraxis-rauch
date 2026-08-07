# Infothek-HTML Workflow Erinnerung

## Wenn der User eine neue Infothek-HTML will

Die Einbindung ist erst vollstaendig, wenn alle betroffenen Ebenen geprueft sind.

## Minimaler Standardablauf

1. Neue HTML-Datei in `public/` anlegen, z. B. `public/thema-name.html`
2. Eintrag in `src/lib/infothekContent.ts` anlegen
3. Sichtbare Felder dort sauber setzen:
   - `label`
   - `href`
   - `description`
   - `external`
   - `gated`

## Wichtige Zusatzpruefung

Wenn die HTML auch im Admin-/Backup-Bereich thematisch sauber mitlaufen soll:

1. `src/lib/backupAreas.ts` pruefen
2. bei passendem Bereich den Dateinamen in `publicAssets` ergaenzen

## SIBO-Beispiel

Beim SIBO-Block waren betroffen:

1. `public/sibo-duenndarmfehlbesiedlung.html`
2. `src/lib/infothekContent.ts`
3. `src/lib/backupAreas.ts`

## Sichtbarkeitsdetail

1. Ein Infothek-Eintrag kann in der Admin-/Dropdown-Ansicht vorhanden sein und trotzdem fuer Besucher durch `gated: true` nur nach Login sichtbar sein.
2. Deshalb immer unterscheiden zwischen:
   - Datei existiert
   - Eintrag existiert
   - gated Verhalten stimmt
   - Seite oeffnet korrekt

## Abschlusspruefung

Nach einer neuen HTML immer moeglichst pruefen:

1. `npm run build`
2. GitHub-Stand enthaelt Datei und `src/lib/infothekContent.ts`-Eintrag
3. Lovable-Projektstand hat die Datei wirklich eingelesen
4. sichtbarer Eintrag in der Lovable-Infothek/Admin-Ansicht
5. Zielseite oeffnet im Lovable-Projekt
6. erst danach optional `Publish -> Update`, wenn der User die oeffentliche Sichtbarkeit will

## Wichtige Akzeptanzregel

Fuer dieses Projekt gilt:

1. `lokal vorhanden` reicht nicht
2. `auf GitHub main` reicht nicht
3. `oeffentlich published` ist nicht der primaere Nachweis
4. primaerer Nachweis ist: der User sieht den Eintrag im Lovable-Projekt in der Infothek/Admin-Oberflaeche

## Arbeitsmodus fuer HTML-Inhalte

Bei neuen oder groesser ueberarbeiteten HTMLs gilt zusaetzlich:

1. geaenderte HTML-Bloecke zuerst im Chat zeigen
2. User kann Inhalt, Ton, rechtliche Vorsicht und Verstaendlichkeit gegenpruefen
3. erst nach dieser inhaltlichen Abnahme gesammelt nach GitHub/Lovable bringen
4. wenn Lovable hakt, das nicht als inhaltliches HTML-Problem missverstehen
