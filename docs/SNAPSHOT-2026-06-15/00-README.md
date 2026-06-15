# 📦 SNAPSHOT 2026-06-15 — Vollständiger Wiederherstellungspunkt

**Erstellt:** 15. Juni 2026
**Projekt:** Naturheilpraxis Peter Rauch (Lovable Cloud Projekt-Ref: `jmebqjadlpltnqawoipb`)
**Zweck:** Bit-genaue Rekonstruktion bei totalem Verlust.

---

## ⚠️ Quellen der Wahrheit (Priorität von oben nach unten)

1. **GitHub-Repository** (falls verbunden) — vollständiger Code inkl. aller Migrationen unter `supabase/migrations/`. Das ist das **eigentliche Backup**.
2. **Lovable History** (Chat oben → History-Tab) — jederzeit zurückrollbare Snapshots.
3. **Diese Snapshot-Doku** — Bauanleitung und Inventar, falls 1 + 2 nicht verfügbar sind.

> **Dringende Empfehlung:** Wenn GitHub noch nicht verbunden ist, JETZT verbinden:
> Plus-Menü (+) im Chat → GitHub → Connect project.

---

## 📁 Inhalt dieses Snapshots

| Datei | Inhalt |
|---|---|
| `00-README.md` | Diese Übersicht + Wiederherstellungs-Reihenfolge |
| `01-architecture.md` | Tech-Stack, Routing, Auth-Flow, Edge-Function-Topologie |
| `02-database.md` | Alle Tabellen + Verweis auf 61 Migrations-Dateien als Quelle der Wahrheit |
| `03-edge-functions.md` | Alle 19 Edge Functions: Zweck, Inputs, Secrets, JWT-Status |
| `04-frontend-features.md` | Feature-Map inkl. neuester Therapy-Recommendation-Erweiterungen |
| `05-workflows.md` | Anamnese-, IAA-, Therapie-, 2FA-Flows |
| `06-security-and-secrets.md` | Secret-Namen, RLS-Matrix, 2FA |
| `07-assets-and-pdfs.md` | Infothek-HTMLs, PDFs, Build-Skripte |
| `08-restore-runbook.md` | **Schritt-für-Schritt Wiederherstellung von Null** |
| `09-file-inventory.txt` | 269 Dateien mit SHA-256-Hash + Größe (Verifikation nach Restore) |

---

## 🆕 Neu seit letztem Snapshot (2026-06-07)

- **Therapy Recommendation** komplett erweitert:
  - Apotheker-Rezept-Feld + OCR-PDF-Upload via `MultiDocUpload`
  - Zusatz-Therapie-Feld (z. B. Stuhlanalyse-Empfehlungen)
  - Neue Edge Function `check-hp-therapy` für KI-Sinnhaftigkeits-Check
  - HTML-Export (neuer Tab + Download), PDF-Export, Befund-Speicherung in `therapy_sessions` (kind=`befund_auswertung`)
  - `LiveInputSummary` mit Sprung-Button zum KI-Check-Bereich
  - Pflicht-Evaluation des Apotheker-Rezepts (≥5 Zeichen) in Section 3 des Prompts
- **DB-Erweiterung** `therapy_sessions`: `befund_html`, `befund_meta`, `version_number`, `version_label`, `parent_session_id`
- **Neue DB-Functions**: `get_therapy_sessions_safe_list`, `get_therapy_session_safe_detail`, `compact_therapy_session_input`, `extract_patient_snapshot_fields`, `upsert_therapy_autosave_draft`, `assign_therapy_session_version`, `prevent_therapy_session_patient_mismatch`, `update_patient_snapshot_from_session`
- **Neue Tabelle** `patient_snapshot` (PII-armer Schnellzugriff)
- **Vite-Production-Fallbacks** in `vite.config.ts` gegen White-Screen
- **PII-Scrubbing** in `analyze-documents`

---

## ✅ Was NICHT im Snapshot ist (mit Begründung)

| Nicht enthalten | Begründung | Alternative |
|---|---|---|
| Patientendaten (`therapy_sessions`, `anamnesis_submissions`, `iaa_submissions`, `profiles`) | DSGVO, 10-Jahres-Aufbewahrung, niemals in Repo | Cloud → Database → Tabelle → CSV-Export |
| Secret-Werte | Security-Policy | Vor Restore neu erzeugen / aus Passwort-Manager |
| Storage-Bucket-Inhalte (`anamnesis-pdfs`, `patient-library`, `therapy-documents`) | Binär, sensibel | Cloud → Storage → Bucket-Export |
| `auth.users` | Verwaltet durch Supabase Auth | User-Liste manuell exportieren falls nötig |

---

## 🔄 Wiederherstellungs-Reihenfolge (Kurzfassung)

1. GitHub-Repo klonen → Code wiederhergestellt
2. Neues Lovable-Projekt anlegen + Lovable Cloud aktivieren
3. Repo via GitHub mit dem neuen Projekt verbinden
4. Alle 61 Migrationen aus `supabase/migrations/` laufen automatisch
5. Secrets manuell setzen (Liste in `06-security-and-secrets.md`)
6. Edge Functions deployen automatisch beim ersten Build
7. Verifikation via `09-file-inventory.txt` (SHA-256 prüfen)

**Detail-Anleitung:** siehe `08-restore-runbook.md`.
