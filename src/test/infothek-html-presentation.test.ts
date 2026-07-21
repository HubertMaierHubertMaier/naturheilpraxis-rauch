import { describe, expect, it } from "vitest";
import { prepareInfothekHtmlForFrame } from "@/lib/infothekHtmlPresentation";

describe("Infothek HTML frame presentation", () => {
  const revealHtml = `<!doctype html>
<html>
  <head><link rel="stylesheet" href="/vendor/infothek-fonts.css"></head>
  <body>
    <div class="reveal"><div class="slides"><section><p>Medizinischer Text</p><img src='bilder/test.jpg'></section></div></div>
    <script src="/content-protection.js"></script>
    <script>Reveal.initialize({ hash: true, controls: true });</script>
  </body>
</html>`;

  it("adapts technical frame behavior without changing article text", () => {
    const result = prepareInfothekHtmlForFrame(revealHtml);

    expect(result).toContain("<p>Medizinischer Text</p>");
    expect(result).toContain("src='/bilder/test.jpg'");
    expect(result).toContain("hash: false");
    expect(result).not.toContain("content-protection.js");
    expect(result).not.toContain("infothek-fonts.css");
    expect(result).toContain('id="infothek-zoom-controls"');
    expect(result).toContain("A-");
    expect(result).toContain("A+");
  });

  it("adds the controls only once", () => {
    const result = prepareInfothekHtmlForFrame(prepareInfothekHtmlForFrame(revealHtml));
    expect(result.match(/id="infothek-zoom-controls"/g)).toHaveLength(1);
  });

  it("does not add presentation controls to non-Reveal documents", () => {
    const result = prepareInfothekHtmlForFrame("<html><body><p>Text</p></body></html>");
    expect(result).toBe("<html><body><p>Text</p></body></html>");
  });
});
