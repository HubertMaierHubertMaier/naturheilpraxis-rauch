// Backup-Center Edge Function
// Modi:
//   ?mode=stats  -> JSON mit Übersicht (Tabellen, Buckets, Secrets)
//   ?mode=db     -> ZIP mit allen Tabellen als CSV+JSON + MANIFEST
//   ?mode=full   -> ZIP wie db, zusätzlich alle Storage-Dateien
//
// Auth: Nur Admin (per JWT + has_role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

function isAllowedCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const isLocalDev =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      ["5173", "4173", "5174", "4174"].includes(url.port);
    return (
      isLocalDev ||
      allowedCorsHostnames.has(url.hostname) ||
      url.hostname.endsWith(".lovableproject.com") ||
      url.hostname.endsWith(".lovable.app")
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}

// Alle zu sichernden Tabellen
const TABLES = [
  "admin_knowledge_base",
  "anamnesis_submissions",
  "app_settings",
  "audit_log",
  "faqs",
  "iaa_submissions",
  "mannayan_orders",
  "mannayan_products",
  "patient_resources",
  "patient_snapshot",
  "practice_info",
  "practice_pricing",
  "profiles",
  "therapy_sessions",
  "user_roles",
  "verification_codes",
];

const BUCKETS = ["anamnesis-pdfs", "patient-library", "therapy-documents"];

