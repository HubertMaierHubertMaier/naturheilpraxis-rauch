import { usePatientLoginEnabled } from "@/hooks/usePatientLoginEnabled";
import { Lock } from "lucide-react";

/**
 * Öffentlich sichtbarer Hinweis, wenn die Patienten-Anmeldung
 * derzeit gesperrt ist. Die Infothek bleibt frei zugänglich.
 */
export function LoginDisabledBanner() {
  const { enabled, loading } = usePatientLoginEnabled();
  if (loading || enabled) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 text-red-900">
      <div className="container flex items-center gap-2 py-2 text-sm">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>Hinweis:</strong> Die Online-Anmeldung für Patientinnen und Patienten
          ist derzeit nicht möglich. Die <strong>Infothek</strong> bleibt frei zugänglich.
          Bitte kontaktieren Sie die Praxis telefonisch.
        </span>
      </div>
    </div>
  );
}
