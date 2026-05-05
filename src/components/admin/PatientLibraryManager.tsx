import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, FileText, Music, Eye, EyeOff, Download } from "lucide-react";
import { toast } from "sonner";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  file_path: string;
  file_type: string;
  file_size: number;
  tags: string[];
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

const BUCKET = "patient-library";

export const PatientLibraryManager = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hypnose",
    tags: "",
    is_published: true,
  });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_resources")
      .select("*")
      .order("category")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Fehler beim Laden: " + error.message);
    } else {
      setResources(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const detectType = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return "pdf";
    if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "mp3";
    return "other";
  };

  const handleUpload = async () => {
    if (!file || !form.title.trim()) {
      toast.error("Bitte Titel und Datei angeben");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.category.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("patient_resources").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Allgemein",
        file_path: path,
        file_type: detectType(file.name),
        file_size: file.size,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_published: form.is_published,
      });
      if (insErr) throw insErr;

      toast.success("Material hochgeladen");
      setForm({ title: "", description: "", category: form.category, tags: "", is_published: true });
      setFile(null);
      load();
    } catch (e: any) {
      toast.error("Upload-Fehler: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const togglePublished = async (r: Resource) => {
    const { error } = await supabase
      .from("patient_resources")
      .update({ is_published: !r.is_published })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (r: Resource) => {
    if (!confirm(`„${r.title}" wirklich löschen?`)) return;
    await supabase.storage.from(BUCKET).remove([r.file_path]);
    const { error } = await supabase.from("patient_resources").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Gelöscht");
      load();
    }
  };

  const downloadAdmin = async (r: Resource) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.file_path, 60);
    if (error || !data) {
      toast.error("Download-Fehler");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Neues Material hochladen</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Titel *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="z.B. Hypnose, Ernährung, Atemübungen"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Beschreibung</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Tags (Komma-getrennt)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div>
              <Label>Datei (PDF / MP3) *</Label>
              <Input
                type="file"
                accept=".pdf,.mp3,.wav,.m4a,.ogg,application/pdf,audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_published}
                onCheckedChange={(v) => setForm({ ...form, is_published: v })}
              />
              <Label>Sofort veröffentlicht (für Patienten sichtbar)</Label>
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Hochladen
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Vorhandene Materialien ({resources.length})</h3>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : resources.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Materialien hochgeladen.</p>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  {r.file_type === "mp3" ? (
                    <Music className="h-5 w-5 mt-1 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 mt-1 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant="secondary">{r.category}</Badge>
                      {!r.is_published && <Badge variant="outline">Versteckt</Badge>}
                      <span className="text-xs text-muted-foreground">{formatSize(r.file_size)}</span>
                    </div>
                    {r.description && (
                      <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => downloadAdmin(r)} title="Vorschau">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => togglePublished(r)} title="Sichtbarkeit">
                      {r.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)} title="Löschen">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
