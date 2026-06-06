import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

type SecretFinding = {
  file: string;
  line: number;
  pattern: string;
};

const textExtensions = new Set([
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: process.cwd(),
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const secretPatterns: Array<[string, RegExp]> = [
  ["jwt_like", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],
  [
    "private_key",
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  ],
  [
    "url_with_credentials",
    /https?:\/\/[^\s/@:]+:[^\s/@]+@/g,
  ],
  [
    "secret_assignment_literal",
    /\b(?:api[_-]?key|secret|token|password|smtp_password|service_role|anon_key|publishable_key)\b\s*[:=]\s*["'](?!\[?REDACTED\]?|<|your_|placeholder|CHANGE_ME|example|dummy|test|xxxx|$)([^"']{12,})["']/gi,
  ],
];

function shouldScan(file: string): boolean {
  if (file === ".gitignore" || file.endsWith(".env.example")) {
    return true;
  }

  return textExtensions.has(extname(file));
}

function lineNumberForMatch(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function collectFindings(): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const file of trackedFiles) {
    if (!shouldScan(file)) {
      continue;
    }

    const absolutePath = resolve(process.cwd(), file);
    if (statSync(absolutePath).size > 300_000) {
      continue;
    }

    const source = readFileSync(absolutePath, "utf8");

    for (const [patternName, pattern] of secretPatterns) {
      for (const match of source.matchAll(pattern)) {
        findings.push({
          file,
          line: lineNumberForMatch(source, match.index ?? 0),
          pattern: patternName,
        });
      }
    }
  }

  return findings;
}

describe("repository secret policy", () => {
  it("does not track obvious JWT-like tokens, private keys, credential URLs, or literal secret assignments", () => {
    expect(collectFindings()).toEqual([]);
  });

  it("keeps local env files ignored while tracking only the placeholder env example", () => {
    expect(trackedFiles.filter((file) => file.startsWith(".env"))).toEqual([
      ".env.example",
    ]);
  });
});
