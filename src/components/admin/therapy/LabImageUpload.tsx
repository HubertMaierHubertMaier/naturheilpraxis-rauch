import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ClipboardPaste, X, Sparkles, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  onExtracted: (text: string) => void;
  mode?: "lab" | "doctor";
}

const fileToDataUrl = (f: File | Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

const downscale = async (file: File | Blob): Promise<string> => {
  const dataUrl = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const max = 1600;
  let { width, height } = img;
  if (width <= max && height <= max) return dataUrl;
  const scale = max / Math.max(width, height);
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
};

export function LabImageUpload({ onExtracted, mode = "lab" }: Props) {
  const isDoctor = mode === "doctor";
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string[]>([]); // data URLs queued
  const [askMore, setAskMore] = useState(false);
  const [lastAddedAt, setLastAddedAt] = useState<number | null>(null);
  const { toast } = useToast();

  const addBlobs = async (blobs: (File | Blob)[]) => {
    if (!blobs.length) return;
    const added: string[] = [];
    for (const b of blobs) {
      try { added.push(await downscale(b)); } catch {}
    }
    if (added.length) {
      setPending((prev) => [...prev, ...added]);
      setLastAddedAt(Date.now());
      setAskMore(true);
      toast({ title: `✓ ${added.length} Bild(er) hinzugefügt`, description: "Ausschnitt wurde der Sammlung hinzugefügt." });
    }
  };

  const removeAt = (i: number) => setPending((p) => p.filter((_, idx) => idx !== i));
  const clearAll = () => setPending([]);

  const extractNow = async () => {
    if (!pending.length) {
      toast({ title: "Keine Bilder", description: "Bitte zuerst Ausschnitte einfügen.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Nicht angemeldet", variant: "destructive" });
        return;
      }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-lab-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: pending.slice(0, 8) }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) {
        toast({ title: "Extraktion fehlgeschlagen", description: json.error, variant: "destructive" });
        return;
      }
      const text = (json.text || "").trim();
      if (!text) {
        toast({ title: "Keine Werte erkannt", variant: "destructive" });
        return;
      }
      onExtracted(text);
      toast({ title: "Laborwerte extrahiert", description: `${pending.length} Bild(er) ausgewertet.` });
      setPending([]);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    addBlobs(Array.from(files));
    if (inputRef.current) inputRef.current.value = "";
  };

  const pasteFromClipboard = async () => {
    try {
      // @ts-ignore
      if (!navigator.clipboard?.read) {
        toast({ title: "Bitte Strg+V im Fenster nutzen", variant: "destructive" });
        return;
      }
      // @ts-ignore
      const items: ClipboardItem[] = await navigator.clipboard.read();
      const blobs: Blob[] = [];
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) blobs.push(await it.getType(type));
      }
      if (!blobs.length) {
        toast({ title: "Kein Bild in der Zwischenablage", variant: "destructive" });
        return;
      }
      await addBlobs(blobs);
    } catch (e: any) {
      toast({ title: "Einfügen fehlgeschlagen", description: e.message + " — Tipp: Strg+V direkt im Fenster nutzen.", variant: "destructive" });
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const blobs: Blob[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const b = item.getAsFile();
          if (b) blobs.push(b);
        }
      }
      if (blobs.length) {
        e.preventDefault();
        addBlobs(blobs);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => inputRef.current?.click()} className="gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Foto/Scan hinzufügen
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={pasteFromClipboard} className="gap-1.5">
          <ClipboardPaste className="h-3.5 w-3.5" />
          Aus Zwischenablage einfügen
        </Button>
        {pending.length > 0 && (
          <>
            <Button type="button" size="sm" disabled={loading} onClick={extractNow} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {loading ? "Extrahiere…" : `Jetzt extrahieren (${pending.length})`}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={clearAll}>
              Alle entfernen
            </Button>
          </>
        )}
      </div>

      {pending.length > 0 ? (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
          <div className="text-xs text-muted-foreground mb-2">
            {pending.length} Ausschnitt(e) bereit. Du kannst weitere mit Strg+V oder „Aus Zwischenablage einfügen" hinzufügen, danach auf „Jetzt extrahieren" klicken.
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((src, i) => (
              <div key={i} className="relative group">
                <img src={src} alt={`Ausschnitt ${i + 1}`} className="h-20 w-auto rounded border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                  title="Entfernen"
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white text-center rounded-b">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Tipp: Markier in Adobe einen Bereich → kopieren → hier mit Strg+V einfügen. Mehrere Ausschnitte sind möglich, danach gemeinsam extrahieren.
        </div>
      )}

      {lastAddedAt && pending.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Ausschnitt wurde hinzugefügt ({pending.length} insgesamt).</span>
        </div>
      )}

      <AlertDialog open={askMore} onOpenChange={setAskMore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weiteres Bild hinzufügen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie noch einen Ausschnitt aus der Zwischenablage oder ein weiteres Foto hinzufügen?
              Aktuell sind <strong>{pending.length}</strong> Ausschnitt(e) gesammelt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel onClick={() => setAskMore(false)}>Nein, fertig</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={async () => { setAskMore(false); await pasteFromClipboard(); }}
              className="gap-1.5"
            >
              <ClipboardPaste className="h-4 w-4" />
              Zwischenablage
            </Button>
            <AlertDialogAction
              onClick={() => { setAskMore(false); inputRef.current?.click(); }}
              className="gap-1.5"
            >
              <Camera className="h-4 w-4" />
              Foto/Scan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
