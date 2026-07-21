---
name: HTML Infothek Delivery Status
description: Produktionsstand 21.07.2026 – HTML-Infothek-Inhalte werden serverseitig aus patient-library/infothek ausgeliefert, nicht mehr als öffentliche App-Assets
type: feature
---

# HTML Infothek – aktueller Produktionsstand

**Gültig ab:** 21.07.2026
**Produktiver App-Code:** `105a46a`
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
- Admin-Login verlangt jetzt ebenfalls die sitzungsgebundene 2FA, die das Infothek-Backend voraussetzt.
- Die Lovable-Vorschau mit Rollen-Simulator ersetzt keine echte Admin-2FA; ein entsprechendes `403` wird in der App verständlich erklärt.
- `patient-library/infothek/mitochondropathie-hws.html` enthält wieder den ursprünglichen HWS-Therapiesatz; kein anderes Storage-Objekt wurde bei dieser Korrektur ersetzt.

## Verbindliche Grenzen

Dieser Memory-Eintrag dokumentiert ausschließlich den Stand. Für Änderungen an Code, Git, Datenbank, Functions, Storage, Secrets, Deployment oder Publish ist ein separater Arbeitsschritt erforderlich.

- Erklärende HTML-Seiten innerhalb der geschützten App bleiben fachlich unverändert. Technische Anpassungen für Zugriffsschutz, Datenschutz, Recht und SEO dürfen den erklärenden Inhalt weder umformulieren noch kürzen.
- Die Einschränkung, manuelle Therapieverfahren nicht zu bewerben, gilt ausschließlich für Texte der späteren öffentlichen Website. Sie ist keine Vorgabe zum Entfernen solcher Erklärungen aus App-Inhalten.
- Medizinische, pharmazeutische oder HWG-relevante Textänderungen erfolgen nur seitenweise nach Peters ausdrücklicher Freigabe.
- In `mitochondropathie-hws.html` wurde deshalb der ursprüngliche Wortlaut `Sanfte HWS-Therapie (Osteopathie, Atlas-/CMD-Behandlung)` wiederhergestellt.
