# 06 UI UX A11Y SEO Google 2026

## 1. Kurzfazit

Das Frontend hat inhaltlich bereits viele starke Bausteine fuer eine vertrauenswuerdige medizinische Praxiswebsite, ist technisch aber uneinheitlich umgesetzt. Besonders die Mischung aus SPA-Routen und statischen `public/`-HTML-Seiten fuehrt zu Inkonsistenzen in UX, Accessibility, SEO und Search-Governance.

## 2. UX-Staerken

### 2.1 Klare Einstiegspfade

Die Homepage trennt gut zwischen:

1. Neupatient
2. bestehendem Nutzer
3. Infothek-/Informationsinteresse

Referenzen:

1. `src/components/home/WelcomeSelection.tsx`
2. `src/pages/Neupatient.tsx`

### 2.2 Gute inhaltliche Vertrauenssignale

1. Praxisdaten, Adresse, Kontakt und Oeffnungszeiten sind sichtbar.
2. Es gibt Quellenhinweise und Haftungsklarheit.
3. Die Seite positioniert sich fachlich klar als Praxisportal mit YMYL-Charakter.

Referenzen:

1. `src/components/layout/Footer.tsx`
2. `src/components/seo/SchemaOrg.tsx`
3. `src/pages/Quellenhinweis.tsx`

### 2.3 Mobile Layout-Grundlagen

1. Separate Desktop-/Mobile-Navigation
2. responsive Grid-Strukturen
3. sichtbare Breakpoint-Anpassungen

Referenzen:

1. `src/components/layout/Header.tsx`
2. `src/pages/Infothek.tsx`
3. `src/pages/Patientenaufklaerung.tsx`

## 3. UX-Schwachstellen

### 3.1 Journey-Brueche durch parallele Inhaltswelt

Problem:

1. Teile der Inhalte liegen als React-Routen vor.
2. Andere Teile liegen als isolierte `public/*.html`-Seiten vor.
3. Diese Static-Seiten folgen nicht automatisch denselben UX-, Consent-, SEO- und Accessibility-Regeln.

Auswirkung:

1. uneinheitliche Nutzererfahrung
2. inkonsistente Linkpfade und Inhalte
3. schwaches Governance-Modell fuer Content

### 3.2 Redirect- und Login-Zurueckfuehrung

Problem:

1. `ProtectedRoute` speichert `state.from`.
2. `InfothekGateRoute` baut `?redirect=`-Links.
3. `Auth.tsx` wertet das nicht konsistent aus.

Auswirkung:

1. Nutzer landen nach Login nicht robust wieder dort, wo sie herkommen.

Referenzen:

1. `src/components/ProtectedRoute.tsx:34-37`
2. `src/components/InfothekGateRoute.tsx:63-68,97-100`
3. `src/pages/Auth.tsx:42-51,375,449`

### 3.3 Inkonsistente Patient Journey

Die Texte in verschiedenen Teilen des Systems kommunizieren unterschiedliche Erwartungen an:

1. Online-Anamnese
2. PDF-Download
3. Freischaltung
4. Datensicherheit

Beispiel:

1. `AnamneseRouteGuard` kommuniziert Deaktivierung aus Datenschutzgruenden.
2. Andere Stellen werben weiterhin mit digitalem Fluss oder Header-Sichtbarkeit.

## 4. Accessibility-Bewertung

## 4.1 Positive Punkte

1. Es gibt semantische Buttons und strukturierte Cards in vielen React-Bereichen.
2. Loading-Zustaende sind teilweise mit `role="status"` markiert.

### 4.2 Hauptprobleme

1. Kein sichtbarer Skip-Link.
2. Navigation und Dropdowns sind nicht durchgaengig als vollwertige semantische Menues modelliert.
3. Passwort-Toggle-Buttons im Auth-Flow haben keine starken Accessibility-Hinweise.
4. Copy-/Select-/Print-Blockaden in `useContentProtection` sind accessibility-feindlich.

### 4.3 Kritischster A11Y-Befund

`useContentProtection` blockiert:

1. Textmarkierung
2. Kopieren
3. Kontextmenue
4. Druck
5. bestimmte Tastaturkuerzel
6. DevTools-Tastenkombinationen

