import type { LocalPrivacyFinding } from "../../supabase/functions/_shared/clinicalDeidentification";
import type { AnamneseOcrPageConfidence } from "./anamneseOcrMapping";

export type DirectPrivacyAudit = {
  findingLocations: Array<{ page: number; line: number; categories: string[] }>;
  failedOcrPages: number[];
  lowConfidencePages: number[];
  quarantinedLineCount: number;
  officeWarningCount: number;
};

/** Only locations and counts enter the report; original text stays in local memory. */
export function buildDirectPrivacyAudit(input: {
  localPrivacyFindings?: readonly LocalPrivacyFinding[];
  ocrFailedPages?: readonly number[];
  ocrPageConfidences?: readonly AnamneseOcrPageConfidence[];
  officeWarnings?: readonly string[];
  previewText: string;
}): DirectPrivacyAudit {
  const pages = (values: readonly number[]) => [...new Set(values.filter(value => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
  return {
    findingLocations: (input.localPrivacyFindings || []).map(finding => ({
      page: finding.pageNumber,
      line: finding.lineNumber,
      categories: [...finding.categories],
    })),
    failedOcrPages: pages(input.ocrFailedPages || []),
    lowConfidencePages: pages((input.ocrPageConfidences || [])
      .filter(page => !Number.isFinite(page.confidence) || page.confidence < 80)
      .map(page => page.pageNumber)),
    quarantinedLineCount: (input.previewText.match(/\[Datenschutz: Restzeile[^\]\n]*\]/giu) || []).length,
    officeWarningCount: input.officeWarnings?.length || 0,
  };
}

export const hasUnresolvedDirectPrivacyAudit = (audit?: DirectPrivacyAudit) =>
  !audit || audit.failedOcrPages.length > 0;
