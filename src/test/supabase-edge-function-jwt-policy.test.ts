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
    "submit-anamnesis",
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

  it("keeps notify-existing-patient authenticated notification emails behind local per-auth-user rate limiting before body parsing and relay calls", () => {
    const source = readFunctionSource("notify-existing-patient");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const relayFetchIndex = source.indexOf("fetch(relayUrl");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `notify-existing-patient:auth-user:\$\{authenticatedSubject\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(relayFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(relayFetchIndex);
  });

  it("does not log or return raw Error objects in notify-existing-patient handling", () => {
    const source = readFunctionSource("notify-existing-patient");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\?\.message/);
  });

  it("keeps elevenlabs-tts provider-cost calls behind local per-auth-user rate limiting before body parsing and provider calls", () => {
    const source = readFunctionSource("elevenlabs-tts");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const providerFetchIndex = source.indexOf("https://api.elevenlabs.io/v1/text-to-speech/");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `elevenlabs-tts:auth-user:\$\{authenticatedSubject\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(providerFetchIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(providerFetchIndex);
  });

  it("does not log or return raw Error objects or raw ElevenLabs provider responses in elevenlabs-tts handling", () => {
    const source = readFunctionSource("elevenlabs-tts");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error|responseText|providerResponse)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\?\.message/);
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
    const sessionQueryIndex = source.indexOf('rpc("get_therapy_sessions_safe_list"');

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

  it("keeps list-therapy-pseudonyms admin session-summary access behind local per-admin rate limiting before session queries", () => {
    const source = readFunctionSource("list-therapy-pseudonyms");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const sessionQueryIndex = source.indexOf('.from("therapy_sessions")');

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `list-therapy-pseudonyms:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(sessionQueryIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(sessionQueryIndex);
  });

  it("does not log or return raw Error objects in list-therapy-pseudonyms session-summary handling", () => {
    const source = readFunctionSource("list-therapy-pseudonyms");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\?\.message/);
  });

  it("keeps resend-submission admin resend/email access behind local per-admin rate limiting before body parsing, submission queries, and email sending", () => {
    const source = readFunctionSource("resend-submission");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const submissionQueryIndex = source.indexOf('.from("anamnesis_submissions")');
    const emailSendIndex = source.indexOf("sendEmail(");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `resend-submission:admin:\$\{adminUserId\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(submissionQueryIndex).toBeGreaterThan(-1);
    expect(emailSendIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(submissionQueryIndex);
    expect(rateLimitIndex).toBeLessThan(emailSendIndex);
  });

  it("does not log or return raw Error objects in resend-submission handling", () => {
    const source = readFunctionSource("resend-submission");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\?\.message/);
  });

  it("keeps send-icd10-report admin report/email access behind local per-admin rate limiting before body parsing and email sending", () => {
    const source = readFunctionSource("send-icd10-report");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const emailSendIndex = source.indexOf("sendEmail(");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `send-icd10-report:admin:\$\{user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(emailSendIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(emailSendIndex);
  });

  it("does not log or return raw Error objects or direct patient identifiers in send-icd10-report handling", () => {
    const source = readFunctionSource("send-icd10-report");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*\$\{patientName\}/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\?\.message/);
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

  it("keeps enrich-wiki-tags admin AI calls behind local per-admin rate limiting before body parsing and AI enrichment", () => {
    const source = readFunctionSource("enrich-wiki-tags");
    const rateLimitIndex = source.indexOf("checkRateLimit(rateLimitKey)");
    const bodyParsingIndex = source.indexOf("await req.json()");
    const aiCallIndex = source.indexOf("await callAI(");

    expect(source).toMatch(/rateLimitMap/);
    expect(source).toMatch(/RATE_LIMIT_WINDOW_MS/);
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/const rateLimitKey = `enrich-wiki-tags:admin:\$\{userResult\.user\.id\}`/);
    expect(source).toMatch(/status:\s*429/);
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(bodyParsingIndex).toBeGreaterThan(-1);
    expect(aiCallIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(bodyParsingIndex);
    expect(rateLimitIndex).toBeLessThan(aiCallIndex);
  });

  it("does not log or return raw Error objects in enrich-wiki-tags AI/admin handling", () => {
    const source = readFunctionSource("enrich-wiki-tags");

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/catch \((?:e|err|error): any\)/);
    expect(source).not.toMatch(/console\.(?:error|warn|log|info)\s*\([^;\n]*,\s*(?:e|err|error)\b/);
    expect(source).not.toMatch(/error:\s*(?:e|err|error)\.message/);
    expect(source).not.toMatch(/error:\s*e instanceof Error \? e\.message/);
  });
});
