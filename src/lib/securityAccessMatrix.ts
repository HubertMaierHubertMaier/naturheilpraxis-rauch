export type RouteAudience = "public" | "auth" | "patient" | "admin";
export type RouteSensitivity = "public" | "patient-sensitive" | "admin-sensitive";
export type RouteGuardType =
  | "none"
  | "ProtectedRoute"
  | "AnamneseRouteGuard"
  | "component-auth-redirect"
  | "component-admin-check";

export interface RouteAccessMatrixEntry {
  path: string;
  component: string;
  routeAudience: RouteAudience;
  guardType: RouteGuardType;
  sensitivity: RouteSensitivity;
  supabaseTables: string[];
  edgeFunctions: string[];
  riskNote: string;
}

export interface EdgeFunctionAccessMatrixEntry {
  name: string;
  verifyJwt: boolean;
  audience: "public-pre-session" | "public-content" | "authenticated" | "admin" | "provider-protected";
  authCheck: string;
  roleCheck: string;
  roleEnforcement: string;
  rateLimitPolicy: string;
  usesServiceRole: boolean;
  cors: "request-aware allowlist" | "public/pre-session cors";
  handlesPii: boolean;
  publicRationale: string;
}

export type TableAudience = "public" | "authenticated-owner" | "admin" | "service-role" | "mixed";

export interface TableAccessMatrixEntry {
  name: string;
  audience: TableAudience;
  rlsEnabled: boolean;
  publicRead: boolean;
  publicReadRationale: string;
  containsPatientData: boolean;
  frontendConsumers: string[];
  policySummary: string;
  riskNote: string;
}

