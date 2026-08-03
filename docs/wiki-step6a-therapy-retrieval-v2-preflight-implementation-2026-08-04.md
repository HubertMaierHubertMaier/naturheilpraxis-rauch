# Wiki Schritt 6A: Retrieval-v2-Bindungspreflight

Stand: 2026-08-04

Status: implementiert und vollstaendig lokal verifiziert. Kein
Supabase-Deployment, kein Retrievallauf, keine Empfehlung und keine medizinische
Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804090000_create_therapy_retrieval_v2_preflight.sql`

implementiert ausschliesslich die ersten drei Voraussetzungen aus Schritt 6 der
Retrieval-Roadmap:

1. genau eine unveraenderliche Therapie-Eingaberevision binden
2. ausschliesslich terminale `verified`- oder `review_only`-Fakten auswaehlen
3. genau ein versiegeltes und vollstaendig validiertes Knowledge-Release binden

Der Block erzeugt vier reine Lesefunktionen. Er erstellt oder veraendert keine
Tabelle, schreibt keine Daten, vergibt keine Ausfuehrungsrechte und ist mit
keinem Anwendungs-, Service-, Import- oder sichtbaren Therapieweg verbunden.
Insbesondere fehlen Entitaetsaufloesung, Sicherheitsauswertung, Kandidaten,
Ranking, Dosierung, KI und Speicherung eines Retrievallaufs weiterhin.

## Exakte Eingabebindung

`therapy_retrieval_v2_input_manifest_v1(uuid)` liefert nur dann ein Manifest,
wenn die Eingaberevision samt Quellenhashkette gueltig ist, alle zugehoerigen
Fakten ihren vollstaendigen Step-3B-Validator bestehen und mindestens ein
terminaler Fakt den erlaubten Reviewstatus besitzt.

Das Manifest bindet:

- Revisions-ID, Eingabehash, Schema-, Hash- und Deidentifikationsversion
- Datenklasse und exakte Quellenzahl
- Auswahlpolicy v1 mit `terminal_facts_only = true`
- Gesamt-, Terminal-, Supersession-, Auswahl- und Ausschlusszaehler
- einen kanonischen `complete_fact_set_hash` ueber IDs, Ordnungen,
  Reviewstatus, Einzelhashes und Korrekturbeziehungen aller Fakten
- fuer jeden ausgewaehlten Fakt ID, Ordnung, Typ, Schluessel, Reviewstatus,
  Inhalts-SHA-256, Quellenzahl, optionale KB-Entitaet und Vorgaenger-ID

Der Revisionshash bindet den deidentifizierten Eingabeumschlag und seine
Quellen. Jeder Faktenhash bindet wiederum Wert, Negation, Status, Sicherheit,
Extraktions- und Reviewmetadaten sowie die exakten Quellenfundstellen. Der
zusaetzliche vollstaendige Faktensethash bewirkt, dass auch eine Veraenderung
oder Ergaenzung eines ausgeschlossenen beziehungsweise supersedierten Fakts den
Eingabehash aendert.

Das Manifest gibt bewusst weder `pseudonym_id`, Rohtext, `fact_value`, Labels,
Quellenpayloads noch Fundstellentexte aus. Die gebundenen Hashes erfassen diese
Inhalte weiterhin. Die Datenklasse bleibt daher ehrlich
`pseudonymized_health_data`.

## Faktenauswahl und Korrekturen

Eine Faktenzeile ist terminal, wenn keine spaetere Zeile sie ueber
`supersedes_fact_id` korrigiert. Nur terminale Fakten mit einem der beiden
Statuswerte werden ausgewaehlt:

- `verified`
- `review_only`

`unreviewed` und `rejected` bleiben sichtbar gezaehlt, aber werden nicht in die
Auswahlliste aufgenommen. Supersedierte Fakten werden ebenfalls nicht als
aktuelle Eingabe verwendet. Ein `review_only`-Fakt bleibt im Ergebnis
ausdruecklich als `requires_fact_review = true` erhalten und wird niemals still
zu einem verifizierten Fakt hochgestuft.

Auch ausgeschlossene Fakten muessen semantisch und kryptografisch gueltig sein.
Triggerumgehende Korruption in nur einer Faktenzeile macht deshalb den gesamten
Eingabepreflight unverfuegbar. Dasselbe gilt fuer eine verwaiste
Fakten-Quellenbindung, die keinem Fakt derselben Revision mehr zugeordnet ist.

## Knowledge-Release-Bindung

`therapy_retrieval_v2_preflight_v1(uuid, text, uuid, text)` akzeptiert eine
Eingaberevisions-ID mit vorab erwartetem Eingabemanifesthash sowie eine
Knowledge-Release-ID mit vorab erwartetem Release-Manifesthash.

Das Release muss `kb_release_is_valid(id, true)` bestehen. Damit ist es
versiegelt, transitiv vollstaendig, an freigegebene exakte Revisionen und
Quellen gebunden und kryptografisch konsistent. Release v1 bleibt dennoch hart
`retrieval_eligible = false` und `is_active = false`. Diese beiden Werte stehen
auch im Bindungsmanifest und werden bei jedem Preflight zusaetzlich zur
Release-Gesamtvalidierung explizit erneut verlangt.

Das kanonische Bindungsmanifest enthaelt nur die exakte Eingabe-ID und ihren
Manifesthash, Faktenpolicy und -zaehler sowie Release-ID, Release-Key,
Release-Manifesthash und Itemzahl. Sein eigener SHA-256 ist die stabile
Eingabe-/Release-Bindung fuer einen spaeteren, separat abgenommenen Schattenpfad.

## Ergebnisstatus und Hashes

Der Ergebnisvertrag unterscheidet fail-closed:

- `RETRIEVAL_V2_EXPECTATION_INVALID`
- `RETRIEVAL_V2_INPUT_UNAVAILABLE`
- `RETRIEVAL_V2_RELEASE_UNAVAILABLE`
- `RETRIEVAL_V2_BINDING_MISMATCH`
- `RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE`

`BOUND_INACTIVE` setzt gleichzeitig exakte Gleichheit beider erwarteten und
tatsaechlichen Hashes voraus. Dieser Status bedeutet nicht `READY`. Jedes
Ergebnis traegt die feste Interpretation
`PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE`,
`medical_use_allowed = false` und `retrieval_execution_allowed = false`.

Der `binding_hash` hasht die tatsaechliche Eingabe-/Release-Bindung. Der
`result_hash` hasht den gesamten Ergebnisvertrag ohne sich selbst und bindet
damit auch Erwartungen, Vergleichsbooleans, Reviewpflicht und Status.
Identische Eingaben liefern byte- und hashgleich dasselbe Ergebnis.

## Rechte und Datenhaltung

Alle vier Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Writer, keinen Runtime-Grant und
keine RLS-Erweiterung.

Die Migration erzeugt keine Tabelle und veraendert keine vorhandene Tabelle.
Der gemeinsame Wiki-Snapshot bleibt byteidentisch bei exakt 67 Tabellen. Der
Therapie-Eingabe-Snapshot v2 bleibt ebenfalls byteidentisch bei seinen vier
Tabellen.

## Fokussierte Verifikation

Der Test

`src/test/therapy-retrieval-v2-preflight.test.ts`

verwendet ausschliesslich synthetische, nichtmedizinische Daten und prueft:

- reine Vier-Funktionen-Migration ohne Tabelle, DML oder Grant
- byteidentische Wiki- und Therapie-Eingabe-Snapshots
- Auswahl von genau einem terminalen verifizierten und einem Review-only-Fakt
- Ausschluss des supersedierten, unreviewten und abgelehnten Fakts
- vollstaendigen Faktensethash ohne Rohwerte oder Pseudonym im Manifest
- deterministischen Eingabe-, Bindungs- und Resultathash
- getrennte Erwartungs-, Eingabe-, Release- und Hashabweichungsstatus
- fail-closed Verhalten bei triggerumgehender Fakten-, verwaister Quellenbindungs-
  und Release-Manipulation sowie bei constraintumgehender Release-Aktivierung
- entzogene Ausfuehrungsrechte fuer alle Anwendungs- und Importrollen

Fokussierter Zwischenstand: 1/1 Datei und 6/6 Tests bestanden.

## Abschlussreview und Verifikation

Die Datenintegritaetsreview fand zunaechst eine fehlende revisionsbezogene
Erkennung fuer eine triggerumgehend eingefuegte verwaiste
Fakten-Quellenbindung. Der Manifestvalidator und der Manipulationstest wurden
daraufhin erweitert. Die unabhaengige P0/P1-Gegenpruefung verlangte zusaetzlich,
dass die bereits durch `kb_release_is_valid(id, true)` erzwungene
Release-Inaktivitaet unmittelbar im 6A-Select sichtbar bleibt. Beide Flags
werden nun redundant explizit geprueft; ein Test entfernt transaktional die
beiden CHECK-Constraints, setzt beide Flags auf `true` und weist
`RETRIEVAL_V2_RELEASE_UNAVAILABLE` nach. Die abschliessende Gegenpruefung lautet
`APPROVE`.

Abschlussstand:

- fokussierter Schritt-6A-Test: 1/1 Datei, 6/6 Tests
- zusammenhaengende Eingabe-/Release-Regression: 4/4 Dateien, 61/61 Tests
- vollstaendiger Projektlauf: 50/50 Dateien, 529/529 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf des neuen Tests ohne Fehler
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- Repository-Secret-Policy im Gesamtlauf erfolgreich
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- unabhaengige Abschlussreview ohne verbleibenden P0/P1-Befund

## Nicht Bestandteil und naechste Gates

Schritt 6A erlaubt noch keinen Retrievallauf. Vor jeder medizinischen oder
produktiven Nutzung bleiben mindestens offen:

1. Release v2 mit exakter Bindung der klinischen Regeln, Suchprojektionen und
   gegebenenfalls Repertoriumsartefakte entwerfen
2. deterministische Entitaetsaufloesung gegen ausschliesslich versiegelte Items
   implementieren
3. konventionelle und homoeopathische Suchspur getrennt berechnen
4. Red-Flag-, Medikamenten-, Interaktions- und Kontraindikationsregeln vor jeder
   Kandidatenbildung fail-closed anwenden
5. Kandidatenstatus, mehrdimensionale Ordnung und stabile Tie-Breaks speichern
6. Audit-, Schattenvergleichs-, Restore-, Datenschutz-, RLS-, Performance- und
   Fachabnahme abschliessen
7. sichtbaren v1-Pfad bis zu einer ausdruecklichen Freigabe unveraendert lassen

Bis dahin ist `RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE` ausschliesslich ein
owner-seitiger Integritaets- und Bindungsnachweis.
