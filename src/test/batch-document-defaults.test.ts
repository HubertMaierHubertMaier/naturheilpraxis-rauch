import { afterEach, describe, expect, it, vi } from "vitest";
import { inferDocumentDateFromFilename, readVievaPdfPassword, rememberVievaPdfPassword } from "../lib/batchDocumentDefaults";
afterEach(() => { localStorage.clear(); vi.useRealTimers(); });
describe("general batch document defaults", () => {
  it("infers distinct formats independently of a patient identifier", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
    expect(inferDocumentDateFromFilename("P-2030-1234 Hospital 29_04_2026.pdf")).toBe("2026-04-29");
    expect(inferDocumentDateFromFilename("Hospital 29_04_26.pdf")).toBe("2026-04-29");
    expect(inferDocumentDateFromFilename("Vieva Vergleich_2026-06-25.pdf")).toBe("2026-06-25");
    expect(inferDocumentDateFromFilename("Labor 16.07.2026.pdf")).toBe("2026-07-16");
  });
  it("does not guess from invalid, absent or conflicting dates", () => {
    expect(inferDocumentDateFromFilename("P-2026-0001.pdf")).toBe("");
    expect(inferDocumentDateFromFilename("Labor_31_02_2026.pdf")).toBe("");
    expect(inferDocumentDateFromFilename("Vergleich_2026-06-25_2026-07-16.pdf")).toBe("");
  });
  it("retains only the locally supplied PDF password across patient changes", () => {
    expect(readVievaPdfPassword()).toBe("");
    rememberVievaPdfPassword("synthetic-pdf-setting");
    expect(readVievaPdfPassword()).toBe("synthetic-pdf-setting");
    rememberVievaPdfPassword("");
    expect(readVievaPdfPassword()).toBe("");
  });
});