Das ist fuer:

1. assistive Technologien
2. juristische/medizinische Informationsseiten
3. normale Patientennutzung
4. Browser- und Plattformkompatibilitaet

ein deutlicher Negativfaktor.

Referenz:

1. `src/hooks/useContentProtection.ts:11-27,29-55,75-82`

## 5. Informationsarchitektur

### 5.1 Positives Muster

Die inhaltliche Gruppierung in `src/lib/infothekContent.ts` ist fachlich plausibel:

1. fuer Patienten
2. Geraete
3. Wissen
4. nur fuer Patienten
5. Hypnose
6. Praktisches

### 5.2 Problematischer Realzustand

1. Die IA im React-Modell ist nicht identisch zur realen URL-Landschaft.
2. Mehrere Items zeigen auf `.html`-Dateien, deren Canonicals wiederum andere Pfade behaupten.

Auswirkung:

1. Search- und IA-Drift
2. schwerere Nutzerorientierung

## 6. SEO-Status gegen Google Search Basics 2026

Google 2026 betont weiterhin:

1. crawlbare Inhalte
2. klare technische Struktur
3. konsistente Canonicals
4. hilfreichen, zuverlaessigen, people-first Content
5. starke Page Experience
6. sinnvolle strukturierte Daten
7. keine AEO-/GEO-Hacks als Ersatz fuer saubere Grundlagen

### 6.1 Was bereits gut ist

1. medizinischer Praxisfokus ist klar erkennbar
2. `MedicalBusiness`-Schema ist vorhanden
3. FAQ-Schema ist vorhanden
4. viele Inhalte haben realen fachlichen Nutzwert
5. es gibt Quellen- und Haftungseinordnung

Referenzen:

1. `src/components/seo/SchemaOrg.tsx`
2. `src/pages/FAQ.tsx`
3. `src/pages/Quellenhinweis.tsx`

### 6.2 Hauptprobleme im technischen SEO

#### A. Clientseitige Metadatenlogik

`SEOHead` setzt Titel, Description, OG und Canonical zur Laufzeit.

Probleme:

1. Initiales HTML ist nicht route-spezifisch.
2. JS-Abhaengigkeit ist hoeher als noetig.
3. Nicht alle React-Seiten nutzen `SEOHead` ueberhaupt.

Referenz:

1. `src/components/seo/SEOHead.tsx:39-98`

#### B. Canonical-Drift

`SEOHead` nimmt `window.location.href`.

Folgen:

1. Query-Parameter koennen kanonisiert werden.
2. interne Login-/Gate-Parameter koennen unnnoetig in Search-Signale einfliessen.

Referenzen:

1. `src/components/seo/SEOHead.tsx:37,86-92`
2. `src/components/home/WelcomeSelection.tsx`
3. `src/components/InfothekGateRoute.tsx`

#### C. Domain- und URL-Inkonsistenz

Es existieren parallel:

1. `rauch-heilpraktiker.de`
2. `www.rauch-heilpraktiker.de`
3. historische Lovable-Domains
4. Canonical-Ziele, die nicht den echten Auslieferungspfaden entsprechen

#### D. Sitemap-Inkonsistenz

`public/sitemap.xml`:

1. enthaelt tote oder nicht vorhandene Routen
2. enthaelt nicht alle relevanten oeffentlichen Static-Seiten
3. enthaelt potenziell gegatete Inhalte

#### E. OG-/Bild-Inkonsistenz

1. OG-Bildreferenzen sind inkonsistent.
2. In Teilen zeigen sie auf alte Preview- oder nicht vorhandene Pfade.

## 7. YMYL, Helpful Content und E-E-A-T

### 7.1 Positiv

Das Projekt arbeitet in einem klaren medizinischen, also YMYL-nahen Kontext und hat mehrere staerkende Signale:

1. reale Praxisidentitaet
2. reale Kontaktangaben
3. Fachthemen mit erkennbarem Kontext
4. Quellen-/Haftungshinweise
5. teilweise patientennahe Fachinformationen mit Praxisbezug

