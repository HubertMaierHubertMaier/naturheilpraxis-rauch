import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

function readFunctionSource(functionName: string): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/functions", functionName, "index.ts"),
    "utf8",
  );
}

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
    "list-therapy-pseudonyms",
    "generate-diagnoses",
    "extract-lab-image",
    "enrich-wiki-tags",
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

  it("does not expose admin-only service-role functions with wildcard CORS", () => {
    for (const functionName of adminOnlyServiceRoleFunctions) {
      const source = readFunctionSource(functionName);

      expect(source, functionName).not.toMatch(
        /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/,
      );
      expect(source, functionName).toMatch(/getCorsHeaders\(req\)/);
    }
  });

  it("does not log direct patient identifiers in high-risk verification/anamnesis functions", () => {
    const highRiskLoggingFunctions = [
      "submit-anamnesis",
      "request-verification-code",
      "verify-code",
      "send-verification-email",
      "resend-submission",
    ];

    const directIdentifierLogPattern =
      /console\.(?:log|warn|error|info)\s*\([^;\n]*(?:\$\{\s*(?:email|patientEmail|submissionId|pdfStoragePath|rateLimitKey|existingUserId)\s*\}|,\s*(?:email|patientEmail|submissionId|pdfStoragePath|rateLimitKey|existingUserId)\b|parseResult\.error\.errors)/;

    for (const functionName of highRiskLoggingFunctions) {
      const source = readFunctionSource(functionName);
      expect(source, functionName).not.toMatch(directIdentifierLogPattern);
    }
  });
});
