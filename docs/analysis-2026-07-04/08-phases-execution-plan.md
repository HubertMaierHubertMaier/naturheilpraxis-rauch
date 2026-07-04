# 08 Phases Execution Plan

## 1. Zielbild

Die Plattform soll in klaren, stabilen Schritten von einem funktional reichen, aber inkonsistent abgesicherten Zustand in einen reproduzierbaren, wartbaren und datenschutzrechtlich belastbaren Zustand ueberfuehrt werden.

Leitprinzipien:

1. erst Risiken senken, dann Features erweitern
2. zuerst Source of Truth und Reproduzierbarkeit stabilisieren
3. Gesundheitsdatenpfade vor allen Komfortthemen haerten
4. kleine, verifizierbare Phasen mit klaren Gates

## 2. Phase 0 - Containment und Wahrheitsbasis

### Ziel

Sensible Artefakte, gebrochene Reproduzierbarkeit und Dokumentationsdrift werden zuerst sichtbar eingefroren und in eine sichere Arbeitsbasis ueberfuehrt.

### Aufgaben

1. Sensible Repo-Artefakte inventarisieren und separat behandeln, insbesondere `docs/database-backup-2026-03-01.md`.
2. Festlegen, welche Doku historisch und welche aktuell verbindlich ist.
3. `package.json` und `package-lock.json` als reproduzierbare Wahrheit wieder in Einklang bringen.
4. Dokumentationsstatus von `doc/`, `docs/` und `docs/analysis-2026-07-04/` explizit markieren.

### Akzeptanzkriterien

1. Es gibt eine eindeutige aktuelle Analysedokumentation.
2. Sensible Altdateien sind organisatorisch klassifiziert.
3. `npm ci` ist wieder gruener oder bewusst als blocker dokumentiert und fuer die Behebung vorbereitet.

## 3. Phase 1 - Auth- und Session-Haertung

### Ziel

Patienten- und Gesundheitsdatenpfade duerfen nur ueber serverseitig belastbare Authentifizierungs- und Autorisierungszustaende erreichbar sein.

### Aufgaben

1. 2FA-Modell neu entwerfen: kein rein clientseitig choreographierter Zweitschritt mehr.
2. Echte serverseitige Session- oder Claims-Semantik fuer "2FA erfuellt" schaffen.
3. `submissionId`-Bindung im Anamnese-Confirm-Pfad hart an den Eigentuemer koppeln.
4. Redirect-Restore fuer geschuetzte Routen sauber implementieren.
5. Admin-Bypass strikt auf lokale Entwicklung begrenzt halten und erneut pruefen.

### Akzeptanzkriterien

1. Ein Passwort-only-Login ohne zweiten Faktor darf nicht zu einer vollwertigen Patientensession fuehren.
2. Kritische Functions pruefen serverseitig den richtigen Sessiontyp oder gleichwertigen Nachweis.
3. Submission-Updates sind nur fuer den zugehoerigen Besitzer moeglich.

## 4. Phase 2 - Access-Modell konsolidieren

### Ziel

Ein einziger, nachvollziehbarer Freigabemechanismus fuer patientenspezifische Inhalte ersetzt parallele Driftmodelle.

### Aufgaben

1. Bibliothekszugriffe zwischen `patient_access` und `profiles.is_verified_patient` vereinheitlichen.
2. Online-Anamnese-Freigabe fachlich klar modellieren: globaler Kill-Switch vs patientenspezifische Freigabe.
3. `patient_access.note` aus patientenseitigen Responses entfernen.
4. `new_patient`-/`patient`-Sichtbarkeitsregeln systemweit angleichen.

### Akzeptanzkriterien

1. Pro Inhaltsklasse gibt es genau eine effektive Freigabelogik.
2. UI-, RLS- und Storage-Zugriffe liefern dieselbe Fachwahrheit.
3. Interne Notizen gelangen nicht mehr in Patientenclients.

## 5. Phase 3 - OTP, Logging und Datenschutzhaertung

### Ziel

Pre-session und hochsensible Backendpfade werden technisch und dokumentarisch auf ein professionelleres Niveau gehoben.

### Aufgaben

1. OTP-Speicherung hashbasiert oder vergleichbar haerten.
2. Rate Limits aus in-memory-Mechanismen in robustere serverseitige Steuerung ueberfuehren.
3. Audit- und Event-Logs auf Datenminimierung umbauen.
4. `backup-export` mit Governance, Audit und minimalem Exportprofil nachruesten.
5. Datenschutzhinweise auf reale Codewahrheit korrigieren.

### Akzeptanzkriterien

1. OTPs liegen nicht mehr als leicht wiederverwendbare Klartexte im Datenmodell.
2. Logging minimiert PII.
3. Datenschutzhinweise sind codekonform.
4. Backup-Exporte sind technisch und organisatorisch sauberer kontrolliert.

