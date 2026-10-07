# SEO-Stand Entwurf „Frequenztherapie“ (ex „Krankheit ist messbar“)

Status: redaktioneller Entwurf, `noindex`, `reviewStatus: pending`, nicht veröffentlicht.

## Im Entwurf umgesetzt (`krankheit-ist-messbar.entwurf.html`)
- `<title>` (≈60 Zeichen): „Frequenztherapie: Physik, Modelle, Einordnung | Praxis Rauch“.
- Meta-Description (141 Zeichen), ohne Leistungsversprechen.
- og:type/locale/site_name/title/description/url, twitter:card. Kein og:image (erst mit freigegebenem, absolut erreichbarem Bild).
- Genau eine H1 (= Seitenthema). Untertitel des Titelblatts ist kein H2 mehr. Hauptkapitel H2, Unterfolien H3 (`.slide-subheading`). Doppelte Überschrift „Die professionellen Werkzeuge …“ → H3 „Werkzeuge im Überblick“.
- Alt-Texte der KI-Symbolbilder als „Symbolbild (zum Denkmodell)“ gekennzeichnet.
- Alle `<img>`: `loading="lazy"`, `decoding="async"`, Rasterbilder mit `width/height` (CLS).
- Interne Links auf die geplanten Zielrouten aus `manifest.json`: /praxis/ersttermin, /patienteninfo/therapieweg, /praxis/diamond-shield-zapper.
- Bilder: 5 JPG à 1024×768, 64–106 KB; 4 SVG < 6 KB. Nicht unnötig groß. Optional WebP (≈ −40 %).
- Mobil: viewport-Meta und `@media (max-width: 760px)` vorhanden, bestehendes Layout erhalten.

## Erst nach gemeinsamer Inhaltsfreigabe an der öffentlichen Route
- Heute wird der Artikel nur in der App ausgeliefert: `get-infothek-html` → `InfothekHtml.tsx` → `srcDoc`-iframe. Suchmaschinen werten Metadaten im iframe nicht als Seitenmetadaten; der App-Kopf (`SEOHead`) setzt nur Titel + `noindex`. Die App ist ein SPA ohne SSR.
- Daher: Ziel `https://rauch-heilpraktiker.de/ratgeber/frequenztherapie` auf der separaten Website als **statisches HTML** ausliefern (Inhalt direkt im Dokument, nicht per iframe/JS nachgeladen), Title/Description/Canonical/og:* im ausgelieferten `<head>`.
- Reveal-Folien: für die öffentliche Seite als lineares Artikel-Layout ausgeben (Folien-Inhalt crawlbar ohne JS); Hash-Navigation aus.
- `noindex` entfernen, Sitemap-Eintrag + robots.txt erst nach Freigabe (`requiredBeforeIndexing` im Manifest: medical-content-review, source-and-link-check, sichtbarer Autor/Prüfer/Datum, healing-claims-and-hwg-review, mobile-accessibility-review).
- Sichtbares Autor-/Prüf-/Aktualisierungsdatum ergänzen (Datum von Peter, nicht erfunden); danach optional Article-JSON-LD (headline, author, dateModified) – keine Reviews/Ratings.
- og:image 1200×630 aus freigegebenem Bild.
- Interne Links erst aktiv prüfen, wenn die Zielrouten live sind.
- Alte URL `/krankheit-ist-messbar.html` per 301 auf die neue Route.
