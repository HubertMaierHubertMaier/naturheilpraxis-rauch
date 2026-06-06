import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { routeAccessMatrix, edgeFunctionAccessMatrix } from "@/lib/securityAccessMatrix";

const appSource = readFileSync("src/App.tsx", "utf8");
const configSource = readFileSync("supabase/config.toml", "utf8");

const appRoutePaths = Array.from(appSource.matchAll(/<Route\s+path="([^"]+)"/g)).map((match) => match[1]);
const configuredFunctionNames = Array.from(configSource.matchAll(/\[functions\.([^\]]+)\]/g)).map((match) => match[1]);

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
});
