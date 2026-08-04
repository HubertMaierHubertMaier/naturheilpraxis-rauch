// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNutrientImportBundleContract,
  type NutrientImportBundleManifest,
} from "@/lib/nutrientImportBundle";

const hash = (value: string) => value.repeat(64);

const controlFlags = {
  deployment_allowed: false,
  import_execution_allowed: false,
  retention_allowed: false,
  deletion_allowed: false,
  replay_execution_allowed: false,
  shadow_execution_allowed: false,
  ai_use_allowed: false,
  plan_selection_allowed: false,
  dosage_evaluation_allowed: false,
  dosage_display_allowed: false,
  medical_use_allowed: false,
  production_use_allowed: false,
  activation_allowed: false,
} as const;

const baseManifest: NutrientImportBundleManifest = {
  contract_version: 1,
  contract_scope: "NUTRIENT_IMPORT_PREFLIGHT_ONLY",
  data_classification: "general_knowledge",
  source_policy: {
    contract_is_source_neutral: true,
    primary_assertion_provenance_required: true,
    source_rights_review_required: true,
    real_source_data_loaded: false,
  },
  preparation: {
    preparation_entity_id: "38000000-0000-4000-8000-000000000001",
    preparation_revision_id: "38100000-0000-4000-8000-000000000001",
    preparation_content_hash: hash("0"),
    preparation_kind: "nutrient_combination",
    formulation_kind: "combination",
    delivery_system: "standard",
  },
  component_count: 2,
  component_set_hash: hash("1"),
  provenance: {
    assertion_count: 3,
    source_binding_count: 3,
    source_binding_set_hash: hash("2"),
  },
  control_flags: controlFlags,
};

describe("Wiki Step 8B parser-side source-neutral nutrient bundle contract", () => {
  it("derives only the closed preflight counts without mutating the manifest", async () => {
    const original = structuredClone(baseManifest);
    const contract = await buildNutrientImportBundleContract(baseManifest);

    expect(baseManifest).toEqual(original);
    expect(contract.manifest).toEqual(baseManifest);
    expect(contract.manifest).not.toBe(baseManifest);
    expect(contract.expectedCounts).toEqual({
      components: 2,
      assertions: 3,
      source_bindings: 3,
    });
    expect(contract.bundleHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("binds preparation, component, provenance, and policy fields", async () => {
    const baseline = await buildNutrientImportBundleContract(baseManifest);
    const changedPreparation = await buildNutrientImportBundleContract({
      ...baseManifest,
      preparation: { ...baseManifest.preparation, preparation_content_hash: hash("3") },
    });
    const changedComponents = await buildNutrientImportBundleContract({
      ...baseManifest,
      component_set_hash: hash("4"),
    });
    const changedProvenance = await buildNutrientImportBundleContract({
      ...baseManifest,
      provenance: { ...baseManifest.provenance, source_binding_set_hash: hash("5") },
    });

    expect(new Set([
      baseline.bundleHash,
      changedPreparation.bundleHash,
      changedComponents.bundleHash,
      changedProvenance.bundleHash,
    ]).size).toBe(4);
  });

  it("rejects extra fields, malformed hashes, inconsistent counts, and authority", async () => {
    await expect(buildNutrientImportBundleContract({
      ...baseManifest,
      provider: "synthetic-vendor",
    })).rejects.toThrow();
    await expect(buildNutrientImportBundleContract({
      ...baseManifest,
      component_set_hash: hash("A"),
    })).rejects.toThrow();
    await expect(buildNutrientImportBundleContract({
      ...baseManifest,
      provenance: { ...baseManifest.provenance, source_binding_count: 2 },
    })).rejects.toThrow("NUTRIENT_IMPORT_BUNDLE_UNBOUND_ASSERTION_COUNT");
    await expect(buildNutrientImportBundleContract({
      ...baseManifest,
      preparation: { ...baseManifest.preparation, formulation_kind: "single" },
    })).rejects.toThrow("NUTRIENT_IMPORT_BUNDLE_FORMULATION_MISMATCH");
    await expect(buildNutrientImportBundleContract({
      ...baseManifest,
      control_flags: { ...baseManifest.control_flags, import_execution_allowed: true },
    })).rejects.toThrow();
  });

  it("contains no vendor, source reader, writer, patient, or activation path", () => {
    const implementation = readFileSync(
      resolve(process.cwd(), "src/lib/nutrientImportBundle.ts"),
      "utf8",
    );
    expect(implementation).not.toMatch(/strunz/i);
    expect(implementation).not.toMatch(/\b(?:fetch|FileReader|readFile|writeFile|insert|update|delete)\b/i);
    expect(implementation).not.toMatch(
      /\b(?:patient_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
  });
});
