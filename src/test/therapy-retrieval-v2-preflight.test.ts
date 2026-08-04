// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prerequisiteMigrationFiles = [
  "20260728090000_create_kb_phase1_core.sql",
  "20260728130000_create_kb_phase2_legacy_bridge.sql",
  "20260728140000_create_kb_phase3_import_staging.sql",
  "20260728150000_create_kb_source_draft_promotion.sql",
  "20260729140000_create_kb_therapeutic_catalog.sql",
  "20260730140000_create_kb_entity_candidate_contract.sql",
  "20260730150000_create_kb_entity_draft_promotion.sql",
  "20260731120000_create_therapy_input_envelope.sql",
  "20260731130000_create_therapy_input_facts.sql",
  "20260801090000_create_kb_release_contract.sql",
  "20260801100000_create_kb_clinical_rule_contract.sql",
  "20260802090000_create_kb_search_document_contract.sql",
  "20260802100000_create_kb_laboratory_contract.sql",
  "20260802110000_create_kb_homeopathic_repertory_contract.sql",
  "20260803100000_create_kb_homeopathic_reader_contract.sql",
  "20260803110000_create_kb_homeopathic_import_preflight_contract.sql",
  "20260803120000_create_kb_homeopathic_small_bundle_writer.sql",
  "20260803130000_create_kb_homeopathic_chunk_import_contract.sql",
] as const;
const prerequisiteMigrations = prerequisiteMigrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const migrationFile = "20260804090000_create_therapy_retrieval_v2_preflight.sql";
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", migrationFile),
  "utf8",
);
const entityResolutionMigrationFile =
  "20260804100000_create_therapy_entity_resolution_preflight.sql";
const entityResolutionMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", entityResolutionMigrationFile),
  "utf8",
);
const splitTrackMigrationFile =
  "20260804110000_create_therapy_split_track_preflight.sql";
const splitTrackMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", splitTrackMigrationFile),
  "utf8",
);
const safetyGateMigrationFile =
  "20260804120000_create_therapy_safety_gate_preflight.sql";
const safetyGateMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", safetyGateMigrationFile),
  "utf8",
);
const candidateStatusMigrationFile =
  "20260804130000_create_therapy_candidate_status_preflight.sql";
const candidateStatusMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", candidateStatusMigrationFile),
  "utf8",
);
const dosageRuleMigrationFile =
  "20260804140000_create_therapy_dosage_rule_preflight.sql";
const dosageRuleMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", dosageRuleMigrationFile),
  "utf8",
);
const auditEnvelopeMigrationFile =
  "20260804150000_create_therapy_retrieval_audit_envelope_preflight.sql";
const auditEnvelopeMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations", auditEnvelopeMigrationFile),
  "utf8",
);

const adminId = "11000000-0000-4000-8000-000000000001";
const patientId = "11000000-0000-4000-8000-000000000002";
const reviewerId = "11000000-0000-4000-8000-000000000003";
const inputRevisionId = "91000000-0000-4000-8000-000000000001";
const inputSourceId = "92000000-0000-4000-8000-000000000001";
const predecessorFactId = "93000000-0000-4000-8000-000000000001";
const successorFactId = "93000000-0000-4000-8000-000000000002";
const reviewOnlyFactId = "93000000-0000-4000-8000-000000000003";
const unreviewedFactId = "93000000-0000-4000-8000-000000000004";
const rejectedFactId = "93000000-0000-4000-8000-000000000005";
const knowledgeSourceId = "21000000-0000-4000-8000-000000000001";
const knowledgeSourceRevisionId = "22000000-0000-4000-8000-000000000001";
const diseaseEntityId = "31000000-0000-4000-8000-000000000001";
const diseaseEntityRevisionId = "32000000-0000-4000-8000-000000000001";
const plantEntityId = "31000000-0000-4000-8000-000000000002";
const plantEntityRevisionId = "32000000-0000-4000-8000-000000000002";
const outsideEntityId = "31000000-0000-4000-8000-000000000003";
const outsideEntityRevisionId = "32000000-0000-4000-8000-000000000003";
const relationAssertionId = "41000000-0000-4000-8000-000000000001";
const homeopathicRelationAssertionId = "41000000-0000-4000-8000-000000000002";
const homeopathicSourceId = "21000000-0000-4000-8000-000000000002";
const homeopathicSourceRevisionId = "22000000-0000-4000-8000-000000000002";
const repertoryEntityId = "31000000-0000-4000-8000-000000000010";
const repertoryRevisionId = "32000000-0000-4000-8000-000000000010";
const homeopathicRemedyIds = [
  "31000000-0000-4000-8000-000000000011",
  "31000000-0000-4000-8000-000000000012",
  "31000000-0000-4000-8000-000000000013",
] as const;
const homeopathicRemedyRevisionIds = [
  "32000000-0000-4000-8000-000000000011",
  "32000000-0000-4000-8000-000000000012",
  "32000000-0000-4000-8000-000000000013",
] as const;
const homeopathicRubricIds = [
  "42000000-0000-4000-8000-000000000010",
  "42000000-0000-4000-8000-000000000011",
  "42000000-0000-4000-8000-000000000012",
  "42000000-0000-4000-8000-000000000013",
] as const;
const homeopathicRubricRevisionIds = [
  "42100000-0000-4000-8000-000000000010",
  "42100000-0000-4000-8000-000000000011",
  "42100000-0000-4000-8000-000000000012",
  "42100000-0000-4000-8000-000000000013",
] as const;
const homeopathicGradeIds = [
  "52000000-0000-4000-8000-000000000010",
  "52000000-0000-4000-8000-000000000011",
] as const;
const repertoryRemedyIds = [
  "62000000-0000-4000-8000-000000000010",
  "62000000-0000-4000-8000-000000000011",
  "62000000-0000-4000-8000-000000000012",
] as const;
const knowledgeReleaseId = "61000000-0000-4000-8000-000000000001";
const safetyInputRevisionId = "91000000-0000-4000-8000-000000000010";
const safetyInputSourceId = "92000000-0000-4000-8000-000000000010";
const safetyContextFactId = "93000000-0000-4000-8000-000000000010";
const medicationStatusFactId = "93000000-0000-4000-8000-000000000011";
const activeMedicationFactId = "93000000-0000-4000-8000-000000000012";
const contraindicationFactId = "93000000-0000-4000-8000-000000000013";
const redFlagFactId = "93000000-0000-4000-8000-000000000014";
const quantitySafetyFactId = "93000000-0000-4000-8000-000000000015";
const excludedCandidateFactId = "93000000-0000-4000-8000-000000000016";
const safetyPreparationId = "31000000-0000-4000-8000-000000000020";
const safetyPreparationRevisionId = "32000000-0000-4000-8000-000000000020";
const medicationEntityId = "31000000-0000-4000-8000-000000000021";
const medicationEntityRevisionId = "32000000-0000-4000-8000-000000000021";
const candidateContextEntityId = "31000000-0000-4000-8000-000000000022";
const candidateContextRevisionId = "32000000-0000-4000-8000-000000000022";
const allowPreparationId = "31000000-0000-4000-8000-000000000023";
const allowPreparationRevisionId = "32000000-0000-4000-8000-000000000023";
const safetyBasisAssertionId = "41000000-0000-4000-8000-000000000020";
const interactionAssertionId = "41000000-0000-4000-8000-000000000021";
const contraindicationAssertionId = "41000000-0000-4000-8000-000000000022";
const precautionAssertionId = "41000000-0000-4000-8000-000000000023";
const allowBasisAssertionId = "41000000-0000-4000-8000-000000000024";
const allowSafetyAssertionId = "41000000-0000-4000-8000-000000000025";
const allowSupportAssertionId = "41000000-0000-4000-8000-000000000026";
const allowDosageAssertionId = "41000000-0000-4000-8000-000000000027";
const interactionRuleId = "51000000-0000-4000-8000-000000000020";
const contraindicationRuleId = "51000000-0000-4000-8000-000000000021";
const precautionRuleId = "51000000-0000-4000-8000-000000000022";
const allowSafetyRuleId = "51000000-0000-4000-8000-000000000023";
const allowDosageRuleId = "50000000-0000-4000-8000-000000000020";
const unknownInputRevisionId = "91000000-0000-4000-8000-000000000099";
const unknownReleaseId = "61000000-0000-4000-8000-000000000099";
const extractedAt = "2026-08-04T08:10:00.000000Z";
const reviewedAt = "2026-08-04T08:20:00.000000Z";

const sourcePayload = {
  format: "text",
  text: "Synthetic clinical source",
  language: "en",
};
const inputEnvelope = {
  format: "therapy_input_envelope_v1",
  clinical_text: "Synthetic deidentified input",
  context: {},
};
const neutralSourceId = "manual_input:artifact:abcdef123456";
const sourceLocator = "section:input";
const safetyNeutralSourceId = "manual_input:artifact:abcdef654321";
const safetySourceLocator = "section:safety_input";

type FactFixture = {
  id: string;
  order: number;
  type: string;
  key: string;
  label: string;
  value: Record<string, unknown>;
  reviewStatus: "unreviewed" | "review_only" | "verified" | "rejected";
  kbEntityId: string | null;
  supersedesFactId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type InputManifest = {
  contract_version: number;
  contract_scope: string;
  data_classification: string;
  complete_fact_set_hash: string;
  fact_selection_policy: {
    policy_version: number;
    accepted_review_statuses: string[];
    terminal_facts_only: boolean;
  };
  fact_counts: {
    total: number;
    terminal: number;
    superseded: number;
    selected: number;
    verified: number;
    review_only: number;
    excluded_unreviewed: number;
    excluded_rejected: number;
  };
  selected_facts: Array<{
    fact_id: string;
    fact_order: number;
    review_status: string;
    content_sha256: string;
  }>;
};

type PreflightResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  therapy_input_revision_id?: string;
  therapy_input_manifest_hash?: string;
  knowledge_release_id?: string;
  release_manifest_hash?: string;
  therapy_input_hash_matches?: boolean;
  release_manifest_hash_matches?: boolean;
  selected_fact_count?: number;
  review_only_fact_count?: number;
  requires_fact_review?: boolean;
  actual_therapy_input_hash?: string;
  actual_release_manifest_hash?: string;
  binding_hash?: string;
  result_hash: string;
  input_manifest?: InputManifest;
};

type EntityQueryManifest = {
  contract_version: number;
  contract_scope: string;
  selected_fact_count: number;
  input_manifest_hash: string;
  facts: Array<{
    fact_id: string;
    fact_order: number;
    kb_entity_id: string | null;
    query_terms: string[];
    identifier_terms: string[];
    query_hash: string;
  }>;
};

type DirectEntityCandidate = {
  position: number;
  candidate_status: string;
  entity_id: string;
  entity_revision_id: string;
  best_match_channel: string;
  matched_channels: string[];
};

type GraphEntityCandidate = {
  position: number;
  candidate_status: string;
  source_entity_id: string;
  relation_type_code: string;
  graph_direction: string;
  entity_id: string;
  entity_revision_id: string;
};

type EntityResolutionFact = {
  fact_id: string;
  direct_candidate_count_before_limit: number;
  returned_direct_candidate_count: number;
  direct_candidates: DirectEntityCandidate[];
  graph_candidate_count_before_limit: number;
  returned_graph_candidate_count: number;
  graph_candidates: GraphEntityCandidate[];
};

type EntityResolutionResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  binding_hash?: string;
  query_manifest_hash?: string;
  selected_fact_count?: number;
  direct_candidate_count_before_limit?: number;
  returned_direct_candidate_count?: number;
  graph_candidate_count_before_limit?: number;
  returned_graph_candidate_count?: number;
  facts?: EntityResolutionFact[];
  result_hash: string;
};

type HomeopathicRequestManifest = {
  contract_version: number;
  contract_scope: string;
  input_manifest_hash: string;
  fact_rubric_links: Array<{
    therapy_input_fact_id: string;
    rubric_revision_id: string;
    fact_content_sha256: string;
    fact_query_hash: string;
    importance: number;
    polarity: string;
  }>;
  repertory_request_hash: string;
};

type SplitTrackResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  candidate_status_assignment_allowed?: boolean;
  homeopathic_request_hash?: string;
  actual_homeopathic_request_hash?: string;
  general_track?: {
    track: string;
    status: string;
    direct_reference_count: number;
    graph_reference_count: number;
    excluded_homeopathic_reference_count: number;
    unresolved_reference_count: number;
    facts: Array<{
      fact_id: string;
      direct_references: DirectEntityCandidate[];
      graph_references: GraphEntityCandidate[];
      excluded_homeopathic_reference_count: number;
    }>;
    track_result_hash: string;
  };
  homeopathic_track?: {
    track: string;
    status: string;
    reader_status: string;
    candidate_count_before_limit: number;
    returned_candidate_count: number;
    candidates: Array<{
      candidate_status: string;
      remedy_entity_id: string;
      remedy_revision_id: string;
      source_remedy_code: string;
    }>;
    track_result_hash: string;
  };
  result_hash: string;
};

type SafetyInputManifest = {
  contract_version: number;
  contract_scope: string;
  therapy_input_manifest_hash: string;
  selected_fact_count: number;
  review_only_fact_count: number;
  requires_input_review: boolean;
  active_red_flag_count: number;
  red_flag_disposition: string;
  red_flags: Array<{
    fact_id: string;
    fact_content_sha256: string;
  }>;
  medication_status: string;
  medication_review_required: boolean;
  medication_status_fact_count: number;
  active_medication_count: number;
  unresolved_active_medication_count: number;
};

type SafetyRuleAssessment = {
  subject_entity_id: string;
  subject_entity_revision_id: string;
  safety_effect: string;
  rules: Array<{
    safety_rule_id: string;
    assertion_id: string;
    rule_type: string;
    effect: string;
    assessment_status: string;
    interaction_related_entity_present: boolean | null;
    conditions: Array<{
      condition_kind: string;
      condition_status: string;
    }>;
  }>;
};

type SafetyGateResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  candidate_formation_allowed: boolean;
  candidate_status_assignment_allowed: boolean;
  inactive_candidate_preflight_ready?: boolean;
  safety_preconditions_complete?: boolean;
  safety_disposition?: string;
  rules_evaluated?: boolean;
  split_track_result_hash?: string;
  actual_split_track_result_hash?: string;
  safety_input_manifest_hash?: string;
  safety_input_manifest?: SafetyInputManifest;
  safety_rule_assessments_hash?: string;
  safety_rule_assessments?: {
    subject_count: number;
    safety_rule_count: number;
    condition_count: number;
    matched_hard_contraindication_or_interaction_count: number;
    subject_assessments: SafetyRuleAssessment[];
  };
  unresolved_release_medication_count?: number;
  result_hash: string;
};

type CandidateStatusResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  retrieval_execution_allowed: boolean;
  productive_candidate_use_allowed: boolean;
  candidate_status_assignment_allowed: boolean;
  inactive_candidate_statuses_materialized?: boolean;
  dosage_evaluation_allowed: boolean;
  ai_use_allowed: boolean;
  global_candidate_status?: string;
  safety_gate_result_hash_matches?: boolean;
  therapy_input_manifest_hash?: string;
  release_manifest_hash?: string;
  split_track_result_hash?: string;
  safety_gate_result_hash?: string;
  candidate_count?: number;
  general_track?: {
    track: string;
    status: string;
    candidate_count: number;
    status_counts: Record<string, number>;
    opaque_composite_score_used: boolean;
    candidates: Array<{
      position: number;
      candidate_status: string;
      status_lock: string;
      status_reasons: string[];
      entity_id: string;
      entity_revision_id: string;
      entity_type_code: string;
      safety: {
        safety_effect: string;
        safety_rule_count: number;
      };
      dimensions: {
        clinical_fact_coverage: Record<string, number>;
        exact_reference_precision: Record<string, number | string>;
        clinical_relation_support: Record<string, number>;
        evidence_foundations: Record<string, number>;
        evidence_quality: Record<string, number>;
        preference_and_budget: Record<string, boolean>;
      };
      evidence_details: Array<{
        assertion_id: string;
        evidence_basis: string;
        evidence_quality: string;
      }>;
    }>;
    track_result_hash: string;
  } | null;
  homeopathic_track?: {
    track: string;
    status: string;
    candidate_count: number;
    status_counts: Record<string, number>;
    opaque_composite_score_used: boolean;
    candidates: Array<{
      position: number;
      candidate_status: string;
      status_reasons: string[];
      remedy_entity_id: string;
      dimensions: {
        rubric_coverage: Record<string, number>;
        domain_coverage: Record<string, number>;
        negative_rubric_conflicts: number;
        materia_medica_alignment: string;
        practice_experience: string;
      };
    }>;
    track_result_hash: string;
  } | null;
  result_hash: string;
};

type DosageRulePreflightResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  productive_candidate_use_allowed: boolean;
  dosage_evaluation_allowed: boolean;
  dosage_display_allowed: boolean;
  concrete_dosage_output_present?: boolean;
  ai_use_allowed: boolean;
  inactive_dosage_rule_bindings_ready?: boolean;
  global_candidate_status?: string;
  candidate_status_result_hash_matches?: boolean;
  allow_candidate_count?: number;
  binding_ready_candidate_count?: number;
  blocked_candidate_count?: number;
  excluded_general_candidate_count?: number;
  review_only_general_candidate_count?: number;
  homeopathic_candidate_count_excluded_from_dosage?: number;
  homeopathic_dosage_evaluation_allowed?: boolean;
  dosage_rule_scope?: {
    status: string;
    allow_candidate_count: number;
    released_dosage_rule_count: number;
    rules: Array<{
      dosage_rule_id: string;
      dosage_rule_content_hash: string;
      assertion_id: string;
      subject_entity_id: string;
      subject_entity_revision_id: string;
      indication_entity_id: string | null;
      indication_entity_revision_id: string | null;
      sources: Array<{
        source_revision_id: string;
        locator_hash: string;
      }>;
    }>;
    scope_hash: string;
  } | null;
  dosage_rule_assessments?: {
    dosage_display_allowed: boolean;
    allow_candidate_count: number;
    binding_ready_candidate_count: number;
    blocked_candidate_count: number;
    candidate_assessments: Array<{
      subject_entity_id: string;
      subject_entity_revision_id: string;
      assessment_status: string;
      inactive_rule_binding_ready: boolean;
      dosage_display_allowed: boolean;
      released_rule_count: number;
      applicable_rule_count: number;
      applicable_rule_identity: {
        dosage_rule_id: string;
        dosage_rule_content_hash: string;
        assertion_id: string;
      } | null;
      rule_assessments: Array<{
        dosage_rule_id: string;
        indication_matches: boolean;
        indication_fact_matches: Array<{
          therapy_input_fact_id: string;
          fact_content_sha256: string;
        }>;
        population_matches: boolean;
        applicability_status: string;
      }>;
    }>;
    assessments_hash: string;
  } | null;
  result_hash: string;
};

