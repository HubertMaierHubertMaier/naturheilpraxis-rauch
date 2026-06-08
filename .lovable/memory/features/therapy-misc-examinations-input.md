---
name: Therapie-Empfehlung — Eingabe für gemischte Voruntersuchungen
description: Freitext-Feld `sonstigeUntersuchungen` in TherapyRecommendation für unsortierte Patienten-Voruntersuchungen (Bildgebung, EAV/NLS, Selbstmessungen, Fremdberichte) — implementiert 2026-06-08
type: feature
---

## Status: IMPLEMENTIERT (2026-06-08)

Im Therapie-Empfehlungs-Tool (`src/components/admin/TherapyRecommendation.tsx`) gibt es ein neues Eingabefeld `sonstigeUntersuchungen` (Textarea, mehrzeilig, optional) unter dem Metatron/HEEL-Block.

**Zweck:** Auffangbecken für gemischte/unstrukturierte Befunde, die nicht sauber in Labor / Stuhlbefund / Arztbrief passen — Bildgebung (MRT/CT/Sono), EKG/Lufu, Allergie-/Funktionstests, Knochendichte, Bioresonanz/EAV, NLS-Auswertungen, Kur-/Reha-Berichte, Selbstmessungen (RR/HRV/CGM), ältere Fremdbefunde.

## Datenfluss

1. **State** in TherapyRecommendation: `sonstigeUntersuchungen` (string).
2. **Persistenz** in `buildInputData`, sessionStorage-Draft, localStorage-Draft pro Pseudonym, Cloud-Draft (`therapy_sessions.eingabe_daten`), `handleLoadSession`, applyDraftPayload, Cloud-merge stringKeys.
3. **Edge-Function `therapy-recommend`:**
   - Destructure aus Body
   - `sonstigeUntersuchungenText` als trimmed string
   - In `queryText` für Wiki-Suche (Boost auf relevante Wiki-Einträge)
   - In `patientInfo`-Array
   - Eigener Prompt-Abschnitt **6c** mit klarer Sortier-Anweisung an die KI (gesicherte Schulmedizin vs. Resonanz vs. Selbstmessung)
4. **LiveInputSummary** zeigt den Block separat mit `ClipboardList`-Icon (indigo).

## Wichtig

- NLS-Disclosure-Logik (Memory: `nls-befund-disclosure`) bleibt aktiv — sobald NLS-Hinweise in dem Feld stehen, sollte das Patienten-PDF die Quelle ausweisen.
- KEIN OCR/Upload in diesem Feld (bewusste Entscheidung — User soll selbst sortieren bzw. abtippen). Falls später OCR gewünscht: separater `LabImageUpload`-Mode `"misc"` möglich.
