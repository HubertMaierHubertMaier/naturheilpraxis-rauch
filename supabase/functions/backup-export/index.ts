// Backup-Center Edge Function
// Modi:
//   ?mode=stats  -> JSON mit Übersicht (Tabellen, Buckets, Secrets)
//   ?mode=db     -> ZIP mit allen Tabellen als CSV+JSON + MANIFEST
//   ?mode=full   -> ZIP wie db, zusätzlich alle Storage-Dateien
//   ?mode=github-code&repo=owner/repo&branch=main -> GitHub-Code-ZIP mit Praxis-Dateiname
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

// Fallback-Listen (werden nur verwendet, wenn die Auto-Discovery fehlschlägt).
// Im Normalfall ermitteln wir alle Tabellen und Buckets dynamisch zur Laufzeit,
// damit neue Tabellen/Buckets automatisch mitgesichert werden.
const FALLBACK_TABLES = [
  "admin_knowledge_base",
  "anamnesis_submissions",
  "app_settings",
  "audit_log",
  "email_send_log",
  "faqs",
  "iaa_submissions",
  "infothek_gating",
  "mannayan_orders",
  "mannayan_products",
  "patient_access",
  "patient_resources",
  "patient_snapshot",
  "practice_info",
  "practice_pricing",
  "profiles",
  "therapy_sessions",
  "two_factor_pending_bindings",
  "two_factor_verified_sessions",
  "user_roles",
  "verification_codes",
];

const FALLBACK_BUCKETS = ["anamnesis-pdfs", "patient-library", "therapy-documents"];

// Spiegel-Definition der Teilbereich-Backups (vgl. src/lib/backupAreas.ts).
// Hier nur die serverseitig relevanten Felder (Tabellen + Buckets).
type AreaDef = { tables: string[]; buckets: string[] };
const AREA_MAP: Record<string, AreaDef> = {
  "anamnesebogen":       { tables: ["anamnesis_submissions"], buckets: ["anamnesis-pdfs"] },
  "vertrag-datenschutz": { tables: [], buckets: [] },
  "wiki":                { tables: ["admin_knowledge_base", "faqs", "practice_pricing", "practice_info"], buckets: [] },
  "infothek":            { tables: ["infothek_gating"], buckets: [] },
  "hypnose":             { tables: [], buckets: [] },
  "patient-library":     { tables: ["patient_resources", "patient_access"], buckets: ["patient-library"] },
  "iaa-icd10":           { tables: ["iaa_submissions", "therapy_sessions", "patient_snapshot", "mannayan_orders", "mannayan_products"], buckets: ["therapy-documents"] },
  "auth-2fa":            { tables: ["profiles", "user_roles", "verification_codes", "audit_log", "app_settings", "two_factor_pending_bindings", "two_factor_verified_sessions"], buckets: [] },
  "edge-mail":           { tables: [], buckets: [] },
};

// System-Tabellen, die niemals gesichert werden (interne Supabase-Mechanik)
const TABLE_BLOCKLIST = new Set<string>([
  "schema_migrations",
  "supabase_migrations",
]);

async function discoverTables(): Promise<{ tables: string[]; source: "openapi" | "fallback" }> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return { tables: FALLBACK_TABLES, source: "fallback" };
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    });
    if (!res.ok) return { tables: FALLBACK_TABLES, source: "fallback" };
    const spec = await res.json() as { definitions?: Record<string, unknown>; paths?: Record<string, unknown> };
    const names = new Set<string>();
    if (spec.definitions) for (const k of Object.keys(spec.definitions)) names.add(k);
    if (spec.paths) {
      for (const p of Object.keys(spec.paths)) {
        const m = p.match(/^\/([A-Za-z0-9_]+)$/);
        if (m) names.add(m[1]);
      }
    }
    const filtered = [...names].filter((n) => !TABLE_BLOCKLIST.has(n) && !n.startsWith("rpc/")).sort();
    if (filtered.length === 0) return { tables: FALLBACK_TABLES, source: "fallback" };
    return { tables: filtered, source: "openapi" };
  } catch (err) {
    console.warn("[backup-export] discoverTables fallback:", (err as Error)?.message);
    return { tables: FALLBACK_TABLES, source: "fallback" };
  }
}

