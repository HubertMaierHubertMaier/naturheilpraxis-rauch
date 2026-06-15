import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Database, HardDrive, Key, RefreshCw, ShieldAlert, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Stats = {
  generatedAt: string;
  tables: Array<{ name: string; rows: number }>;
  buckets: Array<{ name: string; files: number; totalBytes: number }>;
  secrets: string[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function BackupCenter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"db" | "full" | null>(null);

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

  const downloadBackup = async (mode: "db" | "full") => {
    setDownloading(mode);
    const startedAt = Date.now();
    try {
      // supabase.functions.invoke entpackt JSON automatisch — für Binär-Download
      // brauchen wir fetch mit dem User-Token.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Keine aktive Sitzung. Bitte neu anmelden.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const functionsUrl =
        supabaseUrl?.replace(".supabase.co", ".functions.supabase.co") ??
        `https://${projectRef}.functions.supabase.co`;

      const res = await fetch(`${functionsUrl}/backup-export?mode=${mode}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let detail = "";
        try {
          const json = await res.json();
          detail = json?.error ?? "";
        } catch {
          /* binary */
        }
        throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename =
        match?.[1] ?? `backup-${mode}-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const seconds = Math.round((Date.now() - startedAt) / 1000);
      toast.success(`Backup heruntergeladen (${formatBytes(blob.size)} in ${seconds}s).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Backup fehlgeschlagen: ${msg}`);
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
            Vollständige Sicherung aller Daten, die <strong>nicht</strong> in GitHub liegen
            (Datenbank-Inhalte, hochgeladene Dateien, Secret-Namen-Liste). Empfehlung:
            täglich „Schnell-Backup" laden und 1× pro Woche das „Voll-Backup".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={() => downloadBackup("db")}
              disabled={downloading !== null}
              className="h-auto flex-col gap-1 py-4"
            >
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <span className="font-semibold">Schnell-Backup (nur Datenbank)</span>
              </div>
              <span className="text-xs opacity-90">
                {downloading === "db" ? "Wird erstellt…" : `≈ ${totalRows} Zeilen · klein, sekundenschnell`}
              </span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => downloadBackup("full")}
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

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>So nutzt du das Backup</AlertTitle>
            <AlertDescription className="space-y-1 text-sm">
              <p>
                Das ZIP enthält jede Tabelle als <code>.csv</code> (Excel) <em>und</em>{" "}
                <code>.json</code> (zum maschinellen Wieder-Einspielen), eine{" "}
                <code>BACKUP-MANIFEST.md</code> mit Schritt-für-Schritt-Wiederherstellung und
                eine <code>SECRETS-CHECKLISTE.txt</code> mit allen Secret-Namen, die du im
                Notfall neu eintragen musst.
              </p>
              <p className="text-muted-foreground">
                Lege die Datei auf <strong>2 Speichermedien</strong> ab (z. B. lokaler Ordner
                + USB-Stick / NAS). Verschlüsselt aufbewahren — enthält Gesundheitsdaten.
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
            <CardDescription>
              Übersicht aller Tabellen, die im Backup enthalten sind.
            </CardDescription>
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
            Hochgeladene PDFs, MP3s und Befund-Dokumente. Nur im Voll-Backup enthalten.
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
            Aus Sicherheitsgründen lassen sich Secret-Werte nicht exportieren. Diese Liste
            zeigt, welche Namen du bei einer Wiederherstellung neu eintragen musst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="flex flex-wrap gap-2">
              {stats.secrets.map((s) => (
                <Badge key={s} variant="outline" className="font-mono text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Wichtiger Hinweis (DSGVO)</AlertTitle>
        <AlertDescription className="text-sm">
          Backup-Dateien enthalten besondere personenbezogene Daten nach Art. 9 DSGVO
          (Gesundheitsdaten). Bewahre sie ausschließlich verschlüsselt auf (z. B. in einem
          VeraCrypt-Container oder auf einer verschlüsselten Festplatte) und lösche sie
          spätestens nach Ablauf der 10-Jahres-Aufbewahrungsfrist sicher.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default BackupCenter;
