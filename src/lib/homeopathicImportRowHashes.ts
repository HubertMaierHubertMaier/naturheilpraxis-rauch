import { z } from "zod";
import { hashPostgresCanonicalJsonb } from "@/lib/homeopathicImportBundle";

const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const canonicalKeySchema = z.string().regex(/^[a-z0-9]+([._:-][a-z0-9]+)*$/);
const positiveIntegerSchema = z.number().int().min(1).max(2147483647);
const nullableTextSchema = z.string().nullable();
const nullableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const textEncoder = new TextEncoder();
const nonBlankTextSchema = z.string().refine((value) => value.trim().length > 0);
const boundedText = (maximumBytes: number) => nonBlankTextSchema.refine(
  (value) => textEncoder.encode(value).byteLength <= maximumBytes,
);

function compareUtf8(left: string, right: string): number {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const length = Math.min(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

const sourceAliasArraySchema = z.array(boundedText(1024)).max(256)
  .superRefine((values, context) => {
    const canonical = [...new Set(values)].sort(compareUtf8);
    if (canonical.length !== values.length
        || canonical.some((value, index) => value !== values[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "HOMEOPATHIC_IMPORT_ROW_ALIAS_ARRAY_NOT_CANONICAL",
      });
    }
    const normalized = values.map((value) =>
      value.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "HOMEOPATHIC_IMPORT_ROW_ALIAS_TERM_DUPLICATE",
      });
    }
  });

export const homeopathicSourceRevisionPayloadSchema = z.object({
  source_id: uuidSchema,
  source_revision_id: uuidSchema,
  canonical_key: canonicalKeySchema,
  revision_no: positiveIntegerSchema,
  source_type: z.enum([
    "manufacturer_document",
    "traditional_reference",
    "practice_rule",
    "book",
    "journal_article",
    "clinical_study",
    "systematic_review",
    "guideline",
    "website",
    "database",
    "other",
  ]),
  title: nonBlankTextSchema,
  authors: z.array(z.string()),
  publisher: nullableTextSchema,
  edition: nullableTextSchema,
  published_on: nullableDateSchema,
  url: nullableTextSchema,
  doi: nullableTextSchema,
  pmid: nullableTextSchema,
  isbn: nullableTextSchema,
  retrieved_on: nullableDateSchema,
  file_sha256: sha256Schema.nullable(),
  rights_status: z.enum(["own_content", "licensed", "public_domain"]),
  archive_location: nullableTextSchema,
  content_hash: sha256Schema,
  metadata_hash: sha256Schema,
}).strict();

export const homeopathicRemedyEntityRevisionPayloadSchema = z.object({
  entity_id: uuidSchema,
  entity_revision_id: uuidSchema,
  entity_type_code: z.literal("homeopathic_remedy"),
  canonical_key: canonicalKeySchema,
  revision_no: positiveIntegerSchema,
  display_name: nonBlankTextSchema,
  summary: z.string(),
  description_markdown: z.string(),
  origin_type: z.enum(["human", "legacy_snapshot"]),
  content_hash: sha256Schema,
  metadata_hash: sha256Schema,
}).strict();

export const homeopathicRepertoryRevisionPayloadSchema = z.object({
  repertory_schema_version: z.literal(1),
  entity: z.object({
    entity_id: uuidSchema,
    entity_revision_id: uuidSchema,
    entity_type_code: z.literal("homeopathic_repertory"),
    canonical_key: canonicalKeySchema,
  }).strict(),
  revision: z.object({
    revision_no: positiveIntegerSchema,
    display_name: nonBlankTextSchema,
    summary: z.string(),
    description_markdown: z.string(),
    origin_type: z.enum(["human", "legacy_snapshot"]),
    metadata_hash: sha256Schema,
  }).strict(),
  source: homeopathicSourceRevisionPayloadSchema,
  source_binding: z.object({
    source_id: uuidSchema,
    source_revision_id: uuidSchema,
    source_repertory_code: boundedText(512),
    source_language_code: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
    source_locator: boundedText(4096),
  }).strict(),
}).strict().superRefine((payload, context) => {
  if (payload.source.source_id !== payload.source_binding.source_id
      || payload.source.source_revision_id !== payload.source_binding.source_revision_id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HOMEOPATHIC_IMPORT_ROW_SOURCE_BINDING_MISMATCH",
    });
  }
});

