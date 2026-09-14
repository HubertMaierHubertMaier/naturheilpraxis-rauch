export const THERAPY_SOURCE_STAGES = [
  { id: "anamnese", label: "1. Anamnese", groups: [["anamnese"]] },
  { id: "anamnese-metatron", label: "2. Anamnese + Metatron", groups: [["anamnese"], ["metatronHeel"]] },
  { id: "anamnese-vieva", label: "3. Anamnese + Vieva Pro", groups: [["anamnese"], ["vievaPlus"]] },
  { id: "anamnese-labor", label: "4. Anamnese + Labor", groups: [["anamnese"], ["laborKomplett", "laborErhoeht", "laborErniedrigt"]] },
  { id: "anamnese-metatron-labor", label: "5. Anamnese + Metatron + Labor", groups: [["anamnese"], ["metatronHeel"], ["laborKomplett", "laborErhoeht", "laborErniedrigt"]] },
  { id: "anamnese-vieva-labor", label: "6. Anamnese + Vieva Pro + Labor", groups: [["anamnese"], ["vievaPlus"], ["laborKomplett", "laborErhoeht", "laborErniedrigt"]] },
  { id: "all", label: "7. Alles Vorhandene", groups: [] },
] as const;
export type TherapySourceStageId = typeof THERAPY_SOURCE_STAGES[number]["id"];
const CLINICAL_SOURCE_FIELDS = ["anamnese", "laborKomplett", "laborErhoeht", "laborErniedrigt", "stuhlbefund", "arztbericht", "metatronHeel", "sonstigeUntersuchungen", "vievaPlus", "perplexityAnalyse"];
export type TherapySourceScope = {
  version: 1;
  stageId: TherapySourceStageId;
  sources: Array<{ sourceId: string; contentSha256: string }>;
};
export function parseTherapySourceStageId(value: unknown): TherapySourceStageId | null {
  return THERAPY_SOURCE_STAGES.some(stage => stage.id === value) ? value as TherapySourceStageId : null;
}
export function sourceField(sourceId: string): string { return sourceId.split(":")[0]; }
export function stageIncludesSource(stageId: TherapySourceStageId, sourceId: string): boolean {
  if (!CLINICAL_SOURCE_FIELDS.includes(sourceField(sourceId))) return false;
  const stage = THERAPY_SOURCE_STAGES.find(stage => stage.id === stageId)!;
  return stageId === "all" || (stage.groups.flat() as readonly string[]).includes(sourceField(sourceId));
}
export function assertStageSourcesPresent(stageId: TherapySourceStageId, sourceIds: string[]): void {
  const stage = THERAPY_SOURCE_STAGES.find(stage => stage.id === stageId)!;
  if (!sourceIds.length || sourceIds.some(id => !stageIncludesSource(stageId, id))
    || stage.groups.some(group => !sourceIds.some(id => (group as readonly string[]).includes(sourceField(id))))) {
    throw new Error("Die gewählte Quellenstufe ist unvollständig oder enthält andere Befundquellen. Bitte die Auswahl prüfen.");
  }
}
export function buildTherapySourceScope(stageId: TherapySourceStageId, sources: TherapySourceScope["sources"]): TherapySourceScope {
  assertStageSourcesPresent(stageId, sources.map(source => source.sourceId));
  if (new Set(sources.map(source => source.sourceId)).size !== sources.length
    || sources.some(source => !/^[a-f0-9]{64}$/i.test(source.contentSha256))) throw new Error("Quellenbeleg ist ungültig.");
  return { version: 1, stageId, sources: sources.map(({ sourceId, contentSha256 }) => ({ sourceId, contentSha256 })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)) };
}
export function parseTherapySourceScope(value: unknown): TherapySourceScope | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TherapySourceScope>;
  const stage = parseTherapySourceStageId(candidate.stageId);
  if (candidate.version !== 1 || !stage || !Array.isArray(candidate.sources)
    || candidate.sources.some(source => !source || typeof source.sourceId !== "string" || typeof source.contentSha256 !== "string")) return null;
  try { return buildTherapySourceScope(stage, candidate.sources); } catch { return null; }
}
export function sameTherapySourceScope(left: TherapySourceScope, right: TherapySourceScope): boolean {
  return JSON.stringify(buildTherapySourceScope(left.stageId, left.sources)) === JSON.stringify(buildTherapySourceScope(right.stageId, right.sources));
}

/** A separate copy: full safety data must remain available outside this source-limited diagnostic context. */
export function sourceLimitedTherapyInput(input: Record<string, any>, stageId: TherapySourceStageId): Record<string, any> {
  const scoped = { ...input };
  for (const field of CLINICAL_SOURCE_FIELDS) if (!stageIncludesSource(stageId, field)) scoped[field] = undefined;
  // Derived/manual facts may originate from an excluded document. The bound report supplies stage-specific facts.
  for (const field of ["belastungen", "symptome", "erkrankung", "manualDiagnosen", "anamneseZusatzText", "eigeneTherapieVorlage", "previousResultForCompare"]) scoped[field] = undefined;
  return scoped;
}

export async function verifiedSourceLimitedTherapyInput(input: Record<string, any>, scope: TherapySourceScope): Promise<Record<string, any>> {
  const documents = input.therapySourceDocuments;
  if (!Array.isArray(documents) || documents.some(document => !document || typeof document.sourceId !== "string" || typeof document.text !== "string")) throw new Error("Quellentexte für die gewählte Stufe fehlen.");
  const hashes = await Promise.all(documents.map(async document => {
    const canonical = document.text.normalize("NFC").replace(/\r\n?/g, "\n").split("\n").map((line: string) => line.trimEnd()).join("\n").trim();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return { sourceId: document.sourceId, contentSha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("") };
  }));
  if (!sameTherapySourceScope(scope, buildTherapySourceScope(scope.stageId, hashes))) throw new Error("Die übergebenen Quellentexte stimmen nicht mit dem Befundstand überein.");
  const scoped = sourceLimitedTherapyInput(input, scope.stageId);
  for (const field of CLINICAL_SOURCE_FIELDS) {
    const parts = documents.filter(document => sourceField(document.sourceId) === field).map(document => document.text);
    scoped[field] = parts.length ? parts.join("\n\n") : undefined;
  }
  return scoped;
}
