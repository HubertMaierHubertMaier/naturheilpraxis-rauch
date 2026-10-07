import { readFileSync } from "fs";
import { COMPARISON_CONFIGS, type ComparisonConfig } from "@/lib/infothekComparisonConfigs";
/** Test-only: online configs plus offline patient-gated configs rebuilt from docs (never imported by the app). */
const j = JSON.parse(readFileSync("docs/infothek-offline/patient-gated-vergleiche.json", "utf8"));
export const OFFLINE_CONFIGS: ComparisonConfig[] = j.vergleiche.map((c: ComparisonConfig & { entwurf: string }) => ({ ...c, draftHtml: readFileSync(c.entwurf, "utf8") }));
export const ALL_CONFIGS: ComparisonConfig[] = [...COMPARISON_CONFIGS, ...OFFLINE_CONFIGS];