async function discoverBuckets(
  client: ReturnType<typeof createClient>,
): Promise<{ buckets: string[]; source: "api" | "fallback" }> {
  try {
    const { data, error } = await client.storage.listBuckets();
    if (error || !data || data.length === 0) {
      return { buckets: FALLBACK_BUCKETS, source: "fallback" };
    }
    return { buckets: data.map((b) => b.name).sort(), source: "api" };
  } catch {
    return { buckets: FALLBACK_BUCKETS, source: "fallback" };
  }
}


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

function sanitizeGithubInput(repo: string | null, branch: string | null): { repo: string; branch: string } {
  const cleanedRepo = (repo ?? "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
  const cleanedBranch = (branch ?? "main").trim() || "main";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanedRepo)) {
    throw new Error("Ungültiges GitHub-Repo. Erwartet: besitzer/repo");
  }
  if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(cleanedBranch) || cleanedBranch.includes("..") || cleanedBranch.startsWith("/") || cleanedBranch.endsWith("/")) {
    throw new Error("Ungültiger GitHub-Branch.");
  }
  return { repo: cleanedRepo, branch: cleanedBranch };
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
  const { tables: tableNames, source: tableSource } = await discoverTables();
  const { buckets: bucketNames, source: bucketSource } = await discoverBuckets(client);

  const tables: Array<{ name: string; rows: number }> = [];
  for (const t of tableNames) {
    const { count, error } = await client.from(t).select("*", { count: "exact", head: true });
    tables.push({ name: t, rows: error ? -1 : count ?? 0 });
  }

  const buckets: Array<{ name: string; files: number; totalBytes: number }> = [];
  for (const b of bucketNames) {
    try {
      const files = await listAllFiles(client, b);
      const totalBytes = files.reduce((acc, f) => acc + (f.size ?? 0), 0);
      buckets.push({ name: b, files: files.length, totalBytes });
    } catch {
      buckets.push({ name: b, files: -1, totalBytes: 0 });
    }
  }

  let authUserCount = -1;
  try {
    const users = await fetchAllAuthUsers(client);
    authUserCount = users.length;
  } catch {
    /* ignore */
  }

  return {
    generatedAt: new Date().toISOString(),
    tables,
    buckets,
    authUserCount,
    secrets: REQUIRED_SECRETS,
    discovery: { tableSource, bucketSource },
  };
}

type AuthUserExport = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  banned_until: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  mfa_factors: Array<{ id: string; type: string; status: string; created_at: string }>;
};

