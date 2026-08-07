# Lovable GitHub Backup und Sync Erinnerung

## Wichtigster Praxisbefund

Lovable kann trotz korrekt verbundenem Repo und Branch auf einem alten Stand festhaengen.
Das wurde in diesem Projekt bereits konkret beobachtet.

## Repo- und Branch-Merkregel

1. Repo: `HubertMaierHubertMaier/naturheilpraxis-rauch`
2. Branch: `main`

## Uebergeordnetes Ziel

Das letztendliche Projektziel ist nicht nur funktionierender Code, sondern ein **synchroner und fehlerfreier Gesamtstand** zwischen:

1. lokalem Arbeitsstand
2. GitHub `main`
3. Lovable-Projektstand / Preview
4. oeffentlichem Lovable-Publish-Stand
5. allen fuer die Funktion relevanten Konfigurations-, Speicher- und Zugriffsstaenden

Ein Arbeitsblock gilt deshalb nicht als wirklich abgeschlossen, solange eine dieser Ebenen noch hinterherhaengt oder abweicht.

## Wenn Lovable einen neuen GitHub-Stand nicht zeigt

Immer in dieser Reihenfolge arbeiten:

1. In Lovable Repo und Branch pruefen
2. Nicht sofort `Disconnect` klicken
3. Auf GitHub pruefen, ob der erwartete Commit wirklich auf `main` liegt
4. In Lovable den Projektstand erneut pruefen
5. Wenn der Stand im Projekt angekommen ist, danach `Publish -> Update`

## Backup-Merkregeln

1. Vor riskanten Sync-Schritten zuerst sichern
2. Im Admin-`Backup-Center` die grosse Sicherung bevorzugen:
   - `1-Klick-Komplettsicherung`
   - oder `Voll-Backup` plus GitHub-Code-ZIP
3. Nicht nur auf ein kleines thematisches Teilbereich-Backup verlassen, wenn der komplette Bereich wichtig ist

## Was der Backup-Bereich leistet und was nicht

Der Backup-Bereich sichert viel, aber nicht buchstaeblich alles.

Nicht vollstaendig darin enthalten bzw. separat zu behandeln:

1. echte Secret-Werte
2. Patient-Passwoerter
3. 2FA-Neueinrichtung
4. Lovable-History
5. Lovable-Warteschlange
6. browserlokale Entwuerfe in `localStorage` oder `sessionStorage`

## SIBO-Sync-Verlauf als Merkhilfe

1. GitHub hatte den neuen Stand frueher als Lovable.
2. Lovable hing zwischenzeitlich auf `ddd5be6` fest.
3. Nach erneutem Sync war der Stand spaeter im Projekt angekommen.
4. Danach war trotzdem noch `Publish -> Update` fuer die oeffentliche App noetig.
5. Neuer verifizierter Befund vom 2026-07-11: Die oeffentliche SIBO-URL `https://naturheilpraxis-rauch.lovable.app/sibo-duenndarmfehlbesiedlung.html` zeigte weiterhin den aelteren Stand aus Commit `0381183` `Trigger Lovable sync for SIBO`.
6. `origin/main` stand gleichzeitig bereits auf `a444dbb` `Expand SIBO infothek content`.
7. Das bedeutet fuer diesen Fall: Das Problem lag nicht an `public/sibo-duenndarmfehlbesiedlung.html`, sondern am Lovable-/Publish-Stand relativ zu GitHub `main`.
