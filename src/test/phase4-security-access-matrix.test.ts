import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { routeAccessMatrix, edgeFunctionAccessMatrix, tableAccessMatrix } from "@/lib/securityAccessMatrix";

const appSource = readFileSync("src/App.tsx", "utf8");
const configSource = readFileSync("supabase/config.toml", "utf8");

const appRoutePaths = Array.from(appSource.matchAll(/<Route\s+path="([^"]+)"/g)).map((match) => match[1]);
const configuredFunctionNames = Array.from(configSource.matchAll(/\[functions\.([^\]]+)\]/g)).map((match) => match[1]);
const supabaseTypesSource = readFileSync("src/integrations/supabase/types.ts", "utf8");
const databaseTableNames = Array.from(
  supabaseTypesSource
    .split("Tables: {", 2)[1]
    .split("Views:", 1)[0]
    .matchAll(/^\s{6}([a-zA-Z_][a-zA-Z0-9_]*): \{/gm)
).map((match) => match[1]);

describe("Phase 4 security access matrix", () => {
  it("documents every application route declared in App.tsx", () => {
    expect(routeAccessMatrix.map((route) => route.path).sort()).toEqual(appRoutePaths.sort());
  });

  it("keeps admin/patient-only routes classified as non-public", () => {
    const restrictedRoutes = routeAccessMatrix.filter((route) =>
      ["/admin", "/patienten", "/dashboard", "/patienten-bibliothek", "/wissensdatenbank"].includes(route.path)
    );

    expect(restrictedRoutes.map((route) => route.path).sort()).toEqual([
      "/admin",
      "/dashboard",
      "/patienten",
      "/patienten-bibliothek",
      "/wissensdatenbank",
    ]);
    expect(restrictedRoutes).not.toContainEqual(expect.objectContaining({ routeAudience: "public" }));
  });

  it("documents every explicitly configured Supabase Edge Function", () => {
    expect(edgeFunctionAccessMatrix.map((fn) => fn.name).sort()).toEqual(configuredFunctionNames.sort());
  });

  it("requires a written rationale for every intentionally public Edge Function", () => {
    const publicFunctions = edgeFunctionAccessMatrix.filter((fn) => fn.verifyJwt === false);

    expect(publicFunctions.map((fn) => fn.name).sort()).toEqual([
      "request-verification-code",
      "send-verification-email",
      "submit-anamnesis",
      "verify-code",
    ]);
    expect(publicFunctions.every((fn) => fn.publicRationale.length >= 24)).toBe(true);
  });

  it("documents every typed Supabase table in the table/RLS matrix", () => {
    expect(tableAccessMatrix.map((table) => table.name).sort()).toEqual(databaseTableNames.sort());
  });

  it("keeps patient-data tables classified as non-public and RLS-backed", () => {
    const patientTables = tableAccessMatrix.filter((table) => table.containsPatientData);

    expect(patientTables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["anamnesis_submissions", "iaa_submissions", "profiles", "therapy_sessions"])
    );
    expect(patientTables).not.toContainEqual(expect.objectContaining({ publicRead: true }));
    expect(patientTables.every((table) => table.rlsEnabled === true)).toBe(true);
  });

  it("documents the intentionally public table reads separately from patient data", () => {
    const publicReadTables = tableAccessMatrix.filter((table) => table.publicRead);

    expect(publicReadTables.map((table) => table.name).sort()).toEqual([
      "app_settings",
      "faqs",
      "practice_info",
      "practice_pricing",
    ]);
    expect(publicReadTables).not.toContainEqual(expect.objectContaining({ containsPatientData: true }));
    expect(publicReadTables.every((table) => table.publicReadRationale.length >= 24)).toBe(true);
  });
});
