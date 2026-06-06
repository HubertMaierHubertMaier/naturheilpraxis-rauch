import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

function getVerifyJwt(functionName: string): boolean | undefined {
  const sectionPattern = new RegExp(
    String.raw`\[functions\.${functionName}\]\s*\nverify_jwt\s*=\s*(true|false)`,
    "m",
  );
  const match = config.match(sectionPattern);
  return match ? match[1] === "true" : undefined;
}

describe("Supabase Edge Function JWT policy", () => {
  const anonymousFlowFunctions = [
    "request-verification-code",
    "verify-code",
    "submit-anamnesis",
    "send-verification-email",
  ];

  const adminOnlyServiceRoleFunctions = [
    "generate-icd10",
    "send-icd10-report",
    "resend-submission",
    "get-patients",
    "therapy-recommend",
    "get-therapy-sessions",
  ];

  it("keeps required anonymous verification/anamnesis flows explicitly callable without platform JWT", () => {
    for (const functionName of anonymousFlowFunctions) {
      expect(getVerifyJwt(functionName), functionName).toBe(false);
    }
  });

  it("requires platform JWT verification before admin-only service-role functions run", () => {
    for (const functionName of adminOnlyServiceRoleFunctions) {
      expect(getVerifyJwt(functionName), functionName).toBe(true);
    }
  });
});
