# Deploy: backup-export (Commit dc541d7)

Arbeitsstand ist bereits exakt `dc541d7` ("Fix backup export resource limits"), `supabase/functions/backup-export/index.ts` liegt mit 877 Zeilen vor.

## Auszuführen

- Deploy ausschließlich der Edge Function `backup-export` aus dem vorliegenden Stand.
- Danach read-only Verifikation: Deploy-Status und ein OPTIONS/Preflight-Check gegen die Funktion (keine Datenabfrage, kein Export-Lauf).

## Ausdrücklich nicht

- Keine Migration, kein Import, keine DB-Änderung.
- Keine weiteren Edge Functions, kein Git-Kommando, kein Publish des Frontends.