type AuditEnvelopeResult = {
  status: string;
  interpretation: string;
  medical_use_allowed: boolean;
  productive_candidate_use_allowed: boolean;
  dosage_evaluation_allowed: boolean;
  dosage_display_allowed: boolean;
  audit_persistence_allowed: boolean;
  replay_execution_allowed: boolean;
  shadow_execution_allowed: boolean;
  ai_use_allowed: boolean;
  plan_selection_allowed: boolean;
  activation_allowed: boolean;
  inactive_audit_envelope_ready?: boolean;
  global_candidate_status?: string;
  dosage_rule_result_status?: string;
  dosage_rule_result_hash?: string;
  dosage_rule_result_hash_matches?: boolean;
  audit_envelope_hash?: string;
  audit_envelope: {
    audit_envelope_version: number;
    data_classification: string;
    stage_hashes: Record<string, string>;
    fact_provenance: {
      selected_fact_count: number;
      fact_source_binding_count: number;
      raw_fact_values_present: boolean;
      raw_source_locators_present: boolean;
      facts: Array<{
        therapy_input_fact_id: string;
        fact_content_sha256: string;
        sources: Array<{
          therapy_input_source_id: string;
          source_content_sha256: string;
          source_locator_hash: string;
          fact_locator_hash: string;
        }>;
      }>;
      fact_provenance_hash: string;
    };
    comparator_manifest: {
      general_comparator_version: string;
      general_ordering_dimensions: string[];
      homeopathic_comparator_version: string;
      homeopathic_ordering_dimensions: string[];
      opaque_composite_score_used: boolean;
      comparator_manifest_hash: string;
    };
    candidate_decisions: {
      general: Array<{
        candidate_status: string;
        entity_id: string;
        entity_revision_id: string;
        candidate_payload_hash: string;
      }>;
      homeopathic: Array<{
        candidate_status: string;
        remedy_entity_id: string;
        candidate_payload_hash: string;
      }>;
      candidate_decisions_hash: string;
    };
    safety_decisions: {
      subjects: Array<{
        subject_entity_id: string;
        safety_effect: string;
        rules: Array<{
          safety_rule_id: string;
          assertion_id: string;
          assessment_status: string;
          rule_payload_hash: string;
        }>;
      }>;
      safety_decisions_hash: string;
    };
    dosage_decisions: {
      dosage_rule_result_status: string;
      concrete_dosage_output_present: boolean;
      rules: Array<{
        dosage_rule_id: string;
        dosage_rule_content_hash: string;
        assertion_id: string;
      }>;
      candidate_assessments: Array<{
        assessment_status: string;
      }>;
      dosage_decisions_hash: string;
    };
    knowledge_source_binding_count: number;
    knowledge_source_provenance: Array<{
      usage: string;
      rule_id: string | null;
      assertion_id: string;
      source_id: string;
      source_revision_id: string;
      source_content_hash: string;
      locator_hash: string;
    }>;
    raw_source_locators_present: boolean;
    concrete_dosage_output_present: boolean;
    ai_provenance: {
      execution_present: boolean;
      model: string | null;
      prompt_hash: string | null;
      raw_output_hash: string | null;
      validated_output_hash: string | null;
    };
    plan_selection_provenance: {
      selection_present: boolean;
      selected_position_count: number;
      selected_positions: number[];
    };
    audit_envelope_hash: string;
  } | null;
  result_hash: string;
};

const homeopathicRubricLinks = [
  {
    therapy_input_fact_id: successorFactId,
    rubric_revision_id: homeopathicRubricRevisionIds[1],
    importance: 5,
    polarity: "include",
  },
  {
    therapy_input_fact_id: reviewOnlyFactId,
    rubric_revision_id: homeopathicRubricRevisionIds[2],
    importance: 3,
    polarity: "include",
  },
  {
    therapy_input_fact_id: successorFactId,
    rubric_revision_id: homeopathicRubricRevisionIds[3],
    importance: 4,
    polarity: "exclude",
  },
] as const;
const safetyRubricLinks = [{
  therapy_input_fact_id: safetyContextFactId,
  rubric_revision_id: homeopathicRubricRevisionIds[1],
  importance: 1,
  polarity: "include",
}] as const;

let db: PGlite;
let sourceHash = "";
let inputRevisionHash = "";
let expectedInputHash = "";
let expectedReleaseManifestHash = "";
let inputManifest: InputManifest;
let successfulPreflight: PreflightResult;
let wikiSnapshotBefore = "";
let wikiSnapshotAfter = "";
let therapySnapshotBefore = "";
let therapySnapshotAfter = "";
let wikiSnapshotAfterEntityResolution = "";
let therapySnapshotAfterEntityResolution = "";
let entityQueryManifest: EntityQueryManifest;
let successfulEntityResolution: EntityResolutionResult;
let wikiSnapshotAfterSplitTrack = "";
let therapySnapshotAfterSplitTrack = "";
let homeopathicRequestManifest: HomeopathicRequestManifest;
let expectedHomeopathicRequestHash = "";
let successfulSplitTrack: SplitTrackResult;
let wikiSnapshotAfterSafetyGate = "";
let therapySnapshotAfterSafetyGate = "";
let safetyInputHash = "";
let safetyHomeopathicRequestHash = "";
let safetySplitTrackHash = "";
let safetyInputManifest: SafetyInputManifest;
let successfulSafetyGate: SafetyGateResult;
let successfulSafetySplitTrack: SplitTrackResult;
let wikiSnapshotAfterCandidateStatus = "";
let therapySnapshotAfterCandidateStatus = "";
let successfulCandidateStatus: CandidateStatusResult;
let wikiSnapshotAfterDosageRule = "";
let therapySnapshotAfterDosageRule = "";
let successfulDosageRulePreflight: DosageRulePreflightResult;
let wikiSnapshotAfterAuditEnvelope = "";
let therapySnapshotAfterAuditEnvelope = "";
let successfulAuditEnvelope: AuditEnvelopeResult;

async function bootstrapDatabase(): Promise<void> {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE authenticator NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin', 'patient');

    CREATE TABLE public.user_roles (
      user_id uuid NOT NULL,
      role public.app_role NOT NULL,
      UNIQUE (user_id, role)
    );
    CREATE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
         WHERE user_id = _user_id AND role = _role
      )
    $$;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

    CREATE FUNCTION public.update_updated_at_column()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

    CREATE TABLE public.admin_knowledge_base (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      category text NOT NULL DEFAULT 'General',
      tags text[] NOT NULL DEFAULT '{}',
      content text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      entry_kind text NOT NULL DEFAULT 'reference',
      review_status text NOT NULL DEFAULT 'unreviewed',
      evidence_level text NOT NULL DEFAULT 'unrated',
      dosage_status text NOT NULL DEFAULT 'unverified',
      rights_status text NOT NULL DEFAULT 'unknown',
      source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
      therapeutic_topics text[] NOT NULL DEFAULT '{}',
      contraindications text[] NOT NULL DEFAULT '{}',
      interaction_tags text[] NOT NULL DEFAULT '{}',
      safety_notes text NOT NULL DEFAULT '',
      patient_facing_allowed boolean NOT NULL DEFAULT false,
      commercial_claims_reviewed boolean NOT NULL DEFAULT false,
      last_reviewed_at timestamptz,
      reviewed_by uuid
    );
    CREATE TABLE public.mannayan_products (id uuid PRIMARY KEY);
    CREATE TABLE public.knowledge_product_links (id uuid PRIMARY KEY);
    CREATE TABLE public.faqs (id uuid PRIMARY KEY);
    CREATE TABLE public.practice_pricing (id uuid PRIMARY KEY);
    CREATE TABLE public.practice_info (id uuid PRIMARY KEY);
    CREATE TABLE public.patient_snapshot (
      pseudonym_id text PRIMARY KEY,
      snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${patientId}', 'patient');
  `);
}

async function hashJson(value: unknown): Promise<string> {
  const result = await db.query<{ hash: string }>(
    "SELECT public.therapy_input_jsonb_sha256_v1($1::jsonb) AS hash",
    [JSON.stringify(value)],
  );
  return result.rows[0].hash;
}

async function insertInputRevision(): Promise<void> {
  sourceHash = await hashJson({
    hash_schema_version: 1,
    source_order: 1,
    neutral_source_id: neutralSourceId,
    source_type: "manual_input",
    document_date: "2026-08-04",
    source_locator: sourceLocator,
    source_payload: sourcePayload,
  });
  inputRevisionHash = await hashJson({
    envelope_schema_version: 1,
    hash_schema_version: 1,
    deidentification_version: "clinical-deidentification-v1",
    data_classification: "pseudonymized_health_data",
    pseudonym_id: "P-2026-6001",
    input_envelope: inputEnvelope,
    source_count: 1,
    sources: [{
      source_order: 1,
      neutral_source_id: neutralSourceId,
      source_type: "manual_input",
      document_date: "2026-08-04",
      source_locator: sourceLocator,
      content_sha256: sourceHash,
    }],
  });

  await db.exec("BEGIN;");
  try {
    await db.query(`
      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, input_envelope, source_count, content_sha256,
        captured_at, captured_by
      ) VALUES (
        $1, 'P-2026-6001', $2::jsonb, 1, $3,
        '2026-08-04T08:00:00Z', $4
      )
    `, [inputRevisionId, JSON.stringify(inputEnvelope), inputRevisionHash, adminId]);
    await db.query(`
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, document_date, source_locator, source_payload, content_sha256
      ) VALUES ($1, $2, 1, $3, 'manual_input', '2026-08-04', $4, $5::jsonb, $6)
    `, [
      inputSourceId,
      inputRevisionId,
      neutralSourceId,
      sourceLocator,
      JSON.stringify(sourcePayload),
      sourceHash,
    ]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function insertFact(fact: FactFixture): Promise<void> {
  const factLocator = `field:fact_${fact.order}`;
  const contentHash = await hashJson({
    therapy_input_revision_id: inputRevisionId,
    therapy_input_revision_sha256: inputRevisionHash,
    envelope_schema_version: 1,
    revision_hash_schema_version: 1,
    deidentification_version: "clinical-deidentification-v1",
    fact_schema_version: 1,
    hash_schema_version: 1,
    fact_id: fact.id,
    fact_order: fact.order,
    fact_type: fact.type,
    fact_key: fact.key,
    fact_label: fact.label,
    fact_value: fact.value,
    is_negated: false,
    clinical_status: "current",
    certainty: "confirmed",
    extraction_confidence: "high",
    extraction_method: "manual",
    review_status: fact.reviewStatus,
    evidence_scope: "patient_report",
    effective_start_date: null,
    effective_end_date: null,
    effective_date_precision: "unknown",
    kb_entity_id: fact.kbEntityId,
    source_count: 1,
    supersedes_fact_id: fact.supersedesFactId,
    extracted_at: extractedAt,
    extracted_by: adminId,
    reviewed_at: fact.reviewedAt,
    reviewed_by: fact.reviewedBy,
    sources: [{
      link_order: 1,
      source_order: 1,
      neutral_source_id: neutralSourceId,
      source_type: "manual_input",
      document_date: "2026-08-04",
      source_locator: sourceLocator,
      fact_locator: factLocator,
      content_sha256: sourceHash,
      source_role: "primary",
    }],
  });

  await db.exec("BEGIN;");
  try {
    await db.query(`
      INSERT INTO public.therapy_input_facts (
        id, therapy_input_revision_id, fact_order, fact_type, fact_key,
        fact_label, fact_value, is_negated, clinical_status, certainty,
        extraction_confidence, extraction_method, review_status, evidence_scope,
        effective_date_precision, kb_entity_id, source_count, supersedes_fact_id,
        extracted_at, extracted_by, reviewed_at, reviewed_by, content_sha256
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, false, 'current', 'confirmed',
        'high', 'manual', $8, 'patient_report', 'unknown', $9, 1, $10,
        $11, $12, $13, $14, $15
      )
    `, [
      fact.id,
      inputRevisionId,
      fact.order,
      fact.type,
      fact.key,
      fact.label,
      JSON.stringify(fact.value),
      fact.reviewStatus,
      fact.kbEntityId,
      fact.supersedesFactId,
      extractedAt,
      adminId,
      fact.reviewedAt,
      fact.reviewedBy,
      contentHash,
    ]);
    await db.query(`
      INSERT INTO public.therapy_input_fact_sources (
        therapy_input_revision_id, therapy_input_fact_id, link_order,
        source_order, fact_locator, source_role
      ) VALUES ($1, $2, 1, 1, $3, 'primary')
    `, [inputRevisionId, fact.id, factLocator]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function insertInputFacts(): Promise<void> {
  await insertFact({
    id: predecessorFactId,
    order: 1,
    type: "condition",
    key: "condition.synthetic_contract",
    label: "Synthetic contract condition",
    value: { type: "boolean", value: true },
    reviewStatus: "verified",
    kbEntityId: diseaseEntityId,
    supersedesFactId: null,
    reviewedAt,
    reviewedBy: reviewerId,
  });
  await insertFact({
    id: successorFactId,
    order: 2,
    type: "condition",
    key: "condition.synthetic_contract",
    label: "Synthetic contract condition",
    value: {
      type: "coded",
      system: "icd_10_gm",
      code: "R53",
      display: "Synthetic coded disease",
    },
    reviewStatus: "verified",
    kbEntityId: null,
    supersedesFactId: predecessorFactId,
    reviewedAt,
    reviewedBy: reviewerId,
  });
  await insertFact({
    id: reviewOnlyFactId,
    order: 3,
    type: "open_question",
    key: "open_question.synthetic_review",
    label: "Synthetic review question",
    value: { type: "none" },
    reviewStatus: "review_only",
    kbEntityId: plantEntityId,
    supersedesFactId: null,
    reviewedAt: null,
    reviewedBy: null,
  });
  await insertFact({
    id: unreviewedFactId,
    order: 4,
    type: "symptom",
    key: "symptom.synthetic_unreviewed",
    label: "Synthetic unreviewed symptom",
    value: { type: "text", value: "Synthetic unreviewed value" },
    reviewStatus: "unreviewed",
    kbEntityId: null,
    supersedesFactId: null,
    reviewedAt: null,
    reviewedBy: null,
  });
  await insertFact({
    id: rejectedFactId,
    order: 5,
    type: "symptom",
    key: "symptom.synthetic_rejected",
    label: "Synthetic rejected symptom",
    value: { type: "text", value: "Synthetic rejected value" },
    reviewStatus: "rejected",
    kbEntityId: null,
    supersedesFactId: null,
    reviewedAt,
    reviewedBy: reviewerId,
  });
}

type SafetyFactFixture = {
  id: string;
  order: number;
  type: string;
  key: string;
  label: string;
  value: Record<string, unknown>;
  kbEntityId: string | null;
  isNegated?: boolean;
};

async function insertSafetyInput(): Promise<void> {
  const safetySourcePayload = {
    format: "text",
    text: "Synthetic deidentified safety input source",
    language: "en",
  };
  const safetyEnvelope = {
    format: "therapy_input_envelope_v1",
    clinical_text: "Synthetic deidentified safety gate input",
    context: {
      budget_eur: 100,
      preferred_lanes: ["general", "homeopathic"],
    },
  };
  const safetySourceHash = await hashJson({
    hash_schema_version: 1,
    source_order: 1,
    neutral_source_id: safetyNeutralSourceId,
    source_type: "manual_input",
    document_date: "2026-08-04",
    source_locator: safetySourceLocator,
    source_payload: safetySourcePayload,
  });
  const safetyRevisionHash = await hashJson({
    envelope_schema_version: 1,
    hash_schema_version: 1,
    deidentification_version: "clinical-deidentification-v1",
    data_classification: "pseudonymized_health_data",
    pseudonym_id: "P-2026-6002",
    input_envelope: safetyEnvelope,
    source_count: 1,
    sources: [{
      source_order: 1,
      neutral_source_id: safetyNeutralSourceId,
      source_type: "manual_input",
      document_date: "2026-08-04",
      source_locator: safetySourceLocator,
      content_sha256: safetySourceHash,
    }],
  });

  await db.exec("BEGIN;");
  try {
    await db.query(`
      INSERT INTO public.therapy_input_revisions (
        id, pseudonym_id, input_envelope, source_count, content_sha256,
        captured_at, captured_by
      ) VALUES (
        $1, 'P-2026-6002', $2::jsonb, 1, $3,
        '2026-08-04T09:00:00Z', $4
      )
    `, [safetyInputRevisionId, JSON.stringify(safetyEnvelope), safetyRevisionHash, adminId]);
    await db.query(`
      INSERT INTO public.therapy_input_sources (
        id, therapy_input_revision_id, source_order, neutral_source_id,
        source_type, document_date, source_locator, source_payload, content_sha256
      ) VALUES ($1, $2, 1, $3, 'manual_input', '2026-08-04', $4, $5::jsonb, $6)
    `, [
      safetyInputSourceId,
      safetyInputRevisionId,
      safetyNeutralSourceId,
      safetySourceLocator,
      JSON.stringify(safetySourcePayload),
      safetySourceHash,
    ]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }

  const insertSafetyFact = async (fact: SafetyFactFixture): Promise<void> => {
    const factLocator = `field:safety_fact_${fact.order}`;
    const isNegated = fact.isNegated ?? false;
    const factContentHash = await hashJson({
      therapy_input_revision_id: safetyInputRevisionId,
      therapy_input_revision_sha256: safetyRevisionHash,
      envelope_schema_version: 1,
      revision_hash_schema_version: 1,
      deidentification_version: "clinical-deidentification-v1",
      fact_schema_version: 1,
      hash_schema_version: 1,
      fact_id: fact.id,
      fact_order: fact.order,
      fact_type: fact.type,
      fact_key: fact.key,
      fact_label: fact.label,
      fact_value: fact.value,
      is_negated: isNegated,
      clinical_status: "current",
      certainty: "confirmed",
      extraction_confidence: "high",
      extraction_method: "manual",
      review_status: "verified",
      evidence_scope: "patient_report",
      effective_start_date: null,
      effective_end_date: null,
      effective_date_precision: "unknown",
      kb_entity_id: fact.kbEntityId,
      source_count: 1,
      supersedes_fact_id: null,
      extracted_at: extractedAt,
      extracted_by: adminId,
      reviewed_at: reviewedAt,
      reviewed_by: reviewerId,
      sources: [{
        link_order: 1,
        source_order: 1,
        neutral_source_id: safetyNeutralSourceId,
        source_type: "manual_input",
        document_date: "2026-08-04",
        source_locator: safetySourceLocator,
        fact_locator: factLocator,
        content_sha256: safetySourceHash,
        source_role: "primary",
      }],
    });

    await db.exec("BEGIN;");
    try {
      await db.query(`
        INSERT INTO public.therapy_input_facts (
          id, therapy_input_revision_id, fact_order, fact_type, fact_key,
          fact_label, fact_value, is_negated, clinical_status, certainty,
          extraction_confidence, extraction_method, review_status, evidence_scope,
          effective_date_precision, kb_entity_id, source_count, extracted_at,
          extracted_by, reviewed_at, reviewed_by, content_sha256
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'current', 'confirmed',
          'high', 'manual', 'verified', 'patient_report', 'unknown', $9, 1,
          $10, $11, $12, $13, $14
        )
      `, [
        fact.id,
        safetyInputRevisionId,
        fact.order,
        fact.type,
        fact.key,
        fact.label,
        JSON.stringify(fact.value),
        isNegated,
        fact.kbEntityId,
        extractedAt,
        adminId,
        reviewedAt,
        reviewerId,
        factContentHash,
      ]);
      await db.query(`
        INSERT INTO public.therapy_input_fact_sources (
          therapy_input_revision_id, therapy_input_fact_id, link_order,
          source_order, fact_locator, source_role
        ) VALUES ($1, $2, 1, 1, $3, 'primary')
      `, [safetyInputRevisionId, fact.id, factLocator]);
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  };

  await insertSafetyFact({
    id: safetyContextFactId,
    order: 1,
    type: "symptom",
    key: "symptom.synthetic_safety_context",
    label: "Synthetic safety context",
    value: { type: "boolean", value: true },
    kbEntityId: candidateContextEntityId,
  });
  await insertSafetyFact({
    id: medicationStatusFactId,
    order: 2,
    type: "medication",
    key: "medication.status",
    label: "Synthetic medication status",
    value: { type: "coded", system: "local_v1", code: "complete" },
    kbEntityId: null,
  });
  await insertSafetyFact({
    id: activeMedicationFactId,
    order: 3,
    type: "medication",
    key: "medication.synthetic_active",
    label: "Synthetic active medication",
    value: { type: "coded", system: "atc", code: "A01AA01" },
    kbEntityId: medicationEntityId,
  });
  await insertSafetyFact({
    id: contraindicationFactId,
    order: 4,
    type: "allergy",
    key: "allergy.synthetic_substance",
    label: "Synthetic contraindication marker",
    value: { type: "coded", system: "local_v1", code: "present" },
    kbEntityId: null,
  });
  await insertSafetyFact({
    id: redFlagFactId,
    order: 5,
    type: "safety_flag",
    key: "safety_flag.synthetic_escalation",
    label: "Synthetic negated escalation marker",
    value: { type: "boolean", value: true },
    kbEntityId: null,
    isNegated: true,
  });
  await insertSafetyFact({
    id: quantitySafetyFactId,
    order: 6,
    type: "demographic",
    key: "demographic.age_years",
    label: "Synthetic age quantity",
    value: {
      type: "quantity",
      value: 40,
      comparator: "eq",
      unit_system: "ucum",
      unit_code: "a",
    },
    kbEntityId: null,
  });
  await insertSafetyFact({
    id: excludedCandidateFactId,
    order: 7,
    type: "therapy_goal",
    key: "therapy_goal.synthetic_excluded_candidate",
    label: "Synthetic excluded candidate request",
    value: { type: "boolean", value: true },
    kbEntityId: safetyPreparationId,
  });
}

async function releaseKnowledgeRevision(
  table: "kb_source_revisions" | "kb_entity_revisions" | "kb_assertions",
  id: string,
  safetyReview: boolean,
): Promise<void> {
  await db.query(`UPDATE public.${table} SET review_status = 'domain_review' WHERE id = $1`, [id]);
  if (safetyReview) {
    await db.query(`UPDATE public.${table} SET review_status = 'safety_review' WHERE id = $1`, [id]);
  }
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'approved', reviewed_at = '2026-08-04T08:30:00Z',
           reviewed_by = $2
     WHERE id = $1
  `, [id, reviewerId]);
  await db.query(`
    UPDATE public.${table}
       SET review_status = 'released', released_at = '2026-08-04T08:40:00Z'
     WHERE id = $1
  `, [id]);
}

