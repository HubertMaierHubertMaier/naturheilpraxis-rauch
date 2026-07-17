import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const websiteSource = resolve(root, "website-content/infothek");
const sourceHtmlFiles = readdirSync(websiteSource).filter((file) => file.endsWith(".html"));
const internalSource = resolve(root, "protected-content/internal/datenschutz-fahrplan.html");
const manifest = JSON.parse(
  readFileSync(resolve(websiteSource, "manifest.json"), "utf8"),
) as {
  publicOrigin: string;
  pages: Array<{
    file: string;
    visibility: "public" | "patient";
    targetPath: string | null;
    reviewStatus: string;
    indexable: boolean;
  }>;
};

describe("Infothek indexing policy", () => {
  it("replaces retained public HTML paths with noindex redirect stubs", () => {
    const publicHtmlFiles = readdirSync(resolve(root, "public")).filter((file) => file.endsWith(".html"));
    expect(publicHtmlFiles.sort()).toEqual(
      [...sourceHtmlFiles, "datenschutz-fahrplan.html"].sort(),
    );
    for (const file of publicHtmlFiles) {
      const html = readFileSync(resolve(root, "public", file), "utf8");
      expect(Buffer.byteLength(html)).toBeLessThan(1_000);
      expect(html).toMatch(/<meta name="robots" content="noindex, nofollow">/);
      expect(html).toContain(`url=/infothek-dokument/${file.replace(/\.html$/, "")}`);
      expect(html).not.toMatch(
        /(?:infothek-gate|content-protection)\.js|fonts\.(?:googleapis|gstatic)\.com|cdn\./,
      );
    }
    expect(existsSync(resolve(root, "public/infothek-gate.js"))).toBe(false);
    expect(existsSync(resolve(root, "public/content-protection.js"))).toBe(false);
  });

  it("keeps all 17 website source pages outside public hosting", () => {
    expect(sourceHtmlFiles).toHaveLength(17);
    expect(existsSync(internalSource)).toBe(true);
  });

  it("classifies every source page and keeps it on review hold", () => {
    expect(manifest.pages.map((page) => page.file).sort()).toEqual(sourceHtmlFiles.sort());
    expect(manifest.pages.every((page) => page.reviewStatus === "pending")).toBe(true);
    expect(manifest.pages.every((page) => page.indexable === false)).toBe(true);
  });

  it("gives every future public page one canonical target and named author", () => {
    for (const page of manifest.pages.filter((entry) => entry.visibility === "public")) {
      expect(page.targetPath).toMatch(/^\/[a-z0-9/-]+$/);
      const html = readFileSync(resolve(websiteSource, page.file), "utf8");
      expect(html).toContain(
        `<link rel="canonical" href="${manifest.publicOrigin}${page.targetPath}"`,
      );
      expect(html).toMatch(/<meta name="author" content="[^"]+"\s*\/?>/);
    }
  });

  it.each(sourceHtmlFiles)("keeps website source page %s at noindex before review", (file) => {
    const html = readFileSync(resolve(websiteSource, file), "utf8");
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
  });

  it("marks the app shell and internal source as noindex", () => {
    const appShell = readFileSync(resolve(root, "index.html"), "utf8");
    expect(appShell).toMatch(
      /<meta name="robots" content="noindex, nofollow"\s*\/?>/,
    );
    expect(appShell).not.toMatch(/<link rel="canonical"/);
    expect(readFileSync(internalSource, "utf8")).toMatch(
      /<meta name="robots" content="noindex, nofollow"\s*\/?>/,
    );
    expect(readFileSync(internalSource, "utf8")).not.toMatch(
      /(?:infothek-gate|content-protection)\.js/,
    );
  });

  it("publishes only an empty app sitemap tombstone", () => {
    const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
    expect(sitemap).toMatch(/<urlset\b/);
    expect(sitemap).not.toMatch(/<url>|<loc>/);
    const robots = readFileSync(resolve(root, "public/robots.txt"), "utf8");
    expect(robots).not.toMatch(/^Sitemap:/m);
  });

  it.each(sourceHtmlFiles)("does not load presentation assets from third-party CDNs in %s", (file) => {
    const html = readFileSync(resolve(websiteSource, file), "utf8");
    expect(html).not.toMatch(
      /fonts\.(?:googleapis|gstatic)\.com|cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/reveal\.js|cdn\.jsdelivr\.net\/npm\/reveal\.js|(?:infothek-gate|content-protection)\.js/,
    );
    expect(html).not.toMatch(/user-select:\s*none|@media print\s*\{\s*body\s*\{\s*display:\s*none/);
  });
});
