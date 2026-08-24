import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("app settings access", () => {
  it("removes broad authenticated reads while preserving admin table access", () => {
    const migration = readSource("supabase/migrations/20260824103000_restrict_app_settings_authenticated.sql");

    expect(migration).toContain('DROP POLICY IF EXISTS "Authenticated can read app settings"');
    expect(migration).toContain("GRANT SELECT ON public.app_settings TO authenticated, service_role");
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*USING\s*\(true\)/i);
  });

  it("reads the patient login flag only through the public whitelist function", () => {
    const auth = readSource("src/pages/Auth.tsx");

    expect(auth).toContain("supabase.rpc('get_public_app_setting'");
    expect(auth).toContain("_key: 'patient_login_enabled'");
    expect(auth).not.toContain(".from('app_settings')");
  });
});
