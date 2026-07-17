import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const ALLOWED_ROUTE_SET = new Set<string>(INFOTHEK_ROUTES);
const PATIENT_ONLY_ROUTES = new Set<string>([
  "/allergiebehandlung.html",
  "/candida-diaet.html",
  "/kraeuter-schmerz-entzuendung.html",
  "/patienteninfo-hochohmiges-wasser.html",
  "/sibo-duenndarmfehlbesiedlung.html",
]);
const ADMIN_ONLY_ROUTES = new Set<string>([
  "/datenschutz-fahrplan.html",
]);

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "app.rauch-heilpraktiker.de",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

type Visibility = "public" | "new_patient" | "patient" | "internal";

const VISIBILITY_RANK: Record<Visibility, number> = {
  public: 0,
  new_patient: 1,
  patient: 2,
  internal: 3,
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };

  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }

  return headers;
}

function responseHeaders(req: Request): Record<string, string> {
  return {
    ...getCorsHeaders(req),
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function getRequestedRoute(req: Request): string | null {
  const url = new URL(req.url);
  const queryPaths = url.searchParams.getAll("path");
  if (queryPaths.length > 0) {
    return queryPaths.length === 1 ? queryPaths[0] : null;
  }

  if (ALLOWED_ROUTE_SET.has(url.pathname)) {
    return url.pathname;
  }

  for (const prefix of ["/functions/v1/get-infothek-html", "/get-infothek-html"]) {
    if (url.pathname.startsWith(`${prefix}/`)) {
      return url.pathname.slice(prefix.length);
    }
  }

  return null;
}

function fallbackVisibility(route: string): Visibility {
  if (ADMIN_ONLY_ROUTES.has(route)) return "internal";
  if (PATIENT_ONLY_ROUTES.has(route)) return "patient";
  return "public";
}

function configuredVisibility(value: unknown): Visibility | null {
  if (value === null || value === undefined) return null;
  if (value === "public" || value === "new_patient" || value === "patient" || value === "internal") {
    return value;
  }
  return "internal";
}

function effectiveVisibility(route: string, configured: unknown): Visibility {
  const fallback = fallbackVisibility(route);
  const override = configuredVisibility(configured);
  if (!override || VISIBILITY_RANK[fallback] >= VISIBILITY_RANK[override]) {
    return fallback;
  }
  return override;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(req) });
  }
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const route = getRequestedRoute(req);
  if (!route || !ALLOWED_ROUTE_SET.has(route)) {
    return jsonResponse(req, { error: "Not found" }, 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: gatingRow, error: gatingError } = await publicClient
    .from("infothek_gating")
    .select("visibility")
    .eq("href", route)
    .maybeSingle();

  if (gatingError) {
    return jsonResponse(req, { error: "Visibility could not be checked" }, 503);
  }

  const visibility = effectiveVisibility(route, gatingRow?.visibility);
  let authorized = visibility === "public";

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
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

    const { data: twoFactorCompleted, error: twoFactorError } = await userClient.rpc(
      "is_current_session_two_factor_completed",
    );
    if (twoFactorError) {
      return jsonResponse(req, { error: "Two-factor status could not be checked" }, 503);
    }
    if (twoFactorCompleted !== true) {
      return jsonResponse(req, { error: "Two-factor authentication required" }, 403);
    }

    if (visibility === "new_patient") {
      authorized = true;
    } else {
      const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (roleError) {
        return jsonResponse(req, { error: "Role could not be checked" }, 503);
      }

      if (visibility === "internal" || isAdmin === true) {
        authorized = isAdmin === true;
      } else if (!user.email) {
        authorized = false;
      } else {
        const email = user.email.trim().toLowerCase();
        const { data: accessRow, error: accessError } = await userClient
          .from("patient_access")
          .select("infothek_all,infothek_items")
          .eq("email", email)
          .maybeSingle();

        if (accessError) {
          return jsonResponse(req, { error: "Patient access could not be checked" }, 503);
        }

        const allowedItems = Array.isArray(accessRow?.infothek_items)
          ? accessRow.infothek_items
          : [];
        authorized = accessRow?.infothek_all === true || allowedItems.includes(route);
      }
    }
  }

  if (!authorized) {
    return jsonResponse(req, { error: "Forbidden" }, 403);
  }

  // The service role is created only after the route and caller authorization checks.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const filename = route.slice(1);
  const { data: htmlObject, error: downloadError } = await serviceClient.storage
    .from("patient-library")
    .download(`infothek/${filename}`);

  if (downloadError || !htmlObject) {
    return jsonResponse(req, { error: "Document unavailable" }, 404);
  }

  const html = await htmlObject.text();
  return new Response(html, {
    status: 200,
    headers: {
      ...responseHeaders(req),
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
