import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Database,
  HardDrive,
  Key,
  RefreshCw,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  Github,
  Upload,
  Copy,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Clock,
  Table,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Stats = {
  generatedAt: string;
  tables: Array<{ name: string; rows: number }>;
  buckets: Array<{ name: string; files: number; totalBytes: number }>;
  secrets: string[];
};

type StorageList = Record<string, Array<{ path: string; size: number; signedUrl: string }>>;

const REQUIRED_SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_JWKS",
  "SUPABASE_DB_URL",
  "LOVABLE_API_KEY",
  "ELEVENLABS_API_KEY",
  "RELAY_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isoTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function getFunctionsUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (supabaseUrl) return supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
  if (projectRef) return `https://${projectRef}.functions.supabase.co`;
  throw new Error("Supabase URL / Project-ID nicht verfügbar");
}

function getApiKey(): string {
  return (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    ""
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function BackupCenter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"db" | "full" | null>(null);
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<
    | { ok: true; filename: string; size: number; durationSec: number; warnings: number }
    | { ok: false; message: string }
    | null
  >(null);
  const [githubRepo, setGithubRepo] = useState<string>("");
  const [githubBranch, setGithubBranch] = useState<string>("main");
  const [savingRepo, setSavingRepo] = useState(false);
  const [lastFullBackup, setLastFullBackup] = useState<string | null>(null);
  const [lastDbBackup, setLastDbBackup] = useState<string | null>(null);
  const [lastGithubZip, setLastGithubZip] = useState<string | null>(null);
  const [oneClickRunning, setOneClickRunning] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const log = (line: string) => {
    setLogLines((prev) => {
      const next = [...prev, `[${new Date().toLocaleTimeString()}] ${line}`];
      return next.slice(-200);
    });
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, 0);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-export?mode=stats", {
        method: "GET",
      });
      if (error) throw error;
      setStats(data as Stats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Übersicht konnte nicht geladen werden: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const loadGithubRepo = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "github_repo")
      .maybeSingle();
    const v = (data?.value as { owner_repo?: string; branch?: string } | null) ?? null;
    if (v?.owner_repo) setGithubRepo(v.owner_repo);
    if (v?.branch) setGithubBranch(v.branch);
  };

  const saveGithubRepo = async () => {
    const cleaned = githubRepo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
    if (!/^[^/\s]+\/[^/\s]+$/.test(cleaned)) {
      toast.error("Bitte als `besitzer/repo` eingeben (z. B. `peter-rauch/naturheilpraxis`).");
      return;
    }
    setSavingRepo(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(
        { key: "github_repo", value: { owner_repo: cleaned, branch: githubBranch.trim() || "main" } },
        { onConflict: "key" },
      );
      if (error) throw error;
      setGithubRepo(cleaned);
      toast.success("GitHub-Repo gespeichert.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Speichern fehlgeschlagen: ${msg}`);
    } finally {
      setSavingRepo(false);
    }
  };

  const downloadGithubZip = () => {
    const cleaned = githubRepo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
    if (!/^[^/\s]+\/[^/\s]+$/.test(cleaned)) {
      toast.error("Erst Repo-Pfad speichern (Format `besitzer/repo`).");
      return;
    }
    const branch = githubBranch.trim() || "main";
    const url = `https://github.com/${cleaned}/archive/refs/heads/${encodeURIComponent(branch)}.zip`;
    window.open(url, "_blank", "noopener");
    markDone("lastGithub");
    toast.success("GitHub-ZIP-Download gestartet (neuer Tab).");
  };

  useEffect(() => {
    loadStats();
    loadGithubRepo();
    setLastFullBackup(localStorage.getItem("backup:lastFull"));
    setLastDbBackup(localStorage.getItem("backup:lastDb"));
    setLastGithubZip(localStorage.getItem("backup:lastGithub"));
  }, []);

  const markDone = (key: "lastFull" | "lastDb" | "lastGithub") => {
    const iso = new Date().toISOString();
    localStorage.setItem(`backup:${key}`, iso);
    if (key === "lastFull") setLastFullBackup(iso);
    if (key === "lastDb") setLastDbBackup(iso);
    if (key === "lastGithub") setLastGithubZip(iso);
  };

  const ageInDays = (iso: string | null): number | null => {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const formatRelative = (iso: string | null): string => {
    if (!iso) return "noch nie";
    const days = ageInDays(iso) ?? 0;
    if (days === 0) return "heute";
    if (days === 1) return "gestern";
    if (days < 30) return `vor ${days} Tagen`;
    if (days < 365) return `vor ${Math.floor(days / 30)} Mon.`;
    return `vor ${Math.floor(days / 365)} J.`;
  };

  const statusOf = (iso: string | null, warnDays: number, critDays: number) => {
    const days = ageInDays(iso);
    if (days === null) return "crit" as const;
    if (days >= critDays) return "crit" as const;
    if (days >= warnDays) return "warn" as const;
    return "ok" as const;
  };

  async function getToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Keine aktive Sitzung. Bitte neu anmelden.");
    return token;
  }

  async function fetchDbZipBytes(token: string): Promise<{ bytes: ArrayBuffer; filename: string }> {
    const url = `${getFunctionsUrl()}/backup-export?mode=db`;
    const apikey = getApiKey();
    log("Lade Datenbank-Export von Server…");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, apikey },
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json())?.error ?? "";
      } catch {
        /* ignore */
      }
      throw new Error(`DB-Export HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    const buf = await res.arrayBuffer();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `db-backup.zip`;
    log(`Datenbank-ZIP empfangen (${formatBytes(buf.byteLength)}).`);
    return { bytes: buf, filename };
  }

  const downloadDbBackup = async () => {
    setDownloading("db");
    setProgress(0);
    setLogLines([]);
    setLastResult(null);
    const started = Date.now();
    try {
      const token = await getToken();
      setProgress(20);
      const { bytes, filename } = await fetchDbZipBytes(token);
      setProgress(100);
      const fn = `naturheilpraxis-backup-db-${isoTimestamp()}.zip`;
      saveBlob(new Blob([bytes], { type: "application/zip" }), fn);
      const dur = Math.round((Date.now() - started) / 1000);
      log(`Fertig: ${fn} gespeichert.`);
      setLastResult({ ok: true, filename: fn, size: bytes.byteLength, durationSec: dur, warnings: 0 });
      markDone("lastDb");
      toast.success(`Schnell-Backup heruntergeladen (${formatBytes(bytes.byteLength)}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      log(`FEHLER: ${msg}`);
      setLastResult({ ok: false, message: msg });
      toast.error(`Backup fehlgeschlagen: ${msg}`);
    } finally {
      setDownloading(null);
    }
  };

  const downloadFullBackup = async () => {
    setDownloading("full");
    setProgress(0);
    setLogLines([]);
    setLastResult(null);
    const started = Date.now();
    let warnings = 0;
    try {
      const token = await getToken();

      // 1) DB-ZIP holen und entpacken (wir packen alles neu zusammen)
      const { bytes: dbBytes } = await fetchDbZipBytes(token);
      const zip = await JSZip.loadAsync(dbBytes);
      setProgress(10);

      // 2) Storage-Liste mit signierten URLs holen
      log("Hole Storage-Datei-Liste mit signierten URLs…");
      const apikey = getApiKey();
      const listRes = await fetch(`${getFunctionsUrl()}/backup-export?mode=storage-list`, {
        headers: { Authorization: `Bearer ${token}`, apikey },
      });
      if (!listRes.ok) {
        let detail = "";
        try {
          detail = (await listRes.json())?.error ?? "";
        } catch {
          /* ignore */
        }
        throw new Error(`Storage-Liste HTTP ${listRes.status}${detail ? ` — ${detail}` : ""}`);
      }
      const storage = (await listRes.json()) as StorageList;

      const allFiles: Array<{ bucket: string; path: string; size: number; signedUrl: string }> = [];
      for (const [bucket, files] of Object.entries(storage)) {
        for (const f of files) allFiles.push({ bucket, ...f });
      }
      const totalBytes = allFiles.reduce((a, f) => a + f.size, 0);
      log(`Gefunden: ${allFiles.length} Dateien · ${formatBytes(totalBytes)}.`);
      setProgress(15);

      // 3) Dateien parallel (kontrolliert) herunterladen
      const CONCURRENCY = 4;
      let done = 0;
      let downloadedBytes = 0;

      const queue = [...allFiles];
      async function worker() {
        while (queue.length) {
          const f = queue.shift();
          if (!f) break;
          try {
            const r = await fetch(f.signedUrl);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = new Uint8Array(await r.arrayBuffer());
            zip.file(`storage/${f.bucket}/${f.path}`, buf);
            downloadedBytes += buf.length;
          } catch (e) {
            warnings++;
            const msg = e instanceof Error ? e.message : String(e);
            zip.file(`storage/${f.bucket}/${f.path}.ERROR.txt`, msg);
            log(`⚠ ${f.bucket}/${f.path}: ${msg}`);
          } finally {
            done++;
            const pct = 15 + Math.round((done / Math.max(1, allFiles.length)) * 70);
            setProgress(pct);
            if (done % 5 === 0 || done === allFiles.length) {
              log(
                `Storage ${done}/${allFiles.length} (${formatBytes(downloadedBytes)} geladen)`,
              );
            }
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      // 4) ZIP final bauen und speichern
      log("Packe finales ZIP…");
      setProgress(90);
      const finalBlob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (meta) => {
          if (meta.percent) setProgress(90 + Math.min(9, Math.round(meta.percent / 11)));
        },
      );
      setProgress(100);
      const fn = `naturheilpraxis-backup-FULL-${isoTimestamp()}.zip`;
      saveBlob(finalBlob, fn);
      const dur = Math.round((Date.now() - started) / 1000);
      log(`Fertig: ${fn} gespeichert (${formatBytes(finalBlob.size)} in ${dur}s).`);
      setLastResult({ ok: true, filename: fn, size: finalBlob.size, durationSec: dur, warnings });
      markDone("lastFull");
      markDone("lastDb");
      if (warnings === 0) {
        toast.success(`Voll-Backup heruntergeladen (${formatBytes(finalBlob.size)}).`);
      } else {
        toast.warning(
          `Voll-Backup heruntergeladen (${formatBytes(finalBlob.size)}) — ${warnings} Datei(en) mit Fehler.`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      log(`FEHLER: ${msg}`);
      setLastResult({ ok: false, message: msg });
      toast.error(`Voll-Backup fehlgeschlagen: ${msg}`);
    } finally {
      setDownloading(null);
    }
  };

  const runOneClick = async () => {
    if (downloading || oneClickRunning) return;
    setOneClickRunning(true);
    try {
      toast.info("Schritt 1/2: Voll-Backup wird erstellt…");
      await downloadFullBackup();
      // give browser a tick before triggering 2nd download
      await new Promise((r) => setTimeout(r, 800));
      if (githubRepo.trim()) {
        toast.info("Schritt 2/2: GitHub-Code-ZIP wird gestartet…");
        downloadGithubZip();
      } else {
        toast.warning("GitHub-Repo nicht gesetzt — Code-ZIP übersprungen. Bitte unten Repo eintragen.");
      }
    } finally {
      setOneClickRunning(false);
    }
  };

  const totalRows = stats?.tables.reduce((acc, t) => acc + Math.max(0, t.rows), 0) ?? 0;
  const totalFiles = stats?.buckets.reduce((acc, b) => acc + Math.max(0, b.files), 0) ?? 0;
  const totalBytes = stats?.buckets.reduce((acc, b) => acc + b.totalBytes, 0) ?? 0;

  const fullStatus = statusOf(lastFullBackup, 7, 30);
  const githubStatus = statusOf(lastGithubZip, 14, 60);
  const dot = (s: "ok" | "warn" | "crit") =>
    s === "ok" ? "bg-emerald-500" : s === "warn" ? "bg-amber-500" : "bg-destructive";

  return (
    <div className="space-y-6">
      {/* IDIOTENSICHER: 1-Klick Routine ganz oben */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sicherungs-Routine — 1 Klick, alles erledigt
          </CardTitle>
          <CardDescription>
            Drücke <strong>einmal</strong> auf den grünen Knopf. Das System lädt nacheinander{" "}
            <strong>Voll-Backup</strong> (alle Patientendaten + Dateien) und{" "}
            <strong>Code-ZIP</strong> (gesamte App von GitHub) in deinen Download-Ordner.
            Empfehlung: <strong>1× pro Woche</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="lg"
            onClick={runOneClick}
            disabled={downloading !== null || oneClickRunning}
            className="h-auto w-full flex-col gap-1 py-6 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <div className="flex items-center gap-2">
              <Download className="h-6 w-6" />
              <span className="font-bold">
                {oneClickRunning || downloading ? "Sicherung läuft… bitte Tab offen lassen" : "Jetzt komplett sichern (1 Klick)"}
              </span>
            </div>
            <span className="text-xs font-normal opacity-90">
              Daten-Backup + Code-Backup nacheinander · Browser fragt 2× nach Speichern
            </span>
          </Button>

          {/* Ampel-Status: wann zuletzt gesichert? */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dot(fullStatus)}`} aria-hidden />
                <span className="font-medium">Daten-Backup (Voll)</span>
              </div>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatRelative(lastFullBackup)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dot(githubStatus)}`} aria-hidden />
                <span className="font-medium">Code-Backup (GitHub-ZIP)</span>
              </div>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatRelative(lastGithubZip)}
              </span>
            </div>
          </div>

          {(fullStatus === "crit" || githubStatus === "crit") && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sicherung überfällig!</AlertTitle>
              <AlertDescription className="text-sm">
                Mindestens ein Backup ist älter als 30 Tage (oder wurde nie gemacht).
                Bitte jetzt den grünen Knopf drücken.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded border bg-background p-3 text-sm">
            <p className="mb-2 font-medium">So lagerst du die 2 ZIP-Dateien sicher:</p>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>Beide ZIPs aus dem Download-Ordner an <strong>2 getrennte Orte</strong> kopieren:
                z. B. <strong>USB-Stick</strong> + <strong>externe Festplatte</strong> (oder verschlüsselter Cloud-Ordner).</li>
              <li>Mindestens den USB-Stick mit <strong>VeraCrypt</strong> verschlüsseln (enthält Gesundheitsdaten).</li>
              <li>Alte Backups älter als 10 Jahre <strong>sicher löschen</strong> (DSGVO).</li>
            </ol>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Wann brauchst du das?</AlertTitle>
            <AlertDescription className="text-sm">
              Wenn etwas kaputtgeht, ziehst du die ZIP-Datei einfach in den Lovable-Chat und schreibst
              „Bitte wiederherstellen". Details und Profi-Optionen findest du in den Abschnitten unten.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Was-ist-wo Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Table className="h-5 w-5 text-primary" />
            Was ist wo? — Übersicht aller Backup-Bestandteile
          </CardTitle>
          <CardDescription>
            Damit du im Ernstfall sofort weißt, welche Datei was enthält und wo du sie herbekommst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Wenn das weg ist…</th>
                  <th className="px-3 py-2 text-left font-medium">Finde ich hier</th>
                  <th className="px-3 py-2 text-left font-medium">Dateiname / Quelle</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-background">
                  <td className="px-3 py-2.5 font-medium">Code (React, Edge Functions, Infothek-HTMLs)</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <Github className="h-3 w-3" />
                      GitHub-ZIP
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>{`${githubRepo || "<besitzer/repo>"}-main.zip`}</code>
                  </td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">Datenbank-Tabellen (Patienten, Anamnesen, FAQs…)</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <Database className="h-3 w-3" />
                      Schnell-Backup
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>naturheilpraxis-backup-db-*.zip</code>
                  </td>
                </tr>
                <tr className="bg-background">
                  <td className="px-3 py-2.5 font-medium">Hochgeladene Dateien (PDFs, MP3s, MP4s, Befunde)</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <HardDrive className="h-3 w-3" />
                      Voll-Backup
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>naturheilpraxis-backup-FULL-*.zip</code>
                  </td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">Patienten-Login-Konten (Auth / UUIDs)</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <Download className="h-3 w-3" />
                      In jedem ZIP
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>auth/users.json</code>
                  </td>
                </tr>
                <tr className="bg-background">
                  <td className="px-3 py-2.5 font-medium">Secrets (API-Keys, SMTP, Relay-Passwörter)</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <Key className="h-3 w-3" />
                      In jedem ZIP
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>SECRETS-CHECKLISTE.txt</code>
                  </td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">Schritt-für-Schritt-Wiederherstellung</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="gap-1">
                      <Info className="h-3 w-3" />
                      In jedem ZIP
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <code>BACKUP-MANIFEST.md</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hinweis: Das Voll-Backup enthält <strong>alles</strong> (DB + Dateien + Auth + Manifest + Secrets-Checkliste).
            Das Schnell-Backup enthält nur die Datenbank — ist dafür sekundenschnell und klein.
          </p>
        </CardContent>
      </Card>

      <Card>

        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-5 w-5 text-muted-foreground" />
            Einzel-Backups (für Profis)
          </CardTitle>
          <CardDescription>
            Brauchst du nur einen Teil? Hier kannst du <em>Schnell-Backup</em> (nur Datenbank, sekundenschnell)
            oder <em>Voll-Backup</em> (Datenbank + alle Dateien) separat starten. Für den Alltag reicht
            der grüne Knopf ganz oben.
          </CardDescription>

        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={downloadDbBackup}
              disabled={downloading !== null}
              className="h-auto flex-col gap-2 py-5"
            >
              <Database className="h-6 w-6" />
              <span className="font-semibold leading-tight">Schnell-Backup</span>
              <span className="text-xs opacity-90 leading-tight">
                {downloading === "db"
                  ? "Wird erstellt…"
                  : `Nur Datenbank · ≈ ${totalRows} Zeilen · sekundenschnell`}
              </span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={downloadFullBackup}
              disabled={downloading !== null}
              className="h-auto flex-col gap-2 py-5"
            >
              <HardDrive className="h-6 w-6" />
              <span className="font-semibold leading-tight">Voll-Backup</span>
              <span className="text-xs opacity-90 leading-tight">
                {downloading === "full"
                  ? "Wird erstellt… (kann dauern)"
                  : `DB + Dateien · ≈ ${totalFiles} Dateien · ${formatBytes(totalBytes)}`}
              </span>
            </Button>
          </div>

          {downloading && (
            <div className="space-y-2 rounded border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {downloading === "db" ? "Schnell-Backup läuft…" : "Voll-Backup läuft…"}
                </span>
                <span className="tabular-nums text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
              <div
                ref={logRef}
                className="max-h-40 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-tight"
              >
                {logLines.length === 0 ? (
                  <span className="text-muted-foreground">Starte…</span>
                ) : (
                  logLines.map((l, i) => <div key={i}>{l}</div>)
                )}
              </div>
            </div>
          )}

          {!downloading && lastResult && (
            <Alert variant={lastResult.ok ? "default" : "destructive"}>
              {lastResult.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {lastResult.ok
                  ? lastResult.warnings > 0
                    ? "Backup mit Warnungen abgeschlossen"
                    : "Backup erfolgreich abgeschlossen"
                  : "Backup fehlgeschlagen"}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {lastResult.ok ? (
                  <>
                    Datei <code>{lastResult.filename}</code> wurde in deinen Browser-Download-Ordner
                    gespeichert · {formatBytes(lastResult.size)} · {lastResult.durationSec}s
                    {lastResult.warnings > 0 && ` · ${lastResult.warnings} Datei(en) mit Fehler (siehe ERROR.txt im ZIP)`}
                  </>
                ) : (
                  (lastResult as { ok: false; message: string }).message
                )}
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>So nutzt du das Backup</AlertTitle>
            <AlertDescription className="space-y-1 text-sm">
              <p>
                Das ZIP enthält jede Tabelle als <code>.csv</code> (Excel) <em>und</em>{" "}
                <code>.json</code> (zum maschinellen Wieder-Einspielen), eine{" "}
                <code>BACKUP-MANIFEST.md</code> mit Schritt-für-Schritt-Wiederherstellung und eine{" "}
                <code>SECRETS-CHECKLISTE.txt</code> mit allen Secret-Namen.
              </p>
              <p className="text-muted-foreground">
                Lege die Datei auf <strong>2 Speichermedien</strong> ab (z. B. lokaler Ordner + USB
                / NAS). Verschlüsselt aufbewahren — enthält Gesundheitsdaten.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* GitHub-Repo-ZIP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-5 w-5 text-primary" />
            Code-Backup (GitHub-Repository als ZIP)
          </CardTitle>
          <CardDescription>
            Lädt den kompletten Source-Code (React-App, Edge Functions, Migrationen, Skripte,
            statische Infothek-HTMLs, Therapie-PDFs) als ZIP direkt von GitHub. Ergänzt das
            Daten-Backup oben — gemeinsam ergibt das eine 100%ige Wiederherstellungs-Basis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <div className="space-y-1">
              <Label htmlFor="gh-repo" className="text-xs">Repository (Format: <code>besitzer/repo</code>)</Label>
              <Input
                id="gh-repo"
                placeholder="z. B. peter-rauch/naturheilpraxis"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gh-branch" className="text-xs">Branch</Label>
              <Input
                id="gh-branch"
                placeholder="main"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={saveGithubRepo} disabled={savingRepo}>
                {savingRepo ? "Speichere…" : "Speichern"}
              </Button>
            </div>
          </div>
          <Button onClick={downloadGithubZip} className="w-full sm:w-auto" disabled={!githubRepo.trim()}>
            <Download className="mr-2 h-4 w-4" />
            GitHub-ZIP herunterladen
            <ExternalLink className="ml-2 h-3 w-3 opacity-70" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Lädt <code>https://github.com/{githubRepo || "<besitzer>/<repo>"}/archive/refs/heads/{githubBranch || "main"}.zip</code>.
            Funktioniert nur bei öffentlichen Repos ohne Login; bei privaten musst du bei GitHub eingeloggt sein.
          </p>
        </CardContent>
      </Card>

      {/* Restore-Anleitung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-primary" />
            Wiederherstellung — so gibst du mir die Daten zurück
          </CardTitle>
          <CardDescription>
            Wenn etwas verloren geht (von „Tabelle leer" bis „Totalausfall"), führst du mir die
            gesicherten Dateien einfach per Lovable-Chat wieder zu. Kein extra Upload-Knopf nötig
            — Lovable kann Dateianhänge im Chat direkt lesen und einspielen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            <li>Öffne diese App in Lovable (Build-Modus, Chat sichtbar).</li>
            <li>
              Ziehe die gewünschten Dateien in den Chat:
              <ul className="ml-5 mt-1 list-disc text-muted-foreground">
                <li><code>naturheilpraxis-backup-FULL-*.zip</code> (DB + Auth-User + Storage)</li>
                <li>oder <code>naturheilpraxis-backup-db-*.zip</code> (nur DB + Auth-User)</li>
                <li>plus ggf. <code>&lt;repo&gt;-main.zip</code> von GitHub (nur wenn auch der Code weg ist)</li>
              </ul>
            </li>
            <li>Schreibe in den Chat den fertigen Prompt unten (oder eigene Formulierung).</li>
            <li>Ich (Lovable) lese ZIP-Inhalt + Manifest, mache einen Plan und frage dich vor jedem destruktiven Schritt um Bestätigung.</li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Copy-&-Paste-Prompt für mich</Label>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const txt = `Bitte spiele dieses Backup wieder ein. Lies zuerst BACKUP-MANIFEST.md und stats.json im Anhang. Zeige mir dann eine Übersicht (Tabellen + Zeilenzahlen, Auth-User-Anzahl, Storage-Dateien) UND frage mich VOR jedem destruktiven Schritt um Bestätigung (insbesondere vor TRUNCATE/DELETE auf bestehenden Tabellen). Reihenfolge: 1) Schema prüfen, 2) Auth-User wiederherstellen (gleiche IDs!), 3) Tabellen in Foreign-Key-Reihenfolge importieren, 4) Storage-Dateien hochladen.`;
                  navigator.clipboard.writeText(txt).then(
                    () => toast.success("Prompt kopiert."),
                    () => toast.error("Kopieren fehlgeschlagen."),
                  );
                }}
                title="In Zwischenablage kopieren"
              >
                <Copy className="h-3.5 w-3.5" />
                Kopieren
              </Button>
            </div>
            <pre className="overflow-auto rounded border bg-muted/30 p-3 text-xs">
{`Bitte spiele dieses Backup wieder ein. Lies zuerst BACKUP-MANIFEST.md und stats.json
im Anhang. Zeige mir dann eine Übersicht (Tabellen + Zeilenzahlen, Auth-User-Anzahl,
Storage-Dateien) UND frage mich VOR jedem destruktiven Schritt um Bestätigung
(insbesondere vor TRUNCATE/DELETE auf bestehenden Tabellen).
Reihenfolge: 1) Schema prüfen, 2) Auth-User wiederherstellen (gleiche IDs!),
3) Tabellen in Foreign-Key-Reihenfolge importieren, 4) Storage-Dateien hochladen.`}
            </pre>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Warum kein In-App-Restore-Knopf?</AlertTitle>
            <AlertDescription className="text-sm">
              Im echten Worst Case (Cloud-Datenbank weg) wäre auch ein hochgeladenes ZIP in der
              gleichen Cloud zerstört. Daher liegt der Wiederherstellungs-Pfad <em>außerhalb</em>{" "}
              der App — über Lovable-Chat. Für Teil-Schäden (z. B. eine Tabelle versehentlich
              geleert) kann ich gezielt einzelne Dateien aus dem ZIP nachfüttern.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Datenbank-Tabellen
            </CardTitle>
            <CardDescription>Übersicht aller Tabellen im Backup.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </CardHeader>
        <CardContent>
          {loading && !stats ? (
            <p className="text-sm text-muted-foreground">Lade Übersicht…</p>
          ) : stats ? (
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              {stats.tables.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5"
                >
                  <code className="text-xs">{t.name}</code>
                  <Badge variant={t.rows > 0 ? "default" : "secondary"}>
                    {t.rows < 0 ? "Fehler" : `${t.rows} Z.`}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Storage-Buckets (Dateien)
          </CardTitle>
          <CardDescription>
            Hochgeladene PDFs, MP3s, Befund-Dokumente. Nur im Voll-Backup enthalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-2">
              {stats.buckets.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2"
                >
                  <code className="text-sm">{b.name}</code>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {b.files < 0 ? "—" : `${b.files} Dateien`}
                    </span>
                    <Badge variant="outline">{formatBytes(b.totalBytes)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Secrets (NICHT im Backup)
          </CardTitle>
          <CardDescription>
            Aus Sicherheitsgründen lassen sich Secret-Werte nicht exportieren. Diese Liste zeigt,
            welche Namen du bei einer Wiederherstellung neu eintragen musst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(stats?.secrets ?? REQUIRED_SECRETS).map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Wichtiger Hinweis (DSGVO)</AlertTitle>
        <AlertDescription className="text-sm">
          Backup-Dateien enthalten besondere personenbezogene Daten nach Art. 9 DSGVO
          (Gesundheitsdaten). Bewahre sie ausschließlich verschlüsselt auf (z. B. VeraCrypt) und
          lösche sie spätestens nach Ablauf der 10-Jahres-Aufbewahrungsfrist sicher.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default BackupCenter;
