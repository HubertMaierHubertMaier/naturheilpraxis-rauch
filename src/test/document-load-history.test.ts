import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { contentDateLabel, documentLoadEntries, selectionTimestamp } from "../lib/documentLoadHistory";

describe("document load history", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  it("preserves five distinct loading dates for the same document without exposing its name", async () => {
    const file = { name: "private-test.pdf", arrayBuffer: async () => new TextEncoder().encode("synthetic file").buffer, documentType: "anamnese" };
    const events = await Promise.all([1, 2, 3, 4, 5].map(day => documentLoadEntries("test-scope", [file], `2026-09-0${day}T10:00:00Z`)));
    expect(new Set(events.map(e => e[0].loadedAt)).size).toBe(5);
    expect(new Set(events.map(e => e[0].documentKey)).size).toBe(1);
    expect(JSON.stringify(events)).not.toContain(file.name);
    const other = await documentLoadEntries("other-scope", [file], "2026-09-01T10:00:00Z");
    expect(other[0].documentKey).not.toBe(events[0][0].documentKey);
  });
  it("recognizes the same bytes after renaming and distinguishes changed bytes", async () => {
    const file = (text: string) => ({ documentType: "labor", arrayBuffer: async () => new TextEncoder().encode(text).buffer });
    const a = await documentLoadEntries("scope", [file("one"), file("two"), file("one")], "2026-09-25T10:00:00Z");
    expect(a[0].documentKey).toBe(a[2].documentKey);
    expect(a[0].documentKey).not.toBe(a[1].documentKey);
  });
  it("keeps actual-document labels separate and covers each category", () => {
    expect(contentDateLabel("anamnese")).toBe("Anamnesedatum");
    for (const type of ["labor", "metatron", "vieva", "arzt"]) expect(contentDateLabel(type)).toBe("Befunddatum");
    expect(contentDateLabel("")).toBe("Dokumentdatum");
  });
  it("uses explicit loading time, preserves legacy times and rejects UUID date guesses", () => {
    const time = Date.parse("2026-09-24T15:08:00Z");
    expect(selectionTimestamp({ id: `${time.toString(36)}-0-test.pdf` })).toBe(time);
    expect(selectionTimestamp({ id: "anything", loadedAt: "2026-09-24T15:08:00Z" })).toBe(time);
    expect(selectionTimestamp({ id: "deadbeef-1234-1234-1234-123456789012" })).toBeUndefined();
    expect(selectionTimestamp({ id: "bad", loadedAt: "not-a-date" })).toBeUndefined();
  });
});
