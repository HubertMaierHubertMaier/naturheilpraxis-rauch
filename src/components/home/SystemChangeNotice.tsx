import { Sparkles, X } from "lucide-react";
import { useState } from "react";

export function SystemChangeNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
      <div className="container py-4 md:py-5">
        <div className="flex items-start gap-3 md:items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 md:h-10 md:w-10">
            <Sparkles className="h-4 w-4 text-amber-600 md:h-5 md:w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 md:text-base">
              Neu ab sofort: Noch persönlicher auf Ihre Bedürfnisse zugeschnitten
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              Wir haben unsere App umgestellt, damit jeder genau die Inhalte sieht, die für ihn passen. 
              Ob Sie sich nur informieren möchten, als Neupatient starten oder bereits in Behandlung sind — 
              wählen Sie einfach Ihren Zugang. Alle wichtigen Funktionen bleiben erhalten, 
              nur noch übersichtlicher.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-lg p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
            aria-label="Hinweis schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