### 7.2 Negativ

1. Es gibt Content-Drift und Link-Drift.
2. Einige Inhalte sind technisch schwerer crawl- und validierbar als noetig.
3. Das System macht in Teilen sehr starke Sicherheits-/Datenschutzversprechen, die technisch nicht konsistent eingehalten werden.
4. Fuer YMYL ist gerade diese Claim-vs-Code-Luecke vertrauensschaedigend.

### 7.3 Google-2026-Bewertung

Nach Googles 2026-Leitlinien fuer generative AI Search sind fuer dieses Projekt nicht die Schlagwoerter `AEO`, `GEO` oder `llms.txt` entscheidend, sondern:

1. hilfreicher Originalcontent
2. klare technische Crawl-Struktur
3. konsistente Canonicals
4. nicht-kommodisierte, erfahrungsnahe Inhalte
5. gute mobile Page Experience
6. solide Local-Business-Signale

Genau hier liegen die echten Hebel.

## 8. Structured Data Status

### Vorhanden

1. `MedicalBusiness`
2. `WebSite`
3. `BreadcrumbList` global
4. `FAQPage` auf FAQ
5. teilweise `MedicalWebPage`/`FAQPage` in Static-Seiten

### Luecken

1. React-Seiten haben ausser FAQ oft nur generisches globales Schema.
2. strukturierte Daten folgen nicht immer der echten URL-/Canonical-Wahrheit.
3. Breadcrumb-Strategie ist nur rudimentaer.

## 9. Local SEO

### Positiv

1. Adresse, Geo-Daten und Telefonnummern sind vorhanden.
2. Business-Typ ist erkennbar.

### Negativ

1. Telefonnummern und Kontaktangaben sind nicht ueberall konsistent.
2. `www`-/non-`www`-Mischung ist unsauber.
3. Search- und Map-Signale sollten spaeter gegen Business Profile und Search Console konsolidiert werden.

## 10. Admin- und Patienten-UX

### Patientenbereich

Positiv:

1. Dashboard als Sammelpunkt
2. klare Quick Actions
3. nachvollziehbare Historie fuer Anamnesen

Negativ:

1. Bibliothek und Freischaltung sind konzeptionell nicht fuer jeden Nutzer selbsterklaerend.
2. Redirect-Restore fehlt.
3. Schutztexte und Realzugriff sind nicht immer deckungsgleich.

### Adminbereich

Positiv:

1. Viele Betriebsfunktionen zentral erreichbar
2. Zugangsfreigabe und Sichtbarkeit sind direkt pflegbar

Negativ:

1. 14 Tabs in einem einzigen Bereich sind langfristig schwer skalierbar.
2. Kritische Themen wie Backup, KI, Patienten und Zugangsrechte liegen dicht beieinander.
3. Es fehlt ein echtes operatives Aufgaben-Cockpit mit Prioritaeten, Warnungen und Status.

## 11. Wichtigste Frontend-/Search-Massnahmen

1. Canonical- und Domainstrategie vereinheitlichen
2. Static-HTML-Landschaft aufraeumen oder sauber in ein inhaltlich gefuehrtes Modell ueberfuehren
3. `SEOHead`-Nutzung fuer alle oeffentlichen React-Seiten konsistent machen
4. `useContentProtection` aus oeffentlichen Info-Seiten entfernen
5. Sitemap, Robots und Indexierungsstrategie neu aufbauen
6. strukturierte Daten auf echte Seitentypen und echte URLs ausrichten
7. Search Console, Rich Results Test und PageSpeed spaeter als festen Qualitaetsprozess integrieren

## 12. Fazit

UI, UX und Suchfaehigkeit haben eine gute fachliche Basis, werden aber von technischer Inkonsistenz und Sicherheits- bzw. Governance-Drift gebremst. Fuer Google 2026 ist das Projekt nah an einer guten inhaltlichen Position, aber noch nicht an einer sauberen technischen Search-Reife. Die staerksten Hebel liegen nicht in neuen SEO-Tricks, sondern in technischer Konsistenz, ehrlicher Trust-Kommunikation und einer vereinheitlichten Content- und URL-Architektur.
