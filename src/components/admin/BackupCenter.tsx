import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  useEffect(() => {
    loadStats();
  }, []);

  async function getToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Keine aktive Sitzung. Bitte neu anmelden.");
    return token;
  }

  async function fetchDbZipBytes(token: string): Promise<{ bytes: Uint8Array; filename: string }> {
    const url = `${getFunctionsUrl()}/backup-export?mode=db`;
    log("Lade Datenbank-Export von Server…");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json())?.error ?? "";
      } catch {
        /* ignore */
      }
      throw new Error(`DB-Export HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `db-backup.zip`;
    log(`Datenbank-ZIP empfangen (${formatBytes(buf.length)}).`);
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
      setLastResult({ ok: true, filename: fn, size: bytes.length, durationSec: dur, warnings: 0 });
      toast.success(`Schnell-Backup heruntergeladen (${formatBytes(bytes.length)}).`);
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
      const listRes = await fetch(`${getFunctionsUrl()}/backup-export?mode=storage-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) throw new Error(`Storage-Liste HTTP ${listRes.status}`);
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

  const totalRows = stats?.tables.reduce((acc, t) => acc + Math.max(0, t.rows), 0) ?? 0;
  const totalFiles = stats?.buckets.reduce((acc, b) => acc + Math.max(0, b.files), 0) ?? 0;
  const totalBytes = stats?.buckets.reduce((acc, b) => acc + b.totalBytes, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Backup-Center
          </CardTitle>
          <CardDescription>
            Sicherung aller Daten, die <strong>nicht</strong> in GitHub liegen (Datenbank-Inhalte,
            hochgeladene Dateien, Secret-Namen-Liste). Empfehlung: täglich „Schnell-Backup",
            wöchentlich „Voll-Backup". Die Datei landet im Download-Ordner deines Browsers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={downloadDbBackup}
              disabled={downloading !== null}
              className="h-auto flex-col gap-1 py-4"
            >
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <span className="font-semibold">Schnell-Backup (nur Datenbank)</span>
              </div>
              <span className="text-xs opacity-90">
                {downloading === "db"
                  ? "Wird erstellt…"
                  : `≈ ${totalRows} Zeilen · klein, sekundenschnell`}
              </span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={downloadFullBackup}
              disabled={downloading !== null}
              className="h-auto flex-col gap-1 py-4"
            >
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                <span className="font-semibold">Voll-Backup (Datenbank + Dateien)</span>
              </div>
              <span className="text-xs opacity-90">
                {downloading === "full"
                  ? "Wird erstellt… (kann dauern)"
                  : `≈ ${totalFiles} Dateien · ${formatBytes(totalBytes)}`}
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
                  lastResult.message
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Datenbank-Tabellen
            </CardTitle>
            <CardDescription>Übersicht aller Tabellen im Backup.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
