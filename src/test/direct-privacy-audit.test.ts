import { describe, expect, it } from "vitest";
import { buildDirectPrivacyAudit, hasUnresolvedDirectPrivacyAudit } from "@/lib/directPrivacyAudit";

describe("local direct-import privacy report", () => {
  it("reports locations and unresolved OCR without retaining source text", () => {
    const report = buildDirectPrivacyAudit({
      localPrivacyFindings: [{ pageNumber: 12, lineNumber: 3, categories: ["Name"], originalText: "Name: Erika Beispiel" }],
      ocrFailedPages: [87, 87],
      ocrPageConfidences: [{ pageNumber: 14, confidence: 79 }, { pageNumber: 15, confidence: 81 }],
      officeWarnings: ["Synthetischer Word-Prüfhinweis"],
      previewText: "Laborwert: 4,2 mg/l\n[Datenschutz: Restzeile zurückgehalten]",
    });
    expect(report).toEqual({
      findingLocations: [{ page: 12, line: 3, categories: ["Name"] }],
      failedOcrPages: [87], lowConfidencePages: [14], quarantinedLineCount: 1, officeWarningCount: 1,
    });
    expect(JSON.stringify(report)).not.toContain("Erika Beispiel");
    expect(hasUnresolvedDirectPrivacyAudit(report)).toBe(true);
    expect(hasUnresolvedDirectPrivacyAudit({ ...report, failedOcrPages: [] })).toBe(false);
    expect(hasUnresolvedDirectPrivacyAudit()).toBe(true);
  });
});
