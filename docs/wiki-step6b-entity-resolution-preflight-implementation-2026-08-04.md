# Wiki Schritt 6B: Releasegebundener Entity-Resolution-Preflight

Stand: 2026-08-04

Status: implementiert, vollstaendig lokal verifiziert und unabhaengig geprueft. Kein
Supabase-Deployment, keine produktive Suche, keine Sicherheitseinstufung, keine
Empfehlung und keine medizinische Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804100000_create_therapy_entity_resolution_preflight.sql`

erweitert die exakte Schritt-6A-Eingabe-/Release-Bindung um eine rein
deterministische Entitaetsaufloesung. Sie verarbeitet ausschliesslich die in 6A
ausgewaehlten terminalen `verified`- und `review_only`-Fakten und sucht nur in
den Entity-Projektionen genau desselben versiegelten, weiterhin inaktiven
Knowledge-Releases.

Der Block erzeugt drei reine Owner-Lesefunktionen. Er erstellt oder veraendert
keine Tabelle, schreibt keine Suchprojektion, vergibt keine Ausfuehrungsrechte
und ist mit keinem Anwendungs-, Service-, Import-, Therapie- oder sichtbaren
v1-Pfad verbunden.

Nicht Bestandteil von Schritt 6B sind:

- fachliche oder therapeutische Eignung
- Sicherheits-, Interaktions-, Kontraindikations- oder Red-Flag-Auswertung
- Kandidatenstatus `ALLOW`, `REVIEW_ONLY`, `EXCLUDE` oder `ESCALATE_ONLY`
- konventionelle oder homoeopathische Bewertungsspur
- Relevanz-, Evidenz-, Wirksamkeits- oder Gesamtscore
- Dosierung, Produktpraeferenz, KI, Persistenz oder Patientenausgabe

## Deterministisches Fakten-Suchmanifest

`therapy_retrieval_v2_entity_query_manifest_v1(uuid)` ruft zuerst den
vollstaendigen 6A-Eingabemanifestvalidator auf. Es akzeptiert hoechstens 64
ausgewaehlte Fakten und bildet je Fakt eine geordnete, deduplizierte Suchmenge
aus:

- `fact_label`
- begrenztem Textwert
- Anzeige und Code eines strukturierten Codewerts
- optional bereits gesetzter allgemeiner `kb_entity_id`

Die Texte werden ausschliesslich mit `kb_search_normalize_v1()` normalisiert:
Unicode-NFC, Rand-/Mehrfachleerzeichen und Kleinschreibung. Ein Suchterm darf
nach der Normalisierung hoechstens 1.024 UTF-8-Bytes besitzen. Uebergrosse
Textwerte werden nicht abgeschnitten oder still ausgelassen; das gesamte
Suchmanifest wird `NULL`, sodass der Hauptpreflight fail-closed mit
`ENTITY_RESOLUTION_QUERY_UNAVAILABLE` endet. Das komplette Manifest ist auf
1 MiB begrenzt.

Das Manifest bleibt als `pseudonymized_health_data` klassifiziert. Es enthaelt
keine Pseudonym-ID, keinen Eingabeumschlag und keine Quellenpayloads. Es enthaelt
jedoch die fuer die Suche notwendigen normalisierten klinischen Terme und ist
deshalb ausschliesslich owner-seitig zugaenglich. Je Fakt bindet ein eigener
SHA-256 Fakten-ID, Fakteninhaltshash, expliziten KB-Link sowie alle Namen- und
Kennungsterme. Der Gesamtmanifesthash bindet die vollstaendige Suchanfrage an
den exakten 6A-Eingabehash.

## Kennungssemantik

Strukturierte Codes verwenden unveraendert den im Faktenvertrag gespeicherten
Codewert. Eine stille Gross-/Kleinschreibungs- oder Formatnormalisierung findet
nicht statt.

Vertragsversion 1 bildet fuer `pzn`, `gtin`, `loinc`, `icd_10_gm`, `atc` und
`ncbi_taxonomy` sowohl den qualifizierten globalen Term

`identifier:[scheme, null, normalized_value]`

als auch den exakten unqualifizierten Term

`identifier_value:normalized_value`.

`program_code` ist nicht global eindeutig und besitzt im Patientenfakt keinen
Namespace. Deshalb wird dafuer nur der unqualifizierte exakte Term gebildet und
eine moegliche Mehrdeutigkeit als mehrere Treffer erhalten. `local_v1` wird
nicht still als externe Kennung interpretiert. Diese v1-Zuordnung ist im
Funktionsvertrag festgeschrieben und haengt nicht von spaeter umgeschalteten
lebenden Scheme-Zeilen ab.

## Vollstaendige Release-Projektion

`therapy_retrieval_v2_entity_projection_is_complete_v1(uuid)` verlangt:

- ein mit `kb_release_is_valid(id, true)` aktuell gueltiges versiegeltes Release
- weiterhin explizit `retrieval_eligible = false` und `is_active = false`
- mindestens ein exaktes `entity_revision`-Item
- fuer jedes Entity-Item genau die vorhandene, releaseeigene
  `kb_search_documents`-Zeile
- fuer jede dieser Zeilen den vollstaendigen
  `kb_search_document_is_valid()`-Nachweis

Bevor bereits der 6A-Bindungsvalidator laeuft, zaehlt der Hauptpreflight mit
einem indexgestuetzten und selbst begrenzten Scan hoechstens 4.097 Gesamtitems.
Ein uebergrosses oder leeres Release endet damit vor jeder Manifestvalidierung.
Die Projektionspruefung wiederholt diese Schranke und zaehlt erst danach
hoechstens 1.025 Entity-Items und 2.049 Relationsassertions. Jede Stufe bricht
vor der jeweils naechsten ab. Vertragsversion 1 akzeptiert nur:

- hoechstens 4.096 Release-Items insgesamt
- hoechstens 1.024 Entity-Items
- hoechstens 2.048 Relationsassertions

Damit bleiben auch breite Volltexttreffer und hochgradige Graphen fuer maximal
64 Fakten in einem explizit begrenzten Referenzraum. Groessere Releases werden
nicht teilweise verarbeitet, sondern bleiben fuer einen spaeteren
Grossmengenvertrag fail-closed.

Eine partielle Materialisierung ist fuer 6B nicht ausreichend. Eine einzige
fehlende oder manipulierte Entity-Projektion erzeugt
`ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE` und keine Teilergebnisse.

Ein bereits im Faktenvertrag gesetzter `kb_entity_id` ist staerker als eine
Textsuche. Fehlt diese Entitaet als exaktes Entity-Item im gebundenen Release,
wird sie nicht ignoriert oder durch einen Texttreffer ersetzt. Der Preflight
endet mit `ENTITY_RESOLUTION_EXPLICIT_LINK_UNAVAILABLE`.

## Direkte Aufloesungskanaele

`therapy_retrieval_v2_entity_resolution_preflight_v1(...)` ruft zuerst den
positiven inaktiven 6A-Bindungspreflight auf und vergleicht dessen Eingabehash
mit dem Query-Manifest. Danach werden die bereits in 4B-2a angelegten B-Tree-
und GIN-Indizes kanalweise verwendet. Es gibt kein Fakten-mal-Entity-
Kreuzprodukt.

Die feste Prioritaet lautet:

1. exakter `kb_entity_id`-Link
2. exakte qualifizierte globale Kennung
3. exakte unqualifizierte Kennung
4. exakter normalisierter Titel
5. exakter normalisierter Alias
6. exakter kanonischer Schluessel
7. deutscher Volltext mit `plainto_tsquery('pg_catalog.german', ...)`
8. sprachneutraler Volltext mit `plainto_tsquery('pg_catalog.simple', ...)`
9. kanonischer Schluessel und Entity-Revisions-ID als stabiler Tie-Break

Rohtext wird niemals an `to_tsquery` uebergeben. Jeder direkte Treffer nennt
seinen besten Kanal und alle ebenfalls passenden Kanaele. Es gibt bewusst
keinen Volltextscore und keine undurchsichtige Gesamtpunktzahl. Die Position ist
nur eine reproduzierbare Aufloesungsreihenfolge.

Pro Fakt sind standardmaessig acht und maximal 16 direkte Treffer erlaubt. Die
Zaehler vor und nach dem Limit bleiben getrennt sichtbar.

## Begrenzte Graphkante

Nur die limitierten direkten Treffer werden ueber genau eine im selben Release
versiegelte `entity_relation`-Assertion erweitert. Sowohl ausgehende als auch
eingehende Kanten sind zulaessig; die Richtung bleibt im Ergebnis sichtbar.
Der Nachbar muss selbst als exakte Entity-Revision im Release liegen und eine
gueltige Suchprojektion besitzen.

Jeder Graphnachweis bindet:

- direkte Quellentitaet und deren exakte Revision
- Assertion-, Release-Item- und Item-Manifesthash
- Relationstyp, Richtung, Assignment-Staerke und gespeicherten Relationsrang
- Nachbarentitaet, exakte Revision und Projektionshash

Der Relationsrang wird ausgegeben, aber nicht zur Sortierung oder
Eignungsbewertung verwendet. Die feste Ordnung besteht nur aus direkter
Trefferposition, Relationstyp, Assertion-ID, kanonischem Nachbarschluessel und
Nachbarrevision. Es gibt maximal einen Hop, standardmaessig 16 und hoechstens 32
Graphnachweise je Fakt.

Jeder Graphstatus lautet ausdruecklich
`GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION`.

## Ergebnisstatus und Grenzen

Der Hauptvertrag unterscheidet:

- `ENTITY_RESOLUTION_LIMIT_INVALID`
- `ENTITY_RESOLUTION_BINDING_UNAVAILABLE`
- `ENTITY_RESOLUTION_QUERY_UNAVAILABLE`
- `ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE`
- `ENTITY_RESOLUTION_EXPLICIT_LINK_UNAVAILABLE`
- `ENTITY_RESOLUTION_RESULT_LIMIT_EXCEEDED`
- `ENTITY_RESOLUTION_PREFLIGHT_COMPLETE_INACTIVE`

Auch `COMPLETE_INACTIVE` bedeutet nur, dass die Aufloesung unter den gebundenen
Regeln vollstaendig ausgefuehrt wurde; null Treffer sind ein gueltiges Ergebnis.
Jede Antwort traegt
`ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE`,
`medical_use_allowed = false` und `retrieval_execution_allowed = false`.

Der Ergebnisvertrag ist auf 8 MiB begrenzt. Bei Ueberschreitung werden keine
abgeschnittenen Kandidaten geliefert, sondern nur der kompakte
`RESULT_LIMIT_EXCEEDED`-Nachweis. Query-, Binding- und Resultathash sind
kanonisch und deterministisch. Auch der positive und der uebergrosse
Ergebnisvertrag nennen Eingaberevisions- und Release-ID sowie beide exakten
Manifesthashes, sodass der Bindungsnachweis ohne externen Kontext zugeordnet
werden kann.

## Rechte, Snapshot und Restore

Alle drei Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Runtime- oder Such-RPC.

Die Migration erzeugt keine Tabelle und veraendert keine vorhandene Tabelle.
Der Wiki-Snapshot bleibt byteidentisch bei 67 Tabellen; der Therapie-Eingabe-
Snapshot v2 bleibt byteidentisch bei vier Tabellen. Backup- und
Restore-Inventare aendern sich nicht.

## Fokussierte Verifikation

Der erweiterte Test

`src/test/therapy-retrieval-v2-preflight.test.ts`

verwendet ausschliesslich synthetische, nichtmedizinische Daten und prueft:

- reine Drei-Funktionen-Migration ohne Tabelle, DML oder Grant
- byteidentische Wiki- und Therapie-Eingabe-Snapshots
- exaktes Query-Manifest nur fuer die zwei in 6A ausgewaehlten Fakten
- qualifizierte und unqualifizierte ICD-Kennung
- exakten KB-Link, Titel, Alias sowie deutschen und einfachen Volltext
- stabile Kanalreihenfolge ohne Relevanz- oder Gesamtscore
- eingehende und ausgehende `may_support`-Kante mit genau einem Hop
- reine Matchstatus ohne Kandidatenstatus oder Empfehlung
- fail-closed Verhalten bei falschem Binding, unzulaessigem Limit,
  fehlendem explizitem Release-Link und fehlender Suchprojektion
- harte vorgezogene Release-, Entity- und Relationsmengengrenzen einschliesslich
  eines ausgefuehrten Gesamtitem-Ueberlaufs vor dem Binding
- deterministischen Query- und Resultathash
- entzogene Ausfuehrungsrechte aller Anwendungs- und Importrollen

Fokussierter Zwischenstand Schritt 6A und 6B: 1/1 Datei und 11/11 Tests.

## Abschlussreview und Gesamtverifikation

Die erste unabhaengige P0/P1-Pruefung beanstandete, dass die Releasegrenzen erst
nach dem 6A-Bindungsvalidator ausgewertet wurden und dass ein bereits erkannter
Gesamtitem-Ueberlauf die beiden selektiven Zaehler nicht sofort beendete. Der
Hauptpreflight besitzt deshalb jetzt einen eigenen, vorgezogenen 4.097-Zeilen-
Scan. Die Projektionspruefung bricht nach Gesamt-, Entity- und Relationsgrenze
jeweils unmittelbar ab. Ein transaktionaler Test fuegt 4.093 zusaetzliche
synthetische Items ein und weist bei insgesamt 4.097 Items
`ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE` vor dem Binding nach. Die erneute
unabhaengige Pruefung bestaetigte diese Ressourcenhaertung.

Der bestehende Produktionsscan des Suchprojektionsvertrags wurde um genau diese
neue owner-seitige Vertragsmigration erweitert. Direkte Zugriffe aus Funktionen
oder produktiven Therapiepfaden bleiben weiterhin verboten. Eine abschliessende
P0/P1-Pruefung beanstandete zunaechst eine zu breite Ausnahme fuer die neue
Migration. Die Ausnahme erlaubt nun ausdruecklich nur Lesezugriffe; Schreib-DML
und Tabellen-Grants bleiben im Produktionsscan verboten. Der 6B-Fokustest
verwirft zusaetzlich relevante DDL, jede Schreib-DML und jedes `GRANT`
unabhaengig von der Gross-/Kleinschreibung. Die abschliessende Gegenpruefung
lautet `APPROVE`.

Abschlussstand:

- fokussierter Schritt-6A-/6B-Test: 1/1 Datei, 11/11 Tests
- zusammenhaengende Eingabe-, Release- und Suchregression: 5/5 Dateien,
  75/75 Tests
- vollstaendiger Projektlauf in drei laufzeitbegrenzten Teilen: 50/50 Dateien,
  534/534 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der beiden geaenderten Testdateien ohne Fehler
- globaler Altbestandslint weiterhin unabhaengig von 6B mit 397 vorhandenen
  Fehlern und 40 Warnungen rot
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- Repository-Secret-Policy im Gesamtlauf erfolgreich
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- unabhaengige Abschlussreview ohne verbleibenden P0/P1-Befund

## Naechste Gates

Vor jeder medizinischen oder produktiven Nutzung bleiben mindestens offen:

1. direkte und graphbasierte Aufloesung mit realistischen Releasegroessen auf
   echtem PostgreSQL und den erwarteten GIN-/B-Tree-Plaenen profilieren
2. konventionelle/naturheilkundliche und homoeopathische Suchspur strikt
   getrennt aufbauen
3. Sicherheitsregeln vor jeder Kandidateneignung fail-closed anwenden
4. Evidenzdimensionen, Kandidatenstatus und stabile Comparatorversion getrennt
   persistieren
5. Audit, Schattenvergleich, Restore, Datenschutz, RLS und Fachabnahme
   abschliessen
6. Release v1 und den sichtbaren Therapiepfad weiterhin inaktiv lassen

Bis dahin ist Schritt 6B ausschliesslich ein owner-seitiger, synthetisch
gepruefter Entitaets-Match- und Provenienznachweis.
