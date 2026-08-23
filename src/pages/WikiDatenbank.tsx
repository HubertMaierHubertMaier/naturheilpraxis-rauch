import { useDeferredValue, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Bug, Database, ExternalLink, FileSearch, Link2, Search, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PathogenIndex } from "@/components/admin/PathogenIndex";
import { useToast } from "@/hooks/use-toast";
import {
  buildInternalKnowledgeIlikeFilter,
  compactInternalKnowledgeText,
  hasInternalKnowledgeData,
  internalKnowledgeSearchTerms,
  normalizeInternalKnowledgeSearchText,
} from "@/lib/internalKnowledgeSearch";

interface WikiEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  updated_at: string;
  entry_kind: string;
  review_status: string;
  evidence_level: string;
  dosage_status: string;
  rights_status: string;
  source_citations: unknown;
  therapeutic_topics: string[];
  contraindications: string[];
  interaction_tags: string[];
  safety_notes: string;
  patient_facing_allowed: boolean;
}

interface SourceCitation {
  label: string;
  url: string;
}

interface KnowledgeProductLink {
  id: string;
  knowledge_entry_id: string;
  relation_type: string;
  clinical_topics: string[];
  confidence: number;
  safety_notes: string;
  review_status: string;
  admin_knowledge_base: { title: string } | null;
  mannayan_products: { name: string } | null;
}

interface StructuredArticle {
  id: string;
  article_kind: string;
  current_revision_id: string | null;
  updated_at: string;
}

interface StructuredArticleRevision {
  id: string;
  title: string;
  category_path: string;
  tags: string[];
  content_markdown: string;
  review_status: string;
  metadata: unknown;
}

interface ImportBatch {
  id: string;
  source_label: string;
  batch_status: string;
  candidate_count: number;
  metadata: unknown;
  created_at: string;
}

interface ImportCandidate {
  id: string;
  batch_id: string;
  candidate_status: string;
  title?: string;
  display_name?: string;
  proposed_relation_type_code?: string;
  application_text?: string;
  action_text?: string;
  source_locator: string;
  ambiguity_notes: string;
}

interface ImportCandidateProposalLink {
  candidate_kind: string;
  candidate_id: string;
  proposal_id: string;
}

interface ImportCoreLink {
  candidate_kind: string;
  candidate_id: string;
  batch_id: string;
  core_record_kind: string;
}

interface ImportChangeProposal {
  id: string;
  proposal_kind: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string;
}

type CandidateKind = "Quelle" | "Entitaet" | "Beziehung" | "Dosis" | "Sicherheit";
type ReviewDecision = "accept_as_draft" | "needs_clarification" | "reject" | "mark_duplicate";
type ProposalReviewAction = "start_review" | "accept" | "reject";

interface DisplayCandidate extends ImportCandidate {
  kind: CandidateKind;
  label: string;
}

interface DetailedImportCandidate extends DisplayCandidate {
  confidence?: number;
  details: Array<{ label: string; value: string }>;
  excerpt?: string;
  proposedData?: unknown;
  sourceUrl?: string;
}

interface ReadOnlyResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

interface ReadOnlyQuery extends PromiseLike<ReadOnlyResult> {
  select(columns: string): ReadOnlyQuery;
  order(column: string, options: { ascending: boolean }): ReadOnlyQuery;
  or(filters: string): ReadOnlyQuery;
  in(column: string, values: string[]): ReadOnlyQuery;
  range(from: number, to: number): ReadOnlyQuery;
}

const importDb = supabase as unknown as { from(table: string): ReadOnlyQuery };
const searchableCandidateStatuses = ["imported_unreviewed", "needs_clarification", "accepted_as_draft"];
const terminalCandidateStatuses = ["accepted_as_draft", "rejected", "duplicate"];
const reviewStatusByDecision: Record<ReviewDecision, string> = {
  accept_as_draft: "accepted_as_draft",
  needs_clarification: "needs_clarification",
  reject: "rejected",
  mark_duplicate: "duplicate",
};
const reviewLabelByDecision: Record<ReviewDecision, string> = {
  accept_as_draft: "als internen Entwurf annehmen",
  needs_clarification: "Klaerung anfordern",
  reject: "ablehnen",
  mark_duplicate: "als Dublette markieren",
};
const rpcKindByCandidateKind: Record<CandidateKind, string> = {
  Quelle: "source",
  Entitaet: "entity",
  Beziehung: "relation",
  Dosis: "dosage",
  Sicherheit: "safety",
};
const proposalKindByCandidateKind: Record<CandidateKind, string> = {
  Quelle: "source",
  Entitaet: "entity",
  Beziehung: "entity_relation",
  Dosis: "assertion",
  Sicherheit: "assertion",
};
const IMPORT_SEARCH_PAGE_SIZE = 200;

function candidateReviewKey(candidate: DisplayCandidate): string {
  return `${candidate.kind}:${candidate.id}`;
}

function candidateProposalKey(candidate: DisplayCandidate): string {
  return `${rpcKindByCandidateKind[candidate.kind]}:${candidate.id}`;
}

function reviewErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function detailValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function safeExternalUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function details(values: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return values.flatMap(([label, value]) => {
    const formatted = detailValue(value);
    return formatted ? [{ label, value: formatted }] : [];
  });
}