const repertoryLinkSchema = z.object({
  payload: homeopathicRepertoryRevisionPayloadSchema,
  content_hash: sha256Schema,
}).strict();

export const homeopathicRubricRevisionPayloadSchema = z.object({
  rubric_schema_version: z.literal(1),
  repertory_entity_id: uuidSchema,
  repertory_revision_id: uuidSchema,
  repertory: repertoryLinkSchema,
  rubric_id: uuidSchema,
  native_rubric_code: boundedText(512),
  parent_rubric_id: uuidSchema.nullable(),
  parent_native_rubric_code: boundedText(512).nullable(),
  parent_rubric_content_hash: sha256Schema.nullable(),
  rubric_text: boundedText(16384),
  rubric_domain: z.enum([
    "general",
    "mind",
    "modality",
    "location",
    "sensation",
    "concomitant",
    "other_source_native",
  ]),
  sibling_order: z.number().int().min(1).max(1000000),
  source_locator: boundedText(4096),
}).strict().superRefine((payload, context) => {
  const parentFieldCount = [
    payload.parent_rubric_id,
    payload.parent_native_rubric_code,
    payload.parent_rubric_content_hash,
  ].filter((value) => value !== null).length;
  if (parentFieldCount !== 0 && parentFieldCount !== 3) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HOMEOPATHIC_IMPORT_ROW_PARENT_BINDING_INCOMPLETE",
    });
  }
  if (payload.parent_rubric_id === payload.rubric_id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HOMEOPATHIC_IMPORT_ROW_PARENT_SELF_REFERENCE",
    });
  }
});

export const homeopathicGradeDefinitionPayloadSchema = z.object({
  grade_schema_version: z.literal(1),
  repertory_entity_id: uuidSchema,
  repertory_revision_id: uuidSchema,
  repertory: repertoryLinkSchema,
  grade_definition_id: uuidSchema,
  source_grade_code: boundedText(512),
  source_grade_label: boundedText(2048),
  grade_order: z.number().int().min(1).max(256),
  source_locator: boundedText(4096),
}).strict();

export const homeopathicRepertoryRemedyPayloadSchema = z.object({
  remedy_schema_version: z.literal(1),
  repertory_entity_id: uuidSchema,
  repertory_revision_id: uuidSchema,
  repertory: repertoryLinkSchema,
  repertory_remedy_id: uuidSchema,
  source_remedy_code: boundedText(512),
  source_remedy_name: boundedText(4096),
  source_remedy_aliases: sourceAliasArraySchema,
  source_locator: boundedText(4096),
  remedy_entity_revision: homeopathicRemedyEntityRevisionPayloadSchema,
}).strict();

const rubricLinkSchema = z.object({
  payload: homeopathicRubricRevisionPayloadSchema,
  content_hash: sha256Schema,
}).strict();
const remedyLinkSchema = z.object({
  payload: homeopathicRepertoryRemedyPayloadSchema,
  content_hash: sha256Schema,
}).strict();
const gradeLinkSchema = z.object({
  payload: homeopathicGradeDefinitionPayloadSchema,
  content_hash: sha256Schema,
}).strict();

export const homeopathicAssignmentPayloadSchema = z.object({
  assignment_schema_version: z.literal(1),
  repertory_entity_id: uuidSchema,
  repertory_revision_id: uuidSchema,
  repertory: repertoryLinkSchema,
  assignment_id: uuidSchema,
  rubric: rubricLinkSchema,
  remedy: remedyLinkSchema,
  grade: gradeLinkSchema,
  source_locator: boundedText(4096),
}).strict();

export type HomeopathicRepertoryRevisionPayload = z.infer<
  typeof homeopathicRepertoryRevisionPayloadSchema
