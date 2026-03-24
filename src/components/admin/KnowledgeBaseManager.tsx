import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, BookOpen, Tag, FolderOpen, X } from "lucide-react";

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORIES = [
  "Allgemein",
  "Erreger & Pathogene",
  "Naturheilkundliche Mittel",
  "Diagnostik",
  "Therapie & Protokolle",
  "Laborwerte",
  "Ernährung",
  "Frequenztherapie",
  "Fallbeispiele",
];

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

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Allgemein");
  const [formCustomCategory, setFormCustomCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formContent, setFormContent] = useState("");
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

  useEffect(() => {
    fetchEntries();
  }, []);

  // Derive all unique categories and tags
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

  // Filter entries
  const filtered = useMemo(() => {
    let result = entries;
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter);
    }
    if (tagFilter) {
      result = result.filter((e) => e.tags?.includes(tagFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, categoryFilter, tagFilter, searchQuery]);

  const openNewDialog = () => {
    setEditingEntry(null);
    setFormTitle("");
    setFormCategory("Allgemein");
    setFormCustomCategory("");
    setFormTags("");
    setFormContent("");
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const finalCategory = formCategory === "__custom__" ? formCustomCategory.trim() : formCategory;
    if (!formTitle.trim() || !finalCategory) {
      toast({ title: "Titel und Kategorie sind Pflichtfelder", variant: "destructive" });
      return;
    }

    setSaving(true);
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: formTitle.trim(),
      category: finalCategory,
      tags,
      content: formContent,
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Wissensdatenbank</h1>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Eintrag
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche in Titel, Inhalt, Tags..."
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
                {allCategories.map((c) => (
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
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filtered.length} von {entries.length} Einträgen</span>
        {(searchQuery || categoryFilter !== "all" || tagFilter) && (
          <button
            onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setTagFilter(""); }}
            className="text-primary hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Filter zurücksetzen
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
        <div className="space-y-6">
          {groupedEntries.map(({ groupName, entries: groupEntries }) => (
            <div key={groupName}>
              <button
                onClick={() => setExpandedGroup(expandedGroup === groupName ? null : groupName)}
                className="flex items-center gap-2 w-full text-left mb-2 group"
              >
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedGroup === groupName ? "rotate-90" : ""}`} />
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {groupName}
                </h2>
                <Badge variant="outline" className="text-xs">{groupEntries.length}</Badge>
              </button>
              {expandedGroup === groupName && (
                <div className="space-y-2 ml-6">
                  {groupEntries.map((entry) => (
                    <Card
                      key={entry.id}
                      className="cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <CardHeader className="py-3 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold">{entry.title}</CardTitle>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {entry.tags?.filter(t => t !== groupName).map((tag) => (
                                <Badge key={tag} variant="outline" className="gap-1 text-xs">
                                  <Tag className="h-3 w-3" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
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
                            {entry.content || <span className="text-muted-foreground italic">Kein Inhalt</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Zuletzt aktualisiert: {new Date(entry.updated_at).toLocaleString("de-DE")}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                  placeholder="Neue Kategorie eingeben"
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
    </div>
  );
}
