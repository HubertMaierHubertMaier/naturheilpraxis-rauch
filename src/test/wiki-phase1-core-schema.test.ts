import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728090000_create_kb_phase1_core.sql"),
  "utf8",
);
const backupAreasSource = readFileSync(resolve(process.cwd(), "src/lib/backupAreas.ts"), "utf8");
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);

const kbTables = [
  "kb_entity_types",
  "kb_identifier_schemes",
  "kb_relation_types",
  "kb_relation_type_domains",
  "kb_entities",
  "kb_entity_revisions",
  "kb_entity_names",
  "kb_entity_identifiers",
  "kb_sources",
  "kb_source_revisions",
  "kb_assertions",
  "kb_entity_relations",
  "kb_assertion_sources",
  "kb_articles",
  "kb_article_revisions",
  "kb_article_entities",
  "kb_change_proposals",
];

const kbImportTables = [
  "kb_import_batches",
  "kb_source_candidates",
  "kb_entity_candidates",
  "kb_relation_candidates",
  "kb_dosage_candidates",
  "kb_safety_candidates",
  "kb_import_events",
];

const wikiBackupTables = [
  "admin_knowledge_base",
  "mannayan_products",
  "knowledge_product_links",
  ...kbTables,
  ...kbImportTables,
  "faqs",
  "practice_pricing",
  "practice_info",
];

