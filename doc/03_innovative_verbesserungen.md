# 03 — Innovative Verbesserungen

## Leitprinzip

Innovation sollte hier nicht „mehr Features“ bedeuten, sondern:

1. weniger Reibung für Patienten,
2. bessere Datenqualität,
3. höhere Sicherheit,
4. weniger Praxisaufwand,
5. nachvollziehbare KI-Unterstützung,
6. klarere medizinische Verantwortlichkeit.

## Phase 1 — Patient Journey Assistant

### Idee

Ein geführter Assistent auf der Startseite hilft Besuchern, den richtigen Weg zu wählen.

### Umsetzung

#### Schritt 1 — Einstieg

Frage: „Was möchten Sie tun?“

Optionen:

1. Ich bin neu und möchte mich vorbereiten.
2. Ich habe bereits einen Termin.
3. Ich bin schon Patient.
4. Ich suche Informationen zu einem Thema.
5. Ich bin unsicher.

#### Schritt 2 — Kontext

Subfragen:

- Gibt es bereits einen Termin?
- Möchten Sie online oder mit PDF arbeiten?
- Geht es um bestimmte Beschwerden oder allgemeine Information?

#### Schritt 3 — Ergebnis

Der Assistent empfiehlt:

- Neupatienten-Fahrplan,
- Online-Anamnesebogen,
- PDF-Paket,
- Infothek-Thema,
- Praxis-Kontakt.

### Nutzen

- weniger Verwirrung,
- bessere Conversion vom Besucher zum vorbereiteten Patienten,
- weniger Telefon-/E-Mail-Rückfragen.

## Phase 2 — Intelligente Anamnese-Führung

### Idee

Der Anamnesebogen wird dynamisch und adaptiv: Nicht jede Person muss alle Detailfelder sehen.

### Subfeatures

1. Sektion zuerst mit Ja/Nein/Unsicher öffnen.
2. Nur relevante Detailfelder ausklappen.
3. Medizinische Plausibilitätsprüfungen.
4. „Ich weiß nicht“ als valide Antwort.
5. Sanfte Hinweise statt blockierender Fehler.
6. Zusammenfassung je Sektion.

### Beispiele

Wenn „keine Medikamente“ gewählt wurde:

- Medikamentenliste einklappen,
- später prüfen, ob Freitext doch Medikamente erwähnt.

Wenn „Allergien ja“ gewählt wurde:

- Allergie-Typ,
- Reaktion,
- Schweregrad,
- bekannt seit,
- Notfallmedikation.

### Nutzen

- kürzerer subjektiver Aufwand,
- bessere Datenqualität,
- weniger unvollständige Bögen.

## Phase 3 — Anamnese-Qualitätsscore

### Idee

Vor dem Absenden erhält der Patient eine verständliche Qualitätsanzeige.

### Score-Komponenten

1. Pflichtfelder vollständig.
2. Medizinisch relevante Felder beantwortet.
3. Widersprüche geprüft.
4. Kontaktdaten vollständig.
5. Datenschutz/Einwilligung bestätigt.
6. Signatur/Verifikation abgeschlossen.

### Darstellung

- Grün: bereit zum Absenden.
- Gelb: absendbar, aber einige freiwillige Bereiche offen.
- Rot: wichtige Pflichtangaben fehlen.

### Nutzen

- Patient versteht, warum etwas fehlt.
- Praxis erhält vollständigere Daten.
- Weniger Nachfragen.

## Phase 4 — Admin-Aufgaben-Cockpit

### Idee

Adminbereich wird von Modulnavigation zu Aufgabensteuerung erweitert.

### Widgets

1. Neue Anamnesen heute/diese Woche.
2. Ungeprüfte Einreichungen.
3. Patienten ohne bestätigte E-Mail.
4. Unvollständige Dokumente.
5. Therapieempfehlungen im Entwurf.
6. KI-Ergebnisse ohne fachliche Freigabe.
7. Audit-/Security-Hinweise.
8. Inhalte mit ablaufendem Review-Datum.

### Nutzen

- Admin sieht sofort Prioritäten.
- Weniger Klicks.
- Bessere Prozesssicherheit.

## Phase 5 — Human-in-the-loop KI-System

### Idee

KI darf unterstützen, aber nie unkontrolliert finalisieren.

