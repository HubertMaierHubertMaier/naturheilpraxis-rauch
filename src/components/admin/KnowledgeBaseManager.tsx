import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, BookOpen, Tag, X, ChevronRight, ChevronDown, RefreshCw, FolderOpen, Sparkles } from "lucide-react";
import { TagEnrichmentDialog } from "./TagEnrichmentDialog";

// Normalize text for robust German search (case + umlaut-insensitive)
const normalizeSearchText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value).split(/[^a-z0-9]+/g).filter(Boolean);

const extractSearchTerms = (query: string) =>
  tokenizeSearchText(query.trim()).filter((term) => term.length >= 4);

// Split comma-separated search into individual phrases
const splitSearchPhrases = (query: string): string[] =>
  query.split(",").map((p) => p.trim()).filter((p) => p.length > 0);

// Get all unique terms from all comma-separated phrases
const extractAllTerms = (query: string): string[] => {
  const phrases = splitSearchPhrases(query);
  const allTerms = new Set<string>();
  phrases.forEach((p) => extractSearchTerms(p).forEach((t) => allTerms.add(t)));
  return Array.from(allTerms);
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchTextMatchesQuery = (text: string, query: string): boolean => {
  const terms = extractSearchTerms(query);
  if (terms.length === 0 || !text) return false;
  const words = tokenizeSearchText(text);
  if (words.length === 0) return false;
  return terms.every((term) =>
    words.some((word) => word === term || word.startsWith(term) || word.endsWith(term))
  );
};

// Check if text matches ANY single phrase from a comma-separated query
const textMatchesAnyPhrase = (text: string, phrases: string[]): boolean =>
  phrases.some((phrase) => searchTextMatchesQuery(text, phrase));

// Count how many distinct phrases match an entry
const countPhraseMatches = (entry: KnowledgeEntry, phrases: string[]): number => {
  return phrases.filter((phrase) => {
    const terms = extractSearchTerms(phrase);
    if (terms.length === 0) return false;
    return (
      searchTextMatchesQuery(entry.title, phrase) ||
      searchTextMatchesQuery(entry.content, phrase) ||
      searchTextMatchesQuery(entry.category, phrase) ||
      entry.tags?.some((t) => searchTextMatchesQuery(t, phrase))
    );
  }).length;
};

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  created_at: string;
  updated_at: string;
  entry_kind: string;
  review_status: string;
  evidence_level: string;
  dosage_status: string;
  rights_status: string;
  source_citations: Array<{ url?: string; label?: string }>;
  therapeutic_topics: string[];
  contraindications: string[];
  interaction_tags: string[];
  safety_notes: string;
  patient_facing_allowed: boolean;
  commercial_claims_reviewed: boolean;
  last_reviewed_at: string | null;
  reviewed_by: string | null;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const terms = extractAllTerms(query);
  if (terms.length === 0) return <>{text}</>;
  const regex = new RegExp(`(${terms.map(escapeRegex).sort((a, b) => b.length - a.length).join("|")})`, "gi");
  const normalizedTerms = new Set(terms);
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        normalizedTerms.has(normalizeSearchText(part)) ? (
          <mark key={i} className="bg-accent text-accent-foreground rounded-sm px-0.5 font-semibold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ContentSnippets({ content, query }: { content: string; query: string }) {
  const allTerms = extractAllTerms(query);
  const phrases = splitSearchPhrases(query);
  if (allTerms.length === 0 || !content) return null;
  const lines = content.split("\n");
  const matchingLines: { lineIdx: number; line: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (phrases.some((phrase) => searchTextMatchesQuery(lines[i], phrase))) {
      matchingLines.push({ lineIdx: i, line: lines[i] });
      if (matchingLines.length >= 5) break;
    }
  }
  if (matchingLines.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {matchingLines.map(({ lineIdx, line }) => {
        const lowerLine = line.toLowerCase();
        const highlightTerm = allTerms[0].toLowerCase();
        const matchIndex = lowerLine.indexOf(highlightTerm);
        const start = Math.max(0, matchIndex - 60);
        const end = matchIndex >= 0 ? Math.min(line.length, matchIndex + highlightTerm.length + 140) : Math.min(line.length, 200);
        const snippet = line.substring(start, end).trim();
        return (
          <div key={lineIdx} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 overflow-hidden">
            {start > 0 && <span className="text-muted-foreground/60 mr-1">…</span>}
            <HighlightText text={snippet} query={query} />
            {end < line.length && <span className="text-muted-foreground/60 ml-1">…</span>}
          </div>
        );
      })}
    </div>
  );
}

const DEFAULT_CATEGORIES = [
  "Allgemein",
  "Anti-Aging",
  "Diagnostik",
  "Ernährung",
  "Fallbeispiele",
  "Frequenztherapie",
  "Laborwerte",
  "Martin Auerswald",
  "Naturheilpraxis Peter Rauch > Buhner",
  "Naturheilpraxis Peter Rauch > Covid",
  "Naturheilpraxis Peter Rauch > Homotoxikologie",
  "Naturheilpraxis Peter Rauch > Mannayan",
  "Naturheilpraxis Peter Rauch > Nutra Medix",
  "Naturheilpraxis Peter Rauch > Phytotherapie",
  "Naturheilpraxis Peter Rauch > Vieva Pro",
  "Schilddrüse",
];

// Parse hierarchical category into parent > child
const parseCategory = (cat: string) => {
  const parts = cat.split(" > ");
  return { parent: parts[0], child: parts.length > 1 ? parts.slice(1).join(" > ") : null, full: cat };
};

interface HierarchicalGroup {
  name: string;
  children?: { name: string; entries: KnowledgeEntry[] }[];
  entries?: KnowledgeEntry[];
}

export function KnowledgeBaseManager() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<KnowledgeEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());

  const [enrichOpen, setEnrichOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Allgemein");
  const [formCustomCategory, setFormCustomCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formEntryKind, setFormEntryKind] = useState("reference");
  const [formReviewStatus, setFormReviewStatus] = useState("unreviewed");
  const [formEvidenceLevel, setFormEvidenceLevel] = useState("unrated");
  const [formDosageStatus, setFormDosageStatus] = useState("unverified");
  const [formRightsStatus, setFormRightsStatus] = useState("unknown");
  const [formSources, setFormSources] = useState("");
  const [formTherapeuticTopics, setFormTherapeuticTopics] = useState("");
  const [formContraindications, setFormContraindications] = useState("");
  const [formInteractionTags, setFormInteractionTags] = useState("");
  const [formSafetyNotes, setFormSafetyNotes] = useState("");
  const [formPatientFacingAllowed, setFormPatientFacingAllowed] = useState(false);
  const [formCommercialClaimsReviewed, setFormCommercialClaimsReviewed] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_knowledge_base")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setEntries((data as KnowledgeEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const allCategories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    entries.forEach((e) => cats.add(e.category));
    return Array.from(cats).sort();
  }, [entries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [entries]);

  // Parse search into comma-separated phrases
  const searchPhrases = useMemo(() => splitSearchPhrases(searchQuery), [searchQuery]);
  const hasMultiplePhrases = searchPhrases.length > 1;

  // Filter entries - match ANY phrase (OR logic across commas)
  const filtered = useMemo(() => {
    let result = entries;
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter || e.category.startsWith(categoryFilter + " > "));
    }
    if (tagFilter) {
      result = result.filter((e) => e.tags?.includes(tagFilter));
    }
    if (searchQuery.trim()) {
      const phrases = searchPhrases.filter((p) => extractSearchTerms(p).length > 0);
      if (phrases.length > 0) {
        result = result.filter((e) =>
          phrases.some((phrase) =>
            searchTextMatchesQuery(e.title, phrase) ||
            searchTextMatchesQuery(e.content, phrase) ||
            searchTextMatchesQuery(e.category, phrase) ||
            e.tags?.some((t) => searchTextMatchesQuery(t, phrase))
          )
        );
      }
    }
    return result;
  }, [entries, categoryFilter, tagFilter, searchQuery, searchPhrases]);

  const expandToEntry = (entry: KnowledgeEntry) => {
    const parsed = parseCategory(entry.category);
    setExpandedParents((prev) => new Set(prev).add(parsed.parent));
    if (parsed.child) {
      setExpandedChildren((prev) => new Set(prev).add(`${parsed.parent}>${parsed.child}`));
    }
    setExpandedId(entry.id);
  };

  useEffect(() => {
    if (filtered.length === 1) expandToEntry(filtered[0]);
  }, [filtered]);

  // Compute match counts per entry (how many distinct phrases match)
  const matchCounts = useMemo(() => {
    if (!hasMultiplePhrases) return new Map<string, number>();
    const phrases = searchPhrases.filter((p) => extractSearchTerms(p).length > 0);
    const counts = new Map<string, number>();
    filtered.forEach((e) => {
      const count = countPhraseMatches(e, phrases);
      if (count > 1) counts.set(e.id, count);
    });
    return counts;
  }, [filtered, searchPhrases, hasMultiplePhrases]);

  // Build hierarchical groups
  const hierarchicalGroups = useMemo(() => {
    const groups: HierarchicalGroup[] = [];
    const parentMap: Record<string, Record<string, KnowledgeEntry[]>> = {};
    const topLevel: Record<string, KnowledgeEntry[]> = {};

    filtered.forEach((entry) => {
      const parsed = parseCategory(entry.category);
      if (parsed.child) {
        if (!parentMap[parsed.parent]) parentMap[parsed.parent] = {};
        if (!parentMap[parsed.parent][parsed.child]) parentMap[parsed.parent][parsed.child] = [];
        parentMap[parsed.parent][parsed.child].push(entry);
      } else {
        if (!topLevel[parsed.parent]) topLevel[parsed.parent] = [];
        topLevel[parsed.parent].push(entry);
      }
    });

    // Add hierarchical groups
    for (const [parent, childMap] of Object.entries(parentMap).sort((a, b) => a[0].localeCompare(b[0]))) {
      const children = Object.entries(childMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, entries]) => ({ name, entries }));
      groups.push({ name: parent, children, entries: topLevel[parent] || [] });
      delete topLevel[parent];
    }

    // Add top-level groups
    for (const [name, entries] of Object.entries(topLevel).sort((a, b) => a[0].localeCompare(b[0]))) {
      groups.push({ name, entries });
    }

    return groups;
  }, [filtered]);

  // Unique parent categories for filter dropdown
  const parentCategories = useMemo(() => {
    const parents = new Set<string>();
    allCategories.forEach((c) => {
      const p = parseCategory(c);
      parents.add(p.parent);
    });
    return Array.from(parents).sort();
  }, [allCategories]);

  const toggleParent = (name: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleChild = (key: string) => {
    setExpandedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const parents = hierarchicalGroups.map((g) => g.name);
    const children: string[] = [];
    hierarchicalGroups.forEach((g) => {
      g.children?.forEach((c) => children.push(`${g.name}>${c.name}`));
    });
    setExpandedParents(new Set(parents));
    setExpandedChildren(new Set(children));
  };

  const collapseAll = () => {
    setExpandedParents(new Set());
    setExpandedChildren(new Set());
  };

  const isAllExpanded = hierarchicalGroups.length > 0 && hierarchicalGroups.every((g) => expandedParents.has(g.name));

  const openNewDialog = () => {
    setEditingEntry(null);
    setFormTitle("");
    setFormCategory("Allgemein");
    setFormCustomCategory("");
    setFormTags("");
    setFormContent("");
    setFormEntryKind("reference");
    setFormReviewStatus("unreviewed");
    setFormEvidenceLevel("unrated");
    setFormDosageStatus("unverified");
    setFormRightsStatus("unknown");
    setFormSources("");
    setFormTherapeuticTopics("");
    setFormContraindications("");
    setFormInteractionTags("");
    setFormSafetyNotes("");
    setFormPatientFacingAllowed(false);
    setFormCommercialClaimsReviewed(false);
    setDialogOpen(true);
  };

  const openEditDialog = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    const isDefault = DEFAULT_CATEGORIES.includes(entry.category);
    setFormCategory(isDefault ? entry.category : "__custom__");
    setFormCustomCategory(isDefault ? "" : entry.category);
    setFormTags(entry.tags?.join(", ") || "");
    setFormContent(entry.content);
    setFormEntryKind(entry.entry_kind || "reference");
    setFormReviewStatus(entry.review_status || "unreviewed");
    setFormEvidenceLevel(entry.evidence_level || "unrated");
    setFormDosageStatus(entry.dosage_status || "unverified");
    setFormRightsStatus(entry.rights_status || "unknown");
    setFormSources(Array.isArray(entry.source_citations) ? entry.source_citations.map((source) => source.url || source.label || "").filter(Boolean).join("\n") : "");
    setFormTherapeuticTopics(entry.therapeutic_topics?.join(", ") || "");
    setFormContraindications(entry.contraindications?.join(", ") || "");
    setFormInteractionTags(entry.interaction_tags?.join(", ") || "");
    setFormSafetyNotes(entry.safety_notes || "");
    setFormPatientFacingAllowed(entry.patient_facing_allowed === true);
    setFormCommercialClaimsReviewed(entry.commercial_claims_reviewed === true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const finalCategory = formCategory === "__custom__" ? formCustomCategory.trim() : formCategory;
    if (!formTitle.trim() || !finalCategory) {
      toast({ title: "Titel und Kategorie sind Pflichtfelder", variant: "destructive" });
      return;
    }
    if (formPatientFacingAllowed && (formReviewStatus !== "reviewed" || !formCommercialClaimsReviewed)) {
      toast({ title: "Patientenausgabe nicht freigabefähig", description: "Dafür müssen Fachprüfung und Prüfung der Werbe-/Produktaussagen abgeschlossen sein.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (formReviewStatus === "reviewed" && !user) {
      setSaving(false);
      toast({ title: "Fachprüfung nicht gespeichert", description: "Für die Prüferzuordnung ist eine aktive Anmeldung erforderlich.", variant: "destructive" });
      return;
    }
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    const commaList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    const payload = {
      title: formTitle.trim(),
      category: finalCategory,
      tags,
      content: formContent,
      entry_kind: formEntryKind,
      review_status: formReviewStatus,
      evidence_level: formEvidenceLevel,
      dosage_status: formDosageStatus,
      rights_status: formRightsStatus,
      source_citations: formSources.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url })),
      therapeutic_topics: commaList(formTherapeuticTopics),
      contraindications: commaList(formContraindications),
      interaction_tags: commaList(formInteractionTags),
      safety_notes: formSafetyNotes.trim(),
      patient_facing_allowed: formPatientFacingAllowed,
      commercial_claims_reviewed: formCommercialClaimsReviewed,
      last_reviewed_at: formReviewStatus === "reviewed" ? new Date().toISOString() : null,
      reviewed_by: formReviewStatus === "reviewed" ? user?.id || null : null,
    };
    let error;
    if (editingEntry) {
      ({ error } = await supabase.from("admin_knowledge_base").update(payload).eq("id", editingEntry.id));
    } else {
      ({ error } = await supabase.from("admin_knowledge_base").insert(payload));
    }
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingEntry ? "Aktualisiert" : "Gespeichert" });
      setDialogOpen(false);
      fetchEntries();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    const { error } = await supabase.from("admin_knowledge_base").delete().eq("id", deletingEntry.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gelöscht" });
      setDeleteDialogOpen(false);
      setDeletingEntry(null);
      if (expandedId === deletingEntry.id) setExpandedId(null);
      fetchEntries();
    }
  };

  const renderEntry = (entry: KnowledgeEntry) => {
    const phraseMatchCount = matchCounts.get(entry.id) || 0;
    const isMultiMatch = phraseMatchCount >= 2;
    return (
    <Card
      key={entry.id}
      className={`cursor-pointer hover:border-primary/30 transition-colors ${isMultiMatch ? "ring-2 ring-primary/50 border-primary/40 bg-primary/5" : ""}`}
      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
    >
      <CardHeader className="py-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                <HighlightText text={entry.title} query={searchQuery} />
              </CardTitle>
              {isMultiMatch && (
                <Badge className="bg-primary text-primary-foreground text-xs shrink-0">
                  ⭐ {phraseMatchCount} Treffer
                </Badge>
              )}
              <Badge variant={entry.review_status === "reviewed" ? "default" : entry.review_status === "restricted" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                {entry.review_status === "reviewed" ? "fachlich geprüft" : entry.review_status === "restricted" ? "gesperrt" : "Prüfung offen"}
              </Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">Evidenz: {entry.evidence_level || "unrated"}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {entry.tags?.slice(0, 6).map((tag) => (
                <Badge key={tag} variant="outline" className="gap-1 text-xs">
                  <Tag className="h-3 w-3" />{tag}
                </Badge>
              ))}
              {(entry.tags?.length || 0) > 6 && (
                <Badge variant="outline" className="text-xs">+{entry.tags!.length - 6}</Badge>
              )}
            </div>
            {extractAllTerms(searchQuery).length > 0 && expandedId !== entry.id && (
              <ContentSnippets content={entry.content} query={searchQuery} />
            )}
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(entry)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => { setDeletingEntry(entry); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expandedId === entry.id && (
        <CardContent className="pt-0">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80 border-t pt-3">
            {entry.content ? <HighlightText text={entry.content} query={searchQuery} /> : <span className="text-muted-foreground italic">Kein Inhalt</span>}
          </div>
          {(entry.safety_notes || entry.contraindications?.length || entry.interaction_tags?.length) && (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-50/70 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="font-semibold mb-1">Interne Sicherheitsdaten</div>
              {entry.safety_notes && <div>{entry.safety_notes}</div>}
              {entry.contraindications?.length > 0 && <div className="mt-1"><strong>Kontraindikationen:</strong> {entry.contraindications.join(", ")}</div>}
              {entry.interaction_tags?.length > 0 && <div className="mt-1"><strong>Interaktionen:</strong> {entry.interaction_tags.join(", ")}</div>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">Typ: {entry.entry_kind || "reference"}</Badge>
            <Badge variant="outline" className="text-[10px]">Dosierung: {entry.dosage_status || "unverified"}</Badge>
            <Badge variant="outline" className="text-[10px]">Rechte: {entry.rights_status || "unknown"}</Badge>
            <Badge variant="outline" className="text-[10px]">Quellen: {entry.source_citations?.length || 0}</Badge>
            <Badge variant={entry.patient_facing_allowed ? "default" : "secondary"} className="text-[10px]">Patientenausgabe: {entry.patient_facing_allowed ? "freigegeben" : "gesperrt"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Zuletzt aktualisiert: {new Date(entry.updated_at).toLocaleString("de-DE")}
            {entry.last_reviewed_at ? ` · Fachlich geprüft: ${new Date(entry.last_reviewed_at).toLocaleString("de-DE")}` : ""}
          </p>
        </CardContent>
      )}
    </Card>
    );
  };

  const totalEntries = filtered.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Wissensdatenbank</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEnrichOpen(true)} className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20">
            <Sparkles className="h-4 w-4" /> KI-Tags
          </Button>
          <Button variant="outline" onClick={fetchEntries} className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Eintrag
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche… (mehrere Begriffe mit Komma trennen, z.B. Müdigkeit, Schnupfen)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Kategorie filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {parentCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select value={tagFilter || "all"} onValueChange={(v) => setTagFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tag filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground items-center">
        <span>{totalEntries} von {entries.length} Einträgen</span>
        {(searchQuery || categoryFilter !== "all" || tagFilter) && (
          <button
            onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setTagFilter(""); }}
            className="text-primary hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Filter zurücksetzen
          </button>
        )}
        {hierarchicalGroups.length > 0 && (
          <button
            onClick={isAllExpanded ? collapseAll : expandAll}
            className="text-primary hover:underline flex items-center gap-1 ml-auto"
          >
            {isAllExpanded ? "▼ Alle zuklappen" : "▶ Alle aufklappen"}
          </button>
        )}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {entries.length === 0
              ? "Noch keine Einträge. Erstelle deinen ersten Wissenseintrag!"
              : "Keine Einträge gefunden für diese Filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hierarchicalGroups.map((group) => {
            const isParentExpanded = expandedParents.has(group.name);
            const hasChildren = !!group.children && group.children.length > 0;
            const totalCount = hasChildren
              ? group.children!.reduce((sum, c) => sum + c.entries.length, group.entries?.length || 0)
              : (group.entries?.length || 0);

            return (
              <div key={group.name} className="border rounded-lg bg-card">
                {/* Parent header */}
                <button
                  onClick={() => toggleParent(group.name)}
                  className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg"
                >
                  {isParentExpanded ? (
                    <ChevronDown className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  {hasChildren ? (
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-base font-semibold text-foreground">{group.name}</span>
                  <Badge variant="outline" className="text-xs ml-1">{totalCount}</Badge>
                </button>

                {/* Expanded content */}
                {isParentExpanded && (
                  <div className="px-4 pb-3">
                    {hasChildren ? (
                      // Hierarchical: show sub-categories
                      <div className="space-y-2 ml-4 border-l-2 border-muted pl-4">
                        {(group.entries?.length || 0) > 0 && (
                          <div className="space-y-2 mb-2">
                            {group.entries!.map(renderEntry)}
                          </div>
                        )}
                        {group.children!.map((child) => {
                          const childKey = `${group.name}>${child.name}`;
                          const isChildExpanded = expandedChildren.has(childKey);
                          return (
                            <div key={childKey}>
                              <button
                                onClick={() => {
                                  toggleChild(childKey);
                                  if (!isChildExpanded && child.entries.length === 1) expandToEntry(child.entries[0]);
                                }}
                                className="flex items-center gap-2 w-full text-left py-2 hover:text-primary transition-colors"
                              >
                                {isChildExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-sm font-medium">{child.name}</span>
                                <Badge variant="outline" className="text-xs">{child.entries.length}</Badge>
                              </button>
                              {isChildExpanded && (
                                <div className="space-y-2 ml-6 mt-1">
                                  {child.entries.map(renderEntry)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Flat: show entries directly
                      <div className="space-y-2 ml-4">
                        {group.entries!.map(renderEntry)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Eintrag bearbeiten" : "Neuer Wissenseintrag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titel *</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Mittel gegen Trichomonaden" />
            </div>
            <div>
              <label className="text-sm font-medium">Kategorie *</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">✏️ Eigene Kategorie...</SelectItem>
                </SelectContent>
              </Select>
              {formCategory === "__custom__" && (
                <Input
                  className="mt-2"
                  value={formCustomCategory}
                  onChange={(e) => setFormCustomCategory(e.target.value)}
                  placeholder="z.B. Naturheilpraxis Peter Rauch > Neuer Bereich"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Tags (kommagetrennt)</label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="z.B. Trichomonaden, Toxoplasmen, Parasiten"
              />
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-50/40 p-4 space-y-4 dark:bg-amber-950/10">
              <div>
                <div className="font-semibold text-sm">Fachliche Metadaten</div>
                <div className="text-xs text-muted-foreground">Diese Felder steuern Prüfung und Sicherheit. Ein Wiki-Eintrag wird dadurch nicht automatisch zur Therapieempfehlung.</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Eintragstyp</label>
                  <Select value={formEntryKind} onValueChange={setFormEntryKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reference">Referenz</SelectItem>
                      <SelectItem value="remedy">Mittel</SelectItem>
                      <SelectItem value="protocol">Protokoll</SelectItem>
                      <SelectItem value="diagnostic">Diagnostik</SelectItem>
                      <SelectItem value="product">Produkt</SelectItem>
                      <SelectItem value="equipment">Gerät/Zubehör</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prüfstatus</label>
                  <Select value={formReviewStatus} onValueChange={setFormReviewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unreviewed">Ungeprüft</SelectItem>
                      <SelectItem value="needs_review">Prüfung erforderlich</SelectItem>
                      <SelectItem value="reviewed">Fachlich geprüft</SelectItem>
                      <SelectItem value="restricted">Nicht verwenden/gesperrt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Evidenzniveau</label>
                  <Select value={formEvidenceLevel} onValueChange={setFormEvidenceLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unrated">Nicht bewertet</SelectItem>
                      <SelectItem value="traditional">Traditionelle Anwendung</SelectItem>
                      <SelectItem value="mechanistic">Mechanistische Hinweise</SelectItem>
                      <SelectItem value="observational">Beobachtungsdaten</SelectItem>
                      <SelectItem value="clinical">Klinische Daten</SelectItem>
                      <SelectItem value="guideline">Leitlinie/Monographie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Dosierungsstatus</label>
                  <Select value={formDosageStatus} onValueChange={setFormDosageStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_applicable">Nicht anwendbar</SelectItem>
                      <SelectItem value="missing">Fehlt</SelectItem>
                      <SelectItem value="unverified">Ungeprüft</SelectItem>
                      <SelectItem value="verified">Geprüft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">Rechte-/Quellenstatus</label>
                  <Select value={formRightsStatus} onValueChange={setFormRightsStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unbekannt</SelectItem>
                      <SelectItem value="own_content">Eigener Inhalt</SelectItem>
                      <SelectItem value="licensed">Lizenziert</SelectItem>
                      <SelectItem value="quoted">Zulässiges Zitat</SelectItem>
                      <SelectItem value="public_domain">Gemeinfrei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Quellen (eine URL oder Quellenangabe pro Zeile)</label>
                <Textarea value={formSources} onChange={(e) => setFormSources(e.target.value)} rows={3} placeholder="https://..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Therapiethemen (kommagetrennt)</label>
                  <Input value={formTherapeuticTopics} onChange={(e) => setFormTherapeuticTopics(e.target.value)} placeholder="z.B. Darm, Schlaf" />
                </div>
                <div>
                  <label className="text-sm font-medium">Interaktions-Tags</label>
                  <Input value={formInteractionTags} onChange={(e) => setFormInteractionTags(e.target.value)} placeholder="z.B. Antikoagulanzien, CYP3A4" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Kontraindikationen (kommagetrennt)</label>
                <Input value={formContraindications} onChange={(e) => setFormContraindications(e.target.value)} placeholder="z.B. Schwangerschaft, Hypertonie" />
              </div>
              <div>
                <label className="text-sm font-medium">Interne Sicherheitshinweise</label>
                <Textarea value={formSafetyNotes} onChange={(e) => setFormSafetyNotes(e.target.value)} rows={3} placeholder="Konkrete Prüf- und Überwachungshinweise..." />
              </div>
              <div className="space-y-3 rounded-md border bg-background/70 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={formCommercialClaimsReviewed} onCheckedChange={(checked) => setFormCommercialClaimsReviewed(checked === true)} />
                  <span><strong>Werbe-/Produktaussagen geprüft</strong><span className="block text-xs text-muted-foreground">Indikations- und Wirkaussagen wurden auf belastbare Quellen und zulässige Formulierung geprüft.</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={formPatientFacingAllowed} onCheckedChange={(checked) => setFormPatientFacingAllowed(checked === true)} />
                  <span><strong>Für Patientenausgabe freigeben</strong><span className="block text-xs text-muted-foreground">Nur möglich bei fachlich geprüftem Eintrag und geprüften Werbe-/Produktaussagen.</span></span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Inhalt</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Dein Wissen hier eintragen..."
                rows={12}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : editingEntry ? "Aktualisieren" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            „{deletingEntry?.title}" wird unwiderruflich gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TagEnrichmentDialog
        open={enrichOpen}
        onOpenChange={setEnrichOpen}
        onApplied={fetchEntries}
      />
    </div>
  );
}