function quotedValues(source: string, quote: "single" | "double"): string[] {
  const pattern = quote === "single" ? /'([a-z0-9_-]+)'/g : /"([a-z0-9_-]+)"/g;
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function requiredBlock(source: string, pattern: RegExp, description: string): string {
  const match = source.match(pattern);
  expect(match, `Missing ${description}`).not.toBeNull();
  return match![1];
}

function sqlTableNames(source: string): string[] {
  return Array.from(source.matchAll(/public\.(kb_[a-z_]+)/g), (match) => match[1]);
}

describe("Wiki Phase 1 core schema migration", () => {
  it("creates exactly the 17 agreed additive knowledge tables", () => {
    const createdTables = Array.from(
      migration.matchAll(/CREATE TABLE public\.(kb_[a-z_]+)/g),
      (match) => match[1],
    );

    expect(createdTables).toEqual(kbTables);
    expect(new Set(createdTables).size).toBe(17);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("does not reference or modify the legacy knowledge base or patient data", () => {
    expect(migration).not.toContain("admin_knowledge_base");
    expect(migration).not.toMatch(
      /\b(patient_id|patient_user_id|pseudonym_id|anamnesis_id|therapy_session_id|form_data|eingabe_daten)\b/i,
    );

    const jsonbColumns = Array.from(
      migration.matchAll(/^\s+([a-z_]+) jsonb\b/gm),
      (match) => match[1],
    );
    expect(new Set(jsonbColumns)).toEqual(new Set(["metadata", "proposal"]));
  });

  it("uses ownership-safe deferrable current revision foreign keys", () => {
    for (const [table, revisionTable, ownerColumn] of [
      ["kb_entities", "kb_entity_revisions", "entity_id"],
      ["kb_sources", "kb_source_revisions", "source_id"],
      ["kb_articles", "kb_article_revisions", "article_id"],
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}[\\s\\S]*?FOREIGN KEY \\(id, current_revision_id\\)[\\s\\S]*?REFERENCES public\\.${revisionTable}\\(${ownerColumn}, id\\)[\\s\\S]*?DEFERRABLE INITIALLY DEFERRED;`,
        ),
      );
    }
  });

  it("contains stable-key, history, domain and assertion release protections", () => {
    for (const functionName of [
      "kb_prevent_stable_value_change",
      "kb_protect_reviewed_record",
      "kb_validate_entity_relation_domain",
      "kb_protect_used_relation_domain",
      "kb_validate_assertion_release",
      "kb_protect_assertion_dependency",
      "kb_protect_article_entity_dependency",
    ]) {
      expect(migration).toContain(`FUNCTION public.${functionName}()`);
    }

    for (const triggerName of [
      "kb_entities_key_immutable",
      "kb_entities_type_immutable",
      "kb_entity_revisions_protect",
      "kb_source_revisions_protect",
      "kb_assertions_protect",
      "kb_article_revisions_protect",
      "kb_entity_relations_validate_domain",
      "kb_relation_type_domains_protect",
      "kb_assertions_validate_release",
      "kb_article_entities_protect_revision",
    ]) {
      expect(migration).toContain(`CREATE ${triggerName === "kb_assertions_validate_release" ? "CONSTRAINT " : ""}TRIGGER ${triggerName}`);
    }

    expect(migration).toContain("source_revision.review_status = 'released'");
    expect(migration).toContain("assertion_source.is_primary");
    expect(migration).toContain("current_assertion.assertion_kind = 'entity_relation'");
    expect(migration).toContain("Dependencies of approved, released or historical assertions are immutable");
    expect(migration).toContain("Dependencies of approved, released or historical article revisions are immutable");
    expect(migration).toContain("assertion_kind = 'entity_relation'");
    expect(migration).toContain("CREATE TRIGGER kb_assertions_kind_immutable");
  });

  it("enforces explicit review-state transitions on every revision table", () => {
    expect(migration).toContain("FUNCTION public.kb_enforce_review_workflow()");
    for (const [triggerName, tableName, safetyArgument] of [
      ["kb_entity_revisions_review_workflow", "kb_entity_revisions", "true"],
      ["kb_source_revisions_review_workflow", "kb_source_revisions", "false"],
      ["kb_assertions_review_workflow", "kb_assertions", "true"],
      ["kb_article_revisions_review_workflow", "kb_article_revisions", "true"],
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `CREATE TRIGGER ${triggerName}[\\s\\S]*?BEFORE INSERT OR UPDATE ON public\\.${tableName}[\\s\\S]*?kb_enforce_review_workflow\\('${safetyArgument}'\\)`,
        ),
      );
    }

    expect(migration).toContain("new_status <> 'draft'");
    expect(migration).toContain("Knowledge revisions must be inserted as draft");
    expect(migration).toContain("new_status NOT IN ('superseded', 'withdrawn')");
    expect(migration).toContain("Approved revisions may only transition to draft or released");
    expect(migration).toContain("Release requires a separate approved to released transition");
    expect(migration).toContain("Release may only set review_status and released_at");
    expect(migration).toContain("Resetting an approved revision must only clear review metadata");
    expect(migration).toContain("WHEN allows_safety_review THEN 'safety_review'");
    expect(migration).toContain("ELSE 'domain_review'");
    expect(migration).toContain("old_status <> required_approval_status");
    expect(migration).toContain("Approval requires % -> approved and may only set review metadata");
    expect(migration).toContain("Source revisions do not use safety review");
  });

  it("preserves a released primary source for every released assertion", () => {
    expect(migration).toContain("FUNCTION public.kb_preserve_released_assertion_sources()");
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER kb_source_revisions_preserve_released_assertions[\s\S]*?AFTER UPDATE ON public\.kb_source_revisions[\s\S]*?DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toContain("replacement_revision.review_status = 'released'");
    expect(migration).toContain("replacement_source.source_revision_id <> NEW.id");
    expect(migration).toContain("A released assertion would lose its last released primary source");
    expect(migration).toContain("CREATE INDEX kb_assertion_sources_primary_idx");
    expect(migration).not.toContain("CREATE UNIQUE INDEX kb_assertion_sources_primary_idx");
    const lockFunction = requiredBlock(
      migration,
      /CREATE OR REPLACE FUNCTION public\.kb_lock_source_assertions_after_status_changes\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/,
      "statement-wide source assertion lock",
    );
    expect(lockFunction).toContain("kb_old_source_revisions");
    expect(lockFunction).toContain("kb_new_source_revisions");
    expect(lockFunction).toContain("old_source.review_status IS DISTINCT FROM new_source.review_status");
    expect(lockFunction).toContain("JOIN changed_source_revisions changed_source");
    expect(lockFunction).not.toContain("assertion.review_status");
    expect(lockFunction).toMatch(
      /SELECT assertion\.id[\s\S]*?ORDER BY assertion\.id[\s\S]*?FOR UPDATE OF assertion/,
    );

    const lockTrigger = requiredBlock(
      migration,
      /(CREATE TRIGGER kb_source_revisions_lock_affected_assertions[\s\S]*?EXECUTE FUNCTION public\.kb_lock_source_assertions_after_status_changes\(\);)/,
      "statement-wide source lock trigger",
    );
    expect(lockTrigger).toContain("AFTER UPDATE ON public.kb_source_revisions");
    expect(lockTrigger).toContain("OLD TABLE AS kb_old_source_revisions");
    expect(lockTrigger).toContain("NEW TABLE AS kb_new_source_revisions");
    expect(lockTrigger).toContain("FOR EACH STATEMENT");
    expect(lockTrigger).not.toContain("UPDATE OF");
  });

  it("enables one admin-only RLS policy and explicit grants for every table", () => {
    const rlsTables = quotedValues(
      requiredBlock(
        migration,
        /FOREACH kb_table IN ARRAY ARRAY\[([\s\S]*?)\]\s*LOOP/,
        "RLS table loop",
      ),
      "single",
    );
    expect(rlsTables).toEqual(kbTables);
    expect(migration).toContain("ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY");
    expect(migration).toMatch(/FOR ALL\r?\n\s+TO authenticated/);
    expect(migration).toContain("public.has_role(auth.uid(), ''admin''::public.app_role)");

    const authenticatedGrant = requiredBlock(
      migration,
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE([\s\S]*?)TO authenticated;/,
      "authenticated table grant",
    );
    const serviceRoleGrant = requiredBlock(
      migration,
      /GRANT ALL PRIVILEGES ON TABLE([\s\S]*?)TO service_role;/,
      "service-role table grant",
    );
    const publicRevoke = requiredBlock(
      migration,
      /REVOKE ALL ON TABLE([\s\S]*?)FROM PUBLIC, anon, authenticated;/,
      "public and anon table revoke",
    );

    expect(sqlTableNames(authenticatedGrant)).toEqual(kbTables);
    expect(sqlTableNames(serviceRoleGrant)).toEqual(kbTables);
    expect(sqlTableNames(publicRevoke)).toEqual(kbTables);
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE ON TABLE public\.kb_change_proposals\s+FROM authenticated;/,
    );
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE[\s\S]*?public\.kb_entity_types,[\s\S]*?public\.kb_relation_type_domains\s+FROM authenticated;/,
    );

    const grantStatements = migration
      .split(";")
      .filter((statement) => /^\s*GRANT\b/.test(statement));
    expect(grantStatements.some((statement) => /\bTO\s+anon\b/.test(statement))).toBe(false);
  });

  it("contains conservative controlled vocabulary and domain seeds", () => {
    const entityTypeSeed = requiredBlock(
      migration,
      /INSERT INTO public\.kb_entity_types \(code, label\) VALUES([\s\S]*?);/,
      "entity type seed",
    );
    const identifierSeed = requiredBlock(
      migration,
      /INSERT INTO public\.kb_identifier_schemes \([\s\S]*?\) VALUES([\s\S]*?);/,
      "identifier scheme seed",
    );
    const relationSeed = requiredBlock(
      migration,
      /INSERT INTO public\.kb_relation_types \(code, label, is_symmetric, is_active\) VALUES([\s\S]*?);/,
      "relation type seed",
    );

    expect(quotedValues(entityTypeSeed, "single")).toEqual(expect.arrayContaining([
      "manufacturer",
      "product_variant",
      "pathogen",
      "lab_parameter",
      "diagnostic_method",
      "population_group",
    ]));
    expect(quotedValues(identifierSeed, "single")).toEqual(expect.arrayContaining([
      "pzn",
      "gtin",
      "loinc",
      "icd_10_gm",
      "ncbi_taxonomy",
      "program_code",
    ]));
    expect(quotedValues(relationSeed, "single")).toEqual(expect.arrayContaining([
      "manufactured_by",
      "contains",
      "targets_pathogen",
      "contraindicated_for",
      "interacts_with",
    ]));
    expect(migration).toContain("('manufactured_by', 'product', 'manufacturer', 'approved')");
    expect(migration).toContain("('contains', 'product_variant', 'substance', 'approved')");
    expect(migration).toContain("('measured_by', 'lab_parameter', 'diagnostic_method', 'approved')");
    expect(migration).toContain("('may_be_associated_with', 'May be associated with', false, false)");
    expect(migration).not.toContain("('related_to'");
  });

  it("keeps identifier and relation semantics immutable", () => {
    for (const [triggerName, fieldName] of [
      ["kb_identifier_schemes_global_scope_immutable", "is_globally_unique"],
      ["kb_identifier_schemes_pattern_immutable", "value_pattern"],
      ["kb_relation_types_symmetry_immutable", "is_symmetric"],
    ]) {
      expect(migration).toMatch(
        new RegExp(`CREATE TRIGGER ${triggerName}[\\s\\S]*?kb_prevent_stable_value_change\\('${fieldName}'\\)`),
      );
    }
  });

  it("reviews relation domains and requires approved domains for active relation types", () => {
    expect(migration).toMatch(
      /CREATE TABLE public\.kb_relation_type_domains[\s\S]*?review_status text NOT NULL DEFAULT 'draft'[\s\S]*?review_status IN \('draft', 'approved'\)/,
    );
    expect(migration).toContain("FUNCTION public.kb_enforce_relation_domain_workflow()");
    expect(migration).toContain("Relation domains must be inserted as draft");
    expect(migration).toContain("Approved relation domains are immutable");
    expect(migration).toContain("Relation domain approval cannot change domain keys");
    expect(migration).toMatch(
      /CREATE TRIGGER kb_relation_type_domains_review_workflow[\s\S]*?BEFORE INSERT OR UPDATE OR DELETE ON public\.kb_relation_type_domains/,
    );
    expect(migration).toContain("AND review_status = 'approved'");
    expect(migration).toContain("Relation type % is inactive");
    expect(migration).toContain("FUNCTION public.kb_validate_active_relation_type_domains()");
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER kb_relation_types_validate_approved_domains[\s\S]*?DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER kb_relation_type_domains_validate_active_type[\s\S]*?DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toContain("requires at least one approved domain");
  });

  it("defines indexes for revision, relation, source and proposal access paths", () => {
    for (const indexName of [
      "kb_entity_revisions_status_idx",
      "kb_entity_names_lookup_idx",
      "kb_entity_identifiers_entity_idx",
      "kb_source_revisions_status_idx",
      "kb_assertions_status_idx",
      "kb_entity_relations_subject_idx",
      "kb_entity_relations_object_idx",
      "kb_assertion_sources_source_idx",
      "kb_article_revisions_status_idx",
      "kb_article_entities_entity_idx",
      "kb_change_proposals_queue_idx",
    ]) {
      expect(migration).toContain(`CREATE INDEX ${indexName}`);
    }
  });
});

describe("Wiki Phase 1 backup coverage", () => {
  it("keeps the frontend and Edge Function wiki lists identical and complete", () => {
    const frontendWikiBlock = requiredBlock(
      backupAreasSource,
      /id: "wiki"[\s\S]*?tables: \[([\s\S]*?)\],\s*buckets:/,
      "frontend wiki backup tables",
    );
    const edgeWikiBlock = requiredBlock(
      backupExportSource,
      /"wiki": \{[\s\S]*?tables: \[([\s\S]*?)\],\s*buckets:/,
      "Edge Function wiki backup tables",
    );
    const frontendTables = quotedValues(frontendWikiBlock, "double");
    const requiredKbBlock = requiredBlock(
      backupExportSource,
      /const REQUIRED_KB_TABLES = \[([\s\S]*?)\] as const;/,
      "required KB tables",
    );
    const requiredKbTables = quotedValues(requiredKbBlock, "double");
    const requiredImportBlock = requiredBlock(
      backupExportSource,
      /const REQUIRED_KB_IMPORT_TABLES = \[([\s\S]*?)\] as const;/,
      "required KB import tables",
    );
    const requiredImportTables = quotedValues(requiredImportBlock, "double");
    const edgeLiteralTables = quotedValues(edgeWikiBlock, "double");
    const edgeTables = [
      ...edgeLiteralTables.slice(0, 3),
      ...requiredKbTables,
      ...requiredImportTables,
      ...edgeLiteralTables.slice(3),
    ];

    expect(frontendTables).toEqual(wikiBackupTables);
    expect(requiredKbTables).toEqual(kbTables);
    expect(edgeWikiBlock).toContain("...REQUIRED_KB_TABLES");
    expect(edgeWikiBlock).toContain("...REQUIRED_KB_IMPORT_TABLES");
    for (const table of kbTables) {
      expect(backupExportSource.match(new RegExp(`"${table}"`, "g"))).toHaveLength(1);
    }
    expect(edgeTables).toEqual(wikiBackupTables);
    expect(edgeTables).toEqual(frontendTables);
    expect(new Set(frontendTables).size).toBe(frontendTables.length);
  });

  it("includes every new wiki table in the Edge Function fallback inventory", () => {
    const fallbackBlock = requiredBlock(
      backupExportSource,
      /const FALLBACK_TABLES = \[\.\.\.new Set\(\[([\s\S]*?)\]\)\]\.sort\(\);/,
      "Edge Function fallback tables",
    );
    const fallbackTables = quotedValues(fallbackBlock, "double");

    expect(fallbackBlock).toContain("...REQUIRED_KB_TABLES");
    expect(fallbackTables).toEqual(expect.arrayContaining([
      "mannayan_products",
      "knowledge_product_links",
    ]));
    expect(fallbackTables.some((table) => table.startsWith("kb_"))).toBe(false);
  });

  it("always merges required KB tables into successful OpenAPI discovery", () => {
    expect(backupExportSource).toContain("new Set([...filtered, ...REQUIRED_KB_TABLES, ...REQUIRED_KB_IMPORT_TABLES])");
    expect(backupExportSource).toContain('return { tables, source: "openapi" }');
  });

  it("fails subset and database exports when any table cannot be exported", () => {
    const subsetBlock = requiredBlock(
      backupExportSource,
      /if \(mode === "subset"\) \{([\s\S]*?)if \(mode !== "db"\)/,
      "subset export branch",
    );
    expect(subsetBlock).toContain("const tableErrors: Array<{ table: string; message: string }> = []");
    expect(subsetBlock).toContain("tableErrors.push({ table: t, message })");
    expect(subsetBlock).toContain('error: "subset_table_export_failed"');
    expect(subsetBlock).toMatch(/tableErrors\.length > 0[\s\S]*?status: 500/);

    const dbBlock = requiredBlock(
      backupExportSource,
      /\/\/ mode=db:([\s\S]*?)\}\s*catch \(err\)/,
      "database export branch",
    );
    expect(dbBlock).toContain("const tableErrors: Array<{ table: string; message: string }> = []");
    expect(dbBlock).toContain("tableErrors.push({ table, message: msg })");
    expect(dbBlock).toContain('error: "database_table_export_failed"');
    expect(dbBlock).toMatch(/tableErrors\.length > 0[\s\S]*?status: 500/);
    expect(dbBlock).not.toContain(".ERROR.txt");
  });
});
