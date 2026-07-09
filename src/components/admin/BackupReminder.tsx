import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ShieldCheck, Download } from "lucide-react";

type Status = "ok" | "warn" | "crit";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function statusFor(iso: string | null, warnDays: number, critDays: number): Status {
  const d = daysSince(iso);
  if (d === null) return "crit";
  if (d >= critDays) return "crit";
  if (d >= warnDays) return "warn";
  return "ok";
}

function formatRel(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "noch nie gesichert";
  if (d === 0) return "heute gesichert";
  if (d === 1) return "gestern gesichert";
  return `vor ${d} Tagen gesichert`;
}

function scrollToBackupTab() {
  const trigger = document.querySelector<HTMLElement>('[data-radix-collection-item][value="backup"], [role="tab"][value="backup"]');
  if (trigger) {
    trigger.click();
    setTimeout(() => trigger.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    return;
  }
  // Fallback: manuell finden
  const tabs = document.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs.forEach((el) => {
    if (el.textContent?.trim().toLowerCase().includes("backup")) {
      el.click();
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  });
}

/**
 * Sichtbare Backup-Erinnerung für Admins.
 * Liest die Zeitstempel aus localStorage (werden vom BackupCenter gesetzt).
 * - ≥ 7 Tage → gelbe Warnung
 * - ≥ 30 Tage oder nie → rote Warnung
 * - < 7 Tage → grüner Bestätigungs-Balken (dezent)
 */
export function BackupReminder() {
  const [lastFull, setLastFull] = useState<string | null>(null);
  const [lastGithub, setLastGithub] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const read = () => {
      setLastFull(localStorage.getItem("backup:lastFull"));
      setLastGithub(localStorage.getItem("backup:lastGithub"));
      const snoozeUntil = localStorage.getItem("backup:reminderSnoozeUntil");
      setDismissed(snoozeUntil ? Date.parse(snoozeUntil) > Date.now() : false);
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("backup:")) read();
    };
    window.addEventListener("storage", onStorage);
    const iv = window.setInterval(read, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(iv);
    };
  }, []);

  const fullStatus = statusFor(lastFull, 7, 30);
  const codeStatus = statusFor(lastGithub, 14, 60);
  const worst: Status =
    fullStatus === "crit" || codeStatus === "crit"
      ? "crit"
      : fullStatus === "warn" || codeStatus === "warn"
      ? "warn"
      : "ok";

  const snooze = (days: number) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("backup:reminderSnoozeUntil", until);
    setDismissed(true);
  };

  if (worst === "ok") {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-900 dark:text-emerald-200">
          Sicherungen aktuell
        </AlertTitle>
        <AlertDescription className="text-sm text-emerald-900/80 dark:text-emerald-200/80">
          Daten-Backup: {formatRel(lastFull)} · Code-Backup: {formatRel(lastGithub)}.
          Nächste Sicherung in ca. {Math.max(0, 7 - (daysSince(lastFull) ?? 0))} Tagen empfohlen.
        </AlertDescription>
      </Alert>
    );
  }

  if (dismissed && worst === "warn") {
    return null;
  }

  const isCrit = worst === "crit";
  return (
    <Alert
      variant={isCrit ? "destructive" : "default"}
      className={
        isCrit
          ? "border-2 border-destructive shadow-lg"
          : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
      }
    >
      <AlertTriangle
        className={`h-5 w-5 ${isCrit ? "" : "text-amber-600"}`}
      />
      <AlertTitle className={`text-base font-bold ${isCrit ? "" : "text-amber-900 dark:text-amber-200"}`}>
        {isCrit ? "🚨 Backup überfällig — jetzt sichern!" : "⚠️ Backup-Erinnerung"}
      </AlertTitle>
      <AlertDescription className={`space-y-3 text-sm ${isCrit ? "" : "text-amber-900/90 dark:text-amber-200/90"}`}>
        <div className="grid gap-1 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              <strong>Daten-Backup:</strong> {formatRel(lastFull)}
              {fullStatus === "crit" && " ❗"}
              {fullStatus === "warn" && " ⚠️"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              <strong>Code-Backup:</strong> {formatRel(lastGithub)}
              {codeStatus === "crit" && " ❗"}
              {codeStatus === "warn" && " ⚠️"}
            </span>
          </div>
        </div>
        <p>
          Empfehlung: <strong>mindestens 1× pro Woche</strong> ein Voll-Backup ziehen.
          Ohne aktuelles Backup ist im Notfall keine vollständige Wiederherstellung möglich.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={scrollToBackupTab}
            className={isCrit ? "" : "bg-amber-600 hover:bg-amber-700 text-white"}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Jetzt zum Backup-Center
          </Button>
          {!isCrit && (
            <>
              <Button size="sm" variant="ghost" onClick={() => snooze(1)}>
                Morgen erinnern
              </Button>
              <Button size="sm" variant="ghost" onClick={() => snooze(7)}>
                In 7 Tagen erinnern
              </Button>
            </>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default BackupReminder;
