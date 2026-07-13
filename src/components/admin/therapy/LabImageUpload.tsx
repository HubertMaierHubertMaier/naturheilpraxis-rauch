import { ShieldAlert } from "lucide-react";

interface Props {
  onExtracted: (text: string) => void;
  mode?: "lab" | "doctor";
}

export function LabImageUpload(_props: Props) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Datenschutzmodus:</strong> Foto-, Screenshot- und Scan-OCR ist deaktiviert, weil ein ungeschwärztes Bild sonst vor der Anonymisierung an einen externen KI-Dienst übertragen würde. Bitte Werte manuell eintragen oder eine textlesbare PDF über den sicheren PDF-Import verwenden.
      </span>
    </div>
  );
}
