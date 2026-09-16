# Homöopathie-Modul (Oberfläche)

Neue, isolierte Dateien. Keine Änderung an bestehenden Dateien, Routing, Auth, DB oder Paketen.

- `core.ts` — unveränderte Engine von Sorra (deterministisch, `repertorize`, `assertCurrentHomeopathyResult`).
- `labels.ts` — Beschriftungen/Badge-Stile, Originalgrad-Formatierung (keine Prozent-Passung).
- `FactsPanel.tsx` — Schritt 1 Fallangaben (Symptom/Modalität/Erkrankung/IAA, Aussagezustand sichtbar).
- `RubricBindingPanel.tsx` — Schritt 2 Repertorien/Rubriken, Suche auf 40 Treffer begrenzt, mehrere Rubriken je Angabe, Bestätigung + Gewichtung 1–10.
- `CandidateCard.tsx` — Schritt 3/4 je Mittel: Begründung, Angaben, Rubrik, Originalgrad, Fundstelle, Zitat, Potenz/Einnahme je Quelle.
- `HomeopathyModule.tsx` — Rahmen, Auswertung, Statuszustände, Ergebnis-Sperre bei Fall-/Revisionswechsel.

## Einbindung (durch Sorra, nicht ausgeführt)

```tsx
import { HomeopathyModule } from "@/features/homeopathy";

<HomeopathyModule
  patientId={pseudonym}            // pseudonymisierte Fallkennung, kein Name
  inputRevision={inputRevision}
  facts={facts}                    // aus vorhandenem Aufnahme-/IAA-Weg
  bindings={bindings}
  onBindingsChange={setBindings}   // Persistenz liegt beim Aufrufer
  catalog={catalog}                // leerer Katalog => ehrlicher Hinweis statt Schein-Auswertung
  onEvaluated={(result) => {/* optional speichern, admin_only */}}
  onAdoptCandidate={(candidate) => {/* optional in Fallnotiz */}}
  isLoading={loading}
  loadError={loadError}
/>
```

Voraussetzungen für die Integration:
1. Geschützter Admin-Kontext (Route/Guard wie `/therapie-kandidaten`); die Kennzeichnung `admin_only` ersetzt keine Zugriffskontrolle.
2. Katalog-Lieferung (`sources`, `rubrics`, `remedies`, `entries`, `administrations`, `version`) aus der internen Wissensbasis — ohne geladene Daten bleibt das Modul bewusst leer.
3. Persistenz von `bindings` und optional des Ergebnisses inkl. `patientId` + `inputRevision`.
4. Kein KI-Aufruf, kein Publish, keine Patientenfreigabe aus diesem Modul.
