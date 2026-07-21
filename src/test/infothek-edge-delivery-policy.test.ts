import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const getSource = readFileSync(
  resolve(root, "supabase/functions/get-infothek-html/index.ts"),
  "utf8",
);
const migrateSource = readFileSync(
  resolve(root, "supabase/functions/migrate-infothek-html/index.ts"),
  "utf8",
);
const configSource = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
const policySource = readFileSync(
  resolve(root, "supabase/migrations/20260718090000_secure_infothek_delivery_policies.sql"),
  "utf8",
);
const authPageSource = readFileSync(resolve(root, "src/pages/Auth.tsx"), "utf8");
const authContextSource = readFileSync(resolve(root, "src/contexts/AuthContext.tsx"), "utf8");

const expectedRoutes = [
  "/allergiebehandlung.html",
  "/ass-salicylat-histamin.html",
  "/candida-diaet.html",
  "/datenschutz-fahrplan.html",
  "/diabetes-handout.html",
  "/krankheit-ist-messbar.html",
  "/kraeuter-schmerz-entzuendung.html",
  "/logi-ernaehrung-mitochondrien.html",
  "/mitochondropathie-hws.html",
  "/muedigkeit-erschoepfung-burnout.html",
  "/parasiten-deutschland.html",
  "/patienteninfo-hochohmiges-wasser.html",
  "/sibo-duenndarmfehlbesiedlung.html",
  "/therapieweg-uebersicht.html",
  "/umwelt-alltag-gesundheit.html",
  "/vieva-pro-vitalanalyse.html",
  "/viren-bakterien-deutschland.html",
  "/zapper-diamond-shield.html",
].sort();

const expectedPatientRoutes = [
  "/allergiebehandlung.html",
  "/candida-diaet.html",
  "/kraeuter-schmerz-entzuendung.html",
  "/patienteninfo-hochohmiges-wasser.html",
  "/sibo-duenndarmfehlbesiedlung.html",
].sort();

function stringArray(source: string, declaration: string): string[] {
  const match = source.match(new RegExp(`${declaration}\\s*=\\s*\\[([\\s\\S]*?)\\] as const;`));
  expect(match, declaration).not.toBeNull();
  return Array.from(match![1].matchAll(/"(\/[^"\r\n]+\.html)"/g), (item) => item[1]).sort();
}

function stringSet(source: string, declaration: string): string[] {
  const match = source.match(
    new RegExp(`${declaration}\\s*=\\s*new Set<string>\\(\\[([\\s\\S]*?)\\]\\);`),
  );
  expect(match, declaration).not.toBeNull();
  return Array.from(match![1].matchAll(/"(\/[^"\r\n]+\.html)"/g), (item) => item[1]).sort();
}

function verifyJwt(functionName: string): boolean | undefined {
  const match = configSource.match(
    new RegExp(`\\[functions\\.${functionName}\\]\\s*\\r?\\nverify_jwt\\s*=\\s*(true|false)`, "m"),
  );
  return match ? match[1] === "true" : undefined;
}

