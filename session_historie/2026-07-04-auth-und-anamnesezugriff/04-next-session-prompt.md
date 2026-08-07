# 04 Next Session Prompt

## Aktueller Stopppunkt

Diese Session wurde bewusst nach dem Phase-1-Block beendet.

Fakten zum Stand beim Session-Ende:

1. Lovable/GitHub hat den Phase-1-Redirect-Restore-Fix bereits auf `origin/main`.
2. Letzter verifizierter Remote-Commit: `ddd5be6` `Phase-1-Redirect-Restore fix`.
3. Lokaler Branch steht noch auf `170cd05` und ist nach `git fetch origin` `behind 12`.
4. Lokal gibt es zusaetzlich uncommittete Arbeiten aus Phase 0, Phase 3 und einem kleinen Phase-5-Microfix.
5. Deshalb sind Lokal und GitHub/Lovable beim Session-Ende **nicht** im gleichen Stand.

Remote-/Lovable-Referenz fuer Phase 1:

1. `src/lib/authRedirect.ts`
2. `src/pages/Auth.tsx`
3. `src/pages/PatientDashboard.tsx`
4. `src/test/auth-redirect.test.ts`

Lokale, noch nicht nach GitHub/Lovable synchronisierte Arbeiten:

1. `README.md`
2. `docs/analysis-2026-07-04/00-index.md`
3. `docs/database-backup-2026-03-01.md`
4. `src/lib/securityAccessMatrix.ts`
5. `supabase/functions/request-verification-code/index.ts`
6. `supabase/functions/submit-anamnesis/index.ts`
7. `supabase/functions/verify-code/index.ts`
8. `supabase/functions/_shared/verificationCode.ts`
9. `supabase/migrations/20260704211000_hash_verification_codes.sql`

Hinweis:

Die lokale Worktree-Datei `session_historie/opencode-session-export-ses_0d3900feeffet3OK5n4u2Bjtpu-20260704-200517.json` ist nur ein Session-Export-Artefakt und nicht Teil der fachlichen Umsetzung.

## Exakter Prompt Fuer Die Naechste Session

```text
Arbeite im Repository `C:\Users\Administrator\Documents\Lovable\OpenCode\naturheilpraxis-rauch` weiter und setze exakt am Ende der letzten Session an.

Wichtiger Ausgangspunkt:

1. Die letzte Session wurde bewusst nach Abschluss des Phase-1-Blocks in Lovable beendet.
2. Auf GitHub/Lovable ist Phase 1 bereits im Remote-Commit `ddd5be6` `Phase-1-Redirect-Restore fix` vorhanden.
3. Der lokale Checkout ist beim Start dieser Session noch **nicht** mit `origin/main` synchron und war zuletzt `behind 12`.
4. Zusaetzlich liegen lokal uncommittete Arbeiten aus Phase 0, Phase 3 und einem kleinen Phase-5-Microfix.
5. Deshalb darfst Du **keine** Annahme treffen, dass Lokal und GitHub/Lovable aktuell denselben Stand haben.

Verbindliche Arbeitsweise fuer diese Session:

1. Zuerst den Codebestand und den Git-/Remote-Stand exakt untersuchen.
2. **Keine** destruktiven Git-Befehle verwenden.
3. **Kein** `git reset --hard`, **kein** `git checkout --`, **kein** blindes `git pull`, **kein** Rebase ohne ausdrueckliche Freigabe.
4. Vorhandene lokale Aenderungen nicht verwerfen.
5. Phase 1 nicht neu erfinden, sondern den Stand zwischen Lokal und `origin/main` sauber einordnen.

Erste Pflichtschritte:

1. `git status --short --branch`
2. `git log --oneline --decorate -15 --all`
3. `git diff --stat origin/main -- src/pages/Auth.tsx src/pages/PatientDashboard.tsx src/lib/authRedirect.ts src/test/auth-redirect.test.ts`
4. den lokalen Stand gegen `origin/main` fuer die Phase-1-Dateien fachlich vergleichen
5. den lokalen Stand gegen die noch uncommitteten Phase-0/3-Dateien fachlich abgrenzen

Ziel von Block A:

Den exakten Sync-Zustand zwischen:

1. lokalem Worktree
2. lokalem HEAD
3. `origin/main`
4. dem bereits in Lovable umgesetzten Phase-1-Block

sauber herausarbeiten, ohne irgendetwas stillschweigend zu verwerfen.

Wenn die Phase-1-Dateien zwischen Lokal und `origin/main` inhaltlich auseinanderlaufen:

1. Unterschiede praezise benennen
2. nur die kleinste sichere Angleichung vornehmen
3. lokale Phase-0/3-Arbeiten nicht beschaedigen

Nach der Sync-Klaerung und nur wenn der Stand verstanden ist:

Mit **Phase 2** weitermachen.

Phase-2-Ziel fuer die naechste Session:

1. `patient_access.note` nicht mehr an Patientenclients ausliefern
2. die Freigabelogik zwischen `patient_access` und `profiles.is_verified_patient` weiter konsolidieren
3. zuerst auf den patientenseitigen Zugriffspfaden anfangen, insbesondere rund um `usePatientAccess`, die effektive Access-Rueckgabe und die Bibliothek-/Anamnese-Gates

Lokale Dateien mit bereits vorhandenem Phase-0/3-Arbeitsstand, die besonders vorsichtig behandelt werden muessen:

1. `README.md`
2. `docs/analysis-2026-07-04/00-index.md`
3. `docs/database-backup-2026-03-01.md`
4. `src/lib/securityAccessMatrix.ts`
5. `supabase/functions/request-verification-code/index.ts`
6. `supabase/functions/submit-anamnesis/index.ts`
7. `supabase/functions/verify-code/index.ts`
8. `supabase/functions/_shared/verificationCode.ts`
9. `supabase/migrations/20260704211000_hash_verification_codes.sql`

Akzeptanz fuer den ersten Arbeitsblock der neuen Session:

1. Der Sync-Stand zwischen Lokal und `origin/main` ist sauber dokumentiert.
2. Es ist klar, welche Phase-1-Aenderungen bereits auf GitHub/Lovable liegen und welche lokalen Aenderungen davon abweichen.
3. Es wurde nichts unbemerkt verworfen.

Wenn danach Phase 2 umgesetzt wird, am Ende wieder lokal ausfuehren:

1. `npm test`
2. `npm run build`
3. `npx tsc -p tsconfig.app.json --noEmit`
4. `npx tsc -p tsconfig.node.json --noEmit`

Berichte am Ende der neuen Session knapp und praezise:

1. Sync-Befund Lokal vs. `origin/main`
2. konkret geaenderte Dateien
3. Gate-Status
4. offener Rest fuer die naechste Phase
```
