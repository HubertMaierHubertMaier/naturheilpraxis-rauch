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
  audience: "public-pre-session" | "authenticated" | "admin" | "provider-protected";
  authCheck: string;
  roleCheck: string;
  usesServiceRole: boolean;
  cors: "request-aware allowlist" | "public/pre-session cors";
  handlesPii: boolean;
  publicRationale: string;
}

export const routeAccessMatrix: RouteAccessMatrixEntry[] = [
  { path: "/", component: "Index", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings"], edgeFunctions: [], riskNote: "Public start page; feature-flag reads are column-limited." },
  { path: "/auth", component: "Auth", routeAudience: "auth", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings", "profiles", "patient_registrations"], edgeFunctions: ["request-verification-code", "verify-code", "notify-existing-patient"], riskNote: "Pre-session auth/registration flow; no real verification data in tests." },
  { path: "/anamnesebogen", component: "Anamnesebogen", routeAudience: "public", guardType: "AnamneseRouteGuard", sensitivity: "patient-sensitive", supabaseTables: ["app_settings"], edgeFunctions: ["submit-anamnesis", "request-verification-code", "verify-code"], riskNote: "Public only when anamnese_public is enabled; collects anamnesis data and remains highest-risk public flow." },
  { path: "/erstanmeldung", component: "Erstanmeldung", routeAudience: "patient", guardType: "ProtectedRoute", sensitivity: "patient-sensitive", supabaseTables: ["patient_registrations"], edgeFunctions: [], riskNote: "Authenticated onboarding route." },
  { path: "/anamnesebogen-demo", component: "AnamneseDemo", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Demo route; verify no real patient submission is introduced before enabling broader use." },
  { path: "/datenschutz", component: "Datenschutz", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public legal information." },
  { path: "/heilpraktiker", component: "Heilpraktiker", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/gebueh", component: "Gebueh", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/ernaehrung", component: "Ernaehrung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/milch-unvertraeglichkeit", component: "MilchUnvertraeglichkeit", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/milch-knochengesundheit", component: "MilchKnochengesundheit", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/rohmilch-mikrobiologie", component: "RohmilchMikrobiologie", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/frequenztherapie", component: "Frequenztherapie", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/faq", component: "FAQ", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["faqs"], edgeFunctions: [], riskNote: "Public FAQ content; admin writes must remain server/RLS protected." },
  { path: "/praxis-info", component: "PraxisInfo", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["practice_info"], edgeFunctions: [], riskNote: "Public practice content; admin writes must remain server/RLS protected." },
  { path: "/impressum", component: "Impressum", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public legal information." },
  { path: "/patientenaufklaerung", component: "Patientenaufklaerung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public educational content; not a patient-data route." },
  { path: "/neupatient", component: "Neupatient", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: ["app_settings"], edgeFunctions: [], riskNote: "Public patient information; links to controlled anamnesis/auth flows." },
  { path: "/quellenhinweis", component: "Quellenhinweis", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public source/legal information." },
  { path: "/raucherentwoehnung", component: "Raucherentwoehnung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/schilddruese-hypnose", component: "SchilddrueseHypnose", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/reizdarm-hypnose", component: "ReizdarmHypnose", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/infothek", component: "Infothek", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content index." },
  { path: "/reizdarm", component: "Reizdarm", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/knieschwellung", component: "Knieschwellung", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public content route." },
  { path: "/admin", component: "AdminDashboard", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["profiles", "app_settings", "patient_registrations", "audit_logs"], edgeFunctions: ["get-patients", "generate-icd10", "send-icd10-report"], riskNote: "Admin page enforces access in component via useAuth/useAdminCheck plus local-only dev bypass." },
  { path: "/wissensdatenbank", component: "Wissensdatenbank", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["admin_knowledge_base"], edgeFunctions: ["therapy-recommend", "get-therapy-sessions", "enrich-wiki-tags", "extract-lab-image", "generate-diagnoses"], riskNote: "Admin-only knowledge/therapy workspace; component redirects non-admins." },
  { path: "/patienten", component: "PatientenManagerPage", routeAudience: "admin", guardType: "component-admin-check", sensitivity: "admin-sensitive", supabaseTables: ["profiles", "patient_registrations"], edgeFunctions: ["get-patients"], riskNote: "Admin-only patient list; component denies non-admins and dev bypass is localhost-restricted." },
  { path: "/dashboard", component: "PatientDashboard", routeAudience: "patient", guardType: "component-auth-redirect", sensitivity: "patient-sensitive", supabaseTables: ["anamnesis_submissions"], edgeFunctions: [], riskNote: "Patient dashboard redirects unauthenticated users; RLS must constrain submissions to the signed-in patient." },
  { path: "/patienten-bibliothek", component: "PatientenBibliothek", routeAudience: "patient", guardType: "ProtectedRoute", sensitivity: "patient-sensitive", supabaseTables: ["patient_library_items"], edgeFunctions: [], riskNote: "Authenticated patient library route." },
  { path: "/app-uebersicht", component: "AppUebersicht", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Public app overview / informational route." },
  { path: "*", component: "NotFound", routeAudience: "public", guardType: "none", sensitivity: "public", supabaseTables: [], edgeFunctions: [], riskNote: "Catch-all 404 route." },
];

export const edgeFunctionAccessMatrix: EdgeFunctionAccessMatrixEntry[] = [
  { name: "elevenlabs-tts", verifyJwt: true, audience: "provider-protected", authCheck: "Supabase platform JWT", roleCheck: "No explicit role check; protected because provider-cost/key context", usesServiceRole: false, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "enrich-wiki-tags", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: false, publicRationale: "" },
  { name: "extract-lab-image", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "generate-diagnoses", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "generate-icd10", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "get-patients", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "get-therapy-sessions", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "list-therapy-pseudonyms", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "notify-existing-patient", verifyJwt: true, audience: "authenticated", authCheck: "Supabase platform JWT", roleCheck: "Authenticated post-registration notification context", usesServiceRole: false, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "request-verification-code", verifyJwt: false, audience: "public-pre-session", authCheck: "Application-level verification-code flow", roleCheck: "None before session", usesServiceRole: true, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Pre-session verification must accept unauthenticated code requests for login/registration/anamnesis flows." },
  { name: "resend-submission", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "send-icd10-report", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "send-verification-email", verifyJwt: false, audience: "public-pre-session", authCheck: "Legacy application-level verification email flow", roleCheck: "None before session", usesServiceRole: false, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Legacy pre-session verification flow remains intentionally reachable until replacement/legal review is complete." },
  { name: "submit-anamnesis", verifyJwt: false, audience: "public-pre-session", authCheck: "Application-level public anamnesis verification flow", roleCheck: "None before session", usesServiceRole: true, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Public anamnesis submission is intentionally reachable only as the controlled pre-session intake path." },
  { name: "therapy-recommend", verifyJwt: true, audience: "admin", authCheck: "Supabase platform JWT", roleCheck: "Expected admin caller; service-role data path", usesServiceRole: true, cors: "request-aware allowlist", handlesPii: true, publicRationale: "" },
  { name: "verify-code", verifyJwt: false, audience: "public-pre-session", authCheck: "Application-level verification-code completion", roleCheck: "None before session", usesServiceRole: true, cors: "public/pre-session cors", handlesPii: true, publicRationale: "Pre-session verification must accept unauthenticated code confirmation for login/registration/anamnesis flows." },
];
