import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onExtracted: (text: string) => void;
}

const fileToDataUrl = (f: File | Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

// Bild auf max. 1600px Kantenlänge runterskalieren (JPEG q=0.85), spart Tokens.
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

export function LabImageUpload({ onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const processBlobs = async (blobs: (File | Blob)[]) => {
    if (!blobs.length) return;
    setLoading(true);
    try {
      const imgs: string[] = [];
      for (const f of blobs.slice(0, 8)) {
        imgs.push(await downscale(f));
      }
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
          body: JSON.stringify({ images: imgs }),
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
      toast({ title: "Laborwerte extrahiert", description: `${imgs.length} Bild(er) ausgewertet.` });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    processBlobs(Array.from(files));
  };

  const pasteFromClipboard = async () => {
    try {
      // @ts-ignore – Clipboard API
      if (!navigator.clipboard?.read) {
        toast({ title: "Zwischenablage nicht verfügbar", description: "Bitte Strg+V direkt in dieses Fenster nutzen.", variant: "destructive" });
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
        toast({ title: "Kein Bild in der Zwischenablage", description: "Bitte zuerst in Adobe/Windows ein Bild kopieren.", variant: "destructive" });
        return;
      }
      await processBlobs(blobs);
    } catch (e: any) {
      toast({ title: "Einfügen fehlgeschlagen", description: e.message + " — Tipp: Strg+V direkt im Fenster nutzen.", variant: "destructive" });
    }
  };

  // Globaler Strg+V Listener: nimmt Bilder aus der Zwischenablage entgegen
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
        processBlobs(blobs);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
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
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {loading ? "Extrahiere…" : "Labor als Foto/Scan"}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={pasteFromClipboard} className="gap-1.5">
        <ClipboardPaste className="h-3.5 w-3.5" />
        Aus Zwischenablage einfügen
      </Button>
    </div>
  );
}
