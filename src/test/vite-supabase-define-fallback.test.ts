import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression test for the white-page incident (see
 * doc/20260607-white-page-after-phase-4-merge-analysis-pr-4.md).
 *
 * The production bundle must never ship a Supabase client initialized with
 * `void 0` / `undefined` for VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * We do NOT embed real secret values here. We only check the structural
 * guarantee in vite.config.ts: a deterministic, public, browser-safe fallback
 * is wired through `define` so that if the build environment lacks
 * VITE_SUPABASE_* variables, Vite still emits a real string literal instead of
 * `void 0`.
 *
 * Local/Lovable env values continue to take precedence; the fallback only
 * activates when env is missing.
 */
describe("vite.config.ts Supabase env fallback (white-page regression)", () => {
  const viteConfig = readFileSync(
    resolve(process.cwd(), "vite.config.ts"),
    "utf8",
  );

  it("defines a fallback for VITE_SUPABASE_URL", () => {
    expect(viteConfig).toMatch(/FALLBACK_SUPABASE_URL\s*=\s*"https:\/\/[^"]+\.supabase\.co"/);
    expect(viteConfig).toContain('"import.meta.env.VITE_SUPABASE_URL"');
  });

  it("defines a fallback for VITE_SUPABASE_PUBLISHABLE_KEY", () => {
    expect(viteConfig).toMatch(/FALLBACK_SUPABASE_PUBLISHABLE_KEY\s*=\s*\n?\s*"eyJ/);
    expect(viteConfig).toContain('"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"');
  });

  it("defines a fallback for VITE_SUPABASE_PROJECT_ID", () => {
    expect(viteConfig).toMatch(/FALLBACK_SUPABASE_PROJECT_ID\s*=\s*"[a-z0-9]+"/);
    expect(viteConfig).toContain('"import.meta.env.VITE_SUPABASE_PROJECT_ID"');
  });

  it("prefers env over fallback (env || FALLBACK pattern)", () => {
    // Ensures the fallback only activates when env is empty.
    expect(viteConfig).toMatch(/env\.VITE_SUPABASE_URL\s*\|\|\s*FALLBACK_SUPABASE_URL/);
    expect(viteConfig).toMatch(
      /env\.VITE_SUPABASE_PUBLISHABLE_KEY\s*\|\|\s*FALLBACK_SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(viteConfig).toMatch(
      /env\.VITE_SUPABASE_PROJECT_ID\s*\|\|\s*FALLBACK_SUPABASE_PROJECT_ID/,
    );
  });

  it("never replaces Supabase env with undefined/void 0 in the define block", () => {
    // Guard against accidental regressions like
    //   "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(undefined)
    // which is what produced `void 0` in the shipped bundle.
    expect(viteConfig).not.toMatch(
      /"import\.meta\.env\.VITE_SUPABASE_(URL|PUBLISHABLE_KEY|PROJECT_ID)"\s*:\s*JSON\.stringify\(\s*undefined\s*\)/,
    );
    expect(viteConfig).not.toMatch(
      /"import\.meta\.env\.VITE_SUPABASE_(URL|PUBLISHABLE_KEY|PROJECT_ID)"\s*:\s*"?void 0"?/,
    );
  });
});
