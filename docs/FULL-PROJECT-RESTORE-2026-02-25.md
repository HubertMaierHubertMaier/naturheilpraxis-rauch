# Naturheilpraxis Peter Rauch – Complete Project Restore Point

**Date:** 2026-02-25
**Project:** Patient App & Practice Management System
**Version:** 1.1.0 (Produktiv – SMTP Mail-Relay V3)

## Änderungen seit letztem Restore (2026-02-22)

| Datum | Änderung |
|-------|----------|
| 2026-02-25 | Mail-Relay V3 (SMTP Auth) – ersetzt `mail()` durch authentifiziertes SMTP via `fsockopen` |
| 2026-02-25 | Chunked `fwrite()` für PDF-Anhänge (8KB Chunks) – verhindert unvollständige Übertragung |
| 2026-02-25 | `supabase/functions/_shared/smtp.ts` – Shared E-Mail-Utility via PHP-Relay |
| 2026-02-25 | `submit-anamnesis` – Nutzt `_shared/smtp.ts`, sendet PDF an Praxis + Patient |
| 2026-02-25 | `request-verification-code` – Nutzt `_shared/smtp.ts` statt direktem Relay-Aufruf |
| 2026-02-25 | Ghost-User Cleanup bei Registrierung (unbestätigte Accounts werden gelöscht) |
| 2026-02-25 | AuthContext mit `isAdmin` Feld und robusterem Init-Flow |

## Restore-Dokumentation (aufgeteilt in 5 Teile)

| Teil | Datei | Inhalt |
|------|-------|--------|
| 1 | [01-overview-and-config.md](restore/01-overview-and-config.md) | Tech Stack, ENV, Dependencies, Configs |
| 2 | [02-database-schema.md](restore/02-database-schema.md) | Alle Tabellen, Enums, RLS Policies, Functions |
| 3 | [03-frontend-core.md](restore/03-frontend-core.md) | App.tsx, AuthContext, ProtectedRoute, LanguageContext |
| 4 | [04-edge-functions.md](restore/04-edge-functions.md) | Alle Edge Functions + _shared/smtp.ts (komplett) |
| 5 | [05-styling-and-design.md](restore/05-styling-and-design.md) | index.css, tailwind.config.ts, Design System |
| 6 | [06-mail-relay-php.md](restore/06-mail-relay-php.md) | PHP Mail-Relay V3 SMTP (Server-seitig) |

## Server-Infrastruktur

| Komponente | Pfad / URL |
|-----------|------------|
| Mail-Relay PHP | `/var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php` |
| Relay-Quellcode | `docs/mail-relay-v3-smtp.php` (im Repo) |
| Relay-Version | `2026-02-25-v3-smtp` |
| SMTP-Auth | `info@rauch-heilpraktiker.de` über Port 587 (STARTTLS) |
| Debug-Log | `/var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-debug.log` |

## Kritische Secrets

| Secret | Speicherort | Verwendung |
|--------|-------------|------------|
| `RELAY_SECRET` | Lovable Cloud Secrets + PHP-Relay | `[REDACTED - vor Verwendung rotieren]` |
| `SUPABASE_SERVICE_ROLE_KEY` | Lovable Cloud Secrets | Edge Functions Admin-Zugriff |
| `SMTP_PASS` | PHP-Relay auf Server | Postfach-Passwort `info@rauch-heilpraktiker.de` |

## Edge Functions (4 Stück)

| Function | Pfad | Beschreibung |
|----------|------|--------------|
| `request-verification-code` | `supabase/functions/request-verification-code/index.ts` | Login/Registrierung/Passwort-Reset: Code generieren + per E-Mail senden |
| `verify-code` | `supabase/functions/verify-code/index.ts` | Code verifizieren, E-Mail bestätigen, Magic-Link für Login |
| `submit-anamnesis` | `supabase/functions/submit-anamnesis/index.ts` | Anamnesebogen: Submit + Confirm mit PDF-Versand |
| `send-verification-email` | `supabase/functions/send-verification-email/index.ts` | Legacy: Direkter SMTP-Versand (denomailer) – wird nicht mehr aktiv genutzt |