>;
export type HomeopathicRubricRevisionPayload = z.infer<
  typeof homeopathicRubricRevisionPayloadSchema
>;
export type HomeopathicGradeDefinitionPayload = z.infer<
  typeof homeopathicGradeDefinitionPayloadSchema
>;
export type HomeopathicRepertoryRemedyPayload = z.infer<
  typeof homeopathicRepertoryRemedyPayloadSchema
>;
export type HomeopathicAssignmentPayload = z.infer<typeof homeopathicAssignmentPayloadSchema>;
type RepertoryLink = z.infer<typeof repertoryLinkSchema>;

async function assertRepertoryLink(
  link: RepertoryLink,
  repertoryEntityId: string,
  repertoryRevisionId: string,
): Promise<void> {
  if (link.payload.entity.entity_id !== repertoryEntityId
      || link.payload.entity.entity_revision_id !== repertoryRevisionId) {
    throw new Error("HOMEOPATHIC_IMPORT_ROW_REPERTORY_BINDING_MISMATCH");
  }
  const repertory = await hashHomeopathicRepertoryRevisionPayload(link.payload);
  if (repertory.contentHash !== link.content_hash) {
    throw new Error("HOMEOPATHIC_IMPORT_ROW_REPERTORY_HASH_MISMATCH");
  }
}

export async function hashHomeopathicRepertoryRevisionPayload(value: unknown) {
  const payload = homeopathicRepertoryRevisionPayloadSchema.parse(value);
  return { payload, contentHash: await hashPostgresCanonicalJsonb(payload) };
}

export async function hashHomeopathicRubricRevisionPayload(value: unknown) {
  const payload = homeopathicRubricRevisionPayloadSchema.parse(value);
  await assertRepertoryLink(
    payload.repertory,
    payload.repertory_entity_id,
    payload.repertory_revision_id,
  );
  return { payload, contentHash: await hashPostgresCanonicalJsonb(payload) };
}

export async function hashHomeopathicGradeDefinitionPayload(value: unknown) {
  const payload = homeopathicGradeDefinitionPayloadSchema.parse(value);
  await assertRepertoryLink(
    payload.repertory,
    payload.repertory_entity_id,
    payload.repertory_revision_id,
  );
  return { payload, contentHash: await hashPostgresCanonicalJsonb(payload) };
}

export async function hashHomeopathicRepertoryRemedyPayload(value: unknown) {
  const payload = homeopathicRepertoryRemedyPayloadSchema.parse(value);
  await assertRepertoryLink(
    payload.repertory,
    payload.repertory_entity_id,
    payload.repertory_revision_id,
  );
  return { payload, contentHash: await hashPostgresCanonicalJsonb(payload) };
}

export async function hashHomeopathicAssignmentPayload(value: unknown) {
  const payload = homeopathicAssignmentPayloadSchema.parse(value);
  await assertRepertoryLink(
    payload.repertory,
    payload.repertory_entity_id,
    payload.repertory_revision_id,
  );
  const [rubric, remedy, grade] = await Promise.all([
    hashHomeopathicRubricRevisionPayload(payload.rubric.payload),
    hashHomeopathicRepertoryRemedyPayload(payload.remedy.payload),
    hashHomeopathicGradeDefinitionPayload(payload.grade.payload),
  ]);
  if (rubric.contentHash !== payload.rubric.content_hash) {
    throw new Error("HOMEOPATHIC_IMPORT_ROW_RUBRIC_HASH_MISMATCH");
  }
  if (remedy.contentHash !== payload.remedy.content_hash) {
    throw new Error("HOMEOPATHIC_IMPORT_ROW_REMEDY_HASH_MISMATCH");
  }
  if (grade.contentHash !== payload.grade.content_hash) {
    throw new Error("HOMEOPATHIC_IMPORT_ROW_GRADE_HASH_MISMATCH");
  }
  return { payload, contentHash: await hashPostgresCanonicalJsonb(payload) };
}
