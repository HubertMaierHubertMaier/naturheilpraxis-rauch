import { useRef, useState } from "react";
import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  disabled: boolean;
  disabledReason: string;
  onSelectFiles: () => void;
  onFiles: (files: File[]) => void;
};

export function PatientBatchUploadZone({ disabled, disabledReason, onSelectFiles, onFiles }: Props) {
  const folderRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const acceptFiles = (selected: File[]) => {
    if (disabled) { setNotice(disabledReason); return; }
    const pdfs = selected.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    const unsupported = selected.length - pdfs.length;
    setNotice(unsupported
      ? `${unsupported} andere Datei(en) nicht in die PDF-Liste aufgenommen. Word und Text bitte über den dafür vorgesehenen Einzelimport übernehmen.`
      : pdfs.length ? `${pdfs.length} PDF-Datei(en) zur Prüfung ausgewählt. Noch nicht gespeichert.` : "Keine PDF-Datei ausgewählt.");
    if (pdfs.length) onFiles(pdfs);
  };
  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="PDF-Dateien für diesen Fall auswählen oder hineinziehen"
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${disabled ? "border-border bg-muted/30" : dragging ? "border-primary bg-primary/15" : "cursor-pointer border-primary/40 bg-primary/5 hover:bg-primary/10"}`}
        onClick={() => { if (!disabled) onSelectFiles(); }}
        onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectFiles(); } }}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; setDragging(!disabled); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault(); setDragging(false);
          if ([...event.dataTransfer.items].some(item => typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory)) {
            setNotice("Für einen Ordner bitte die Schaltfläche „Ordner mit PDFs auswählen“ verwenden."); return;
          }
          acceptFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <FileUp className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="font-semibold">PDFs eines Patientenfalls hier hineinziehen</p>
        <p className="mt-1 text-sm text-muted-foreground">Oder hier klicken und mehrere Dateien auswählen.</p>
        {disabled && <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">{disabledReason}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf,.pdf" multiple className="hidden" aria-label="Lokalen Ordner mit PDFs auswählen"
          ref={input => { folderRef.current = input; input?.setAttribute("webkitdirectory", ""); }}
          onChange={event => { const selected = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; acceptFiles(selected); }} />
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => folderRef.current?.click()} className="gap-2">
          <FolderOpen className="h-4 w-4" /> Ordner mit PDFs auswählen
        </Button>
        <p className="text-xs text-muted-foreground">Eine Ablage unter Dokumente ist optional. Erst deine Auswahl startet die Prüfung; ein Ordner wird nicht automatisch überwacht.</p>
      </div>
      {notice && <p role="status" className="rounded-md border bg-background p-2 text-sm">{notice}</p>}
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        <li><strong>1. Zuordnen:</strong> Dokumentart und Datum je Datei kontrollieren.</li>
        <li><strong>2. Prüfen:</strong> Dateien auslesen und jede Datenschutzvorschau prüfen.</li>
        <li><strong>3. Übernehmen:</strong> Geprüfte Inhalte passend übernehmen und Speicherbestätigung abwarten.</li>
      </ol>
    </div>
  );
}