// Liste der Secret-Namen, die für eine vollständige Wiederherstellung gesetzt werden müssen
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

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvValue(row[c])).join(","));
  }
  return lines.join("\n");
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function fetchTableAll(
  client: ReturnType<typeof createClient>,
  table: string,
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  let from = 0;
  const all: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`[backup-export] Tabelle ${table}:`, error.message);
      throw new Error(`Tabelle ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function gatherStats(client: ReturnType<typeof createClient>) {
  const tables: Array<{ name: string; rows: number }> = [];
  for (const t of TABLES) {
    const { count, error } = await client.from(t).select("*", { count: "exact", head: true });
    tables.push({ name: t, rows: error ? -1 : count ?? 0 });
  }

  const buckets: Array<{ name: string; files: number; totalBytes: number }> = [];
  for (const b of BUCKETS) {
    try {
      const files = await listAllFiles(client, b);
      const totalBytes = files.reduce((acc, f) => acc + (f.size ?? 0), 0);
      buckets.push({ name: b, files: files.length, totalBytes });
    } catch {
      buckets.push({ name: b, files: -1, totalBytes: 0 });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    tables,
    buckets,
    secrets: REQUIRED_SECRETS,
  };
}

type StorageFileEntry = { path: string; size: number };

async function listAllFiles(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix = "",
): Promise<StorageFileEntry[]> {
  const out: StorageFileEntry[] = [];
  const { data, error } = await client.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  for (const item of data ?? []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    // Verzeichnis erkennen: kein metadata-Eintrag mit size
    const meta = (item as unknown as { metadata?: { size?: number } }).metadata;
    if (meta && typeof meta.size === "number") {
      out.push({ path: fullPath, size: meta.size });
    } else if (!meta) {
      // Unterordner -> rekursiv
      const sub = await listAllFiles(client, bucket, fullPath);
      out.push(...sub);
    }
  }
  return out;
}

function buildManifest(stats: Awaited<ReturnType<typeof gatherStats>>, mode: "db" | "full"): string {
  const lines: string[] = [];
  lines.push("# BACKUP-MANIFEST — Naturheilpraxis Peter Rauch");
  lines.push("");
  lines.push(`Erstellt: ${stats.generatedAt}`);
  lines.push(`Modus: ${mode === "full" ? "Voll-Backup (Datenbank + Storage)" : "Schnell-Backup (nur Datenbank)"}`);
  lines.push("");
  lines.push("## Enthaltene Datenbank-Tabellen");
  lines.push("");
  lines.push("| Tabelle | Zeilen | Dateien im Backup |");
  lines.push("|---------|-------:|-------------------|");
  for (const t of stats.tables) {
    lines.push(`| \`${t.name}\` | ${t.rows} | \`db/${t.name}.csv\` + \`db/${t.name}.json\` |`);
  }
  lines.push("");
  lines.push("## Storage-Buckets");
  lines.push("");
  if (mode === "full") {
    lines.push("| Bucket | Dateien | Größe |");
    lines.push("|--------|--------:|------:|");
    for (const b of stats.buckets) {
      lines.push(`| \`${b.name}\` | ${b.files} | ${formatBytes(b.totalBytes)} |`);
    }
    lines.push("");
    lines.push("Dateien liegen unter `storage/<bucket-name>/<pfad>`.");
  } else {
    lines.push("Storage-Dateien sind in diesem Schnell-Backup **NICHT** enthalten.");
    lines.push("Für eine vollständige Sicherung der PDFs/MP3s bitte das Voll-Backup verwenden.");
    lines.push("");
    for (const b of stats.buckets) {
      lines.push(`- \`${b.name}\`: ${b.files} Dateien, ${formatBytes(b.totalBytes)}`);
    }
  }
  lines.push("");
  lines.push("## Secrets (NICHT im Backup enthalten)");
  lines.push("");
  lines.push("Aus Sicherheitsgründen können Secret-Werte nicht exportiert werden.");
  lines.push("Beim Wiederherstellen auf einem neuen System müssen folgende Secrets neu gesetzt werden:");
  lines.push("");
  for (const s of REQUIRED_SECRETS) {
    lines.push(`- \`${s}\``);
  }
  lines.push("");
  lines.push("Die Werte holst du aus den jeweiligen Provider-Dashboards (ElevenLabs, SMTP-Anbieter, etc.).");
  lines.push("");
  lines.push("## Wiederherstellung — Schritt für Schritt");
  lines.push("");
  lines.push("1. **Code wiederherstellen**: Repo von GitHub klonen (`git clone <repo-url>`).");
  lines.push("2. **Neues Lovable-Cloud-Projekt** anlegen oder bestehendes leeres Projekt nutzen.");
  lines.push("3. **Migrationen ausführen**: Schema kommt automatisch aus `supabase/migrations/`.");
  lines.push("4. **Secrets eintragen**: alle oben gelisteten Namen in den Lovable-Cloud-Settings hinterlegen.");
  lines.push("5. **Tabellen-Daten zurückspielen**: Die JSON-Dateien aus `db/` per Skript wieder einspielen");
  lines.push("   (z.B. via `psql \\copy` oder eine kleine Restore-Edge-Function). CSVs sind für manuelle");
  lines.push("   Inspektion in Excel/LibreOffice gedacht.");
  if (mode === "full") {
    lines.push("6. **Storage-Dateien hochladen**: Dateien aus `storage/<bucket>/` in die jeweiligen");
    lines.push("   neu angelegten Buckets hochladen (Cloud → Files).");
  }
  lines.push("");
  lines.push("## Wichtig");
  lines.push("");
  lines.push("- Dieses Backup enthält **personenbezogene Gesundheitsdaten** (Art. 9 DSGVO).");
  lines.push("- Verschlüsselt aufbewahren (z.B. VeraCrypt-Container).");
  lines.push("- Aufbewahrungsfrist: 10 Jahre gemäß Praxis-DSGVO-Konzept.");
  lines.push("- Alte Backups nach Ablauf der Frist sicher löschen.");
  lines.push("");
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function buildSecretsChecklist(): string {
  return [
    "SECRETS-CHECKLISTE",
    "===================",
    "",
    "Folgende Secrets müssen nach einer Wiederherstellung neu eingetragen werden.",
    "Werte sind aus Sicherheitsgründen NICHT exportierbar.",
    "",
    ...REQUIRED_SECRETS.map((s) => `[ ] ${s}`),
    "",
    "Quellen der Werte:",
    "- SUPABASE_* / LOVABLE_API_KEY: werden vom neuen Cloud-Projekt automatisch erzeugt.",
    "- ELEVENLABS_API_KEY: https://elevenlabs.io/app/settings/api-keys",
    "- SMTP_*: aus dem Dashboard deines Mail-Providers (Brevo, Mailjet etc.).",
    "- RELAY_SECRET: zufälligen String generieren UND identisch in der PHP-Relay-Datei eintragen.",
    "",
  ].join("\n");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Admin-Check
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let isAdmin = false;
    if (token && token !== anonKey) {
      const { data: userData } = await adminClient.auth.getUser(token);
      if (userData?.user) {
        const { data: roleCheck } = await adminClient.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        isAdmin = !!roleCheck;
      }
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "stats").toLowerCase();

    if (mode === "stats") {
      const stats = await gatherStats(adminClient);
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Neuer Modus: Storage-Liste mit signierten URLs (Client lädt selbst)
    if (mode === "storage-list") {
      const result: Record<string, Array<{ path: string; size: number; signedUrl: string }>> = {};
      for (const bucket of BUCKETS) {
        try {
          const files = await listAllFiles(adminClient, bucket);
          const entries: Array<{ path: string; size: number; signedUrl: string }> = [];
          // signedUrls in Batches erzeugen (createSignedUrls akzeptiert max ~100)
          const batchSize = 100;
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const { data, error } = await adminClient.storage
              .from(bucket)
              .createSignedUrls(batch.map((f) => f.path), 60 * 60); // 1h gültig
            if (error) throw error;
            for (let j = 0; j < batch.length; j++) {
              const su = data?.[j];
              if (su?.signedUrl) {
                entries.push({ path: batch[j].path, size: batch[j].size, signedUrl: su.signedUrl });
              }
            }
          }
          result[bucket] = entries;
        } catch (e) {
          console.error(`[backup-export] storage-list ${bucket}:`, e);
          result[bucket] = [];
        }
      }
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode !== "db") {
      return new Response(JSON.stringify({ error: "mode must be stats|db|storage-list" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode=db: nur Datenbank, serverseitig ZIP bauen (klein & schnell)
    const zip = new JSZip();
    const stats = await gatherStats(adminClient);

    for (const table of TABLES) {
      try {
        const rows = await fetchTableAll(adminClient, table);
        zip.file(`db/${table}.json`, JSON.stringify(rows, null, 2));
        zip.file(`db/${table}.csv`, rowsToCsv(rows));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        zip.file(`db/${table}.ERROR.txt`, msg);
      }
    }

    zip.file("BACKUP-MANIFEST.md", buildManifest(stats, "db"));
    zip.file("SECRETS-CHECKLISTE.txt", buildSecretsChecklist());
    zip.file("stats.json", JSON.stringify(stats, null, 2));

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const filename = `naturheilpraxis-backup-db-${isoTimestamp()}.zip`;

    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup-export]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
