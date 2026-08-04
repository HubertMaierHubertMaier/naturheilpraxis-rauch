# Wiki Schritt 6E: Medizinisch inaktiver Kandidatenstatus-Preflight

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Kandidaten oder Patientendaten
und keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804130000_create_therapy_candidate_status_preflight.sql`

setzt einen fail-closed Kandidatenstatus- und Bewertungs-Preflight auf die
vollstaendig gebundenen Ergebnisse der Schritte 6C und 6D. Sie erzeugt genau
drei geschlossene Lesefunktionen:

1. `therapy_retrieval_v2_general_candidate_track_v1(uuid,uuid,jsonb,jsonb)`
2. `therapy_retrieval_v2_homeopathic_candidate_track_v1(jsonb,jsonb)`
3. `therapy_retrieval_v2_candidate_status_preflight_v1(...)`

Die Migration erzeugt keine Tabelle, View, Policy, Rolle, Persistenz oder
Schreibfunktion. Alle Ergebnisse bleiben medizinisch und operativ inaktiv:

- `medical_use_allowed = false`
- `retrieval_execution_allowed = false`
- `productive_candidate_use_allowed = false`
- `candidate_status_assignment_allowed = false`
- `dosage_evaluation_allowed = false`
- `ai_use_allowed = false`

`inactive_candidate_statuses_materialized = true` bedeutet ausschliesslich,
dass der synthetische Preflight die Statuswerte reproduzierbar gebildet hat. Es
ist keine Therapie-, Produkt-, Dosierungs- oder Einsatzfreigabe.

## Bindung an Split-Track und Safety-Gate

Der aeussere Vertrag berechnet den vollstaendigen 6D-Safety-Gate-Preflight
erneut. Der Aufrufer muss den exakten erwarteten 6D-Resultathash uebergeben.
Damit bleiben Eingaberevision, Knowledge-Release, Release-Manifest,
Repertoriumsrevision, Fakt-Rubrik-Bindung, Limits, 6C-Split-Track und saemtliche
6D-Safety-Bewertungen in einer kanonischen Hashkette gebunden.

Ein positiver Kandidatenlauf erfordert:

- `SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE`
- den exakten erwarteten Safety-Gate-Resultathash
- denselben vollstaendigen 6C-Split-Track-Resultathash in Aufruf, Safety-Gate
  und erneut berechnetem Split-Track
- intern gueltige Resultathashes beider Vorstufen

Unverfuegbare, unvollstaendige oder abweichende Vorstufen erzeugen kein
Teilresultat. Insbesondere entstehen keine Kandidaten, wenn der Safety-Gate
nicht vollstaendig und hashidentisch vorliegt.

## Unumkehrbare Vorrangregeln

Die Safety-Disposition wird vor der erwarteten Safety-Hash-Uebereinstimmung
ausgewertet. Dadurch kann ein veralteter Aufruferhash weder eine neu erkannte
Red Flag noch eine verpflichtende Medikamentenpruefung verbergen:

- `SAFETY_GATE_ESCALATE_ONLY_INACTIVE` wird unmittelbar
  `CANDIDATE_STATUS_ESCALATE_ONLY_INACTIVE`.
- `SAFETY_GATE_REVIEW_REQUIRED_INACTIVE` wird unmittelbar
  `CANDIDATE_STATUS_REVIEW_ONLY_INACTIVE`.
- Beide Ergebnisse enthalten null Kandidaten und keine Teilspuren.
- `ESCALATE_ONLY` und `EXCLUDE` tragen die technische Sperre
  `UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN`.

Die Statuspraezedenz lautet:

1. `ESCALATE_ONLY`
2. `EXCLUDE`
3. `REVIEW_ONLY`
4. `ALLOW`

KI, Client, Praeferenz, Budget oder Pin duerfen diese Statuswerte nicht
veraendern.

## Allgemeine und naturheilkundliche Spur

Die allgemeine Spur uebernimmt ausschliesslich exakte
`preparation`-/`product_variant`-Revisionen aus der allgemeinen 6C-Spur. Jede
Revision muss weiterhin exaktes Item desselben Knowledge-Releases sein und eine
6D-Subjectbewertung besitzen.

`EXCLUDE` entsteht ausschliesslich aus dem unveraenderten 6D-Safety-Effekt
`EXCLUDE` und hat Vorrang vor jeder anderen Dimension.

Ein Fakt darf zu einem inaktiven `ALLOW` nur beitragen, wenn er gleichzeitig:

- nicht negiert ist,
- `clinical_status = current` besitzt,
- `certainty = confirmed` besitzt,
- `review_status = verified` besitzt.

Negierte, historische, unbekannte, geplante, unbestaetigte oder nur
pruefpflichtige Faktentreffer bleiben in der Provenienz sichtbar, erzwingen aber
`REVIEW_ONLY`. Dadurch kann ein formal verifizierter, jedoch unsicherer Fakt
nicht still als bestaetigte klinische Passung verwendet werden.

Zusaetzlich benoetigt `ALLOW` mindestens eine freigegebene, releasegebundene
Graphassertion:

- Relation `indicated_for` oder `may_support`
- Richtung zur exakten therapeutischen Revision
- Zuordnungsstaerke `direct` oder `indirect`
- Evidenzgrundlage und Evidenzqualitaet jeweils nicht `unrated`
- Bindung an mindestens einen erlaubnisfaehigen Fakt

Eine `not_recommended`-Zuordnung, ein fehlender oder reviewpflichtiger
Safety-Effekt, ein nicht erlaubnisfaehiger Fakt oder fehlender starker Support
erzeugt `REVIEW_ONLY`. Ein `NOTICE_ONLY`-Safety-Effekt darf nur zusammen mit
allen uebrigen Bedingungen zu dem weiterhin inaktiven Status `ALLOW` fuehren.
Auch `NO_MATCHING_RULE_INACTIVE` ist ein ausdruecklich bekannter, nicht
blockierender 6D-Effekt. Jeder unbekannte oder spaeter neu hinzukommende
Safety-Effekt scheitert dagegen geschlossen als `REVIEW_ONLY`.

## Getrennte sichtbare Dimensionen

Es gibt keine einzelne undurchsichtige Gesamtpunktzahl. Pro allgemeinem
Kandidaten bleiben getrennt sichtbar:

- klinische Faktenabdeckung einschliesslich erlaubnisfaehiger und
  reviewpflichtiger Fakten
- exakte Referenzart sowie direkte und graphbasierte Treffer
- freigegebene Relationsassertionen, starker Support und
  `not_recommended`-Zuordnungen
- Hersteller-, traditionelle, praktische/erfahrungsbezogene,
  wissenschaftliche und unbewertete Grundlagen
- Evidenzqualitaet von `unrated` bis `high`
- praktische beziehungsweise erfahrungsmedizinische Assertionen als eigene
  Dimension
- exakte Quellenrevisionen, Fundstellen und neuestes Publikationsdatum
- Praeferenz- und Budgetkontext als nachgelagerte, nicht statusbildende
  Information

Assertion, Assertion-Inhaltshash, Relation, Richtung, Zuordnungsstaerke,
Gueltigkeitsdaten, Quellenrevision, Quelleninhaltshash, Quellenrolle und genaue
Fundstelle bleiben als erklaerbare Provenienz erhalten. Rohwerte oder
Patientenidentifikatoren werden nicht ausgegeben. Die Referenzprovenienz besitzt
auch bei mehreren Graphkanten desselben Fakts eine vollstaendige kanonische
Tie-Break-Reihenfolge; dadurch bleiben Spur- und Gesamthashes deterministisch.

Die stabile Reihenfolge verwendet nacheinander Status, bestaetigte
Faktenabdeckung, starken Support, exakte Produktvariante vor Zubereitung,
Direktreferenzen, kanonischen Schluessel und Revisions-ID. Diese Reihenfolge ist
kein Wirksamkeits- oder Gesamtscore.

## Homoeopathische Spur

Die homoeopathische Spur uebernimmt ausschliesslich die source-nativen
Repertoriumstreffer aus 6C. Generische `homeopathic_remedy`-Revisionen besitzen
noch keine exakte Zubereitungs-, Potenz-, Produktvarianten- und
Subject-Safety-Bindung. Deshalb bleibt jeder Treffer zwingend `REVIEW_ONLY`.

Getrennt sichtbar bleiben:

- Rubrikabdeckung
- source-natives Gradprofil
- Domaenenabdeckung
- negative Rubrikkonflikte
- stabile source-native Position
- `materia_medica_alignment = NOT_ASSESSED`
- `practice_experience = NOT_ASSESSED`

Die Spur darf keine allgemeinen Kandidaten wiederverwenden, keinen
spurenuebergreifenden Score bilden und keine Repertoriumsuebereinstimmung als
Wirksamkeitsnachweis darstellen.

## Hashes, Grenzen und Statuswerte

Allgemeine Spur, homoeopathische Spur und Gesamtergebnis besitzen getrennte
kanonische SHA-256-Hashes. Wiederholte identische Aufrufe liefern bytegleich
dieselben Payloads und Hashes. Das Gesamtergebnis ist auf 8 MiB begrenzt.

Die vorhandenen Grenzen der Vorstufen bleiben wirksam, insbesondere 4.096
Release-Items, 512 therapeutische Safety-Subjects, 2.048 Safety-Regeln, 8.192
Safety-Bedingungen und hoechstens 200 uebernommene homoeopathische
Spurkandidaten. Der aktuelle Hauptaufruf begrenzt diese Spur weiterhin auf 50.

Der aeussere Vertrag kennt:

- `CANDIDATE_STATUS_ESCALATE_ONLY_INACTIVE`
- `CANDIDATE_STATUS_REVIEW_ONLY_INACTIVE`
- `CANDIDATE_STATUS_SAFETY_GATE_UNAVAILABLE`
- `CANDIDATE_STATUS_EXPECTATION_INVALID`
- `CANDIDATE_STATUS_SAFETY_GATE_MISMATCH`
- `CANDIDATE_STATUS_SPLIT_TRACK_UNAVAILABLE`
- `CANDIDATE_STATUS_TRACKS_UNAVAILABLE`
- `CANDIDATE_STATUS_RESULT_LIMIT_EXCEEDED`
- `CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE`

## Rechte und unveraenderte Snapshots

Alle drei Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Runtime-RPC.

Wiki-Snapshot und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Backup- und Restore-Inventare aendern sich nicht.
Release v1 bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Synthetische Tests

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft fuer 6E:

- reine Drei-Funktionen-Migration ohne Tabelle, DDL, DML oder Grant
- unveraenderte Wiki- und Therapie-Eingabe-Snapshots
- ein synthetisches inaktives `ALLOW` mit exakter Supportassertion
- unverrueckbares `EXCLUDE` trotz Praeferenz- und Budgetkontext
- unsichere Faktentreffer als `REVIEW_ONLY`
- getrennte homoeopathische `REVIEW_ONLY`-Kandidaten ohne Cross-Track-Reuse
- exakte Safety-, Split-, Spur- und Gesamthashbindung
- Vorrang von Red-Flag-`ESCALATE_ONLY` und Medikamenten-`REVIEW_ONLY` vor
  veralteten Safety-Hasherwartungen
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Abschlussstand:

- fokussierter Schritt-6A-bis-6E-Vertrag in laufzeitbegrenzten Gruppen:
  29/29 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such- und
  Repertoriumsregression: 7/7 Dateien, 116/116 Tests
- vollstaendiger Projektlauf in laufzeitbegrenzten Gruppen: 50/50 Dateien,
  552/552 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf ohne Fehler
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- unabhaengige P0/P1-Gegenpruefung nach Fail-Closed-Haertung unbekannter
  Safety-Effekte und vollstaendig deterministischer Referenzreihenfolge:
  `APPROVE`, hohe Sicherheit, keine verbleibenden Befunde

## Bewusste Restrisiken und naechste Gates

- PGlite besitzt nur eine Datenbanksession. Der reine Lesepfad hat keine neue
  Schreibkonkurrenz; reale Laufzeiten und Queryplaene fuer Hoechstgrenzen
  muessen trotzdem vor Deployment auf echtem PostgreSQL profiliert werden.
- Der Vertrag enthaelt keine echten medizinischen Kandidaten, Regeln oder
  Quellen. Vor jedem Deployment sind medizinische Fachreview, Quellenreview und
  realistische Negativfixtures erforderlich.
- Gueltigkeitsdaten und Quellenaktualitaet bleiben sichtbar, aber eine spaetere
  produktive Vergleichsversion muss den fachlich abgenommenen zeitlichen
  Bewertungsstichtag explizit binden.
- Homoeopathische Materia-medica-Uebereinstimmung und Praxiserfahrung sind noch
  nicht bewertet. Ohne exakte Zubereitungs-, Potenz- und Safety-Bindung bleibt
  jeder Repertoriumstreffer reviewpflichtig.
- Dosierungsregeln werden weder gelesen noch bewertet. Dosierungsanzeige,
  Persistenz, Audit, Schattenvergleich, Datenschutz-, RLS-, Restore- und
  Aktivierungsabnahme bleiben offen.

Bis dahin ist Schritt 6E ausschliesslich ein owner-seitiger, synthetisch
gepruefter Status-, Erklaerungs- und Integritaetsnachweis ohne medizinische
Nutzung.
