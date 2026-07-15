-- Public pages only need the gating decision, never the admin user identifier.
REVOKE SELECT ON public.infothek_gating FROM anon, authenticated;
GRANT SELECT (href, gated, visibility) ON public.infothek_gating TO anon, authenticated;
GRANT SELECT ON public.infothek_gating TO service_role;