type ReleaseItemReference = {
  kind: "entity_revision" | "assertion" | "source_revision";
  entityId?: string;
  entityRevisionId?: string;
  assertionId?: string;
  sourceId?: string;
  sourceRevisionId?: string;
};

async function addReleaseItem(
  itemOrder: number,
  reference: ReleaseItemReference,
): Promise<void> {
  await db.query(`
    WITH manifest AS (
      SELECT public.kb_release_item_manifest_v1(
        $4::uuid, $5::uuid, NULL, NULL, $6::uuid, $7::uuid, $8::uuid
      ) AS value
    )
    INSERT INTO public.kb_release_items (
      release_id, item_order, item_kind, entity_id, entity_revision_id,
      assertion_id, source_id, source_revision_id, item_manifest, item_manifest_hash
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8,
           value, public.kb_release_manifest_hash_v1(value)
      FROM manifest
  `, [
    knowledgeReleaseId,
    itemOrder,
    reference.kind,
    reference.entityId ?? null,
    reference.entityRevisionId ?? null,
    reference.assertionId ?? null,
    reference.sourceId ?? null,
    reference.sourceRevisionId ?? null,
  ]);
}

async function insertHomeopathicFixture(): Promise<void> {
  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${homeopathicSourceId}', 'source:split-track-repertory');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, rights_status, content_hash
    ) VALUES (
      '${homeopathicSourceRevisionId}', '${homeopathicSourceId}', 1, 'database',
      'Synthetic split-track repertory source', 'licensed', repeat('6', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${homeopathicSourceRevisionId}'
     WHERE id = '${homeopathicSourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${repertoryEntityId}', 'homeopathic_repertory',
       'homeopathic-repertory:split-track-synthetic'),
      ('${homeopathicRemedyIds[0]}', 'homeopathic_remedy',
       'homeopathic-remedy:split-track-alpha'),
      ('${homeopathicRemedyIds[1]}', 'homeopathic_remedy',
       'homeopathic-remedy:split-track-beta'),
      ('${homeopathicRemedyIds[2]}', 'homeopathic_remedy',
       'homeopathic-remedy:split-track-gamma');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${repertoryRevisionId}', '${repertoryEntityId}', 1,
       'Synthetic split-track repertory', 'Synthetic source-native fixture.',
       'Non-medical split-track fixture.', repeat('0', 64)),
      ('${homeopathicRemedyRevisionIds[0]}', '${homeopathicRemedyIds[0]}', 1,
       'Synthetic homeopathic alpha', '', '', repeat('7', 64)),
      ('${homeopathicRemedyRevisionIds[1]}', '${homeopathicRemedyIds[1]}', 1,
       'Synthetic homeopathic beta', '', '', repeat('8', 64)),
      ('${homeopathicRemedyRevisionIds[2]}', '${homeopathicRemedyIds[2]}', 1,
       'Synthetic homeopathic gamma', '', '', repeat('9', 64));
    UPDATE public.kb_entities entity SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN (
         '${repertoryEntityId}', '${homeopathicRemedyIds[0]}',
         '${homeopathicRemedyIds[1]}', '${homeopathicRemedyIds[2]}'
       );
    INSERT INTO public.kb_entity_names (
      entity_id, name, normalized_name, name_kind, language_code, is_preferred
    ) VALUES
      ('${repertoryEntityId}', 'Synthetic split-track repertory',
       'synthetic split-track repertory', 'preferred', 'en', true),
      ('${homeopathicRemedyIds[0]}', 'Synthetic homeopathic alpha',
       'synthetic homeopathic alpha', 'preferred', 'en', true),
      ('${homeopathicRemedyIds[0]}', 'Synthetic review question',
       'synthetic review question', 'spelling_variant', 'en', false),
      ('${homeopathicRemedyIds[1]}', 'Synthetic homeopathic beta',
       'synthetic homeopathic beta', 'preferred', 'en', true),
      ('${homeopathicRemedyIds[2]}', 'Synthetic homeopathic gamma',
       'synthetic homeopathic gamma', 'preferred', 'en', true);

    INSERT INTO public.kb_relation_type_domains (
      relation_type_code, subject_entity_type_code,
      object_entity_type_code, review_status
    ) VALUES ('may_support', 'homeopathic_remedy', 'disease', 'draft');
    UPDATE public.kb_relation_type_domains
       SET review_status = 'approved'
     WHERE relation_type_code = 'may_support'
       AND subject_entity_type_code = 'homeopathic_remedy'
       AND object_entity_type_code = 'disease';
    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text, content_hash
    ) VALUES (
      '${homeopathicRelationAssertionId}',
      'assertion:split-track-homeopathic-origin', 1, 'entity_relation',
      'Synthetic homeopathic-origin edge for track separation testing.',
      repeat('a', 64)
    );
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES (
      '${homeopathicRelationAssertionId}', '${homeopathicSourceRevisionId}',
      'supports', 'section:split-track-edge', true
    );
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id,
      assignment_strength, rank, context_text
    ) VALUES (
      '${homeopathicRelationAssertionId}', '${homeopathicRemedyIds[0]}',
      'may_support', '${diseaseEntityId}', 'possible', 50,
      'Synthetic cross-track exclusion edge only.'
    );

    INSERT INTO public.kb_homeopathic_repertory_revision_details (
      entity_id, entity_revision_id, source_id, source_revision_id,
      source_repertory_code, source_language_code, source_locator
    ) VALUES (
      '${repertoryEntityId}', '${repertoryRevisionId}',
      '${homeopathicSourceId}', '${homeopathicSourceRevisionId}',
      'SYN-SPLIT-1', 'de', 'catalog:split-track:edition-1'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_homeopathic_repertory_revision_hash_v1(entity_id, id)
     WHERE id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_rubrics (
      id, repertory_entity_id, native_rubric_code
    ) VALUES
      ('${homeopathicRubricIds[0]}', '${repertoryEntityId}', 'ROOT'),
      ('${homeopathicRubricIds[1]}', '${repertoryEntityId}', 'ROOT.MIND'),
      ('${homeopathicRubricIds[2]}', '${repertoryEntityId}', 'ROOT.MODALITY'),
      ('${homeopathicRubricIds[3]}', '${repertoryEntityId}', 'ROOT.EXCLUDE');
    INSERT INTO public.kb_homeopathic_rubric_revisions (
      id, repertory_entity_id, repertory_revision_id, rubric_id,
      parent_rubric_id, rubric_text, rubric_domain, sibling_order,
      source_locator, rubric_content_hash
    ) VALUES
      ('${homeopathicRubricRevisionIds[0]}', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricIds[0]}', NULL,
       'Synthetic root', 'general', 1, 'rubric:root', repeat('0', 64)),
      ('${homeopathicRubricRevisionIds[1]}', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricIds[1]}',
       '${homeopathicRubricIds[0]}', 'Synthetic mind rubric', 'mind', 1,
       'rubric:root.mind', repeat('0', 64)),
      ('${homeopathicRubricRevisionIds[2]}', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricIds[2]}',
       '${homeopathicRubricIds[0]}', 'Synthetic modality rubric', 'modality', 2,
       'rubric:root.modality', repeat('0', 64)),
      ('${homeopathicRubricRevisionIds[3]}', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricIds[3]}',
       '${homeopathicRubricIds[0]}', 'Synthetic exclusion rubric', 'general', 3,
       'rubric:root.exclude', repeat('0', 64));
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id = '${homeopathicRubricRevisionIds[0]}';
    UPDATE public.kb_homeopathic_rubric_revisions
       SET rubric_content_hash = public.kb_homeopathic_rubric_revision_hash_v1(id)
     WHERE id IN (
       '${homeopathicRubricRevisionIds[1]}',
       '${homeopathicRubricRevisionIds[2]}',
       '${homeopathicRubricRevisionIds[3]}'
     );

    INSERT INTO public.kb_homeopathic_grade_definitions (
      id, repertory_entity_id, repertory_revision_id, source_grade_code,
      source_grade_label, grade_order, source_locator, grade_content_hash
    ) VALUES
      ('${homeopathicGradeIds[0]}', '${repertoryEntityId}', '${repertoryRevisionId}',
       'G-A', 'Source grade A', 1, 'grade:a', repeat('0', 64)),
      ('${homeopathicGradeIds[1]}', '${repertoryEntityId}', '${repertoryRevisionId}',
       'G-B', 'Source grade B', 2, 'grade:b', repeat('0', 64));
    UPDATE public.kb_homeopathic_grade_definitions
       SET grade_content_hash = public.kb_homeopathic_grade_definition_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_repertory_remedies (
      id, repertory_entity_id, repertory_revision_id, remedy_entity_id,
      remedy_revision_id, source_remedy_code, source_remedy_name,
      source_locator, remedy_content_hash
    ) VALUES
      ('${repertoryRemedyIds[0]}', '${repertoryEntityId}', '${repertoryRevisionId}',
       '${homeopathicRemedyIds[0]}', '${homeopathicRemedyRevisionIds[0]}',
       'R-A', 'Synthetic alpha', 'remedy:r-a', repeat('0', 64)),
      ('${repertoryRemedyIds[1]}', '${repertoryEntityId}', '${repertoryRevisionId}',
       '${homeopathicRemedyIds[1]}', '${homeopathicRemedyRevisionIds[1]}',
       'r-B', 'Synthetic beta', 'remedy:r-b', repeat('0', 64)),
      ('${repertoryRemedyIds[2]}', '${repertoryEntityId}', '${repertoryRevisionId}',
       '${homeopathicRemedyIds[2]}', '${homeopathicRemedyRevisionIds[2]}',
       'R-C', 'Synthetic gamma', 'remedy:r-c', repeat('0', 64));
    UPDATE public.kb_homeopathic_repertory_remedies
       SET remedy_content_hash = public.kb_homeopathic_repertory_remedy_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';

    INSERT INTO public.kb_homeopathic_rubric_remedy_assignments (
      id, repertory_entity_id, repertory_revision_id, rubric_revision_id,
      repertory_remedy_id, grade_definition_id, source_locator,
      assignment_content_hash
    ) VALUES
      ('72000000-0000-4000-8000-000000000010', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricRevisionIds[1]}',
       '${repertoryRemedyIds[0]}', '${homeopathicGradeIds[1]}',
       'assignment:mind:r-a', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000011', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricRevisionIds[2]}',
       '${repertoryRemedyIds[0]}', '${homeopathicGradeIds[0]}',
       'assignment:modality:r-a', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000012', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricRevisionIds[1]}',
       '${repertoryRemedyIds[1]}', '${homeopathicGradeIds[0]}',
       'assignment:mind:r-b', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000013', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricRevisionIds[2]}',
       '${repertoryRemedyIds[2]}', '${homeopathicGradeIds[1]}',
       'assignment:modality:r-c', repeat('0', 64)),
      ('72000000-0000-4000-8000-000000000014', '${repertoryEntityId}',
       '${repertoryRevisionId}', '${homeopathicRubricRevisionIds[3]}',
       '${repertoryRemedyIds[2]}', '${homeopathicGradeIds[1]}',
       'assignment:exclude:r-c', repeat('0', 64));
    UPDATE public.kb_homeopathic_rubric_remedy_assignments
       SET assignment_content_hash = public.kb_homeopathic_assignment_hash_v1(id)
     WHERE repertory_revision_id = '${repertoryRevisionId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);

  await releaseKnowledgeRevision(
    "kb_source_revisions",
    homeopathicSourceRevisionId,
    false,
  );
  for (const revisionId of homeopathicRemedyRevisionIds) {
    await releaseKnowledgeRevision("kb_entity_revisions", revisionId, true);
  }
  await releaseKnowledgeRevision("kb_entity_revisions", repertoryRevisionId, true);
  await releaseKnowledgeRevision(
    "kb_assertions",
    homeopathicRelationAssertionId,
    true,
  );
}

