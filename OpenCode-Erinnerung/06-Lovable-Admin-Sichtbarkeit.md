# Lovable Admin Sichtbarkeit vor Publish

## Kernregel

Wenn der User eine neue oder geaenderte Infothek-HTML beauftragt, ist die Arbeit erst dann als angekommen zu betrachten, wenn sie im Lovable-Projekt selbst sichtbar ist.

Nicht ausreichend sind fuer dieses Projekt:

1. Datei nur lokal vorhanden
2. Datei nur auf GitHub `main`
3. Seite nur ueber oeffentlichen Publish-Link sichtbar

## Primaerer Abschlussnachweis

Der primaere Nachweis ist:

1. Lovable-Projektstand hat die Aenderung eingelesen
2. der Eintrag ist in der Lovable-Infothek/Admin-Oberflaeche sichtbar
3. die Zielseite laesst sich dort sinnvoll oeffnen

## Standard-Checkliste fuer neue HTMLs

1. `public/<slug>.html` existiert
2. `src/lib/infothekContent.ts` enthaelt den Eintrag
3. falls sinnvoll: `src/lib/backupAreas.ts` mitziehen
4. GitHub `main` pruefen
5. Lovable-Projektstand pruefen
6. Sichtbarkeit im Lovable-Infothek-Dropdown oder in der passenden Admin-Ansicht pruefen
7. erst danach optional `Publish -> Update`

## Verhalten bei Abweichung

Wenn der User sagt `es ist noch nicht da`, nicht mit `aber es ist auf GitHub` zufriedengeben.
Dann weiter pruefen:

1. hat Lovable den GitHub-Stand wirklich eingelesen?
2. ist die richtige Ebene gemeint: Lovable-Projektoberflaeche, nicht oeffentliche App?
3. fehlt der Eintrag in `infothekContent.ts`, in `backupAreas.ts` oder nur im Lovable-Sync?

## Projektbezogene Prioritaet

Fuer diesen User ist wichtig:

1. zuerst Sichtbarkeit im Lovable-Projekt
2. oeffentliche Sichtbarkeit erst spaeter, wenn gewuenscht

## Zusatzregel fuer effizientes Arbeiten

1. Nicht nach jeder kleinen Textaenderung im Lovable-UI herumklicken.
2. Erst einen sinnvollen inhaltlichen Block fertigstellen.
3. Dem User die relevanten HTML-Ausschnitte im Chat zeigen.
4. Dann genau einmal pruefen, ob der Stand im Lovable-Projekt angekommen ist.
5. Wenn nicht, als Sync-Thema behandeln und nicht als erneute HTML-Arbeit.
