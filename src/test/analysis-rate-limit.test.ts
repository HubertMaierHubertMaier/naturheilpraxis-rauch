import { describe, expect, it } from "vitest";
import { analysisRetryLimitAfterFailure, isAnalysisRateLimitError } from "@/lib/analysisRetryPolicy";

describe("analysis rate-limit handling", () => {
  it("recognizes the gateway status and both service messages", () => {
    expect(isAnalysisRateLimitError("429 Zu viele Analyse-Anfragen. Bitte später erneut versuchen.")).toBe(true);
    expect(isAnalysisRateLimitError("Rate-Limit erreicht. Bitte später erneut versuchen.")).toBe(true);
    expect(isAnalysisRateLimitError("Leere Antwort vom Analyse-Dienst")).toBe(false);
  });

  it("resumes a rate-limited part at its original size", () => {
    expect(analysisRetryLimitAfterFailure(6000, "429 Zu viele Analyse-Anfragen", 1200)).toBeNull();
    expect(analysisRetryLimitAfterFailure(6000, "Rate-Limit erreicht")).toBeNull();
    expect(analysisRetryLimitAfterFailure(6000, "Zeitlimit", 1200)).toBe(600);
  });
});
