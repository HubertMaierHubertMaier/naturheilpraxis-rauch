// Definitionen der thematischen Teilbereich-Backups.
// Jeder Bereich bündelt zusammengehörige DB-Tabellen, Storage-Buckets,
// öffentliche Dateien (public/) und Source-Code-Pfade (fürs Manifest).
//
// Wird sowohl vom Frontend (BackupCenter, JSZip im Browser) als auch von der
// Edge-Function `backup-export?mode=subset&area=...` (für DB+Storage) genutzt.
// → Edge-Function hat eine gespiegelte Kopie der Tabellen/Bucket-Listen.

export type BackupArea = {
  id: string;
  label: string;
  description: string;
  /** DB-Tabellen, die zu diesem Bereich gehören */
  tables: string[];
  /** Komplette Storage-Buckets, die zu diesem Bereich gehören */
  buckets: string[];
  /** Statische Dateien aus public/ (werden im Browser per fetch geladen) */
  publicAssets: string[];
  /** Source-Code-Pfade (informativ – landen im AREA-MANIFEST.json,
   *  damit man aus dem GitHub-Code-ZIP gezielt extrahieren kann). */
  sourcePaths: string[];
};

export const BACKUP_AREAS: BackupArea[] = [
  {
    id: "anamnesebogen",
    label: "Anamnesebogen",
    description:
      "Online-Anamnesebogen, PDF-Vorlage (mehrfach gesichert), eingereichte Patienten-Anamnesen + PDFs.",
    tables: ["anamnesis_submissions"],
    buckets: ["anamnesis-pdfs"],
    publicAssets: [
      "anamnesebogen-blanko.pdf",
      "anamnesebogen-blanko.pdf.backup",
    ],
    sourcePaths: [
      "public/anamnesebogen-blanko.pdf",
      "public/anamnesebogen-blanko.pdf.backup",
      "assets/backups/anamnesebogen-blanko.pdf",
      "src/pages/Anamnesebogen.tsx",
      "src/pages/AnamneseDemo.tsx",
      "src/pages/Neupatient.tsx",
      "src/components/anamnese/",
      "src/components/AnamneseRouteGuard.tsx",
      "src/lib/anamneseFormData.ts",
      "src/lib/pdfExport.ts",
      "src/lib/pdfExportEnhanced.ts",
      "src/hooks/useAnamneseEnabled.ts",
      "src/hooks/useAnamneseOnlineEnabled.ts",
      "src/hooks/useAnamnesePublic.ts",
      "scripts/build-anamnese-fillable.py",
      "scripts/check-anamnese-pdf-exists.ts",
      "supabase/functions/submit-anamnesis/",
    ],
  },
  {
    id: "vertrag-datenschutz",
    label: "Patientenvertrag & Datenschutz",
    description:
      "Vertrags-/Datenschutz-PDFs, Datenschutz-Seite, Build-Skripte.",
    tables: [],
    buckets: [],
    publicAssets: [
      "patientenvertrag-blanko.pdf",
      "datenschutz-einwilligung-blanko.pdf",
      "datenschutz-fahrplan.html",
    ],
    sourcePaths: [
      "public/patientenvertrag-blanko.pdf",
      "public/datenschutz-einwilligung-blanko.pdf",
      "public/datenschutz-fahrplan.html",
      "src/pages/Datenschutz.tsx",
      "src/pages/Patientenaufklaerung.tsx",
      "src/lib/datenschutzPdfExport.ts",
      "scripts/build-vertrag-datenschutz.py",
    ],
  },
  {
    id: "wiki",
    label: "Wiki / Naturheilkundliche Mittel",
    description:
      "Admin-Wissensdatenbank, FAQs, Preise. Enthält Mittel-Protokolle (mit Dosierungen).",
    tables: ["admin_knowledge_base", "faqs", "practice_pricing", "practice_info"],
    buckets: [],
    publicAssets: [],
    sourcePaths: [
      "src/pages/Wissensdatenbank.tsx",
      "src/pages/FAQ.tsx",
      "src/pages/PraxisInfo.tsx",
      "src/components/admin/",
    ],
  },
  {
    id: "infothek",
    label: "Infothek (öffentliche Patienten-Infos)",
    description:
      "Statische HTML-Patienteninfos, Infothek-Gating, Zugriffsregeln.",
    tables: ["infothek_gating"],
    buckets: [],
    publicAssets: [
      "allergiebehandlung.html",
      "ass-salicylat-histamin.html",
      "candida-diaet.html",
      "diabetes-handout.html",
      "kraeuter-schmerz-entzuendung.html",
      "krankheit-ist-messbar.html",
      "logi-ernaehrung-mitochondrien.html",
      "mitochondropathie-hws.html",
      "muedigkeit-erschoepfung-burnout.html",
      "parasiten-deutschland.html",
      "patienteninfo-hochohmiges-wasser.html",
      "therapieweg-uebersicht.html",
      "umwelt-alltag-gesundheit.html",
      "vieva-pro-vitalanalyse.html",
      "viren-bakterien-deutschland.html",
      "zapper-diamond-shield.html",
      "infothek-gate.js",
      "content-protection.js",
    ],
    sourcePaths: [
      "public/*.html",
      "public/infothek-gate.js",
      "public/content-protection.js",
      "src/pages/Infothek.tsx",
      "src/lib/infothekContent.ts",
      "src/hooks/useInfothekGating.ts",
      "src/components/InfothekGateRoute.tsx",
    ],
  },
  {
    id: "hypnose",
    label: "Hypnose-Module",
    description:
      "Hypnose-Seiten, SSML/Text-Skripte, TTS-Audio-Generator.",
    tables: [],
    buckets: [],
    publicAssets: [
      "therapie/parkinson/parkinson-hypnose-kurz.ssml",
      "therapie/parkinson/parkinson-hypnose-kurz.txt",
      "therapie/parkinson/parkinson-hypnose-lang.ssml",
      "therapie/parkinson/parkinson-hypnose-lang.txt",
      "therapie/parkinson/README.md",
    ],
    sourcePaths: [
      "public/therapie/",
      "src/pages/ParkinsonHypnose.tsx",
      "src/pages/ReizdarmHypnose.tsx",
      "src/pages/SchilddrueseHypnose.tsx",
      "src/pages/Raucherentwoehnung.tsx",
      "src/components/hypnose/",
      "scripts/build-raucher-hypnose.py",
      "scripts/build-reizdarm-hypnose.py",
      "scripts/build-schilddruese-hypnose.py",
      "supabase/functions/elevenlabs-tts/",
    ],
  },
  {
    id: "patient-library",
    label: "Patienten-Bibliothek",
    description:
      "Geschützte PDF/MP3-Sammlung für verifizierte Patienten + Zugriffsregeln.",
    tables: ["patient_resources", "patient_access"],
    buckets: ["patient-library"],
    publicAssets: [],
    sourcePaths: [
      "src/pages/PatientenBibliothek.tsx",
      "src/hooks/usePatientAccess.ts",
    ],
  },
  {
    id: "iaa-icd10",
    label: "IAA / ICD-10 / Therapie-Empfehlung",
    description:
      "IAA-Bögen, ICD-10-Berichte, Therapie-Sessions, Mannayan-Bestellungen.",
    tables: [
      "iaa_submissions",
      "therapy_sessions",
      "patient_snapshot",
      "mannayan_orders",
      "mannayan_products",
    ],
    buckets: ["therapy-documents"],
    publicAssets: [],
    sourcePaths: [
      "src/components/iaa/",
      "src/lib/iaaQuestions.ts",
      "src/lib/icd10Mapping.ts",
      "src/lib/icd10PdfExport.ts",
      "src/lib/therapyParser.ts",
      "supabase/functions/generate-icd10/",
      "supabase/functions/send-icd10-report/",
      "supabase/functions/therapy-recommend/",
      "supabase/functions/analyze-documents/",
      "supabase/functions/get-therapy-sessions/",
      "supabase/functions/list-therapy-pseudonyms/",
      "supabase/functions/generate-diagnoses/",
      "supabase/functions/check-hp-therapy/",
      "supabase/functions/extract-lab-image/",
      "supabase/functions/enrich-wiki-tags/",
    ],
  },
  {
    id: "auth-2fa",
    label: "Auth, 2FA & Patientenverwaltung",
    description:
      "Login, 2FA-Codes, Profile, Rollen, Patienten-Manager, Audit-Log.",
    tables: [
      "profiles",
      "user_roles",
      "verification_codes",
      "audit_log",
      "app_settings",
    ],
    buckets: [],
    publicAssets: [],
    sourcePaths: [
      "src/pages/Auth.tsx",
      "src/pages/Erstanmeldung.tsx",
      "src/pages/PatientDashboard.tsx",
      "src/pages/PatientenManager.tsx",
      "src/contexts/AuthContext.tsx",
      "src/components/ProtectedRoute.tsx",
      "src/hooks/useAdminCheck.ts",
      "src/hooks/usePatientLoginEnabled.ts",
      "src/lib/devAdminBypass.ts",
      "src/lib/securityAccessMatrix.ts",
      "supabase/functions/request-verification-code/",
      "supabase/functions/verify-code/",
      "supabase/functions/send-verification-email/",
      "supabase/functions/notify-existing-patient/",
      "supabase/functions/resend-submission/",
      "supabase/functions/get-patients/",
    ],
  },
  {
    id: "edge-mail",
    label: "Edge Functions & Mail-Relay",
    description:
      "Alle Edge Functions + PHP-Mail-Relay-Skripte.",
    tables: [],
    buckets: [],
    publicAssets: [],
    sourcePaths: [
      "supabase/functions/",
      "supabase/config.toml",
      "docs/mail-relay-v3-smtp.php",
      "docs/mail-relay-v2.php",
      "docs/send-email-relay.php",
    ],
  },
];

export function getBackupArea(id: string): BackupArea | undefined {
  return BACKUP_AREAS.find((a) => a.id === id);
}