async function searchAllImportRows(table: string, columns: string, filter: string): Promise<ReadOnlyResult> {
  const data: unknown[] = [];
  for (let from = 0; ; from += IMPORT_SEARCH_PAGE_SIZE) {
    const result = await importDb.from(table)
      .select(columns)
      .in("candidate_status", searchableCandidateStatuses)
      .or(filter)
      .order("id", { ascending: true })
      .range(from, from + IMPORT_SEARCH_PAGE_SIZE - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data || [];
    data.push(...page);
    if (page.length < IMPORT_SEARCH_PAGE_SIZE) return { data, error: null };
  }
}

async function searchImportCandidateDetails(value: string): Promise<DetailedImportCandidate[]> {
  if (internalKnowledgeSearchTerms(value).length === 0) return [];
  const sourceFilter = buildInternalKnowledgeIlikeFilter(["title", "publisher", "source_url", "external_identifier", "source_locator", "original_excerpt", "ambiguity_notes"], value);
  const entityFilter = buildInternalKnowledgeIlikeFilter(["display_name", "description_markdown", "proposed_canonical_key", "source_locator", "original_excerpt", "ambiguity_notes"], value);
  const relationFilter = buildInternalKnowledgeIlikeFilter(["candidate_key", "proposed_relation_type_code", "assignment_strength", "source_locator", "original_excerpt", "ambiguity_notes"], value);
  const dosageFilter = buildInternalKnowledgeIlikeFilter(["application_route", "dose_unit", "reference_period", "frequency_text", "duration_text", "timing_text", "application_text", "source_locator", "original_excerpt", "ambiguity_notes"], value);
  const safetyFilter = buildInternalKnowledgeIlikeFilter(["rule_type", "severity", "action_text", "source_locator", "original_excerpt", "ambiguity_notes"], value);
  const [sourceResult, entityResult, relationResult, dosageResult, safetyResult] = await Promise.all([
    searchAllImportRows("kb_source_candidates", "id, batch_id, candidate_status, proposed_source_type, title, publisher, publication_date, source_url, external_identifier, rights_status, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data", sourceFilter),
    searchAllImportRows("kb_entity_candidates", "id, batch_id, candidate_status, proposed_entity_type_code, proposed_canonical_key, display_name, aliases, description_markdown, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data", entityFilter),
    searchAllImportRows("kb_relation_candidates", "id, batch_id, candidate_status, candidate_key, proposed_relation_type_code, assignment_strength, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data", relationFilter),
    searchAllImportRows("kb_dosage_candidates", "id, batch_id, candidate_status, application_route, minimum_dose, maximum_dose, dose_unit, reference_period, frequency_text, duration_text, timing_text, application_text, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data", dosageFilter),
    searchAllImportRows("kb_safety_candidates", "id, batch_id, candidate_status, rule_type, severity, action_text, source_locator, original_excerpt, confidence, ambiguity_notes, proposed_data", safetyFilter),
  ]);

  const results = [sourceResult, entityResult, relationResult, dosageResult, safetyResult];
  const unexpectedError = results.find((result) => result.error && !/does not exist|schema cache|could not find/i.test(result.error.message));
  if (unexpectedError?.error) throw new Error(unexpectedError.error.message);
  const rows = (result: ReadOnlyResult) => (result.error ? [] : (result.data || [])) as Record<string, unknown>[];
  const common = (row: Record<string, unknown>) => ({
    id: String(row.id),
    batch_id: String(row.batch_id),
    candidate_status: String(row.candidate_status),
    source_locator: detailValue(row.source_locator),
    ambiguity_notes: detailValue(row.ambiguity_notes),
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    excerpt: compactInternalKnowledgeText(row.original_excerpt),
    proposedData: row.proposed_data,
  });

  return [
    ...rows(sourceResult).map((row) => ({
      ...common(row), kind: "Quelle" as const, label: detailValue(row.title) || "Quelle ohne Titel",
      sourceUrl: safeExternalUrl(detailValue(row.source_url)),
      details: details([["Quellenart", row.proposed_source_type], ["Herausgeber", row.publisher], ["Veroeffentlicht", row.publication_date], ["Kennung", row.external_identifier], ["Rechte", row.rights_status], ["Vertrauen", typeof row.confidence === "number" ? `${row.confidence}%` : ""]]),
    })),
    ...rows(entityResult).map((row) => ({
      ...common(row), kind: "Entitaet" as const, label: detailValue(row.display_name) || "Entitaet ohne Namen",
      details: details([["Entitaetsart", row.proposed_entity_type_code], ["Kanonischer Schluessel", row.proposed_canonical_key], ["Aliase", row.aliases], ["Beschreibung", row.description_markdown], ["Vertrauen", typeof row.confidence === "number" ? `${row.confidence}%` : ""]]),
    })),
    ...rows(relationResult).map((row) => ({
      ...common(row), kind: "Beziehung" as const, label: detailValue(row.proposed_relation_type_code) || "Beziehung pruefen",
      details: details([["Beziehungsart", row.proposed_relation_type_code], ["Zuordnungsstaerke", row.assignment_strength], ["Kandidatenschluessel", row.candidate_key], ["Vertrauen", typeof row.confidence === "number" ? `${row.confidence}%` : ""]]),
    })),
    ...rows(dosageResult).map((row) => ({
      ...common(row), kind: "Dosis" as const, label: detailValue(row.application_text) || "Dosierung pruefen",
      details: details([["Anwendungsweg", row.application_route], ["Mindestdosis", row.minimum_dose], ["Hoechstdosis", row.maximum_dose], ["Einheit", row.dose_unit], ["Bezugszeitraum", row.reference_period], ["Haeufigkeit", row.frequency_text], ["Dauer", row.duration_text], ["Zeitpunkt", row.timing_text], ["Vertrauen", typeof row.confidence === "number" ? `${row.confidence}%` : ""]]),
    })),
    ...rows(safetyResult).map((row) => ({
      ...common(row), kind: "Sicherheit" as const, label: detailValue(row.action_text) || "Sicherheit pruefen",
      details: details([["Regelart", row.rule_type], ["Schweregrad", row.severity], ["Vertrauen", typeof row.confidence === "number" ? `${row.confidence}%` : ""]]),
    })),
  ].sort((left, right) => `${left.kind} ${left.label}`.localeCompare(`${right.kind} ${right.label}`, "de"));
}

function normalize(value: string) {
  return normalizeInternalKnowledgeSearchText(value);
}

function formatDate(value: string) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "unbekannt";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

function sourceCitations(value: unknown): SourceCitation[] {
  const citations = new Map<string, SourceCitation>();
  const visited = new Set<object>();
  const text = (candidate: unknown) => typeof candidate === "string" ? candidate.trim() : "";

  const visit = (candidate: unknown, depth = 0): void => {
    if (!candidate || depth > 5) return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof candidate !== "object" || visited.has(candidate)) return;
    visited.add(candidate);

    const record = candidate as Record<string, unknown>;
    const rawUrl = [record.url, record.source_url, record.manufacturerSource]
      .map(text)
      .find(Boolean);
    const url = rawUrl ? safeExternalUrl(rawUrl) : "";
    if (url) {
      const label = [record.label, record.title, record.publisher].map(text).find(Boolean) || url;
      citations.set(url, { url, label });
    }

    [
      record.source_citations,
      record.proposed_data,
      record.source_document,
      record.source_inventory,
      record.product,
      record.legacy_record,
    ].forEach((nested) => visit(nested, depth + 1));
  };

  visit(value);
  return [...citations.values()];
}

const relationLabels: Record<string, string> = {
  exact_product: "Exaktes Produkt",
  ingredient_match: "Inhaltsstoff-Bezug",
  topic_match: "Gesundheitsthema",
  alternative: "Alternative",
  do_not_combine: "Nicht kombinieren",
};

