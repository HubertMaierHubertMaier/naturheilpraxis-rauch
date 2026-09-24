import { useRef, useState } from "react";
import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLINICAL_DOCUMENT_ACCEPT, isSupportedClinicalDocument } from "@/lib/clinicalDocumentFormats";

type Props = {
  disabled: boolean;
  disabledReason: string;
  onSelectFiles: () => void;
  onFiles: (files: File[]) => void;
  mode?: "single" | "batch";
  onModeChange?: (mode: "single" | "batch") => void;
  selectionLocked?: boolean;
  hasSelection?: boolean;
};

export function PatientBatchUploadZone({ disabled, disabledReason, onSelectFiles, onFiles, mode = "batch", onModeChange, selectionLocked = false, hasSelection = false }: Props) {
  const folderRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const acceptFiles = (selected: File[]) => {
    if (disabled) { setNotice(disabledReason); return; }
    if (mode === "single" && selected.length > 1) { setNotice("Für mehrere Dateien bitte die Sammeleingabe wählen. Es wurde keine Datei übernommen."); return; }
    const documents = selected.filter(isSupportedClinicalDocument);
    const unsupported = selected.length - documents.length;
    setNotice(unsupported
      ? `${unsupported} nicht unterstützte Datei(en). Unterstützt werden PDF, Word (.docx) und Excel (.xlsx).`
      : documents.length ? `${documents.length} Dokument(e) zur Prüfung ausgewählt. Noch nicht gespeichert.` : "Kein unterstütztes Dokument ausgewählt.");
    if (documents.length) onFiles(documents);
  };
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Dokumente einzeln oder gesammelt übernehmen" className="grid gap-3 sm:grid-cols-2">
        {([
          ["single", "Einzeleingabe", "Eine PDF-, Word- oder Excel-Datei zuordnen, nachschwärzen und übernehmen."],
          ["batch", "Sammeleingabe", "PDF, Word und Excel eines Falls gemeinsam auswählen und einzeln prüfen."],
        ] as const).map(([value, title, description]) => <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={selectionLocked} onClick={() => onModeChange?.(value)} className={`rounded-xl border-2 p-4 text-left transition-all ${mode === value ? "border-blue-600 bg-blue-600 text-white shadow-lg dark:border-blue-500 dark:bg-blue-500" : "border-border bg-background hover:border-primary/40"}`}><span className="block text-base font-semibold">{title}</span><span className={`mt-1 block text-sm ${mode === value ? "text-white/90" : "text-muted-foreground"}`}>{description}</span></button>)}
      </div>
      {selectionLocked && <p className="text-xs text-muted-foreground">Die aktuelle Dateiauswahl bleibt erhalten. Vor einem Wechsel diese Auswahl übernehmen oder bewusst entfernen.</p>}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>Vorschau aktualisieren</Button>
        <span className="text-xs font-medium text-muted-foreground">nur Vorschau – keine Veröffentlichung</span>
      </div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="PDF-, Word- und Excel-Dateien für diesen Fall auswählen oder hineinziehen"
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${disabled ? "border-border bg-muted/30" : dragging ? "border-primary bg-primary/15" : "cursor-pointer border-primary/40 bg-primary/5 hover:bg-primary/10"}`}
        onClick={() => { if (!disabled) onSelectFiles(); }}
        onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectFiles(); } }}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; setDragging(!disabled); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault(); setDragging(false);
          if ([...event.dataTransfer.items].some(item => typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory)) {
            setNotice(mode === "single" ? "Für einen Ordner zuerst die Sammeleingabe wählen und dort „Ordner mit Dokumenten auswählen“ verwenden." : "Für einen Ordner bitte die Schaltfläche „Ordner mit Dokumenten auswählen“ verwenden."); return;
          }
          acceptFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <FileUp className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="font-semibold">{mode === "single" ? "Ein Dokument dieses Patientenfalls hier hineinziehen" : "PDF-, Word- und Excel-Dateien dieses Patientenfalls hier hineinziehen"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "single" ? "Oder hier klicken und ein Dokument auswählen." : "Oder hier klicken und mehrere Dokumente auswählen."}</p>
        {disabled && <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">{disabledReason}</p>}
      </div>
      {mode === "batch" && <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept={CLINICAL_DOCUMENT_ACCEPT} multiple className="hidden" aria-label="Lokalen Ordner mit Dokumenten auswählen"
          ref={input => { folderRef.current = input; input?.setAttribute("webkitdirectory", ""); }}
          onChange={event => { const selected = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; acceptFiles(selected); }} />
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => folderRef.current?.click()} className={`gap-2 ${hasSelection ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white dark:border-blue-500 dark:bg-blue-500" : !disabled ? "border-primary/50 bg-primary/5 text-primary animate-pulse" : ""}`}>
          <FolderOpen className="h-4 w-4" /> Ordner mit Dokumenten auswählen
        </Button>
        <p className="text-xs text-muted-foreground">Eine Ablage unter Dokumente ist optional. Erst deine Auswahl startet die Prüfung; ein Ordner wird nicht automatisch überwacht.</p>
      </div>}
      {notice && <p role="status" className="rounded-md border bg-background p-2 text-sm">{notice}</p>}
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        <li><strong>1. Zuordnen:</strong> Dokumentart und Datum je Datei kontrollieren.</li>
        <li><strong>2. Nachschwärzen und prüfen:</strong> Vorhandene lokale Schwärzung anwenden und die vollständige Datenschutzvorschau prüfen.</li>
        <li><strong>3. Übernehmen:</strong> Geprüfte Inhalte passend übernehmen und Speicherbestätigung abwarten.</li>
      </ol>
    </div>
  );
}
