# 04 — Frontend-Features: Pages, Komponenten, Hooks

**Snapshot:** 2026-06-07

## 1. Pages (33)

### Öffentliche Info-Seiten
| Page | Datei | LOC | Funktion |
|---|---|---|---|
| Index (Start) | `Index.tsx` | — | Hero + Features + WelcomeSelection (3-Tier-Tiles) |
| Auth | `Auth.tsx` | — | Login + Registrierung + 2FA-OTP |
| Datenschutz | `Datenschutz.tsx` | — | DSGVO-Erklärung, 10y-Hinweis, NLS-Disclosure |
| Impressum | `Impressum.tsx` | — | § 5 TMG |
| Heilpraktiker | `Heilpraktiker.tsx` | — | Profil Peter Rauch |
| Gebühr | `Gebueh.tsx` | — | Dynamische Preise aus `practice_pricing` |
| Ernährung | `Ernaehrung.tsx` | — | LOGI-Übersicht |
| Milch-* (3) | `MilchUnvertraeglichkeit / MilchKnochengesundheit / RohmilchMikrobiologie` | — | Themenseiten |
| Frequenztherapie | `Frequenztherapie.tsx` | — | BIT / Zapper / NLS / EAV |
| Reizdarm | `Reizdarm.tsx` | 288 | Reizdarm-Therapie-Übersicht |
| Knieschwellung | `Knieschwellung.tsx` | — | Beispiel-Fallbeschreibung |
| FAQ | `FAQ.tsx` | — | CMS-Daten aus `faqs` |
| Praxis-Info | `PraxisInfo.tsx` | 115 | CMS aus `practice_info` |
| Quellenhinweis | `Quellenhinweis.tsx` | 236 | Literatur-Liste |
| Patientenaufklärung | `Patientenaufklaerung.tsx` | 364 | Rechtliche Aufklärung, Mandatory-Checkbox-Integration |
| Neupatient | `Neupatient.tsx` | — | Onboarding-Info |
| Raucherentwöhnung | `Raucherentwoehnung.tsx` | 215 | Hypnose-Modul |
| Schilddrüse-Hypnose | `SchilddrueseHypnose.tsx` | 252 | Hypnose-Modul |
| Reizdarm-Hypnose | `ReizdarmHypnose.tsx` | 253 | Hypnose-Modul |
| Infothek | `Infothek.tsx` | — | 5-Sektionen-Wissensportal (Public, dosierungsfrei) |
| App-Übersicht | `AppUebersicht.tsx` | — | Sitemap |
| Anamnese-Demo | `AnamneseDemo.tsx` | — | Test-Submission ohne echte Übermittlung |
| NotFound | `NotFound.tsx` | 24 | 404 |

### Geschützte Seiten
| Page | Datei | LOC | Zugriff |
|---|---|---|---|
| Anamnesebogen | `Anamnesebogen.tsx` | — | `AnamneseRouteGuard` — Feature-Flag + Public-Toggle |
| Erstanmeldung | `Erstanmeldung.tsx` | — | `ProtectedRoute` — eingeloggt |
| Patienten-Bibliothek | `PatientenBibliothek.tsx` | 220 | `ProtectedRoute` + `is_verified_patient` |
| Patient-Dashboard | `PatientDashboard.tsx` | 375 | Eigene Anamnese-Historie, PDFs |

### Admin / Therapeut
| Page | Datei | LOC | Inhalt |
|---|---|---|---|
| Admin-Dashboard | `AdminDashboard.tsx` | — | Manager-Tabs: FAQs, Practice-Info, Pricing, Patient-Manager, Patient-Library, KnowledgeBase, Audit-Log, Mannayan, Toggles, ICD10, Therapy, Tag-Enrichment |
| Wissensdatenbank | `Wissensdatenbank.tsx` | 110 | Admin-Wiki mit Dosierungen, Pathogen-Index, Suche |
| Patienten-Manager | `PatientenManager.tsx` | 84 | Wrapper für `PatientManager`-Komponente |

---

## 2. Admin-Komponenten (16 in `src/components/admin/`)

