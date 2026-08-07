# Diamond Shield Wiki und Pathogen-Mittel-Zuordnung

## Auftrag vom 26.07.2026

Peter moechte die Empfehlungen von `diamondshieldzapper.com` in der internen Wiki/Wissensdatenbank haben. Besonders wichtig ist die spaetere Zuordnung von Pathogenen zu passenden ChipCards und begleitenden Mitteln.

## Gepruefte Quellen

1. `https://diamondshieldzapper.com/diamond-shield-zapper-chipcards/`
2. Das dort verlinkte PDF `Sanftes Therapieren mit Biofrequenzen`, 15. Auflage 2025, 210 Seiten.

Die Website-Ueberschriften sind:

1. `Chipcards nach HP Alan Baklayan`
2. `NEU: Harmonisieren der Funktionen`
3. `Chipcards nach den 5 Elementen`
4. `Chipcards nach Dr. Hulda Clark`

Nur die Baklayan-Abschnitte enthalten im PDF konkrete begleitende Praeparate und Dosierungen. Die Harmonisierungs-, Fuenf-Elemente- und Clark-Bereiche enthalten Programm-/Katalogzuordnungen, aber keine eigenen Praeparatlisten.

## Umsetzung

- Migration: `supabase/migrations/20260726170000_seed_diamond_shield_wiki.sql`
- Parser: `src/components/admin/PathogenIndex.tsx`
- KI-Retrieval und Cancer-Quellenstand: `supabase/functions/therapy-recommend/index.ts`
- Test: `src/test/diamond-shield-pathogen-index.test.ts`

Die Migration ist idempotent nach exaktem Titel und seedet kompakte Eintraege bis maximal 3000 Zeichen. Sie enthaelt Begleitmittel, Website-Kataloge und eigene Pathogen-Mittel-Matrizen fuer Bakterien, Viren, Pilze und Parasiten. Alle medizinischen Zuordnungen sind als Hersteller-/Therapeutenangaben aus Erfahrungsheilkunde gekennzeichnet.

Der Pathogenindex erkennt jetzt Tabellen unter `## Pathogen-Mittel-Zuordnung` mit:

`Pathogen | Gruppe | Mittel | Zuordnung / Quelle | Anwendung`

Das alte `Wirkspektrum`-Format bleibt erhalten.

## Verifikation

- Gezielter Test: 3/3 erfolgreich.
- Gesamttest: 84/84 erfolgreich.
- TypeScript: erfolgreich.
- Produktionsbuild: erfolgreich.
- `git diff --check`: erfolgreich.

## Noch nicht live

Die Aenderungen sind lokal. Sie wurden nicht committed, gepusht oder auf die laufende Supabase-Datenbank angewendet. In der Sitzung war kein `SUPABASE_ACCESS_TOKEN` gesetzt und keine lokale Supabase-Verknuepfung vorhanden.

Vor einer Live-Bestaetigung:

1. Migration autorisiert ausrollen.
2. Als Admin `/wissensdatenbank` oeffnen.
3. Die vier Diamond-Shield-Kategorien und den exakten Eintrag `Diamond Shield – Begleitprotokoll bei Cancer` pruefen.
4. Im Pathogenindex Stichproben fuer Borrelia/Samento, EBV/Takuna, Candida/Cumanda, Clostridien/Oregano und MRSA/Banderol pruefen.
5. Eine Therapie-KI-Testanfrage mit einem Bakterium, Virus, Pilz und Parasiten ausfuehren und den Wiki-Audit kontrollieren.