## Shared Module

| Modul | Pfad | Beschreibung |
|-------|------|--------------|
| `smtp.ts` | `supabase/functions/_shared/smtp.ts` | Shared E-Mail-Versand via PHP-Relay mit Attachment-Fallback |

## Schnelle Wiederherstellung

1. **Datenbank:** SQL aus `docs/restore/02-database-schema.md` ausführen
2. **Edge Functions:** Dateien in `supabase/functions/` werden automatisch deployed
3. **Frontend:** `npm install && npm run build`
4. **Secrets:** `RELAY_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` in Lovable Cloud setzen
5. **Mail-Relay:** `docs/mail-relay-v3-smtp.php` auf Server kopieren als `/var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php`
6. **SMTP-Passwort:** In der PHP-Datei auf dem Server `$SMTP_PASS` setzen

## GitHub-Verbindung

Für einen vollständigen Download aller Dateien:
1. Klicke auf den **Projektnamen** (oben links)
2. → **Settings** → **GitHub** → **Connect project**
3. Nach dem Verbinden: `git clone <repo-url>`

## Vollständige Dateistruktur

```
├── docs/
│   ├── FULL-PROJECT-RESTORE-2026-02-25.md (diese Datei)
│   ├── PROJECT-DOCUMENTATION.md
│   ├── design-specification.md
│   ├── mail-relay-v2.php (alt, Backup)
│   ├── mail-relay-v2.php.old (alt, Backup)
│   ├── mail-relay-v3-smtp.php (AKTUELL – auf Server kopieren)
│   ├── send-email-relay.php (alt)
│   └── restore/
│       ├── 01-overview-and-config.md
│       ├── 02-database-schema.md
│       ├── 03-frontend-core.md
│       ├── 04-edge-functions.md
│       ├── 05-styling-and-design.md
│       └── 06-mail-relay-php.md
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── _shared/
│   │   │   └── smtp.ts
│   │   ├── request-verification-code/
│   │   │   └── index.ts
│   │   ├── verify-code/
│   │   │   └── index.ts
│   │   ├── submit-anamnesis/
│   │   │   └── index.ts
│   │   └── send-verification-email/
│   │       └── index.ts
│   └── migrations/
├── src/
│   ├── App.tsx, App.css, main.tsx, index.css
│   ├── assets/ (hero-nature.jpg, practice-icon.png, practice-logo.png)
│   ├── components/
│   │   ├── CookieBanner.tsx, LanguageSwitcher.tsx, NavLink.tsx, ProtectedRoute.tsx
│   │   ├── admin/ (FAQManager, PracticeInfoManager, PricingManager)
│   │   ├── anamnese/ (25+ Sektionen + shared/)
│   │   ├── home/ (FeaturesSection, HeroSection, InfoSection)
│   │   ├── iaa/ (IAAForm)
│   │   ├── layout/ (Footer, Header, InfothekDropdown, Layout)
│   │   ├── seo/ (SEOHead, SchemaOrg)
│   │   └── ui/ (shadcn Komponenten)
│   ├── contexts/ (AuthContext, LanguageContext)
│   ├── hooks/ (use-mobile, use-toast, useAdminCheck)
│   ├── integrations/supabase/ (client.ts, types.ts – auto-generiert)
│   ├── lib/ (anamneseFormData, iaaQuestions, pdfExport*, translations, utils, medicalOptions, datenschutzPdfExport)
│   └── pages/ (18 Seiten)
├── public/ (favicon.ico, placeholder.svg, robots.txt, krankheit-ist-messbar.html, zapper-diamond-shield.html)
├── index.html
├── vite.config.ts, tailwind.config.ts, tsconfig.*.json
└── package.json
```
