# Naturheilpraxis Rauch — Gesamtbericht Problematiken, Lücken, Workflows und Innovationen

Stand der lokalen Analyse: 2026-06-04  
Lokaler Clone: `/home/klaus999/projects/naturheilpraxis-rauch`  
Analysierter Git-Stand: `main` / `5448b51` — `Markdown-Renderer ergänzt`  
Original-Repository: nicht verändert.

## Zweck dieser Dokumentation

Diese gesonderte Dokumentation fasst die Tiefenanalyse in einer für Produkt-, Praxis-, Technik- und Datenschutzentscheidungen verständlichen Form zusammen. Der Schwerpunkt liegt auf:

1. allen wesentlichen Problematiken und Lücken,
2. Stabilität, Datensicherheit und Betriebsfähigkeit,
3. Verbesserung der bestehenden Workflows mit klaren Steppings und Substeppings,
4. innovativen, aber realistisch umsetzbaren Verbesserungen,
5. einem priorisierten Phasenplan.

## Dokumentstruktur

1. `00_sicherungsstrategie_und_freigabegates.md`  
   Lokale Sicherheitskopien, Backup-Schema je Phase, Freigabe-Gates, Commit-/Push-Regel und persönliche Eingriffspunkte.

2. `01_problemfelder_luecken.md`  
   Präzise Zusammenfassung aller identifizierten Problemfelder, Risiken, Lücken und technischen Schulden.

3. `02_workflow_steppings_substeppings.md`  
   Analyse und Neudesign der zentralen Nutzer-, Patienten-, Admin-, Anamnese-, 2FA-, Therapie- und Betriebsworkflows.

4. `03_innovative_verbesserungen.md`  
   Innovative, praxisnahe Verbesserungen für UX, Patient Journey, Datensicherheit, KI-Unterstützung, Wissensmanagement und Betrieb.

5. `04_phasenplan_umsetzung.md`  
   Konkreter Phasen-/Schrittplan zur Stabilisierung, Absicherung und Weiterentwicklung.

6. `05_dsgvo_patientendaten_anamnese.md`  
   DSGVO-orientierte technische Vorbereitung für manuellen Download, späteren E-Mail-Versand und interaktive Anamneseübertragung mit Patientendaten.

## Executive Summary

Das Projekt ist funktional weit fortgeschritten: Es kombiniert eine öffentliche Praxiswebsite, einen Neupatienten-Fahrplan, Online-Anamnese, Login-/2FA-Flows, Adminbereich, Patientenverwaltung, Supabase-Datenbank/RLS, Edge Functions, PDF-Export, KI-gestützte ICD-10-/Therapie-Funktionen und umfangreiche Infothek-/Audio-/Dokumentinhalte.

Der aktuelle Zustand ist jedoch nicht gleichmäßig produktionsreif. Der Frontend-Build funktioniert, TypeScript kompiliert und die Startseite rendert lokal ohne Browserfehler. Gleichzeitig sind Clean Install, Tests und Lint rot bzw. defekt. Für eine Anwendung mit personenbezogenen Gesundheitsdaten ist das ein hoher Handlungsbedarf.

Die stärksten Prioritäten sind:

1. Reproduzierbarkeit herstellen: `npm ci` muss funktionieren.
2. Testsystem reparieren: `npm test` muss starten und relevante Kernflows abdecken.
3. Sicherheitsmodell vereinheitlichen: Router-Guards, Page-Guards, RLS und Edge-Function-Auth müssen als klare Matrix dokumentiert und getestet werden.
4. `.env` aus Git entfernen und Secret-Hygiene professionalisieren.
5. Edge Functions mit `verify_jwt=false` vollständig prüfen und härten.
6. Workflows intuitiver machen: klare Stepper, Statusanzeigen, automatische Speicherstände, verständliche Fehlerführung, Admin-Checklisten.
7. Große Dateien modularisieren, damit Wartung, Tests und Security-Review möglich werden.

## Wichtigste Befunde in einem Satz

Das Produkt hat eine starke fachliche Basis und viele wertvolle Funktionen, braucht aber vor weiterem Funktionsausbau zuerst eine technische und prozessuale Stabilisierung, damit Patienten-/Gesundheitsdaten sicher, reproduzierbar und wartbar verarbeitet werden.
