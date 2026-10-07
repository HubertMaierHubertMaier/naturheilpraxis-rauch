import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { KRANKHEIT_IST_MESSBAR_CHANGES as CHANGES } from "@/lib/infothekComparisonChanges";

const original = readFileSync("website-content/infothek/krankheit-ist-messbar.html", "utf8");
const draft = readFileSync("website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html", "utf8");
const text = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent!.replace(/\s+/g, " ").trim();

it("keeps the original wording when nothing is accepted", () => {
  const { html, failed } = composeWorkingVersion(original, draft, CHANGES, new Set());
  expect(failed).toEqual([]);
  expect(text(html)).toBe(text(original));
});

it("applies every proposal and matches the draft text when all are accepted", () => {
  const { html, failed } = composeWorkingVersion(original, draft, CHANGES, new Set(CHANGES.map((c) => c.id)));
  expect(failed).toEqual([]);
  expect(text(html)).toBe(text(draft));
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.title).toBe(new DOMParser().parseFromString(draft, "text/html").title);
});

it("mixes original and accepted proposals", () => {
  const { html } = composeWorkingVersion(original, draft, CHANGES, new Set([17, 1]));
  const t = text(html);
  expect(t).not.toContain("Deshalb heilt Frequenztherapie");
  expect(t).toContain("kein Heilungsnachweis");
  expect(t).toContain("Carlo Rubbia & die Brücke zur Heilung");
  expect(t).toContain("Komplettes Körper-WLAN");
  expect(new DOMParser().parseFromString(html, "text/html").title).toContain("Frequenztherapie: Physik");
  expect(html).toContain("ARBEITSFASSUNG");
});
