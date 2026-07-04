# 09 Innovation Backlog

## 1. Leitlinie

Innovationen sind fuer dieses Projekt sinnvoll, aber nur nach Stabilisierung. In einem Gesundheitsdatenkontext ist jede Innovation erst dann wertvoll, wenn sie:

1. keine Sicherheits- oder DSGVO-Schuld vergroessert
2. den Praxisbetrieb messbar erleichtert
3. den Patientennutzen klar steigert
4. keine neue Schattenarchitektur neben dem Kernsystem erzeugt

## 2. Sofort sinnvoll nach den Haertungsphasen

### 2.1 Admin-Aufgaben-Cockpit

Nutzen:

1. offene Registrierungen
2. fehlende Freischaltungen
3. Backup-Warnungen
4. Audit-Auffaelligkeiten
5. Therapie- oder Dokumentwarteschlangen

Voraussetzung:

1. Phase 1 bis 3 abgeschlossen

### 2.2 Patientenstatus-Modell

Statt nur `patient` plus Freigabeflags sollte ein klareres fachliches Statusmodell eingefuehrt werden, zum Beispiel:

1. registriert
2. identifiziert
3. freigeschaltet
4. bibliotheksberechtigt
5. anamneseaktiv

Vorteil:

1. weniger Parallel-Flags
2. bessere UX-Texte
3. klarere Admin-Entscheidungen

### 2.3 Sichere Freischaltungs-Historie

Freigaben sollten nicht nur Zustand, sondern auch nachvollziehbare Historie tragen:

1. wer hat freigeschaltet
2. wann
3. warum
4. welche Sichtbarkeitsstufe

## 3. Fachlich starke, aber nur nach Kernhaertung sinnvolle Innovationen

### 3.1 Patientenbibliothek 2.0

Moegliche Ausbaustufe:

1. persoenliche Empfehlungen statt nur freier Bibliothek
2. materialspezifische Freigabe nach Therapieverlauf
3. Read-/Play-Tracking nur, wenn datenschutzrechtlich sauber begruendet
4. Versionskennzeichen fuer Skripte und Audioinhalte

### 3.2 Sicherer Verlauf fuer Anamnesen

Moegliche Ausbaustufe:

1. Versionshistorie pro Anamnesebogen
2. gezielte Aenderungsdifferenz zwischen Versionen
3. "Was hat sich seit dem letzten Termin geaendert"-Ansicht fuer Praxis und Patient

### 3.3 Human-in-the-loop KI-Assistenz

Statt "AI als versteckte Blackbox" sollte das Ziel sein:

1. klarer Hinweis, welche Inhalte AI-generiert sind
2. Quellenbezug und Begruendung pro Vorschlag
3. Review-Pflicht vor Uebernahme
4. fachlicher Freigabestatus pro Vorschlag

### 3.4 Dokument-Pipeline mit PII-Schutz

Fuer Therapie-Uploads:

1. vorgelagerte PII-Pruefung
2. moegliche Schwellen fuer manuelle Freigabe
3. Redaktions- und Pseudonymisierungsstufe vor AI-Analyse
4. strukturierte Extraktion statt loser HTML-/Prompt-Flows

## 4. UX- und Search-Innovationen

### 4.1 Content-System statt Static-Handouts

Die heutige Static-HTML-Welt sollte mittelfristig in ein gepflegtes Content-System ueberfuehrt werden.

Ziele:

1. einheitliche URLs
2. einheitliche Metadaten
3. einheitliche Canonicals
4. echte Sichtbarkeitssteuerung
5. bessere Accessibility

### 4.2 Search-Ready medizinische Wissensarchitektur

Fuer Google 2026 sinnvoll:

1. klare Seitentypen
2. bessere Autorenschaft und Quellenkennzeichnung
3. medizinische Topic-Hubs
4. saubere interne Verlinkung statt verteilter Einzeldateien
5. Search-Console- und Rich-Results-Review als Regelprozess

### 4.3 Mehrsprachigkeit richtig oder gar nicht

Der aktuelle Sprachumschalter ist clientseitiger State, aber kein sauberes indexierbares Mehrsprachenmodell.

Innovationsoption:

1. echte sprachspezifische URLs
2. `hreflang`
3. sprachspezifische Canonicals
4. saubere Content-Eigentuemerschaft pro Sprache

## 5. Betriebs- und Compliance-Innovationen

### 5.1 DLP- und Redaktionspfad fuer Logs

1. PII-Redaktion in Audit- und Event-Logs
2. automatische Warnungen bei sensiblen Inhaltspfaden
3. Log-Stufen pro Kontext

### 5.2 Backup-Governance

1. verschluesselte Exporte
2. getrennte Rollen fuer Export und Restore
3. dokumentierte Restore-Uebungen
4. klare Lebenszyklen fuer Backup-Artefakte

### 5.3 Datenschutz-Ampel fuer neue Features

Jedes neue Feature bekommt vor Umsetzung eine kleine Ampel:

1. Gruen: kein zusaetzlicher PII-Pfad
2. Gelb: PII vorhanden, aber sauber begrenzt
3. Rot: Gesundheitsdaten, neue Drittland- oder AI-Verarbeitung, neue Consent-Anforderungen

## 6. Multitenancy nur bei echtem Produktbedarf

Eine technische Tenant-Readiness ist keine Sofortinnovation, sondern nur sinnvoll, wenn es einen echten Produktbedarf gibt, etwa:

1. mehrere Praxen
2. mehrere Standorte
3. mehrere rechtliche Verantwortliche
4. mehrere Behandlerorganisationen

Vorher sollte das System bewusst Single-Practice und stark darin sein.

## 7. Priorisierte Innovationsreihenfolge

### Nach Phase 3

1. Admin-Aufgaben-Cockpit
2. Patientenstatus-Modell
3. Freischaltungs-Historie

### Nach Phase 4 und 5

1. Content-System fuer Static-Handouts
2. Search-/SEO-Konsolidierung
3. Patientenbibliothek 2.0

### Nach Phase 6

1. Human-in-the-loop KI-Assistenz
2. Dokument-Pipeline mit PII-Schutz
3. DLP-/Log-Redaktion

### Nur bei echtem Bedarf

1. Multitenancy

## 8. Fazit

Die besten Innovationen fuer dieses Projekt sind nicht die lautesten oder technisch exotischsten. Die sinnvollsten Innovationen sind jene, die die bereits vorhandene fachliche Staerke der Praxis in ein stabileres, nachvollziehbareres und vertrauenswuerdigeres digitales System uebersetzen.