export const routeAccessMatrix: RouteAccessMatrixEntry[] = [
  { path: "/", component: "Index", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings"], edgeFunctions: [], riskNote: "Public start page; feature-flag reads are column-limited." },
  { path: "/auth", component: "Auth", routeAudience: "auth", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings", "anamnesis_submissions"], edgeFunctions: ["request-verification-code", "verify-code", "notify-existing-patient"], riskNote: "Pre-session auth/registration flow; no real verification data in tests." },
  { path: "/anamnesebogen", component: "Anamnesebogen", routeAudience: "auth", guardType: "AnamneseRouteGuard", sensitivity: "patient-sensitive", supabaseTables: ["anamnesis_submissions", "iaa_submissions"], edgeFunctions: ["submit-anamnesis", "request-verification-code", "verify-code"], riskNote: "Login-protected anamnesis route; collects health data and must never be reachable anonymously." },
  { path: "/erstanmeldung", component: "Erstanmeldung", routeAudience: "patient", guardType: "ProtectedRoute", sensitivity: "patient-sensitive", supabaseTables: ["anamnesis_submissions", "practice_pricing"], edgeFunctions: [], riskNote: "Authenticated onboarding route." },
  { path: "/anamnesebogen-demo", component: "AnamneseDemo", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Demo route; verify no real patient submission is introduced before enabling broader use." },
  { path: "/datenschutz", component: "Datenschutz", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public legal information." },
  { path: "/heilpraktiker", component: "Heilpraktiker", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/gebueh", component: "Gebueh", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/ernaehrung", component: "Ernaehrung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/milch-unvertraeglichkeit", component: "MilchUnvertraeglichkeit", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/milch-knochengesundheit", component: "MilchKnochengesundheit", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/rohmilch-mikrobiologie", component: "RohmilchMikrobiologie", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/faq", component: "FAQ", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["faqs"], edgeFunctions: [], riskNote: "Public FAQ content; admin writes must remain server/RLS protected." },
  { path: "/praxis-info", component: "PraxisInfo", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["practice_info"], edgeFunctions: [], riskNote: "Public practice content; admin writes must remain server/RLS protected." },
  { path: "/impressum", component: "Impressum", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public legal information." },
  { path: "/patientenaufklaerung", component: "Patientenaufklaerung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public educational content; not a patient-data route." },
  { path: "/neupatient", component: "Neupatient", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings"], edgeFunctions: [], riskNote: "Public patient information; links to controlled anamnesis/auth flows." },
  { path: "/quellenhinweis", component: "Quellenhinweis", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public source/legal information." },
  { path: "/raucherentwoehnung", component: "Raucherentwoehnung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/schilddruese-hypnose", component: "SchilddrueseHypnose", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/reizdarm-hypnose", component: "ReizdarmHypnose", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/parkinson-hypnose", component: "ParkinsonHypnose", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/infothek", component: "Infothek", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content index." },
  { path: "/reizdarm", component: "Reizdarm", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/knieschwellung", component: "Knieschwellung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/admin", component: "AdminDashboard", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["profiles", "app_settings", "audit_log"], edgeFunctions: ["get-patients", "generate-icd10", "send-icd10-report"], riskNote: "Admin page enforces access in component via useAuth/useAdminCheck plus local-only dev bypass." },
  { path: "/wissensdatenbank", component: "Wissensdatenbank", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["admin_knowledge_base", "knowledge_product_links", "mannayan_products", "therapy_sessions"], edgeFunctions: ["analyze-documents", "therapy-recommend", "get-therapy-sessions", "enrich-wiki-tags", "extract-lab-image", "generate-diagnoses"], riskNote: "Admin-only knowledge/therapy workspace; component redirects non-admins." },
  { path: "/patienten", component: "PatientenManagerPage", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["profiles"], edgeFunctions: ["get-patients"], riskNote: "Admin-only patient list; component denies non-admins and dev bypass is localhost-restricted." },
  { path: "/dashboard", component: "PatientDashboard", routeAudience: "patient", guardType: "ProtectedRoute", sensitivity: "patient-sensitive", supabaseTables: ["anamnesis_submissions"], edgeFunctions: [], riskNote: "Patient dashboard requires an authenticated and 2FA-bound session; RLS must constrain submissions to the signed-in patient." },
  { path: "/patienten-bibliothek", component: "PatientenBibliothek", routeAudience: "patient", guardType: "ProtectedRoute", sensitivity: "patient-sensitive", supabaseTables: ["patient_resources", "profiles"], edgeFunctions: [], riskNote: "Authenticated patient library route." },
  { path: "/app-uebersicht", component: "AppUebersicht", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public app overview / informational route." },
  { path: "*", component: "NotFound", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Catch-all 404 route." },
];

export const edgeFunctionAccessMatrix: EdgeFunctionAccessMatrixEntry[] = [
  { name: "analyze-documents", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC before request-body parsing and AI calls", rateLimitPolicy: "Best-effort local per-isolate admin rate limit before body parsing and AI calls; JWT and admin role are the primary access controls.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "check-hp-therapy", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC before therapy checks", rateLimitPolicy: "Request processing is JWT-gated; admin-only therapeutic checks should remain behind platform auth.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "elevenlabs-tts", verifyJwt: true, audience: "provider-protected", authCheck: "Supabase platform JWT plus auth.getUser token verification", roleCheck: "Authenticated user required; no admin role for patient-facing TTS", roleEnforcement: "verified Supabase user required before provider access", rateLimitPolicy: "Local in-memory per-authenticated-user rate limit before request-body parsing and ElevenLabs provider calls, with HTTP 429 response.", usesServiceRole: false, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "enrich-wiki-tags", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through user_roles lookup", roleEnforcement: "admin enforced via service-role user_roles lookup after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and AI provider calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "extract-lab-image", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through user_roles lookup", roleEnforcement: "admin enforced via service-role user_roles lookup after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and AI provider calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "generate-diagnoses", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through user_roles lookup", roleEnforcement: "admin enforced via service-role user_roles lookup after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and AI provider calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "generate-icd10", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and AI provider calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "get-infothek-html", verifyJwt: false, audience: "public-content", authCheck: "Exact route allowlist is public only when the server-side visibility rule is public; restricted routes validate auth.getUser and completed 2FA", roleCheck: "Patient routes require an explicit patient_access grant or admin role; the internal route requires admin", roleEnforcement: "server-side visibility, patient_access, completed 2FA and has_role checks run before service-role storage access", rateLimitPolicy: "Only allowlisted GET requests can read non-PII HTML; no provider calls or arbitrary storage paths are accepted.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: false, publicRationale: "Public Infothek articles require anonymous read access, while the function enforces stronger server-side checks for every restricted route." },
  { name: "get-patients", verifyJwt: true, audience: "admin", authCheck: "Authorization bearer token resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before patient-list queries, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "get-therapy-sessions", verifyJwt: true, audience: "admin", authCheck: "Authorization bearer token resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and therapy session queries, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "list-therapy-pseudonyms", verifyJwt: true, audience: "admin", authCheck: "Authorization bearer token resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before therapy session summary queries, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "migrate-infothek-html", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser and completed session-bound 2FA", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC and completed 2FA before service-role storage migration", rateLimitPolicy: "Admin-only one-time migration with a fixed 18-file allowlist, bounded source size and no caller-selected paths.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "notify-existing-patient", verifyJwt: true, audience: "authenticated", authCheck: "Supabase platform JWT plus auth.getUser token verification", roleCheck: "Authenticated post-registration notification context; no admin role", roleEnforcement: "verified Supabase user required before notification relay access", rateLimitPolicy: "Local in-memory per-authenticated-user rate limit before request-body parsing and relay notification calls, with HTTP 429 response.", usesServiceRole: false, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "request-verification-code", verifyJwt: false, audience: "public-pre-session", authCheck: "Application-level verification-code flow", roleCheck: "None before session", roleEnforcement: "public pre-session flow; no role before session", rateLimitPolicy: "Local in-memory rate limit per email/type for 15 minutes with HTTP 429 response.", usesServiceRole: true, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Pre-session verification must accept unauthenticated code requests for login/registration/anamnesis flows." },
  { name: "resend-submission", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing, submission queries, PDF retrieval, AI ICD-10 generation, and email resend calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "send-icd10-report", verifyJwt: true, audience: "admin", authCheck: "Authorization bearer token resolved with auth.getUser", roleCheck: "Admin enforced through user_roles lookup", roleEnforcement: "admin enforced via service-role user_roles lookup after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and report email sending, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "send-verification-email", verifyJwt: true, audience: "authenticated", authCheck: "Platform JWT required before the disabled legacy handler", roleCheck: "Endpoint disabled with HTTP 410", roleEnforcement: "no email action remains; authenticated requests receive HTTP 410", rateLimitPolicy: "No provider call or email action remains.", usesServiceRole: false, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "submit-anamnesis", verifyJwt: true, audience: "authenticated", authCheck: "Platform JWT required plus auth.getUser check inside the function", roleCheck: "Authenticated user required", roleEnforcement: "anonymous requests receive 401 before any anamnesis data is accepted", rateLimitPolicy: "Local in-memory rate limits for submission attempts with HTTP 429 responses.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "therapy-recommend", verifyJwt: true, audience: "admin", authCheck: "Authorization header resolved with auth.getUser", roleCheck: "Admin enforced through has_role RPC", roleEnforcement: "admin enforced via has_role RPC after auth.getUser", rateLimitPolicy: "Local in-memory per-admin rate limit before request-body parsing and AI provider calls, with HTTP 429 response.", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "verify-code", verifyJwt: false, audience: "public-pre-session", authCheck: "Application-level verification-code completion", roleCheck: "None before session", roleEnforcement: "public pre-session flow; no role before session", rateLimitPolicy: "Local in-memory rate limit per email for 1 hour with HTTP 429 response.", usesServiceRole: true, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Pre-session verification must accept unauthenticated code confirmation for login/registration/anamnesis flows." },
];


export const tableAccessMatrix: TableAccessMatrixEntry[] = [
  {
    name: "admin_knowledge_base",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: false,
    frontendConsumers: ["KnowledgeBaseManager", "Wissensdatenbank", "therapy admin components"],
    policySummary: "Admin-only knowledge-base access via RLS policies and admin route/component checks.",
    riskNote: "Contains internal therapeutic knowledge context; keep writes and enrichment flows admin-only.",
  },
  {
    name: "anamnesis_submissions",
    audience: "mixed",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["Anamnesebogen", "Auth", "Erstanmeldung", "PatientDashboard", "ICD10Generator"],
    policySummary: "Patient/owner reads plus admin/service-role workflows; public intake goes through controlled pre-session edge functions.",
    riskNote: "High-sensitivity anamnesis data; never expose direct public reads or real patient data in tests/logs.",
  },
  {
    name: "app_settings",
    audience: "mixed",
    rlsEnabled: true,
    publicRead: true,
    publicReadRationale: "Public pages need feature flags, but Phase 4 column grants limit anon/authenticated reads to key/value/updated_at.",
    containsPatientData: false,
    frontendConsumers: ["Anamnese toggles", "Auth", "Index", "Neupatient"],
    policySummary: "Limited public SELECT for feature flags; full settings and writes remain admin/service-role controlled.",
    riskNote: "Keep updated_by hidden from public roles and avoid storing sensitive values in public settings.",
  },
  {
    name: "audit_log",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["AuditLogManager", "AdminDashboard"],
    policySummary: "Admin read access; authenticated inserts/self-read policies exist for audit traceability.",
    riskNote: "Audit details may contain user context; logging hygiene must avoid patient payloads and secrets.",
  },
  {
    name: "email_send_log",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["EmailLogManager", "AdminDashboard"],
    policySummary: "Admin-only visibility into email relay attempts and failures via RLS-backed SELECT access.",
    riskNote: "Contains recipient addresses, delivery metadata, and operational mail failure details; keep access admin-only.",
  },
  {
    name: "faqs",
    audience: "public",
    rlsEnabled: true,
    publicRead: true,
    publicReadRationale: "Published FAQ content is intentionally public website content; admin writes stay RLS-protected.",
    containsPatientData: false,
    frontendConsumers: ["FAQ", "FAQManager"],
    policySummary: "Published rows are publicly readable; admin policies cover create/update/delete and full reads.",
    riskNote: "Do not place patient- or practice-internal data in public FAQ records.",
  },
  {
    name: "iaa_submissions",
    audience: "authenticated-owner",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["Anamnesebogen"],
    policySummary: "Users can view/insert/update their own IAA rows; admins can manage all rows.",
    riskNote: "Patient-submitted questionnaire data; keep public access blocked and tests synthetic.",
  },
  {
    name: "infothek_gating",
    audience: "public",
    rlsEnabled: true,
    publicRead: true,
    publicReadRationale: "Public Infothek pages need visibility flags to render locked/free tiles consistently; writes remain admin-only.",
    containsPatientData: false,
    frontendConsumers: ["Infothek", "InfothekDropdown", "InfothekGateRoute"],
    policySummary: "Column-limited public reads expose href/gated/visibility only; administrative policies control changes.",
    riskNote: "Keep updated_by hidden from public roles and never use DB overrides to downgrade code-marked therapy content below patient-only access.",
  },
  {
    name: "knowledge_product_links",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: false,
    frontendConsumers: ["KnowledgeProductLinkManager", "TherapyRecommendation"],
    policySummary: "Admin-only reviewed links between internal wiki entries and Mannayan products.",
    riskNote: "A link is not evidence of efficacy; relation type, review status, and safety notes remain mandatory context.",
  },
  {
    name: "mannayan_orders",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: [],
    policySummary: "Admin-only management policy with RLS enabled.",
    riskNote: "Order records can include patient labels/notes; treat as sensitive even if currently unused in frontend.",
  },
  {
    name: "mannayan_products",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: false,
    frontendConsumers: ["KnowledgeProductLinkManager", "MannayanPriceManager"],
    policySummary: "Admin-only product management policy with RLS enabled.",
    riskNote: "Product catalog data is internal; a product-to-wiki link is not evidence of efficacy.",
  },
  {
    name: "patient_resources",
    audience: "authenticated-owner",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["PatientLibraryManager", "PatientenBibliothek"],
    policySummary: "Admin manages resources; patients read resources assigned/available to their authenticated context.",
    riskNote: "Patient library access must remain authenticated and avoid revealing patient-specific resource assignments publicly.",
  },
  {
    name: "patient_access",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["usePatientAccess", "PatientManager", "PatientenBibliothek"],
    policySummary: "Admin-managed access grants; patients receive only their own effective grants through a security-definer function.",
    riskNote: "Contains patient emails and unlock flags; never expose direct public reads.",
  },
  {
    name: "patient_snapshot",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["therapy admin components"],
    policySummary: "Admin/service-role safe snapshot access for therapy workflows.",
    riskNote: "Contains compacted patient health context; keep behind admin/RPC access only.",
  },
  {
    name: "practice_info",
    audience: "public",
    rlsEnabled: true,
    publicRead: true,
    publicReadRationale: "Practice information is intentionally public website content; admin writes stay RLS-protected.",
    containsPatientData: false,
    frontendConsumers: ["PraxisInfo", "PracticeInfoManager"],
    policySummary: "Public read for published practice content; admin policies cover management.",
    riskNote: "Keep operational secrets and internal-only notes out of public practice records.",
  },
  {
    name: "practice_pricing",
    audience: "public",
    rlsEnabled: true,
    publicRead: true,
    publicReadRationale: "Pricing shown in public onboarding/education pages is intentionally public content.",
    containsPatientData: false,
    frontendConsumers: ["Erstanmeldung", "Patientenaufklaerung", "PricingManager"],
    policySummary: "Public reads for published pricing; admin writes remain protected.",
    riskNote: "Pricing rows are not patient data but should not carry internal comments or secrets.",
  },
  {
    name: "profiles",
    audience: "mixed",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["PatientManager", "PatientenBibliothek"],
    policySummary: "Users access own profile; admin policies support patient management.",
    riskNote: "Profile data can identify patients/users; never expose as public read.",
  },
  {
    name: "therapy_deleted_document_markers",
    audience: "service-role",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: [],
    policySummary: "No direct client policies; security-definer cleanup functions and triggers use short-lived marker tombstones.",
    riskNote: "Contains pseudonym-scoped deletion markers; keep inaccessible to anon and authenticated clients.",
  },
  {
    name: "therapy_sessions",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: ["TherapyRecommendation", "PseudonymHistory", "TherapyPatientOverview"],
    policySummary: "Admin/service-role therapy workflow table with RLS enabled and authenticated edge-function access.",
    riskNote: "Therapy history is highly sensitive; keep route, edge function, and RLS controls aligned.",
  },
  {
    name: "two_factor_pending_bindings",
    audience: "service-role",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: [],
    policySummary: "Service-role-only pending 2FA setup state; no direct client table access.",
    riskNote: "Contains transient authentication binding material; keep inaccessible to anon/authenticated clients.",
  },
  {
    name: "two_factor_verified_sessions",
    audience: "service-role",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: [],
    policySummary: "Service-role-only verified 2FA session state; no direct client table access.",
    riskNote: "Authentication session metadata is security-sensitive and must never be publicly readable.",
  },
  {
    name: "user_roles",
    audience: "admin",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: false,
    frontendConsumers: [],
    policySummary: "Role mutation restricted to admins; role checks are security-critical.",
    riskNote: "Privilege escalation table; changes require explicit admin-only controls and focused tests.",
  },
  {
    name: "verification_codes",
    audience: "service-role",
    rlsEnabled: true,
    publicRead: false,
    publicReadRationale: "",
    containsPatientData: true,
    frontendConsumers: [],
    policySummary: "No direct anon/authenticated policies; pre-session edge functions use service role for verification workflows.",
    riskNote: "Verification data is sensitive; no direct client access and no real verification values in logs/tests.",
  },
];
