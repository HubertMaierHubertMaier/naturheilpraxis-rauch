---
name: Therapie-Empfehlung — Eingabe für gemischte Voruntersuchungen + Perplexity-Recherche
description: Zwei Freitextfelder in TherapyRecommendation — `sonstigeUntersuchungen` (gemischte Befunde, 5–60 Seiten) und `perplexityAnalyse` (externe AI-Recherche). Vollständige Verarbeitung, Datumsextraktion, tiefenpräzise Differentialdiagnostik.
type: feature
---

## Status: IMPLEMENTIERT (2026-06-08, erweitert)

### Felder im Therapie-Empfehlungs-Tool (`src/components/admin/TherapyRecommendation.tsx`)

1. **`sonstigeUntersuchungen`** — Textarea (rows=12). Auffangbecken für gemischte/unstrukturierte Befunde: Bildgebung (MRT/CT/Sono), EKG/Lufu, Allergie-/Funktionstests, Knochendichte, Bioresonanz/EAV, NLS-Auswertungen, Kur-/Reha-Berichte, Selbstmessungen, ältere Fremdbefunde. **Darf 5–60+ Seiten lang sein.**
2. **`perplexityAnalyse`** — Textarea (rows=10). Externe AI-Recherche / Perplexity-Auswertung / PubMed / S3-Leitlinien / Cochrane / Lehrbuch-Exzerpte.

Beide Felder zeigen einen Zeichen-Counter im Label; bei >80.000 Zeichen erscheint ein Hinweis "sehr groß → Pro-Modell aktivieren".

## Datenfluss (verbindlich, kein Trimmen)

1. **State** in TherapyRecommendation: `sonstigeUntersuchungen`, `perplexityAnalyse` (string).
2. **Persistenz** in `buildInputData`, sessionStorage-Draft, localStorage-Draft pro Pseudonym, Cloud-Draft (`therapy_sessions.eingabe_daten`), `handleLoadSession`, applyDraftPayload, Cloud-merge stringKeys.
3. **Edge-Function `therapy-recommend`:**
   - Beide aus Body destructured, als trimmed strings
   - In `queryText` für Wiki-Suche (Boost auf relevante Wiki-Einträge)
   - In `patientInfo`-Array mit Zeichenangabe
   - Eigene Prompt-Abschnitte **6c** (sonstige) und **6d** (Perplexity) mit verbindlicher Lese- und Auswertungs-Anweisung
   - **Kein Trimmen** des Patienten-Kontexts — bei >80k Zeichen Total wird `console.warn` mit Empfehlung Pro-Modell ausgegeben (Gemini-Pro hat 1M Token Kontext)
   - Meta-Block: `sonstigeUntersuchungenChars`, `perplexityAnalyseChars`
4. **LiveInputSummary** zeigt beide Blöcke separat mit Icon (indigo: `ClipboardList` für sonstige, teal: `Search` für Perplexity).

## Verbindliche Prompt-Regeln (Edge-Function)

### Block 6c — Sonstige Voruntersuchungen
- **VOLLSTÄNDIG lesen** — kein Stichproben, kein Überfliegen. Bei Kontextlimit explizit als "⚠️ Kontextlimit erreicht" melden.
- **Datums-Extraktion (PFLICHT)**: jedes Untersuchungsdatum aus Freitext (TT.MM.JJJJ, „März 2024", „vor 2 Jahren" …) erkennen, Befund + Datum + Typ zuordnen.
- Output-Sektion **🗂️ Voruntersuchungen – chronologische Auswertung**: chronologisch sortiert (neueste zuerst), pro Befund Format `**[Datum] – [Typ]** → Befund / Therapierelevanz / Einordnung (a/b/c)`.
- Klassifikation: (a) gesicherter schulmed. Befund, (b) Resonanz (EAV/NLS/Bioresonanz), (c) Verlaufs-/Selbstmessung — jede Gruppe unterschiedlich gewichtet.

### Block 6d — Perplexity-Recherche
- **VOLLSTÄNDIG lesen**.
- Differentialdiagnosen daraus übernehmen + gewichten.
- Studien/Leitlinien dürfen zitiert werden (immer mit Originalquelle, z.B. „PMID xxxxxxxx", „S3-LL DGP 2023").
- **Wiki-Vorrang**: Mittel, die nur in der Recherche, nicht im Wiki stehen → als `💡 Recherche-Anregung` markieren, NICHT als Hauptmittel empfehlen.
- Widersprüche transparent machen — Wiki gewinnt im Zweifel.
- Anti-Halluzinations-Regel.

### Output-Sektion **🔎 Differentialdiagnostik (vertieft)** — PFLICHT
Sobald 6c oder 6d Inhalt haben: mindestens 3–6 Differentialdiagnosen mit ICD-10 (sofern möglich), Wahrscheinlichkeit, Dafür/Dagegen-Befunden, zusätzlich nötigen Untersuchungen, naturheilkundlicher Konsequenz.

## Wichtig

- NLS-Disclosure-Logik (Memory: `nls-befund-disclosure`) bleibt aktiv.
- KEIN OCR/Upload in diesen Feldern — User soll selbst sortieren / einfügen.
- Bei sehr großen Eingaben: Empfehlung Pro-Modell (`useProModel`) — Gemini-2.5-Pro statt Flash.
