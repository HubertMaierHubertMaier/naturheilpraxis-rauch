import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Mail, Plus, FileText, BookOpen, Library, Loader2, Save, Search, UserPlus, Clock } from "lucide-react";
import { listAllInfothekItems } from "@/lib/infothekContent";
import { useInfothekGating } from "@/hooks/useInfothekGating";
import { Separator } from "@/components/ui/separator";

interface AccessRow {
  id: string;
  email: string;
  anamnese_download: boolean;
  infothek_all: boolean;
  infothek_items: string[];
  library_access: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface PendingProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  email: "",
  note: "",
  anamnese_download: true,
  infothek_all: false,
  library_access: false,
  infothek_items: [] as string[],
};

export function PatientAccessManager() {
  const { getVisibility, loading: gatingLoading } = useInfothekGating();
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AccessRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_access")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Laden fehlgeschlagen: " + error.message);
    setRows((data ?? []) as AccessRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.includes(q) || (r.note ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const patientScopedItems = useMemo(
    () =>
      listAllInfothekItems().filter(
        ({ item }) => getVisibility(item.href, !!item.gated) === "patient"
      ),
    [getVisibility]
  );

  const openEdit = (row: AccessRow) => {
    setEditing(row);
    setForm({
      email: row.email,
      note: row.note ?? "",
      anamnese_download: row.anamnese_download,
      infothek_all: row.infothek_all,
      library_access: row.library_access,
      infothek_items: row.infothek_items ?? [],
    });
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setNewOpen(true);
  };

  const save = async () => {
    if (!form.email.trim()) {
      toast.error("E-Mail erforderlich");
      return;
    }
    setSaving(true);
    const payload = {
      email: form.email.trim().toLowerCase(),
      note: form.note.trim() || null,
      anamnese_download: form.anamnese_download,
      infothek_all: form.infothek_all,
      library_access: form.library_access,
      infothek_items: form.infothek_all
        ? []
        : form.infothek_items.filter((href) =>
            patientScopedItems.some(({ item }) => item.href === href)
          ),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("patient_access").update(payload).eq("id", editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("patient_access").insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen: " + error.message);
      return;
    }
    toast.success(editing ? "Zugang aktualisiert" : "Zugang freigeschaltet");
    setEditing(null);
    setNewOpen(false);
    setForm(EMPTY_FORM);
    load();
  };

  const remove = async (row: AccessRow) => {
    if (!confirm(`Zugang für ${row.email} wirklich entfernen?`)) return;
    const { error } = await supabase.from("patient_access").delete().eq("id", row.id);
    if (error) {
      toast.error("Löschen fehlgeschlagen: " + error.message);
      return;
    }
    toast.success("Zugang entfernt");
    load();
  };

  const dialogOpen = newOpen || !!editing;
  const setDialogOpen = (o: boolean) => {
    if (!o) {
      setEditing(null);
      setNewOpen(false);
      setForm(EMPTY_FORM);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="E-Mail oder Notiz suchen…"
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Neue E-Mail freischalten
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? `Zugang bearbeiten: ${editing.email}` : "Neuen Patienten-Zugang freischalten"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail des Patienten</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="patient@example.com"
                  disabled={!!editing}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Sobald sich der Nutzer mit genau dieser E-Mail registriert/anmeldet, werden die unten gesetzten Bereiche freigeschaltet.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Notiz (intern)</Label>
                <Textarea
                  id="note"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="z. B. Telefonat 17.06., Termin 24.06., Bauchwohl-Hypnose vereinbart"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Freigaben</h4>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer">
                  <Checkbox
                    checked={form.anamnese_download}
                    onCheckedChange={(c) => setForm({ ...form, anamnese_download: !!c })}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-primary" /> Anamnesebogen
                    </div>
                    <p className="text-xs text-muted-foreground">PDF-Download und Online-Formular werden im Header sichtbar.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer">
                  <Checkbox
                    checked={form.library_access}
                    onCheckedChange={(c) => setForm({ ...form, library_access: !!c })}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Library className="h-4 w-4 text-primary" /> Patienten-Bibliothek
                    </div>
                    <p className="text-xs text-muted-foreground">Zugriff auf geschützte PDFs/MP3s (Hypnose-Audios etc.).</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer">
                  <Checkbox
                    checked={form.infothek_all}
                    onCheckedChange={(c) => setForm({ ...form, infothek_all: !!c })}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <BookOpen className="h-4 w-4 text-primary" /> Komplette Infothek (alle gesperrten Beiträge)
                    </div>
                    <p className="text-xs text-muted-foreground">Sinnvoll für bestehende Patienten in laufender Therapie.</p>
                  </div>
                </label>
              </div>

              {!form.infothek_all && patientScopedItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Oder einzelne Infothek-Beiträge freischalten:</h4>
                  <p className="text-xs text-muted-foreground">
                    Angezeigt werden die Beiträge, die im Tab „Sichtbarkeit“ aktuell auf „Patienten“ stehen.
                  </p>
                  <div className="space-y-3">
                    {Object.entries(
                      patientScopedItems.reduce<Record<string, typeof patientScopedItems>>((acc, x) => {
                        (acc[x.group] ||= []).push(x);
                        return acc;
                      }, {})
                    ).map(([group, items]) => (
                      <div key={group} className="rounded-lg border border-border p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                        <div className="space-y-2">
                          {items.map(({ item }) => {
                            const checked = form.infothek_items.includes(item.href);
                            return (
                              <label key={item.href} className="flex items-start gap-2 text-sm cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    setForm((f) => ({
                                      ...f,
                                      infothek_items: c
                                        ? [...f.infothek_items, item.href]
                                        : f.infothek_items.filter((h) => h !== item.href),
                                    }));
                                  }}
                                  className="mt-0.5"
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{item.label.de}</div>
                                  <div className="text-xs text-muted-foreground">{item.description.de}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading || gatingLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Noch keine Patienten-Zugänge angelegt. Klicke oben rechts auf <b>„Neue E-Mail freischalten"</b>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{row.email}</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Bearbeiten</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(row)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {row.note && <CardDescription className="text-xs">{row.note}</CardDescription>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {row.anamnese_download && <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> Anamnese</Badge>}
                  {row.library_access && <Badge variant="secondary" className="gap-1"><Library className="h-3 w-3" /> Bibliothek</Badge>}
                  {row.infothek_all ? (
                    <Badge variant="secondary" className="gap-1"><BookOpen className="h-3 w-3" /> Infothek komplett</Badge>
                  ) : row.infothek_items.length > 0 ? (
                    <Badge variant="secondary" className="gap-1"><BookOpen className="h-3 w-3" /> {row.infothek_items.length} Infothek-Beitrag/-äge</Badge>
                  ) : null}
                  {!row.anamnese_download && !row.library_access && !row.infothek_all && row.infothek_items.length === 0 && (
                    <Badge variant="outline" className="text-muted-foreground">Nichts freigeschaltet</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
