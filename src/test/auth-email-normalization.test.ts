import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/authEmail";

describe("normalizeEmail", () => {
  it("removes invisible formatting characters before validating an email", () => {
    expect(normalizeEmail("\u200B Info@Example.Test \uFEFF")).toBe("info@example.test");
  });
});
