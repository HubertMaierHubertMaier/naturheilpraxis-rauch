# 04 — Frontend Features: Pages, Components, Hooks

**Snapshot:** 2026-06-04 · 33 Pages · ~13.843 LOC

## 1. Pages (sortiert nach Funktion)

### Marketing / Public
| Page | LOC | Beschreibung |
|------|-----|--------------|
| `Index.tsx` | 18 | Landing: Hero + 3 Access-Tiles (Visitor/Neupatient/Verified) |
| `Heilpraktiker.tsx` | 213 | Profil Peter Rauch (Berufsbild, Qualifikationen) |
| `Gebueh.tsx` | 170 | Gebührenordnung GebüH |
| `Frequenztherapie.tsx` | 245 | Über NLS/Bioresonanz/EAV |
| `Ernaehrung.tsx` | 200 | Ernährungsberatung |
| `FAQ.tsx` | 159 | DB-getriebene FAQ-Liste |
| `PraxisInfo.tsx` | 115 | Praxis-Infoblöcke aus DB |
| `Impressum.tsx` | 236 | § 5 TMG Pflichtangaben |
| `Datenschutz.tsx` | 318 | DSGVO-Erklärung (10y Retention, AI-Opt-out) |
| `Patientenaufklaerung.tsx` | 364 | Patientenrechte, Behandlungsvertrag |
| `Quellenhinweis.tsx` | 236 | Anonymisierte Quellenangaben (Copyright-Compliance) |
| `AppUebersicht.tsx` | 118 | Funktionsübersicht der Plattform |

### Patienten-Workflow
| Page | LOC | Beschreibung |
|------|-----|--------------|
| `Auth.tsx` | 989 | Login + Registrierung + 2FA + Passwort-Reset |
| `Erstanmeldung.tsx` | 569 | 3-Schritt-Onboarding mit Phone-Gate-Checkbox |
| `Neupatient.tsx` | 349 | Info-Seite für Neupatienten |
| `Anamnesebogen.tsx` | 1186 | 25-Sektionen-Formular (Wizard/Accordion) |
| `AnamneseDemo.tsx` | 604 | Test-Version mit Mock-Daten (öffentlich) |
| `PatientDashboard.tsx` | 375 | Patienten-Hub (Anamnesen-Historie, PDF-Downloads, Versionen) |
| `PatientenBibliothek.tsx` | 220 | Geschützte PDF/MP3-Sammlung (verified patients) |

### Admin
| Page | LOC | Beschreibung |
|------|-----|--------------|
| `AdminDashboard.tsx` | 244 | Zentrale: FAQs, Praxis-Infos, Pricing, Toggles, Audit, Therapie, Wiki, Patienten, Bibliothek |
| `PatientenManager.tsx` | 84 | Tab-Wrapper auf `PatientManager.tsx` Component |
| `Wissensdatenbank.tsx` | 110 | Admin-Wiki Manager |

### Infothek (Gesundheitsthemen, public)
| Page | LOC | Beschreibung |
|------|-----|--------------|
| `Infothek.tsx` | 82 | 5-Pillar-Übersicht (Komplementärmedizin) |
| `MilchUnvertraeglichkeit.tsx` | 599 | Laktose/Casein-Thema |
| `MilchKnochengesundheit.tsx` | 363 | |
| `RohmilchMikrobiologie.tsx` | 355 | |
| `Reizdarm.tsx` | 288 | |
| `Knieschwellung.tsx` | 214 | |

### Hypnose-Module
| Page | LOC | Beschreibung |
|------|-----|--------------|
| `Raucherentwoehnung.tsx` | 215 | 3-Säulen E-Zigaretten-Entwöhnung |
| `SchilddrueseHypnose.tsx` | 252 | Schilddrüsen-Selbsthypnose |
| `ReizdarmHypnose.tsx` | 253 | Reizdarm-Selbsthypnose |

