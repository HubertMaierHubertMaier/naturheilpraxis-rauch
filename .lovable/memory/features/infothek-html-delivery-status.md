---
name: HTML Infothek Delivery Status
description: Produktionsstand 17.07.2026 – HTML-Infothek-Inhalte werden serverseitig aus patient-library/infothek ausgeliefert, nicht mehr als öffentliche App-Assets
type: feature
---

# HTML Infothek – aktueller Produktionsstand

**Gültig ab:** 17.07.2026  
**GitHub-main:** `65f4d0e`  
**Lovable-Produktion:** `naturheilpraxis-rauch.lovable.app` ist Up to date.

## Status-Point

Die 18 vollständigen HTML-Inhalte werden **nicht mehr als öffentliche App-Assets** ausgeliefert, sondern liegen bereinigt im privaten Bucket `patient-library/infothek` und werden ausschließlich über die Edge Function `get-infothek-html` mit folgenden Schritten geladen:

- **Allowlist:** nur 18 feste Routen sind zulässig.
- **Sichtbarkeitsprüfung:** `public` / `new_patient` / `patient` / `internal`.
- **Authentifizierung:** JWT-User-Check via `auth.getUser()`.
- **2FA:** `is_current_session_two_factor_completed()`.
- **Patientenfreigabe:** konkrete Freigabe in `patient_access` (infothek_items / infothek_all).
- **Adminschutz:** interne Seiten nur für `admin`-Rolle.

## Öffentliche Weiterleitungen

Die 18 alten `.html`-URLs enthalten nur kleine `noindex`-Weiterleitungen auf die endungslosen `/infothek-dokument/...`-App-Routen. App und Antworten bleiben `noindex`, App-Canonicals fehlen bewusst, `robots.txt` nennt keine Sitemap und `/sitemap.xml` ist eine leere Löschmarke ohne URLs.

## Live-Verifikation

- Öffentlicher Zugriff: `200` (Weiterleitung / ggf. öffentliche Seite)
- Freigeschalteter Patient: `200`
- Interne Seite für Nicht-Admin: `403`
- Direkter Storage-Zugriff: blockiert

## Verbindliche Grenzen

Dieser Memory-Eintrag dokumentiert ausschließlich den Stand. Für Änderungen an Code, Git, Datenbank, Functions, Storage, Secrets, Deployment oder Publish ist ein separater Arbeitsschritt erforderlich.
