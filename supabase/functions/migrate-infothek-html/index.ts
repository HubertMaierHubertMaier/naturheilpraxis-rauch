import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE_ORIGIN = "https://naturheilpraxis-rauch.lovable.app";
const BUCKET = "patient-library";
const MAX_HTML_BYTES = 5 * 1024 * 1024;

const INFOTHEK_ROUTES = [
  "/allergiebehandlung.html",
  "/ass-salicylat-histamin.html",
  "/candida-diaet.html",
  "/datenschutz-fahrplan.html",
  "/diabetes-handout.html",
  "/krankheit-ist-messbar.html",
  "/kraeuter-schmerz-entzuendung.html",
  "/logi-ernaehrung-mitochondrien.html",
  "/mitochondropathie-hws.html",
  "/muedigkeit-erschoepfung-burnout.html",
  "/parasiten-deutschland.html",
  "/patienteninfo-hochohmiges-wasser.html",
  "/sibo-duenndarmfehlbesiedlung.html",
  "/therapieweg-uebersicht.html",
  "/umwelt-alltag-gesundheit.html",
  "/vieva-pro-vitalanalyse.html",
  "/viren-bakterien-deutschland.html",
  "/zapper-diamond-shield.html",
] as const;

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "app.rauch-heilpraktiker.de",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

type MigrationStatus =
  | "uploaded"
  | "fetch_failed"
  | "invalid_source"
  | "transform_failed"
  | "upload_failed";

type MigrationResult = {
  filename: string;
  status: MigrationStatus;
};

function isAllowedCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const isLocalDev =
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      ["5173", "4173", "5174", "4174", "4178", "8080"].includes(url.port);

    return (
      isLocalDev ||
      (url.protocol === "https:" &&
        (allowedCorsHostnames.has(url.hostname) ||
          url.hostname.endsWith(".lovableproject.com") ||
          url.hostname.endsWith(".lovable.app")))
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }

  return headers;
}

