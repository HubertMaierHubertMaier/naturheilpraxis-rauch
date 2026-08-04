import { z } from "zod";
import { hashPostgresCanonicalJsonb } from "@/lib/homeopathicImportBundle";

export const NUTRIENT_IMPORT_BUNDLE_CONTRACT_VERSION = 1 as const;
export const NUTRIENT_IMPORT_BUNDLE_SCOPE = "NUTRIENT_IMPORT_PREFLIGHT_ONLY" as const;

const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const nutrientPreparationKindSchema = z.enum([
  "nutrient_single",
  "nutrient_combination",
  "mineral",
  "trace_element",
  "amino_acid",
  "probiotic",
  "enzyme",
  "supplement",
]);
const deliverySystemSchema = z.enum([
  "standard",
  "chelated",
  "liposomal",
  "buffered",
  "extended_release",
  "oil_based",
  "water_based",
  "enteric_coated",
  "other",
]);

const sourcePolicySchema = z.object({
  contract_is_source_neutral: z.literal(true),
  primary_assertion_provenance_required: z.literal(true),
  source_rights_review_required: z.literal(true),
  real_source_data_loaded: z.literal(false),
}).strict();

const preparationSchema = z.object({
  preparation_entity_id: uuidSchema,
  preparation_revision_id: uuidSchema,
  preparation_content_hash: sha256Schema,
  preparation_kind: nutrientPreparationKindSchema,
  formulation_kind: z.enum(["single", "combination"]),
  delivery_system: deliverySystemSchema,
}).strict();

const controlFlagsSchema = z.object({
  deployment_allowed: z.literal(false),
  import_execution_allowed: z.literal(false),
  retention_allowed: z.literal(false),
  deletion_allowed: z.literal(false),
  replay_execution_allowed: z.literal(false),
  shadow_execution_allowed: z.literal(false),
  ai_use_allowed: z.literal(false),
  plan_selection_allowed: z.literal(false),
  dosage_evaluation_allowed: z.literal(false),
  dosage_display_allowed: z.literal(false),
  medical_use_allowed: z.literal(false),
  production_use_allowed: z.literal(false),
  activation_allowed: z.literal(false),
}).strict();

export const nutrientImportBundleManifestSchema = z.object({
  contract_version: z.literal(NUTRIENT_IMPORT_BUNDLE_CONTRACT_VERSION),
  contract_scope: z.literal(NUTRIENT_IMPORT_BUNDLE_SCOPE),
  data_classification: z.literal("general_knowledge"),
  source_policy: sourcePolicySchema,
  preparation: preparationSchema,
  component_count: z.number().int().min(1).max(4096),
  component_set_hash: sha256Schema,
  provenance: z.object({
    assertion_count: z.number().int().min(1).max(8192),
    source_binding_count: z.number().int().min(1).max(16384),
    source_binding_set_hash: sha256Schema,
  }).strict(),
  control_flags: controlFlagsSchema,
}).strict();

export type NutrientImportBundleManifest = z.infer<typeof nutrientImportBundleManifestSchema>;

function assertManifestRelationships(manifest: NutrientImportBundleManifest): void {
  if (manifest.provenance.source_binding_count < manifest.provenance.assertion_count) {
    throw new Error("NUTRIENT_IMPORT_BUNDLE_UNBOUND_ASSERTION_COUNT");
  }
  if (
    (manifest.preparation.preparation_kind === "nutrient_single"
      && manifest.preparation.formulation_kind !== "single")
    || (manifest.preparation.preparation_kind === "nutrient_combination"
      && manifest.preparation.formulation_kind !== "combination")
  ) {
    throw new Error("NUTRIENT_IMPORT_BUNDLE_FORMULATION_MISMATCH");
  }
}

export async function buildNutrientImportBundleContract(value: unknown): Promise<{
  manifest: NutrientImportBundleManifest;
  expectedCounts: {
    components: number;
    assertions: number;
    source_bindings: number;
  };
  bundleHash: string;
}> {
  const manifest = nutrientImportBundleManifestSchema.parse(value);
  assertManifestRelationships(manifest);
  return {
    manifest,
    expectedCounts: {
      components: manifest.component_count,
      assertions: manifest.provenance.assertion_count,
      source_bindings: manifest.provenance.source_binding_count,
    },
    bundleHash: await hashPostgresCanonicalJsonb(manifest),
  };
}
