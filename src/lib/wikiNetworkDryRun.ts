/**
 * DRY RUN only: derives reviewable proposals (actors + role relations) from stored data fields.
 * Never writes. Output is a downloadable JSON for Codex/Peter review (VERNETZUNG-PLAN.md, Phase 2).
 */
import { norm, isPharmacyName, type WikiModel } from "@/lib/wikiTaxonomy";

export type ProposedActorType = "organization" | "person" | "pharmacy";
export interface ProposedActor {
  proposal_key: string; display_name: string; normalized_match_key: string;
  proposed_entity_type_code: ProposedActorType; aliases: string[];
  existing_entity_id: string | null; evidence: Array<{ field: string; ref: string }>;
}
export interface ProposedRelation {
  subject: { kind: "entity" | "source_revision"; id: string; label: string };
  relation_type_code: "manufactured_by" | "published_by" | "authored_by";
  object_proposal_key: string; origin: "data_field"; field: string; review_status: "candidate";
}
export interface MergeHint { keys: string[]; reason: string }
export interface DryRun { generated_at: string; note: string; actors: ProposedActor[]; relations: ProposedRelation[]; merge_hints: MergeHint[]; counts: Record<string, number> }

const LEGAL = /\b(gmbh|co|kg|ag|ug|e k|ek|ltd|inc|llc|ohg|gbr|mbh)\b/g;
/** Matching key only: legal suffixes removed. Display name never changed. */
export const matchKey = (s: string) => norm(s).replace(LEGAL, " ").replace(/\s+/g, " ").trim();
/** Personen erkennen nur an Titeln/Initial-Muster – sonst Organisation (konservativ). */
export const looksLikePerson = (s: string) => /^(dr|prof|med)\b|\b[A-ZÄÖÜ]\.\s?[A-ZÄÖÜ][a-zäöüß]+$|^[A-ZÄÖÜ][a-zäöüß]+,\s?[A-ZÄÖÜ]\.?$/.test(s.trim());
const INTERNAL = /interne|praxis|recherche|strukturierung|importpr|quellen- und/i;

export function buildDryRun(m: WikiModel, now = new Date()): DryRun {
  const actors = new Map<string, ProposedActor>();
  const relations: ProposedRelation[] = [];
  const existingByKey = new Map<string, string>();
  for (const e of m.entities.values()) if (["manufacturer", "pharmacy", "publisher", "organization", "person"].includes(e.type)) existingByKey.set(matchKey(e.name), e.id);
  const actor = (name: string, type: ProposedActorType, field: string, ref: string) => {
    const display = name.trim(); const key = `${type}:${norm(display)}`;
    if (!actors.has(key)) actors.set(key, { proposal_key: key, display_name: display, normalized_match_key: matchKey(display), proposed_entity_type_code: type, aliases: [], existing_entity_id: existingByKey.get(matchKey(display)) ?? null, evidence: [] });
    const a = actors.get(key)!; if (a.evidence.length < 25) a.evidence.push({ field, ref }); return a;
  };
  for (const e of m.entities.values()) if (e.manufacturerField) {
    const a = actor(e.manufacturerField, isPharmacyName(e.manufacturerField) ? "pharmacy" : "organization", "entity.metadata.proposed_data.manufacturer", e.id);
    relations.push({ subject: { kind: "entity", id: e.id, label: e.name }, relation_type_code: "manufactured_by", object_proposal_key: a.proposal_key, origin: "data_field", field: "manufacturer", review_status: "candidate" });
  }
  for (const s of m.sources.values()) {
    if (s.publisher?.trim() && !INTERNAL.test(s.publisher)) {
      const t: ProposedActorType = isPharmacyName(s.publisher) ? "pharmacy" : looksLikePerson(s.publisher) ? "person" : "organization";
      const a = actor(s.publisher, t, "source_revision.publisher", s.id);
      relations.push({ subject: { kind: "source_revision", id: s.id, label: s.title ?? "" }, relation_type_code: "published_by", object_proposal_key: a.proposal_key, origin: "data_field", field: "publisher", review_status: "candidate" });
    }
    for (const au of s.authors ?? []) if (au?.trim() && !INTERNAL.test(au)) {
      const a = actor(au, "person", "source_revision.authors", s.id);
      relations.push({ subject: { kind: "source_revision", id: s.id, label: s.title ?? "" }, relation_type_code: "authored_by", object_proposal_key: a.proposal_key, origin: "data_field", field: "authors", review_status: "candidate" });
    }
  }
  // Known aliases (Peter / ORDNUNGSKONZEPT) – only attached if the actor exists in the data.
  const ALIASES: Array<[RegExp, string]> = [[/mannayan/i, "Mannayan"], [/schnell ?einfach ?gesund/i, "Einfach Schnell Gesund"], [/bio-?diagnostik/i, "Biodiagnostik"]];
  for (const a of actors.values()) for (const [re, al] of ALIASES) if (re.test(a.display_name) && a.display_name !== al) a.aliases.push(al);
  // Merge hints: same match key, different proposals (never auto-merged).
  const byMatch = new Map<string, string[]>();
  for (const a of actors.values()) byMatch.set(a.normalized_match_key, [...(byMatch.get(a.normalized_match_key) ?? []), a.proposal_key]);
  const merge_hints = [...byMatch.values()].filter((k) => k.length > 1).map((keys) => ({ keys, reason: "gleicher Abgleichsschlüssel – Zusammenführung nur nach Review" }));
  const list = [...actors.values()].sort((x, y) => x.display_name.localeCompare(y.display_name, "de"));
  return {
    generated_at: now.toISOString(),
    note: "PROBELAUF – nichts geschrieben. Alle Einträge sind Kandidaten (review_status=candidate) und benötigen Prüfung/Freigabe.",
    actors: list, relations, merge_hints,
    counts: { actors: list.length, organizations: list.filter((a) => a.proposed_entity_type_code === "organization").length, persons: list.filter((a) => a.proposed_entity_type_code === "person").length, pharmacies: list.filter((a) => a.proposed_entity_type_code === "pharmacy").length, relations: relations.length, already_existing: list.filter((a) => a.existing_entity_id).length, merge_hints: merge_hints.length },
  };
}