### Komponenten

1. KI-Vorschlag als Entwurf.
2. Quellen-/Begründungspflicht.
3. Fachliche Freigabe durch Admin/Behandler.
4. Änderungsdiff zwischen KI-Vorschlag und finaler Version.
5. Audit: Modell, Zeitpunkt, Prompt-Version, Input-Kategorie, Reviewer.
6. PII-Redaction vor KI-Aufruf.

### Nutzen

- sicherere medizinische Nutzung,
- nachvollziehbare Entscheidungen,
- bessere DSGVO-/Haftungsposition.

## Phase 6 — Datenschutz-Ampel

### Idee

Für jeden sensiblen Workflow zeigt eine interne Ampel, ob Datenschutzanforderungen erfüllt sind.

### Prüfpunkte

1. Auth vorhanden.
2. Rolle geprüft.
3. RLS aktiv.
4. Service Role nur serverseitig.
5. Keine PII in externen KI-Payloads.
6. Keine PII in Logs.
7. CORS eingeschränkt.
8. Rate-Limit aktiv.
9. Audit-Log vorhanden.
10. Lösch-/Exportfähigkeit dokumentiert.

### Nutzen

- Datenschutz wird operationalisiert.
- Admin/Entwicklung erkennt Risiken schneller.

## Phase 7 — Persönliche Patientenbibliothek

### Idee

Patienten erhalten nur die für sie freigegebenen Inhalte, geordnet nach Behandlungsphase.

### Phasen

1. Vorbereitung vor Termin.
2. Nach Erstgespräch.
3. Therapiephase.
4. Nachsorge.
5. Allgemeine Infothek.

### Funktionen

- von Praxis freigegebene Artikel,
- PDFs,
- Audio/Hypnose-Inhalte,
- Markierung „gelesen/angehört“,
- Hinweise ohne medizinische Diagnoseautomatik.

## Phase 8 — Smart Document Pipeline

### Idee

Dokumente werden versioniert, nachvollziehbar und sicher erzeugt.

### Substeps

1. Dokumentenvorlage versionieren.
2. Datenquelle validieren.
3. PDF generieren.
4. Hash erzeugen.
5. Speicherung/Ablage auditieren.
6. Download bereitstellen.
7. Änderungshistorie anzeigen.

### Nutzen

- bessere Nachvollziehbarkeit,
- klare Dokumentversionen,
- weniger manuelle Ablagefehler.

## Phase 9 — Wissensdatenbank mit Review-Zyklus

### Idee

Infothek-/Wissensinhalte werden nicht nur gespeichert, sondern aktiv gepflegt.

### Substeps

1. Inhalt erstellen.
2. Medizinische Kategorie zuweisen.
3. Quellen erfassen.
4. Review-Datum setzen.
5. Veröffentlichung.
6. Automatische Erinnerung bei Review-Fälligkeit.
7. Archivierung alter Inhalte.

### Nutzen

- Fachartikel bleiben aktuell,
- medizinische Aussagen werden kontrollierter,
- bessere SEO- und Qualitätswirkung.

## Phase 10 — Sicherheits- und Betriebsmonitor

### Idee

Ein internes technisches Dashboard zeigt Zustand und Risiken.

### Anzeigen

1. letzter erfolgreicher Build,
2. Teststatus,
3. Supabase Function Health,
4. fehlgeschlagene Logins/2FA-Versuche,
5. ungewöhnliche Verification-Code-Anfragen,
6. Edge-Function-Fehlerquoten,
7. offene Security-Todos,
8. Versionsstand.

### Nutzen

- frühe Fehlererkennung,
- weniger Blindflug,
- bessere Betriebsreife.

## Innovationspriorität

Kurzfristig am wertvollsten:

1. Admin-Aufgaben-Cockpit.
2. Anamnese-Qualitätsscore.
3. Einheitlicher Patient Journey Stepper.
4. Edge-Function-Datenschutz-Ampel.

Mittelfristig:

1. Human-in-the-loop KI-System.
2. Persönliche Patientenbibliothek.
3. Smart Document Pipeline.

Langfristig:

1. Betriebsmonitor.
2. Review-Zyklus für Wissensdatenbank.
3. Adaptive Anamnese mit medizinischer Plausibilitätsprüfung.