async function insertSealedKnowledgeRelease(): Promise<void> {
  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${knowledgeSourceId}', 'source:retrieval-v2-preflight');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, content_hash
    ) VALUES (
      '${knowledgeSourceRevisionId}', '${knowledgeSourceId}', 1,
      'practice_rule', 'Synthetic preflight source', repeat('1', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${knowledgeSourceRevisionId}'
     WHERE id = '${knowledgeSourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${diseaseEntityId}', 'disease', 'disease:retrieval-v2-synthetic'),
      ('${plantEntityId}', 'plant', 'plant:retrieval-v2-synthetic'),
      ('${outsideEntityId}', 'symptom', 'symptom:outside-release-synthetic'),
      ('${safetyPreparationId}', 'preparation', 'preparation:safety-gate-synthetic'),
      ('${medicationEntityId}', 'substance', 'substance:safety-gate-medication'),
      ('${candidateContextEntityId}', 'symptom', 'symptom:candidate-status-context'),
      ('${allowPreparationId}', 'preparation', 'preparation:candidate-status-allow');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary,
      description_markdown, content_hash
    ) VALUES
      ('${diseaseEntityRevisionId}', '${diseaseEntityId}', 1,
       'Synthetic coded disease', 'Synthetic contract condition summary',
       'Full text marker for the synthetic contract condition.', repeat('2', 64)),
      ('${plantEntityRevisionId}', '${plantEntityId}', 1,
       'Synthetic support plant', 'Synthetic review question summary',
       'Full text marker for the synthetic review question.', repeat('3', 64)),
      ('${outsideEntityRevisionId}', '${outsideEntityId}', 1,
       'Synthetic outside-release symptom', 'Not part of the bound release.',
       'Explicit-link fail-closed fixture.', repeat('5', 64)),
      ('${safetyPreparationRevisionId}', '${safetyPreparationId}', 1,
       'Synthetic isolated safety preparation', 'Safety-gate fixture only.',
       'Not a medical product or recommendation.', repeat('b', 64)),
      ('${medicationEntityRevisionId}', '${medicationEntityId}', 1,
       'Synthetic isolated medication substance', 'Interaction fixture only.',
       'Not a real medication or recommendation.', repeat('c', 64)),
      ('${candidateContextRevisionId}', '${candidateContextEntityId}', 1,
       'Synthetic safety context', 'Candidate-status context only.',
       'Not a clinical symptom or diagnosis.', repeat('d', 64)),
      ('${allowPreparationRevisionId}', '${allowPreparationId}', 1,
       'Synthetic inactive allow preparation', 'Candidate-status fixture only.',
       'Not a medical product or recommendation.', repeat('e', 64));
    UPDATE public.kb_entities entity
       SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN (
         '${diseaseEntityId}', '${plantEntityId}', '${outsideEntityId}',
         '${safetyPreparationId}', '${medicationEntityId}',
         '${candidateContextEntityId}', '${allowPreparationId}'
       );
    INSERT INTO public.kb_entity_names (
      entity_id, name, normalized_name, name_kind, language_code, is_preferred
    ) VALUES
      ('${diseaseEntityId}', 'Synthetic coded disease',
       'synthetic coded disease', 'preferred', 'en', true),
      ('${diseaseEntityId}', 'Synthetic contract condition',
       'synthetic contract condition', 'spelling_variant', 'en', false),
      ('${plantEntityId}', 'Synthetic support plant',
       'synthetic support plant', 'preferred', 'en', true),
      ('${plantEntityId}', 'Synthetic review question',
       'synthetic review question', 'spelling_variant', 'en', false),
      ('${outsideEntityId}', 'Synthetic outside-release symptom',
       'synthetic outside-release symptom', 'preferred', 'en', true),
      ('${safetyPreparationId}', 'Synthetic isolated safety preparation',
       'synthetic isolated safety preparation', 'preferred', 'en', true),
      ('${medicationEntityId}', 'Synthetic isolated medication substance',
       'synthetic isolated medication substance', 'preferred', 'en', true),
      ('${candidateContextEntityId}', 'Synthetic safety context',
       'synthetic safety context', 'preferred', 'en', true),
      ('${allowPreparationId}', 'Synthetic inactive allow preparation',
       'synthetic inactive allow preparation', 'preferred', 'en', true);
    INSERT INTO public.kb_entity_identifiers (
      entity_id, scheme_code, value, normalized_value, is_primary
    ) VALUES ('${diseaseEntityId}', 'icd_10_gm', 'R53', 'R53', true);

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text,
      evidence_basis, evidence_quality, content_hash
    ) VALUES
      ('${relationAssertionId}', 'assertion:retrieval-v2-synthetic-relation', 1,
       'entity_relation', 'Synthetic plant relation for contract testing.',
       'unrated', 'unrated', repeat('4', 64)),
      ('${safetyBasisAssertionId}', 'assertion:safety-gate-preparation-basis', 1,
       'classification', 'Synthetic safety preparation basis.',
       'unrated', 'unrated', repeat('d', 64)),
      ('${interactionAssertionId}', 'assertion:safety-gate-interaction', 1,
       'safety', 'Synthetic interaction rule for contract testing.',
       'practice_rule', 'moderate', repeat('e', 64)),
      ('${contraindicationAssertionId}', 'assertion:safety-gate-contraindication', 1,
       'safety', 'Synthetic contraindication rule for contract testing.',
       'practice_rule', 'moderate', repeat('f', 64)),
      ('${precautionAssertionId}', 'assertion:safety-gate-precaution', 1,
       'safety', 'Synthetic AND-condition rule for contract testing.',
       'practice_rule', 'moderate', repeat('0', 64)),
      ('${allowBasisAssertionId}', 'assertion:candidate-status-allow-basis', 1,
       'classification', 'Synthetic inactive allow preparation basis.',
       'unrated', 'unrated', repeat('1', 64)),
      ('${allowSafetyAssertionId}', 'assertion:candidate-status-allow-safety', 1,
       'safety', 'Synthetic informational safety rule.',
       'practice_rule', 'moderate', repeat('2', 64)),
      ('${allowSupportAssertionId}', 'assertion:candidate-status-allow-support', 1,
       'entity_relation', 'Synthetic released support evidence.',
       'clinical_study', 'high', repeat('3', 64)),
      ('${allowDosageAssertionId}', 'assertion:dosage-rule-preflight-allow', 1,
       'dosage', 'Synthetic inactive dosage-rule identity.',
       'practice_rule', 'moderate', repeat('4', 64));
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES
      ('${relationAssertionId}', '${knowledgeSourceRevisionId}',
       'supports', 'section:synthetic', true),
      ('${safetyBasisAssertionId}', '${knowledgeSourceRevisionId}',
       'supports', 'section:safety-basis', true),
      ('${interactionAssertionId}', '${knowledgeSourceRevisionId}',
       'qualifies', 'section:safety-interaction', true),
      ('${contraindicationAssertionId}', '${knowledgeSourceRevisionId}',
       'qualifies', 'section:safety-contraindication', true),
      ('${precautionAssertionId}', '${knowledgeSourceRevisionId}',
       'qualifies', 'section:safety-precaution', true),
      ('${allowBasisAssertionId}', '${knowledgeSourceRevisionId}',
       'supports', 'section:candidate-allow-basis', true),
      ('${allowSafetyAssertionId}', '${knowledgeSourceRevisionId}',
       'qualifies', 'section:candidate-allow-safety', true),
      ('${allowSupportAssertionId}', '${knowledgeSourceRevisionId}',
       'supports', 'section:candidate-allow-support', true),
      ('${allowDosageAssertionId}', '${knowledgeSourceRevisionId}',
       'supports', 'section:dosage-rule-preflight', true);
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id,
      assignment_strength, rank, context_text
    ) VALUES (
      '${relationAssertionId}', '${plantEntityId}', 'may_support',
      '${diseaseEntityId}', 'possible', 40, 'Synthetic graph edge only.'
    );
    INSERT INTO public.kb_entity_relations (
      assertion_id, subject_entity_id, relation_type_code, object_entity_id,
      assignment_strength, rank, context_text
    ) VALUES (
      '${allowSupportAssertionId}', '${allowPreparationId}', 'may_support',
      '${candidateContextEntityId}', 'direct', 90,
      'Synthetic candidate-status support edge only.'
    );

    INSERT INTO public.kb_preparation_revision_details (
      entity_id, entity_revision_id, preparation_kind, dosage_form,
      administration_routes, basis_assertion_id
    ) VALUES (
      '${safetyPreparationId}', '${safetyPreparationRevisionId}', 'other',
      'other', ARRAY['oral'], '${safetyBasisAssertionId}'
    ), (
      '${allowPreparationId}', '${allowPreparationRevisionId}', 'other',
      'other', ARRAY['oral'], '${allowBasisAssertionId}'
    );
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
     WHERE id IN ('${safetyPreparationRevisionId}', '${allowPreparationRevisionId}');

    INSERT INTO public.kb_safety_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      related_entity_id, related_entity_revision_id, rule_type, severity,
      effect, notice_text, rule_content_hash
    ) VALUES (
      '${interactionRuleId}', '${interactionAssertionId}',
      '${safetyPreparationId}', '${safetyPreparationRevisionId}',
      '${medicationEntityId}', '${medicationEntityRevisionId}',
      'interaction', 'avoid', 'exclude',
      'Synthetic interaction exclusion.', repeat('0', 64)
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind
    ) VALUES ('${interactionRuleId}', 1, 'always');

    INSERT INTO public.kb_safety_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      rule_type, severity, effect, notice_text, rule_content_hash
    ) VALUES (
      '${contraindicationRuleId}', '${contraindicationAssertionId}',
      '${safetyPreparationId}', '${safetyPreparationRevisionId}',
      'contraindication', 'avoid', 'exclude',
      'Synthetic contraindication exclusion.', repeat('0', 64)
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind,
      fact_type, fact_key, coded_system, coded_values
    ) VALUES (
      '${contraindicationRuleId}', 1, 'coded_value_in',
      'allergy', 'allergy.synthetic_substance', 'local_v1', ARRAY['present']
    );

    INSERT INTO public.kb_safety_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      rule_type, severity, effect, notice_text, rule_content_hash
    ) VALUES (
      '${precautionRuleId}', '${precautionAssertionId}',
      '${safetyPreparationId}', '${safetyPreparationRevisionId}',
      'precaution', 'caution', 'review_only',
      'Synthetic complete AND-condition review.', repeat('0', 64)
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind,
      condition_entity_id, condition_entity_revision_id
    ) VALUES (
      '${precautionRuleId}', 1, 'entity_present',
      '${medicationEntityId}', '${medicationEntityRevisionId}'
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind, fact_type, fact_key
    ) VALUES
      ('${precautionRuleId}', 2, 'fact_present',
       'symptom', 'symptom.synthetic_safety_context'),
      ('${precautionRuleId}', 3, 'fact_missing',
       'open_question', 'open_question.synthetic_absent');
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind, fact_type, fact_key,
      quantity_comparator, quantity_value, quantity_unit_system, quantity_unit_code
    ) VALUES (
      '${precautionRuleId}', 4, 'quantity_compare',
      'demographic', 'demographic.age_years', 'ge', 18, 'ucum', 'a'
    );

    INSERT INTO public.kb_safety_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      rule_type, severity, effect, notice_text, rule_content_hash
    ) VALUES (
      '${allowSafetyRuleId}', '${allowSafetyAssertionId}',
      '${allowPreparationId}', '${allowPreparationRevisionId}',
      'monitoring', 'information', 'allow_with_notice',
      'Synthetic informational notice.', repeat('0', 64)
    );
    INSERT INTO public.kb_safety_rule_conditions (
      safety_rule_id, condition_order, condition_kind
    ) VALUES ('${allowSafetyRuleId}', 1, 'always');
    INSERT INTO public.kb_dosage_rules (
      id, assertion_id, subject_entity_id, subject_entity_revision_id,
      indication_entity_id, indication_entity_revision_id,
      administration_route, dose_min, dose_max, dose_unit_system, dose_unit_code,
      frequency_min, frequency_max, frequency_period,
      duration_min, duration_max, duration_unit, timing, rule_content_hash
    ) VALUES (
      '${allowDosageRuleId}', '${allowDosageAssertionId}',
      '${allowPreparationId}', '${allowPreparationRevisionId}',
      '${candidateContextEntityId}', '${candidateContextRevisionId}',
      'oral', 1, 2, 'local_v1', 'drop', 1, 2, 'day',
      1, 2, 'day', 'unspecified', repeat('0', 64)
    );
    UPDATE public.kb_dosage_rules
       SET rule_content_hash = public.kb_dosage_rule_hash_v1(id)
     WHERE id = '${allowDosageRuleId}';
    UPDATE public.kb_safety_rules
       SET rule_content_hash = public.kb_safety_rule_hash_v1(id)
     WHERE id IN (
       '${interactionRuleId}', '${contraindicationRuleId}', '${precautionRuleId}',
       '${allowSafetyRuleId}'
     );
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);
  await releaseKnowledgeRevision("kb_source_revisions", knowledgeSourceRevisionId, false);
  await releaseKnowledgeRevision("kb_entity_revisions", diseaseEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_entity_revisions", plantEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_entity_revisions", outsideEntityRevisionId, true);
  await releaseKnowledgeRevision("kb_entity_revisions", candidateContextRevisionId, true);
  await releaseKnowledgeRevision("kb_assertions", safetyBasisAssertionId, true);
  await releaseKnowledgeRevision(
    "kb_entity_revisions",
    safetyPreparationRevisionId,
    true,
  );
  await releaseKnowledgeRevision(
    "kb_entity_revisions",
    medicationEntityRevisionId,
    true,
  );
  await releaseKnowledgeRevision("kb_assertions", allowBasisAssertionId, true);
  await releaseKnowledgeRevision(
    "kb_entity_revisions",
    allowPreparationRevisionId,
    true,
  );
  await releaseKnowledgeRevision("kb_assertions", relationAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", interactionAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", contraindicationAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", precautionAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", allowSafetyAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", allowSupportAssertionId, true);
  await releaseKnowledgeRevision("kb_assertions", allowDosageAssertionId, true);
  await insertHomeopathicFixture();

  await db.exec("BEGIN;");
  try {
    await db.query(`
      WITH release_input AS (
        SELECT $1::uuid AS id, 'release:retrieval-v2-preflight'::text AS release_key
      ), manifest AS (
        SELECT release_input.*,
               public.kb_release_manifest_v1(id, release_key) AS value
          FROM release_input
      )
      INSERT INTO public.kb_releases (
        id, release_key, release_manifest, release_manifest_hash
      )
      SELECT id, release_key, value, public.kb_release_manifest_hash_v1(value)
        FROM manifest
    `, [knowledgeReleaseId]);
    await addReleaseItem(1, {
      kind: "source_revision",
      sourceId: knowledgeSourceId,
      sourceRevisionId: knowledgeSourceRevisionId,
    });
    await addReleaseItem(2, {
      kind: "entity_revision",
      entityId: diseaseEntityId,
      entityRevisionId: diseaseEntityRevisionId,
    });
    await addReleaseItem(3, {
      kind: "entity_revision",
      entityId: plantEntityId,
      entityRevisionId: plantEntityRevisionId,
    });
    await addReleaseItem(4, {
      kind: "assertion",
      assertionId: relationAssertionId,
    });
    await addReleaseItem(5, {
      kind: "source_revision",
      sourceId: homeopathicSourceId,
      sourceRevisionId: homeopathicSourceRevisionId,
    });
    await addReleaseItem(6, {
      kind: "entity_revision",
      entityId: repertoryEntityId,
      entityRevisionId: repertoryRevisionId,
    });
    for (const [index, entityId] of homeopathicRemedyIds.entries()) {
      await addReleaseItem(7 + index, {
        kind: "entity_revision",
        entityId,
        entityRevisionId: homeopathicRemedyRevisionIds[index],
      });
    }
    await addReleaseItem(10, {
      kind: "assertion",
      assertionId: homeopathicRelationAssertionId,
    });
    await addReleaseItem(11, {
      kind: "entity_revision",
      entityId: safetyPreparationId,
      entityRevisionId: safetyPreparationRevisionId,
    });
    await addReleaseItem(12, {
      kind: "entity_revision",
      entityId: medicationEntityId,
      entityRevisionId: medicationEntityRevisionId,
    });
    await addReleaseItem(13, {
      kind: "assertion",
      assertionId: safetyBasisAssertionId,
    });
    await addReleaseItem(14, {
      kind: "assertion",
      assertionId: interactionAssertionId,
    });
    await addReleaseItem(15, {
      kind: "assertion",
      assertionId: contraindicationAssertionId,
    });
    await addReleaseItem(16, {
      kind: "assertion",
      assertionId: precautionAssertionId,
    });
    await addReleaseItem(17, {
      kind: "entity_revision",
      entityId: candidateContextEntityId,
      entityRevisionId: candidateContextRevisionId,
    });
    await addReleaseItem(18, {
      kind: "entity_revision",
      entityId: allowPreparationId,
      entityRevisionId: allowPreparationRevisionId,
    });
    await addReleaseItem(19, {
      kind: "assertion",
      assertionId: allowBasisAssertionId,
    });
    await addReleaseItem(20, {
      kind: "assertion",
      assertionId: allowSafetyAssertionId,
    });
    await addReleaseItem(21, {
      kind: "assertion",
      assertionId: allowSupportAssertionId,
    });
    await addReleaseItem(22, {
      kind: "assertion",
      assertionId: allowDosageAssertionId,
    });
    await db.query(`
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             ),
             release_status = 'sealed',
             sealed_at = '2026-08-04T08:50:00Z'
       WHERE release.id = $1
    `, [knowledgeReleaseId]);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT;");
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => undefined);
    throw error;
  }
  await db.query(`
    INSERT INTO public.kb_search_documents (release_id, release_item_id)
    SELECT item.release_id, item.id
      FROM public.kb_release_items item
     WHERE item.release_id = $1
       AND item.item_kind = 'entity_revision'
     ORDER BY item.item_order
  `, [knowledgeReleaseId]);
  expectedReleaseManifestHash = (await db.query<{ hash: string }>(`
    SELECT release_manifest_hash AS hash FROM public.kb_releases WHERE id = $1
  `, [knowledgeReleaseId])).rows[0].hash;
}

async function readPreflight(
  expectedInput: string | null = expectedInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  revisionId: string | null = inputRevisionId,
  releaseId: string | null = knowledgeReleaseId,
): Promise<PreflightResult> {
  return (await db.query<{ value: PreflightResult }>(`
    SELECT public.therapy_retrieval_v2_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text
    ) AS value
  `, [revisionId, expectedInput, releaseId, expectedRelease])).rows[0].value;
}

async function readEntityResolution(
  expectedInput: string | null = expectedInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  directLimit: number | null = 8,
  graphLimit: number | null = 16,
): Promise<EntityResolutionResult> {
  return (await db.query<{ value: EntityResolutionResult }>(`
    SELECT public.therapy_retrieval_v2_entity_resolution_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::integer, $6::integer
    ) AS value
  `, [
    inputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    directLimit,
    graphLimit,
  ])).rows[0].value;
}

async function readSplitTrack(
  expectedInput: string | null = expectedInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  rubricLinks: unknown = homeopathicRubricLinks,
  expectedRequest: string | null = expectedHomeopathicRequestHash,
  homeopathicLimit: number | null = 50,
): Promise<SplitTrackResult> {
  return (await db.query<{ value: SplitTrackResult }>(`
    SELECT public.therapy_retrieval_v2_split_track_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, 8, 16, $9::integer
    ) AS value
  `, [
    inputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(rubricLinks),
    expectedRequest,
    homeopathicLimit,
  ])).rows[0].value;
}

async function readSafetySplitTrack(
  expectedInput: string,
  expectedRelease: string,
  expectedRequest: string,
): Promise<SplitTrackResult> {
  return (await db.query<{ value: SplitTrackResult }>(`
    SELECT public.therapy_retrieval_v2_split_track_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, 8, 16, 50
    ) AS value
  `, [
    safetyInputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
    expectedRequest,
  ])).rows[0].value;
}

async function readSafetyGate(
  expectedInput: string | null = safetyInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  expectedRequest: string | null = safetyHomeopathicRequestHash,
  expectedSplit: string | null = safetySplitTrackHash,
): Promise<SafetyGateResult> {
  return (await db.query<{ value: SafetyGateResult }>(`
    SELECT public.therapy_retrieval_v2_safety_gate_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, $9::text, 8, 16, 50
    ) AS value
  `, [
    safetyInputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
    expectedRequest,
    expectedSplit,
  ])).rows[0].value;
}

async function readCurrentSafetyGate(
  expectedRelease = expectedReleaseManifestHash,
): Promise<SafetyGateResult> {
  const currentInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [safetyInputRevisionId])).rows[0].value;
  const currentRequestManifest = (await db.query<{ value: HomeopathicRequestManifest }>(`
    SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb
    ) AS value
  `, [
    safetyInputRevisionId,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
  ])).rows[0].value;
  const currentRequestHash = await hashJson(currentRequestManifest);
  const currentSplit = await readSafetySplitTrack(
    currentInputHash,
    expectedRelease,
    currentRequestHash,
  );
  expect(currentSplit.status).toBe("SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE");
  return readSafetyGate(
    currentInputHash,
    expectedRelease,
    currentRequestHash,
    currentSplit.result_hash,
  );
}

async function readCandidateStatus(
  expectedInput: string | null = safetyInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  expectedRequest: string | null = safetyHomeopathicRequestHash,
  expectedSplit: string | null = safetySplitTrackHash,
  expectedSafety: string | null = successfulSafetyGate?.result_hash ?? null,
): Promise<CandidateStatusResult> {
  return (await db.query<{ value: CandidateStatusResult }>(`
    SELECT public.therapy_retrieval_v2_candidate_status_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, $9::text, $10::text, 8, 16, 50
    ) AS value
  `, [
    safetyInputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
    expectedRequest,
    expectedSplit,
    expectedSafety,
  ])).rows[0].value;
}

async function readDosageRulePreflight(
  expectedInput: string | null = safetyInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  expectedRequest: string | null = safetyHomeopathicRequestHash,
  expectedSplit: string | null = safetySplitTrackHash,
  expectedSafety: string | null = successfulSafetyGate?.result_hash ?? null,
  expectedCandidate: string | null = successfulCandidateStatus?.result_hash ?? null,
): Promise<DosageRulePreflightResult> {
  return (await db.query<{ value: DosageRulePreflightResult }>(`
    SELECT public.therapy_retrieval_v2_dosage_rule_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, $9::text, $10::text, $11::text, 8, 16, 50
    ) AS value
  `, [
    safetyInputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
    expectedRequest,
    expectedSplit,
    expectedSafety,
    expectedCandidate,
  ])).rows[0].value;
}

async function readAuditEnvelope(
  expectedInput: string | null = safetyInputHash,
  expectedRelease: string | null = expectedReleaseManifestHash,
  expectedRequest: string | null = safetyHomeopathicRequestHash,
  expectedSplit: string | null = safetySplitTrackHash,
  expectedSafety: string | null = successfulSafetyGate?.result_hash ?? null,
  expectedCandidate: string | null = successfulCandidateStatus?.result_hash ?? null,
  expectedDosage: string | null = successfulDosageRulePreflight?.result_hash ?? null,
): Promise<AuditEnvelopeResult> {
  return (await db.query<{ value: AuditEnvelopeResult }>(`
    SELECT public.therapy_retrieval_v2_audit_envelope_preflight_v1(
      $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
      $7::jsonb, $8::text, $9::text, $10::text, $11::text, $12::text,
      8, 16, 50
    ) AS value
  `, [
    safetyInputRevisionId,
    expectedInput,
    knowledgeReleaseId,
    expectedRelease,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
    expectedRequest,
    expectedSplit,
    expectedSafety,
    expectedCandidate,
    expectedDosage,
  ])).rows[0].value;
}

