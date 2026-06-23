import { AlertCircle } from "lucide-react";

interface SpamFolderHintProps {
  email: string;
  language: "de" | "en";
}

const PICKY_PROVIDERS = [
  "freenet.de",
  "web.de",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "t-online.de",
  "1und1.de",
  "1and1.de",
];

export function SpamFolderHint({ email, language }: SpamFolderHintProps) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || !PICKY_PROVIDERS.includes(domain)) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex gap-2 items-start">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        {language === "de" ? (
          <>
            <strong>Hinweis für {domain}:</strong> Mails von dort werden häufig
            verzögert zugestellt oder in den <strong>Spam-Ordner</strong>{" "}
            verschoben. Bitte auch dort nachsehen, falls nach ein paar Minuten
            kein Code da ist.
          </>
        ) : (
          <>
            <strong>Note for {domain}:</strong> This provider often delays
            emails or sends them to the <strong>spam folder</strong>. Please
            check there if the code does not arrive within a few minutes.
          </>
        )}
      </div>
    </div>
  );
}