## 6. Phase 4 - Static Content, Consent und Search-Reife

### Ziel

Die ausgelieferte Content-Landschaft wird in eine such- und datenschutzkonforme technische Struktur gebracht.

### Aufgaben

1. Patientenspezifische oder gated Inhalte aus `public/` entfernen oder in ein echtes geschuetztes Modell ueberfuehren.
2. `infothek-gate.js` nicht mehr als tragendes Schutzkonzept verwenden.
3. Consent-Strategie real machen oder textlich auf technisch notwendige Funktionen begrenzen.
4. Canonicals, Domainstrategie, OG-Bilder, Sitemap und Robots vereinheitlichen.
5. `SEOHead` auf alle oeffentlichen React-Seiten sauber anwenden oder prerender-/SSR-Strategie vorbereiten.
6. `useContentProtection` aus oeffentlichen Inhaltsseiten entfernen.

### Akzeptanzkriterien

1. Gated Inhalte sind nicht mehr nur clientseitig "geschuetzt".
2. Search-Signale sind konsistent.
3. Consent entspricht der realen technischen Wirkung.
4. Accessibility wird nicht mehr durch Schutz-Hacks sabotiert.

## 7. Phase 5 - Reproduzierbare Qualitaetsgates

### Ziel

Die technische Basis wird fuer sichere Weiterentwicklung wieder messbar.

### Aufgaben

1. `npm ci` gruener machen.
2. `npm test` wieder lauffaehig machen.
3. `npm run build` und TypeScript-Gates wiederherstellen.
4. historische Lint-Baseline neu einordnen.
5. CI-freundliche Abfolge der Gates definieren.

### Akzeptanzkriterien

1. Die lokale Toolchain ist reproduzierbar installierbar.
2. Test-, Build- und TypeScript-Pruefungen sind technisch wieder nutzbar.
3. Es existiert eine klare CI-Reihenfolge.

## 8. Phase 6 - Modularisierung der Risikohotspots

### Ziel

Monolithische Risiko-Dateien werden in testbare, reviewbare Einheiten zerlegt.

### Aufgaben

1. `src/pages/Auth.tsx` zerlegen
2. `src/pages/Anamnesebogen.tsx` zerlegen
3. `src/components/admin/TherapyRecommendation.tsx` zerlegen
4. `src/components/admin/BackupCenter.tsx` zerlegen
5. `src/lib/pdfExportEnhanced.ts` zerlegen

### Akzeptanzkriterien

1. Keine fachliche Verhaltensaenderung ohne begleitenden Test.
2. Jede Extraktion reduziert Verantwortung pro Datei erkennbar.

## 9. Phase 7 - Operatives Admin-Cockpit

### Ziel

Der Adminbereich wird von einer Tab-Sammlung zu einer betrieblich fuehrenden Arbeitsoberflaeche.

### Aufgaben

1. Admin-Start mit Prioritaeten, Alerts und offenen Freischaltungen
2. sichtbare Security-/Backup-/Audit-Hinweise
3. klarere Trennung zwischen CMS, Patientenbetrieb, Therapie-AI und Restore/Backup

### Akzeptanzkriterien

1. Admins sehen zuerst offene Aufgaben statt nur Tabs.
2. Sicherheits- und Betriebszustand sind auf einer ersten Ebene sichtbar.

## 10. Phase 8 - Optionale Tenant-Readiness

### Ziel

Nur wenn wirklich noetig: vorbereiten, dass das System spaeter mehrere Praxen, Standorte oder Organisationen tragen kann.

### Aufgaben

1. Produktentscheidung: wird Multitenancy ueberhaupt gebraucht?
2. Falls ja: Tenant-Domain-Modell definieren
3. RLS-, Storage-, Settings- und Rollenmodell tenantisieren

### Akzeptanzkriterien

1. Keine Schein-Multitenancy.
2. Entweder bewusst Single-Practice dokumentiert oder sauber tenantfaehig neu modelliert.

## 11. Reihenfolgeempfehlung

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8 nur bei echtem Bedarf

## 12. Definition eines stabilen Zwischenstands

Ein belastbarer Zwischenstand ist erreicht, wenn:

1. keine sensiblen Altdateien mehr unklassifiziert im Doku-Raum liegen
2. `npm ci` wieder reproduzierbar ist
3. Auth-/2FA-Sessionmodell serverseitig konsistent ist
4. patientenspezifische Freigaben nicht mehr ueber Parallelmodelle driften
5. gated Inhalte nicht mehr in `public/` als Pseudo-Schutz ausgerollt werden
6. Datenschutztexte technisch wahr sind
