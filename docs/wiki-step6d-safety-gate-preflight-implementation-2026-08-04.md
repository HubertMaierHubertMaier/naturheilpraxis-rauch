# Wiki Schritt 6D: Medizinisch inaktiver Safety-Gate-Preflight

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Regeln oder Patientendaten und
keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804120000_create_therapy_safety_gate_preflight.sql`

setzt den ersten fail-closed Safety-Gate-Vertrag vor einer spaeteren
Kandidatenbildung um. Sie erzeugt genau drei geschlossene Lesefunktionen:

1. `therapy_retrieval_v2_safety_input_manifest_v1(uuid)`
2. `therapy_retrieval_v2_safety_rule_assessments_v1(uuid,uuid)`
3. `therapy_retrieval_v2_safety_gate_preflight_v1(...)`

Die Migration erzeugt keine Tabelle, View, Policy, Rolle, Persistenz oder
Schreibfunktion. Sie fuehrt kein Retrieval v2 produktiv aus und vergibt weder
Kandidateneignung noch Dosierung, Empfehlung oder medizinische Freigabe.

Auch der positive Status bleibt ausdruecklich inaktiv:

- `medical_use_allowed = false`
- `retrieval_execution_allowed = false`
- `candidate_formation_allowed = false`
- `candidate_status_assignment_allowed = false`

`inactive_candidate_preflight_ready = true` bedeutet nur, dass ein spaeterer,
ebenfalls inaktiver Kandidatenvertrag den gebundenen Safety-Hash als
Vorbedingung verwenden darf. Es bedeutet niemals `ALLOW`.

## Bindung an Schritt 6C

Der Safety-Gate-Preflight berechnet den vollstaendigen 6C-Split-Track erneut und
akzeptiert ausschliesslich
`SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE`. Der Aufrufer muss zusaetzlich den
vorher erwarteten 6C-Resultathash uebergeben. Dadurch sind Eingaberevision,
Knowledge-Release, Release-Manifest, Repertorium, Fakt-Rubrik-Bindung, Limits und
beide getrennten Matchspuren unveraenderlich an das Safety-Ergebnis gebunden.

Hashdrift erzeugt `SAFETY_GATE_SPLIT_TRACK_MISMATCH`; ein nicht vollstaendiger
6C-Lauf erzeugt `SAFETY_GATE_SPLIT_TRACK_UNAVAILABLE`. Beide Faelle sperren jede
weitere Stufe.

## Red-Flag-Vertrag

Das Safety-Eingabemanifest verwendet exakt dieselben terminalen
`verified`-/`review_only`-Fakten wie 6A. Als aktive Red Flag gilt jeder
nicht negierte `safety_flag` mit `clinical_status` `current` oder `unknown`.
Unsicherheit oder `review_only` schwaechen die Sperre nicht ab.

Sobald mindestens eine solche Red Flag existiert:

- lautet der Status `SAFETY_GATE_ESCALATE_ONLY_INACTIVE`,
- lautet die einzige Safety-Disposition `ESCALATE_ONLY`,
- werden keine Kandidaten gebildet oder bewertet,
- werden die nachgeordneten Safety-Regeln nicht als Ersatzfreigabe ausgewertet.

Das Ergebnis nennt nur Fakten-ID, Reihenfolge, Reviewstatus, Sicherheit und
Fakteninhaltshash. Label, Rohwert, Quellpayload, Freitext und Pseudonym werden
nicht ausgegeben.

## Medikamentenstatus

Ein eindeutiger Medikamentenstatus benoetigt genau einen ausgewaehlten Fakt mit:

- `fact_type = medication`
- `fact_key = medication.status`
- `review_status = verified`
- `clinical_status = current`
- `certainty = confirmed`
- nicht negiertem Wert
- `fact_value.type = coded`
- `fact_value.system = local_v1`
- Code `complete` oder `none_reported`

Fehlende, mehrfache, unreviewte, negierte, historische, unbekannte oder
unvollstaendige Statuswerte erzeugen Review. `none_reported` zusammen mit einem
aktiven Medikamentenfakt ist widerspruechlich und erzeugt ebenfalls Review.

Jeder aktive Medikamentenfakt ausserhalb des Statusfakts benoetigt eine
`kb_entity_id`. Diese Entity muss als exakte Revision im gebundenen Release
liegen. Dadurch kann ein unaufgeloestes oder releasefremdes Medikament nicht an
Interaktionsregeln vorbeilaufen. Zusaetzlich blockiert jeder andere
`review_only`-Fakt den Safety-Gate mit
`SAFETY_GATE_REVIEW_REQUIRED_INACTIVE`.

## Release-Closure und Mengengrenzen

Vor den vollstaendigen Release- und Regelvalidatoren werden drei Dimensionen
stufenweise begrenzt:

- hoechstens 512 exakte `preparation`-/`product_variant`-Subjects
- hoechstens 2.048 Safety-Assertions beziehungsweise Safety-Regeln
- hoechstens 8.192 Safety-Bedingungen

Mindestens ein exaktes therapeutisches Subject und mindestens eine Safety-Regel
sind fuer den positiven 6D-Vertrag erforderlich. Die bestehende 6B-Grenze von
4.096 Release-Items bleibt vorgelagert wirksam.

Fuer jedes Release-Subject gilt fail-closed:

- mindestens eine freigegebene Safety-Regel muss im Release liegen,
- jede global `released` Safety-Regel dieses exakten Subjects muss enthalten
  sein; Cherry-Picking ist unzulaessig,
- Assertion und Subject-Revision muessen exakte Release-Items sein,
- jede Related- und Condition-Entity-Revision muss exakt im Release liegen,
- jede gebundene Quellenrevision, nicht nur die primaere, muss Release-Item sein,
- `kb_safety_rule_is_valid` muss fuer jede Regel wahr sein.

Ein fehlender, uebergrosser oder unvollstaendiger Bereich erzeugt
`SAFETY_GATE_RULE_SCOPE_UNAVAILABLE`. Der Test weist insbesondere nach, dass ein
nach dem bestehenden Release-v1-Vertrag weiterhin formal gueltiges Release von
6D abgelehnt wird, wenn nur eine von mehreren freigegebenen Safety-Regeln eines
Subjects entfernt wurde.

## Deterministische Bedingungsauswertung

Alle sechs Bedingungsarten des 4B-1-Vertrags werden ausgewertet:

- `always`
- `entity_present`
- `fact_present`
- `fact_missing`
- `coded_value_in`
- `quantity_compare`

Mehrere Bedingungen bleiben eine geordnete AND-Menge. Ausgewertet werden nur
ausgewaehlte, nicht negierte Fakten mit Status `current` oder `unknown`.

`entity_present` verlangt eine Patientenfakt-Entity, deren exakte Revision im
Release mit der Condition-Revision uebereinstimmt. `coded_value_in` verlangt bei
genau einem aktiven Fakt Codesystem und Code. Mehrdeutige Mehrfachfakten werden
nicht still priorisiert, sondern `INDETERMINATE`.

`quantity_compare` fuehrt absichtlich keine Einheitenumrechnung und keine
Interpolation offener Patientenintervalle durch. Es akzeptiert genau einen
aktiven Quantity-Fakt mit `comparator = eq` sowie exakt gleichem Einheitssystem
und Einheitencode. Abweichende Einheiten, offene Comparatoren oder Mehrfachwerte
werden `INDETERMINATE`; ein spaeterer Kandidat kann dadurch hoechstens
`REVIEW_ONLY`, niemals `ALLOW`, erhalten.

Bei `interaction` ist die exakt gebundene Related-Entity zusaetzlich eine
implizite zwingende Bedingung. Eine `always`-Interaktionsregel trifft daher nur,
wenn die Related-Entity tatsaechlich in einem aktiven ausgewaehlten Fakt
vorliegt.

## Regel- und Subjectergebnis

Jede Regel erhaelt genau einen Auswertungsstatus:

- `MATCHED`
- `NOT_MATCHED`
- `INDETERMINATE_REVIEW_REQUIRED`

Je Subject werden die unveraenderten 4B-1-Effekte zusammengefuehrt:

- eine passende `exclude`-Regel erzeugt `EXCLUDE`,
- eine passende `review_only`- oder unbestimmte Regel erzeugt `REVIEW_ONLY`,
- eine passende `allow_with_notice`-Regel erzeugt nur `NOTICE_ONLY`,
- ohne passende Regel bleibt `NO_MATCHING_RULE_INACTIVE`.

Es gibt bewusst keinen Subjecteffekt `ALLOW`. `EXCLUDE` hat Vorrang vor Review
und Hinweis. Der positive Gesamtstatus
`SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE` bestaetigt nur, dass die
regelgebundene Safety-Auswertung vollstaendig und reproduzierbar vorliegt.

## Statuswerte und Hashes

Der aeussere Vertrag kennt:

- `SAFETY_GATE_EXPECTATION_INVALID`
- `SAFETY_GATE_SPLIT_TRACK_UNAVAILABLE`
- `SAFETY_GATE_SPLIT_TRACK_MISMATCH`
- `SAFETY_GATE_INPUT_UNAVAILABLE`
- `SAFETY_GATE_ESCALATE_ONLY_INACTIVE`
- `SAFETY_GATE_REVIEW_REQUIRED_INACTIVE`
- `SAFETY_GATE_RULE_SCOPE_UNAVAILABLE`
- `SAFETY_GATE_RESULT_LIMIT_EXCEEDED`
- `SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE`

Safety-Eingabemanifest, Regelbewertungen und Gesamtergebnis besitzen getrennte
kanonische SHA-256-Bindungen. Das vollstaendige Ergebnis ist auf 8 MiB begrenzt.

## Rechte und unveraenderte Snapshots

Alle drei Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Runtime-RPC.

Wiki-Snapshot und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Backup- und Restore-Inventare aendern sich nicht.
Release v1 bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Synthetische Tests

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft fuer 6D:

- reine Drei-Funktionen-Migration ohne Tabelle, DDL, DML oder Grant
- unveraenderte Wiki- und Therapie-Eingabe-Snapshots
- Red-Flag-Erkennung ohne Rohwertausgabe
- eindeutigen, fehlenden und unklaren Medikamentenstatus
- releasefremde beziehungsweise unaufgeloeste Medikamentensperre
- vollstaendige Release-Closure und Schutz gegen Safety-Regel-Cherry-Picking
- passende harte Interaktion mit impliziter Related-Entity-Praesenz
- passende harte Kontraindikation
- alle sechs Bedingungsarten, davon vier gemeinsam in einer AND-Regel
- deterministische Subject-, Regel-, Condition- und Gesamthashes
- Vorrang von `EXCLUDE` ohne Erzeugung eines `ALLOW`
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Abschlussstand:

- fokussierter Schritt-6A-bis-6D-Test in zwei laufzeitbegrenzten Gruppen:
  22/22 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such- und
  Repertoriumsregression: 7/7 Dateien, 109/109 Tests
- vollstaendiger Projektlauf in laufzeitbegrenzten Gruppen: 50/50 Dateien,
  545/545 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf ohne Fehler
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- unabhaengige P0/P1-Gegenpruefung nach Haertung von `certainty` und
  SQL-`NULL`-Semantik: `APPROVE`, hohe Sicherheit, keine verbleibenden Befunde

## Bewusste Restrisiken und naechste Gates

- PGlite besitzt nur eine Datenbanksession. Der reine Lesepfad hat keine neue
  Schreibkonkurrenz; reale Laufzeiten und Queryplaene fuer die Hoechstgrenzen
  muessen trotzdem vor Deployment auf echtem PostgreSQL profiliert werden.
- Die Codes `complete` und `none_reported` sind ein 6D-Preflight-Vokabular. Eine
  spaetere Eingabe-UI beziehungsweise Importstrecke muss sie kontrolliert und
  fachlich abgenommen erzeugen; derzeit existiert keine produktive Erfassung.
- Der Vertrag enthaelt keine echten Sicherheitsregeln. Vor jedem Deployment sind
  medizinische Fachreview, Quellenreview und realistische Negativfixtures
  erforderlich.
- Ein spaeterer Kandidatenvertrag muss den exakten 6D-Resultathash verlangen,
  ausschliesslich die bewerteten Subject-Revisionen verwenden und `EXCLUDE`
  technisch unumkehrbar halten.
- Dosierung, KI-Formulierung, Persistenz, Audit, Schattenvergleich, Restore,
  Datenschutz-, RLS- und Aktivierungsabnahme bleiben offen.

Bis dahin ist Schritt 6D ausschliesslich ein owner-seitiger, synthetisch
gepruefter Safety- und Integritaetsnachweis ohne medizinische Nutzung.
