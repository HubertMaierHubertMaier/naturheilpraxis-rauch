# Wiki Schritt 7A: Medizinisch inaktiver Retrieval-Audit-Envelope-Preflight

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Daten, keine Auditpersistenz,
keinen Schattenlauf und keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804150000_create_therapy_retrieval_audit_envelope_preflight.sql`

erzeugt genau eine geschlossene Lesefunktion:

`therapy_retrieval_v2_audit_envelope_preflight_v1(...)`

Sie berechnet den vollstaendigen Schritt-6F-Vertrag erneut und verlangt dessen
exakten erwarteten Resultathash. Nur danach erzeugt sie ein deterministisches,
noch nicht gespeichertes Audit-Envelope fuer Eingabe-, Release-, Regel-,
Comparator-, Fakten-, Quellen- und Kandidatenentscheidungsprovenienz.

Die Migration erzeugt keine Tabelle, View, Policy, Rolle, Persistenz oder
Schreibfunktion. Auch der positive Status
`RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE` setzt ausschliesslich
`inactive_audit_envelope_ready = true`. In jedem Pfad bleiben:

- `medical_use_allowed = false`
- `productive_candidate_use_allowed = false`
- `dosage_evaluation_allowed = false`
- `dosage_display_allowed = false`
- `audit_persistence_allowed = false`
- `replay_execution_allowed = false`
- `shadow_execution_allowed = false`
- `ai_use_allowed = false`
- `plan_selection_allowed = false`
- `activation_allowed = false`

## Vorrang und exakte 6F-Bindung

Red-Flag- und Medikamentensperren besitzen erneut Vorrang vor einem veralteten
Aufruferhash:

- 6F-`ESCALATE_ONLY` erzeugt
  `RETRIEVAL_AUDIT_ESCALATE_ONLY_INACTIVE`.
- 6F-`REVIEW_ONLY` erzeugt `RETRIEVAL_AUDIT_REVIEW_ONLY_INACTIVE`.
- Beide Antworten enthalten kein Audit-Envelope und zeigen sichtbar, ob der
  erwartete 6F-Hash noch stimmt.
- Eine veraltete Erwartung kann deshalb weder Eskalation noch Pflichtreview
  verbergen.

Ein vollstaendiges Envelope entsteht nur, wenn:

- der erwartete 6F-Hash syntaktisch gueltig ist,
- der erneut berechnete 6F-Hash exakt uebereinstimmt,
- der 6F-Inhalt seinen eigenen kanonischen Hash reproduziert,
- 6E-Kandidatenstatus und 6D-Safety-Gate erneut vollstaendig berechenbar sind,
- ihre Resultathashes sowohl untereinander als auch mit den erwarteten
  Stufenhashes und 6F exakt uebereinstimmen,
- Eingabemanifest, Trackhashes, Safety-Regelbewertungen sowie 6F-Regelscope und
  -bewertungen intern reproduzierbar sind.

Die auditierbaren 6F-Ausgaenge
`DOSAGE_RULE_NO_ALLOW_CANDIDATES_INACTIVE`,
`DOSAGE_RULE_BINDINGS_READY_INACTIVE` und
`DOSAGE_RULE_PREFLIGHT_BLOCKED_INACTIVE` koennen ein Envelope erzeugen. Ein
fachlich blockierter Retrievalausgang bleibt damit auditierbar, ohne dadurch
medizinisch oder produktiv zulaessig zu werden.

## Stufen- und Vertragsprovenienz

Das Envelope bindet feste v1-Vertragsbezeichnungen fuer:

- Eingabemanifest
- Knowledge-Release-Manifest
- Split-Track
- Safety-Gate
- Kandidatenstatus
- Dosierungsregel-Preflight
- Audit-Envelope

Die Stufenidentitaet umfasst ausschliesslich Therapie-Eingaberevision,
Knowledge-Release, Repertoriums-Entity und Repertoriumsrevision. Die Hashkette
umfasst:

- Therapie-Eingabemanifest
- Release-Manifest
- Eingabe-/Release-Bindung
- homoeopathisches Request-Manifest
- Split-Track-Resultat
- Safety-Gate-Resultat
- Kandidatenstatus-Resultat
- Dosierungsregel-Resultat

Es gibt keinen Laufzeitstempel, keine zufaellige Audit-ID und keinen Benutzer-,
Patienten-, Session- oder Anamneseverweis. Gleiche gebundene Eingaben erzeugen
deshalb dasselbe Envelope und denselben Resultathash.

## Fakten- und Eingabequellenprovenienz

Alle bereits durch 6A ausgewaehlten terminalen Fakten werden mit folgenden
Feldern gebunden:

- Fakten-ID und Reihenfolge
- Faktentyp und kontrollierter Faktenschluessel
- Reviewstatus und Fakt-Inhaltshash
- optionaler stabiler KB-Entity-Verweis
- optionale Korrekturvorgaenger-ID

Zu jeder Faktenquellenbindung werden Eingabequellen-ID, neutrale Artefakt-ID,
Quellentyp, Quelleninhaltshash, Rolle und Reihenfolge gebunden. Freie
Quellenfundstellen und Faktenfundstellen werden nicht ausgegeben. Stattdessen
enthaelt das Envelope fuer beide jeweils einen kanonischen SHA-256-Hash.

Nicht enthalten sind:

- Faktwert und Faktenlabel
- Eingabeumschlag oder klinischer Freitext
- Quellenpayload
- freie Quellen- oder Faktenfundstelle
- Praxispseudonym

`raw_fact_values_present` und `raw_source_locators_present` bleiben explizit
`false`.

## Comparator- und Kandidatenentscheidungen

Das Comparator-Manifest bindet getrennt:

- `GENERAL_CANDIDATE_ORDER_V1` samt den sieben exakten allgemeinen
  Sortierdimensionen aus 6E
- `HOMEOPATHIC_SOURCE_NATIVE_ORDER_V1` samt der source-nativen
  Repertoriumsreihenfolge
- Kandidatenstatus- und Tracktrennungspolicy
- `opaque_composite_score_used = false`

Allgemeine und homoeopathische Kandidaten bleiben getrennt. Jede
Kandidatenentscheidung enthaelt Position, Status, Sperre, Gruende und exakte
Entity-/Revisionsidentitaet. Allgemeine Kandidaten binden zusaetzlich sichtbare
Dimensionen, Faktenreferenzen und Evidenzassertionsidentitaeten. Die
vollstaendige urspruengliche Kandidatenprojektion wird durch einen separaten
`candidate_payload_hash` gebunden, ohne ihre freien Quellenfundstellen in das
Audit-Envelope zu kopieren.

Homoeopathische Kandidaten bleiben `REVIEW_ONLY`; es gibt weder eine
spuruebergreifende Kandidatenwiederverwendung noch einen Wirksamkeits- oder
Gesamtscore.

## Safety- und Dosierungsregelentscheidungen

Safety-Provenienz enthaelt pro exaktem Subject:

- Safety-Effekt
- Safety-Regel-ID, Assertion-ID und Regelinhaltshash
- Regeltyp, Schweregrad, Effekt und Bewertungsstatus
- geordnete Bedingungs-IDs und deren Status
- einen Hash der vollstaendigen 6D-Regelprojektion

Freier `notice_text` wird nicht ausgegeben, bleibt aber durch den
Regelprojektionshash gebunden.

Dosierungsprovenienz enthaelt ausschliesslich:

- 6F-Status, Scope-, Bewertungs- und Resultathash
- Regel-ID, Regelinhaltshash und Assertion-ID/-Hash
- exakte Subject-, Indikations- und Populationsidentitaeten
- Kandidatenbewertungsstatus und die bereits in 6F sichtbaren exakten
  Faktenbindungen

Dosis, Einheit, Frequenz, Dauer, Timing und Administrationsroute werden weder
gelesen noch ausgegeben. `concrete_dosage_output_present` bleibt `false`.

## Vereinheitlichte Wissensquellenprovenienz

Alle in Kandidatenevidenz, Safety-Regeln und Dosierungsregeln verwendeten
Knowledge-Quellen werden in einer stabil geordneten Liste zusammengefuehrt.
Jede Bindung enthaelt:

- Verwendungsart `candidate_evidence`, `safety_rule` oder `dosage_rule`
- exakte Subject-, Regel- und Assertion-Identitaet
- Quellen- und Quellenrevisions-ID
- Quelleninhaltshash, Quellenrolle und Primaerkennzeichen
- ausschliesslich den kanonischen Fundstellenhash

Die freie KB-Fundstelle erscheint nicht im Envelope.

## Explizit leere KI- und Planauswahlprovenienz

Da 7A weder KI noch eine Planwahl ausfuehrt, erfindet der Vertrag keine
Provenienz. Er bindet stattdessen explizit:

- `execution_present = false`
- `model = null`
- `prompt_hash = null`
- `raw_output_hash = null`
- `validated_output_hash = null`
- `selection_present = false`
- `selected_position_count = 0`
- `selected_positions = []`

Eine spaetere KI- oder Auswahlstufe benoetigt einen neuen, separat abgenommenen
Vertrag und darf diese Abwesenheit nicht nachtraeglich umdeuten.

## Ressourcengrenzen und Hashes

7A erbt alle Grenzen der Schritte 6A bis 6F und prueft zusaetzlich:

- ein bis 2.048 ausgewaehlte terminale Fakten
- hoechstens 16.384 Fakten-zu-Eingabequellen-Bindungen
- hoechstens 16.384 Safety-Regel-zu-Wissensquellen-Bindungen
- hoechstens 512 allgemeine Kandidaten
- hoechstens 200 homoeopathische Kandidaten
- hoechstens 32.768 normalisierte Wissensquellen-Verwendungsbindungen
- hoechstens 8 MiB fuer das gesamte 7A-Resultat

Faktenprovenienz, Comparator-Manifest, Kandidatenentscheidungen,
Safety-Entscheidungen, Dosierungsentscheidungen, Audit-Envelope und Gesamtergebnis
besitzen jeweils getrennte kanonische SHA-256-Hashes.

## Statuswerte

Der aeussere Vertrag kennt:

- `RETRIEVAL_AUDIT_ESCALATE_ONLY_INACTIVE`
- `RETRIEVAL_AUDIT_REVIEW_ONLY_INACTIVE`
- `RETRIEVAL_AUDIT_DOSAGE_PREFLIGHT_UNAVAILABLE`
- `RETRIEVAL_AUDIT_EXPECTATION_INVALID`
- `RETRIEVAL_AUDIT_DOSAGE_RESULT_MISMATCH`
- `RETRIEVAL_AUDIT_PROVENANCE_UNAVAILABLE`
- `RETRIEVAL_AUDIT_PROVENANCE_LIMIT_EXCEEDED`
- `RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE`
- `RETRIEVAL_AUDIT_RESULT_LIMIT_EXCEEDED`

Keiner dieser Werte erlaubt Persistenz, Replayausfuehrung, Schattenbetrieb,
Dosierungsanzeige, KI, Planwahl, Aktivierung oder medizinische Nutzung.

## Rechte und unveraenderte Snapshots

Die Funktion ist `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`, `anon`,
`authenticated`, `service_role`, `kb_importer` und `kb_import_runtime`
widerrufen. Es gibt keinen Runtime-RPC.

Wiki-Snapshot und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Backup- und Restore-Inventare aendern sich nicht.
Release v1 bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Synthetische Tests und Abschlussstand

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft fuer 7A:

- reine Ein-Funktionen-Migration ohne Schema- oder Schreib-DDL
- unveraenderte Wiki- und Therapie-Eingabe-Snapshots
- exakte 6F-Erwartung und vollstaendige Stufenhashkette
- getrennte Hashes aller Auditbereiche
- Fakten- und Eingabequellenidentitaeten ohne Rohwerte oder freie Fundstellen
- exakte Comparatorversionen und getrennte Kandidatenentscheidungen
- Safety- und Dosierungsregelidentitaeten ohne Notice- oder Dosierungsfreitext
- normalisierte Quellenverwendungen mit ausschliesslich gehashter Fundstelle
- explizit leere KI- und Planauswahlprovenienz
- Vorrang von Red-Flag-`ESCALATE_ONLY` und Medikamenten-`REVIEW_ONLY`
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Abschlussstand:

- fokussierter Schritt-6A-bis-7A-Vertrag in vier laufzeitbegrenzten
  Hintergrundgruppen: 15 + 11 + 13 + 7 = 46/46 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such- und
  Repertoriumsregression: 7/7 Dateien, 133/133 Tests
- vollstaendiger Projektlauf aus dem gruppierten Retrievalvertrag und dem
  uebrigen Projektbestand: 50/50 Dateien, 569/569 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf ohne Fehler
- Repository-Secret-Policy ohne Befund
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- unabhaengige P0/P1-Gegenpruefung: `APPROVE`, hohe Sicherheit, keine Befunde

Ein monolithischer Lauf der langen PGlite-Datei bestand zwar alle 46 Tests,
meldete nach 138 Sekunden jedoch einen Vitest-Worker-RPC-Timeout. Er gilt deshalb
nicht als Abschlussgate. Die vier kuerzeren Gruppen bestanden ohne Runnerfehler
und bilden den reproduzierbaren fokussierten Abschlussnachweis.

## Bewusste Restrisiken und naechste Gates

- Das Envelope lebt nur innerhalb eines Owner-Aufrufs. Es gibt noch keine
  append-only Audit-Tabelle, Writer-Transaktion, RLS-, Backup-, Restore- oder
  Aufbewahrungsregel.
- Es findet kein Replay und kein Schattenvergleich gegen `therapy-recommend`
  statt. Laufzeit, Abdeckung und Abweichungen werden noch nicht gemessen.
- Reale PostgreSQL-Queryplaene und Hoechstgrenzen muessen vor jedem Deployment
  separat profiliert werden; PGlite besitzt nur eine Datenbanksession.
- Es existieren weder echte medizinische Regeln noch eine medizinische
  Fachabnahme der synthetischen Entscheidungen.
- KI-Modell, Prompt, Roh-/validierte Ausgabe und ausgewaehlte Planpositionen sind
  bewusst abwesend. Spaetere Stufen benoetigen eigene Hash- und Validatorvertraege.
- Datenschutz-, Aufbewahrungs-, RLS-, Restore-, Betriebs- und
  Aktivierungsabnahme bleiben offen.

Der naechste additive Block darf erst die unveraenderliche, weiterhin inaktive
Persistenz eines exakt erwarteten 7A-Envelope entwerfen. Schattenausfuehrung,
KI, Planwahl und sichtbare Therapieausgabe bleiben auch dort ausgeschlossen.