async function fetchAllAuthUsers(
  client: ReturnType<typeof createClient>,
): Promise<AuthUserExport[]> {
  const all: AuthUserExport[] = [];
  const perPage = 1000;
  let page = 1;
  // Hard safety cap to avoid infinite loops
  while (page <= 50) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      all.push({
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        phone_confirmed_at: u.phone_confirmed_at ?? null,
        banned_until: (u as unknown as { banned_until?: string }).banned_until ?? null,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
        mfa_factors: (u.factors ?? []).map((f) => ({
          id: f.id,
          type: f.factor_type,
          status: f.status,
          created_at: f.created_at,
        })),
      });
    }
    if (users.length < perPage) break;
    page++;
  }
  return all;
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
  lines.push(`Modus: ${mode === "full" ? "Voll-Backup (Datenbank + Storage + Auth-Users)" : "Schnell-Backup (Datenbank + Auth-Users)"}`);
  lines.push("");
  lines.push("## Wiederherstellungs-Kette — WAS LIEGT WO?");
  lines.push("");
  lines.push("Für eine 100%ige Wiederherstellung brauchst du DREI Quellen:");
  lines.push("");
  lines.push("**1. GitHub-Repository** (Code, Schema, statische Dateien)");
  lines.push("- `src/` — komplette React-App");
  lines.push("- `supabase/functions/` — alle Edge Functions");
  lines.push("- `supabase/migrations/` — DB-Schema, RLS, Policies, Trigger");
  lines.push("- `supabase/config.toml` — Function-Konfiguration");
  lines.push("- `public/*.html` — alle Infothek-Seiten (Allergie, Parasiten, Zapper, etc.)");
  lines.push("- `public/therapie/**/*.pdf` — statische Therapie-Begleitskripte (Raucher, Reizdarm, Schilddrüse)");
  lines.push("- `docs/` — Mail-Relay PHP-Datei, Restore-Doku, Snapshots");
  lines.push("- `scripts/` — Build-Skripte für PDFs/Hypnose");
  lines.push("- `package.json`, `bun.lock`, `vite.config.ts`, `tailwind.config.ts`, `index.html`");
  lines.push("");
  lines.push("**2. Dieses Backup-ZIP** (alles, was NICHT in GitHub ist)");
  lines.push("- `db/*.json` + `db/*.csv` — alle DB-Tabelleninhalte");
  lines.push("- `auth/users.json` — Liste aller Patienten-Konten (ohne Passwörter)");
  if (mode === "full") {
    for (const b of stats.buckets) {
      lines.push(`- \`storage/${b.name}/\` — ${b.files} Datei(en), ${formatBytes(b.totalBytes)}`);
    }
  }
  lines.push("- `SECRETS-CHECKLISTE.txt` — Liste der Secret-Namen");
  lines.push("");
  lines.push("**3. Secrets aus den Provider-Dashboards** (Werte nirgendwo gespeichert)");
  lines.push("- ELEVENLABS_API_KEY, SMTP_*, RELAY_SECRET (siehe Checkliste)");
  lines.push("");
  lines.push("**Nicht gesichert (weil nicht nötig oder unmöglich):**");
  lines.push("- Patient-Passwörter → gehasht, NICHT exportierbar. Lösung: Reset-Mails versenden.");
  lines.push("- Dynamisch erzeugte Hypnose-MP3s → werden im Browser per Edge-TTS neu generiert.");
  lines.push("- Lovable-Cloud-Secret-Werte → aus Sicherheitsgründen nicht exportierbar.");
  lines.push("");
  lines.push("## Enthaltene Datenbank-Tabellen");
  lines.push("");
  lines.push("| Tabelle | Zeilen | Dateien im Backup |");
  lines.push("|---------|-------:|-------------------|");
  for (const t of stats.tables) {
    lines.push(`| \`${t.name}\` | ${t.rows} | \`db/${t.name}.csv\` + \`db/${t.name}.json\` |`);
  }
  lines.push("");
  lines.push(`**Auth-Benutzerkonten:** ${stats.authUserCount >= 0 ? stats.authUserCount : "Fehler"} (siehe \`auth/users.json\`)`);
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
  lines.push("**Szenario A: Kleine Panne (einzelne Daten/Datei verloren)**");
  lines.push("- Einzeltabelle/Datei gezielt aus diesem ZIP zurückspielen.");
  lines.push("");
  lines.push("**Szenario B: Komplett-Wiederherstellung (Worst Case)**");
  lines.push("1. **Code zurückholen**: Repo von GitHub klonen (`git clone <repo-url>`).");
  lines.push("2. **Neues Lovable-Cloud-Projekt** anlegen (oder bestehendes leeres nutzen).");
  lines.push("3. **Schema kommt automatisch** aus `supabase/migrations/` (RLS, Tabellen, Buckets, Functions, Trigger).");
  lines.push("4. **Secrets eintragen**: alle Namen aus `SECRETS-CHECKLISTE.txt` in Lovable-Cloud → Settings → Secrets.");
  lines.push("5. **Auth-Benutzer wiederherstellen**: User aus `auth/users.json` via Admin-API anlegen (ID übernehmen!). Passwort-Reset-Mails an alle Patienten verschicken.");
  lines.push("6. **Tabellen-Daten zurückspielen**: Die JSON-Dateien aus `db/` per Skript einspielen (z. B. via `psql \\copy` oder Restore-Edge-Function). CSVs sind für manuelle Inspektion in Excel/LibreOffice.");
  if (mode === "full") {
    lines.push("7. **Storage-Dateien hochladen**: Dateien aus `storage/<bucket>/` in die neu angelegten Buckets hochladen (Cloud → Files oder via Skript).");
  }
  lines.push("");
  lines.push("## Wichtig — DSGVO");
  lines.push("");
  lines.push("- Dieses Backup enthält **personenbezogene Gesundheitsdaten** (Art. 9 DSGVO).");
  lines.push("- Verschlüsselt aufbewahren (z. B. VeraCrypt-Container, GPG, verschlüsselte USB).");
  lines.push("- Aufbewahrungsfrist: 10 Jahre gemäß Praxis-DSGVO-Konzept.");
  lines.push("- Alte Backups nach Ablauf der Frist sicher löschen (`shred` / sicheres Löschen).");
  lines.push("- 2 Speichermedien empfohlen (z. B. lokale Festplatte + USB-Stick im Tresor).");
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

    if (mode === "github-code") {
      const { repo, branch } = sanitizeGithubInput(url.searchParams.get("repo"), url.searchParams.get("branch"));
      const githubToken = Deno.env.get("GITHUB_TOKEN") ?? "";
      const ghHeaders: Record<string, string> = { "User-Agent": "naturheilpraxis-backup-export" };
      if (githubToken) ghHeaders["Authorization"] = `Bearer ${githubToken}`;
      // GitHub API endpoint supports private repos with token and returns a redirect to codeload
      const apiUrl = `https://api.github.com/repos/${repo}/zipball/${encodeURIComponent(branch)}`;
      const codeloadUrl = `https://codeload.github.com/${repo}/zip/refs/heads/${encodeURIComponent(branch)}`;
      let githubRes = await fetch(githubToken ? apiUrl : codeloadUrl, { headers: ghHeaders, redirect: "follow" });
      if (!githubRes.ok || !githubRes.body) {
        const status = githubRes.status;
        if (status === 404 && !githubToken) {
          throw new Error(`GitHub-Code-ZIP HTTP 404 — Repo ist vermutlich PRIVAT. Bitte ein GitHub Personal Access Token mit "repo"-Scope als Secret "GITHUB_TOKEN" hinterlegen.`);
        }
        if (status === 401 || status === 403) {
          throw new Error(`GitHub-Code-ZIP HTTP ${status} — Token abgelaufen oder ohne "repo"-Scope. Bitte GITHUB_TOKEN erneuern.`);
        }
        throw new Error(`GitHub-Code-ZIP konnte nicht geladen werden (HTTP ${status}). Repo/Branch prüfen.`);
      }
      const filename = `Naturheilpraxis-CODE-Backup-${isoTimestamp()}.zip`;
      return new Response(githubRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Neuer Modus: Storage-Liste mit signierten URLs (Client lädt selbst)
    if (mode === "storage-list") {
      const result: Record<string, Array<{ path: string; size: number; signedUrl: string }>> = {};
      const { buckets: dynamicBuckets } = await discoverBuckets(adminClient);
      for (const bucket of dynamicBuckets) {
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

    // Teilbereich-Backup: liefert für einen Bereich JSON-Daten aller zugehörigen
    // DB-Tabellen + signierte URLs der zugehörigen Storage-Dateien.
    // Public-Assets aus `public/` lädt der Browser selbst (sind statisch ausgeliefert).
    if (mode === "subset") {
      const areaId = (url.searchParams.get("area") || "").toLowerCase();
      const area = AREA_MAP[areaId];
      if (!area) {
        return new Response(
          JSON.stringify({ error: `unknown area '${areaId}'`, available: Object.keys(AREA_MAP) }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tablesOut: Record<string, { rows: Record<string, unknown>[]; error?: string }> = {};
      for (const t of area.tables) {
        try {
          const rows = await fetchTableAll(adminClient, t);
          tablesOut[t] = { rows };
        } catch (e) {
          tablesOut[t] = { rows: [], error: e instanceof Error ? e.message : String(e) };
        }
      }

      const storageOut: Record<string, Array<{ path: string; size: number; signedUrl: string }>> = {};
      for (const bucket of area.buckets) {
        try {
          const files = await listAllFiles(adminClient, bucket);
          const entries: Array<{ path: string; size: number; signedUrl: string }> = [];
          const batchSize = 100;
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const { data, error } = await adminClient.storage
              .from(bucket)
              .createSignedUrls(batch.map((f) => f.path), 60 * 60);
            if (error) throw error;
            for (let j = 0; j < batch.length; j++) {
              const su = data?.[j];
              if (su?.signedUrl) {
                entries.push({ path: batch[j].path, size: batch[j].size, signedUrl: su.signedUrl });
              }
            }
          }
          storageOut[bucket] = entries;
        } catch (e) {
          console.error(`[backup-export] subset storage ${bucket}:`, e);
          storageOut[bucket] = [];
        }
      }

      return new Response(
        JSON.stringify({
          area: areaId,
          generatedAt: new Date().toISOString(),
          tables: tablesOut,
          storage: storageOut,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode !== "db") {
      return new Response(
        JSON.stringify({ error: "mode must be stats|db|storage-list|github-code|subset" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // mode=db: nur Datenbank, serverseitig ZIP bauen (klein & schnell)
    const zip = new JSZip();
    const stats = await gatherStats(adminClient);

    const tableNamesForDb = stats.tables.map((t) => t.name);
    for (const table of tableNamesForDb) {
      try {
        const rows = await fetchTableAll(adminClient, table);
        zip.file(`db/${table}.json`, JSON.stringify(rows, null, 2));
        zip.file(`db/${table}.csv`, rowsToCsv(rows));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        zip.file(`db/${table}.ERROR.txt`, msg);
      }
    }

    // Auth-Benutzerkonten (kritisch für Wiederherstellung — Passwörter NICHT exportierbar)
    try {
      const authUsers = await fetchAllAuthUsers(adminClient);
      zip.file("auth/users.json", JSON.stringify(authUsers, null, 2));
      zip.file("auth/users.csv", rowsToCsv(authUsers as unknown as Record<string, unknown>[]));
      zip.file(
        "auth/README.txt",
        [
          "AUTH-BENUTZERKONTEN — Wiederherstellungs-Hinweis",
          "================================================",
          "",
          `Anzahl Konten: ${authUsers.length}`,
          "",
          "WICHTIG: Passwörter sind hier NICHT enthalten (technisch unmöglich — sie sind",
          "gesalzene Hashes in auth.users und werden vom Provider nicht freigegeben).",
          "",
          "Bei Wiederherstellung auf einem neuen System:",
          "1. Konten via Admin-API neu anlegen (id, email aus users.json übernehmen).",
          "2. Allen Patienten per Passwort-Reset-Mail einen neuen Zugang ermöglichen.",
          "3. 2FA-Faktoren (mfa_factors) müssen vom Patienten neu eingerichtet werden.",
          "",
          "Die user_id MUSS identisch bleiben, sonst brechen die Foreign Keys zu",
          "profiles, user_roles, anamnesis_submissions etc. — daher beim Re-Import",
          "die id-Werte aus users.json verwenden.",
        ].join("\n"),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      zip.file("auth/ERROR.txt", `Auth-User-Export fehlgeschlagen: ${msg}`);
    }

    zip.file("BACKUP-MANIFEST.md", buildManifest(stats, "db"));
    zip.file("SECRETS-CHECKLISTE.txt", buildSecretsChecklist());
    zip.file("stats.json", JSON.stringify(stats, null, 2));

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const filename = `Naturheilpraxis-DATEN-Backup-${isoTimestamp()}.zip`;

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