function jsonResponse(req: Request, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function assetUrl(value: string): URL | null {
  try {
    return new URL(value, SOURCE_ORIGIN);
  } catch {
    return null;
  }
}

function tagAttribute(tag: string, name: "href" | "src"): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function isRevealCdn(url: URL): boolean {
  return (
    ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com"].includes(url.hostname) &&
    url.pathname.toLowerCase().includes("reveal.js")
  );
}

function transformHtml(source: string): string {
  if (!/<html\b/i.test(source) || !/<head\b[^>]*>/i.test(source) || !/<\/head>/i.test(source)) {
    throw new Error("Invalid HTML document");
  }

  let fontStyleEmitted = false;
  let infothekStyleEmitted = false;
  let revealStyleEmitted = false;
  let revealScriptEmitted = false;
  let revealThemeEmitted = false;
  let needsImportedFonts = false;

  let html = source.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = tagAttribute(tag, "href");
    if (!href) return tag;

    const url = assetUrl(href);
    if (!url) return tag;
    const path = url.pathname.toLowerCase();

    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
      if (fontStyleEmitted) return "";
      fontStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/infothek-fonts.css">';
    }
    if (path === "/vendor/infothek-fonts.css") {
      if (fontStyleEmitted) return "";
      fontStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/infothek-fonts.css">';
    }
    if (path === "/vendor/infothek.css") {
      if (infothekStyleEmitted) return "";
      infothekStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/infothek.css">';
    }
    if (path === "/vendor/reveal/reveal.css") {
      if (revealStyleEmitted) return "";
      revealStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/reveal.css">';
    }
    if (path === "/vendor/reveal/simple.css") {
      if (revealThemeEmitted) return "";
      revealThemeEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/simple.css" id="theme">';
    }
    if (path === "/vendor/reveal/white.css") {
      if (revealThemeEmitted) return "";
      revealThemeEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/white.css" id="theme">';
    }
    if (!isRevealCdn(url)) return tag;

    if (/\/theme\/simple(?:\.min)?\.css$/i.test(path)) {
      if (revealThemeEmitted) return "";
      revealThemeEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/simple.css" id="theme">';
    }
    if (/\/theme\/white(?:\.min)?\.css$/i.test(path)) {
      if (revealThemeEmitted) return "";
      revealThemeEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/white.css" id="theme">';
    }
    if (/\/(?:css\/|dist\/)?reveal(?:\.min)?\.css$/i.test(path)) {
      if (revealStyleEmitted) return "";
      revealStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/reveal/reveal.css">';
    }

    throw new Error("Unsupported Reveal stylesheet");
  });

  html = html.replace(/<script\b[^>]*\bsrc\s*=\s*(["']).*?\1[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) => {
    const src = tagAttribute(tag, "src");
    if (!src) return tag;

    const url = assetUrl(src);
    if (!url) return tag;
    const path = url.pathname.toLowerCase();

    if (path === "/infothek-gate.js" || path === "/content-protection.js") {
      return "";
    }
    if (url.hostname === "cdn.tailwindcss.com") {
      if (infothekStyleEmitted) return "";
      infothekStyleEmitted = true;
      return '<link rel="stylesheet" href="/vendor/infothek.css">';
    }
    if (path === "/vendor/reveal/reveal.js") {
      if (revealScriptEmitted) return "";
      revealScriptEmitted = true;
      return '<script src="/vendor/reveal/reveal.js"></script>';
    }
    if (!isRevealCdn(url)) return tag;
    if (/\/(?:js\/|dist\/)?reveal(?:\.min)?\.js$/i.test(path)) {
      if (revealScriptEmitted) return "";
      revealScriptEmitted = true;
      return '<script src="/vendor/reveal/reveal.js"></script>';
    }

    throw new Error("Unsupported Reveal script");
  });

  html = html.replace(
    /@import\s+(?:url\()?\s*["']?https:\/\/fonts\.(?:googleapis|gstatic)\.com\/[^;]+;/gi,
    () => {
      needsImportedFonts = true;
      return "";
    },
  );
  html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*(["'])(?:robots|googlebot)\1)[^>]*>/gi, "");
  html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n<meta name="robots" content="noindex, nofollow">`);
  html = html.replace(
    /<\/head>/i,
    "<style>.protected-overlay{display:none!important}</style>\n</head>",
  );

  if (needsImportedFonts && !fontStyleEmitted) {
    html = html.replace(
      /<\/head>/i,
      '<link rel="stylesheet" href="/vendor/infothek-fonts.css">\n</head>',
    );
  }

  if (
    /(?:infothek-gate|content-protection)\.js/i.test(html) ||
    /fonts\.(?:googleapis|gstatic)\.com|cdn\.tailwindcss\.com/i.test(html) ||
    /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)[^"'\s>]*reveal\.js/i.test(html)
  ) {
    throw new Error("External asset remained after transformation");
  }

  return html;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }
  if (!authHeader.startsWith("Bearer ") || authHeader.length <= 7) {
    return jsonResponse(req, { error: "Authentication required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.id) {
    return jsonResponse(req, { error: "Authentication required" }, 401);
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) {
    return jsonResponse(req, { error: "Role could not be checked" }, 503);
  }
  if (isAdmin !== true) {
    return jsonResponse(req, { error: "Forbidden" }, 403);
  }

  const { data: twoFactorCompleted, error: twoFactorError } = await userClient.rpc(
    "is_current_session_two_factor_completed",
  );
  if (twoFactorError) {
    return jsonResponse(req, { error: "Two-factor status could not be checked" }, 503);
  }
  if (twoFactorCompleted !== true) {
    return jsonResponse(req, { error: "Two-factor authentication required" }, 403);
  }

  // Elevated storage access is unavailable until JWT, admin role, and 2FA all pass.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: bucket, error: bucketError } = await serviceClient.storage.getBucket(BUCKET);
  if (bucketError || !bucket || bucket.public !== false) {
    return jsonResponse(req, { error: "Private destination bucket unavailable" }, 503);
  }

  const results: MigrationResult[] = [];
  for (const route of INFOTHEK_ROUTES) {
    const filename = route.slice(1);
    let response: Response;
    try {
      response = await fetch(`${SOURCE_ORIGIN}${route}`, {
        headers: { Accept: "text/html" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      results.push({ filename, status: "fetch_failed" });
      continue;
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !response.ok ||
      !contentType.includes("text/html") ||
      (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES)
    ) {
      results.push({ filename, status: "invalid_source" });
      continue;
    }

    let transformed: string;
    try {
      const source = await response.text();
      if (new TextEncoder().encode(source).byteLength > MAX_HTML_BYTES) {
        results.push({ filename, status: "invalid_source" });
        continue;
      }
      transformed = transformHtml(source);
    } catch {
      results.push({ filename, status: "transform_failed" });
      continue;
    }

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(`infothek/${filename}`, new Blob([transformed], { type: "text/html; charset=utf-8" }), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    results.push({ filename, status: uploadError ? "upload_failed" : "uploaded" });
  }

  const completed = results.every((result) => result.status === "uploaded");
  return jsonResponse(req, { results }, completed ? 200 : 207);
});
