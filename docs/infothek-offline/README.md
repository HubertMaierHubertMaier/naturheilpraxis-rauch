# Offline-Vorbereitung interner Infothek-Vergleiche

Betrifft: fit-gesund-herbst-winter-7-minuten, fit-gesund-herbst-winter-infothek (visibility internal, pending, noindex).

- Original: website-content/infothek/<slug>.html, Entwurf: website-content/infothek/drafts/<slug>.entwurf.html, Vorschläge: herbst-winter-vergleich.json.
- Nicht im Browser-Bundle: `?raw`-Importe landen in öffentlich abrufbaren JS-Assets; Admin-Route und noindex schützen das nicht.
- Später (nicht umgesetzt, keine Live-Ausführung): Vergleich online nur über geschützten Abruf beider HTMLs durch get-infothek-html (JWT/2FA/Admin), Vorschläge ebenso serverseitig; bis dahin offline.
- Test: src/test/infothek-internal-offline.test.ts.