Alle Hypnose-Seiten bieten:
- MP3-Download (Edge-TTS Florian `-50%` Rate, `±0` Pitch — VERBINDLICH)
- `Selbsthypnose-Skript-Wortlaut.pdf` Download
- Begleitskript-PDF (z.B. `Begleitskript-E-Zigarette.pdf`)
- `HypnoseAudioPlayer` Component für Web-Streaming

---

## 2. Admin-Komponenten (`src/components/admin/`)

| Component | Zweck |
|-----------|-------|
| `FAQManager.tsx` | DE/EN-FAQ CRUD |
| `PracticeInfoManager.tsx` | Info-Block CRUD |
| `PricingManager.tsx` | Preisliste CRUD |
| `KnowledgeBaseManager.tsx` | Admin-Wiki: Hierarchie, Toggle, Refresh |
| `PathogenIndex.tsx` | Pathogen-Index (Latein-Nomenklatur) |
| `TagEnrichmentDialog.tsx` | AI-Tag-Vorschläge (`enrich-wiki-tags`) |
| `TherapyRecommendation.tsx` | Haupt-UI für Therapie-Tool |
| `therapy/PathogenInput.tsx` | Pathogen-Eingabe mit Autocomplete |
| `therapy/CategoryCard.tsx`, `CategoryFilter.tsx` | Wiki-Boost-Kategorien |
| `therapy/LabImageUpload.tsx` | Bild-Upload + `extract-lab-image` |
| `therapy/LiveInputSummary.tsx` | Live-Validierung der Eingabe |
| `therapy/PatientContextBar.tsx` | Pseudonym + Alter + Hauptbeschwerden |
| `therapy/PreferredRemediesCard.tsx` | Pinning bevorzugter Mittel |
| `therapy/PseudonymHistory.tsx` | Verlauf bisheriger Sessions |
| `therapy/TherapyPatientOverview.tsx` | Übersicht aller Pseudonyme |
| `therapy/WikiAuditCard.tsx` | Hinweise auf fehlende Wiki-Einträge |
| `therapy/FreeSectionCard.tsx` | Freitext-Empfehlungsbereich |
| `therapy/printRecipe.ts` | Rezept-Druckansicht (physische Kopie) |
| `ICD10Generator.tsx` | ICD-10-Generierung aus Anamnese |
| `MannayanPriceManager.tsx` | Heilmittel-Katalog CRUD |
| `PatientManager.tsx` | Patientenliste + manuelle Verifikation + Mail-Resend |
| `PatientLibraryManager.tsx` | Patient-Library Upload/Verwaltung |
| `AuditLogManager.tsx` | DSGVO-Audit-Log Viewer |
| `AnamneseToggle.tsx` | App-Setting `anamnese_enabled` |
| `AnamnesePublicToggle.tsx` | App-Setting `anamnese_public` |
| `PatientLoginToggle.tsx` | App-Setting `patient_login_enabled` |
| `AIModelInfo.tsx` | Übersicht verwendeter AI-Modelle |

---

## 3. Anamnese-Sections (`src/components/anamnese/`) — 25 Sektionen

