import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("patient profile verification", () => {
  it("prevents self-service updates from changing verified-patient status", () => {
    const migration = readSource(
      "supabase/migrations/20260824124500_restrict_verified_patient_self_update.sql",
    );

    expect(migration).toContain('DROP POLICY IF EXISTS "Users can update their own profile"');
    expect(migration).toMatch(/WITH CHECK\s*\([\s\S]*auth\.uid\(\)[\s\S]*is_verified_patient\s*=\s*public\.is_verified_patient/i);
  });

  it("retains the trigger as a second admin-only safeguard", () => {
    const triggerMigration = readSource(
      "supabase/migrations/20260704095049_94efbf0b-76bc-4784-95b3-ab7b1795f004.sql",
    );

    expect(triggerMigration).toContain("Only admins may change is_verified_patient");
    expect(triggerMigration).toContain("BEFORE UPDATE OF is_verified_patient ON public.profiles");
  });
});