export default function WikiDatenbank() {
  const { user, loading: authLoading, isAdmin, roleChecked } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [productLinks, setProductLinks] = useState<KnowledgeProductLink[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [importCandidates, setImportCandidates] = useState<DisplayCandidate[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [detailedImportResults, setDetailedImportResults] = useState<DetailedImportCandidate[]>([]);
  const [importSearchLoading, setImportSearchLoading] = useState(false);
  const [importSearchError, setImportSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [candidateProposalIds, setCandidateProposalIds] = useState<Record<string, string>>({});
  const [importChangeProposals, setImportChangeProposals] = useState<ImportChangeProposal[]>([]);
  const [importCoreLinks, setImportCoreLinks] = useState<ImportCoreLink[]>([]);
  const [proposalReviewNotes, setProposalReviewNotes] = useState<Record<string, string>>({});
  const [reviewingCandidateKey, setReviewingCandidateKey] = useState<string | null>(null);
  const [completingBatchId, setCompletingBatchId] = useState<string | null>(null);
  const [submittingProposalKey, setSubmittingProposalKey] = useState<string | null>(null);
  const [reviewingProposalId, setReviewingProposalId] = useState<string | null>(null);

  const handleReviewDecision = async (candidate: DisplayCandidate, decision: ReviewDecision) => {
    if (reviewingCandidateKey || completingBatchId || submittingProposalKey || reviewingProposalId) return;
    const key = candidateReviewKey(candidate);
    const note = (reviewNotes[key] || "").trim();
    if (!note) {
      toast({ title: "Pruefnotiz fehlt", description: "Jede fachliche Entscheidung braucht eine nachvollziehbare Notiz.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Kandidat „${candidate.label}“ wirklich ${reviewLabelByDecision[decision]}? Die Entscheidung wird unveraenderbar protokolliert.`)) return;

    setReviewingCandidateKey(key);
    try {
      const { error: reviewError } = await (supabase as any).rpc("kb_record_import_review_decision", {
        _candidate_kind: rpcKindByCandidateKind[candidate.kind],
        _candidate_id: candidate.id,
        _decision: decision,
        _decision_notes: note,
      });
      if (reviewError) throw reviewError;

      const candidateStatus = reviewStatusByDecision[decision];
      setImportCandidates((current) => current.map((item) => candidateReviewKey(item) === key ? { ...item, candidate_status: candidateStatus } : item));
      setDetailedImportResults((current) => current.map((item) => candidateReviewKey(item) === key ? { ...item, candidate_status: candidateStatus } : item));
      setReviewNotes((current) => ({ ...current, [key]: "" }));
      toast({
        title: "Entscheidung protokolliert",
        description: decision === "accept_as_draft"
          ? "Der Kandidat ist ein interner Entwurf. Er ist weder veroeffentlicht noch fuer Patienten freigegeben."
          : `Neuer interner Status: ${candidateStatus}.`,
      });
    } catch (reviewError) {
      toast({ title: "Entscheidung nicht gespeichert", description: reviewErrorMessage(reviewError, "Der geschuetzte Reviewweg hat die Aenderung abgelehnt."), variant: "destructive" });
    } finally {
      setReviewingCandidateKey(null);
    }
  };

  const handleCompleteBatchReview = async (batch: ImportBatch) => {
    if (reviewingCandidateKey || completingBatchId || submittingProposalKey || reviewingProposalId) return;
    if (!window.confirm(`Pruefung des Pakets „${batch.source_label}“ wirklich abschliessen? Danach ist das Reviewpaket unveraenderbar protokolliert.`)) return;
    setCompletingBatchId(batch.id);
    try {
      const { error: completeError } = await (supabase as any).rpc("kb_complete_import_batch_review", { _batch_id: batch.id });
      if (completeError) throw completeError;
      setImportBatches((current) => current.map((item) => item.id === batch.id ? { ...item, batch_status: "reviewed" } : item));
      toast({ title: "Paketpruefung abgeschlossen", description: "Angenommene Kandidaten bleiben interne Entwuerfe; es erfolgte keine Veroeffentlichung oder Patientenfreigabe." });
    } catch (completeError) {
      toast({ title: "Paket nicht abgeschlossen", description: reviewErrorMessage(completeError, "Nicht alle Kandidaten haben eine abschliessende Entscheidung."), variant: "destructive" });
    } finally {
      setCompletingBatchId(null);
    }
  };

  const handleSubmitCandidateProposal = async (candidate: DisplayCandidate) => {
    if (reviewingCandidateKey || completingBatchId || submittingProposalKey || reviewingProposalId) return;
    const batch = importBatches.find((item) => item.id === candidate.batch_id);
    if (candidate.candidate_status !== "accepted_as_draft" || batch?.batch_status !== "reviewed") {
      toast({ title: "Kernpruefung noch gesperrt", description: "Zuerst muessen der Kandidat angenommen und das gesamte Importpaket abgeschlossen sein.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Kandidat „${candidate.label}“ fuer die getrennte Kernpruefung einreichen? Es wird nur ein interner Vorschlag mit Status submitted erstellt.`)) return;

    const key = candidateProposalKey(candidate);
    setSubmittingProposalKey(key);
    try {
      const { data: proposalId, error: submitError } = await (supabase as any).rpc("kb_submit_import_candidate_proposal", {
        _candidate_kind: rpcKindByCandidateKind[candidate.kind],
        _candidate_id: candidate.id,
      });
      if (submitError) throw submitError;
      if (typeof proposalId !== "string" || !proposalId) throw new Error("Der Vorschlagsweg hat keine Kennung zurueckgegeben.");
      setCandidateProposalIds((current) => ({ ...current, [key]: proposalId }));
      setImportChangeProposals((current) => current.some((proposal) => proposal.id === proposalId) ? current : [{
        id: proposalId,
        proposal_kind: proposalKindByCandidateKind[candidate.kind],
        status: "submitted",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        review_notes: "",
      }, ...current]);
      toast({ title: "Kernpruefung vorgemerkt", description: "Der vollstaendige Kandidat liegt als interner submitted-Vorschlag vor. Es wurde nichts freigegeben oder veroeffentlicht." });
    } catch (submitError) {
      toast({ title: "Vorschlag nicht erstellt", description: reviewErrorMessage(submitError, "Der geschuetzte Vorschlagsweg hat die Einreichung abgelehnt."), variant: "destructive" });
    } finally {
      setSubmittingProposalKey(null);
    }
  };

  const handleProposalReview = async (proposal: ImportChangeProposal, action: ProposalReviewAction) => {
    if (reviewingCandidateKey || completingBatchId || submittingProposalKey || reviewingProposalId) return;
    const note = (proposalReviewNotes[proposal.id] || "").trim();
    if (action !== "start_review" && !note) {
      toast({ title: "Pruefnotiz fehlt", description: "Die abschliessende Vorschlagsentscheidung braucht eine fachliche Notiz.", variant: "destructive" });
      return;
    }
    const actionLabel = action === "start_review" ? "in die getrennte Pruefung nehmen" : action === "accept" ? "fuer eine spaetere Kernumsetzung annehmen" : "ablehnen";
    if (!window.confirm(`Vorschlag ${proposal.id} wirklich ${actionLabel}? Auch eine Annahme schreibt noch keine Kerndaten und gibt nichts frei.`)) return;

    setReviewingProposalId(proposal.id);
    try {
      const { error: proposalReviewError } = await (supabase as any).rpc("kb_review_import_candidate_proposal", {
        _proposal_id: proposal.id,
        _review_action: action,
        _review_notes: note,
      });
      if (proposalReviewError) throw proposalReviewError;
      const nextStatus = action === "start_review" ? "in_review" : action === "accept" ? "accepted" : "rejected";
      setImportChangeProposals((current) => current.map((item) => item.id === proposal.id ? {
        ...item,
        status: nextStatus,
        review_notes: action === "start_review" ? item.review_notes : note,
        reviewed_at: action === "start_review" ? item.reviewed_at : new Date().toISOString(),
      } : item));
      if (action !== "start_review") setProposalReviewNotes((current) => ({ ...current, [proposal.id]: "" }));
      toast({
        title: action === "start_review" ? "Getrennte Pruefung begonnen" : "Vorschlagsentscheidung protokolliert",
        description: action === "accept" ? "Der Vorschlag ist angenommen, aber weiterhin nicht in Kerndaten umgesetzt oder freigegeben." : `Neuer interner Vorschlagsstatus: ${nextStatus}.`,
      });
    } catch (proposalReviewError) {
      toast({ title: "Vorschlagspruefung nicht gespeichert", description: reviewErrorMessage(proposalReviewError, "Der geschuetzte Vorschlagsweg hat die Entscheidung abgelehnt."), variant: "destructive" });
    } finally {
      setReviewingProposalId(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const loadEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        const [articleResult, revisionResult, linkResult, batchResult, sourceResult, entityResult, relationResult, dosageResult, safetyResult, proposalLinkResult, changeProposalResult, coreLinkResult] = await Promise.all([
          supabase
            .from("kb_articles")
            .select("id, article_kind, current_revision_id, updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("kb_article_revisions")
            .select("id, title, category_path, tags, content_markdown, review_status, metadata"),
          supabase
            .from("knowledge_product_links")
            .select("id, knowledge_entry_id, relation_type, clinical_topics, confidence, safety_notes, review_status, admin_knowledge_base(title), mannayan_products(name)")
            .order("updated_at", { ascending: false }),
          importDb
            .from("kb_import_batches")
            .select("id, source_label, batch_status, candidate_count, metadata, created_at")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_source_candidates")
            .select("id, batch_id, candidate_status, title, source_locator, ambiguity_notes")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_entity_candidates")
            .select("id, batch_id, candidate_status, display_name, source_locator, ambiguity_notes")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_relation_candidates")
            .select("id, batch_id, candidate_status, proposed_relation_type_code, source_locator, ambiguity_notes")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_dosage_candidates")
            .select("id, batch_id, candidate_status, application_text, source_locator, ambiguity_notes")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_safety_candidates")
            .select("id, batch_id, candidate_status, action_text, source_locator, ambiguity_notes")
            .order("created_at", { ascending: false }),
          importDb
            .from("kb_import_candidate_proposals")
            .select("candidate_kind, candidate_id, proposal_id"),
          importDb
            .from("kb_change_proposals")
            .select("id, proposal_kind, status, submitted_at, reviewed_at, review_notes")
            .order("submitted_at", { ascending: false }),
          importDb
            .from("kb_import_core_links")
            .select("candidate_kind, candidate_id, batch_id, core_record_kind"),
        ]);
        if (articleResult.error) throw articleResult.error;
        if (revisionResult.error) throw revisionResult.error;
        if (linkResult.error) throw linkResult.error;
        if (active) {
          const revisions = new Map(
            ((revisionResult.data as StructuredArticleRevision[]) || []).map((revision) => [revision.id, revision]),
          );
          setEntries(((articleResult.data as StructuredArticle[]) || []).flatMap((article) => {
            const revision = article.current_revision_id ? revisions.get(article.current_revision_id) : undefined;
            if (!revision) return [];
            const metadata = revision.metadata && typeof revision.metadata === "object"
              ? revision.metadata as Record<string, unknown>
              : {};
            const legacy = metadata.legacy_record && typeof metadata.legacy_record === "object"
              ? metadata.legacy_record as Record<string, unknown>
              : {};
            const field = (key: string) => legacy[key] ?? metadata[key];
            const strings = (key: string) => Array.isArray(field(key))
              ? (field(key) as unknown[]).filter((value): value is string => typeof value === "string")
              : [];
            return [{
              id: article.id,
              title: revision.title,
              category: revision.category_path,
              tags: revision.tags || [],
              content: revision.content_markdown,
              updated_at: article.updated_at,
              entry_kind: article.article_kind,
              review_status: revision.review_status,
               evidence_level: typeof field("evidence_level") === "string" ? field("evidence_level") as string : "unbewertet",
               dosage_status: typeof field("dosage_status") === "string" ? field("dosage_status") as string : "unverifiziert",
               rights_status: typeof field("rights_status") === "string" ? field("rights_status") as string : "unbekannt",
              source_citations: revision.metadata,
              therapeutic_topics: strings("therapeutic_topics"),
              contraindications: strings("contraindications"),
              interaction_tags: strings("interaction_tags"),
               safety_notes: typeof field("safety_notes") === "string" ? field("safety_notes") as string : "",
              patient_facing_allowed: false,
            }];
          }));
          setProductLinks((linkResult.data as unknown as KnowledgeProductLink[]) || []);
          const importResults = [batchResult, sourceResult, entityResult, relationResult, dosageResult, safetyResult];
          const importSchemaMissing = importResults.some((result) => result.error && /does not exist|schema cache|could not find/i.test(result.error.message));
          const importUnexpectedError = importResults.find((result) => result.error && !/does not exist|schema cache|could not find/i.test(result.error.message));
          if (importUnexpectedError?.error) throw importUnexpectedError.error;
          if (proposalLinkResult.error && !/does not exist|schema cache|could not find/i.test(proposalLinkResult.error.message)) throw proposalLinkResult.error;
          if (changeProposalResult.error && !/does not exist|schema cache|could not find/i.test(changeProposalResult.error.message)) throw changeProposalResult.error;
          if (coreLinkResult.error && !/does not exist|schema cache|could not find/i.test(coreLinkResult.error.message)) throw coreLinkResult.error;
          setImportBatches(importSchemaMissing ? [] : ((batchResult.data as ImportBatch[]) || []));
          const displayCandidates = [
            ...((sourceResult.data as ImportCandidate[]) || []).map((candidate) => ({ ...candidate, kind: "Quelle" as const, label: candidate.title || "Quelle ohne Titel" })),
            ...((entityResult.data as ImportCandidate[]) || []).map((candidate) => ({ ...candidate, kind: "Entitaet" as const, label: candidate.display_name || "Entitaet ohne Namen" })),
            ...((relationResult.data as ImportCandidate[]) || []).map((candidate) => ({ ...candidate, kind: "Beziehung" as const, label: candidate.proposed_relation_type_code || "Beziehung pruefen" })),
            ...((dosageResult.data as ImportCandidate[]) || []).map((candidate) => ({ ...candidate, kind: "Dosis" as const, label: candidate.application_text || "Dosierung pruefen" })),
            ...((safetyResult.data as ImportCandidate[]) || []).map((candidate) => ({ ...candidate, kind: "Sicherheit" as const, label: candidate.action_text || "Sicherheit pruefen" })),
          ];
          setImportCandidates(importSchemaMissing ? [] : displayCandidates);
          const proposalLinks = proposalLinkResult.error ? [] : ((proposalLinkResult.data as ImportCandidateProposalLink[]) || []);
          setCandidateProposalIds(Object.fromEntries(proposalLinks.map((link) => [`${link.candidate_kind}:${link.candidate_id}`, link.proposal_id])));
          const linkedProposalIds = new Set(proposalLinks.map((link) => link.proposal_id));
          const changeProposals = changeProposalResult.error ? [] : ((changeProposalResult.data as ImportChangeProposal[]) || []);
          setImportChangeProposals(changeProposals.filter((proposal) => linkedProposalIds.has(proposal.id)));
          setImportCoreLinks(coreLinkResult.error ? [] : ((coreLinkResult.data as ImportCoreLink[]) || []));
        }
      } catch (loadError) {
        if (active) {
          setEntries([]);
          setImportBatches([]);
          setImportCandidates([]);
          setCandidateProposalIds({});
          setImportChangeProposals([]);
          setImportCoreLinks([]);
          setError(loadError instanceof Error ? loadError.message : "Die WikiDatenbank ist noch nicht verbunden.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadEntries();
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || internalKnowledgeSearchTerms(deferredSearch).length === 0) {
      setDetailedImportResults([]);
      setImportSearchLoading(false);
      setImportSearchError(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setImportSearchLoading(true);
      setImportSearchError(null);
      searchImportCandidateDetails(deferredSearch)
        .then((results) => {
          if (active) setDetailedImportResults(results);
        })
        .catch((searchError) => {
          if (!active) return;
          setDetailedImportResults([]);
          setImportSearchError(searchError instanceof Error ? searchError.message : "Die Pruefkandidaten konnten nicht durchsucht werden.");
        })
        .finally(() => {
          if (active) setImportSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [deferredSearch, isAdmin]);

  if (authLoading || (user && !roleChecked)) {
    return (
      <Layout>
        <div className="container py-12">
          <Skeleton className="mb-6 h-12 w-72" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user && !isAdmin) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const queryTerms = internalKnowledgeSearchTerms(deferredSearch).map(normalize);
  const hasQuery = queryTerms.length > 0;
  const filteredEntries = entries.filter((entry) => {
    if (queryTerms.length === 0) return true;
    const haystack = normalize([
      entry.title,
      entry.category,
      entry.content,
      ...(entry.tags || []),
      ...(entry.therapeutic_topics || []),
      ...(entry.contraindications || []),
      ...(entry.interaction_tags || []),
      entry.safety_notes,
      JSON.stringify(entry.source_citations || {}),
    ].join(" "));
    return queryTerms.every((term) => haystack.includes(term));
  });
  const filteredProductLinks = productLinks.filter((link) => {
    if (queryTerms.length === 0) return false;
    const haystack = normalize([
      link.admin_knowledge_base?.title,
      link.mannayan_products?.name,
      link.relation_type,
      ...(link.clinical_topics || []),
      link.safety_notes,
    ].filter(Boolean).join(" "));
    return queryTerms.every((term) => haystack.includes(term));
  });

  const sourceCount = entries.reduce((count, entry) => count + sourceCitations(entry.source_citations).length, 0);
  const importCoreLinkByCandidate = new Map(importCoreLinks.map((link) => [`${link.candidate_kind}:${link.candidate_id}`, link]));
  const metrics = [
    { value: loading ? "..." : String(entries.length), label: "Wiki-Eintraege" },
    { value: loading ? "..." : String(productLinks.length), label: "Mittelverknuepfungen" },
    { value: loading ? "..." : String(sourceCount), label: "Quellenbelege" },
    { value: loading ? "..." : String(importCoreLinks.length), label: "Im internen Quellenkern" },
    { value: loading ? "..." : String(importCandidates.length), label: "Import-Pruefdatensaetze" },
  ];

  return (
    <Layout>
      <main className="container max-w-6xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/wissensdatenbank" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Alte Wiki unverändert öffnen
          </Link>
          <Badge variant="outline" className="gap-2 border-emerald-300 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Neue WikiDatenbank / Read-only
          </Badge>
        </div>

        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-sage-50 via-background to-background p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Parallel zur bisherigen Wiki</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold text-foreground md:text-4xl">WikiDatenbank</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Die neue Datenbankansicht wird getrennt von der alten Wiki betrieben. Sie ist zunächst bewusst schreibgeschützt: Einträge, Prüfstatus und Quellenkontext können geprüft werden, ohne bestehende Wiki-Inhalte zu verändern.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Technischer Status">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-5">
                <div className="text-2xl font-bold text-primary">{metric.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{metric.label}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="entries" className="mt-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="entries" className="gap-2"><BookOpen className="h-4 w-4" /> Alle Wiki-Eintraege</TabsTrigger>
            <TabsTrigger value="pathogens" className="gap-2"><Bug className="h-4 w-4" /> Pathogene</TabsTrigger>
            <TabsTrigger value="links" className="gap-2"><Link2 className="h-4 w-4" /> Mittelverknuepfungen</TabsTrigger>
            <TabsTrigger value="imports" className="gap-2"><FileSearch className="h-4 w-4" /> Importpruefung</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Vollstaendigen Wiki-Bestand durchsuchen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Einzelbegriff oder kombiniert, z. B. Klinghardt, Covid oder Buhner, Banderol ..."
                    className="pl-9"
                    aria-label="WikiDatenbank durchsuchen"
                  />
                </div>
                {queryTerms.length > 1 && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Kombinierte UND-Suche:</span>
                      {queryTerms.map((term) => <Badge key={term} variant="outline">{term}</Badge>)}
                    </div>
                    <p className="mt-2 text-emerald-900/80">Es erscheinen nur Ergebnisse, in denen alle Suchbegriffe gemeinsam vorkommen.</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{loading ? "Eintraege werden gelesen ..." : hasQuery ? `${filteredEntries.length} Wiki-Treffer, ${detailedImportResults.length} Treffer im geschuetzten Pruefbereich` : `${entries.length} Wiki-Eintraege und ${importCandidates.length} Importkandidaten durchsuchbar`}</span>
                  <span>Keine Schreib-, Loesch- oder Freigabeaktionen in dieser Ansicht</span>
                </div>
              </CardContent>
            </Card>

            {hasQuery && (
              <Card className="border-blue-300 bg-blue-50/50">
                <CardContent className="p-5 text-sm text-blue-950">
                  <p className="font-semibold">Gesamtsuche nach „{deferredSearch}“</p>
                  <p className="mt-1 text-blue-900/80">
                    Die Suche verbindet den strukturierten Wiki-Bestand, gepruefte Produktverknuepfungen und den geschuetzten Import-Pruefbereich. {queryTerms.length > 1 ? "Bei der kombinierten Suche muessen alle Begriffe gemeinsam im Ergebnis vorkommen. " : ""}Ungepruefte Angaben bleiben deutlich gekennzeichnet und werden nicht automatisch freigegeben.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">Wiki: {filteredEntries.length}</Badge>
                    <Badge variant="outline">Produktbezuege: {filteredProductLinks.length}</Badge>
                    <Badge variant="outline">Pruefkandidaten: {importSearchLoading ? "..." : detailedImportResults.length}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-amber-300 bg-amber-50/60">
                <CardContent className="p-5 text-sm text-amber-900">
                  Die neue Ansicht ist technisch bereit, aber die autorisierte Datenbankverbindung ist noch nicht aktiv: {error}
                </CardContent>
              </Card>
            )}

            <section className="space-y-4" aria-live="polite">
              {hasQuery && <h2 className="text-xl font-semibold text-foreground">Strukturierter Wiki-Bestand</h2>}
              {!loading && !error && filteredEntries.length === 0 && (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Keine strukturierten Wiki-Eintraege fuer diese Suche vorhanden.</CardContent></Card>
              )}
              {filteredEntries.map((entry) => {
                const sources = sourceCitations(entry.source_citations);
                return (
                  <Card key={entry.id}>
                    <CardContent className="p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{entry.category || "Allgemein"}</p>
                          <h2 className="mt-1 text-xl font-semibold text-foreground">{entry.title}</h2>
                        </div>
                        <Badge variant="secondary">Aktualisiert {formatDate(entry.updated_at)}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline">Art: {entry.entry_kind || "unbekannt"}</Badge>
                        <Badge variant="outline">Pruefung: {entry.review_status || "unbekannt"}</Badge>
                        <Badge variant="outline">Evidenz: {entry.evidence_level || "unbewertet"}</Badge>
                        <Badge variant="outline">Dosis: {entry.dosage_status || "unbekannt"}</Badge>
                        <Badge variant="outline">Rechte: {entry.rights_status || "unbekannt"}</Badge>
                        {entry.patient_facing_allowed === false && <Badge variant="outline">Nicht patientengerichtet</Badge>}
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry.content}</p>
                      {(entry.tags || []).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
                      {(entry.therapeutic_topics || []).length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Themen</p><div className="mt-2 flex flex-wrap gap-2">{entry.therapeutic_topics.map((topic) => <Badge key={topic} variant="outline">{topic}</Badge>)}</div></div>}
                      {sources.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quellen</p><div className="mt-2 flex flex-wrap gap-3 text-sm">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{source.label}<ExternalLink className="h-3.5 w-3.5" /></a>)}</div></div>}
                      {(entry.contraindications || []).length > 0 && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900"><strong>Gegenanzeigen:</strong> {entry.contraindications.join(", ")}</div>}
                      {(entry.interaction_tags || []).length > 0 && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900"><strong>Interaktionen:</strong> {entry.interaction_tags.join(", ")}</div>}
                      {entry.safety_notes && <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground"><strong>Sicherheitsnotiz:</strong> {entry.safety_notes}</div>}
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {hasQuery && filteredProductLinks.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground">Verknuepfte Produkte und Themen</h2>
                {filteredProductLinks.map((link) => (
                  <Card key={`search-link-${link.id}`}>
                    <CardContent className="p-5">
                      <p className="font-medium text-foreground">{link.admin_knowledge_base?.title || "Wiki-Eintrag fehlt"} <span className="text-muted-foreground">→</span> {link.mannayan_products?.name || "Mittel fehlt"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{relationLabels[link.relation_type] || link.relation_type}</Badge>
                        <Badge variant="outline">Pruefung: {link.review_status}</Badge>
                        <Badge variant="outline">Vertrauen: {link.confidence}%</Badge>
                      </div>
                      {link.clinical_topics.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Themen: {link.clinical_topics.join(", ")}</p>}
                      {link.safety_notes && <p className="mt-3 text-sm text-amber-800">Sicherheitsnotiz: {link.safety_notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {hasQuery && (
              <section className="space-y-3" aria-live="polite">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Geschuetzter Import-Pruefbereich</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Hier erscheinen auch noch ungepruefte Quellen-, Entitaets-, Beziehungs-, Dosis- und Sicherheitsangaben. Sie sind internes Wissen, aber keine automatische Therapie- oder Patientenfreigabe.</p>
                </div>
                {importSearchLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Pruefkandidaten werden strukturiert durchsucht ...</CardContent></Card>}
                {importSearchError && <Card className="border-amber-300 bg-amber-50/60"><CardContent className="p-5 text-sm text-amber-900">Pruefbereich konnte nicht durchsucht werden: {importSearchError}</CardContent></Card>}
                {!importSearchLoading && !importSearchError && detailedImportResults.length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine ungeprueften Importdaten fuer diese Suche gefunden.</CardContent></Card>}
                {detailedImportResults.map((candidate) => (
                  <ImportCandidateSearchCard
                    key={`${candidate.kind}-${candidate.id}`}
                    candidate={candidate}
                    note={reviewNotes[candidateReviewKey(candidate)] || ""}
                    busy={reviewingCandidateKey !== null || completingBatchId !== null || submittingProposalKey !== null || reviewingProposalId !== null}
                    batchReviewed={importBatches.some((batch) => batch.id === candidate.batch_id && batch.batch_status === "reviewed")}
                    proposalId={candidateProposalIds[candidateProposalKey(candidate)]}
                    submittingProposal={submittingProposalKey === candidateProposalKey(candidate)}
                    onNoteChange={(note) => setReviewNotes((current) => ({ ...current, [candidateReviewKey(candidate)]: note }))}
                    onDecision={(decision) => handleReviewDecision(candidate, decision)}
                    onSubmitProposal={() => handleSubmitCandidateProposal(candidate)}
                  />
                ))}
              </section>
            )}
          </TabsContent>

          <TabsContent value="pathogens" className="mt-6">
            <PathogenIndex entries={entries} loading={loading} />
          </TabsContent>

          <TabsContent value="links" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-primary" /> Bestehende Wiki-Mittelverknuepfungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!loading && productLinks.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Keine Mittelverknuepfungen vorhanden.</p>}
                {productLinks.map((link) => (
                  <div key={link.id} className="rounded-lg border p-4">
                    <p className="font-medium text-foreground">{link.admin_knowledge_base?.title || "Wiki-Eintrag fehlt"} <span className="text-muted-foreground">→</span> {link.mannayan_products?.name || "Mittel fehlt"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{relationLabels[link.relation_type] || link.relation_type}</Badge>
                      <Badge variant="outline">Pruefung: {link.review_status}</Badge>
                      <Badge variant="outline">Vertrauen: {link.confidence}%</Badge>
                    </div>
                    {link.clinical_topics.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Themen: {link.clinical_topics.join(", ")}</p>}
                    {link.safety_notes && <p className="mt-3 text-sm text-amber-800">Sicherheitsnotiz: {link.safety_notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports" className="mt-6 space-y-6">
            <Card className="border-amber-300 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><FileSearch className="h-5 w-5 text-amber-700" /> Unveroeffentlichte Importpruefung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Interner Quellenkern:</strong> {importCoreLinks.length} von {importCandidates.length} Datensaetzen sind quellengetreu als interne Entwuerfe im Kernbestand verknuepft. Sie bleiben nur fuer Admins sichtbar.</p>
                <p>Die folgende Pruefung bewertet Struktur, Evidenz, Dosierung und Sicherheit. Jede Entscheidung verlangt eine Pruefnotiz und wird ueber den geschuetzten Admin-Reviewweg dauerhaft protokolliert.</p>
                <p><strong>Reihenfolge:</strong> zuerst Quellen, dann Entitaeten, danach Beziehungen, Dosierungen und Sicherheit. „Interner Entwurf“ ist keine fachliche Freigabe, Veroeffentlichung oder Patientenfreigabe.</p>
              </CardContent>
            </Card>

            <section className="grid gap-4 md:grid-cols-2">
              {importBatches.map((batch) => {
                const metadata = batch.metadata && typeof batch.metadata === "object" ? batch.metadata as Record<string, unknown> : {};
                const batchCandidates = importCandidates.filter((candidate) => candidate.batch_id === batch.id);
                const decidedCandidates = batchCandidates.filter((candidate) => terminalCandidateStatuses.includes(candidate.candidate_status)).length;
                const coreLinkedCandidates = importCoreLinks.filter((link) => link.batch_id === batch.id).length;
                const allCandidatesLoaded = batchCandidates.length === batch.candidate_count;
                const canCompleteReview = batch.batch_status === "ready_for_review" && allCandidatesLoaded && decidedCandidates === batch.candidate_count && batch.candidate_count > 0;
                return (
                  <Card key={batch.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="font-semibold text-foreground">{batch.source_label}</h2>
                        <Badge variant="outline">{batch.batch_status}</Badge>
                      </div>
                      <p className="mt-3 text-2xl font-bold text-primary">{batch.candidate_count}</p>
                      <p className="text-sm text-muted-foreground">Kandidaten, erstellt {formatDate(batch.created_at)}</p>
                      <p className="mt-2 text-sm text-muted-foreground">Abschliessend entschieden: {decidedCandidates}/{batch.candidate_count}</p>
                      <p className="mt-2 text-sm text-muted-foreground">Im internen Quellenkern: {coreLinkedCandidates}/{batch.candidate_count}</p>
                      {typeof metadata.source_family === "string" && <p className="mt-3 text-sm text-muted-foreground">Bestand: {metadata.source_family}</p>}
                      {batch.batch_status === "ready_for_review" && (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-4"
                          disabled={!canCompleteReview || reviewingCandidateKey !== null || completingBatchId !== null || submittingProposalKey !== null || reviewingProposalId !== null}
                          onClick={() => handleCompleteBatchReview(batch)}
                          title={!allCandidatesLoaded ? "Noch nicht alle Kandidaten sind in der Ansicht geladen" : !canCompleteReview ? "Jeder Kandidat braucht zuerst eine abschliessende Entscheidung" : "Reviewpaket abschliessen"}
                        >
                          {completingBatchId === batch.id ? "Wird abgeschlossen ..." : "Paketpruefung abschliessen"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Getrennte fachliche Strukturpruefung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Diese Vorschlaege dienen der spaeteren fachlich strukturierten Zuordnung. Der quellengetreue interne Entwurf bleibt bereits erhalten; selbst der Status accepted ist noch keine fachliche Freigabe, Veroeffentlichung oder Patientenfreigabe.</p>
                {!loading && importChangeProposals.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Noch kein Kandidat wurde fuer die getrennte fachliche Strukturpruefung eingereicht.</p>}
                {importChangeProposals.map((proposal) => {
                  const candidate = importCandidates.find((item) => candidateProposalIds[candidateProposalKey(item)] === proposal.id);
                  const note = proposalReviewNotes[proposal.id] || "";
                  const operationBusy = reviewingCandidateKey !== null || completingBatchId !== null || submittingProposalKey !== null || reviewingProposalId !== null;
                  return (
                    <div key={proposal.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{candidate?.label || "Importvorschlag"}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">Vorschlag: {proposal.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{proposal.proposal_kind}</Badge><Badge variant="outline">{proposal.status}</Badge></div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Eingereicht {formatDate(proposal.submitted_at)}</p>
                      {proposal.status === "submitted" && <Button type="button" size="sm" variant="outline" className="mt-3" disabled={operationBusy} onClick={() => handleProposalReview(proposal, "start_review")}>{reviewingProposalId === proposal.id ? "Wird begonnen ..." : "Getrennte Pruefung beginnen"}</Button>}
                      {proposal.status === "in_review" && (
                        <div className="mt-3 space-y-3 rounded-lg border border-amber-300/70 bg-amber-50/50 p-3 dark:bg-amber-950/10">
                          <label className="text-xs font-semibold text-foreground" htmlFor={`proposal-review-note-${proposal.id}`}>Pflichtnotiz zu Evidenz, Sicherheit, Quellenbezug und Entscheidung</label>
                          <Textarea id={`proposal-review-note-${proposal.id}`} value={note} onChange={(event) => setProposalReviewNotes((current) => ({ ...current, [proposal.id]: event.target.value }))} disabled={operationBusy} className="min-h-20 bg-background" placeholder="Getrennte fachliche Bewertung und noch offene Unsicherheiten dokumentieren ..." />
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" disabled={operationBusy || !note.trim()} onClick={() => handleProposalReview(proposal, "accept")}>Fuer spaetere Kernumsetzung annehmen</Button>
                            <Button type="button" size="sm" variant="destructive" disabled={operationBusy || !note.trim()} onClick={() => handleProposalReview(proposal, "reject")}>Vorschlag ablehnen</Button>
                          </div>
                        </div>
                      )}
                      {(proposal.status === "accepted" || proposal.status === "rejected") && <p className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground"><strong>Abschliessende Vorschlagsentscheidung:</strong> {proposal.status}. {proposal.review_notes || "Keine Notiz geladen."} Keine automatische Kernumsetzung oder Freigabe.</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quellen-, Entitaets-, Beziehungs-, Dosis- und Sicherheitskandidaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!loading && importCandidates.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Importkandidaten vorhanden.</p>}
                {importCandidates.map((candidate) => (
                  <div key={`${candidate.kind}-${candidate.id}`} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{candidate.label}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{candidate.kind}</Badge>
                        <Badge variant="outline">{candidate.candidate_status}</Badge>
                        {importCoreLinkByCandidate.has(candidateProposalKey(candidate)) && <Badge variant="outline">Interner Quellenkern</Badge>}
                      </div>
                    </div>
                    {candidate.source_locator && <p className="mt-2 break-all text-xs text-muted-foreground">Fundstelle: {candidate.source_locator}</p>}
                    {candidate.ambiguity_notes && <p className="mt-2 text-sm text-muted-foreground">{candidate.ambiguity_notes}</p>}
                    <ImportCandidateReviewControls
                      candidate={candidate}
                      note={reviewNotes[candidateReviewKey(candidate)] || ""}
                      busy={reviewingCandidateKey !== null || completingBatchId !== null || submittingProposalKey !== null || reviewingProposalId !== null}
                      batchReviewed={importBatches.some((batch) => batch.id === candidate.batch_id && batch.batch_status === "reviewed")}
                      proposalId={candidateProposalIds[candidateProposalKey(candidate)]}
                      submittingProposal={submittingProposalKey === candidateProposalKey(candidate)}
                      onNoteChange={(note) => setReviewNotes((current) => ({ ...current, [candidateReviewKey(candidate)]: note }))}
                      onDecision={(decision) => handleReviewDecision(candidate, decision)}
                      onSubmitProposal={() => handleSubmitCandidateProposal(candidate)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Keine automatische Veroeffentlichung oder Patientenfreigabe</span>
          <Link to="/wissensdatenbank" className="inline-flex items-center gap-1 hover:text-primary">Alte Wiki <ExternalLink className="h-3.5 w-3.5" /></Link>
        </footer>
      </main>
    </Layout>
  );
}

function ImportCandidateSearchCard({
  candidate,
  note,
  busy,
  batchReviewed,
  proposalId,
  submittingProposal,
  onNoteChange,
  onDecision,
  onSubmitProposal,
}: {
  candidate: DetailedImportCandidate;
  note: string;
  busy: boolean;
  batchReviewed: boolean;
  proposalId?: string;
  submittingProposal: boolean;
  onNoteChange: (note: string) => void;
  onDecision: (decision: ReviewDecision) => void;
  onSubmitProposal: () => void;
}) {
  return (
    <Card className="border-amber-200">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{candidate.kind}</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{candidate.label}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{candidate.candidate_status}</Badge>
            <Badge variant="outline">{candidate.candidate_status === "accepted_as_draft" ? "Nur intern / Entwurf" : "Nur intern / ungeprueft"}</Badge>
          </div>
        </div>

        {candidate.details.length > 0 && (
          <dl className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
            {candidate.details.map((detail) => (
              <div key={`${candidate.id}-${detail.label}`}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{detail.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {candidate.excerpt && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quellenauszug</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{candidate.excerpt}</p>
          </div>
        )}

        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {candidate.sourceUrl && <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Originalquelle oeffnen <ExternalLink className="h-3.5 w-3.5" /></a>}
          {candidate.source_locator && <p className="break-all"><strong>Fundstelle:</strong> {candidate.source_locator}</p>}
          {candidate.ambiguity_notes && <p><strong>Offene Pruefung:</strong> {candidate.ambiguity_notes}</p>}
        </div>

        {hasInternalKnowledgeData(candidate.proposedData) && (
          <details className="mt-4 rounded-lg border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Alle strukturierten Originalfelder anzeigen</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(candidate.proposedData, null, 2)}</pre>
          </details>
        )}

        <ImportCandidateReviewControls candidate={candidate} note={note} busy={busy} batchReviewed={batchReviewed} proposalId={proposalId} submittingProposal={submittingProposal} onNoteChange={onNoteChange} onDecision={onDecision} onSubmitProposal={onSubmitProposal} />
      </CardContent>
    </Card>
  );
}

function ImportCandidateReviewControls({
  candidate,
  note,
  busy,
  batchReviewed,
  proposalId,
  submittingProposal,
  onNoteChange,
  onDecision,
  onSubmitProposal,
}: {
  candidate: DisplayCandidate;
  note: string;
  busy: boolean;
  batchReviewed: boolean;
  proposalId?: string;
  submittingProposal: boolean;
  onNoteChange: (note: string) => void;
  onDecision: (decision: ReviewDecision) => void;
  onSubmitProposal: () => void;
}) {
  const reviewable = candidate.candidate_status === "imported_unreviewed" || candidate.candidate_status === "needs_clarification";
  if (!reviewable) {
    const accepted = candidate.candidate_status === "accepted_as_draft";
    return (
      <div className="mt-4 space-y-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p>Entscheidung protokolliert: <strong>{candidate.candidate_status}</strong>. Ein angenommener Kandidat bleibt ein interner Entwurf.</p>
        {accepted && proposalId && <p className="break-all text-foreground"><strong>Getrennte fachliche Strukturpruefung vorgemerkt:</strong> {proposalId}</p>}
        {accepted && !proposalId && (
          <div className="space-y-2">
            <Button type="button" size="sm" variant="outline" disabled={busy || !batchReviewed} onClick={onSubmitProposal}>
              {submittingProposal ? "Wird vorgemerkt ..." : "Zur fachlichen Strukturpruefung einreichen"}
            </Button>
            <p>{batchReviewed ? "Dies erstellt nur einen submitted-Vorschlag; Kerndaten, Freigaben und Patientensicht bleiben unveraendert." : "Die Einreichung wird erst nach Abschluss des gesamten Importpakets freigeschaltet."}</p>
          </div>
        )}
      </div>
    );
  }

  const disabled = busy || !note.trim();
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-amber-300/70 bg-amber-50/50 p-3 dark:bg-amber-950/10">
      <div>
        <label className="text-xs font-semibold text-foreground" htmlFor={`review-note-${candidate.kind}-${candidate.id}`}>Pflichtnotiz zur fachlichen Entscheidung</label>
        <Textarea
          id={`review-note-${candidate.kind}-${candidate.id}`}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Quelle, fachliche Begruendung, offene Unsicherheit oder Dublettenbezug dokumentieren ..."
          className="mt-2 min-h-20 bg-background"
          disabled={busy}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={() => onDecision("accept_as_draft")}>Als internen Entwurf annehmen</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onDecision("needs_clarification")}>Klaerung erforderlich</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onDecision("mark_duplicate")}>Dublette</Button>
        <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={() => onDecision("reject")}>Ablehnen</Button>
      </div>
      <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">Die serverseitige Pruefung erzwingt Admin-Rolle und Abhaengigkeiten. Der Quellenstand bleibt intern erhalten; Annahme bedeutet niemals automatische fachliche Freigabe oder Patientenfreigabe.</p>
    </div>
  );
}
