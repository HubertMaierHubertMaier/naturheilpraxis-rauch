---
name: Workload-/Honorar-Schätzer in Therapie-Eingabemasken
description: WorkloadBadge zeigt Seiten + Stunden + Honorar (100 €/h) bei großen Befundfeldern (Labor, Arztbrief, sonstige Voruntersuchungen, Perplexity). Annahme 2500 Zeichen/Seite, 8 min/Seite (Fach + Fremdsprache).
type: feature
---

## Zweck
Peter braucht für Patienten-Befund-Konvolute (10–15 Arzt-Auswertungen, oft EN/FR, 50–200+ Seiten) eine **transparente Aufwands- und Honorar-Schätzung**, die er dem Patienten zeigen kann.

## Komponente
`src/components/admin/therapy/WorkloadBadge.tsx`
- `WorkloadBadge` (inline, neben Feld-Label)
- `WorkloadTotal` (Block oben im Großdaten-Tab, summiert alle Felder)

## Kalkulationsbasis (verbindlich, nicht ohne Rückfrage ändern)
- `CHARS_PER_PAGE = 2500`
- `MIN_PER_PAGE = 8` (Lesen + medizinische Bewertung, Fremdsprachen-Aufschlag inkludiert → ca. 7,5 Seiten/Stunde)
- `HOURLY_RATE_EUR = 100`

→ Faustformel: ≈ 13 € pro Seite Sichtungs-/Auswertungsaufwand.

## Eingebunden in (`TherapyRecommendation.tsx`)
1. Tab **Labor** → `laborKomplett`
2. Tab **Arzt/NLS** → `arztbericht`
3. Tab **Großdaten** → `sonstigeUntersuchungen` + `perplexityAnalyse`
4. Tab **Großdaten** zusätzlich `WorkloadTotal` mit Summe aller großen Felder als Honorar-Basis-Ansage.

## Tooltip
Beim Hover über Badge: Zeichen, Seiten, min/Seite-Annahme, ergebende Stunden, Honorar 100 €/h, optionaler Hinweis (Fremdsprache etc.).
