# Wiederherstellung: Zwei-HTML-Vergleich (bestätigte Vorlage, Peter 07.10.2026)

Git-Stand bei Erstellung: Basis-Commit `89756dbc` (2026-10-07), Arbeitszweig `edit/edt-ddb8eab2…`; die Änderungen dieses Schritts kommen im nächsten automatischen Commit danach. MD5-Präfixe (vor dem Commit):
InfothekHtmlVergleich.tsx `b44f35e2f281` · infothekComparison.ts `d6c87d906e2f` · infothekDecisions.ts `94376aaedb64` · infothekComparisonConfigs.ts `f00f1dd95ea3` · infothekFundstelle.ts `08851c758609` · practiceContact.ts `aace55c0190a`.

## Route und Dateien
- Route `/admin/infothek-vergleich/:slug` (Admin-Prüfung in der Komponente), Seite `src/pages/InfothekHtmlVergleich.tsx`.
- Registry je Artikel: `src/lib/infothekComparisonConfigs.ts` (Basis = ausgelieferte Seite oder Basisentwurf, Entwurf `website-content/infothek/drafts/<slug>.entwurf.html`, Vorschläge, Notizen, Restprüfungen, Berichtstitel).
- Markierung und Arbeitsfassung: `src/lib/infothekComparison.ts` (`composeWorkingVersion`, `findChangeTarget`).
- Entscheidungen/Zähler/Bericht: `src/lib/infothekDecisions.ts` (`progressProjection` ist die einzige Quelle für alle Zähler und den Bericht).
- Fundstelle: `src/lib/infothekFundstelle.ts` („<seite>.html · Abschnitt X von Y“; Seitentitel/Meta = „Seiteneinstellungen / Google-Suchvorschau – außerhalb des Artikeltexts“; keine erfundenen Seitenzahlen).
- Kontaktdaten: `src/lib/practiceContact.ts` (Korrektur der Telefonnummer auch in der Arbeitsfassung).
- Tests: `src/test/infothek-*.test.ts`, `src/test/practice-contact.test.ts`.

## Verbindliches Verhalten
- Links das Original (unverändert, dokumentierter Ausgangsstand), rechts Entwurf oder Arbeitsfassung; gemeinsames Scrollen.
- Einzelentscheidung je Vorschlag (Übernehmen / Original beibehalten / Rückgängig). Gespeichert nur im Browser (localStorage, Schlüssel je Slug und Benutzer); der Fortschrittsbericht ist die Sicherung.
- Klick in „Noch zu entscheiden“ oder in der Liste: Marker in beiden Frames anspringen und die Randnotiz mit Vorher/Nachher/Buttons ins Blickfeld holen.
- Optionale Alternativen ersetzen den Vorgänger nur in der Projektion; gespeicherte Entscheidungen werden nie verändert.
- Keine automatische Übernahme, keine Veröffentlichung.

## Neuer Artikel
Eintrag in der Registry ergänzen, Entwurf unter `drafts/` ablegen, Tests `infothek-compose-all`/`infothek-comparison-configs` laufen automatisch über alle Slugs.

## Fortschreibung 07.10.2026 abends – HTML-Paket 1
- Neue Vergleiche (Registry-Einträge, Entwürfe unter `website-content/infothek/drafts/`): `ass-salicylat-histamin` (5 Vorschläge), `diabetes-handout` (4), `ersttermin-naturheilpraxis` (4), `therapieweg-uebersicht` (5).
- Redaktionsstatus wird aus der Registry abgeleitet (`editorialWithRegistry`): konfigurierter Vergleich = „Vergleich vorbereitet“, Vorschlagszahl aus der Registry. Allergie zeigt 12 statt veraltet 9.
- Tests: `infothek-comparison-configs` und `infothek-compose-all` prüfen Anker links/rechts und Zusammensetzung aller Kombinationen je Slug; `infothek-editorial-registry` prüft Status.
- Restliche 15 bestehende HTMLs ohne Vergleich: candida-diaet, dankbarkeit-alltag, fit-gesund-herbst-winter-7-minuten, fit-gesund-herbst-winter-infothek, kraeuter-schmerz-entzuendung, logi-ernaehrung-mitochondrien, mitochondropathie-hws, muedigkeit-erschoepfung-burnout, parasiten-deutschland, patienteninfo-hochohmiges-wasser, sibo-duenndarmfehlbesiedlung, umwelt-alltag-gesundheit, vieva-pro-vitalanalyse, viren-bakterien-deutschland, zapper-diamond-shield.

## Paket 2 (07.10.2026 ~20:05Z)
Vorbereitet: candida-diaet (5), sibo-duenndarmfehlbesiedlung (2), muedigkeit-erschoepfung-burnout (6), kraeuter-schmerz-entzuendung (4). Entwürfe unter website-content/infothek/drafts/*.entwurf.html; keine Abnahme/Publikation. Offen: 11 weitere Vergleiche.