describe("secure Infothek Edge delivery policy", () => {
  it("keeps both endpoints pinned to the exact 18-file allowlist", () => {
    expect(stringArray(getSource, "const INFOTHEK_ROUTES")).toEqual(expectedRoutes);
    expect(stringArray(migrateSource, "const INFOTHEK_ROUTES")).toEqual(expectedRoutes);
    expect(getSource).toContain("!ALLOWED_ROUTE_SET.has(route)");
  });

  it("keeps hardcoded patient and admin pages from being downgraded by DB visibility", () => {
    expect(stringSet(getSource, "const PATIENT_ONLY_ROUTES")).toEqual(expectedPatientRoutes);
    expect(stringSet(getSource, "const ADMIN_ONLY_ROUTES")).toEqual([
      "/datenschutz-fahrplan.html",
    ]);
    expect(getSource).toMatch(/VISIBILITY_RANK\[fallback\]\s*>=\s*VISIBILITY_RANK\[override\]/);
    expect(getSource).toContain('if (ADMIN_ONLY_ROUTES.has(route)) return "internal"');
    expect(getSource).toContain('if (PATIENT_ONLY_ROUTES.has(route)) return "patient"');
  });

  it("does not permit path traversal, caller-selected buckets, or direct patient storage reads", () => {
    expect(getSource).toContain('const filename = route.slice(1)');
    expect(getSource).toContain('.from("patient-library")');
    expect(getSource).toContain('.download(`infothek/${filename}`)');
    expect(getSource).not.toMatch(/\.from\(\s*(?:bucket|req|route|filename)/);
    expect(getSource).not.toContain("decodeURIComponent");
    expect(migrateSource).toContain('.upload(`infothek/${filename}`');
  });

  it("requires verified JWT, admin role, and completed session 2FA before migration elevation", () => {
    const authIndex = migrateSource.indexOf("userClient.auth.getUser()");
    const roleIndex = migrateSource.indexOf('userClient.rpc("has_role"');
    const twoFactorIndex = migrateSource.indexOf('"is_current_session_two_factor_completed"');
    const serviceRoleIndex = migrateSource.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');

    expect(migrateSource).toContain('req.method !== "POST"');
    expect(authIndex).toBeGreaterThan(-1);
    expect(roleIndex).toBeGreaterThan(authIndex);
    expect(twoFactorIndex).toBeGreaterThan(roleIndex);
    expect(serviceRoleIndex).toBeGreaterThan(twoFactorIndex);
    expect(migrateSource).toContain("if (isAdmin !== true)");
    expect(migrateSource).toContain("if (twoFactorCompleted !== true)");
  });

  it("routes admin logins through the same completed session 2FA", () => {
    expect(authPageSource).toContain("if (isAdminData !== true)");
    expect(authPageSource).toContain("const session = await finalizeTwoFactorSession(bindingToken)");
    expect(authPageSource).not.toContain("Admin: direct login, no 2FA needed");
    expect(authContextSource).toContain("rpc('is_current_session_two_factor_completed')");
    expect(authContextSource).not.toContain("rpc('is_current_session_two_factor_verified' as never)");
  });

  it("does not create service-role clients until delivery callers are authorized", () => {
    const denialIndex = getSource.indexOf("if (!authorized)", getSource.indexOf("const visibility"));
    const serviceRoleIndex = getSource.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');

    expect(denialIndex).toBeGreaterThan(-1);
    expect(serviceRoleIndex).toBeGreaterThan(denialIndex);
    expect(getSource.slice(0, serviceRoleIndex)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(migrateSource.slice(0, migrateSource.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')))
      .not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps anonymous public delivery and admin migration JWT intent explicit", () => {
    expect(verifyJwt("get-infothek-html")).toBe(false);
    expect(verifyJwt("migrate-infothek-html")).toBe(true);
  });

  it("serves only non-cacheable, non-indexable UTF-8 HTML with restricted CORS", () => {
    expect(getSource).toContain('"Content-Type": "text/html; charset=utf-8"');
    expect(getSource).toContain('"Cache-Control": "private, no-store"');
    expect(getSource).toContain('"X-Robots-Tag": "noindex, nofollow"');
    expect(getSource).not.toMatch(/"Access-Control-Allow-Origin"\s*:\s*"\*"/);
    expect(getSource).toContain("getCorsHeaders(req)");
    expect(getSource).toContain('"app.rauch-heilpraktiker.de"');
  });

  it("removes gate/protection scripts, forces robots, localizes assets, and upserts HTML", () => {
    expect(migrateSource).toContain('path === "/infothek-gate.js"');
    expect(migrateSource).toContain('path === "/content-protection.js"');
    expect(migrateSource).toContain('<meta name="robots" content="noindex, nofollow">');
    for (const asset of [
      "/vendor/infothek-fonts.css",
      "/vendor/infothek.css",
      "/vendor/reveal/reveal.css",
      "/vendor/reveal/reveal.js",
    ]) {
      expect(migrateSource).toContain(asset);
    }
    expect(migrateSource).toContain('contentType: "text/html; charset=utf-8"');
    expect(migrateSource).toContain("upsert: true");
    expect(migrateSource).toContain("{ results }");
    expect(migrateSource).toContain(".protected-overlay{display:none!important}");
  });

  it("requires library_access for direct published resources and non-Infothek objects", () => {
    expect(policySource).toContain(
      'DROP POLICY IF EXISTS "Verified patients can view published resources"',
    );
    expect(policySource).toContain(
      'DROP POLICY IF EXISTS "Verified patients can read patient-library objects"',
    );
    expect(policySource.match(/access\.library_access = true/g)).toHaveLength(2);
    expect(policySource.match(/lower\(access\.email\) = lower\(COALESCE\(auth\.jwt\(\) ->> 'email', ''\)\)/g))
      .toHaveLength(2);
    expect(policySource).toContain("AND name NOT LIKE 'infothek/%'");
    expect(policySource.match(/TO authenticated/g)?.length).toBeGreaterThanOrEqual(3);
    expect(policySource.match(/is_current_session_two_factor_completed\(\)/g)).toHaveLength(2);
    expect(policySource).not.toMatch(/DROP POLICY IF EXISTS "Admins manage/);
  });
});
