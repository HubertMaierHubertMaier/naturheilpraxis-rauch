import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WikiSourceContent, readableWikiStatus } from "@/components/wiki/WikiSourceContent";

it("renders all source sections as headings and preserves body, lists, and literal code", () => {
  const content = "## Quellenaussage\n\nVollständiger Beispieltext.\n\n## Genaue Fundstelle\n\n- Skript, Seite 8\n- Zweite Fundstelle\n\n`## bleibt im Code`";
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<WikiSourceContent content={content} />);
  expect([...host.querySelectorAll("h2")].map(h => h.textContent)).toEqual(["Quellenaussage", "Genaue Fundstelle"]);
  expect(host.textContent).toContain("Vollständiger Beispieltext.");
  expect(host.querySelectorAll("li")).toHaveLength(2);
  expect(host.querySelector("code")?.textContent).toBe("## bleibt im Code");
});

it("does not execute imported HTML or load remote images merely by rendering a source", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<WikiSourceContent content={'<script>alert(1)</script>\n\n[unsafe](javascript:alert)\n\n![Diagramm](https://example.invalid/image.png)'} />);
  expect(host.querySelector("script")).toBeNull();
  expect(host.querySelector("img")).toBeNull();
  expect([...host.querySelectorAll("a")].some(a => a.getAttribute("href")?.startsWith("javascript:"))).toBe(false);
  const imageLink = [...host.querySelectorAll("a")].find(a => a.textContent === "Bildquelle öffnen");
  expect(imageLink?.getAttribute("href")).toBe("https://example.invalid/image.png");
  expect(imageLink?.getAttribute("rel")).toContain("noopener");
});

it("explains known status codes without changing or hiding unknown source metadata", () => {
  expect(readableWikiStatus("reference")).toBe("Quelleneintrag");
  expect(readableWikiStatus("draft")).toBe("Entwurf – noch nicht geprüft");
  expect(readableWikiStatus("unrated")).toBe("Noch nicht bewertet");
  expect(readableWikiStatus("unverified")).toBe("Noch nicht geprüft");
  expect(readableWikiStatus("custom-original-status")).toBe("custom-original-status");
});
