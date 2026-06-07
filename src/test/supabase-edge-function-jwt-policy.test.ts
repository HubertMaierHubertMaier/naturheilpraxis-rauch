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

  const authenticatedNonPublicFunctions = [
    ...adminOnlyServiceRoleFunctions,
    "elevenlabs-tts",
    "notify-existing-patient",
  ];

  it("keeps required anonymous verification/anamnesis flows explicitly callable without platform JWT", () => {
    for (const functionName of anonymousFlowFunctions) {
      expect(getVerifyJwt(functionName), functionName).toBe(false);
    }
  });

  it("requires platform JWT verification before authenticated non-public functions run", () => {
    for (const functionName of authenticatedNonPublicFunctions) {
      expect(getVerifyJwt(functionName), functionName).toBe(true);
    }
  });

  it("does not expose authenticated non-public functions with wildcard CORS", () => {
    for (const functionName of authenticatedNonPublicFunctions) {
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
      "notify-existing-patient",
    ];

    const directIdentifierLogPattern =
      /console\.(?:log|warn|error|info)\s*\([^;\n]*(?:\$\{\s*(?:email|patientEmail|submissionId|pdfStoragePath|rateLimitKey|existingUserId|relayResult)\s*\}|,\s*(?:email|patientEmail|submissionId|pdfStoragePath|rateLimitKey|existingUserId|relayResult)\b|parseResult\.error\.errors)/;

    for (const functionName of highRiskLoggingFunctions) {
      const source = readFunctionSource(functionName);
      expect(source, functionName).not.toMatch(directIdentifierLogPattern);
    }
  });

  it("keeps legacy verification email protected by local in-memory rate limiting", () => {
    const source = readFunctionSource("send-verification-email");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/status:\s*429/);
    expect(source).toMatch(/const rateLimitKey = `verification-email:\$\{email\}:\$\{type\}`/);
  });

  it("keeps get-patients admin patient-list access behind local per-admin rate limiting", () => {
    const source = readFunctionSource("get-patients");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `get-patients:admin:\$\{adminUserId\}`/);
    expect(source).toMatch(/status:\s*429/);
  });

  it("does not log raw Error objects in get-patients patient-list handling", () => {
    const source = readFunctionSource("get-patients");

    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*error\b/);
  });

  it("keeps therapy-recommend admin AI calls behind local per-admin rate limiting before body parsing", () => {
    const source = readFunctionSource("therapy-recommend");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const aiFetchIndex = source.lastIndexOf("https://ai.gateway.lovable.dev/v1/chat/completions");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `therapy-recommend:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(aiFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(aiFetchIndex);
  });

  it("keeps get-therapy-sessions admin session access behind local per-admin rate limiting before session queries", () => {
    const source = readFunctionSource("get-therapy-sessions");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const sessionQueryIndex = source.indexOf('.from("therapy_sessions")');

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `get-therapy-sessions:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(sessionQueryIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(sessionQueryIndex);
  });

  it("does not log raw Error objects in get-therapy-sessions session handling", () => {
    const source = readFunctionSource("get-therapy-sessions");

    expect(source).not.toMatch(/catch \(error: any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*error\b/);
  });

  it("keeps generate-icd10 admin AI calls behind local per-admin rate limiting before body parsing and provider calls", () => {
    const source = readFunctionSource("generate-icd10");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const providerFetchIndex = source.indexOf("https://ai.gateway.lovable.dev/v1/chat/completions");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `generate-icd10:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(providerFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(providerFetchIndex);
  });

  it("does not log raw Error objects in generate-icd10 AI/admin handling", () => {
    const source = readFunctionSource("generate-icd10");

    expect(source).not.toMatch(/catch \((?:err|aiErr|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:err|aiErr|error)\b/);
  });

  it("keeps generate-diagnoses admin AI calls behind local per-admin rate limiting before body parsing and provider calls", () => {
    const source = readFunctionSource("generate-diagnoses");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const providerFetchIndex = source.indexOf("https://ai.gateway.lovable.dev/v1/chat/completions");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `generate-diagnoses:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(providerFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(providerFetchIndex);
  });

  it("does not log or return raw Error objects in generate-diagnoses AI/admin handling", () => {
    const source = readFunctionSource("generate-diagnoses");

    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
  });

  it("keeps extract-lab-image admin AI calls behind local per-admin rate limiting before body parsing and provider calls", () => {
    const source = readFunctionSource("extract-lab-image");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const providerFetchIndex = source.indexOf("https://ai.gateway.lovable.dev/v1/chat/completions");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `extract-lab-image:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(providerFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(providerFetchIndex);
  });

  it("does not log or return raw Error objects in extract-lab-image AI/admin handling", () => {
    const source = readFunctionSource("extract-lab-image");

    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
  });
});