| Komponente | LOC | Zweck |
|---|---|---|
| `TherapyRecommendation.tsx` | 2.405 | KI-Therapieplanung (Pseudonym-Session, Wiki-Boost, Preferred-Remedies, Print) |
| `MannayanPriceManager.tsx` | 775 | Vitaplace-Produktkatalog + Preise |
| `KnowledgeBaseManager.tsx` | 742 | Wiki-Hierarchie (Folders + Articles), Tags, Evidence-Grade |
| `PracticeInfoManager.tsx` | 415 | CMS-CRUD `practice_info` |
| `PathogenIndex.tsx` | 406 | Latein-Pathogen-Index (Auto-Parser aus Wiki) |
| `FAQManager.tsx` | 325 | FAQ-CRUD (DE/EN) |
| `ICD10Generator.tsx` | 315 | UI für `generate-icd10` + `send-icd10-report` |
| `TagEnrichmentDialog.tsx` | 308 | Batch-Tag-Enrichment via `enrich-wiki-tags` |
| `PatientManager.tsx` | 269 | Patientenliste, manuelle Verifikation, Resend |
| `PatientLibraryManager.tsx` | 243 | CRUD für `patient_resources` |
| `PricingManager.tsx` | 197 | Preis-CRUD |
| `AIModelInfo.tsx` | 151 | Modell-Info-Banner |
| `AnamnesePublicToggle.tsx` | 97 | Toggle `app_settings.anamnese_public` |
| `PatientLoginToggle.tsx` | 94 | Toggle `app_settings.patient_login_enabled` |
| `AnamneseToggle.tsx` | 88 | Toggle `app_settings.anamnese_enabled` |
| `AuditLogManager.tsx` | 79 | Read-only Audit-Log-View |

### Therapy-Subkomponenten (`src/components/admin/therapy/`)
- `CategoryCard.tsx`, `CategoryFilter.tsx`, `FreeSectionCard.tsx`
- `LabImageUpload.tsx` (`extract-lab-image`-Aufruf)
- `LiveInputSummary.tsx`, `PathogenInput.tsx`, `PatientContextBar.tsx`
- `PreferredRemediesCard.tsx`, `PseudonymHistory.tsx`
- `TherapyPatientOverview.tsx`, `WikiAuditCard.tsx`
- `printRecipe.ts` (Rezept-Druckansicht)

---

## 3. Anamnese-Sektionen (29 in `src/components/anamnese/`)

`IntroSection`, `PatientDataSection`, `ComplaintsSection`, `MedicalHistorySection`, `MedicationsSection`, `AllergiesSection`, `VaccinationsSection`, `SurgeriesSection`, `FamilyHistorySection`, `LifestyleSection`, `SocialSection`, `EnvironmentSection`, `PreferencesSection`, `HeartSection`, `LungSection`, `LiverSection`, `KidneySection`, `DigestiveSection`, `DentalSection`, `HormoneSection`, `NeurologySection`, `MusculoskeletalSection`, `InfectionsSection`, `CancerSection`, `WomenHealthSection`, `MensHealthSection`, `SignatureSection`, `FilteredSummaryView`, `PrintView`, `VerificationDialog` + `shared/`

Mapping zu Bogen-Sektionen I–XXV siehe Memory `anamnesebogen-validation-structure`.

---

## 4. Hooks (`src/hooks/`)

| Hook | Zweck |
|---|---|
| `useAdminCheck` | RPC `has_role('admin')`, gecached via React-Query |
| `useAnamneseEnabled` | Liest `app_settings.anamnese_enabled` |
| `useAnamnesePublic` | Liest `app_settings.anamnese_public` |
| `usePatientLoginEnabled` | Liest `app_settings.patient_login_enabled` |
| `useContentProtection` | Lädt `/content-protection.js` für Right-Click-Disable |
| `use-toast` / `use-mobile` | Shadcn/Standard |

---

## 5. Contexts

- **`AuthContext`** — Wraps Supabase-Auth-Listener (`onAuthStateChange`), exponiert `user`, `session`, `signIn`, `signUp`, `signOut`, 2FA-Helpers.
- **`LanguageContext`** — DE/EN-Switching, persistiert in `localStorage`.

---

## 6. Layout

- **`Header.tsx`** — Navigation + `LanguageSwitcher` + `InfothekDropdown` + Auth-Status; Anamnese-Link sichtbar wenn `anamnese_enabled && (anamnese_public || authenticated)`.
- **`Footer.tsx`** — Praxis-Adresse, Rechts-Links.
- **`InfothekDropdown.tsx`** — Mega-Menü der 5 Wissens-Sektionen; nicht-eingeloggte User sehen nur sanitisierte Auswahl (Memory: `visitor-access-sanitization`).
- **`Layout.tsx`** — `Header + Outlet + Footer`-Wrapper.

---

## 7. SEO

- **`SchemaOrg.tsx`** — Global `LocalBusiness` JSON-LD im `<head>` injiziert (Augsburg-Geo).
- **`SEOHead.tsx`** — Per-Page Title/Description/OG.
- Robots: `public/robots.txt` (allow all außer `/admin*`, `/patienten*`).

---

## 8. Frontend-Sicherheit

- **`ProtectedRoute.tsx`** — Redirect zu `/auth` wenn nicht eingeloggt.
- **`AnamneseRouteGuard.tsx`** — Doppelter Check (Feature-Flag + Public-Toggle), Redirect zu `/`.
- **`devAdminBypass.ts`** — Stub, kein Header-Bypass mehr (Phase 3).
- **`securityAccessMatrix.ts`** — Single-Source-of-Truth für Auth-Matrix, getestet in `phase4-security-access-matrix.test.ts`.
