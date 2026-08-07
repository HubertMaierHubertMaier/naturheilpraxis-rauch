# OpenCode Erinnerung - Start Hier

## Zweck

Diese Dateien sind die feste Projekt-Erinnerung fuer neue Sessions.
Sie sollen verhindern, dass bereits geklaerte Arbeitsregeln, Sync-Probleme und Einbindungsdetails erneut verloren gehen.
Sie sind die dauerhafte Sammelstelle ueber mehrere Tage hinweg und nicht nur eine Tagesnotiz.

## Zwei Arbeitsbereiche strikt trennen

Bislang gibt es im Groben nur diese zwei Arbeitsbereiche:

1. `Lovable` = Arbeit an der eigentlichen Anwendung `naturheilpraxis-rauch`, insbesondere React, Supabase, Patienten-/Adminfunktionen, GitHub-Sync und Lovable-Deployment.
2. `BNI-Claudius HTML` = einfache direkte Erweiterung genau dieser einzelnen Datei:
   `C:\Users\Administrator\Documents\Lovable\OpenCode\naturheilpraxis-rauch\BNI-Claudius\gesundheitsrunde-beispiel-fuer-die-gruppe.html`

Wenn der User `BNI`, `BNI-Claudius`, `Claudius HTML` oder `am HTML weiterarbeiten` sagt, gilt standardmaessig ausschliesslich Arbeitsbereich 2. Dann:

1. nur die genannte HTML-Hauptdatei lesen und bearbeiten
2. nicht mit der Lovable-App oder der Patienten-/Adminarbeit vermischen
3. nicht auf `src/pages/BNIGesundheitsrunde.tsx` ausweichen
4. nicht ungefragt die Spiegelung unter `public/bni-claudius/`, React-Dateien, GitHub, Lovable oder Deployments bearbeiten
5. keine breite Datei- oder Rechnersuche starten

Andere Dateien oder eine Veroeffentlichung werden erst einbezogen, wenn der User das ausdruecklich verlangt.

## Pflicht vor neuer Arbeit

Bei jeder neuen Session zuerst lesen:

1. diese Datei
2. `OpenCode-Erinnerung/01-Infothek-HTML-Workflow.md`, wenn eine Infothek-HTML, gated Inhalte oder statische `public/*.html` betroffen sind
3. `OpenCode-Erinnerung/02-Lovable-GitHub-Backup-und-Sync.md`, wenn GitHub, Lovable, Publish, Backup oder Sync betroffen sind
4. `OpenCode-Erinnerung/03-Bisherige-Quellen.md`, wenn der Ursprung einer Regel oder eines Befunds nachvollzogen werden muss
5. `OpenCode-Erinnerung/04-Backup-Center-Grenzen.md`, wenn gesichert, wiederhergestellt oder migriert werden soll
6. `OpenCode-Erinnerung/05-SIBO-Infothek-und-Kirkamm.md`, wenn an SIBO, Infothek-Sichtbarkeit oder Kirkamm-Inhalten weitergearbeitet wird
7. `OpenCode-Erinnerung/06-Lovable-Admin-Sichtbarkeit.md`, wenn eine HTML in der Lovable-Infothek sichtbar werden soll
8. `OpenCode-Erinnerung/07-BNI-Claudius.md`, wenn an der BNI-HTML im Ordner `BNI-Claudius/` weitergearbeitet wird; dabei die strikte Trennung der beiden Arbeitsbereiche beachten
9. `OpenCode-Erinnerung/09-Anamnese-PDF-Paket.md`, wenn der geschuetzte Anamnese-/Erstanmeldungs-PDF-Download betroffen ist
10. `OpenCode-Erinnerung/10-Wiki-Datenstruktur.md`, wenn die interne Wiki, Mittel, Hersteller, Beschwerden, Pathogene, Laborwerte oder Therapiezuordnungen betroffen sind

## Aktueller Kernstand

1. Das echte aktuell verwendete GitHub-Repo fuer dieses Projekt ist `HubertMaierHubertMaier/naturheilpraxis-rauch`.
2. `README.md` nennt noch `reddy67/naturheilpraxis-rauch` und ist damit in diesem Punkt veraltet.
3. Lovable kann auf einem alten Stand haengen bleiben, obwohl GitHub `main` bereits weiter ist.
4. Vor `Disconnect` immer stoppen. Erst Repo, Branch, Sync und Publish sauber pruefen.
5. Das lokal getestete additive Wiki-Phase-1-Kernschema ist seit 28.07.2026 mit Commit `e46effb` auf GitHub gesichert.
6. GitHub `main` steht aktuell auf `592513a` mit dem direkten sicheren Labor-PDF-Import und lokaler Browser-OCR.
7. Die Phase-1-Migration wurde noch nicht auf Supabase oder Lovable ausgerollt. Die Live-Wiki bleibt unveraendert.
8. Im Reiter `Labor` kann eine vollstaendige PDF direkt lokal ausgelesen und anonymisiert in `laborKomplett` uebernommen werden. Vorhandene OCR-Textebenen werden bevorzugt; nur textarme Rasterseiten werden lokal im Browser nacherkannt. PDF- und Bilddaten gehen nicht an einen OCR-Cloud-Dienst.
9. Eine einzelne Logo-, Leer- oder textarme Bildseite darf eine ansonsten lesbare PDF nicht mehr blockieren. OCR-, Render- und Initialisierungsfehler besitzen Timeouts und werden pro Seite behandelt.