| # | Section | Datei |
|---|---------|-------|
| I | Patientendaten | `PatientDataSection.tsx` |
| II | Sozialanamnese | `SocialSection.tsx` |
| III | Hauptbeschwerden | `ComplaintsSection.tsx` |
| IV | Medizinische Vorgeschichte | `MedicalHistorySection.tsx` |
| V | Familienanamnese | `FamilyHistorySection.tsx` |
| VI | Operationen | `SurgeriesSection.tsx` |
| VII | Medikamente | `MedicationsSection.tsx` |
| VIII | Allergien | `AllergiesSection.tsx` |
| IX | Impfungen | `VaccinationsSection.tsx` |
| X | Infektionen | `InfectionsSection.tsx` |
| XI | Verdauung | `DigestiveSection.tsx` |
| XII | Leber/Galle | `LiverSection.tsx` |
| XIII | Niere/Blase | `KidneySection.tsx` |
| XIV | Herz/Kreislauf | `HeartSection.tsx` |
| XV | Lunge | `LungSection.tsx` |
| XVI | Bewegungsapparat | `MusculoskeletalSection.tsx` |
| XVII | Neurologie | `NeurologySection.tsx` |
| XVIII | Hormone | `HormoneSection.tsx` |
| XIX | Frauenheilkunde | `WomenHealthSection.tsx` |
| XX | Männerheilkunde | `MensHealthSection.tsx` |
| XXI | Zähne | `DentalSection.tsx` (mit `shared/ToothDiagram.tsx`) |
| XXII | Krebs | `CancerSection.tsx` (mit Nuklear-Med-Warnung) |
| XXIII | Umwelt/Lifestyle | `EnvironmentSection.tsx`, `LifestyleSection.tsx` |
| XXIV | IAA/Trikombin | (in `IAAForm.tsx`) |
| XXV | Einwilligung + Signatur | `SignatureSection.tsx` |

Plus: `IntroSection.tsx`, `PreferencesSection.tsx`, `FilteredSummaryView.tsx`, `PrintView.tsx`, `VerificationDialog.tsx`.

### Shared Helpers
- `DentalChart.tsx`, `ToothDiagram.tsx` — Zahn-Visualisierung
- `MultiEntryField.tsx` — Dynamische Listen-Eingabe
- `MultiSelectCheckbox.tsx` — Multi-Select
- `NumericInput.tsx` — Zahleneingabe mit Validierung
- `SubConditionList.tsx` — Hierarchische Bedingungsliste
- `TemporalStatusSelect.tsx` — Type-First-Pattern (Begin/Status/End)
- `YearMonthSelect.tsx` — Jahr/Monat Selector

---

## 4. Layout-Komponenten (`src/components/layout/`)
- `Layout.tsx` — Container mit Header + Footer
- `Header.tsx` — Navigation mit Auth-Status, LanguageSwitcher
- `Footer.tsx` — Impressum/Datenschutz-Links
- `InfothekDropdown.tsx` — Mega-Menü Infothek

## 5. Hooks (`src/hooks/`)
| Hook | Zweck |
|------|-------|
| `useAdminCheck` | RPC `has_role('admin')` |
| `useAnamneseEnabled` | App-Setting `anamnese_enabled` |
| `useAnamnesePublic` | App-Setting `anamnese_public` |
| `usePatientLoginEnabled` | App-Setting `patient_login_enabled` |
| `useContentProtection` | Aktiviert `public/content-protection.js` für sensible Seiten |
| `use-mobile` | Mobile-Breakpoint Detect |
| `use-toast` | Toast-Wrapper (shadcn) |

## 6. Contexts
- `AuthContext` — User, Session, `isAdmin`, signOut. Init mit `isMounted`-Guard. Admin-Check via setTimeout(0) für Race-Safety.
- `LanguageContext` — DE/EN, localStorage-persistent, `t(de, en)`-Helper.

## 7. Components (Top-Level)
- `ProtectedRoute.tsx` — Auth-pflichtig + Dev-Bypass (nur non-prod)
- `AnamneseRouteGuard.tsx` — Auth + Toggle `anamnese_enabled` + `anamnese_public`
- `CookieBanner.tsx` — DSGVO-Cookie-Hinweis
- `ErrorBoundary.tsx` — React Error Boundary
- `LanguageSwitcher.tsx` — DE/EN Switch
- `LoginDisabledBanner.tsx` — Wenn `patient_login_enabled=false`
- `NavLink.tsx` — Aktiver Nav-Link
- `seo/SEOHead.tsx` — Per-Page Meta-Tags
- `seo/SchemaOrg.tsx` — JSON-LD strukturierte Daten
- `hypnose/HypnoseAudioPlayer.tsx` — Audio-Player für Hypnose-MP3s
