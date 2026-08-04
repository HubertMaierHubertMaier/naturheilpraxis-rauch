# Wiki Schritt 6C: Medizinisch inaktiver Split-Track-Preflight

Stand: 2026-08-04

Status: implementiert, fokussiert lokal verifiziert und unabhaengig geprueft.
Kein Supabase-Deployment, keine Kandidateneignung, keine Sicherheitsfreigabe,
keine Wirksamkeitsaussage, keine Empfehlung und keine medizinische Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804110000_create_therapy_split_track_preflight.sql`

setzt Roadmap-Schritt 6 Nummer 5 als reinen Owner-Preflight um. Sie trennt:

- allgemeine beziehungsweise naturheilkundliche Entity- und Graphreferenzen
- source-native homoeopathische Treffer aus genau einem Repertorium

Die Migration erzeugt drei Lesefunktionen und keine Tabelle. Sie schreibt keine
Projektion, vergibt keine Ausfuehrungsrechte und ist mit keinem Anwendungs-,
Service-, Import-, Therapie- oder sichtbaren v1-Pfad verbunden.

Der Block entscheidet ausdruecklich noch nicht:

- klinische oder fachliche Eignung
- Sicherheit, Red Flags, Interaktionen oder Kontraindikationen
- Kandidatenstatus `ALLOW`, `REVIEW_ONLY`, `EXCLUDE` oder `ESCALATE_ONLY`
- Evidenzqualitaet, Wirksamkeit, Dosierung, Potenz oder Produktpraeferenz
- repertoriumsuebergreifende Gewichtung oder eine gemeinsame Gesamtpunktzahl
- KI-Formulierung, Persistenz, Schattenbetrieb oder Patientenausgabe

## Releasegebundene Referenzklassifikation

`therapy_retrieval_v2_reference_track_v1(uuid,uuid,uuid)` akzeptiert nur eine
exakte Entity-Revision, die als `entity_revision`-Item im gebundenen
Knowledge-Release liegt. Das Ergebnis ist genau einer der Werte:

- `GENERAL_OR_NATUROPATHIC_REFERENCE`
- `HOMEOPATHIC_REFERENCE`
- `UNRESOLVED_REFERENCE`

`homeopathic_repertory` und `homeopathic_remedy` sind immer homoeopathisch.
Eine `preparation` ist nur dann homoeopathisch, wenn ihre exakte
`kb_preparation_revision_details`-Zeile einen der Typen `homeopathic_single`,
`homeopathic_complex`, `nosode`, `sarcode` oder `isode` traegt. Eine
`product_variant` erbt die Spur ausschliesslich von ihrer exakt gebundenen
Zubereitungsrevision.

Eine Produktfamilie ohne exakte Variante bleibt `UNRESOLVED_REFERENCE` und wird
nicht still einer Spur zugeordnet. Alle Klassifikationen sind reine
Referenzklassifikationen, niemals Kandidateneignung.

## Fakt-zu-Rubrik-Provenienz

`therapy_retrieval_v2_homeopathic_request_manifest_v1(...)` akzeptiert 1 bis
256 eindeutige Rubrikbindungen. Jede Bindung besitzt exakt:

- `therapy_input_fact_id`
- `rubric_revision_id`
- `importance` von 1 bis 5
- `polarity` mit `include` oder `exclude`

Die Patientenfakt-ID muss im exakten 6B-Querymanifest liegen und damit eine
terminale `verified`- oder `review_only`-Zeile des gebundenen 6A-Eingabestands
sein. Eine unreviewte, abgelehnte, supersedierte, fremde oder unbekannte
Faktenzeile laesst das gesamte Manifest fail-closed scheitern.

Das Manifest bindet pro Zuordnung:

- Fakten-ID, Fakteninhaltshash, Faktenqueryhash und Reviewstatus
- exakte Rubrik- und Rubrikrevisions-ID
- Rubrikinhaltshash, Wichtigkeit und Polaritaet
- das vollstaendige kanonische Step-5B-1-Repertoriumsanfragemanifest
- dessen separaten Anfragehash

Die Eingabereihenfolge ist unerheblich. Eindeutige Rubrikrevisionen werden
kanonisch sortiert; eine Permutation erzeugt bytegleiches JSON und denselben
SHA-256. Das Manifest bleibt `pseudonymized_health_data`, enthaelt aber weder
Pseudonym-ID noch Eingabeumschlag oder Quellenpayload.

## Vorgezogene Repertoriumsgrenzen

Der Hauptpreflight ruft zuerst den positiven, weiterhin inaktiven 6B-
Entity-Resolution-Vertrag auf. Danach prueft er vor dem Fakt-Rubrik-Manifest,
dem vollstaendigen Step-5A-Validator und dem Step-5B-1-Reader stufenweise:

- hoechstens 256 Rubrikrevisionen mit `LIMIT 257`
- hoechstens 64 Graddefinitionen mit `LIMIT 65`
- hoechstens 256 Repertoriumsmittel mit `LIMIT 257`
- hoechstens 2.048 Zuordnungen mit `LIMIT 2049`

Jede Stufe bricht vor der naechsten ab. Leere oder groessere Bereiche liefern
`SPLIT_TRACK_HOMEOPATHIC_SCOPE_UNAVAILABLE`; es gibt keine Teilverarbeitung.
Damit erbt der Preflight bewusst die kleine, bereits gepruefte Step-5B-5-
Referenzgroesse. Ein spaeterer Grossmengenvertrag benoetigt echte PostgreSQL-
Profilierung und eine eigene Freigabe.

## Exakte Releasebindung der homoeopathischen Spur

Vor dem Reader muessen im selben Knowledge-Release liegen:

- die exakte Repertoriums-Entity-Revision
- die exakte Quellenrevision des Repertoriums
- jede im Repertorium gebundene Mittel-Entity-Revision

Danach muss `kb_homeopathic_repertory_lane_status_v1()` exakt
`HOMEOPATHIC_LANE_READY` liefern. Damit bleiben der vollstaendige Step-5A-
Integritaetsnachweis, freigegebene beziehungsweise lizenzierte Quellenrechte und
mindestens eine gueltige Rubrik-Mittel-Grad-Zuordnung erforderlich.

Der vom Reader gemeldete Anfragehash muss dem im 6C-Manifest gebundenen
Repertoriumsanfragehash entsprechen. Jeder zurueckgegebene Treffer wird nochmals
als releasegebundene `HOMEOPATHIC_REFERENCE` klassifiziert.

## Strikt getrennte Ausgabespuren

Die allgemeine Spur uebernimmt aus 6B nur Referenzen mit
`GENERAL_OR_NATUROPATHIC_REFERENCE`. Direkte Referenzen tragen
`GENERAL_REFERENCE_MATCH_ONLY_NOT_ELIGIBILITY`, Graphreferenzen
`GENERAL_GRAPH_MATCH_ONLY_NOT_ELIGIBILITY`.

Bei einer Graphkante werden Quelle und Ziel getrennt klassifiziert. Nur wenn
beide allgemein beziehungsweise naturheilkundlich sind, darf der Pfad in die
allgemeine Spur. Eine homoeopathische Quelle zu einem allgemeinen Ziel wird
genauso vollstaendig ausgeschlossen wie ein allgemeiner Ursprung zu einem
homoeopathischen Ziel. Dadurch kann keine homoeopathische Provenienz ueber ein
allgemein aussehendes Nachbarziel in die andere Spur gelangen.

Die homoeopathische Spur entsteht ausschliesslich aus
`kb_homeopathic_repertorize_single_v1()`. Ihre Treffer behalten
`REPERTORY_MATCH_ONLY` und die getrennten source-nativen Abdeckungs-, Konflikt-
und Gradprofile. Null Treffer bleiben als
`HOMEOPATHIC_NO_REPERTORY_MATCHES_INACTIVE` sichtbar und werden nicht erfunden
oder durch allgemeine Treffer ersetzt.

Beide Teilvertraege besitzen eigene Hashes. Der Gesamtvertrag bindet beide an:

- exakten Eingabe- und Releasehash
- 6A-Bindinghash
- 6B-Entity-Resolution-Resultathash
- 6C-Fakt-Rubrik-Manifesthash

`cross_track_candidate_reuse_allowed` ist fest `false`. Unaufgeloeste
Produktfamilien bleiben ausgeschlossen.

## Status und Inaktivitaet

Der Hauptvertrag unterscheidet:

- `SPLIT_TRACK_EXPECTATION_INVALID`
- `SPLIT_TRACK_ENTITY_RESOLUTION_UNAVAILABLE`
- `SPLIT_TRACK_HOMEOPATHIC_REQUEST_UNAVAILABLE`
- `SPLIT_TRACK_HOMEOPATHIC_REQUEST_MISMATCH`
- `SPLIT_TRACK_HOMEOPATHIC_SCOPE_UNAVAILABLE`
- `SPLIT_TRACK_HOMEOPATHIC_READER_UNAVAILABLE`
- `SPLIT_TRACK_RESULT_LIMIT_EXCEEDED`
- `SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE`

Jede Antwort traegt
`SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE`,
`medical_use_allowed = false` und `retrieval_execution_allowed = false`. Der
positive Vertrag setzt ausserdem `candidate_status_assignment_allowed = false`.
Das Gesamtergebnis ist auf 8 MiB begrenzt.

## Rechte, Snapshot und Test

Alle drei Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Runtime-RPC.

Wiki-Snapshot und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Backup- und Restore-Inventare aendern sich nicht.

Der synthetische PGlite-Test

`src/test/therapy-retrieval-v2-preflight.test.ts`

prueft unter anderem:

- reine Drei-Funktionen-Migration ohne Tabelle, DDL, DML oder Grant
- exakte allgemeine, homoeopathische und unaufgeloeste Klassifikation
- kanonische Fakt-Rubrik-Bindung nur fuer ausgewaehlte Fakten
- exakte Releasebindung von Repertorium, Quelle und allen Mitteln
- getrennte allgemeine Entity-/Graphreferenzen und Repertoriumstreffer
- Ausschluss einer homoeopathischen Quellkante mit allgemeinem Ziel
- leere homoeopathische Spur ohne erfundene Treffer
- fail-closed Verhalten bei Hashdrift, unreviewtem Fakt, ungueltigem Limit und
  releasefremdem Mittel
- reproduzierbare Anfrage-, Teilspur- und Gesamtresultathashes
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Fokussierter Zwischenstand Schritt 6A bis 6C: 1/1 Datei und 16/16 Tests.

Die unabhaengige P0/P1-Pruefung fand zunaechst eine moegliche Graphleckage: Eine
homoeopathische Quelle mit allgemeinem Ziel haette bei reiner Zielklassifikation
in die allgemeine Spur gelangen koennen. Nun muessen beide Kantenenden allgemein
sein. Der neue synthetische Gegenbeweis bleibt vollstaendig ausgeschlossen; die
erneute Gegenpruefung lautet `APPROVE`.

Der bestehende Repertoriums-Isolationsscan kennt 6C nur als explizite
Read-only-Vertragsmigration. Direkte Schreib-DML und Tabellen-Grants auf eine
Repertoriumstabelle bleiben fuer sie verboten. Die abschliessende Review der
Kombination aus Migration, Fokustest, Isolationsscan und Dokumentation lautet
ebenfalls `APPROVE`.

Abschlussstand:

- fokussierter Schritt-6A-bis-6C-Test: 1/1 Datei, 16/16 Tests
- zusammenhaengende Eingabe-, Release-, Such- und Repertoriumsregression:
  7/7 Dateien, 96/96 Tests
- vollstaendiger Projektlauf in drei laufzeitbegrenzten Teilen: 50/50 Dateien,
  539/539 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der beiden geaenderten Testdateien ohne Fehler
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- Repository-Secret-Policy im Gesamtlauf erfolgreich
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- unabhaengige Abschlussreview ohne verbleibenden P0/P1-Befund

## Naechste Gates

Vor jeder Kandidateneignung oder medizinischen Nutzung bleiben mindestens offen:

1. Red-Flag-, Medikamenten-, Interaktions- und Kontraindikationsregeln vor jeder
   Kandidatenbildung fail-closed anwenden
2. Kandidatenstatus und getrennte Bewertungsdimensionen versioniert festlegen
3. exakte Zubereitung, Potenz und Produktvariante vor jeder Dosierung verlangen
4. realistische Release- und Repertoriumsgroessen auf echtem PostgreSQL
   profilieren
5. Audit, Persistenz, Schattenvergleich, Restore, Datenschutz, RLS und
   Fachabnahme abschliessen
6. Release v1 und den sichtbaren Therapiepfad weiterhin inaktiv lassen

Bis dahin ist Schritt 6C ausschliesslich ein owner-seitiger, synthetisch
gepruefter Trennungs-, Provenienz- und Integritaetsnachweis.
