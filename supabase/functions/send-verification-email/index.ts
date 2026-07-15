import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const allowedCorsHostnames = new Set([
  "naturheilpraxis-rauch.lovable.app",
  "rauch-heilpraktiker.de",
  "www.rauch-heilpraktiker.de",
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (origin) {
    try {
      const url = new URL(origin);
      const isLocalDev =
        (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        ["5173", "4173", "5174", "4174"].includes(url.port);
      if (
        isLocalDev ||
        allowedCorsHostnames.has(url.hostname) ||
        url.hostname.endsWith(".lovableproject.com") ||
        url.hostname.endsWith(".lovable.app")
      ) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
    } catch {
      // Invalid origins receive no CORS permission.
    }
  }

  return headers;
}

serve((req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(
    JSON.stringify({ error: "Dieser veraltete E-Mail-Endpunkt ist deaktiviert." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
