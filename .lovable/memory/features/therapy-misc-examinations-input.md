---
name: Therapie-Empfehlung — Eingabe für gemischte Voruntersuchungen
description: Zusätzliches Freitext-/Upload-Feld in TherapyRecommendation für unsortierte Patienten-Voruntersuchungen (Labor + sonstige Befunde gemischt)
type: feature
---

## Anforderung (Peter, 2026-06-08)

Im Therapie-Empfehlungs-Tool (`src/components/admin/TherapyRecommendation.tsx`) gibt es bisher:
- Patienten-Pseudonym laden/neu
- Beschwerden, Pathogene, Laborwerte (über `LabImageUpload` / `extract-lab-image`)
- Wiki-Boost, bevorzugte Mittel
- Generierung via `therapy-recommend` (Gemini)

**Fehlt:** Ein zusätzlicher Eingabebereich für **gemischte/unsortierte Voruntersuchungen** des Patienten — Fälle, in denen Befunde NICHT sauber in Labor vs. sonstige Diagnostik (Bildgebung, Funktionstests, Arztbriefe, NLS-Berichte, EAV-Messungen, etc.) getrennt vorliegen.

## Umsetzungs-Skizze (bei Implementierung)

1. Neues Feld `misc_examinations` (Textarea, mehrzeilig, optional) im Therapy-Form.
2. Optional: Mehrfach-Upload (PDF/Bild) → OCR/Vision via Gemini → Text-Extrakt einsortieren.
3. Inhalt fließt als zusätzlicher Kontextblock in den `therapy-recommend`-Prompt ein (eigener Abschnitt "Vorhandene Voruntersuchungen — unstrukturiert").
4. Persistenz in `therapy_sessions.session_data` (JSON), damit beim Reload der Pseudonym-Session vorhanden.
5. NLS-Disclosure-Logik (Memory: `nls-befund-disclosure`) prüfen — wenn unsortierte Befunde NLS-Hinweise enthalten, ebenfalls Patienten-PDF-Hinweis triggern.

**How to apply:** Bei nächster Iteration an TherapyRecommendation diesen Punkt mit-implementieren. Nicht eigenmächtig jetzt schon umsetzen — User signalisiert nur „merken".
