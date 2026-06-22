import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") ?? "";
  return new Response(
    JSON.stringify({ siteKey }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
