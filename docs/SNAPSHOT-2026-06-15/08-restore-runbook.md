# 08 — Restore-Runbook (Schritt-für-Schritt)

## Voraussetzungen für vollständige Wiederherstellung

- ✅ Zugriff auf GitHub-Repo (oder lokales ZIP des Codes)
- ✅ Lovable-Account
- ✅ Zugriff auf Passwort-Manager mit SMTP/ElevenLabs/RELAY-Secrets
- ✅ Optional: Datenbank-CSV-Exporte aus Cloud (falls Patientendaten erhalten bleiben sollen)
- ✅ Optional: Storage-Bucket-Exporte

---

## Szenario A — GitHub-Sync vorhanden (Idealfall)

### A1. Neues Lovable-Projekt anlegen
1. https://lovable.dev → „New Project"
2. Name: `Naturheilpraxis Peter Rauch (Restore YYYY-MM-DD)`
3. Lovable Cloud aktivieren (Plus-Menü → Cloud → Enable)

### A2. GitHub-Repo verbinden
1. Plus-Menü → GitHub → Connect project
2. Bestehendes Repo auswählen → Code wird automatisch synchronisiert
3. Migrationen unter `supabase/migrations/` laufen automatisch bei erstem Deploy
4. Edge Functions deployen automatisch

### A3. Secrets setzen
Chat-Befehl: „Bitte setze folgende Secrets: SMTP_HOST=..., SMTP_USER=..., SMTP_PASSWORD=..., RELAY_SECRET=..., ELEVENLABS_API_KEY=..., SMTP_PORT=587"
(LOVABLE_API_KEY und alle SUPABASE_* werden automatisch durch Cloud gesetzt.)

### A4. Auth konfigurieren
1. Cloud-Auth-Settings öffnen
2. HIBP-Password-Check aktivieren
3. Email-Confirm aktivieren (KEIN Auto-Confirm)
4. Optional: Google-Provider (Client-ID/Secret aus Backup)

### A5. Storage-Buckets anlegen
Drei private Buckets:
- `anamnesis-pdfs` (private)
- `patient-library` (private)
- `therapy-documents` (private)

Bucket-Inhalte aus Backup hochladen.

### A6. Verifikation
```bash
# Hash-Vergleich mit Snapshot-Inventar
cd <projekt-root>
sha256sum src/components/admin/TherapyRecommendation.tsx
# muss matchen mit docs/SNAPSHOT-2026-06-15/09-file-inventory.txt
```

### A7. Smoke-Test
- `/` lädt
- `/auth` → Login mit Admin-Test-Account
- `/admin` → Therapy Recommendation öffnet ohne Fehler
- Edge Function `check-hp-therapy` via Test-Patient triggern

---

## Szenario B — Nur dieser Snapshot vorhanden (Worst Case)

Wenn weder GitHub noch Code-ZIP vorhanden ist, ist eine **exakte** Rekonstruktion **nicht möglich** —
der TypeScript-Code aller Komponenten ist nicht in dieser Doku enthalten (zu umfangreich, ~270 Dateien).

**Möglich** ist eine funktionale Neukonstruktion durch Lovable AI:
1. Neues Lovable-Projekt + Cloud aktivieren
2. Diese 10 Snapshot-Dateien in das Projekt-Verzeichnis `docs/SNAPSHOT-2026-06-15/` legen
3. Im Chat: „Bitte rekonstruiere das gesamte Projekt nach den Spezifikationen in `docs/SNAPSHOT-2026-06-15/`. Beginne mit dem Datenbank-Schema (`02-database.md`), dann Edge Functions (`03-edge-functions.md`), dann Frontend (`04-frontend-features.md`). Folge dem Auth-Modell aus `01-architecture.md` und den Sicherheitsvorgaben aus `06-security-and-secrets.md`."
4. Schritt-für-Schritt iterieren

**Realität:** Diese Rekonstruktion wird **funktional äquivalent**, aber **nicht bit-genau** sein. Deshalb ist GitHub-Sync nicht verhandelbar.

---

## Szenario C — Nur DB ist kaputt, Code OK

1. Cloud-Dashboard → Database → alle Tabellen droppen (Vorsicht!)
2. Migrationen unter `supabase/migrations/` neu ausführen (Lovable macht das automatisch beim nächsten Deploy, sonst `supabase db push`)
3. Optional: CSV-Backups einlesen pro Tabelle

---

## Szenario D — Nur einzelne Datei verloren

Lovable History (Chat oben → History) → letzte funktionierende Version wählen → Revert.

---

## Verifikations-Checkliste nach Restore

- [ ] `/` lädt (Startseite mit Hero, Welcome-Selection)
- [ ] `/impressum`, `/datenschutz`, `/faq` lädt
- [ ] Login funktioniert (2FA-Code kommt per Mail an)
- [ ] Admin-Login → `/admin` → alle Tabs sichtbar
- [ ] Anamnesebogen `/anamnesebogen-demo` lässt sich ausfüllen + absenden (Demo-Mode)
- [ ] Therapy Recommendation: Pseudonym wählen, KI-Empfehlung läuft durch
- [ ] `check-hp-therapy` Edge Function liefert Antwort
- [ ] PDF-Export funktioniert
- [ ] E-Mail-Versand via PHP-Relay funktioniert (Test-Mail an Admin)
- [ ] Patient-Library lädt für Verified Patient
- [ ] Hypnose-Audio-Player spielt MP3 ab

## Bei Problemen

- Console-Logs prüfen (F12 → Console)
- Edge-Function-Logs in Cloud-Dashboard
- DB-Linter: `supabase/linter` Tool aufrufen
- Im Lovable-Chat: „Bitte führe einen Security-Scan durch"