## Bisher besonders wichtige Erkenntnisse

1. Neue Infothek-HTMLs brauchen nicht nur die Datei in `public/`, sondern auch den Eintrag in `src/lib/infothekContent.ts`.
2. Wenn die HTML auch in thematischen Admin-/Backup-Teilbereichslisten auftauchen soll, muss zusaetzlich `src/lib/backupAreas.ts` ergaenzt werden.
3. Beim SIBO-Block war genau diese dritte Stelle anfangs die zusaetzliche Stolperfalle.
4. Die SIBO-Seite ist fachlich eingebunden und der sichtbare Infothek-Eintrag wurde spaeter bestaetigt.

## Arbeitsregel fuer neue statische Inhalte

Standard fuer neue Infothek-Inhalte, sofern nichts anderes verlangt wird:

1. `external: true`
2. `gated: true`

## Speicher- und Datenschutzregel

1. Technische Projektentwicklung fuer Lovable, Datenbankstrukturen, Sicherheitskonzepte, allgemeine Arbeitsablaeufe und fuer die Zusammenarbeit notwendige Projektdokumentation duerfen nach Pruefung im Projekt-Repository und auf GitHub gesichert werden.
2. Persoenliche Angaben ueber den Projektinhaber, seine Biografie und seine konkrete therapeutische Arbeitsweise bleiben ausschliesslich lokal, sofern fuer einen klar benannten Inhalt nicht ausdruecklich eine andere Freigabe erteilt wurde.
3. Dateien mit gemischtem technischem und persoenlichem Inhalt muessen vor einem GitHub-Upload getrennt oder bereinigt werden.
4. Patientendaten, Zugangsdaten, Tokens, private Schluessel und sonstige Geheimnisse duerfen niemals in Git oder auf GitHub gespeichert werden.
5. Bei jedem Commit nur die geprueften, zum Auftrag gehoerenden Dateien aufnehmen; keine pauschale Uebernahme eines verschmutzten Arbeitsstands.

## Praktische Merksaetze

1. Erst kleine lokale Aenderung, dann pruefen, dann GitHub/Lovable.
2. Kein blindes `Disconnect` bei Lovable-GitHub-Problemen.
3. Bei Sync-Stoerungen erst GitHub `main`, dann Lovable-Projektstand, dann `Publish -> Update` pruefen.
4. Bei HTML-Arbeit zuerst die geaenderten HTML-Bloecke im Chat zeigen, damit der User inhaltlich gegenpruefen kann.
5. Lovable-Sync nur gesammelt nach einem sinnvollen Arbeitsblock pruefen, nicht nach jeder Mini-Aenderung.

## Fortschreibungsregel

1. Neue belastbare Erkenntnisse nach einer Session nicht nur in `session_historie/` oder einer Uebergabenotiz lassen.
2. Dauerhaft nuetzliche Regeln immer zusaetzlich in `OpenCode-Erinnerung/` uebernehmen.
3. `session_historie/` bleibt Tages- und Ablaufdoku; `OpenCode-Erinnerung/` bleibt die verdichtete Projekt-Erinnerung.

## Aktueller Stopppunkt

1. Wiki Phase 0 ist abgeschlossen: vollstaendiger lokaler Export, Inventur und isolierter Restore mit exaktem Vergleich aller 21 Wiki-Felder.
2. Wiki Phase 1 ist technisch implementiert, mit 239/239 Tests sowie Build geprueft und unabhaengig ohne offene P0-/P1-Befunde abgenommen.
3. GitHub `main` steht auf `592513a` `Fix local OCR for laboratory PDFs`; der direkte Labor-Upload steht in `56aeb8f`, das Wiki-Kernschema in `e46effb`.
4. Supabase-TypeScript-Typen, Remote-Migration, Backup-Edge-Function und Lovable wurden bewusst noch nicht ausgerollt.
5. Naechster Schritt nur mit gesonderter Freigabe: Backup erneut bestaetigen, SQL-Migration remote ausfuehren und pruefen, Typen regenerieren, erst danach Backup-Function ausrollen und Restore abnehmen.
