import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface LogRow {
  id: string;
  created_at: string;
  recipient: string;
  subject: string | null;
  context: string | null;
  from_addr: string | null;
  http_status: number | null;
  relay_success: boolean | null;
  relay_message: string | null;
  relay_version: string | null;
  error_message: string | null;
  duration_ms: number | null;
  has_attachment: boolean;
}

export function EmailLogManager() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (onlyFailed) query = query.or("relay_success.eq.false,relay_success.is.null");
    const { data, error } = await query;
    if (error) {
      console.warn("email_send_log load error:", error.message);
      setRows([]);
    } else {
      setRows((data as LogRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [onlyFailed]);

  const filtered = filter.trim()
    ? rows.filter(
        (r) =>
          r.recipient.toLowerCase().includes(filter.toLowerCase()) ||
          (r.context ?? "").toLowerCase().includes(filter.toLowerCase()) ||
          (r.subject ?? "").toLowerCase().includes(filter.toLowerCase()),
      )
    : rows;

  const total = filtered.length;
  const ok = filtered.filter((r) => r.relay_success === true).length;
  const fail = filtered.filter((r) => r.relay_success === false || r.relay_success === null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Empfänger, Kontext oder Betreff filtern…"
            className="pl-8"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Button
          variant={onlyFailed ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyFailed((v) => !v)}
        >
          {onlyFailed ? "Nur Fehler ✓" : "Nur Fehler"}
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Gesamt: <strong className="text-foreground">{total}</strong></span>
        <span className="text-emerald-600">✓ {ok}</span>
        <span className="text-destructive">✗ {fail}</span>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Zeit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Empfänger</th>
                <th className="px-3 py-2 font-medium">Kontext</th>
                <th className="px-3 py-2 font-medium">Betreff</th>
                <th className="px-3 py-2 font-medium">HTTP</th>
                <th className="px-3 py-2 font-medium">Dauer</th>
                <th className="px-3 py-2 font-medium">Relay-Nachricht / Fehler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    {loading ? "Lade…" : "Keine Einträge."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const ok = r.relay_success === true;
                const isFail = r.relay_success === false || r.relay_success === null;
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(r.created_at), "dd.MM. HH:mm:ss", { locale: de })}
                    </td>
                    <td className="px-3 py-2">
                      {ok ? (
                        <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </Badge>
                      ) : r.relay_success === false ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" /> reject
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> error
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.recipient}</td>
                    <td className="px-3 py-2">
                      {r.context && <Badge variant="secondary">{r.context}</Badge>}
                    </td>
                    <td className="px-3 py-2 max-w-[280px] truncate" title={r.subject ?? ""}>
                      {r.subject}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.http_status ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[400px] text-xs">
                      <div className={isFail ? "text-destructive" : "text-muted-foreground"}>
                        {r.error_message || r.relay_message || ""}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Zeigt die letzten 300 Versandversuche. Logs werden bei jedem Mail-Versand (Anmelde-Code,
        Passwort-Reset, Anamnese-Bestätigung, ICD-10-Report) automatisch geschrieben.
      </p>
    </div>
  );
}