async function readCurrentDosageRulePriority(): Promise<DosageRulePreflightResult> {
  const currentInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [safetyInputRevisionId])).rows[0].value;
  const currentRequestManifest = (await db.query<{ value: HomeopathicRequestManifest }>(`
    SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb
    ) AS value
  `, [
    safetyInputRevisionId,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
  ])).rows[0].value;
  const currentRequestHash = await hashJson(currentRequestManifest);
  const currentSplit = await readSafetySplitTrack(
    currentInputHash,
    expectedReleaseManifestHash,
    currentRequestHash,
  );
  expect(currentSplit.status).toBe("SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE");
  return readDosageRulePreflight(
    currentInputHash,
    expectedReleaseManifestHash,
    currentRequestHash,
    currentSplit.result_hash,
    successfulSafetyGate.result_hash,
    successfulCandidateStatus.result_hash,
  );
}

async function readCurrentAuditPriority(): Promise<AuditEnvelopeResult> {
  const currentInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [safetyInputRevisionId])).rows[0].value;
  const currentRequestManifest = (await db.query<{ value: HomeopathicRequestManifest }>(`
    SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb
    ) AS value
  `, [
    safetyInputRevisionId,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
  ])).rows[0].value;
  const currentRequestHash = await hashJson(currentRequestManifest);
  const currentSplit = await readSafetySplitTrack(
    currentInputHash,
    expectedReleaseManifestHash,
    currentRequestHash,
  );
  expect(currentSplit.status).toBe("SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE");
  return readAuditEnvelope(
    currentInputHash,
    expectedReleaseManifestHash,
    currentRequestHash,
    currentSplit.result_hash,
    successfulSafetyGate.result_hash,
    successfulCandidateStatus.result_hash,
    successfulDosageRulePreflight.result_hash,
  );
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase();
  for (const prerequisiteMigration of prerequisiteMigrations) {
    await db.exec(prerequisiteMigration);
  }
  await insertSealedKnowledgeRelease();
  await insertInputRevision();
  await insertInputFacts();
  await insertSafetyInput();

  wikiSnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;

  await db.exec(migration);

  wikiSnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  inputManifest = (await db.query<{ value: InputManifest }>(`
    SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  expectedInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  successfulPreflight = await readPreflight();

  await db.exec(entityResolutionMigration);
  wikiSnapshotAfterEntityResolution = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterEntityResolution = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  entityQueryManifest = (await db.query<{ value: EntityQueryManifest }>(`
    SELECT public.therapy_retrieval_v2_entity_query_manifest_v1($1) AS value
  `, [inputRevisionId])).rows[0].value;
  successfulEntityResolution = await readEntityResolution();

  await db.exec(splitTrackMigration);
  wikiSnapshotAfterSplitTrack = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterSplitTrack = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  homeopathicRequestManifest = (await db.query<{
    value: HomeopathicRequestManifest;
  }>(`
    SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb
    ) AS value
  `, [
    inputRevisionId,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(homeopathicRubricLinks),
  ])).rows[0].value;
  expectedHomeopathicRequestHash = (await db.query<{ value: string }>(`
    SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS value
  `, [JSON.stringify(homeopathicRequestManifest)])).rows[0].value;
  successfulSplitTrack = await readSplitTrack();

  safetyInputHash = (await db.query<{ value: string }>(`
    SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
  `, [safetyInputRevisionId])).rows[0].value;
  const safetyRequestManifest = (await db.query<{
    value: HomeopathicRequestManifest;
  }>(`
    SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
      $1::uuid, $2::uuid, $3::uuid, $4::jsonb
    ) AS value
  `, [
    safetyInputRevisionId,
    repertoryEntityId,
    repertoryRevisionId,
    JSON.stringify(safetyRubricLinks),
  ])).rows[0].value;
  safetyHomeopathicRequestHash = await hashJson(safetyRequestManifest);
  successfulSafetySplitTrack = await readSafetySplitTrack(
    safetyInputHash,
    expectedReleaseManifestHash,
    safetyHomeopathicRequestHash,
  );
  expect(successfulSafetySplitTrack.status)
    .toBe("SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE");
  safetySplitTrackHash = successfulSafetySplitTrack.result_hash;

  await db.exec(safetyGateMigration);
  wikiSnapshotAfterSafetyGate = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterSafetyGate = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  safetyInputManifest = (await db.query<{ value: SafetyInputManifest }>(`
    SELECT public.therapy_retrieval_v2_safety_input_manifest_v1($1) AS value
  `, [safetyInputRevisionId])).rows[0].value;
  successfulSafetyGate = await readSafetyGate();

  await db.exec(candidateStatusMigration);
  wikiSnapshotAfterCandidateStatus = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterCandidateStatus = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  successfulCandidateStatus = await readCandidateStatus();

  await db.exec(dosageRuleMigration);
  wikiSnapshotAfterDosageRule = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterDosageRule = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  successfulDosageRulePreflight = await readDosageRulePreflight();

  await db.exec(auditEnvelopeMigration);
  wikiSnapshotAfterAuditEnvelope = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfterAuditEnvelope = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  successfulAuditEnvelope = await readAuditEnvelope();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("therapy retrieval v2 Step 6A through Step 7A preflights", () => {
  it("adds only four closed read functions and changes no snapshot", async () => {
    expect(migration.match(/CREATE FUNCTION public\./g)).toHaveLength(4);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toMatch(/CREATE TABLE|ALTER TABLE|INSERT INTO|GRANT EXECUTE/);
    expect(migration).not.toMatch(/\b(pseudonym_id|fact_value|source_payload|clinical_text)\b/i);
    expect(migration).toContain("PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE");
    expect(wikiSnapshotAfter).toBe(wikiSnapshotBefore);
    expect(therapySnapshotAfter).toBe(therapySnapshotBefore);

    const boundary = await db.query<{ tables: number; active: number }>(`
      SELECT
        (SELECT count(*)::integer
           FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables')) AS tables,
        (SELECT count(*)::integer FROM public.kb_releases
          WHERE retrieval_eligible OR is_active) AS active
    `);
    expect(boundary.rows[0]).toEqual({ tables: 67, active: 0 });
  });

  it("binds only terminal verified and review-only facts without raw values", async () => {
    expect(inputManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_INPUT_PREFLIGHT_ONLY",
      data_classification: "pseudonymized_health_data",
      fact_selection_policy: {
        policy_version: 1,
        accepted_review_statuses: ["verified", "review_only"],
        terminal_facts_only: true,
      },
      fact_counts: {
        total: 5,
        terminal: 4,
        superseded: 1,
        selected: 2,
        verified: 1,
        review_only: 1,
        excluded_unreviewed: 1,
        excluded_rejected: 1,
      },
    }));
    expect(inputManifest.selected_facts.map((fact) => fact.fact_id)).toEqual([
      successorFactId,
      reviewOnlyFactId,
    ]);
    expect(inputManifest.selected_facts.map((fact) => fact.review_status)).toEqual([
      "verified",
      "review_only",
    ]);
    expect(inputManifest.selected_facts.every((fact) =>
      /^[0-9a-f]{64}$/.test(fact.content_sha256))).toBe(true);
    expect(inputManifest.complete_fact_set_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(inputManifest)).not.toContain("Synthetic unreviewed value");
    expect(JSON.stringify(inputManifest)).not.toContain("Synthetic rejected value");
    expect(JSON.stringify(inputManifest)).not.toContain("P-2026-6001");
    expect(expectedInputHash).toMatch(/^[0-9a-f]{64}$/);

    const replay = (await db.query<{ manifest: InputManifest; hash: string }>(`
      SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS manifest,
             public.therapy_retrieval_v2_input_hash_v1($1) AS hash
    `, [inputRevisionId])).rows[0];
    expect(replay.manifest).toEqual(inputManifest);
    expect(replay.hash).toBe(expectedInputHash);
  });

  it("returns one deterministic inactive binding and preserves explicit review", async () => {
    expect(successfulPreflight).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE",
      interpretation: "PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      therapy_input_hash_matches: true,
      release_manifest_hash_matches: true,
      selected_fact_count: 2,
      review_only_fact_count: 1,
      requires_fact_review: true,
      actual_therapy_input_hash: expectedInputHash,
      actual_release_manifest_hash: expectedReleaseManifestHash,
      binding_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulPreflight.input_manifest).toEqual(inputManifest);
    expect(await readPreflight()).toEqual(successfulPreflight);

    const { result_hash: resultHash, ...payload } = successfulPreflight;
    const calculated = (await db.query<{ hash: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS hash
    `, [JSON.stringify(payload)])).rows[0].hash;
    expect(calculated).toBe(resultHash);
  });

  it("distinguishes malformed expectations, binding drift, and unavailable inputs", async () => {
    const malformed = await readPreflight(expectedInputHash.toUpperCase());
    expect(malformed.status).toBe("RETRIEVAL_V2_EXPECTATION_INVALID");
    expect(malformed.medical_use_allowed).toBe(false);
    expect(malformed.retrieval_execution_allowed).toBe(false);

    const inputMismatch = await readPreflight("0".repeat(64));
    expect(inputMismatch).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_BINDING_MISMATCH",
      therapy_input_hash_matches: false,
      release_manifest_hash_matches: true,
    }));
    const releaseMismatch = await readPreflight(expectedInputHash, "f".repeat(64));
    expect(releaseMismatch).toEqual(expect.objectContaining({
      status: "RETRIEVAL_V2_BINDING_MISMATCH",
      therapy_input_hash_matches: true,
      release_manifest_hash_matches: false,
    }));

    const missingInput = await readPreflight(
      expectedInputHash,
      expectedReleaseManifestHash,
      unknownInputRevisionId,
    );
    expect(missingInput.status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    const missingRelease = await readPreflight(
      expectedInputHash,
      expectedReleaseManifestHash,
      inputRevisionId,
      unknownReleaseId,
    );
    expect(missingRelease.status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
  });

  it("fails closed after trigger-bypassed input or release corruption", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.therapy_input_facts SET content_sha256 = repeat('f', 64)
         WHERE id = '${successorFactId}'
      `);
      const manifest = (await db.query<{ value: InputManifest | null }>(`
        SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
      `, [inputRevisionId])).rows[0].value;
      expect(manifest).toBeNull();
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(
      "BEGIN; ALTER TABLE public.therapy_input_fact_sources DISABLE TRIGGER USER;",
    );
    try {
      await db.exec(`
        INSERT INTO public.therapy_input_fact_sources (
          therapy_input_revision_id, therapy_input_fact_id, link_order,
          source_order, fact_locator, source_role
        ) VALUES (
          '${inputRevisionId}', '93000000-0000-4000-8000-000000000099',
          1, 1, 'line:orphan', 'primary'
        )
      `);
      const manifest = (await db.query<{ value: InputManifest | null }>(`
        SELECT public.therapy_retrieval_v2_input_manifest_v1($1) AS value
      `, [inputRevisionId])).rows[0].value;
      expect(manifest).toBeNull();
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_INPUT_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_releases DISABLE TRIGGER USER;");
    try {
      await db.exec(`
        UPDATE public.kb_releases
           SET release_manifest = release_manifest || '{"tampered":true}'::jsonb,
               release_manifest_hash = public.kb_release_manifest_hash_v1(
                 release_manifest || '{"tampered":true}'::jsonb
               )
         WHERE id = '${knowledgeReleaseId}'
      `);
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_releases DISABLE TRIGGER USER;
      ALTER TABLE public.kb_releases
        DROP CONSTRAINT kb_releases_retrieval_eligible_check;
      ALTER TABLE public.kb_releases
        DROP CONSTRAINT kb_releases_is_active_check;
      UPDATE public.kb_releases
         SET retrieval_eligible = true, is_active = true
       WHERE id = '${knowledgeReleaseId}';
    `);
    try {
      expect((await readPreflight()).status).toBe("RETRIEVAL_V2_RELEASE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readPreflight()).toEqual(successfulPreflight);
  });

  it("adds only three closed entity-resolution functions and changes no snapshot", async () => {
    expect(entityResolutionMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(entityResolutionMigration).toMatch(/^BEGIN;/);
    expect(entityResolutionMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(entityResolutionMigration)
      .not.toMatch(
        /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
      );
    expect(entityResolutionMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(entityResolutionMigration).not.toMatch(/\bGRANT\b/i);
    expect(entityResolutionMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    expect(entityResolutionMigration)
      .toContain("ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE");
    expect(entityResolutionMigration).toContain("LIMIT 4097");
    expect(entityResolutionMigration).toContain("LIMIT 1025");
    expect(entityResolutionMigration).toContain("LIMIT 2049");
    const projectionFunction = entityResolutionMigration.slice(
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_projection_is_complete_v1",
      ),
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1",
      ),
    );
    expect(projectionFunction.indexOf(
      "IF release_item_count NOT BETWEEN 1 AND 4096",
    )).toBeLessThan(projectionFunction.indexOf("INTO entity_item_count"));
    expect(projectionFunction.indexOf(
      "IF entity_item_count NOT BETWEEN 1 AND 1024",
    )).toBeLessThan(projectionFunction.indexOf("INTO relation_item_count"));
    const resolutionFunction = entityResolutionMigration.slice(
      entityResolutionMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1",
      ),
    );
    expect(resolutionFunction.indexOf("LIMIT 4097")).toBeLessThan(
      resolutionFunction.indexOf("binding_result :="),
    );
    expect(wikiSnapshotAfterEntityResolution).toBe(wikiSnapshotAfter);
    expect(therapySnapshotAfterEntityResolution).toBe(therapySnapshotAfter);

    const projection = await db.query<{ complete: boolean; active: number }>(`
      SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
               AS complete,
             (SELECT count(*)::integer FROM public.kb_releases
               WHERE retrieval_eligible OR is_active) AS active
    `, [knowledgeReleaseId]);
    expect(projection.rows[0]).toEqual({ complete: true, active: 0 });
  });

  it("derives a bounded deterministic query manifest only from selected facts", async () => {
    expect(entityQueryManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_ENTITY_QUERY_PREFLIGHT_ONLY",
      selected_fact_count: 2,
      input_manifest_hash: expectedInputHash,
    }));
    expect(entityQueryManifest.facts.map((fact) => fact.fact_id)).toEqual([
      successorFactId,
      reviewOnlyFactId,
    ]);
    expect(entityQueryManifest.facts[0]).toEqual(expect.objectContaining({
      fact_id: successorFactId,
      kb_entity_id: null,
      query_terms: ["r53", "synthetic coded disease", "synthetic contract condition"],
      identifier_terms: [
        'identifier:["icd_10_gm", null, "R53"]',
        'identifier_value:"R53"',
      ],
      query_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(entityQueryManifest.facts[1]).toEqual(expect.objectContaining({
      fact_id: reviewOnlyFactId,
      kb_entity_id: plantEntityId,
      query_terms: ["synthetic review question"],
      identifier_terms: [],
      query_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(JSON.stringify(entityQueryManifest)).not.toContain("P-2026-6001");

    const replay = (await db.query<{ value: EntityQueryManifest }>(`
      SELECT public.therapy_retrieval_v2_entity_query_manifest_v1($1) AS value
    `, [inputRevisionId])).rows[0].value;
    expect(replay).toEqual(entityQueryManifest);
  });

  it("resolves exact channels and one-hop graph provenance without a recommendation", async () => {
    expect(successfulEntityResolution).toEqual(expect.objectContaining({
      status: "ENTITY_RESOLUTION_PREFLIGHT_COMPLETE_INACTIVE",
      interpretation: "ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      therapy_input_revision_id: inputRevisionId,
      therapy_input_manifest_hash: expectedInputHash,
      knowledge_release_id: knowledgeReleaseId,
      release_manifest_hash: expectedReleaseManifestHash,
      binding_hash: successfulPreflight.binding_hash,
      query_manifest_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      selected_fact_count: 2,
      direct_candidate_count_before_limit: 3,
      returned_direct_candidate_count: 3,
      graph_candidate_count_before_limit: 4,
      returned_graph_candidate_count: 4,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulEntityResolution.facts).toHaveLength(2);

    const diseaseFact = successfulEntityResolution.facts?.[0];
    expect(diseaseFact).toEqual(expect.objectContaining({
      fact_id: successorFactId,
      direct_candidate_count_before_limit: 1,
      returned_direct_candidate_count: 1,
      graph_candidate_count_before_limit: 2,
      returned_graph_candidate_count: 2,
    }));
    expect(diseaseFact?.direct_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "ENTITY_REFERENCE_MATCH_ONLY",
      entity_id: diseaseEntityId,
      entity_revision_id: diseaseEntityRevisionId,
      best_match_channel: "exact_qualified_identifier",
      matched_channels: expect.arrayContaining([
        "exact_qualified_identifier",
        "exact_unqualified_identifier",
        "exact_normalized_title",
        "exact_normalized_alias",
        "german_full_text",
        "simple_full_text",
      ]),
    }));
    expect(diseaseFact?.graph_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION",
      source_entity_id: diseaseEntityId,
      relation_type_code: "may_support",
      graph_direction: "inbound",
      entity_id: plantEntityId,
      entity_revision_id: plantEntityRevisionId,
    }));

    const plantFact = successfulEntityResolution.facts?.[1];
    expect(plantFact).toEqual(expect.objectContaining({
      direct_candidate_count_before_limit: 2,
      returned_direct_candidate_count: 2,
      graph_candidate_count_before_limit: 2,
      returned_graph_candidate_count: 2,
    }));
    expect(plantFact?.direct_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "ENTITY_REFERENCE_MATCH_ONLY",
      entity_id: plantEntityId,
      entity_revision_id: plantEntityRevisionId,
      best_match_channel: "exact_kb_entity_link",
      matched_channels: expect.arrayContaining([
        "exact_kb_entity_link",
        "exact_normalized_alias",
        "german_full_text",
        "simple_full_text",
      ]),
    }));
    expect(plantFact?.direct_candidates[1]).toEqual(expect.objectContaining({
      entity_id: homeopathicRemedyIds[0],
      entity_revision_id: homeopathicRemedyRevisionIds[0],
      best_match_channel: "exact_normalized_alias",
    }));
    expect(plantFact?.graph_candidates[0]).toEqual(expect.objectContaining({
      candidate_status: "GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION",
      source_entity_id: plantEntityId,
      relation_type_code: "may_support",
      graph_direction: "outbound",
      entity_id: diseaseEntityId,
      entity_revision_id: diseaseEntityRevisionId,
    }));
    expect(plantFact?.graph_candidates[1]).toEqual(expect.objectContaining({
      candidate_status: "GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION",
      source_entity_id: homeopathicRemedyIds[0],
      source_entity_revision_id: homeopathicRemedyRevisionIds[0],
      entity_id: diseaseEntityId,
      entity_revision_id: diseaseEntityRevisionId,
    }));
    expect(JSON.stringify(successfulEntityResolution)).not.toMatch(
      /"candidate_status":"(?:ALLOW|REVIEW_ONLY|EXCLUDE|ESCALATE_ONLY)"/,
    );
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);

    const { result_hash: resultHash, ...payload } = successfulEntityResolution;
    const calculated = (await db.query<{ hash: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS hash
    `, [JSON.stringify(payload)])).rows[0].hash;
    expect(calculated).toBe(resultHash);
  });

  it("fails closed for invalid limits, binding drift, and incomplete projections", async () => {
    expect((await readEntityResolution(
      expectedInputHash,
      expectedReleaseManifestHash,
      0,
      16,
    )).status).toBe("ENTITY_RESOLUTION_LIMIT_INVALID");
    expect((await readEntityResolution(
      "0".repeat(64),
      expectedReleaseManifestHash,
    )).status).toBe("ENTITY_RESOLUTION_BINDING_UNAVAILABLE");

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts
           SET fact_value = jsonb_build_object(
             'type', 'text', 'value', repeat('x', 1025)
           )
         WHERE id = $1
      `, [reviewOnlyFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [reviewOnlyFactId]);
      const changedInputHash = (await db.query<{ hash: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS hash
      `, [inputRevisionId])).rows[0].hash;
      expect((await readPreflight(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE");
      expect((await readEntityResolution(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("ENTITY_RESOLUTION_QUERY_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET kb_entity_id = $2 WHERE id = $1
      `, [successorFactId, outsideEntityId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [successorFactId]);
      const changedInputHash = (await db.query<{ hash: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS hash
      `, [inputRevisionId])).rows[0].hash;
      expect((await readPreflight(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE");
      expect((await readEntityResolution(
        changedInputHash,
        expectedReleaseManifestHash,
      )).status).toBe("ENTITY_RESOLUTION_EXPLICIT_LINK_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }

    await db.exec("BEGIN; ALTER TABLE public.kb_search_documents DISABLE TRIGGER USER;");
    try {
      await db.query(`
        DELETE FROM public.kb_search_documents document
         USING public.kb_release_items item
         WHERE document.release_item_id = item.id
           AND item.release_id = $1
           AND item.entity_id = $2
      `, [knowledgeReleaseId, plantEntityId]);
      const projection = (await db.query<{ complete: boolean }>(`
        SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
                 AS complete
      `, [knowledgeReleaseId])).rows[0].complete;
      expect(projection).toBe(false);
      expect((await readEntityResolution()).status)
        .toBe("ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);
  });

  it("rejects an oversized release before the binding validator", async () => {
    await db.exec("BEGIN;");
    try {
      await db.exec(`
        ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;
        DROP INDEX public.kb_release_items_source_revision_idx;
        INSERT INTO public.kb_release_items (
          release_id, item_order, item_kind, source_id, source_revision_id,
          item_manifest, item_manifest_hash
        )
        SELECT item.release_id, generated.item_order, item.item_kind,
               item.source_id, item.source_revision_id,
               item.item_manifest, item.item_manifest_hash
          FROM public.kb_release_items item
          CROSS JOIN generate_series(23, 4097) generated(item_order)
         WHERE item.release_id = '${knowledgeReleaseId}'
           AND item.item_kind = 'source_revision'
           AND item.source_id = '${knowledgeSourceId}';
      `);
      const projection = (await db.query<{ complete: boolean }>(`
        SELECT public.therapy_retrieval_v2_entity_projection_is_complete_v1($1)
                 AS complete
      `, [knowledgeReleaseId])).rows[0].complete;
      expect(projection).toBe(false);
      expect((await readEntityResolution()).status)
        .toBe("ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readEntityResolution()).toEqual(successfulEntityResolution);
  });

  it("adds only three closed split-track functions and classifies exact release references", async () => {
    expect(splitTrackMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(splitTrackMigration).toMatch(/^BEGIN;/);
    expect(splitTrackMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(splitTrackMigration).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
    );
    expect(splitTrackMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(splitTrackMigration).not.toMatch(/\bGRANT\b/i);
    expect(splitTrackMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    expect(splitTrackMigration).toContain("LIMIT 257");
    expect(splitTrackMigration).toContain("LIMIT 65");
    expect(splitTrackMigration).toContain("LIMIT 2049");
    const splitPreflight = splitTrackMigration.slice(
      splitTrackMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_split_track_preflight_v1",
      ),
    );
    expect(splitPreflight.indexOf("LIMIT 257")).toBeLessThan(
      splitPreflight.indexOf("request_manifest :="),
    );
    expect(wikiSnapshotAfterSplitTrack).toBe(wikiSnapshotAfterEntityResolution);
    expect(therapySnapshotAfterSplitTrack).toBe(therapySnapshotAfterEntityResolution);

    const tracks = (await db.query<{
      disease: string;
      remedy: string;
      repertory: string;
      unknown: string;
      active: number;
    }>(`
      SELECT
        public.therapy_retrieval_v2_reference_track_v1($1, $2, $3) AS disease,
        public.therapy_retrieval_v2_reference_track_v1($1, $4, $5) AS remedy,
        public.therapy_retrieval_v2_reference_track_v1($1, $6, $7) AS repertory,
        public.therapy_retrieval_v2_reference_track_v1(
          $1, '31000000-0000-4000-8000-000000000099',
          '32000000-0000-4000-8000-000000000099'
        ) AS unknown,
        (SELECT count(*)::integer FROM public.kb_releases
          WHERE retrieval_eligible OR is_active) AS active
    `, [
      knowledgeReleaseId,
      diseaseEntityId,
      diseaseEntityRevisionId,
      homeopathicRemedyIds[0],
      homeopathicRemedyRevisionIds[0],
      repertoryEntityId,
      repertoryRevisionId,
    ])).rows[0];
    expect(tracks).toEqual({
      disease: "GENERAL_OR_NATUROPATHIC_REFERENCE",
      remedy: "HOMEOPATHIC_REFERENCE",
      repertory: "HOMEOPATHIC_REFERENCE",
      unknown: "UNRESOLVED_REFERENCE",
      active: 0,
    });
  });

  it("binds each source-native rubric to an exact selected fact deterministically", async () => {
    expect(homeopathicRequestManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_HOMEOPATHIC_REQUEST_PREFLIGHT_ONLY",
      input_manifest_hash: expectedInputHash,
      repertory_request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(homeopathicRequestManifest.fact_rubric_links).toHaveLength(3);
    expect(homeopathicRequestManifest.fact_rubric_links.map((link) =>
      link.therapy_input_fact_id)).toEqual([
      successorFactId,
      reviewOnlyFactId,
      successorFactId,
    ]);
    expect(homeopathicRequestManifest.fact_rubric_links.every((link) =>
      /^[0-9a-f]{64}$/.test(link.fact_content_sha256)
      && /^[0-9a-f]{64}$/.test(link.fact_query_hash))).toBe(true);
    expect(expectedHomeopathicRequestHash).toMatch(/^[0-9a-f]{64}$/);

    const reversed = (await db.query<{ value: HomeopathicRequestManifest }>(`
      SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
        $1::uuid, $2::uuid, $3::uuid, $4::jsonb
      ) AS value
    `, [
      inputRevisionId,
      repertoryEntityId,
      repertoryRevisionId,
      JSON.stringify([...homeopathicRubricLinks].reverse()),
    ])).rows[0].value;
    expect(reversed).toEqual(homeopathicRequestManifest);
  });

  it("keeps general references and repertory matches in separate inactive tracks", async () => {
    expect(successfulSplitTrack).toEqual(expect.objectContaining({
      status: "SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE",
      interpretation: "SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      candidate_status_assignment_allowed: false,
      homeopathic_request_hash: expectedHomeopathicRequestHash,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulSplitTrack.general_track).toEqual(expect.objectContaining({
      track: "GENERAL_OR_NATUROPATHIC_REFERENCE_TRACK",
      status: "GENERAL_REFERENCE_MATCHES_READY_INACTIVE",
      direct_reference_count: 2,
      graph_reference_count: 2,
      excluded_homeopathic_reference_count: 3,
      unresolved_reference_count: 0,
      track_result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulSplitTrack.general_track?.facts[1]).toEqual(
      expect.objectContaining({
        fact_id: reviewOnlyFactId,
        excluded_homeopathic_reference_count: 2,
      }),
    );
    expect(successfulSplitTrack.general_track?.facts[1].direct_references)
      .toHaveLength(1);
    expect(successfulSplitTrack.general_track?.facts[1].direct_references[0])
      .toEqual(expect.objectContaining({ entity_id: plantEntityId }));
    expect(successfulSplitTrack.general_track?.facts[1].graph_references)
      .toHaveLength(1);
    expect(successfulSplitTrack.general_track?.facts[1].graph_references[0])
      .toEqual(expect.objectContaining({ source_entity_id: plantEntityId }));

    expect(successfulSplitTrack.homeopathic_track).toEqual(expect.objectContaining({
      track: "HOMEOPATHIC_SOURCE_NATIVE_REPERTORY_TRACK",
      status: "HOMEOPATHIC_REPERTORY_MATCHES_READY_INACTIVE",
      reader_status: "HOMEOPATHIC_REPERTORY_MATCHES_READY",
      candidate_count_before_limit: 3,
      returned_candidate_count: 3,
      track_result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulSplitTrack.homeopathic_track?.candidates.map((candidate) =>
      candidate.source_remedy_code)).toEqual(["R-A", "r-B", "R-C"]);
    expect(successfulSplitTrack.homeopathic_track?.candidates.every((candidate) =>
      candidate.candidate_status === "REPERTORY_MATCH_ONLY")).toBe(true);

    const generalJson = JSON.stringify(successfulSplitTrack.general_track);
    for (const entityId of homeopathicRemedyIds) {
      expect(generalJson).not.toContain(entityId);
    }
    for (const revisionId of homeopathicRemedyRevisionIds) {
      expect(generalJson).not.toContain(revisionId);
    }
    expect(JSON.stringify(successfulSplitTrack)).not.toMatch(
      /"candidate_status":"(?:ALLOW|REVIEW_ONLY|EXCLUDE|ESCALATE_ONLY)"/,
    );
    expect(await readSplitTrack()).toEqual(successfulSplitTrack);

    const { result_hash: resultHash, ...payload } = successfulSplitTrack;
    const calculated = (await db.query<{ hash: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS hash
    `, [JSON.stringify(payload)])).rows[0].hash;
    expect(calculated).toBe(resultHash);
  });

  it("preserves an empty homeopathic track without inventing matches", async () => {
    const noMatchLinks = [{
      therapy_input_fact_id: successorFactId,
      rubric_revision_id: homeopathicRubricRevisionIds[0],
      importance: 1,
      polarity: "include",
    }];
    const noMatchManifest = (await db.query<{ value: HomeopathicRequestManifest }>(`
      SELECT public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
        $1::uuid, $2::uuid, $3::uuid, $4::jsonb
      ) AS value
    `, [
      inputRevisionId,
      repertoryEntityId,
      repertoryRevisionId,
      JSON.stringify(noMatchLinks),
    ])).rows[0].value;
    const noMatchHash = (await db.query<{ value: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb) AS value
    `, [JSON.stringify(noMatchManifest)])).rows[0].value;
    const result = await readSplitTrack(
      expectedInputHash,
      expectedReleaseManifestHash,
      noMatchLinks,
      noMatchHash,
    );
    expect(result.status).toBe("SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE");
    expect(result.homeopathic_track).toEqual(expect.objectContaining({
      status: "HOMEOPATHIC_NO_REPERTORY_MATCHES_INACTIVE",
      reader_status: "HOMEOPATHIC_NO_REPERTORY_MATCHES",
      candidate_count_before_limit: 0,
      returned_candidate_count: 0,
      candidates: [],
    }));
  });

  it("fails closed for request drift, unselected facts, and release-external remedies", async () => {
    expect((await readSplitTrack(
      expectedInputHash,
      expectedReleaseManifestHash,
      homeopathicRubricLinks,
      "0".repeat(64),
    )).status).toBe("SPLIT_TRACK_HOMEOPATHIC_REQUEST_MISMATCH");
    expect((await readSplitTrack(
      expectedInputHash,
      expectedReleaseManifestHash,
      homeopathicRubricLinks,
      expectedHomeopathicRequestHash,
      0,
    )).status).toBe("SPLIT_TRACK_EXPECTATION_INVALID");

    const unselectedFactLinks = homeopathicRubricLinks.map((link, index) =>
      index === 0 ? { ...link, therapy_input_fact_id: unreviewedFactId } : link);
    expect((await readSplitTrack(
      expectedInputHash,
      expectedReleaseManifestHash,
      unselectedFactLinks,
    )).status).toBe("SPLIT_TRACK_HOMEOPATHIC_REQUEST_UNAVAILABLE");

    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_homeopathic_repertory_remedies DISABLE TRIGGER USER;
      UPDATE public.kb_homeopathic_repertory_remedies
         SET remedy_entity_id = '${outsideEntityId}',
             remedy_revision_id = '${outsideEntityRevisionId}'
       WHERE id = '${repertoryRemedyIds[0]}';
    `);
    try {
      expect((await readSplitTrack()).status)
        .toBe("SPLIT_TRACK_HOMEOPATHIC_SCOPE_UNAVAILABLE");
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readSplitTrack()).toEqual(successfulSplitTrack);
  });

  it("adds only three closed safety-gate functions and changes no snapshot", async () => {
    expect(safetyGateMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(safetyGateMigration).toMatch(/^BEGIN;/);
    expect(safetyGateMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(safetyGateMigration).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
    );
    expect(safetyGateMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(safetyGateMigration).not.toMatch(/\bGRANT\b/i);
    expect(safetyGateMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    expect(safetyGateMigration).toContain("LIMIT 513");
    expect(safetyGateMigration).toContain("LIMIT 2049");
    expect(safetyGateMigration).toContain("LIMIT 8193");
    expect(safetyGateMigration).toContain("only_disposition', 'ESCALATE_ONLY'");
    const assessmentFunction = safetyGateMigration.slice(
      safetyGateMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_safety_rule_assessments_v1",
      ),
      safetyGateMigration.indexOf(
        "CREATE FUNCTION public.therapy_retrieval_v2_safety_gate_preflight_v1",
      ),
    );
    expect(assessmentFunction.indexOf("LIMIT 8193")).toBeLessThan(
      assessmentFunction.indexOf("public.kb_safety_rule_is_valid"),
    );
    expect(wikiSnapshotAfterSafetyGate).toBe(wikiSnapshotAfterSplitTrack);
    expect(therapySnapshotAfterSafetyGate).toBe(therapySnapshotAfterSplitTrack);
  });

  it("binds red flags and medication completeness without returning raw fact values", async () => {
    expect(safetyInputManifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "THERAPY_RETRIEVAL_V2_SAFETY_INPUT_PREFLIGHT_ONLY",
      therapy_input_manifest_hash: safetyInputHash,
      selected_fact_count: 7,
      review_only_fact_count: 0,
      requires_input_review: false,
      active_red_flag_count: 0,
      red_flag_disposition: "NONE",
      red_flags: [],
      medication_status: "CLEAR_COMPLETE",
      medication_review_required: false,
      medication_status_fact_count: 1,
      active_medication_count: 1,
      unresolved_active_medication_count: 0,
    }));
    expect(JSON.stringify(safetyInputManifest)).not.toMatch(
      /Synthetic (?:medication|contraindication|safety context)|P-2026-6002|A01AA01/,
    );
    const replay = (await db.query<{ value: SafetyInputManifest }>(`
      SELECT public.therapy_retrieval_v2_safety_input_manifest_v1($1) AS value
    `, [safetyInputRevisionId])).rows[0].value;
    expect(replay).toEqual(safetyInputManifest);
  });

  it("evaluates release-closed interactions and contraindications before candidates", async () => {
    expect(successfulSafetyGate).toEqual(expect.objectContaining({
      status: "SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE",
      interpretation: "SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      candidate_formation_allowed: false,
      candidate_status_assignment_allowed: false,
      inactive_candidate_preflight_ready: true,
      safety_preconditions_complete: true,
      safety_disposition: "RULE_EFFECTS_EVALUATED_INACTIVE",
      rules_evaluated: true,
      split_track_result_hash: safetySplitTrackHash,
      safety_input_manifest_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      safety_rule_assessments_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      unresolved_release_medication_count: 0,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulSafetyGate.safety_rule_assessments).toEqual(
      expect.objectContaining({
        subject_count: 2,
        safety_rule_count: 4,
        condition_count: 7,
        matched_hard_contraindication_or_interaction_count: 2,
      }),
    );
    const subject = successfulSafetyGate.safety_rule_assessments
      ?.subject_assessments[0];
    expect(subject).toEqual(expect.objectContaining({
      subject_entity_id: safetyPreparationId,
      subject_entity_revision_id: safetyPreparationRevisionId,
      safety_effect: "EXCLUDE",
    }));
    expect(subject?.rules.map((rule) => ({
      id: rule.safety_rule_id,
      type: rule.rule_type,
      status: rule.assessment_status,
    }))).toEqual([
      { id: interactionRuleId, type: "interaction", status: "MATCHED" },
      { id: contraindicationRuleId, type: "contraindication", status: "MATCHED" },
      { id: precautionRuleId, type: "precaution", status: "MATCHED" },
    ]);
    expect(subject?.rules[0].interaction_related_entity_present).toBe(true);
    expect(subject?.rules.every((rule) =>
      rule.conditions.every((condition) =>
        condition.condition_status === "MATCHED"))).toBe(true);
    expect(subject?.rules[2].conditions.map((condition) =>
      condition.condition_kind)).toEqual([
      "entity_present",
      "fact_present",
      "fact_missing",
      "quantity_compare",
    ]);
    expect(JSON.stringify(successfulSafetyGate)).not.toMatch(
      /"(?:candidate_status|safety_effect)":"ALLOW"/,
    );
    expect(await readSafetyGate()).toEqual(successfulSafetyGate);

    const { result_hash: resultHash, ...payload } = successfulSafetyGate;
    expect(await hashJson(payload)).toBe(resultHash);
    expect((await readSafetyGate(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      "0".repeat(64),
    )).status).toBe("SAFETY_GATE_SPLIT_TRACK_MISMATCH");
  });

  it("turns every active red flag into escalation without evaluating candidates", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET is_negated = false WHERE id = $1
      `, [redFlagFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [redFlagFactId]);
      const result = await readCurrentSafetyGate();
      expect(result).toEqual(expect.objectContaining({
        status: "SAFETY_GATE_ESCALATE_ONLY_INACTIVE",
        safety_disposition: "ESCALATE_ONLY",
        candidate_formation_allowed: false,
        inactive_candidate_preflight_ready: false,
        safety_preconditions_complete: false,
        rules_evaluated: false,
      }));
      expect(result.safety_input_manifest?.red_flags).toEqual([
        expect.objectContaining({ fact_id: redFlagFactId }),
      ]);
      expect(result.safety_rule_assessments).toBeUndefined();
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("requires review for an unclear medication status", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts
           SET fact_value = '{"type":"coded","system":"local_v1","code":"unknown"}'::jsonb
         WHERE id = $1
      `, [medicationStatusFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [medicationStatusFactId]);
      const unclear = await readCurrentSafetyGate();
      expect(unclear).toEqual(expect.objectContaining({
        status: "SAFETY_GATE_REVIEW_REQUIRED_INACTIVE",
        safety_disposition: "REVIEW_ONLY",
        rules_evaluated: false,
        candidate_formation_allowed: false,
      }));
      expect(unclear.safety_input_manifest?.medication_status).toBe("UNCLEAR");
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("requires review for an uncertain medication status", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET certainty = 'uncertain' WHERE id = $1
      `, [medicationStatusFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [medicationStatusFactId]);
      const uncertain = await readCurrentSafetyGate();
      expect(uncertain.status).toBe("SAFETY_GATE_REVIEW_REQUIRED_INACTIVE");
      expect(uncertain.safety_input_manifest?.medication_status).toBe("UNCLEAR");
      expect(uncertain.rules_evaluated).toBe(false);
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("requires review when the medication status is missing", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET review_status = 'rejected' WHERE id = $1
      `, [medicationStatusFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [medicationStatusFactId]);
      const missing = await readCurrentSafetyGate();
      expect(missing.status).toBe("SAFETY_GATE_REVIEW_REQUIRED_INACTIVE");
      expect(missing.safety_input_manifest?.medication_status).toBe("MISSING");
      expect(missing.rules_evaluated).toBe(false);
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("requires review for unresolved active medication", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET kb_entity_id = NULL WHERE id = $1
      `, [activeMedicationFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [activeMedicationFactId]);
      const unresolved = await readCurrentSafetyGate();
      expect(unresolved.status).toBe("SAFETY_GATE_REVIEW_REQUIRED_INACTIVE");
      expect(unresolved.safety_input_manifest?.medication_status)
        .toBe("UNRESOLVED_ENTITY");
      expect(unresolved.unresolved_release_medication_count).toBe(1);
      expect(unresolved.rules_evaluated).toBe(false);
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("rejects release-external active medication", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET kb_entity_id = $2 WHERE id = $1
      `, [activeMedicationFactId, outsideEntityId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [activeMedicationFactId]);
      const changedInputHash = (await db.query<{ value: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
      `, [safetyInputRevisionId])).rows[0].value;
      const releaseExternal = await readSafetyGate(
        changedInputHash,
        expectedReleaseManifestHash,
        safetyHomeopathicRequestHash,
        safetySplitTrackHash,
      );
      expect(releaseExternal.status).toBe("SAFETY_GATE_SPLIT_TRACK_UNAVAILABLE");
      expect(releaseExternal.candidate_formation_allowed).toBe(false);
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("rejects cherry-picked release safety rules even when the base release remains valid", async () => {
    await db.exec(`
      BEGIN;
      ALTER TABLE public.kb_release_items DISABLE TRIGGER USER;
      ALTER TABLE public.kb_releases DISABLE TRIGGER USER;
      DELETE FROM public.kb_release_items
       WHERE release_id = '${knowledgeReleaseId}'
         AND assertion_id = '${interactionAssertionId}';
      UPDATE public.kb_releases release
         SET release_manifest = public.kb_release_manifest_v1(release.id, release.release_key),
             release_manifest_hash = public.kb_release_manifest_hash_v1(
               public.kb_release_manifest_v1(release.id, release.release_key)
             )
       WHERE release.id = '${knowledgeReleaseId}';
    `);
    try {
      const changedReleaseHash = (await db.query<{ value: string }>(`
        SELECT release_manifest_hash AS value
          FROM public.kb_releases WHERE id = $1
      `, [knowledgeReleaseId])).rows[0].value;
      const baseRelease = (await db.query<{ value: boolean }>(`
        SELECT public.kb_release_is_valid($1, true) AS value
      `, [knowledgeReleaseId])).rows[0].value;
      expect(baseRelease).toBe(true);
      const result = await readCurrentSafetyGate(changedReleaseHash);
      expect(result).toEqual(expect.objectContaining({
        status: "SAFETY_GATE_RULE_SCOPE_UNAVAILABLE",
        safety_disposition: "REVIEW_ONLY",
        candidate_formation_allowed: false,
        inactive_candidate_preflight_ready: false,
        safety_preconditions_complete: false,
        rules_evaluated: false,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
    expect(await readSafetyGate()).toEqual(successfulSafetyGate);
  });

  it("adds only three closed candidate-status functions and changes no snapshot", () => {
    expect(candidateStatusMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(candidateStatusMigration).toMatch(/^BEGIN;/);
    expect(candidateStatusMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(candidateStatusMigration).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
    );
    expect(candidateStatusMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(candidateStatusMigration).not.toMatch(/\bGRANT\b/i);
    expect(candidateStatusMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    expect(candidateStatusMigration).toContain(
      "'ESCALATE_ONLY', 'EXCLUDE', 'REVIEW_ONLY', 'ALLOW'",
    );
    expect(candidateStatusMigration).toContain(
      "'exclude_and_escalate_overridable', false",
    );
    expect(candidateStatusMigration).toContain("'opaque_composite_score_used', false");
    expect(candidateStatusMigration).toContain(
      'reference.value::text COLLATE "C"',
    );
    expect(wikiSnapshotAfterCandidateStatus).toBe(wikiSnapshotAfterSafetyGate);
    expect(therapySnapshotAfterCandidateStatus).toBe(therapySnapshotAfterSafetyGate);
  });

  it("assigns general ALLOW and immutable EXCLUDE from separate visible dimensions", async () => {
    expect(successfulCandidateStatus).toEqual(expect.objectContaining({
      status: "CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE",
      interpretation: "INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE",
      medical_use_allowed: false,
      retrieval_execution_allowed: false,
      productive_candidate_use_allowed: false,
      candidate_status_assignment_allowed: false,
      inactive_candidate_statuses_materialized: true,
      dosage_evaluation_allowed: false,
      ai_use_allowed: false,
      split_track_result_hash: safetySplitTrackHash,
      safety_gate_result_hash: successfulSafetyGate.result_hash,
      candidate_count: 4,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulCandidateStatus.general_track).toEqual(expect.objectContaining({
      track: "GENERAL_OR_NATUROPATHIC_CANDIDATE_TRACK",
      status: "GENERAL_CANDIDATE_STATUSES_READY_INACTIVE",
      candidate_count: 2,
      status_counts: {
        ALLOW: 1,
        REVIEW_ONLY: 0,
        EXCLUDE: 1,
        ESCALATE_ONLY: 0,
      },
      opaque_composite_score_used: false,
      track_result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));

    const [allowed, excluded] = successfulCandidateStatus.general_track!.candidates;
    expect(allowed).toEqual(expect.objectContaining({
      candidate_status: "ALLOW",
      entity_id: allowPreparationId,
      entity_revision_id: allowPreparationRevisionId,
      entity_type_code: "preparation",
      status_lock: "INACTIVE_ONLY_NOT_MEDICAL_USE",
      status_reasons: ["INACTIVE_ELIGIBILITY_CRITERIA_MET"],
      safety: expect.objectContaining({ safety_effect: "NOTICE_ONLY" }),
    }));
    expect(allowed.dimensions.clinical_relation_support).toEqual(
      expect.objectContaining({ strong_support_assertion_count: 1 }),
    );
    expect(allowed.dimensions.evidence_foundations).toEqual(
      expect.objectContaining({ scientific: 1 }),
    );
    expect(allowed.dimensions.evidence_quality).toEqual(
      expect.objectContaining({ high: 1 }),
    );
    expect(allowed.evidence_details).toEqual([
      expect.objectContaining({
        assertion_id: allowSupportAssertionId,
        evidence_basis: "clinical_study",
        evidence_quality: "high",
      }),
    ]);

    expect(excluded).toEqual(expect.objectContaining({
      candidate_status: "EXCLUDE",
      entity_id: safetyPreparationId,
      entity_revision_id: safetyPreparationRevisionId,
      status_lock: "UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN",
      status_reasons: expect.arrayContaining([
        "SAFETY_RULE_EXCLUDE_UNOVERRIDABLE",
      ]),
      safety: expect.objectContaining({ safety_effect: "EXCLUDE" }),
    }));
    expect(excluded.dimensions.preference_and_budget).toEqual(
      expect.objectContaining({
        preference_context_present: true,
        budget_context_present: true,
        used_for_candidate_status: false,
        eligible_only_after_safety_and_fit: true,
      }),
    );

    const unknownSafety = structuredClone(successfulSafetyGate);
    const unknownAssessment = unknownSafety.safety_rule_assessments
      ?.subject_assessments.find(
        (assessment) => assessment.subject_entity_id === allowPreparationId,
      );
    expect(unknownAssessment).toBeDefined();
    unknownAssessment!.safety_effect = "UNRECOGNIZED_SYNTHETIC_EFFECT";
    unknownSafety.result_hash = await hashJson(Object.fromEntries(
      Object.entries(unknownSafety).filter(([key]) => key !== "result_hash"),
    ));
    const failClosed = (await db.query<{ value: CandidateStatusResult["general_track"] }>(`
      SELECT public.therapy_retrieval_v2_general_candidate_track_v1(
        $1::uuid, $2::uuid, $3::jsonb, $4::jsonb
      ) AS value
    `, [
      safetyInputRevisionId,
      knowledgeReleaseId,
      JSON.stringify(successfulSafetySplitTrack),
      JSON.stringify(unknownSafety),
    ])).rows[0].value;
    expect(failClosed?.candidates.find(
      (candidate) => candidate.entity_id === allowPreparationId,
    )).toEqual(expect.objectContaining({
      candidate_status: "REVIEW_ONLY",
      status_reasons: expect.arrayContaining([
        "UNRECOGNIZED_SAFETY_EFFECT_REQUIRES_REVIEW",
      ]),
    }));
  });

  it("keeps every source-native homeopathic candidate separate and review-only", () => {
    expect(successfulCandidateStatus.homeopathic_track).toEqual(
      expect.objectContaining({
        track: "HOMEOPATHIC_SOURCE_NATIVE_CANDIDATE_TRACK",
        status: "HOMEOPATHIC_CANDIDATES_REVIEW_ONLY_INACTIVE",
        candidate_count: 2,
        status_counts: {
          ALLOW: 0,
          REVIEW_ONLY: 2,
          EXCLUDE: 0,
          ESCALATE_ONLY: 0,
        },
        opaque_composite_score_used: false,
        track_result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(successfulCandidateStatus.homeopathic_track?.candidates.every(
      (candidate) => candidate.candidate_status === "REVIEW_ONLY",
    )).toBe(true);
    expect(successfulCandidateStatus.homeopathic_track?.candidates[0].status_reasons)
      .toContain("EXACT_HOMEOPATHIC_PREPARATION_UNRESOLVED");
    expect(successfulCandidateStatus.homeopathic_track?.candidates[0].dimensions)
      .toEqual(expect.objectContaining({
        materia_medica_alignment: "NOT_ASSESSED",
        practice_experience: "NOT_ASSESSED",
      }));
    expect(JSON.stringify(successfulCandidateStatus)).not.toContain(
      '"opaque_composite_score_used":true',
    );
  });

  it("keeps uncertain clinical fact matches review-only", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET certainty = 'uncertain' WHERE id = $1
      `, [safetyContextFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [safetyContextFactId]);
      const generalTrack = (await db.query<{
        value: CandidateStatusResult["general_track"];
      }>(`
        SELECT public.therapy_retrieval_v2_general_candidate_track_v1(
          $1::uuid, $2::uuid, $3::jsonb, $4::jsonb
        ) AS value
      `, [
        safetyInputRevisionId,
        knowledgeReleaseId,
        JSON.stringify(successfulSafetySplitTrack),
        JSON.stringify(successfulSafetyGate),
      ])).rows[0].value;
      const candidate = generalTrack?.candidates.find(
        (item) => item.entity_id === allowPreparationId,
      );
      expect(candidate).toEqual(expect.objectContaining({
        candidate_status: "REVIEW_ONLY",
        status_reasons: expect.arrayContaining([
          "NO_ALLOW_ELIGIBLE_FACT_MATCH",
          "NEGATED_INACTIVE_UNCONFIRMED_OR_UNVERIFIED_FACT_MATCH",
          "NO_RELEASED_STRONG_SUPPORT_ASSERTION",
        ]),
      }));
      expect(candidate?.dimensions.clinical_fact_coverage).toEqual(
        expect.objectContaining({
          allow_eligible_fact_count: 0,
          review_required_fact_count: 1,
        }),
      );
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 20_000);

  it("binds the exact safety hash and keeps deterministic track and result hashes", async () => {
    expect((await readCandidateStatus(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      "0".repeat(64),
    )).status).toBe("CANDIDATE_STATUS_SAFETY_GATE_MISMATCH");

    const {
      track_result_hash: generalTrackHash,
      ...generalTrackPayload
    } = successfulCandidateStatus.general_track!;
    expect(await hashJson(generalTrackPayload)).toBe(generalTrackHash);
    const {
      track_result_hash: homeopathicTrackHash,
      ...homeopathicTrackPayload
    } = successfulCandidateStatus.homeopathic_track!;
    expect(await hashJson(homeopathicTrackPayload)).toBe(homeopathicTrackHash);
    const { result_hash: resultHash, ...payload } = successfulCandidateStatus;
    expect(await hashJson(payload)).toBe(resultHash);
  }, 15_000);

  it("rejects a malformed expected safety-gate hash", async () => {
    expect((await readCandidateStatus(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      null,
    )).status).toBe("CANDIDATE_STATUS_EXPECTATION_INVALID");
  }, 15_000);

  it("preserves red-flag escalation ahead of stale safety expectations", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET is_negated = false WHERE id = $1
      `, [redFlagFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [redFlagFactId]);
      expect(await readCurrentDosageRulePriority()).toEqual(expect.objectContaining({
        status: "DOSAGE_RULE_ESCALATE_ONLY_INACTIVE",
        global_candidate_status: "ESCALATE_ONLY",
        candidate_status_result_hash_matches: false,
        medical_use_allowed: false,
        dosage_evaluation_allowed: false,
        dosage_display_allowed: false,
        ai_use_allowed: false,
        dosage_rule_scope: null,
        dosage_rule_assessments: null,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("preserves mandatory medication review ahead of dosage-rule binding", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET certainty = 'uncertain' WHERE id = $1
      `, [medicationStatusFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [medicationStatusFactId]);
      expect(await readCurrentDosageRulePriority()).toEqual(expect.objectContaining({
        status: "DOSAGE_RULE_REVIEW_ONLY_INACTIVE",
        global_candidate_status: "REVIEW_ONLY",
        candidate_status_result_hash_matches: false,
        medical_use_allowed: false,
        dosage_evaluation_allowed: false,
        dosage_display_allowed: false,
        ai_use_allowed: false,
        dosage_rule_scope: null,
        dosage_rule_assessments: null,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("adds only three closed dosage-rule functions and changes no snapshot", () => {
    expect(dosageRuleMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(3);
    expect(dosageRuleMigration).toMatch(/^BEGIN;/);
    expect(dosageRuleMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(dosageRuleMigration).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
    );
    expect(dosageRuleMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(dosageRuleMigration).not.toMatch(/\bGRANT\b/i);
    expect(dosageRuleMigration).not.toMatch(
      /\b(pseudonym_id|patient_id|patient_user_id|session_id|anamnesis_id)\b/i,
    );
    const executableDosageRuleMigration = dosageRuleMigration.slice(
      0,
      dosageRuleMigration.indexOf("COMMENT ON FUNCTION"),
    );
    expect(executableDosageRuleMigration).not.toMatch(
      /\b(dose_min|dose_max|frequency_min|frequency_max|frequency_period|duration_min|duration_max|duration_unit|timing|administration_route)\b/,
    );
    expect(dosageRuleMigration).toContain("LIMIT 4097");
    expect(dosageRuleMigration).toContain("LIMIT 16385");
    expect(dosageRuleMigration).toContain("LIMIT 8193");
    expect(dosageRuleMigration).toContain("candidate_rule_count > 2048");
    expect(wikiSnapshotAfterDosageRule).toBe(wikiSnapshotAfterCandidateStatus);
    expect(therapySnapshotAfterDosageRule).toBe(therapySnapshotAfterCandidateStatus);
  });

  it("binds exactly one released rule to the eligible general candidate without dosage output", async () => {
    expect(successfulDosageRulePreflight).toEqual(expect.objectContaining({
      status: "DOSAGE_RULE_BINDINGS_READY_INACTIVE",
      interpretation: "RULE_BINDING_PREFLIGHT_ONLY_NO_DOSAGE_OUTPUT_OR_MEDICAL_USE",
      medical_use_allowed: false,
      productive_candidate_use_allowed: false,
      dosage_evaluation_allowed: false,
      dosage_display_allowed: false,
      concrete_dosage_output_present: false,
      ai_use_allowed: false,
      inactive_dosage_rule_bindings_ready: true,
      candidate_status_result_hash_matches: true,
      allow_candidate_count: 1,
      binding_ready_candidate_count: 1,
      blocked_candidate_count: 0,
      excluded_general_candidate_count: 1,
      review_only_general_candidate_count: 0,
      homeopathic_candidate_count_excluded_from_dosage: 2,
      homeopathic_dosage_evaluation_allowed: false,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(successfulDosageRulePreflight.dosage_rule_scope).toEqual(
      expect.objectContaining({
        status: "DOSAGE_RULE_SCOPE_READY_INACTIVE",
        allow_candidate_count: 1,
        released_dosage_rule_count: 1,
        scope_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(successfulDosageRulePreflight.dosage_rule_scope?.rules).toEqual([
      expect.objectContaining({
        dosage_rule_id: allowDosageRuleId,
        assertion_id: allowDosageAssertionId,
        subject_entity_id: allowPreparationId,
        subject_entity_revision_id: allowPreparationRevisionId,
        indication_entity_id: candidateContextEntityId,
        indication_entity_revision_id: candidateContextRevisionId,
        sources: [expect.objectContaining({
          source_revision_id: knowledgeSourceRevisionId,
          locator_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        })],
      }),
    ]);
    const assessment = successfulDosageRulePreflight
      .dosage_rule_assessments?.candidate_assessments[0];
    expect(assessment).toEqual(expect.objectContaining({
      subject_entity_id: allowPreparationId,
      subject_entity_revision_id: allowPreparationRevisionId,
      assessment_status: "EXACT_DOSAGE_RULE_BINDING_READY_INACTIVE",
      inactive_rule_binding_ready: true,
      dosage_display_allowed: false,
      released_rule_count: 1,
      applicable_rule_count: 1,
      applicable_rule_identity: expect.objectContaining({
        dosage_rule_id: allowDosageRuleId,
        assertion_id: allowDosageAssertionId,
      }),
    }));
    expect(assessment?.rule_assessments[0]).toEqual(expect.objectContaining({
      indication_matches: true,
      indication_fact_matches: [expect.objectContaining({
        therapy_input_fact_id: safetyContextFactId,
      })],
      population_matches: true,
      applicability_status: "APPLICABLE_EXACT_FACT_BINDING",
    }));
    expect(JSON.stringify(successfulDosageRulePreflight)).not.toMatch(
      /"(?:dose|dose_min|dose_max|frequency|duration|timing|administration_route)"\s*:/,
    );
    expect(JSON.stringify(successfulDosageRulePreflight)).not.toContain(
      "section:dosage-rule-preflight",
    );

    const invalidTypeCandidate = structuredClone(successfulCandidateStatus);
    const invalidGeneralTrack = invalidTypeCandidate.general_track!;
    invalidGeneralTrack.candidates[0].entity_type_code = "symptom";
    invalidGeneralTrack.track_result_hash = await hashJson(Object.fromEntries(
      Object.entries(invalidGeneralTrack).filter(
        ([key]) => key !== "track_result_hash",
      ),
    ));
    invalidTypeCandidate.result_hash = await hashJson(Object.fromEntries(
      Object.entries(invalidTypeCandidate).filter(([key]) => key !== "result_hash"),
    ));
    const invalidScope = (await db.query<{ value: unknown }>(`
      SELECT public.therapy_retrieval_v2_dosage_rule_scope_v1(
        $1::uuid, $2::jsonb
      ) AS value
    `, [knowledgeReleaseId, JSON.stringify(invalidTypeCandidate)])).rows[0].value;
    expect(invalidScope).toBeNull();
  });

  it("binds the exact candidate hash and keeps scope, assessment, and result hashes deterministic", async () => {
    expect((await readDosageRulePreflight(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      successfulSafetyGate.result_hash,
      "0".repeat(64),
    )).status).toBe("DOSAGE_RULE_CANDIDATE_STATUS_MISMATCH");

    const { scope_hash: scopeHash, ...scopePayload } =
      successfulDosageRulePreflight.dosage_rule_scope!;
    expect(await hashJson(scopePayload)).toBe(scopeHash);
    const { assessments_hash: assessmentsHash, ...assessmentsPayload } =
      successfulDosageRulePreflight.dosage_rule_assessments!;
    expect(await hashJson(assessmentsPayload)).toBe(assessmentsHash);
    const { result_hash: resultHash, ...resultPayload } = successfulDosageRulePreflight;
    expect(await hashJson(resultPayload)).toBe(resultHash);
  }, 15_000);

  it("rejects a malformed expected candidate-status hash", async () => {
    expect((await readDosageRulePreflight(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      successfulSafetyGate.result_hash,
      null,
    )).status).toBe("DOSAGE_RULE_EXPECTATION_INVALID");
  }, 15_000);

  it("blocks rule assessment when the exact indication fact is unavailable", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET kb_entity_id = NULL WHERE id = $1
      `, [safetyContextFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [safetyContextFactId]);
      const currentInputHash = (await db.query<{ value: string }>(`
        SELECT public.therapy_retrieval_v2_input_hash_v1($1) AS value
      `, [safetyInputRevisionId])).rows[0].value;
      const currentCandidate = structuredClone(successfulCandidateStatus);
      currentCandidate.therapy_input_manifest_hash = currentInputHash;
      currentCandidate.result_hash = await hashJson(Object.fromEntries(
        Object.entries(currentCandidate).filter(([key]) => key !== "result_hash"),
      ));
      const currentScope = (await db.query<{
        value: NonNullable<DosageRulePreflightResult["dosage_rule_scope"]>;
      }>(`
        SELECT public.therapy_retrieval_v2_dosage_rule_scope_v1(
          $1::uuid, $2::jsonb
        ) AS value
      `, [knowledgeReleaseId, JSON.stringify(currentCandidate)])).rows[0].value;
      const currentAssessments = (await db.query<{
        value: NonNullable<DosageRulePreflightResult["dosage_rule_assessments"]>;
      }>(`
        SELECT public.therapy_retrieval_v2_dosage_rule_assessments_v1(
          $1::uuid, $2::uuid, $3::jsonb, $4::jsonb
        ) AS value
      `, [
        safetyInputRevisionId,
        knowledgeReleaseId,
        JSON.stringify(currentCandidate),
        JSON.stringify(currentScope),
      ])).rows[0].value;
      expect(currentAssessments).toEqual(expect.objectContaining({
        allow_candidate_count: 1,
        binding_ready_candidate_count: 0,
        blocked_candidate_count: 1,
        dosage_display_allowed: false,
      }));
      expect(currentAssessments.candidate_assessments[0])
        .toEqual(expect.objectContaining({
          assessment_status: "DOSAGE_RULE_NOT_APPLICABLE_INACTIVE",
          inactive_rule_binding_ready: false,
          applicable_rule_count: 0,
          rule_assessments: [expect.objectContaining({
            indication_matches: false,
            indication_fact_matches: [],
            applicability_status: "INDICATION_FACT_MISSING",
          })],
        }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("fails closed when a released dosage rule is missing", async () => {
    await db.exec("BEGIN; ALTER TABLE public.kb_dosage_rules DISABLE TRIGGER USER;");
    try {
      await db.query("DELETE FROM public.kb_dosage_rules WHERE id = $1", [
        allowDosageRuleId,
      ]);
      const result = await readDosageRulePreflight();
      expect(result).toEqual(expect.objectContaining({
        status: "DOSAGE_RULE_SCOPE_UNAVAILABLE",
        medical_use_allowed: false,
        dosage_evaluation_allowed: false,
        dosage_display_allowed: false,
        ai_use_allowed: false,
        dosage_rule_scope: null,
        dosage_rule_assessments: null,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 15_000);

  it("adds only one closed audit-envelope function and changes no snapshot", () => {
    expect(auditEnvelopeMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(1);
    expect(auditEnvelopeMigration).toMatch(/^BEGIN;/);
    expect(auditEnvelopeMigration.trimEnd()).toMatch(/COMMIT;$/);
    expect(auditEnvelopeMigration).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|TRIGGER|POLICY|TYPE|SEQUENCE|SCHEMA)\b|\bTRUNCATE\b/i,
    );
    expect(auditEnvelopeMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|COPY)\b/i,
    );
    expect(auditEnvelopeMigration).not.toMatch(/\bGRANT\b/i);
    expect(auditEnvelopeMigration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|session_id|anamnesis_id)\b/i,
    );
    const executableAuditMigration = auditEnvelopeMigration.slice(
      0,
      auditEnvelopeMigration.indexOf("COMMENT ON FUNCTION"),
    );
    expect(executableAuditMigration).not.toMatch(
      /\b(fact_value|source_payload|input_envelope|clinical_text|notice_text)\b/,
    );
    expect(executableAuditMigration).not.toMatch(
      /\b(dose_min|dose_max|frequency_min|frequency_max|frequency_period|duration_min|duration_max|duration_unit|timing|administration_route)\b/,
    );
    expect(auditEnvelopeMigration).toContain("LIMIT 16385");
    expect(auditEnvelopeMigration).toContain("knowledge_source_binding_count > 32768");
    expect(auditEnvelopeMigration).toContain("octet_length(result_payload::text) > 8388608");
    for (const field of [
      "medical_use_allowed",
      "productive_candidate_use_allowed",
      "dosage_evaluation_allowed",
      "dosage_display_allowed",
      "audit_persistence_allowed",
      "replay_execution_allowed",
      "shadow_execution_allowed",
      "ai_use_allowed",
      "plan_selection_allowed",
      "activation_allowed",
    ]) {
      expect(auditEnvelopeMigration.match(
        new RegExp(`'${field}', false`, "g"),
      )).toHaveLength(11);
    }
    expect(wikiSnapshotAfterAuditEnvelope).toBe(wikiSnapshotAfterDosageRule);
    expect(therapySnapshotAfterAuditEnvelope).toBe(therapySnapshotAfterDosageRule);
  });

  it("materializes a deterministic inactive audit envelope without enabling use", () => {
    expect(successfulAuditEnvelope).toEqual(expect.objectContaining({
      status: "RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE",
      interpretation: "AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE",
      medical_use_allowed: false,
      productive_candidate_use_allowed: false,
      dosage_evaluation_allowed: false,
      dosage_display_allowed: false,
      audit_persistence_allowed: false,
      replay_execution_allowed: false,
      shadow_execution_allowed: false,
      ai_use_allowed: false,
      plan_selection_allowed: false,
      activation_allowed: false,
      inactive_audit_envelope_ready: true,
      dosage_rule_result_status: "DOSAGE_RULE_BINDINGS_READY_INACTIVE",
      dosage_rule_result_hash: successfulDosageRulePreflight.result_hash,
      dosage_rule_result_hash_matches: true,
      audit_envelope_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    const envelope = successfulAuditEnvelope.audit_envelope!;
    expect(envelope).toEqual(expect.objectContaining({
      audit_envelope_version: 1,
      data_classification: "pseudonymized_health_data",
      raw_source_locators_present: false,
      concrete_dosage_output_present: false,
      audit_envelope_hash: successfulAuditEnvelope.audit_envelope_hash,
    }));
    expect(envelope.stage_hashes).toEqual(expect.objectContaining({
      therapy_input_manifest_hash: safetyInputHash,
      release_manifest_hash: expectedReleaseManifestHash,
      homeopathic_request_hash: safetyHomeopathicRequestHash,
      split_track_result_hash: safetySplitTrackHash,
      safety_gate_result_hash: successfulSafetyGate.result_hash,
      candidate_status_result_hash: successfulCandidateStatus.result_hash,
      dosage_rule_result_hash: successfulDosageRulePreflight.result_hash,
    }));
  });

  it("binds fact, comparator, candidate, rule, and hashed source audit provenance", () => {
    const envelope = successfulAuditEnvelope.audit_envelope!;
    expect(envelope.fact_provenance).toEqual(expect.objectContaining({
      selected_fact_count: safetyInputManifest.selected_fact_count,
      fact_source_binding_count: safetyInputManifest.selected_fact_count,
      raw_fact_values_present: false,
      raw_source_locators_present: false,
      fact_provenance_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(envelope.fact_provenance.facts).toHaveLength(
      safetyInputManifest.selected_fact_count,
    );
    expect(envelope.fact_provenance.facts.every(
      (fact) => fact.fact_content_sha256.match(/^[0-9a-f]{64}$/)
        && fact.sources.length === 1
        && fact.sources[0].therapy_input_source_id === safetyInputSourceId
        && /^[0-9a-f]{64}$/.test(fact.sources[0].source_locator_hash)
        && /^[0-9a-f]{64}$/.test(fact.sources[0].fact_locator_hash),
    )).toBe(true);

    expect(envelope.comparator_manifest).toEqual(expect.objectContaining({
      general_comparator_version: "GENERAL_CANDIDATE_ORDER_V1",
      general_ordering_dimensions: [
        "candidate_status_allow_review_exclude",
        "verified_fact_coverage_desc",
        "strong_support_assertions_desc",
        "product_variant_before_preparation",
        "direct_reference_count_desc",
        "canonical_key_asc",
        "entity_revision_id_asc",
      ],
      homeopathic_comparator_version: "HOMEOPATHIC_SOURCE_NATIVE_ORDER_V1",
      homeopathic_ordering_dimensions: [
        "source_native_repertory_position_asc",
        "no_cross_track_or_efficacy_score",
      ],
      opaque_composite_score_used: false,
      comparator_manifest_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(envelope.candidate_decisions.general).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_status: "ALLOW",
        entity_id: allowPreparationId,
        entity_revision_id: allowPreparationRevisionId,
        candidate_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      expect.objectContaining({
        candidate_status: "EXCLUDE",
        entity_id: safetyPreparationId,
      }),
    ]));
    expect(envelope.candidate_decisions.homeopathic.every(
      (candidate) => candidate.candidate_status === "REVIEW_ONLY"
        && /^[0-9a-f]{64}$/.test(candidate.candidate_payload_hash),
    )).toBe(true);

    const safetyRules = envelope.safety_decisions.subjects.flatMap(
      (subject) => subject.rules,
    );
    expect(safetyRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        safety_rule_id: allowSafetyRuleId,
        assertion_id: allowSafetyAssertionId,
        rule_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      expect.objectContaining({ safety_rule_id: interactionRuleId }),
      expect.objectContaining({ safety_rule_id: contraindicationRuleId }),
    ]));
    expect(envelope.dosage_decisions).toEqual(expect.objectContaining({
      dosage_rule_result_status: "DOSAGE_RULE_BINDINGS_READY_INACTIVE",
      concrete_dosage_output_present: false,
      rules: [expect.objectContaining({
        dosage_rule_id: allowDosageRuleId,
        assertion_id: allowDosageAssertionId,
      })],
      candidate_assessments: [expect.objectContaining({
        assessment_status: "EXACT_DOSAGE_RULE_BINDING_READY_INACTIVE",
      })],
      dosage_decisions_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));

    expect(new Set(
      envelope.knowledge_source_provenance.map((source) => source.usage),
    )).toEqual(new Set(["candidate_evidence", "safety_rule", "dosage_rule"]));
    expect(envelope.knowledge_source_binding_count).toBe(
      envelope.knowledge_source_provenance.length,
    );
    expect(envelope.knowledge_source_provenance.every(
      (source) => source.source_id === knowledgeSourceId
        && source.source_revision_id === knowledgeSourceRevisionId
        && /^[0-9a-f]{64}$/.test(source.source_content_hash)
        && /^[0-9a-f]{64}$/.test(source.locator_hash),
    )).toBe(true);

    expect(envelope.ai_provenance).toEqual({
      execution_present: false,
      model: null,
      prompt_hash: null,
      raw_output_hash: null,
      validated_output_hash: null,
    });
    expect(envelope.plan_selection_provenance).toEqual({
      selection_present: false,
      selected_position_count: 0,
      selected_positions: [],
    });
    const serialized = JSON.stringify(successfulAuditEnvelope);
    expect(serialized).not.toContain(safetySourceLocator);
    expect(serialized).not.toContain("section:dosage-rule-preflight");
    expect(serialized).not.toMatch(/"(?:fact_value|source_payload|notice_text)"\s*:/);
    expect(serialized).not.toMatch(
      /"(?:dose_min|dose_max|frequency_min|frequency_max|frequency_period|duration_min|duration_max|duration_unit|timing|administration_route)"\s*:/,
    );
  });

  it("binds the exact dosage result and every audit hash deterministically", async () => {
    expect((await readAuditEnvelope(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      successfulSafetyGate.result_hash,
      successfulCandidateStatus.result_hash,
      "0".repeat(64),
    )).status).toBe("RETRIEVAL_AUDIT_DOSAGE_RESULT_MISMATCH");
    expect((await readAuditEnvelope(
      safetyInputHash,
      expectedReleaseManifestHash,
      safetyHomeopathicRequestHash,
      safetySplitTrackHash,
      successfulSafetyGate.result_hash,
      successfulCandidateStatus.result_hash,
      null,
    )).status).toBe("RETRIEVAL_AUDIT_EXPECTATION_INVALID");

    const envelope = successfulAuditEnvelope.audit_envelope!;
    const {
      fact_provenance_hash: factHash,
      ...factPayload
    } = envelope.fact_provenance;
    expect(await hashJson(factPayload)).toBe(factHash);
    const {
      comparator_manifest_hash: comparatorHash,
      ...comparatorPayload
    } = envelope.comparator_manifest;
    expect(await hashJson(comparatorPayload)).toBe(comparatorHash);
    const {
      candidate_decisions_hash: candidateHash,
      ...candidatePayload
    } = envelope.candidate_decisions;
    expect(await hashJson(candidatePayload)).toBe(candidateHash);
    const {
      safety_decisions_hash: safetyHash,
      ...safetyPayload
    } = envelope.safety_decisions;
    expect(await hashJson(safetyPayload)).toBe(safetyHash);
    const {
      dosage_decisions_hash: dosageHash,
      ...dosagePayload
    } = envelope.dosage_decisions;
    expect(await hashJson(dosagePayload)).toBe(dosageHash);
    const { audit_envelope_hash: envelopeHash, ...envelopePayload } = envelope;
    expect(await hashJson(envelopePayload)).toBe(envelopeHash);
    const { result_hash: resultHash, ...resultPayload } = successfulAuditEnvelope;
    expect(await hashJson(resultPayload)).toBe(resultHash);
    expect(await readAuditEnvelope()).toEqual(successfulAuditEnvelope);
  }, 20_000);

  it("preserves red-flag escalation ahead of a stale audit expectation", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET is_negated = false WHERE id = $1
      `, [redFlagFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [redFlagFactId]);
      expect(await readCurrentAuditPriority()).toEqual(expect.objectContaining({
        status: "RETRIEVAL_AUDIT_ESCALATE_ONLY_INACTIVE",
        global_candidate_status: "ESCALATE_ONLY",
        dosage_rule_result_hash_matches: false,
        medical_use_allowed: false,
        audit_persistence_allowed: false,
        shadow_execution_allowed: false,
        ai_use_allowed: false,
        activation_allowed: false,
        audit_envelope: null,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 20_000);

  it("preserves medication review ahead of a stale audit expectation", async () => {
    await db.exec("BEGIN; ALTER TABLE public.therapy_input_facts DISABLE TRIGGER USER;");
    try {
      await db.query(`
        UPDATE public.therapy_input_facts SET certainty = 'uncertain' WHERE id = $1
      `, [medicationStatusFactId]);
      await db.query(`
        UPDATE public.therapy_input_facts
           SET content_sha256 = public.therapy_input_fact_sha256_v1(id)
         WHERE id = $1
      `, [medicationStatusFactId]);
      expect(await readCurrentAuditPriority()).toEqual(expect.objectContaining({
        status: "RETRIEVAL_AUDIT_REVIEW_ONLY_INACTIVE",
        global_candidate_status: "REVIEW_ONLY",
        dosage_rule_result_hash_matches: false,
        medical_use_allowed: false,
        audit_persistence_allowed: false,
        shadow_execution_allowed: false,
        ai_use_allowed: false,
        activation_allowed: false,
        audit_envelope: null,
      }));
    } finally {
      await db.exec("ROLLBACK;");
    }
  }, 20_000);

  it("exposes no retrieval or audit preflight function to application or import roles", async () => {
    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege(role_name, function_name, 'EXECUTE') AS can_execute
        FROM unnest(ARRAY[
          'anon', 'authenticated', 'service_role', 'kb_importer', 'kb_import_runtime'
        ]::text[]) role_name
       CROSS JOIN unnest(ARRAY[
          'public.therapy_retrieval_v2_input_manifest_v1(uuid)',
          'public.therapy_retrieval_v2_input_hash_v1(uuid)',
          'public.therapy_retrieval_v2_expectations_are_valid_v1(text,text)',
          'public.therapy_retrieval_v2_preflight_v1(uuid,text,uuid,text)',
          'public.therapy_retrieval_v2_entity_query_manifest_v1(uuid)',
          'public.therapy_retrieval_v2_entity_projection_is_complete_v1(uuid)',
          'public.therapy_retrieval_v2_entity_resolution_preflight_v1(uuid,text,uuid,text,integer,integer)',
          'public.therapy_retrieval_v2_reference_track_v1(uuid,uuid,uuid)',
          'public.therapy_retrieval_v2_homeopathic_request_manifest_v1(uuid,uuid,uuid,jsonb)',
          'public.therapy_retrieval_v2_split_track_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,integer,integer,integer)',
          'public.therapy_retrieval_v2_safety_input_manifest_v1(uuid)',
          'public.therapy_retrieval_v2_safety_rule_assessments_v1(uuid,uuid)',
          'public.therapy_retrieval_v2_safety_gate_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,integer,integer,integer)',
          'public.therapy_retrieval_v2_general_candidate_track_v1(uuid,uuid,jsonb,jsonb)',
          'public.therapy_retrieval_v2_homeopathic_candidate_track_v1(jsonb,jsonb)',
          'public.therapy_retrieval_v2_candidate_status_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,integer,integer,integer)',
          'public.therapy_retrieval_v2_dosage_rule_scope_v1(uuid,jsonb)',
          'public.therapy_retrieval_v2_dosage_rule_assessments_v1(uuid,uuid,jsonb,jsonb)',
          'public.therapy_retrieval_v2_dosage_rule_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,integer,integer,integer)',
          'public.therapy_retrieval_v2_audit_envelope_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,integer,integer,integer)'
        ]::text[]) function_name
    `);
    expect(privileges.rows).toHaveLength(100);
    expect(privileges.rows.every((row) => row.can_execute === false)).toBe(true);
  });
});
