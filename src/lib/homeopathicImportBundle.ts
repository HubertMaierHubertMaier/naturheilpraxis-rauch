import { z } from "zod";

export const HOMEOPATHIC_IMPORT_BUNDLE_CONTRACT_VERSION = 1 as const;
export const HOMEOPATHIC_IMPORT_BUNDLE_SCOPE = "HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY" as const;

const textEncoder = new TextEncoder();
const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const boundedText = (maximumBytes: number) => z.string().refine(
  (value) => value.trim().length > 0
    && !value.includes("\0")
    && hasWellFormedUtf16(value)
    && textEncoder.encode(value).byteLength <= maximumBytes,
);

const repertorySchema = z.object({
  repertory_entity_id: uuidSchema,
  repertory_revision_id: uuidSchema,
  repertory_content_hash: sha256Schema,
  source_id: uuidSchema,
  source_revision_id: uuidSchema,
  source_content_hash: sha256Schema,
  source_rights_status: z.enum(["own_content", "licensed", "public_domain"]),
  source_repertory_code: boundedText(512),
  source_language_code: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
  source_locator: boundedText(4096),
}).strict();

const rubricSchema = z.object({
  rubric_id: uuidSchema,
  rubric_revision_id: uuidSchema,
  rubric_content_hash: sha256Schema,
}).strict();

const gradeDefinitionSchema = z.object({
  grade_definition_id: uuidSchema,
  grade_content_hash: sha256Schema,
}).strict();

const remedySchema = z.object({
  repertory_remedy_id: uuidSchema,
  remedy_entity_id: uuidSchema,
  remedy_revision_id: uuidSchema,
  remedy_content_hash: sha256Schema,
}).strict();

const assignmentSchema = z.object({
  assignment_id: uuidSchema,
  rubric_revision_id: uuidSchema,
  repertory_remedy_id: uuidSchema,
  grade_definition_id: uuidSchema,
  assignment_content_hash: sha256Schema,
}).strict();

export const homeopathicImportBundleInputSchema = z.object({
  contract_version: z.literal(HOMEOPATHIC_IMPORT_BUNDLE_CONTRACT_VERSION),
  contract_scope: z.literal(HOMEOPATHIC_IMPORT_BUNDLE_SCOPE),
  data_classification: z.literal("general_knowledge"),
  repertory: repertorySchema,
  rubrics: z.array(rubricSchema).min(1),
  grade_definitions: z.array(gradeDefinitionSchema).min(1),
  remedies: z.array(remedySchema).min(1),
  assignments: z.array(assignmentSchema).min(1),
}).strict();

export type HomeopathicImportBundleInput = z.infer<typeof homeopathicImportBundleInputSchema>;

export type HomeopathicImportBundleManifest = {
  contract_version: typeof HOMEOPATHIC_IMPORT_BUNDLE_CONTRACT_VERSION;
  contract_scope: typeof HOMEOPATHIC_IMPORT_BUNDLE_SCOPE;
  data_classification: "general_knowledge";
  repertory: HomeopathicImportBundleInput["repertory"];
  component_counts: {
    rubrics: number;
    grade_definitions: number;
    remedies: number;
    assignments: number;
  };
  component_hashes: {
    rubrics: string;
    grade_definitions: string;
    remedies: string;
    assignments: string;
  };
};

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

// PostgreSQL jsonb orders object keys by UTF-8 byte length, then by byte value.
function compareJsonbKeys(left: string, right: string): number {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) {
    return leftBytes.byteLength - rightBytes.byteLength;
  }
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index] - rightBytes[index];
    }
  }
  return 0;
}

function postgresJsonbText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_NON_INTEGER_NUMBER");
    }
    return String(value);
  }
  if (typeof value === "string") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_STRING_ENCODING_FAILED");
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(postgresJsonbText).join(", ")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort(compareJsonbKeys)
      .map((key) => `${postgresJsonbText(key)}: ${postgresJsonbText(record[key])}`);
    return `{${entries.join(", ")}}`;
  }
  throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_UNSUPPORTED_JSON_VALUE");
}

async function sha256Utf8(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_SHA256_UNAVAILABLE");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertUnique<T>(values: T[], keyOf: (value: T) => string, errorCode: string): void {
  const keys = new Set<string>();
  for (const value of values) {
    const key = keyOf(value);
    if (keys.has(key)) throw new Error(errorCode);
    keys.add(key);
  }
}

