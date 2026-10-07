import { readFileSync } from "node:fs";
import { it } from "vitest";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { KRANKHEIT_IST_MESSBAR_CHANGES as C } from "@/lib/infothekComparisonChanges";
it("d", () => {
  const o = readFileSync("website-content/infothek/krankheit-ist-messbar.html", "utf8");
  const d = readFileSync("website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html", "utf8");
  const t = (h: string) => new DOMParser().parseFromString(h, "text/html").body.textContent!.replace(/\s+/g, "");
  const a = t(composeWorkingVersion(o, d, C, new Set(C.map(c=>c.id))).html), b = t(d);
  let i = 0; while (a[i] === b[i]) i++;
  console.log("DIFF", i, a.slice(i-80,i+80), "\n----\n", b.slice(i-80,i+80));
});
