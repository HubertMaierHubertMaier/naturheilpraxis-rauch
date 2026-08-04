# Wiki Schritt 6F: Medizinisch inaktiver Dosierungsregel-Preflight

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Dosierungsdaten oder
Patientendaten und keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804140000_create_therapy_dosage_rule_preflight.sql`

setzt einen fail-closed Identitaets- und Anwendbarkeits-Preflight fuer bereits
freigegebene Dosierungsregeln auf das vollstaendig gebundene 6E-Ergebnis. Sie
erzeugt genau drei geschlossene Lesefunktionen:

1. `therapy_retrieval_v2_dosage_rule_scope_v1(uuid,jsonb)`
2. `therapy_retrieval_v2_dosage_rule_assessments_v1(uuid,uuid,jsonb,jsonb)`
3. `therapy_retrieval_v2_dosage_rule_preflight_v1(...)`

Die Migration erzeugt keine Tabelle, View, Policy, Rolle, Persistenz oder
Schreibfunktion. Auch der positive Status ist keine Dosierungsfreigabe:

- `medical_use_allowed = false`
- `productive_candidate_use_allowed = false`
- `dosage_evaluation_allowed = false`
- `dosage_display_allowed = false`
- `concrete_dosage_output_present = false`
- `ai_use_allowed = false`

`inactive_dosage_rule_bindings_ready = true` bedeutet nur, dass fuer jeden
bereits zulaessigen allgemeinen Kandidaten genau eine freigegebene Regelidentitaet
mit exakter Anwendbarkeitsbindung vorliegt. Der Vertrag gibt deren konkrete
Dosierung weder aus noch frei.

## Vollstaendige Hashkette und Vorrang

Der aeussere Vertrag berechnet Schritt 6E erneut und verlangt dessen exakten
erwarteten Resultathash. Damit bleiben in einer Kette gebunden:

- Therapie-Eingaberevision und Eingabemanifest
- Knowledge-Release und Release-Manifest
- Repertoriumsrevision und Fakt-Rubrik-Bindung
- 6C-Split-Track-Resultat
- 6D-Safety-Gate-Resultat
- 6E-Kandidatenstatus-Resultat
- 6F-Regelscope, Regelbewertungen und Gesamtergebnis

Red-Flag- und Medikamentensperren werden vor der 6E-Hasherwartung ausgewertet.
Ein veralteter Aufruferhash kann deshalb keine neue Sperre verbergen:

- `ESCALATE_ONLY` erzeugt `DOSAGE_RULE_ESCALATE_ONLY_INACTIVE`.
- globales `REVIEW_ONLY` erzeugt `DOSAGE_RULE_REVIEW_ONLY_INACTIVE`.
- Beide Ergebnisse enthalten weder Regelscope noch Regelbewertung.
- `EXCLUDE`- und `REVIEW_ONLY`-Kandidaten gelangen nie in den Dosierungsscope.

## Ausschliesslich exakte allgemeine ALLOW-Kandidaten

Der Scope akzeptiert nur Kandidaten, die in 6E gleichzeitig:

- in der allgemeinen beziehungsweise naturheilkundlichen Spur liegen,
- exakt den Status `ALLOW` besitzen,
- den Typ `preparation` oder `product_variant` besitzen,
- eine exakte Entity- und Revisionsbindung samt Inhalts-Hash tragen.

Ein fehlender, unbekannter oder anderer Entitaetstyp scheitert geschlossen. Er
wird nicht still aus der Kandidatenmenge entfernt. `EXCLUDE`, `REVIEW_ONLY`,
`ESCALATE_ONLY` und saemtliche homoeopathischen Kandidaten bleiben technisch
ausgeschlossen. Die homoeopathische Spur kann ohne exakte Zubereitungs-, Potenz-
und Subject-Safety-Bindung keine Dosierungsregel erhalten.

## Release-geschlossener Regelscope

Fuer jedes exakte `ALLOW`-Subject werden alle global `released`
Dosierungsregeln betrachtet. Jede davon muss:

- `kb_dosage_rule_is_valid(id) = true` erfuellen,
- eine freigegebene `dosage`-Assertion besitzen,
- mit ihrer Assertion als Item im exakt gebundenen Release liegen,
- das exakte Subject als Entity-Revisions-Item im selben Release besitzen,
- optionale Indikations- und Populationsrevisionen als exakte Release-Items
  besitzen,
- saemtliche gebundenen Quellenrevisionen als exakte Items desselben Releases
  besitzen.

Dadurch kann der Release keine freigegebene Regel eines bereits zulaessigen
Subjects still auslassen. Eine fehlende, triggerumgehend entfernte oder
semantisch ungueltige Regel macht den Scope unverfuegbar. Existiert fuer einen
Kandidaten ueberhaupt keine freigegebene Regel, bleibt der Scope formal leer und
die Kandidatenbewertung lautet `DOSAGE_RULE_MISSING_INACTIVE`.

Die Scope-Ausgabe enthaelt nur Regel-ID, Regelinhaltshash, Assertion-ID und
-Hash, exakte Subject-/Indikations-/Populationsidentitaeten sowie
Quellenrevisionsidentitaeten und -Hashes. Freie Quellenfundstellen werden nicht
ausgegeben, sondern nur als kanonischer `locator_hash` gebunden. So koennen
Dosierungsangaben auch nicht indirekt ueber eine freie Fundstelle austreten.

## Exakte Indikations- und Populationsbindung

Optionale Regelindikationen und -populationen werden nur gegen die bereits in
6A ausgewaehlten terminalen Fakten geprueft. Ein Fakt ist fuer 6F nur
anwendbarkeitsfaehig, wenn er gleichzeitig:

- nicht negiert ist,
- `clinical_status = current` besitzt,
- `certainty = confirmed` besitzt,
- `review_status = verified` besitzt,
- eine exakte `kb_entity_id` besitzt,
- weiterhin denselben gebundenen Fakteninhaltshash besitzt.

Die Regelrevision der Indikation beziehungsweise Population muss als exaktes
Item im Knowledge-Release liegen. Der stabile Entity-Verweis des Fakts wird
dadurch gegen genau diese Release-Revision interpretiert. Texttreffer,
unsichere, historische, unbekannte oder nur reviewpflichtige Fakten reichen fuer
eine Dosierungsregelbindung nicht aus.

Eine Regel ohne Indikationsbindung gilt indikationsseitig als allgemein. Eine
Regel ohne Populationsbindung gilt populationsseitig als allgemein. Sind beide
Bindungen vorhanden, muessen beide als AND-Bedingung exakt erfuellt sein.

## Eindeutigkeit statt Dosierungswahl

Pro bereits zulaessigem Kandidaten gilt:

- null freigegebene Regeln: `DOSAGE_RULE_MISSING_INACTIVE`
- Regeln vorhanden, aber keine exakt anwendbar:
  `DOSAGE_RULE_NOT_APPLICABLE_INACTIVE`
- genau eine exakt anwendbare Regel:
  `EXACT_DOSAGE_RULE_BINDING_READY_INACTIVE`
- mehr als eine exakt anwendbare Regel:
  `DOSAGE_RULE_AMBIGUOUS_REVIEW_ONLY_INACTIVE`

Nur der dritte Fall setzt `inactive_rule_binding_ready = true`. Mehrere passende
Regeln werden weder automatisch priorisiert noch zusammengefuehrt. Praeferenz,
Budget, Client, Pin oder KI duerfen keine Regel auswaehlen.

Auch bei genau einer Regel werden Dosisbereich, Einheit, Frequenz, Dauer, Timing
und Administrationsroute nicht gelesen, projiziert oder angezeigt. Der
Regelinhaltshash bindet diese unveraenderlichen 4B-1-Daten fuer eine spaetere,
separat abzunehmende Stufe, ohne sie in 6F offenzulegen.

## Ressourcengrenzen und Hashes

Vorgezogene begrenzte Scans erlauben hoechstens:

- 4.096 Dosierungsassertions insgesamt
- 4.096 Dosierungsregeln insgesamt
- 16.384 Quellenbindungen aller Dosierungsassertions
- 2.048 freigegebene Regeln fuer die aktuellen `ALLOW`-Kandidaten
- 8.192 Quellenbindungen dieser Kandidatenregeln

Die vorgelagerten Grenzen von 512 Safety-Subjects, 4.096 Release-Items und dem
8-MiB-6E-Ergebnis bleiben wirksam. Das 6F-Gesamtergebnis ist ebenfalls auf 8 MiB
begrenzt. Scope, Bewertungen und Gesamtergebnis besitzen getrennte kanonische
SHA-256-Hashes und vollstaendige stabile Reihenfolgen.

## Statuswerte

Der aeussere Vertrag kennt:

- `DOSAGE_RULE_ESCALATE_ONLY_INACTIVE`
- `DOSAGE_RULE_REVIEW_ONLY_INACTIVE`
- `DOSAGE_RULE_CANDIDATE_STATUS_UNAVAILABLE`
- `DOSAGE_RULE_EXPECTATION_INVALID`
- `DOSAGE_RULE_CANDIDATE_STATUS_MISMATCH`
- `DOSAGE_RULE_SCOPE_UNAVAILABLE`
- `DOSAGE_RULE_ASSESSMENTS_UNAVAILABLE`
- `DOSAGE_RULE_NO_ALLOW_CANDIDATES_INACTIVE`
- `DOSAGE_RULE_BINDINGS_READY_INACTIVE`
- `DOSAGE_RULE_PREFLIGHT_BLOCKED_INACTIVE`
- `DOSAGE_RULE_RESULT_LIMIT_EXCEEDED`

Keiner dieser Werte erlaubt eine konkrete Dosierungsanzeige oder medizinische
Nutzung.

## Rechte und unveraenderte Snapshots

Alle drei Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Runtime-RPC.

Wiki-Snapshot und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Backup- und Restore-Inventare aendern sich nicht.
Release v1 bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Synthetische Tests und Abschlussstand

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft fuer 6F:

- reine Drei-Funktionen-Migration ohne Tabellen-, View-, Policy- oder Rollen-DDL
- unveraenderte Wiki- und Therapie-Eingabe-Snapshots
- genau eine freigegebene, exakte Regelbindung fuer den allgemeinen
  `ALLOW`-Kandidaten
- vollstaendigen Ausschluss von `EXCLUDE` und homoeopathischen Kandidaten
- fehlende konkrete Dosis-, Frequenz-, Dauer-, Timing- und Routenausgabe
- gehashte statt frei ausgegebener Quellenfundstellen
- fail-closed Ablehnung fremder oder fehlender `ALLOW`-Entitaetstypen
- fehlende Regel und fehlende exakte Indikationsbindung
- Vorrang von Red-Flag-`ESCALATE_ONLY` und Medikamenten-`REVIEW_ONLY`
- exakte Kandidatenstatus-, Scope-, Bewertungs- und Gesamthashes
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Abschlussstand:

- fokussierter Schritt-6A-bis-6F-Vertrag in laufzeitbegrenzten Gruppen:
  40/40 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such- und
  Repertoriumsregression: 7/7 Dateien, 127/127 Tests
- vollstaendiger Projektlauf in laufzeitbegrenzten Gruppen: 50/50 Dateien,
  563/563 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf ohne Fehler
- Secret-Policy ohne Befund
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- unabhaengige P0/P1-Gegenpruefung nach Typ- und Fundstellenhaertung:
  `APPROVE`, hohe Sicherheit, keine verbleibenden Befunde

## Bewusste Restrisiken und naechste Gates

- PGlite besitzt nur eine Datenbanksession. Der reine Lesepfad hat keine neue
  Schreibkonkurrenz; reale Laufzeiten und Queryplaene fuer Hoechstgrenzen
  muessen trotzdem vor Deployment auf echtem PostgreSQL profiliert werden.
- Der Vertrag enthaelt nur synthetische Regeln. Vor jedem Deployment sind
  medizinische Fachreview, Quellenreview und realistische Negativfixtures
  erforderlich.
- Ein stabiler Entity-Verweis im Patientenfakt wird gegen die exakte Revision
  des gebundenen Releases interpretiert. Eine spaetere Capture- und
  Entity-Resolution-Abnahme muss diese Semantik fachlich bestaetigen.
- 6F trifft bewusst keine Auswahl zwischen mehreren anwendbaren Regeln und
  wertet keine konkrete Dosierung aus. Ein spaeterer Vertrag benoetigt dafuer
  eigene Comparatorversion, Audit-, Anzeige- und Safety-Abnahme.
- Persistenz, Replay-Audit, Schattenvergleich, Datenschutz-, RLS-, Restore- und
  Aktivierungsabnahme bleiben offen.

Bis dahin ist Schritt 6F ausschliesslich ein owner-seitiger, synthetisch
gepruefter Regelidentitaets- und Anwendbarkeitsnachweis ohne Dosierungsanzeige
oder medizinische Nutzung.
