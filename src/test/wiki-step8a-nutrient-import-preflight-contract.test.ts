// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseMigrationFiles = [
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

const baseMigrations = baseMigrationFiles.map((file) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"),
);
const nutrientPreflightMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260804180000_create_kb_nutrient_import_preflight_contract.sql",
  ),
  "utf8",
);

const adminId = "18000000-0000-4000-8000-000000000001";
const sourceId = "28000000-0000-4000-8000-000000000001";
const sourceRevisionId = "28100000-0000-4000-8000-000000000001";
const preparationId = "38000000-0000-4000-8000-000000000001";
const preparationRevisionId = "38100000-0000-4000-8000-000000000001";
const firstNutrientId = "38000000-0000-4000-8000-000000000002";
const firstNutrientRevisionId = "38100000-0000-4000-8000-000000000002";
const secondNutrientId = "38000000-0000-4000-8000-000000000003";
const secondNutrientRevisionId = "38100000-0000-4000-8000-000000000003";
const preparationAssertionId = "48000000-0000-4000-8000-000000000001";
const firstComponentAssertionId = "48000000-0000-4000-8000-000000000002";
const secondComponentAssertionId = "48000000-0000-4000-8000-000000000003";
const firstComponentId = "58000000-0000-4000-8000-000000000001";
const secondComponentId = "58000000-0000-4000-8000-000000000002";

const expectedCounts = {
  assertions: 3,
  components: 2,
  source_bindings: 3,
};

type ControlFlags = Record<string, boolean>;

type NutrientManifest = {
  contract_version: number;
  contract_scope: string;
  data_classification: string;
  source_policy: {
    contract_is_source_neutral: boolean;
    primary_assertion_provenance_required: boolean;
    source_rights_review_required: boolean;
    real_source_data_loaded: boolean;
  };
  preparation: {
    preparation_entity_id: string;
    preparation_revision_id: string;
    preparation_content_hash: string;
    preparation_kind: string;
    formulation_kind: string;
    delivery_system: string;
  };
  component_count: number;
  component_set_hash: string;
  provenance: {
    assertion_count: number;
    source_binding_count: number;
    source_binding_set_hash: string;
  };
  control_flags: ControlFlags;
};

type NutrientPreflightResult = {
  status: string;
  interpretation: string;
  actual_manifest_hash?: string;
  expected_manifest_hash?: string;
  actual_counts?: typeof expectedCounts;
  expected_counts?: typeof expectedCounts;
  manifest_hash_matches?: boolean;
  counts_match?: boolean;
  manifest?: NutrientManifest;
  control_flags: ControlFlags;
  result_hash: string;
};

let db: PGlite;
let wikiSnapshotBefore = "";
let wikiSnapshotAfter = "";
let therapySnapshotBefore = "";
let therapySnapshotAfter = "";
let manifest: NutrientManifest;
let manifestHash = "";
let readyResult: NutrientPreflightResult;

async function bootstrapDatabase(target: PGlite): Promise<void> {
  await target.exec(`
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
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('${adminId}', 'admin');
  `);
}

async function readManifest(): Promise<NutrientManifest> {
  return (await db.query<{ value: NutrientManifest }>(`
    SELECT public.kb_nutrient_import_manifest_v1(
      '${preparationId}', '${preparationRevisionId}'
    ) AS value
  `)).rows[0].value;
}

async function readManifestHash(): Promise<string> {
  return (await db.query<{ value: string }>(`
    SELECT public.kb_nutrient_import_manifest_hash_v1(
      '${preparationId}', '${preparationRevisionId}'
    ) AS value
  `)).rows[0].value;
}

