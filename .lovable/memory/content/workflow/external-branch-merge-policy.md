---
name: External Branch Merge Policy
description: Merges von extern (lokal/GitHub) erstellten Branches nach main — Lovable kann nicht selbst mergen
type: preference
---

# Externe Branches & Merges nach main

**Hintergrund:** Lovable synchronisiert nur den `main`-Branch und kann keine `git merge`/`push`/`checkout` ausführen. Branches wie `stabilization/*`, `feature/*` etc., die per lokalem Git oder direkt auf GitHub committet werden (z. B. von `klaus999`), sind für Lovable unsichtbar, bis sie in `main` gemergt sind.

## Regel für Lovable-AI

1. **NIE behaupten** "Ich merge das jetzt." — Merges müssen vom User auf GitHub ausgeführt werden.
2. **Bei Merge-Anfrage** immer den Compare-Link liefern:
   `https://github.com/reddy67/naturheilpraxis-rauch/compare/main...<branch-name>`
3. **Inhaltsprüfung vor Freigabe:**
   - Hat der User eine Merge-Anforderungs-Doku angehängt? → diese als Quelle für Diff-Inhalt nutzen.
   - Sind kritische Pfade betroffen? → explizit warnen:
     - `src/integrations/supabase/client.ts` oder `types.ts` (auto-generated, nie manuell)
     - `.env` (Lovable-managed)
     - `supabase/config.toml` (nur function-blocks, keine project-level changes)
     - `supabase/functions/**` (DB/Edge-Logik — Review pflicht)
     - DB-Migrationen außerhalb Lovable
   - Reine Test-/Build-/Doku-Änderungen → Freigabe OK.
4. **Nach User-Merge:** 30–60 s warten, dann via `git log --oneline -5` im Sandbox prüfen, ob `main` aktualisiert ist (HEAD-SHA ändert sich, Tree-Inhalt entspricht Branch-HEAD).
5. **SHA-Mismatch ist normal:** Lovable rewriteet Commit-Hashes (eigener Committer/Timestamp). Vergleich immer über **Tree-Inhalt**, nicht SHA.

## Schnell-Template für Merge-Antwort

```
Ich kann nicht selbst mergen. Bitte auf GitHub ausführen:
1. https://github.com/reddy67/naturheilpraxis-rauch/compare/main...<BRANCH>
2. Create PR → Merge → Confirm
3. ~60s warten, dann Lovable refreshen
```