function assertBundleRelationships(input: HomeopathicImportBundleInput): void {
  assertUnique(input.rubrics, (row) => row.rubric_id, "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_RUBRIC");
  assertUnique(
    input.rubrics,
    (row) => row.rubric_revision_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_RUBRIC_REVISION",
  );
  assertUnique(
    input.grade_definitions,
    (row) => row.grade_definition_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_GRADE_DEFINITION",
  );
  assertUnique(
    input.remedies,
    (row) => row.repertory_remedy_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_REPERTORY_REMEDY",
  );
  assertUnique(
    input.remedies,
    (row) => row.remedy_entity_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_REMEDY_ENTITY",
  );
  assertUnique(
    input.remedies,
    (row) => row.remedy_revision_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_REMEDY_REVISION",
  );
  assertUnique(
    input.assignments,
    (row) => row.assignment_id,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_ASSIGNMENT",
  );
  assertUnique(
    input.assignments,
    (row) => `${row.rubric_revision_id}:${row.repertory_remedy_id}`,
    "HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_RUBRIC_REMEDY_PAIR",
  );

  const rubricRevisionIds = new Set(input.rubrics.map((row) => row.rubric_revision_id));
  const gradeDefinitionIds = new Set(
    input.grade_definitions.map((row) => row.grade_definition_id),
  );
  const repertoryRemedyIds = new Set(input.remedies.map((row) => row.repertory_remedy_id));
  for (const assignment of input.assignments) {
    if (!rubricRevisionIds.has(assignment.rubric_revision_id)) {
      throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_UNKNOWN_RUBRIC_REVISION");
    }
    if (!gradeDefinitionIds.has(assignment.grade_definition_id)) {
      throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_UNKNOWN_GRADE_DEFINITION");
    }
    if (!repertoryRemedyIds.has(assignment.repertory_remedy_id)) {
      throw new Error("HOMEOPATHIC_IMPORT_BUNDLE_UNKNOWN_REPERTORY_REMEDY");
    }
  }
}

export async function buildHomeopathicImportBundleContract(
  value: unknown,
): Promise<{ manifest: HomeopathicImportBundleManifest; bundleHash: string }> {
  const input = homeopathicImportBundleInputSchema.parse(value);
  assertBundleRelationships(input);

  const rubricLines = [...input.rubrics]
    .sort((left, right) => compareCodeUnits(left.rubric_id, right.rubric_id)
      || compareCodeUnits(left.rubric_revision_id, right.rubric_revision_id))
    .map((row) => `${row.rubric_id}:${row.rubric_revision_id}:${row.rubric_content_hash}`);
  const gradeLines = [...input.grade_definitions]
    .sort((left, right) => compareCodeUnits(left.grade_definition_id, right.grade_definition_id))
    .map((row) => `${row.grade_definition_id}:${row.grade_content_hash}`);
  const remedyLines = [...input.remedies]
    .sort((left, right) => compareCodeUnits(left.repertory_remedy_id, right.repertory_remedy_id))
    .map((row) => [
      row.repertory_remedy_id,
      row.remedy_entity_id,
      row.remedy_revision_id,
      row.remedy_content_hash,
    ].join(":"));
  const assignmentLines = [...input.assignments]
    .sort((left, right) => compareCodeUnits(left.assignment_id, right.assignment_id))
    .map((row) => [
      row.assignment_id,
      row.rubric_revision_id,
      row.repertory_remedy_id,
      row.grade_definition_id,
      row.assignment_content_hash,
    ].join(":"));

  const [rubricHash, gradeHash, remedyHash, assignmentHash] = await Promise.all([
    sha256Utf8(rubricLines.join("\n")),
    sha256Utf8(gradeLines.join("\n")),
    sha256Utf8(remedyLines.join("\n")),
    sha256Utf8(assignmentLines.join("\n")),
  ]);

  const manifest: HomeopathicImportBundleManifest = {
    contract_version: HOMEOPATHIC_IMPORT_BUNDLE_CONTRACT_VERSION,
    contract_scope: HOMEOPATHIC_IMPORT_BUNDLE_SCOPE,
    data_classification: "general_knowledge",
    repertory: input.repertory,
    component_counts: {
      rubrics: input.rubrics.length,
      grade_definitions: input.grade_definitions.length,
      remedies: input.remedies.length,
      assignments: input.assignments.length,
    },
    component_hashes: {
      rubrics: rubricHash,
      grade_definitions: gradeHash,
      remedies: remedyHash,
      assignments: assignmentHash,
    },
  };

  return {
    manifest,
    bundleHash: await sha256Utf8(postgresJsonbText(manifest)),
  };
}