async function readPreflight(
  expectedHash: string,
  counts: unknown,
  selectedPreparationId = preparationId,
  selectedRevisionId = preparationRevisionId,
): Promise<NutrientPreflightResult> {
  return (await db.query<{ value: NutrientPreflightResult }>(`
    SELECT public.kb_nutrient_import_preflight_v1(
      $1::uuid, $2::uuid, $3::text, $4::jsonb
    ) AS value
  `, [selectedPreparationId, selectedRevisionId, expectedHash, JSON.stringify(counts)])).rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await bootstrapDatabase(db);
  for (const migration of baseMigrations) {
    await db.exec(migration);
  }

  wikiSnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotBefore = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;
  await db.exec(nutrientPreflightMigration);
  wikiSnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.kb_export_wiki_snapshot()::text AS value",
  )).rows[0].value;
  therapySnapshotAfter = (await db.query<{ value: string }>(
    "SELECT public.therapy_input_export_snapshot_v2() AS value",
  )).rows[0].value;

  await db.exec(`
    BEGIN;
    INSERT INTO public.kb_sources (id, canonical_key)
    VALUES ('${sourceId}', 'source:synthetic-neutral-nutrient-fixture');
    INSERT INTO public.kb_source_revisions (
      id, source_id, revision_no, source_type, title, rights_status, content_hash
    ) VALUES (
      '${sourceRevisionId}', '${sourceId}', 1, 'database',
      'Synthetic source-neutral nutrient fixture', 'licensed', repeat('f', 64)
    );
    UPDATE public.kb_sources SET current_revision_id = '${sourceRevisionId}'
     WHERE id = '${sourceId}';

    INSERT INTO public.kb_entities (id, entity_type_code, canonical_key) VALUES
      ('${preparationId}', 'preparation', 'preparation:synthetic-neutral-nutrient'),
      ('${firstNutrientId}', 'nutrient', 'nutrient:synthetic-alpha'),
      ('${secondNutrientId}', 'nutrient', 'nutrient:synthetic-beta');
    INSERT INTO public.kb_entity_revisions (
      id, entity_id, revision_no, display_name, summary, origin_type, content_hash
    ) VALUES
      ('${preparationRevisionId}', '${preparationId}', 1,
       'Synthetic neutral nutrient preparation', 'Non-medical fixture',
       'parser', repeat('0', 64)),
      ('${firstNutrientRevisionId}', '${firstNutrientId}', 1,
       'Synthetic nutrient alpha', 'Non-medical fixture', 'parser', repeat('a', 64)),
      ('${secondNutrientRevisionId}', '${secondNutrientId}', 1,
       'Synthetic nutrient beta', 'Non-medical fixture', 'parser', repeat('b', 64));
    UPDATE public.kb_entities entity SET current_revision_id = revision.id
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = entity.id
       AND entity.id IN ('${preparationId}', '${firstNutrientId}', '${secondNutrientId}');

    INSERT INTO public.kb_assertions (
      id, canonical_key, version_no, assertion_kind, claim_text,
      origin_type, evidence_basis, content_hash
    ) VALUES
      ('${preparationAssertionId}', 'assertion:synthetic-neutral-classification', 1,
       'classification', 'Synthetic nutrient classification only',
       'parser', 'unrated', repeat('c', 64)),
      ('${firstComponentAssertionId}', 'assertion:synthetic-neutral-component-alpha', 1,
       'classification', 'Synthetic alpha component only',
       'parser', 'unrated', repeat('d', 64)),
      ('${secondComponentAssertionId}', 'assertion:synthetic-neutral-component-beta', 1,
       'classification', 'Synthetic beta component only',
       'parser', 'unrated', repeat('e', 64));
    INSERT INTO public.kb_assertion_sources (
      assertion_id, source_revision_id, source_role, locator, is_primary
    ) VALUES
      ('${preparationAssertionId}', '${sourceRevisionId}', 'supports',
       'fixture:classification', true),
      ('${firstComponentAssertionId}', '${sourceRevisionId}', 'supports',
       'fixture:component-alpha', true),
      ('${secondComponentAssertionId}', '${sourceRevisionId}', 'qualifies',
       'fixture:component-beta', true);

    INSERT INTO public.kb_preparation_revision_details (
      entity_id, entity_revision_id, preparation_kind, dosage_form,
      administration_routes, standardization_status, basis_assertion_id
    ) VALUES (
      '${preparationId}', '${preparationRevisionId}', 'nutrient_combination',
      'capsules', ARRAY['oral'], 'not_standardized', '${preparationAssertionId}'
    );
    INSERT INTO public.kb_nutrient_revision_details (
      entity_id, entity_revision_id, formulation_kind, delivery_system,
      basis_assertion_id
    ) VALUES (
      '${preparationId}', '${preparationRevisionId}', 'combination', 'standard',
      '${preparationAssertionId}'
    );
    INSERT INTO public.kb_composition_components (
      id, owner_entity_id, owner_revision_id, component_entity_id,
      component_revision_id, component_role, chemical_form,
      amount_min, amount_max, amount_unit, elemental_amount, elemental_unit,
      component_order, basis_assertion_id
    ) VALUES
      ('${firstComponentId}', '${preparationId}', '${preparationRevisionId}',
       '${firstNutrientId}', '${firstNutrientRevisionId}', 'nutrient',
       'synthetic-alpha-form', 10, 10, 'mg', 2, 'mg', 1,
       '${firstComponentAssertionId}'),
      ('${secondComponentId}', '${preparationId}', '${preparationRevisionId}',
       '${secondNutrientId}', '${secondNutrientRevisionId}', 'nutrient',
       'synthetic-beta-form', 20, 20, 'mg', 4, 'mg', 2,
       '${secondComponentAssertionId}');
    UPDATE public.kb_entity_revisions
       SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
     WHERE id = '${preparationRevisionId}';
    SET CONSTRAINTS ALL IMMEDIATE;
    COMMIT;
  `);

  manifest = await readManifest();
  manifestHash = await readManifestHash();
  readyResult = await readPreflight(manifestHash, expectedCounts);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("Wiki Step 8A source-neutral nutrient import preflight", () => {
  it("installs only four closed read functions without changing either snapshot", async () => {
    expect(nutrientPreflightMigration.match(/CREATE FUNCTION public\./g)).toHaveLength(4);
    expect(nutrientPreflightMigration).not.toMatch(
      /\b(?:CREATE TABLE|ALTER TABLE|INSERT INTO|UPDATE|DELETE|TRUNCATE|GRANT EXECUTE)\b/,
    );
    expect(nutrientPreflightMigration).not.toMatch(/strunz/i);
    expect(nutrientPreflightMigration).not.toMatch(
      /\b(?:patient_id|patient_user_id|pseudonym_id|session_id|therapy_session_id|anamnesis_id)\b/i,
    );
    expect(nutrientPreflightMigration).toContain("NUTRIENT_IMPORT_PREFLIGHT_ONLY");
    expect(nutrientPreflightMigration).toContain("contract_is_source_neutral");
    expect(wikiSnapshotAfter).toBe(wikiSnapshotBefore);
    expect(therapySnapshotAfter).toBe(therapySnapshotBefore);

    const activeReleases = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count FROM public.kb_releases
       WHERE retrieval_eligible OR is_active
    `);
    expect(activeReleases.rows[0].count).toBe(0);
  });

  it("binds one synthetic preparation to bounded component and provenance hashes", () => {
    expect(manifest).toEqual(expect.objectContaining({
      contract_version: 1,
      contract_scope: "NUTRIENT_IMPORT_PREFLIGHT_ONLY",
      data_classification: "general_knowledge",
      source_policy: {
        contract_is_source_neutral: true,
        primary_assertion_provenance_required: true,
        source_rights_review_required: true,
        real_source_data_loaded: false,
      },
      preparation: expect.objectContaining({
        preparation_entity_id: preparationId,
        preparation_revision_id: preparationRevisionId,
        preparation_kind: "nutrient_combination",
        formulation_kind: "combination",
        delivery_system: "standard",
      }),
      component_count: 2,
      provenance: expect.objectContaining({
        assertion_count: 3,
        source_binding_count: 3,
      }),
    }));
    expect(manifest.preparation.preparation_content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.component_set_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.provenance.source_binding_set_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest).not.toHaveProperty("components");
    expect(manifest).not.toHaveProperty("sources");
  });

  it("returns one deterministic inactive-ready result with every authority flag false", async () => {
    expect(readyResult).toEqual(expect.objectContaining({
      status: "NUTRIENT_IMPORT_PREFLIGHT_READY_INACTIVE",
      interpretation: "PREFLIGHT_ONLY_NOT_IMPORT_SOURCE_APPROVAL_OR_MEDICAL_USE",
      actual_manifest_hash: manifestHash,
      expected_manifest_hash: manifestHash,
      actual_counts: expectedCounts,
      expected_counts: expectedCounts,
      manifest_hash_matches: true,
      counts_match: true,
      manifest,
      result_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(Object.keys(readyResult.control_flags)).toHaveLength(13);
    expect(Object.values(readyResult.control_flags).every((value) => value === false)).toBe(true);
    expect(await readPreflight(manifestHash, expectedCounts)).toEqual(readyResult);

    const resultHash = await db.query<{ value: string }>(`
      SELECT public.kb_release_manifest_hash_v1($1::jsonb - 'result_hash') AS value
    `, [JSON.stringify(readyResult)]);
    expect(resultHash.rows[0].value).toBe(readyResult.result_hash);
  });

  it("rejects malformed or unbounded expectations before reading a bundle", async () => {
    const malformedHash = await readPreflight("A".repeat(64), expectedCounts);
    const extraCount = await readPreflight(manifestHash, {
      ...expectedCounts,
      remedies: 1,
    });
    const excessiveCount = await readPreflight(manifestHash, {
      ...expectedCounts,
      components: 4097,
    });
    const countMismatch = await readPreflight(manifestHash, {
      ...expectedCounts,
      components: 3,
    });

    for (const result of [malformedHash, extraCount, excessiveCount]) {
      expect(result.status).toBe("NUTRIENT_IMPORT_EXPECTATION_INVALID");
      expect(Object.values(result.control_flags).every((value) => value === false)).toBe(true);
      expect(result.result_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(countMismatch).toEqual(expect.objectContaining({
      status: "NUTRIENT_IMPORT_BUNDLE_MISMATCH",
      manifest_hash_matches: true,
      counts_match: false,
    }));
  });

  it("fails closed when one assertion loses generic primary provenance", async () => {
    await db.exec("BEGIN;");
    try {
      await db.query(`
        DELETE FROM public.kb_assertion_sources
         WHERE assertion_id = $1::uuid
      `, [secondComponentAssertionId]);
      const unavailable = await readPreflight(manifestHash, expectedCounts);
      expect(unavailable.status).toBe("NUTRIENT_IMPORT_BUNDLE_UNAVAILABLE");
      expect(unavailable).not.toHaveProperty("manifest");
      expect(Object.values(unavailable.control_flags).every((value) => value === false)).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }
  });

  it("detects component and generic source drift without writing an import", async () => {
    await db.exec("BEGIN;");
    try {
      await db.exec(`
        UPDATE public.kb_composition_components
           SET amount_max = 21
         WHERE id = '${secondComponentId}';
        UPDATE public.kb_entity_revisions
           SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
         WHERE id = '${preparationRevisionId}';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      const componentMismatch = await readPreflight(manifestHash, expectedCounts);
      expect(componentMismatch.status).toBe("NUTRIENT_IMPORT_BUNDLE_MISMATCH");
      expect(componentMismatch.manifest_hash_matches).toBe(false);
      expect(componentMismatch.counts_match).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    await db.exec("BEGIN;");
    try {
      await db.exec(`
        UPDATE public.kb_source_revisions
           SET content_hash = repeat('9', 64)
         WHERE id = '${sourceRevisionId}';
        SET CONSTRAINTS ALL IMMEDIATE;
      `);
      const sourceMismatch = await readPreflight(manifestHash, expectedCounts);
      expect(sourceMismatch.status).toBe("NUTRIENT_IMPORT_BUNDLE_MISMATCH");
      expect(sourceMismatch.manifest_hash_matches).toBe(false);
      expect(sourceMismatch.counts_match).toBe(true);
    } finally {
      await db.exec("ROLLBACK;").catch(() => undefined);
    }

    expect(await readManifestHash()).toBe(manifestHash);
  });

  it("keeps application, service, and importer roles outside the contract", async () => {
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "kb_importer",
      "kb_import_runtime",
    ]) {
      await db.exec(`SET ROLE ${role};`);
      try {
        await expect(db.query(`
          SELECT public.kb_nutrient_import_preflight_v1(
            '${preparationId}', '${preparationRevisionId}',
            '${manifestHash}', '${JSON.stringify(expectedCounts)}'::jsonb
          )
        `)).rejects.toThrow(/permission denied/i);
      } finally {
        await db.exec("RESET ROLE;").catch(() => undefined);
      }
    }
  });
});
