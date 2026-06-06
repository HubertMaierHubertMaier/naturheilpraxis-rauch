import { describe, expect, it } from "vitest";
import { isDevAdminBypassAllowedHost } from "@/lib/devAdminBypass";

describe("Dev-Admin-Bypass host policy", () => {
  it("allows the bypass only for explicit local Vite development hosts", () => {
    expect(isDevAdminBypassAllowedHost("localhost", true)).toBe(true);
    expect(isDevAdminBypassAllowedHost("127.0.0.1", true)).toBe(true);
    expect(isDevAdminBypassAllowedHost("::1", true)).toBe(true);
  });

  it("does not allow the bypass on Lovable preview or published hosts", () => {
    expect(isDevAdminBypassAllowedHost("id-preview--example.lovableproject.com", false)).toBe(false);
    expect(isDevAdminBypassAllowedHost("preview.naturheilpraxis-rauch.example", false)).toBe(false);
    expect(isDevAdminBypassAllowedHost("naturheilpraxis-rauch.lovable.app", false)).toBe(false);
    expect(isDevAdminBypassAllowedHost("rauch-heilpraktiker.de", false)).toBe(false);
    expect(isDevAdminBypassAllowedHost("www.rauch-heilpraktiker.de", false)).toBe(false);
  });

  it("does not allow non-local hosts even when a dev build is served on the network", () => {
    expect(isDevAdminBypassAllowedHost("192.168.0.42", true)).toBe(false);
    expect(isDevAdminBypassAllowedHost("praxis-laptop.local", true)).toBe(false);
  });

  it("does not allow local hosts for production preview builds", () => {
    expect(isDevAdminBypassAllowedHost("localhost", false)).toBe(false);
    expect(isDevAdminBypassAllowedHost("127.0.0.1", false)).toBe(false);
  });
});
